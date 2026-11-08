/**
 * Task 8 — Public professional profile smoke checks.
 * Run: npx tsx scripts/verify-professional-profile.ts
 */
import assert from "node:assert/strict";
import {
  PROFESSIONAL_BIO_MAX,
  toUpdateProfessionalBioPayload,
  validateProfessionalBio,
} from "../src/lib/professional-bio";
import {
  PROFESSIONAL_DISPLAY_NAME_FALLBACK,
  isCoordinatorProfessional,
  isPhotographerProfessional,
  mapProfessionalProfileContentPage,
  mapPublicProfessionalProfile,
  professionalPublicLocation,
} from "../src/lib/professional-profile-mapper";
import { apiV1MediaPath, resolveMediaUrl } from "../src/lib/hall-media-url";
import {
  PROFESSIONALS_PATH,
  professionalProfilePath,
} from "../src/lib/account-profile-path";

assert.equal(professionalProfilePath("u-1"), `${PROFESSIONALS_PATH}/u-1`);
assert.equal(validateProfessionalBio("x".repeat(PROFESSIONAL_BIO_MAX + 1)), "tooLong");
assert.equal(validateProfessionalBio("نبذة قصيرة"), null);
assert.deepEqual(toUpdateProfessionalBioPayload("  "), { bio: null });
assert.deepEqual(toUpdateProfessionalBioPayload("  أهلاً  "), { bio: "أهلاً" });

const studio = mapPublicProfessionalProfile({
  userId: "u-photo",
  role: "Photographer",
  approvalStatus: "Approved",
  isPubliclyAvailable: true,
  displayName: "استوديو نور",
  studioName: "استوديو نور",
  studioLocation: "غزة",
  detailedStudioLocation: "الرمال",
  phoneNumber: "0591111111",
  bio: "تصوير مناسبات",
  profilePictureUrl: "/api/v1/profile/u-photo/picture",
  posts: [
    {
      id: "11111111-1111-1111-1111-111111111111",
      content: "جلسة خارجية",
      images: [{ id: "22222222-2222-2222-2222-222222222222", url: "/api/v1/posts/p/images/i", order: 0 }],
    },
  ],
  offers: [],
});
assert.ok(studio);
assert.equal(studio?.isPubliclyAvailable, true);
assert.equal(isPhotographerProfessional(studio?.role), true);
assert.equal(professionalPublicLocation(studio!), "غزة · الرمال");
assert.equal(studio?.posts.length, 1);
assert.equal(studio?.posts[0]?.images[0]?.url, "/api/v1/posts/p/images/i");

const independent = mapPublicProfessionalProfile({
  userId: "u-ind",
  role: "Photographer",
  isPubliclyAvailable: true,
  displayName: PROFESSIONAL_DISPLAY_NAME_FALLBACK,
  bio: null,
  posts: [],
  offers: [],
});
assert.ok(independent);
assert.equal(independent?.displayName, PROFESSIONAL_DISPLAY_NAME_FALLBACK);
assert.equal(independent?.studioName, null);
assert.equal(independent?.phoneNumber, null);

const coordinator = mapPublicProfessionalProfile({
  userId: "u-coord",
  role: "EventCoordinator",
  isPubliclyAvailable: true,
  displayName: "وردة",
  shopName: "وردة",
  shopLocation: "خان يونس",
  phoneNumber: "0592222222",
  posts: [],
  offers: [],
});
assert.ok(coordinator);
assert.equal(isCoordinatorProfessional(coordinator?.role), true);
assert.equal(professionalPublicLocation(coordinator!), "خان يونس");

const privateSelf = mapPublicProfessionalProfile({
  userId: "u-pending",
  role: "Photographer",
  approvalStatus: "Pending",
  isPubliclyAvailable: false,
});
assert.ok(privateSelf);
assert.equal(privateSelf?.isPubliclyAvailable, false);
assert.equal(privateSelf?.displayName, PROFESSIONAL_DISPLAY_NAME_FALLBACK);

const page = mapProfessionalProfileContentPage({
  items: [
    {
      id: "33333333-3333-3333-3333-333333333333",
      content: "عرض ربيعي",
      oldPrice: 1000,
      offerPrice: 800,
      images: [],
    },
  ],
  pageNumber: 1,
  pageSize: 12,
  totalCount: 1,
  totalPages: 1,
});
assert.equal(page.items[0]?.offerPrice, 800);

assert.equal(
  apiV1MediaPath("/api/v1/profile/u-photo/picture"),
  "/api/v1/profile/u-photo/picture",
);
assert.ok(resolveMediaUrl("/api/v1/profile/u-photo/picture").includes("/api/v1/profile/"));

console.log("verify-professional-profile: ok");
