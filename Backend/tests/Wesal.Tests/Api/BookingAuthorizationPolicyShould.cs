using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Wesal.API.Controllers;
using Wesal.Domain.Constants;

namespace Wesal.Tests.Api;

/// <summary>
/// Pins the endpoint-level split between booking and publishing (WESAL specification
/// §4.2/§4.3). Browsing and booking must stay open to any authenticated account — the
/// approval status is enforced inside the service layer and must not be moved onto these
/// routes — while creating or editing posts and offers keeps the approved-account gate.
///
/// These facts are checked by reflection because the service tests cannot see which
/// policy a controller action actually carries; removing the policy, or attaching the
/// publishing gate to the booking route, would otherwise pass unnoticed.
/// </summary>
public class BookingAuthorizationPolicyShould
{
    [Theory]
    [InlineData(nameof(HallsController.CreateHourlyBooking))]
    public void BookingEndpoint_RequiresAuthenticationOnly(string actionName)
    {
        var action = Action<HallsController>(actionName);

        var policies = AuthorizeAttributes(action);
        Assert.Contains(policies, p => p.Policy == ApplicationPolicies.RequireAuthenticatedUser);
        Assert.DoesNotContain(policies, p => p.Policy == ApplicationPolicies.RequireApprovedAccount);

        // No controller-level gate may narrow the booking route to approved accounts.
        Assert.Empty(AuthorizeAttributes(typeof(HallsController)));
    }

    [Fact]
    public void MyBookingsEndpoint_RequiresAuthenticationOnly()
    {
        var action = Action<BookingsController>(nameof(BookingsController.GetMyBookings));

        var controllerPolicies = AuthorizeAttributes(typeof(BookingsController));
        Assert.Contains(controllerPolicies, p => p.Policy == ApplicationPolicies.RequireAuthenticatedUser);
        Assert.DoesNotContain(controllerPolicies, p => p.Policy == ApplicationPolicies.RequireApprovedAccount);

        Assert.DoesNotContain(AuthorizeAttributes(action), p => p.Policy == ApplicationPolicies.RequireApprovedAccount);
    }

    [Theory]
    [InlineData(typeof(HallsController), nameof(HallsController.SearchHalls))]
    [InlineData(typeof(HallsController), nameof(HallsController.GetHalls))]
    [InlineData(typeof(HallsController), nameof(HallsController.GetHallDetails))]
    [InlineData(typeof(HallsController), nameof(HallsController.GetFeaturedHalls))]
    [InlineData(typeof(HallsController), nameof(HallsController.GetHourlyCatalog))]
    [InlineData(typeof(HallsController), nameof(HallsController.GetAvailabilityCalendar))]
    public void PublicHallBrowseEndpoint_StaysAnonymous(Type controller, string actionName)
    {
        var action = controller.GetMethod(actionName, BindingFlags.Public | BindingFlags.Instance);
        Assert.NotNull(action);

        Assert.NotEmpty(action!.GetCustomAttributes<AllowAnonymousAttribute>(inherit: true));
        Assert.Empty(AuthorizeAttributes(action));
    }

    [Theory]
    [InlineData(typeof(PostsController), nameof(PostsController.Create))]
    [InlineData(typeof(PostsController), nameof(PostsController.Update))]
    [InlineData(typeof(ProfessionalOffersController), nameof(ProfessionalOffersController.Create))]
    [InlineData(typeof(ProfessionalOffersController), nameof(ProfessionalOffersController.Update))]
    public void PublishingEndpoint_KeepsTheApprovedAccountGate(Type controller, string actionName)
    {
        var action = controller.GetMethod(actionName, BindingFlags.Public | BindingFlags.Instance);
        Assert.NotNull(action);

        var attributes = AuthorizeAttributes(action!);
        Assert.Contains(attributes, p => p.Policy == ApplicationPolicies.RequireApprovedAccount);
        Assert.Contains(attributes, p =>
            p.Roles is not null
            && p.Roles.Contains(ApplicationRoles.EventCoordinator, StringComparison.Ordinal)
            && p.Roles.Contains(ApplicationRoles.Photographer, StringComparison.Ordinal));
    }

    [Fact]
    public void StopOfferEndpoint_StaysProfessionalOnly()
    {
        // Stopping an offer is guarded inside ProfessionalOfferService.StopAsync by the
        // live approval check, so the endpoint only has to keep the professional role
        // gate. This fact records that split explicitly.
        var action = Action<ProfessionalOffersController>(nameof(ProfessionalOffersController.Stop));

        var attributes = AuthorizeAttributes(action);
        Assert.Contains(attributes, p =>
            p.Roles is not null
            && p.Roles.Contains(ApplicationRoles.EventCoordinator, StringComparison.Ordinal)
            && p.Roles.Contains(ApplicationRoles.Photographer, StringComparison.Ordinal));
    }

    private static MethodInfo Action<TController>(string actionName)
    {
        var action = typeof(TController).GetMethod(actionName, BindingFlags.Public | BindingFlags.Instance);
        Assert.NotNull(action);
        return action!;
    }

    private static AuthorizeAttribute[] AuthorizeAttributes(MethodInfo method)
        => method.GetCustomAttributes<AuthorizeAttribute>(inherit: true).ToArray();

    private static AuthorizeAttribute[] AuthorizeAttributes(Type controller)
        => controller.GetCustomAttributes<AuthorizeAttribute>(inherit: true).ToArray();
}
