namespace Wesal.Infrastructure.Auth;

public sealed class PasswordResetOptions
{
    public const string SectionName = "PasswordReset";

    /// <summary>
    /// Base URL of the SPA used to build the absolute reset link mailed to the user
    /// (US-LOGIN-06). Example: "https://wesal.example.com".
    /// </summary>
    public string FrontendBaseUrl { get; set; } = string.Empty;
}