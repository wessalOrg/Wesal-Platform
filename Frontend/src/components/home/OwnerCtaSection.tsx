"use client";

import Link from "next/link";
import Image from "next/image";
import LangDir from "@/components/layout/LangDir";
import { useUiLang } from "@/components/layout/LanguageProvider";
import Reveal from "@/components/ui/Reveal";
import { useT } from "@/i18n";
import { langToDir } from "@/lib/language";

export default function OwnerCtaSection() {
  const t = useT();

  return (
    <section className="owner-cta relative isolate overflow-hidden py-16 sm:py-20">
      <Reveal>
      <div
        dir="ltr"
        className="container-wesal relative z-10 grid items-center gap-10 lg:grid-cols-2 lg:gap-6"
      >
        <LangDir className="owner-cta-copy text-start">
          <p className="owner-cta-line mb-3 text-sm font-semibold text-[var(--wesal-gold)]">
            {t("home.owner.eyebrow")}
          </p>
          <h2 className="owner-cta-line text-2xl font-extrabold leading-[1.45] text-[var(--wesal-maroon)] sm:text-3xl lg:text-[2.15rem]">
            {t("home.owner.title")}
          </h2>
          <p className="owner-cta-line mt-4 max-w-xl text-sm leading-8 text-[var(--wesal-muted)] sm:text-base">
            {t("home.owner.desc")}
          </p>

          <div className="owner-cta-line mt-7 flex flex-wrap gap-3">
            <Link href="/register?type=owner" className="btn-primary gap-2 px-6 py-3">
              {t("home.owner.ctaPrimary")}
            </Link>
            <Link href="/#benefits" className="btn-outline px-6 py-3">
              {t("home.owner.ctaSecondary")}
            </Link>
          </div>
        </LangDir>

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
  const t = useT();
  const lang = useUiLang();
  const dir = langToDir(lang);

  const nav = [
    { label: t("home.owner.demo.nav.home"), on: true },
    { label: t("home.owner.demo.nav.halls"), on: false },
    { label: t("home.owner.demo.nav.calendar"), on: false },
    { label: t("home.owner.demo.nav.clients"), on: false },
    { label: t("home.owner.demo.nav.bookings"), on: false },
    { label: t("home.owner.demo.nav.finance"), on: false },
    { label: t("home.owner.demo.nav.reports"), on: false },
    { label: t("home.owner.demo.nav.settings"), on: false },
  ];

  const stats = [
    { l: t("home.owner.demo.stat.bookings"), v: "128" },
    { l: t("home.owner.demo.stat.users"), v: "1,482" },
    { l: t("home.owner.demo.stat.newHalls"), v: "23" },
    { l: t("home.owner.demo.stat.revenue"), v: "45,250 ر.س" },
  ];

  const activities = [
    {
      name: t("home.owner.demo.hall.lotus"),
      time: t("home.owner.demo.today"),
      status: t("home.owner.demo.status.done"),
      tone: "ok" as const,
    },
    {
      name: t("home.owner.demo.hall.rimas"),
      time: t("home.owner.demo.yesterday"),
      status: t("home.owner.demo.status.pending"),
      tone: "wait" as const,
    },
    {
      name: t("home.owner.demo.hall.andalus"),
      time: t("home.owner.demo.sunday"),
      status: t("home.owner.demo.status.cancelled"),
      tone: "bad" as const,
    },
  ];

  return (
    <div className="dash" dir={dir}>
      <aside className="dash-aside">
        <div className="dash-logo">{t("brand.name")}</div>
        {nav.map((n) => (
          <div key={n.label} className={`dash-link ${n.on ? "on" : ""}`}>
            <i />
            <span>{n.label}</span>
          </div>
        ))}
      </aside>

      <main className="dash-main">
        <h4 className="dash-title">{t("home.owner.demo.overview")}</h4>

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
            <h5>{t("home.owner.demo.chart")}</h5>
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
            <h5>{t("home.owner.demo.activity")}</h5>
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
  const t = useT();
  const lang = useUiLang();
  const dir = langToDir(lang);

  const icons = [
    t("home.owner.demo.icon.ac"),
    t("home.owner.demo.icon.garden"),
    t("home.owner.demo.icon.vip"),
    t("home.owner.demo.icon.parking"),
  ];

  return (
    <div className="pui" dir={dir}>
      <div className="pui-top">
        <span className="pui-brand">{t("brand.name")}</span>
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
          <h4>{t("home.owner.demo.phoneTitle")}</h4>
          <span>★ 4.9</span>
        </div>
        <div className="pui-icons">
          {icons.map((label) => (
            <div key={label} className="pui-ico">
              <i />
              <span>{label}</span>
            </div>
          ))}
        </div>
        <p className="pui-serv">{t("home.owner.demo.services")}</p>
        <ul>
          <li>{t("home.owner.demo.service1")}</li>
          <li>{t("home.owner.demo.service2")}</li>
          <li>{t("home.owner.demo.service3")}</li>
        </ul>
      </div>
    </div>
  );
}
