using System.Text.Json.Nodes;
using Wesal.Application.Ai;
using Wesal.Application.Ai.Navigation;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Ai;

/// <summary>
/// Scenario tests for the application-aware assistant. Unless a test says otherwise the
/// harness runs with Gemini OFF, proving the deterministic path is correct on its own.
/// </summary>
public class MabroukContextualAssistantShould
{
    private static readonly string[] AllowedHrefs =
        WesalNavigationRegistry.NavigablePages.Where(p => !p.IsDynamic).Select(p => p.Path).ToArray();

    private static void AssertActionsAreTrusted(AiAssistantResponse response)
    {
        foreach (var action in response.Actions ?? [])
        {
            Assert.Equal(AiAssistantActionTypes.Navigate, action.Type);
            var page = WesalNavigationRegistry.Find(action.PageKey);
            Assert.NotNull(page);
            Assert.True(
                AllowedHrefs.Contains(action.Href) || (page!.IsDynamic && action.Href.StartsWith("/halls/", StringComparison.Ordinal)),
                $"Untrusted href '{action.Href}'");
            Assert.StartsWith("/", action.Href);
            Assert.DoesNotContain("//", action.Href);
            Assert.DoesNotContain(":", action.Href);
        }
    }

    // ───────────────────────── hall context ─────────────────────────

    [Fact]
    public async Task PinnedHall_PriceQuestion_ReturnsThatHallsLivePrice_WithoutSearching()
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync("كم سعرها؟", pinnedHall: h.NakheelId);

