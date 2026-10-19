using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

/// <summary>
/// EF Core writer for durably persisted notifications (WESAL coordinator setup,
/// minimum reusable support). Adds without saving so the notification commits in the
/// same unit-of-work transaction as the business state it announces.
/// </summary>
public sealed class UserNotificationWriter : IUserNotificationWriter
{
    private readonly ApplicationDbContext _context;

    public UserNotificationWriter(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(UserNotification notification, CancellationToken cancellationToken = default)
        => await _context.UserNotifications.AddAsync(notification, cancellationToken);
}
