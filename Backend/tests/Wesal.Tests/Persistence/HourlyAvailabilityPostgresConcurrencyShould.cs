using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.Bookings;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;
using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Persistence;

/// <summary>
/// PostgreSQL-only regression checks for the common Hall-row serialization lock.
/// Set WESAL_TEST_PG to an explicitly disposable PostgreSQL connection string. Each
/// test creates and drops a uniquely named database; it never uses the supplied
/// database itself for application data.
/// </summary>
public sealed class HourlyAvailabilityPostgresConcurrencyShould
{
    [PostgresFact]
    public async Task BookingWaitingBehindDayBlock_ObservesTheCommittedBlock()
    {
        await using var database = await TestDatabase.CreateAsync();
        var hallId = await database.SeedHallAsync();
        var date = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(2);

        await using var blocker = database.CreateContext("day-block-writer");
        await using var blockerTx = await blocker.Database.BeginTransactionAsync();
        Assert.True(await new BookingRepository(blocker).LockHallForAvailabilityChangeAsync(hallId));
        await new BookingRepository(blocker).SetDayOpenAsync(hallId, date, false);

        await using var bookingOperation = database.CreateBookingOperation("booking-writer");
        var create = bookingOperation.Service.CreateHourlyBookingAsync(new HourlyBookingRequestDto
        {
            HallId = hallId,
            Date = date,
            SlotStarts = [new TimeOnly(10, 0)],
            NameOnBooking = "Concurrent requester",
            RequesterName = "Concurrent requester"
        });
        await database.WaitUntilBlockedByLockAsync("booking-writer");
        await blockerTx.CommitAsync();
        await Assert.ThrowsAsync<Wesal.Domain.Exceptions.ConflictException>(() => create);

        await using var verify = database.CreateContext("day-block-verifier");
        Assert.False(await new BookingRepository(verify).IsDayOpenAsync(hallId, date));
        Assert.Empty(await verify.Bookings.Where(x => x.HallId == hallId && x.Date == date).ToListAsync());
    }

    [PostgresFact]
    public async Task BookingWaitingBehindWindowChange_ObservesTheCommittedWindow()
    {
        await using var database = await TestDatabase.CreateAsync();
        var hallId = await database.SeedHallAsync();
        var date = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(2);

        await using var reservation = database.CreateContext("booking-writer");
        await using var reservationTx = await reservation.Database.BeginTransactionAsync();
        Assert.True(await new BookingRepository(reservation).LockHallForAvailabilityChangeAsync(hallId));
        var repo = new BookingRepository(reservation);
        Assert.Equal(1, await repo.ReserveHourlySlotsAsync(hallId, date, [new TimeOnly(17, 0)]));
        await repo.AddAsync(CreateBooking(hallId, date, new TimeOnly(17, 0)));

        await using var ownerOperation = database.CreateOwnerAvailabilityOperation("window-writer");
        var update = ownerOperation.Service.UpdateHourlySettingsAsync(hallId, new UpdateOwnerHourlySettingsRequest
        {
            HourlySlotEnd = new TimeOnly(16, 0)
        });
        await database.WaitUntilBlockedByLockAsync("window-writer");
        await reservationTx.CommitAsync();
        await Assert.ThrowsAsync<Wesal.Domain.Exceptions.ConflictException>(() => update);

        await using var verify = database.CreateContext("window-verifier");
        Assert.Equal(new TimeOnly(18, 0), (await verify.Halls.AsNoTracking().SingleAsync(x => x.Id == hallId)).HourlySlotEnd);
        var booking = Assert.Single(await verify.Bookings.Include(x => x.Slots).Where(x => x.HallId == hallId && x.Date == date).ToListAsync());
        Assert.Equal(BookingStatus.Pending, booking.Status);
        Assert.Equal(HallSlotStatus.Reserved, (await verify.HallSlotAvailabilities.SingleAsync()).Status);
    }

    private static Booking CreateBooking(Guid hallId, DateOnly date, TimeOnly start) => new()
    {
        HallId = hallId,
        RequesterUserId = "integration-seeker",
        Date = date,
        NameOnBooking = "PostgreSQL concurrency test",
        Status = BookingStatus.Pending,
        Slots = [new BookingSlot { StartTime = start, EndTime = start.AddHours(1) }]
    };

    private sealed class TestDatabase : IAsyncDisposable
    {
        private readonly string _adminConnectionString;
        private readonly string _databaseName;
        private readonly string _testConnectionString;

        private TestDatabase(string adminConnectionString, string databaseName, string testConnectionString)
            => (_adminConnectionString, _databaseName, _testConnectionString) = (adminConnectionString, databaseName, testConnectionString);

        public static async Task<TestDatabase> CreateAsync()
        {
            var configured = Environment.GetEnvironmentVariable("WESAL_TEST_PG");
            if (string.IsNullOrWhiteSpace(configured))
                throw new InvalidOperationException("PostgreSQL test connection was not configured.");

            var admin = new Npgsql.NpgsqlConnectionStringBuilder(configured);
            if (!IsLoopbackHost(admin.Host ?? string.Empty))
                throw new InvalidOperationException("PostgreSQL concurrency tests only allow localhost/loopback hosts.");

            admin.Database = "postgres";
            var name = $"wesal_concurrency_{Guid.NewGuid():N}";
            await using (var connection = new Npgsql.NpgsqlConnection(admin.ConnectionString))
            {
                await connection.OpenAsync();
                await using var create = connection.CreateCommand();
                create.CommandText = $"CREATE DATABASE \"{name}\"";
                await create.ExecuteNonQueryAsync();
            }

            var test = new Npgsql.NpgsqlConnectionStringBuilder(configured) { Database = name, Pooling = false };
            return new TestDatabase(admin.ConnectionString, name, test.ConnectionString);
        }

