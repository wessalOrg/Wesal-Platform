namespace Wesal.Application.Ai;

public interface IAiLanguageDetector
{
    /// <returns>"ar" for Arabic, "en" for English, null if ambiguous/insufficient confidence</returns>
    string? Detect(string? text);
}
