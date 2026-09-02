namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IUnitOfWork
{
    Task<IWesalTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
