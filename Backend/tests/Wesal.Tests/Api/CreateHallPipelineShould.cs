using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Wesal.API.Controllers;
using Wesal.API.Filters;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.Halls;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Api;

public sealed class CreateHallPipelineShould : IAsyncDisposable
{
    private readonly WebApplication _app;
    private readonly HttpClient _client;
    private readonly ApplicationDbContext _context;
    private readonly LocalHallMediaStorage _mediaStorage;

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
        builder.Services.AddIdentityCore<ApplicationUser>(o =>
        {
            o.Password.RequireDigit = true;
            o.Password.RequireLowercase = true;
            o.Password.RequireUppercase = true;
            o.Password.RequireNonAlphanumeric = true;
            o.Password.RequiredLength = 8;
            o.User.RequireUniqueEmail = true;
        }).AddRoles<ApplicationRole>().AddEntityFrameworkStores<ApplicationDbContext>();
        builder.Services.AddScoped<ICurrentUserService>(_ => new FakeCurrentUser());
        builder.Services.AddScoped<IHallRepository, TestInMemoryHallRepository>();
        builder.Services.AddScoped<IUnitOfWork, TestInMemoryUnitOfWork>();
        var mediaStorage = new LocalHallMediaStorage(
            Options.Create(new HallMediaOptions
            {
                Directory = Path.Combine(Path.GetTempPath(), "wesal-media-pipeline-" + Guid.NewGuid())
            }));
        builder.Services.AddSingleton<IHallMediaStorage>(mediaStorage);
        // WESAL-TASK-13 (Edit 13): the production dispatcher is built into the real DI graph
        // by Wesal.Infrastructure. This pipeline test uses a trimmed container, so the
        // notification port is supplied here to keep the service constructible; the wording
        // and recipient assertions live in NotificationLocalizationShould.
        builder.Services.AddScoped<INotificationService>(_ => new FakeNotificationService());
        builder.Services.AddScoped<INotificationDispatcher>(_ => new RecordingNotificationDispatcher());
        builder.Services.AddScoped<IHallCreationService, HallCreationService>();
    builder.Services.AddScoped<IOwnerIdentityService, StubOwnerIdentityService>();
        builder.Services.AddScoped<IOwnerSidebarService, StubOwnerSidebarService>();
        builder.Services.AddScoped<IHallInitiationService, StubHallInitiationService>();
        builder.Services.AddScoped<IHallStatusTrackingService, StubHallStatusTrackingService>();
        builder.Services.AddScoped<IOwnerHallService, StubOwnerHallService>();
        // The trimmed container does not run AddApplication()'s assembly scan, so the
        // update endpoint's explicitly-injected validator is registered directly,
        // mirroring production.
        builder.Services.AddScoped<FluentValidation.IValidator<Wesal.Application.Common.Models.UpdateOwnerHallRequest>, Wesal.Application.Common.Validation.UpdateOwnerHallRequestValidator>();
        builder.Services.AddScoped<IOwnerBookingRequestsService, StubOwnerBookingRequestsService>();
        builder.Services.AddScoped<IOwnerHourlyAvailabilityService, StubOwnerHourlyAvailabilityService>();
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
        _mediaStorage = mediaStorage;
        SeedOwnerWithIdentityDocument();
    }

    /// <summary>
    /// HallCreationService requires the authenticated owner to have uploaded an identity
    /// document (US-OWNER-30); seed the test user so the happy-path pipeline succeeds.
    /// </summary>
    private void SeedOwnerWithIdentityDocument()
    {
        var userManager = _app.Services.CreateScope().ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = _app.Services.CreateScope().ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.HallOwner)).GetAwaiter().GetResult();
        userManager.CreateAsync(new ApplicationUser
        {
            Id = "owner-1",
            FullName = "Test Owner",
            Email = "owner@example.com",
            UserName = "owner@example.com",
            PhoneNumber = "+970599000000",
            IdentityDocumentUrl = "/documents/owners/owner-1/id.jpg"

        }, "Password123!").GetAwaiter().GetResult();
        userManager.AddToRoleAsync(userManager.FindByIdAsync("owner-1").GetAwaiter().GetResult()!, ApplicationRoles.HallOwner).GetAwaiter().GetResult();
    }

    [Fact]
    public async Task ValidMultipart_Returns201AndPersistsHall()
    {
        using var content = new MultipartFormDataContent();
        content.Add(new StringContent("Test Wedding Hall"), "name");
        content.Add(new StringContent("+972599123456"), "contactPhone");
        content.Add(new StringContent("Gaza"), "region");
        content.Add(new StringContent("حي الشجاعية"), "address");
        content.Add(new StringContent("Elegant hall for weddings"), "description");
        content.Add(new StringContent("300"), "capacity");
        content.Add(new StringContent("1000"), "price");
        content.Add(new StringContent("initiation-id-123"), "initiationId");
        content.Add(new StringContent("08:00"), "hourlySlotStart");
        content.Add(new StringContent("22:00"), "hourlySlotEnd");

        var response = await _client.PostAsync("/api/v1/owner/halls", content);

        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.Created, $"Expected 201 but got {response.StatusCode}: {body}");

        var hall = await _context.Halls.SingleOrDefaultAsync();
        Assert.True(hall is not null, $"Location={response.Headers.Location}");
        Assert.Equal("owner-1", hall!.OwnerId);
        Assert.Equal(HallStatus.PendingReview, hall.Status);
        Assert.Equal(new TimeOnly(8, 0), hall.HourlySlotStart);
        Assert.Equal(new TimeOnly(22, 0), hall.HourlySlotEnd);
        Assert.Equal("Gaza", hall.Region.ToString());
    }

    [Fact]
    public async Task ValidMultipart_WithPhoto_Returns201()
    {
        using var content = new MultipartFormDataContent();
        content.Add(new StringContent("Test Wedding Hall"), "name");
        content.Add(new StringContent("+972599123456"), "contactPhone");
        content.Add(new StringContent("Gaza"), "region");
        content.Add(new StringContent("حي الشجاعية"), "address");
        content.Add(new StringContent("Elegant hall for weddings"), "description");
        content.Add(new StringContent("300"), "capacity");
        content.Add(new StringContent("08:00"), "hourlySlotStart");
        content.Add(new StringContent("22:00"), "hourlySlotEnd");

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
        // The 201 Location must address the created owner hall resource itself.
        Assert.Contains($"/api/v1/owner/halls/{hall.Id}", response.Headers.Location!.ToString(), StringComparison.OrdinalIgnoreCase);

        var imageUrl = hall.Images.Single().Url;
        var fileName = Path.GetFileName(imageUrl);
        var diskPath = Path.Combine(_mediaStorage.HallsUploadDirectory(hall.Id), fileName);
        Assert.True(File.Exists(diskPath), $"Expected photo file on disk at {diskPath}");
    }

    [Fact]
    public async Task MissingDescriptionField_Returns201AndPersistsHall()
    {
        using var content = new MultipartFormDataContent();
        content.Add(new StringContent("Test Wedding Hall"), "name");
        content.Add(new StringContent("+972599123456"), "contactPhone");
        content.Add(new StringContent("Gaza"), "region");
        content.Add(new StringContent("حي الشجاعية"), "address");
        content.Add(new StringContent("300"), "capacity");
        content.Add(new StringContent("1000"), "price");
        content.Add(new StringContent("08:00"), "hourlySlotStart");
        content.Add(new StringContent("22:00"), "hourlySlotEnd");

        var response = await _client.PostAsync("/api/v1/owner/halls", content);

        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.Created, $"Expected 201 but got {response.StatusCode}: {body}");
        var hall = await _context.Halls.SingleOrDefaultAsync();
        Assert.NotNull(hall);
        Assert.Equal("Test Wedding Hall", hall!.Name);
        Assert.Null(hall.Description);
    }

    [Fact]
    public async Task MalformedTime_Returns400()
    {
        using var content = new MultipartFormDataContent();
        content.Add(new StringContent("Test Wedding Hall"), "name");
        content.Add(new StringContent("+972599123456"), "contactPhone");
        content.Add(new StringContent("Gaza"), "region");
        content.Add(new StringContent("حي الشجاعية"), "address");
        content.Add(new StringContent("Elegant hall for weddings"), "description");
        content.Add(new StringContent("300"), "capacity");
        content.Add(new StringContent("not-a-time"), "hourlySlotStart");
        content.Add(new StringContent("22:00"), "hourlySlotEnd");

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
        content.Add(new StringContent("حي الشجاعية"), "address");
        content.Add(new StringContent("Elegant hall for weddings"), "description");
        content.Add(new StringContent("300"), "capacity");
        content.Add(new StringContent("08:00"), "hourlySlotStart");
        content.Add(new StringContent("22:00"), "hourlySlotEnd");

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
            Address = "حي الشجاعية",
            Description = "Elegant hall for weddings",
            Capacity = 300,
            Price = 1000,
            HourlySlotStart = new TimeOnly(8, 0),
            HourlySlotEnd = new TimeOnly(22, 0)
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

        public Task<IReadOnlyList<Hall>> SearchApprovedHallsAsync(string? name, HallRegion? region, string? area, string? detailedAddress, DateOnly? date, TimeOnly? startTime, int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(_ctx.Halls.Skip(skip).Take(take).ToList());

        public Task<int> SearchApprovedHallsCountAsync(string? name, HallRegion? region, string? area, string? detailedAddress, DateOnly? date, TimeOnly? startTime, CancellationToken cancellationToken = default)
            => Task.FromResult(_ctx.Halls.Count());

        public Task<IReadOnlyList<HallImage>> GetHallImagesAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallImage>>(_ctx.HallImages.Where(i => i.HallId == hallId).ToList());

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

    private sealed class StubOwnerIdentityService : IOwnerIdentityService
    {
        public Task<IdentityDocumentUploadResult> UploadIdentityDocumentAsync(OwnerDocumentUpload upload, CancellationToken cancellationToken = default)
            => Task.FromResult(new IdentityDocumentUploadResult { UploadedAt = DateTimeOffset.UtcNow, HasDocument = true });

        public Task<StoredDocument> GetIdentityDocumentAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(new StoredDocument { RelativeUrl = "/documents/owners/owner-1/id.jpg", FullPath = "n/a", ContentType = "image/jpeg", FileName = "id.jpg" });
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

        public Task<OwnerBookingsCalendarDto> GetBookingsCalendarAsync(Guid hallId, DateOnly fromDate, DateOnly toDate, CancellationToken cancellationToken = default)
            => Task.FromResult(new OwnerBookingsCalendarDto { HallId = hallId, FromDate = fromDate, ToDate = toDate });
    }

    private sealed class StubOwnerHourlyAvailabilityService : IOwnerHourlyAvailabilityService
    {
        public Task<OwnerDayBlockResultDto> SetDayBlockAsync(Guid hallId, OwnerDayBlockRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new OwnerDayBlockResultDto { HallId = hallId, Date = request.Date, IsOpen = request.IsOpen ?? false });

        public Task<OwnerHourlySettingsDto> UpdateHourlySettingsAsync(Guid hallId, UpdateOwnerHourlySettingsRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new OwnerHourlySettingsDto { HallId = hallId });
    }

    private sealed class StubHallSubscriptionService : IHallSubscriptionService
    {
        public Task<OwnerHallSubscriptionDto> GetHallSubscriptionAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult(new OwnerHallSubscriptionDto());
    }
}