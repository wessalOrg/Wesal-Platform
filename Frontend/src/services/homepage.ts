import api from "@/lib/api";
import { HOMEPAGE_INTRO_FALLBACK } from "@/constants/homepageFallback";
import type {
  HomepageIntro,
  HomepageIntroApiDto,
  HomepageIntroResponse,
} from "@/types/homepage";

function normalizePayload(payload: HomepageIntroResponse): HomepageIntroApiDto {
  if ("data" in payload && payload.data) return payload.data;
  return payload as HomepageIntroApiDto;
}

function mapIntro(dto: HomepageIntroApiDto): HomepageIntro {
  const platformName = dto.platformNameAr?.trim();
  const tagline = dto.titleAr?.trim();
  const description = dto.descriptionAr?.trim();

  if (!platformName || !tagline || !description) {
    throw new Error("Homepage intro response is incomplete");
  }

  return {
    platformName,
    tagline,
    titleLine1: HOMEPAGE_INTRO_FALLBACK.titleLine1,
    titleLine2: HOMEPAGE_INTRO_FALLBACK.titleLine2,
    description,
    isFallback: dto.isFallback ?? false,
  };
}

/**
 * Homepage hero copy (US-LAND-01).
 * GET /v1/homepage/introduction
 */
export async function fetchHomepageIntro(): Promise<HomepageIntro> {
  try {
    const { data } = await api.get<HomepageIntroResponse>(
      "/homepage/introduction",
      { timeout: 2500 },
    );
    return mapIntro(normalizePayload(data));
  } catch {
    return { ...HOMEPAGE_INTRO_FALLBACK, isFallback: true };
  }
}