        private static bool IsLoopbackHost(string host)
            => host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
                || host.Equals("127.0.0.1", StringComparison.Ordinal)
                || host.Equals("::1", StringComparison.Ordinal);

        public ApplicationDbContext CreateContext(string appName)
        {
            var builder = new Npgsql.NpgsqlConnectionStringBuilder(_testConnectionString) { ApplicationName = appName };
            var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseNpgsql(builder.ConnectionString).Options;
            return new ApplicationDbContext(options);
        }

        public async Task<Guid> SeedHallAsync()
        {
            await using var context = CreateContext("seed");
            await context.Database.EnsureCreatedAsync();
            context.Users.Add(new ApplicationUser
            {
                Id = "integration-owner",
                UserName = "integration-owner",
                NormalizedUserName = "INTEGRATION-OWNER",
                Email = "integration-owner@test.local",
                NormalizedEmail = "INTEGRATION-OWNER@TEST.LOCAL",
                FullName = "Integration Owner"
            });
            var hall = new Hall
            {
                Name = "Concurrency hall",
                Address = "Gaza",
                Capacity = 100,
                OwnerId = "integration-owner",
                Status = HallStatus.Approved,
                PaymentStatus = HallPaymentStatus.Paid,
                HourlySlotStart = new TimeOnly(9, 0),
                HourlySlotEnd = new TimeOnly(18, 0)
            };
            context.Halls.Add(hall);
            await context.SaveChangesAsync();
            return hall.Id;
        }

        public ServiceOperation<HourlySlotService> CreateBookingOperation(string appName)
        {
            var operation = CreateServiceOperation(appName);
            var current = new TestCurrentUser("integration-seeker", ApplicationRoles.RegisteredUser);
            var service = new HourlySlotService(
                new HallRepository(operation.Context),
                new BookingRepository(operation.Context),
                new UnitOfWork(operation.Context),
                current,
                new RecordingOwnerBookingRequestNotifier(),
                new RecordingNotificationDispatcher());
            return new ServiceOperation<HourlySlotService>(operation.Provider, operation.Scope, operation.Context, service);
        }

        public ServiceOperation<OwnerHourlyAvailabilityService> CreateOwnerAvailabilityOperation(string appName)
        {
            var operation = CreateServiceOperation(appName);
            var service = new OwnerHourlyAvailabilityService(
                operation.Provider.GetRequiredService<UserManager<ApplicationUser>>(),
                new TestCurrentUser("integration-owner", ApplicationRoles.HallOwner),
                new OwnerDashboardRepository(operation.Context),
                new BookingRepository(operation.Context),
                new UnitOfWork(operation.Context));
            return new ServiceOperation<OwnerHourlyAvailabilityService>(operation.Provider, operation.Scope, operation.Context, service);
        }

        private (ServiceProvider Provider, IServiceScope Scope, ApplicationDbContext Context) CreateServiceOperation(string appName)
        {
            var services = new ServiceCollection();
            services.AddLogging();
            var builder = new Npgsql.NpgsqlConnectionStringBuilder(_testConnectionString) { ApplicationName = appName };
            services.AddDbContext<ApplicationDbContext>(options => options.UseNpgsql(builder.ConnectionString));
            services.AddIdentityCore<ApplicationUser>().AddRoles<ApplicationRole>().AddEntityFrameworkStores<ApplicationDbContext>();
            var provider = services.BuildServiceProvider();
            var scope = provider.CreateScope();
            return (provider, scope, scope.ServiceProvider.GetRequiredService<ApplicationDbContext>());
        }

        public async Task WaitUntilBlockedByLockAsync(string applicationName)
        {
            await using var connection = new Npgsql.NpgsqlConnection(_testConnectionString);
            await connection.OpenAsync();
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            while (!timeout.IsCancellationRequested)
            {
                await using var command = connection.CreateCommand();
                command.CommandText = "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name = @app AND wait_event_type = 'Lock' AND cardinality(pg_blocking_pids(pid)) > 0)";
                command.Parameters.AddWithValue("app", applicationName);
                if ((bool)(await command.ExecuteScalarAsync(timeout.Token) ?? false))
                    return;

                await Task.Delay(20, timeout.Token);
            }

            throw new TimeoutException($"Connection '{applicationName}' did not enter a PostgreSQL lock wait.");
        }

        public async ValueTask DisposeAsync()
        {
            Npgsql.NpgsqlConnection.ClearAllPools();
            await using var connection = new Npgsql.NpgsqlConnection(_adminConnectionString);
            await connection.OpenAsync();
            await using var drop = connection.CreateCommand();
            drop.CommandText = $"DROP DATABASE IF EXISTS \"{_databaseName}\" WITH (FORCE)";
            await drop.ExecuteNonQueryAsync();
        }
    }

    private sealed class PostgresFactAttribute : FactAttribute
    {
        public PostgresFactAttribute()
        {
            if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("WESAL_TEST_PG")))
                Skip = "Set WESAL_TEST_PG to run PostgreSQL concurrency integration tests.";
        }
    }

    private sealed class TestCurrentUser(string userId, string role) : ICurrentUserService
    {
        public string? UserId => userId;
        public string? UserName => userId;
        public string? Email => $"{userId}@test.local";
        public bool IsAuthenticated => true;
        public IReadOnlyList<string> Roles => [role];
    }

    private sealed class ServiceOperation<TService>(ServiceProvider provider, IServiceScope scope, ApplicationDbContext context, TService service) : IAsyncDisposable
    {
        public ApplicationDbContext Context { get; } = context;
        public TService Service { get; } = service;
        public async ValueTask DisposeAsync()
        {
            scope.Dispose();
            await provider.DisposeAsync();
        }
    }
}
