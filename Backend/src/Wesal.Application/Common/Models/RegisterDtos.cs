namespace Wesal.Application.Common.Models;

public class RegisterRequest
{
    public RegisterRequest() { }

    public RegisterRequest(string fullName, string email, string phoneNumber, string password, string confirmPassword, string? accountType)
    {
        FullName = fullName;
        Email = email;
        PhoneNumber = phoneNumber;
        Password = password;
        ConfirmPassword = confirmPassword;
        AccountType = accountType;
    }

    public string FullName { get; init; } = string.Empty;

    public string Email { get; init; } = string.Empty;

    public string PhoneNumber { get; init; } = string.Empty;

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

    public string PhoneNumber { get; init; } = string.Empty;

    public string AccountType { get; init; } = string.Empty;

    public string Role { get; init; } = string.Empty;

    public string Token { get; init; } = string.Empty;
}
