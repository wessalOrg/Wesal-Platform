# Task 03 — confirmed external owner bookings

Branch: `feat/backend-owner-external-bookings`.

Base and last verified origin/main: `ede83f028a2ad8e1f7a1b5cbc47453bc81a209b6`.

Implementation is isolated in `C:/Users/Pc/AppData/Local/Temp/wesal-task03`. The original checkout remains on `codex/booking-hour-alignment-hall-locking`, with its original untracked audit files preserved. PR #74 was not changed. Its exact-hour validation and shared Hall row-lock implementation are unchanged.

## Implemented phases

1. **Schema/contracts:** `BookingSource.Online=0`, `ExternalManual=1`, and appended `BookingStatus.Confirmed=4`. Existing enum values remain intact. Nullable requester is constrained by source; external customers have no fake accounts. Separate private external details, revision, audit events and idempotency receipts are persisted.
2. **Backend lifecycle:** owner-scoped creation, reads, updates and cancellation. A shared Hall lock is acquired inside the existing unit-of-work transaction before mutable Hall/booking/availability reads. Creates claim Available/missing hourly rows directly as Booked. Rescheduling claims added hours, retains intersections, updates the aggregate, and releases obsolete hours atomically. Cancellation retains booking/slots/history and releases hours safely. Online lifecycle services/repository writes explicitly exclude external bookings.
3. **PostgreSQL verification:** a new temporary PostgreSQL 18 cluster was initialized on a separate loopback port. Each test creates/drops a uniquely named disposable database. No installed/shared application database is used. Tests exercise independent connections, real locks, conflicts, rollback, migration compatibility, source constraints and audit deletion protection.
4. **Frontend:** the existing modal/cards/calendar now use backend IDs and data. Add/edit/cancel support stable retry keys and revision headers. External confirmation is independent of financial fields; online payment/delete actions are hidden. Subscription-expired calendar/details reads use authorized external endpoints. Legacy browser entries no longer participate in live lists or occupancy. No import screen or localStorage deletion was added.
5. **Regression/review:** production frontend build, TypeScript, backend regression, existing assistant contracts, external contracts and mobile browser API-contract scenarios were exercised. CI runs the new external contract script.

## Migration and compatibility

Migration: `20261023175636_AddConfirmedExternalBookings`.

- Existing rows receive Source=Online and Revision=1 without rewriting identity, status, amounts or payment timestamps.
- Source/status/requester/deposit and financial constraints enforce the separate workflows.
- Audit/history relationships use restrictive deletion behavior. A PostgreSQL trigger rejects UPDATE/DELETE of audit events.
- Down migration refuses to proceed if external bookings exist, avoiding loss of their booking/audit data.
- The migration was applied only to throwaway test databases. Normal application startup already runs migrations; do not start an unreviewed build against shared or production configuration.
- The new schema and application should be released together during pre-launch. Older clients do not understand the new Confirmed enum/source.

## API

Owner-authenticated prefix: `/api/v1/owner/halls/{hallId}/external-bookings`.

| Method | Suffix | Result |
| --- | --- | --- |
| POST | empty | 201, persistent server ID, Location, ETag |
| GET | empty, with fromDate/toDate/page/pageSize | bounded date range and pagination, including cancelled rows |
| GET | /{bookingId} | current owner-private DTO and ETag |
| PUT | /{bookingId} | atomic update and new revision |
| POST | /{bookingId}/cancel | preserved cancelled record and released hours |
| GET | /{bookingId}/history | owner-private append-only revision snapshots |

Request fields: customerName, phone, eventType, date, slotStarts, optional guests/notes/totalAmount/amountReceivedExternally. Source, status, actors, ownership, IDs and confirmation metadata are derived on the server.

Responses include source/status, ordered slots, revision, confirmation/cancellation metadata, private details and action capabilities. External payment-confirmation and hard-delete capabilities are always false.

