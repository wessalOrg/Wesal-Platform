# Mabrouk knowledge coverage recovery audit

Baseline discovery source: `1e39ed8f2d97170024839fc7a321e83a5810a9ea:Backend/src/Wesal.Infrastructure/AiAssistant/HowToService.cs`. Historical HowTo answers were treated as discovery only and checked against current services, controllers, routes, capability registry, and current KB. The new route is policy gate → live hall context → deterministic known knowledge → Gemini tool orchestration → deterministic fallback. Recommendation and hall-data questions remain on the grounded route.

## Historical intent matrix

| Old intent | Old answer source | Current truth | Action | Test cases |
|---|---|---|---|---|
| Account registration / account types | Historical MatchArabic/MatchEnglish; registration article | Registered User and Hall Owner roles; required profile fields and password rules in current account flow | Preserved and route before Gemini | corpus registration; registration tests |
| Login | Historical Match functions; login article | Current login page and auth flow | Preserved | corpus login; login KB tests |
| Password reset | Historical account/login hints | Reset availability and exact flow are not verified by current source | Conservative/ask support | policy and auth tests |
| Hall search and browse | Historical search branch | Current browse/search supports region, address, date, name, and capacity; only public approved halls | Kept on grounded search/tool path; how-to stays deterministic | offline eval; corpus search |
| Search filters | Historical search branch | Current frontend/backend search request and supported filters | Updated | search tests; coverage corpus |
| Hall details, photos, location, capacity, features | Historical detail branch | Current hall detail projection supplies these public facts | Live hall details win over static knowledge | contextual assistant tests |
| Hall price | Historical pricing branch | Price is hall-specific and may be undisclosed; platform FAQ price is separate | Live hall context or clarify; never substitute subscription price | hall price regression |
| Availability/calendar | Historical availability branch | Hourly slots and availability are live hall-specific; owners may hide booked slots | Live availability tool/context wins | offline eval; availability tests |
| Booking | Historical booking branch | Registered User selects a date and one or more 60-minute slots; request starts Pending | Rewritten from verified booking service | coverage corpus; booking tests |
| Booking status / My bookings | Historical dashboard/status branches | Current status lifecycle includes Pending, Accepted, Rejected, Cancelled; user can view own bookings | Preserved/updated | booking status tests |
| Cancellation | Historical cancellation branch claimed pending only | Current code permits cancellation while Pending or Accepted before deposit confirmation; full refund terms are unresolved | Rewritten from current cancellation service; refund policy isolated as pending | cancellation and policy regression |
| Booking rejection | Historical rejected branch | Current request status/rejection reason is owner/admin data and surfaced to requester where present | Updated to direct user to booking details/notifications | corpus status cases |
| Ratings | Historical ratings branch | Current rating eligibility/requirements are not conclusively established as product policy | Keep unconfirmed | conservative policy tests |
| Comments | Historical comments branch | Current comment eligibility/visibility policy is not conclusively established | Keep unconfirmed | conservative policy tests |
| Messaging / contact owner | Historical messaging branch | Authenticated Registered User can start a hall-owner conversation from hall detail; this differs from Wesal support contact | Preserved and separated from support intent | contact-owner/support regression |
| Contact Wesal / support | Historical support/contact branches and contact KB | Current KB lists WhatsApp `+970567581412`, phones `0598150426`, `590 774 4476`, and `wesal.platform.gaza@gmail.com` | Preserved exactly from verified article | KB contact tests; corpus |
| Support hours | Historical support-hours branch | Current article says 9:00–18:00; days/timezone are not stated | Preserved without inventing days/timezone | support-hours test |
| Platform overview / services | Historical general/capabilities branches | Current capability truth: approved wedding halls and public hall information; photographers/planners are Coming Soon; catering unavailable | Updated to capability registry and current KB | capability tests; corpus |
| Homepage contents | Historical homepage branch | Current homepage has current preview and category cards; old six-hall claims are stale | Current homepage KB wins | homepage KB tests |
| Wesal developers / technical team | Historical creator/general matcher | Current team KB identifies primary developers Abdulaziz Al-Khazendar and Mohammed Shama plus broader team | Restored; narrowed creator matcher so team questions do not claim Mabrouk authorship | team-versus-creator tests |
| Mabrouk creator | Historical generic creator answer | Current assistant attribution: the Wesal team created Mabrouk | Preserved as separate intent | creator regression |
| Language switching | Historical language branch | Current UI supports Arabic RTL and English LTR using the language toggle | Preserved | corpus language cases |
| PWA/install | Historical install hints | Current manifest, service worker, and install UI are present; platform-specific install steps vary | Preserve only general supported install guidance; no guaranteed install behavior | corpus install prompt; frontend checks |
| Hall Owner dashboard | Historical generic owner branch | Owner routes include owned halls, calendar, bookings, messages; server checks enforce owner boundary | Expanded from current routes/services | owner KB and corpus |
| Add hall / identity document | Historical shallow owner branch | Authenticated Hall Owner; identity document required in profile; current form field requirements validated by HallCreationService | First-class detailed deterministic answer and verified KB article | add-hall semantic and follow-up tests |
| Hall edit/delete/owned halls | Historical management branch | Owner can view/edit owned halls and delete where permitted; ownership enforced server-side | Preserved with permission qualifiers | hall management KB |
| Hall approval states | Historical approval branch | New hall starts PendingReview; Admin approves/rejects | Preserved | add-hall tests; approval KB |
| Public hall visibility | Historical owner branch | Approved + subscription payment confirmed + not locked + not deleted | Preserved from Admin/public visibility code | add-hall follow-up tests |
| Owner subscription payment | Historical subscription branch | Current configured subscription terms/confirmation flow are available through payment service | Preserved from runtime configuration; no unrelated payment claims | payment tests |
| Booking deposit/refund policy | Historical booking/cancellation answer text | Exact deposit, method, due date, refund amount/deadline are not proven by current implementation | Split from verified booking steps; remain unconfirmed | conservative policy regression |
| Hall Owner booking another hall | Historical official guide claim | Current booking role authorization blocks Hall Owner booking; product policy not reconciled | Isolated into pending-confirmation article; no confident answer | conservative policy regression |
| Privacy/legal wording | Historical policy answers | Current code does not establish complete legal wording | Remains pending; conservative support response | privacy regression |
| Mabrouk capabilities | Historical greeting/general branches | Mabrouk provides guidance and public read-only hall search/details/availability; no write actions | Preserved with V2 public tool boundary | V2 capability/tool tests |
| Unsupported or unknown requests | Historical generic fallback | Unknown questions should not become model-invented platform facts | Keep safe fallback; unknowns continue to model only within V2 guardrails | unknown-query/V2 eval |

