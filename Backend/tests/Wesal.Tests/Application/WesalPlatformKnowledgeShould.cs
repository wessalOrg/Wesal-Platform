using Wesal.Application.Ai;

namespace Wesal.Tests.Application;

public class WesalPlatformKnowledgeShould
{
    [Fact]
    public void GetImplementedFeatures_ContainsOnlySupportedFunctionality()
    {
        var features = WesalPlatformKnowledge.GetImplementedFeatures("ar");
        Assert.NotEmpty(features);
        // Must contain core implemented features
        Assert.Contains(features, f => f.Key == "browse_halls");
        Assert.Contains(features, f => f.Key == "search_halls");
        Assert.Contains(features, f => f.Key == "hall_details");
        Assert.Contains(features, f => f.Key == "ratings");
        Assert.Contains(features, f => f.Key == "comments");
        Assert.Contains(features, f => f.Key == "authentication");
        Assert.Contains(features, f => f.Key == "ai_assistant");
    }

    [Fact]
    public void GetImplementedFeatures_DoesNotContainUnimplementedClaims()
    {
        var features = WesalPlatformKnowledge.GetImplementedFeatures("en");
        // Ensure no fictional future features are claimed
        var keys = features.Select(f => f.Key).ToList();
        Assert.DoesNotContain("payment", keys);
        Assert.DoesNotContain("future_feature", keys);
    }

    [Fact]
    public void BuildContextPrompt_ContainsImplementedFeaturesOnly()
    {
        var promptAr = WesalPlatformKnowledge.BuildContextPrompt("ar");
        var promptEn = WesalPlatformKnowledge.BuildContextPrompt("en");

        Assert.Contains("وصال", promptAr);
        Assert.Contains("Wesal", promptEn);
        Assert.Contains("تصفح القاعات", promptAr);
        Assert.Contains("Browse halls", promptEn);
        Assert.DoesNotContain("payment", promptEn, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void GetImplementedFeatures_ArabicAndEnglish_BothHaveSameCount()
    {
        var ar = WesalPlatformKnowledge.GetImplementedFeatures("ar");
        var en = WesalPlatformKnowledge.GetImplementedFeatures("en");
        Assert.Equal(ar.Count, en.Count);
    }

    [Fact]
    public void Knowledge_IsStructuredAndMaintainable()
    {
        var features = WesalPlatformKnowledge.GetImplementedFeatures();
        foreach (var f in features)
        {
            Assert.False(string.IsNullOrWhiteSpace(f.Title));
            Assert.False(string.IsNullOrWhiteSpace(f.Description));
            Assert.True(f.IsAvailable);
        }
    }
}
