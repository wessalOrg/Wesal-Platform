using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Wesal.Domain.Constants;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// The identity-document endpoints must remain behind their role policies. These facts
/// are pinned by reflection because the service layer cannot see the controller policy:
/// an unauthorized caller would otherwise be refused only when resolving the document,
/// a different check arriving by coincidence.
/// </summary>
public class IdentityDocumentAuthorizationShould
{
    [Fact]
    public void AdminIdentityEndpoint_IsAdminOnly()
    {
        var action = typeof(Wesal.API.Controllers.AdminController)
            .GetMethod(nameof(Wesal.API.Controllers.AdminController.GetOwnerIdentityDocument));

        Assert.NotNull(action);

        var controllerPolicy = ControllerPolicy<Wesal.API.Controllers.AdminController>();
        var actionPolicies = action!.GetCustomAttributes<AuthorizeAttribute>(inherit: true).Cast<AuthorizeAttribute>();

        Assert.Equal(ApplicationPolicies.RequireAdmin, controllerPolicy!.Policy);
        Assert.DoesNotContain(actionPolicies, p => p.Policy == ApplicationPolicies.RequireAuthenticatedUser);
    }

    [Fact]
    public void OwnerIdentityEndpoints_AreHallOwnerOnly()
    {
        var upload = typeof(Wesal.API.Controllers.OwnerController)
            .GetMethod(nameof(Wesal.API.Controllers.OwnerController.UploadIdentityDocument));
        var read = typeof(Wesal.API.Controllers.OwnerController)
            .GetMethod(nameof(Wesal.API.Controllers.OwnerController.GetIdentityDocument));

        Assert.NotNull(upload);
        Assert.NotNull(read);

        var controllerPolicy = ControllerPolicy<Wesal.API.Controllers.OwnerController>();

        Assert.NotNull(controllerPolicy);
        Assert.Equal(ApplicationPolicies.RequireHallOwner, controllerPolicy!.Policy);

        foreach (var action in new[] { upload!, read! })
        {
            var actionPolicies = action.GetCustomAttributes<AuthorizeAttribute>(inherit: true).Cast<AuthorizeAttribute>();
            Assert.DoesNotContain(actionPolicies, p => p.Policy == ApplicationPolicies.RequireAuthenticatedUser);
        }
    }

    private static AuthorizeAttribute? ControllerPolicy<TController>()
        => typeof(TController)
            .GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true)
            .Cast<AuthorizeAttribute>()
            .SingleOrDefault();
}