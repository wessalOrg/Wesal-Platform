# Mabrouk Knowledge Studio and V3 gap-capture seam

## Branch boundary

This feature was built in a separate worktree from the current V3 branch. Do not cherry-pick it into the active V3 checkout while that work is in progress. The Studio supplies a scoped IAiKnowledgeGapRecorder and IAiKnowledgeGapDetector, but this branch does not wire either into AiAssistantService.ProcessMessageAsync.

## Recommended V3 integration point

AiAssistantService.ProcessMessageAsync resolves the turn through RouteAsync, adds contextual actions, records route metadata, and returns the final response. On the finalized V3 branch, add the gap-capture call after the route has produced its final response and before the normal return. Keep early returns for resumed availability and other typed outcomes outside this hook.

Do not infer a gap from the answer text or from AiAssistantResponseKind.Answer alone. Add or preserve a typed outcome on the route result that distinguishes GenericNoTrustedAnswer from successful knowledge answers, no matching halls, date clarification, Coming Soon capability answers, unsupported write requests, and operational failures. Pass only GenericNoTrustedAnswer to the detector. NegativeFeedback may be recorded later from the explicit feedback endpoint after the feedback action is verified.

The intended call has this shape:

1. The V3 route marks the resolved outcome as GenericNoTrustedAnswer only when no trusted source supplied an answer and the final result is the generic safe fallback.
2. The route calls IAiKnowledgeGapDetector.IsRecordable(outcome).
3. For an allowed result, it calls IAiKnowledgeGapRecorder.RecordAsync with the bounded original question, detected language, coarse reason, route label, and occurrence time.
4. The recorder performs its own redaction, normalization, sample cap, and clustering. Do not pass conversation history, response text, user IDs, bearer headers, tool payloads, or session state.
5. Recording failure is best-effort and must not fail or delay the user-facing assistant response. Log only the exception type or a fixed diagnostic code, never the question or provider payload.

The hook must not record successful trusted answers, empty hall search results, unavailable/Coming Soon answers, booking/write refusals, clarification questions, or operational failures. It must not alter routing, response wording, assistant state, or capabilities.

## Validation after V3 is finalized

On the merged feature branch, add tests proving each excluded outcome stays out of the inbox, a true generic fallback creates one redacted cluster, repeated normalized questions increment a cluster, and recorder failure does not change the assistant response. Run the existing conversation-state and offline evaluation suite as well as the Studio lifecycle tests.
