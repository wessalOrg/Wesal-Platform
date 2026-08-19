using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface ILanguageService
{
    Task<LanguageResponse> GetLanguageAsync(CancellationToken cancellationToken = default);

    Task<LanguageResponse> UpdateLanguageAsync(UpdateLanguageRequest request, CancellationToken cancellationToken = default);
}