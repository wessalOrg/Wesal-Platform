import assert from "node:assert/strict";
import { parseChatSnapshot, serializeChatSnapshot } from "../src/lib/ai-chat-storage";
import type { AiChatMessage } from "../src/types/ai-chat";

const message = (role: AiChatMessage["role"], text: string): AiChatMessage => ({
  id: `${role}-1`,
  role,
  text,
  createdAt: new Date(0).toISOString(),
  variant: "default",
  halls: [],
  recommendationStatus: null,
  criteria: null,
  lang: null,
  category: null,
  availability: null,
  actions: [],
});

const serialized = serializeChatSnapshot({
  lang: "en",
  sessionId: "12345678-1234-1234-1234-123456789abc",
  messages: [
    message("user", "my token is abc.def"),
    message("user", "x".repeat(700)),
    message("user", "Bearer abcdefghijklmnop"),
    message("assistant", "A token value: token=should-not-persist"),
  ],
  pinned: null,
}, 1_000);

assert.ok(!serialized.includes("abc.def"));
assert.ok(!serialized.includes("abcdefghijklmnop"));
assert.ok(!serialized.includes("should-not-persist"));
assert.ok(!serialized.includes("x".repeat(700)));

const restored = parseChatSnapshot(serialized, 1_000, "en");
assert.ok(restored);
assert.match(restored.messages[0]!.text, /redacted/i);
assert.match(restored.messages[1]!.text, /omitted/i);
assert.match(restored.messages[2]!.text, /redacted/i);
assert.match(restored.messages[3]!.text, /redacted/i);

process.stdout.write("Assistant sessionStorage sanitization passed.\n");
