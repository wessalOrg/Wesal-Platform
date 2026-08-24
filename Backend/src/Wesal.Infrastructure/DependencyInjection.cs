using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Constants;
using Wesal.Infrastructure.Auth;
using Wesal.Infrastructure.Bookings;
using Wesal.Infrastructure.CurrentUser;
using Wesal.Infrastructure.Halls;
using Wesal.Infrastructure.Homepage;
using Wesal.Infrastructure.Sessions;
using Wesal.Infrastructure.Ratings;
using Wesal.Infrastructure.Comments;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.AiAssistant;
using Wesal.Infrastructure.Languages;
using Wesal.Infrastructure.Localization;
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
        services.AddScoped<IHomepageIntroductionService, HomepageIntroductionService>();
        services.AddScoped<IFeaturedHallsService, FeaturedHallsService>();
        services.AddScoped<IHallDetailsService, HallDetailsService>();
        services.AddScoped<IAllHallsService, AllHallsService>();
        services.AddScoped<IHallSearchService, HallSearchService>();
        services.AddScoped<IBookingRequestService, BookingRequestService>();
        services.AddScoped<ISessionService, SessionService>();
        services.AddScoped<IRatingService, RatingService>();
        services.AddScoped<ICommentService, CommentService>();
        services.AddScoped<IConversationService, ConversationService>();
        services.AddScoped<ILanguageService, LanguageService>();
        services.AddScoped<ITranslationService, TranslationService>();
        services.AddSingleton<IChatSessionService, ChatSessionService>();
        services.AddSingleton<IHowToService, HowToService>();
        services.AddSingleton<IDateTime, DateTimeService>();

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.MapInboundClaims = false;
                options.Events = new JwtBearerEvents
                {
                    OnChallenge = context =>
                    {
                        if (context.Handled || context.Response.HasStarted)
                        {
                            return Task.CompletedTask;
                        }

                        context.HandleResponse();

                        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                        context.Response.ContentType = "application/problem+json";

                        var problemDetails = new ProblemDetails
                        {
                            Status = StatusCodes.Status401Unauthorized,
                            Title = "You are not authenticated",
                            Type = "https://httpstatuses.com/401",
                            Extensions =
                            {
                                ["code"] = "Unauthorized"
                            }
                        };

                        return context.Response.WriteAsJsonAsync(problemDetails);
                    }
                };
                options.TokenValidationParameters = JwtTokenValidationParametersFactory.Create(jwtSettings);
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
