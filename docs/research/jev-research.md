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

Correction (2026-10-02): the first-party models page, <https://docs.typesafe.ai/models>, gives different limits from the third-party numbers below. Use the first-party numbers.

- Rate limits: 100K tokens each second and 80 requests each second. "Rate limits are adjusting dynamically", and the limits "can change without notice".
- Context: 64k tokens for each request, and 32k tokens for `state` plus the longest question.
- Price: $0.042 for each 1 million input tokens. Output tokens are free.
- Model IDs: `jev-1.13.0`. `jev-latest` and `jev-preview` both point to `jev-1.13.0`.

The text below is the earlier third-party data.

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

## 6. Open models with the same protocol

Jev has no open weights. Other groups released open models that use the same `/v1/systemone` protocol. Checked on 2026-10-02 from the project pages only. We did not run them.

| Project | What it is | Use for this repository |
|---|---|---|
| [Ollama 0.35](https://ollama.com/blog/ollama-now-supports-jev-style-decision-models) | A local `/v1/systemone` endpoint. Models: `nimble` (9B, Bespoke Labs), `tev1` (4B), `tev1:0.8b`. | The first choice. Ollama reports 91 ms for each decision for `nimble` on an M5 Max. |
| [wfzyx/von](https://github.com/wfzyx/von) | A 395M ModernBERT model with a server for the same protocol. Apache-2.0. Docker image `ghcr.io/wfzyx/von:cpu`. | The second choice. It runs on a CPU. |
| [ikermoel/open-alternative-jev](https://github.com/ikermoel/open-alternative-jev) | A Python library. It has no HTTP server. | Not applicable without an adapter. |

- Ollama reports a mean accuracy of 75.7% for `nimble` and 76.0% for Jev on 13 public datasets.
- The Ollama example sends `state` as an object. This repository sends a string. This difference is not tested.
- A threshold that you tune on an open model does not transfer to Jev.
- The proxy uses a local server when `.env` has `JEV_UPSTREAM_URL` and `JEV_MODEL`. See `.env.example`.

## 7. How TypeSafe trained Jev

Source: public articles (2026-10-02), not TypeSafe documents.

- TypeSafe names the method RLCD: Reinforcement Learning for Calibrated Decisions.
- RLCD optimizes for calibrated probabilities on structured decision tasks, not for text that people prefer.
- TypeSafe did not publish the reward function, the architecture, or the training procedure.
- A customer cannot fine-tune Jev. TypeSafe serves the same weights to all customers.
- To change the behavior, change the state, the instructions, and the criteria. Divide a broad judgment into atomic questions and combine the answers in code.
- One third-party tool (SuperQode, with GEPA) uses 2 to 20 labeled examples to improve the question text automatically. We did not test it.

### Research on RLCD (checked 2026-10-02)

- No paper on RLCD exists. No reward function, no data description, and no calibration curve are public. No independent group reproduced RLCD.
- All that we know comes from the launch materials of TypeSafe and from articles that explain them.
- The stated goal: when the model gives 80% for an answer, the answer is correct in approximately 80% of such cases.
- Commentators compare RLCD to a classifier that trains with a proper scoring rule. This is their opinion, not a statement from TypeSafe.
- Related academic work, not from TypeSafe:
  - Tan, Lin, Motani, Lee, "On the effectiveness of reward functions in reinforcement learning for confidence calibration of large language models", arXiv 2607.04332 (July 2026). A badly designed confidence reward makes a model answer wrongly with a high confidence ("confidence reward hacking"). The authors treat the reward scheme as a setting to tune for each application.
  - "Rewarding Doubt", which one article names as earlier work on a reward for calibrated confidence. We did not read it.
- An independent benchmark (arXiv 2610.00346, from a different session, not read in this session) reports that the calibration of Jev is good on some task families and bad on others.

### What the game examples show about Jev (READMEs only, 2026-10-02)

| Project | Jev decides | Code decides | Result that the README reports |
|---|---|---|---|
| typesafe-mario | One of 7 controller actions | All timing arithmetic, for example a `jump_must_start_this_decision` fact. No scripted override. | None |
| jev-doom-agent | A tactical macro | The motor inputs for the macro. `FALLBACK` label for a failed or low-confidence call. | None |
| jev-doom | One of the legal choices that code builds | Navigation, tactical assists, motors | "This repository makes no level-completion or model-performance claim." |
| typesafe-nes | Move (Choice), danger (Score), stomp and full speed (Noul) | Tile scan, jump timing, a state machine for tall pipes, edge refusal | Mario World 1-1 complete with one death. Contra to screen 9 with several deaths. Mega Man stalls at the first ladder. 175 to 210 ms for each decision. |
| jev-game-agent | One move from candidates | Emulator lookahead that removes fatal moves, checkpoint recovery. The game pauses for each request. | A "verified victory" exit code. Not continuous real-time play. |

- The common pattern: code calculates the facts and builds the legal options, and Jev selects one option.
- Most examples give no measured result. The examples that complete a level give code the most work (lookahead, jump timing, edge refusal).
- typesafe-nes reports the same failure that we found: "Jev reads literally." A criterion about "a wall or a ladder" caused 90 seconds of an "up" hold with no ladder.
- No example demonstrates RLCD or calibration. Each example demonstrates a harness around a fixed model.

Articles:

- <https://www.mindstudio.ai/blog/typesafe-jev-rlcd-vs-rlhf>
- <https://systemonemodels.org/guides/rlcd-explained/>
- <https://www.sanity.io/glossary/rlcd-reinforcement-learning-for-calibrated-decisions>
- <https://arxiv.org/abs/2607.04332>
- <https://analyticsmadesimple.com/tutorials/jev-typesafe-ai-system-one-model-rlcd-tutorial/>
- <https://anthonymaio.substack.com/p/jev-the-language-model-that-wont>
- <https://anth.us/blog/fine-tuning-jev/>
- <https://medium.com/superagentic-ai/jev-systemone-tune-in-superqode-gepa-teach-decisions-from-unlabeled-examples-b17f074dfe94>

## 7b. Documented accuracy (checked 2026-10-04)

TypeSafe publishes no general accuracy benchmark for Jev. Its docs claim calibration and give per-cookbook results only, for example re-ranking 40 CLERC legal queries: top-1 accuracy from 5% to 18%, top-10 from 38% to 62%.

| Source | Data | Jev result | Comparison |
|---|---|---|---|
| Rafe and Das, arXiv 2610.00346 (preprint, 29 Sep 2026), read in full HTML | D1 workflows 2,000; D2 CLINC-150 intents 800; D3 social science about 2,000 | D1 0.732, D2 0.913, D3 mean F1 55.0%. ECE 0.033 / 0.032 / 0.251 | D2: BGE-small + LR 0.948, BERT-base 0.940. Zero-shot DeBERTa: 0.411 / 0.507. Qwen3.6-27B option likelihood: 0.733 / 0.912 |
| priorbench/jev (pre-registered, 5,721 calls) | 400 classification items | 95.9% zero-shot | Keywords 77.2%, TF-IDF + LR 66.0%. Number and date comparisons 99.6% over 13 designs. Option order up to 13 points |
| ejs-5/jev-benchmark | 868 n8n commits, labels from git history | Route 85.6%, triage 70.9%, size 37.2%, risk 63.9% | GPT-5.6 Terra and Claude Opus 5 better on all tasks. Jev 5.7 to 11.8 times faster, 120 to 242 times cheaper |
| Ollama blog (vendor of competing models) | 13 Bespoke Labs datasets, 3,880 decisions | 76.0% | nimble 75.7%, tev1 4B 73.3% |
| anisselbd/jev-phishing-bench | 2,000 synthetic emails | One verdict 62.6%; 5 signals + regression 95.0% | Claude Haiku 4.5 81.3%, regex 91.6% |
| fstandhartinger/jevbench (the builder runs the leaderboard site) | 534 decisions, 4 tiers | Score 63.29, rank 3 | Imajev-4B 67.37, Plumb-4B 65.84 |
| dev.to survey "Jev after eight days" (secondary) | Aggregates 14 preprints, 104 repos | 72.5% on its pooled set | Mid-price LLMs 74.5 to 76.0%, frontier 79.0 to 84.0%. Median ECE 0.071 |

Summary: Jev's accuracy depends strongly on the task (37% to 96% in these sources). With task labels, trained classifiers beat it on intents. Frontier LLMs beat it on accuracy, at much higher cost and latency. Its calibration is good on some task families (ECE about 0.03) and poor on others (0.25). Our own maze runs and reproductions are in this folder and in `question-design-finding.md`.

## 7c. Video: IBM Technology, "What Is Jev? The AI Model That Doesn't Generate Text"

URL: <https://youtu.be/YGgNBcIgI4s> (15 minutes). We read the English transcript on 2026-10-04.

- System 1 and System 2 come from Daniel Kahneman, Thinking, Fast and Slow (2011): 2 × 2 is System 1, 17 × 24 = 408 is System 2. (The terms were coined by Keith Stanovich and Richard West in 2000; that fact is not from the video.)
- A chat model writes one token at a time. A reasoning model writes its chain of thought: the closest that AI gets to System 2. Many software decisions are System 1 judgment calls.
- Example: a support email ("I was charged twice this month"). Three questions in one request: refund (Noul, 0.9), team (Choice, billing 0.85), urgency (Score).
- An LLM that returns JSON gives no reliable sense of how sure it is. Asking the model for its confidence does not match its real probabilities.
- RLHF: people prefer confident answers, so a model can learn to sound sure when it is wrong. RLVR rewards the right final answer, not knowing how sure to be. RLCD rewards probabilities that turn out right. TypeSafe has published little about the architecture.
- Calibration: on a chart of stated probability against how often the answer is correct, a calibrated model lies on the diagonal.
- Thresholds for the refund Noul: above 0.9 the refund queue; 0.1 to 0.9 a person; below 0.1 not a refund. The more a mistake costs, the higher the threshold.
- Limits: text only, weak at math and counting, can be tricked by instructions hidden in the data.
- Workflow: Jev for the fast calls, an LLM for the reply, Jev again for the customer's answer. This matches Kahneman: most work runs on System 1.
- The name: William Stanley Jevons and the Jevons paradox (1865, more efficient steam engines, more coal burned). Other secondary sources report the same; we found no TypeSafe page that states it. TypeSafe's primer states the same bet: cheaper intelligence will create much more demand.
- The video suggests Jev as a jailbreak guardrail. TypeSafe lists adversarial content as a failure mode, so the deck does not recommend it without tests.

## 8. Not verified

- The name of a JavaScript SDK. The quickstart shows only Python and HTTP. Use `fetch` against the endpoint.
- The CORS behavior of `api.typesafe.ai` for a real `POST`. A preflight request on 2026-10-02 returned HTTP 400 with no `Access-Control-Allow-Origin` header, so we use a local proxy.
- The price and the rate limits. The source is not TypeSafe.
- Access for a room of attendees during early access.
- The real latency from the venue network.
- We read only the README of each example. We did not run an example or read its source.

## 9. Sources

- <https://system-one-explainer.netlify.app/>
- <https://docs.typesafe.ai/introduction/quickstart>
- <https://abrarqasim.com/blog/typesafe-ai-jev-api-tutorial-choice-score-noul-and-the-gotchas/>
- <https://developers.cloudflare.com/ai/models/typesafe/jev/>
- <https://www.mindstudio.ai/blog/jev-real-time-game-demos>
- <https://promptql.io/blog/jev-ai>
- <https://shop.zimaspace.com/blogs/tech-ai-hub/what-is-jev-ai-decision-model-agents>
- <https://madewithjev.com/categories/games-and-real-time>
- The GitHub repositories in section 5.
