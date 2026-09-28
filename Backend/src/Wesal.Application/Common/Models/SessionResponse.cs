using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

public sealed class SessionResponse
{
    public bool IsAuthenticated { get; init; }

    public string? Role { get; init; }

    public string? UserName { get; init; }

    public Language Language { get; init; }

    /// <summary>
    /// Whether the authenticated user holds the Hall Owner role (Edit 19), derived
    /// server-side from the authenticated session. Drives the "Add your hall" CTA
    /// without trusting any client-supplied role value.
    /// </summary>
    public bool IsHallOwner { get; init; }

    /// <summary>
    /// Whether the authenticated user already owns at least one (non-deleted) hall
    /// (Edit 19), counted live from the database. Never taken from client input.
    /// </summary>
    public bool OwnsHall { get; init; }
}
