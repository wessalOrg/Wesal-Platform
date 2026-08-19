using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface ILanguagePreferenceService
{
    Task<LanguagePreferenceResponse> GetLanguagePreferenceAsync(CancellationToken cancellationToken);

    Task<LanguagePreferenceResponse> UpdateLanguagePreferenceAsync(UpdateLanguagePreferenceRequest request, CancellationToken cancellationToken);
}
