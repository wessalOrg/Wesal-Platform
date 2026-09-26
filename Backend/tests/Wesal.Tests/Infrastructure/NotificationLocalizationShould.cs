using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Enums;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Notifications;
using Wesal.Persistence.Data;
using Xunit;
using Xunit.Abstractions;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// WESAL-TASK-13 / Edit 13: the localized notification layer.
/// </summary>
/// <remarks>
/// <para>
/// These tests exist to pin three things that a user would notice immediately if they
/// regressed, and that no amount of code review would catch reliably:
/// </para>
/// <list type="number">
/// <item>The exact Arabic and English wording of every notification, including the four
/// titles the product specified verbatim.</item>
/// <item>That the language is the RECIPIENT's stored preference, never the sender's or the
/// acting Admin's. This is the whole point of the feature.</item>
/// <item>That a realtime delivery failure can never roll back the business action that
/// triggered the notification.</item>
/// </list>
/// </remarks>
public sealed class NotificationLocalizationShould : IDisposable
{
    private const string ArabicUserId = "user-arabic";
    private const string EnglishUserId = "user-english";
    private const string UnknownUserId = "user-does-not-exist";

    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly ITestOutputHelper _output;

    public NotificationLocalizationShould(ITestOutputHelper output)
    {
        _output = output;

        var services = new ServiceCollection();

        services.AddLogging();
        services
            .AddDbContext<ApplicationDbContext>(options => options.UseInMemoryDatabase(
                $"notifications-{Guid.NewGuid()}"))
            .AddIdentity<ApplicationUser, ApplicationRole>(options =>
            {
                options.Password.RequireNonAlphanumeric = true;
                options.Password.RequiredLength = 8;
                options.User.RequireUniqueEmail = true;
            })
            .AddRoles<ApplicationRole>()
            .AddEntityFrameworkStores<ApplicationDbContext>();

        _provider = services.BuildServiceProvider();
        _context = _provider.GetRequiredService<ApplicationDbContext>();
        _context.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _context.Dispose();
        _provider.Dispose();
        GC.SuppressFinalize(this);
    }

    private UserManager<ApplicationUser> UserManager => _provider.GetRequiredService<UserManager<ApplicationUser>>();

    private INotificationService Service => new NotificationService(UserManager);

    // ---------------------------------------------------------------------
    // 1. The four titles the product specified verbatim.
    // ---------------------------------------------------------------------

    [Theory]
    // Login: "مرحبًا بك" / "Welcome", informational only, no action.
    [InlineData(NotificationKind.WelcomeLogin, "مرحبًا بك", "Welcome", null)]
    // Request sent: "تم إرسال الطلب" / "Request Sent".
    [InlineData(NotificationKind.BookingRequestSentToRequester, "تم إرسال الطلب", "Request Sent", "طلباتي")]
    // Hall created: "تم إنشاء الصالة" / "Hall Created".
    [InlineData(NotificationKind.HallCreatedForOwner, "تم إنشاء الصالة", "Hall Created", "قاعاتي")]
    // Booking cancelled: "تم إلغاء الحجز" / "Booking Cancelled".
    [InlineData(NotificationKind.BookingCancelledForOwner, "تم إلغاء الحجز", "Booking Cancelled", "عرض الطلبات")]
    public void SpecifiedTitle_IsExactInBothLanguages(
        NotificationKind kind,
        string arabicTitle,
        string englishTitle,
        string? arabicActionLabel)
    {
        var template = NotificationCatalog.Get(kind);

        Assert.Equal(arabicTitle, template.ArabicTitle);
        Assert.Equal(englishTitle, template.EnglishTitle);
        Assert.Equal(arabicActionLabel, template.ArabicActionLabel);
    }

    [Fact]
    public void Welcome_HasNoActionBecauseItIsInformationalOnly()
    {
        var template = NotificationCatalog.Get(NotificationKind.WelcomeLogin);

        Assert.Equal(NotificationActionTarget.None, template.ActionTarget);
        Assert.Null(template.ArabicActionLabel);
        Assert.Null(template.EnglishActionLabel);
    }

    // ---------------------------------------------------------------------
    // 2. Click-through targets, as the product specified.
    // ---------------------------------------------------------------------

