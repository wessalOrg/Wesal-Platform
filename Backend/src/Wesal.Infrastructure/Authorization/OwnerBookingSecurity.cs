using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Authorization;

/// <summary>Shared account-security gate for owner booking data and mutations.</summary>
internal static class OwnerBookingSecurity
{
    public static async Task EnsureUnlockedAsync(UserManager<ApplicationUser> users,
        ApplicationUser user, IAccountLockService accountLocks, CancellationToken ct)
    {
        if (await users.IsLockedOutAsync(user)) throw new ForbiddenException("The account is locked.");
        await accountLocks.EnsureUnlockedAsync(user.Id, ct);
    }
}
