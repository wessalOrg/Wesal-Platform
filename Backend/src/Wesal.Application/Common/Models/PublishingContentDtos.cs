namespace Wesal.Application.Common.Models;

public sealed class CreatePostRequest
{
    public string? Content { get; init; }
    public decimal? Price { get; init; }
    public IReadOnlyList<OwnerDocumentUpload> Images { get; init; } = [];
}

public sealed class UpdatePostRequest
{
    public string? Content { get; init; }
    public decimal? Price { get; init; }
    public bool ReplaceImages { get; init; }
    public IReadOnlyList<Guid> KeepImageIds { get; init; } = [];
    public IReadOnlyList<OwnerDocumentUpload> Images { get; init; } = [];
}

public class CreateProfessionalOfferRequest
{
    public string? Content { get; init; }
    public decimal OldPrice { get; init; }
    public decimal OfferPrice { get; init; }
    public decimal? PriceBox { get; init; }
    public DateTimeOffset StartsAt { get; init; }
    public DateTimeOffset EndsAt { get; init; }
    public IReadOnlyList<OwnerDocumentUpload> Images { get; init; } = [];
}

public sealed class UpdateProfessionalOfferRequest : CreateProfessionalOfferRequest
{
    public bool ReplaceImages { get; init; }
    public IReadOnlyList<Guid> KeepImageIds { get; init; } = [];
}

public class CreateHallOfferRequest
{
    public decimal OldBookingPrice { get; init; }
    public decimal OfferPrice { get; init; }
    public DateTimeOffset StartsAt { get; init; }
    public DateTimeOffset EndsAt { get; init; }
}

public sealed class UpdateHallOfferRequest : CreateHallOfferRequest
{
}

public sealed class PublicProfileImageDto
{
    public Guid Id { get; init; }
    public string Url { get; init; } = string.Empty;
    public int Order { get; init; }
}

public sealed class PostResponse
{
    public Guid Id { get; init; }
    public int SaveCount { get; init; }
    public string OwnerUserId { get; init; } = string.Empty;
    public string? Content { get; init; }
    public decimal? Price { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? UpdatedAt { get; init; }
    public IReadOnlyList<PublicProfileImageDto> Images { get; init; } = [];
}

public sealed class ProfessionalOfferResponse
{
    public Guid Id { get; init; }
    public string OwnerUserId { get; init; } = string.Empty;
    public string? Content { get; init; }
    public decimal OldPrice { get; init; }
    public decimal OfferPrice { get; init; }
    public decimal? PriceBox { get; init; }
    public DateTimeOffset StartsAt { get; init; }
    public DateTimeOffset EndsAt { get; init; }
    public DateTimeOffset? StoppedAt { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public IReadOnlyList<PublicProfileImageDto> Images { get; init; } = [];
}

public sealed class HallOfferDto
{
    public Guid Id { get; init; }
    public Guid HallId { get; init; }
    public string HallName { get; init; } = string.Empty;
    public string? MainImageUrl { get; init; }
    public decimal OldBookingPrice { get; init; }
    public decimal OfferPrice { get; init; }
    public DateTimeOffset StartsAt { get; init; }
    public DateTimeOffset EndsAt { get; init; }
    public DateTimeOffset? StoppedAt { get; init; }
}
