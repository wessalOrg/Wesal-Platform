namespace Wesal.Application.Common.Models;

public class ProfileResponse
{
    /// <summary>
    /// The authenticated caller's own identity id (WESAL-TASK-9, Edit 9).
    ///
    /// This is the caller's own subject id, already present in their own access token;
    /// returning it is not a cross-user disclosure. It is required because the web
    /// client maps the payload as <c>id: String(data.id ?? data.userId ?? "self")</c>
    /// and then persists that value into stored auth state. Without a real id here the
    /// client fell back to the truthy sentinel string "self" and overwrote the signed-in
    /// user's stored id, corrupting the identity (and the session key derived from it)
    /// for every user whose profile loaded.
    /// </summary>
    public string Id { get; init; } = string.Empty;

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
