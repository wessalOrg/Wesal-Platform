"use client";

import { useEffect, useId, useRef, useState } from "react";
import PostEditorIcon from "@/components/professionals/PostEditorIcon";
import "./professional-post-form.css";
import { ApiError, isForbiddenApiError, isUnauthorizedApiError } from "@/lib/api-error";
import { resolveMediaUrl } from "@/lib/hall-media-url";
import {
  PROFESSIONAL_POST_CONTENT_MAX,
  PROFESSIONAL_POST_IMAGE_ACCEPT,
  PROFESSIONAL_POST_IMAGES_MAX,
  hasProfessionalPostBody,
  parseProfessionalPostPrice,
  validateProfessionalPostContent,
  validateProfessionalPostImages,
} from "@/lib/professional-post-validation";
import { useRequestScope } from "@/hooks/useRequestScope";
import { useT } from "@/i18n";
import {
  createProfessionalPost,
  updateProfessionalPost,
} from "@/services/professional-posts";
import type { ProfessionalProfileContentItem } from "@/types/professional-profile";

type ProfessionalPostFormProps = {
  mode: "create" | "edit";
  initialPost?: ProfessionalProfileContentItem | null;
  onClose: () => void;
  onSaved: () => void;
  onSubmittingChange?: (submitting: boolean) => void;
};

type ExistingImage = {
  id: string;
  url: string;
};

export default function ProfessionalPostForm(props: ProfessionalPostFormProps) {
  // Each target owns its draft, validation state and local image URLs.
  return <ProfessionalPostFormDraft key={`${props.mode}:${props.initialPost?.id ?? "new"}`} {...props} />;
}

