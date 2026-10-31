using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Authorization;
using Wesal.Infrastructure.Publishing;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;
using Wesal.Persistence.Services;
using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

public sealed class PostInteractionServiceShould
{
    [Fact]
    public async Task RegisterShare_IsIdempotentForAUserWithinTwentyFourHours_AndCountsUsersAndNewDays()
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("owner", ApplicationRoles.EventCoordinator);
        var firstUser = await test.CreateUserAsync("first", ApplicationRoles.RegisteredUser);
        var secondUser = await test.CreateUserAsync("second", ApplicationRoles.RegisteredUser);
        var post = await test.CreatePostAsync(owner);
        var time = new MutableTimeProvider(new DateTimeOffset(2026, 10, 19, 12, 0, 0, TimeSpan.Zero));
        var service = new PostSharingService(new PostRepository(test.Context), test.CurrentUser,
            new UnitOfWork(test.Context), Options.Create(new PostSharingOptions { PublicWebBaseUrl = "https://wesal.example/" }),
            time, NullLogger<PostSharingService>.Instance);

        Assert.Equal($"https://wesal.example/posts/{post.Id:D}", await service.GetShareLinkAsync(post.Id));
        test.CurrentUser.UserId = firstUser.Id;
        await service.RegisterShareAsync(post.Id);
        await service.RegisterShareAsync(post.Id);
        await test.Context.Entry(post).ReloadAsync();
        Assert.Equal(1, post.ShareCount);
        Assert.Empty(test.Context.UserNotifications);

