namespace Wesal.Application.Common.Models;

public sealed class CreateRatingRequest
{
    public Guid HallId { get; init; }

    public int Value { get; init; }
}

public sealed class UpdateRatingRequest
{
    public Guid HallId { get; init; }

    public int Value { get; init; }
}

public sealed class RatingResponse
{
    public Guid RatingId { get; init; }

    public Guid HallId { get; init; }

    public int Value { get; init; }

    public double AverageRating { get; init; }

    public int TotalRatings { get; init; }
}

public sealed class HallRatingSummary
{
    public Guid HallId { get; init; }

    public double AverageRating { get; init; }

    public int TotalRatings { get; init; }

    public int? UserRating { get; init; }
}
