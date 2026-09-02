using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Asp.Versioning;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using Serilog;
using Wesal.API;
using Wesal.API.Filters;
using Wesal.Application;
using Wesal.Infrastructure;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Logging;
using Wesal.Infrastructure.Middleware;
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

    if (rateLimitingOptions.Enabled)
    {
        services.AddRateLimiter(limiterOptions =>
        {
            limiterOptions.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            limiterOptions.AddPolicy(RateLimitingOptions.GlobalPolicyName, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = rateLimitingOptions.PermitLimit,
                        Window = TimeSpan.FromSeconds(rateLimitingOptions.WindowSeconds),
                        QueueLimit = 0,
                        AutoReplenishment = true
                    }));
        });
    }

    services.AddHealthChecks()
        .AddDbContextCheck<ApplicationDbContext>(name: "database");

    services.AddSwaggerGen(options =>
    {
        options.SwaggerDoc("v1", new OpenApiInfo
        {
            Title = "Wesal API",
            Version = "v1",
            Description = "REST API for the Wesal wedding hall booking platform (وصال)."
        });

        options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Name = "Authorization",
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            In = ParameterLocation.Header,
            Description = "Enter your JWT token. Example: your-access-token"
        });

        options.AddSecurityRequirement(new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecurityScheme
                {
                    Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
                },
                Array.Empty<string>()
            }
        });
    });

    var app = builder.Build();

    ValidateNonDevelopmentConfiguration(app.Environment, configuration);

    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        if (app.Environment.IsDevelopment())
        {
            db.Database.Migrate();
        }
        else
        {
            Log.Information("Skipping startup migration - apply migrations via the deployment pipeline.");
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

    app.UseSwagger();
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/swagger/v1/swagger.json", "Wesal API v1"));

    app.UseDefaultFiles();
    app.UseStaticFiles();

    app.UseCors(CorsPolicyName);

    if (rateLimitingOptions.Enabled)
    {
        app.UseRateLimiter();
    }

    app.UseAuthentication();
    app.UseAuthorization();

    app.MapControllers();
    app.MapHub<ConversationHub>("/hubs/conversation");
    app.MapHealthChecks("/health");

    app.MapGet("/", () => Results.Ok(new { service = "Wesal API", status = "running", version = "v1" }));

    app.Run();
}
catch (Exception exception)
{
    Log.Fatal(exception, "Wesal API terminated unexpectedly.");
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

    var resetPageUrl = configuration["PasswordReset:ResetPageUrl"] ?? string.Empty;
    if (resetPageUrl.Contains("localhost", StringComparison.OrdinalIgnoreCase))
    {
        throw new InvalidOperationException(
            "PasswordReset:ResetPageUrl must point to the deployed frontend reset page outside Development.");
    }

    var geminiModel = configuration["GoogleAI:GeminiModel"] ?? string.Empty;
    if (string.IsNullOrWhiteSpace(geminiModel) || !geminiModel.StartsWith("gemini-", StringComparison.Ordinal))
    {
        throw new InvalidOperationException(
            "GoogleAI:GeminiModel must be a valid Gemini model id (e.g. gemini-2.5-flash) or be left unset outside Development.");
    }
}