        test.CurrentUser.UserId = secondUser.Id;
        await service.RegisterShareAsync(post.Id);
        time.Advance(TimeSpan.FromHours(25));
        test.CurrentUser.UserId = firstUser.Id;
        await service.RegisterShareAsync(post.Id);
        await test.Context.Entry(post).ReloadAsync();
        Assert.Equal(3, post.ShareCount);
    }

    [Fact]
    public async Task ShareLink_UsesRelativeFallback_AndHidesPostsOfUnapprovedOwners()
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("owner", ApplicationRoles.EventCoordinator);
        var pending = await test.CreateUserAsync("pending", ApplicationRoles.EventCoordinator, AccountApprovalStatus.Pending);
        var post = await test.CreatePostAsync(owner);
        var hiddenPost = await test.CreatePostAsync(pending);
        var service = new PostSharingService(new PostRepository(test.Context), test.CurrentUser,
            new UnitOfWork(test.Context), Options.Create(new PostSharingOptions()), TimeProvider.System,
            NullLogger<PostSharingService>.Instance);

        Assert.Equal($"/posts/{post.Id:D}", await service.GetShareLinkAsync(post.Id));
        await Assert.ThrowsAsync<NotFoundException>(() => service.GetShareLinkAsync(hiddenPost.Id));
    }

    [Fact]
    public async Task FetchingTheShareLinkDoesNotCountAndRegisteringFromThePlatformLinkCountsOnce()
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("owner", ApplicationRoles.EventCoordinator);
        var viewer = await test.CreateUserAsync("viewer", ApplicationRoles.RegisteredUser);
        var post = await test.CreatePostAsync(owner);
        var service = new PostSharingService(new PostRepository(test.Context), test.CurrentUser,
            new UnitOfWork(test.Context), Options.Create(new PostSharingOptions { PublicWebBaseUrl = "https://wesal.example" }),
            TimeProvider.System, NullLogger<PostSharingService>.Instance);

        await service.GetShareLinkAsync(post.Id);
        await service.GetShareLinkAsync(post.Id);
        await test.Context.Entry(post).ReloadAsync();
        Assert.Equal(0, post.ShareCount);

        test.CurrentUser.UserId = viewer.Id;
        await service.RegisterShareAsync(post.Id);
        await test.Context.Entry(post).ReloadAsync();
        Assert.Equal(1, post.ShareCount);
        Assert.Empty(test.Context.UserNotifications);
    }

    [Fact]
    public async Task CreateCommentOnVisiblePost_WithoutRequiringCommenterApproval_AndNotifyCoordinator()
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("owner", ApplicationRoles.EventCoordinator);
        var commenter = await test.CreateUserAsync("commenter", ApplicationRoles.RegisteredUser, AccountApprovalStatus.Pending);
        test.Context.CoordinatorProfiles.Add(new CoordinatorProfile { Id = Guid.NewGuid(), UserId = owner.Id, BusinessType = CoordinatorBusinessType.Shop, ShopName = "Rose Studio", PhoneNumber = "1", IdentityDocumentUrl = "private" });
        var post = await test.CreatePostAsync(owner);
        test.CurrentUser.UserId = commenter.Id;

        var created = await test.Service.CreateCommentAsync(post.Id, new CreatePostCommentRequest { Text = "  مرحباً   بالعالم  " });

        Assert.Equal("مرحباً بالعالم", created.Text);
        Assert.Equal("Commenter", created.AuthorName);
        var notification = Assert.Single(test.Context.UserNotifications);
        Assert.Equal(NotificationKind.PostCommentedForCoordinator, notification.Kind);
        Assert.Equal("Commenter علّق على منشورك", notification.Body);
        Assert.Equal(NotificationActionTarget.Post, notification.ActionTarget);
        Assert.Equal(post.Id.ToString(), notification.TargetId);
        Assert.Single(test.Dispatcher.Dispatches);
    }

    [Fact]
    public async Task PendingProfessional_CannotCommentOnPosts()
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("owner", ApplicationRoles.EventCoordinator);
        var commenter = await test.CreateUserAsync("pending-photo", ApplicationRoles.Photographer, AccountApprovalStatus.Pending);
        var post = await test.CreatePostAsync(owner);
        test.CurrentUser.UserId = commenter.Id;
        test.CurrentUser.SetRoles(ApplicationRoles.Photographer);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            test.Service.CreateCommentAsync(post.Id, new CreatePostCommentRequest { Text = "Blocked" }));

        Assert.Empty(test.Context.PostComments);
    }

    [Fact]
    public async Task LinkCommentsToBothImageAndTextOnlyPosts()
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("owner", ApplicationRoles.EventCoordinator);
        var commenter = await test.CreateUserAsync("commenter", ApplicationRoles.RegisteredUser);
        var textPost = await test.CreatePostAsync(owner);
        var imagePost = await test.CreatePostAsync(owner, withImage: true);
        test.CurrentUser.UserId = commenter.Id;

        var textComment = await test.Service.CreateCommentAsync(textPost.Id, new CreatePostCommentRequest { Text = "Text post" });
        var imageComment = await test.Service.CreateCommentAsync(imagePost.Id, new CreatePostCommentRequest { Text = "Image post" });

        Assert.Equal(textPost.Id, textComment.PostId);
        Assert.Equal(imagePost.Id, imageComment.PostId);
        Assert.Null(textPost.Images.FirstOrDefault());
        Assert.Single(imagePost.Images);
    }

    [Fact]
    public async Task CreateCommentOnPhotographerWork_WithoutLeakingAdminOnlyFullName()
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("photographer-owner", ApplicationRoles.Photographer);
        var commenter = await test.CreateUserAsync("safe-public-name", ApplicationRoles.Photographer);
        test.Context.PhotographerProfiles.Add(new PhotographerProfile { Id = Guid.NewGuid(), UserId = commenter.Id, HasStudio = false, FullName = "COMMENTER ADMIN SECRET", PhoneNumber = "1", IdentityDocumentUrl = "private" });
        test.Context.PhotographerProfiles.Add(new PhotographerProfile { Id = Guid.NewGuid(), UserId = owner.Id, HasStudio = false, FullName = "ADMIN SECRET", PhoneNumber = "1", IdentityDocumentUrl = "private" });
        var post = await test.CreatePostAsync(owner);
        test.CurrentUser.UserId = commenter.Id;

        await test.Service.CreateCommentAsync(post.Id, new CreatePostCommentRequest { Text = "Nice" });

        var notification = Assert.Single(test.Context.UserNotifications);
        Assert.Equal(NotificationKind.PostCommentedForPhotographer, notification.Kind);
        Assert.Equal("مستخدم علّق على أحد أعمالك", notification.Body);
        var dto = await test.Service.ListCommentsAsync(post.Id, 1, 10);
        Assert.Equal("مستخدم", Assert.Single(dto.Items).AuthorName);
        var json = System.Text.Json.JsonSerializer.Serialize(dto);
        Assert.DoesNotContain("ADMIN SECRET", json);
        Assert.DoesNotContain("COMMENTER ADMIN SECRET", json);
    }

    [Theory]
    [InlineData("")]
    [InlineData("  \t \n")]
    [InlineData("<b></b>")]
    public async Task RejectEmptyOrMarkupOnlyComments(string text)
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("owner", ApplicationRoles.EventCoordinator);
        var commenter = await test.CreateUserAsync("commenter", ApplicationRoles.RegisteredUser);
        var post = await test.CreatePostAsync(owner);
        test.CurrentUser.UserId = commenter.Id;
        await Assert.ThrowsAsync<ValidationException>(() => test.Service.CreateCommentAsync(post.Id, new CreatePostCommentRequest { Text = text }));
    }

    [Fact]
    public async Task StripControlCharactersAndRejectCommentsOverTheMaximum()
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("owner", ApplicationRoles.EventCoordinator);
        var commenter = await test.CreateUserAsync("commenter", ApplicationRoles.RegisteredUser);
        var post = await test.CreatePostAsync(owner);
        test.CurrentUser.UserId = commenter.Id;
        var result = await test.Service.CreateCommentAsync(post.Id, new CreatePostCommentRequest { Text = "he\0llo" });
        Assert.Equal("hello", result.Text);
        await Assert.ThrowsAsync<ValidationException>(() => test.Service.CreateCommentAsync(post.Id, new CreatePostCommentRequest { Text = new string('x', PostCommentLimits.MaxTextLength + 1) }));
    }

    [Fact]
    public async Task FlattenRepliesAndNotifyOnceBasedOnTheCommentBeingRepliedTo()
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("owner", ApplicationRoles.EventCoordinator);
        var first = await test.CreateUserAsync("first", ApplicationRoles.RegisteredUser);
        var second = await test.CreateUserAsync("second", ApplicationRoles.HallOwner);
        test.Context.CoordinatorProfiles.Add(new CoordinatorProfile { Id = Guid.NewGuid(), UserId = owner.Id, BusinessType = CoordinatorBusinessType.Shop, ShopName = "Rose Studio", PhoneNumber = "1", IdentityDocumentUrl = "private" });
        var post = await test.CreatePostAsync(owner);
        test.CurrentUser.UserId = owner.Id;
        var top = await test.Service.CreateCommentAsync(post.Id, new CreatePostCommentRequest { Text = "Owner comment" });
        test.CurrentUser.UserId = first.Id;
        var reply = await test.Service.ReplyAsync(post.Id, top.Id, new CreatePostCommentRequest { Text = "Reply one" });
        test.CurrentUser.UserId = second.Id;
        var nestedReply = await test.Service.ReplyAsync(post.Id, reply.Id, new CreatePostCommentRequest { Text = "Reply two" });

        Assert.Equal(top.Id, reply.ParentCommentId);
        Assert.Equal(top.Id, nestedReply.ParentCommentId);
        Assert.Equal(reply.Id, nestedReply.ReplyToCommentId);
        Assert.Equal(2, test.Context.UserNotifications.Count());
        Assert.Contains(test.Context.UserNotifications, notification => notification.Kind == NotificationKind.PostCommentReplyForOwner);
        Assert.Contains(test.Context.UserNotifications, notification => notification.Kind == NotificationKind.PostCommentReplyOnOwnerPost);
        Assert.Contains(test.Context.UserNotifications, notification => notification.Body == "first رد على تعليقك");
        Assert.Contains(test.Context.UserNotifications, notification => notification.Body == "second رد على تعليق في منشورك");
        Assert.Equal(2, test.Dispatcher.Dispatches.Count);
        var replies = await test.Service.ListRepliesAsync(post.Id, top.Id, 1, 10);
        Assert.Equal(2, replies.TotalCount);
        Assert.Equal(2, Assert.Single((await test.Service.ListCommentsAsync(post.Id, 1, 10)).Items).ReplyCount);
    }

    [Fact]
    public async Task NotifyForRepliesToOtherUsersCommentsOnlyOnceAndNeverForTheOwnersOwnAction()
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("owner", ApplicationRoles.EventCoordinator);
        var first = await test.CreateUserAsync("first", ApplicationRoles.RegisteredUser);
        var second = await test.CreateUserAsync("second", ApplicationRoles.RegisteredUser);
        var post = await test.CreatePostAsync(owner);
        test.CurrentUser.UserId = first.Id;
        var top = await test.Service.CreateCommentAsync(post.Id, new CreatePostCommentRequest { Text = "A comment" });
        test.CurrentUser.UserId = second.Id;
        await test.Service.ReplyAsync(post.Id, top.Id, new CreatePostCommentRequest { Text = "A reply" });
        Assert.Equal(NotificationKind.PostCommentReplyOnOwnerPost, test.Context.UserNotifications.Last().Kind);
        var beforeOwnerAction = test.Dispatcher.Dispatches.Count;
        test.CurrentUser.UserId = owner.Id;
        await test.Service.CreateCommentAsync(post.Id, new CreatePostCommentRequest { Text = "Owner comment" });
        Assert.Equal(beforeOwnerAction, test.Dispatcher.Dispatches.Count);
        Assert.Equal(2, test.Context.UserNotifications.Count());
    }

    [Fact]
    public async Task NotifyOnlyThePhotographerOwnerForRepliesAndNeverTheCommentAuthor()
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("photographer-owner", ApplicationRoles.Photographer);
        var author = await test.CreateUserAsync("third-party-author", ApplicationRoles.RegisteredUser);
        var replier = await test.CreateUserAsync("replier", ApplicationRoles.RegisteredUser);
        var post = await test.CreatePostAsync(owner);

        test.CurrentUser.UserId = author.Id;
        var comment = await test.Service.CreateCommentAsync(post.Id, new CreatePostCommentRequest { Text = "Author comment" });
        test.CurrentUser.UserId = replier.Id;
        await test.Service.ReplyAsync(post.Id, comment.Id, new CreatePostCommentRequest { Text = "Reply to the author" });

        Assert.Equal(NotificationKind.PostCommentReplyOnOwnerPost, test.Context.UserNotifications.Last().Kind);
        Assert.DoesNotContain(test.Context.UserNotifications, row => row.RecipientUserId == author.Id);
        Assert.All(test.Context.UserNotifications, row => Assert.Equal(owner.Id, row.RecipientUserId));

        test.CurrentUser.UserId = owner.Id;
        var ownerComment = await test.Service.CreateCommentAsync(post.Id, new CreatePostCommentRequest { Text = "Owner comment" });
        test.CurrentUser.UserId = replier.Id;
        await test.Service.ReplyAsync(post.Id, ownerComment.Id, new CreatePostCommentRequest { Text = "Reply to the owner" });

        Assert.Equal(NotificationKind.PostCommentReplyForOwner, test.Context.UserNotifications.Last().Kind);
        Assert.All(test.Context.UserNotifications, row => Assert.Equal(owner.Id, row.RecipientUserId));
        Assert.Equal(3, test.Context.UserNotifications.Count()); // comment + reply-on-post + reply-to-owner
    }

    [Fact]
    public async Task RollBackCommentCreationWhenItsDurableNotificationCannotBeWritten()
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("owner", ApplicationRoles.EventCoordinator);
        var commenter = await test.CreateUserAsync("commenter", ApplicationRoles.RegisteredUser);
        var post = await test.CreatePostAsync(owner);
        test.CurrentUser.UserId = commenter.Id;
        var service = test.CreateService(new FailingNotificationWriter());

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateCommentAsync(post.Id, new CreatePostCommentRequest { Text = "Will roll back" }));

        Assert.Empty(await test.Context.PostComments.AsNoTracking().ToListAsync());
        Assert.Empty(await test.Context.UserNotifications.AsNoTracking().ToListAsync());
        Assert.Empty(test.Dispatcher.Dispatches);
    }

    [Fact]
    public async Task RestrictDeletionToTheAuthorAndDeleteAParentThreadWithoutNotifications()
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("owner", ApplicationRoles.EventCoordinator);
        var author = await test.CreateUserAsync("author", ApplicationRoles.RegisteredUser);
        var other = await test.CreateUserAsync("other", ApplicationRoles.HallOwner);
        var post = await test.CreatePostAsync(owner);
        test.CurrentUser.UserId = author.Id;
        var top = await test.Service.CreateCommentAsync(post.Id, new CreatePostCommentRequest { Text = "Top" });
        var reply = await test.Service.ReplyAsync(post.Id, top.Id, new CreatePostCommentRequest { Text = "Reply" });
        var notificationCount = test.Dispatcher.Dispatches.Count;
        test.CurrentUser.UserId = other.Id;
        await Assert.ThrowsAsync<ForbiddenException>(() => test.Service.DeleteCommentAsync(post.Id, top.Id));
        test.CurrentUser.UserId = author.Id;
        await test.Service.DeleteCommentAsync(post.Id, top.Id);
        Assert.Empty(test.Context.PostComments);
        Assert.Equal(notificationCount, test.Dispatcher.Dispatches.Count);
    }

    [Fact]
    public async Task RejectCommentsOnMissingOrNonPublicPosts()
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("owner", ApplicationRoles.EventCoordinator, AccountApprovalStatus.Pending);
        var commenter = await test.CreateUserAsync("commenter", ApplicationRoles.RegisteredUser);
        var post = await test.CreatePostAsync(owner);
        test.CurrentUser.UserId = commenter.Id;
        await Assert.ThrowsAsync<NotFoundException>(() => test.Service.CreateCommentAsync(Guid.NewGuid(), new CreatePostCommentRequest { Text = "Hi" }));
        await Assert.ThrowsAsync<NotFoundException>(() => test.Service.CreateCommentAsync(post.Id, new CreatePostCommentRequest { Text = "Hi" }));
        await Assert.ThrowsAsync<NotFoundException>(() => test.Service.ListCommentsAsync(post.Id, 1, 10));
    }

    [Fact]
    public async Task RejectAReplyWhenTheSuppliedPostDoesNotOwnTheComment()
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("owner", ApplicationRoles.EventCoordinator);
        var commenter = await test.CreateUserAsync("commenter", ApplicationRoles.RegisteredUser);
        var post = await test.CreatePostAsync(owner);
        var otherPost = await test.CreatePostAsync(owner);
        test.CurrentUser.UserId = commenter.Id;
        var comment = await test.Service.CreateCommentAsync(post.Id, new CreatePostCommentRequest { Text = "Parent" });
        await Assert.ThrowsAsync<NotFoundException>(() => test.Service.ReplyAsync(otherPost.Id, comment.Id, new CreatePostCommentRequest { Text = "Wrong post" }));
        Assert.Single(test.Context.PostComments);
    }

    [Fact]
    public async Task PaginateTopLevelCommentsNewestFirstAndRepliesOldestFirst()
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("owner", ApplicationRoles.EventCoordinator);
        var first = await test.CreateUserAsync("first", ApplicationRoles.RegisteredUser);
        var second = await test.CreateUserAsync("second", ApplicationRoles.RegisteredUser);
        var post = await test.CreatePostAsync(owner);
        test.Clock.Now = new DateTimeOffset(2026, 10, 19, 12, 0, 0, TimeSpan.Zero);
        test.CurrentUser.UserId = first.Id;
        var older = await test.Service.CreateCommentAsync(post.Id, new CreatePostCommentRequest { Text = "Older" });
        test.Clock.Now = test.Clock.Now.AddMinutes(1);
        test.CurrentUser.UserId = second.Id;
        var newer = await test.Service.CreateCommentAsync(post.Id, new CreatePostCommentRequest { Text = "Newer" });
        test.CurrentUser.UserId = first.Id;
        var firstReply = await test.Service.ReplyAsync(post.Id, newer.Id, new CreatePostCommentRequest { Text = "First reply" });
        test.Clock.Now = test.Clock.Now.AddMinutes(1);
        test.CurrentUser.UserId = second.Id;
        await test.Service.ReplyAsync(post.Id, newer.Id, new CreatePostCommentRequest { Text = "Second reply" });

        var firstPage = await test.Service.ListCommentsAsync(post.Id, 1, 1);
        var secondPage = await test.Service.ListCommentsAsync(post.Id, 2, 1);
        Assert.Equal(newer.Id, Assert.Single(firstPage.Items).Id);
        Assert.Equal(older.Id, Assert.Single(secondPage.Items).Id);
        var replyPage = await test.Service.ListRepliesAsync(post.Id, newer.Id, 1, 1);
        Assert.Equal(firstReply.Id, Assert.Single(replyPage.Items).Id);
        Assert.Equal(2, replyPage.TotalCount);
    }

    [Fact]
    public async Task AddRemoveAndListFavoritesIdempotentlyWithoutNotifications()
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("owner", ApplicationRoles.EventCoordinator);
        var saver = await test.CreateUserAsync("saver", ApplicationRoles.Photographer);
        var post = await test.CreatePostAsync(owner);
        test.CurrentUser.UserId = saver.Id;

        await test.Service.AddFavoriteAsync(post.Id);
        await test.Service.AddFavoriteAsync(post.Id);
        Assert.Equal(1, (await test.Context.Posts.SingleAsync()).SaveCount);
        Assert.Single(test.Context.PostFavorites);
        Assert.Empty(test.Context.UserNotifications);
        var favorites = await test.Service.ListFavoritesAsync(1, 10);
        Assert.Equal(post.Id, Assert.Single(favorites.Items).Id);
        await test.Service.RemoveFavoriteAsync(post.Id);
        await test.Service.RemoveFavoriteAsync(post.Id);
        Assert.Equal(0, (await test.Context.Posts.SingleAsync()).SaveCount);
        Assert.Empty(test.Context.PostFavorites);
        Assert.Empty(test.Context.UserNotifications);
    }

    [Fact]
    public async Task ListFavoritesNewestSavedFirstAndRejectUnauthenticatedUsers()
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("owner", ApplicationRoles.EventCoordinator);
        var saver = await test.CreateUserAsync("saver", ApplicationRoles.RegisteredUser);
        var older = await test.CreatePostAsync(owner);
        var newer = await test.CreatePostAsync(owner);
        test.CurrentUser.UserId = saver.Id;
        test.Clock.Now = new DateTimeOffset(2026, 10, 19, 12, 0, 0, TimeSpan.Zero);
        await test.Service.AddFavoriteAsync(older.Id);
        test.Clock.Now = test.Clock.Now.AddMinutes(1);
        await test.Service.AddFavoriteAsync(newer.Id);
        var result = await test.Service.ListFavoritesAsync(1, 1);
        Assert.Equal(newer.Id, Assert.Single(result.Items).Id);
        Assert.Equal(2, result.TotalCount);
        test.CurrentUser.UserId = null;
        await Assert.ThrowsAsync<UnauthorizedException>(() => test.Service.ListFavoritesAsync(1, 10));
    }

    [Fact]
    public async Task HideFavoritesOfPostsWhoseOwnersAreNoLongerApproved()
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("owner", ApplicationRoles.EventCoordinator);
        var saver = await test.CreateUserAsync("saver", ApplicationRoles.RegisteredUser);
        var post = await test.CreatePostAsync(owner);
        test.CurrentUser.UserId = saver.Id;
        await test.Service.AddFavoriteAsync(post.Id);
        owner.ApprovalStatus = AccountApprovalStatus.Pending;
        await test.Context.SaveChangesAsync();
        var result = await test.Service.ListFavoritesAsync(1, 10);
        Assert.Empty(result.Items);
        Assert.Equal(0, result.TotalCount);
        Assert.Single(test.Context.PostFavorites);
    }

    [Fact]
    public async Task LockedOwnersContentAndFavoritesDisappearAndReturnAfterManualUnlock()
    {
        await using var test = await TestHarness.CreateAsync();
        var owner = await test.CreateUserAsync("owner", ApplicationRoles.EventCoordinator);
        var saver = await test.CreateUserAsync("saver", ApplicationRoles.RegisteredUser);
        var post = await test.CreatePostAsync(owner);
        test.CurrentUser.UserId = saver.Id;
        await test.Service.AddFavoriteAsync(post.Id);

        var now = DateTimeOffset.UtcNow;
        var accountLock = new UserPublishingRestriction
        {
            Id = Guid.NewGuid(), UserId = owner.Id, StartsAt = now.AddMinutes(-1), EndsAt = now.AddHours(1),
            CreatedByAdminId = "admin", CreatedAt = now.AddMinutes(-1)
        };
        test.Context.AccountLocks.Add(accountLock);
        await test.Context.SaveChangesAsync();
        var sharing = new PostSharingService(new PostRepository(test.Context), test.CurrentUser,
            new UnitOfWork(test.Context), Options.Create(new PostSharingOptions()), TimeProvider.System,
            NullLogger<PostSharingService>.Instance);

        await Assert.ThrowsAsync<NotFoundException>(() => sharing.GetShareLinkAsync(post.Id));
        await Assert.ThrowsAsync<NotFoundException>(() => sharing.RegisterShareAsync(post.Id));
        Assert.Empty((await test.Service.ListFavoritesAsync(1, 10)).Items);
        Assert.Single(test.Context.PostFavorites);

        accountLock.LiftedAt = DateTimeOffset.UtcNow;
        accountLock.LiftedByAdminId = "admin";
        await test.Context.SaveChangesAsync();
        Assert.Single((await test.Service.ListFavoritesAsync(1, 10)).Items);
        Assert.StartsWith("/posts/", await sharing.GetShareLinkAsync(post.Id));
        Assert.Single(test.Context.PostFavorites);
    }

    private sealed class TestHarness : IAsyncDisposable
    {
        private readonly ServiceProvider _provider;
        public ApplicationDbContext Context { get; }
        public MutableCurrentUser CurrentUser { get; } = new();
        public FakeNotificationService Notifications { get; } = new();
        public RecordingNotificationDispatcher Dispatcher { get; } = new();
        public TestClock Clock { get; } = new();
        public IPostInteractionService Service { get; }
        private readonly UserManager<ApplicationUser> _users;

        private TestHarness(ServiceProvider provider)
        {
            _provider = provider;
            Context = provider.GetRequiredService<ApplicationDbContext>();
            _users = provider.GetRequiredService<UserManager<ApplicationUser>>();
            Service = new PostInteractionService(new PostInteractionRepository(Context), CurrentUser, new UnitOfWork(Context), _users, Notifications,
                new UserNotificationWriter(Context), Dispatcher, Clock, approvalGuard: new AccountApprovalGuard(CurrentUser, _users));
        }

        public IPostInteractionService CreateService(IUserNotificationWriter notificationWriter)
            => new PostInteractionService(new PostInteractionRepository(Context), CurrentUser, new UnitOfWork(Context), _users,
                Notifications, notificationWriter, Dispatcher, Clock, approvalGuard: new AccountApprovalGuard(CurrentUser, _users));

        public static async Task<TestHarness> CreateAsync()
        {
            var services = new ServiceCollection();
            services.AddDbContext<ApplicationDbContext>(options =>
            {
                options.UseInMemoryDatabase(Guid.NewGuid().ToString());
                options.ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning));
            });
            services.AddIdentityCore<ApplicationUser>().AddRoles<ApplicationRole>().AddEntityFrameworkStores<ApplicationDbContext>();
            services.AddLogging();
            var provider = services.BuildServiceProvider();
            var harness = new TestHarness(provider);
            await harness.Context.Database.EnsureCreatedAsync();
            var roles = provider.GetRequiredService<RoleManager<ApplicationRole>>();
            foreach (var role in new[] { ApplicationRoles.EventCoordinator, ApplicationRoles.Photographer, ApplicationRoles.RegisteredUser, ApplicationRoles.HallOwner })
                await roles.CreateAsync(new ApplicationRole(role));
            return harness;
        }

        public async Task<ApplicationUser> CreateUserAsync(string name, string role, AccountApprovalStatus approval = AccountApprovalStatus.Approved)
        {
            var user = new ApplicationUser { Id = Guid.NewGuid().ToString(), UserName = name, Email = name + "@example.test", FullName = name == "commenter" ? "Commenter" : name, ApprovalStatus = approval };
            var created = await _users.CreateAsync(user, "Password123!");
            Assert.True(created.Succeeded, string.Join(",", created.Errors.Select(error => error.Description)));
            var added = await _users.AddToRoleAsync(user, role);
            Assert.True(added.Succeeded);
            return user;
        }

        public async Task<Post> CreatePostAsync(ApplicationUser owner, bool withImage = false)
        {
            var post = new Post { Id = Guid.NewGuid(), OwnerUserId = owner.Id, Content = withImage ? null : "Post" };
            if (withImage)
                post.Images.Add(new PostImage { Id = Guid.NewGuid(), PostId = post.Id, Order = 0, StorageKey = "post-image.png", ContentType = "image/png" });
            Context.Posts.Add(post);
            await Context.SaveChangesAsync();
            return post;
        }

        public async ValueTask DisposeAsync() => await _provider.DisposeAsync();
    }

    private sealed class MutableCurrentUser : ICurrentUserService
    {
        public string? UserId { get; set; }
        public string? UserName => UserId;
        public string? Email => null;
        public bool IsAuthenticated => UserId is not null;
        private IReadOnlyList<string> _roles = [];
        public IReadOnlyList<string> Roles => _roles;
        public void SetRoles(params string[] roles) => _roles = roles;
    }

    private sealed class TestClock : IDateTime { public DateTimeOffset Now { get; set; } = new(2026, 10, 19, 12, 0, 0, TimeSpan.Zero); }

    private sealed class MutableTimeProvider(DateTimeOffset now) : TimeProvider
    {
        private DateTimeOffset _now = now;
        public override DateTimeOffset GetUtcNow() => _now;
        public void Advance(TimeSpan elapsed) => _now = _now.Add(elapsed);
    }

    private sealed class FailingNotificationWriter : Wesal.Application.Common.Interfaces.Persistence.IUserNotificationWriter
    {
        public Task AddAsync(UserNotification notification, CancellationToken cancellationToken = default)
            => throw new InvalidOperationException("Notification persistence failed.");
    }
}
