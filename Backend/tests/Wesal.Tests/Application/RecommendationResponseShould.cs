using Wesal.Application.Common.Models;

namespace Wesal.Tests.Application;

public class RecommendationResponseShould
{
    [Fact]
    public void SuccessResponse_HasCorrectStatus()
    {
        var response = CreateSuccessResponse();

        Assert.Equal(RecommendationStatus.Success, response.Status);
    }

    [Fact]
    public void SuccessResponse_ContainsRecommendations()
    {
        var response = CreateSuccessResponse();

        Assert.NotEmpty(response.Recommendations);
        Assert.Equal(2, response.Recommendations.Count);
    }

    [Fact]
    public void SuccessResponse_ContainsExtractedCriteria()
    {
        var response = CreateSuccessResponse();

        Assert.NotNull(response.ExtractedCriteria);
        Assert.Equal("Gaza", response.ExtractedCriteria.Region);
        Assert.Equal("Al-Nasr", response.ExtractedCriteria.Area);
        Assert.Equal(new DateOnly(2026, 8, 2), response.ExtractedCriteria.Date);
    }

    [Fact]
    public void SuccessResponse_HasUserFriendlyMessage()
    {
        var response = CreateSuccessResponse();

        Assert.NotNull(response.Message);
        Assert.NotEmpty(response.Message);
    }

    [Fact]
    public void IncompleteCriteriaResponse_HasCorrectStatus()
    {
        var response = new RecommendationResponse(
            RecommendationStatus.IncompleteCriteria,
            new ExtractedCriteriaDto("Gaza", null, null, null, null),
            Array.Empty<HallRecommendationDto>(),
            "Please provide a date to find available halls.",
            DateTime.UtcNow);

        Assert.Equal(RecommendationStatus.IncompleteCriteria, response.Status);
        Assert.Empty(response.Recommendations);
    }

    [Fact]
    public void NoResultsResponse_HasCorrectStatus()
    {
        var response = new RecommendationResponse(
            RecommendationStatus.NoResults,
            new ExtractedCriteriaDto("Gaza", "Al-Nasr", new DateOnly(2026, 8, 2), "FirstPeriod", 200),
            Array.Empty<HallRecommendationDto>(),
            "No halls found matching your criteria.",
            DateTime.UtcNow);

        Assert.Equal(RecommendationStatus.NoResults, response.Status);
        Assert.Empty(response.Recommendations);
    }

    [Fact]
    public void AiUnavailableResponse_HasCorrectStatus()
    {
        var response = new RecommendationResponse(
            RecommendationStatus.AiUnavailable,
            null,
            Array.Empty<HallRecommendationDto>(),
            "The recommendation service is temporarily unavailable.",
            DateTime.UtcNow);

        Assert.Equal(RecommendationStatus.AiUnavailable, response.Status);
        Assert.Null(response.ExtractedCriteria);
    }

    [Fact]
    public void HallRecommendationDto_AvailableHall_HasNoUnavailableReason()
    {
        var hall = new HallRecommendationDto(
            Guid.NewGuid(), "Test Hall", "Gaza", "Al-Nasr", 300, 5000m, null, true, null);

        Assert.True(hall.IsAvailable);
        Assert.Null(hall.UnavailableReason);
    }

    [Fact]
    public void HallRecommendationDto_UnavailableHall_HasReason()
    {
        var hall = new HallRecommendationDto(
            Guid.NewGuid(), "Test Hall", "Gaza", "Al-Nasr", 300, 5000m, null, false, "Booked for the requested date.");

        Assert.False(hall.IsAvailable);
        Assert.Equal("Booked for the requested date.", hall.UnavailableReason);
    }

    [Fact]
    public void HallRecommendationDto_ContainsAllRequiredFields()
    {
        var hallId = Guid.NewGuid();
        var hall = new HallRecommendationDto(
            hallId, "Grand Hall", "Gaza", "Al-Nasr", 500, 8000m, "https://img.example.com/hall.jpg", true, null);

        Assert.Equal(hallId, hall.HallId);
        Assert.Equal("Grand Hall", hall.HallName);
        Assert.Equal("Gaza", hall.Region);
        Assert.Equal("Al-Nasr", hall.Address);
        Assert.Equal(500, hall.Capacity);
        Assert.Equal(8000m, hall.Price);
        Assert.Equal("https://img.example.com/hall.jpg", hall.MainImage);
    }

    [Fact]
    public void ExtractedCriteriaDto_AllFieldsNull_IsValid()
    {
        var criteria = new ExtractedCriteriaDto(null, null, null, null, null);

        Assert.Null(criteria.Region);
        Assert.Null(criteria.Area);
        Assert.Null(criteria.Date);
        Assert.Null(criteria.BookingPeriod);
        Assert.Null(criteria.Capacity);
    }

    [Fact]
    public void ExtractedCriteriaDto_AllFieldsPopulated_IsValid()
    {
        var criteria = new ExtractedCriteriaDto(
            "Gaza", "Al-Nasr", new DateOnly(2026, 8, 2), "FirstPeriod", 300);

        Assert.Equal("Gaza", criteria.Region);
        Assert.Equal("Al-Nasr", criteria.Area);
        Assert.Equal(new DateOnly(2026, 8, 2), criteria.Date);
        Assert.Equal("FirstPeriod", criteria.BookingPeriod);
        Assert.Equal(300, criteria.Capacity);
    }

    [Fact]
    public void RecommendationStatus_AllValues_Exist()
    {
        Assert.Equal(0, (int)RecommendationStatus.Success);
        Assert.Equal(1, (int)RecommendationStatus.IncompleteCriteria);
        Assert.Equal(2, (int)RecommendationStatus.NoResults);
        Assert.Equal(3, (int)RecommendationStatus.AiUnavailable);
    }

    [Fact]
    public void RecommendationResponse_RecordEquality_Works()
    {
        var timestamp = DateTime.UtcNow;
        var msg = "test";
        var criteria = new ExtractedCriteriaDto("Gaza", null, null, null, null);

        var a = new RecommendationResponse(
            RecommendationStatus.Success, criteria, Array.Empty<HallRecommendationDto>(), msg, timestamp);
        var b = new RecommendationResponse(
            RecommendationStatus.Success, criteria, Array.Empty<HallRecommendationDto>(), msg, timestamp);

        Assert.Equal(a, b);
    }

    [Fact]
    public void RecommendationResponse_RecordInequality_Works()
    {
        var timestamp = DateTime.UtcNow;

        var a = new RecommendationResponse(
            RecommendationStatus.Success, null, Array.Empty<HallRecommendationDto>(), "msg1", timestamp);
        var b = new RecommendationResponse(
            RecommendationStatus.NoResults, null, Array.Empty<HallRecommendationDto>(), "msg2", timestamp);

        Assert.NotEqual(a, b);
    }

    private static RecommendationResponse CreateSuccessResponse()
    {
        var criteria = new ExtractedCriteriaDto("Gaza", "Al-Nasr", new DateOnly(2026, 8, 2), "FirstPeriod", 200);

        var halls = new List<HallRecommendationDto>
        {
            new(Guid.NewGuid(), "Grand Hall", "Gaza", "Al-Nasr", 300, 5000m, null, true, null),
            new(Guid.NewGuid(), "Al-Noor Hall", "Gaza", "Al-Nasr", 250, 4500m, null, true, null)
        };

        return new RecommendationResponse(
            RecommendationStatus.Success,
            criteria,
            halls,
            "Found 2 halls matching your criteria.",
            DateTime.UtcNow);
    }
}
