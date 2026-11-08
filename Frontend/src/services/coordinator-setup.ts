import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import type { CoordinatorSetupResult } from "@/types/coordinator-setup";

const SETUP_PATH = "/coordinator/setup";
const RESUBMIT_PATH = "/coordinator/setup/resubmit";
const UPLOAD_TIMEOUT_MS = 60_000;

type CoordinatorSetupResultDto = CoordinatorSetupResult & {
  IsSetupComplete?: boolean;
  ApprovalStatus?: string | number;
  BusinessType?: string | number;
  SubmittedAt?: string;
};

function stripFormContentType(body: unknown, headers: Record<string, unknown>) {
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    delete headers["Content-Type"];
  }
  return body;
}

function mapResult(data: CoordinatorSetupResultDto): CoordinatorSetupResult {
  return {
    isSetupComplete: Boolean(data.isSetupComplete ?? data.IsSetupComplete),
    approvalStatus: data.approvalStatus ?? data.ApprovalStatus ?? "Pending",
    businessType: (data.businessType ?? data.BusinessType ?? "Shop") as CoordinatorSetupResult["businessType"],
    submittedAt: String(data.submittedAt ?? data.SubmittedAt ?? ""),
  };
}

async function postSetup(
  path: string,
  formData: FormData,
): Promise<CoordinatorSetupResult> {
  try {
    const { data } = await api.post<CoordinatorSetupResultDto>(path, formData, {
      timeout: UPLOAD_TIMEOUT_MS,
      transformRequest: [stripFormContentType],
    });
    return mapResult(data);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error instanceof Error ? error.message : "auth.coordinator.setup.error.generic",
      0,
    );
  }
}

/** POST /api/v1/coordinator/setup — authenticated EventCoordinator only. */
export async function submitCoordinatorSetup(
  formData: FormData,
): Promise<CoordinatorSetupResult> {
  return postSetup(SETUP_PATH, formData);
}

/** PUT/POST resubmit after rejection. */
export async function resubmitCoordinatorSetup(
  formData: FormData,
): Promise<CoordinatorSetupResult> {
  return postSetup(RESUBMIT_PATH, formData);
}
