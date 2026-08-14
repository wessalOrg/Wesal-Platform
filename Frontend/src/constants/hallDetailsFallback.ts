import type { HallDetail } from "@/types/hall";
import { FEATURED_HALLS_FALLBACK } from "@/constants/featuredHallsFallback";

const GALLERY = [
  "/halls/featured-lotus.webp",
  "/halls/featured-02.webp",
  "/halls/featured-03.webp",
  "/halls/featured-04.webp",
];

/** Rich demo data for hall details when API is unavailable (US-LAND-04). */
export const HALL_DETAILS_FALLBACK: Record<string, HallDetail> = {
  "1": {
    id: "1",
    name: "قصر الزهراء",
    description:
      "قصر الزهراء من أرقى قاعات الأفراح في غزة، يتميز بتصميم فاخر يجمع بين الأناقة الكلاسيكية واللمسات العصرية. القاعة مجهّزة بإضاءة احترافية، نظام صوت متكامل، ومساحات واسعة للاستقبال والتصوير. فريقنا يساعدك في تنسيق كل تفاصيل حفلتك من الاستقبال حتى نهاية الفترة.",
    location: "غزة — تل الهوا",
    region: "gaza",
    capacity: 500,
    capacityMax: 800,
    amenities: [
      "مكيفة",
      "حديقة خارجية",
      "مولد كهرباء",
      "موقف سيارات",
      "نظام صوت",
      "إضاءة LED",
      "غرفة تجهيز العروس",
      "خدمة ضيافة",
    ],
    gallery: GALLERY,
    mainImageUrl: "/halls/featured-lotus.webp",
    slotPrices: [
      {
        label: "الفترة الصباحية",
        time: "12:00 – 15:00",
        price: 1200,
        priceLabel: "1,200 ₪",
      },
      {
        label: "الفترة المسائية",
        time: "16:00 – 20:00",
        price: 1500,
        priceLabel: "1,500 ₪",
      },
    ],
    ownerPhone: "+970599000001",
    isActive: true,
    rating: 4.9,
    reviewCount: 42,
    availabilityDays: [
      {
        dateLabel: "15 August",
        periods: [
          { label: "الفترة الأولى", time: "12:00 – 15:00", status: "booked" },
          { label: "الفترة الثانية", time: "16:00 – 20:00", status: "available" },
        ],
      },
      {
        dateLabel: "16 August",
        periods: [
          { label: "الفترة الأولى", time: "12:00 – 15:00", status: "available" },
          { label: "الفترة الثانية", time: "16:00 – 20:00", status: "available" },
        ],
      },
      {
        dateLabel: "17 August",
        periods: [
          { label: "الفترة الأولى", time: "12:00 – 15:00", status: "available" },
          { label: "الفترة الثانية", time: "16:00 – 20:00", status: "booked" },
        ],
      },
    ],
  },
  "2": {
    id: "2",
    name: "قاعة الأندلس",
    description:
      "قاعة الأندلس بطابع كلاسيكي راقٍ، مناسبة للحفلات المتوسطة مع ديكور دافئ وإضاءة مميزة.",
    location: "شمال غزة",
    region: "north",
    capacity: 350,
    amenities: ["كلاسيك", "إضاءة مميزة", "مكيفة", "موقف سيارات"],
    gallery: ["/halls/featured-02.webp", "/halls/featured-05.webp"],
    mainImageUrl: "/halls/featured-02.webp",
    slotPrices: [
      { label: "الفترة الصباحية", time: "11:00 – 14:00", price: 780, priceLabel: "780 ₪" },
      { label: "الفترة المسائية", time: "17:00 – 21:00", price: 980, priceLabel: "980 ₪" },
    ],
    ownerPhone: "+970599000002",
    isActive: true,
    rating: 4.7,
    reviewCount: 28,
    availabilityDays: [
      {
        dateLabel: "15 August",
        periods: [
          { label: "الفترة الأولى", time: "11:00 – 14:00", status: "available" },
          { label: "الفترة الثانية", time: "17:00 – 21:00", status: "available" },
        ],
      },
    ],
  },
  "inactive-demo": {
    id: "inactive-demo",
    name: "قاعة غير متاحة (تجريبي)",
    description: "هذه القاعة غير نشطة حالياً.",
    location: "غزة",
    region: "gaza",
    capacity: 200,
    amenities: [],
    gallery: [],
    mainImageUrl: "/halls/featured-06.webp",
    slotPrices: [],
    isActive: false,
  },
};

export function getHallDetailsFallback(id: string): HallDetail | null {
  if (HALL_DETAILS_FALLBACK[id]) return HALL_DETAILS_FALLBACK[id];

  const featured = FEATURED_HALLS_FALLBACK.find((hall) => hall.id === id);
  if (!featured) return null;

  const basePrice = featured.priceLabel
    ? Number.parseFloat(featured.priceLabel.replace(/[^\d.]/g, ""))
    : null;

  return {
    id: featured.id,
    name: featured.name,
    description:
      featured.tags?.length
        ? `قاعة ${featured.name} في ${featured.location}، مجهّزة بـ ${featured.tags.join("، ")}.`
        : `قاعة ${featured.name} في ${featured.location}.`,
    location: featured.location,
    region: featured.region,
    capacity: featured.capacity,
    capacityMax: featured.capacityMax ?? null,
    amenities: featured.tags ?? [],
    gallery: [featured.imageUrl],
    mainImageUrl: featured.imageUrl,
    slotPrices: basePrice
      ? [
          {
            label: "الفترة الصباحية",
            price: basePrice,
            priceLabel: `${basePrice.toLocaleString("en-US")} ₪`,
          },
          {
            label: "الفترة المسائية",
            price: basePrice,
            priceLabel: `${basePrice.toLocaleString("en-US")} ₪`,
          },
        ]
      : [],
    isActive: true,
    rating: featured.rating ?? null,
    reviewCount: featured.reviewCount ?? null,
    availabilityDays: featured.availabilityDays ?? [],
  };
}
