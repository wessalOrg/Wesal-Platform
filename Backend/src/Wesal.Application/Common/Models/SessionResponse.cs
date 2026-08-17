namespace Wesal.Application.Common.Models;

public sealed class SessionResponse
{
    public bool IsAuthenticated { get; init; }

    public string? Role { get; init; }

    public string? UserName { get; init; }
}
