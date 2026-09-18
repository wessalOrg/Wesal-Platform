using Wesal.Domain.Constants;

namespace Wesal.Application.Common.Models;

/// <summary>
/// Result of the Add Hall initiation endpoint (US-OWNER-03).
/// A single machine-readable 'Ready' signal is returned when a valid Hall Owner
/// session may open the Add Hall form (US-OWNER-04). No hall record is created.
/// Blocked states surface as HTTP problem details via the existing exception
/// pipeline (401 unauthenticated, 403 not a Hall Owner, 404 invalid session account).
/// The response deliberately carries no client-supplied identity: the owner is
/// resolved exclusively from the authenticated session server-side.
/// </summary>
public sealed record HallInitiationResponse(
    string Status,
    string Code)
{
    public static HallInitiationResponse Ready()
        => new(HallInitiation.StatusReady, HallInitiation.CodeReady);
}