import { ProfileError } from "@/lib/profile-errors";
import type { UpdateProfileInput, UserProfile } from "@/types/profile";

const STORAGE_KEY = "wesal_profile_mock";
const LATENCY_MS = 380;

const TAKEN_EMAIL = "taken@wesal.ps";
const TAKEN_PHONE = "+970599000000";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{6,19}$/;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function readStore(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile & { version?: number };
    if (!parsed?.id) return null;
    const stamp =
      parsed.concurrencyStamp ||
      (typeof parsed.version === "number" ? String(parsed.version) : "");
    if (!stamp) return null;
    return {
      id: parsed.id,
      fullName: parsed.fullName,
      email: parsed.email,
      phoneNumber: parsed.phoneNumber,
      concurrencyStamp: stamp,
    };
  } catch {
    return null;
  }
}

function writeStore(profile: UserProfile): void {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

function seedProfile(displayName: string | null): UserProfile {
  const fullName = displayName?.trim() || "ليان أحمد";
  return {
    id: "mock-regular-user",
    fullName,
    email: "layan@wesal.ps",
    phoneNumber: "+970599111222",
    concurrencyStamp: "1",
  };
}

function requireProfile(displayName: string | null): UserProfile {
  return readStore() ?? seedProfile(displayName);
}

export async function mockFetchProfile(displayName: string | null): Promise<UserProfile> {
  await wait(LATENCY_MS);
  const profile = requireProfile(displayName);
  writeStore(profile);
  return { ...profile };
}

export async function mockUpdateProfile(
  input: UpdateProfileInput,
  displayName: string | null,
): Promise<UserProfile> {
  await wait(LATENCY_MS);

  const current = requireProfile(displayName);
  const fullName = input.fullName.trim();
  const email = input.email.trim();
  const phoneNumber = input.phoneNumber.trim();

  if (input.concurrencyStamp !== current.concurrencyStamp) {
    throw new ProfileError("errors.profile.stale", 409, {
      code: "stale",
      currentStamp: current.concurrencyStamp,
    });
  }

  const fields: Record<string, string> = {};
  if (!fullName) fields.fullName = "errors.profile.fullNameRequired";
  else if (fullName.length > 150) fields.fullName = "errors.profile.fullNameTooLong";

  if (!email) fields.email = "errors.profile.emailRequired";
  else if (!EMAIL_RE.test(email) || email.length > 256) {
    fields.email = "errors.profile.emailInvalid";
  }

  if (!phoneNumber) fields.phoneNumber = "errors.profile.phoneRequired";
  else if (!PHONE_RE.test(phoneNumber) || phoneNumber.length > 30) {
    fields.phoneNumber = "errors.profile.phoneInvalid";
  }

  if (Object.keys(fields).length > 0) {
    throw new ProfileError("errors.profile.validation", 400, { fields });
  }

  if (email.toLowerCase() === TAKEN_EMAIL) {
    throw new ProfileError("errors.profile.emailTaken", 409, {
      code: "email_taken",
      fields: { email: "errors.profile.emailTaken" },
    });
  }

  if (phoneNumber.replace(/\s/g, "") === TAKEN_PHONE) {
    throw new ProfileError("errors.profile.phoneTaken", 409, {
      code: "phone_taken",
      fields: { phoneNumber: "errors.profile.phoneTaken" },
    });
  }

  const next: UserProfile = {
    ...current,
    fullName,
    email,
    phoneNumber,
    concurrencyStamp: String(Number(current.concurrencyStamp || "0") + 1),
  };
  writeStore(next);
  return { ...next };
}