## Current add-hall evidence

- `OwnerController` applies the Hall Owner policy to owner endpoints and exposes the add-hall initiation and create endpoints.
- `HallInitiationService` requires an authenticated existing account; `HallCreationService` requires Hall Owner role and a profile identity document before persistence.
- Required creation fields include name, contact phone, region, region-matched catalog address, and positive capacity. Price, description, predefined features, optional other features, hourly window, YouTube link, and photos are represented by the form/request; cover and gallery photos are not mandatory.
- Creation persists `PendingReview`. Admin review transitions the hall to Approved or Rejected. Public hall query additionally filters for confirmed subscription, unlocked, non-deleted state.
- The owner dashboard frontend gates the add form until profile readiness and identity-document upload. Server enforcement remains authoritative.

## Historical matcher category inventory

The baseline matcher contained the following category branches; each maps to the validated rows above and is protected by the named regression/coverage assertions:

| Baseline branch | Current mapping |
|---|---|
| `account`, `registration`, `login` | Account registration and login rows |
| `availability`, `month-hint`, `hours` | Availability/calendar row; exact date required for live checks |
| `booking`, `booking-cancel`, `booking-rejected`, `cancellation` | Booking, cancellation, status, and rejection rows |
| `capabilities`, `general`, `greeting` | Platform overview, capability truth, safe fallback rows |
| `capacity`, `hall-details`, `photos` | Hall detail row and live hall context |
| `comments`, `ratings` | Separate pending-confirmation rows |
| `dashboard`, `hall-owner`, `home` | Owner dashboard and owner guide rows |
| `filter`, `search` | Hall search and filter rows; live search remains tool-backed |
| `homepage` | Current homepage row |
| `ils`, `payment` | Owner subscription and separately pending booking payment terms |
| `language`, `toggle` | Language switching row |
| `messaging` | Separate owner messaging and Wesal support contact rows |
| `pricing` | Hall-specific live price and platform FAQ price are disambiguated |
| `shamaa` | Verified team row; Mohammed Shama spelling is preserved from current source |

Legacy category strings are implementation labels, not proof that the old text remains true. The source-backed current mapping above records the action for each branch rather than reusing old response copy.

## Regression contract and evidence

The corpus fixture `tests/Wesal.Tests/Ai/Fixtures/mabrouk-knowledge-coverage.json` contains more than 200 Arabic, Palestinian/Gazan, mixed-language, typo, spelling, and follow-up variants. `MabroukKnowledgeCoverageShould` checks deterministic response coverage and semantic requirements for team attribution, capability truth, hourly booking, add-hall prerequisites and review, follow-up context, support-vs-owner messaging, policy uncertainty, and that hall search/live hall facts yield to grounded V2 routing. The harness also checks known team/add-hall prompts do not invoke Gemini when it is available.

The safe 13-prompt local `AiAssistantService` smoke ran with fake hall/test data and Gemini disabled; the harness captured the actual route from the assistant's route log:

| Prompt | Route/source |
|---|---|
| مين مطورين وصال؟ | knowledge |
| كيف أضيف قاعة؟ | knowledge |
| شو لازم أرفع عشان أضيف القاعة؟ | knowledge |
| بعد ما أضيفها شو بصير؟ | knowledge |
| ليش قاعتي مش ظاهرة؟ | knowledge |
| شو بتقدموا؟ | knowledge |
| كيف أحجز؟ | knowledge |
| وين بشوف حجوزاتي؟ | policy |
| كيف أتواصل مع صاحب القاعة؟ | knowledge |
| كيف أتواصل مع وصال؟ | policy |
| عندكم مصورين؟ | policy |
| كيف أغير اللغة؟ | knowledge |
| مين عمل مبروك؟ | knowledge |

All 13 responses were non-empty; the same run asserted no Gemini calls. This is a local service-router smoke over test doubles, not a production or external-provider check.

Policy uncertainty is deliberately isolated from verified booking and owner workflows: a pending statement in one policy area must not suppress those independently verified answers.
