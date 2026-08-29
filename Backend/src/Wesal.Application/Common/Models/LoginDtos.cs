namespace Wesal.Application.Common.Models;

public class LoginRequest
{
    public string Identifier { get; init; } = string.Empty;

    public string Password { get; init; } = string.Empty;
}

public class LoginResponse
{
    public string Id { get; init; } = string.Empty;

    public string FullName { get; init; } = string.Empty;

    public string Email { get; init; } = string.Empty;

    public string PhoneNumber { get; init; } = string.Empty;

    public string AccountType { get; init; } = string.Empty;

    public string Role { get; init; } = string.Empty;

    public string Token { get; init; } = string.Empty;
}