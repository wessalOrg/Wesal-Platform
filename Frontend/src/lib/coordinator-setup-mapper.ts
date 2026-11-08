import { normalizeCoordinatorPhone } from "@/lib/coordinator-setup-validation";
import type { CoordinatorSetupValues } from "@/types/coordinator-setup";

/**
 * Maps UI form state to the multipart fields expected by
 * POST /api/v1/coordinator/setup (ASP.NET [FromForm] contract).
 * Only the selected branch's fields and files are appended.
 */
export function mapCoordinatorSetupToFormData(values: CoordinatorSetupValues): FormData {
  const formData = new FormData();
  formData.append("BusinessType", values.businessType);
  formData.append("PhoneNumber", normalizeCoordinatorPhone(values.phoneNumber));

  if (values.identityDocument) {
    formData.append("IdentityDocument", values.identityDocument, values.identityDocument.name);
  }

  if (values.businessType === "Shop") {
    formData.append("ShopName", values.shopName.trim());
    formData.append("ShopLocation", values.shopLocation.trim());
    if (values.shopPhoto) {
      formData.append("ShopPhoto", values.shopPhoto, values.shopPhoto.name);
    }
    return formData;
  }

  formData.append("OnlineStoreName", values.onlineStoreName.trim());
  for (const photo of values.workPhotos) {
    if (photo) formData.append("WorkPhotos", photo, photo.name);
  }
  return formData;
}
