/** Mapped `PostStatisticsItemDto`. */
export type PostStatisticsItem = {
  postId: string;
  content: string | null;
  saveCount: number;
  shareCount: number;
  viewCount: number;
};

/** Mapped `OwnerStatisticsDto` from GET /statistics/me. */
export type OwnerStatistics = {
  pageNumber: number;
  pageSize: number;
  totalPosts: number;
  profileViewCount: number;
  totalSaveCount: number;
  totalShareCount: number;
  totalPostViewCount: number;
  posts: PostStatisticsItem[];
};

export type StatisticsPeriodId = "30d" | "7d" | "all";
