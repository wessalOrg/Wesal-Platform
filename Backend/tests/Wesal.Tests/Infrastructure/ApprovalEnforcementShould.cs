using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Authorization;
using Wesal.Infrastructure.Comments;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Ratings;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// WESAL approval enforcement inside the content services: an Event Coordinator or
/// Photographer whose account is not Approved cannot create OR edit comments and
/// ratings, even when the service is invoked directly (no controller in between).
/// Ordinary registered users pass through untouched. The check reads the live
/// database status, so an approval or rejection takes effect on the very next call.
/// </summary>
public class ApprovalEnforcementShould : IDisposable
{
    private const string BlockedMessage = "approved by an administrator";

    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public ApprovalEnforcementShould()
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
        foreach (var role in new[]
                 {
                     ApplicationRoles.RegisteredUser, ApplicationRoles.HallOwner,
                     ApplicationRoles.EventCoordinator, ApplicationRoles.Photographer
                 })
        {
            roleManager.CreateAsync(new ApplicationRole(role)).GetAwaiter().GetResult();
        }
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
    }

    private async Task<ApplicationUser> CreateUserAsync(
        string email,
        AccountApprovalStatus status,
        params string[] roles)
    {
        var user = new ApplicationUser
        {
            FullName = "Test User",
            Email = email,
            UserName = email,
            PhoneNumber = "+970599000000",
            ApprovalStatus = status,
            IsSetupComplete = true
        };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(string.Join(",", result.Errors.Select(e => e.Description)));
        }
        foreach (var role in roles)
        {
            await _userManager.AddToRoleAsync(user, role);
        }

        return user;
    }

    private Hall AddHall(string ownerId)
    {
        var hall = new Hall
        {
            Name = "Approval Hall",
            Address = "Al-Rashid Street, Gaza",
            Region = HallRegion.Gaza,
            Capacity = 150,
            OwnerId = ownerId,
            Status = HallStatus.Approved,
            PaymentStatus = HallPaymentStatus.Paid,
            IsDeleted = false
        };
        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    /// <summary>
    /// Real guard over the live database, current user carrying the given roles —
    /// the exact wiring production uses (minus the controller).
    /// </summary>
    private ApprovalActor CreateActor(ApplicationUser user, params string[] roles)
        => new(user.Id, roles, new AccountApprovalGuard(new FixedCurrentUser(user.Id, roles), _userManager), _context);

    private async Task SetStatusAsync(ApplicationUser user, AccountApprovalStatus status)
    {
        // Detach every tracked instance first: service calls re-read the user through
        // the shared context, and Identity would otherwise reject a second instance
        // with the same key. The flip is read back live by the guard afterwards.
        _context.ChangeTracker.Clear();
        var fresh = await _userManager.FindByIdAsync(user.Id)
            ?? throw new InvalidOperationException("The user vanished before its status could change.");
        fresh.ApprovalStatus = status;
        await _userManager.UpdateAsync(fresh);
        _context.ChangeTracker.Clear();
    }

    private sealed record ApprovalActor(
        string UserId,
        string[] Roles,
        IAccountApprovalGuard Guard,
        ApplicationDbContext Context)
    {
        public CommentService CreateCommentService()
            => new(new CommentRepository(Context), new HallRepository(Context),
                new FixedCurrentUser(UserId, Roles), Guard);

        public RatingService CreateRatingService()
            => new(new RatingRepository(Context), new HallRepository(Context),
                new FixedCurrentUser(UserId, Roles), Guard);
    }

    // --- Comment creation ---------------------------------------------------------------

    [Theory]
    [InlineData(AccountApprovalStatus.Pending)]
    [InlineData(AccountApprovalStatus.Rejected)]
    public async Task UnapprovedPhotographer_CannotCreateComment(AccountApprovalStatus status)
    {
        var user = await CreateUserAsync($"c-photo-{status}@example.com", status,
            ApplicationRoles.RegisteredUser, ApplicationRoles.Photographer);
        var hall = AddHall("owner-1");
        var actor = CreateActor(user, ApplicationRoles.RegisteredUser, ApplicationRoles.Photographer);

        var exception = await Assert.ThrowsAsync<ForbiddenException>(() =>
            actor.CreateCommentService().CreateCommentAsync(
                new CreateCommentRequest { HallId = hall.Id, Content = "Should be blocked" }));

        Assert.Contains(BlockedMessage, exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(_context.Comments.IgnoreQueryFilters());
    }

    [Theory]
    [InlineData(AccountApprovalStatus.Pending)]
    [InlineData(AccountApprovalStatus.Rejected)]
    public async Task UnapprovedCoordinator_CannotCreateComment(AccountApprovalStatus status)
    {
        var user = await CreateUserAsync($"c-coord-{status}@example.com", status,
            ApplicationRoles.RegisteredUser, ApplicationRoles.EventCoordinator);
        var hall = AddHall("owner-1");
        var actor = CreateActor(user, ApplicationRoles.RegisteredUser, ApplicationRoles.EventCoordinator);

        var exception = await Assert.ThrowsAsync<ForbiddenException>(() =>
            actor.CreateCommentService().CreateCommentAsync(
                new CreateCommentRequest { HallId = hall.Id, Content = "Should be blocked" }));

        Assert.Contains(BlockedMessage, exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(_context.Comments.IgnoreQueryFilters());
    }

    [Fact]
    public async Task ApprovedPhotographer_CanCreateComment()
    {
        var user = await CreateUserAsync("c-photo-ok@example.com", AccountApprovalStatus.Approved,
            ApplicationRoles.RegisteredUser, ApplicationRoles.Photographer);
        var hall = AddHall("owner-1");
        var actor = CreateActor(user, ApplicationRoles.RegisteredUser, ApplicationRoles.Photographer);

        var result = await actor.CreateCommentService().CreateCommentAsync(
            new CreateCommentRequest { HallId = hall.Id, Content = "Approved content" });

        Assert.Equal("Approved content", result.Content);
    }

    [Fact]
    public async Task OrdinaryPendingRegisteredUser_CanCreateComment()
    {
        // The rule narrows exactly the two restricted roles; an ordinary account with
        // any status passes.
        var user = await CreateUserAsync("c-plain@example.com", AccountApprovalStatus.Pending, ApplicationRoles.RegisteredUser);
        var hall = AddHall("owner-1");
        var actor = CreateActor(user, ApplicationRoles.RegisteredUser);

        var result = await actor.CreateCommentService().CreateCommentAsync(
            new CreateCommentRequest { HallId = hall.Id, Content = "Ordinary content" });

        Assert.Equal("Ordinary content", result.Content);
    }

    // --- Comment editing: the live-status rule on the edit path --------------------------

    [Fact]
    public async Task PhotographerApprovalRevokedAfterCreation_CannotEditComment()
    {
        var user = await CreateUserAsync("c-revoke@example.com", AccountApprovalStatus.Approved,
            ApplicationRoles.RegisteredUser, ApplicationRoles.Photographer);
        var hall = AddHall("owner-1");
        var actor = CreateActor(user, ApplicationRoles.RegisteredUser, ApplicationRoles.Photographer);
        var service = actor.CreateCommentService();
        var created = await service.CreateCommentAsync(
            new CreateCommentRequest { HallId = hall.Id, Content = "Before revocation" });

        await SetStatusAsync(user, AccountApprovalStatus.Rejected);

        var exception = await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.UpdateCommentAsync(created.CommentId, new UpdateCommentRequest { Content = "After revocation" }));
        Assert.Contains(BlockedMessage, exception.Message, StringComparison.OrdinalIgnoreCase);

        _context.ChangeTracker.Clear();
        var row = await _context.Comments.IgnoreQueryFilters().SingleAsync(c => c.Id == created.CommentId);
        Assert.Equal("Before revocation", row.Content);
    }

    [Fact]
    public async Task CoordinatorApprovalRevokedAfterCreation_CannotEditComment()
    {
        var user = await CreateUserAsync("c-revoke-coord@example.com", AccountApprovalStatus.Approved,
            ApplicationRoles.RegisteredUser, ApplicationRoles.EventCoordinator);
        var hall = AddHall("owner-1");
        var actor = CreateActor(user, ApplicationRoles.RegisteredUser, ApplicationRoles.EventCoordinator);
        var service = actor.CreateCommentService();
        var created = await service.CreateCommentAsync(
            new CreateCommentRequest { HallId = hall.Id, Content = "Original" });

        await SetStatusAsync(user, AccountApprovalStatus.Pending);

        var exception = await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.UpdateCommentAsync(created.CommentId, new UpdateCommentRequest { Content = "Edited" }));
        Assert.Contains(BlockedMessage, exception.Message, StringComparison.OrdinalIgnoreCase);

        _context.ChangeTracker.Clear();
        var row = await _context.Comments.IgnoreQueryFilters().SingleAsync(c => c.Id == created.CommentId);
        Assert.Equal("Original", row.Content);
    }

    [Fact]
    public async Task OrdinaryUser_CanEditOwnComment()
    {
        var user = await CreateUserAsync("c-edit-ok@example.com", AccountApprovalStatus.Pending, ApplicationRoles.RegisteredUser);
        var hall = AddHall("owner-1");
        var actor = CreateActor(user, ApplicationRoles.RegisteredUser);
        var service = actor.CreateCommentService();
        var created = await service.CreateCommentAsync(
            new CreateCommentRequest { HallId = hall.Id, Content = "Original" });

        var updated = await service.UpdateCommentAsync(
            created.CommentId, new UpdateCommentRequest { Content = "Edited by ordinary user" });

        Assert.Equal("Edited by ordinary user", updated.Content);
    }

    // --- Rating creation -----------------------------------------------------------------

    [Theory]
    [InlineData(AccountApprovalStatus.Pending)]
    [InlineData(AccountApprovalStatus.Rejected)]
    public async Task UnapprovedPhotographer_CannotRate(AccountApprovalStatus status)
    {
        var user = await CreateUserAsync($"r-photo-{status}@example.com", status,
            ApplicationRoles.RegisteredUser, ApplicationRoles.Photographer);
        var hall = AddHall("owner-1");
        var actor = CreateActor(user, ApplicationRoles.RegisteredUser, ApplicationRoles.Photographer);

        var exception = await Assert.ThrowsAsync<ForbiddenException>(() =>
            actor.CreateRatingService().CreateRatingAsync(
                new CreateRatingRequest { HallId = hall.Id, Value = 5 }));

        Assert.Contains(BlockedMessage, exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(_context.Ratings);
    }

    [Theory]
    [InlineData(AccountApprovalStatus.Pending)]
    [InlineData(AccountApprovalStatus.Rejected)]
    public async Task UnapprovedCoordinator_CannotRate(AccountApprovalStatus status)
    {
        var user = await CreateUserAsync($"r-coord-{status}@example.com", status,
            ApplicationRoles.RegisteredUser, ApplicationRoles.EventCoordinator);
        var hall = AddHall("owner-1");
        var actor = CreateActor(user, ApplicationRoles.RegisteredUser, ApplicationRoles.EventCoordinator);

        var exception = await Assert.ThrowsAsync<ForbiddenException>(() =>
            actor.CreateRatingService().CreateRatingAsync(
                new CreateRatingRequest { HallId = hall.Id, Value = 5 }));

        Assert.Contains(BlockedMessage, exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(_context.Ratings);
    }

    [Fact]
    public async Task ApprovedPhotographer_CanRate()
    {
        var user = await CreateUserAsync("r-photo-ok@example.com", AccountApprovalStatus.Approved,
            ApplicationRoles.RegisteredUser, ApplicationRoles.Photographer);
        var hall = AddHall("owner-1");
        var actor = CreateActor(user, ApplicationRoles.RegisteredUser, ApplicationRoles.Photographer);

        var result = await actor.CreateRatingService().CreateRatingAsync(
            new CreateRatingRequest { HallId = hall.Id, Value = 4 });

        Assert.Equal(4, result.Value);
        Assert.Single(_context.Ratings);
    }

    [Fact]
    public async Task OrdinaryPendingRegisteredUser_CanRate()
    {
        var user = await CreateUserAsync("r-plain@example.com", AccountApprovalStatus.Pending, ApplicationRoles.RegisteredUser);
        var hall = AddHall("owner-1");
        var actor = CreateActor(user, ApplicationRoles.RegisteredUser);

        var result = await actor.CreateRatingService().CreateRatingAsync(
            new CreateRatingRequest { HallId = hall.Id, Value = 3 });

        Assert.Equal(3, result.Value);
    }

    // --- Rating editing: the live-status rule on the edit path ---------------------------

    [Fact]
    public async Task PhotographerApprovalRevokedAfterRating_CannotUpdateRating()
    {
        var user = await CreateUserAsync("r-revoke@example.com", AccountApprovalStatus.Approved,
            ApplicationRoles.RegisteredUser, ApplicationRoles.Photographer);
        var hall = AddHall("owner-1");
        var actor = CreateActor(user, ApplicationRoles.RegisteredUser, ApplicationRoles.Photographer);
        var service = actor.CreateRatingService();
        await service.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 4 });

        await SetStatusAsync(user, AccountApprovalStatus.Pending);

        var exception = await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.UpdateRatingAsync(new UpdateRatingRequest { HallId = hall.Id, Value = 2 }));
        Assert.Contains(BlockedMessage, exception.Message, StringComparison.OrdinalIgnoreCase);

        _context.ChangeTracker.Clear();
        var row = await _context.Ratings.SingleAsync(r => r.HallId == hall.Id);
        Assert.Equal(4, row.Value);
    }

    [Fact]
    public async Task OrdinaryUser_CanUpdateOwnRating()
    {
        var user = await CreateUserAsync("r-edit-ok@example.com", AccountApprovalStatus.Pending, ApplicationRoles.RegisteredUser);
        var hall = AddHall("owner-1");
        var actor = CreateActor(user, ApplicationRoles.RegisteredUser);
        var service = actor.CreateRatingService();
        await service.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 2 });

        // Create and update happen in separate requests in production; simulate the
        // fresh scope so the repository's no-tracking read does not collide with the
        // instance created in this context.
        _context.ChangeTracker.Clear();

        var updated = await service.UpdateRatingAsync(new UpdateRatingRequest { HallId = hall.Id, Value = 5 });

        Assert.Equal(5, updated.Value);
    }

    // --- Delete is intentionally out of scope (spec blocks create/edit only) --------------

    [Fact]
    public async Task UnapprovedPhotographer_MayStillDeleteOwnComment()
    {
        // The specification blocks unapproved accounts from CREATING and EDITING
        // content; deletion of their own content stays available.
        var user = await CreateUserAsync("d-photo@example.com", AccountApprovalStatus.Pending,
            ApplicationRoles.RegisteredUser, ApplicationRoles.Photographer);
        var hall = AddHall("owner-1");
        var actor = CreateActor(user, ApplicationRoles.RegisteredUser, ApplicationRoles.Photographer);

        // Creation while approved, revocation afterwards, then delete still works.
        await SetStatusAsync(user, AccountApprovalStatus.Approved);
        var service = actor.CreateCommentService();
        var created = await service.CreateCommentAsync(
            new CreateCommentRequest { HallId = hall.Id, Content = "Deletable" });
        await SetStatusAsync(user, AccountApprovalStatus.Pending);

        await service.DeleteCommentAsync(created.CommentId);

        _context.ChangeTracker.Clear();
        var row = await _context.Comments.IgnoreQueryFilters().SingleAsync(c => c.Id == created.CommentId);
        Assert.True(row.IsDeleted);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }

    private sealed class FixedCurrentUser : ICurrentUserService
    {
        public FixedCurrentUser(string? userId, params string[] roles)
        {
            UserId = userId;
            IsAuthenticated = !string.IsNullOrWhiteSpace(userId);
            Roles = roles;
        }

        public string? UserId { get; }
        public string? UserName => "test";
        public string? Email => "test@example.com";
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles { get; }
    }
}
