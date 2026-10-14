using Xunit;
using Wesal.Application.Ai;
using Wesal.Domain.Catalogs;
using Wesal.Domain.Enums;

namespace Wesal.Tests.Ai;

public sealed class MabroukBudgetAndLocationShould
{
    [Theory]
    [InlineData("بالرمال", "حي الرمال", HallRegion.Gaza)]
    [InlineData("في الرمال", "حي الرمال", HallRegion.Gaza)]
    [InlineData("حي الرمال", "حي الرمال", HallRegion.Gaza)]
    public void Resolve_Neighborhood_With_Various_Prepositions(string message, string expectedLabel, HallRegion expectedRegion)
    {
        var result = AiLocationResolver.Resolve(message, expectedRegion);
        Assert.NotNull(result.Area);
        var area = result.Area!.CanonicalLabel;
        Assert.Equal(expectedLabel, area);
        Assert.Equal(expectedRegion, result.Area!.Region);
        Assert.False(result.IsAmbiguous);
    }

    [Fact]
    public void Do_Not_FalseMatch_Similar_Names()
    {
        // "بالنصيرات" must match MiddleArea "النصيرات", not Gaza "النصر"
        var result1 = AiLocationResolver.Resolve("بالنصيرات", HallRegion.MiddleArea);
        Assert.NotNull(result1.Area);
        var a1 = result1.Area!.CanonicalLabel;
        Assert.Equal("النصيرات", a1);
        Assert.Equal(HallRegion.MiddleArea, result1.Area!.Region);
        Assert.False(result1.IsAmbiguous);

        // "السلام عليكم" must not resolve to "حي السلام" (core "السلام" is in deny-list)
        var result2 = AiLocationResolver.Resolve("السلام عليكم", HallRegion.SouthGaza);
        // Core "السلام" is denied and no full canonical match; result has no area.
        Assert.Null(result2.Area);
        // IsAmbiguous is false when no candidates found (code returns Area null, IsAmbiguous false)
        Assert.False(result2.IsAmbiguous);
    }

    [Fact]
    public void Resolve_Region_Context_Disambiguates()
    {
        // When region context is given, ambiguity is resolved; without it, result is ambiguous.
        var entries = new List<(HallRegion Region, string Label)>
        {
            (HallRegion.Gaza, "حي الرمال"),
            (HallRegion.SouthGaza, "حي النصيرات"),
        };
        var result = AiLocationResolver.Resolve("بالرمال", HallRegion.Gaza, entries);
        Assert.NotNull(result.Area);
        var a = result.Area!.CanonicalLabel;
        Assert.Equal("حي الرمال", a);
        Assert.Equal(HallRegion.Gaza, result.Area!.Region);
        Assert.False(result.IsAmbiguous);
    }

    [Fact]
    public void Core_Less_Than_4_Chars_Or_In_Deny_List_Is_Skipped()
    {
        // Short or generic cores (e.g. "السلام", "الامل") must not be matched on their own.
        // Only full canonical labels should match.
        var result = AiLocationResolver.Resolve("بالسلام", HallRegion.SouthGaza);
        // "السلام" core is in deny-list and short; full canonical label "حي السلام" won't match "بالسلام"
        // because the pattern requires the full word with Arabic prefixes. Likely no match.
        // Given the code, if no candidates, Area=null, IsAmbiguous=false.
        Assert.Null(result.Area);
        Assert.False(result.IsAmbiguous);
    }
}