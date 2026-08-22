import type { UiLang } from "@/lib/language";
import type {
  FeaturedHall,
  HallAvailabilityDay,
  HallDetail,
  HallDetails,
  HallReview,
  HallSlotPrice,
} from "@/types/hall";

/** Common Arabic → English phrase map for demo/UI hall content. */
const PHRASE_EN: Record<string, string> = {
  "الفترة الأولى": "First period",
  "الفترة الثانية": "Second period",
  "الفترة الصباحية": "Morning period",
  "الفترة المسائية": "Evening period",
  يوم: "day",
  "/ يوم": "/ day",
  " / يوم": " / day",
  "₪ / يوم": "₪ / day",
  مفتوحة: "Open",
  مغلقة: "Closed",
  مكيفة: "Air-conditioned",
  "حديقة خارجية": "Outdoor garden",
  "مولد كهرباء": "Generator",
  حديقة: "Garden",
  كلاسيك: "Classic",
  "إضاءة مميزة": "Special lighting",
  "حفلة خطوبة": "Engagement party",
  "حفلة زفاف": "Wedding party",
  "حفلات كبرى": "Large events",
  "موقف سيارات": "Parking",
  اقتصادية: "Budget-friendly",
  "ديكور حديث": "Modern décor",
  "ديكور فاخر": "Luxury décor",
  إطلالة: "View",
  "نظام صوت": "Sound system",
  "إضاءة LED": "LED lighting",
  "غرفة تجهيز العروس": "Bridal suite",
  "خدمة ضيافة": "Hospitality service",
  VIP: "VIP",
  "منذ أسبوع": "1 week ago",
  "منذ أسبوعين": "2 weeks ago",
  "هذه القاعة غير نشطة حالياً.": "This hall is currently inactive.",
  "قاعة غير متاحة (تجريبي)": "Unavailable hall (demo)",
};

const LOCATION_EN: Record<string, string> = {
  غزة: "Gaza",
  "شمال غزة": "North Gaza",
  "وسط غزة": "Middle Gaza",
  "جنوب غزة": "South Gaza",
  "غزة - تل الهوا": "Gaza — Tel al-Hawa",
  "غزة — تل الهوا": "Gaza — Tel al-Hawa",
  رفح: "Rafah",
  جباليا: "Jabalia",
  "تل الهوا": "Tel al-Hawa",
  "خان يونس": "Khan Yunis",
  النصيرات: "Nuseirat",
  الشجاعية: "Al-Shuja'iyya",
  "بيت لاهيا": "Beit Lahia",
  "دير البلح": "Deir al-Balah",
  الرمال: "Al-Rimal",
  الكورنيش: "Corniche",
  "بيت حانون": "Beit Hanoun",
};

const HALL_NAME_EN: Record<string, string> = {
  "1": "Royal Hall",
  "2": "Andalus Hall",
  "3": "Golden Palm Hall",
  "4": "Yasmin Hall",
  "5": "Silver Moon Hall",
  "6": "Rayhan Hall",
  "7": "Olive Hall",
  "8": "Firdous Hall",
  "9": "Sawsan Hall",
  "10": "Noor Hall",
  "11": "Karama Hall",
  "12": "Amal Hall",
  "13": "White Yasmin Hall",
  "14": "Sham Hall",
  "15": "Sea Hall",
  "16": "Rose Hall",
  "17": "Diamond Hall",
  "18": "Salam Hall",
  "19": "Pearl Hall",
  "20": "Sanabel Hall",
  "21": "Oasis Hall",
  "22": "Carmel Hall",
  "23": "Bustan Hall",
  "24": "Fayrouz Hall",
  "قاعة رويال": "Royal Hall",
  "قاعة رويال الفاخرة": "Royal Luxury Hall",
  "قاعة الأندلس": "Andalus Hall",
  "قاعة النخيل الذهبية": "Golden Palm Hall",
  "قاعة الياسمين": "Yasmin Hall",
  "قاعة القمر الفضي": "Silver Moon Hall",
  "قاعة الريحان": "Rayhan Hall",
  "قاعة الزيتون": "Olive Hall",
  "قاعة الفردوس": "Firdous Hall",
  "قاعة السوسن": "Sawsan Hall",
  "قاعة النور": "Noor Hall",
  "قاعة الكرامة": "Karama Hall",
  "قاعة الأمل": "Amal Hall",
  "قاعة الياسمين البيضاء": "White Yasmin Hall",
  "قاعة الشام": "Sham Hall",
  "قاعة البحر": "Sea Hall",
  "قاعة الوردة": "Rose Hall",
  "قاعة الماس": "Diamond Hall",
  "قاعة السلام": "Salam Hall",
  "قاعة اللؤلؤة": "Pearl Hall",
  "قاعة السنابل": "Sanabel Hall",
  "قاعة الواحة": "Oasis Hall",
  "قاعة الكرمل": "Carmel Hall",
  "قاعة البستان": "Bustan Hall",
  "قاعة الفيروز": "Fayrouz Hall",
  "قصر الزهراء": "Zahra Palace",
};

