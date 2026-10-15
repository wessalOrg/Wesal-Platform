using System.Diagnostics;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Infrastructure.AiAssistant;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Ai;

/// <summary>Measures production hybrid retrieval against source-reviewed labeled knowledge cases.</summary>
public sealed class MabroukV5RetrievalBaselineShould
{
    [Fact]
    public async Task RecordLabeledCorpusMetricsAgainstCurrentHybridRetriever()
    {
        var fixturePath = Path.Combine(AppContext.BaseDirectory, "Ai", "Fixtures", "mabrouk-v5-retrieval-eval.json");
        using var fixture = JsonDocument.Parse(await File.ReadAllTextAsync(fixturePath));
        var cases = fixture.RootElement.EnumerateArray().ToArray();
        Assert.True(cases.Length >= 30);
        var ids = cases.Select(item => item.GetProperty("id").GetString()!).ToArray();
        Assert.Equal(ids.Length, ids.Distinct(StringComparer.Ordinal).Count());
        Assert.Equal(18, cases.Count(item => item.GetProperty("cohort").GetString() == "v5"));
        Assert.Equal(16, cases.Count(item => item.GetProperty("cohort").GetString() == "v6"));

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase("MabroukV6RetrievalEvaluation-" + Guid.NewGuid())
            .Options;
        await using var db = new ApplicationDbContext(options);
        var repository = new AiKnowledgeStudioRepository(db);
        var clock = new FixedClock(new DateTimeOffset(2026, 10, 13, 12, 0, 0, TimeSpan.Zero));
        var embedded = new WesalKnowledgeService();
        var retriever = new HybridWesalKnowledgeService(embedded, repository, clock, NullLogger<HybridWesalKnowledgeService>.Instance);
        var rows = new List<EvalRow>(cases.Length);
        var latencySamples = new List<double>(cases.Length * 10);
        var embeddedKeys = embedded.GetArticles().Select(article => article.Key).ToHashSet(StringComparer.Ordinal);

        foreach (var item in cases)
        {
            var id = item.GetProperty("id").GetString()!;
            var query = item.GetProperty("query").GetString()!;
            var language = item.GetProperty("language").GetString()!;
            var expectedKeys = item.GetProperty("expectedKeys").EnumerateArray()
                .Select(value => value.GetString()!).ToArray();
            var preferredKey = item.GetProperty("preferredKey").ValueKind == JsonValueKind.String
                ? item.GetProperty("preferredKey").GetString()
                : null;
            var fallbackExpectation = item.GetProperty("fallbackExpectation").GetString()!;
            var forbiddenKeys = item.GetProperty("forbiddenKeys").EnumerateArray()
                .Select(value => value.GetString()!).ToArray();

            Assert.Contains(fallbackExpectation, new[] { "required", "allowed", "forbidden" });
            Assert.True(preferredKey is null ? expectedKeys.Length == 0 : expectedKeys.Contains(preferredKey, StringComparer.Ordinal),
                $"{id}: preferredKey must be null for an unknown query or belong to expectedKeys.");
            Assert.Empty(expectedKeys.Intersect(forbiddenKeys, StringComparer.Ordinal));
            Assert.All(expectedKeys.Concat(forbiddenKeys), key => Assert.True(
                embeddedKeys.Contains(key),
                $"{id}: labeled key '{key}' is not present in the embedded knowledge corpus."));

            _ = await retriever.SearchAsync(query, language, 5); // warm JIT and embedded document cache
            var samples = new List<double>(10);
            IReadOnlyList<WesalKnowledgeArticle> results = [];
            for (var sample = 0; sample < 10; sample++)
            {
                var timer = Stopwatch.StartNew();
                results = await retriever.SearchAsync(query, language, 5);
                timer.Stop();
                samples.Add(timer.Elapsed.TotalMilliseconds);
            }
            latencySamples.AddRange(samples);

            var top1 = results.FirstOrDefault();
            var top3 = results.Take(3).ToArray();
            var top3Keys = top3.Select(result => result.StableKey ?? string.Empty).ToArray();
            var top3Evidence = top3.Select(result =>
                $"{result.StableKey}|score={result.MatchScore}|method={result.RetrievalMethod}|aliases={string.Join(',', result.MatchedAliases ?? [])}").ToArray();
            var top1Key = top1?.StableKey;
            var top1Accepted = top1Key is not null && expectedKeys.Contains(top1Key, StringComparer.Ordinal);
            var top3Accepted = top3.Any(result => expectedKeys.Contains(result.StableKey, StringComparer.Ordinal));
            var fallback = results.Count == 0;
            var fallbackCorrect = fallbackExpectation switch
            {
                "required" => fallback,
                "forbidden" => !fallback,
                _ => true
            };
            var wrongSource = results.Count > 0 && !top1Accepted;
            rows.Add(new EvalRow(
                id,
                item.GetProperty("cohort").GetString()!,
                language,
                item.GetProperty("kind").GetString()!,
                expectedKeys,
                preferredKey,
                top1Key,
                top3Keys,
                top3Evidence,
                top1Accepted,
                top1Key is not null && top1Key == preferredKey,
                top3Accepted,
                fallback,
                fallbackCorrect,
                fallbackExpectation,
                results.Count > 0 && forbiddenKeys.Contains(top1Key!, StringComparer.Ordinal),
                top3.Any(result => forbiddenKeys.Contains(result.StableKey, StringComparer.Ordinal)),
                wrongSource,
                samples.Average()));
        }

        var answerableRows = rows.Where(row => row.ExpectedKeys.Length > 0).ToArray();
        Assert.Equal(32, answerableRows.Length);
        Assert.All(answerableRows, row => Assert.True(row.Top1Accepted, $"{row.Id}: returned unaccepted source '{row.Top1Key}'."));
        Assert.All(answerableRows, row => Assert.True(row.PreferredTop1, $"{row.Id}: expected preferred source '{row.PreferredKey}', got '{row.Top1Key}'."));
        Assert.All(answerableRows, row => Assert.True(row.Top3Accepted, $"{row.Id}: none of the accepted sources appeared in top 3."));
        Assert.All(rows, row => Assert.False(row.ForbiddenTop1, $"{row.Id}: forbidden source ranked first ('{row.Top1Key}')."));
        Assert.All(rows, row => Assert.False(row.ForbiddenTop3, $"{row.Id}: forbidden source appeared in top 3 ({string.Join(", ", row.Top3Keys)})."));
        Assert.All(rows, row => Assert.True(row.FallbackCorrect, $"{row.Id}: fallback did not match '{row.FallbackExpectation}'."));
        var report = new
        {
            version = 3,
            baseline = "origin/main 9c01dfd8e6456d2476c51ab3281b8ba763827e97",
            retriever = "HybridWesalKnowledgeService (exact aliases + deterministic lexical ranking; no vectors)",
            note = "Source-reviewed expectedKeys are answerable sources; preferredKey measures ranking preference. Wrong source is an unaccepted top-1 result; forbidden top-1 and top-3 are reported separately. Fallback correctness follows each case's required/allowed/forbidden expectation. Offline embedded corpus, empty in-memory dynamic repository; latency excludes database and network time.",
            corpusSize = rows.Count,
            cohorts = rows.GroupBy(row => row.Cohort).OrderBy(group => group.Key).Select(group => new
            {
                cohort = group.Key,
                cases = group.Count(),
                answerableCases = group.Count(row => row.ExpectedKeys.Length > 0),
                top1SourceAccuracy = Ratio(group.Count(row => row.Top1Accepted), group.Count(row => row.ExpectedKeys.Length > 0)),
                preferredTop1Rate = Ratio(group.Count(row => row.PreferredTop1), group.Count(row => row.PreferredKey is not null)),
                top3SourceRecall = Ratio(group.Count(row => row.Top3Accepted), group.Count(row => row.ExpectedKeys.Length > 0)),
                wrongSourceTop1Rate = Ratio(group.Count(row => row.WrongSource), group.Count()),
                forbiddenTop1Rate = Ratio(group.Count(row => row.ForbiddenTop1), group.Count()),
                forbiddenTop3Rate = Ratio(group.Count(row => row.ForbiddenTop3), group.Count()),
                fallbackRate = Ratio(group.Count(row => row.Fallback), group.Count()),
                fallbackExpectationAccuracy = Ratio(group.Count(row => row.FallbackCorrect), group.Count())
            }),
            answerableCases = answerableRows.Length,
            top1SourceAccuracy = Ratio(rows.Count(row => row.Top1Accepted), answerableRows.Length),
            preferredTop1Rate = Ratio(rows.Count(row => row.PreferredTop1), rows.Count(row => row.PreferredKey is not null)),
            top3SourceRecall = Ratio(rows.Count(row => row.Top3Accepted), answerableRows.Length),
            wrongSourceTop1Rate = Ratio(rows.Count(row => row.WrongSource), rows.Count),
            forbiddenTop1Rate = Ratio(rows.Count(row => row.ForbiddenTop1), rows.Count),
            forbiddenTop3Rate = Ratio(rows.Count(row => row.ForbiddenTop3), rows.Count),
            fallbackRate = Ratio(rows.Count(row => row.Fallback), rows.Count),
            fallbackExpectationAccuracy = Ratio(rows.Count(row => row.FallbackCorrect), rows.Count),
            averageLatencyMs = Math.Round(latencySamples.Average(), 3),
            p95LatencyMs = Math.Round(Percentile(latencySamples.Order().ToArray(), 0.95), 3),
            byLanguage = rows.GroupBy(row => row.Language).OrderBy(group => group.Key).Select(group => new
            {
                language = group.Key,
                cases = group.Count(),
                answerableCases = group.Count(row => row.ExpectedKeys.Length > 0),
                top1SourceAccuracy = Ratio(group.Count(row => row.Top1Accepted), group.Count(row => row.ExpectedKeys.Length > 0)),
                preferredTop1Rate = Ratio(group.Count(row => row.PreferredTop1), group.Count(row => row.PreferredKey is not null)),
                top3SourceRecall = Ratio(group.Count(row => row.Top3Accepted), group.Count(row => row.ExpectedKeys.Length > 0)),
                fallbackRate = Ratio(group.Count(row => row.Fallback), group.Count())
            }),
            byKind = rows.GroupBy(row => row.Kind).OrderBy(group => group.Key).Select(group => new
            {
                kind = group.Key,
                cases = group.Count(),
                answerableCases = group.Count(row => row.ExpectedKeys.Length > 0),
                top1SourceAccuracy = Ratio(group.Count(row => row.Top1Accepted), group.Count(row => row.ExpectedKeys.Length > 0)),
                top3SourceRecall = Ratio(group.Count(row => row.Top3Accepted), group.Count(row => row.ExpectedKeys.Length > 0)),
                wrongSourceTop1Rate = Ratio(group.Count(row => row.WrongSource), group.Count())
            }),
            cases = rows
        };

        var output = Path.Combine(Path.GetTempPath(), "mabrouk-v6-retrieval-evaluation.json");
        await File.WriteAllTextAsync(output, JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }));
        Console.WriteLine("Evaluation report: " + output);
        Console.WriteLine(JsonSerializer.Serialize(new
        {
            report.baseline,
            report.corpusSize,
            report.answerableCases,
            report.top1SourceAccuracy,
            report.preferredTop1Rate,
            report.top3SourceRecall,
            report.wrongSourceTop1Rate,
            report.forbiddenTop1Rate,
            report.forbiddenTop3Rate,
            report.fallbackRate,
            report.fallbackExpectationAccuracy,
            report.averageLatencyMs,
            report.p95LatencyMs,
            report.cohorts,
            report.byLanguage,
            failures = rows.Where(row => !row.Top1Accepted && !row.FallbackCorrect || row.WrongSource || row.ForbiddenTop1)
                .Select(row => new { row.Id, row.ExpectedKeys, row.PreferredKey, row.Top1Key, row.Fallback, row.WrongSource, row.ForbiddenTop1 })
        }));
    }

    private static double Ratio(int numerator, int denominator)
        => denominator == 0 ? 0 : Math.Round((double)numerator / denominator, 4);

    private static double Percentile(IReadOnlyList<double> sorted, double percentile)
        => sorted.Count == 0 ? 0 : sorted[Math.Clamp((int)Math.Ceiling(percentile * sorted.Count) - 1, 0, sorted.Count - 1)];

    private sealed record EvalRow(string Id, string Cohort, string Language, string Kind, string[] ExpectedKeys,
        string? PreferredKey, string? Top1Key, string[] Top3Keys, string[] Top3Evidence, bool Top1Accepted, bool PreferredTop1, bool Top3Accepted,
        bool Fallback, bool FallbackCorrect, string FallbackExpectation, bool ForbiddenTop1, bool ForbiddenTop3, bool WrongSource,
        double AverageLatencyMs);

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
