using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IAiKnowledgeGapRecorder
{
    Task<Guid?> RecordAsync(AiKnowledgeGapCandidate candidate, CancellationToken cancellationToken = default);
}

public enum AiKnowledgeGapOutcome
{
    TrustedAnswer,
    GenericNoTrustedAnswer,
    NoMatchingHalls,
    NeedsDateClarification,
    ComingSoonCapability,
    UnsupportedWriteAction,
    OperationalFailure,
    NegativeFeedback
}

public interface IAiKnowledgeGapDetector
{
    bool IsRecordable(AiKnowledgeGapOutcome outcome);
}
