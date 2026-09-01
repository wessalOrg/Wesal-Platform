namespace Wesal.Application.Common.Models;

public class ProfileResponse
{
    public string FullName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string PhoneNumber { get; init; } = string.Empty;
    public string ConcurrencyStamp { get; init; } = string.Empty;
}

public class UpdateProfileRequest
{
    public string FullName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string PhoneNumber { get; init; } = string.Empty;
    public string? ConcurrencyStamp { get; init; }
}
