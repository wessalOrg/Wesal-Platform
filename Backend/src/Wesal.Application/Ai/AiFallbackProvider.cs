using Wesal.Application.Common.Models;

namespace Wesal.Application.Ai;

public interface IAiFallbackProvider
{
    AiHowToResponse GetFallback(string? language, Guid? sessionId = null);
    string GetFallbackAnswer(string? language);
}

public sealed class AiFallbackProvider : IAiFallbackProvider
{
    public string GetFallbackAnswer(string? language)
    {
        var isArabic = string.Equals(language, "ar", StringComparison.OrdinalIgnoreCase) || string.IsNullOrWhiteSpace(language);
        return isArabic
            ? "عذراً، لم أتمكن من معالجة طلبك حالياً. يمكنك تصفح القاعات من صفحة القاعات، استخدام البحث والفلاتر، عرض تفاصيل القاعة والتحقق من التوفر، أو التواصل مع صاحب القاعة. حاول إعادة صياغة سؤالك."
            : "Sorry, I couldn't process your request right now. You can browse halls on the Halls page, use search and filters, view hall details and check availability, or contact the hall owner. Please try rephrasing your question.";
    }

    public AiHowToResponse GetFallback(string? language, Guid? sessionId = null)
    {
        var effectiveLang = string.IsNullOrWhiteSpace(language) ? "ar" : language!;
        if (effectiveLang != "ar" && effectiveLang != "en") effectiveLang = "ar";
        return new AiHowToResponse(
            Answer: GetFallbackAnswer(effectiveLang),
            IsFallback: true,
            SessionId: sessionId,
            Language: effectiveLang);
    }
}