    [Theory]
    [InlineData(NotificationKind.BookingRequestSentToRequester, NotificationActionTarget.MyBookings)]
    [InlineData(NotificationKind.HallCreatedForOwner, NotificationActionTarget.MyHalls)]
    [InlineData(NotificationKind.BookingCancelledForOwner, NotificationActionTarget.OwnerBookingRequests)]
    [InlineData(NotificationKind.BookingRequestCreatedForOwner, NotificationActionTarget.BookingRequestDetails)]
    [InlineData(NotificationKind.BookingAcceptedForRequester, NotificationActionTarget.Conversation)]
    [InlineData(NotificationKind.BookingRejectedForRequester, NotificationActionTarget.Conversation)]
    [InlineData(NotificationKind.HallApprovedForOwner, NotificationActionTarget.MyHalls)]
    [InlineData(NotificationKind.HallSubmittedForAdmin, NotificationActionTarget.AdminHallRequests)]
    [InlineData(NotificationKind.HallRejectedForOwner, NotificationActionTarget.Conversation)]
    public void ActionTarget_MatchesTheProductSpecification(
        NotificationKind kind,
        NotificationActionTarget expected)
    {
        Assert.Equal(expected, NotificationCatalog.Get(kind).ActionTarget);
    }

    // ---------------------------------------------------------------------
    // 3. The language is the RECIPIENT's, not the sender's. This is the core
    //    requirement of Edit 13 and the easiest thing to get wrong.
    // ---------------------------------------------------------------------

    [Fact]
    public async Task RendersInTheRecipientsStoredLanguage_NotTheSenders()
    {
        await GivenUserAsync(ArabicUserId, "arabic@example.com", Language.Arabic);
        await GivenUserAsync(EnglishUserId, "english@example.com", Language.English);

        var service = Service;

        var arabic = await service.BuildAsync(
            NotificationKind.BookingRejectedForRequester,
            ArabicUserId,
            new Dictionary<string, string?>
            {
                [NotificationTokens.HallName] = "Grand Hall",
                [NotificationTokens.Reason] = "Busy"
            });

        var toEnglish = await service.BuildAsync(
            NotificationKind.BookingRejectedForRequester,
            EnglishUserId,
            new Dictionary<string, string?>
            {
                [NotificationTokens.HallName] = "Grand Hall",
                [NotificationTokens.Reason] = "Busy"
            });

        Assert.Equal(Language.Arabic, arabic.Language);
        Assert.Equal("ar", SupportedLanguages.ToCode(arabic.Language));
        Assert.Equal(Language.English, toEnglish.Language);
        Assert.Equal("en", SupportedLanguages.ToCode(toEnglish.Language));

        // The two recipients see genuinely different notifications for the same event.
        Assert.NotEqual(arabic.Title, toEnglish.Title);
        Assert.NotEqual(arabic.Body, toEnglish.Body);

        _output.WriteLine($"AR title: {arabic.Title}");
        _output.WriteLine($"EN title: {toEnglish.Title}");
        _output.WriteLine($"AR body : {arabic.Body}");
        _output.WriteLine($"EN body : {toEnglish.Body}");
    }

    [Fact]
    public async Task EveryKind_RendersInBothLanguagesWithoutLeakedPlaceholders()
    {
        await GivenUserAsync(EnglishUserId, "english@example.com", Language.English);

        var tokens = new Dictionary<string, string?>
        {
            [NotificationTokens.RequesterName] = "Sara",
            [NotificationTokens.CancellerName] = "Sara",
            [NotificationTokens.HallName] = "Grand Hall",
            [NotificationTokens.Date] = "2026-09-27",
            [NotificationTokens.StartTime] = "18:00",
            [NotificationTokens.EndTime] = "22:00",
            [NotificationTokens.Amount] = "500",
            [NotificationTokens.Reason] = "Fully booked"
        };

        foreach (var kind in Enum.GetValues<NotificationKind>())
        {
            var arabic = NotificationCatalog.Render(kind, Language.Arabic, tokens);
            var english = NotificationCatalog.Render(kind, Language.English, tokens);

            AssertNoUnsubstitutedTokens(kind, Language.Arabic, arabic.Title, arabic.Body);
            AssertNoUnsubstitutedTokens(kind, Language.English, english.Title, english.Body);

            Assert.False(string.IsNullOrWhiteSpace(arabic.Title), $"{kind} has an empty Arabic title.");
            Assert.False(string.IsNullOrWhiteSpace(english.Title), $"{kind} has an empty English title.");
            Assert.False(string.IsNullOrWhiteSpace(arabic.Body), $"{kind} has an empty Arabic body.");
            Assert.False(string.IsNullOrWhiteSpace(english.Body), $"{kind} has an empty English body.");

            _output.WriteLine($"[{kind}] AR: {arabic.Title} | {arabic.Body}");
            _output.WriteLine($"[{kind}] EN: {english.Title} | {english.Body}");
        }

        await Task.CompletedTask;
    }

