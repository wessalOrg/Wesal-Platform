namespace Wesal.Application.Ai;

public sealed class AiLanguageDetector : IAiLanguageDetector
{
    public string? Detect(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;

        int arabic = 0, latin = 0;
        foreach (var ch in text)
        {
            if (ch >= '\u0600' && ch <= '\u06FF')
                arabic++;
            else if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z'))
                latin++;
        }

        if (arabic == 0 && latin == 0)
            return null;

        if (arabic > 0 && latin == 0)
            return "ar";
        if (latin > 0 && arabic == 0)
            return "en";

        // Mixed: use dominant with 60% threshold to avoid mixed-language responses
        var total = arabic + latin;
        var arabicRatio = (double)arabic / total;
        var latinRatio = (double)latin / total;

        if (arabicRatio >= 0.6) return "ar";
        if (latinRatio >= 0.6) return "en";

        // Ambiguous/mixed without clear dominant → fallback
        return null;
    }
}
