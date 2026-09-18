using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IAdminHallService
{
    Task<HallApprovalResponse> ApproveHallAsync(Guid hallId, CancellationToken cancellationToken = default);
}
