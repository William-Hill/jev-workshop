import { test, expect } from "@playwright/test";

test("the demo answers a price question in System 1 and shows the LLM-only answer beside it", async ({ page }) => {
  await page.route("**/api/jev", (route) => route.fulfill({ json: {
    model: "jev-1.13.0",
    answers: {
      intent: { type: "choice", choice: "price", probabilities: { price: 0.93, other: 0.07 }, confidence: 0.9 },
      answerable: { type: "noul", noul: 0.95 },
      ticket: { type: "choice", choice: "general_admission", probabilities: { general_admission: 0.8 }, confidence: 0.7 },
    },
    usage: { input_tokens: 900, output_tokens: 40 },
  } }));
  await page.route("**/api/llm", (route) => route.fulfill({ json: { text: "A General Admission ticket costs $350.", model: "llm-test", usage: { input_tokens: 12000, output_tokens: 20 }, ms: 1800 } }));
  await page.goto("/ask.html");
  await page.fill("#question", "How much is a ticket?");
  await page.click("#ask");
  await expect(page.locator("#jev-path")).toHaveText("SYSTEM 1");
  await expect(page.locator("#jev-answer")).toContainText("$350");
  await expect(page.locator("#llm-answer")).toContainText("$350");
  await expect(page.locator("#jev-bars li")).toHaveCount(2);
});

test("the demo sends a writing question to System 2 and shows why", async ({ page }) => {
  await page.route("**/api/jev", (route) => route.fulfill({ json: {
    model: "jev-1.13.0",
    answers: {
      intent: { type: "choice", choice: "manager_email", probabilities: { manager_email: 0.97 }, confidence: 0.96 },
      answerable: { type: "noul", noul: 0.05 },
      ticket: { type: "choice", choice: "general_admission", probabilities: { general_admission: 0.8 }, confidence: 0.7 },
    },
    usage: { input_tokens: 900, output_tokens: 40 },
  } }));
  await page.route("**/api/llm", (route) => route.fulfill({ json: { text: "Dear manager, ...", model: "llm-test", usage: { input_tokens: 12000, output_tokens: 200 }, ms: 4000 } }));
  await page.goto("/ask.html");
  await page.fill("#question", "Help me ask my manager to pay");
  await page.click("#ask");
  await expect(page.locator("#jev-path")).toHaveText("SYSTEM 2");
  await expect(page.locator("#jev-why")).toContainText("manager_email");
  await expect(page.locator("#jev-answer")).toContainText("Dear manager");
});
