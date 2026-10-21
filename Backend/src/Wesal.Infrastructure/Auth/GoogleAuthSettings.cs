namespace Wesal.Infrastructure.Auth;

public sealed class GoogleAuthSettings
{
    public const string SectionName = "GoogleAuth";
    public string ClientId { get; set; } = string.Empty;
}
