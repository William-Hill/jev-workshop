// level2d with System 2 as an LLM. When the escalation rule fires, an LLM gets a map
// of the maze and picks the move. Needs LLM_BACKEND (claude-cli or anthropic) in .env.
// Load it with /?jev=1&variant=level2d-s2llm&timeout=30000
export * from "./level2d.js";
export { shouldEscalate } from "./escalate.js";
import { askLlm } from "../system2/llm.js";

export async function system2(snapshot, scene) {
  return askLlm(snapshot, scene);
}
