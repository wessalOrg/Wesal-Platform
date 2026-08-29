"use client";

import AiHallNoResults from "@/components/assistant/AiHallNoResults";
import AiHallRecommendationCard from "@/components/assistant/AiHallRecommendationCard";
import { useAiHallNavigation } from "@/hooks/useAiHallNavigation";
import type {
  AiExtractedCriteria,
  AiRecommendedHall,
  RecommendationStatus,
} from "@/types/ai-chat";

type AiHallRecommendationListProps = {
  halls: AiRecommendedHall[];
  status: RecommendationStatus | null;
  criteria?: AiExtractedCriteria | null;
};

export function hasRecommendationSurface(
  halls: AiRecommendedHall[],
  status: RecommendationStatus | null,
): boolean {
  if (halls.length > 0) return true;
  return status === "NoResults";
}

/**
 * Renders recommend results (or a no-results card) under an assistant bubble.
 * Navigation lives in `useAiHallNavigation`, not in the chat engine.
 */
export default function AiHallRecommendationList({
  halls,
  status,
  criteria = null,
}: AiHallRecommendationListProps) {
  const { openHall, prefetch, pendingId, notice } = useAiHallNavigation();

  if (!hasRecommendationSurface(halls, status)) return null;

  if (status === "NoResults" || halls.length === 0) {
    return (
      <div className="mt-2" data-testid="ai-chat-recommendations">
        <AiHallNoResults criteria={criteria} />
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2" data-testid="ai-chat-recommendations">
      {halls.map((hall) => (
        <AiHallRecommendationCard
          key={hall.hallId || hall.hallName}
          hall={hall}
          criteria={criteria}
          pending={pendingId === hall.hallId}
          noticeKey={notice?.hallId === hall.hallId ? notice.messageKey : null}
          onOpen={openHall}
          onPrefetch={prefetch}
        />
      ))}
    </div>
  );
}
