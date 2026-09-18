using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Provides the sidebar data of the Hall Owner management interface (US-OWNER-01).
/// Access is restricted to Hall Owners by the RequireHallOwner authorization policy.
/// </summary>
public interface IOwnerSidebarService
{
    Task<OwnerSidebarResponse> GetSidebarAsync(CancellationToken cancellationToken = default);
}