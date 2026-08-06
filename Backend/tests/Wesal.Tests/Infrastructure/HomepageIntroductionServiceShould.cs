using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Wesal.Infrastructure.Homepage;

namespace Wesal.Tests.Infrastructure;

public class HomepageIntroductionServiceShould
{
    [Fact]
    public async Task GetIntroductionAsync_ReturnsConfiguredContent()
    {
        var service = CreateService(new HomepageIntroductionOptions
        {
            PlatformNameAr = "وصال",
            PlatformNameEn = "Wesal",
            TitleAr = "عنوان عربي",
            TitleEn = "English title",
            DescriptionAr = "وصف عربي",
            DescriptionEn = "English description"
        });

        var result = await service.GetIntroductionAsync();

        Assert.False(result.IsFallback);
        Assert.Equal("وصال", result.PlatformNameAr);
        Assert.Equal("Wesal", result.PlatformNameEn);
        Assert.Equal("عنوان عربي", result.TitleAr);
        Assert.Equal("English title", result.TitleEn);
        Assert.Equal("وصف عربي", result.DescriptionAr);
        Assert.Equal("English description", result.DescriptionEn);
    }

    [Fact]
    public async Task GetIntroductionAsync_FallsBackWhenOptionsAreMissing()
    {
        var service = CreateService(new HomepageIntroductionOptions());

        var result = await service.GetIntroductionAsync();

        Assert.True(result.IsFallback);
        Assert.False(string.IsNullOrWhiteSpace(result.TitleAr));
        Assert.False(string.IsNullOrWhiteSpace(result.TitleEn));
        Assert.False(string.IsNullOrWhiteSpace(result.DescriptionAr));
        Assert.False(string.IsNullOrWhiteSpace(result.DescriptionEn));
    }

    [Fact]
    public async Task GetIntroductionAsync_FallsBackWhenOptionsArePartiallyConfigured()
    {
        var service = CreateService(new HomepageIntroductionOptions
        {
            PlatformNameAr = "وصال",
            PlatformNameEn = "Wesal"
        });

        var result = await service.GetIntroductionAsync();

        Assert.True(result.IsFallback);
    }

    private static HomepageIntroductionService CreateService(HomepageIntroductionOptions options)
        => new(Options.Create(options), NullLogger<HomepageIntroductionService>.Instance);
}
