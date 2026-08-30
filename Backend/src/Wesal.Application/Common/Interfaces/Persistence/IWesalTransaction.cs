namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IWesalTransaction : IAsyncDisposable
{
    Task CommitAsync(CancellationToken cancellationToken = default);

    Task RollbackAsync(CancellationToken cancellationToken = default);
}