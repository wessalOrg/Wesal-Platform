"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cropAndCompressAvatar, type AvatarCropArea } from "@/lib/profile-avatar";
import { useT } from "@/i18n";

type ProfileAvatarCropDialogProps = {
  imageSrc: string;
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const VIEW = 340;

/**
 * Circular crop dialog with drag-to-pan and zoom slider.
 * Used by seeker, owner, and admin profile photo flows.
 */
export default function ProfileAvatarCropDialog({
  imageSrc,
  open,
  busy = false,
  onCancel,
  onConfirm,
}: ProfileAvatarCropDialogProps) {
  const t = useT();
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open || !imageSrc) return;

    let cancelled = false;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setNatural({ w: 0, h: 0 });
    setReady(false);

    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      setNatural({ w: image.naturalWidth, h: image.naturalHeight });
      setReady(true);
    };
    image.onerror = () => {
      if (cancelled) return;
      setReady(false);
    };
    image.src = imageSrc;

    return () => {
      cancelled = true;
    };
  }, [open, imageSrc]);

  const coverScale =
    natural.w > 0 && natural.h > 0 ? Math.max(VIEW / natural.w, VIEW / natural.h) : 1;
  const displayW = Math.max(1, natural.w * coverScale * zoom);
  const displayH = Math.max(1, natural.h * coverScale * zoom);

  const clampOffset = useCallback(
    (x: number, y: number, nextZoom = zoom) => {
      if (natural.w <= 0 || natural.h <= 0) return { x: 0, y: 0 };
      const w = natural.w * coverScale * nextZoom;
      const h = natural.h * coverScale * nextZoom;
      const maxX = Math.max(0, (w - VIEW) / 2);
      const maxY = Math.max(0, (h - VIEW) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [coverScale, natural.h, natural.w, zoom],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (busy || saving || !ready) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    event.preventDefault();
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    setOffset(clampOffset(dragRef.current.ox + dx, dragRef.current.oy + dy));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const onZoomChange = (value: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
    setZoom(next);
    setOffset((current) => clampOffset(current.x, current.y, next));
  };

  const buildCropArea = (): AvatarCropArea | null => {
    if (!natural.w || !natural.h) return null;
    const scale = coverScale * zoom;
    // Image is centered in VIEW×VIEW, then shifted by offset.
    const left = (VIEW - displayW) / 2 + offset.x;
    const top = (VIEW - displayH) / 2 + offset.y;
    const size = VIEW / scale;
    const x = Math.max(0, Math.min(natural.w - size, -left / scale));
    const y = Math.max(0, Math.min(natural.h - size, -top / scale));
    return {
      x,
      y,
      width: Math.min(size, natural.w),
      height: Math.min(size, natural.h),
    };
  };

  const handleConfirm = async () => {
    const area = buildCropArea();
    if (!area) return;
    setSaving(true);
    try {
      const dataUrl = await cropAndCompressAvatar(imageSrc, area);
      onConfirm(dataUrl);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="profile-avatar-crop-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-avatar-crop-title"
      data-testid="profile-avatar-crop-dialog"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy && !saving) onCancel();
      }}
    >
      <div className="profile-avatar-crop-panel" onClick={(event) => event.stopPropagation()}>
        <header className="profile-avatar-crop-header">
          <h2 id="profile-avatar-crop-title" className="profile-avatar-crop-title">
            {t("seeker.settings.avatar.cropTitle")}
          </h2>
          <p className="profile-avatar-crop-hint">{t("seeker.settings.avatar.cropHint")}</p>
        </header>

        <div
          className="profile-avatar-crop-stage"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {ready ? (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL crop source
            <img
              src={imageSrc}
              alt=""
              draggable={false}
              className="profile-avatar-crop-image"
              style={{
                width: `${displayW}px`,
                height: `${displayH}px`,
                left: `${(VIEW - displayW) / 2 + offset.x}px`,
                top: `${(VIEW - displayH) / 2 + offset.y}px`,
              }}
            />
          ) : (
            <p className="profile-avatar-crop-loading">{t("common.loading")}</p>
          )}
          <div className="profile-avatar-crop-mask" aria-hidden="true" />
        </div>

        <label className="profile-avatar-crop-zoom">
          <span>{t("seeker.settings.avatar.zoom")}</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.05}
            value={zoom}
            disabled={busy || saving || !ready}
            data-testid="profile-avatar-crop-zoom"
            onInput={(event) => onZoomChange(Number(event.currentTarget.value))}
            onChange={(event) => onZoomChange(Number(event.currentTarget.value))}
          />
        </label>

        <footer className="profile-avatar-crop-actions">
          <button
            type="button"
            className="btn-outline min-h-11"
            disabled={busy || saving}
            onClick={onCancel}
          >
            {t("halls.comment.cancel")}
          </button>
          <button
            type="button"
            className="btn-primary min-h-11"
            disabled={busy || saving || !ready}
            data-testid="profile-avatar-crop-confirm"
            onClick={() => {
              void handleConfirm();
            }}
          >
            {saving ? t("seeker.settings.avatar.uploading") : t("seeker.settings.avatar.cropApply")}
          </button>
        </footer>
      </div>
    </div>
  );
}
