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

    /// <summary>
    /// True once the Hall Owner has published the accepted booking's period as
    /// Booked (US-OWNER-13). A booking can only be published while Accepted;
    /// publishing permanently marks the requested HallAvailability as Booked and
    /// is irreversible in this model.
    /// </summary>
    public bool IsPublished { get; set; }

    public string? RejectionReason { get; set; }

    public Guid? RejectionMessageId { get; set; }
}