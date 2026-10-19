using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Publishing;

public sealed class PostSharingService(
    IPostRepository posts,
    ICurrentUserService currentUser,
    IUnitOfWork unitOfWork,
    IOptions<PostSharingOptions> options,
    TimeProvider clock,
    ILogger<PostSharingService> logger) : IPostSharingService
{
    private static int _missingUrlWarningLogged;

    public async Task<string> GetShareLinkAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        if (await posts.GetPublicAsync(postId, cancellationToken) is null)
            throw new NotFoundException("Post", postId);
        var path = $"/posts/{postId:D}";
        var baseUrl = options.Value.PublicWebBaseUrl?.Trim();
        if (Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
            return $"{uri.GetLeftPart(UriPartial.Authority).TrimEnd('/')}{path}";
        if (Interlocked.Exchange(ref _missingUrlWarningLogged, 1) == 0)
            logger.LogWarning("PostSharing:PublicWebBaseUrl is missing or invalid; returning relative post share links.");
        return path;
    }

    public async Task RegisterShareAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        if (!currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(currentUser.UserId))
            throw new UnauthorizedException("You must be logged in to register a post share.");
        if (await posts.GetPublicAsync(postId, cancellationToken) is null)
            throw new NotFoundException("Post", postId);
        try
        {
            await unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                if (await posts.GetPublicAsync(postId, cancellationToken) is null)
                    throw new NotFoundException("Post", postId);
                await posts.RegisterShareAsync(postId, currentUser.UserId, clock.GetUtcNow(), cancellationToken);
            }, cancellationToken);
        }
        catch (Exception ex) when (ex.Message.Contains("23505", StringComparison.Ordinal)
            || ex.InnerException?.Message.Contains("23505", StringComparison.Ordinal) == true)
        {
            // The unique user/post/UTC-day key makes concurrent retries idempotent.
        }
    }
}
