using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Wesal.API.Controllers;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Admin;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public sealed class AdminAccountDeletionShould
{
    [Fact]
    public async Task DeleteProfessionalAccountWithNoDependentRecords()
    {
        await using var test = await Harness.CreateAsync();
        var owner = test.AddUser("owner");
        await test.Db.SaveChangesAsync();

        var result = await test.Service().DeleteAccountAsync(owner.Id, new DeleteAccountRequest { Confirm = true });

        Assert.True(result.Success);
        Assert.Null(await test.Db.Users.FindAsync(owner.Id));
    }

    [Fact]
    public async Task PreserveBookingAndSharedConversationHistoryWhileCleaningOwnedContent()
    {
        await using var test = await Harness.CreateAsync();
        var owner = test.AddUser("owner");
        var customer = test.AddUser("customer", professional: false);
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Owner hall", Address = "Center", OwnerId = owner.Id };
        test.Db.Halls.Add(hall);
        var bookingByOwner = new Booking { HallId = hall.Id, RequesterUserId = owner.Id, Date = new DateOnly(2026, 10, 20) };
        var bookingByCustomer = new Booking { HallId = hall.Id, RequesterUserId = customer.Id, Date = new DateOnly(2026, 10, 21) };
        test.Db.Bookings.AddRange(bookingByOwner, bookingByCustomer);

        var post = new Post { Id = Guid.NewGuid(), OwnerUserId = owner.Id, Content = "Owned work" };
        test.Db.Posts.Add(post);
        test.Db.PostComments.Add(new PostComment { PostId = post.Id, AuthorUserId = customer.Id, Text = "Customer comment" });

        var conversation = new Conversation
        {
            Id = Guid.NewGuid(), SenderUserId = customer.Id, HallOwnerId = owner.Id,
            Kind = ConversationKind.CustomerProvider
        };
        test.Db.Conversations.Add(conversation);
        var customerMessage = new Message { Id = Guid.NewGuid(), ConversationId = conversation.Id, SenderUserId = customer.Id, Content = "Is this available?" };
        var ownerMessage = new Message { Id = Guid.NewGuid(), ConversationId = conversation.Id, SenderUserId = owner.Id, Content = "Yes." };
        test.Db.Messages.AddRange(customerMessage, ownerMessage);
        test.Db.ConversationReadStates.AddRange(
            new ConversationReadState { ConversationId = conversation.Id, UserId = owner.Id },
            new ConversationReadState { ConversationId = conversation.Id, UserId = customer.Id });
        await test.Db.SaveChangesAsync();

        var result = await test.Service().DeleteAccountAsync(owner.Id, new DeleteAccountRequest { Confirm = true });

        Assert.True(result.Success);
        Assert.Null(await test.Db.Users.FindAsync(owner.Id));
        Assert.NotNull(await test.Db.Users.FindAsync(customer.Id));
        var retainedHall = await test.Db.Halls.SingleAsync(row => row.Id == hall.Id);
        Assert.True(retainedHall.IsDeleted);
        Assert.Null(retainedHall.OwnerId);
        Assert.Equal(new[] { bookingByOwner.Id, bookingByCustomer.Id }.Order(),
            await test.Db.Bookings.OrderBy(row => row.Id).Select(row => row.Id).ToArrayAsync());
        Assert.Equal(new[] { owner.Id, customer.Id }.Order(),
            await test.Db.Bookings.OrderBy(row => row.RequesterUserId).Select(row => row.RequesterUserId).ToArrayAsync());
        Assert.False(await test.Db.Posts.AnyAsync(row => row.Id == post.Id));
        Assert.False(await test.Db.PostComments.AnyAsync(row => row.PostId == post.Id));
        Assert.True(await test.Db.Conversations.AnyAsync(row => row.Id == conversation.Id));
        Assert.True(await test.Db.Messages.AnyAsync(row => row.Id == customerMessage.Id));
        Assert.False(await test.Db.Messages.AnyAsync(row => row.Id == ownerMessage.Id));
        Assert.False(await test.Db.ConversationReadStates.AnyAsync(row => row.UserId == owner.Id));
        Assert.True(await test.Db.ConversationReadStates.AnyAsync(row => row.UserId == customer.Id));
    }

    [Fact]
    public async Task RejectUnconfirmedSelfAndMissingAccountDeletionAndTreatRepeatAsNotFound()
    {
        await using var test = await Harness.CreateAsync();
        var owner = test.AddUser("owner");
        await test.Db.SaveChangesAsync();
        var service = test.Service();

        await Assert.ThrowsAsync<ValidationException>(() => service.DeleteAccountAsync(owner.Id, new DeleteAccountRequest { Confirm = false }));
        await Assert.ThrowsAsync<ValidationException>(() => service.DeleteAccountAsync("admin", new DeleteAccountRequest { Confirm = true }));
        await Assert.ThrowsAsync<NotFoundException>(() => service.DeleteAccountAsync("missing", new DeleteAccountRequest { Confirm = true }));

        await service.DeleteAccountAsync(owner.Id, new DeleteAccountRequest { Confirm = true });
        await Assert.ThrowsAsync<NotFoundException>(() => service.DeleteAccountAsync(owner.Id, new DeleteAccountRequest { Confirm = true }));
    }

    [Fact]
    public void KeepAccountDeletionEndpointRestrictedToAdministrators()
    {
        var authorization = Assert.Single(typeof(AdminModerationController).GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AuthorizeAttribute), inherit: true)
            .Cast<Microsoft.AspNetCore.Authorization.AuthorizeAttribute>());
        Assert.Equal(ApplicationPolicies.RequireAdmin, authorization.Policy);
    }

    private sealed class Harness : IAsyncDisposable
    {
        public ApplicationDbContext Db { get; }
        private readonly TestCurrentUser _current = new("admin");
        private readonly TrackingUnitOfWork _unitOfWork;

        private Harness(ApplicationDbContext db)
        {
            Db = db;
            _unitOfWork = new TrackingUnitOfWork(db);
        }

        public static async Task<Harness> CreateAsync()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
            var harness = new Harness(new ApplicationDbContext(options));
            await harness.Db.Database.EnsureCreatedAsync();
            return harness;
        }

        public ApplicationUser AddUser(string name, bool professional = true)
        {
            var user = new ApplicationUser { Id = Guid.NewGuid().ToString(), UserName = name, NormalizedUserName = name.ToUpperInvariant() };
            Db.Users.Add(user);
            if (professional)
                Db.CoordinatorProfiles.Add(new CoordinatorProfile
                {
                    Id = Guid.NewGuid(), UserId = user.Id, BusinessType = CoordinatorBusinessType.Shop,
                    ShopName = name, PhoneNumber = "000", IdentityDocumentUrl = $"private/{user.Id}/identity.jpg"
                });
            return user;
        }

        public AdminModerationService Service()
        {
            var manager = new Mock<UserManager<ApplicationUser>>(
                Mock.Of<IUserStore<ApplicationUser>>(), Options.Create(new IdentityOptions()), new PasswordHasher<ApplicationUser>(),
                Array.Empty<IUserValidator<ApplicationUser>>(), Array.Empty<IPasswordValidator<ApplicationUser>>(),
                new UpperInvariantLookupNormalizer(), new IdentityErrorDescriber(), Mock.Of<IServiceProvider>(), NullLogger<UserManager<ApplicationUser>>.Instance);
            manager.Setup(value => value.FindByIdAsync(It.IsAny<string>()))
                .Returns((string id) => Task.FromResult(Db.Users.FirstOrDefault(user => user.Id == id)));
            manager.Setup(value => value.IsInRoleAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()))
                .Returns((ApplicationUser _, string role) => Task.FromResult(role is ApplicationRoles.EventCoordinator or ApplicationRoles.Photographer));
            manager.Setup(value => value.DeleteAsync(It.IsAny<ApplicationUser>()))
                .Returns(async (ApplicationUser user) =>
                {
                    Assert.True(_unitOfWork.IsExecuting);
                    Db.Users.Remove(user);
                    await Db.SaveChangesAsync();
                    return IdentityResult.Success;
                });

            return new AdminModerationService(
                new AdminModerationRepository(Db), Mock.Of<IUserPublishingRestrictionRepository>(), Mock.Of<IUserNotificationWriter>(),
                Mock.Of<INotificationService>(), Mock.Of<INotificationDispatcher>(), _unitOfWork, manager.Object, _current,
                Mock.Of<IIdentityDocumentStore>(), TimeProvider.System, NullLogger<AdminModerationService>.Instance,
                Mock.Of<IConversationPresenceTracker>());
        }

        public async ValueTask DisposeAsync() => await Db.DisposeAsync();

        private sealed class TestCurrentUser(string? id) : ICurrentUserService
        {
            public string? UserId => id;
            public string? UserName => id;
            public string? Email => null;
            public bool IsAuthenticated => id is not null;
            public IReadOnlyList<string> Roles => [ApplicationRoles.Admin];
        }

        private sealed class TrackingUnitOfWork(ApplicationDbContext db) : IUnitOfWork
        {
            public bool IsExecuting { get; private set; }
            public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => db.SaveChangesAsync(cancellationToken);
            public Task ExecuteInTransactionAsync(Func<Task> operation, CancellationToken cancellationToken = default)
                => ExecuteInTransactionAsync(async () => { await operation(); return true; }, cancellationToken);
            public async Task<TResult> ExecuteInTransactionAsync<TResult>(Func<Task<TResult>> operation, CancellationToken cancellationToken = default)
            {
                IsExecuting = true;
                try { return await operation(); }
                finally { IsExecuting = false; }
            }
        }
    }
}
