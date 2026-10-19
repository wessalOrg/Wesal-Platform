namespace Wesal.Application.Common.Interfaces;

public interface IPostSharingService
{
    Task<string> GetShareLinkAsync(Guid postId, CancellationToken cancellationToken = default);
    Task RegisterShareAsync(Guid postId, CancellationToken cancellationToken = default);
}
