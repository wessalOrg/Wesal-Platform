import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";
import { toHallPaymentStatus } from "@/constants/hallPaymentStatus";

export const PAYMENT_RECEIPT_PATH = (hallId: string) =>
  `/owner/halls/${encodeURIComponent(hallId)}/payment-receipt`;

export type PaymentReceiptUploadResult = {
  hallId: string;
  hallName: string;
  paymentStatus: "Unpaid" | "ReceiptUploaded" | "Paid";
  uploadedAt: string | null;
  hasReceipt: boolean;
};

type PaymentReceiptUploadResultDto = {
  hallId?: string | null;
  hallName?: string | null;
  paymentStatus?: string | number | null;
  uploadedAt?: string | null;
  hasReceipt?: boolean | null;
};

function mapPaymentReceiptResult(
  data: unknown,
  fallbackHallId: string,
): PaymentReceiptUploadResult {
  const dto = data as PaymentReceiptUploadResultDto;
  const paymentStatus = toHallPaymentStatus(dto.paymentStatus);
  return {
    hallId: String(dto.hallId ?? fallbackHallId ?? "").trim(),
    hallName: String(dto.hallName ?? "—").trim(),
    paymentStatus: paymentStatus ?? "ReceiptUploaded",
    uploadedAt: String(dto.uploadedAt ?? "").trim() || null,
    hasReceipt: Boolean(dto.hasReceipt),
  };
}

function usesMock(): boolean {
  const token = getAccessToken();
  return !token || token.startsWith("stub-");
}

/**
 * Uploads the payment receipt for one of the owner's own halls (US-OWNER-31).
 * Only valid for an Approved, not-yet-paid hall; success moves it to ReceiptUploaded.
 * Multipart field name is `file`. POST /api/v1/owner/halls/{hallId}/payment-receipt
 */
export async function uploadPaymentReceipt(
  hallId: string,
  hallName: string,
  file: File,
): Promise<PaymentReceiptUploadResult> {
  if (usesMock()) {
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    return {
      hallId,
      hallName,
      paymentStatus: "ReceiptUploaded",
      uploadedAt: new Date().toISOString(),
      hasReceipt: true,
    };
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const { data, status } = await api.post<unknown>(PAYMENT_RECEIPT_PATH(hallId), formData, {
      timeout: 60000,
      transformRequest: [
        (body, headers) => {
          if (typeof FormData !== "undefined" && body instanceof FormData) {
            if (headers && typeof headers === "object") {
              delete (headers as Record<string, unknown>)["Content-Type"];
            }
          }
          return body;
        },
      ],
    });

    if (status === 204 || data == null || data === "") {
      return {
        hallId,
        hallName,
        paymentStatus: "ReceiptUploaded",
        uploadedAt: new Date().toISOString(),
        hasReceipt: true,
      };
    }
    return mapPaymentReceiptResult(data, hallId);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error
        ? err.message
        : "owner.management.payment.errors.uploadFailed",
      0,
    );
  }
}

/**
 * Streams the owner's own payment receipt for a hall as a preview object URL.
 * Returns null when no receipt exists (backend 404).
 * GET /api/v1/owner/halls/{hallId}/payment-receipt
 */
export async function fetchPaymentReceiptUrl(
  hallId: string,
): Promise<string | null> {
  if (usesMock()) return null;

  try {
    const { data } = await api.get<Blob>(PAYMENT_RECEIPT_PATH(hallId), {
      responseType: "blob",
      timeout: 15000,
    });
    if (!data || (typeof Blob !== "undefined" && data.size === 0)) return null;
    return URL.createObjectURL(data);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) return null;
      throw err;
    }
    throw new ApiError(
      err instanceof Error
        ? err.message
        : "owner.management.payment.errors.loadFailed",
      0,
    );
  }
}