import { FEATURED_HALLS_FALLBACK } from "@/constants/featuredHallsFallback";
import {
  DEFAULT_HALL_AMENITIES,
  type HallDetails,
  type HallReview,
} from "@/types/hall";

const DESCRIPTIONS: Record<string, string> = {
  "1": "قاعة بتصميم كلاسيكي عصري، تجمع بين الفخامة والبساطة، وتوفر مساحات واسعة مع إضاءة مدروسة بعناية.",
  "2": "قاعة الأندلس بطابع كلاسيك وإضاءة مميزة، مثالية للحفلات المتوسطة في شمال غزة.",
  "3": "قاعة النخيل الذهبية بأجواء مفتوحة مناسبة لحفلات الخطوبة والمناسبات الخارجية.",
  "4": "قاعة الياسمين بديكور حديث وتكييف كامل، خيار عملي للمناسبات في جنوب غزة.",
  "5": "قاعة القمر الفضي بسعة كبيرة ومرافق VIP وموقف سيارات للضيوف.",
  "6": "قاعة الريحان خيار اقتصادي مكيّف للمناسبات الصغيرة والمتوسطة في رفح.",
  "7": "قاعة الزيتون بمساحة مفتوحة وحديقة، مناسبة للحفلات في شمال غزة.",
  "8": "قاعة الفردوس بخدمات VIP وتكييف كامل، خيار فاخر للمناسبات الكبيرة.",
  "9": "قاعة السوسن بديكور ناعم وسعة مناسبة لحفلات الخطوبة في خان يونس.",
  "10": "قاعة النور بإضاءة مميزة وأجواء مفتوحة في المنطقة الوسطى.",
  "11": "قاعة الكرامة بسعة متوسطة وموقف سيارات، خيار عملي داخل غزة.",
  "12": "قاعة الأمل بخدمات VIP مناسبة لحفلات الزفاف في بيت لاهيا.",
  "13": "قاعة الياسمين البيضاء خيار اقتصادي مناسب للمناسبات في دير البلح.",
  "14": "قاعة الشام بديكور فاخر وسعة كبيرة في منطقة الرمال.",
  "15": "قاعة البحر بأجواء مفتوحة وإطلالة قريبة من الكورنيش.",
  "16": "قاعة الوردة بحديقة مناسبة لحفلات الخطوبة في بيت حانون.",
  "17": "قاعة الماس خيار VIP للحفلات الكبرى في الشيخ رضوان.",
  "18": "قاعة السلام سعة مريحة وخيار اقتصادي في عبسان.",
  "19": "قاعة اللؤلؤة بديكور فاخر وتكييف كامل في حي الزيتون.",
  "20": "قاعة السنابل بمساحة مفتوحة وحديقة مناسبة للمناسبات في بيت حانون.",
  "21": "قاعة الواحة بخدمات VIP وإضاءة مميزة في المغازي.",
  "22": "قاعة الكرمل خيار عملي لحفلات الخطوبة في خان يونس.",
  "23": "قاعة البستان بحديقة خارجية وسعة كبيرة في جباليا البلد.",
  "24": "قاعة الفيروز بموقف سيارات وتكييف مناسب للمناسبات في رفح الغربية.",
};

const LOCATIONS: Record<string, string> = {
  "1": "جنوب مدينة غزة",
};

const NAMES: Record<string, string> = {
  "1": "قاعة رويال الفاخرة",
};

export const DEMO_HALL_REVIEWS: HallReview[] = [
  {
    id: "r1",
    author: "أحمد محمد",
    rating: 5,
    comment: "تجربة رائعة والقاعة غاية في الفخامة والخدمة ممتازة.",
    timeAgo: "منذ أسبوع",
  },
  {
    id: "r2",
    author: "سارة خالد",
    rating: 5,
    comment: "المكان مثالي جداً والتنظيم كان احترافياً.",
    timeAgo: "منذ أسبوعين",
  },
];

/** Demo hall details when GET /halls/:id is unavailable. */
export const HALL_DETAILS_FALLBACK: HallDetails[] = FEATURED_HALLS_FALLBACK.map(
  (hall, index) => {
    const extras = FEATURED_HALLS_FALLBACK.filter((_, i) => i !== index).slice(
      0,
      3,
    );
    const isRoyal = hall.id === "1";

    return {
      id: hall.id,
      name: NAMES[hall.id] ?? hall.name,
      location: LOCATIONS[hall.id] ?? hall.location,
      region: hall.region,
      capacity: hall.capacity,
      capacityMax: hall.capacityMax ?? null,
      priceLabel: isRoyal ? "1500 ₪ / يوم" : hall.priceLabel,
      rating: isRoyal ? 4.9 : hall.rating,
      reviewCount: isRoyal ? 124 : hall.reviewCount,
      description: DESCRIPTIONS[hall.id] ?? null,
      amenities: DEFAULT_HALL_AMENITIES,
      reviews: DEMO_HALL_REVIEWS,
      images: [hall.imageUrl, ...extras.map((item) => item.imageUrl)],
      isAvailable: true,
      isOwner: false,
      availabilityDays: hall.availabilityDays ?? [],
    };
  },
);

export function findHallDetailsFallback(id: string): HallDetails | undefined {
  return HALL_DETAILS_FALLBACK.find((hall) => hall.id === String(id));
}
