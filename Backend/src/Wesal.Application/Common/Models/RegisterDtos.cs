using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

public class RegisterRequest
{
    public RegisterRequest() { }

    public RegisterRequest(string fullName, string email, string password, string confirmPassword, string? accountType)
    {
        FullName = fullName;
        Email = email;
        Password = password;
        ConfirmPassword = confirmPassword;
        AccountType = accountType;
    }

    public string FullName { get; init; } = string.Empty;

    public string Email { get; init; } = string.Empty;

    public string Password { get; init; } = string.Empty;

    public string ConfirmPassword { get; init; } = string.Empty;

    public string? AccountType { get; init; }
}

public class RegisterResponse
{
    public string Id { get; init; } = string.Empty;

    public string UserId => Id;

    public string FullName { get; init; } = string.Empty;

    public string Email { get; init; } = string.Empty;

    public string AccountType { get; init; } = string.Empty;

    public string Role { get; init; } = string.Empty;

    public string Token { get; init; } = string.Empty;

    /// <summary>
    /// False for freshly registered Event Coordinators and Photographers, whose
    /// registration is only complete after their role-specific setup data is submitted.
    /// True for Regular Users and Hall Owners, who are complete at account creation.
    /// </summary>
    public bool IsSetupComplete { get; init; } = true;

    /// <summary>
    /// The account's approval state. New coordinator/photographer accounts start
    /// <c>Pending</c>; every other account is <c>Approved</c>.
    /// </summary>
    public AccountApprovalStatus ApprovalStatus { get; init; } = AccountApprovalStatus.Approved;
}
