using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Wesal.Domain.Constants;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// The photographer setup endpoints must stay behind their role policies. These facts
/// are pinned by reflection because the service layer cannot see the controller policy:
/// an unauthorized caller would otherwise be refused only when resolving data, a
/// different check arriving by coincidence.
/// </summary>
public class PhotographerEndpointAuthorizationShould
{
    [Fact]
    public void PhotographerSetupEndpoint_IsPhotographerOnly()
    {
        var action = typeof(Wesal.API.Controllers.PhotographerController)
            .GetMethod(nameof(Wesal.API.Controllers.PhotographerController.SubmitSetup));

        Assert.NotNull(action);

        var controllerPolicy = ControllerPolicy<Wesal.API.Controllers.PhotographerController>();
        var actionPolicies = action!.GetCustomAttributes<AuthorizeAttribute>(inherit: true).Cast<AuthorizeAttribute>();

        Assert.Equal(ApplicationPolicies.RequirePhotographer, controllerPolicy!.Policy);
        Assert.DoesNotContain(actionPolicies, p => p.Policy == ApplicationPolicies.RequireAuthenticatedUser);
    }

    [Fact]
    public void AdminPhotographerIdentityEndpoint_IsAdminOnly()
    {
        var action = typeof(Wesal.API.Controllers.AdminPhotographersController)
            .GetMethod(nameof(Wesal.API.Controllers.AdminPhotographersController.GetPhotographerIdentityDocument));

        Assert.NotNull(action);

        var controllerPolicy = ControllerPolicy<Wesal.API.Controllers.AdminPhotographersController>();
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
