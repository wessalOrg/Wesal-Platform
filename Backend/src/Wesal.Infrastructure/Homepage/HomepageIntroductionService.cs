using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.Homepage;

public class HomepageIntroductionService : IHomepageIntroductionService
{
    private static readonly HomepageIntroductionDto FallbackContent = new()
    {
        PlatformNameAr = "وصال",
        PlatformNameEn = "Wesal",
        TitleAr = "ابحث عن قاعة الأفراح المناسبة في غزة بسهولة",
        TitleEn = "Find your perfect wedding hall in Gaza with ease",
        DescriptionAr = "وصال منصتك للبحث عن قاعات الأفراح في غزة ومقارنتها والتواصل مع أصحابها وحجزها دون الحاجة إلى زيارات ميدانية مرهقة.",
        DescriptionEn = "Wesal is your platform to search, compare, communicate with hall owners, and book wedding halls across Gaza without time-consuming field visits.",
        IsFallback = true
    };

    private readonly HomepageIntroductionOptions _options;
    private readonly ILogger<HomepageIntroductionService> _logger;

    public HomepageIntroductionService(
        IOptions<HomepageIntroductionOptions> options,
        ILogger<HomepageIntroductionService> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public Task<HomepageIntroductionDto> GetIntroductionAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (!HasValidContent(_options))
        {
            _logger.LogWarning(
                "Homepage introduction content is missing or incomplete under configuration section '{Section}'; serving fallback promotional content.",
                HomepageIntroductionOptions.SectionName);

            return Task.FromResult(FallbackContent);
        }

        return Task.FromResult(new HomepageIntroductionDto
        {
            PlatformNameAr = _options.PlatformNameAr,
            PlatformNameEn = _options.PlatformNameEn,
            TitleAr = _options.TitleAr,
            TitleEn = _options.TitleEn,
            DescriptionAr = _options.DescriptionAr,
            DescriptionEn = _options.DescriptionEn,
            IsFallback = false
        });
    }

    private static bool HasValidContent(HomepageIntroductionOptions options)
        => !string.IsNullOrWhiteSpace(options.PlatformNameAr)
           && !string.IsNullOrWhiteSpace(options.PlatformNameEn)
           && !string.IsNullOrWhiteSpace(options.TitleAr)
           && !string.IsNullOrWhiteSpace(options.TitleEn)
           && !string.IsNullOrWhiteSpace(options.DescriptionAr)
           && !string.IsNullOrWhiteSpace(options.DescriptionEn);
}
