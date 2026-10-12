using System.Data.Common;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Wesal.Application;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Infrastructure;
using Wesal.Infrastructure.AiAssistant;
using Wesal.Persistence;
using Wesal.Persistence.Data;
using Xunit.Abstractions;

namespace Wesal.Tests.Ai;

/// <summary>
/// Real-PostgreSQL integration gates for the Studio + learning loop. Every test
/// requires the WESAL_TEST_PG environment variable (full Npgsql connection
/// string to an isolated local server); without it the test reports and passes
/// vacuously so CI without PostgreSQL stays green.
/// </summary>
public sealed class MabroukStudioPgShould
{
    private readonly ITestOutputHelper _output;

    public MabroukStudioPgShould(ITestOutputHelper output) => _output = output;

    private static string? ServerConnectionString()
        => Environment.GetEnvironmentVariable("WESAL_TEST_PG");

    private static string WithDatabase(string serverConnectionString, string database)
    {
        var builder = new DbConnectionStringBuilder { ConnectionString = serverConnectionString };
        builder["Database"] = database;
        return builder.ConnectionString;
    }

    private async Task<string?> CreateDatabaseAsync(string serverConnectionString, string name)
    {
        await using var connection = new Npgsql.NpgsqlConnection(WithDatabase(serverConnectionString, "postgres"));
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = $"CREATE DATABASE \"{name}\"";
        await command.ExecuteNonQueryAsync();
        return WithDatabase(serverConnectionString, name);
    }

