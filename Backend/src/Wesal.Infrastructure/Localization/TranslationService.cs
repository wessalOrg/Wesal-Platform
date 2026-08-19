using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Constants;

namespace Wesal.Infrastructure.Localization;

public sealed class TranslationService : ITranslationService
{
    private static readonly IReadOnlyDictionary<string, (string Arabic, string English)> Translations =
        new Dictionary<string, (string Arabic, string English)>
        {
            ["platform.name"] = ("وصال", "Wesal"),
            ["home.title"] = ("ابحث عن قاعة الأفراح المناسبة في غزة بسهولة", "Find your perfect wedding hall in Gaza with ease"),
            ["home.description"] = ("وصال منصتك للبحث عن قاعات الأفراح في غزة ومقارنتها والتواصل مع أصحابها وحجزها.", "Wesal is your platform to search, compare and book wedding halls across Gaza."),
            ["common.welcome"] = ("أهلاً وسهلاً بك", string.Empty)
        };

    public string Resolve(string key, string? language = null)
    {
        if (string.IsNullOrWhiteSpace(key) || !Translations.TryGetValue(key, out var entry))
        {
            return string.Empty;
        }

        var isEnglish = SupportedLanguages.IsSupported(language)
            && string.Equals(language, SupportedLanguages.English, StringComparison.OrdinalIgnoreCase);

        if (isEnglish && !string.IsNullOrWhiteSpace(entry.English))
        {
            return entry.English;
        }

        return entry.Arabic;
    }
}