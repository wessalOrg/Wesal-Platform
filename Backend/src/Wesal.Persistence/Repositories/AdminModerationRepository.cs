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

    public async Task<AccountCleanupSnapshot> DeleteProfessionalAccountDataAsync(string userId, CancellationToken cancellationToken = default)
    {
        var user = await context.Users.FirstAsync(row => row.Id == userId, cancellationToken);
        var coordinator = await context.CoordinatorProfiles.FirstOrDefaultAsync(row => row.UserId == userId, cancellationToken);
        var photographer = await context.PhotographerProfiles.FirstOrDefaultAsync(row => row.UserId == userId, cancellationToken);
        var ownedHalls = await context.Halls.Where(row => row.OwnerId == userId && !row.IsDeleted).ToListAsync(cancellationToken);
        var posts = await context.Posts.Include(row => row.Images).Where(row => row.OwnerUserId == userId).ToListAsync(cancellationToken);
        var postIds = posts.Select(row => row.Id).ToArray();
        var offers = await context.ProfessionalOffers.Include(row => row.Images).Where(row => row.OwnerUserId == userId).ToListAsync(cancellationToken);
        var conversations = await context.Conversations.Where(row => row.SenderUserId == userId || row.HallOwnerId == userId).ToListAsync(cancellationToken);
        var conversationIds = conversations.Select(row => row.Id).ToArray();
        // Conversations are shared records: removing the account must not erase messages
        // authored by its customers or the administration. Remove only the deleted user's
        // own messages and keep the conversation history available to surviving participants.
        var removedMessages = await context.Messages.Where(row => row.SenderUserId == userId).ToListAsync(cancellationToken);
        var attachmentUrls = removedMessages.Select(row => row.AttachmentUrl).Where(value => !string.IsNullOrWhiteSpace(value)).Select(value => value!).Distinct(StringComparer.Ordinal).ToArray();
        var imageKeys = posts.SelectMany(row => row.Images).Select(row => row.StorageKey)
            .Concat(offers.SelectMany(row => row.Images).Select(row => row.StorageKey))
            .Concat(new[] { user.ProfilePictureStorageKey, user.IdentityDocumentUrl, coordinator?.IdentityDocumentUrl,
                coordinator?.ShopPhotoUrl, coordinator?.WorkPhoto1Url, coordinator?.WorkPhoto2Url,
                photographer?.IdentityDocumentUrl }.Where(value => !string.IsNullOrWhiteSpace(value))!)
            .Select(value => value!).Distinct(StringComparer.Ordinal).ToArray();

        var counts = new Dictionary<string, int>(StringComparer.Ordinal)
        {
            ["halls"] = ownedHalls.Count,
            ["posts"] = posts.Count,
            ["offers"] = offers.Count,
            ["messages"] = removedMessages.Count,
            ["comments"] = await context.PostComments.CountAsync(row => row.AuthorUserId == userId || postIds.Contains(row.PostId), cancellationToken),
            ["favorites"] = await context.PostFavorites.CountAsync(row => row.UserId == userId || postIds.Contains(row.PostId), cancellationToken),
            ["shares"] = await context.PostShares.CountAsync(row => row.UserId == userId || postIds.Contains(row.PostId), cancellationToken)
        };

        // Hall and booking rows are shared business history. Hide and detach owned halls
        // rather than cascading their bookings, slots, or other users' booking records.
        foreach (var hall in ownedHalls)
        {
            hall.IsDeleted = true;
            hall.OwnerId = null;
        }

        if (posts.Count != 0) context.Posts.RemoveRange(posts);
        if (offers.Count != 0) context.ProfessionalOffers.RemoveRange(offers);
        context.PostComments.RemoveRange(context.PostComments.Where(row => row.AuthorUserId == userId));
        context.PostFavorites.RemoveRange(context.PostFavorites.Where(row => row.UserId == userId));
        context.PostShares.RemoveRange(context.PostShares.Where(row => row.UserId == userId));
        context.Messages.RemoveRange(removedMessages);
        context.ConversationReadStates.RemoveRange(context.ConversationReadStates.Where(row => row.UserId == userId));
        context.UserNotifications.RemoveRange(context.UserNotifications.Where(row => row.RecipientUserId == userId));
        context.UserNotifications.RemoveRange(context.UserNotifications.Where(row => row.ConversationId != null
            && conversationIds.Contains(row.ConversationId.Value) && row.GroupSenderUserId == userId));
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
