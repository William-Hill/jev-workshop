// Test only: escalate every Jev decision, and let System 2 pick the last legal option.
export * from "./level2d.js";

export function shouldEscalate() {
  return { escalate: true, why: "test: always escalate" };
}

export async function system2(snapshot) {
  const options = Object.keys(snapshot.options);
  return { choice: options[options.length - 1], reason: "test: last option", model: "test" };
}
