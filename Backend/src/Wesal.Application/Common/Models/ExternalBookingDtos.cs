namespace Wesal.Application.Common.Models;

public sealed record ExternalBookingRequest
{
    public string CustomerName { get; init; } = "";
    public string Phone { get; init; } = "";
    public string EventType { get; init; } = "";
    public DateOnly Date { get; init; }
    public IReadOnlyList<TimeOnly> SlotStarts { get; init; } = [];
    public int? Guests { get; init; }
    public string Notes { get; init; } = "";
    public decimal? TotalAmount { get; init; }
    public decimal? AmountReceivedExternally { get; init; }
}

public sealed record CancelExternalBookingRequest(string Reason = "");
public sealed record ExternalBookingDto(
    Guid BookingId, Guid HallId, string Source, string Status, DateOnly Date,
    IReadOnlyList<TimeOnly> SlotStarts, string TimeRange, long Revision,
    string CustomerName, string Phone, string EventType, int? Guests, string Notes,
    decimal? TotalAmount, decimal? AmountReceivedExternally,
    DateTimeOffset ConfirmedAt, DateTimeOffset? CancelledAt, string? CancellationReason,
    bool CanEdit, bool CanCancel, bool CanConfirmDeposit = false, bool CanDelete = false);
public sealed record ExternalBookingPage(IReadOnlyList<ExternalBookingDto> Items, int Page, int PageSize);
public sealed record ExternalBookingAuditDto(long Revision, string Operation, string ActorUserId,
    DateTimeOffset OccurredAt, string? BeforeJson, string AfterJson);
