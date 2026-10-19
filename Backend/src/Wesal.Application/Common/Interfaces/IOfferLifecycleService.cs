namespace Wesal.Application.Common.Interfaces;

public interface IOfferLifecycleService
{
    Task ProcessAsync(CancellationToken cancellationToken = default);
}
