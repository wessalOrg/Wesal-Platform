# BACKEND REQUIREMENTS FOR TASK 5

Frontend Task 5 (rejection, request-changes, resubmission) integrates with existing
notifications and `POST/PUT …/setup/resubmit`. The items below are **verified gaps**
that block full product behavior. Proposed shapes are recommendations, not live contracts.

---

## 1. Own registration submission read API

1. **Feature name:** Get own coordinator/photographer setup submission  
2. **Business requirement:** Prefill edit/resubmit form with previously submitted text fields and represent existing attachments.  
3. **Current available backend behavior:**  
   - `GET /profile` exposes `IsSetupComplete` + `ApprovalStatus` only (no setup fields, no rejection reason).  
   - `GET /profile/public/{userId}` for a non-approved self caller returns only identity/status with `IsPubliclyAvailable=false` (no setup fields).  
   - Admin-only detail DTOs exist (`AdminCoordinatorRequestDetailDto` / `AdminPhotographerRequestDetailDto`) and are not callable by the applicant.  
4. **Missing behavior:** Authenticated EventCoordinator / Photographer cannot read their own submitted setup payload.  
5. **Proposed endpoint:** `GET /api/v1/coordinator/setup` and `GET /api/v1/photographer/setup` (or `/me`)  
6. **Suggested HTTP method:** GET  
7. **Required request fields:** none (caller identity from auth)  
8. **Required response fields (non-sensitive):**  
   - Coordinator: `businessType`, shop/freelance text fields, `phoneNumber`, `submittedAt`, booleans/flags that attachments exist (not storage keys).  
   - Photographer: `hasStudio`, studio/independent text fields, `phoneNumber`, `submittedAt`, identity-present flag.  
   - Independent photographer `fullName` may be returned **only** on this authenticated own-setup surface (never on public profile).  
9. **Auth:** Require EventCoordinator / Photographer respectively; own account only.  
10. **Validation/errors:** 401/403/404 when no profile.  
11. **Frontend blocked:** Prefill of previous registration data.  
12. **Priority:** Critical  

---

## 2. Preserve unchanged attachments on resubmit

1. **Feature name:** Optional attachment retention on resubmit  
2. **Business requirement:** Do not force re-upload of valid existing ID/shop/work photos when only text changes.  
3. **Current available backend behavior:**  
   - `POST/PUT /coordinator/setup/resubmit` and `/photographer/setup/resubmit` re-run the same attachment validators as initial submit.  
   - Identity document (and branch photos) are required multipart files every time; previous URLs are overwritten.  
   - Controllers never return private document URLs to the applicant.  
4. **Missing behavior:** No “keep existing file” flag / omitted-file means keep semantics.  
5. **Proposed modification:** Accept omitted file parts as “retain previous” when status is Rejected/NeedsChanges; reject omit only when no prior file exists.  
6. **Suggested HTTP method:** same resubmit endpoints  
7. **Required request fields:** existing Form fields + optional files  
8. **Required response fields:** unchanged status result is fine; optionally `retainedAttachments` flags  
9. **Auth:** unchanged  
10. **Validation:** branch rules unchanged; omit allowed only when prior attachment exists  
11. **Frontend blocked:** Safe attachment preview + replace-only UX without full re-upload  
12. **Priority:** Critical  

---

## 3. Rejection / NeedsChanges reason on profile

1. **Feature name:** Account decision reason on profile  
2. **Business requirement:** Status UI shows Admin reason/notes without depending on notification inbox hydration.  
3. **Current available backend behavior:** Reason is embedded in notification body (`CoordinatorRejectedForCoordinator`, `PhotographerRejectedForPhotographer`) and posted into Admin conversation; NeedsChanges notes live in conversation (notification body points there). `ProfileResponse` has no reason field.  
4. **Missing behavior:** Durable `rejectionReason` / `changeRequestNotes` on profile (or own-setup GET).  
5. **Proposed modification:** Add optional `LastReviewNote` (or similar) to `ProfileResponse` for professional roles when status is Rejected/NeedsChanges.  
6. **Suggested HTTP method:** existing `GET /profile`  
7. **Required response fields:** `lastReviewNote?: string`, `lastReviewAt?: string`  
8. **Auth:** own profile only  
9. **Validation:** never expose notes on public profile  
10. **Frontend blocked:** Status panel notes when inbox is empty/unhydrated  
11. **Priority:** High  