    [Fact]
    public void DepositAmount_IsABareNumber_SoTheTemplateCarriesTheCurrencyExactlyOnce()
    {
        // BookingNotificationValues formats the deposit culture-invariantly as a bare
        // number and the template supplies the currency word. If the value ever started
        // carrying "ILS" itself, every acceptance notice would read "500 ILS ILS".
        var arabic = NotificationCatalog.Render(
            NotificationKind.BookingAcceptedForRequester,
            Language.Arabic,
            new Dictionary<string, string?> { [NotificationTokens.Amount] = "500" });

        var english = NotificationCatalog.Render(
            NotificationKind.BookingAcceptedForRequester,
            Language.English,
            new Dictionary<string, string?> { [NotificationTokens.Amount] = "500" });

        Assert.Contains("\"500\" شيكل", arabic.Body);
        Assert.Contains("\"500\" ILS", english.Body);
        Assert.DoesNotContain("ILS ILS", english.Body);
    }

    // ---------------------------------------------------------------------
    // 4. Degradation: an unreadable preference must never block a real action.
    // ---------------------------------------------------------------------
    [Fact]
    public async Task UnknownRecipient_FallsBackToThePlatformDefaultRatherThanThrowing()
    {
        var content = await Service.BuildAsync(NotificationKind.WelcomeLogin, UnknownUserId);

        Assert.Equal(Language.Arabic, content.Language);
    }

    [Fact]
    public async Task BlankRecipient_FallsBackToThePlatformDefaultRatherThanThrowing()
    {
        var content = await Service.BuildAsync(NotificationKind.WelcomeLogin, "   ");

        Assert.Equal(Language.Arabic, content.Language);
    }

    // ---------------------------------------------------------------------
    // 5. Best-effort delivery: a broken realtime pipe must not fail the action.
    // ---------------------------------------------------------------------

    [Fact]
    public async Task Dispatcher_SwallowsRealtimeFailuresSoTheBusinessActionStillSucceeds()
    {
        var service = new NotificationDispatcher(
            Service,
            new ThrowingNotifier(),
            new FakeDateTime(),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<NotificationDispatcher>.Instance);

        // No exception escapes: a booking approval or an admin action must not fail
        // because a browser was offline.
        await service.DispatchAsync(NotificationKind.HallApprovedForOwner, ArabicUserId);

        // And a real cancellation is still signalled, never swallowed as a cancellation.
        var cancelling = new NotificationDispatcher(
            Service,
            new ThrowingNotifier(new OperationCanceledException()),
            new FakeDateTime(),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<NotificationDispatcher>.Instance);

        await Assert.ThrowsAsync<OperationCanceledException>(() =>
            cancelling.DispatchAsync(NotificationKind.HallApprovedForOwner, ArabicUserId));
    }

    [Fact]
    public async Task Dispatcher_SkipsSilentlyWhenNoRecipientCouldBeResolved()
    {
        var notifier = new RecordingNotifier();

        var dispatcher = new NotificationDispatcher(
            Service,
            notifier,
            new FakeDateTime(),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<NotificationDispatcher>.Instance);

        await dispatcher.DispatchAsync(NotificationKind.HallApprovedForOwner, string.Empty);

        Assert.Empty(notifier.Notifications);
    }

