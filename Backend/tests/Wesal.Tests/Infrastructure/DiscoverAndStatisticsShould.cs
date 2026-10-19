using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Moq;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Persistence.Services;
using Wesal.API.Controllers;

namespace Wesal.Tests.Infrastructure;

public sealed class DiscoverAndStatisticsShould
{
    private static readonly DateTimeOffset Now = new(2026, 10, 19, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AllFeedContainsOnlyPublicHallsAndProfessionalPosts()
    {
        await using var test = await Harness.CreateAsync();
        var coordinator = test.AddProfessional(ApplicationRoles.EventCoordinator, "shop-owner", "Rose Shop");
        var photographer = test.AddPhotographer("studio-owner", "Private Legal Name", "Light Studio");
        var pending = test.AddProfessional(ApplicationRoles.EventCoordinator, "pending-owner", "Pending Shop", AccountApprovalStatus.Pending);
        test.AddHall("Public Hall");
        test.AddHall("Unpaid Hall", paid: false);
        test.AddPost(coordinator, "Coordinator post");
        test.AddPost(photographer, "Photographer post");
        test.AddPost(pending, "Hidden post");
        test.AddOffer(coordinator, Now.AddHours(-1), Now.AddHours(1));
        await test.Db.SaveChangesAsync();

        var service = test.Discover();
        var all = await service.GetFeedAsync("All", 1, 20);
        var halls = await service.GetFeedAsync("Halls", 1, 20);
        var photographers = await service.GetFeedAsync("Photographers", 1, 20);

        Assert.Equal(3, all.TotalCount);
        Assert.Equal(2, all.Items.Count(item => item.ContentType == "Post"));
        Assert.Single(all.Items, item => item.ContentType == "Hall");
        Assert.DoesNotContain(all.Items, item => item.ContentType.Contains("Offer", StringComparison.Ordinal));
        Assert.Equal("Public Hall", Assert.Single(halls.Items).DisplayName);
        var photographerCard = Assert.Single(photographers.Items);
        Assert.Equal("Light Studio", photographerCard.DisplayName);
        Assert.DoesNotContain("Private Legal Name", JsonSerializer.Serialize(photographers.Items));
    }

    [Fact]
    public async Task OffersAreVisibleOnlyFromInclusiveStartToExclusiveEndAndHallRemainsDiscoverable()
    {
        await using var test = await Harness.CreateAsync();
        var owner = test.AddProfessional(ApplicationRoles.EventCoordinator, "owner", "Market");
        var hall = test.AddHall("Hall with offer");
        test.AddOffer(owner, Now, Now.AddHours(1));
        test.AddOffer(owner, Now.AddTicks(1), Now.AddHours(1), content: "Not started");
        test.AddOffer(owner, Now.AddHours(-1), Now, content: "Ended");
        test.AddOffer(owner, Now.AddHours(-1), Now.AddHours(1), stopped: true, content: "Stopped");
        test.Db.HallOffers.Add(new HallOffer
        {
            HallId = hall.Id, OldBookingPrice = 1000, OfferPrice = 800,
            StartsAt = Now, EndsAt = Now.AddHours(1), CreatedAt = Now
        });
        await test.Db.SaveChangesAsync();

        var offers = await test.Discover().GetFeedAsync("Offers", 1, 20);
        var halls = await test.Discover().GetFeedAsync("Halls", 1, 20);

        Assert.Equal(2, offers.TotalCount);
        Assert.Contains(offers.Items, item => item.ContentType == "ProfessionalOffer" && item.Content == null);
        Assert.Contains(offers.Items, item => item.ContentType == "HallOffer" && item.DisplayName == "Hall with offer");
        Assert.Contains(halls.Items, item => item.DisplayName == "Hall with offer");
    }

    [Fact]
    public async Task SearchUsesOnlyPublicCategoryNamesAndHallArea()
    {
        await using var test = await Harness.CreateAsync();
        var coordinator = test.AddProfessional(ApplicationRoles.EventCoordinator, "coordinator", "Rose Shop");
        test.AddProfessional(ApplicationRoles.EventCoordinator, "freelancer", "ignored", businessType: CoordinatorBusinessType.Freelance, storeName: "Gift Market");
        test.AddPhotographer("photo", "Secret Legal Name", "Light Studio");
        test.AddPhotographer("no-studio", "Another Private Name", null, hasStudio: false);
        test.AddHall("Rose Hall", address: "North Area");
        await test.Db.SaveChangesAsync();

        var search = test.Discover();
        Assert.Equal("Rose Shop", Assert.Single((await search.SearchAsync("Event Coordinators", "rose", 1, 20)).Items).DisplayName);
        Assert.Equal("Gift Market", Assert.Single((await search.SearchAsync("Event Coordinators", "gift", 1, 20)).Items).DisplayName);
        Assert.Equal("Light Studio", Assert.Single((await search.SearchAsync("Photographers", "light", 1, 20)).Items).DisplayName);
        Assert.Equal("Rose Hall", Assert.Single((await search.SearchAsync("Halls", "north area", 1, 20)).Items).DisplayName);
        Assert.Empty((await search.SearchAsync("All", "Secret Legal Name", 1, 20)).Items);
        Assert.Empty((await search.SearchAsync("All", "Another Private Name", 1, 20)).Items);
        Assert.Empty((await search.SearchAsync("All", "%' OR 1=1 --", 1, 20)).Items);
        Assert.Empty((await search.SearchAsync("All", "   ", 1, 20)).Items);
        await Assert.ThrowsAsync<ValidationException>(() => search.SearchAsync("Offers", "rose", 1, 20));
        await Assert.ThrowsAsync<ValidationException>(() => search.GetFeedAsync("invalid", 1, 10));
    }

    [Fact]
    public async Task UsesDeterministicMixedPaginationAndRejectsInvalidWindows()
    {
        await using var test = await Harness.CreateAsync();
        var coordinator = test.AddProfessional(ApplicationRoles.EventCoordinator, "owner", "Shop");
        test.AddHall("Hall");
        test.AddPost(coordinator, "One");
        test.AddPost(coordinator, "Two");
        await test.Db.SaveChangesAsync();
        var service = test.Discover();

        var first = await service.GetFeedAsync("All", 1, 2);
        var second = await service.GetFeedAsync("All", 2, 2);

        Assert.Equal(3, first.TotalCount);
        Assert.Equal(2, first.Items.Count);
        Assert.Single(second.Items);
        Assert.Empty(first.Items.Select(row => row.Id).Intersect(second.Items.Select(row => row.Id)));
        await Assert.ThrowsAsync<ValidationException>(() => service.GetFeedAsync("All", 0, 10));
        await Assert.ThrowsAsync<ValidationException>(() => service.GetFeedAsync("All", 1, 1000));
    }

    [Fact]
    public async Task CountsPostAndProfileViewEventsForTheAuthenticatedOwnerOnly()
    {
        await using var test = await Harness.CreateAsync();
        var owner = test.AddProfessional(ApplicationRoles.EventCoordinator, "owner", "Shop");
        var post = test.AddPost(owner, "safe post excerpt");
        post.SaveCount = 3;
        post.ShareCount = 2;
        var other = test.AddProfessional(ApplicationRoles.Photographer, "other", "Other Studio");
        test.AddPost(other, "other post");
        await test.Db.SaveChangesAsync();
        test.CurrentUser.UserId = owner.Id;
        var service = new StatisticsService(test.Db, test.CurrentUser, new FixedClock(Now));

        await service.RecordPostViewAsync(post.Id);
        await service.RecordPostViewAsync(post.Id);
        await service.RecordProfileViewAsync(owner.Id);
        await service.RecordProfileViewAsync(owner.Id);
        var stats = await service.GetMyStatisticsAsync(1, 20);

        Assert.Equal(2, stats.TotalPostViewCount);
        Assert.Equal(2, stats.ProfileViewCount);
        Assert.Equal(3, stats.TotalSaveCount);
        Assert.Equal(2, stats.TotalShareCount);
        Assert.Equal(2, Assert.Single(stats.Posts).ViewCount);
        Assert.DoesNotContain("Private", JsonSerializer.Serialize(stats));
        Assert.Empty(test.Db.UserNotifications);

        test.CurrentUser.UserId = "non-professional-id";
        await Assert.ThrowsAsync<ForbiddenException>(() => service.GetMyStatisticsAsync(1, 20));
    }

    [Fact]
    public async Task RecordsViewsAtPostAndPublicProfileDetailBoundariesOnly()
    {
        var postId = Guid.NewGuid();
        var posts = new Mock<IPostService>();
        posts.Setup(service => service.GetPublicAsync(postId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PublicProfileContentDto { Id = postId });
        var statistics = new Mock<IStatisticsService>();
        statistics.Setup(service => service.RecordPostViewAsync(postId, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        var postsController = new PostsController(posts.Object, Mock.Of<IPostSharingService>(), statistics.Object);

        await postsController.GetById(postId, CancellationToken.None);

        statistics.Verify(service => service.RecordPostViewAsync(postId, It.IsAny<CancellationToken>()), Times.Once);
        posts.Verify(service => service.ListProfileAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);

        var profileService = new Mock<IProfessionalProfileService>();
        profileService.Setup(service => service.GetPublicProfileAsync("owner", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PublicProfessionalProfileResponse { UserId = "owner", IsPubliclyAvailable = true });
        statistics.Setup(service => service.RecordProfileViewAsync("owner", It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        var profilesController = new ProfileController(Mock.Of<IProfileService>(), profileService.Object, statistics.Object);

        await profilesController.GetPublicProfile("owner", CancellationToken.None);

        statistics.Verify(service => service.RecordProfileViewAsync("owner", It.IsAny<CancellationToken>()), Times.Once);
    }

    private sealed class Harness : IAsyncDisposable
    {
        private readonly List<(string Id, string Name)> _roles = [];
        public ApplicationDbContext Db { get; }
        public TestCurrentUser CurrentUser { get; } = new();

        private Harness(DbContextOptions<ApplicationDbContext> options)
        {
            Db = new ApplicationDbContext(options);
        }

        public static async Task<Harness> CreateAsync()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            var test = new Harness(options);
            await test.Db.Database.EnsureCreatedAsync();
            foreach (var role in new[] { ApplicationRoles.EventCoordinator, ApplicationRoles.Photographer, ApplicationRoles.HallOwner })
            {
                var id = Guid.NewGuid().ToString();
                test._roles.Add((id, role));
                test.Db.Roles.Add(new ApplicationRole { Id = id, Name = role, NormalizedName = role.ToUpperInvariant() });
            }
            await test.Db.SaveChangesAsync();
            return test;
        }

        public ApplicationUser AddProfessional(string role, string username, string displayName,
            AccountApprovalStatus approval = AccountApprovalStatus.Approved, CoordinatorBusinessType businessType = CoordinatorBusinessType.Shop,
            string? storeName = null)
        {
            var user = AddUser(role, username, approval);
            Db.CoordinatorProfiles.Add(new CoordinatorProfile
            {
                Id = Guid.NewGuid(), UserId = user.Id, BusinessType = businessType,
                ShopName = businessType == CoordinatorBusinessType.Shop ? displayName : null,
                OnlineStoreName = businessType == CoordinatorBusinessType.Freelance ? storeName ?? displayName : null,
                PhoneNumber = "000", IdentityDocumentUrl = "private"
            });
            return user;
        }

        public ApplicationUser AddPhotographer(string username, string fullName, string? studioName, bool hasStudio = true)
        {
            var user = AddUser(ApplicationRoles.Photographer, username, AccountApprovalStatus.Approved);
            Db.PhotographerProfiles.Add(new PhotographerProfile
            {
                Id = Guid.NewGuid(), UserId = user.Id, HasStudio = hasStudio,
                FullName = hasStudio ? null : fullName, StudioName = studioName,
                PhoneNumber = "000", IdentityDocumentUrl = "private"
            });
            return user;
        }

        public Hall AddHall(string name, string address = "Center", bool paid = true)
        {
            var hall = new Hall
            {
                Id = Guid.NewGuid(), Name = name, Address = address, Status = HallStatus.Approved,
                PaymentStatus = paid ? HallPaymentStatus.Paid : HallPaymentStatus.Unpaid,
                CreatedAt = Now, MainImageUrl = "/hall.jpg"
            };
            Db.Halls.Add(hall);
            return hall;
        }

        public Post AddPost(ApplicationUser owner, string content)
        {
            var post = new Post { Id = Guid.NewGuid(), OwnerUserId = owner.Id, Content = content, CreatedAt = Now };
            Db.Posts.Add(post);
            return post;
        }

        public void AddOffer(ApplicationUser owner, DateTimeOffset startsAt, DateTimeOffset endsAt, bool stopped = false, string? content = null)
            => Db.ProfessionalOffers.Add(new ProfessionalOffer
            {
                Id = Guid.NewGuid(), OwnerUserId = owner.Id, Content = content,
                OldPrice = 100, OfferPrice = 80, StartsAt = startsAt, EndsAt = endsAt,
                StoppedAt = stopped ? Now : null, CreatedAt = startsAt
            });

        public IDiscoverService Discover() => new DiscoverService(Db, new FixedClock(Now));

        private ApplicationUser AddUser(string role, string username, AccountApprovalStatus approval)
        {
            var user = new ApplicationUser { Id = Guid.NewGuid().ToString(), UserName = username, NormalizedUserName = username.ToUpperInvariant(), ApprovalStatus = approval };
            Db.Users.Add(user);
            var roleId = _roles.Single(row => row.Name == role).Id;
            Db.UserRoles.Add(new Microsoft.AspNetCore.Identity.IdentityUserRole<string> { UserId = user.Id, RoleId = roleId });
            return user;
        }

        public async ValueTask DisposeAsync() => await Db.DisposeAsync();
    }

    private sealed class TestCurrentUser : ICurrentUserService
    {
        public string? UserId { get; set; }
        public string? UserName => UserId;
        public string? Email => null;
        public bool IsAuthenticated => UserId is not null;
        public IReadOnlyList<string> Roles => [];
    }

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
