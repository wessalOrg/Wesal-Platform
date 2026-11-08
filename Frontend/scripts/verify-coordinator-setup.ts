/**
 * Lightweight contract checks for Event Coordinator setup validation + FormData mapping.
 * Run: npx tsx scripts/verify-coordinator-setup.ts
 */
import assert from "node:assert/strict";
import { mapCoordinatorSetupToFormData } from "../src/lib/coordinator-setup-mapper";
import {
  createEmptyCoordinatorSetupValues,
  switchCoordinatorBusinessType,
  validateCoordinatorSetupValues,
} from "../src/lib/coordinator-setup-validation";

function fakeImage(name: string): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type: "image/jpeg" });
}

function main() {
  const emptyShop = createEmptyCoordinatorSetupValues("Shop");
  const emptyErrors = validateCoordinatorSetupValues(emptyShop);
  assert.ok(emptyErrors.shopName);
  assert.ok(emptyErrors.shopLocation);
  assert.ok(emptyErrors.phoneNumber);
  assert.ok(emptyErrors.shopPhoto);
  assert.ok(emptyErrors.identityDocument);

  const shop = {
    ...emptyShop,
    shopName: "لمسة ورد",
    shopLocation: "غزة الرمال",
    phoneNumber: "0595123456",
    shopPhoto: fakeImage("shop.jpg"),
    identityDocument: fakeImage("id.jpg"),
  } as const;
  assert.equal(Object.keys(validateCoordinatorSetupValues(shop)).length, 0);

  const shopForm = mapCoordinatorSetupToFormData(shop);
  assert.equal(shopForm.get("BusinessType"), "Shop");
  assert.equal(shopForm.get("ShopName"), "لمسة ورد");
  assert.ok(shopForm.get("ShopPhoto"));
  assert.equal(shopForm.get("OnlineStoreName"), null);
  assert.equal(shopForm.getAll("WorkPhotos").length, 0);

  const freelanceBase = switchCoordinatorBusinessType(shop, "Freelance");
  assert.equal(freelanceBase.businessType, "Freelance");
  assert.equal(freelanceBase.phoneNumber, shop.phoneNumber);
  assert.equal(freelanceBase.identityDocument, shop.identityDocument);

  const onePhoto = {
    ...freelanceBase,
    onlineStoreName: "متجر ورد",
    workPhotos: [fakeImage("w1.jpg"), null] as [File | null, File | null],
  };
  const oneErrors = validateCoordinatorSetupValues(onePhoto);
  assert.ok(oneErrors.workPhotos || oneErrors.workPhoto1);

  const threeAttempt = {
    ...freelanceBase,
    onlineStoreName: "متجر ورد",
    workPhotos: [fakeImage("w1.jpg"), fakeImage("w2.jpg")] as [File | null, File | null],
  };
  assert.equal(Object.keys(validateCoordinatorSetupValues(threeAttempt)).length, 0);

  const freelanceForm = mapCoordinatorSetupToFormData(threeAttempt);
  assert.equal(freelanceForm.get("BusinessType"), "Freelance");
  assert.equal(freelanceForm.get("OnlineStoreName"), "متجر ورد");
  assert.equal(freelanceForm.get("ShopName"), null);
  assert.equal(freelanceForm.get("ShopPhoto"), null);
  assert.equal(freelanceForm.getAll("WorkPhotos").length, 2);

  console.log("verify-coordinator-setup: ok");
}

main();
