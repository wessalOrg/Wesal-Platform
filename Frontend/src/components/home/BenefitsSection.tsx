const BENEFITS = [
  {
    title: "وصول أوسع للعملاء",
    description:
      "اعرض قاعتك أمام الباحثين عن المكان المناسب لمناسباتهم ووسّع حضورك على المنصة.",
    icon: "users" as const,
  },
  {
    title: "إدارة الحجوزات بسهولة",
    description: "تابع طلبات الحجز والمواعيد ونظّمها من مكان واحد بكل سهولة.",
    icon: "calendar" as const,
  },
  {
    title: "عرض احترافي لقاعتك",
    description:
      "اعرض صور قاعتك وتفاصيلها وخدماتها بطريقة أنيقة تساعد العملاء على التعرّف عليها.",
    icon: "gallery" as const,
  },
  {
    title: "تواصل مباشر مع العملاء",
    description: "استقبل استفسارات العملاء وتابع طلباتهم بسهولة عبر المنصة.",
    icon: "chat" as const,
  },
  {
    title: "إشعارات فورية",
    description: "ابقَ على اطلاع عند وصول طلب حجز جديد أو حدوث تحديث مهم على حجوزاتك.",
    icon: "bell" as const,
  },
  {
    title: "إحصائيات وتقارير",
    description:
      "تابع أداء قاعتك وبيانات الحجوزات من خلال مؤشرات تساعدك على اتخاذ قرارات أفضل.",
    icon: "chart" as const,
  },
  {
    title: "تقييمات تعزز الثقة",
    description: "اجمع تقييمات وتجارب عملائك وساهم في بناء حضور موثوق لقاعتك.",
    icon: "star" as const,
  },
  {
    title: "إدارة التوافر والمواعيد",
    description:
      "حدّث المواعيد والفترات المتاحة للحجز لتساعد العملاء على معرفة التوافر بسهولة.",
    icon: "slots" as const,
  },
];

export default function BenefitsSection() {
  return (
    <section
      id="benefits"
      className="benefits-section scroll-mt-20 bg-white py-12 sm:py-16"
    >
      <div className="container-wesal">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="benefits-heading text-2xl font-extrabold text-[var(--wesal-maroon)] sm:text-3xl">
            لماذا تنضم إلى وصال؟
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--wesal-muted)] sm:text-base">
            أدوات متكاملة تساعدك على عرض قاعتك، تنظيم حجوزاتك، والتواصل مع عملائك بكل
            سهولة.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-10">
          {BENEFITS.map((benefit, index) => (
            <article
              key={benefit.title}
              className="benefit-card group flex flex-col items-center text-center"
              style={{ animationDelay: `${100 + index * 70}ms` }}
            >
              <div className="benefit-icon flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--wesal-pink)] text-[var(--wesal-maroon)] sm:h-14 sm:w-14">
                <BenefitIcon name={benefit.icon} />
              </div>
              <h3 className="mt-3 text-sm font-bold text-[var(--wesal-maroon)] sm:text-[0.95rem]">
                {benefit.title}
              </h3>
              <p className="mt-1.5 max-w-[15rem] text-xs leading-6 text-[var(--wesal-muted)] sm:text-[0.8rem]">
                {benefit.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function BenefitIcon({ name }: { name: (typeof BENEFITS)[number]["icon"] }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true as const,
  };

  if (name === "users") {
    return (
      <svg {...common}>
        <circle cx="10" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M4.2 18c.7-3 2.8-4.5 5.8-4.5s5.1 1.5 5.8 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M17 8h3M18.5 6.5v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "calendar") {
    return (
      <svg {...common}>
        <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M14.5 14.5l1.2 1.2 2.3-2.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "chat") {
    return (
      <svg {...common}>
        <path d="M5 6.5h14v9.5H9l-4 3V6.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M8.5 10h7M8.5 13h4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "gallery") {
    return (
      <svg {...common}>
        <rect x="3.5" y="5" width="17" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="9" cy="10" r="1.6" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3.8 16.5 9 12.5l3 2.5 3.2-3.5 5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "star") {
    return (
      <svg {...common}>
        <path
          d="M12 3.6l2.2 4.5 5 .7-3.6 3.5.9 5L12 15.6 7.5 17.3l.9-5L4.8 8.8l5-.7L12 3.6Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === "chart") {
    return (
      <svg {...common}>
        <path d="M12 4a8 8 0 1 1-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M12 4v8h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "slots") {
    return (
      <svg {...common}>
        <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M7.5 14h4M7.5 17h4M14 14h2.5M14 17h2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M9 18h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M12 3a5.5 5.5 0 0 1 5.5 5.5c0 2.2-1.2 3.5-2.3 4.5-.8.7-1.2 1.3-1.2 2.5h-4c0-1.2-.4-1.8-1.2-2.5-1.1-1-2.3-2.3-2.3-4.5A5.5 5.5 0 0 1 12 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
