import {
  isValidRegisterPhone,
  normalizeRegisterPhone,
} from "@/lib/register-validation";
import {
  COORDINATOR_IDENTITY_ACCEPT,
  COORDINATOR_IMAGE_ACCEPT,
  COORDINATOR_LIMITS,
  COORDINATOR_MAX_IMAGE_BYTES,
  COORDINATOR_WORK_PHOTO_COUNT,
  type CoordinatorBusinessType,
  type CoordinatorSetupFieldErrors,
  type CoordinatorSetupValues,
} from "@/types/coordinator-setup";

const IMAGE_MIME = new Set(
  COORDINATOR_IMAGE_ACCEPT.split(",").map((value) => value.trim()),
);
const IDENTITY_MIME = new Set(
  COORDINATOR_IDENTITY_ACCEPT.split(",").map((value) => value.trim()),
);

export type CoordinatorSetupErrorKey =
  | "auth.coordinator.setup.error.businessType"
  | "auth.coordinator.setup.error.shopName"
  | "auth.coordinator.setup.error.shopNameMax"
  | "auth.coordinator.setup.error.shopLocation"
  | "auth.coordinator.setup.error.shopLocationMax"
  | "auth.coordinator.setup.error.onlineStoreName"
  | "auth.coordinator.setup.error.onlineStoreNameMax"
  | "auth.coordinator.setup.error.phone"
  | "auth.coordinator.setup.error.phoneInvalid"
  | "auth.coordinator.setup.error.shopPhoto"
  | "auth.coordinator.setup.error.identityDocument"
  | "auth.coordinator.setup.error.workPhotosCount"
  | "auth.coordinator.setup.error.workPhoto"
  | "auth.coordinator.setup.error.fileType"
  | "auth.coordinator.setup.error.fileSize";

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

export function isAcceptedImageFile(file: File): boolean {
  return IMAGE_MIME.has(file.type.toLowerCase());
}

export function isAcceptedIdentityFile(file: File): boolean {
  return IDENTITY_MIME.has(file.type.toLowerCase());
}

export function isWithinUploadSize(file: File): boolean {
  return file.size > 0 && file.size <= COORDINATOR_MAX_IMAGE_BYTES;
}

export function validateCoordinatorImageFile(file: File | null): CoordinatorSetupErrorKey | null {
  if (!file) return "auth.coordinator.setup.error.shopPhoto";
  if (!isAcceptedImageFile(file)) return "auth.coordinator.setup.error.fileType";
  if (!isWithinUploadSize(file)) return "auth.coordinator.setup.error.fileSize";
  return null;
}

export function validateCoordinatorIdentityFile(
  file: File | null,
): CoordinatorSetupErrorKey | null {
  if (!file) return "auth.coordinator.setup.error.identityDocument";
  if (!isAcceptedIdentityFile(file)) return "auth.coordinator.setup.error.fileType";
  if (!isWithinUploadSize(file)) return "auth.coordinator.setup.error.fileSize";
  return null;
}

export function createEmptyCoordinatorSetupValues(
  businessType: CoordinatorBusinessType = "Shop",
): CoordinatorSetupValues {
  if (businessType === "Freelance") {
    return {
      businessType: "Freelance",
      onlineStoreName: "",
      phoneNumber: "",
      workPhotos: [null, null],
      identityDocument: null,
    };
  }
  return {
    businessType: "Shop",
    shopName: "",
    shopLocation: "",
    phoneNumber: "",
    shopPhoto: null,
    identityDocument: null,
  };
}

/** Switch branch while preserving shared phone / identity when possible. */
export function switchCoordinatorBusinessType(
  current: CoordinatorSetupValues,
  next: CoordinatorBusinessType,
): CoordinatorSetupValues {
  if (current.businessType === next) return current;
  const shared = {
    phoneNumber: current.phoneNumber,
    identityDocument: current.identityDocument,
  };
  if (next === "Shop") {
    return {
      businessType: "Shop",
      shopName: "",
      shopLocation: "",
      shopPhoto: null,
      ...shared,
    };
  }
  return {
    businessType: "Freelance",
    onlineStoreName: "",
    workPhotos: [null, null],
    ...shared,
  };
}