function ProfessionalPostFormDraft({
  mode,
  initialPost = null,
  onClose,
  onSaved,
  onSubmittingChange,
}: ProfessionalPostFormProps) {
  const t = useT();
  const scope = useRequestScope();
  const titleId = useId();
  const contentId = useId();
  const priceId = useId();
  const fileId = useId();
  const objectUrls = useRef<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveInProgress = useRef(false);
  const [dragging, setDragging] = useState(false);

  const [content, setContent] = useState(initialPost?.content ?? "");
  const [priceText, setPriceText] = useState(
    initialPost?.price != null ? String(initialPost.price) : "",
  );
  const [existingImages, setExistingImages] = useState<ExistingImage[]>(
    () =>
      (initialPost?.images ?? []).map((image) => ({
        id: image.id,
        url: resolveMediaUrl(image.url),
      })),
  );
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [contentIssue, setContentIssue] = useState<"tooLong" | null>(null);
  const [priceIssue, setPriceIssue] = useState<
    "invalid" | "negative" | "tooLarge" | "decimals" | null
  >(null);
  const [imagesIssue, setImagesIssue] = useState<
    "required" | "tooMany" | "emptyFile" | "tooLarge" | "type" | "bodyRequired" | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url);
      objectUrls.current = [];
    };
  }, []);

  const replacePreviews = (files: File[]) => {
    for (const url of objectUrls.current) URL.revokeObjectURL(url);
    const next = files.map((file) => URL.createObjectURL(file));
    objectUrls.current = next;
    setNewPreviews(next);
  };

  const onPickFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const picked = Array.from(list);
    const merged = [...newFiles, ...picked].slice(
      0,
      Math.max(0, PROFESSIONAL_POST_IMAGES_MAX - existingImages.length),
    );
    setNewFiles(merged);
    replacePreviews(merged);
    setImagesIssue(
      validateProfessionalPostImages(merged, {
        required: false,
        existingCount: existingImages.length,
      }),
    );
  };

  const removeExisting = (imageId: string) => {
    setExistingImages((current) => current.filter((row) => row.id !== imageId));
    setImagesIssue(null);
  };

  const removeNew = (index: number) => {
    const next = newFiles.filter((_, i) => i !== index);
    setNewFiles(next);
    replacePreviews(next);
    setImagesIssue(
      validateProfessionalPostImages(next, {
        required: false,
        existingCount: existingImages.length,
      }),
    );
  };

  const validate = () => {
    const nextContentIssue = validateProfessionalPostContent(content);
    const parsedPrice = parseProfessionalPostPrice(priceText);
    // Backend: image OR non-empty caption — images are never mandatory alone.
    const nextImagesIssue = validateProfessionalPostImages(newFiles, {
      required: false,
      existingCount: mode === "edit" ? existingImages.length : 0,
    });
    const imageCount =
      (mode === "edit" ? existingImages.length : 0) + newFiles.length;
    const bodyOk = hasProfessionalPostBody(content, imageCount);

    setContentIssue(nextContentIssue);
    setPriceIssue(parsedPrice.issue);
    if (nextImagesIssue) setImagesIssue(nextImagesIssue);
    else if (!bodyOk) setImagesIssue("bodyRequired");
    else setImagesIssue(null);

    return (
      !nextContentIssue &&
      !parsedPrice.issue &&
      !nextImagesIssue &&
      bodyOk
    );
  };

  const onSubmit = async () => {
    const current = scope.capture();
    if (!current() || saveInProgress.current) return;
    if (!validate()) return;
    const parsedPrice = parseProfessionalPostPrice(priceText);
    saveInProgress.current = true;
    setSubmitting(true);
    onSubmittingChange?.(true);
    setError(null);
    let saved = false;
    try {
      if (mode === "create") {
        await createProfessionalPost({
          content,
          price: parsedPrice.value,
          images: newFiles,
        });
      } else if (initialPost) {
        const originalIds = (initialPost.images ?? []).map((image) => image.id);
        const keptIds = existingImages.map((image) => image.id);
        const imagesChanged =
          newFiles.length > 0 ||
          keptIds.length !== originalIds.length ||
          keptIds.some((id, index) => id !== originalIds[index]);
        await updateProfessionalPost(initialPost.id, {
          content,
          price: parsedPrice.value,
          replaceImages: imagesChanged,
          keepImageIds: keptIds,
          images: newFiles,
        });
      }
      saved = true;
    } catch (err) {
      if (!current()) return;
      if (isUnauthorizedApiError(err)) {
        setError(t("professionals.posts.errors.unauthorized"));
      } else if (isForbiddenApiError(err)) {
        setError(t("professionals.posts.errors.forbidden"));
      } else if (err instanceof ApiError && err.status === 404) {
        setError(t("professionals.posts.errors.notFound"));
      } else if (err instanceof ApiError && err.status === 413) {
        setError(t("professionals.posts.errors.tooLarge"));
      } else if (err instanceof ApiError && err.status === 415) {
        setError(t("professionals.posts.errors.type"));
      } else {
        setError(
          t(
            mode === "create"
              ? "professionals.posts.errors.createFailed"
              : "professionals.posts.errors.updateFailed",
          ),
        );
      }
    } finally {
      saveInProgress.current = false;
      if (current()) {
        setSubmitting(false);
        onSubmittingChange?.(false);
      }
    }
    if (saved && current()) {
      onSaved();
      onClose();
    }
  };

  const imagesErrorText = (() => {
    switch (imagesIssue) {
      case "required":
        return t("professionals.posts.errors.imageRequired");
      case "tooMany":
        return t("professionals.posts.errors.tooManyImages", {
          max: String(PROFESSIONAL_POST_IMAGES_MAX),
        });
      case "tooLarge":
        return t("professionals.posts.errors.tooLarge");
      case "type":
        return t("professionals.posts.errors.type");
      case "emptyFile":
        return t("professionals.posts.errors.emptyFile");
      case "bodyRequired":
        return t("professionals.posts.errors.bodyRequired");
      default:
        return null;
    }
  })();

  const priceErrorText = (() => {
    switch (priceIssue) {
      case "invalid":
      case "decimals":
        return t("professionals.posts.errors.priceInvalid");
      case "negative":
        return t("professionals.posts.errors.priceNegative");
      case "tooLarge":
        return t("professionals.posts.errors.priceTooLarge");
      default:
        return null;
    }
  })();

  const imageLimitReached = existingImages.length + newFiles.length >= PROFESSIONAL_POST_IMAGES_MAX;

  return (
    <section className="post-editor" role="dialog" aria-labelledby={titleId} data-testid="professional-post-form">
      <header className="post-editor-head">
        <span className="post-editor-head-icon"><PostEditorIcon name={mode === "create" ? "add" : "document"} /></span>
        <div>
          <h2 id={titleId}>{t(mode === "create" ? "professionals.posts.createTitle" : "professionals.posts.editTitle")}</h2>
          <p>{t(mode === "create" ? "professionals.posts.createSubtitle" : "professionals.posts.editSubtitle")}</p>
        </div>
      </header>
      <div className="post-editor-layout">
        <div className="post-editor-main">
          <div className="post-editor-caption">
            <label htmlFor={contentId} className="post-editor-label">
              <PostEditorIcon name="document" />{t("professionals.posts.contentLabel")}
            </label>
            <textarea id={contentId} value={content} disabled={submitting} maxLength={PROFESSIONAL_POST_CONTENT_MAX + 40}
              rows={5} placeholder={t("professionals.posts.contentPlaceholder")} className="post-editor-textarea"
              aria-invalid={Boolean(contentIssue)} aria-describedby={contentId + "-hint " + contentId + "-count"}
              onChange={(event) => {
                const next = event.target.value;
                setContent(next);
                setContentIssue(validateProfessionalPostContent(next));
                if (imagesIssue === "bodyRequired" || imagesIssue === "required") {
                  const imageCount = existingImages.length + newFiles.length;
                  setImagesIssue(hasProfessionalPostBody(next, imageCount) ? null : "bodyRequired");
                }
              }} />
            <p id={contentId + "-count"} className="post-editor-counter" data-testid="professional-post-character-count">
              {t("professionals.posts.characterCount", { count: String(content.length), max: String(PROFESSIONAL_POST_CONTENT_MAX) })}
            </p>
            <p id={contentId + "-hint"} className="sr-only">{t("professionals.posts.contentHint", { max: String(PROFESSIONAL_POST_CONTENT_MAX) })}</p>
            {contentIssue ? <p className="post-editor-error" role="alert">{t("professionals.posts.errors.contentTooLong")}</p> : null}
          </div>
          <div className="post-editor-price">
            <label htmlFor={priceId} className="post-editor-label"><PostEditorIcon name="price" />{t("professionals.posts.priceLabel")}</label>
            <div className={"post-editor-price-field" + (priceIssue ? " has-error" : "")}>
              <input id={priceId} type="text" inputMode="decimal" value={priceText} disabled={submitting}
                placeholder={t("professionals.posts.pricePlaceholder")} aria-invalid={Boolean(priceIssue)}
                aria-describedby={priceId + "-hint"}
                onChange={(event) => { setPriceText(event.target.value); setPriceIssue(parseProfessionalPostPrice(event.target.value).issue); }} />
              <span>{t("offers.currency")}</span>
            </div>
            <p id={priceId + "-hint"} className="post-editor-hint"><PostEditorIcon name="info" />{t("professionals.posts.priceHint")}</p>
            {priceErrorText ? <p className="post-editor-error" role="alert">{priceErrorText}</p> : null}
          </div>
        </div>
        <div className="post-editor-images"
          onDragOver={(event) => { event.preventDefault(); if (!submitting && !imageLimitReached) setDragging(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
          onDrop={(event) => {
            event.preventDefault(); setDragging(false);
            if (!submitting && !imageLimitReached) onPickFiles(event.dataTransfer.files);
          }}>
          <p className="post-editor-label"><PostEditorIcon name="image" />{t("professionals.posts.imagesLabel")}</p>
          <p className="post-editor-images-intro">{t("professionals.posts.imagesHelp")}</p>
          <button type="button" disabled={submitting || imageLimitReached} data-testid="professional-post-dropzone"
            className={"post-editor-dropzone" + (dragging ? " is-dragging" : "") + (existingImages.length + newFiles.length > 0 ? " has-images" : "")}
            aria-describedby={fileId + "-hint"} onClick={() => fileInputRef.current?.click()}>
            <PostEditorIcon name="image" />
            <strong>{t("professionals.posts.addImages")}</strong>
            <span>{t("professionals.posts.dropImages")}</span>
            <small>JPG, PNG, WebP</small>
          </button>
          <input ref={fileInputRef} id={fileId} type="file" accept={PROFESSIONAL_POST_IMAGE_ACCEPT} multiple className="sr-only"
            aria-label={t("professionals.posts.imagesLabel")} tabIndex={-1} disabled={submitting || imageLimitReached}
            onChange={(event) => { onPickFiles(event.target.files); event.target.value = ""; }} />
          {existingImages.length + newPreviews.length > 0 ? (
            <ul className="post-editor-previews" data-testid="professional-post-image-previews">
              {existingImages.map((image) => (
                <li key={image.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- existing post image */}
                  <img src={image.url} alt="" />
                  <button type="button" className="post-editor-remove" disabled={submitting}
                    aria-label={t("professionals.posts.removeImage")} title={t("professionals.posts.removeImage")}
                    onClick={() => removeExisting(image.id)}><PostEditorIcon name="close" /></button>
                </li>
              ))}
              {newPreviews.map((preview, index) => (
                <li key={preview}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- local image preview */}
                  <img src={preview} alt="" />
                  <button type="button" className="post-editor-remove" disabled={submitting}
                    aria-label={t("professionals.posts.removeImage")} title={t("professionals.posts.removeImage")}
                    onClick={() => removeNew(index)}><PostEditorIcon name="close" /></button>
                </li>
              ))}
            </ul>
          ) : null}
          <p id={fileId + "-hint"} className="post-editor-hint"><PostEditorIcon name="info" />{t("professionals.posts.imagesHint", { max: String(PROFESSIONAL_POST_IMAGES_MAX) })}</p>
          {imagesErrorText ? <p className="post-editor-error" role="alert">{imagesErrorText}</p> : null}
        </div>
      </div>
      {error ? <p className="post-editor-error" role="alert">{error}</p> : null}
      <footer className="post-editor-actions">
        <button type="button" className="post-editor-publish" disabled={submitting} aria-busy={submitting || undefined}
          data-testid="professional-post-submit" onClick={() => void onSubmit()}>
          <PostEditorIcon name="send" />
          {t(submitting ? (mode === "create" ? "professionals.posts.publishing" : "professionals.posts.saving")
            : (mode === "create" ? "professionals.posts.publish" : "professionals.posts.save"))}
        </button>
        <button type="button" className="post-editor-cancel" disabled={submitting} onClick={onClose}>{t("professionals.posts.cancel")}</button>
      </footer>
    </section>
  );
}
