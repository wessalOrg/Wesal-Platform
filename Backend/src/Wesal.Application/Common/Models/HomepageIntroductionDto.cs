namespace Wesal.Application.Common.Models;

public class HomepageIntroductionDto
{
    public string PlatformNameAr { get; init; } = string.Empty;

    public string PlatformNameEn { get; init; } = string.Empty;

    public string TitleAr { get; init; } = string.Empty;

    public string TitleEn { get; init; } = string.Empty;

    public string DescriptionAr { get; init; } = string.Empty;

    public string DescriptionEn { get; init; } = string.Empty;

    public bool IsFallback { get; init; }
}
