using Wesal.Application.Common.Models;

namespace Wesal.Tests.Ai;

/// <summary>Ensures assistant booking conversations stop at a user-reviewable preview.</summary>
public sealed class MabroukV6SafeActionsShould
{
    [Theory]
    [InlineData("ar", "ابحث عن قاعات", "لم يتم إرسال الطلب أو تأكيد الحجز")]
    [InlineData("en", "show me halls", "No booking was submitted or confirmed")]
    public async Task PrepareBookingPreviewWithoutSubmitting(
        string language,
        string query,
        string noSubmissionPhrase)
    {
        var harness = new MabroukHarness();
        var state = new AiConversationState(
            BookingHallId: harness.NakheelId,
            BookingHallName: "قاعة النخيل",
            BookingDate: new DateOnly(2026, 10, 25),
            BookingStartTime: new TimeOnly(18, 0),
            BookingEndTime: new TimeOnly(22, 0),
            BookingCustomerName: "Abood");
        var conversation = new AiConversationContext([], null, State: state);

        var response = await harness.AskAsync(query, language, conversation: conversation);

        Assert.Equal(AiAssistantResponseKind.Answer, response.Kind);
        Assert.Contains(noSubmissionPhrase, response.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("2026-10-25", response.Message);
        Assert.Contains("18:00", response.Message);
        Assert.Contains("22:00", response.Message);
        Assert.Contains("Abood", response.Message);
        Assert.Contains(harness.NakheelId, harness.Details.Requested);
    }
}
