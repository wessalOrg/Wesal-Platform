using Wesal.Application.Ai;

namespace Wesal.Tests.Ai;

public class AiIntentRulesShould
{
    // ── payment ──────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("كم سعر الاشتراك لصاحب القاعة؟")]
    [InlineData("كم سعر الاشتراك؟")]
    [InlineData("كيف أجدد الاشتراك؟")]
    [InlineData("بدي أدفع اشتراك القاعة")]
    [InlineData("كيف أدفع رسوم الاشتراك؟")]
    [InlineData("how do I renew my subscription?")]
    [InlineData("how do I pay my subscription?")]
    [InlineData("how much is the owner subscription?")]
    public void Payment_SubscriptionWords_MeanTheOwnerSubscription(string message)
        => Assert.Equal(AiPaymentIntent.OwnerSubscription, AiPaymentIntentClassifier.Classify(message));

    [Theory]
    [InlineData("كيف أدفع الحجز؟")]
    [InlineData("كيف ادفع العربون؟")]
    [InlineData("how do I pay for my booking?")]
    [InlineData("where do I pay the deposit?")]
    public void Payment_BookingWords_MeanABookingPayment_NeverTheOwnerSubscription(string message)
        => Assert.Equal(AiPaymentIntent.BookingPayment, AiPaymentIntentClassifier.Classify(message));

    [Theory]
    [InlineData("كيف أدفع؟")]
    [InlineData("How do I pay?")]
    [InlineData("Where do I pay?")]
    public void Payment_BareHowDoIPay_IsAmbiguous(string message)
        => Assert.Equal(AiPaymentIntent.Ambiguous, AiPaymentIntentClassifier.Classify(message));

    [Theory]
    [InlineData("كم سعر قاعة النخيل؟")]
    [InlineData("كم سعرها؟")]
    [InlineData("what is the price of the hall?")]
    [InlineData("كيف أحجز قاعة؟")]
    public void Payment_HallPriceAndBookingHowTo_AreNotPayments(string message)
        => Assert.Equal(AiPaymentIntent.None, AiPaymentIntentClassifier.Classify(message));

    // ── support ──────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("كيف أتواصل مع الدعم الفني؟")]
    [InlineData("كيف اتواصل مع الدعم الفني؟")]
    [InlineData("بدي دعم وصال")]
    [InlineData("بدي دعم")]
    [InlineData("رقم وصال")]
    [InlineData("عندي مشكلة بالموقع")]
    [InlineData("عندي مشكلة في الموقع")]
    [InlineData("ما هي ساعات الدعم؟")]
    [InlineData("how do I contact Wesal support?")]
    [InlineData("technical support")]
    [InlineData("I have a problem with the website")]
    public void Support_IsRecognized(string message)
        => Assert.True(AiSupportIntentDetector.IsSupport(message), message);

    [Theory]
    [InlineData("كيف أحكي مع صاحب الصالة؟")]
    [InlineData("كيف أتواصل مع صاحب القاعة؟")]
    [InlineData("how do I contact the hall owner?")]
    [InlineData("كم سعر قاعة النخيل؟")]
    public void Support_IsNotHallOwnerMessagingOrHallQuestions(string message)
        => Assert.False(AiSupportIntentDetector.IsSupport(message), message);

    // ── hall questions ───────────────────────────────────────────────────────

    [Theory]
    [InlineData("كم سعرها؟", AiHallQuestion.Price)]
    [InlineData("بكم القاعة؟", AiHallQuestion.Price)]
    [InlineData("how much is it?", AiHallQuestion.Price)]
    [InlineData("كم بتسع؟", AiHallQuestion.Capacity)]
    [InlineData("كم شخص بتتسع؟", AiHallQuestion.Capacity)]
    [InlineData("what is the capacity?", AiHallQuestion.Capacity)]
    [InlineData("وين مكانها؟", AiHallQuestion.Location)]
    [InlineData("where is it located?", AiHallQuestion.Location)]
    [InlineData("شو الخدمات الموجودة؟", AiHallQuestion.Services)]
    [InlineData("what amenities does it have?", AiHallQuestion.Services)]
    [InlineData("في صور؟", AiHallQuestion.Photos)]
    [InlineData("متاحة بكرة؟", AiHallQuestion.Availability)]
    [InlineData("متاحة الجمعة؟", AiHallQuestion.Availability)]
    [InlineData("is it available tomorrow?", AiHallQuestion.Availability)]
    [InlineData("كيف أحجزها؟", AiHallQuestion.BookingHowTo)]
    [InlineData("كيف بحجزها؟", AiHallQuestion.BookingHowTo)]
    [InlineData("كيف أتواصل معهم؟", AiHallQuestion.ContactOwner)]
    [InlineData("احكيلي عنها", AiHallQuestion.Details)]
    [InlineData("مرحبا", AiHallQuestion.None)]
    public void HallQuestion_IsClassified(string message, AiHallQuestion expected)
        => Assert.Equal(expected, AiHallQuestionClassifier.Classify(message));

    // ── references ───────────────────────────────────────────────────────────

    [Theory]
    [InlineData("الثانية شو سعرها؟", 1)]
    [InlineData("the second one", 1)]
    [InlineData("الأولى", 0)]
    [InlineData("الثالثة متاحة؟", 2)]
    [InlineData("الأخيرة", -1)]
    public void Ordinal_IsResolved(string message, int expected)
        => Assert.Equal(expected, AiReferenceResolver.TryGetOrdinal(message));

    [Fact]
    public void Ordinal_AbsentWhenNotMentioned()
        => Assert.Null(AiReferenceResolver.TryGetOrdinal("كم سعرها؟"));

    [Theory]
    [InlineData("كم سعر قاعة النخيل؟", "النخيل")]
    [InlineData("احكيلي عن صالة الأوركيد", "الأوركيد")]
    [InlineData("tell me about Orchid hall", "Orchid")]
    [InlineData("tell me about Ghost Hall", "Ghost")]
    public void ExplicitHallName_KeepsTheUsersSpelling(string message, string expected)
        => Assert.Equal(expected, AiReferenceResolver.TryGetExplicitHallName(message));

    [Theory]
    [InlineData("كم سعرها؟")]
    [InlineData("كم سعر هذه القاعة؟")]
    [InlineData("متاحة بكرة؟")]
    [InlineData("بدي قاعة بغزة")]
    [InlineData("بدي قاعة في غزة لـ 300 شخص")]
    [InlineData("what is the price of this hall?")]
    [InlineData("is the hall available?")]
    public void ExplicitHallName_IsNullForPronounsAndRegions(string message)
        => Assert.Null(AiReferenceResolver.TryGetExplicitHallName(message));
}
