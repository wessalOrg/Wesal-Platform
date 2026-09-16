using System.Reflection;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>
/// Lightweight knowledge retrieval over the official Wesal Knowledge Base
/// (<c>documentation/ai-knowledge/*.md</c>), embedded into this assembly at
/// build time. Documents use YAML front matter for metadata (title, category,
/// status, keywords) and bilingual content sections (<c>## العربية</c> /
/// <c>## English</c>). Retrieval ranks documents by keyword and content-term
/// overlap with the user's question, then returns the top results bound to the
/// requested language. There is deliberately no vector store or embeddings; the
/// <see cref="IWesalKnowledgeService"/> contract is intentionally small so a
/// future RAG/search backend can replace this implementation without changing
/// callers. Content status (<see cref="WesalKnowledgeStatus"/>) is preserved on
/// every returned article; callers must never present NeedsVerification or Draft
/// content as confirmed platform policy.
/// </summary>
public sealed partial class WesalKnowledgeService : IWesalKnowledgeService
{
    private static readonly string[] BilingualMarkers = ["WesalKnowledge.", "documentation.ai-knowledge", "documentation/ai-knowledge", "ai-knowledge"];

    private static readonly HashSet<string> BrandKeywords = new(StringComparer.Ordinal)
    {
        "وصال",
        "wesal",
        "مبروك",
        "mabrook"
    };

    private readonly IReadOnlyList<KnowledgeDocument> _documents;
    private readonly ILogger<WesalKnowledgeService> _logger;

    public WesalKnowledgeService(ILogger<WesalKnowledgeService>? logger = null)
    {
        _logger = logger ?? NullLogger<WesalKnowledgeService>.Instance;
        _documents = LoadDocuments(typeof(WesalKnowledgeService).Assembly);
    }

    internal WesalKnowledgeService(IReadOnlyList<KnowledgeDocument> documents)
    {
        _documents = documents;
        _logger = NullLogger<WesalKnowledgeService>.Instance;
    }

    public Task<IReadOnlyList<WesalKnowledgeArticle>> SearchAsync(
        string question,
        string? language,
        int maxResults = 3,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(question))
        {
            return Task.FromResult<IReadOnlyList<WesalKnowledgeArticle>>([]);
        }

        cancellationToken.ThrowIfCancellationRequested();

        var normalizedQuery = Normalize(question);
        if (normalizedQuery.Length == 0)
        {
            return Task.FromResult<IReadOnlyList<WesalKnowledgeArticle>>([]);
        }

        var queryTokens = Tokenize(normalizedQuery);
        var effectiveMax = Math.Clamp(maxResults, 1, 10);

        IReadOnlyList<WesalKnowledgeArticle> results = _documents
            .Select(d => (Document: d, Score: Score(d, normalizedQuery, queryTokens, language)))
            .Where(x => x.Score > 0)
            .OrderByDescending(x => x.Score)
            .ThenByDescending(x => x.Document.Status == WesalKnowledgeStatus.Verified)
            .ThenByDescending(x => x.Document.LastUpdated)
            .ThenBy(x => x.Document.Category, StringComparer.Ordinal)
            .Take(effectiveMax)
            .Select(x => new WesalKnowledgeArticle(
                x.Document.Title,
                x.Document.Category,
                x.Document.Source,
                x.Document.LastUpdated,
                x.Document.Status,
                GetLocalizedContent(x.Document.Content, language)))
            .ToList();

