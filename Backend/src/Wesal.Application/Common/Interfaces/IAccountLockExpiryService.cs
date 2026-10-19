namespace Wesal.Application.Common.Interfaces;

public interface IAccountLockExpiryService
{
    Task<int> ProcessExpiredAsync(string? userId = null, CancellationToken cancellationToken = default);
}
