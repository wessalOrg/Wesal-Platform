using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

public sealed class UpdateLanguagePreferenceRequest
{
    public Language Language { get; init; }
}

public sealed class LanguagePreferenceResponse
{
    public Language Language { get; init; }
}
