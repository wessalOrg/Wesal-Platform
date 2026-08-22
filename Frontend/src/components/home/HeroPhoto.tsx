"use client";

import Image from "next/image";
import { useT } from "@/i18n";

const HERO_IMAGE_SRC = "/hero/hall-slide-b.webp";

export default function HeroPhoto({ showAlt = false }: { showAlt?: boolean }) {
  const t = useT();

  return (
    <div className="hero-slideshow absolute inset-0 overflow-hidden">
      <div className="hero-slide is-active">
        <Image
          src={HERO_IMAGE_SRC}
          alt={showAlt ? t("home.hero.imageAlt") : ""}
          fill
          priority
          quality={75}
          sizes="(min-width: 768px) 90rem, 100vw"
          className="hero-photo"
        />
      </div>
    </div>
  );
}
