using Microsoft.AspNetCore.Identity;
using Wesal.Domain.Enums;

namespace Wesal.Infrastructure.Identity;

public class ApplicationUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;

    public Language PreferredLanguage { get; set; } = Language.Arabic;

    /// <summary>
    /// Relative storage URL of the owner-uploaded identity document (ID card). Required
    /// (backend-enforced) before a Hall Owner can create a hall. Stored OUTSIDE the
    /// public static-file area; only the owner and the Admin can read it.
    /// </summary>
    public string? IdentityDocumentUrl { get; set; }

    public DateTimeOffset? IdentityDocumentUploadedAt { get; set; }
}
