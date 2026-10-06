import { test, expect } from "@playwright/test";

// The test server runs with LLM_BACKEND=none (playwright.config.js), so no test calls a real LLM.
test("/api/llm rejects GET", async ({ request }) => {
  const r = await request.get("/api/llm");
  expect(r.status()).toBe(405);
});

test("/api/llm says clearly when System 2 is off", async ({ request }) => {
  const r = await request.post("/api/llm", { data: { system: "s", prompt: "p", max_tokens: 5 } });
  expect(r.status()).toBe(503);
  expect((await r.json()).error).toMatch(/LLM_BACKEND/);
});
