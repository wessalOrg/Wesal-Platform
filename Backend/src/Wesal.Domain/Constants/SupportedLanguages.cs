using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Domain.Constants;

public static class SupportedLanguages
{
    public const string Arabic = "ar";

    public const string English = "en";

    public static readonly string[] All = [Arabic, English];

    public static string Default => Arabic;

    public static bool IsSupported(string? language)
        => !string.IsNullOrWhiteSpace(language)
           && All.Contains(language.Trim(), StringComparer.OrdinalIgnoreCase);

    public static Language ToLanguage(string? language)
    {
        if (string.IsNullOrWhiteSpace(language))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Language"] = ["Language code is required. Supported languages are 'ar' and 'en'."]
            });
        }

        return language.Trim().ToLowerInvariant() switch
        {
            Arabic => Language.Arabic,
            English => Language.English,
            _ => throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Language"] = [$"Unsupported language code '{language}'. Supported languages are 'ar' and 'en'."]
            })
        };
    }

    public static string ToCode(Language language)
        => language switch
        {
            Language.Arabic => Arabic,
            Language.English => English,
            _ => Arabic
        };
}