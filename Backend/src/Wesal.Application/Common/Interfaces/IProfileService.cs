using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IProfileService
{
    Task<ProfileResponse> GetProfileAsync(CancellationToken cancellationToken = default);
    Task<ProfileResponse> UpdateProfileAsync(UpdateProfileRequest request, CancellationToken cancellationToken = default);
}
