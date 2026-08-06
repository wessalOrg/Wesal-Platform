using Microsoft.AspNetCore.Identity;

namespace Wesal.Infrastructure.Identity;

public class ApplicationRole : IdentityRole
{
    public ApplicationRole()
    {
    }

    public ApplicationRole(string roleName)
        : base(roleName)
    {
    }
}
