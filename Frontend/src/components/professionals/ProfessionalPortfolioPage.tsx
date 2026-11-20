"use client";

import Link from "next/link";
import { useState } from "react";
import ProfessionalPublicProfileView from "@/components/professionals/ProfessionalPublicProfileView";
import { useProfessionalAccountAccess } from "@/hooks/useProfessionalAccountAccess";
import { professionalProfilePath } from "@/lib/account-profile-path";
import { useT } from "@/i18n";
import "./professional-portfolio.css";

export default function ProfessionalPortfolioPage() {
  const t = useT();
  const access = useProfessionalAccountAccess();
  const [visitorPreview, setVisitorPreview] = useState(false);

  if (!access.ready || access.statusLoading) {
    return <div className="h-64 animate-pulse rounded-3xl bg-white" aria-busy="true" />;
  }
  if (!access.isProfessional || !access.userId) {
    return <p role="alert">{t("portfolio.professionalOnly")}</p>;
  }

  return (
    <div className="portfolio-workspace" data-testid="professional-portfolio-page">
      <header className="portfolio-workspace-toolbar">
        <h1>{t("portfolio.title")}</h1>
        <div>
          <button type="button" className="btn-outline px-4 text-sm" aria-pressed={visitorPreview}
            data-testid="portfolio-visitor-toggle" onClick={() => setVisitorPreview((current) => !current)}>
            {t(visitorPreview ? "portfolio.backToManage" : "portfolio.preview")}
          </button>
          <Link href={professionalProfilePath(access.userId)} target="_blank" rel="noopener noreferrer"
            className="btn-outline inline-flex items-center px-4 text-sm">
            {t("portfolio.openPublic")}
          </Link>
        </div>
      </header>
      {visitorPreview ? (
        <p className="portfolio-preview-notice" role="status" data-testid="portfolio-preview-notice">
          {t("portfolio.previewNotice")}
        </p>
      ) : null}
      <ProfessionalPublicProfileView key={`${access.sessionKey}-${visitorPreview}`} userId={access.userId}
        visitorPreview={visitorPreview} />
    </div>
  );
}
