import type { HomepageIntro } from "@/types/homepage";

/** Fallback when GET /homepage/introduction is unavailable (US-LAND-01). */
export const HOMEPAGE_INTRO_FALLBACK: HomepageIntro = {
  platformName: "وصال",
  tagline: "لأن التفاصيل الجميلة تبدأ من هنا",
  titleLine1: "اختر المكان",
  titleLine2: "الذي يليق بيومك",
  description:
    "اكتشف مجموعة مختارة من القاعات واجعل مناسبتك كما تخيلتها.",
  isFallback: true,
};
