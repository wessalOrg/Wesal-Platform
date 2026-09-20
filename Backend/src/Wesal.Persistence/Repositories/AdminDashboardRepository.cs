using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public class AdminDashboardRepository : IAdminDashboardRepository
{
    private readonly ApplicationDbContext _context;

    public AdminDashboardRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<AdminPendingHallDto>> GetPendingHallsAsync(
        int skip,
        int take,
        CancellationToken cancellationToken = default)
    {
        return await _context.Halls
            .AsNoTracking()
            .Where(hall => hall.Status == HallStatus.PendingReview && !hall.IsDeleted)
            .OrderBy(hall => hall.CreatedAt)
            .ThenBy(hall => hall.Id)
            .Skip(skip)
            .Take(take)
            .Select(hall => new AdminPendingHallDto
            {
                HallId = hall.Id,
                Name = hall.Name,
                ThumbnailUrl = hall.MainImageUrl,
                SubmittedAt = hall.CreatedAt
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<int> GetPendingHallsCountAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Halls
            .CountAsync(hall => hall.Status == HallStatus.PendingReview && !hall.IsDeleted, cancellationToken);
    }

    public async Task<AdminHallDetailRow?> GetHallDetailForAdminAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
    {
        var hall = await _context.Halls
            .AsNoTracking()
            .Include(hall => hall.Images)
            .Include(hall => hall.Features)
            .FirstOrDefaultAsync(hall => hall.Id == hallId && !hall.IsDeleted, cancellationToken);

        if (hall is null)
        {
            return null;
        }

        var owner = string.IsNullOrWhiteSpace(hall.OwnerId)
            ? null
            : await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(user => user.Id == hall.OwnerId, cancellationToken);

        return new AdminHallDetailRow
        {
            HallId = hall.Id,
            Name = hall.Name,
            Region = hall.Region,
            Address = hall.Address,
            DetailedAddress = hall.DetailedAddress,
            Description = hall.Description,
            Capacity = hall.Capacity,
            Price = hall.Price,
            SubmittedAt = hall.CreatedAt,
            Status = hall.Status,
            OwnerId = hall.OwnerId,
            OwnerFullName = owner?.FullName,
            OwnerPhoneNumber = owner?.PhoneNumber,
            OwnerEmail = owner?.Email,
            MainImageUrl = hall.MainImageUrl,
            YouTubeVideoUrl = hall.YouTubeVideoUrl,
            OtherFeatures = hall.OtherFeatures,
            Features = hall.Features
                .Where(feature => !string.IsNullOrWhiteSpace(feature.Name))
                .Select(feature => feature.Name)
                .OrderBy(name => name, StringComparer.Ordinal)
                .ToList(),
            PaymentStatus = hall.PaymentStatus,
            PaymentReceiptUploadedAt = hall.PaymentReceiptUploadedAt,
            HasPaymentReceipt = !string.IsNullOrWhiteSpace(hall.PaymentReceiptUrl),
            OwnerHasIdentityDocument = !string.IsNullOrWhiteSpace(owner?.IdentityDocumentUrl),
            PhotoUrls = hall.Images
                .Where(image => !image.IsDeleted)
                .OrderBy(image => image.DisplayOrder)
                .ThenBy(image => image.CreatedAt)
                .Select(image => image.Url)
                .ToList()
        };
    }

    public async Task<IReadOnlyList<AdminSubscriptionHallRow>> GetSubscriptionOverviewAsync(
        CancellationToken cancellationToken = default)
    {
        return await (
            from hall in _context.Halls.AsNoTracking()
            join owner in _context.Users.AsNoTracking() on hall.OwnerId equals owner.Id into ownerJoin
            from owner in ownerJoin.DefaultIfEmpty()
            where !hall.IsDeleted
            orderby owner!.FullName, hall.Name
            select new AdminSubscriptionHallRow
            {
                HallId = hall.Id,
                Name = hall.Name,
                OwnerId = hall.OwnerId ?? string.Empty,
                OwnerFullName = owner!.FullName,
                OwnerPhoneNumber = owner!.PhoneNumber,
                OwnerEmail = owner!.Email,
                Status = hall.Status,
                PaymentStatus = hall.PaymentStatus,
                SystemLocked = hall.SystemLocked,
                AdminLocked = hall.IsAdminLocked,
                NextBillingDate = hall.SubscriptionCycleEnd,
                LastPaymentDate = hall.SubscriptionCycleStart,
                LockedAt = hall.LockedAt,
                LockedByAdminUserId = hall.LockedByAdminUserId
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Hall>> GetExpiredPaidCyclesAsync(
        DateOnly today,
        CancellationToken cancellationToken = default)
    {
        return await _context.Halls
            .Where(hall => !hall.IsDeleted
                && hall.Status == HallStatus.Approved
                && hall.PaymentStatus == HallPaymentStatus.Paid
                && !hall.SystemLocked
                && hall.SubscriptionCycleEnd != null
                && hall.SubscriptionCycleEnd < today)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Hall>> GetSubscriptionExpiryWarningCandidatesAsync(
        DateOnly today,
        int warningDays,
        CancellationToken cancellationToken = default)
    {
        var triggerDate = today.AddDays(warningDays);

        return await _context.Halls
            .Where(hall => !hall.IsDeleted
                && hall.Status == HallStatus.Approved
                && hall.PaymentStatus == HallPaymentStatus.Paid
                && hall.SubscriptionCycleEnd != null
                && ((hall.SubscriptionCycleEnd == triggerDate && hall.WarningSentForCycleEnd != hall.SubscriptionCycleEnd)
                    || (hall.WarningSentForCycleEnd == hall.SubscriptionCycleEnd
                        && hall.WarningSentAttempts > 0
                        && hall.SubscriptionCycleEnd > today)))
            .ToListAsync(cancellationToken);
    }

    public async Task<string?> GetUserEmailAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        return await _context.Users
            .AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => user.Email)
            .FirstOrDefaultAsync(cancellationToken);
    }
}