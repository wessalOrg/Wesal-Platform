using Microsoft.OpenApi.Models;

namespace Wesal.API.Swagger;

/// <summary>
/// The API's OpenAPI document configuration.
/// <para>
/// It lives here, rather than inline in <c>Program</c>, so the regression test that guards the
/// published document builds the document through the exact same setup the application uses.
/// A test with its own copy of the configuration could pass while production still served a
/// broken document, which is exactly the failure this guards against.
/// </para>
/// <para>
/// Note for anyone adding an upload endpoint: do not put <c>[FromForm]</c> on an
/// <see cref="Microsoft.AspNetCore.Http.IFormFile"/> parameter. ASP.NET Core already infers the
/// form-file binding source from the type, and the explicit attribute replaces it with a plain
/// form source, which makes ApiExplorer unreadable for Swashbuckle. Generation of the entire
/// document then fails, so <c>/swagger/v1/swagger.json</c> answers 500 and hides every endpoint,
/// not just the upload one. The accompanying <c>[FromForm]</c> text fields are correct and
/// should stay.
/// </para>
/// </summary>
public static class SwaggerConfiguration
{
    public const string DocumentName = "v1";

    public static IServiceCollection AddWesalSwagger(this IServiceCollection services)
    {
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc(DocumentName, new OpenApiInfo
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

        return services;
    }
}
