// System 1 for attendee questions: one Jev request with three questions about the same state.
// Jev picks an intent, says if the checked facts can answer, and picks a ticket.
// Code decides the route. Jev never writes an answer or a number.

export const JEV_MODEL = "jev-1.13.0";

export const SYSTEM2_INTENTS = new Set(["fit", "manager_email", "trip_plan", "other"]);

// Rule 1 of the talk: write the exact condition in each option. Jev does not see the keys.
const INTENT_CRITERIA = {
  price: "The question asks what a RenderATL 2027 ticket costs, or which ticket is the cheapest. It does not ask which ticket fits the person.",
  dates_venue: "The question asks when RenderATL 2027 takes place, or the address or building of the venue.",
  group_discount: "The question asks about a discount or a price for a group, a team, or several tickets.",
  included: "The question asks if the badge or ticket includes a specific thing, for example the concert, workshops, food, the career fair, parties, or Atlanta Tech Week events.",
  tracks: "The question asks if the conference has talks, a track, or a summit about a topic, for example AI, design, observability, Node, legal tech, web, or go-to-market.",
  exec_summit: "The question asks about the Executive Summit: who can attend, how to apply, or what it costs.",
  ticket_choice: "The question describes the person (role, experience, team, goals) and asks which ticket they should buy.",
  fit: "The question asks if attending RenderATL is worth it or a good fit for the person, which needs a judgment about their goals.",
  manager_email: "The question asks for help to convince a manager or employer to pay, for example a draft email or arguments.",
  trip_plan: "The question asks for help to plan the trip: schedule, days, travel, budget, or what to do in Atlanta.",
  other: "The question is about anything else: parking, hotels, refunds, transfers, policies, the code of conduct, accessibility, or a topic not listed in the other options.",
};

const TICKET_CRITERIA = {
  general_admission: "General Admission: for engineers, developers, designers, AI builders, founders, students, and community attendees.",
  gold: "Gold: everything in General Admission plus The Commits award show and the Leaders Lounge; for engineering leaders, managers, and open source maintainers who want those.",
  exec_summit: "Executive Summit: for senior executives (VP, CTO, CEO level); it needs a separate application.",
};

// The facts that Jev sees, so that it can judge if they answer the question.
function factsState(f) {
  return {
    dates: f.dates, venue: f.venue,
    tickets: { general_admission: f.tickets.general_admission, gold: f.tickets.gold },
    group_discount: f.group_discount,
    executive_summit: f.exec_summit && { name: f.exec_summit.name, cost: f.exec_summit.cost, how: "separate application" },
    included: f.included, tracks: f.tracks, summits: f.summits,
  };
}

export function buildJevRequest(question, facts) {
  return {
    model: JEV_MODEL,
    state: { question, facts: factsState(facts) },
    questions: {
      intent: { type: "choice", instructions: "Which topic does the attendee question in `question` ask about?", criteria: INTENT_CRITERIA },
      answerable: {
        type: "noul",
        instructions: "Can the question in `question` be answered completely with only the RenderATL 2027 facts in `facts`? A recommendation of one ticket for the person described counts as answerable when `facts.tickets` covers it.",
        criteria: { true: "These facts answer the whole question.", false: "The question needs other information, advice, or writing." },
      },
      ticket: { type: "choice", instructions: "Which RenderATL 2027 ticket fits the person described in `question` best?", criteria: TICKET_CRITERIA },
    },
  };
}

// Tuned on the 70 tune questions (docs/research/ask-agent-ab.md). The demo, the benchmark, and the tests use these.
export const ROUTE_THRESHOLDS = Object.freeze({ minProbability: 0.7, minAnswerable: 0.2 });

export function decideRoute(answers, { minProbability = ROUTE_THRESHOLDS.minProbability, minAnswerable = ROUTE_THRESHOLDS.minAnswerable } = {}) {
  const intent = answers.intent.choice;
  const probability = answers.intent.probabilities[intent] ?? 0;
  if (SYSTEM2_INTENTS.has(intent)) return { path: "system2", intent, probability, why: `intent "${intent}" needs writing or judgment` };
  if (probability < minProbability) return { path: "system2", intent, probability, why: `intent probability ${probability} is below ${minProbability}` };
  if (answers.answerable.noul < minAnswerable) return { path: "system2", intent, probability, why: `answerable ${answers.answerable.noul} is below ${minAnswerable}` };
  return { path: "system1", intent, probability, why: `intent "${intent}" at probability ${probability}` };
}