Mutations require UUID `Idempotency-Key`. Update and first cancellation require a strong numeric `If-Match`, for example `"1"`. Missing preconditions produce 428; stale revisions produce 412; conflicts produce 409 with stable codes. Receipts are committed atomically with the mutation, are scoped to actor/Hall/operation/target/key, and compare the normalized request hash. Receipt replay is authorized against current ownership first and never resurrects a cancelled booking.

## Business/security behavior

- Same-day admission uses Asia/Hebron and rejects every started hour. Exact tick alignment and whole-hour containment are required; cross-midnight/ambiguous or nonexistent local times are rejected. Selected disjoint hours are supported by the API; metadata-only UI edits preserve such selections.
- Creation/rescheduling requires an approved, non-admin-locked Hall with an unexpired paid subscription, checked inside the transaction. Details-only edits and cancellation remain possible after subscription expiry. Administrative Hall locks and account/security locks remain enforced.
- Current Hall ownership controls access, including receipt replay/history. Original actors remain in audit snapshots after transfer.
- Optional amounts are nonnegative numeric(12,2); received cannot exceed total when both exist. They never drive status or the online deposit workflow.
- Public availability contains only availability information. External PII is not added to seeker history, AI tools, online notification pipelines or customer chat.
- No hard-delete/reopen/automatic import is provided. Existing localStorage test records are left byte-for-byte untouched by the application.

## Verification

| Check | Final result |
| --- | --- |
| Full backend suite with disposable PostgreSQL | 3,104 passed / 0 failed / 0 skipped |
| New Task 03 service cases | 31 passed |
| New Task 03 API/lifecycle cases | 8 passed |
| New dedicated real-PostgreSQL cases | 16 passed |
| Backend build | passed; 25 nullable-reference/test-host deprecation warnings on full compilation, 0 errors |
| EF pending-model check | no pending changes |
| Next.js 16.4 production build | passed; 45 static pages |
| TypeScript | passed |
| External booking contract script | 12 passed |
| API URL/environment script | 25 passed |
| Existing assistant contract script | 23 passed |
| Existing Knowledge Studio contract script | 7 passed |
| Existing assistant storage script | passed |
| Mobile Chrome browser API-contract scenarios | 3 passed / 0 failed / 0 skipped |
| ESLint | 18 errors / 7 warnings remain; inherited findings, no new-file lint findings |

The browser scenarios mock every API request and use an isolated browser profile: they verify persistent-ID rendering, legacy-storage preservation, lost-response retry keys, and edit/cancel after expiry. Backend transaction/authorization behavior is independently tested against real PostgreSQL; no real external-service or production browser journey is claimed.

Early runs exposed and led to correction of EF treating a new GUID-keyed reschedule slot as an existing entity. Restricted runs also encountered local PostgreSQL connection permissions and the existing Google Fonts build download restriction; successful final runs used the required permissions. No failures were hidden or unrelated tests changed.

Remaining limitations: inherited lint debt and nullable/deprecated-test-host compiler warnings; overnight/DST-ambiguous hours are intentionally unsupported; no live R2/Supabase/SMTP/Gemini checks; no cross-device real-time push was added (authoritative reads and mutation invalidation are provided). No unresolved business-policy conflict or approved-rule deviation is known.

No push, merge, rebase, deployment, shared/production database mutation, legacy import, or application localStorage deletion was performed.

## Changed-file manifest

