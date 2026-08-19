namespace Wesal.Application.Common.Models;

public sealed class LanguageResponse
{
    public string Language { get; init; } = string.Empty;
}

public sealed class UpdateLanguageRequest
{
    public string Language { get; init; } = string.Empty;
}