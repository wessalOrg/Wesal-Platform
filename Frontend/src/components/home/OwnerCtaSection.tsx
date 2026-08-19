import Link from "next/link";
import Image from "next/image";
import Reveal from "@/components/ui/Reveal";

export default function OwnerCtaSection() {
  return (
    <section className="owner-cta relative isolate overflow-hidden py-16 sm:py-20">
      <Reveal>
      <div
        dir="ltr"
        className="container-wesal relative z-10 grid items-center gap-10 lg:grid-cols-2 lg:gap-6"
      >
        <div dir="rtl" className="owner-cta-copy text-start">
          <p className="owner-cta-line mb-3 text-sm font-semibold text-[var(--wesal-gold)]">
            لأصحاب القاعات
          </p>
          <h2 className="owner-cta-line text-2xl font-extrabold leading-[1.45] text-[var(--wesal-maroon)] sm:text-3xl lg:text-[2.15rem]">
            قاعتك تستحق أن تصل إلى جمهور أكبر
          </h2>
          <p className="owner-cta-line mt-4 max-w-xl text-sm leading-8 text-[var(--wesal-muted)] sm:text-base">
            اعرض قاعتك على وصال، وكن أقرب إلى العملاء الباحثين عن المكان المناسب
            لمناسباتهم. نظّم تفاصيل قاعتك ومواعيدها وطلبات الحجز بسهولة، واستفد من
            أدوات تساعدك على تعزيز حضورك والتواصل مع عملائك في مكان واحد.
          </p>

          <div className="owner-cta-line mt-7 flex flex-wrap gap-3">
            <Link href="/register?type=owner" className="btn-primary gap-2 px-6 py-3">
              أضف قاعتك الآن
            </Link>
            <Link href="/#benefits" className="btn-outline px-6 py-3">
              اكتشف المزايا
            </Link>
          </div>

          <p className="owner-cta-line mt-4 text-xs leading-6 text-[var(--wesal-muted)] sm:text-sm">
            استثمر في حضور قاعتك بـ 120 ₪ شهريًا
            <br />
            ما يعادل 4 ₪ يوميًا فقط.
          </p>
        </div>

        {/* UX/UI device scene: angled silver laptop + white phone on beige pedestal */}
        <div className="owner-scene" aria-hidden="false">
          <div className="owner-pedestal" aria-hidden="true" />

          <div className="owner-mac">
            <div className="owner-mac-lid">
              <div className="owner-mac-bezel">
                <span className="owner-mac-cam" />
                <div className="owner-mac-screen">
                  <DashUI />
                </div>
              </div>
            </div>
            <div className="owner-mac-bottom">
              <span className="owner-mac-slot" />
            </div>
          </div>

          <div className="owner-iphone">
            <div className="owner-iphone-side" />
            <div className="owner-iphone-shell">
              <span className="owner-iphone-island" />
              <div className="owner-iphone-screen">
                <PhoneUI />
              </div>
            </div>
          </div>
        </div>
      </div>
      </Reveal>
    </section>
  );
}

function DashUI() {
  const nav = [
    { t: "الرئيسية", on: true },
    { t: "القاعات", on: false },
    { t: "التقويم", on: false },
    { t: "العملاء", on: false },
    { t: "الحجوزات", on: false },
    { t: "المالية", on: false },
    { t: "التقارير", on: false },
    { t: "الإعدادات", on: false },
  ];

  const stats = [
    { l: "الحجوزات النشطة", v: "128" },
    { l: "إجمالي المستخدمين", v: "1,482" },
    { l: "الصالات الجديدة", v: "23" },
    { l: "إجمالي الإيرادات", v: "45,250 ر.س" },
  ];

  const activities = [
    { name: "قاعة اللوتس", time: "اليوم · 10:20", status: "مكتمل", tone: "ok" as const },
    { name: "قاعة ريماس", time: "أمس · 18:40", status: "قيد الانتظار", tone: "wait" as const },
    { name: "قاعة الأندلس", time: "الأحد · 14:15", status: "ملغي", tone: "bad" as const },
  ];

  return (
    <div className="dash" dir="rtl">
      <aside className="dash-aside">
        <div className="dash-logo">وصال</div>
        {nav.map((n) => (
          <div key={n.t} className={`dash-link ${n.on ? "on" : ""}`}>
            <i />
            <span>{n.t}</span>
          </div>
        ))}
      </aside>

      <main className="dash-main">
        <h4 className="dash-title">نظرة عامة</h4>

        <div className="dash-cards">
          {stats.map((c) => (
            <div key={c.l} className="dash-card">
              <span>{c.l}</span>
              <b>{c.v}</b>
            </div>
          ))}
        </div>

        <div className="dash-grid">
          <section className="dash-panel">
            <h5>الحجوزات خلال آخر 7 أيام</h5>
            <svg viewBox="0 0 260 100" className="dash-svg" aria-hidden="true" preserveAspectRatio="none">
              <defs>
                <linearGradient id="dashGoldFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(196,160,92,0.28)" />
                  <stop offset="100%" stopColor="rgba(196,160,92,0)" />
                </linearGradient>
              </defs>
              <path
                d="M8 72 C40 66 52 42 78 48 C104 54 118 28 148 36 C178 44 198 22 252 30 L252 100 L8 100 Z"
                fill="url(#dashGoldFill)"
              />
              <path
                className="dash-line"
                d="M8 72 C40 66 52 42 78 48 C104 54 118 28 148 36 C178 44 198 22 252 30"
                fill="none"
                stroke="#c4a05c"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              {[
                [8, 72],
                [78, 48],
                [148, 36],
                [252, 30],
              ].map(([cx, cy]) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.4" fill="#fff" stroke="#c4a05c" strokeWidth="1.6" />
              ))}
            </svg>
          </section>

          <section className="dash-panel">
            <h5>أحدث النشاطات</h5>
            <div className="dash-rows">
              {activities.map((a) => (
                <div key={a.name} className="dash-row">
                  <div className="dash-row-text">
                    <span>{a.name}</span>
                    <small>{a.time}</small>
                  </div>
                  <em className={`dash-badge dash-badge--${a.tone}`}>{a.status}</em>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function PhoneUI() {
  return (
    <div className="pui" dir="rtl">
      <div className="pui-top">
        <span className="pui-brand">وصال</span>
      </div>
      <div className="pui-hero">
        <Image
          src="/halls/featured-lotus.webp"
          alt=""
          fill
          className="object-cover"
          sizes="160px"
        />
      </div>
      <div className="pui-body">
        <div className="pui-title">
          <h4>قاعة ريماس الملكية</h4>
          <span>★ 4.9</span>
        </div>
        <div className="pui-icons">
          {["مكيف", "حديقة", "VIP", "موقف"].map((t) => (
            <div key={t} className="pui-ico">
              <i />
              <span>{t}</span>
            </div>
          ))}
        </div>
        <p className="pui-serv">الخدمات المقدمة</p>
        <ul>
          <li>تنسيق كامل للقاعة</li>
          <li>إضاءة وتصوير</li>
          <li>ضيافة واستقبال</li>
        </ul>
      </div>
    </div>
  );
}
