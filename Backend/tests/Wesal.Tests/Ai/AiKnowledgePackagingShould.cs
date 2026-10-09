using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using Wesal.Application.Ai;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Ai;

/// <summary>
/// Guards the historical production failure: the Knowledge Base was embedded from
/// Backend/documentation/ai-knowledge, but Backend/.dockerignore excluded
/// documentation/, so the Render image shipped with ZERO articles and every support /
/// FAQ / platform question fell through to generic help text.
/// </summary>
public class AiKnowledgePackagingShould
{
    private static readonly string BackendDir = Path.Combine(RepoPaths.Root(), "Backend");

    // ── Docker build-context rules (mirrors Docker's .dockerignore semantics) ──

    private static Regex ToRegex(string pattern)
    {
        pattern = pattern.Trim('/');
        var builder = new System.Text.StringBuilder("^");
        for (var i = 0; i < pattern.Length; i++)
        {
            var c = pattern[i];
            if (c == '*' && i + 1 < pattern.Length && pattern[i + 1] == '*')
            {
                i++;
                if (i + 1 < pattern.Length && pattern[i + 1] == '/')
                {
                    i++;
                    builder.Append("(.*/)?");
                }
                else
                {
                    builder.Append(".*");
                }
            }
            else if (c == '*')
            {
                builder.Append("[^/]*");
            }
            else if (c == '?')
            {
                builder.Append("[^/]");
            }
            else
            {
                builder.Append(Regex.Escape(c.ToString()));
            }
        }

        return new Regex(builder.Append('$').ToString(), RegexOptions.CultureInvariant);
    }

    private static bool IsIgnored(string path, IReadOnlyList<(bool Negate, Regex Pattern)> rules)
    {
        var parts = path.Split('/');
        var ignored = false;
        foreach (var (negate, pattern) in rules)
        {
            var matches = Enumerable.Range(1, parts.Length).Any(k => pattern.IsMatch(string.Join('/', parts.Take(k))));
            if (matches)
            {
                ignored = !negate;
            }
        }

        return ignored;
    }

    private static List<(bool, Regex)> LoadDockerIgnore()
    {
        var file = Path.Combine(BackendDir, ".dockerignore");
        Assert.True(File.Exists(file), ".dockerignore not found");
        return File.ReadAllLines(file)
            .Select(line => line.Trim())
            .Where(line => line.Length > 0 && !line.StartsWith('#'))
            .Select(line => line.StartsWith('!') ? (true, ToRegex(line[1..])) : (false, ToRegex(line)))
            .ToList();
    }

    [Fact]
    public void DockerBuildContext_IncludesEveryKnowledgeArticle()
    {
        var rules = LoadDockerIgnore();
        var kbRoot = Path.Combine(BackendDir, "documentation", "ai-knowledge");
        var files = Directory.EnumerateFiles(kbRoot, "*.md", SearchOption.AllDirectories).ToList();
        Assert.NotEmpty(files);

        foreach (var file in files)
        {
            var relative = Path.GetRelativePath(BackendDir, file).Replace('\\', '/');
            Assert.False(IsIgnored(relative, rules), $"{relative} is excluded from the Docker build context by Backend/.dockerignore");
        }
    }

    [Fact]
    public void DockerBuildContext_StillExcludesUnrelatedDocumentation()
    {
        var rules = LoadDockerIgnore();
        Assert.True(IsIgnored("documentation/mcp.md", rules));
        Assert.True(IsIgnored("src/Wesal.API/bin/Release/x.dll", rules));
    }

    [Fact]
    public void TheOriginalFailure_WouldBeCaught()
    {
        // The pre-fix rule set: a bare "documentation/" excludes the whole folder.
        var old = new List<(bool, Regex)> { (false, ToRegex("documentation/")) };
        Assert.True(IsIgnored("documentation/ai-knowledge/faq/faq.md", old));
    }

    [Fact]
    public void KnowledgeFiles_AreEmbeddedByTheInfrastructureProject()
    {
        var csproj = File.ReadAllText(Path.Combine(BackendDir, "src", "Wesal.Infrastructure", "Wesal.Infrastructure.csproj"));
        Assert.Contains(@"documentation\ai-knowledge\**\*.md", csproj);
    }

    // ── what actually loaded ──

    [Fact]
    public void EmbeddedKnowledgeBase_LoadsArticles()
    {
        var service = new WesalKnowledgeService();

        Assert.True(service.ArticleCount >= 20, $"expected the full KB, loaded {service.ArticleCount}");
        var sourceCount = Directory
            .EnumerateFiles(Path.Combine(BackendDir, "documentation", "ai-knowledge"), "*.md", SearchOption.AllDirectories)
            .Count();
        Assert.Equal(sourceCount, service.ArticleCount);
    }

    [Theory]
    [InlineData("ما هي ساعات الدعم؟", "ar", "Wesal support hours")]
    [InlineData("what are the support hours?", "en", "Wesal support hours")]
    [InlineData("كيف أتواصل مع الدعم؟", "ar", "contact")]
    [InlineData("شو هو وصال؟", "ar", "About Wesal")]
    [InlineData("what is wesal", "en", "About Wesal")]
    [InlineData("مين مطورين وصال", "ar", "Wesal team")]
    [InlineData("كيف أجدد اشتراك قاعتي", "ar", "Hall owner subscription")]
    [InlineData("what do booking statuses mean", "en", "Booking request statuses")]
    public async Task KnowledgeSearch_FindsTheRightArticle_InArabicAndEnglish(string question, string language, string titlePart)
    {
        var service = new WesalKnowledgeService();

        var results = await service.SearchAsync(question, language, 5);

        Assert.Contains(results, a => a.Title.Contains(titlePart, StringComparison.OrdinalIgnoreCase));
    }

    [Theory]
    [InlineData("ما هي ساعات الدعم؟", "ar", "9:00")]
    [InlineData("كيف أتواصل مع الدعم؟", "ar", "wesal.platform.gaza@gmail.com")]
    [InlineData("What are the support hours?", "en", "9:00")]
    [InlineData("What is Wesal?", "en", "approved wedding halls")]
    public async Task HowTo_WithGeminiDisabled_StillAnswersFromTheKnowledgeBase(string question, string language, string expected)
    {
        var how = new HowToService(
            new SubscriptionPaymentService(Options.Create(new SubscriptionPaymentOptions())),
            new AiLanguageDetector(),
            null,
            geminiService: null,
            knowledgeService: new WesalKnowledgeService());

        var answer = await how.AskHowToAsync(question, language);

        Assert.Contains(expected, answer.Answer);
    }

    [Fact]
    public async Task VerificationNotes_AreNeverShownToUsers()
    {
        var results = await new WesalKnowledgeService().SearchAsync("about wesal", "en", 5);

        Assert.All(results, a => Assert.DoesNotContain("Verification note", a.Content, StringComparison.OrdinalIgnoreCase));
    }
}
