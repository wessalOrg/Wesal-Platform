namespace Wesal.Application.Common.Models;

public class ForgotPasswordRequest
{
    public string Email { get; init; } = string.Empty;
}

public class ForgotPasswordResponse
{
    public string Message { get; init; } = string.Empty;
}

public class ResetPasswordRequest
{
    public string Email { get; init; } = string.Empty;

    public string Token { get; init; } = string.Empty;

    public string NewPassword { get; init; } = string.Empty;

    public string ConfirmNewPassword { get; init; } = string.Empty;
}

public class ResetPasswordResponse
{
    public string Message { get; init; } = string.Empty;
}