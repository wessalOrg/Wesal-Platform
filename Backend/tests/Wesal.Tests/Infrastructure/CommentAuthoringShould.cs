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
using Wesal.Infrastructure.Comments;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Author-owned comment lifecycle (Edit 22) against the real repositories: edits and
/// deletes are author-scoped, deleted comments vanish from retrieval, and responses
/// carry the persisted profile name and picture (resolved in one query, never N+1).
/// </summary>
public class CommentAuthoringShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public CommentAuthoringShould()
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
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.RegisteredUser)).GetAwaiter().GetResult();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.HallOwner)).GetAwaiter().GetResult();
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
    }

    private async Task<ApplicationUser> CreateUserAsync(
        string email,
        string phone,
        string role,
        string fullName = "Seeker User",
        string? profilePictureUrl = null)
    {
        var user = new ApplicationUser
        {
            FullName = fullName,
            Email = email,
            UserName = email,
            PhoneNumber = phone,
            ProfilePictureUrl = profilePictureUrl
        };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded) throw new Exception(string.Join(",", result.Errors.Select(e => e.Description)));
        await _userManager.AddToRoleAsync(user, role);
        return user;
    }

    private Hall AddHall(string ownerId)
    {
        var hall = new Hall
        {
            Name = "Grand Hall",
            Address = "Al-Rashid Street, Gaza",
            Region = HallRegion.Gaza,
            Capacity = 200,
            OwnerId = ownerId,
            Status = HallStatus.Approved,
            PaymentStatus = HallPaymentStatus.Paid,
            IsDeleted = false
        };
        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private CommentService CreateService(string? userId, bool authenticated)
        => new(new CommentRepository(_context), new HallRepository(_context),
            new FakeCurrentUser(userId, authenticated, ApplicationRoles.RegisteredUser));

    [Fact]
    public async Task CreateComment_ReturnsActualProfileNameAndPicture()
    {
        var user = await CreateUserAsync("s1@example.com", "+970599100001", ApplicationRoles.RegisteredUser,
            fullName: "Layla Hassan", profilePictureUrl: "/uploads/profiles/layla.jpg");
        var hall = AddHall("owner-1");

        var result = await CreateService(user.Id, true)
            .CreateCommentAsync(new CreateCommentRequest { HallId = hall.Id, Content = "Beautiful hall!" });

        Assert.Equal("Layla Hassan", result.UserName);
        Assert.Equal("/uploads/profiles/layla.jpg", result.UserProfilePictureUrl);
        Assert.Equal(user.Id, result.UserId);
    }

    [Fact]
    public async Task CreateComment_WithoutPicture_ReturnsNullPicture()
    {
        var user = await CreateUserAsync("s2@example.com", "+970599100002", ApplicationRoles.RegisteredUser,
            fullName: "Omar Khalil");
        var hall = AddHall("owner-1");

        var result = await CreateService(user.Id, true)
            .CreateCommentAsync(new CreateCommentRequest { HallId = hall.Id, Content = "Nice!" });

        Assert.Equal("Omar Khalil", result.UserName);
        Assert.Null(result.UserProfilePictureUrl);
    }

    [Fact]
    public async Task GetHallComments_ReturnsProfileNamesInOneListing()
    {
        var author = await CreateUserAsync("s3@example.com", "+970599100003", ApplicationRoles.RegisteredUser,
            fullName: "Sara Nasser", profilePictureUrl: "/uploads/profiles/sara.jpg");
        var hall = AddHall("owner-1");
        var service = CreateService(author.Id, true);
        await service.CreateCommentAsync(new CreateCommentRequest { HallId = hall.Id, Content = "First!" });
        await service.CreateCommentAsync(new CreateCommentRequest { HallId = hall.Id, Content = "Second!" });

        var comments = await CreateService(null, false).GetHallCommentsAsync(hall.Id);

        Assert.Equal(2, comments.Count);
        Assert.All(comments, c => Assert.Equal("Sara Nasser", c.UserName));
        Assert.All(comments, c => Assert.Equal("/uploads/profiles/sara.jpg", c.UserProfilePictureUrl));
    }

    [Fact]
    public async Task Author_CanEdit_OwnComment()
    {
        var user = await CreateUserAsync("s4@example.com", "+970599100004", ApplicationRoles.RegisteredUser);
        var hall = AddHall("owner-1");
        var service = CreateService(user.Id, true);
        var created = await service.CreateCommentAsync(
            new CreateCommentRequest { HallId = hall.Id, Content = "Original" });

        var updated = await service.UpdateCommentAsync(
            created.CommentId, new UpdateCommentRequest { Content = "Edited content" });

        Assert.Equal("Edited content", updated.Content);
        Assert.Equal(created.CommentId, updated.CommentId);

        _context.ChangeTracker.Clear();
        var reloaded = await _context.Comments.FindAsync(created.CommentId);
        Assert.Equal("Edited content", reloaded!.Content);
    }

    [Fact]
    public async Task NonAuthor_CannotEdit_Comment()
    {
        var author = await CreateUserAsync("s5@example.com", "+970599100005", ApplicationRoles.RegisteredUser);
        var intruder = await CreateUserAsync("s6@example.com", "+970599100006", ApplicationRoles.RegisteredUser);
        var hall = AddHall("owner-1");
        var created = await CreateService(author.Id, true)
            .CreateCommentAsync(new CreateCommentRequest { HallId = hall.Id, Content = "Mine" });

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            CreateService(intruder.Id, true).UpdateCommentAsync(
                created.CommentId, new UpdateCommentRequest { Content = "Hijacked" }));

        Assert.Contains("author", ex.Message, StringComparison.OrdinalIgnoreCase);

        _context.ChangeTracker.Clear();
        var reloaded = await _context.Comments.FindAsync(created.CommentId);
        Assert.Equal("Mine", reloaded!.Content);
    }

    [Fact]
    public async Task UpdateComment_InvalidContent_IsRejected()
    {
        var user = await CreateUserAsync("s7@example.com", "+970599100007", ApplicationRoles.RegisteredUser);
        var hall = AddHall("owner-1");
        var service = CreateService(user.Id, true);
        var created = await service.CreateCommentAsync(
            new CreateCommentRequest { HallId = hall.Id, Content = "Original" });

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.UpdateCommentAsync(created.CommentId, new UpdateCommentRequest { Content = "" }));

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.UpdateCommentAsync(created.CommentId, new UpdateCommentRequest { Content = new string('x', 1001) }));
    }

    [Fact]
    public async Task UpdateComment_MissingComment_ReturnsNotFound()
    {
        var user = await CreateUserAsync("s8@example.com", "+970599100008", ApplicationRoles.RegisteredUser);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateService(user.Id, true).UpdateCommentAsync(
                Guid.NewGuid(), new UpdateCommentRequest { Content = "Ghost" }));
    }

    [Fact]
    public async Task Author_CanDelete_CommentDisappearsFromListing()
    {
        var user = await CreateUserAsync("s9@example.com", "+970599100009", ApplicationRoles.RegisteredUser);
        var hall = AddHall("owner-1");
        var service = CreateService(user.Id, true);
        var created = await service.CreateCommentAsync(
            new CreateCommentRequest { HallId = hall.Id, Content = "Remove me" });

        await service.DeleteCommentAsync(created.CommentId);

        var comments = await CreateService(null, false).GetHallCommentsAsync(hall.Id);
        Assert.Empty(comments);

        // Soft-deleted: the row survives for history but reads as gone.
        _context.ChangeTracker.Clear();
        var row = await _context.Comments
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == created.CommentId);
        Assert.NotNull(row);
        Assert.True(row!.IsDeleted);
    }

    [Fact]
    public async Task NonAuthor_CannotDelete_Comment()
    {
        var author = await CreateUserAsync("s10@example.com", "+970599100010", ApplicationRoles.RegisteredUser);
        var intruder = await CreateUserAsync("s11@example.com", "+970599100011", ApplicationRoles.RegisteredUser);
        var hall = AddHall("owner-1");
        var created = await CreateService(author.Id, true)
            .CreateCommentAsync(new CreateCommentRequest { HallId = hall.Id, Content = "Mine" });

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            CreateService(intruder.Id, true).DeleteCommentAsync(created.CommentId));

        var comments = await CreateService(null, false).GetHallCommentsAsync(hall.Id);
        Assert.Single(comments);
    }

    [Fact]
    public async Task DeleteComment_MissingComment_ReturnsNotFound()
    {
        var user = await CreateUserAsync("s12@example.com", "+970599100012", ApplicationRoles.RegisteredUser);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateService(user.Id, true).DeleteCommentAsync(Guid.NewGuid()));
    }

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

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }
}
