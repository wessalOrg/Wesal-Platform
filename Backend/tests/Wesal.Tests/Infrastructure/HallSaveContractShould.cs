using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Primitives;
using Wesal.API.Controllers;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Halls;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Infrastructure.Sessions;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Hall-save contract (Edit 24) plus session ownership (Edit 19) against the real
/// stores: a fully valid update — JSON or multipart with fresh uploads — succeeds for
/// the owning hall owner without authentication failures; invalid payloads fail with
/// validation errors; and a stranger's hall resolves as not-found, never leaking
/// ownership or succeeding.
/// </summary>
public class HallSaveContractShould : IDisposable
{
    private static readonly byte[] JpegBytes =
        [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01];

    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly string _mediaRoot;

    public HallSaveContractShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(o => o
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
        services.AddIdentityCore<ApplicationUser>(o =>
        {
            o.Password.RequireDigit = true;
            o.Password.RequireLowercase = true;
            o.Password.RequireUppercase = true;
            o.Password.RequireNonAlphanumeric = true;
            o.Password.RequiredLength = 8;
            o.User.RequireUniqueEmail = true;
        }).AddRoles<ApplicationRole>().AddEntityFrameworkStores<ApplicationDbContext>();
        services.AddLogging();
        _provider = services.BuildServiceProvider();
        _context = _provider.GetRequiredService<ApplicationDbContext>();
        _context.Database.EnsureCreated();
        var roleManager = _provider.GetRequiredService<RoleManager<ApplicationRole>>();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.HallOwner)).GetAwaiter().GetResult();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.RegisteredUser)).GetAwaiter().GetResult();
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
        _mediaRoot = Path.Combine(Path.GetTempPath(), "wesal-test-media-" + Guid.NewGuid());
    }

    private async Task<ApplicationUser> CreateOwnerAsync(string email, string phone)
    {
        var user = new ApplicationUser { FullName = "Hall Owner", Email = email, UserName = email, PhoneNumber = phone };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded) throw new Exception(string.Join(",", result.Errors.Select(e => e.Description)));
        await _userManager.AddToRoleAsync(user, ApplicationRoles.HallOwner);
        return user;
    }

    private Hall AddHall(string ownerId)
    {
        var hall = new Hall
        {
            Name = "Grand Hall",
            Address = "حي الرمال",
            Region = HallRegion.Gaza,
            Capacity = 200,
            Price = 1500,
            ShowPrice = true,
            ContactPhone = "+970599111111",
            Description = "Spacious hall",
            OwnerId = ownerId,
            Status = HallStatus.Approved,
            PaymentStatus = HallPaymentStatus.Paid,
            IsDeleted = false,
            MainImageUrl = "/uploads/halls/cover.jpg"
        };
        hall.Images.Add(new HallImage { HallId = hall.Id, Url = "https://cdn.example.com/old-1.jpg", DisplayOrder = 0 });
        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private OwnerHallService CreateOwnerService(string ownerId)
        => new(_userManager, new FakeCurrentUser(ownerId, true, ApplicationRoles.HallOwner),
            new OwnerDashboardRepository(_context), new BookingRepository(_context),
            new HallMediaStorage(Options.Create(new HallMediaOptions { Directory = _mediaRoot })),
            new UnitOfWork(_context));

    private static UpdateOwnerHallRequest ValidRequest(Hall hall) => new()
    {
        Name = "Grand Hall Updated",
        Address = hall.Address,
        Region = hall.Region,
        Capacity = 250,
        Price = 1500,
        ShowPrice = true,
        ContactPhone = "+970599222222",
        Description = "Renovated hall",
        Features = [],
        Photos =
        [
            new UpdateOwnerHallPhotoDto { Url = "https://cdn.example.com/new-1.jpg", DisplayOrder = 0 }
        ],
        HourlySlotStart = new TimeOnly(9, 0),
        HourlySlotEnd = new TimeOnly(21, 0)
    };

    // ---------- Edit 19: session ownership ----------

    [Fact]
    public async Task Session_OwnerWithHall_ReportsRoleAndOwnership()
    {
        var owner = await CreateOwnerAsync("o1@example.com", "+970599100001");
        AddHall(owner.Id);

        var session = await new SessionService(
                new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner),
                new OwnerDashboardRepository(_context))
            .GetSessionAsync();

        Assert.True(session.IsAuthenticated);
        Assert.Equal(ApplicationRoles.HallOwner, session.Role);
        Assert.True(session.IsHallOwner);
        Assert.True(session.OwnsHall);
    }

    [Fact]
    public async Task Session_OwnerWithoutHall_ReportsNoHall()
    {
        var owner = await CreateOwnerAsync("o2@example.com", "+970599100002");

        var session = await new SessionService(
                new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner),
                new OwnerDashboardRepository(_context))
            .GetSessionAsync();

        Assert.True(session.IsHallOwner);
        Assert.False(session.OwnsHall);
    }

    [Fact]
    public async Task Session_Seeker_ReportsRoleWithoutOwnership()
    {
        var session = await new SessionService(
                new FakeCurrentUser("seeker-1", true, ApplicationRoles.RegisteredUser),
                new OwnerDashboardRepository(_context))
            .GetSessionAsync();

        Assert.True(session.IsAuthenticated);
        Assert.Equal(ApplicationRoles.RegisteredUser, session.Role);
        Assert.False(session.IsHallOwner);
        Assert.False(session.OwnsHall);
    }

    // ---------- Edit 24: valid/invalid save ----------

    [Fact]
    public async Task ValidHallUpdate_Succeeds_WithoutAuthenticationFailure()
    {
        var owner = await CreateOwnerAsync("o3@example.com", "+970599100003");
        var hall = AddHall(owner.Id);

        // The authenticated owner resolves and saves without any auth error.
        var result = await CreateOwnerService(owner.Id)
            .UpdateOwnedHallAsync(hall.Id, ValidRequest(hall));

        Assert.Equal("Grand Hall Updated", result.HallName);
        Assert.Equal(250, result.Capacity);
    }

    [Fact]
    public async Task InvalidHallUpdate_ReturnsValidationErrors()
    {
        var owner = await CreateOwnerAsync("o4@example.com", "+970599100004");
        var hall = AddHall(owner.Id);

        // An empty merged gallery is rejected at the service layer with the same
        // field/message shape the boundary validator uses: the URL payload carries no
        // photos and the only accompanying upload is an empty cover, which hall
        // creation semantics skip instead of counting as a photo.
        var valid = ValidRequest(hall);
        var invalid = new UpdateOwnerHallRequest
        {
            Name = valid.Name,
            Address = valid.Address,
            Region = valid.Region,
            Capacity = valid.Capacity,
            Price = valid.Price,
            ShowPrice = valid.ShowPrice,
            ContactPhone = valid.ContactPhone,
            Description = valid.Description,
            Features = valid.Features,
            Photos = [],
            HourlySlotStart = valid.HourlySlotStart,
            HourlySlotEnd = valid.HourlySlotEnd,
            MainPhoto = new HallPhotoUpload
            {
                FileName = "cover.jpg",
                ContentType = "image/jpeg",
                Content = []
            }
        };

        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            CreateOwnerService(owner.Id).UpdateOwnedHallAsync(hall.Id, invalid));

        var photosErrors = Assert.Contains("Photos", ex.Errors);
        Assert.Contains("At least one photo is required.", photosErrors);
    }

    [Fact]
    public async Task InvalidJsonUpdate_ReturnsBadRequestWithFieldErrors()
    {
        // Boundary validation (Edit 24): an invalid JSON payload is rejected with a 400
        // carrying per-field errors — the same contract the action filter enforced
        // before the endpoint learned multipart.
        var owner = await CreateOwnerAsync("o12@example.com", "+970599100012");
        var hall = AddHall(owner.Id);

        var valid = ValidRequest(hall);
        var invalid = new UpdateOwnerHallRequest
        {
            Name = "",
            Address = valid.Address,
            Region = valid.Region,
            Capacity = valid.Capacity,
            Price = valid.Price,
            ShowPrice = valid.ShowPrice,
            ContactPhone = valid.ContactPhone,
            Description = valid.Description,
            Features = valid.Features,
            Photos = valid.Photos,
            HourlySlotStart = valid.HourlySlotStart,
            HourlySlotEnd = valid.HourlySlotEnd
        };
        var payload = System.Text.Json.JsonSerializer.Serialize(
            invalid,
            new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));

        var httpContext = new DefaultHttpContext();
        httpContext.Request.ContentType = "application/json";
        httpContext.Request.Body = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(payload));

        var controller = CreateUpdateController(new RecordingOwnerHallService());
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        var actionResult = await controller.UpdateOwnedHall(hall.Id, CancellationToken.None);
        var badRequest = Assert.IsType<BadRequestObjectResult>(actionResult.Result);
        Assert.Equal(StatusCodes.Status400BadRequest, badRequest.StatusCode);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains("Name", problem.Errors.Keys);
    }

    [Fact]
    public async Task UpdateAnotherOwnersHall_ResolvesNotFound()
    {
        var owner = await CreateOwnerAsync("o5@example.com", "+970599100005");
        var stranger = await CreateOwnerAsync("o6@example.com", "+970599100006");
        var hall = AddHall(owner.Id);

        // Ownership is repository-scoped: a stranger's hall is not-found, and the
        // persisted hall is untouched.
        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateOwnerService(stranger.Id).UpdateOwnedHallAsync(hall.Id, ValidRequest(hall)));

        _context.ChangeTracker.Clear();
        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Equal("Grand Hall", reloaded!.Name);
    }

    [Fact]
    public async Task UnauthenticatedUpdate_ThrowsUnauthorized()
    {
        var owner = await CreateOwnerAsync("o7@example.com", "+970599100007");
        var hall = AddHall(owner.Id);

        var service = new OwnerHallService(
            _userManager, new FakeCurrentUser(null, false),
            new OwnerDashboardRepository(_context), new BookingRepository(_context),
            new HallMediaStorage(Options.Create(new HallMediaOptions { Directory = _mediaRoot })),
            new UnitOfWork(_context));

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.UpdateOwnedHallAsync(hall.Id, ValidRequest(hall)));
    }

    [Fact]
    public async Task UpdateWithFreshUploads_PersistsFilesAndMergesGallery()
    {
        var owner = await CreateOwnerAsync("o8@example.com", "+970599100008");
        var hall = AddHall(owner.Id);

        // Multipart path: every existing photo replaced by fresh uploads, so the
        // URL-only payload carries an empty gallery and the merged request must still
        // satisfy the "at least one photo" rule.
        var valid = ValidRequest(hall);
        var request = new UpdateOwnerHallRequest
        {
            Name = valid.Name,
            Address = valid.Address,
            Region = valid.Region,
            Capacity = valid.Capacity,
            Price = valid.Price,
            ShowPrice = valid.ShowPrice,
            ContactPhone = valid.ContactPhone,
            Description = valid.Description,
            Features = valid.Features,
            MainImageUrl = null,
            Photos = [],
            HourlySlotStart = valid.HourlySlotStart,
            HourlySlotEnd = valid.HourlySlotEnd,
            MainPhoto = new HallPhotoUpload
            {
                FileName = "cover.jpg",
                ContentType = "image/jpeg",
                Content = JpegBytes
            },
            NewPhotos = new[]
            {
                new HallPhotoUpload { FileName = "g1.jpg", ContentType = "image/jpeg", Content = JpegBytes }
            }
        };

        var result = await CreateOwnerService(owner.Id).UpdateOwnedHallAsync(hall.Id, request);

        Assert.StartsWith("/uploads/halls/", result.MainImageUrl, StringComparison.Ordinal);
        Assert.True(File.Exists(Path.Combine(
            _mediaRoot, "halls", hall.Id.ToString(),
            Path.GetFileName(result.MainImageUrl!))));
        Assert.Contains(result.Photos, photo => photo.Url.StartsWith("/uploads/halls/", StringComparison.Ordinal));
    }

    [Fact]
    public async Task UpdateWithInvalidUpload_RejectsWithoutOrphaningFiles()
    {
        var owner = await CreateOwnerAsync("o9@example.com", "+970599100009");
        var hall = AddHall(owner.Id);
        var before = Directory.Exists(Path.Combine(_mediaRoot, "halls", hall.Id.ToString()))
            ? Directory.GetFiles(Path.Combine(_mediaRoot, "halls", hall.Id.ToString())).Length
            : 0;

        var valid = ValidRequest(hall);
        var request = new UpdateOwnerHallRequest
        {
            Name = valid.Name,
            Address = valid.Address,
            Region = valid.Region,
            Capacity = valid.Capacity,
            Price = valid.Price,
            ShowPrice = valid.ShowPrice,
            ContactPhone = valid.ContactPhone,
            Description = valid.Description,
            Features = valid.Features,
            Photos = valid.Photos,
            HourlySlotStart = valid.HourlySlotStart,
            HourlySlotEnd = valid.HourlySlotEnd,
            NewPhotos = new[]
            {
                new HallPhotoUpload { FileName = "evil.exe", ContentType = "application/octet-stream", Content = JpegBytes }
            }
        };

        await Assert.ThrowsAsync<ValidationException>(() =>
            CreateOwnerService(owner.Id).UpdateOwnedHallAsync(hall.Id, request));

        var after = Directory.Exists(Path.Combine(_mediaRoot, "halls", hall.Id.ToString()))
            ? Directory.GetFiles(Path.Combine(_mediaRoot, "halls", hall.Id.ToString())).Length
            : 0;
        Assert.Equal(before, after);
    }

    // ---------- Edit 24: multipart controller contract ----------

    [Fact]
    public async Task MultipartUpdate_ReachesService_WithUploads()
    {
        var owner = await CreateOwnerAsync("o10@example.com", "+970599100010");
        var hall = AddHall(owner.Id);

        var payload = System.Text.Json.JsonSerializer.Serialize(
            ValidRequest(hall),
            new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));

        var httpContext = new DefaultHttpContext();
        httpContext.Request.ContentType = "multipart/form-data; boundary=----test";
        httpContext.Request.Form = new FormCollection(
            new Dictionary<string, StringValues> { ["payload"] = payload },
            new FormFileCollection
            {
                new FormFile(new MemoryStream(JpegBytes), 0, JpegBytes.Length, "mainPhoto", "cover.jpg")
                {
                    Headers = new HeaderDictionary(),
                    ContentType = "image/jpeg"
                }
            });

        var recorder = new RecordingOwnerHallService();
        var controller = CreateUpdateController(recorder);
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        var actionResult = await controller.UpdateOwnedHall(hall.Id, CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(actionResult.Result);

        Assert.NotNull(recorder.Request);
        Assert.NotNull(recorder.Request!.MainPhoto);
        Assert.Equal("cover.jpg", recorder.Request.MainPhoto!.FileName);
        Assert.Equal(JpegBytes, recorder.Request.MainPhoto.Content);
        Assert.NotNull(ok.Value);
    }

    [Fact]
    public async Task JsonUpdate_ReachesService_WithoutUploads()
    {
        var owner = await CreateOwnerAsync("o11@example.com", "+970599100011");
        var hall = AddHall(owner.Id);

        var payload = System.Text.Json.JsonSerializer.Serialize(
            ValidRequest(hall),
            new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));

        var httpContext = new DefaultHttpContext();
        httpContext.Request.ContentType = "application/json";
        httpContext.Request.Body = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(payload));

        var recorder = new RecordingOwnerHallService();
        var controller = CreateUpdateController(recorder);
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        var actionResult = await controller.UpdateOwnedHall(hall.Id, CancellationToken.None);

        Assert.IsType<OkObjectResult>(actionResult.Result);
        Assert.NotNull(recorder.Request);
        Assert.Null(recorder.Request!.MainPhoto);
        Assert.Equal("Grand Hall Updated", recorder.Request.Name);
    }

    private static OwnerController CreateUpdateController(RecordingOwnerHallService recorder)
        => new(
            new StubOwnerSidebarService(), new StubHallCreationService(), new StubHallInitiationService(),
            new StubHallStatusTrackingService(), recorder, new StubOwnerBookingRequestsService(),
            new StubOwnerHourlyAvailabilityService(), new StubHallSubscriptionService(),
            new StubOwnerIdentityService(), new UpdateOwnerHallRequestValidator());

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        private readonly string[] _roles;

        public FakeCurrentUser(string? userId, bool authenticated, params string[] roles)
        {
            UserId = userId;
            IsAuthenticated = authenticated;
            _roles = roles;
        }

        public string? UserId { get; }
        public string? UserName => "test";
        public string? Email => "test@example.com";
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles => _roles;
    }

    private sealed class RecordingOwnerHallService : IOwnerHallService
    {
        public UpdateOwnerHallRequest? Request { get; private set; }

        public Task<OwnerHallDetailsDto> GetOwnedHallDetailsAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult(new OwnerHallDetailsDto());

        public Task<OwnerHallDetailsDto> UpdateOwnedHallAsync(Guid hallId, UpdateOwnerHallRequest request, CancellationToken cancellationToken = default)
        {
            Request = request;
            return Task.FromResult(new OwnerHallDetailsDto());
        }

        public Task DeleteOwnedHallAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private sealed class StubOwnerSidebarService : IOwnerSidebarService
    {
        public Task<OwnerSidebarResponse> GetSidebarAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(new OwnerSidebarResponse());
    }

    private sealed class StubHallCreationService : IHallCreationService
    {
        public Task<CreateHallResponse> CreateHallAsync(CreateHallRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new CreateHallResponse());
    }

    private sealed class StubHallInitiationService : IHallInitiationService
    {
        public Task<HallInitiationResponse> InitiateAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(HallInitiationResponse.Ready());
    }

    private sealed class StubHallStatusTrackingService : IHallStatusTrackingService
    {
        public Task<IReadOnlyList<OwnerHallDto>> GetOwnedHallsAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<OwnerHallDto>>([]);
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
            => Task.FromResult(new OwnerDayBlockResultDto());

        public Task<OwnerHourlySettingsDto> UpdateHourlySettingsAsync(Guid hallId, UpdateOwnerHourlySettingsRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new OwnerHourlySettingsDto());
    }

    private sealed class StubHallSubscriptionService : IHallSubscriptionService
    {
        public Task<OwnerHallSubscriptionDto> GetHallSubscriptionAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult(new OwnerHallSubscriptionDto());
    }

    private sealed class StubOwnerIdentityService : IOwnerIdentityService
    {
        public Task<IdentityDocumentUploadResult> UploadIdentityDocumentAsync(OwnerDocumentUpload upload, CancellationToken cancellationToken = default)
            => Task.FromResult(new IdentityDocumentUploadResult());

        public Task<StoredDocument> GetIdentityDocumentAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(new StoredDocument());
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();

        try
        {
            if (Directory.Exists(_mediaRoot))
            {
                Directory.Delete(_mediaRoot, true);
            }
        }
        catch
        {
        }
    }
}
