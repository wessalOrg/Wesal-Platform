using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Models;

public sealed class PostAuthorPublicData
{
    public string UserId { get; init; } = string.Empty;
    public string? FullName { get; init; }
    public string? ProfilePictureUrl { get; init; }
    public string? CoordinatorBusinessName { get; init; }
    public string? PhotographerStudioName { get; init; }
}

public sealed record PostFavoriteWithPost(PostFavorite Favorite, Post Post);
