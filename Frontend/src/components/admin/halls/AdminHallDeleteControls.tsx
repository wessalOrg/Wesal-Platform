"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useDeleteAdminHall } from "@/hooks/useDeleteAdminHall";
import { ADMIN_MANAGEMENT_PATH } from "@/lib/account-profile-path";
import { useT } from "@/i18n";

type AdminHallDeleteControlsProps = {
  hallId: string;
  hallName: string;
};

export default function AdminHallDeleteControls({
  hallId,
  hallName,
}: AdminHallDeleteControlsProps) {
  const t = useT();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const deleteState = useDeleteAdminHall({
    onDeleted: () => {
      setConfirmOpen(false);
      router.push(ADMIN_MANAGEMENT_PATH);
    },
  });

  const closeConfirm = useCallback(() => setConfirmOpen(false), []);

  return (
    <div className="flex min-w-0 flex-col items-stretch gap-2">
      {deleteState.errorKey ? (
        <p className="rounded-xl bg-[#fdecea] px-3 py-2 text-sm text-[#b42318]" role="alert">
          {t(deleteState.errorKey)}
        </p>
      ) : null}

      {!confirmOpen ? (
        <button
          type="button"
          className="btn-outline min-h-11 min-w-[8.5rem] border-[#b42318] text-[#b42318] hover:bg-[#fdecea]"
          disabled={deleteState.pending}
          data-testid="admin-hall-delete"
          onClick={() => setConfirmOpen(true)}
        >
          {t("admin.delete.submit")}
        </button>
      ) : (
        <div className="rounded-xl border border-[#f5c6c2] bg-[#fdecea] p-4 space-y-3">
          <p className="text-sm font-semibold text-[#b42318]">
            {t("admin.delete.confirm", { name: hallName })}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="min-h-10 rounded-lg bg-[#b42318] px-4 text-xs font-semibold text-white hover:bg-[#912019] disabled:opacity-60"
              disabled={deleteState.pending}
              data-testid="admin-hall-delete-confirm"
              onClick={() => {
                deleteState.clearError();
                void deleteState.deleteHall(hallId);
              }}
            >
              {deleteState.pending ? t("admin.delete.deleting") : t("admin.delete.confirmYes")}
            </button>
            <button
              type="button"
              className="btn-outline min-h-10"
              disabled={deleteState.pending}
              onClick={closeConfirm}
            >
              {t("admin.delete.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
