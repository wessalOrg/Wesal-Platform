using Wesal.Domain.Common;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IUnitOfWork
{
    IGenericRepository<TEntity> Repository<TEntity>()
        where TEntity : BaseEntity;

    Task<IWesalTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