- .github/workflows/ci.yml
- Backend/documentation/task03-external-bookings.md
- Backend/src/Wesal.API/Controllers/OwnerExternalBookingsController.cs
- Backend/src/Wesal.Application/Common/Interfaces/IOwnerExternalBookingService.cs
- Backend/src/Wesal.Application/Common/Interfaces/Persistence/IExternalBookingRepository.cs
- Backend/src/Wesal.Application/Common/Models/ExternalBookingDtos.cs
- Backend/src/Wesal.Application/Common/Models/OwnerBookingRequestDtos.cs
- Backend/src/Wesal.Application/Common/Validation/ExternalBookingRequestValidator.cs
- Backend/src/Wesal.Domain/Common/BookingActivity.cs
- Backend/src/Wesal.Domain/Entities/Booking.cs
- Backend/src/Wesal.Domain/Entities/BookingAuditEvent.cs
- Backend/src/Wesal.Domain/Entities/BookingMutationReceipt.cs
- Backend/src/Wesal.Domain/Entities/ExternalBookingDetails.cs
- Backend/src/Wesal.Domain/Enums/BookingSource.cs
- Backend/src/Wesal.Domain/Enums/BookingStatus.cs
- Backend/src/Wesal.Domain/Exceptions/ExternalBookingException.cs
- Backend/src/Wesal.Infrastructure/Bookings/BookingAcceptanceService.cs
- Backend/src/Wesal.Infrastructure/Bookings/BookingCancellationService.cs
- Backend/src/Wesal.Infrastructure/Bookings/BookingDeletionService.cs
- Backend/src/Wesal.Infrastructure/Bookings/BookingPaymentConfirmationService.cs
- Backend/src/Wesal.Infrastructure/Bookings/BookingRejectionService.cs
- Backend/src/Wesal.Infrastructure/Bookings/OwnerExternalBookingService.cs
- Backend/src/Wesal.Infrastructure/DependencyInjection.cs
- Backend/src/Wesal.Infrastructure/Middleware/GlobalExceptionHandlingMiddleware.cs
- Backend/src/Wesal.Persistence/Data/ApplicationDbContext.cs
- Backend/src/Wesal.Persistence/DependencyInjection.cs
- Backend/src/Wesal.Persistence/Migrations/20261023175636_AddConfirmedExternalBookings.Designer.cs
- Backend/src/Wesal.Persistence/Migrations/20261023175636_AddConfirmedExternalBookings.cs
- Backend/src/Wesal.Persistence/Migrations/ApplicationDbContextModelSnapshot.cs
- Backend/src/Wesal.Persistence/Repositories/BookingRepository.cs
- Backend/src/Wesal.Persistence/Repositories/ExternalBookingRepository.cs
- Backend/src/Wesal.Persistence/Repositories/OwnerDashboardRepository.cs
- Backend/tests/Wesal.Tests/Api/ExternalBookingApiShould.cs
- Backend/tests/Wesal.Tests/Infrastructure/ExternalBookingServiceShould.cs
- Backend/tests/Wesal.Tests/Persistence/ExternalBookingPostgresShould.cs
- Frontend/e2e/09-external-bookings.spec.ts
- Frontend/package.json
- Frontend/playwright.external.config.ts
- Frontend/scripts/verify-external-bookings.ts
- Frontend/src/components/halls/notifications/AcceptanceStateBadge.tsx
- Frontend/src/components/halls/notifications/HallNotificationCard.tsx
- Frontend/src/components/owner-management/halls/ExternalBookingActions.tsx
- Frontend/src/components/owner-management/halls/OwnerAddBookingModal.tsx
- Frontend/src/components/owner-management/halls/OwnerCalendarBookingCard.tsx
- Frontend/src/components/owner-management/halls/OwnerHallBookingsCalendar.tsx
- Frontend/src/hooks/useHallNotifications.ts
- Frontend/src/hooks/useOwnerBookingsCalendar.ts
- Frontend/src/i18n/messages/ar.ts
- Frontend/src/i18n/messages/en.ts
- Frontend/src/lib/hall-notifications.ts
- Frontend/src/lib/owner-acceptance-ui.ts
- Frontend/src/lib/owner-booking-status.ts
- Frontend/src/lib/owner-calendar-bookings.ts
- Frontend/src/lib/owner-hall-booking-requests-mapper.ts
- Frontend/src/services/hall-notifications.ts
- Frontend/src/services/owner-bookings-calendar.ts
- Frontend/src/services/owner-external-bookings.ts
- Frontend/src/types/external-booking.ts
- Frontend/src/types/hall-notifications.ts
