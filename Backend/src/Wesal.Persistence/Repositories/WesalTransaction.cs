using Microsoft.EntityFrameworkCore.Storage;
using Wesal.Application.Common.Interfaces.Persistence;

namespace Wesal.Persistence.Repositories;

public sealed class WesalTransaction : IWesalTransaction
{
    private readonly IDbContextTransaction _transaction;
    private bool _completed;

    public WesalTransaction(IDbContextTransaction transaction)
    {
        _transaction = transaction;
    }

    public async Task CommitAsync(CancellationToken cancellationToken = default)
    {
        await _transaction.CommitAsync(cancellationToken);
        _completed = true;
    }

    public async Task RollbackAsync(CancellationToken cancellationToken = default)
    {
        await _transaction.RollbackAsync(cancellationToken);
        _completed = true;
    }

    public async ValueTask DisposeAsync()
    {
        if (!_completed)
        {
            await _transaction.RollbackAsync();
        }

        await _transaction.DisposeAsync();
    }
}