import {
  isAcceptedIdentityFile,
  isValidCoordinatorPhone,
  isWithinUploadSize,
  normalizeCoordinatorPhone,
} from "@/lib/coordinator-setup-validation";
import {
  PHOTOGRAPHER_LIMITS,
  type PhotographerSetupFieldErrors,
  type PhotographerSetupValues,
} from "@/types/photographer-setup";

export type PhotographerSetupErrorKey =
  | "auth.photographer.setup.error.hasStudio"
  | "auth.photographer.setup.error.studioName"
  | "auth.photographer.setup.error.studioNameMax"
  | "auth.photographer.setup.error.studioLocation"
  | "auth.photographer.setup.error.studioLocationMax"
  | "auth.photographer.setup.error.detailedStudioLocation"
  | "auth.photographer.setup.error.detailedStudioLocationMax"
  | "auth.photographer.setup.error.fullName"
  | "auth.photographer.setup.error.fullNameMax"
  | "auth.photographer.setup.error.phone"
  | "auth.photographer.setup.error.phoneInvalid"
  | "auth.photographer.setup.error.identityDocument"
  | "auth.photographer.setup.error.fileType"
  | "auth.photographer.setup.error.fileSize";

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

export function validatePhotographerIdentityFile(
  file: File | null,
): PhotographerSetupErrorKey | null {
  if (!file) return "auth.photographer.setup.error.identityDocument";
  if (!isAcceptedIdentityFile(file)) return "auth.photographer.setup.error.fileType";
  if (!isWithinUploadSize(file)) return "auth.photographer.setup.error.fileSize";
  return null;
}

export function createEmptyPhotographerSetupValues(
  hasStudio: boolean = true,
): PhotographerSetupValues {
  if (hasStudio) {
    return {
      hasStudio: true,
      studioName: "",
      studioLocation: "",
      detailedStudioLocation: "",
      phoneNumber: "",
      identityDocument: null,
    };
  }
  return {
    hasStudio: false,
    fullName: "",
    phoneNumber: "",
    identityDocument: null,
  };
}

/** Switch branch while preserving shared phone / identity when possible. */
export function switchPhotographerStudioBranch(
  current: PhotographerSetupValues,
  nextHasStudio: boolean,
): PhotographerSetupValues {
  if (current.hasStudio === nextHasStudio) return current;
  const shared = {
    phoneNumber: current.phoneNumber,
    identityDocument: current.identityDocument,
  };
  if (nextHasStudio) {
    return {
      hasStudio: true,
      studioName: "",
      studioLocation: "",
      detailedStudioLocation: "",
      ...shared,
    };
  }
  return {
    hasStudio: false,
    fullName: "",
    ...shared,
  };
}

export function validatePhotographerSetupValues(
  values: PhotographerSetupValues,
): PhotographerSetupFieldErrors {
  const errors: PhotographerSetupFieldErrors = {};

  if (isBlank(values.phoneNumber)) {
    errors.phoneNumber = "auth.photographer.setup.error.phone";
  } else if (!isValidCoordinatorPhone(values.phoneNumber)) {
    errors.phoneNumber = "auth.photographer.setup.error.phoneInvalid";
  }

  const identityIssue = validatePhotographerIdentityFile(values.identityDocument);
  if (identityIssue) errors.identityDocument = identityIssue;

  if (values.hasStudio) {
    if (isBlank(values.studioName)) {
      errors.studioName = "auth.photographer.setup.error.studioName";
    } else if (values.studioName.trim().length > PHOTOGRAPHER_LIMITS.maxStudioNameLength) {
      errors.studioName = "auth.photographer.setup.error.studioNameMax";
    }

    if (isBlank(values.studioLocation)) {
      errors.studioLocation = "auth.photographer.setup.error.studioLocation";
    } else if (
      values.studioLocation.trim().length > PHOTOGRAPHER_LIMITS.maxStudioLocationLength
    ) {
      errors.studioLocation = "auth.photographer.setup.error.studioLocationMax";
    }

    if (isBlank(values.detailedStudioLocation)) {
      errors.detailedStudioLocation =
        "auth.photographer.setup.error.detailedStudioLocation";
    } else if (
      values.detailedStudioLocation.trim().length >
      PHOTOGRAPHER_LIMITS.maxDetailedStudioLocationLength
    ) {
      errors.detailedStudioLocation =
        "auth.photographer.setup.error.detailedStudioLocationMax";
    }
  } else {
    if (isBlank(values.fullName)) {
      errors.fullName = "auth.photographer.setup.error.fullName";
    } else if (values.fullName.trim().length > PHOTOGRAPHER_LIMITS.maxFullNameLength) {
      errors.fullName = "auth.photographer.setup.error.fullNameMax";
    }
  }

  return errors;
}

export { normalizeCoordinatorPhone as normalizePhotographerPhone };
