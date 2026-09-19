using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Wesal.API.Controllers;
using Wesal.API.Filters;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.Halls;
using Wesal.Persistence.Data;

namespace Wesal.Tests.Api;

public sealed class CreateHallPipelineShould : IAsyncDisposable
{
    private readonly WebApplication _app;
    private readonly HttpClient _client;
    private readonly ApplicationDbContext _context;
    private readonly IHallMediaStorage _mediaStorage;

    public CreateHallPipelineShould()
    {
        var services = new ServiceCollection();
        services.AddLogging();

        services.AddControllers(options => options.Filters.Add<ValidateActionFilter>())
            .AddApplicationPart(typeof(OwnerController).Assembly)
            .AddJsonOptions(options =>
                options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));

        services.AddApiVersioning(options =>
        {
            options.DefaultApiVersion = new Asp.Versioning.ApiVersion(1, 0);
            options.AssumeDefaultVersionWhenUnspecified = true;
            options.ReportApiVersions = true;
        }).AddMvc();

        services.AddAuthentication(TestAuthHandler.SchemeName)
            .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });

        services.AddAuthorization(options =>
        {
            options.AddPolicy(ApplicationPolicies.RequireAdmin, policy => policy.RequireRole(ApplicationRoles.Admin));
            options.AddPolicy(ApplicationPolicies.RequireHallOwner, policy => policy.RequireRole(ApplicationRoles.HallOwner));
            options.AddPolicy(ApplicationPolicies.RequireRegisteredUser, policy =>
                policy.RequireRole(ApplicationRoles.RegisteredUser, ApplicationRoles.HallOwner, ApplicationRoles.Admin));
            options.AddPolicy(ApplicationPolicies.RequireAuthenticatedUser, policy => policy.RequireAuthenticatedUser());
        });

        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["AllowedHosts"] = "*",
            ["HostFiltering:AllowedHosts"] = "*"
        });
        foreach (var descriptor in services)
        {
            builder.Services.Add(descriptor);
        }

        var inMemoryRoot = new Microsoft.EntityFrameworkCore.Storage.InMemoryDatabaseRoot();
        builder.Services.AddDbContext<ApplicationDbContext>(o => o.UseInMemoryDatabase(nameof(CreateHallPipelineShould), inMemoryRoot));
        builder.Services.AddScoped<ICurrentUserService>(_ => new FakeCurrentUser());
        builder.Services.AddScoped<IHallRepository, TestInMemoryHallRepository>();
        builder.Services.AddScoped<IUnitOfWork, TestInMemoryUnitOfWork>();
        builder.Services.AddSingleton<IHallMediaStorage>(new FakeHallMediaStorage());
        builder.Services.AddScoped<IHallCreationService, HallCreationService>();
        builder.Services.AddScoped<IOwnerSidebarService, StubOwnerSidebarService>();
        builder.Services.AddScoped<IHallInitiationService, StubHallInitiationService>();
        builder.Services.AddScoped<IHallStatusTrackingService, StubHallStatusTrackingService>();
        builder.Services.AddScoped<IOwnerHallService, StubOwnerHallService>();
        builder.Services.AddScoped<IOwnerBookingRequestsService, StubOwnerBookingRequestsService>();
        builder.Services.AddScoped<IOwnerAvailabilityService, StubOwnerAvailabilityService>();
        builder.Services.AddScoped<IHallSubscriptionService, StubHallSubscriptionService>();

        _app = builder.Build();
        _app.UseMiddleware<Wesal.Infrastructure.Middleware.GlobalExceptionHandlingMiddleware>();
        _app.UseAuthentication();
        _app.UseAuthorization();
        _app.MapControllers();
        _app.StartAsync().GetAwaiter().GetResult();

        _client = _app.GetTestClient();
        _client.DefaultRequestHeaders.Add(TestAuthHandler.HeaderName, "test-token");
        _context = _app.Services.CreateScope().ServiceProvider.GetRequiredService<ApplicationDbContext>();
        _mediaStorage = _app.Services.GetRequiredService<IHallMediaStorage>();
    }

    [Fact]
    public async Task ValidMultipart_Returns201AndPersistsHall()
    {
        using var content = new MultipartFormDataContent();
        content.Add(new StringContent("Test Wedding Hall"), "name");
        content.Add(new StringContent("+972599123456"), "contactPhone");
        content.Add(new StringContent("Gaza"), "region");
        content.Add(new StringContent("Gaza City, Main Street"), "address");
        content.Add(new StringContent("Elegant hall for weddings"), "description");
        content.Add(new StringContent("300"), "capacity");
        content.Add(new StringContent("1000"), "price");
        content.Add(new StringContent("initiation-id-123"), "initiationId");
        content.Add(new StringContent("08:00"), "firstPeriodStart");
        content.Add(new StringContent("14:00"), "firstPeriodEnd");
        content.Add(new StringContent("15:00"), "secondPeriodStart");
        content.Add(new StringContent("22:00"), "secondPeriodEnd");

        var response = await _client.PostAsync("/api/v1/owner/halls", content);

        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.Created, $"Expected 201 but got {response.StatusCode}: {body}");

        var hall = await _context.Halls.Include(h => h.BookingPeriods).SingleOrDefaultAsync();
        Assert.True(hall is not null, $"Location={response.Headers.Location}");
        Assert.Equal("owner-1", hall!.OwnerId);
        Assert.Equal(HallStatus.PendingReview, hall.Status);
        Assert.Equal(2, hall.BookingPeriods.Count);
        Assert.Equal("Gaza", hall.Region.ToString());
    }

    [Fact]
    public async Task ValidMultipart_WithPhoto_Returns201()
    {
        using var content = new MultipartFormDataContent();
        content.Add(new StringContent("Test Wedding Hall"), "name");
        content.Add(new StringContent("+972599123456"), "contactPhone");
        content.Add(new StringContent("Gaza"), "region");
        content.Add(new StringContent("Gaza City, Main Street"), "address");
        content.Add(new StringContent("Elegant hall for weddings"), "description");
        content.Add(new StringContent("300"), "capacity");
        content.Add(new StringContent("08:00"), "firstPeriodStart");
        content.Add(new StringContent("14:00"), "firstPeriodEnd");
        content.Add(new StringContent("15:00"), "secondPeriodStart");
        content.Add(new StringContent("22:00"), "secondPeriodEnd");

        var photoBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0x00, 0x00, 0x00 };
        var photoContent = new ByteArrayContent(photoBytes);
        photoContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        photoContent.Headers.ContentDisposition = new ContentDispositionHeaderValue("form-data")
        {
            Name = "photos",
            FileName = "cover.jpg",
            FileNameStar = "cover.jpg"
        };
        content.Add(photoContent, "photos", "cover.jpg");

        var response = await _client.PostAsync("/api/v1/owner/halls", content);

        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.Created, $"Expected 201 but got {response.StatusCode}: {body}");
        Assert.True(response.Headers.Location is not null, "Expected a Location header.");
        var hall = await _context.Halls.Include(h => h.Images).SingleOrDefaultAsync();
        Assert.NotNull(hall);
        Assert.Single(hall!.Images);

        var imageUrl = hall.Images.Single().Url;
        var fileName = Path.GetFileName(imageUrl);
        var diskPath = Path.Combine(_mediaStorage.HallsUploadDirectory(hall.Id), fileName);
        Assert.True(File.Exists(diskPath), $"Expected photo file on disk at {diskPath}");
    }

    [Fact]
    public async Task MalformedTime_Returns400()
    {
        using var content = new MultipartFormDataContent();
        content.Add(new StringContent("Test Wedding Hall"), "name");
        content.Add(new StringContent("+972599123456"), "contactPhone");
        content.Add(new StringContent("Gaza"), "region");
        content.Add(new StringContent("Gaza City, Main Street"), "address");
        content.Add(new StringContent("Elegant hall for weddings"), "description");
        content.Add(new StringContent("300"), "capacity");
        content.Add(new StringContent("not-a-time"), "firstPeriodStart");
        content.Add(new StringContent("14:00"), "firstPeriodEnd");
        content.Add(new StringContent("15:00"), "secondPeriodStart");
        content.Add(new StringContent("22:00"), "secondPeriodEnd");

        var response = await _client.PostAsync("/api/v1/owner/halls", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await _context.Halls.CountAsync());
    }

    [Fact]
    public async Task MissingRequiredField_Returns400AndCreatesNoHall()
    {
        using var content = new MultipartFormDataContent();
        content.Add(new StringContent(""), "name");
        content.Add(new StringContent("+972599123456"), "contactPhone");
        content.Add(new StringContent("Gaza"), "region");
        content.Add(new StringContent("Gaza City, Main Street"), "address");
        content.Add(new StringContent("Elegant hall for weddings"), "description");
        content.Add(new StringContent("300"), "capacity");
        content.Add(new StringContent("08:00"), "firstPeriodStart");
        content.Add(new StringContent("14:00"), "firstPeriodEnd");
        content.Add(new StringContent("15:00"), "secondPeriodStart");
        content.Add(new StringContent("22:00"), "secondPeriodEnd");

        var response = await _client.PostAsync("/api/v1/owner/halls", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await _context.Halls.CountAsync());
    }

    [Fact]
    public async Task DirectServiceCall_PersistsHall()
    {
        await using var scope = _app.Services.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IHallCreationService>();
        var response = await service.CreateHallAsync(BuildRequest(), CancellationToken.None);

        var count = await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Halls.CountAsync();
        Assert.True(count == 1, $"direct service count={count}, HallId={response.HallId}");
    }

    private static CreateHallRequest BuildRequest()
        => new()
        {
            Name = "Test Wedding Hall",
            ContactPhone = "+972599123456",
            Region = "Gaza",
            Address = "Gaza City, Main Street",
            Description = "Elegant hall for weddings",
            Capacity = 300,
            Price = 1000,
            FirstPeriodStart = new TimeOnly(8, 0),
            FirstPeriodEnd = new TimeOnly(14, 0),
            SecondPeriodStart = new TimeOnly(15, 0),
            SecondPeriodEnd = new TimeOnly(22, 0)
        };

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _app.DisposeAsync();
    }

    private sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public const string SchemeName = "TestAuth";
        public const string HeaderName = "X-Test-Auth";

        public TestAuthHandler(
            Microsoft.Extensions.Options.IOptionsMonitor<AuthenticationSchemeOptions> options,
            Microsoft.Extensions.Logging.ILoggerFactory logger,
            System.Text.Encodings.Web.UrlEncoder encoder)
            : base(options, logger, encoder)
        {
        }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (!Request.Headers.ContainsKey(HeaderName))
            {
                return Task.FromResult(AuthenticateResult.Fail("Missing test header"));
            }

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "owner-1"),
                new Claim(ClaimTypes.Name, "owner-1"),
                new Claim(ClaimTypes.Role, ApplicationRoles.HallOwner),
                new Claim(JwtRegisteredClaim.Jti, Guid.NewGuid().ToString()),
            };
            var identity = new ClaimsIdentity(claims, SchemeName);
            var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName);
            return Task.FromResult(AuthenticateResult.Success(ticket));
        }

        private static class JwtRegisteredClaim
        {
            public const string Jti = "jti";
        }
    }

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        public string? UserId => "owner-1";
        public string? UserName => "owner-1";
        public string? Email => "owner@example.com";
        public bool IsAuthenticated => true;
        public IReadOnlyList<string> Roles => new[] { ApplicationRoles.HallOwner };
    }

    private sealed class FakeHallMediaStorage : IHallMediaStorage
    {
        private readonly string _root = Path.Combine(Path.GetTempPath(), "wesal-media-pipeline-" + Guid.NewGuid());

        public string Root => _root;

        public string HallsUploadDirectory(Guid hallId) => Path.Combine(_root, "halls", hallId.ToString());
    }

    private sealed class TestInMemoryHallRepository : IHallRepository
    {
        private readonly ApplicationDbContext _ctx;

        public TestInMemoryHallRepository(ApplicationDbContext ctx) => _ctx = ctx;

        public Task AddAsync(Hall hall, CancellationToken cancellationToken = default)
            => _ctx.Halls.AddAsync(hall, cancellationToken).AsTask();

        public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => _ctx.Halls.AsNoTracking().FirstOrDefaultAsync(h => h.Id == id, cancellationToken);

        public Task<Hall?> GetHallByIdForUpdateAsync(Guid id, CancellationToken cancellationToken = default)
            => _ctx.Halls.FirstOrDefaultAsync(h => h.Id == id, cancellationToken);

        public Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(_ctx.Halls.Take(count).ToList());

        public Task<IReadOnlyList<Hall>> GetApprovedHallsByRegionAsync(HallRegion region, int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(_ctx.Halls.Where(h => h.Region == region).Take(count).ToList());

        public Task<IReadOnlyList<Hall>> GetApprovedHallsPaginatedAsync(int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(_ctx.Halls.Skip(skip).Take(take).ToList());

        public Task<int> GetApprovedHallsCountAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(_ctx.Halls.Count());

        public Task<IReadOnlyList<Hall>> SearchApprovedHallsAsync(string? name, HallRegion? region, string? area, DateOnly? date, BookingPeriodType? period, int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(_ctx.Halls.Skip(skip).Take(take).ToList());

        public Task<int> SearchApprovedHallsCountAsync(string? name, HallRegion? region, string? area, DateOnly? date, BookingPeriodType? period, CancellationToken cancellationToken = default)
            => Task.FromResult(_ctx.Halls.Count());

        public Task<IReadOnlyList<HallImage>> GetHallImagesAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallImage>>(_ctx.HallImages.Where(i => i.HallId == hallId).ToList());

        public Task<IReadOnlyList<HallBookingPeriod>> GetBookingPeriodsAsync(IReadOnlyCollection<Guid> hallIds, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallBookingPeriod>>(_ctx.HallBookingPeriods.Where(p => hallIds.Contains(p.HallId)).ToList());

        public Task<IReadOnlyList<HallAvailability>> GetAvailabilityAsync(IReadOnlyCollection<Guid> hallIds, DateOnly fromDate, DateOnly toDate, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallAvailability>>(_ctx.HallAvailabilities.Where(a => hallIds.Contains(a.HallId)).ToList());
    }

    private sealed class TestInMemoryUnitOfWork : IUnitOfWork
    {
        private readonly ApplicationDbContext _ctx;

        public TestInMemoryUnitOfWork(ApplicationDbContext ctx) => _ctx = ctx;

        public Task<TResult> ExecuteInTransactionAsync<TResult>(Func<Task<TResult>> operation, CancellationToken cancellationToken = default)
            => operation();

        public Task ExecuteInTransactionAsync(Func<Task> operation, CancellationToken cancellationToken = default)
            => operation();

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
            => _ctx.SaveChangesAsync(cancellationToken);
    }

    private sealed class StubOwnerSidebarService : IOwnerSidebarService
    {
        public Task<OwnerSidebarResponse> GetSidebarAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(new OwnerSidebarResponse());
    }

    private sealed class StubHallInitiationService : IHallInitiationService
    {
        public Task<HallInitiationResponse> InitiateAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(new HallInitiationResponse("Ready", "ready"));
    }

    private sealed class StubHallStatusTrackingService : IHallStatusTrackingService
    {
        public Task<IReadOnlyList<OwnerHallDto>> GetOwnedHallsAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<OwnerHallDto>>([]);
    }

    private sealed class StubOwnerHallService : IOwnerHallService
    {
        public Task<OwnerHallDetailsDto> GetOwnedHallDetailsAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult(new OwnerHallDetailsDto());
        public Task<OwnerHallDetailsDto> UpdateOwnedHallAsync(Guid hallId, UpdateOwnerHallRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new OwnerHallDetailsDto());
        public Task DeleteOwnedHallAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private sealed class StubOwnerBookingRequestsService : IOwnerBookingRequestsService
    {
        public Task<IReadOnlyList<OwnerBookingRequestDto>> GetBookingRequestsAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<OwnerBookingRequestDto>>([]);
    }

    private sealed class StubOwnerAvailabilityService : IOwnerAvailabilityService
    {
        public Task<OwnerAvailabilityCalendarDto> GetAvailabilityAsync(Guid hallId, DateOnly fromDate, DateOnly toDate, CancellationToken cancellationToken = default)
            => Task.FromResult(new OwnerAvailabilityCalendarDto());

        public Task<OwnerAvailabilityPeriodDto> UpdateAvailabilityAsync(Guid hallId, UpdateOwnerAvailabilityRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new OwnerAvailabilityPeriodDto());
    }

    private sealed class StubHallSubscriptionService : IHallSubscriptionService
    {
        public Task<OwnerHallSubscriptionDto> GetHallSubscriptionAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult(new OwnerHallSubscriptionDto());
    }
}