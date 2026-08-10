export type HomepageIntro = {
  platformName: string;
  tagline: string;
  titleLine1: string;
  titleLine2: string;
  description: string;
  isFallback?: boolean;
};

export type HomepageIntroApiDto = {
  platformNameAr?: string;
  platformNameEn?: string;
  titleAr?: string;
  titleEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  isFallback?: boolean;
};

export type HomepageIntroResponse =
  | HomepageIntroApiDto
  | { data: HomepageIntroApiDto };
