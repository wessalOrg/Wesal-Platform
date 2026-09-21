"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import DeleteHallConfirmationDialog from "@/components/halls/DeleteHallConfirmationDialog";
import DestructiveActionButton from "@/components/halls/DestructiveActionButton";
import HallDeletionFeedback from "@/components/halls/HallDeletionFeedback";
import HallDeletionStateWrapper from "@/components/halls/HallDeletionStateWrapper";
import { useDeleteHall } from "@/hooks/useDeleteHall";
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
    <HallDeletionStateWrapper state={visualState}>
      <div className="space-y-2" data-testid="owner-delete-hall">
        <DestructiveActionButton
          hallId={hallId}
          busy={deleting}
          disabled={locked}
          expanded={open}
          describedBy={feedbackKind ? errorId : undefined}
          onClick={handleOpen}
        />
        {!open && feedbackKind ? (
          <HallDeletionFeedback id={errorId} kind={feedbackKind} message={error} />
        ) : null}
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
