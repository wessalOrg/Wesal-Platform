using Wesal.Application.Common.Models;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

public class RecommendationServiceStubShould
{
    private readonly RecommendationServiceStub _service = new();

    [Fact]
    public async Task GetRecommendations_ReturnsAiUnavailableStatus()
    {
        var result = await _service.GetRecommendationsAsync("I need a hall in Gaza", "en", CancellationToken.None);

        Assert.Equal(RecommendationStatus.AiUnavailable, result.Status);
    }

    [Fact]
    public async Task GetRecommendations_ReturnsEmptyRecommendations()
    {
        var result = await _service.GetRecommendationsAsync("I need a hall in Gaza", "en", CancellationToken.None);

        Assert.Empty(result.Recommendations);
    }

    [Fact]
    public async Task GetRecommendations_ReturnsUserFriendlyMessage()
    {
        var result = await _service.GetRecommendationsAsync("I need a hall in Gaza", "en", CancellationToken.None);

        Assert.NotNull(result.Message);
        Assert.Contains("not yet available", result.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetRecommendations_ReturnsNullExtractedCriteria()
    {
        var result = await _service.GetRecommendationsAsync("I need a hall in Gaza", "en", CancellationToken.None);

        Assert.Null(result.ExtractedCriteria);
    }

    [Fact]
    public async Task GetRecommendations_ReturnsUtcTimestamp()
    {
        var before = DateTime.UtcNow;
        var result = await _service.GetRecommendationsAsync("I need a hall in Gaza", "en", CancellationToken.None);
        var after = DateTime.UtcNow;

        Assert.True(result.Timestamp >= before.AddSeconds(-1));
        Assert.True(result.Timestamp <= after.AddSeconds(1));
    }

    [Fact]
    public async Task GetRecommendations_ArabicLanguage_ReturnsSameResponse()
    {
        var result = await _service.GetRecommendationsAsync("أحتاج قاعة في غزة", "ar", CancellationToken.None);

        Assert.Equal(RecommendationStatus.AiUnavailable, result.Status);
    }

    [Fact]
    public async Task GetRecommendations_NullLanguage_ReturnsSameResponse()
    {
        var result = await _service.GetRecommendationsAsync("I need a hall", null, CancellationToken.None);

        Assert.Equal(RecommendationStatus.AiUnavailable, result.Status);
    }

    [Fact]
    public async Task GetRecommendations_EmptyMessage_ReturnsSameResponse()
    {
        var result = await _service.GetRecommendationsAsync("", "en", CancellationToken.None);

        Assert.Equal(RecommendationStatus.AiUnavailable, result.Status);
    }
}