    [Fact]
    public async Task Dispatcher_PushesTheLocalizedEventToThatRecipientOnly()
    {
        await GivenUserAsync(EnglishUserId, "english@example.com", Language.English);

        var notifier = new RecordingNotifier();

        var dispatcher = new NotificationDispatcher(
            Service,
            notifier,
            new FakeDateTime(new DateTimeOffset(2026, 9, 26, 12, 0, 0, TimeSpan.Zero)),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<NotificationDispatcher>.Instance);

        await dispatcher.DispatchAsync(
            NotificationKind.BookingRequestSentToRequester,
            EnglishUserId,
            targetId: "booking-42");

        var pushed = Assert.Single(notifier.Notifications);
        Assert.Equal(EnglishUserId, pushed.RecipientUserId);
        Assert.Equal("Request Sent", pushed.Notification.Title);
        Assert.Equal("en", pushed.Notification.Language);
        Assert.Equal("booking-42", pushed.Notification.TargetId);
        Assert.Equal(nameof(NotificationActionTarget.MyBookings), pushed.Notification.ActionTarget);
        Assert.Equal(new DateTimeOffset(2026, 9, 26, 12, 0, 0, TimeSpan.Zero), pushed.Notification.OccurredAt);
    }

    [Fact]
    public async Task Dispatcher_OmitsTheActionTargetEntirelyForAnActionlessNotification()
    {
        await GivenUserAsync(EnglishUserId, "english@example.com", Language.English);

        var notifier = new RecordingNotifier();

        var dispatcher = new NotificationDispatcher(
            Service,
            notifier,
            new FakeDateTime(),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<NotificationDispatcher>.Instance);

        await dispatcher.DispatchAsync(NotificationKind.WelcomeLogin, EnglishUserId);

        var pushed = Assert.Single(notifier.Notifications);
        Assert.Equal("Welcome", pushed.Notification.Title);
        Assert.Null(pushed.Notification.ActionLabel);
        Assert.Null(pushed.Notification.ActionTarget);
    }

    // ---------------------------------------------------------------------
    // Helpers.
    // ---------------------------------------------------------------------

    private async Task GivenUserAsync(string id, string email, Language language)
    {
        var user = new ApplicationUser
        {
            Id = id,
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            PreferredLanguage = language
        };

        var result = await UserManager.CreateAsync(user, "Password123!");

        Assert.True(result.Succeeded, string.Join("; ", result.Errors.Select(e => e.Description)));
    }

    private static void AssertNoUnsubstitutedTokens(
        NotificationKind kind,
        Language language,
        string title,
        string body)
    {
        var known = new[]
        {
            NotificationTokens.RequesterName,
            NotificationTokens.CancellerName,
            NotificationTokens.HallName,
            NotificationTokens.Date,
            NotificationTokens.StartTime,
            NotificationTokens.EndTime,
            NotificationTokens.Amount,
            NotificationTokens.Reason
        };

        foreach (var token in known)
        {
            Assert.DoesNotContain(token, title);
            Assert.DoesNotContain(token, body);
        }

        // Any leftover brace pattern at all means a template and its call site disagree.
        Assert.False(
            title.Contains('{') || body.Contains('{'),
            $"{kind} ({language}) leaked an unresolved placeholder: '{title}' / '{body}'");
    }

    private sealed class RecordingNotifier : INotificationNotifier
    {
        public List<(string RecipientUserId, NotificationEvent Notification)> Notifications { get; } = new();

        public Task NotifyAsync(
            string recipientUserId,
            NotificationEvent notification,
            CancellationToken cancellationToken = default)
        {
            Notifications.Add((recipientUserId, notification));
            return Task.CompletedTask;
        }
    }

    private sealed class ThrowingNotifier : INotificationNotifier
    {
        private readonly Exception _exception;

        public ThrowingNotifier(Exception? exception = null)
            => _exception = exception ?? new InvalidOperationException("realtime pipe is down");

        public Task NotifyAsync(
            string recipientUserId,
            NotificationEvent notification,
            CancellationToken cancellationToken = default)
            => throw _exception;
    }

    private sealed class FakeDateTime : IDateTime
    {
        private readonly DateTimeOffset _now;

        public FakeDateTime(DateTimeOffset? now = null)
            => _now = now ?? new DateTimeOffset(2026, 9, 26, 12, 0, 0, TimeSpan.Zero);

        public DateTimeOffset Now => _now;

        public DateTime UtcNow => _now.UtcDateTime;
    }
}
