export type PostImage = {
  id: string;
  url: string;
  order: number;
};

/** Public post payload (`PublicProfileContentDto` for posts). */
export type Post = {
  id: string;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerAvatarUrl: string | null;
  ownerRole: string | null;
  content: string | null;
  price: number | null;
  saveCount: number;
  shareCount: number;
  commentCount: number;
  isSavedByCurrentUser: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  images: PostImage[];
};

export type PostComment = {
  id: string;
  postId: string;
  text: string;
  authorUserId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  parentCommentId: string | null;
  replyToCommentId: string | null;
  replyCount: number;
  createdAt: string;
};

export type FavoritePost = {
  id: string;
  ownerUserId: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
  content: string | null;
  price: number | null;
  saveCount: number;
  savedAt: string;
  images: PostImage[];
};

export type PublicProfessionalProfile = {
  userId: string;
  role: string | null;
  displayName: string | null;
  bio: string | null;
  profilePictureUrl: string | null;
  shopName: string | null;
  studioName: string | null;
  shopLocation: string | null;
  studioLocation: string | null;
  isPubliclyAvailable: boolean;
  posts: Post[];
  offers: import("@/types/offers").ProfessionalOffer[];
};

export type PagedResult<T> = {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};
