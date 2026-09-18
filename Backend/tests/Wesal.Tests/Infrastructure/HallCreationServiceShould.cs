using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Halls;
using Wesal.Persistence.Data;

namespace Wesal.Tests.Infrastructure;

public class HallCreationServiceShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly HallCreationService _service;
    private readonly FakeCurrentUser _currentUser;

    public HallCreationServiceShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(o => o.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        services.AddLogging();
        services.AddSingleton<IWebHostEnvironment>(new FakeWebHostEnvironment());
        _provider = services.BuildServiceProvider();
        _context = _provider.GetRequiredService<ApplicationDbContext>();
        _context.Database.EnsureCreated();
        _currentUser = new FakeCurrentUser("owner-1", true, Wesal.Domain.Constants.ApplicationRoles.HallOwner);
        _service = new HallCreationService(_currentUser, new TestHallRepository(_context), new TestUnitOfWork(_context), _provider.GetRequiredService<IWebHostEnvironment>());
    }

    private class FakeCurrentUser : Wesal.Application.Common.Interfaces.ICurrentUserService
    {
        public FakeCurrentUser(string? userId, bool auth, string role) { UserId = userId; IsAuthenticated = auth; Roles = new[] { role }; }
        public string? UserId { get; }
        public string? UserName => "test";
        public string? Email => "test@example.com";
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles { get; }
    }

    private class FakeWebHostEnvironment : IWebHostEnvironment
    {
        public string WebRootPath { get; set; } = Path.Combine(Path.GetTempPath(), "wesal-test-" + Guid.NewGuid());
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "Test";
        public string ContentRootPath { get; set; } = Directory.GetCurrentDirectory();
        public Microsoft.Extensions.FileProviders.IFileProvider WebRootFileProvider { get; set; } = null!;
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
    }

    private class TestHallRepository : Wesal.Application.Common.Interfaces.Persistence.IHallRepository
    {
        private readonly ApplicationDbContext _ctx;
        public TestHallRepository(ApplicationDbContext ctx) => _ctx = ctx;
        public Task AddAsync(Wesal.Domain.Entities.Hall hall, CancellationToken cancellationToken = default) => _ctx.Halls.AddAsync(hall, cancellationToken).AsTask();
        public Task<Wesal.Domain.Entities.Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default) => _ctx.Halls.AsNoTracking().FirstOrDefaultAsync(h => h.Id == id, cancellationToken);
        public Task<IReadOnlyList<Wesal.Domain.Entities.Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Wesal.Domain.Entities.Hall>>(_ctx.Halls.Where(h => h.Status == HallStatus.Approved && !h.IsDeleted).Take(count).ToList());
        public Task<IReadOnlyList<Wesal.Domain.Entities.Hall>> GetApprovedHallsByRegionAsync(HallRegion region, int count, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Wesal.Domain.Entities.Hall>>(_ctx.Halls.Where(h => h.Region == region).Take(count).ToList());
        public Task<IReadOnlyList<Wesal.Domain.Entities.Hall>> GetApprovedHallsPaginatedAsync(int skip, int take, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Wesal.Domain.Entities.Hall>>(_ctx.Halls.Skip(skip).Take(take).ToList());
        public Task<int> GetApprovedHallsCountAsync(CancellationToken cancellationToken = default) => Task.FromResult(_ctx.Halls.Count());
        public Task<IReadOnlyList<Wesal.Domain.Entities.Hall>> SearchApprovedHallsAsync(string? name, HallRegion? region, string? area, DateOnly? date, BookingPeriodType? period, int skip, int take, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Wesal.Domain.Entities.Hall>>(_ctx.Halls.Skip(skip).Take(take).ToList());
        public Task<int> SearchApprovedHallsCountAsync(string? name, HallRegion? region, string? area, DateOnly? date, BookingPeriodType? period, CancellationToken cancellationToken = default) => Task.FromResult(_ctx.Halls.Count());
        public Task<IReadOnlyList<Wesal.Domain.Entities.HallImage>> GetHallImagesAsync(Guid hallId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Wesal.Domain.Entities.HallImage>>(_ctx.HallImages.Where(i => i.HallId == hallId).ToList());
        public Task<IReadOnlyList<Wesal.Domain.Entities.HallBookingPeriod>> GetBookingPeriodsAsync(IReadOnlyCollection<Guid> hallIds, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Wesal.Domain.Entities.HallBookingPeriod>>(_ctx.HallBookingPeriods.Where(p => hallIds.Contains(p.HallId)).ToList());
        public Task<IReadOnlyList<Wesal.Domain.Entities.HallAvailability>> GetAvailabilityAsync(IReadOnlyCollection<Guid> hallIds, DateOnly fromDate, DateOnly toDate, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Wesal.Domain.Entities.HallAvailability>>(_ctx.HallAvailabilities.Where(a => hallIds.Contains(a.HallId)).ToList());
    }

    private class TestUnitOfWork : Wesal.Application.Common.Interfaces.Persistence.IUnitOfWork
    {
        private readonly ApplicationDbContext _ctx;
        public TestUnitOfWork(ApplicationDbContext ctx) => _ctx = ctx;
        public Task<Wesal.Application.Common.Interfaces.Persistence.IWesalTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default) => Task.FromResult<Wesal.Application.Common.Interfaces.Persistence.IWesalTransaction>(new FakeTransaction());
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => _ctx.SaveChangesAsync(cancellationToken);
        private class FakeTransaction : Wesal.Application.Common.Interfaces.Persistence.IWesalTransaction
        {
            public Task CommitAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
            public Task RollbackAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
            public ValueTask DisposeAsync() => ValueTask.CompletedTask;
            public void Dispose() { }
        }
    }

    private static CreateHallRequest CreateValidRequest(string region = "Gaza", decimal? price = 1000, IReadOnlyList<HallPhotoUpload>? photos = null) => new()
    {
        Name = "Test Hall",
        ContactPhone = "+972599123456",
        Region = region,
        Address = "Gaza City, Test Street",
        Description = "Beautiful hall for weddings",
        Capacity = 300,
        Price = price,
        FirstPeriodStart = new TimeOnly(8, 0),
        FirstPeriodEnd = new TimeOnly(14, 0),
        SecondPeriodStart = new TimeOnly(15, 0),
        SecondPeriodEnd = new TimeOnly(22, 0),
        Photos = photos
    };

    private static HallPhotoUpload CreateValidPhoto(string fileName = "test.jpg", string contentType = "image/jpeg")
    {
        // Minimal valid JPEG header
        var content = new byte[] { 0xFF, 0xD8, 0xFF, 0x00, 0x00, 0x00 };
        return new HallPhotoUpload { FileName = fileName, ContentType = contentType, Content = content };
    }

    [Fact]
    public async Task CreateHall_AllRequiredFields_Succeeds()
    {
        var request = CreateValidRequest();
        var result = await _service.CreateHallAsync(request);
        Assert.Equal("Test Hall", result.Name);
        Assert.Equal(HallStatus.PendingReview, result.Status);
    }

    [Fact]
    public async Task CreateHall_WithOnePhoto_Succeeds()
    {
        var request = CreateValidRequest(photos: new[] { CreateValidPhoto() });
        var result = await _service.CreateHallAsync(request);
        Assert.Single(result.Images);
    }

    [Fact]
    public async Task CreateHall_WithMultiplePhotos_Succeeds()
    {
        var photos = new[] { CreateValidPhoto("a.jpg"), new HallPhotoUpload { FileName = "b.png", ContentType = "image/png", Content = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x00 } } };
        var request = CreateValidRequest(photos: photos);
        var result = await _service.CreateHallAsync(request);
        Assert.Equal(2, result.Images.Count);
    }

    [Fact]
    public async Task CreateHall_OwnerAssociatedCorrectly()
    {
        var request = CreateValidRequest();
        var result = await _service.CreateHallAsync(request);
        var hall = await _context.Halls.FindAsync(result.HallId);
        Assert.Equal("owner-1", hall!.OwnerId);
    }

    [Theory]
    [InlineData("North Gaza")]
    [InlineData("Gaza")]
    [InlineData("Middle Area")]
    [InlineData("South Gaza")]
    public async Task Region_Accepted(string region)
    {
        var request = CreateValidRequest(region: region);
        var result = await _service.CreateHallAsync(request);
        Assert.Equal(region.Replace(" ", ""), result.Region.ToString().Replace(" ", ""));
    }

    [Fact]
    public async Task UnsupportedRegion_Rejected()
    {
        var request = CreateValidRequest(region: "InvalidRegion");
        await Assert.ThrowsAsync<ValidationException>(() => _service.CreateHallAsync(request));
        Assert.Equal(0, await _context.Halls.CountAsync());
    }

    [Fact]
    public async Task FirstPeriod_EndEqualStart_Rejected()
    {
        var request = CreateValidRequest();
        request = new CreateHallRequest { Name = request.Name, ContactPhone = request.ContactPhone, Region = request.Region, Address = request.Address, Description = request.Description, Capacity = request.Capacity, Price = request.Price, FirstPeriodStart = new TimeOnly(8, 0), FirstPeriodEnd = new TimeOnly(8, 0), SecondPeriodStart = request.SecondPeriodStart, SecondPeriodEnd = request.SecondPeriodEnd };
        await Assert.ThrowsAsync<ValidationException>(() => _service.CreateHallAsync(request));
    }

    [Fact]
    public async Task RentalPrice_Optional_SucceedsWithoutPrice()
    {
        var request = CreateValidRequest(price: null);
        var result = await _service.CreateHallAsync(request);
        Assert.Null(result.Price);
    }

    [Fact]
    public async Task InvalidPhoto_Rejected()
    {
        var badPhoto = new HallPhotoUpload { FileName = "bad.exe", ContentType = "application/octet-stream", Content = new byte[] { 0x00, 0x01 } };
        var request = CreateValidRequest(photos: new[] { badPhoto });
        await Assert.ThrowsAsync<ValidationException>(() => _service.CreateHallAsync(request));
        Assert.Equal(0, await _context.Halls.CountAsync());
    }

    [Fact]
    public async Task Unauthenticated_Rejected()
    {
        var unauthService = new HallCreationService(new FakeCurrentUser(null, false, ""), new TestHallRepository(_context), new TestUnitOfWork(_context), _provider.GetRequiredService<IWebHostEnvironment>());
        var request = CreateValidRequest();
        await Assert.ThrowsAsync<UnauthorizedException>(() => unauthService.CreateHallAsync(request));
    }

    [Fact]
    public async Task RegularUser_Rejected()
    {
        var regUser = new FakeCurrentUser("user-2", true, Wesal.Domain.Constants.ApplicationRoles.RegisteredUser);
        var service = new HallCreationService(regUser, new TestHallRepository(_context), new TestUnitOfWork(_context), _provider.GetRequiredService<IWebHostEnvironment>());
        var request = CreateValidRequest();
        await Assert.ThrowsAsync<ForbiddenException>(() => service.CreateHallAsync(request));
    }

    [Fact]
    public async Task ValidationFailure_CreatesNoHall()
    {
        var countBefore = await _context.Halls.CountAsync();
        var request = CreateValidRequest();
        request = new CreateHallRequest { Name = "", ContactPhone = request.ContactPhone, Region = request.Region, Address = request.Address, Description = request.Description, Capacity = request.Capacity, Price = request.Price, FirstPeriodStart = request.FirstPeriodStart, FirstPeriodEnd = request.FirstPeriodEnd, SecondPeriodStart = request.SecondPeriodStart, SecondPeriodEnd = request.SecondPeriodEnd };
        await Assert.ThrowsAsync<ValidationException>(() => _service.CreateHallAsync(request));
        Assert.Equal(countBefore, await _context.Halls.CountAsync());
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }
}
