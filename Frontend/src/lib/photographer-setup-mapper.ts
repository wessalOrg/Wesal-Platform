import { normalizePhotographerPhone } from "@/lib/photographer-setup-validation";
import type { PhotographerSetupValues } from "@/types/photographer-setup";

/**
 * Maps UI form state to multipart fields expected by
 * POST /api/v1/photographer/setup (ASP.NET [FromForm] contract).
 * Only the selected branch's fields and the identity file are appended.
 * Never includes a public display name; FullName is admin-only on the backend.
 */
export function mapPhotographerSetupToFormData(
  values: PhotographerSetupValues,
): FormData {
  const formData = new FormData();
  formData.append("HasStudio", values.hasStudio ? "true" : "false");
  formData.append("PhoneNumber", normalizePhotographerPhone(values.phoneNumber));

  if (values.identityDocument) {
    formData.append(
      "IdentityDocument",
      values.identityDocument,
      values.identityDocument.name,
    );
  }

  if (values.hasStudio) {
    formData.append("StudioName", values.studioName.trim());
    formData.append("StudioLocation", values.studioLocation.trim());
    formData.append("DetailedStudioLocation", values.detailedStudioLocation.trim());
    return formData;
  }

  formData.append("FullName", values.fullName.trim());
  return formData;
}
