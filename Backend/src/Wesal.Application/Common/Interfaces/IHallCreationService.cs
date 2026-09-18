using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IHallCreationService
{
    Task<CreateHallResponse> CreateHallAsync(CreateHallRequest request, CancellationToken cancellationToken = default);
}
