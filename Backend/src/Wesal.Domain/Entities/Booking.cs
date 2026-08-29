using Wesal.Domain.Common;
using Wesal.Domain.Enums;

namespace Wesal.Domain.Entities;

public class Booking : BaseAuditableEntity
{
    public Guid HallId { get; set; }

    public Hall Hall { get; set; } = null!;

    public string RequesterUserId { get; set; } = string.Empty;

    public DateOnly Date { get; set; }

    public BookingPeriodType Period { get; set; }

    public BookingStatus Status { get; set; } = BookingStatus.Pending;

    public string? RejectionReason { get; set; }

    public Guid? RejectionMessageId { get; set; }
}