namespace Wesal.Application.Common.Models;

public sealed record RegisterRequest(
    string FullName,
    string Email,
    string PhoneNumber,
    string Password,
    string ConfirmPassword,
    string AccountType);

public sealed record RegisterResponse(
    string UserId,
    string FullName,
    string Email,
    string PhoneNumber,
    string AccountType,
    string Token);
