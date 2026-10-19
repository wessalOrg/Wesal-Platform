using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Wesal.Domain.Constants;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// The coordinator setup endpoints must stay behind their role policies. These facts
/// are pinned by reflection because the service layer cannot see the controller policy:
/// an unauthorized caller would otherwise be refused only when resolving data, a
/// different check arriving by coincidence.
/// </summary>
public class CoordinatorEndpointAuthorizationShould
{
    [Fact]
    public void CoordinatorSetupEndpoint_IsEventCoordinatorOnly()
    {
        var action = typeof(Wesal.API.Controllers.CoordinatorController)
            .GetMethod(nameof(Wesal.API.Controllers.CoordinatorController.SubmitSetup));

        Assert.NotNull(action);

        var controllerPolicy = ControllerPolicy<Wesal.API.Controllers.CoordinatorController>();
        var actionPolicies = action!.GetCustomAttributes<AuthorizeAttribute>(inherit: true).Cast<AuthorizeAttribute>();

        Assert.Equal(ApplicationPolicies.RequireEventCoordinator, controllerPolicy!.Policy);
        Assert.DoesNotContain(actionPolicies, p => p.Policy == ApplicationPolicies.RequireAuthenticatedUser);
    }

    [Fact]
    public void AdminCoordinatorIdentityEndpoint_IsAdminOnly()
    {
        var action = typeof(Wesal.API.Controllers.AdminCoordinatorsController)
            .GetMethod(nameof(Wesal.API.Controllers.AdminCoordinatorsController.GetCoordinatorIdentityDocument));

        Assert.NotNull(action);

        var controllerPolicy = ControllerPolicy<Wesal.API.Controllers.AdminCoordinatorsController>();
        var actionPolicies = action!.GetCustomAttributes<AuthorizeAttribute>(inherit: true).Cast<AuthorizeAttribute>();

        Assert.Equal(ApplicationPolicies.RequireAdmin, controllerPolicy!.Policy);
        Assert.DoesNotContain(actionPolicies, p => p.Policy == ApplicationPolicies.RequireAuthenticatedUser);
    }

    private static AuthorizeAttribute? ControllerPolicy<TController>()
        => typeof(TController)
            .GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true)
            .Cast<AuthorizeAttribute>()
            .SingleOrDefault();
}
