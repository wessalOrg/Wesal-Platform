using Wesal.Domain.Entities;

namespace Wesal.Domain.Constants;

/// <summary>
/// The schedule for the "24 hours before an offer ends" reminder (requirements 10.6, 15.5 and 15.9).
///
/// The reminder is due exactly <see cref="LeadTime"/> before <see cref="ProfessionalOffer.EndsAt"/>
/// and is delivered only if a worker processes it inside <see cref="GraceWindow"/> of that moment.
/// The bounded window is deliberate: the reminder must not drift into "the first check during the
/// final 24 hours" (a worker that was down for hours must not deliver a late notice), while a
/// normal amount of scheduling jitter still delivers it. Overlapping workers cannot double-send
/// because the claim is an atomic conditional update on <see cref="ProfessionalOffer.ReminderSentAt"/>.
///
/// <see cref="ProfessionalOffer.ReminderEligible"/> is the creation-time gate that records whether a
/// "24 hours before" moment even exists: an offer created less than <see cref="LeadTime"/> before its
/// end is never eligible, so it can never receive a late reminder.
/// </summary>
public static class OfferReminderSchedule
{
    /// <summary>How long before the end the reminder is due (24 hours).</summary>
    public static readonly TimeSpan LeadTime = TimeSpan.FromHours(24);

    /// <summary>
    /// How long after its due moment a reminder may still be delivered. Sized to a small multiple of
    /// the lifecycle worker interval (~5 minutes) so ordinary jitter is tolerated but a real outage
    /// does not resurrect the notice hours late.
    /// </summary>
    public static readonly TimeSpan GraceWindow = TimeSpan.FromMinutes(15);

    /// <summary>The instant the reminder is due for an offer (<c>EndsAt - 24h</c>).</summary>
    public static DateTimeOffset DueAt(ProfessionalOffer offer) => offer.EndsAt - LeadTime;

    /// <summary>
    /// Whether the offer is currently a reminder candidate for the given instant: eligible, never
    /// edited/stopped/expired, not already reminded, and processed inside the due window.
    /// </summary>
    public static bool IsDue(ProfessionalOffer offer, DateTimeOffset now)
    {
        if (!offer.ReminderEligible || offer.HasBeenEdited || offer.ReminderSentAt is not null
            || offer.StoppedAt is not null || offer.ExpiredProcessedAt is not null) return false;
        var due = DueAt(offer);
        return IsInWindow(due, offer.EndsAt, now);
    }

    /// <summary>
    /// Whether <paramref name="now"/> falls in <c>[due, due + GraceWindow)</c> and still before the
    /// offer end. Shared by the production query bounds and the in-memory test repository.
    /// </summary>
    public static bool IsInWindow(DateTimeOffset due, DateTimeOffset endsAt, DateTimeOffset now)
        => now >= due && now < due + GraceWindow && now < endsAt;
}
