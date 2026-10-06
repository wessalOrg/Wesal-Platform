using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Asp.Versioning;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Serilog;
using Wesal.API;
using Wesal.API.Filters;
using Wesal.API.Swagger;
using Wesal.Application;
using Wesal.Infrastructure;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Halls;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Logging;
using Wesal.Infrastructure.Middleware;
using Wesal.Infrastructure.Notifications;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Persistence;
using Wesal.Persistence.Data;

const string CorsPolicyName = "WesalCorsPolicy";

Log.Logger = WesalSerilog.CreateLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    var port = Environment.GetEnvironmentVariable("PORT") ?? "5298";
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

    builder.Host.UseSerilog();

    var services = builder.Services;
    var configuration = builder.Configuration;

    services.AddApplication();
    services.AddInfrastructure(configuration);
    services.AddPersistence(configuration);

    services.AddControllers(options =>
        {
            options.Filters.Add<ValidateActionFilter>();
        })
        .AddJsonOptions(options =>
        {
            options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        });

    // Streamable HTTP MCP endpoint. The registered tools expose only the same
    // public hall information already available through the REST API.
    services.AddMcpServer()
        .WithHttpTransport()
        .WithToolsFromAssembly();

    services.AddApiVersioning(options =>
        {
            options.DefaultApiVersion = new ApiVersion(1, 0);
            options.AssumeDefaultVersionWhenUnspecified = true;
            options.ReportApiVersions = true;
        })
        .AddMvc();

    services.AddCors(options =>
    {
        options.AddPolicy(CorsPolicyName, policy =>
        {
            var allowedOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

            if (allowedOrigins.Length == 0)
            {
                throw new InvalidOperationException(
                    "CORS is not configured. Set the Cors:AllowedOrigins configuration section " +
                    "or provide the Cors__AllowedOrigins environment variable before starting the application.");
            }

            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
        });
    });

    services.AddSignalR();

    var rateLimitingOptions = new RateLimitingOptions();
    configuration.GetSection(RateLimitingOptions.SectionName).Bind(rateLimitingOptions);

    services.AddWesalRateLimiting(configuration);

    services.AddHealthChecks()
        .AddDbContextCheck<ApplicationDbContext>(name: "database");

    services.AddWesalSwagger();

    var app = builder.Build();

    if (args.Contains("--migrate", StringComparer.OrdinalIgnoreCase))
    {
        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Database.Migrate();
        }

        Log.Information("Database migrations applied successfully via the deployment release task.");
        return;
    }

    ValidateNonDevelopmentConfiguration(app.Environment, configuration);

    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        db.Database.Migrate();
        Log.Information("Database migrations applied on startup.");

        var provisioningOptions = configuration
            .GetSection(AdminProvisioningOptions.SectionName)
            .Get<AdminProvisioningOptions>();

        if (provisioningOptions is { Enabled: true, Admins.Count: > 0 })
        {
            var adminProvisioning = scope.ServiceProvider.GetRequiredService<AdminProvisioningService>();
            await adminProvisioning.RunAsync(provisioningOptions.Admins, CancellationToken.None);
        }
    }

    app.UseSerilogRequestLogging();

    app.UseForwardedHeaders(new ForwardedHeadersOptions
    {
        ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
    });

    app.UseMiddleware<GlobalExceptionHandlingMiddleware>();

    if (!app.Environment.IsDevelopment())
    {
        app.UseHsts();
    }

    app.UseHttpsRedirection();

    // The public document/UI stay available in Development, and in other
    // environments only when explicitly enabled (Swagger:Enabled=true).
    var swaggerEnabled = app.Environment.IsDevelopment()
        || configuration.GetValue<bool>("Swagger:Enabled");
    if (swaggerEnabled)
    {
        app.UseSwagger();
        app.UseSwaggerUI(options => options.SwaggerEndpoint("/swagger/v1/swagger.json", "Wesal API v1"));
    }

    app.UseDefaultFiles();
    app.UseStaticFiles();

    // Legacy local hall media (development): serve /uploads/... from the local
    // root. With the R2 provider, images are absolute public URLs loaded straight
    // from R2, so no local mount is created (wwwroot static files above are unaffected).
    var mediaStorage = app.Services.GetRequiredService<IHallMediaStorage>();
    var documentStorage = app.Services.GetRequiredService<Wesal.Application.Common.Interfaces.IDocumentStorage>();
    var identityDocumentStorage = Wesal.Infrastructure.Documents.IdentityDocumentStoreRegistration.DescribeIdentityDocumentStorage(configuration);
    if (mediaStorage.Info is { IsLocal: true, LocalRoot: string localRoot })
    {
        app.UseStaticFiles(new StaticFileOptions
        {
            RequestPath = "/uploads",
            FileProvider = new PhysicalFileProvider(localRoot)
        });
    }
    ValidateHallMediaConfiguration(app.Environment, configuration);
    WarnIfEphemeralUploadStorage(mediaStorage.Info, documentStorage.Root, identityDocumentStorage);
    // Names the active provider and its bucket (never credentials) so a deploy that is
    // still on ephemeral storage is visible in the logs.
    Log.Information(
        "Identity document storage: {Provider} (bucket {Bucket}); served only through authenticated endpoints.",
        identityDocumentStorage.Provider,
        identityDocumentStorage.Bucket ?? "n/a");

    app.UseCors(CorsPolicyName);

    if (rateLimitingOptions.Enabled)
    {
        app.UseRateLimiter();
    }

    app.UseAuthentication();
    app.UseAuthorization();

    app.MapControllers();
    app.MapMcp("/mcp");
    // Monitoring and realtime stay reachable even when the global limiter runs.
    app.MapHub<ConversationHub>("/hubs/conversation").DisableRateLimiting();
    app.MapHub<OwnerDashboardHub>("/hubs/owner-dashboard").DisableRateLimiting();
    app.MapHub<NotificationsHub>("/hubs/notifications").DisableRateLimiting();
    app.MapHealthChecks("/health").DisableRateLimiting();

    app.MapGet("/health/live", () => Results.Ok(new { status = "healthy" })).DisableRateLimiting();

    app.MapGet("/", () => Results.Ok(new { service = "Wesal API", status = "running", version = "v1" })).DisableRateLimiting();

    app.Run();
}
catch (Exception exception)
{
    Log.Fatal(exception, "Wesal API terminated unexpectedly.");
    Environment.ExitCode = 1;
}
finally
{
    Log.CloseAndFlush();
}