        return Task.FromResult(results);
    }

    private static int Score(
        KnowledgeDocument document,
        string normalizedQuery,
        IReadOnlySet<string> queryTokens,
        string? language)
    {
        var score = 0;

        if (!string.IsNullOrWhiteSpace(document.Title)
            && normalizedQuery.Contains(Normalize(document.Title), StringComparison.Ordinal))
        {
            score += 2;
        }

        foreach (var keyword in document.Keywords)
        {
            var normalized = Normalize(keyword);
            if (normalized.Length > 0
                && normalizedQuery.Contains(normalized, StringComparison.Ordinal))
            {
                // Longer, more descriptive keywords carry more intent signal than
                // short brand mentions (e.g. "what is wesal" vs "wesal"). Brand
                // words still score so generic platform questions resolve, but they
                // must not outrank a doc that answers the actual intent.
                score += BrandKeywords.Contains(normalized)
                    ? 2
                    : Math.Max(normalized.Length, 2);
            }
        }

        var contentTokens = Tokenize(GetLocalizedContent(document.Content, language));
        foreach (var token in queryTokens)
        {
            if (contentTokens.Contains(token))
            {
                score += 1;
            }
        }

        return score;
    }

    private static IReadOnlyList<KnowledgeDocument> LoadDocuments(Assembly assembly)
    {
        var names = assembly
            .GetManifestResourceNames()
            .Where(n => BilingualMarkers.Any(m => n.Contains(m, StringComparison.OrdinalIgnoreCase))
                        && n.EndsWith(".md", StringComparison.OrdinalIgnoreCase))
            .OrderBy(n => n, StringComparer.Ordinal)
            .ToList();

        var documents = new List<KnowledgeDocument>(names.Count);
        foreach (var name in names)
        {
            using var stream = assembly.GetManifestResourceStream(name);
            if (stream is null)
            {
                continue;
            }

            using var reader = new StreamReader(stream);
            var raw = reader.ReadToEnd();
            var parsed = ParseDocument(name, raw);
            if (parsed is not null)
            {
                documents.Add(parsed);
            }
        }

        return documents;
    }

    internal static KnowledgeDocument? ParseDocument(string resourceName, string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        var meta = ParseFrontMatter(raw, out var body);

        var title = meta.GetValueOrDefault("title")?.Trim() ?? string.Empty;
        var category = meta.GetValueOrDefault("category")?.Trim() ?? string.Empty;
        var source = meta.GetValueOrDefault("source")?.Trim() ?? string.Empty;
        var statusText = meta.GetValueOrDefault("status")?.Trim() ?? string.Empty;
        var lastUpdated = ParseDate(meta.GetValueOrDefault("lastUpdated"));
        var keywords = (meta.GetValueOrDefault("keywords")?.Trim() ?? string.Empty)
            .Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToArray();

        var status = statusText.ToLowerInvariant() switch
        {
            "verified" => WesalKnowledgeStatus.Verified,
            "draft" => WesalKnowledgeStatus.Draft,
            _ => WesalKnowledgeStatus.NeedsVerification
        };

        return new KnowledgeDocument(
            resourceName,
            title,
            category,
            source,
            lastUpdated,
            status,
            keywords,
            string.IsNullOrWhiteSpace(body) ? raw : body.Trim());
    }

    private static Dictionary<string, string> ParseFrontMatter(string raw, out string body)
    {
        var dictionary = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        body = raw;

        var lines = raw.Split('\n');
        if (lines.Length < 3 || lines[0].Trim() != "---")
        {
            return dictionary;
        }

        var end = -1;
        for (var i = 1; i < lines.Length; i++)
        {
            if (lines[i].Trim() == "---")
            {
                end = i;
                break;
            }
        }

        if (end < 0)
        {
            return dictionary;
        }

        for (var i = 1; i < end; i++)
        {
            var line = lines[i];
            var separator = line.IndexOf(':');
            if (separator <= 0)
            {
                continue;
            }

            var key = line[..separator].Trim();
            var value = line[(separator + 1)..].Trim();
            if (key.Length > 0)
            {
                dictionary[key] = value;
            }
        }

        body = string.Join('\n', lines[(end + 1)..]);
        return dictionary;
    }

    private static DateOnly ParseDate(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return DateOnly.MinValue;
        }

        return DateOnly.TryParseExact(raw.Trim(), "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.None, out var parsed)
            ? parsed
            : DateOnly.MinValue;
    }

    /// <summary>
    /// Extracts the bilingual section matching the requested language and strips
    /// internal "Verification note / ملاحظة تحقق" paragraphs so end users only see
    /// the official guidance. Falls back to the full body when the language or
    /// section is unknown.
    /// </summary>
    internal static string GetLocalizedContent(string content, string? language)
    {
        var isArabic = !string.IsNullOrWhiteSpace(language) && language.StartsWith("ar", StringComparison.OrdinalIgnoreCase);
        var header = isArabic ? "## \u0627\u0644\u0639\u0631\u0628\u064a\u0629" : "## English";

        var lines = content.Split('\n');
        var start = Array.FindIndex(lines, l => l.Trim().Equals(header, StringComparison.OrdinalIgnoreCase));
        if (start < 0)
        {
            return CleanUserFacingParagraphs(content);
        }

        var end = lines.Length;
        for (var i = start + 1; i < lines.Length; i++)
        {
            if (lines[i].TrimStart().StartsWith("## ", StringComparison.Ordinal))
            {
                end = i;
                break;
            }
        }

        var section = string.Join('\n', lines[(start + 1)..end]);
        return CleanUserFacingParagraphs(section);
    }

    private static string CleanUserFacingParagraphs(string text)
    {
        var paragraphs = text.Split("\n\n", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(p => !StartsVerificationNote(p))
            .ToList();

        return paragraphs.Count == 0
            ? text.Trim()
            : string.Join("\n\n", paragraphs).Trim();
    }

    private static bool StartsVerificationNote(string paragraph)
    {
        var trimmed = paragraph.TrimStart();
        return trimmed.StartsWith("Verification note:", StringComparison.OrdinalIgnoreCase)
            || trimmed.StartsWith("\u0645\u0644\u0627\u062d\u0638\u0629 \u062a\u062d\u0642\u0642", StringComparison.Ordinal);
    }

    private static string Normalize(string input)
        => WhitespaceRegex().Replace(input.Trim().ToLowerInvariant(), " ");

    private static IReadOnlySet<string> Tokenize(string text)
        => WordRegex().Matches(text)
            .Select(m => m.Value)
            .ToHashSet(StringComparer.Ordinal);

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();

    [GeneratedRegex(@"[\p{L}\p{N}]+", RegexOptions.CultureInvariant)]
    private static partial Regex WordRegex();

    internal sealed record KnowledgeDocument(
        string ResourceName,
        string Title,
        string Category,
        string Source,
        DateOnly LastUpdated,
        WesalKnowledgeStatus Status,
        IReadOnlyList<string> Keywords,
        string Content);
}