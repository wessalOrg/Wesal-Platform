/**
 * Lightweight contract checks for Photographer setup validation + FormData mapping.
 * Run: npx tsx scripts/verify-photographer-setup.ts
 */
import assert from "node:assert/strict";
import { mapPhotographerSetupToFormData } from "../src/lib/photographer-setup-mapper";
import {
  createEmptyPhotographerSetupValues,
  switchPhotographerStudioBranch,
  validatePhotographerSetupValues,
} from "../src/lib/photographer-setup-validation";

function fakeImage(name: string): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type: "image/jpeg" });
}

function main() {
  const emptyStudio = createEmptyPhotographerSetupValues(true);
  const emptyErrors = validatePhotographerSetupValues(emptyStudio);
  assert.ok(emptyErrors.studioName);
  assert.ok(emptyErrors.studioLocation);
  assert.ok(emptyErrors.detailedStudioLocation);
  assert.ok(emptyErrors.phoneNumber);
  assert.ok(emptyErrors.identityDocument);

  const studio = {
    ...emptyStudio,
    studioName: "عدسة وصال",
    studioLocation: "غزة الرمال",
    detailedStudioLocation: "شارع النصر",
    phoneNumber: "0595123456",
    identityDocument: fakeImage("id.jpg"),
  } as const;
  assert.equal(Object.keys(validatePhotographerSetupValues(studio)).length, 0);

  const studioForm = mapPhotographerSetupToFormData(studio);
  assert.equal(studioForm.get("HasStudio"), "true");
  assert.equal(studioForm.get("StudioName"), "عدسة وصال");
  assert.equal(studioForm.get("StudioLocation"), "غزة الرمال");
  assert.equal(studioForm.get("DetailedStudioLocation"), "شارع النصر");
  assert.ok(studioForm.get("IdentityDocument"));
  assert.equal(studioForm.get("FullName"), null);

  const independentBase = switchPhotographerStudioBranch(studio, false);
  assert.equal(independentBase.hasStudio, false);
  assert.equal(independentBase.phoneNumber, studio.phoneNumber);
  assert.equal(independentBase.identityDocument, studio.identityDocument);

  const independentEmpty = validatePhotographerSetupValues(independentBase);
  assert.ok(independentEmpty.fullName);
  assert.equal(independentEmpty.studioName, undefined);

  const independent = {
    ...independentBase,
    fullName: "أحمد محمد",
  };
  assert.equal(Object.keys(validatePhotographerSetupValues(independent)).length, 0);

  const independentForm = mapPhotographerSetupToFormData(independent);
  assert.equal(independentForm.get("HasStudio"), "false");
  assert.equal(independentForm.get("FullName"), "أحمد محمد");
  assert.equal(independentForm.get("StudioName"), null);
  assert.equal(independentForm.get("StudioLocation"), null);
  assert.equal(independentForm.get("DetailedStudioLocation"), null);
  assert.ok(independentForm.get("IdentityDocument"));

  console.log("verify-photographer-setup: ok");
}

main();