export function validateCoordinatorSetupValues(
  values: CoordinatorSetupValues,
): CoordinatorSetupFieldErrors {
  const errors: CoordinatorSetupFieldErrors = {};

  if (isBlank(values.phoneNumber)) {
    errors.phoneNumber = "auth.coordinator.setup.error.phone";
  } else if (!isValidCoordinatorPhone(values.phoneNumber)) {
    errors.phoneNumber = "auth.coordinator.setup.error.phoneInvalid";
  }

  const identityIssue = validateCoordinatorIdentityFile(values.identityDocument);
  if (identityIssue) errors.identityDocument = identityIssue;

  if (values.businessType === "Shop") {
    if (isBlank(values.shopName)) {
      errors.shopName = "auth.coordinator.setup.error.shopName";
    } else if (values.shopName.trim().length > COORDINATOR_LIMITS.maxShopNameLength) {
      errors.shopName = "auth.coordinator.setup.error.shopNameMax";
    }

    if (isBlank(values.shopLocation)) {
      errors.shopLocation = "auth.coordinator.setup.error.shopLocation";
    } else if (values.shopLocation.trim().length > COORDINATOR_LIMITS.maxShopLocationLength) {
      errors.shopLocation = "auth.coordinator.setup.error.shopLocationMax";
    }

    const shopPhotoIssue = validateCoordinatorImageFile(values.shopPhoto);
    if (shopPhotoIssue) {
      errors.shopPhoto =
        shopPhotoIssue === "auth.coordinator.setup.error.shopPhoto"
          ? "auth.coordinator.setup.error.shopPhoto"
          : shopPhotoIssue;
    }
  } else {
    if (isBlank(values.onlineStoreName)) {
      errors.onlineStoreName = "auth.coordinator.setup.error.onlineStoreName";
    } else if (
      values.onlineStoreName.trim().length > COORDINATOR_LIMITS.maxOnlineStoreNameLength
    ) {
      errors.onlineStoreName = "auth.coordinator.setup.error.onlineStoreNameMax";
    }

    const filled = values.workPhotos.filter((file): file is File => Boolean(file));
    if (filled.length !== COORDINATOR_WORK_PHOTO_COUNT) {
      errors.workPhotos = "auth.coordinator.setup.error.workPhotosCount";
    }

    values.workPhotos.forEach((file, index) => {
      if (!file) {
        errors[index === 0 ? "workPhoto0" : "workPhoto1"] =
          "auth.coordinator.setup.error.workPhoto";
        return;
      }
      if (!isAcceptedImageFile(file)) {
        errors[index === 0 ? "workPhoto0" : "workPhoto1"] =
          "auth.coordinator.setup.error.fileType";
      } else if (!isWithinUploadSize(file)) {
        errors[index === 0 ? "workPhoto0" : "workPhoto1"] =
          "auth.coordinator.setup.error.fileSize";
      }
    });
  }

  return errors;
}

export function normalizeCoordinatorPhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  // Setup UI shows +970; accept local 05… or national 5… mobiles.
  if (/^05\d{8}$/.test(digits)) return `+970${digits.slice(1)}`;
  if (/^5\d{8}$/.test(digits)) return `+970${digits}`;
  if (/^9705\d{8}$/.test(digits)) return `+${digits}`;
  return normalizeRegisterPhone(phone);
}

export function isValidCoordinatorPhone(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed) return false;
  const digits = trimmed.replace(/\D/g, "");
  if (/^05\d{8}$/.test(digits) || /^5\d{8}$/.test(digits) || /^9705\d{8}$/.test(digits)) {
    return true;
  }
  return isValidRegisterPhone(phone);
}