static void ValidateNonDevelopmentConfiguration(IWebHostEnvironment environment, IConfiguration configuration)
{
    if (environment.IsDevelopment())
    {
        return;
    }

    const string placeholderJwtSecret = "CHANGE_ME_in_production_use_a_strong_secret_of_at_least_32_characters";
    const string developmentConnectionString = "Host=localhost;Port=5432;Database=wesal;Username=postgres;Password=postgres";

    var jwtSecret = configuration["Jwt:SecretKey"] ?? string.Empty;
    if (string.IsNullOrWhiteSpace(jwtSecret) || string.Equals(jwtSecret, placeholderJwtSecret, StringComparison.Ordinal))
    {
        throw new InvalidOperationException(
            "Jwt:SecretKey must be overridden with a strong secret via the Jwt__SecretKey environment variable outside Development.");
    }

    var connectionString = configuration.GetConnectionString("DefaultConnection") ?? string.Empty;
    if (string.IsNullOrWhiteSpace(connectionString)
        || string.Equals(connectionString, developmentConnectionString, StringComparison.OrdinalIgnoreCase))
    {
        throw new InvalidOperationException(
            "ConnectionStrings:DefaultConnection must be overridden via the ConnectionStrings__DefaultConnection environment variable outside Development.");
    }

    var geminiModel = configuration["GoogleAI:GeminiModel"]?.Trim() ?? string.Empty;
    if (string.IsNullOrWhiteSpace(geminiModel) || !geminiModel.StartsWith("gemini-", StringComparison.OrdinalIgnoreCase))
    {
        // Gemini is optional: a missing/invalid model id must not crash the whole
        // service (the app falls back to its built-in default and to the
        // deterministic how-to/search classifiers). Log and continue.
        Log.Warning(
            "GoogleAI:GeminiModel is missing or invalid ('{Model}'); using the built-in default and deterministic fallbacks. Set GoogleAI__GeminiModel to a valid id such as gemini-2.5-flash.",
            geminiModel);
    }
}

