using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace Wesal.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        var assembly = ApplicationAssembly.Value;

        services.AddAutoMapper(config => config.AddMaps(assembly));
        services.AddValidatorsFromAssembly(assembly);

        return services;
    }
}
