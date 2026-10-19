namespace Wesal.Domain.Entities;

/// <summary>A user's saved hall ("المفضلة"). (UserId, HallId) is unique.</summary>
public sealed class HallFavorite
{
    public Guid Id { get; set; }

    public string UserId { get; set; } = string.Empty;

    public Guid HallId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
