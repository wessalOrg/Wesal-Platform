using Wesal.Application.Ai;
using Wesal.Application.Ai.Navigation;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>
/// Deterministic, model-independent handling of the questions whose answer must come
/// from one trusted source and must never depend on whether Gemini is up:
/// <list type="bullet">
/// <item>navigation requests (registry pages only; no invented routes);</item>
/// <item>services Wesal has no page for (photography, catering...) — answered
/// truthfully with NO navigation target;</item>
/// <item>Wesal technical support / official contact (Knowledge Base);</item>
/// <item>hall-owner subscription (trusted configuration, never the model);</item>
/// <item>booking payment (Knowledge Base) and ambiguous "how do I pay" (clarification).</item>
/// </list>
/// It runs before Gemini. Anything it does not recognise returns null and flows on to
/// the model (or, when the model is down, to the deterministic search/how-to path).
/// </summary>
public sealed class AiAssistantPolicyGate
{
    private static readonly NaturalLanguageCriteriaExtractor CriteriaExtractor = new();

    private readonly ISubscriptionPaymentService _subscriptionPaymentService;
    private readonly IWesalKnowledgeService _knowledgeService;

    public AiAssistantPolicyGate(
        ISubscriptionPaymentService subscriptionPaymentService,
        IWesalKnowledgeService knowledgeService)
    {
        _subscriptionPaymentService = subscriptionPaymentService;
        _knowledgeService = knowledgeService;
    }

    public async Task<AiAssistantResponse?> TryHandleAsync(
        string message,
        string language,
        CancellationToken cancellationToken)
    {
        var criteria = CriteriaExtractor.Extract(message);
        var hasSearchCriteria = !string.IsNullOrWhiteSpace(criteria.Region)
            || !string.IsNullOrWhiteSpace(criteria.Area)
            || criteria.Date.HasValue
            || criteria.Capacity.HasValue;

        // Support and payment questions are about Wesal itself, never navigation.
        var payment = AiPaymentIntentClassifier.Classify(message);
        if (payment != AiPaymentIntent.None)
        {
            return await HandlePaymentAsync(payment, language, cancellationToken);
        }

        if (AiSupportIntentDetector.IsSupport(message))
        {
            return await HandleSupportAsync(message, language, cancellationToken);
        }

        if (!hasSearchCriteria)
        {
            var unavailable = AiNavigationIntentDetector.DetectUnavailableTopic(message);
            if (unavailable is not null)
            {
                var capability = WesalCapabilityRegistry.Find(unavailable.Key);
                var comingSoon = capability?.Status == WesalCapabilityStatus.ComingSoon;
                var answer = comingSoon
                    ? language == "en"
                        ? $"{capability!.LabelEn} are coming soon on Wesal. You can't search for or book them yet."
                        : $"خدمة {capability!.LabelAr} لسه قيد التجهيز في وصال، وما بتقدر تبحث عنها أو تحجزها حالياً."
                    : language == "en"
                        ? $"Wesal doesn't currently offer {unavailable.LabelEn}. What I can help with today is finding wedding halls, checking their details and availability, and explaining how booking works."
                        : $"خدمة {unavailable.LabelAr} مش متاحة حالياً في وصال. بقدر أساعدك بالبحث عن قاعات الأفراح وتفاصيلها وتوفرها، أو أشرحلك طريقة الحجز.";

                var response = Build(
                    language,
                    AiAssistantResponseKind.Answer,
                    answer,
                    null);

                // Describing a service as Coming Soon must not route users into its
                // placeholder page. An explicit request to open that real page is
                // handled by the navigation detector below.
                return response;
            }

            var navigation = AiNavigationIntentDetector.Detect(message);
            if (navigation is not null)
            {
                return BuildNavigation(language, navigation);
            }
        }

        return null;
    }

    private async Task<AiAssistantResponse> HandlePaymentAsync(
        AiPaymentIntent payment,
        string language,
        CancellationToken cancellationToken)
    {
        switch (payment)
        {
            case AiPaymentIntent.OwnerSubscription:
            {
                var response = await _subscriptionPaymentService.GetSubscriptionPaymentResponseAsync(language, cancellationToken);
                return Build(language, AiAssistantResponseKind.Answer, response.Answer, null);
            }

            case AiPaymentIntent.BookingPayment:
            {
                var articles = await _knowledgeService.SearchAsync("booking deposit payment", language, 5, cancellationToken);
                var booking = articles.FirstOrDefault(a =>
                    string.Equals(a.Category, "user-guide", StringComparison.OrdinalIgnoreCase)
                    && a.Title.Contains("payment terms", StringComparison.OrdinalIgnoreCase));

                var text = booking is not null
                    ? Compose(booking, language)
                    : AiPaymentTexts.BookingFallback(language);

                return Build(language, AiAssistantResponseKind.Answer, text, null);
            }

            default:
                return Build(
                    language,
                    AiAssistantResponseKind.Clarification,
                    AiPaymentTexts.Ambiguous(language, _subscriptionPaymentService.GetPaymentDetails()),
                    null);
        }
    }

