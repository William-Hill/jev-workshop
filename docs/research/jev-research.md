# Jev research

Date of the research: 2026-10-02.

This file records what we know about Jev and about the public game examples.
Each fact has a source. The section "Not verified" lists the open items.

## 1. What Jev is

- Jev is a System One decision model from TypeSafe AI.
- TypeSafe released Jev in early access on 2026-09-15.
- Jev does not write text. It answers bounded questions with probabilities.
- You send a state and a set of typed questions. Jev answers all of them in one request.
- Jev is a hosted service. TypeSafe did not release the model weights.
- The explainer page gives 120 ms for each request as an example.

The explainer page that we use in the lecture:
<https://system-one-explainer.netlify.app/>

## 2. The API

Source: <https://docs.typesafe.ai/introduction/quickstart>

- Endpoint: `POST https://api.typesafe.ai/v1/systemone`
- Authorization: `Authorization: Bearer <TYPESAFE_API_KEY>`
- Keys: `console.typesafe.ai/keys`
- Model ID: `jev-latest`. The response reports the exact version, for example `jev-1.13.0`.
- Python SDK: `pip install typesafe-sdk` (Python 3.10 or later).

### Request

```json
{
  "state": "Hi, I've been trying to connect my Stripe account for 3 days and the integration keeps failing. I'm losing sales. Please help ASAP.",
  "model": "jev-latest",
  "questions": {
    "department": {
      "type": "choice",
      "instructions": "Which team should handle this",
      "criteria": {
        "billing": "Payment or subscription issues",
        "technical": "Bugs or integration problems",
        "sales": "Pricing or account questions"
      }
    },
    "frustration": {
      "type": "score",
      "instructions": "How frustrated the customer appears",
      "criteria": [
        "Calm, just stating facts",
        "Frustrated but civil",
        "Very angry, strong language"
      ]
    },
    "is_urgent": {
      "type": "noul",
      "instructions": "The message conveys urgency or time-sensitivity"
    }
  }
}
```

The `state` field accepts a string. One tutorial also sends an object with named fields.