---

## 4. Coordinator NeedsChanges workflow

1. **Feature name:** Coordinator request-changes (parity with photographer)  
2. **Business requirement:** Only required if product wants coordinator “request changes” distinct from reject. Task 5 explicitly scopes NeedsChanges to photographers unless already supported.  
3. **Current available backend behavior:** Photographer admin `RequestChanges` → `NeedsChanges` + notification; coordinator resubmit allowed **only** from `Rejected`.  
4. **Missing behavior:** Coordinator NeedsChanges transition + notification kind (if product needs it).  
5. **Proposed:** Out of scope unless product asks; document only.  
6–11. N/A  
12. **Priority:** Optional  

---

## Frontend workarounds shipped with Task 5

- Rejection / NeedsChanges notifications mapped; click opens Admin conversation via `targetId`.  
- Status panel hydrates `GET /notifications` for rejection reasons and falls back to Admin conversation messages for NeedsChanges notes (`useProfessionalReviewNotes`); still no durable profile field (gap 3).  
- Edit & Resubmit opens setup `?mode=edit`.  
- Resubmit forms call existing resubmit endpoints; user must re-enter fields and re-upload required files until gaps 1–2 are fixed.  

## Resolved since backend `321893f`

Hall booking for EventCoordinator / Photographer (any approval status) is supported by
`HallBookingAccess` on the backend. Frontend `BookHall` / `getHallActionPermissions`
now mirror that policy; publishing remains approval-gated.

---

# TASK 8 — Public professional profiles (verified gaps)

Frontend Task 8 integrates `GET /profile/{userId}`, `PUT /profile/bio`,
`GET /posts/profile/{userId}`, `GET /offers/profile/{userId}`, and
`POST /professionals/{providerUserId}/conversations`. Gaps below are verified from
backend source; they do not block the core public profile page.

## T8.1 Profile cover / banner image

1. **Feature name:** Public profile cover image  
2. **Business requirement:** Cinematic cover behind the avatar matching the approved UI mockup.  
3. **Current available backend behavior:** Only `ApplicationUser.ProfilePicture*` + `GET/POST /profile/.../picture`. No cover/banner field, DTO property, or endpoint.  
4. **Missing behavior:** Cover upload + public cover URL on `PublicProfessionalProfileResponse`.  
5. **Proposed:** Optional `CoverImageUrl` + `POST /profile/cover` (or extend picture upload with a `slot=cover|avatar` field).  
6. **Frontend workaround:** Brand-styled gradient cover fallback (no fabricated media).  
7. **Priority:** Medium  

## T8.2 Customer–provider display name privacy

1. **Feature name:** Safe public names in professional messaging  
2. **Business requirement:** Independent photographer legal/account full name must never surface in public or customer messaging surfaces.  
3. **Current available backend behavior:** Public profile correctly uses `PublicProfiles.ResolveDisplayName` / fallback `"مستخدم"`. Customer–provider conversations still resolve participant names via account `FullName` (`ConversationService.PublicParticipantName`).  
4. **Missing behavior:** Provider-side display name should use the same public-name resolver as Discover/public profile.  
5. **Proposed:** Resolve provider names through `PublicProfiles` (or shared helper) for CustomerProvider threads and related notifications.  
6. **Frontend workaround:** Does not invent alternate names; messaging UI shows whatever the conversation API returns.  
7. **Priority:** High (privacy)  