const DESCRIPTION_EN: Record<string, string> = {
  "1": "A hall with a modern classic design that blends luxury and simplicity, with spacious areas and carefully planned lighting.",
  "2": "Andalus Hall has a classic character and distinctive lighting — ideal for mid-size events in North Gaza.",
  "3": "Golden Palm Hall offers an open atmosphere suited to engagement parties and outdoor celebrations.",
  "4": "Yasmin Hall features modern décor and full air-conditioning — a practical choice for events in South Gaza.",
  "5": "Silver Moon Hall has large capacity, VIP facilities, and guest parking.",
  "6": "Rayhan Hall is a budget-friendly air-conditioned option for small and mid-size events in Rafah.",
  "قصر الزهراء من أرقى قاعات الأفراح في غزة، يتميز بتصميم فاخر يجمع بين الأناقة الكلاسيكية واللمسات العصرية. القاعة مجهّزة بإضاءة احترافية، نظام صوت متكامل، ومساحات واسعة للاستقبال والتصوير. فريقنا يساعدك في تنسيق كل تفاصيل حفلتك من الاستقبال حتى نهاية الفترة.":
    "Zahra Palace is one of Gaza’s finest wedding halls, with a luxurious design that mixes classic elegance and modern touches. It offers professional lighting, a full sound system, and wide spaces for reception and photography. Our team helps coordinate every detail of your celebration from arrival to the end of the period.",
  "قاعة الأندلس بطابع كلاسيكي راقٍ، مناسبة للحفلات المتوسطة مع ديكور دافئ وإضاءة مميزة.":
    "Andalus Hall has an elegant classic character, suited to mid-size celebrations with warm décor and distinctive lighting.",
  "قاعة بتصميم كلاسيكي عصري، تجمع بين الفخامة والبساطة، وتوفر مساحات واسعة مع إضاءة مدروسة بعناية.":
    "A hall with a modern classic design that blends luxury and simplicity, with spacious areas and carefully planned lighting.",
  "قاعة الأندلس بطابع كلاسيك وإضاءة مميزة، مثالية للحفلات المتوسطة في شمال غزة.":
    "Andalus Hall has a classic character and distinctive lighting — ideal for mid-size events in North Gaza.",
  "قاعة النخيل الذهبية بأجواء مفتوحة مناسبة لحفلات الخطوبة والمناسبات الخارجية.":
    "Golden Palm Hall offers an open atmosphere suited to engagement parties and outdoor celebrations.",
  "قاعة الياسمين بديكور حديث وتكييف كامل، خيار عملي للمناسبات في جنوب غزة.":
    "Yasmin Hall features modern décor and full air-conditioning — a practical choice for events in South Gaza.",
  "قاعة القمر الفضي بسعة كبيرة ومرافق VIP وموقف سيارات للضيوف.":
    "Silver Moon Hall has large capacity, VIP facilities, and guest parking.",
  "قاعة الريحان خيار اقتصادي مكيّف للمناسبات الصغيرة والمتوسطة في رفح.":
    "Rayhan Hall is a budget-friendly air-conditioned option for small and mid-size events in Rafah.",
};

const REVIEW_EN: Record<string, { author: string; comment: string; timeAgo: string }> = {
  r1: {
    author: "Ahmad Mohammad",
    comment: "A wonderful experience — the hall is extremely luxurious and the service was excellent.",
    timeAgo: "1 week ago",
  },
  r2: {
    author: "Sara Khaled",
    comment: "The venue was perfect and the organization was truly professional.",
    timeAgo: "2 weeks ago",
  },
  "تجربة رائعة والقاعة غاية في الفخامة والخدمة ممتازة.": {
    author: "Ahmad Mohammad",
    comment: "A wonderful experience — the hall is extremely luxurious and the service was excellent.",
    timeAgo: "1 week ago",
  },
  "المكان مثالي جداً والتنظيم كان احترافياً.": {
    author: "Sara Khaled",
    comment: "The venue was perfect and the organization was truly professional.",
    timeAgo: "2 weeks ago",
  },
};

function mapPhrase(value: string, lang: UiLang): string {
  if (lang !== "en") return value;
  return PHRASE_EN[value] ?? value;
}

export function localizePriceLabel(label: string | null | undefined, lang: UiLang): string | null {
  if (!label) return null;
  if (lang !== "en") return label;
  return label
    .replace(/\s*\/\s*يوم/g, " / day")
    .replace(/يوم/g, "day");
}

export function localizeHallName(id: string, name: string, lang: UiLang): string {
  if (lang !== "en") return name;
  return HALL_NAME_EN[id] ?? HALL_NAME_EN[name] ?? name;
}

export function localizeLocation(location: string, lang: UiLang): string {
  if (lang !== "en") return location;
  return LOCATION_EN[location] ?? location;
}

export function localizeTag(tag: string, lang: UiLang): string {
  return mapPhrase(tag, lang);
}

