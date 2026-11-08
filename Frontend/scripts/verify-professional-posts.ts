/**
 * Task 9 — Professional Posts create/edit smoke checks.
 * Run: npx tsx scripts/verify-professional-posts.ts
 */
import assert from "node:assert/strict";
import {
  PROFESSIONAL_POST_CONTENT_MAX,
  PROFESSIONAL_POST_IMAGES_MAX,
  hasProfessionalPostBody,
  parseProfessionalPostPrice,
  validateProfessionalPostContent,
  validateProfessionalPostImageFile,
  validateProfessionalPostImages,
} from "../src/lib/professional-post-validation";

assert.equal(validateProfessionalPostContent("x".repeat(PROFESSIONAL_POST_CONTENT_MAX + 1)), "tooLong");
assert.equal(validateProfessionalPostContent("منشور قصير"), null);

assert.deepEqual(parseProfessionalPostPrice(""), { value: null, issue: null });
assert.deepEqual(parseProfessionalPostPrice("12.5"), { value: 12.5, issue: null });
assert.equal(parseProfessionalPostPrice("12.555").issue, "invalid");
assert.equal(parseProfessionalPostPrice("-1").issue, "invalid");
assert.equal(parseProfessionalPostPrice("abc").issue, "invalid");

assert.equal(hasProfessionalPostBody("", 0), false);
assert.equal(hasProfessionalPostBody("نص", 0), true);
assert.equal(hasProfessionalPostBody("", 1), true);

assert.equal(
  validateProfessionalPostImages([], { required: true, existingCount: 0 }),
  "required",
);
assert.equal(
  validateProfessionalPostImages([], { required: false, existingCount: 1 }),
  null,
);

const okFile = {
  name: "shot.jpg",
  type: "image/jpeg",
  size: 1024,
} as File;
assert.equal(validateProfessionalPostImageFile(okFile), null);

const badType = {
  name: "doc.pdf",
  type: "application/pdf",
  size: 1024,
} as File;
assert.equal(validateProfessionalPostImageFile(badType), "type");

const tooMany = Array.from({ length: PROFESSIONAL_POST_IMAGES_MAX + 1 }, () => okFile);
assert.equal(validateProfessionalPostImages(tooMany), "tooMany");

console.log("verify-professional-posts: ok");
