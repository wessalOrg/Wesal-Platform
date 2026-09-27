/**
 * Edit 9 — seeker profile page maps live GET/PUT /profile and shows name/email/phone.
 * Run: npx tsx scripts/verify-seeker-profile.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mapProfileDto, memberSinceYear, profileDisplayName } from "../src/lib/profile-mapper";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function testMapsBackendProfileResponse() {
  const camel = mapProfileDto({
    fullName: "ليان أحمد",
    email: "layan@wesal.ps",
    phoneNumber: "+970599111222",
    concurrencyStamp: "stamp-1",
    isIdentityDocumentUploaded: false,
  });
  assert.equal(camel.fullName, "ليان أحمد");
  assert.equal(camel.email, "layan@wesal.ps");
  assert.equal(camel.phoneNumber, "+970599111222");
  assert.equal(camel.concurrencyStamp, "stamp-1");
  assert.equal(camel.createdAt, null);

  const pascal = mapProfileDto({
    FullName: "Sara N.",
    Email: "sara@wesal.ps",
    PhoneNumber: "+970599000111",
    ConcurrencyStamp: "stamp-2",
    IsIdentityDocumentUploaded: true,
  });
  assert.equal(pascal.fullName, "Sara N.");
  assert.equal(pascal.email, "sara@wesal.ps");
  assert.equal(pascal.phoneNumber, "+970599000111");
  assert.equal(pascal.isIdentityDocumentUploaded, true);

  const wrapped = mapProfileDto({
    data: { fullName: "Nested", email: "n@wesal.ps", phoneNumber: "+970599222333" },
  });
  assert.equal(wrapped.fullName, "Nested");
  assert.equal(wrapped.email, "n@wesal.ps");

  const empty = mapProfileDto(null);
  assert.equal(empty.fullName, "");
  assert.equal(empty.email, "");
  assert.equal(empty.phoneNumber, "");
  console.log("ok  mapProfileDto matches ProfileResponse + wrappers");
}

function testDisplayFallbacks() {
  assert.equal(profileDisplayName({ fullName: "  أحمد  " }, "جلسة"), "أحمد");
  assert.equal(profileDisplayName({ fullName: "" }, "جلسة"), "جلسة");
  assert.equal(memberSinceYear(null), null);
  assert.equal(memberSinceYear("2024-03-01T00:00:00Z"), "2024");
  assert.equal(memberSinceYear("not-a-date"), null);
  console.log("ok  empty fields fall back instead of crashing");
}

function testLiveEndpoints() {
  const service = read("src/services/profile.ts");
  assert.match(service, /api\.get<unknown>\("\/profile"/);
  assert.match(service, /api\.put<unknown>\(\s*"\/profile"/);
  assert.match(service, /fullName: input\.fullName/);
  assert.match(service, /phoneNumber: input\.phoneNumber/);
  assert.match(service, /concurrencyStamp: input\.concurrencyStamp/);
  assert.doesNotMatch(service, /\/api\/user\/profile/);
  assert.doesNotMatch(service, /\/account\/me/);
  console.log("ok  live JWT uses GET/PUT /profile");
}

function testUiSurfaces() {
  const home = read("src/components/seeker-dashboard/SeekerDashboardHome.tsx");
  const settings = read("src/components/seeker-dashboard/SeekerSettingsPage.tsx");
  const card = read("src/components/profile/ProfileHeroCard.tsx");
  const hero = read("src/components/profile/ProfileHeroCard.tsx");

  assert.match(home, /useSeekerProfile/);
  assert.match(home, /ProfileHeroCard/);
  assert.match(home, /display\.email/);
  assert.match(home, /display\.phoneNumber/);
  assert.doesNotMatch(home, /2023/);

  assert.match(settings, /status === "error" && !profileState\.profile/);
  assert.match(settings, /ProfileHeroCard/);
  assert.match(settings, /profile\.fullName/);
  assert.match(settings, /profile\.email/);
  assert.match(settings, /profile\.phoneNumber/);

  assert.match(card, /profile\.fullName/);
  assert.match(card, /profile\.phone/);
  assert.match(hero, /profile\.unspecified/);
  assert.doesNotMatch(hero, /2023/);
  console.log("ok  seeker home + account render name/email/phone");
}

testMapsBackendProfileResponse();
testDisplayFallbacks();
testLiveEndpoints();
testUiSurfaces();
console.log("seeker profile wiring checks passed");
