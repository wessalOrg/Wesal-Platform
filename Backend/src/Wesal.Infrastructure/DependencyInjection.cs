using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Constants;
using Wesal.Infrastructure.Auth;
using Wesal.Infrastructure.CurrentUser;
using Wesal.Infrastructure.Halls;
using Wesal.Infrastructure.Homepage;
using Wesal.Infrastructure.Comments;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Ratings;
using Wesal.Infrastructure.Sessions;
using Wesal.Infrastructure.Time;

namespace Wesal.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var jwtSettings = configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>() ?? new JwtSettings();

        services.AddOptions<JwtSettings>()
            .Bind(configuration.GetSection(JwtSettings.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddHttpContextAccessor();

        services.AddOptions<HomepageIntroductionOptions>()
            .Bind(configuration.GetSection(HomepageIntroductionOptions.SectionName));

        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<ISessionService, SessionService>();
        services.AddScoped<IHomepageIntroductionService, HomepageIntroductionService>();
        services.AddScoped<IFeaturedHallsService, FeaturedHallsService>();
        services.AddScoped<IRatingService, RatingService>();
        services.AddScoped<ICommentService, CommentService>();
        services.AddScoped<IConversationService, ConversationService>();
        services.AddSingleton<IDateTime, DateTimeService>();

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwtSettings.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwtSettings.Audience,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SecretKey)),
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromMinutes(jwtSettings.ClockSkewMinutes),
                    NameClaimType = ApplicationClaimTypes.UserName,
                    RoleClaimType = ApplicationClaimTypes.Role
                };
            });

        services.AddAuthorization(options =>
        {
            options.AddPolicy(ApplicationPolicies.RequireAdmin, policy =>
                policy.RequireRole(ApplicationRoles.Admin));

            options.AddPolicy(ApplicationPolicies.RequireHallOwner, policy =>
                policy.RequireRole(ApplicationRoles.HallOwner));

            options.AddPolicy(ApplicationPolicies.RequireRegisteredUser, policy =>
                policy.RequireRole(ApplicationRoles.RegisteredUser, ApplicationRoles.HallOwner, ApplicationRoles.Admin));

            options.AddPolicy(ApplicationPolicies.RequireAuthenticatedUser, policy =>
                policy.RequireAuthenticatedUser());
        });

        return services;
    }
}
