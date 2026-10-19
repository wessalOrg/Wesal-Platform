import { expect, test } from "@playwright/test";
import { askChat, openChat } from "./helpers";

test("Arabic refund questions do not invent amounts or timing", async ({ page }) => {
  await openChat(page);
  const answer = await askChat(page, "كم برجعولي إذا ألغيت الحجز؟");

  expect(answer).toContain("غير مؤكدة");
  expect(answer).toContain("دعم وصال");
  expect(answer).not.toMatch(/[0-9٠-٩]/);
});

test("English refund questions identify unconfirmed timing", async ({ page }) => {
  await openChat(page);
  const answer = await askChat(page, "How long does a cancelled booking refund take?");

  expect(answer).toContain("not confirmed");
  expect(answer).toContain("Wesal support");
  expect(answer).not.toMatch(/[0-9٠-٩]/);
});

test("cancellation after a confirmed deposit stays blocked", async ({ page }) => {
  await openChat(page);
  const answer = await askChat(page, "Can I cancel my accepted booking after the deposit was paid?");

  expect(answer).toContain("blocks cancellation after payment confirmation");
  expect(answer).not.toMatch(/[0-9٠-٩]/);
});