/// <summary>
/// Production hardening: container-local temp storage is writable but NOT durable.
/// Warn explicitly at startup when uploads would not survive a redeploy so the
/// missing persistent-storage infrastructure cannot go unnoticed. Point
/// HallMedia:Directory / DocumentStorage:Directory at durable storage to silence.
/// </summary>
static bool IsEphemeralUploadRoot(string root)
{
    var temp = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar);
    var full = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar);
    return full.Equals(temp, StringComparison.OrdinalIgnoreCase)
        || full.StartsWith(temp + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
}

static void WarnIfEphemeralUploadStorage(
    Wesal.Infrastructure.Halls.HallMediaStorageInfo mediaInfo,
    string documentRoot,
    Wesal.Infrastructure.Documents.IdentityDocumentStorageInfo identityDocumentStorage)
{
    // R2-backed hall media is durable by construction: nothing to warn about.
    if (mediaInfo is { IsLocal: true, LocalRoot: string mediaRoot } && IsEphemeralUploadRoot(mediaRoot))
    {
        Log.Warning(
            "Hall media storage is ephemeral ({Root}); uploaded photos will NOT survive instance replacement/redeploy. Set HallMedia:Provider=R2 (HallMedia__Provider) with durable R2 settings for production.",
            mediaRoot);
    }

    if (IsEphemeralUploadRoot(documentRoot))
    {
        if (identityDocumentStorage.IsRemote)
        {
            Log.Warning(
                "Conversation attachment storage is ephemeral ({Root}); attachments will NOT survive instance replacement/redeploy. Identity documents are unaffected ({IdentityProvider}).",
                documentRoot,
                identityDocumentStorage.Provider);
        }
        else
        {
            Log.Warning(
                "Protected document storage is ephemeral ({Root}); identity documents and attachments will NOT survive instance replacement/redeploy. Set DocumentStorage:Provider=Supabase (DocumentStorage__Provider) with SupabaseStorage:Url / SupabaseStorage:SecretKey for durable identity documents.",
                documentRoot);
        }
    }
}

/// <summary>
/// Startup safety for durable hall media: when the R2 provider is selected, all
/// required settings are validated here so a misconfigured deployment fails
/// clearly at boot (naming settings, never secret values) instead of 500ing the
/// first upload. Local development needs no R2 configuration.
/// </summary>
static void ValidateHallMediaConfiguration(Microsoft.AspNetCore.Hosting.IWebHostEnvironment environment, IConfiguration configuration)
{
    var provider = configuration.GetSection("HallMedia")?.Get<Wesal.Infrastructure.Halls.HallMediaOptions>()?.Provider;
    if (!string.Equals(provider, Wesal.Infrastructure.Halls.HallMediaOptions.ProviderR2, StringComparison.OrdinalIgnoreCase))
    {
        if (!environment.IsDevelopment())
        {
            Log.Warning(
                "HallMedia:Provider is '{Provider}'; production hall uploads use ephemeral container-local storage and will NOT survive restarts. Set HallMedia__Provider=R2 for durable storage.",
                provider ?? "(unset)");
        }

        return;
    }

    var r2 = configuration.GetSection("HallMedia:R2").Get<Wesal.Infrastructure.Halls.HallMediaR2Options>();
    Wesal.Infrastructure.Halls.HallMediaR2Configuration.Validate(r2, environment.IsDevelopment());
}
