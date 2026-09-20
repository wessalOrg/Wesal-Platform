namespace Wesal.Application.Common.Models;

public class ProfileResponse
{
    public string FullName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string PhoneNumber { get; init; } = string.Empty;
    public string ConcurrencyStamp { get; init; } = string.Empty;

    /// <summary>
    /// True when the Hall Owner has uploaded an identity document. The document is
    /// mandatory before the owner can create a hall, so the profile UI can show the
    /// completion state (US-OWNER-30).
    /// </summary>
    public bool IsIdentityDocumentUploaded { get; init; }
}

public class UpdateProfileRequest
{
    public string FullName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string PhoneNumber { get; init; } = string.Empty;
    public string? ConcurrencyStamp { get; init; }
}

public class ChangePasswordRequest
{
    public string CurrentPassword { get; init; } = string.Empty;
    public string NewPassword { get; init; } = string.Empty;
    public string ConfirmPassword { get; init; } = string.Empty;
}

public class ChangePasswordResponse
{
    public string Message { get; init; } = string.Empty;
}
