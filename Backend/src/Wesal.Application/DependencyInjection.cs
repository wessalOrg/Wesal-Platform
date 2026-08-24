using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Ai;

namespace Wesal.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        var assembly = ApplicationAssembly.Value;

        services.AddAutoMapper(config => config.AddMaps(assembly));
        services.AddValidatorsFromAssembly(assembly);

        services.AddScoped<IAiResponseValidator, AiResponseValidator>();
        services.AddScoped<IAiFallbackProvider, AiFallbackProvider>();

        return services;
    }
}
