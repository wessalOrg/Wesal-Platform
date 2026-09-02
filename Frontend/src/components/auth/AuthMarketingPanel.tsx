"use client";

import { memo, type ReactNode } from "react";
import { useT } from "@/i18n";

function AuthMarketingPanel({ variant }: { variant: "desktop" | "mobile" }) {
  const t = useT();

  const features = [
    {
      icon: <ShieldIcon />,
      title: t("auth.register.feature.trustedTitle"),
      body: t("auth.register.feature.trustedBody"),
    },
    {
      icon: <ChatIcon />,
      title: t("auth.register.feature.contactTitle"),
      body: t("auth.register.feature.contactBody"),
    },
    {
      icon: <CalendarIcon />,
      title: t("auth.register.feature.bookingTitle"),
      body: t("auth.register.feature.bookingBody"),
    },
  ];

  if (variant === "mobile") {
    return (
      <ul
        className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:hidden"
        aria-label={t("auth.register.featuresLabel")}
      >
        {features.map((feature, index) => (
          <FeatureCard key={`${feature.title}-mobile`} index={index} {...feature} />
        ))}
      </ul>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-8 lg:max-w-[54%] lg:min-h-[32rem] xl:min-h-[36rem]">
      <div className="flex flex-1 items-center justify-center px-1">
        <div className="inline-flex max-w-full flex-col items-center text-center">
          <h1 className="wesal-register-hero-title text-[1.85rem] font-extrabold leading-[1.3] whitespace-nowrap sm:text-[2.35rem] lg:text-[2.75rem] xl:text-[3rem]">
            {t("auth.register.heroTitle")}
          </h1>
          <p className="wesal-register-hero-sub mt-4 w-full max-w-[22rem] text-center text-sm leading-7 sm:max-w-[28rem] sm:text-base lg:max-w-[30rem] lg:text-[1.05rem] lg:leading-8">
            {t("auth.register.heroSub")}
          </p>
        </div>
      </div>

      <ul
        className="hidden grid-cols-3 gap-4 lg:grid lg:-translate-y-6 xl:-translate-y-8"
        aria-label={t("auth.register.featuresLabel")}
      >
        {features.map((feature, index) => (
          <FeatureCard key={feature.title} index={index} {...feature} />
        ))}
      </ul>
    </div>
  );
}

const FeatureCard = memo(function FeatureCard({
  icon,
  title,
  body,
  index = 0,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  index?: number;
}) {
  return (
    <li
      className="wesal-register-feature group px-4 py-4 sm:px-3.5 sm:py-4"
      style={{ animationDelay: `${120 + index * 80}ms` }}
    >
      <span className="wesal-register-feature-icon" aria-hidden="true">
        {icon}
      </span>
      <p className="wesal-register-feature-title">{title}</p>
      <p className="wesal-register-feature-body">{body}</p>
    </li>
  );
});

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5" aria-hidden="true">
      <path d="M12 3.5 5.5 6v5.2c0 4.2 2.8 7.4 6.5 8.8 3.7-1.4 6.5-4.6 6.5-8.8V6L12 3.5Z" strokeLinejoin="round" />
      <path d="m9.2 12 1.9 1.9 3.7-3.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5" aria-hidden="true">
      <path d="M5 16.5 3.8 20l3.5-1.2A8.5 8.5 0 1 0 5 16.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5" aria-hidden="true">
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M8 3.5v4M16 3.5v4M4 10h16" strokeLinecap="round" />
      <path d="m10 14.2 1.5 1.5 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default memo(AuthMarketingPanel);
