using System.Text.Json;
using System.Text.RegularExpressions;
using Wesal.Application.Ai;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;

namespace Wesal.Infrastructure.AiAssistant;

public sealed class AiKnowledgeGapDetector : IAiKnowledgeGapDetector
{
    public bool IsRecordable(AiKnowledgeGapOutcome outcome)
        => outcome is AiKnowledgeGapOutcome.GenericNoTrustedAnswer or AiKnowledgeGapOutcome.NegativeFeedback;
}

public sealed class AiKnowledgeGapRecorder : IAiKnowledgeGapRecorder
{
    private const int MaximumQuestionLength = 500;
    private const int MaximumSamples = 5;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly IAiKnowledgeStudioRepository _repository;
    private readonly TimeProvider _timeProvider;

    public AiKnowledgeGapRecorder(IAiKnowledgeStudioRepository repository, TimeProvider timeProvider)
    {
        _repository = repository;
        _timeProvider = timeProvider;
    }

    public async Task<Guid?> RecordAsync(AiKnowledgeGapCandidate candidate, CancellationToken cancellationToken = default)
    {
        if (candidate.Reason is not (AiKnowledgeGapReason.NoTrustedKnowledge
            or AiKnowledgeGapReason.GenericFallback
            or AiKnowledgeGapReason.NegativeFeedback))
        {
            return null;
        }

        var safeQuestion = AiKnowledgeGapSanitizer.Sanitize(candidate.Question, MaximumQuestionLength);
        var normalized = AiText.Normalize(safeQuestion);
        if (normalized.Length < 3)
        {
            return null;
        }

        var language = NormalizeLanguage(candidate.Language, safeQuestion);
        var now = candidate.OccurredAt?.ToUniversalTime() ?? _timeProvider.GetUtcNow();
        var candidates = await _repository.GetRecentUnresolvedGapsAsync(language, 300, cancellationToken);
        var existing = candidates.FirstOrDefault(cluster =>
            AiKnowledgeGapSimilarity.AreSafeDuplicates(cluster.NormalizedKey, normalized));

        if (existing is not null)
        {
            existing.OccurrenceCount = checked(existing.OccurrenceCount + 1);
            existing.LastSeenAt = now;
            var samples = DeserializeSamples(existing.SampleQuestionsJson);
            if (samples.Count < MaximumSamples && !samples.Contains(safeQuestion, StringComparer.Ordinal))
            {
                samples.Add(safeQuestion);
                existing.SampleQuestionsJson = JsonSerializer.Serialize(samples, JsonOptions);
            }

            await _repository.SaveChangesAsync(cancellationToken);
            return existing.Id;
        }

        var cluster = new AiKnowledgeGapCluster
        {
            CanonicalQuestion = safeQuestion,
            NormalizedKey = normalized,
            Language = language,
            Status = AiKnowledgeGapStatus.New,
            OccurrenceCount = 1,
            FirstSeenAt = now,
            LastSeenAt = now,
            Reason = candidate.Reason,
            SampleQuestionsJson = JsonSerializer.Serialize(new[] { safeQuestion }, JsonOptions)
        };

        _repository.AddGap(cluster);
        await _repository.SaveChangesAsync(cancellationToken);
        return cluster.Id;
    }

    private static List<string> DeserializeSamples(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static string NormalizeLanguage(string? language, string question)
    {
        if (language?.StartsWith("en", StringComparison.OrdinalIgnoreCase) == true) return "en";
        if (language?.StartsWith("ar", StringComparison.OrdinalIgnoreCase) == true) return "ar";
        return question.Any(c => c is >= '\u0600' and <= '\u06ff') ? "ar" : "en";
    }
}

public static partial class AiKnowledgeGapSanitizer
{
    public static string Sanitize(string? value, int maxLength = 500)
    {
        if (string.IsNullOrWhiteSpace(value) || maxLength <= 0) return string.Empty;

        var safe = value.Replace('\r', ' ').Replace('\n', ' ').Trim();
        safe = BearerTokenRegex().Replace(safe, "[redacted]");
        safe = JwtRegex().Replace(safe, "[redacted]");
        safe = SecretAssignmentRegex().Replace(safe, "$1=[redacted]");
        safe = EmailRegex().Replace(safe, "[redacted email]");
        safe = PhoneRegex().Replace(safe, "[redacted phone]");
        safe = ControlCharacterRegex().Replace(safe, " ");
        safe = WhitespaceRegex().Replace(safe, " ").Trim();
        return safe.Length <= maxLength ? safe : safe[..maxLength].TrimEnd();
    }

    [GeneratedRegex(@"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]{8,}", RegexOptions.CultureInvariant)]
    private static partial Regex BearerTokenRegex();

    [GeneratedRegex(@"\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b", RegexOptions.CultureInvariant)]
    private static partial Regex JwtRegex();

    [GeneratedRegex(@"(?i)\b(password|passcode|api[_-]?key|secret|authorization|token)\s*[:=]\s*[^\s,;]+", RegexOptions.CultureInvariant)]
    private static partial Regex SecretAssignmentRegex();

    [GeneratedRegex(@"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex EmailRegex();

    [GeneratedRegex(@"(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)", RegexOptions.CultureInvariant)]
    private static partial Regex PhoneRegex();

    [GeneratedRegex(@"[\u0000-\u001f\u007f]")]
    private static partial Regex ControlCharacterRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();
}

public static class AiKnowledgeGapSimilarity
{
    public static bool AreSafeDuplicates(string left, string right)
    {
        var normalizedLeft = AiText.Normalize(left);
        var normalizedRight = AiText.Normalize(right);
        if (normalizedLeft.Length == 0 || normalizedRight.Length == 0) return false;
        if (string.Equals(normalizedLeft, normalizedRight, StringComparison.Ordinal)) return true;

        var leftTokens = AiText.Tokens(normalizedLeft).ToHashSet(StringComparer.Ordinal);
        var rightTokens = AiText.Tokens(normalizedRight).ToHashSet(StringComparer.Ordinal);
        if (leftTokens.Count < 3 || rightTokens.Count < 3) return false;

        var intersection = leftTokens.Intersect(rightTokens, StringComparer.Ordinal).Count();
        var union = leftTokens.Union(rightTokens, StringComparer.Ordinal).Count();
        return union > 0 && (double)intersection / union >= 0.9;
    }
}
