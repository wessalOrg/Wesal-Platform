import { ApiError } from "@/lib/api-error";

export type MarkPaidErrorKind =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "not_approved"
  | "network"
  | "generic";

export class MarkPaidError extends ApiError {
  kind: MarkPaidErrorKind;

  constructor(message: string, status?: number, kind: MarkPaidErrorKind = "generic") {
    super(message, status);
    this.name = "MarkPaidError";
    this.kind = kind;
  }
}

export function toMarkPaidError(err: unknown): MarkPaidError {
  if (err instanceof MarkPaidError) return err;

  const status = err instanceof ApiError ? err.status : undefined;
  const code = err instanceof ApiError ? (err.code ?? "").toLowerCase() : "";
  const blob = (
    err instanceof ApiError
      ? `${err.message} ${err.detail ?? ""} ${err.code ?? ""}`
      : err instanceof Error
        ? err.message
        : String(err ?? "")
  ).toLowerCase();

  if (status === 401) {
    return new MarkPaidError("admin.halls.paid.errors.unauthorized", 401, "unauthorized");
  }
  if (status === 403) {
    return new MarkPaidError("admin.halls.paid.errors.forbidden", 403, "forbidden");
  }
  if (status === 404) {
    return new MarkPaidError("admin.halls.paid.errors.notFound", 404, "not_found");
  }
  if (
    status === 422 ||
    code === "hallnotapproved" ||
    blob.includes("notapproved") ||
    blob.includes("only an approved")
  ) {
    return new MarkPaidError("admin.halls.paid.errors.notApproved", 422, "not_approved");
  }
  if (!status || blob.includes("network") || blob.includes("timeout")) {
    return new MarkPaidError("admin.halls.paid.errors.network", status, "network");
  }
  return new MarkPaidError("admin.halls.paid.errors.generic", status, "generic");
}
