"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import DeleteHallConfirmationDialog from "@/components/halls/DeleteHallConfirmationDialog";
import DestructiveActionButton from "@/components/halls/DestructiveActionButton";
import HallDeletionFeedback from "@/components/halls/HallDeletionFeedback";
import HallDeletionStateWrapper from "@/components/halls/HallDeletionStateWrapper";
import { useDeleteHall } from "@/hooks/useDeleteHall";
import { useT } from "@/i18n";
import {
  HALL_DELETION_EXIT_MS,
  hallDeletionFeedbackKind,
  hallDeletionLocksAction,
  hallDeletionVisualState,
} from "@/lib/owner-hall-deletion-ui";

type OwnerDeleteHallActionProps = {
  hallId: string;
  hallName: string;
  onDeleted: () => void;
};

export default function OwnerDeleteHallAction({
  hallId,
  hallName,
  onDeleted,
}: OwnerDeleteHallActionProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [alreadyGone, setAlreadyGone] = useState(false);
  const errorId = useId();
  const exitTimerRef = useRef<number | null>(null);
  const onDeletedRef = useRef(onDeleted);
  useEffect(() => {
    onDeletedRef.current = onDeleted;
  });

  const { remove, deleting, error, clearError } = useDeleteHall({
    onDeleted: (result) => {
      setOpen(false);
      setAlreadyGone(result.alreadyDeleted);
      setExiting(true);
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = window.setTimeout(() => {
        onDeletedRef.current();
      }, HALL_DELETION_EXIT_MS);
    },
  });

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    };
  }, []);

  const visualState = hallDeletionVisualState({
    deleting,
    exiting,
    alreadyGone,
    errorKey: error,
  });
  const locked = hallDeletionLocksAction(visualState);
  const feedbackKind = hallDeletionFeedbackKind(error);

  const handleOpen = useCallback(() => {
    if (locked) return;
    clearError();
    setAlreadyGone(false);
    setOpen(true);
  }, [clearError, locked]);

  const handleClose = useCallback(() => {
    if (deleting || exiting) return;
    setOpen(false);
  }, [deleting, exiting]);

  return (
    <HallDeletionStateWrapper state={visualState} className="flex h-full min-w-0 w-full">
      <div
        className="flex h-full w-full min-w-0 flex-col gap-3 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 shadow-[0_8px_22px_rgba(90,55,45,0.05)] sm:p-5"
        data-testid="owner-delete-hall"
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-extrabold text-[var(--wesal-maroon-dark)] sm:text-[0.95rem]">
            {t("owner.hall.delete")}
          </h3>
          <p className="mt-1.5 text-sm leading-6 text-[var(--wesal-muted)]">
            {t("owner.hall.deleteSectionHint")}
          </p>
        </div>

        <div className="mt-auto border-t border-[var(--wesal-border)] pt-3">
          <DestructiveActionButton
            hallId={hallId}
            busy={deleting}
            disabled={locked}
            expanded={open}
            describedBy={feedbackKind ? errorId : undefined}
            onClick={handleOpen}
          />
          {!open && feedbackKind ? (
            <div className="mt-2">
              <HallDeletionFeedback id={errorId} kind={feedbackKind} message={error} />
            </div>
          ) : null}
        </div>

        <DeleteHallConfirmationDialog
          open={open}
          hallId={hallId}
          hallName={hallName}
          busy={deleting}
          errorKey={error}
          onClose={handleClose}
          onConfirm={() => {
            void remove(hallId);
          }}
        />
      </div>
    </HallDeletionStateWrapper>
  );
}
