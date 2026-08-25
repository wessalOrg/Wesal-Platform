using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Wesal.Domain.Common;

namespace Wesal.Domain.Entities;

public class AISession : BaseEntity
{
    [MaxLength(450)]
    public string? SessionId { get; set; }

    public bool IsGuestSession { get; set; }

    [MaxLength(450)]
    public string? UserId { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? LastAccessedAt { get; set; }

    [MaxLength(500)]
    public string? Status { get; set; }

    [MaxLength(500)]
    public string? AiServiceStatus { get; set; }

    [MaxLength(450)]
    public string? GuestIdentifier { get; set; }

    public bool IsExpired => LastAccessedAt.HasValue && DateTimeOffset.UtcNow - LastAccessedAt > TimeSpan.FromHours(24);
}