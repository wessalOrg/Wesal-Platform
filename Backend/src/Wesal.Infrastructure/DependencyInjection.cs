using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
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
using Wesal.Infrastructure.Admin;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Infrastructure.Notifications;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Profile;
using Wesal.Infrastructure.Search;
using Wesal.Infrastructure.Time;
using Wesal.Infrastructure.Email;
using Wesal.Infrastructure.Warnings;
using Wesal.Infrastructure.Documents;

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
        services.AddSingleton(TimeProvider.System);

        services.AddOptions<HomepageIntroductionOptions>()
            .Bind(configuration.GetSection(HomepageIntroductionOptions.SectionName));

        services.AddOptions<SubscriptionPaymentOptions>()
            .Bind(configuration.GetSection(SubscriptionPaymentOptions.SectionName));

        services.AddOptions<GoogleAiSettings>()
            .Bind(configuration.GetSection(GoogleAiSettings.SectionName));

        services.AddOptions<AdminProvisioningOptions>()
            .Bind(configuration.GetSection(AdminProvisioningOptions.SectionName));

        services.AddScoped<AdminProvisioningService>();

        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<IHomepageIntroductionService, HomepageIntroductionService>();
        services.AddScoped<IFeaturedHallsService, FeaturedHallsService>();
        services.AddScoped<IHallDetailsService, HallDetailsService>();
        services.AddScoped<IAllHallsService, AllHallsService>();
        services.AddScoped<IHallSearchService, HallSearchService>();
        services.AddScoped<IHourlySlotService, HourlySlotService>();
        services.AddScoped<IBookingRejectionService, BookingRejectionService>();
        services.AddScoped<IBookingCancellationService, BookingCancellationService>();
        services.AddScoped<IBookingAcceptanceService, BookingAcceptanceService>();
    services.AddScoped<IBookingPaymentConfirmationService, BookingPaymentConfirmationService>();
        services.AddScoped<IBookingDeletionService, BookingDeletionService>();
        services.AddScoped<IOwnerBookingRequestNotifier, OwnerBookingRequestNotifier>();
        services.AddScoped<ISessionService, SessionService>();
        services.AddScoped<IRatingService, RatingService>();
        services.AddScoped<ICommentService, CommentService>();
        services.AddScoped<IConversationService, ConversationService>();
        services.AddScoped<IConversationNotifier, ConversationNotifier>();

        // WESAL-TASK-10 (Edit 10 follow-up): the SignalR hub's access rules. Registered here so
        // the hub cannot be constructed without them.
        services.AddScoped<ConversationThreadGuard>();
        services.AddSingleton<Wesal.Infrastructure.Conversations.IConversationPresenceTracker, Wesal.Infrastructure.Conversations.ConversationPresenceTracker>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<INotificationNotifier, NotificationNotifier>();
        services.AddScoped<INotificationDispatcher, NotificationDispatcher>();
        services.AddScoped<ILoginService, LoginService>();
        services.AddScoped<ILogoutService, LogoutService>();
        services.AddScoped<IProfileService, ProfileService>();
        services.AddScoped<IProfessionalProfileService, ProfessionalProfileService>();
        services.AddScoped<IOwnerIdentityService, OwnerIdentityService>();
        services.AddScoped<Wesal.Application.Common.Interfaces.ICoordinatorSetupService, Wesal.Infrastructure.Coordinators.CoordinatorSetupService>();
        services.AddScoped<Wesal.Application.Common.Interfaces.ICoordinatorAdminService, Wesal.Infrastructure.Coordinators.CoordinatorAdminService>();
        services.AddScoped<Wesal.Application.Common.Interfaces.IPhotographerSetupService, Wesal.Infrastructure.Photographers.PhotographerSetupService>();
        services.AddScoped<Wesal.Application.Common.Interfaces.IPhotographerAdminService, Wesal.Infrastructure.Photographers.PhotographerAdminService>();
        services.AddScoped<Wesal.Application.Common.Interfaces.IAccountApprovalGuard, Wesal.Infrastructure.Authorization.AccountApprovalGuard>();
        services.AddScoped<IAuthorizationHandler, Wesal.Infrastructure.Authorization.ApprovedAccountAuthorizationHandler>();
        services.AddScoped<IOwnerSidebarService, OwnerSidebarService>();
        services.AddScoped<IHallCreationService, HallCreationService>();
        services.AddOptions<HallMediaOptions>().Bind(configuration.GetSection(HallMediaOptions.SectionName));
        services.AddOptions<HallMediaR2Options>().Bind(configuration.GetSection($"{HallMediaOptions.SectionName}:R2"));
        services.AddHallMediaStorage(configuration);
