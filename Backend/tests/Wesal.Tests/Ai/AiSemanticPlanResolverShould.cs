using Wesal.Application.Ai;
using Wesal.Application.Common.Models;

namespace Wesal.Tests.Ai;

public sealed class AiSemanticPlanResolverShould
{
    private static readonly DateOnly Today = new(2026, 10, 12);
    private static readonly AiTurnContext Turn = AiTurnContext.Empty(Today);

    [Fact]
    public void ProduceTypedBudgetSearchPlanWithoutGuessingCapacity()
    {
        var plan = AiSemanticPlanResolver.Resolve("بدي صالة ب1500 شيكل", "ar", Today, null, Turn);

        Assert.Equal(AiSemanticGoal.FindHall, plan.Goal);
        Assert.Equal(1500, plan.PriceBudget.MaximumPrice);
        Assert.Null(plan.Capacity);
        Assert.Equal(AiPriceSortPreference.LowestPrice, plan.SortPreference);
        Assert.Equal(AiPlanConfidence.High, plan.Confidence);
    }

    [Fact]
    public void KeepAnUnqualifiedNumberOutOfThePlan()
    {
        var plan = AiSemanticPlanResolver.Resolve("1500", "ar", Today, null, Turn);

        Assert.Null(plan.PriceBudget.MinimumPrice);
        Assert.Null(plan.PriceBudget.MaximumPrice);
        Assert.Null(plan.PriceBudget.AroundPrice);
        Assert.Null(plan.Capacity);
    }

    [Fact]
    public void ResolveAnArabicMultiwordHallNameAsAnExplicitReference()
    {
        var plan = AiSemanticPlanResolver.Resolve("صالة سيتي ستارز بكم", "ar", Today, null, Turn);

        Assert.Equal(AiSemanticGoal.HallDetails, plan.Goal);
        Assert.Equal(AiHallReferenceKind.ExplicitName, plan.HallReference.Kind);
        Assert.Equal("سيتي ستارز", plan.HallReference.Name);
        Assert.Contains(AiRequestedFact.Price, plan.RequestedFacts);
    }

    [Fact]
    public void KeepAreaAndRegionAsSeparateSearchCriteria()
    {
        var plan = AiSemanticPlanResolver.Resolve("حي الرمال", "ar", Today, null, Turn);

        Assert.Equal(AiSemanticGoal.FindHall, plan.Goal);
        Assert.Equal("Gaza", plan.Region);
        Assert.Equal("حي الرمال", plan.Area);
    }

    [Fact]
    public void ResolveComparedOrdinalsOnlyAgainstTheLastResultSet()
    {
        var firstId = Guid.NewGuid();
        var secondId = Guid.NewGuid();
        var thirdId = Guid.NewGuid();
        var state = new AiConversationState(
            ActiveGoal: "find_hall",
            ShownHallIds: [firstId, secondId, thirdId]);
        var context = new AiConversationContext(
            [],
            new AiAssistantIntentDto(AiIntentType.SearchHalls, "Gaza", null, null, null, null),
            [new AiHallRef(firstId, "City Stars"), new AiHallRef(secondId, "Orchid"), new AiHallRef(thirdId, "Palm")],
            State: state);

        var plan = AiSemanticPlanResolver.Resolve("قارن الأولى والثالثة", "ar", Today, context, Turn);

        Assert.Equal(AiSemanticGoal.CompareHalls, plan.Goal);
        Assert.Equal(AiComparisonIntent.CompareSelected, plan.ComparisonIntent);
        Assert.Equal(AiResultSetReferenceKind.LastShown, plan.ResultSetReference?.Kind);
        Assert.Equal(new[] { 0, 2 }, plan.SelectedResultReferences?.Select(reference => reference.Index).ToArray());
    }
}
