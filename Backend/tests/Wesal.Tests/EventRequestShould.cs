using System.Text.Json;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;
using Wesal.Domain.Constants;
using Wesal.Domain.Enums;
using Wesal.Domain.Entities;
using Wesal.Domain.Exceptions;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Persistence.Services;

namespace Wesal.Tests;

public sealed class EventRequestShould
{
    [Fact]
    public async Task Reject_missing_answers_past_dates_and_all_no_answers()
    {
        var validator = new EventRequestCreateRequestValidator();
        var missing = await validator.ValidateAsync(new EventRequestCreateRequest("Name", DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)), EventType.WEDDING, true, null, false));
        var past = await validator.ValidateAsync(new EventRequestCreateRequest("Name", DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), EventType.WEDDING, true, false, false));
        var allNo = await validator.ValidateAsync(new EventRequestCreateRequest("Name", DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)), EventType.WEDDING, false, false, false));
        Assert.False(missing.IsValid);
        Assert.False(past.IsValid);
        Assert.False(allNo.IsValid);
    }

    [Fact]
    public async Task Return_exact_configuration_for_all_six_event_types()
    {
        var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var current = new Mock<ICurrentUserService>();
        var unit = new Mock<IUnitOfWork>();
        var locks = new Mock<IAccountLockService>();
        var dispatcher = new Mock<INotificationDispatcher>();
        var validator = new Mock<IValidator<EventRequestCreateRequest>>();
        var sut = new EventRequestService(db, current.Object, unit.Object, validator.Object, locks.Object,
            dispatcher.Object, Options.Create(new EventRequestOptions()), NullLogger<EventRequestService>.Instance);

        var config = await sut.GetConfigurationAsync();

        Assert.Equal(6, config.Count);
        Assert.Equal(new[] { "حفل تخرج", "زفاف", "حفل مولود", "ورشة عمل", "حدث مهم", "حفلة شباب" }, config.Select(x => x.Label));
        Assert.All(config, item =>
        {
            Assert.False(string.IsNullOrWhiteSpace(item.HallQuestion));
            Assert.Equal("هل تحتاج لمحلات تزيين وهدايا؟", item.DecorationAndGiftsQuestion);
            Assert.Equal("هل تحتاج لمصورين؟", item.PhotographersQuestion);
        });
    }

    [Theory]
    [InlineData(NotificationKind.EVENT_REQUEST_HALL, "الباحث \"سلمى\" يبحث عن صالة في تاريخ \"2026-12-01\" بمناسبة \"زفاف\". انقر هنا للتواصل معه عن قاعتك وعروضك.")]
    [InlineData(NotificationKind.EVENT_REQUEST_DECORATION_GIFTS, "الباحث \"سلمى\" يبحث عن محلات تزيين وهدايا في تاريخ \"2026-12-01\" بمناسبة \"زفاف\". انقر هنا للتواصل معه عن منتجاتك وعروضك.")]
    [InlineData(NotificationKind.EVENT_REQUEST_PHOTOGRAPHY, "الباحث \"سلمى\" يبحث عن مصورين في تاريخ \"2026-12-01\" بمناسبة \"زفاف\". انقر هنا للتواصل معه عن تصويرك وعروضك.")]
    public void Render_exact_arabic_template(NotificationKind kind, string expected)
    {
        var body = NotificationCatalog.Render(kind, Language.Arabic, new Dictionary<string, string?>
        {
            [NotificationTokens.EventSeekerName] = "سلمى", [NotificationTokens.Date] = "2026-12-01",
            [NotificationTokens.EventType] = "زفاف"
        }, Guid.NewGuid().ToString()).Body;
        Assert.Equal(expected, body);
    }

    [Theory]
    [InlineData(true, true, true, 3)]
    [InlineData(true, true, false, 2)]
    [InlineData(true, false, true, 2)]
    [InlineData(true, false, false, 1)]
    [InlineData(false, true, true, 2)]
    [InlineData(false, true, false, 1)]
    [InlineData(false, false, true, 1)]
    public async Task Fan_out_only_to_requested_service_groups(bool hall, bool decoration, bool photography, int expectedGroups)
    {
        await using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var seekerId = Guid.NewGuid().ToString();
        db.EventRequests.Add(new EventRequest { SeekerId = seekerId, SeekerFullName = "سلمى", EventDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            EventType = EventType.WEDDING, NeedsHall = hall, NeedsDecorationAndGifts = decoration, NeedsPhotographers = photography });
        AddProvider("hall", "HallOwner", AccountApprovalStatus.Pending);
        AddProvider("decor", "EventCoordinator", AccountApprovalStatus.Approved);
        AddProvider("photo", "Photographer", AccountApprovalStatus.Approved);
        await db.SaveChangesAsync();
        var current = new Mock<ICurrentUserService>();
        var unit = new Mock<IUnitOfWork>();
        var locks = new Mock<IAccountLockService>();
        locks.Setup(x => x.GetLockedUserIdsAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new HashSet<string>());
        var dispatcher = new Mock<INotificationDispatcher>();
        var validator = new Mock<IValidator<EventRequestCreateRequest>>();
        var sut = new EventRequestService(db, current.Object, unit.Object, validator.Object, locks.Object,
            dispatcher.Object, Options.Create(new EventRequestOptions { FanoutBatchSize = 10 }), NullLogger<EventRequestService>.Instance);

        await sut.ProcessPendingAsync();

        var sent = await db.EventRequestNotificationTargets.AsNoTracking().ToListAsync();
        Assert.Equal(expectedGroups, sent.Count);
        Assert.Equal(hall, sent.Any(x => x.ServiceType == ServiceType.HALL));
        Assert.Equal(decoration, sent.Any(x => x.ServiceType == ServiceType.DECORATION_GIFTS));
        Assert.Equal(photography, sent.Any(x => x.ServiceType == ServiceType.PHOTOGRAPHY));

        void AddProvider(string id, string roleName, AccountApprovalStatus approval)
        {
            var userId = Guid.NewGuid().ToString();
            var roleId = Guid.NewGuid().ToString();
            db.Users.Add(new ApplicationUser { Id = userId, UserName = id, ApprovalStatus = approval });
            db.Roles.Add(new ApplicationRole { Id = roleId, Name = roleName, NormalizedName = roleName.ToUpperInvariant() });
            db.UserRoles.Add(new IdentityUserRole<string> { UserId = userId, RoleId = roleId });
        }
    }

    [Fact]
    public async Task Only_approved_setup_complete_providers_receive_exactly_one_notification()
    {
        await using var db = NewDb();
        var request = NewRequest();
        request.NeedsHall = false;
        request.NeedsDecorationAndGifts = true;
        request.NeedsPhotographers = true;
        db.EventRequests.Add(request);
        var decor = SeedRole(db, ApplicationRoles.EventCoordinator);
        var photo = SeedRole(db, ApplicationRoles.Photographer);
        SeedProvider(db, "decor-approved", decor, AccountApprovalStatus.Approved);
        SeedProvider(db, "photo-approved", photo, AccountApprovalStatus.Approved);
        SeedProvider(db, "decor-pending", decor, AccountApprovalStatus.Pending);
        SeedProvider(db, "decor-rejected", decor, AccountApprovalStatus.Rejected);
        SeedProvider(db, "photo-needs-changes", photo, AccountApprovalStatus.NeedsChanges);
        SeedProvider(db, "photo-incomplete", photo, AccountApprovalStatus.Approved, setupComplete: false);
        await db.SaveChangesAsync();
        var dispatcher = CompletedDispatcher();

        await CreateService(db, dispatcher).ProcessPendingAsync();

        var targets = await db.EventRequestNotificationTargets.AsNoTracking().ToListAsync();
        Assert.Equal(
            new[] { "decor-approved", "photo-approved" },
            targets.Select(x => x.ProviderId).OrderBy(x => x, StringComparer.Ordinal).ToArray());
        Assert.All(targets, target => Assert.Equal(request.Id, target.EventRequestId));
        Assert.Equal(2, await db.UserNotifications.CountAsync());
        Assert.Equal(2, dispatcher.Invocations.Count(x => x.Method.Name == nameof(INotificationDispatcher.DispatchAsync)));
    }

    [Fact]
    public async Task Fan_out_is_idempotent_on_retry_and_stores_the_client_payload()
    {
        await using var db = NewDb();
        var request = NewRequest();
        request.NeedsHall = false;
        request.NeedsDecorationAndGifts = true;
        request.NeedsPhotographers = false;
        db.EventRequests.Add(request);
        var decor = SeedRole(db, ApplicationRoles.EventCoordinator);
        SeedProvider(db, "decor", decor, AccountApprovalStatus.Approved);
        await db.SaveChangesAsync();
        var dispatcher = CompletedDispatcher();
        var sut = CreateService(db, dispatcher);

        await sut.ProcessPendingAsync();

        // Simulate the background job retrying a request it had already fanned out.
        var stored = await db.EventRequests.SingleAsync();
        stored.FanoutCompleted = false;
        await db.SaveChangesAsync();
        await sut.ProcessPendingAsync();

        Assert.Single(await db.EventRequestNotificationTargets.ToListAsync());
        Assert.Single(await db.UserNotifications.ToListAsync());
        Assert.Single(await db.Conversations.ToListAsync());
        Assert.Equal(1, dispatcher.Invocations.Count(x => x.Method.Name == nameof(INotificationDispatcher.DispatchAsync)));

        var notification = await db.UserNotifications.AsNoTracking().SingleAsync();
        using var payload = JsonDocument.Parse(notification.PayloadJson!);
        Assert.Equal(request.Id, payload.RootElement.GetProperty("eventRequestId").GetGuid());
        Assert.Equal("seeker", payload.RootElement.GetProperty("seekerId").GetString());
        Assert.Equal("سلمى", payload.RootElement.GetProperty("fullName").GetString());
        Assert.Equal(request.EventDate.ToString("yyyy-MM-dd"), payload.RootElement.GetProperty("eventDate").GetString());
        Assert.Equal("WEDDING", payload.RootElement.GetProperty("eventType").GetString());
        Assert.Equal("DECORATION_GIFTS", payload.RootElement.GetProperty("serviceType").GetString());
    }

    [Fact]
    public async Task Multi_role_provider_gets_one_notification_per_matching_service_on_one_thread()
    {
        await using var db = NewDb();
        var request = NewRequest();
        request.NeedsHall = false;
        request.NeedsDecorationAndGifts = true;
        request.NeedsPhotographers = true;
        db.EventRequests.Add(request);
        var decor = SeedRole(db, ApplicationRoles.EventCoordinator);
        var photo = SeedRole(db, ApplicationRoles.Photographer);
        db.Users.Add(new ApplicationUser
        {
            Id = "multi",
            UserName = "multi",
            ApprovalStatus = AccountApprovalStatus.Approved,
            IsSetupComplete = true
        });
        db.UserRoles.Add(new IdentityUserRole<string> { UserId = "multi", RoleId = decor });
        db.UserRoles.Add(new IdentityUserRole<string> { UserId = "multi", RoleId = photo });
        await db.SaveChangesAsync();

        await CreateService(db, CompletedDispatcher()).ProcessPendingAsync();

        var targets = await db.EventRequestNotificationTargets.AsNoTracking().ToListAsync();
        Assert.Equal(2, targets.Count);
        Assert.All(targets, target => Assert.Equal("multi", target.ProviderId));
        Assert.Equal(
            new[] { ServiceType.DECORATION_GIFTS, ServiceType.PHOTOGRAPHY },
            targets.Select(x => x.ServiceType).OrderBy(x => x).ToArray());
        Assert.Single(await db.Conversations.ToListAsync());
        Assert.Equal(2, await db.UserNotifications.CountAsync());
    }

    [Fact]
    public async Task Sanitizes_the_typed_full_name_before_storing_and_notifying()
    {
        await using var db = NewDb();
        var sut = CreateSubmissionService(db, RegisteredUser("seeker"));

        var response = await sut.CreateAsync(new EventRequestCreateRequest(
            "  <b>سلمى</b>\u0007 ", DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)),
            EventType.WEDDING, true, false, false));

        var saved = await db.EventRequests.AsNoTracking().SingleAsync();
        Assert.Equal("سلمى", saved.SeekerFullName);
        Assert.DoesNotContain("<", saved.SeekerFullName);
        Assert.DoesNotContain(saved.SeekerFullName, char.IsControl);
        Assert.Equal(EventTypeLabels.Get(EventType.WEDDING), response.EventTypeLabel);

        await Assert.ThrowsAsync<Wesal.Domain.Exceptions.ValidationException>(() => sut.CreateAsync(
            new EventRequestCreateRequest(" <b> </b> ", DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)),
                EventType.WEDDING, true, false, false)));
    }

    [Fact]
    public async Task Reject_duplicate_and_rate_limited_submissions()
    {
        await using var db = NewDb();
        var sut = CreateSubmissionService(db, RegisteredUser("seeker"),
            new EventRequestOptions { MaxPerHour = 2, DuplicateWindowMinutes = 15 });
        var date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5));

        await sut.CreateAsync(new EventRequestCreateRequest("سلمى", date, EventType.WEDDING, true, false, false));
        await Assert.ThrowsAsync<ConflictException>(() => sut.CreateAsync(
            new EventRequestCreateRequest("سلمى", date, EventType.WEDDING, true, false, false)));
        await sut.CreateAsync(new EventRequestCreateRequest("سلمى", date.AddDays(1), EventType.WEDDING, true, false, false));
        await Assert.ThrowsAsync<TooManyRequestsException>(() => sut.CreateAsync(
            new EventRequestCreateRequest("سلمى", date.AddDays(2), EventType.WEDDING, true, false, false)));

        Assert.Equal(2, await db.EventRequests.CountAsync());
    }

    [Fact]
    public async Task Every_event_type_renders_its_arabic_label_in_the_notification()
    {
        foreach (var eventType in Enum.GetValues<EventType>())
        {
            await using var db = NewDb();
            var request = NewRequest();
            request.NeedsHall = false;
            request.NeedsDecorationAndGifts = false;
            request.NeedsPhotographers = true;
            request.EventType = eventType;
            db.EventRequests.Add(request);
            var photo = SeedRole(db, ApplicationRoles.Photographer);
            SeedProvider(db, "photo", photo, AccountApprovalStatus.Approved);
            await db.SaveChangesAsync();

            await CreateService(db, CompletedDispatcher()).ProcessPendingAsync();

            var body = await db.UserNotifications.Select(x => x.Body).SingleAsync();
            Assert.Contains(EventTypeLabels.Get(eventType), body, StringComparison.Ordinal);
            Assert.DoesNotContain("{", body, StringComparison.Ordinal);
        }
    }

    [Fact]
    public async Task Fan_out_pages_through_a_large_provider_population()
    {
        await using var db = NewDb();
        var request = NewRequest();
        request.NeedsHall = false;
        request.NeedsDecorationAndGifts = false;
        request.NeedsPhotographers = true;
        db.EventRequests.Add(request);
        var photo = SeedRole(db, ApplicationRoles.Photographer);
        for (var index = 0; index < 200; index++)
            SeedProvider(db, $"photo-{index:D3}", photo, AccountApprovalStatus.Approved);
        await db.SaveChangesAsync();

        await CreateService(db, CompletedDispatcher(), options: new EventRequestOptions { FanoutBatchSize = 10 })
            .ProcessPendingAsync();

        Assert.Equal(200, await db.EventRequestNotificationTargets.CountAsync());
        Assert.Equal(200, await db.UserNotifications.CountAsync());
        Assert.Equal(200, await db.Conversations.CountAsync());
        Assert.True((await db.EventRequests.SingleAsync()).FanoutCompleted);
    }

    private static ApplicationDbContext NewDb()
        => new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static EventRequest NewRequest()
        => new()
        {
            SeekerId = "seeker",
            SeekerFullName = "سلمى",
            EventDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            EventType = EventType.WEDDING,
            NeedsHall = true
        };

    private static string SeedRole(ApplicationDbContext db, string roleName)
    {
        var roleId = Guid.NewGuid().ToString();
        db.Roles.Add(new ApplicationRole { Id = roleId, Name = roleName, NormalizedName = roleName.ToUpperInvariant() });
        return roleId;
    }

    private static void SeedProvider(ApplicationDbContext db, string userId, string roleId,
        AccountApprovalStatus approval, bool setupComplete = true)
    {
        db.Users.Add(new ApplicationUser
        {
            Id = userId,
            UserName = userId,
            ApprovalStatus = approval,
            IsSetupComplete = setupComplete
        });
        db.UserRoles.Add(new IdentityUserRole<string> { UserId = userId, RoleId = roleId });
    }

    private static ICurrentUserService RegisteredUser(string userId)
    {
        var current = new Mock<ICurrentUserService>();
        current.SetupGet(x => x.IsAuthenticated).Returns(true);
        current.SetupGet(x => x.UserId).Returns(userId);
        current.SetupGet(x => x.Roles).Returns(new[] { ApplicationRoles.RegisteredUser });
        return current.Object;
    }

    private static Mock<INotificationDispatcher> CompletedDispatcher()
    {
        var dispatcher = new Mock<INotificationDispatcher>();
        dispatcher.Setup(x => x.DispatchAsync(It.IsAny<NotificationKind>(), It.IsAny<string>(),
                It.IsAny<IReadOnlyDictionary<string, string?>>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        return dispatcher;
    }

    private static EventRequestService CreateService(ApplicationDbContext db,
        Mock<INotificationDispatcher>? dispatcher = null, ICurrentUserService? current = null,
        EventRequestOptions? options = null)
    {
        var locks = new Mock<IAccountLockService>();
        locks.Setup(x => x.GetLockedUserIdsAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new HashSet<string>());
        return new EventRequestService(db, current ?? Mock.Of<ICurrentUserService>(), Mock.Of<IUnitOfWork>(),
            new EventRequestCreateRequestValidator(), locks.Object, (dispatcher ?? new Mock<INotificationDispatcher>()).Object,
            Options.Create(options ?? new EventRequestOptions()), NullLogger<EventRequestService>.Instance);
    }

    private static EventRequestService CreateSubmissionService(ApplicationDbContext db,
        ICurrentUserService current, EventRequestOptions? options = null)
    {
        var unit = new Mock<IUnitOfWork>();
        unit.Setup(x => x.ExecuteInTransactionAsync(It.IsAny<Func<Task>>(), It.IsAny<CancellationToken>()))
            .Returns((Func<Task> operation, CancellationToken _) => operation());
        unit.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .Returns(() => db.SaveChangesAsync());
        var locks = new Mock<IAccountLockService>();
        locks.Setup(x => x.GetLockedUserIdsAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new HashSet<string>());
        return new EventRequestService(db, current, unit.Object, new EventRequestCreateRequestValidator(),
            locks.Object, new Mock<INotificationDispatcher>().Object,
            Options.Create(options ?? new EventRequestOptions()), NullLogger<EventRequestService>.Instance);
    }
}
