// System 1 answers. Code writes every answer from facts.json, so every number is exact.

// Words that attendees use for each included item. Code matches them; Jev does not.
const ITEM_WORDS = {
  "RenderFEST": ["renderfest", "concert", "music"],
  "Food Truck Park": ["food", "lunch", "eat"],
  "Expo & Career Fair": ["career", "expo floor", "exhibit", "hiring"],
  "Breakout Workshops": ["workshop"],
  "Atlanta Tech Week": ["tech week", "citywide"],
  "Side Events": ["side event", "party", "parties", "mixer", "kickoff"],
  "Atlanta AI Expo": ["ai expo"],
  "OpenJS Node Interactive Summit": ["node", "openjs"],
  "Main Conference Programming": ["session", "talks", "keynote"],
};

// Items that the guide says are NOT on every badge. Code adds the exclusion when the question names one.
function exclusions(q, f) {
  const notes = [];
  if (/exec|summit/.test(q) && !/(ai expo|node|openjs|legal|go to market|gtm|runtime)/.test(q)) {
    notes.push(`The ${f.exec_summit.name} is not included with ${f.tickets.general_admission.name} or ${f.tickets.gold.name}: it needs a separate application (${f.exec_summit.apply}) and is ${f.exec_summit.cost}.`);
  }
  if (/commits|leaders lounge|lounge/.test(q)) {
    notes.push(`The Commits and the Leaders Lounge are Gold only (${f.tickets.gold.price}); they are not included with ${f.tickets.general_admission.name}.`);
  }
  return notes;
}

export function answerFromFacts(intent, ticket, question, f) {
  const ga = f.tickets.general_admission, gold = f.tickets.gold, g = f.group_discount, ex = f.exec_summit;
  const q = question.toLowerCase();
  switch (intent) {
    case "price":
      return `${ga.name} is ${ga.price} (${ga.tier}). ${gold.name} is ${gold.price} (${gold.tier}) and adds ${gold.adds}. Source: ${f.source}`;
    case "dates_venue":
      return `RenderATL 2027 is on ${f.dates} at ${f.venue}.`;
    case "group_discount":
      return `Groups of ${g.min_tickets} or more ${ga.name} tickets save ${g.percent}% on each ticket: ${g.price_each} each at the ${ga.tier} price. ${g.note}.`;
    case "included": {
      const notes = exclusions(q, f);
      if (notes.length) return notes.join(" ");
      const hit = f.included.find((item) => (ITEM_WORDS[item] || [item.toLowerCase()]).some((w) => q.includes(w)));
      return hit
        ? `Yes. The badge includes ${hit}. It also includes: ${f.included.filter((i) => i !== hit).join(", ")}.`
        : `The badge includes: ${f.included.join(", ")}.`;
    }
    case "tracks":
      return `Published tracks: ${f.tracks.join(", ")}. Summits: ${f.summits.join(", ")}. All are included with the badge.`;
    case "exec_summit":
      return `The ${ex.name} needs a separate application (${ex.apply}). It is ${ex.cost}.`;
    case "ticket_choice":
      if (ticket === "gold") return `${gold.name} (${gold.price}) fits best: it adds ${gold.adds} to everything in ${ga.name}.`;
      if (ticket === "exec_summit") return `Apply to the ${ex.name} (${ex.apply}); it is ${ex.cost}. Buy ${ga.name} (${ga.price}) for the rest of the conference.`;
      return `${ga.name} (${ga.price}, ${ga.tier}) fits best. It includes the full conference, the workshops, and RenderFEST.`;
    default:
      throw new Error(`Intent "${intent}" is a System 2 intent; it has no template`);
  }
}
