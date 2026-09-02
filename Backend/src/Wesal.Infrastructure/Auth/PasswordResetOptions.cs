using System.ComponentModel.DataAnnotations;

namespace Wesal.Infrastructure.Auth;

public class PasswordResetOptions
{
    public const string SectionName = "PasswordReset";

    [Required]
    public string ResetPageUrl { get; set; } = string.Empty;
}