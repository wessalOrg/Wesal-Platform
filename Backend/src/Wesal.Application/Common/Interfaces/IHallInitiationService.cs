using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Starts the 'Add Hall' flow for the current Hall Owner (US-OWNER-03).
/// Access is restricted to Hall Owners by the RequireHallOwner authorization policy
/// (Wesal.Domain.Constants.ApplicationPolicies). The owner is resolved exclusively
/// from the authenticated session; the method accepts no client-supplied identity.
/// The flow is stateless: it validates a live owner session and reports readiness so
/// the frontend can open the Add Hall form (US-OWNER-04). No empty or draft hall
/// record is created or prepared here.
/// </summary>
public interface IHallInitiationService
{
    Task<HallInitiationResponse> InitiateAsync(CancellationToken cancellationToken = default);
}