using System.ComponentModel.DataAnnotations;
using Wesal.Domain.Common;

namespace Wesal.Domain.Entities;

public class RevokedToken : BaseEntity
{
    [MaxLength(450)]
    public string Jti { get; set; } = string.Empty;

    [MaxLength(450)]
    public string UserId { get; set; } = string.Empty;

    public DateTimeOffset RevokedAt { get; set; } = DateTimeOffset.UtcNow;
}