export function localizePeriodLabel(label: string, lang: UiLang): string {
  return mapPhrase(label, lang);
}

export function localizeBookedSummary(
  summary: string | null | undefined,
  lang: UiLang,
): string | null {
  if (!summary) return null;
  if (lang !== "en") return summary;
  return summary
    .replace(/الفترة الأولى/g, "First period")
    .replace(/الفترة الثانية/g, "Second period");
}

export function localizeDescription(
  id: string,
  description: string | null | undefined,
  lang: UiLang,
  extras?: { name?: string; location?: string; tags?: string[] },
): string | null {
  if (!description) return null;
  if (lang !== "en") return description;
  const mapped = DESCRIPTION_EN[id] ?? DESCRIPTION_EN[description];
  if (mapped) return mapped;
  if (extras?.name && extras.location && /[\u0600-\u06FF]/.test(description)) {
    const name = localizeHallName(id, extras.name, lang);
    const location = localizeLocation(extras.location, lang);
    const tags = (extras.tags ?? []).map((tag) => localizeTag(tag, lang));
    if (tags.length) {
      return `${name} in ${location}, equipped with ${tags.join(", ")}.`;
    }
    return `${name} in ${location}.`;
  }
  return description;
}

export function localizeSlotPrices(
  slots: HallSlotPrice[],
  lang: UiLang,
): HallSlotPrice[] {
  if (lang !== "en") return slots;
  return slots.map((slot) => ({
    ...slot,
    label: localizePeriodLabel(slot.label, lang),
    priceLabel: localizePriceLabel(slot.priceLabel, lang) ?? slot.priceLabel,
    time: slot.time
      ?.replace(/\s*م\b/g, " PM")
      .replace(/\s*ص\b/g, " AM"),
  }));
}

export function localizeAvailabilityDays(
  days: HallAvailabilityDay[] | undefined,
  lang: UiLang,
): HallAvailabilityDay[] | undefined {
  if (!days) return days;
  if (lang !== "en") return days;
  return days.map((day) => ({
    ...day,
    periods: day.periods.map((period) => ({
      ...period,
      label: localizePeriodLabel(period.label, lang),
      time: period.time
        ?.replace(/\s*م\b/g, " PM")
        .replace(/\s*ص\b/g, " AM"),
    })),
  }));
}

export function localizeReviews(reviews: HallReview[], lang: UiLang): HallReview[] {
  if (lang !== "en") return reviews;
  return reviews.map((review) => {
    const mapped = REVIEW_EN[review.id] ?? REVIEW_EN[review.comment];
    if (!mapped) {
      return {
        ...review,
        timeAgo: mapPhrase(review.timeAgo, lang),
      };
    }
    return {
      ...review,
      author: mapped.author,
      comment: mapped.comment,
      timeAgo: mapped.timeAgo,
    };
  });
}

export function localizeFeaturedHall(hall: FeaturedHall, lang: UiLang): FeaturedHall {
  if (lang !== "en") return hall;
  return {
    ...hall,
    name: localizeHallName(hall.id, hall.name, lang),
    location: localizeLocation(hall.location, lang),
    priceLabel: localizePriceLabel(hall.priceLabel, lang),
    tags: hall.tags?.map((tag) => localizeTag(tag, lang)),
    bookedPeriodsSummary: localizeBookedSummary(hall.bookedPeriodsSummary, lang),
    availabilityDays: localizeAvailabilityDays(hall.availabilityDays, lang),
  };
}

export function localizeHallDetails(hall: HallDetails, lang: UiLang): HallDetails {
  if (lang !== "en") return hall;
  return {
    ...hall,
    name: localizeHallName(hall.id, hall.name, lang),
    location: localizeLocation(hall.location, lang),
    priceLabel: localizePriceLabel(hall.priceLabel, lang),
    description: localizeDescription(hall.id, hall.description, lang, {
      name: hall.name,
      location: hall.location,
      tags: hall.amenities.map((item) => item.label),
    }),
    amenities: hall.amenities.map((item) => ({
      ...item,
      label: localizeTag(item.label, lang),
    })),
    reviews: localizeReviews(hall.reviews, lang),
    availabilityDays: localizeAvailabilityDays(hall.availabilityDays, lang),
  };
}

export function localizeHallDetail(hall: HallDetail, lang: UiLang): HallDetail {
  if (lang !== "en") return hall;
  return {
    ...hall,
    name: localizeHallName(hall.id, hall.name, lang),
    location: localizeLocation(hall.location, lang),
    description:
      localizeDescription(hall.id, hall.description, lang, {
        name: hall.name,
        location: hall.location,
        tags: hall.amenities,
      }) ?? hall.description,
    amenities: hall.amenities.map((tag) => localizeTag(tag, lang)),
    slotPrices: localizeSlotPrices(hall.slotPrices, lang),
    availabilityDays: localizeAvailabilityDays(hall.availabilityDays, lang),
  };
}
