"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import ContentImageGallery from "@/components/posts/ContentImageGallery";
import PostInquiryButton from "@/components/posts/PostInquiryButton";
import OfferDateRange from "./OfferDateRange";
import OfferPriceDisplay from "./OfferPriceDisplay";
import PostEditorIcon from "@/components/professionals/PostEditorIcon";
import { useT } from "@/i18n";
import { ApiError } from "@/lib/api-error";
import { professionalProfilePath } from "@/lib/account-profile-path";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import { fetchProfessionalOffer } from "@/services/professional-offers";
import type { ProfessionalOffer } from "@/types/offers";
import "./professional-offer-details.css";

type OfferDetailsState =
  | { status: "loading" }
  | { status: "error"; errorKey: string }
  | { status: "ready"; offer: ProfessionalOffer };

export default function ProfessionalOfferDetails({ offerId, disabled = false }: { offerId: string; disabled?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return <>
    <button type="button" className="btn-outline !min-h-9 mt-1 w-full px-3 text-sm" disabled={disabled}
      data-testid={`professional-offer-open-${offerId}`} onClick={() => setOpen(true)}>{t("offers.card.viewDetails")}</button>
    {open ? <OfferDetailsDialog key={offerId} offerId={offerId} onClose={close} /> : null}
  </>;
}

export function OfferDetailsDialog({ offerId, onClose, managementPreview = false }: {
  offerId: string;
  onClose: () => void;
  managementPreview?: boolean;
}) {
  const t = useT();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<OfferDetailsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const closeDialog = () => {
    dialogRef.current?.close();
    onClose();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    lockBodyScroll();
    return () => { dialog?.close(); unlockBodyScroll(); previousFocus?.focus({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchProfessionalOffer(offerId).then((offer) => {
      if (!cancelled) setState({ status: "ready", offer });
    }).catch((error: unknown) => {
      if (!cancelled) setState({ status: "error", errorKey: error instanceof ApiError && error.status === 404
        ? "offers.errors.notFound" : "offers.errors.loadFailed" });
    });
    return () => { cancelled = true; };
  }, [offerId, attempt]);

  return <dialog ref={dialogRef} className="professional-offer-details" aria-labelledby={titleId}
    data-testid="professional-offer-details" onCancel={(event) => { event.preventDefault(); closeDialog(); }}>
    <header className="professional-offer-details-heading">
      <h2 id={titleId}>{t("offers.form.details")}</h2>
      <button type="button" onClick={closeDialog} aria-label={t("common.close")}><PostEditorIcon name="close" /></button>
    </header>
    {state.status === "loading" ? <p className="p-6 text-sm text-[var(--wesal-muted)]" role="status">{t("common.loading")}</p> : null}
    {state.status === "error" ? <div className="p-6">
      <p className="text-sm text-[#b42318]" role="alert">{t(state.errorKey)}</p>
      <button type="button" className="btn-outline mt-4 px-4" onClick={() => {
        setState({ status: "loading" }); setAttempt((current) => current + 1);
      }}>{t("common.retry")}</button>
    </div> : null}
    {state.status === "ready" ? <div className="professional-offer-details-layout">
      <ContentImageGallery key={state.offer.id} images={state.offer.images} emptyState={t("offers.card.noImage")} />
      <div className="professional-offer-details-content">
        <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--wesal-text)]" data-testid="professional-offer-full-text">
          {state.offer.content?.trim() || t("offers.card.untitled")}
        </p>
        <OfferPriceDisplay oldPrice={state.offer.oldPrice} offerPrice={state.offer.offerPrice} />
        <OfferDateRange startsAt={state.offer.startsAt} endsAt={state.offer.endsAt} />
        {!managementPreview && state.offer.ownerUserId ? <Link href={professionalProfilePath(state.offer.ownerUserId)} className="text-sm font-bold text-[var(--wesal-maroon)]" onClick={closeDialog}>{t("offers.card.viewProfile")}</Link> : null}
        {!managementPreview ? <PostInquiryButton kind="offer" contentId={state.offer.id} variant="outline" /> : null}
      </div>
    </div> : null}
  </dialog>;
}
