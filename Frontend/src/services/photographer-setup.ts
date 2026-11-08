import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import type { PhotographerSetupResult } from "@/types/photographer-setup";

const SETUP_PATH = "/photographer/setup";
const RESUBMIT_PATH = "/photographer/setup/resubmit";
const UPLOAD_TIMEOUT_MS = 60_000;

type PhotographerSetupResultDto = PhotographerSetupResult & {
  IsSetupComplete?: boolean;
  ApprovalStatus?: string | number;
  HasStudio?: boolean;
  SubmittedAt?: string;
};

function stripFormContentType(body: unknown, headers: Record<string, unknown>) {
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    delete headers["Content-Type"];
  }
  return body;
}

function mapResult(data: PhotographerSetupResultDto): PhotographerSetupResult {
  return {
    isSetupComplete: Boolean(data.isSetupComplete ?? data.IsSetupComplete),
    approvalStatus: data.approvalStatus ?? data.ApprovalStatus ?? "Pending",
    hasStudio: Boolean(data.hasStudio ?? data.HasStudio),
    submittedAt: String(data.submittedAt ?? data.SubmittedAt ?? ""),
  };
}

async function postSetup(
  path: string,
  formData: FormData,
): Promise<PhotographerSetupResult> {
  try {
    const { data } = await api.post<PhotographerSetupResultDto>(path, formData, {
      timeout: UPLOAD_TIMEOUT_MS,
      transformRequest: [stripFormContentType],
    });
    return mapResult(data);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error instanceof Error ? error.message : "auth.photographer.setup.error.generic",
      0,
    );
  }
}

/** POST /api/v1/photographer/setup — authenticated Photographer only. */
export async function submitPhotographerSetup(
  formData: FormData,
): Promise<PhotographerSetupResult> {
  return postSetup(SETUP_PATH, formData);
}

/** PUT/POST resubmit after rejection. */
export async function resubmitPhotographerSetup(
  formData: FormData,
): Promise<PhotographerSetupResult> {
  return postSetup(RESUBMIT_PATH, formData);
}
