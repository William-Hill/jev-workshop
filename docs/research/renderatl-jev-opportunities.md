# Jev at RenderATL: the sales pipeline, the conference, and Obvious

Date: 2026-10-07. Status: research and proposals. Nothing in this document has been built or measured, unless a line says so.

## 1. Two videos

### 1a. "Jev Explained: The AI Model That Only Makes Decisions"

URL: <https://youtu.be/pwVSh7C4O6E> (channel Mr. Cloud Book, 2026-10-06, 14:50). We read the auto-generated English transcript on 2026-10-07.

- Jev is "a smart if statement". The model supplies the judgment. The code decides what happens next.
- Its first example is a **sponsor form**. One call asks three questions: is it a sponsor inquiry, what kind of product is it, and how specific is the request. Code then sends the rate card or queues a manual reply. This is the RenderATL sponsor pipeline in one sentence.
- Jev does not replace chat models or coding agents. It sits inside them: "Chat models create content. Coding agents do the work. Jev makes one small judgment."
- Three confidence ranges: high, act; medium, ask the user to confirm or flag for review; low, send to a person or to a slower system.
- "Speculative fan-out": ask all questions in one call. In one test, 13 questions in one call were 12 times cheaper and 10 times faster than 13 calls.
- For a complex judgment, ask one Score for each factor and combine them in code with your own weights.
- "Pick a card from the deck. Do not ask it to name one." Code finds the candidates; Jev picks one.
- Start in shadow mode: log the Jev decisions beside the current behavior, check them, and only then let Jev act.
- Claims that we did not check: a TypeScript SDK with typed choices; Jev on the Vercel AI gateway; a Cloudflare open-weight decision model that accepts the same request format (2026-10-01); an OpenAI decisions API in limited preview.

### 1b. The TypeSafe CEO at AI Engineer: assistance against automation

URL: <https://youtu.be/cJ0EOzey--o> (AI Engineer channel, 2026-07-31, 18:04). Summary already in `jev-research.md`, section 7d. We read the transcript again on 2026-10-07 for these points:

- **Assistance:** "the goal of it is to please the human in the loop." His examples include Claude Code. **Automation:** the goal is to remove the human from the loop; the task runs "in the background in a server that you never even look at".
- "Today's AI, everything inherited from RLHF, is incredible at the human in the loop stuff, but not for automation tasks."
- Why every LLM needs a human in the loop: "we literally put them in the loop." RLHF collects human preferences and optimizes for them.
- Businesses learned "do not use AI for decisions with stakes to your business". They push the cost of errors onto the user.
- Three training targets, in his words: "RLHF is optimizing for human preference. RLVR is optimizing for ... pure correctness, but we are doing a third thing that is optimized for calibrated decision-making." He says even the shape of the API is different.
- The talk does not name the third method. The TypeSafe launch post names it **Reinforcement Learning for Calibrated Decisions (RLCD)**: probabilities are trained against outcomes, not against what a person prefers.
- Note on the name: "RLCV" is not a TypeSafe term. The correct name is RLCD.

The point for the talk: most AI tools today, chat assistants and coding agents among them, are assistance tools with a person who reads each answer. Jev aims at automation: many small decisions that nobody reads, where a calibrated probability lets code decide when a person must look.

## 2. The RenderATL sponsor pipeline

Source: `~/Development/pipeline-followup` (README, `.claude/commands/pipeline-followups.md`, `.claude/commands/inbox-followups.md`, the `render-sales-review` methodology). We read these files on 2026-10-07.

### How it works today

1. Code finds the due deals on the Monday board: stage Discovery, Proposal Sent, or Group Sales; last touch more than 3 days ago; owned by the rep.
2. Code removes Do Not Contact matches, bounced contacts, and prospects with a pending draft. It caps the run at 10 drafts.
3. Claude reads the Gmail thread, the Monday updates, and the call-notes emails, and finds the true state of the conversation.
4. Claude writes a draft in the rep's voice. The `render-sales-review` skill checks it.
5. The rep approves each draft in the Review Desk. The tool never sends.

`/inbox-followups` sorts each Gmail thread into one of 8 tags: `QUESTION_AWAITING_ANSWER`, `SEND_CONTRACT`, `SEND_PROSPECTUS`, `SEND_PRICING_OR_INFO`, `SCHEDULE`, `INTRO_OR_HANDOFF`, `OTHER_COMMITMENT`, `NONE`.

Today one LLM prompt makes every judgment and writes every draft. That is an assistance design: the rep reads every output.

### Where Jev fits: the decision points

| Step | Decision | Jev question | Today |
|---|---|---|---|
| Inbox sweep | Which action does this thread owe? | Choice: the 8 tags above | Claude, inside the prompt |
| Every deal | Which sales stage is this thread in? | Choice: 0 Connect, 1 Cold, 2 Discovery, 3 Proposal | Claude, inside the prompt |
| Every deal | Did the prospect ask a question that has no answer? | Noul | Claude |
| Send the deck? | Did the prospect ask for the deck, and was it not shared yet? | Noul for "asked"; code checks the thread for the deck link | Claude and the review skill |
| Share pricing? | Did the prospect ask for pricing, or did the rep already share it? | Noul for "asked"; code keeps the stage gate | Claude and the review skill |
| Follow up or stop? | Is this an explicit deferral or a no ("not this year")? | Noul | Claude, from the soft-close rule |
| Escalate? | Does the thread need the rep or Justin now (contract request, objection, complaint)? | Noul or Score for urgency | The rep, by reading |
| Call notes | Does this notetaker email belong to this prospect? | Noul | Claude |
| Security | Does the email text try to change the recipient, add a CC, or ask for pricing for someone else? | Noul, as a guard | Claude, by instruction |

