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

/// <summary>Measures the production hybrid retriever against the reviewed Mabrouk corpus.</summary>
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

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase("MabroukV5RetrievalBaseline-" + Guid.NewGuid())
            .Options;
        await using var db = new ApplicationDbContext(options);
        var repository = new AiKnowledgeStudioRepository(db);
        var clock = new FixedClock(new DateTimeOffset(2026, 10, 13, 12, 0, 0, TimeSpan.Zero));
        var embedded = new WesalKnowledgeService();
        var retriever = new HybridWesalKnowledgeService(embedded, repository, clock, NullLogger<HybridWesalKnowledgeService>.Instance);
        var rows = new List<EvalRow>(cases.Length);

        foreach (var item in cases)
        {
            var query = item.GetProperty("query").GetString()!;
            var language = item.GetProperty("language").GetString()!;
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
            var expectedKeys = item.TryGetProperty("expectedKeys", out var expectedKeyValues)
                ? expectedKeyValues.EnumerateArray().Select(value => value.GetString()!).ToArray()
                : [];
            if (item.TryGetProperty("expectedKey", out var legacyExpectedKey)
                && legacyExpectedKey.ValueKind == JsonValueKind.String)
                expectedKeys = [legacyExpectedKey.GetString()!];
            var acceptableFallback = item.GetProperty("acceptableFallback").GetBoolean();
            var forbidden = item.GetProperty("forbiddenKeys").EnumerateArray().Select(value => value.GetString()!).ToArray();
            var top1 = results.FirstOrDefault();
            var top3 = results.Take(3).ToArray();
            var actualTop1Key = top1?.StableKey;
            var labelMatch = expectedKeys.Contains(actualTop1Key, StringComparer.Ordinal);
            var forbiddenMatch = forbidden.Any(key => results.Any(result => result.StableKey == key));
            var wrongSource = forbiddenMatch
                || (expectedKeys.Length > 0 && !acceptableFallback && results.Count > 0 && !labelMatch);
            rows.Add(new EvalRow(
                item.GetProperty("id").GetString()!,
                language,
                item.GetProperty("kind").GetString()!,
                expectedKeys,
                actualTop1Key,
                labelMatch,
                top3.Any(result => expectedKeys.Contains(result.StableKey, StringComparer.Ordinal)),
                results.Count == 0,
                wrongSource,
                acceptableFallback,
                samples.Average(),
                Percentile(samples.Order().ToArray(), 0.95)));
        }

        var report = new
        {
            version = 2,
            baseline = "origin/main 950a4b0a4da9f7007642cd8691f0f3118d81a0cc",
            retriever = "HybridWesalKnowledgeService (exact aliases + deterministic lexical ranking; no vectors)",
            note = "Offline embedded corpus, in-memory empty dynamic repository; latency excludes database and network time.",
            corpusSize = rows.Count,
            top1Accuracy = Ratio(rows.Count(row => row.Top1Correct), rows.Count(row => row.ExpectedKeys.Length > 0)),
            top3Recall = Ratio(rows.Count(row => row.Top3Correct), rows.Count(row => row.ExpectedKeys.Length > 0)),
            wrongSourceRate = Ratio(rows.Count(row => row.WrongSource), rows.Count),
            fallbackRate = Ratio(rows.Count(row => row.Fallback), rows.Count),
            averageLatencyMs = Math.Round(rows.Average(row => row.AverageLatencyMs), 3),
            p95LatencyMs = Math.Round(Percentile(rows.Select(row => row.P95LatencyMs).Order().ToArray(), 0.95), 3),
            byLanguage = rows.GroupBy(row => row.Language).OrderBy(group => group.Key).Select(group => new
            {
                language = group.Key,
                cases = group.Count(),
                top1Accuracy = Ratio(group.Count(row => row.Top1Correct), group.Count(row => row.ExpectedKeys.Length > 0)),
                top3Recall = Ratio(group.Count(row => row.Top3Correct), group.Count(row => row.ExpectedKeys.Length > 0)),
                fallbackRate = Ratio(group.Count(row => row.Fallback), group.Count())
            }),
            byKind = rows.GroupBy(row => row.Kind).OrderBy(group => group.Key).Select(group => new
            {
                kind = group.Key,
                cases = group.Count(),
                top1Accuracy = Ratio(group.Count(row => row.Top1Correct), group.Count(row => row.ExpectedKeys.Length > 0)),
                top3Recall = Ratio(group.Count(row => row.Top3Correct), group.Count(row => row.ExpectedKeys.Length > 0)),
                wrongSourceRate = Ratio(group.Count(row => row.WrongSource), group.Count())
            }),
            cases = rows
        };

        var output = Path.Combine(Path.GetTempPath(), "mabrouk-v6-retrieval-baseline.json");
        await File.WriteAllTextAsync(output, JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }));
        Console.WriteLine("Baseline report: " + output);
        Console.WriteLine(JsonSerializer.Serialize(new
        {
            report.baseline,
            report.corpusSize,
            report.top1Accuracy,
            report.top3Recall,
            report.wrongSourceRate,
            report.fallbackRate,
            report.averageLatencyMs,
            report.p95LatencyMs,
            report.byLanguage,
            failures = rows.Where(row => !row.Top1Correct && !row.AcceptableFallback)
                .Select(row => new { row.Id, row.ExpectedKeys, row.Top1Key, row.Fallback, row.WrongSource })
        }));
    }

    private static double Ratio(int numerator, int denominator)
        => denominator == 0 ? 0 : Math.Round((double)numerator / denominator, 4);

    private static double Percentile(IReadOnlyList<double> sorted, double percentile)
        => sorted.Count == 0 ? 0 : sorted[Math.Clamp((int)Math.Ceiling(percentile * sorted.Count) - 1, 0, sorted.Count - 1)];

    private sealed record EvalRow(string Id, string Language, string Kind, string[] ExpectedKeys, string? Top1Key,
        bool Top1Correct, bool Top3Correct, bool Fallback, bool WrongSource, bool AcceptableFallback, double AverageLatencyMs, double P95LatencyMs);

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
