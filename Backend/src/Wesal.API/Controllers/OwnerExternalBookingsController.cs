using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Exceptions;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/owner/halls/{hallId:guid}/external-bookings")]
[Authorize(Policy = ApplicationPolicies.RequireHallOwner)]
public sealed class OwnerExternalBookingsController(IOwnerExternalBookingService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<ExternalBookingDto>> Create(Guid hallId, ExternalBookingRequest request, CancellationToken ct)
    {
        var result = await service.CreateAsync(hallId, request, Key(), ct);
        SetETag(result);
        return CreatedAtAction(nameof(Get), new { version = "1", hallId, bookingId = result.BookingId }, result);
    }

    [HttpGet]
    public Task<ExternalBookingPage> List(Guid hallId, [FromQuery] DateOnly fromDate, [FromQuery] DateOnly toDate,
        CancellationToken ct, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        => service.ListAsync(hallId, fromDate, toDate, page, pageSize, ct);

    [HttpGet("{bookingId:guid}")]
    public async Task<ExternalBookingDto> Get(Guid hallId, Guid bookingId, CancellationToken ct)
    {
        var result = await service.GetAsync(hallId, bookingId, ct);
        SetETag(result);
        return result;
    }

    [HttpGet("{bookingId:guid}/history")]
    public Task<IReadOnlyList<ExternalBookingAuditDto>> History(Guid hallId, Guid bookingId, CancellationToken ct)
        => service.HistoryAsync(hallId, bookingId, ct);

    [HttpPut("{bookingId:guid}")]
    public async Task<ExternalBookingDto> Update(Guid hallId, Guid bookingId, ExternalBookingRequest request, CancellationToken ct)
    {
        var result = await service.UpdateAsync(hallId, bookingId, request, Key(), Revision(), ct);
        SetETag(result);
        return result;
    }

    [HttpPost("{bookingId:guid}/cancel")]
    public async Task<ExternalBookingDto> Cancel(Guid hallId, Guid bookingId, CancelExternalBookingRequest request, CancellationToken ct)
    {
        var result = await service.CancelAsync(hallId, bookingId, request, Key(), Revision(), ct);
        SetETag(result);
        return result;
    }

    private string Key()
    {
        if (Request.Headers["Idempotency-Key"].Count != 1)
            throw new ExternalBookingException(400, "IdempotencyKeyRequired", "Supply one UUID Idempotency-Key.");
        return Request.Headers["Idempotency-Key"].ToString();
    }

    // Zero is checked inside the service AFTER receipt replay, allowing a committed retry
    // to succeed even when its revision is now stale. A first cancellation needs If-Match.
    private long Revision()
    {
        var value = Request.Headers.IfMatch.ToString();
        if (value.Length < 3 || value[0] != '"' || value[^1] != '"' || !long.TryParse(value[1..^1], out var revision) || revision <= 0)
            return 0;
        return revision;
    }

    private void SetETag(ExternalBookingDto result) => Response.Headers.ETag = $"\"{result.Revision}\"";
}
