namespace Wesal.Application.Common.Models;

/// <summary>Public card shared by Discover and Search. Only safe display fields are projected.</summary>
public sealed class DiscoverItemDto
{
    public string ContentType { get; init; } = string.Empty;
    public Guid Id { get; init; }
    public string? OwnerUserId { get; init; }
    public string? DisplayName { get; init; }
    public string? Content { get; init; }
    public string? ImageUrl { get; init; }
    public string? Location { get; init; }
    public decimal? Price { get; init; }
    public decimal? OldPrice { get; init; }
    public decimal? OfferPrice { get; init; }
    public DateTimeOffset? StartsAt { get; init; }
    public DateTimeOffset? EndsAt { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

public sealed class PostStatisticsItemDto
{
    public Guid PostId { get; init; }
    public string? Content { get; init; }
    public int SaveCount { get; init; }
    public int ShareCount { get; init; }
    /// <summary>Total successful public post-detail requests; repeated requests count separately.</summary>
    public int ViewCount { get; init; }
}

public sealed class OwnerStatisticsDto
{
    public int PageNumber { get; init; }
    public int PageSize { get; init; }
    public int TotalPosts { get; init; }
    /// <summary>Total successful public profile-detail requests; repeated requests count separately.</summary>
    public int ProfileViewCount { get; init; }
    public int TotalSaveCount { get; init; }
    public int TotalShareCount { get; init; }
    /// <summary>Total successful public post-detail requests across the owner's posts; not unique viewers.</summary>
    public int TotalPostViewCount { get; init; }
    public IReadOnlyList<PostStatisticsItemDto> Posts { get; init; } = [];
}