### Response

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "department": {
      "type": "choice",
      "choice": "technical",
      "confidence": 0.78,
      "probabilities": { "technical": 0.85, "sales": 0.0, "billing": 0.15 }
    },
    "frustration": {
      "type": "score",
      "score": 1.0,
      "confidence": 1.0,
      "legend": {
        "0": "Calm, just stating facts",
        "1": "Frustrated but civil",
        "2": "Very angry, strong language"
      },
      "probabilities": { "0": 0.0, "1": 1.0, "2": 0.0 }
    },
    "is_urgent": { "type": "noul", "noul": 1.0 }
  },
  "usage": { "input_tokens": 392, "output_tokens": 65 }
}
```

### The three question types

| Type | Input | Output | Use in the maze |
|---|---|---|---|
| Choice | `criteria` object: option key to description | `choice`, `confidence`, `probabilities` | Which direction to move |
| Score | `criteria` array: ordered labels | `score`, `confidence`, `legend`, `probabilities` | How dangerous the position is |
| Noul | `instructions` only | `noul` (0.0 to 1.0) | "Go for the power pellet now?" |

## 3. Price and limits

Source: a third-party tutorial and the Cloudflare model page. TypeSafe did not confirm these numbers to us.

- Price: $0.042 for each 1 million input tokens. Output tokens are free.
- Rate limits: 250,000 tokens each second and 1,200 requests each minute.
- Context: 32,000 tokens of state (the tutorial gives 64,000 for the full request).
- Input is text only.
- English is the primary language.

Estimate for the hackathon: 5 requests each second at 400 input tokens is 7.2 million tokens each hour.
That is approximately $0.30 each hour for each attendee.
One public Doom build reports approximately $7 each hour at 10 requests each second, so the state size controls the cost.

Caution: 1,200 requests each minute is 20 requests each second.
If all attendees share one key, the room can exceed this limit.

## 4. Gotchas

Source: <https://abrarqasim.com/blog/typesafe-ai-jev-api-tutorial-choice-score-noul-and-the-gotchas/>

1. Jev does not see the question key. Put the meaning in `instructions`, not in the key.
2. A Noul answer has no `confidence` field. Use the `noul` value as the threshold input.
3. Do not use a Noul for "how much". Use a Score.
4. A threshold for one question does not transfer to a different question.
5. Jev counts badly. Count in code, and send the number.
6. Jev does date arithmetic badly. Do the arithmetic in code.
7. Jev answers the exact words of the question, not the intent.
8. Pin a version ID (for example `jev-1.13.0`) before you tune a threshold. `jev-latest` changes on each release.
9. Confidence for n options: `(n × largest_probability − 1) / (n − 1)`.

Rule from the explainer page: a high confidence never replaces an access control or a policy check.
For the maze, this means that code must reject an illegal direction, whatever Jev answers.

## 5. Public game examples

| Project | Game | What to copy |
|---|---|---|
| [fhshaik/typesafe-mario](https://github.com/fhshaik/typesafe-mario) | Super Mario Bros | State design and the three-question request |
| [lukaske/jev-doom-agent](https://github.com/lukaske/jev-doom-agent) | Doom in the browser (WebAssembly) | Browser stack, key proxy, telemetry panel, fallback label |
| [olivier-motium/jev-doom](https://github.com/olivier-motium/jev-doom) | Freedoom | Local dashboard and spending limit |
| [seanthomasevans/typesafe-nes](https://github.com/seanthomasevans/typesafe-nes) | Mario, Contra, Mega Man | Decision log (`decisions.jsonl`), overrides shown in red |
| [IAnMove/jev-game-agent](https://github.com/IAnMove/jev-game-agent) | Emulator games (BizHawk) | Dashboard with the exact requests and responses |
| [amalvarezme/mario-jev](https://github.com/amalvarezme/mario-jev) | Mario | Not examined |

Lists of more builds:

- <https://madewithjev.com/categories/games-and-real-time> (Tetris, Pong, Subway Surfers, Pokémon, chess, Minesweeper)
- <https://github.com/hellogumbo/awesome-jev>
- <https://github.com/Anil-matcha/awesome-jev-by-typesafe>

We found no Pac-Man build and no maze build in these lists.

### typesafe-mario (the best model for the state design)

- Jev does not get screenshots. The harness sends object-centric JSON.
- State groups: player, trajectory, hazard (a maximum of 3 enemies), terrain, reaction timing, recent control, episode.
- Actions (7): `noop`, `right`, `right_jump`, `right_run`, `right_run_jump`, `jump`, `left`.
- One decision each 8 emulator frames.
- Each request asks three questions: a Choice for the action, a Noul for the jump, a Score for the danger.
- The Score is only for the display. This is a good pattern for a teaching panel.
- The panel shows the action, the full Choice distribution, the confidence, the latency, the Noul, the Score, and the parsed state.
- Design rule: Jev interprets typed facts, and exact timing arithmetic stays in code.

### jev-doom-agent (the best model for the browser stack)

- Vite and TypeScript, the same stack family as this repository.
- The browser gives the key once to the local Node/Vite server. The server keeps the key in memory only.
- The telemetry shows the choice, the probabilities, the confidence, the latency, and the state sent.
- When a call fails or the confidence is low, the panel shows "OFFLINE SIMULATED POLICY — NOT JEV".
- Jev selects a tactical macro, not a raw key press.

### The pattern that all examples share

1. Convert the game state to compact, structured text.
2. Ask a Choice question with a small, fixed set of actions.
3. Do exact arithmetic and legality checks in code.
4. Show each decision: state sent, probabilities, confidence, latency.
5. Log each decision to a file.
6. Label each decision that code made in place of Jev.

## 6. Not verified

- The name of a JavaScript SDK. The quickstart shows only Python and HTTP. Use `fetch` against the endpoint.
- The CORS behavior of `api.typesafe.ai`. Plan for a local proxy.
- The price and the rate limits. The source is not TypeSafe.
- Access for a room of attendees during early access.
- The real latency from the venue network.
- We read only the README of each example. We did not run an example or read its source.

## 7. Sources

- <https://system-one-explainer.netlify.app/>
- <https://docs.typesafe.ai/introduction/quickstart>
- <https://abrarqasim.com/blog/typesafe-ai-jev-api-tutorial-choice-score-noul-and-the-gotchas/>
- <https://developers.cloudflare.com/ai/models/typesafe/jev/>
- <https://www.mindstudio.ai/blog/jev-real-time-game-demos>
- <https://promptql.io/blog/jev-ai>
- <https://shop.zimaspace.com/blogs/tech-ai-hub/what-is-jev-ai-decision-model-agents>
- <https://madewithjev.com/categories/games-and-real-time>
- The GitHub repositories in section 5.
