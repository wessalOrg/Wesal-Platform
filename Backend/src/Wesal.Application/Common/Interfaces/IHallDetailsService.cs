using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IHallDetailsService
{
    Task<HallDetailsDto> GetHallDetailsAsync(Guid hallId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Reads the booking-period availability of one public, approved hall for a
/// specified date. This is deliberately read-only and is safe for guest-facing
/// consumers such as the public API and MCP server.
/// </summary>
public interface IHallAvailabilityService
{
    Task<HallAvailabilityDto> GetHallAvailabilityAsync(
        Guid hallId,
        DateOnly date,
        CancellationToken cancellationToken = default);
}
