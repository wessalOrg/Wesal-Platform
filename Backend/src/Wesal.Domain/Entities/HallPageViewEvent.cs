namespace Wesal.Domain.Entities;

/// <summary>A single accepted public hall-details page view for owner visitor statistics.</summary>
public sealed class HallPageViewEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid HallId { get; set; }

    public DateTimeOffset ViewedAt { get; set; }
}
