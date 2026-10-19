namespace Wesal.Domain.Entities;

/// <summary>A single accepted public post or professional-profile detail view.</summary>
public sealed class ContentViewEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string OwnerUserId { get; set; } = string.Empty;
    public Guid? PostId { get; set; }
    public string? ProfileUserId { get; set; }
    public DateTimeOffset ViewedAt { get; set; }
}
