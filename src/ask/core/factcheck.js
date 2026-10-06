// Checks every exact fact that code puts in an answer against the guide text.
// Each price is checked next to its ticket name and tier, so a changed price fails.
export function factStrings(f) {
  const ga = f.tickets.general_admission, gold = f.tickets.gold, g = f.group_discount;
  return [
    f.dates, f.venue,
    `${ga.name}, ${ga.tier}, ${ga.price}`, `${gold.name}, ${gold.tier}, ${gold.price}`,
    "The Commits", "Leaders Lounge",
    `${g.min_tickets} or more`, `${g.percent}%`, g.price_each, g.note,
    f.exec_summit.name, f.exec_summit.apply, f.exec_summit.cost,
    ...f.tracks, ...f.summits, ...f.included,
  ];
}

// Returns a message for each fact string that the guide does not contain. An empty list means OK.
export function missingFacts(f, guide) {
  const text = String(guide).replace(/\s+/g, " ").toLowerCase();
  return factStrings(f).filter((v) => !text.includes(String(v).replace(/\s+/g, " ").toLowerCase()))
    .map((v) => `"${v}" is not in the guide`);
}
