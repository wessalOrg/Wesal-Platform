using Wesal.Domain.Common;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IUnitOfWork
{
    IGenericRepository<TEntity> Repository<TEntity>()
        where TEntity : BaseEntity;

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
