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

// Cross-site request forgery: a page on another site must not spend the user's Jev credit or Claude quota.
for (const route of ["/api/llm", "/api/jev"]) {
  test(`${route} rejects a request from another origin`, async ({ request }) => {
    const r = await request.post(route, { data: { prompt: "p" }, headers: { Origin: "https://evil.example" } });
    expect(r.status()).toBe(403);
  });

  test(`${route} rejects a body that is not JSON (no preflight)`, async ({ request }) => {
    const r = await request.post(route, { data: '{"prompt":"p"}', headers: { "Content-Type": "text/plain" } });
    expect(r.status()).toBe(415);
  });
}
