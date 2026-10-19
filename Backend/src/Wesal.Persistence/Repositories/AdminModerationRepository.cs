using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public sealed class AdminModerationRepository(ApplicationDbContext context) : IAdminModerationRepository
{
    public Task<Post?> GetPostForModerationAsync(Guid id, CancellationToken cancellationToken = default)
        => context.Posts.Include(row => row.Images).FirstOrDefaultAsync(row => row.Id == id, cancellationToken);

    public Task<ProfessionalOffer?> GetOfferForModerationAsync(Guid id, CancellationToken cancellationToken = default)
        => context.ProfessionalOffers.Include(row => row.Images).FirstOrDefaultAsync(row => row.Id == id, cancellationToken);

    public void RemovePost(Post post) => context.Posts.Remove(post);
    public void RemoveOffer(ProfessionalOffer offer) => context.ProfessionalOffers.Remove(offer);

    public async Task<bool> HasHallOrBookingHistoryAsync(string userId, CancellationToken cancellationToken = default)
        => await context.Halls.AnyAsync(row => row.OwnerId == userId, cancellationToken)
            || await context.Bookings.AnyAsync(row => row.RequesterUserId == userId, cancellationToken);

    public async Task<AccountCleanupSnapshot> DeleteProfessionalAccountDataAsync(string userId, CancellationToken cancellationToken = default)
    {
        var user = await context.Users.FirstAsync(row => row.Id == userId, cancellationToken);
        var coordinator = await context.CoordinatorProfiles.FirstOrDefaultAsync(row => row.UserId == userId, cancellationToken);
        var photographer = await context.PhotographerProfiles.FirstOrDefaultAsync(row => row.UserId == userId, cancellationToken);
        var posts = await context.Posts.Include(row => row.Images).Where(row => row.OwnerUserId == userId).ToListAsync(cancellationToken);
        var postIds = posts.Select(row => row.Id).ToArray();
        var offers = await context.ProfessionalOffers.Include(row => row.Images).Where(row => row.OwnerUserId == userId).ToListAsync(cancellationToken);
        var conversations = await context.Conversations.Where(row => row.SenderUserId == userId || row.HallOwnerId == userId).ToListAsync(cancellationToken);
        var conversationIds = conversations.Select(row => row.Id).ToArray();
        var removedMessages = await context.Messages.Where(row => row.SenderUserId == userId || conversationIds.Contains(row.ConversationId)).ToListAsync(cancellationToken);
        var attachmentUrls = removedMessages.Select(row => row.AttachmentUrl).Where(value => !string.IsNullOrWhiteSpace(value)).Select(value => value!).Distinct(StringComparer.Ordinal).ToArray();
        var imageKeys = posts.SelectMany(row => row.Images).Select(row => row.StorageKey)
            .Concat(offers.SelectMany(row => row.Images).Select(row => row.StorageKey))
            .Concat(new[] { user.ProfilePictureStorageKey, user.IdentityDocumentUrl, coordinator?.IdentityDocumentUrl,
                coordinator?.ShopPhotoUrl, coordinator?.WorkPhoto1Url, coordinator?.WorkPhoto2Url,
                photographer?.IdentityDocumentUrl }.Where(value => !string.IsNullOrWhiteSpace(value))!)
            .Select(value => value!).Distinct(StringComparer.Ordinal).ToArray();

        var counts = new Dictionary<string, int>(StringComparer.Ordinal)
        {
            ["posts"] = posts.Count,
            ["offers"] = offers.Count,
            ["conversations"] = conversations.Count,
            ["messages"] = conversationIds.Length == 0 ? 0 : await context.Messages.CountAsync(row => conversationIds.Contains(row.ConversationId), cancellationToken),
            ["comments"] = await context.PostComments.CountAsync(row => row.AuthorUserId == userId || postIds.Contains(row.PostId), cancellationToken),
            ["favorites"] = await context.PostFavorites.CountAsync(row => row.UserId == userId || postIds.Contains(row.PostId), cancellationToken),
            ["shares"] = await context.PostShares.CountAsync(row => row.UserId == userId || postIds.Contains(row.PostId), cancellationToken)
        };

        if (posts.Count != 0) context.Posts.RemoveRange(posts);
        if (offers.Count != 0) context.ProfessionalOffers.RemoveRange(offers);
        context.PostComments.RemoveRange(context.PostComments.Where(row => row.AuthorUserId == userId));
        context.PostFavorites.RemoveRange(context.PostFavorites.Where(row => row.UserId == userId));
        context.PostShares.RemoveRange(context.PostShares.Where(row => row.UserId == userId));
        context.Conversations.RemoveRange(conversations);
        context.Messages.RemoveRange(context.Messages.Where(row => row.SenderUserId == userId));
        context.UserNotifications.RemoveRange(context.UserNotifications.Where(row => row.RecipientUserId == userId));
        context.CoordinatorProfiles.RemoveRange(context.CoordinatorProfiles.Where(row => row.UserId == userId));
        context.PhotographerProfiles.RemoveRange(context.PhotographerProfiles.Where(row => row.UserId == userId));
        context.UserPublishingRestrictions.RemoveRange(context.UserPublishingRestrictions.Where(row => row.UserId == userId));
        context.RevokedTokens.RemoveRange(context.RevokedTokens.Where(row => row.UserId == userId));
        context.AISessions.RemoveRange(context.AISessions.Where(row => row.UserId == userId));
        context.AiConversationSessions.RemoveRange(context.AiConversationSessions.Where(row => row.UserId == userId));
        context.Ratings.RemoveRange(context.Ratings.Where(row => row.UserId == userId));
        context.Comments.RemoveRange(context.Comments.Where(row => row.UserId == userId));
        return new AccountCleanupSnapshot(imageKeys, attachmentUrls, counts);
    }
}
