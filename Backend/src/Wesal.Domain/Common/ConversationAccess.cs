using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Domain.Common;

/// <summary>
/// Resource-level authorization policy for reading and posting in a conversation
/// (US-ADMIN-05/07, FR-SUB-01/05). It is the single definition of who may see a thread,
/// and it lives here rather than inside <c>ConversationService</c> so that every transport
/// enforces the identical rule.
///
/// WESAL-TASK-10 (Edit 10 follow-up): this type exists because the rule used to be enforced
/// only by the HTTP service methods. The SignalR hub re-implemented the participant check
/// and the attachment download endpoint skipped the owner gate altogether, so an Admin-locked
/// or system-locked hall owner was refused the thread, refused both send paths, refused the
/// conversation read — and still received every live <c>MessageReceived</c> payload and could
/// download the payment-proof image. Partial enforcement of a security rule is not
/// enforcement, so the rule is now stated once and shared by the service, the hub and the
/// live-push filter.
/// </summary>
public static class ConversationAccess
{
    /// <summary>
    /// A conversation's two parties, plus Admins, may take part in it. Used by the HTTP
    /// endpoints and the hub, each of which raises its own transport-appropriate exception
    /// (<see cref="ForbiddenException"/> for HTTP, <c>HubException</c> for SignalR).
    /// </summary>
    public static bool IsParticipant(Conversation conversation, string? userId, bool isAdmin)
    {
        if (isAdmin)
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(userId))
        {
            return false;
        }

        return string.Equals(userId, conversation.SenderUserId, StringComparison.OrdinalIgnoreCase)
            || string.Equals(userId, conversation.HallOwnerId, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Whether the current user may be told about new messages in this conversation right
    /// now. This is the same rule as <see cref="EnsureOwnerMessagingAccess"/> expressed as a
    /// predicate, so the live-push filter can decide delivery without producing exceptions
    /// for a case that is not exceptional.
    /// </summary>
    public static bool CanAccess(Hall? hall, bool isThreadOwner, bool isAdmin)
    {
        if (isAdmin || !isThreadOwner)
        {
            return true;
        }

        if (hall is null || hall.IsDeleted)
        {
            return true;
        }

        if (hall.Status != HallStatus.Approved)
        {
            return true;
        }

        // Edit 4 carve-out, identical to the guard below: waives the PAYMENT requirement
        // only, and only for this thread's own owner.
        if (hall.PaymentStatus != HallPaymentStatus.Paid && !hall.IsAdminLocked && !hall.SystemLocked)
        {
            return true;
        }

        return IsAllowed(hall);
    }

    /// <summary>
    /// Hall-management messaging gate (US-ADMIN-05/07, FR-SUB-01/05): when the current user
    /// is the OWNER of the conversation's hall, an Approved hall's messaging is subject to
    /// <see cref="HallManagementAccess"/> (Admin lock, payment required, system lock).
    /// PendingReview/Rejected hall threads stay open so the owner can read and reply to
    /// review/rejection messages (US-ADMIN-03). Seekers and Admins are never blocked by
    /// this gate.
    ///
    /// WESAL-TASK-4 (Edit 4) carves out one case: the owner of their own owner/Admin
    /// thread may read it and post into it even when the hall is unpaid, because that
    /// thread is exactly where the payment notice lives and where the payment proof is
    /// sent. Without this the notice is unsendable AND unreadable at the precise moment
    /// it is needed: the Admin asks for payment, then cannot let the owner answer.
    ///
    /// The carve-out is deliberately narrow — it applies only to the owner of this
    /// conversation, only inside this thread, and only waives the PAYMENT requirement.
    /// A manual Admin lock and the system lock still apply, so a locked hall is never
    /// waived, and no other HallManagementAccess-gated action (hall management, hall
    /// settings, owner booking actions) is affected: this gate guards conversation
    /// access only. Seekers and Admins are unaffected, and a deleted hall is still
    /// rejected earlier as not-found.
    /// </summary>
    public static void EnsureOwnerMessagingAccess(Hall? hall, bool isThreadOwner, bool isAdmin)
    {
        if (CanAccess(hall, isThreadOwner, isAdmin))
        {
            return;
        }

        // Unreachable while CanAccess stays in step with this call, but the compiler cannot
        // prove it, and a silent fall-through here would be an authorization bypass.
        EnsureDenied(hall!);
    }

    /// <summary>
    /// Raises the same business-rule code the HTTP endpoints use when a hall's messaging is
    /// locked. Exposed so a transport that must not surface a business-rule code (SignalR)
    /// can still fail a join for the right reason.
    /// </summary>
    public static void EnsureDenied(Hall hall) => HallManagementAccess.EnsureAllowed(hall);

    /// <summary>Evaluates the same conjunction <see cref="HallManagementAccess"/> uses.</summary>
    private static bool IsAllowed(Hall hall)
        => !hall.IsAdminLocked
            && hall.PaymentStatus == HallPaymentStatus.Paid
            && !hall.SystemLocked;
}