    private async Task<AiAssistantResponse> HandleSupportAsync(
        string message,
        string language,
        CancellationToken cancellationToken)
    {
        var contact = await FindAsync("contact support whatsapp phone email", language, "contact", cancellationToken);
        var parts = new List<string>();

        if (contact is not null)
        {
            parts.Add(Compose(contact, language));
        }

        if (AiSupportIntentDetector.AsksForHours(message) || contact is null)
        {
            var hours = await FindAsync("support hours", language, "support hours", cancellationToken);
            if (hours is not null)
            {
                parts.Add(Compose(hours, language));
            }
        }

        var text = parts.Count > 0
            ? string.Join("\n\n", parts)
            : language == "en"
                ? "You can reach the Wesal team through the Help Center page."
                : "تقدر توصل لفريق وصال من صفحة مركز المساعدة.";

        var response = Build(language, AiAssistantResponseKind.Answer, text, null);
        var help = NavigateAction(language, WesalNavigationRegistry.Help, AiNavigationMode.Suggest);
        return help is null ? response : response with { Actions = [help] };
    }

    private async Task<WesalKnowledgeArticle?> FindAsync(
        string query,
        string language,
        string titleContains,
        CancellationToken cancellationToken)
    {
        var articles = await _knowledgeService.SearchAsync(query, language, 6, cancellationToken);
        return articles.FirstOrDefault(a =>
            string.Equals(a.Category, "platform", StringComparison.OrdinalIgnoreCase)
            && a.Title.Contains(titleContains, StringComparison.OrdinalIgnoreCase));
    }

    private static string Compose(WesalKnowledgeArticle article, string language)
        => WesalKnowledgeAnswerComposer.Compose(article, language);

    internal static AiAssistantResponse BuildNavigation(string language, AiNavigationMatch match)
    {
        var action = NavigateAction(language, match.Page.Key, match.Mode);
        var label = language == "en" ? match.Page.LabelEn : match.Page.LabelAr;

        string message;
        if (match.Mode == AiNavigationMode.Auto)
        {
            message = language == "en"
                ? $"Sure, opening the \"{label}\" page for you."
                : $"أكيد، بفتحلك صفحة «{label}».";
        }
        else
        {
            message = match.Page.Key switch
            {
                WesalNavigationRegistry.Halls => language == "en"
                    ? "You can browse all halls on the Halls page. If you tell me the region, guest count or date, I can search for matching halls right here."
                    : "تقدر تتصفح كل الصالات من صفحة الصالات. وإذا حكيتلي المنطقة أو عدد الضيوف أو التاريخ، بدوّرلك على القاعات المناسبة هون.",
                WesalNavigationRegistry.Faq => language == "en"
                    ? "You'll find the frequently asked questions on the FAQ page."
                    : "الأسئلة الشائعة موجودة في صفحة الأسئلة الشائعة.",
                WesalNavigationRegistry.Help => language == "en"
                    ? "The Help Center is the place to get assistance."
                    : "مركز المساعدة هو المكان المناسب للحصول على مساعدة.",
                _ => language == "en"
                    ? $"You can find that on the \"{label}\" page."
                    : $"تلاقي هذا الشي في صفحة «{label}»."
            };
        }

        var response = Build(language, AiAssistantResponseKind.Answer, message, null);
        return response with { Actions = action is null ? null : [action] };
    }

    /// <summary>The only way an assistant action is created: the href always comes from the registry.</summary>
    internal static AiAssistantActionDto? NavigateAction(
        string language,
        string pageKey,
        AiNavigationMode mode,
        Guid? entityId = null)
    {
        var page = WesalNavigationRegistry.Find(pageKey);
        var href = WesalNavigationRegistry.ResolveHref(pageKey, entityId);
        if (page is null || href is null)
        {
            return null;
        }

        return new AiAssistantActionDto(
            AiAssistantActionTypes.Navigate,
            page.Key,
            href,
            language == "en" ? page.LabelEn : page.LabelAr,
            mode == AiNavigationMode.Auto ? AiAssistantActionTypes.ModeAuto : AiAssistantActionTypes.ModeSuggest);
    }

    private static AiAssistantResponse Build(
        string language,
        AiAssistantResponseKind kind,
        string message,
        AiAssistantIntentDto? intent)
        => new(
            kind,
            message,
            language,
            DateTime.UtcNow,
            Array.Empty<HallRecommendationDto>(),
            HallDetails: null,
            Availability: null,
            Intent: intent);
}
