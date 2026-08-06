using Microsoft.AspNetCore.Identity;
using Wesal.Domain.Enums;

namespace Wesal.Infrastructure.Identity;

public class ApplicationUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;

    public Language PreferredLanguage { get; set; } = Language.Arabic;
}
