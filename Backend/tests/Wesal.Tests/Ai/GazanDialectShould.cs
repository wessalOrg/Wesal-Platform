using Microsoft.Extensions.Options;
using Wesal.Application.Ai;
using Wesal.Application.Ai.Navigation;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Ai;

/// <summary>
/// Gazan-dialect coverage for the deterministic assistant layer: every phrasing
/// here is how Gazans actually type, and each must resolve to a useful answer
/// category (never the generic fallback) with no model involved.
/// </summary>
public sealed class GazanDialectShould
{
    private static HowToService CreateHowTo() => new(
        new SubscriptionPaymentService(Options.Create(new SubscriptionPaymentOptions())));

    public static TheoryData<string> SearchPhrasings => new()
    {
        "دورلي على قاعة",
        "فرجيني قاعات",
        "وين بلاقي قاعة؟",
        "شو عندكم قاعات؟",
    };

    [Theory]
    [MemberData(nameof(SearchPhrasings))]
    public async Task SearchDialect_ReturnsSearchAnswer(string phrase)
    {
        var response = await CreateHowTo().AskHowToAsync(phrase, "ar");
        Assert.Equal("search", response.Category);
    }

    public static TheoryData<string> PricePhrasings => new()
    {
        "قديش سعر القاعة؟",
        "شو سعر الليلة؟",
        "بقديش الحجز؟",
    };

    [Theory]
    [MemberData(nameof(PricePhrasings))]
    public async Task PriceDialect_ReturnsPricingAnswer(string phrase)
    {
        var response = await CreateHowTo().AskHowToAsync(phrase, "ar");
        Assert.Equal("pricing", response.Category);
    }

    [Theory]
    [InlineData("بتسع كم واحد؟")]
    [InlineData("كم نفر بتسع القاعة؟")]
    public async Task CapacityDialect_ReturnsCapacityAnswer(string phrase)
    {
        var response = await CreateHowTo().AskHowToAsync(phrase, "ar");
        Assert.Equal("capacity", response.Category);
    }

    [Theory]
    [InlineData("فرجيني صور القاعة")]
    [InlineData("وين صور القاعة؟")]
    public async Task PhotosDialect_ReturnsPhotosAnswer(string phrase)
    {
        var response = await CreateHowTo().AskHowToAsync(phrase, "ar");
        Assert.Equal("photos", response.Category);
    }

    [Theory]
    [InlineData("القاعة فاضية يوم الجمعة؟")]
    [InlineData("وينتا في حجز فاضي؟")]
    public async Task AvailabilityDialect_ReturnsAvailabilityAnswer(string phrase)
    {
        var response = await CreateHowTo().AskHowToAsync(phrase, "ar");
        Assert.Equal("availability", response.Category);
    }

    [Theory]
    [InlineData("شو دوامكم؟")]
    [InlineData("وينتا بتفتحو؟")]
    public async Task HoursDialect_ReturnsHoursAnswer(string phrase)
    {
        var response = await CreateHowTo().AskHowToAsync(phrase, "ar");
        Assert.Equal("hours", response.Category);
    }

    [Fact]
    public async Task AskForYourNumber_ReturnsSupportAnswer()
    {
        var response = await CreateHowTo().AskHowToAsync("اعطيني رقمكم", "ar");
        Assert.Equal("support", response.Category);
    }

    [Fact]
    public void OwnerNumber_IsNotWesalSupport()
    {
        Assert.False(AiSupportIntentDetector.IsSupport("شو رقم صاحب القاعة؟"));
    }

    public static TheoryData<string> GreetingPhrasings => new()
    {
        "مرحبا",
        "يسلمو",
        "شكرا",
    };

    [Theory]
    [MemberData(nameof(GreetingPhrasings))]
    public async Task GreetingDialect_ReturnsGreetingAnswer(string phrase)
    {
        var response = await CreateHowTo().AskHowToAsync(phrase, "ar");
        Assert.Equal("greeting", response.Category);
    }

    [Fact]
    public async Task GreetingWithIntent_RoutesByIntent()
    {
        var response = await CreateHowTo().AskHowToAsync("مرحبا بدي احجز", "ar");
        Assert.Equal("booking", response.Category);
    }

    public static TheoryData<string> CreatorPhrasings => new()
    {
        "مين عملك؟",
        "احكيلي عن حالك",
    };

