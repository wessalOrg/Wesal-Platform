using Wesal.Infrastructure.Halls;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// R2 configuration validation (durable hall media, Phase 20): misconfiguration
/// fails clearly at startup naming settings, never secret values.
/// </summary>
public sealed class HallMediaR2ConfigurationShould
{
    private static HallMediaR2Options Valid() => new()
    {
        ServiceUrl = "https://abc123.r2.cloudflarestorage.com",
        AccessKeyId = "AKID",
        SecretAccessKey = "SECRET-VALUE",
        BucketName = "wesal-hall-media",
        PublicBaseUrl = "https://media.example.com/"
    };

    [Fact]
    public void MissingSection_ThrowsNamingSettings()
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => HallMediaR2Configuration.Validate(null, isDevelopment: false));
        Assert.Contains("HallMedia:R2", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void MissingSecret_ThrowsNamingSettingWithoutSecretValue()
    {
        var options = Valid();
        options.SecretAccessKey = null;

        var ex = Assert.Throws<InvalidOperationException>(
            () => HallMediaR2Configuration.Validate(options, isDevelopment: false));
        Assert.Contains("HallMedia:R2:SecretAccessKey", ex.Message, StringComparison.Ordinal);
        Assert.DoesNotContain("SECRET-VALUE", ex.Message, StringComparison.Ordinal);
        Assert.DoesNotContain(options.AccessKeyId!, ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void NonHttpsBase_ThrowsOutsideDevelopment_AllowsInDevelopment()
    {
        var options = Valid();
        options.PublicBaseUrl = "http://localhost:9000/media";

        Assert.Throws<InvalidOperationException>(
            () => HallMediaR2Configuration.Validate(options, isDevelopment: false));

        var validated = HallMediaR2Configuration.Validate(options, isDevelopment: true);
        Assert.Equal("http://localhost:9000/media", validated.PublicBaseUrl);
    }

    [Theory]
    [InlineData("https://user:pass@media.example.com")]
    [InlineData("https://media.example.com/?x=1")]
    [InlineData("https://media.example.com/#x")]
    [InlineData("https://media.example.com/uploads/halls")]
    public void UnsafeBase_Throws(string baseUrl)
    {
        var options = Valid();
        options.PublicBaseUrl = baseUrl;

        Assert.Throws<InvalidOperationException>(
            () => HallMediaR2Configuration.Validate(options, isDevelopment: false));
    }

    [Fact]
    public void OversizedBase_Throws()
    {
        var options = Valid();
        options.PublicBaseUrl = "https://media.example.com/" + new string('a', 400);

        Assert.Throws<InvalidOperationException>(
            () => HallMediaR2Configuration.Validate(options, isDevelopment: false));
    }

    [Fact]
    public void ValidOptions_TrimTrailingSlashAndPassThrough()
    {
        var validated = HallMediaR2Configuration.Validate(Valid(), isDevelopment: false);

        Assert.Equal("https://media.example.com", validated.PublicBaseUrl);
        Assert.Equal("wesal-hall-media", validated.BucketName);
    }
}
