# Jev use cases and teaching examples

Date of the research: 2026-10-02.

This file adds to `jev-research.md` and `workshop-notes.md`. It does not repeat the game repositories of section 5 or the RLCD facts of section 7 in `jev-research.md`.

Source labels in this file:

- **first-party**: a TypeSafe page or a TypeSafe repository.
- **primary**: the code, data, or paper of the author who made the measurement. We read the README and, where stated, the code.
- **secondary**: a list, a directory, or a post that reports the claim of another person.

No number in this file comes from a run that we did. All numbers are the numbers of the source.

## Summary

1. The documented failure mode "literal reading" has strong independent evidence. A house rule in the criteria gave 24/24. The same rule left out gave 5/24, and 15 of the 19 errors had a probability above 0.90 ([phuryn/experiments](https://github.com/phuryn/experiments/tree/main/jev-decisions-api)).
2. Calibration is good on some task families and bad on others. arXiv 2610.00346 exists. It gives an ECE of 0.033 on typed decisions and 0.251 on social-science tasks ([arXiv 2610.00346](https://arxiv.org/html/2610.00346)).
3. A broad "what do I do" Choice fails in two action games. Atomic yes/no questions plus a rule in code work much better: a mean score of 3.0 against 59.25 in GapFlap ([lunar-terminal](https://github.com/gdchaochao/lunar-terminal)).
4. Without an explicit "none" or "abstain" option, Jev always picks an option. In one audit, the removal of the abstain option took accuracy from 0.950 to 0.000 ([jev-calibration-audit](https://github.com/jujumilk3/jev-calibration-audit)).
5. More questions in one request cost almost no time (16 questions against 1: +14 ms). More rows in one state can lower the quality ([jev-calibration-audit](https://github.com/jujumilk3/jev-calibration-audit), [jev-orderby-bench](https://github.com/yodablocks/jev-orderby-bench)).
6. The rate limits on the TypeSafe models page are 100K tokens each second and 80 requests each second. These numbers are different from the numbers in `jev-research.md` section 3 ([docs: models](https://docs.typesafe.ai/models)).

## Use cases (non-game)

"Code does" is the work that the source code or the cookbook gives to code, not to Jev.

| Use case | Source | Jev decides | Question types | Code does | Measured result |
|---|---|---|---|---|---|
| Sponsor skip in YouTube videos (browser extension) | [valentynkit/jev-skip](https://github.com/valentynkit/jev-skip), primary, code read (`lib/questions.ts`, `lib/schedule.ts`, `thresholds.json`) | The category of each 30-second caption segment | One Choice for each segment, 7 options, one of them `other` ("none of the above, or not enough text to tell") | Gets the captions. Cuts 30 s windows. A regex marks URLs and coupon codes as evidence. Sends one request for each video. Skips only at p >= 0.85. Skips nothing on `other`, during an ad, or on an error. | 77% of crowd-labeled sponsor seconds over 23 videos. 34 s of false skips each hour. $0.0008 for each video. Answers 0.9 s after the request. |
| Map CSV columns to a table | [DuvInc/jev-table-import-mapper](https://github.com/DuvInc/jev-table-import-mapper), primary, README | Does source column X go to destination column Y | One Noul for each column pair, plus one "no home" guard Noul for each source column | Exact name match first, free. Greedy one-to-one match above a threshold. Shows a flag when a column has no match but the guard is low. | 23-column export to 10-column table: 10 of 10 mapped, 253 questions in one call, 915 ms, $0.0012. |
| Auto-approve a pull request (used by [mirrord](https://github.com/metalbear-co/mirrord/blob/main/.github/workflows/jev-auto-approve.yaml)) | [metalbear-co/jev-auto-approve](https://github.com/metalbear-co/jev-auto-approve), primary, README; workflow file in mirrord confirmed | Ready to merge? Covered by tests? Needs a human? | 3 Noul questions, one call | Approves only when every answer clears the threshold. Otherwise comments with the numbers. mirrord uses 0.95. | No accuracy published. |
| Run a Mac menu command from plain words | [rohit9mehta/dwim](https://github.com/rohit9mehta/dwim), primary, README | Does this menu item do what the user typed | One Noul for each menu item, in parallel | Reads the menu tree. Runs the top item only above `confident` (default 0.5) and `lead` (default 0). Never runs "delete", "erase", "quit" and similar items without a key press. Else shows a short list. | Example: `File > Compress` 0.89, next item 0.18. No accuracy published. |
| Classify and split documents | [jerryjliu/docjev](https://github.com/jerryjliu/docjev), primary, README | Document category; boundaries between documents in a packet | Choice | OCR and text extraction (LiteParse) | 40/40 classified. 7/8 packets split exactly. Median 138.6 ms (classify), 209.6 ms (split). $0.011663 for Jev decisions. |
| Medical hallucination check | [stperic/jev-medhallu-benchmark](https://github.com/stperic/jev-medhallu-benchmark), primary, README | Does the answer misrepresent the abstract | One Noul, threshold 0.65 tuned on 1,000 dev items | Threshold. Sends uncertain items to an LLM. | 92.9% on 1,000 test items. Median 204 ms. $0.03 for each 1,000 checks. At p >= 0.9 (37% of items): 99.5% accurate. |
| Robot fleet incident triage (simulated) | [robokrunch/jev-physical-ai](https://github.com/robokrunch/jev-physical-ai), primary, README | Escalate? Which team? How urgent? | Noul, Choice, Score in one call | None stated beyond the call | 300 incidents. 91.3% agreement with template labels. p50 0.527 s. $24.57 for each 1 million decisions. |
| Agent evaluation | [LangChain blog](https://www.langchain.com/blog/jev-agent-evals-langsmith), primary | Pass or fail; usefulness | Choice, Score (1–5), Noul | Compares with a human oracle | 500/500 agreement on 5 weather scenarios. 0.44 s. $0.00035 for each call. The authors call the result "narrow". |
| Phishing: click or not | [anisselbd/jev-phishing-bench](https://github.com/anisselbd/jev-phishing-bench), primary, README | Verdict, plus 5 signal questions | Choice and Noul (9 questions, one call) | Logistic regression over the 5 signal answers | Verdict alone: 62.6% (Claude Haiku 4.5: 81.3%). 5 signals + regression: 95.0% on held-out half. p50 239 ms. $0.038 for each 1,000 emails. |
| Legal passage rerank | [docs: rerank cookbook](https://docs.typesafe.ai/cookbooks/rerank_typesafe), first-party | Could this passage be from the cited case | One Noul for each query-passage pair | BM25 shortlist of 30 | Top-1 5% to 18%. Top-10 38% to 62%. 1,200 calls, $0.0645, `jev-1.12`. |
| SEC filing industry class | [docs: classification with confidence](https://docs.typesafe.ai/cookbooks/classification_using_confidence), first-party | 1 of 75 SIC groups | One Choice | Below 0.9, reports the broader SIC division | >= 0.9: 27/30 correct. < 0.9: 12/30 at group level, 70% at division level. `jev-1.12`. |
| Date extraction | [docs: date extraction cookbook](https://docs.typesafe.ai/cookbooks/date_extraction_cookbook), first-party | Mode, month, day, year, weekday, week offset | 7 Choice questions | `assemble()` builds the date. Confidence = minimum of the parts. < 0.60 goes to a person. | 5 of 6 accepted (0.91–0.97). 1 sent to review (0.46). |
| Verify an LLM extraction | [docs: SDE cascade](https://docs.typesafe.ai/cookbooks/sde_cascade), first-party | Is each field hallucinated, off-target, wrong type, and so on | Noul for each failure mode | Escalates to a larger model if any p > 0.7 | Shown as a cost-quality frontier. No single escalation rate given. |
| Vendor workflow evals | [evals.typesafe.ai](https://evals.typesafe.ai), first-party | Invoice, support, agent trace, security triage | Not stated on the page | Code in [WorkflowEvals](https://github.com/typesafe-ai/WorkflowEvals) | 67.8% overall, 0.4 s. Invoice processing: 61.8% (Sol: 79.1%). |
| Email triage | [madewithjev: 500 emails](https://madewithjev.com/builds/500-emails-3-cents), secondary (X post) | Email class | Not stated | Not stated | 500 emails for 3.5 cents. No accuracy. Self-reported. |

## Teaching examples by lesson

### a. The model reads the criteria literally

TypeSafe states it: "`jev-1.13` answers the question you wrote, not the one you meant" ([docs: jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13)).

| Example | What happened | Source |
|---|---|---|
| House rules | A routing rule written into the criteria: 24/24 correct. The rule not written: 5/24, and 15 of the 19 errors were above 0.90. Labeled examples in `state` gave only 13/24. | [phuryn/experiments, 02-house-rules-n24](https://github.com/phuryn/experiments/tree/main/jev-decisions-api), primary |
| Village at 3 a.m. | With vague action criteria, the villagers stayed at the well at 3 a.m. ("eat 58% at hunger 0/100"). With thresholds in the criteria ("only when hunger > ~50"), they went to bed at 22:00 with 85–90% confidence. | [tfolkman/jev-village](https://github.com/tfolkman/jev-village), primary, README |
| Czech moderation | A better question moved P(vulgar) by −0.04. An explicit list of the terms in the `false` criterion moved it by −0.82 (0.98 to 0.13). Over 41 paired items, better criteria took accuracy from 70% to 96%. | [RastislavDujava/jev-classification-prompting](https://github.com/RastislavDujava/jev-classification-prompting), primary |

Maze link: this is the same failure as Note 1 in `workshop-notes.md`. The fix is the same: write the priority rule into the criteria.

### b. Confidence is not correctness; calibration differs by domain

| Example | What happened | Source |
|---|---|---|
| Fair die | A Choice over the 6 faces of a hidden fair die, 400 trials. Mean probability 82.9%. Accuracy 19.0% (76/400). A fair coin: 92.0% stated, 52.0% correct. | [KantaHayashiAI/jev-does-not-play-dice](https://github.com/KantaHayashiAI/jev-does-not-play-dice), primary |
| A label that is not in the text | Priority set by a hidden company rule. Accuracy 44.7% (chance 25%), mean stated probability 0.74. On 3 public datasets the ECE was 0.024–0.032. The `confidence` field had an ECE of 0.18 on the synthetic set. | [scienthoon/jev-ood-calibration](https://github.com/scienthoon/jev-ood-calibration), primary |
| By task family | ECE 0.033 on typed decisions and 0.032 on CLINC-150, but 0.251 on social-science tasks (pooled). Prompt-injection detection: ECE 0.104; 9.14% of inputs at p < 0.1 were unsafe. | [arXiv 2610.00346](https://arxiv.org/html/2610.00346); [arXiv 2609.33401](https://arxiv.org/html/2609.33401v1), primary |

Counter-evidence: in some domains a high threshold works. At confidence >= 0.95, 492 of 493 answers were correct ([etsabary/jev-deterministic-benchmark](https://github.com/etsabary/jev-deterministic-benchmark)). The language of `state` also changes calibration: XNLI ECE went from 0.057 (English) to 0.101 (Spanish) ([marcosmartinez/jev-acento](https://github.com/marcosmartinez/jev-acento)).

Lecture point: measure the threshold on your own data. TypeSafe says the same: "The correct threshold values depend on your domain" ([docs: confidence](https://docs.typesafe.ai/confidence)).

### c. Code owns arithmetic, counting, dates, and legality checks

| Example | What happened | Source |
|---|---|---|
| Tetris board | Given the ASCII grid, Jev once picked the worst candidate at 0.71. Given the computed results of each move (`lines_sent`, `holes_created`, `well_depth`), it picked rank 1 of 8 at 0.66–0.87. Code finds all 60–120 legal positions and keeps 14. | [Tsagaanbayr1/jev-tetris](https://github.com/Tsagaanbayr1/jev-tetris), primary, README |
| Counting and state change | Exact counting: 33.3% (15/45). Sequential state changes: 13.2% (5/38). Static logic: 97% to 100%. | [etsabary/jev-deterministic-benchmark](https://github.com/etsabary/jev-deterministic-benchmark), primary |
| Pick, do not write | A regex finds every email, phone, and amount. Jev only picks one candidate, so it "cannot invent a value or transpose a digit". | [docs: pre-parsed value extraction](https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook), first-party |

Disagreement: [priorbench/jev](https://github.com/priorbench/jev) reports 99.6% on number and date comparisons over 13 designs. This conflicts with the TypeSafe jaggedness page. Keep the arithmetic in code anyway, because the cost is low and the risk is known.

Maze link: code gives the legal directions and the distances. Jev chooses among legal directions only.

### d. Thresholds, abstain or "none of these" options, and fallbacks

| Example | What happened | Source |
|---|---|---|
| Remove the abstain option | KoBBQ: accuracy on items with no answer 0.950 to 0.000. Stereotype picks 0.03 to 0.79, at 0.79 confidence. ECE 0.023 to 0.793. Separately: 0 of 30 out-of-scope messages flagged without a "none" option, at 0.99. | [jujumilk3/jev-calibration-audit](https://github.com/jujumilk3/jev-calibration-audit); [priorbench/jev](https://github.com/priorbench/jev), primary |
| A review band, not one cut | One insurance claim, 15 repeats: the `covered` answer was between 0.43 and 0.53, across the 0.5 line. The cookbook sends 0.30–0.70 to a person. The banking example uses 0.6 for "check balance" and 0.85 for "approve transfer". | [docs: Noul consistency cookbook](https://docs.typesafe.ai/cookbooks/consistency_noul_cookbook); [docs: confidence routing](https://docs.typesafe.ai/patterns/confidence-routing), first-party |
| Hysteresis | `{ enter: 0.8, exit: 0.6 }`: the decision enters at 0.8 and stays until the value falls below 0.6. Small changes then do not flip the decision. | [edgardcham/huncho](https://github.com/edgardcham/huncho), primary, README |

Fallback labels: jev-village falls back to a rules brain for each failed request and counts it on a `degraded` meter ([jev-village](https://github.com/tfolkman/jev-village)). jev-tetris shows `FALLBACK` on screen ([jev-tetris](https://github.com/Tsagaanbayr1/jev-tetris)).

Maze link: hysteresis is a good fix for a ghost-chase decision that flips each tile.

### e. Divide a broad judgment into atomic questions and combine in code

| Example | What happened | Source |
|---|---|---|
| GapFlap (Flappy-style game) | One Choice "flap or hold": mean score 3.0. Random: 5.0. Three Nouls ("bird above the gap", "below", "inside") plus a 6-line rule in code: 59.25. Hand-written script: 80. | [gdchaochao/lunar-terminal, `jev-games/flappy.py`](https://github.com/gdchaochao/lunar-terminal), primary, code read |
| Robocode tank tactics | 327 random-action trials. The policy of Jev's top choice: −2.07. Uniform random: +1.24. Best action: +15.54. Correlation of Jev's value with the result: r = −0.099. | [gdchaochao/lunar-terminal](https://github.com/gdchaochao/lunar-terminal), primary |
| Phishing | One verdict: 62.6%. Five signal Nouls + logistic regression: 95.0%. A two-line regex alone: 91.8%. | [anisselbd/jev-phishing-bench](https://github.com/anisselbd/jev-phishing-bench), primary |

First-party support: in the wine-score cookbook, one direct Score gave RMSE 2.15. 18 decomposed questions gave 1.87, and 38 gave 1.77 ([docs: autoresearch](https://docs.typesafe.ai/cookbooks/autoresearch_feature_discovery)). TypeSafe calls decomposition "probably the most important concept" ([docs: how to build](https://docs.typesafe.ai/concepts/how-to-build-with-system-one)).

### f. Choice vs Score vs Noul: when each fits

Rules from TypeSafe ([docs: primitives](https://docs.typesafe.ai/primitives), [docs: Choice](https://docs.typesafe.ai/primitives/choice)):

| Type | Use it for | Rule |
|---|---|---|
| Choice | One of a known set with no order | Add `other` or `none of the above` when the list can miss an input. Max 255 options. The option names go to the model. The question ID does not. |
| Score | A position on a spectrum | 2 to 10 levels. A Noul of 0.5 is not "medium". |
| Noul | One yes/no fact | One question in each Noul. Phrase it so that a high value means yes. No `confidence` field. |

Field evidence:

- A Choice must pick an option even when no option fits. jev-table-import-mapper uses a matrix of Nouls so that a column can map to nothing ([DuvInc/jev-table-import-mapper](https://github.com/DuvInc/jev-table-import-mapper)).
- The same judgment as a Noul and as a two-option Choice differed by 0.125 on average ([jev-calibration-audit](https://github.com/jujumilk3/jev-calibration-audit)).
- On the same inputs, Noul was underconfident and Choice and Score were overconfident ([jev-ood-calibration](https://github.com/scienthoon/jev-ood-calibration)). Calibrate each question type separately.

### g. Latency and cost tradeoffs that shape the design

| Example | What happened | Source |
|---|---|---|
| Ask more questions in one call | 16 questions against 1: +14 ms, 0.4% answer flips. 800 judgments in one call: 985 ms, $0.00075. A fixed floor of about 430 ms makes a second chained call expensive. | [jev-calibration-audit](https://github.com/jujumilk3/jev-calibration-audit); [priorbench/jev](https://github.com/priorbench/jev), primary |
| Decide less often | jev-skip sends one request for each video, not one for each second. It caps a chunk at 90 segments or 20,000 state tokens. | [jev-skip `lib/questions.ts`](https://github.com/valentynkit/jev-skip), primary, code read |
| Decide before it is needed | The round trip was 300 ms–1.2 s (2.4 s cold). jev-tetris asks about the next piece while the current piece falls. It uses the answer only if the inputs match. | [Tsagaanbayr1/jev-tetris](https://github.com/Tsagaanbayr1/jev-tetris), primary |

Caution: more rows in one `state` can lower the quality. 40 rows in each request failed a sort test that one row in each request passed ([jev-orderby-bench](https://github.com/yodablocks/jev-orderby-bench)). TypeSafe also lists "Large state full of irrelevant detail" as a failure mode ([docs: jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13)).

Cost scale: jev-village made 13,200 decisions for approximately $0.35, at 160–250 ms each ([jev-village](https://github.com/tfolkman/jev-village)).

## Failures and limits

### First-party

| Limit | Value | Source |
|---|---|---|
| Documented failure modes | 9: literal reading, math and numbers, date comparison, indirection, large irrelevant state, adversarial content, contradictory instructions and criteria, Choice option order ("leans toward the option that comes first"), generation | [docs: jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13) |
| Rate limits | 100K tokens each second, 80 requests each second. "Rate limits are adjusting dynamically." | [docs: models](https://docs.typesafe.ai/models) |
| Context | 64k tokens for each request. 32k for `state` plus the longest question. | [docs: models](https://docs.typesafe.ai/models) |
| Language | "English is the primary training language" | [docs: models](https://docs.typesafe.ai/models) |
| Options and levels | Choice: max 255 options. Score: 2 to 10 levels. | [docs: API](https://docs.typesafe.ai/api) |
| Errors | `429 Too Many Requests`, `529 Overloaded`. Retry with exponential backoff. | [docs: API](https://docs.typesafe.ai/api) |
| Weak vendor task | Invoice processing 61.8% against 79.1% (Sol) | [evals.typesafe.ai](https://evals.typesafe.ai) |

Caution: the rate limits on the models page differ from section 3 of `jev-research.md` (250,000 tokens and 1,200 requests each minute). Use the TypeSafe page. 80 requests each second is 4,800 each minute.

### Papers

| Paper | Result for Jev | Source |
|---|---|---|
| arXiv 2610.00346, Rafe and Das, submitted 29 September 2026: "Benchmarking System One decision models against trained classifiers and language models for automated decision gates" | It exists. A threshold for 5% in-scope risk still accepts 0.310 of out-of-scope requests (0.195 with an explicit out-of-scope option). "Swapping yes and no flips 50.5 answers per hundred for Jev" (option keys swapped, rubric fixed). 5 to 150 options: accuracy 0.990 to 0.913. Median 138 ms, p95 183 ms. $0.0079 for each 1,000 decisions. | [arXiv abstract](https://arxiv.org/abs/2610.00346), [HTML](https://arxiv.org/html/2610.00346) |
| arXiv 2609.37647, Deußer, Sparrenberg, Sifa | Pooled Choice ECE 0.028 over 22 datasets. Emotion 58.5%, SST-5 57.9%. Multi-label: mean P(yes) 0.209 against an observed rate of 0.041. Tuned thresholds: UNFAIR-ToS micro-F1 0.499 to 0.748. | [arXiv](https://arxiv.org/html/2609.37647v1) |
| arXiv 2609.33401 (agent security) | WAInjectBench: missed all 129 "no-EI" positives. At a 1% miss limit, 0% of inputs automated. | [arXiv](https://arxiv.org/html/2609.33401v1) |

### Independent benchmarks

- Logic tasks: Jev 77.0% on a 100-question set. Qwen3.5 4B with 2,048 thinking tokens: 96.7% ([softpudding/jev-frontier-100](https://github.com/softpudding/jev-frontier-100)).
- Graded product relevance (Amazon ESCI): 4 of 6 pre-registered gates fail. A paraphrase moved the answer by 0.164 on average ([jev-orderby-bench](https://github.com/yodablocks/jev-orderby-bench)).
- Option order: results conflict. One audit found 0 argmax flips in 400 ([jev-calibration-audit](https://github.com/jujumilk3/jev-calibration-audit)). On a question with no correct answer, the first option won ([jev-does-not-play-dice](https://github.com/KantaHayashiAI/jev-does-not-play-dice)). The README notes that JavaScript sorts integer-like keys such as `"1"`, so the sent order can differ from the written order.
- Probability precision: probabilities come back with 2 decimals and are often exactly 0 or 1 ([jev-ood-calibration](https://github.com/scienthoon/jev-ood-calibration)).

### GitHub issues on TypeSafe repositories

| Issue | Problem | Maze relevance |
|---|---|---|
| [typesafe-sdk-js #17](https://github.com/typesafe-ai/typesafe-sdk-js/issues/17) | `NaN`, `Infinity`, `-Infinity` in `state` become `null` without a warning (`JSON.stringify`) | High. A distance of `Infinity` (no blocker) reaches Jev as `null`. Send a large number or a word. |
| [typesafe-sdk-python #15](https://github.com/typesafe-ai/typesafe-sdk-python/issues/15) | In a near tie, `choice` is sometimes 0.01 below the highest probability (35 responses) | Medium. Read `choice`, or apply a tie rule in code. |
| [typesafe-sdk-js #15](https://github.com/typesafe-ai/typesafe-sdk-js/issues/15) | Cloudflare returns an HTML 403 when `state` text contains a `curl` command with a URL | Low |
| [skills #10](https://github.com/typesafe-ai/skills/issues/10) | console.typesafe.ai: sign-in and sign-up returned HTTP 500 for 2 days (opened 2026-09-26) | High for the room. Get keys before the workshop day. |

## Recommended examples for the workshop

| # | Example | Lesson | Reason |
|---|---|---|---|
| 1 | House rules: 24/24 with the rule written, 5/24 without it ([phuryn](https://github.com/phuryn/experiments/tree/main/jev-decisions-api)) | a, b | Two numbers on one slide. It matches our blocker finding: wrong at high confidence when the priority is not in the words. |
| 2 | GapFlap: one Choice 3.0, three Nouls + code 59.25 ([lunar-terminal](https://github.com/gdchaochao/lunar-terminal)) | e, c | A small grid game like the maze. It shows hackathon level 2 (atomic questions, rule in code). |
| 3 | Village at 3 a.m. ([jev-village](https://github.com/tfolkman/jev-village)) | a, d | Visual and easy to explain. One criteria line with a threshold changed the whole population. It also shows a labeled fallback. |
| 4 | Fair die: 82.9% stated, 19.0% correct ([jev-does-not-play-dice](https://github.com/KantaHayashiAI/jev-does-not-play-dice)) | b | The fastest proof that confidence is not correctness. It needs no domain knowledge. |
| 5 | jev-skip seek bar ([jev-skip](https://github.com/valentynkit/jev-skip)) | d, g | A real non-game product with a visual bar. One request for each video, a `other` option, and a 0.85 threshold. |

Alternative for lesson d: the abstain removal (0.950 to 0.000) from [jev-calibration-audit](https://github.com/jujumilk3/jev-calibration-audit). It is strong, but the dataset (KoBBQ) needs more explanation.

## Not verified

- We did not run any example or reproduce any number. All numbers are the numbers of the authors.
- For most repositories we read only the README. We read code for jev-skip and GapFlap only.
- Self-reported posts with no code: the 500-email triage, Sales Copilot, the X post filter, and the WebMCP result (49/49, approximately 112× lower cost). The WebMCP source is an X post via [madewithjev](https://madewithjev.com/builds/webmcp-benchmark).
- The papers arXiv 2610.00346, 2609.37647, and 2609.33401: we read the abstract and an HTML summary, not the full text.
- [arXiv 2609.26758](https://arxiv.org/abs/2609.26758) (option names "no/yes" drop AUC from .81 to .58): reported by [awesome-jev-robustness](https://github.com/Yifan-Lan/awesome-jev-robustness), secondary. We did not open it.
- Option order bias: the sources conflict (see "Failures and limits"). We did not test it.
- The number and date claim of priorbench (99.6%) conflicts with the TypeSafe docs. We did not test it.
- TypeSafe has no separate pricing, limits, or changelog page in `llms.txt`. The price and limits are on the models page. We did not read the SDK changelog pages.
- We did not find a TypeSafe customer or case-study page. The launch post names only the Doom and Wikiracing demos ([TypeSafe blog](https://typesafe.ai/blog/introducing-system-one-models-and-jev)). `typesafe.ai/blog` returned no post list.
- The awesome lists of [vicfei](https://github.com/vicfei/awesome-jev-by-typesafe), [Anil-matcha](https://github.com/Anil-matcha/awesome-jev-by-typesafe), and [v-modal](https://github.com/v-modal/awesome-jev-tools) were searched by keyword only. Many entries were not opened.
- The two tank and Flappy games and the village are games, but they are not in section 5 of `jev-research.md`. We used them as teaching examples, not as use cases.

## Sources

First-party:

- <https://docs.typesafe.ai/llms.txt>
- <https://docs.typesafe.ai/model-jaggedness/jev-1.13>
- <https://docs.typesafe.ai/models>
- <https://docs.typesafe.ai/api>
- <https://docs.typesafe.ai/confidence>
- <https://docs.typesafe.ai/primitives>
- <https://docs.typesafe.ai/primitives/choice>
- <https://docs.typesafe.ai/primitives/noul>
- <https://docs.typesafe.ai/concepts/how-to-build-with-system-one>
- <https://docs.typesafe.ai/concepts/use-case-map>
- <https://docs.typesafe.ai/patterns/confidence-routing>
- <https://docs.typesafe.ai/patterns/composite-scoring>
- <https://docs.typesafe.ai/patterns/fan-out>
- <https://docs.typesafe.ai/patterns/intent-routing>
- <https://docs.typesafe.ai/cookbooks/consistency_noul_cookbook>
- <https://docs.typesafe.ai/cookbooks/consistency_choice_cookbook>
- <https://docs.typesafe.ai/cookbooks/date_extraction_cookbook>
- <https://docs.typesafe.ai/cookbooks/classification_using_confidence>
- <https://docs.typesafe.ai/cookbooks/sde_cascade>
- <https://docs.typesafe.ai/cookbooks/llm_guardrails>
- <https://docs.typesafe.ai/cookbooks/rerank_typesafe>
- <https://docs.typesafe.ai/cookbooks/hierarchical_classification>
- <https://docs.typesafe.ai/cookbooks/autoresearch_feature_discovery>
- <https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook>
- <https://docs.typesafe.ai/cookbooks/function_calling>
- <https://docs.typesafe.ai/demos/smart-home>
- <https://typesafe.ai/blog/introducing-system-one-models-and-jev>
- <https://evals.typesafe.ai>
- <https://github.com/typesafe-ai/WorkflowEvals>
- GitHub issues: typesafe-sdk-js #15, #17; typesafe-sdk-python #15; skills #10

Papers:

- <https://arxiv.org/abs/2610.00346>
- <https://arxiv.org/html/2609.37647v1>
- <https://arxiv.org/html/2609.33401v1>

Primary repositories and posts:

- <https://github.com/valentynkit/jev-skip>
- <https://github.com/DuvInc/jev-table-import-mapper>
- <https://github.com/metalbear-co/jev-auto-approve>
- <https://github.com/rohit9mehta/dwim>
- <https://github.com/jerryjliu/docjev>
- <https://github.com/stperic/jev-medhallu-benchmark>
- <https://github.com/robokrunch/jev-physical-ai>
- <https://www.langchain.com/blog/jev-agent-evals-langsmith>
- <https://github.com/anisselbd/jev-phishing-bench>
- <https://github.com/phuryn/experiments>
- <https://github.com/tfolkman/jev-village>
- <https://github.com/RastislavDujava/jev-classification-prompting>
- <https://github.com/KantaHayashiAI/jev-does-not-play-dice>
- <https://github.com/scienthoon/jev-ood-calibration>
- <https://github.com/marcosmartinez/jev-acento>
- <https://github.com/Tsagaanbayr1/jev-tetris>
- <https://github.com/etsabary/jev-deterministic-benchmark>
- <https://github.com/priorbench/jev>
- <https://github.com/jujumilk3/jev-calibration-audit>
- <https://github.com/edgardcham/huncho>
- <https://github.com/gdchaochao/lunar-terminal>
- <https://github.com/yodablocks/jev-orderby-bench>
- <https://github.com/softpudding/jev-frontier-100>

Secondary (lists and directories):

- <https://madewithjev.com>
- <https://github.com/hellogumbo/awesome-jev>
- <https://github.com/Anil-matcha/awesome-jev-by-typesafe>
- <https://github.com/kraayenjon/awesome-jev>
- <https://github.com/vicfei/awesome-jev-by-typesafe>
- <https://github.com/v-modal/awesome-jev-tools>
- <https://github.com/Yifan-Lan/awesome-jev-robustness>
