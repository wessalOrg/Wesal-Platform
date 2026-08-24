using Wesal.Application.Ai;

namespace Wesal.Tests.Application;

public class AiFallbackProviderShould
{
    private readonly AiFallbackProvider _provider = new();

    [Fact]
    public void FallbackAnswer_Arabic_NotEmptyAndNoInternalDetails()
    {
        var answer = _provider.GetFallbackAnswer("ar");
        Assert.False(string.IsNullOrWhiteSpace(answer));
        Assert.DoesNotContain("exception", answer, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("stack", answer, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("API key", answer, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("تصفح القاعات", answer);
    }

    [Fact]
    public void FallbackAnswer_English_NotEmptyAndSafe()
    {
        var answer = _provider.GetFallbackAnswer("en");
        Assert.False(string.IsNullOrWhiteSpace(answer));
        Assert.DoesNotContain("exception", answer, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("browse halls", answer, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void GetFallback_ReturnsValidStructure()
    {
        var sessionId = Guid.NewGuid();
        var response = _provider.GetFallback("ar", sessionId);
        Assert.NotNull(response);
        Assert.False(string.IsNullOrWhiteSpace(response.Answer));
        Assert.True(response.IsFallback);
        Assert.Equal(sessionId, response.SessionId);
        Assert.Equal("ar", response.Language);
    }

    [Fact]
    public void GetFallback_NullLanguage_DefaultsToArabic()
    {
        var response = _provider.GetFallback(null);
        Assert.Equal("ar", response.Language);
        Assert.True(response.IsFallback);
    }

    [Fact]
    public void GetFallback_EmptyResponseScenario_ReturnsFallback()
    {
        var validator = new AiResponseValidator();
        string? empty = "";
        Assert.False(validator.IsValid(empty));
        var fallback = _provider.GetFallback("en");
        Assert.True(fallback.IsFallback);
        Assert.False(string.IsNullOrWhiteSpace(fallback.Answer));
    }

    [Fact]
    public void GetFallback_TimeoutScenario_ReturnsFallbackWithoutExceptionDetails()
    {
        // Simulate timeout by directly calling fallback provider (no exception details exposed)
        var fallback = _provider.GetFallback("ar");
        Assert.DoesNotContain("timeout", fallback.Answer, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Timeout", fallback.Answer);
        Assert.True(fallback.IsFallback);
    }

    [Fact]
    public void Fallback_DoesNotClaimUnsupportedFeatures()
    {
        var ar = _provider.GetFallbackAnswer("ar");
        var en = _provider.GetFallbackAnswer("en");
        // Must not claim payment, AI booking, etc. that are not implemented
        Assert.DoesNotContain("دفع", ar);
        Assert.DoesNotContain("payment", en, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("future", en, StringComparison.OrdinalIgnoreCase);
    }
}
