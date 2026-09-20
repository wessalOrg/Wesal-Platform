namespace Wesal.Domain.Entities;

/// <summary>
/// A single feature of a hall (US-HALL). Features are selected from the predefined
/// catalog in <c>HallFeatureCatalog</c>; the canonical stored name is the Arabic
/// display string. Stored per-hall so the public hall details can render them directly.
/// </summary>
public class HallFeature
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid HallId { get; set; }

    public Hall Hall { get; set; } = null!;

    public string Name { get; set; } = string.Empty;
}