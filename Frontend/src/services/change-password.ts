import api from "@/lib/api";
import { ApiError, getApiFieldMessages } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";
import { getRegisterPasswordIssue } from "@/lib/register-validation";
import { profileUsesMock } from "@/services/profile";

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type ChangePasswordField =
  | "currentPassword"
  | "newPassword"
  | "confirmPassword";

export type ChangePasswordFieldErrors = Partial<Record<ChangePasswordField, string>>;

export class ChangePasswordError extends Error {
  readonly fields: ChangePasswordFieldErrors;

  constructor(message: string, fields: ChangePasswordFieldErrors = {}) {
    super(message);
    this.name = "ChangePasswordError";
    this.fields = fields;
  }
}

function passwordIssueKey(
  issue: NonNullable<ReturnType<typeof getRegisterPasswordIssue>>,
): string {
  switch (issue) {
    case "required":
      return "auth.register.form.error.password";
    case "min":
      return "auth.register.form.error.passwordMin";
    case "max":
      return "auth.register.form.error.passwordMax";
    case "upper":
      return "auth.register.form.error.passwordUpper";
    case "lower":
      return "auth.register.form.error.passwordLower";
    case "digit":
      return "auth.register.form.error.passwordDigit";
    case "special":
      return "auth.register.form.error.passwordSpecial";
  }
}

export function validateChangePassword(
  input: ChangePasswordInput,
): ChangePasswordFieldErrors {
  const fields: ChangePasswordFieldErrors = {};

  if (!input.currentPassword.trim()) {
    fields.currentPassword = "seeker.settings.password.errors.currentRequired";
  }

  const newIssue = getRegisterPasswordIssue(input.newPassword);
  if (newIssue) fields.newPassword = passwordIssueKey(newIssue);

  if (!input.confirmPassword) {
    fields.confirmPassword = "auth.register.form.error.confirmPassword";
  } else if (input.newPassword !== input.confirmPassword) {
    fields.confirmPassword = "auth.register.form.error.passwordMismatch";
  }

  if (
    !fields.newPassword &&
    input.currentPassword &&
    input.newPassword &&
    input.currentPassword === input.newPassword
  ) {
    fields.newPassword = "seeker.settings.password.errors.sameAsCurrent";
  }

  return fields;
}

async function mockChangePassword(input: ChangePasswordInput): Promise<void> {
  const fields = validateChangePassword(input);
  if (Object.keys(fields).length) {
    throw new ChangePasswordError("seeker.settings.password.errors.invalid", fields);
  }
  await new Promise((resolve) => setTimeout(resolve, 350));
}

const CHANGE_PASSWORD_FIELDS: ChangePasswordField[] = [
  "currentPassword",
  "newPassword",
  "confirmPassword",
];

function localizeChangePasswordField(
  field: ChangePasswordField,
  message: string,
): string | null {
  const lower = message.toLowerCase();

  if (field === "currentPassword") {
    return "seeker.settings.password.errors.currentInvalid";
  }

  if (field === "confirmPassword") {
    return lower.includes("match")
      ? "auth.register.form.error.passwordMismatch"
      : "auth.register.form.error.confirmPassword";
  }

  if (field === "newPassword") {
    if (lower.includes("different")) return "seeker.settings.password.errors.sameAsCurrent";
    if (lower.includes("uppercase")) return "auth.register.form.error.passwordUpper";
    if (lower.includes("lowercase")) return "auth.register.form.error.passwordLower";
    if (lower.includes("digit") || lower.includes("number")) {
      return "auth.register.form.error.passwordDigit";
    }
    if (lower.includes("special") || lower.includes("alphanumeric")) {
      return "auth.register.form.error.passwordSpecial";
    }
    if (lower.includes("at least") || lower.includes("minimum") || lower.includes("too short")) {
      return "auth.register.form.error.passwordMin";
    }
    return "auth.register.form.error.password";
  }

  return null;
}

async function apiChangePassword(input: ChangePasswordInput): Promise<void> {
  const fields = validateChangePassword(input);
  if (Object.keys(fields).length) {
    throw new ChangePasswordError("seeker.settings.password.errors.invalid", fields);
  }

  try {
    await api.post(
      "/profile/change-password",
      {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        confirmPassword: input.confirmPassword,
      },
      { timeout: 10000 },
    );
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 400 || err.status === 422) {
        const fieldErrors: ChangePasswordFieldErrors = {};
        for (const field of CHANGE_PASSWORD_FIELDS) {
          const message = getApiFieldMessages(err, field)[0];
          if (!message) continue;
          const key = localizeChangePasswordField(field, message);
          if (key) fieldErrors[field] = key;
        }
        if (Object.keys(fieldErrors).length > 0) {
          throw new ChangePasswordError("seeker.settings.password.errors.invalid", fieldErrors);
        }
        throw new ChangePasswordError("seeker.settings.password.errors.invalid", {
          currentPassword: "seeker.settings.password.errors.currentInvalid",
        });
      }
      if (err.status === 401) {
        throw new ChangePasswordError("seeker.settings.password.errors.unauthorized");
      }
    }
    throw new ChangePasswordError("seeker.settings.password.errors.generic");
  }
}

export async function changePassword(input: ChangePasswordInput): Promise<void> {
  const token = getAccessToken();
  if (!token || profileUsesMock()) {
    await mockChangePassword(input);
    return;
  }
  await apiChangePassword(input);
}
