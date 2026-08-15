using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IHallDetailsService
{
    Task<HallDetailsDto> GetHallDetailsAsync(Guid hallId, CancellationToken cancellationToken = default);
}
