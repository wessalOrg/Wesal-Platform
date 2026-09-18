using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Bookings;

/// <summary>
/// Publishes an accepted booking's booked period as Booked on behalf of the
/// authenticated Hall Owner (US-OWNER-13, FR-BOOK-06). The owner is resolved from
/// the JWT session; ownership is enforced by comparing the session user id to the
/// persisted hall owner id so a caller can never publish another owner's booking.
///
/// Publishing is only valid for a booking that is Accepted and not yet published.
/// Before the atomic publish, a mandatory final server-side availability re-check
/// rejects the request when any other active (Pending or Accepted) booking claims
/// the exact same hall/date/period, and the exact HallAvailability period is
/// reserved as Booked so the published period is definitively excluded from public
/// availability. Only the booking's own requested period is ever touched.
///
/// The publish-vs-publish (and publish-vs-state-change) race is resolved at the
/// database level via an atomic conditional UPDATE (PublishAcceptedAsync): exactly
/// one wins per row, and a lost race surfaces as a ConflictException. The whole
/// operation runs inside a single database transaction so a failure never leaves
/// partial state (published booking with a released period, or vice versa).
/// </summary>
public sealed class BookingPublishingService : IBookingPublishingService
{
    private readonly IBookingRepository _bookingRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUser;

    public BookingPublishingService(
        IBookingRepository bookingRepository,
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUser)
    {
        _bookingRepository = bookingRepository;
        _unitOfWork = unitOfWork;
        _currentUser = currentUser;
    }

    public async Task<PublishBookingResultDto> PublishBookingAsync(
        Guid hallId,
        Guid bookingId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        EnsureAuthenticatedHallOwner();

        var booking = await _bookingRepository.GetByIdWithHallAsync(bookingId, cancellationToken);

        if (booking is null
            || booking.HallId != hallId
            || booking.Hall?.IsDeleted == true)
        {
            throw new NotFoundException(nameof(Booking), bookingId);
        }

        EnsureHallOwnership(booking);

        HallManagementAccess.EnsureAllowed(booking.Hall!);

        EnsurePublishable(booking);

        IWesalTransaction? transaction = null;

        try
        {
            transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);

            // Mandatory final server-side availability re-check: the requested
            // hall/date/period must still be claimable by this booking alone.
            var hasCompetingClaim = await _bookingRepository.HasOtherActiveBookingsAsync(
                booking.HallId,
                booking.Date,
                booking.Period,
                booking.Id,
                cancellationToken);

            if (hasCompetingClaim)
            {
                throw new ConflictException(
                    "The requested booking period is claimed by another active booking and cannot be published.");
            }

            // Guarantee the exact period is publicly Booked (reserved where a row
            // is missing or was released) without touching any other period/date.
            await _bookingRepository.ReservePeriodAsync(
                booking.HallId,
                booking.Date,
                booking.Period,
                cancellationToken);

            var publishedRows = await _bookingRepository.PublishAcceptedAsync(
                booking.Id,
                cancellationToken);

            if (publishedRows == 0)
            {
                throw new ConflictException(
                    "The booking has already been published or is no longer in the accepted state.");
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            throw;
        }
        finally
        {
            if (transaction is not null)
            {
                await transaction.DisposeAsync();
            }
        }

        return MapToResult(booking);
    }

    private void EnsureAuthenticatedHallOwner()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to publish a booking period.");
        }

        if (!_currentUser.Roles.Contains(ApplicationRoles.HallOwner, StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Only the hall owner can publish a booking period.");
        }
    }

    private void EnsureHallOwnership(Booking booking)
    {
        if (!string.Equals(_currentUser.UserId, booking.Hall?.OwnerId, StringComparison.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Only the hall owner can publish this booking period.");
        }
    }

    private static void EnsurePublishable(Booking booking)
    {
        if (booking.IsPublished)
        {
            throw new ConflictException("The booking period has already been published.");
        }

        if (booking.Status != BookingStatus.Accepted)
        {
            throw new ConflictException(BuildNotAcceptedMessage(booking.Status));
        }
    }

    private static string BuildNotAcceptedMessage(BookingStatus status)
        => status switch
        {
            BookingStatus.Pending => "The booking request is still pending and cannot be published; accept it first.",
            BookingStatus.Rejected => "The booking request was rejected and cannot be published.",
            BookingStatus.Cancelled => "The booking request has been cancelled and cannot be published.",
            _ => "The booking is not in the accepted state and cannot be published."
        };

    private static PublishBookingResultDto MapToResult(Booking booking)
        => new()
        {
            BookingId = booking.Id,
            HallId = booking.HallId,
            HallName = booking.Hall?.Name ?? string.Empty,
            RequesterUserId = booking.RequesterUserId,
            Date = booking.Date,
            Period = booking.Period,
            Status = booking.Status,
            IsPublished = true
        };
}