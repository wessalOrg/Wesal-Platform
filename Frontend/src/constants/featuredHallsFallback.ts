import type { FeaturedHall } from "@/types/hall";

/** Demo halls used when featured API is unavailable (design/dev fallback). */
export const FEATURED_HALLS_FALLBACK: FeaturedHall[] = [
  {
    id: "1",
    name: "قاعة رويال",
    imageUrl: "/halls/featured-lotus.webp",
    priceLabel: "1,500 / يوم",
    rating: 4.9,
    reviewCount: 42,
    location: "غزة",
    capacity: 500,
    capacityMax: 800,
    tags: ["مكيفة", "حديقة خارجية", "مولد كهرباء"],
    region: "gaza",
    bookedPeriodsSummary: "15 August · الفترة الأولى",
    availabilityDays: [
      {
        dateLabel: "15 August",
        periods: [
          { label: "الفترة الأولى", time: "12:00 م – 3:00 م", status: "booked" },
          { label: "الفترة الثانية", time: "4:00 م – 8:00 م", status: "available" },
        ],
      },
      {
        dateLabel: "16 August",
        periods: [
          { label: "الفترة الأولى", time: "12:00 م – 3:00 م", status: "available" },
          { label: "الفترة الثانية", time: "4:00 م – 8:00 م", status: "available" },
        ],
      },
    ],
  },
  {
    id: "2",
    name: "قاعة الأندلس",
    imageUrl: "/halls/featured-02.webp",
    priceLabel: "980 / يوم",
    rating: 4.7,
    reviewCount: 28,
    location: "شمال غزة",
    capacity: 350,
    tags: ["كلاسيك", "إضاءة مميزة"],
    region: "north",
    bookedPeriodsSummary: null,
    availabilityDays: [
      {
        dateLabel: "15 August",
        periods: [
          { label: "الفترة الأولى", time: "11:00 ص – 2:00 م", status: "available" },
          { label: "الفترة الثانية", time: "5:00 م – 9:00 م", status: "available" },
        ],
      },
    ],
  },
  {
    id: "3",
    name: "قاعة النخيل الذهبية",
    imageUrl: "/halls/featured-03.webp",
    priceLabel: "1,100 / يوم",
    rating: 4.8,
    reviewCount: 36,
    location: "وسط غزة",
    capacity: 420,
    tags: ["مفتوحة", "حفلة خطوبة"],
    region: "middle",
    bookedPeriodsSummary: "16 August · الفترة الثانية",
    availabilityDays: [
      {
        dateLabel: "16 August",
        periods: [
          { label: "الفترة الأولى", time: "12:00 م – 3:00 م", status: "available" },
          { label: "الفترة الثانية", time: "4:00 م – 8:00 م", status: "booked" },
        ],
      },
    ],
  },
  {
    id: "4",
    name: "قاعة الياسمين",
    imageUrl: "/halls/featured-04.webp",
    priceLabel: "870 / يوم",
    rating: 4.6,
    reviewCount: 19,
    location: "جنوب غزة",
    capacity: 280,
    tags: ["مكيفة", "ديكور حديث"],
    region: "south",
    bookedPeriodsSummary: null,
    availabilityDays: [
      {
        dateLabel: "17 August",
        periods: [
          { label: "الفترة الأولى", time: "1:00 م – 4:00 م", status: "available" },
          { label: "الفترة الثانية", time: "5:00 م – 10:00 م", status: "available" },
        ],
      },
    ],
  },
  {
    id: "5",
    name: "قاعة القمر الفضي",
    imageUrl: "/halls/featured-05.webp",
    priceLabel: "1,400 / يوم",
    rating: 5,
    reviewCount: 51,
    location: "غزة - تل الهوا",
    capacity: 600,
    tags: ["VIP", "موقف سيارات"],
    region: "gaza",
    bookedPeriodsSummary: "18 August · الفترة الأولى",
    availabilityDays: [
      {
        dateLabel: "18 August",
        periods: [
          { label: "الفترة الأولى", time: "12:00 م – 3:00 م", status: "booked" },
          { label: "الفترة الثانية", time: "4:00 م – 8:00 م", status: "booked" },
        ],
      },
    ],
  },
  {
    id: "6",
    name: "قاعة الريحان",
    imageUrl: "/halls/featured-06.webp",
    priceLabel: "750 / يوم",
    rating: 4.5,
    reviewCount: 14,
    location: "رفح",
    capacity: 220,
    tags: ["اقتصادية", "مكيفة"],
    region: "south",
    bookedPeriodsSummary: null,
    availabilityDays: [
      {
        dateLabel: "19 August",
        periods: [
          { label: "الفترة الأولى", time: "12:00 م – 3:00 م", status: "available" },
          { label: "الفترة الثانية", time: "4:00 م – 8:00 م", status: "available" },
        ],
      },
    ],
  },
];
