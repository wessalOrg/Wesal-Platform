using System.Text.Json.Serialization;
using Asp.Versioning;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using Serilog;
using Wesal.API.Filters;
using Wesal.Application;
using Wesal.Infrastructure;
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

    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Database.Migrate();
    }

    app.UseSerilogRequestLogging();

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

    app.UseAuthentication();
    app.UseAuthorization();

    app.MapControllers();
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