services.AddOptions<DocumentStorageOptions>().Bind(configuration.GetSection(DocumentStorageOptions.SectionName));
services.AddSingleton<IDocumentStorage, DocumentStorage>();
        services.AddIdentityDocumentStore(configuration);
        services.AddMessageAttachmentStore(configuration);
        services.AddHostedService<ConversationAttachmentBackfillService>();
        services.AddScoped<IHallInitiationService, HallInitiationService>();
        services.AddScoped<IHallStatusTrackingService, HallStatusTrackingService>();
        services.AddScoped<IOwnerHallService, OwnerHallService>();
        services.AddScoped<IOwnerHourlyAvailabilityService, OwnerHourlyAvailabilityService>();
        services.AddScoped<IHallSubscriptionService, HallSubscriptionService>();
        services.AddScoped<IAdminHallService, AdminHallService>();
        services.AddScoped<IAdminHallReviewService, AdminHallReviewService>();
        // WESAL Tasks 5/6: the shared mechanics of an Administrator decision on a
        // coordinator or photographer account request (transition guard, thread
        // resolution, durable notification, post-commit dispatch).
        services.AddScoped<AccountRequestReviewActions>();
        services.AddScoped<IAdminSubscriptionService, AdminSubscriptionService>();
        services.AddScoped<ISubscriptionExpiryLockService, SubscriptionExpiryLockService>();
        services.Configure<SubscriptionExpiryLockOptions>(configuration.GetSection(SubscriptionExpiryLockOptions.SectionName));
        services.AddHostedService<SubscriptionExpiryLockBackgroundService>();
        services.AddScoped<IEmailService, EmailService>();
        services.Configure<EmailOptions>(configuration.GetSection(EmailOptions.SectionName));
        services.Configure<PasswordResetOptions>(configuration.GetSection(PasswordResetOptions.SectionName));
        services.AddScoped<ISubscriptionExpiryWarningService, SubscriptionExpiryWarningService>();
        services.Configure<SubscriptionExpiryWarningOptions>(configuration.GetSection(SubscriptionExpiryWarningOptions.SectionName));
        services.AddHostedService<SubscriptionExpiryWarningBackgroundService>();
        services.AddSingleton<IHallSearchIndexer, HallSearchIndexer>();
        services.AddScoped<IOwnerBookingRequestsService, OwnerBookingRequestsService>();
        services.AddScoped<ILanguageService, LanguageService>();
        services.AddScoped<IChatSessionService, ChatSessionService>();
        services.AddSingleton<WesalKnowledgeService>();
        services.AddSingleton<IEmbeddedWesalKnowledgeSource>(sp => sp.GetRequiredService<WesalKnowledgeService>());
        services.AddSingleton<IWesalKnowledgeStats>(sp => sp.GetRequiredService<WesalKnowledgeService>());
        services.AddScoped<IWesalKnowledgeService, HybridWesalKnowledgeService>();
        services.AddScoped<IAiKnowledgeGapRecorder, AiKnowledgeGapRecorder>();
        services.AddSingleton<IAiKnowledgeGapDetector, AiKnowledgeGapDetector>();
        services.AddScoped<IAiKnowledgeStudioService, MabroukKnowledgeStudioService>();
        services.AddHostedService<AiKnowledgeStartupCheck>();
        services.AddScoped<IHowToService, HowToService>();
        services.AddScoped<IRecommendationService, RecommendationService>();
        services.AddSingleton<ISubscriptionPaymentService, SubscriptionPaymentService>();
        services.AddScoped<IHallRecommendationMatcher, HallRecommendationMatcher>();
        services.AddSingleton<IDateTime, DateTimeService>();
        services.AddSingleton<IGeminiService>(sp => new GeminiService(
            sp.GetRequiredService<IOptions<GoogleAiSettings>>(),
            sp.GetRequiredService<Microsoft.Extensions.Logging.ILogger<GeminiService>>()));
        services.AddSingleton<IGeminiToolCallService>(sp => (IGeminiToolCallService)sp.GetRequiredService<IGeminiService>());
        services.AddSingleton<IAiIntentExtractor, GeminiAiIntentExtractor>();
        services.AddScoped<IWesalToolGateway, WesalToolGateway>();
        services.AddScoped<IGeminiToolOrchestrator, GeminiToolOrchestrator>();
        services.AddSingleton<AiClock>();
        services.AddScoped<AiContextResolver>();
        services.AddScoped<AiAssistantPolicyGate>();
        services.AddScoped<IAiAssistantService, AiAssistantService>();

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.MapInboundClaims = false;
                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = TokenRevocationValidation.OnTokenValidatedAsync,
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

            options.AddPolicy(ApplicationPolicies.RequireEventCoordinator, policy =>
                policy.RequireRole(ApplicationRoles.EventCoordinator));

            options.AddPolicy(ApplicationPolicies.RequirePhotographer, policy =>
                policy.RequireRole(ApplicationRoles.Photographer));

            // WESAL approval enforcement: the reusable publishing gate. Passes for
            // every account except an unapproved Event Coordinator or Photographer.
            // Intended for user-generated-content creation/editing endpoints.
            options.AddPolicy(ApplicationPolicies.RequireApprovedAccount, policy =>
                policy.AddRequirements(new Wesal.Infrastructure.Authorization.ApprovedAccountRequirement()));

            options.AddPolicy(ApplicationPolicies.RequireAuthenticatedUser, policy =>
                policy.RequireAuthenticatedUser());
        });

        services.AddScoped<Wesal.Application.Common.Interfaces.IUserContentPublishingRestrictionService, Wesal.Infrastructure.Identity.UserContentPublishingRestrictionService>();
        services.AddScoped<INotificationInboxService, NotificationInboxService>();
        services.AddScoped<IAdminModerationService, AdminModerationService>();
        services.AddHostedService<PublishingRestrictionBackgroundService>();
        services.AddScoped<Wesal.Application.Common.Interfaces.IPostService, Wesal.Infrastructure.Publishing.PostService>();
        services.AddOptions<Wesal.Infrastructure.Publishing.PostSharingOptions>()
            .Bind(configuration.GetSection(Wesal.Infrastructure.Publishing.PostSharingOptions.SectionName))
            .Validate(options => string.IsNullOrWhiteSpace(options.PublicWebBaseUrl)
                || Uri.TryCreate(options.PublicWebBaseUrl, UriKind.Absolute, out var uri)
                    && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps),
                "PostSharing:PublicWebBaseUrl must be an absolute HTTP or HTTPS URL when configured.");
        services.AddScoped<Wesal.Application.Common.Interfaces.IPostSharingService, Wesal.Infrastructure.Publishing.PostSharingService>();
        services.AddScoped<Wesal.Application.Common.Interfaces.IPostInteractionService, Wesal.Infrastructure.Publishing.PostInteractionService>();
        services.AddScoped<Wesal.Application.Common.Interfaces.IProfessionalOfferService, Wesal.Infrastructure.Publishing.ProfessionalOfferService>();
        services.AddScoped<Wesal.Application.Common.Interfaces.IHallOfferService, Wesal.Infrastructure.Publishing.HallOfferService>();
        services.AddScoped<Wesal.Application.Common.Interfaces.IOfferLifecycleService, Wesal.Infrastructure.Publishing.OfferLifecycleService>();
        services.AddHostedService<Wesal.Infrastructure.Publishing.OfferLifecycleBackgroundService>();
        return services;
    }
}
