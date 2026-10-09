using System.ComponentModel.DataAnnotations;

namespace Wesal.Domain.Entities;

/// <summary>
/// Short-lived, bounded assistant memory. This is separate from AISession, which
/// records authentication/session telemetry and is not a conversation store.
/// </summary>
public sealed class AiConversationSession
{
    [Key]
    public Guid SessionId { get; set; }

    [MaxLength(450)]
    public string? UserId { get; set; }

    [Required, MaxLength(8)]
    public string Language { get; set; } = "ar";

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset LastActivityAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }

    /// <summary>Optimistic concurrency token used to prevent multi-instance lost updates.</summary>
    public int Revision { get; set; }

    [Required, MaxLength(20_000)]
    public string TurnsJson { get; set; } = "[]";

    [MaxLength(8_000)]
    public string? LastIntentJson { get; set; }

    [MaxLength(4_000)]
    public string? LastHallsJson { get; set; }

    [MaxLength(1_000)]
    public string? LastHallJson { get; set; }
}
