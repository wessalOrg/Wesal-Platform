"use client";

import { useEffect, useId, useRef, useState } from "react";
import { hallFieldClassName } from "@/components/owner-management/add-hall/HallFormField";
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
};

type ExistingImage = {
  id: string;
  url: string;
};

export default function ProfessionalPostForm({
  mode,
  initialPost = null,
  onClose,
  onSaved,
}: ProfessionalPostFormProps) {
  const t = useT();
  const titleId = useId();
  const contentId = useId();
  const priceId = useId();
  const fileId = useId();
  const objectUrls = useRef<string[]>([]);

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
        required: mode === "create",
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
        required: mode === "create",
        existingCount: existingImages.length,
      }),
    );
  };

  const validate = () => {
    const nextContentIssue = validateProfessionalPostContent(content);
    const parsedPrice = parseProfessionalPostPrice(priceText);
    const nextImagesIssue = validateProfessionalPostImages(newFiles, {
      required: mode === "create",
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
    if (submitting) return;
    if (!validate()) return;
    const parsedPrice = parseProfessionalPostPrice(priceText);
    setSubmitting(true);
    setError(null);
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
      onSaved();
      onClose();
    } catch (err) {
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
      setSubmitting(false);
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

  return (
    <section
      className="rounded-3xl border border-[color-mix(in_srgb,var(--wesal-maroon)_14%,white)] bg-white p-4 shadow-[0_16px_36px_rgba(88,40,48,0.1)] sm:p-5"
      role="dialog"
      aria-labelledby={titleId}
      data-testid="professional-post-form"
    >
      <h2 id={titleId} className="text-lg font-bold text-[var(--wesal-text)]">
        {mode === "create"
          ? t("professionals.posts.createTitle")
          : t("professionals.posts.editTitle")}
      </h2>
      <p className="mt-1 text-sm leading-6 text-[var(--wesal-muted)]">
        {mode === "create"
          ? t("professionals.posts.createSubtitle")
          : t("professionals.posts.editSubtitle")}
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <p className="text-sm font-semibold text-[var(--wesal-text)]">
            {t("professionals.posts.imagesLabel")}
          </p>
          <p className="mt-1 text-xs text-[var(--wesal-muted)]">
            {t("professionals.posts.imagesHint", {
              max: String(PROFESSIONAL_POST_IMAGES_MAX),
            })}
          </p>
          {(existingImages.length > 0 || newPreviews.length > 0) && (
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {existingImages.map((image) => (
                <li key={image.id} className="relative overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                  <button
                    type="button"
                    className="absolute end-1 top-1 rounded-full bg-black/55 px-2 py-0.5 text-xs text-white"
                    disabled={submitting}
                    onClick={() => removeExisting(image.id)}
                  >
                    {t("professionals.posts.removeImage")}
                  </button>
                </li>
              ))}
              {newPreviews.map((preview, index) => (
                <li key={preview} className="relative overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                  <button
                    type="button"
                    className="absolute end-1 top-1 rounded-full bg-black/55 px-2 py-0.5 text-xs text-white"
                    disabled={submitting}
                    onClick={() => removeNew(index)}
                  >
                    {t("professionals.posts.removeImage")}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label
            htmlFor={fileId}
            className="btn-outline mt-3 inline-flex !min-h-10 cursor-pointer items-center px-3 text-sm"
          >
            {t("professionals.posts.addImages")}
          </label>
          <input
            id={fileId}
            type="file"
            accept={PROFESSIONAL_POST_IMAGE_ACCEPT}
            multiple
            className="sr-only"
            disabled={
              submitting ||
              existingImages.length + newFiles.length >= PROFESSIONAL_POST_IMAGES_MAX
            }
            onChange={(event) => {
              onPickFiles(event.target.files);
              event.target.value = "";
            }}
          />
          {imagesErrorText ? (
            <p className="mt-2 text-sm text-[#b42318]" role="alert">
              {imagesErrorText}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor={contentId}
            className="block text-sm font-semibold text-[var(--wesal-text)]"
          >
            {t("professionals.posts.contentLabel")}
          </label>
          <textarea
            id={contentId}
            value={content}
            disabled={submitting}
            maxLength={PROFESSIONAL_POST_CONTENT_MAX + 40}
            rows={4}
            placeholder={t("professionals.posts.contentPlaceholder")}
            className={`${hallFieldClassName(Boolean(contentIssue))} mt-2 min-h-[6rem] w-full resize-y`}
            onChange={(event) => {
              setContent(event.target.value);
              setContentIssue(validateProfessionalPostContent(event.target.value));
            }}
          />
          <p className="mt-1 text-xs text-[var(--wesal-muted)]">
            {t("professionals.posts.contentHint", {
              max: String(PROFESSIONAL_POST_CONTENT_MAX),
            })}
          </p>
          {contentIssue ? (
            <p className="mt-1 text-sm text-[#b42318]" role="alert">
              {t("professionals.posts.errors.contentTooLong")}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor={priceId}
            className="block text-sm font-semibold text-[var(--wesal-text)]"
          >
            {t("professionals.posts.priceLabel")}
          </label>
          <input
            id={priceId}
            type="text"
            inputMode="decimal"
            value={priceText}
            disabled={submitting}
            placeholder={t("professionals.posts.pricePlaceholder")}
            className={`${hallFieldClassName(Boolean(priceIssue))} mt-2 w-full`}
            onChange={(event) => {
              setPriceText(event.target.value);
              setPriceIssue(parseProfessionalPostPrice(event.target.value).issue);
            }}
          />
          <p className="mt-1 text-xs text-[var(--wesal-muted)]">
            {t("professionals.posts.priceHint")}
          </p>
          {priceErrorText ? (
            <p className="mt-1 text-sm text-[#b42318]" role="alert">
              {priceErrorText}
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-[#b42318]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="btn-primary !min-h-11"
          disabled={submitting}
          aria-busy={submitting || undefined}
          data-testid="professional-post-submit"
          onClick={() => void onSubmit()}
        >
          {submitting
            ? mode === "create"
              ? t("professionals.posts.publishing")
              : t("professionals.posts.saving")
            : mode === "create"
              ? t("professionals.posts.publish")
              : t("professionals.posts.save")}
        </button>
        <button
          type="button"
          className="btn-outline !min-h-11"
          disabled={submitting}
          onClick={onClose}
        >
          {t("professionals.posts.cancel")}
        </button>
      </div>
    </section>
  );
}
