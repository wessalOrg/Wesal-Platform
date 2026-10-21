namespace Wesal.Application.Common.Models;

public sealed class GoogleAuthRequest
{
    public string Credential { get; init; } = string.Empty;
    public string AccountType { get; init; } = string.Empty;
}

public sealed class GoogleRegisterRequest
{
    public string RegistrationToken { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string AccountType { get; init; } = string.Empty;
}

public sealed class GoogleAuthResponse
{
    public bool RequiresRegistration { get; init; }
    public string? RegistrationToken { get; init; }
    public string? Email { get; init; }
    public string? FullName { get; init; }
    public string? AccountType { get; init; }
    public string? GoogleName { get; init; }
    public LoginResponse? User { get; init; }
}
