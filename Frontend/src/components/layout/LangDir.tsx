"use client";

import type { ReactNode } from "react";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { langToDir } from "@/lib/language";

type LangDirProps = {
  children: ReactNode;
  className?: string;
};

/** Applies the active UI language direction without hardcoding RTL. */
export default function LangDir({ children, className }: LangDirProps) {
  const lang = useUiLang();
  return (
    <div dir={langToDir(lang)} className={className}>
      {children}
    </div>
  );
}
