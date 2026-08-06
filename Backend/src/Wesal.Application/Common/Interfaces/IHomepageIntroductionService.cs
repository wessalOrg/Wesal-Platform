using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IHomepageIntroductionService
{
    Task<HomepageIntroductionDto> GetIntroductionAsync(CancellationToken cancellationToken = default);
}