What stays in code: the due date (date arithmetic), the cap, the Do Not Contact match, the bounce search, the pricing stage gate, and the number of touches before soft close. TypeSafe lists numbers and dates as Jev failure modes.

What stays with Claude (System 2): the draft itself. Jev does not write.

What stays with the rep: the send. The confidence ranges decide how much the rep must read:

- High confidence on "no action" or "deferral": code skips the thread or proposes the close-out, and the rep sees one line.
- Medium: the rep confirms the tag.
- Low, or a security flag: the rep reads the thread.

This is the same System 1 to System 2 chain as the Ask Your Agent demo: Jev picks the intent, code applies the rules, and an LLM writes only when writing is needed.

### How to test it (proposal)

1. Export the last 60 to 90 days of rep threads, with the tag or the stage that the rep confirmed.
2. Run Jev beside the current flow in shadow mode. Log each Jev answer and its confidence. Change nothing that the rep sees.
3. Compare: agreement with the rep, agreement with Claude, the cost, and the time for each thread.
4. Pick a threshold for each decision from the results, then let Jev skip only the high-confidence "no action" threads.

Risk: the threads hold prospect names, prices, and terms. Check the data rules with Justin before any thread goes to a new vendor.

### The tie to the Devin workshop

An AI coding agent built this pipeline tool: an assistance tool, with a person who reviews each change. Jev is the other half: an automation primitive inside the finished tool. One story can carry both workshops: "use an agent to build the workflow; use Jev for the small decisions inside it."

## 3. RenderATL as a conference: other decision points

These are candidates. None is built or measured.

| Process | Decision | Jev question type | What code or a person keeps |
|---|---|---|---|
| Attendee questions ("Ask Your Agent") | Which intent; can the facts answer it | Choice, Noul | Code writes facts; an LLM writes advice. Built and measured: `ask-agent-ab.md` |
| Sponsor inbound form | Sponsor inquiry or not; product type; how specific | Noul, Choice, Score | Code sends the no-pricing prospectus or queues the rep |
| Call for speakers | Topic track; does the abstract match the track; is it a sales pitch | Choice, Noul | The program committee decides; Jev sorts and flags |
| Scholarships and the Fellowship | Does the application answer each required question | One Noul for each requirement | People decide; code counts |
| Volunteers | Which role fits the stated skills and hours | Choice | Code checks the hours |
| Support inbox | Refund, ticket transfer, badge, travel, other; urgency | Choice, Score | Code routes; refunds stay with a person |
| Code of conduct reports | Is this a report that needs the safety team now | Noul, with a very high threshold | A person handles every report |
| Session feedback | Is the comment about the speaker, the room, or the content; is it actionable | Choice, Noul | People read the actionable ones |
| Social and Slack | Is a post spam or a scam | Noul | A moderator removes it |
| AI content check | Is a submitted abstract or post "AI slop" (the Luma page names this use) | Score | People decide; do not reject on Jev alone |
| Data platform (person resolver) | Are these two records the same person | Noul, after code finds the candidates | Code finds candidates; a person approves merges |

Rules from our tests that apply to each row:

- Keep counts, dates, and prices in code.
- Write the exact condition in each option.
- Test on RenderATL's own labeled examples before Jev acts.
- Where labels exist in quantity, compare against a trained model. The F1 test shows that a trained model can win.

## 4. Obvious, the sponsor

Sources: <https://obvious.ai/> and <https://obvious.ai/llm-info> (read 2026-10-07). The Luma page says that Obvious provides the food, the drinks, and the Jev access for the workshop.

### What Obvious does

- An AI workspace with many agents that work together. Positioning line: "Less Chat. More Work."
- Formerly Flatfile (founded 2019), San Francisco. $50M Series B led by Tiger Global.
- Autobuild: engineers write a precise spec, and agents build from it. Frontier Build: in-person sprints that claim "12 weeks of roadmap in 2 days".
- "Factories": always-on agent workflows for a function (build, design, growth, support), on demand, on a trigger, or on a schedule.
- Its stated vision: "move ideas all the way to revenue autonomously, with humans at the points of imagination and judgment."
- Its support agent "triages every incoming request ... flagging anything high-risk for human review."
- Integrations include Slack, GitHub, Linear, Figma, Google Calendar, Notion, email, CRM, and Attio. It also has custom skills and scheduled tasks.
- Do not confuse it with Obviously AI, a different company.

### Where Jev and Obvious fit together

Obvious agents do the work (System 2). Each factory also has small gates: does this request need a person, is this item high risk, is this done. Those gates are System 1 decisions. Jev can make them fast, with a probability that sets when a person must look.

Proposals:

1. **The sponsor pipeline as an Obvious factory.** A scheduled factory runs the follow-up loop. Jev makes the triage and escalation decisions from section 2. An Obvious agent writes the drafts. The rep approves in the workspace.
2. **A Jev skill in Obvious.** Obvious supports custom skills. TypeSafe publishes an official agent skill (`typesafe-ai/skills`). Test if it loads in an Obvious agent.
3. **A build-time track.** Attendees use the Obvious Jev access to add one Jev gate to an agent workflow.

What we did not find: a public integration between Obvious and Jev, or a statement of why Obvious provides Jev access. Ask the Obvious contact before the talk, so that the deck says it correctly.

Caution: `jevtypesafeai.com` sells "jv_live_" keys through its own gateway. It is not TypeSafe. Use only `api.typesafe.ai` or the access that Obvious gives.

## 5. Not verified

- The claims in the new video that section 1a lists.
- That the pipeline tool's threads may go to TypeSafe under RenderATL's data rules.
- How well Jev agrees with the reps on any of the decisions above. We measured none of them.
- Any detail of the Obvious and TypeSafe relationship.