    private static ServiceProvider BuildProvider(string connectionString)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = connectionString
            })
            .Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSignalR();
        services.AddApplication();
        services.AddInfrastructure(configuration);
        services.AddPersistence(configuration);
        return services.BuildServiceProvider();
    }

    private static async Task MigrateLatestAsync(ApplicationDbContext db)
        => await db.Database.MigrateAsync();

    private static AiKnowledgeArticleInput Article(
        string key,
        string title,
        string alias,
        string answerAr,
        string answerEn,
        string? overridesBuiltInKey = null,
        DateOnly? effectiveUntil = null,
        AiKnowledgeVerificationStatus verificationStatus = AiKnowledgeVerificationStatus.Verified,
        IReadOnlyList<AiKnowledgeAliasInput>? aliases = null)
        => new(
            key, title, "support", answerAr, answerEn, "Local test source", 50,
            verificationStatus, null, effectiveUntil, null, overridesBuiltInKey,
            aliases ?? [new AiKnowledgeAliasInput("ar", alias)], "Local test change note.");

    [Fact]
    public async Task CleanDatabaseAppliesFullMigrationChain()
    {
        var server = ServerConnectionString();
        if (server is null) { _output.WriteLine("WESAL_TEST_PG not set; skipped."); return; }

        var dbName = "wsltest_chain_" + Guid.NewGuid().ToString("N")[..12];
        var connectionString = await CreateDatabaseAsync(server, dbName);
        try
        {
            await using var provider = BuildProvider(connectionString!);
            using var scope = provider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await MigrateLatestAsync(db);

            var applied = db.Database.GetAppliedMigrations().ToList();
            Assert.Contains("20261009145828_AddMabroukKnowledgeStudio", applied);
            Assert.Contains("20261009150000_AddAiConversationState", applied);

            var studio = scope.ServiceProvider.GetRequiredService<IAiKnowledgeStudioService>();
            Assert.Empty(await studio.ListKnowledgeAsync(new AiKnowledgeListQuery(Source: "dynamic")));
            Assert.True((await studio.ListKnowledgeAsync(new AiKnowledgeListQuery(Source: "builtin"))).Count >= 26);

            var sessions = scope.ServiceProvider.GetRequiredService<IChatSessionService>();
            var session = await sessions.InitializeSessionAsync("ar");
            Assert.NotEqual(Guid.Empty, session.SessionId);
            _output.WriteLine($"Migrations applied: {applied.Count}; Studio tables + sessions live on real PG.");
        }
        finally
        {
            await DropDatabaseDirectAsync(server, dbName);
        }
    }

    [Fact]
    public async Task ProductionV3UpgradePreservesLegacySessionRows()
    {
        var server = ServerConnectionString();
        if (server is null) { _output.WriteLine("WESAL_TEST_PG not set; skipped."); return; }

        var dbName = "wsltest_upgrade_" + Guid.NewGuid().ToString("N")[..12];
        var connectionString = await CreateDatabaseAsync(server, dbName);
        try
        {
            await using var provider = BuildProvider(connectionString!);
            using var scope = provider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            // Production V3 state ends at AddAiConversationState (Studio not yet applied).
            await db.GetService<IMigrator>().MigrateAsync("20261009150000_AddAiConversationState");

            // A legacy row written before the Studio migration (no new columns).
            var legacyId = Guid.NewGuid();
            await db.Database.ExecuteSqlRawAsync(
                "INSERT INTO wesal.\"AiConversationSessions\" (\"SessionId\", \"Language\", \"CreatedAt\", \"LastActivityAt\", \"ExpiresAt\", \"Revision\", \"TurnsJson\", \"LastHallsJson\") " +
                $"VALUES ('{legacyId}', 'ar', now(), now(), now() + interval '30 minutes', 0, '[]', '[]')");

            await MigrateLatestAsync(db);

            var sessions = scope.ServiceProvider.GetRequiredService<IChatSessionService>();
            var context = await sessions.GetConversationContextAsync(legacyId);
            Assert.Empty(context.Turns);
            Assert.Null(context.State);

            var studio = scope.ServiceProvider.GetRequiredService<IAiKnowledgeStudioService>();
            var overview = await studio.GetOverviewAsync();
            Assert.True(overview.BuiltInArticles >= 26);
            _output.WriteLine($"Legacy session {legacyId} survived the Studio upgrade with null state.");
        }
        finally
        {
            await DropDatabaseDirectAsync(server, dbName);
        }
    }

    [Fact]
    public async Task DynamicLifecycleIsImmediateAndAudited()
    {
        var server = ServerConnectionString();
        if (server is null) { _output.WriteLine("WESAL_TEST_PG not set; skipped."); return; }

        var dbName = "wsltest_life_" + Guid.NewGuid().ToString("N")[..12];
        var connectionString = await CreateDatabaseAsync(server, dbName);
        try
        {
            await using var provider = BuildProvider(connectionString!);
            using var scope = provider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await MigrateLatestAsync(db);
            var studio = scope.ServiceProvider.GetRequiredService<IAiKnowledgeStudioService>();
            var knowledge = scope.ServiceProvider.GetRequiredService<IWesalKnowledgeService>();
            const string probe = "أين أجد جدول مواعيد القمر المحلي؟";

            Assert.DoesNotContain(await knowledge.SearchAsync(probe, "ar", 5), article => article.Title == "جدول مواعيد القمر");

            var draft = await studio.CreateKnowledgeAsync(
                Article("moon-timetable", "جدول مواعيد القمر", probe, "تجد الجدول في صفحة الخدمة.", "See the service page."), "admin-1");
            Assert.DoesNotContain(await knowledge.SearchAsync(probe, "ar", 5), article => article.Title == "جدول مواعيد القمر");

            await studio.PublishKnowledgeAsync(draft.Id, "Publish moon timetable.", "admin-1");
            Assert.Equal("تجد الجدول في صفحة الخدمة.",
                Assert.Single(await knowledge.SearchAsync(probe, "ar", 5), article => article.Title == "جدول مواعيد القمر").Content);

            await studio.UpdateKnowledgeAsync(draft.Id, Article("moon-timetable", "جدول مواعيد القمر", probe,
                "الجدول المحدّث في صفحة الخدمة.", "Updated on the service page."), "admin-1");
            Assert.Equal("تجد الجدول في صفحة الخدمة.",
                Assert.Single(await knowledge.SearchAsync(probe, "ar", 5), article => article.Title == "جدول مواعيد القمر").Content);

            await studio.PublishKnowledgeAsync(draft.Id, "Republish moon timetable.", "admin-1");
            Assert.Equal("الجدول المحدّث في صفحة الخدمة.",
                Assert.Single(await knowledge.SearchAsync(probe, "ar", 5), article => article.Title == "جدول مواعيد القمر").Content);

            await studio.ArchiveKnowledgeAsync(draft.Id, "Archive moon timetable.", "admin-1");
            Assert.DoesNotContain(await knowledge.SearchAsync(probe, "ar", 5), article => article.Title == "جدول مواعيد القمر");

            var revisions = await studio.GetRevisionsAsync(draft.Id);
            Assert.Contains(revisions, revision => revision.Action == "Published");
            Assert.Contains(revisions, revision => revision.Action == "Archived");

            var marked = await studio.PublishKnowledgeAsync(draft.Id, "Republish after archive.", "admin-1");
            Assert.NotNull(marked);
            var reviewed = await studio.MarkReviewedAsync(draft.Id, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(30), "Reviewed moon timetable.", "admin-1");
            Assert.NotNull(reviewed!.ReviewAt);
        }
        finally
        {
            await DropDatabaseDirectAsync(server, dbName);
        }
    }

    [Fact]
    public async Task PublishedDynamicKnowledgeSurvivesProviderRestart()
    {
        var server = ServerConnectionString();
        if (server is null) { _output.WriteLine("WESAL_TEST_PG not set; skipped."); return; }

        var dbName = "wsltest_restart_" + Guid.NewGuid().ToString("N")[..12];
        var connectionString = (await CreateDatabaseAsync(server, dbName))!;
        const string probe = "ما هو لون التلسكوب المحلي؟";

        await using (var provider = BuildProvider(connectionString))
        {
            using var scope = provider.CreateScope();
            await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.MigrateAsync();
            var studio = scope.ServiceProvider.GetRequiredService<IAiKnowledgeStudioService>();
            var draft = await studio.CreateKnowledgeAsync(
                Article("telescope-colour", "لون التلسكوب", probe, "التلسكوب أزرق.", "The telescope is blue."), "admin-1");
            await studio.PublishKnowledgeAsync(draft.Id, "Publish telescope colour.", "admin-1");
        }

        await using (var restarted = BuildProvider(connectionString))
        {
            using var scope = restarted.CreateScope();
            var knowledge = scope.ServiceProvider.GetRequiredService<IWesalKnowledgeService>();
            Assert.Equal("التلسكوب أزرق.",
                Assert.Single(await knowledge.SearchAsync(probe, "ar", 5), article => article.Title == "لون التلسكوب").Content);
        }

        await DropDatabaseDirectAsync(server, dbName);
    }

    [Fact]
    public async Task BuiltInOverrideFallsBackAfterArchiveAndLeavesMarkdownUntouched()
    {
        var server = ServerConnectionString();
        if (server is null) { _output.WriteLine("WESAL_TEST_PG not set; skipped."); return; }

        var mdPath = Path.Combine(RepoPaths.Root(), "Backend", "documentation", "ai-knowledge", "platform", "team.md");
        var beforeHash = Convert.ToHexString(SHA256.HashData(await File.ReadAllBytesAsync(mdPath)));

        var dbName = "wsltest_override_" + Guid.NewGuid().ToString("N")[..12];
        var connectionString = await CreateDatabaseAsync(server, dbName);
        try
        {
            await using var provider = BuildProvider(connectionString!);
            using var scope = provider.CreateScope();
            await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.MigrateAsync();
            var studio = scope.ServiceProvider.GetRequiredService<IAiKnowledgeStudioService>();
            var knowledge = scope.ServiceProvider.GetRequiredService<IWesalKnowledgeService>();
            const string question = "Who developed Wesal?";

            var builtIn = Assert.Single(await knowledge.SearchAsync(question, "en", 3), article => !article.IsDynamic);
            var created = await studio.CreateOverrideAsync(builtIn.StableKey!, "admin-1");
            Assert.DoesNotContain(await knowledge.SearchAsync(question, "en", 3), article => article.IsDynamic);

            await studio.UpdateKnowledgeAsync(created.Id, Article(created.Key, created.Title, question,
                "فريق مؤقت.", "Temporary override wording.", overridesBuiltInKey: builtIn.StableKey,
                aliases: created.Aliases.Select(alias => new AiKnowledgeAliasInput(alias.Language, alias.Text)).ToList()), "admin-1");
            await studio.PublishKnowledgeAsync(created.Id, "Publish temporary override.", "admin-1");
            var overridden = Assert.Single(await knowledge.SearchAsync(question, "en", 3));
            Assert.True(overridden.IsDynamic);

            await studio.ArchiveKnowledgeAsync(created.Id, "Restore built-in.", "admin-1");
            var restored = Assert.Single(await knowledge.SearchAsync(question, "en", 3));
            Assert.False(restored.IsDynamic);
            Assert.Equal(builtIn.StableKey, restored.StableKey);

            var afterHash = Convert.ToHexString(SHA256.HashData(await File.ReadAllBytesAsync(mdPath)));
            Assert.Equal(beforeHash, afterHash);
        }
        finally
        {
            await DropDatabaseDirectAsync(server, dbName);
        }
    }

    [Fact]
    public async Task LearningLoopCapturesResolvesAndDoesNotRepeat()
    {
        var server = ServerConnectionString();
        if (server is null) { _output.WriteLine("WESAL_TEST_PG not set; skipped."); return; }

        var dbName = "wsltest_loop_" + Guid.NewGuid().ToString("N")[..12];
        var connectionString = (await CreateDatabaseAsync(server, dbName))!;
        const string unknown = "هل وصال عنده خطة مؤكدة لافتتاح مكتب فعلي في رفح؟";

        await using var provider = BuildProvider(connectionString);
        using var scope = provider.CreateScope();
        await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.MigrateAsync();
        var assistant = scope.ServiceProvider.GetRequiredService<IAiAssistantService>();
        var studio = scope.ServiceProvider.GetRequiredService<IAiKnowledgeStudioService>();

        var first = await assistant.ProcessMessageAsync(unknown, "ar");
        Assert.Equal(AiAssistantResponseKind.Answer, first.Kind);
        Assert.Equal(AiIntentType.HowTo, first.Intent?.Intent);
        var gaps = await studio.ListGapsAsync();
        var cluster = Assert.Single(gaps);
        Assert.Equal(1, cluster.OccurrenceCount);

        _ = await assistant.ProcessMessageAsync(unknown, "ar");
        Assert.Equal(2, (await studio.GetGapAsync(cluster.Id))!.OccurrenceCount);

        // Exclusions record nothing.
        _ = await assistant.ProcessMessageAsync("بدي صالة ل5000 شخص", "ar");
        _ = await assistant.ProcessMessageAsync("بكم ومتى متوفرة", "ar");
        _ = await assistant.ProcessMessageAsync("عندكم مصورين؟", "ar");
        _ = await assistant.ProcessMessageAsync("وديني عالقاعات", "ar");
        Assert.Single(await studio.ListGapsAsync());

        var draft = await studio.CreateArticleFromGapAsync(cluster.Id, "admin-1");
        Assert.NotNull(draft);
        await studio.UpdateKnowledgeAsync(draft.Id, Article(draft.Key, "مكتب رفح",
            unknown, "نعم، لدينا مكتب فعلي في رفح.", "Yes, we have a physical office in Rafah."), "admin-1");
        await studio.PublishKnowledgeAsync(draft.Id, "Publish Rafah office answer.", "admin-1");
        Assert.Equal("Resolved", (await studio.GetGapAsync(cluster.Id))!.Status);

        var second = await assistant.ProcessMessageAsync(unknown, "ar");
        Assert.Contains("مكتب فعلي في رفح", second.Message, StringComparison.Ordinal);
        Assert.Empty(await studio.ListGapsAsync());

        await DropDatabaseDirectAsync(server, dbName);
    }

    [Fact]
    public async Task GapRecorderDatabaseFailureKeepsAssistantAlive()
    {
        var server = ServerConnectionString();
        if (server is null) { _output.WriteLine("WESAL_TEST_PG not set; skipped."); return; }

        var dbName = "wsltest_gapfail_" + Guid.NewGuid().ToString("N")[..12];
        var connectionString = (await CreateDatabaseAsync(server, dbName))!;
        await using var provider = BuildProvider(connectionString);
        using var scope = provider.CreateScope();
        await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.MigrateAsync();
        var assistant = scope.ServiceProvider.GetRequiredService<IAiAssistantService>();

        // Kill the database under the live scope: every persistence call now throws.
        await DropDatabaseDirectAsync(server, dbName);

        var response = await assistant.ProcessMessageAsync("هل يوجد خصم لمجموعات الضيوف الكبيرة؟", "ar");
        Assert.Equal(AiAssistantResponseKind.Answer, response.Kind);
        Assert.False(string.IsNullOrWhiteSpace(response.Message));
    }

    [Fact]
    public async Task DynamicStoreFailureKeepsBuiltInKnowledge()
    {
        var server = ServerConnectionString();
        if (server is null) { _output.WriteLine("WESAL_TEST_PG not set; skipped."); return; }

        var dbName = "wsltest_dynfail_" + Guid.NewGuid().ToString("N")[..12];
        var connectionString = (await CreateDatabaseAsync(server, dbName))!;
        await using var provider = BuildProvider(connectionString);
        using var scope = provider.CreateScope();
        await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.MigrateAsync();
        var knowledge = scope.ServiceProvider.GetRequiredService<IWesalKnowledgeService>();

        await DropDatabaseDirectAsync(server, dbName);

        var articles = await knowledge.SearchAsync("شو هي وصال؟", "ar", 3);
        Assert.Contains(articles, article => article.Title == "About Wesal");
    }

    [Fact]
    public async Task AliasChurnWithLanguageSwitchSucceeds()
    {
        var server = ServerConnectionString();
        if (server is null) { _output.WriteLine("WESAL_TEST_PG not set; skipped."); return; }

        var dbName = "wsltest_alias_" + Guid.NewGuid().ToString("N")[..12];
        var connectionString = await CreateDatabaseAsync(server, dbName);
        try
        {
            await using var provider = BuildProvider(connectionString!);
            using var scope = provider.CreateScope();
            await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.MigrateAsync();
            var studio = scope.ServiceProvider.GetRequiredService<IAiKnowledgeStudioService>();

            var created = await studio.CreateKnowledgeAsync(new AiKnowledgeArticleInput(
                "alias-churn", "Alias churn", "support", "جواب.", "Answer.", "Local test source", 10,
                AiKnowledgeVerificationStatus.Verified, null, null, null, null,
                [
                    new AiKnowledgeAliasInput("en", "Who developed Wesal?"),
                    new AiKnowledgeAliasInput("ar", "سؤال عربي أول"),
                    new AiKnowledgeAliasInput("ar", "سؤال عربي ثان")
                ], "Local test change note."), "admin-1");

            var updated = await studio.UpdateKnowledgeAsync(created.Id, new AiKnowledgeArticleInput(
                "alias-churn", "Alias churn", "support", "جواب محدث.", "Updated answer.", "Local test source", 10,
                AiKnowledgeVerificationStatus.Verified, null, null, null, null,
                [new AiKnowledgeAliasInput("ar", "Who developed Wesal?")], "Local test change note."), "admin-1");
            Assert.NotNull(updated);
            Assert.Single(updated.Aliases);
            Assert.Equal("ar", updated.Aliases[0].Language);
        }
        finally
        {
            await DropDatabaseDirectAsync(server, dbName);
        }
    }

    private static async Task DropDatabaseDirectAsync(string serverConnectionString, string name)
    {
        try
        {
            await using var connection = new Npgsql.NpgsqlConnection(WithDatabase(serverConnectionString, "postgres"));
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = $"DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)";
            await command.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Could not drop test database {name}.", ex);
        }
    }
}