        Assert.Equal(AiAssistantResponseKind.HallDetails, response.Kind);
        Assert.Equal(h.NakheelId, response.HallDetails!.HallId);
        Assert.Contains("7000", response.Message);
        Assert.Contains("قاعة النخيل", response.Message);
        Assert.Empty(h.Search.Requests);
        Assert.Contains(h.NakheelId, h.Details.Requested);
    }

    [Fact]
    public async Task PinnedHall_CapacityLocationServicesPhotos_UseLiveHallData()
    {
        var h = new MabroukHarness();

        var capacity = await h.AskAsync("كم بتسع؟", pinnedHall: h.NakheelId);
        var location = await h.AskAsync("وين مكانها؟", pinnedHall: h.NakheelId);
        var services = await h.AskAsync("شو الخدمات الموجودة؟", pinnedHall: h.NakheelId);
        var photos = await h.AskAsync("في صور؟", pinnedHall: h.NakheelId);

        Assert.Contains("400", capacity.Message);
        Assert.Contains("حي الرمال", location.Message);
        Assert.Contains("تكييف", services.Message);
        Assert.Contains("موقف سيارات", services.Message);
        Assert.Contains("1", photos.Message);
        Assert.Contains(photos.Actions!, a => a.PageKey == "hall_details" && a.Href == $"/halls/{h.NakheelId:D}");
        Assert.Empty(h.Search.Requests);
    }

    [Fact]
    public async Task PinnedHall_PriceHiddenByOwner_IsReportedTruthfully()
    {
        var h = new MabroukHarness();
        h.Details.Add(MabroukHarness.Hall(h.OrchidId, "قاعة الأوركيد", "غزة", "النصر", 250, null, []));

        var response = await h.AskAsync("كم سعرها؟", pinnedHall: h.OrchidId);

        Assert.DoesNotContain("5000", response.Message);
        Assert.Contains("لم يعرض سعراً", response.Message);
    }

    [Fact]
    public async Task PinnedHall_AvailabilityTomorrow_ChecksTheSameHall_OnTheResolvedDate()
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync("متاحة بكرة؟", pinnedHall: h.NakheelId);

        Assert.Equal(AiAssistantResponseKind.Availability, response.Kind);
        Assert.Equal(h.NakheelId, h.Slots.LastHallId);
        Assert.Equal(new DateOnly(2026, 10, 2), h.Slots.LastDate);
        Assert.Equal(h.NakheelId, response.Availability!.HallId);
        Assert.Equal("قاعة النخيل", response.Availability.HallName);
        Assert.Empty(h.Search.Requests);
    }

    [Fact]
    public async Task PinnedHall_AvailabilityFriday_UsesTheNextFriday()
    {
        var h = new MabroukHarness();

        await h.AskAsync("متاحة الجمعة؟", pinnedHall: h.NakheelId);

        Assert.Equal(new DateOnly(2026, 10, 2), h.Slots.LastDate); // 2026-10-01 is a Thursday
    }

    [Fact]
    public async Task PinnedHall_AvailabilityWithoutADate_AsksForOne()
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync("متاحة؟", pinnedHall: h.NakheelId);

        Assert.Equal(AiAssistantResponseKind.Clarification, response.Kind);
        Assert.Empty(h.Slots.Calls);
    }

    [Fact]
    public async Task PinnedHall_PastDate_IsRefused()
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync("متاحة 2026-09-01؟", pinnedHall: h.NakheelId);

        Assert.Equal(AiAssistantResponseKind.Clarification, response.Kind);
        Assert.Empty(h.Slots.Calls);
    }

    [Fact]
    public async Task PinnedHall_EnglishQuestions_Work()
    {
        var h = new MabroukHarness();

        var price = await h.AskAsync("how much is it?", "en", pinnedHall: h.NakheelId);
        var capacity = await h.AskAsync("what is the capacity?", "en", pinnedHall: h.NakheelId);

        Assert.Contains("7000", price.Message);
        Assert.Equal("en", price.ResponseLanguage);
        Assert.Contains("400", capacity.Message);
    }

    [Fact]
    public async Task PinnedHall_BookingHowTo_KeepsContext_AndSuggestsTheHallPage()
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync("كيف أحجزها؟", pinnedHall: h.NakheelId);

        Assert.Equal(AiAssistantResponseKind.Answer, response.Kind);
        Assert.Contains("حجز", response.Message);
        var action = Assert.Single(response.Actions!);
        Assert.Equal("hall_details", action.PageKey);
        Assert.Equal($"/halls/{h.NakheelId:D}", action.Href);
        Assert.Equal("suggest", action.Mode);
    }

    [Fact]
    public async Task HallPage_Pathname_ProvidesTheHallContext_WithoutAPin()
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync("كم بتسع؟", pathname: $"/halls/{h.NakheelId}");

        Assert.Contains("400", response.Message);
        Assert.Empty(h.Search.Requests);
    }

    [Fact]
    public async Task ExplicitHallName_BeatsThePinnedHall()
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync("كم سعر قاعة الأوركيد؟", pinnedHall: h.NakheelId);

        Assert.Equal(h.OrchidId, response.HallDetails!.HallId);
        Assert.Contains("الأوركيد", response.Message);
        Assert.DoesNotContain("7000", response.Message);
    }

    [Fact]
    public async Task OrdinalReference_ResolvesAgainstTheLastShownHalls()
    {
        var h = new MabroukHarness();
        var conversation = new AiConversationContext(
            [],
            null,
            [new AiHallRef(h.NakheelId, "قاعة النخيل"), new AiHallRef(h.OrchidId, "قاعة الأوركيد")]);

        var response = await h.AskAsync("الثانية شو سعرها؟", conversation: conversation);

        Assert.Equal(h.OrchidId, response.HallDetails!.HallId);
        Assert.Contains("5000", response.Message);
    }

    [Fact]
    public async Task ConversationFocus_AllowsAPronounFollowUp_WithoutAPin()
    {
        var h = new MabroukHarness();
        var conversation = new AiConversationContext([], null, null, new AiHallRef(h.OrchidId, "قاعة الأوركيد"));

        var response = await h.AskAsync("كم بتسع؟", conversation: conversation);

        Assert.Contains("250", response.Message);
    }

    [Fact]
    public async Task NewPinnedHall_ReplacesTheOldOne_NeverMixing()
    {
        var h = new MabroukHarness();

        var a = await h.AskAsync("كم سعرها؟", pinnedHall: h.NakheelId);
        var b = await h.AskAsync("كم سعرها؟", pinnedHall: h.OrchidId);

        Assert.Contains("7000", a.Message);
        Assert.Contains("5000", b.Message);
        Assert.DoesNotContain("7000", b.Message);
    }

    [Fact]
    public async Task InvalidPinnedHall_IsIgnored_AndNeverThrows()
    {
        var h = new MabroukHarness();

        var unknown = await h.AskAsync("كم سعرها؟", pinnedHall: Guid.NewGuid());
        var garbage = await h.AskAsync("كم سعرها؟", pinnedRaw: "not-a-guid");
        var empty = await h.AskAsync("كم سعرها؟", pinnedRaw: Guid.Empty.ToString());

        foreach (var response in new[] { unknown, garbage, empty })
        {
            Assert.Equal(AiAssistantResponseKind.Clarification, response.Kind);
            Assert.Null(response.HallDetails);
        }
    }

    [Fact]
    public async Task PinnedHallThatIsNotPublic_IsDropped()
    {
        var h = new MabroukHarness();
        var hidden = Guid.NewGuid(); // the details service answers NotFound for non-public halls

        var response = await h.AskAsync("كم سعرها؟", pinnedHall: hidden);

        Assert.Equal(AiAssistantResponseKind.Clarification, response.Kind);
    }

    [Theory]
    [InlineData("//evil.example/halls")]
    [InlineData("https://evil.example/halls")]
    [InlineData("javascript:alert(1)")]
    [InlineData("/photography")]
    [InlineData("/halls/../admin")]
    public async Task SpoofedPagePath_IsIgnored(string pathname)
    {
        var h = new MabroukHarness();

        var turn = await h.ContextResolver.ResolveAsync(
            new AiRequestContext(new AiPageContextDto(pathname, "admin"), null), null, "كم سعرها؟", CancellationToken.None);

        Assert.Null(turn.PageKey);
        Assert.Null(turn.PagePath);
        Assert.Null(turn.Hall);
    }

    [Fact]
    public async Task ClientPageKeyAndEntityName_AreNeverTrusted()
    {
        var h = new MabroukHarness();

        var turn = await h.ContextResolver.ResolveAsync(
            new AiRequestContext(new AiPageContextDto("/halls", "admin"), new AiEntityContextDto("hall", h.OrchidId.ToString(), "قاعة النخيل (7000)")),
            null,
            "كم سعرها؟",
            CancellationToken.None);

        Assert.Equal("halls", turn.PageKey);
        Assert.Equal("قاعة الأوركيد", turn.Hall!.HallName);
        Assert.Equal("pinned", turn.HallSource);
    }

    [Fact]
    public async Task JwtLikeValues_InContext_AreRejected_AndNeverReachTheTurnContext()
    {
        var h = new MabroukHarness();
        const string jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.c2lnbmF0dXJl";

        var turn = await h.ContextResolver.ResolveAsync(
            new AiRequestContext(new AiPageContextDto($"/halls?token={jwt}"), new AiEntityContextDto("hall", jwt)),
            null,
            "كم سعرها؟",
            CancellationToken.None);

        Assert.Equal("halls", turn.PageKey);   // query string is dropped, only the route is kept
        Assert.DoesNotContain(jwt, turn.PagePath ?? string.Empty);
        Assert.Null(turn.Hall);                // not a GUID -> ignored
    }

    // ───────────────────────── navigation ─────────────────────────

    [Theory]
    [InlineData("بدي صالة", "halls", "/halls", "suggest")]
    [InlineData("وديني عالصالات", "halls", "/halls", "auto")]
    [InlineData("ورجيني كل الصالات", "halls", "/halls", "auto")]
    [InlineData("وين الأسئلة الشائعة؟", "faq", "/faq", "suggest")]
    [InlineData("بدي مساعدة", "help", "/help", "suggest")]
    [InlineData("سجلني دخول", "login", "/login", "auto")]
    [InlineData("وين بلاقي الصالات؟", "halls", "/halls", "suggest")]
    public async Task Navigation_ReturnsATrustedAction(string message, string pageKey, string href, string mode)
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync(message);

        var action = Assert.Single(response.Actions!);
        Assert.Equal(pageKey, action.PageKey);
        Assert.Equal(href, action.Href);
        Assert.Equal(mode, action.Mode);
        Assert.False(string.IsNullOrWhiteSpace(action.Label));
        Assert.Empty(h.Search.Requests); // navigation never calls hall APIs
        AssertActionsAreTrusted(response);
    }

    [Fact]
    public async Task Navigation_AutoMode_SaysSomethingBeforeNavigating()
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync("وديني عالصالات");

        Assert.Contains("بفتحلك", response.Message);
    }

    [Fact]
    public async Task Support_AnswersFromTheOfficialContact_AndSuggestsHelp()
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync("بدي دعم");

        Assert.Contains("+970567581412", response.Message);
        Assert.Contains(response.Actions!, a => a.PageKey == "help" && a.Href == "/help" && a.Mode == "suggest");
        AssertActionsAreTrusted(response);
    }

    [Theory]
    [InlineData("بدي تصوير")]
    [InlineData("وديني عالتصوير")]
    [InlineData("I want a photographer")]
    public async Task ServiceWithoutAPage_NeverProducesAFakeRoute(string message)
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync(message, message.StartsWith("I", StringComparison.Ordinal) ? "en" : "ar");

        Assert.True(response.Actions is null || response.Actions.Count == 0);
        Assert.DoesNotContain("/photography", response.Message);
        Assert.Contains(response.ResponseLanguage == "en" ? "dedicated" : "ما في صفحة", response.Message);
    }

    [Fact]
    public async Task HowToSearch_GetsAHallsSuggestion_OnTopOfTheAnswer()
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync("كيف أبحث عن صالة؟");

        Assert.Contains(response.Actions ?? [], a => a.PageKey == "halls" && a.Mode == "suggest");
    }

    [Fact]
    public async Task SearchWithRealCriteria_IsASearch_NotNavigation()
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync("بدي قاعة بغزة لـ 300 شخص");

        Assert.Equal(AiAssistantResponseKind.Halls, response.Kind);
        Assert.Single(response.Halls); // only the 400-seat hall holds 300
        Assert.Equal(h.NakheelId, response.Halls[0].HallId);
        Assert.True(response.Actions is null || response.Actions.Count == 0);
    }

    // ───────────────────────── routing correctness ─────────────────────────

    [Fact]
    public async Task BookingPayment_IsNeverTheOwnerSubscription()
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync("كيف أدفع الحجز؟");

        Assert.DoesNotContain("+972597744476", response.Message);
        Assert.DoesNotContain("120", response.Message);
        Assert.Contains("عربون", response.Message);
    }

    [Fact]
    public async Task OwnerSubscription_UsesTheTrustedConfiguration()
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync("كم سعر الاشتراك لصاحب القاعة؟");

        Assert.Contains("+972597744476", response.Message);
        Assert.Contains("120", response.Message);
    }

    [Fact]
    public async Task SupportQuestion_IsNeverHallOwnerMessaging()
    {
        var h = new MabroukHarness();

        var support = await h.AskAsync("كيف أتواصل مع الدعم الفني؟");
        var owner = await h.AskAsync("كيف أحكي مع صاحب الصالة؟");

        Assert.Contains("+970567581412", support.Message);
        Assert.DoesNotContain("+970567581412", owner.Message);
        Assert.Contains("صاحب", owner.Message);
    }

    [Fact]
    public async Task HallPrice_IsNeverTheSubscriptionPrice()
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync("كم سعر قاعة النخيل؟");

        Assert.Equal(AiAssistantResponseKind.HallDetails, response.Kind);
        Assert.Contains("7000", response.Message);
        Assert.DoesNotContain("120", response.Message);
        Assert.DoesNotContain("شيكل", response.Message);
    }

    [Fact]
    public async Task AmbiguousHowDoIPay_AsksWhichPaymentAndNeverGuesses()
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync("كيف أدفع؟");

        Assert.Equal(AiAssistantResponseKind.Clarification, response.Kind);
        Assert.Contains("أي دفع", response.Message);
    }

    // ───────────────────────── knowledge ─────────────────────────

    [Theory]
    [InlineData("شو هو وصال؟", "ar", "منصة")]
    [InlineData("ما هي ساعات الدعم؟", "ar", "9:00")]
    [InlineData("كيف أتواصل مع الدعم الفني؟", "ar", "wesal.platform.gaza@gmail.com")]
    [InlineData("What is Wesal?", "en", "modern platform")]
    [InlineData("What are the support hours?", "en", "9:00")]
    public async Task KnowledgeQuestions_AreAnsweredFromTheKnowledgeBase_WithGeminiOff(string message, string language, string expected)
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync(message, language);

        Assert.Contains(expected, response.Message);
    }

    // ───────────────────────── Gemini OFF: everything still works ─────────────────────────

    [Fact]
    public async Task GeminiOff_HallDetailsByName_Works()
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync("احكيلي عن قاعة النخيل");

        Assert.Equal(AiAssistantResponseKind.HallDetails, response.Kind);
        Assert.Equal(h.NakheelId, response.HallDetails!.HallId);
    }

    [Fact]
    public async Task GeminiOff_AvailabilityByNameAndRelativeDate_Works()
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync("هل قاعة النخيل متاحة بكرة؟");

        Assert.Equal(AiAssistantResponseKind.Availability, response.Kind);
        Assert.Equal(h.NakheelId, response.Availability!.HallId);
        Assert.Equal(new DateOnly(2026, 10, 2), response.Availability.Date);
    }

    [Fact]
    public async Task GeminiOff_AvailabilityByNameAndIsoDate_Works()
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync("هل قاعة النخيل متاحة يوم 2026-10-20؟");

        Assert.Equal(AiAssistantResponseKind.Availability, response.Kind);
        Assert.Equal(new DateOnly(2026, 10, 20), h.Slots.LastDate);
    }

    [Fact]
    public async Task GeminiOff_FollowUpRefinement_CarriesTheRegionForward()
    {
        var h = new MabroukHarness();
        var conversation = new AiConversationContext(
            [],
            new AiAssistantIntentDto(AiIntentType.SearchHalls, "Gaza", null, null, null, null));

        var response = await h.AskAsync("طيب 300 شخص", conversation: conversation);

        Assert.Equal(AiAssistantResponseKind.Halls, response.Kind);
        Assert.Single(response.Halls);
        Assert.Equal(h.NakheelId, response.Halls[0].HallId);
    }

    [Fact]
    public async Task GeminiOff_NeverReturnsTheOldGenericHowToForAHallSearch()
    {
        var h = new MabroukHarness();

        var response = await h.AskAsync("هات قاعات بغزة");

        Assert.Equal(AiAssistantResponseKind.Halls, response.Kind);
        Assert.Equal(2, response.Halls.Count);
    }

    // ───────────────────────── Gemini ON: structured results and context ─────────────────────────

    private static GeminiToolTurn Call(string tool, JsonObject args)
        => new(null, new GeminiFunctionCall(tool, args));

    [Fact]
    public async Task GeminiOn_HallSearch_ReturnsStructuredHalls_NotJustText()
    {
        var h = new MabroukHarness(geminiAvailable: true);
        h.Gemini.Script.Enqueue(Call("search_halls", new JsonObject { ["region"] = "Gaza", ["minCapacity"] = 300 }));
        h.Gemini.Script.Enqueue(new GeminiToolTurn("وجدت قاعة النخيل.", null));

        var response = await h.AskAsync("هات قاعات بغزة لـ 300 شخص");

        Assert.Equal(AiAssistantResponseKind.Halls, response.Kind);
        Assert.Equal("وجدت قاعة النخيل.", response.Message);
        var hall = Assert.Single(response.Halls);
        Assert.Equal(h.NakheelId, hall.HallId);
        Assert.Equal(7000m, hall.Price);
    }

    [Fact]
    public async Task GeminiOn_PinnedHall_IsInTheSystemInstruction_WithTodaysDate_AndNoSecrets()
    {
        var h = new MabroukHarness(geminiAvailable: true);
        h.Gemini.Script.Enqueue(new GeminiToolTurn("ok", null));

        await h.AskAsync("متاحة بكرة؟ كم سعر الاشتراك", pathname: $"/halls/{h.NakheelId}", pinnedHall: h.NakheelId);
        // the payment gate answers the subscription question; use a pure hall question instead:
        h.Gemini.Calls.Clear();
        h.Gemini.Script.Enqueue(new GeminiToolTurn("ok", null));
        await h.AskAsync("شو رأيك فيها؟", pathname: $"/halls/{h.NakheelId}", pinnedHall: h.NakheelId);

        var (_, system) = Assert.Single(h.Gemini.Calls);
        Assert.Contains("Today is 2026-10-01 (Thursday)", system);
        Assert.Contains(h.NakheelId.ToString(), system);
        Assert.Contains("Hall in context", system);
        Assert.Contains("hall_details", system);
        Assert.DoesNotContain("Bearer", system, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("eyJ", system);
    }

    [Fact]
    public async Task GeminiOn_ToolHistory_IsAlwaysPaired_EvenWithLongConversations()
    {
        var h = new MabroukHarness(geminiAvailable: true);
        var turns = new List<AiConversationTurn>();
        for (var i = 1; i <= 8; i++)
        {
            turns.Add(new AiConversationTurn("user", $"question {i}"));
            turns.Add(new AiConversationTurn("assistant", $"answer {i}"));
        }

        h.Gemini.Script.Enqueue(Call("get_hall_details", new JsonObject { ["hallId"] = h.NakheelId.ToString() }));
        h.Gemini.Script.Enqueue(new GeminiToolTurn("done", null));

        var response = await h.AskAsync("شو رأيك فيها؟", conversation: new AiConversationContext(turns, null), pinnedHall: h.NakheelId);

        Assert.Equal(AiAssistantResponseKind.HallDetails, response.Kind);
        Assert.Equal(2, h.Gemini.Calls.Count);

        foreach (var (contents, _) in h.Gemini.Calls)
        {
            var sanitized = GeminiService.SanitizeToolContents(contents);
            Assert.Equal(contents.Count, sanitized.Count); // nothing was an orphan
            for (var i = 0; i < contents.Count; i++)
            {
                if (contents[i].Parts.Any(p => p.FunctionCall is not null))
                {
                    Assert.True(contents[i + 1].Parts.Any(p => p.FunctionResponse is not null));
                }
            }

            // history = 5 whole exchanges + the current message (+ the pair on the 2nd call)
            Assert.Equal(5, contents.Count(c => c.Role == "user" && c.Parts.Any(p => p.Text is not null)) - 1);
        }

        var secondCall = h.Gemini.Calls[1].Contents;
        Assert.Equal("model", secondCall[^2].Role);
        Assert.Equal("function", secondCall[^1].Role);
    }

    [Fact]
    public async Task GeminiOn_AssistantHistory_IsSentAsModelRole_NotAsUser()
    {
        var h = new MabroukHarness(geminiAvailable: true);
        h.Gemini.Script.Enqueue(new GeminiToolTurn("ok", null));
        var turns = new[]
        {
            new AiConversationTurn("user", "هات قاعات بغزة"),
            new AiConversationTurn("assistant", "وجدت قاعتين")
        };

        await h.AskAsync("شو رأيك بالأولى؟", conversation: new AiConversationContext(turns, null));

        var contents = h.Gemini.Calls[0].Contents;
        Assert.Equal("user", contents[0].Role);
        Assert.Equal("model", contents[1].Role);
        Assert.Equal("وجدت قاعتين", contents[1].Parts[0].Text);
    }

    [Fact]
    public async Task GeminiUnavailableMidTurn_FallsBackToTheDeterministicPath()
    {
        var h = new MabroukHarness(geminiAvailable: true);
        h.Gemini.Script.Enqueue(null); // Gemini failed

        var response = await h.AskAsync("هات قاعات بغزة");

        Assert.Equal(AiAssistantResponseKind.Halls, response.Kind);
        Assert.Equal(2, response.Halls.Count);
    }

    [Fact]
    public async Task GeminiOn_StillNavigatesDeterministically_WithoutCallingTheModel()
    {
        var h = new MabroukHarness(geminiAvailable: true);

        var response = await h.AskAsync("وديني عالصالات");

        Assert.Equal("/halls", Assert.Single(response.Actions!).Href);
        Assert.Empty(h.Gemini.Calls);
    }

    [Fact]
    public async Task ResponseMemory_CapturesShownHallsAndFocus()
    {
        var h = new MabroukHarness();

        var list = await h.AskAsync("هات قاعات بغزة");
        var details = await h.AskAsync("كم سعرها؟", pinnedHall: h.NakheelId);

        Assert.Equal(2, AiResponseMemory.ShownHalls(list).Count);
        Assert.Null(AiResponseMemory.FocusedHall(list));
        Assert.Equal(h.NakheelId, AiResponseMemory.FocusedHall(details)!.HallId);
    }
}
