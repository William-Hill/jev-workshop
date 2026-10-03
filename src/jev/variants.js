// Load the questions module: src/jev/questions.js, or a variant from src/jev/variants/.
import * as base from "./questions.js";

const modules = import.meta.glob("./variants/*.js");

export async function loadVariant(name) {
  if (!name || name === "questions") return { name: "questions", ...base };
  const load = modules[`./variants/${name}.js`];
  if (!load) throw new Error(`The variant "${name}" does not exist in src/jev/variants/.`);
  return { name, ...base, ...(await load()) };
}