    [Theory]
    [MemberData(nameof(CreatorPhrasings))]
    public async Task CreatorDialect_ReturnsCreatorAnswer(string phrase)
    {
        var response = await CreateHowTo().AskHowToAsync(phrase, "ar");
        Assert.Contains("وصال", response.Answer, StringComparison.Ordinal);
    }

    public static TheoryData<string> CancelPhrasings => new()
    {
        "بدي الغي الحجز",
        "بطلت بدي احجز",
        "مش بدي احجز",
    };

    [Theory]
    [MemberData(nameof(CancelPhrasings))]
    public async Task CancelDialect_DoesNotReturnBookingInstructions(string phrase)
    {
        var response = await CreateHowTo().AskHowToAsync(phrase, "ar");
        Assert.Equal("booking-cancel", response.Category);
    }

    [Fact]
    public async Task WhyRejected_ReturnsReasonGuidance()
    {
        var response = await CreateHowTo().AskHowToAsync("ليش الحجز مرفوض؟", "ar");
        Assert.Equal("booking-rejected", response.Category);
    }

    [Fact]
    public void WhenWord_IsNotLocation()
    {
        Assert.NotEqual(AiHallQuestion.Location, AiHallQuestionClassifier.Classify("وينتا بتفتحو؟"));
    }

    [Fact]
    public void Photographer_IsNotPhotosQuestion()
    {
        Assert.NotEqual(AiHallQuestion.Photos, AiHallQuestionClassifier.Classify("بدي مصور"));
    }

    [Fact]
    public void DialectPrice_IsPriceQuestion()
    {
        Assert.Equal(AiHallQuestion.Price, AiHallQuestionClassifier.Classify("قديش سعر القاعة؟"));
    }

    [Theory]
    [InlineData("طب كيف احجز صالة او مصور")]
    [InlineData("بدي احجز قاعة ومصور")]
    public async Task PhotographerMention_DoesNotReturnPhotosAnswer(string phrase)
    {
        var response = await CreateHowTo().AskHowToAsync(phrase, "ar");
        Assert.NotEqual("photos", response.Category);
    }

    public static TheoryData<string> CapabilitiesPhrasings => new()
    {
        "بتقدموا انتو",
        "شو خدماتكم؟",
        "شو بتقدمو؟",
    };

    [Theory]
    [MemberData(nameof(CapabilitiesPhrasings))]
    public async Task CapabilitiesDialect_ReturnsCapabilitiesAnswer(string phrase)
    {
        var response = await CreateHowTo().AskHowToAsync(phrase, "ar");
        Assert.Equal("capabilities", response.Category);
    }

    public static TheoryData<string> OrthographyVariants => new()
    {
        "أبحث عن قاعة",
        "ابحث عن قاعة",
        "فرجيني صورة القاعة",
        "بدي ألغي الحجز",
    };

    [Theory]
    [MemberData(nameof(OrthographyVariants))]
    public async Task OrthographyVariants_DoNotFallToGeneric(string phrase)
    {
        var response = await CreateHowTo().AskHowToAsync(phrase, "ar");
        Assert.NotEqual("general", response.Category);
    }

    public static TheoryData<string> MonthHintPhrasings => new()
    {
        "بشهر 10 بدي",
        "أكتوبر",
        "بشهر عشرة",
    };

    [Theory]
    [MemberData(nameof(MonthHintPhrasings))]
    public async Task MonthWithoutDay_AsksForExactDay(string phrase)
    {
        var response = await CreateHowTo().AskHowToAsync(phrase, "ar");
        Assert.Equal("month-hint", response.Category);
    }

    [Theory]
    [InlineData("استعرض الصالات")]
    [InlineData("اعرضلي القاعات")]
    public async Task ShowHallsDialect_ReturnsSearchAnswer(string phrase)
    {
        var response = await CreateHowTo().AskHowToAsync(phrase, "ar");
        Assert.Equal("search", response.Category);
    }

    [Fact]
    public async Task FamousWord_IsNotMonthHint()
    {
        // "اشهر" (most famous) contains "شهر" but must not trigger month-hint.
        var response = await CreateHowTo().AskHowToAsync("شو اشهر صالة بغزة؟", "ar");
        Assert.NotEqual("month-hint", response.Category);
    }
}
