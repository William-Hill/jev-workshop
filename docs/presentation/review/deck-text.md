# Jev Workshop full deck: visible text and speaker notes (generated from jev-workshop.html)


## Slide 1 (section 0)

### On the slide

RenderATL × AI Ship & Social · Thursday, October 15, 2026
Jev
Workshop
What Jev is, where it fits, and how to use it in your own projects
William MJ Hill · Forward Deploy Engineer, RenderATL · @emjay_hill
Co-hosted by RenderATL and AI Ship & Social · Food, drinks, and Jev access by Obvious

### Speaker notes

Do not open with an agenda. Thank the hosts in one sentence, then go to the next slide.
Say: "Thank you to AI Ship & Social for co-hosting, and to Obvious for the food, the drinks, and your Jev access today."
Introduce yourself in one sentence: "I am William MJ Hill, a Forward Deploy Engineer at RenderATL. You can find me at @emjay_hill."
Disclosure, say it early: "I have no relationship with TypeSafe AI, the company that makes Jev. Obvious sponsors this event and gives you Jev access. I used my own API key for every test in this talk, and no sponsor reviewed these results." An audience of engineers will ask.
Obvious (obvious.ai) is an AI workspace company in San Francisco, formerly Flatfile, with multi-agent workflows that it calls factories. Do not confuse it with Obviously AI, a different company. As far as we know, Obvious is a sponsor, not a TypeSafe partner, and there is no public Obvious and Jev integration. Every test in this talk used our own TypeSafe key.


## Slide 2 (section 0)

### On the slide

The promise
By the end of this talk, you will know when to use Jev, when to use something else, and how to write a question that it answers well.
Then you will build with it yourself, with free Jev access from Obvious.

### Speaker notes

Say: "Jev is new. It went into early access on September 15, one month ago, and yesterday, October 14, TypeSafe added images. In thirty minutes you will know what it does, what it does not do, and how it compares with tools that you already use. I will show where the evidence is strong, where it is weak, and where we have none."
Bridge: "Every tool exists for a problem. Let us start with the problem."


## Slide 3 (section 1)

### On the slide

The problem
Software makes many small decisions about text.
Which team gets this support ticket?
Is this message a refund request?
Does this post break our community rules?
Which model must answer this prompt?
Each decision has a fixed set of answers, and it runs many times a day.

### Speaker notes

Say: "A person answers each of these in a second. Each one has a short, known list of answers. And each one runs thousands of times, with no person watching."
Ask the room: "How do you build this today?" Take two answers at most, to keep the time.
Bridge: "Most answers fall into four tools."


## Slide 4 (section 1)

### On the slide

The problem
Today we have four tools for these decisions.
Tool
Good at
Weak at
Rules and regex
Exact, cheap, easy to audit
New wording breaks them
Trained classifier
Fast and cheap for each call
Needs labeled training data. A new label needs new training.
Zero-shot classifier
Labels as text at run time
Lower accuracy. Test its scores before code acts on them.
LLM prompt
Reads anything, follows instructions
Returns text to parse. A probability for each option needs extra work.

### Speaker notes

Rules: "if the subject contains 'refund', send it to billing". A customer who writes "I want my money back" gets past it.
Trained classifier: logistic regression or a fine-tuned BERT model. You need hundreds or thousands of labeled examples, and a new team means new training.
Zero-shot classifier: for example the Hugging Face zero-shot pipeline, which uses an entailment model. You give the labels as text at run time.
LLM prompt: "Here is a ticket, reply with billing, technical, or sales." JSON mode fixes the format. For a probability, you can limit the output to the option tokens and read their log probabilities, then calibrate them with temperature scaling. That works, but it is extra work, and not every API exposes log probabilities.
A documented example of text output that drifts: Anthropic's own guide for Claude Opus 5 says that its "default user-facing responses run longer than prior Opus models'", that a lower effort setting does not reliably shorten them, and that it "can also expand the scope of a task, adding steps that weren't requested." Users on Hacker News and Reddit made the same complaint. If your code parses an LLM's answer to make a decision, that drift becomes your problem.
Be honest if asked: we did not measure Jev against an LLM on the same task. The one public comparison that we found is on slide 22.
Bridge: "Before we look at Jev, one idea from the people who built it: assistance is not the same job as automation."


## Slide 5 (section 1)

### On the slide

The problem
Most AI today assists a person. Automation is a different job.
Assistance
Automation
The goal
Help the person in the loop
Remove the person from the loop
How it runs
Once, while a person reads it
In the background, many times
Who sees an error
The user, who fixes it
Often nobody, until it costs money
What it needs
Good text
A fixed answer and a probability
Trained for
Human preference (RLHF)
Calibrated decisions (RLCD)
Examples
Chat, coding agents
Jev
Paraphrase of the TypeSafe CEO, AI Engineer, 31 July 2026. RLCD: the TypeSafe launch post. The vendor's framing, with no benchmark numbers.

### Speaker notes

Say: "The CEO of TypeSafe, the company that makes Jev, co-authored the RLHF work behind ChatGPT. His argument: today's chat models are trained to please the person who reads the answer. That is good for assistance. It is a poor fit for automation, where no person reads each answer."
His own words, worth quoting: assistance tasks are ones where "the goal of it is to please the human in the loop." Automation should run "in the background in a server that you never even look at." And: "Today's AI, everything inherited from RLHF, is incredible at the human in the loop stuff, but not for automation tasks." Why does every LLM need a human in the loop? "We literally put them in the loop."
The last row: he names three training targets. "RLHF is optimizing for human preference. RLVR is optimizing for pure correctness, but we are doing a third thing that is optimized for calibrated decision-making." The launch post calls that third thing RLCD, reinforcement learning for calibrated decisions. He puts Claude Code on the assistance side too: a great tool, but one with a person who reads each step.
Say: "Most of the AI tools that you use today are assistance tools: a chat window, a coding agent, a person who reads every answer. Jev is built for the other column: thousands of small decisions that nobody reads."
RLHF, if asked now: reinforcement learning from human feedback. People rank model answers, a reward model learns their preferences, and the model is trained toward answers that people prefer. Slide 14 has all three definitions.
His point about errors: a reward model that learns from people tends to reward answers that sound confident. So a chat model can sound right when it is wrong. In assistance, the user catches that. In automation, nobody does.
Be clear about the source: this is the vendor's own story, from a talk before the Jev launch. It is a useful way to sort tasks. It is not evidence that Jev is more accurate. I have no relationship with TypeSafe.
Source: "Jev CEO: I made ChatGPT, now I'm building what's next", AI Engineer channel, youtu.be/cJ0EOzey--o. Notes in docs/research/jev-research.md, section 7d.
Bridge: "Jev aims at the automation side, and at the gap between the last two rows of the table before: labels as text, with a probability for each option built in."


## Slide 6 (section 2)

### On the slide

What Jev is
Jev answers a fixed-option question about text, and returns a probability for each option.
Who
A hosted model from TypeSafe AI, in early access since 15 Sept 2026
Speed
About 170 to 250 ms for each request in our tests
Name
After economist William Stanley Jevons
It reads natural language, like an LLM. It returns a typed answer, one of your options, and it writes no text.

### Speaker notes

Say: "That is the whole definition. Input: text and a question with options that you write. Output: one option, and a probability for each option."
"Typed answer" means the answer is always one of the options that you defined, so code never parses free text.
The name: the next slide explains it.
Speed: the median request time in our maze benchmark was 166 to 204 ms, from a laptop in Atlanta, through a local proxy. Current stable version: jev-1.13.0. Since 14 October, jev-1.14.0 is out as jev-preview, and jev-latest moves to it in about one week. Since 14 October, Jev also reads images, behind an experimental header: slide 12. Text is still the main input, and the only one that TypeSafe supports for production.
Bridge: "Why the name Jev? It comes from a book about coal."


## Slide 7 (section 2)

### On the slide

What Jev is · the name "Jev"
Named after Jevons: when a resource gets cheaper, we use more of it.
1865: coal
Steam engines used less coal for each job.
Britain burned more coal in total.
2026: decisions
A judgment call costs less than a cent.
TypeSafe bets that software will make many more of them.
"It is wholly a confusion of ideas to suppose that the economical use of fuel is equivalent to a diminished consumption. The very contrary is the truth." Jevons, The Coal Question (1865). TypeSafe, 2026: "We named Jev after William Stanley Jevons."

### Speaker notes

Say: "In 1865 the economist William Stanley Jevons asked a simple question: Britain's steam engines get more efficient every year, so why does Britain burn more coal every year? His answer: a cheaper job finds more uses. More factories bought engines, and total coal use went up. Economists now call this the Jevons paradox."
"TypeSafe named Jev after him on purpose. Its launch post says it expects machine intelligence to follow the same path as coal: each large drop in the cost of a decision opens many more uses. A call that takes 170 ms and costs a small part of a cent can go where an LLM is too slow or too expensive today: every row of a table, every line of a log, every move in a game."
The other side, say it: more decisions also means more total mistakes. Sophos calls this "Jev's paradox": when automated decisions are cheap enough to run on everything, any error rate adds up. Our maze shows it at small scale. Jev followed our written rules in about 96 percent of decisions, but a game has about 90 decisions, so each game had about 4 wrong moves, and some of them cost a life.
Be exact if asked: the paradox is not a law. It happens only when demand grows faster than the cost falls. Farm productivity is the standard counter-example: food got cheaper, and people did not eat much more food.
Sources: TypeSafe, "Introducing System One Models & Jev", typesafe.ai/blog, 15 Sept 2026. IBM Technology, "What Is Jev?", also tells the story. Jevons, The Coal Question, chapter 7, "Of the Economy of Fuel". Sophos, "Jev's Paradox: the hidden cost of cheap AI decisions". Maze numbers: docs/research/question-design-finding.md.
Bridge: "The other name, System One, comes from psychology. Here is the idea."


## Slide 8 (section 2)

### On the slide

What Jev is · the name "System One"
The idea comes from psychology: two ways to think.
System 1: fast and automatic
2 × 2 = ?
You know "4" at once.
Jev is built for this kind of judgment
System 2: slow and deliberate
17 × 24 = ?
You work it out step by step: 408.
Reasoning models come closest to this
Daniel Kahneman, Thinking, Fast and Slow (2011). Psychologists Keith Stanovich and Richard West named System 1 and System 2 in 2000. Examples from IBM Technology, "What Is Jev?".

### Speaker notes

Say: "TypeSafe borrowed the name from Daniel Kahneman's book Thinking, Fast and Slow. Kahneman describes two modes of human thinking. System 1 is fast and automatic: what is 2 times 2? You know it is 4 without any work. System 2 is slow and deliberate: what is 17 times 24? You must work through it, step by step, to get 408."
"Most AI models are built to write. A chat model writes its answer one token at a time. A reasoning model goes further and writes out its chain of thought before it answers. That is as close to System 2 as AI gets today."
"But many decisions inside software are not System 2. They are quick judgment calls. Look at a support email that says 'I was charged twice this month, please fix it.' Is it a refund request? A person who skims it knows at once: yes. That is System 1 work, and that is the kind of work Jev is built for."
Origin, if asked: Kahneman made the terms famous in 2011. The terms "System 1" and "System 2" come from the psychologists Keith Stanovich and Richard West, in a 2000 paper on reasoning. Kahneman won the 2002 Nobel prize in economics for his work with Amos Tversky on judgment and decision making.
Source for the examples: IBM Technology, "What Is Jev? The AI Model That Doesn't Generate Text" (YouTube, 15 minutes). A good link to share after the talk.
Bridge: "If you want one technique to compare System 1 Jev with, compare it with a classifier."


## Slide 9 (section 2)

### On the slide

What Jev is
Think of it as a classifier whose labels you write in English, at request time.
Trained classifier
Labels are fixed at training time.
Needs labeled training data.
Jev
Labels and rules are in each request.
Needs no training data, but you still need a labeled test set.
A preprint by Rafe and Das (arXiv 2610.00346, 29 Sept 2026) tested 8 decision models, Jev among them, against classifiers and LLMs. With labeled data, small trained classifiers were the most accurate on intent tasks. Without labels, decision models beat a zero-shot classifier. We read the abstract only.

### Speaker notes

Say: "A trained classifier learns its labels from examples. Jev gets its labels in the request, as words. You can change a label or add a rule, and the next request uses it."
The event page calls Jev "a zero-shot classifier". That is a fair short name: it classifies with no training examples. The difference from the older zero-shot method in the table on slide 4: Jev also takes written rules for each option, and TypeSafe trains its probabilities to match outcomes.
Be exact about "no labels": you need no training data, but you still need a set of labeled test cases to know how well it works and where to put thresholds. That set can be small compared with training data, but it is not zero.
The preprint: published September 29, about two weeks before this talk, not peer reviewed. It compared model classes on workflow, intent, and social-science decisions. Its summary: the ranking depends on the conditions. With the task's own labels, small trained classifiers win on intents. Without labels, Jev and similar models beat the older zero-shot method.
Bridge: "Here is what one request looks like."


## Slide 10 (section 2)

### On the slide

What Jev is · how to call it
One request, one answer.
POST /v1/systemone
state
"Help! My payouts have
been failing for 3 days."
question
department (choice)
"Which team should handle this?"
billing
Payments, invoicing, refunds
technical
Bugs, outages, integrations
sales
Pricing, upgrades, new accounts
choice
billing
billing
0.88
technical
0.12
sales
0.00
confidence
0.81
The example from the TypeSafe API reference, shortened. One request can carry many questions.

### Speaker notes

Say: "Three parts. The state is the content: here, one support message. The question has instructions and a list of options, and each option has a short description. The answer names one option and gives a probability for each."
Details for questions: The question name, "department", is not sent to the model, so all the meaning must be in the instructions and the descriptions. A request can carry many questions, answered in parallel. Limits: up to 255 options for each Choice, and 64,000 tokens for each request (32,000 for the state plus one question). Since 14 October, the header TypeSafe-Danger-Zone-Long-Context: true raises both limits to 262,000 tokens. TypeSafe says long context is slower and less accurate, at the same price for each token.
Bridge: "This was a Choice. There are three question types."


## Slide 11 (section 2)

### On the slide

What Jev is · question types
Three question types, and the classic technique that each one matches.
Choice
"Which team handles this ticket?"
One option, with a probability for each
Like a multi-class classifier
Score
"How frustrated is this customer?"
A number on levels that you define, for example 1.4
Like an ordinal rating
Noul
"Does this message ask for a refund?"
The probability of yes, for example 0.95
Like a binary classifier

### Speaker notes

Choice picks one of your options. Score rates on ordered levels that you describe, for example 0 calm, 1 frustrated, 2 very frustrated; the answer is the probability-weighted level, so 1.4 lies between "frustrated" and "very frustrated". Noul, TypeSafe's name for a yes or no question, gives the probability of yes.
Tie: "Each one is a classic machine learning output. You already know how to use these in code: an argmax, a threshold, a sort."
Bridge: "Those are the three types that I tested for this talk. Yesterday TypeSafe added a fourth type, and a new kind of input."


## Slide 12 (section 2)

### On the slide

What Jev is · new on 14 October
Since yesterday, Jev also reads images. TypeSafe calls it experimental.
[IMAGE: A RenderMaze board. A green box that Jev returned surrounds the runner character.]
An image can go in the state, in the instructions, or in the criteria.
A new question type, Box, returns where a thing is in an image. It needs jev-1.14.0.
Off by default. Turn it on with the header TypeSafe-Danger-Zone-Images: true.
Our test this morning: on one maze frame, Box found the runner 4 times in 4 runs. About 1,400 tokens, $0.00006.
TypeSafe blog, 14 Oct: "too much jaggedness" for production. Ours: 1 frame, 4 runs.

### Speaker notes

Say: "One update, because this is new. Yesterday, October 14, TypeSafe released jev-1.14.0 and turned on images. An image can go anywhere that text can go: in the state, inside a question, or as the example for an option. And there is a new question type, Box, which returns where something is in an image."
Say: "Our maze player does not see the screen. Code sends it facts. So this morning I sent Jev one frame of the maze, as an image, with three questions. The green box is Jev's Box answer for the runner: the same place in 4 of 4 runs, with a confidence of 0.55 to 0.67. The request took about 1,400 input tokens, which is less than one hundredth of a cent, and 190 to 330 ms."
Say the limits plainly: "TypeSafe puts this in what it calls the danger zone. Its words: there is still 'way too much jaggedness for us to vouch for these for production'. It also says that every model, Jev included, does worse on images than on text. One frame and four runs is a demo, not a measurement. Everything in the next part of this talk applies to images too."
The other two questions in our test. "About how many wings are left?" (true answer: 135). jev-1.14.0 answered "more than 100" at 0.78 to 0.81 in 4 of 4 runs. jev-1.13.0 answered "50 to 100" at 0.64, wrong, in 1 run. "Is a blocker within 3 tiles of the runner?" Both versions said no (0.18 to 0.22, and 0.38), which is correct. Counting is a known failure mode, so do not read the wing result as a rule. Script: the request is in the session scratchpad; the image is media/jev-box-maze.jpg.
Facts, if asked:
1. The header: TypeSafe-Danger-Zone-Images: true, on each request with an image or a Box question. Without it, the API returns 400: "Images are experimental." We saw that error.
2. Versions: jev-1.13.0 and jev-1.14.0 both accept images. TypeSafe says jev-1.13.0 "was multimodal all along". Box needs jev-1.14.0 or jev-preview.
3. How to send an image: list it once in a top-level "assets" map, with a reference string as its key, for example a new UUID. Write the reference anywhere in the state, the instructions, or the criteria, and the model gets the image in its place. The Python and JavaScript SDKs make the references for you. Over HTTP, multipart is better than base64, because base64 makes each image about one third larger.
4. Limits: PNG or JPEG only. 256 to 1,568 pixels on each side, 16 MiB for each file, 32 MiB for each request. An image outside the limits is rejected, not resized.
5. Cost: images are input tokens at the same price, $0.042 for each 1 million. Each use of a reference adds the image again. Wes Bos measured one question on an 850 × 850 image at $0.000097, about 10,000 images for each dollar. So put a shared image in the state once, not in each question.
6. Box always returns a box. It has no "not found" answer. Ask a Noul "Is there a mug in the photo?" in the same request, and ignore the box when the Noul is low. One Box question finds one thing.
7. Long context: a second header, TypeSafe-Danger-Zone-Long-Context: true, raises the limit from 64,000 to 262,000 tokens. Slower and less accurate.
8. A docs conflict: on 15 October the Models page still says "Input: Text" for both versions, and that Jev "does not accept audio or video". The Images page says both versions accept images. Video is still not an input.
9. VideoJev is not TypeSafe. Posts on X on 14 October (Aran Komatsuzaki, AK) shared "VideoJev: System One Model for Video Understanding and Interaction", arXiv 2610.18615. It is an academic paper by other authors (Zhu, Zeng, and others), with open 4B and 35B models. It uses the System One idea. If someone asks: it is not a TypeSafe product, and Jev does not accept video.
10. For the build time: our maze proxy does not send the images header, and it rejects a body over 64 KiB, so an image request through /api/jev fails. To try images, use the TypeSafe console or the curl example on the TypeSafe Images page.
I have no relationship with TypeSafe. This test used my own key.
Bridge: "Back to the numbers that every answer carries. Choice, Score, and now Box answers carry a confidence. People misread it, so here is exactly what it is."


## Slide 13 (section 2)

### On the slide

What Jev is · probability and confidence
Probabilities and confidence are two different numbers.
Probability
Billing 0.88
TypeSafe says these are calibrated: of many answers at 0.8, about 80% are correct.
Confidence
≈ (n × top − 1) / (n − 1)
How concentrated the probabilities are. It is not the chance of being correct.
TypeSafe docs: Confidence; System One. Calibration "does not guarantee that an individual answer is correct."

### Speaker notes

Say: "The probabilities are the model's estimate for each option. TypeSafe claims they are calibrated. That is a claim about groups: of a thousand answers at 0.8, about 800 are correct."
Draw it in the air, from the IBM video: put the stated probability on the bottom axis and how often the answer is correct on the side axis. A calibrated model lies on the diagonal: answers at 0.8 are correct about 80 percent of the time.
"Confidence is arithmetic on those probabilities. n is the number of options, top is the highest probability. All the probability on one option gives 1. An even spread gives 0. With 3 options and a top of 0.88, confidence is 0.81. So 'confidence 0.81' does not mean '81 percent correct'."
For a Score, TypeSafe uses a different spread formula over the levels. A Noul has no confidence field: a value near 0.5 means "not sure". A Box answer, new since 14 October, has a confidence too.
Tie: "With a classifier that you train, you calibrate it yourself, with Platt scaling or temperature scaling on a held-out set. TypeSafe says it does that work in training. You still must check it on your own data, as the next part shows."
Bridge: "Where would calibration come from? TypeSafe says: from the way it trains the model."


## Slide 14 (section 2)

### On the slide

What Jev is · training
TypeSafe says it trains Jev to give probabilities that match outcomes.
RLHF
Reinforcement learning from human feedback
Rewards answers that people prefer
Chat models
RLVR
Reinforcement learning with verifiable rewards
Rewards answers that a program can check
Reasoning models
RLCD
Reinforcement learning for calibrated decisions
Rewards probabilities that match outcomes
Jev
No paper or reward function is published. Customers cannot fine-tune Jev.

### Speaker notes

Keep this slide to about one minute.
Define the shared term: "All three start with RL, reinforcement learning. A model produces an output, a reward function scores it, and training makes high-scoring outputs more probable. The methods differ in where the score comes from."
Context: a model first learns from a huge amount of text (pre-training), then learns to be useful in a second stage (post-training). Much of post-training uses reinforcement learning.
RLHF, reinforcement learning from human feedback. People compare answers and pick the better one. A reward model learns those choices, and training moves the language model toward answers that score high. OpenAI used it for InstructGPT and ChatGPT. Side effect: people tend to like answers that sound confident, so a model can learn to sound sure even when it is wrong.
RLVR, reinforcement learning with verifiable rewards. A program checks each answer: is the math correct, do the unit tests pass? This produced the reasoning models. The reward checks only the final answer. It does not reward the model for knowing how sure it should be.
RLCD, reinforcement learning for calibrated decisions. TypeSafe's name for its own method. The model gives a probability for each option, and the reward depends on whether those probabilities match how often the answers are correct.
If asked "why reinforcement learning, when a normal classifier loss such as log loss already rewards calibration?": TypeSafe does not explain this, and it has not published a paper, a reward function, the base model, or its size. Say that you do not know.
Bridge: "A model trained for one narrow job has limits. TypeSafe publishes nine of them."


## Slide 15 (section 3)

### On the slide

What it does not solve
TypeSafe publishes nine known failure modes for jev-1.13.
Literal reading
Math and numbers
Dates and times
Indirection
Large state with irrelevant detail
Adversarial content
Instructions that contradict criteria
Choice option order
Text generation (out of scope)
TypeSafe docs, "Jev 1.13 jaggedness", checked again 15 October 2026. No list exists yet for jev-1.14 or for images. Read it before you design a question.

### Speaker notes

Say: "Every tool on the earlier table had a weak column. This is Jev's, from TypeSafe itself. A published list is useful, because it tells you what to test."
For each mode, the test to run:
1. Literal reading: "jev-1.13 answers the question you wrote, not the one you meant." Test: write the exact condition, and check boundary cases. 2 and 3. Math, counting, dates: test any question that compares numbers or dates, and move it to code. 4. Indirection, for example a property of a property: point at the exact field. 5. Large state: send only the fields that the question needs. 6. Adversarial content: text in the state can steer the answer. 7. Contradiction: keep the instructions and the option text in agreement. 8. Option order: reorder the options and check that the answer stays the same. 9. Generation: Jev does not write text; use an LLM for that.
New since 14 October: TypeSafe publishes no failure list for jev-1.14 or for images yet. The release post says that "all models (Jev included) perform worse on multimodality over pure text", and that it is "way too much jaggedness for us to vouch for these for production". Assume that every mode on this list also applies to images, and that counting objects in an image is worse than counting in text.
Bridge: "Two of these modes produce wrong answers with high confidence. Here are the measurements."


## Slide 16 (section 3)

### On the slide

What it does not solve
Confidence cannot tell you that the question is wrong.
An incomplete question
24 support messages, 4 teams. The question left out a company rule.
19 wrong. 15 of them had confidence above 0.90.
Option order and scope
A swap of the yes and no labels changed 50.5 of 100 answers.
A 5% risk threshold still let in 31% of out-of-scope requests.
Left: phuryn/experiments on GitHub, rerun 3 times by us. Right: Rafe and Das preprint, not rerun by us.

### Speaker notes

Left, say: "Someone published an experiment on GitHub: 24 support messages to route to 4 teams. The company had a routing rule that a new employee would not guess, and the question did not state it. Jev routed 19 messages wrong, and 15 of those 19 had a confidence above 0.90. We ran the same code three times and got the same accuracy; 14 of the 19 errors were above 0.90 in our runs."
The lesson on the left is about the question, not about Jev alone: any model would miss a rule that nobody wrote down. The point is that the confidence cannot warn you. It describes the words you wrote, not your intent.
Right, say: "The preprint found two other problems. When they swapped which label meant yes and which meant no, about half of the answers changed. And a threshold tuned to accept only 5 percent risky answers still accepted 31 percent of requests that were outside the question's scope."
What to do: test each Noul and Choice with the options in a different order, and add an explicit "none of these" option for requests outside the scope. Each extra order costs one more request.
Bridge: "Next, the facts about the service itself."


## Slide 17 (section 3)

### On the slide

What it does not solve
Production facts about the service.
Price
$0.042 for each 1 million input tokens. Output is free.
Rate limits
Set for each organization. Read yours in the console.
Errors
429 rate limit, 529 overloaded: retry with backoff. 401 key, 422 bad request.
Versions
jev-latest moves to jev-1.14.0 in about one week. Pin a version.
Repeatability
Close, not exact: in our 3 reruns of 72 requests, 70 got the same answer each time

### Speaker notes

Price: our maze games used about 100,000 to 250,000 input tokens each, which is about one cent or less.
Rate limits: on 2 October the docs said 80 requests and 100,000 tokens each second, "can change without notice". On 15 October the docs say only that limits are set for each organization, in requests and tokens each second, and that the console shows them. Higher limits are on custom and enterprise plans. Images have no separate rate limit.
Errors: the TypeSafe SDKs retry 429 and 529 with backoff by default. A timeout or a 5xx error needs a fallback in your code: in our maze, code makes the move and labels it FALLBACK. The docs state no SLA.
Versions: the response reports the exact version that answered, so log it. On 14 October TypeSafe released jev-1.14.0 as jev-preview, with "small, subtle improvements", the largest in languages other than English. jev-latest moves to jev-1.14.0 about one week later. TypeSafe says it will give 60 days of notice before it removes jev-1.13.0, and 30 days for jev-1.14.0, and that a deprecation policy comes first. If you tuned a threshold on jev-1.13.0, pin jev-1.13.0, and test again on jev-1.14.0 before you move. The Box question type needs jev-1.14.0.
Repeatability: in our 3 reruns of the house-rules experiment (72 requests each), 70 requests got the same answer each time. The probabilities moved slightly between runs, for example 0.92 against 0.87.
Bridge: "And the facts about your data."


## Slide 18 (section 3)

### On the slide

What it does not solve
Data and security.
Your text goes to TypeSafe, hosted in the U.S.
Policy: no training on your inputs. Retention "as long as reasonably necessary".
A DPA is now listed. No SOC 2 report is listed.
Text in the state can steer the answer. Code must check high-stakes actions.
TypeSafe privacy policy; TypeSafe docs, Legal and jaggedness, "Adversarial content". Checked again 15 October 2026.

### Speaker notes

Say: "Four facts before you send customer data. The service runs in the U.S. The privacy policy says TypeSafe will not train or fine-tune models on your inputs, but it gives no fixed retention period. On 2 October, the public site listed no data processing agreement. On 15 October, the docs Legal page lists a Data Processing Agreement, and zero data retention for enterprise customers. I did not read the DPA. No SOC 2 report is listed; ask TypeSafe if you need one."
New since 14 October: an opt-in setting lets TypeSafe look at your queries to find model errors. TypeSafe says it still does not train on them. Leave it off for customer data unless your data rules allow it. Images go to TypeSafe the same way as text. The API removes the image metadata (EXIF), but the pixels can still show faces, names, or addresses.
Prompt injection: "TypeSafe's docs say that Jev does not treat the state as hostile by default, and that content written to steer the model can move the answer. The request separates the state from the questions, but the docs do not promise that text in the state cannot influence the answer. So treat the answer as untrusted input: code checks any action with real consequences."
Bridge: "With the limits known, here is how to use it well."


## Slide 19 (section 4)

### On the slide

How to use it
Code owns the workflow. Jev makes one narrow judgment inside it.
CodeBuilds the state. Checks the refund window and the amount.
JevAnswers the language questions: refund asked? Duplicate charge described?
CodeCombines the answers with the exact checks, then acts or sends it to a person.
Adapted from the refund example in the TypeSafe docs, System One.

### Speaker notes

Say: "This is the shape of every good Jev system. Code collects the facts and does every exact check: dates, amounts, account status. Jev answers only the questions that need language understanding, in one request. Code makes the decision and sends unclear cases to a person."
Tie: "You have seen this shape before. It is a rules engine or a workflow, where one step is a classifier. The difference is that the classifier's labels are words that you can change."
Bridge: "Five rules make this work. The first one is about the words."


## Slide 20 (section 4)

### On the slide

How to use it · rule 1
Write the exact condition in the words.
Company rule left out
5 / 24
Company rule written in
24 / 24
Same experiment as slide 16 (phuryn/experiments, 24 support messages). The rule was written for these messages and scored on them, so this shows the effect of the words, not accuracy on new messages.

### Speaker notes

Say: "Same model, same 24 messages. The only change: the company's routing rule went into the option descriptions. Correct answers went from 5 to 24."
The caveat, said plainly: the rule was written for these 24 messages and scored on the same 24. That proves that the words change the answer. It does not prove 100 percent accuracy on messages that nobody has seen. For that, keep a held-out test set.
TypeSafe's advice: "When you look at a wrong answer and find yourself explaining what you really meant, that explanation is the missing half of the instruction."
Bridge: "Rule two is about what not to ask at all."


## Slide 21 (section 4)

### On the slide

How to use it · rule 2
Keep counting, math, and dates in code.
Asked of Jev
"Is the bird below the opening?"
Correct in 35% of 434 answers, worse than a coin flip
Done in code
bird_row > opening_bottom
Correct every time, for free
GapFlap, a public Flappy Bird game on GitHub (gdchaochao/lunar-terminal) that asks Jev about row numbers. Our rerun: "below" 0.353, "above" 0.433, "inside" 0.894.

### Speaker notes

Say: "A public Flappy Bird project gives Jev the bird's row number and the rows of the opening, for example 'bird row 6, opening rows 3 to 5', and asks yes or no questions about position. We ran it. On 'is the bird below the opening', Jev was correct 35 percent of the time."
Why 35 percent matters: a coin flip gets 50 percent on a yes or no question. Below 50 percent means a systematic error, most likely a misread of the row direction (row numbers grow downward). That is failure mode 1 and 2 together: literal reading of numbers.
The design rule: code calculates the numbers, and Jev weighs their meaning. In our maze, code counts the steps to each blocker.
Bridge: "Rule three is the one that TypeSafe calls the most important. The evidence for it is weaker than TypeSafe suggests."


## Slide 22 (section 4)

### On the slide

How to use it · rule 3
Splitting a judgment into narrow questions is an option. Measure it.
Phishing, 2,000 synthetic emails
Accuracy
Jev, one verdict question
62.6%
Claude Haiku 4.5, one verdict
81.3%
A regex, no AI
91.6%
Jev, 5 signal questions + trained regression
95.0%
anisselbd/jev-phishing-bench, a public GitHub benchmark. Self-reported, not rerun by us. The regression needs labeled data.

### Speaker notes

Say: "TypeSafe calls this 'probably the most important concept' in its guide: a broad question hides several judgments, and narrow questions show each one. Here is the best public evidence we found. One broad phishing verdict from Jev: 62.6 percent. Claude Haiku on the same verdict: 81.3. A plain regex: 91.6. Five narrow Jev questions, combined by a logistic regression: 95."
Three cautions. It is self-reported. The emails are synthetic, and a regex gets most of the way. And the regression is trained on labels, so this design needs labeled data. In our own maze, the version with an extra danger question did worse than the version with only better words. Splitting is a design option. Measure it.
This is also the only Jev-against-LLM comparison that we found. We did not measure one ourselves.
Bridge: "Rule four decides what code does with each answer."


## Slide 23 (section 4)

### On the slide

How to use it · rule 4
Let your test results and the stakes decide what code does.
Low probabilitySend it to a person, or use a fallback
Low stakesAct at a lower threshold. A mistake is easy to undo.
High stakesAct only at a high threshold. Below it, ask to confirm.
Choose each threshold from a labeled test set: plot the share of cases that code automates against the error rate.

### Speaker notes

Say: "One threshold is not enough. TypeSafe's docs show a voice banking app: below a confidence of 0.6, a person handles it; a balance check can act at 0.6; a money transfer needs more than 0.85, and below that the app asks the user to confirm. Those numbers are TypeSafe's example, not a recommendation."
How to get your own numbers: run your labeled test set, sort the answers by probability, and for each possible threshold compute two things: what share of cases code would handle alone, and how many of those it gets wrong. Pick the point that fits the cost of a mistake. Use the probability of the chosen option for this, because that is the number TypeSafe claims is calibrated.
A second example, from the IBM video, for a refund Noul: above 0.9, send it straight to the refund queue; between 0.1 and 0.9, a person checks it; below 0.1, it is not a refund request. Because the numbers are calibrated, the threshold also tells you roughly how often the automatic path is wrong. The more a mistake costs, the higher the threshold.
Tie: "This is the same method that you use for any classifier with a review queue."
In our maze, code uses the fallback policy below a confidence of 0.2. We set it low on purpose, so that most moves stay with Jev for the teaching demo. We did not tune it.
Bridge: "All of this depends on a test on your own data. That is rule five."


## Slide 24 (section 4)

### On the slide

How to use it · rule 5
Test on your own data, then pin the version.
Keep a labeled test set, and some cases that nobody tuned on.
Log each decision: the state, the question, the answer, the version.
Compare two versions of a question on the same cases.
Pin a version, for example jev-1.13.0, before you tune a threshold.
TypeSafe skill guide: "Treat cookbook thresholds and demo results as examples to evaluate."

### Speaker notes

Say: "The preprint's summary was that the best model class depends on the conditions. Your conditions are your data. Keep a labeled test set, hold some of it back so that you do not tune on it, log everything, and compare versions on the same cases."
Bridge: "So where does this fit in real systems?"


## Slide 25 (section 5)

### On the slide

Use cases
Where Jev fits, and how strong the evidence is.
Use case
Jev decides
Code does
Evidence
Ticket routing
The team for each ticket
Policy checks, queues
Public experiment, rerun by us
Hard-case tier
Only the cases a cheap classifier is unsure about
Runs the classifier first
Preprint: same accuracy as Jev alone, 0.43 of the cost
Moderation
Which written rule a post breaks
Allow, warn, block
Vendor idea, not tested
Game characters
The next action
Rules, timing, legal moves
Village experiment (partly held up), our maze
Sales email
The rep's next step
Gates, drafts, the send
Our real-email test: equal to Sonnet, 2% of its cost
Before an LLM
Which inputs fit the request
The cap, the ontology check
Our PTSO A/B: better outfits, one run

### Speaker notes

Say: "Four places where the shape fits: fixed options, text input, many decisions. The right column says how much to believe each one."
Ticket routing: the experiment from slides 16 and 20.
Hard-case tier: the preprint's most practical result. A classifier trained on intents handles most requests, and only the uncertain ones go to Jev. That matched Jev's accuracy at 0.43 of its cost, in their setup.
Moderation: from TypeSafe's own list of use cases. We did not test it. Remember failure mode 6: hostile users write hostile text, so moderation needs your own tests. We removed "jailbreak detection" from this table for the same reason.
Game characters: a public village simulation, where Jev picks what each villager does. Vague option text sent a villager with zero hunger to eat at 3 a.m., 5 times out of 5. Explicit thresholds sent them to bed. Our rerun matched both results, but the author changed the state text in the same commit, so the words were not the only cause. And our maze, which is next.
Bridge: "Just as important is where Jev does not fit."


## Slide 26 (section 5)

### On the slide

Use cases · System 1 and System 2 together
Jev makes the fast calls. An LLM does the slow work.
Jev, System 1The email arrives. Refund request? Which team? How urgent?
LLM, System 2Code routes the email. An LLM writes the reply.
Jev, System 1The customer answers. Jev classifies the answer, and the loop continues.
The support-email workflow from IBM Technology, "What Is Jev?". Kahneman's view: most of what we do runs on System 1, and System 2 starts only when a task needs real thought.

### Speaker notes

Say: "You do not throw away large language models. You put each one where it fits. Jev makes the quick calls: is this a refund request, which team, how urgent. Code routes the email. An LLM does the slow work: it writes the reply. When the customer answers, Jev classifies that answer, and the loop continues."
Why the decision step must not depend on generated text: a model that writes can make its answer longer, change its format, or add work that nobody asked for. Anthropic documents exactly this for Claude Opus 5 ("default user-facing responses run longer than prior Opus models'"). Jev cannot do any of that, because it can only return one of your options. Say it this way: "When the task is a decision, do not ask a model that writes. Ask a model that picks." Do not say that Jev fixes Claude's verbosity: for anything a person reads, you still need an LLM and a length instruction in the prompt.
Sources: Prompting Claude Opus 5, Claude Platform Docs (platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5); Hacker News thread "Why does Opus 5 feel worse to work with?". Note: Anthropic never released a model named "Opus 5.1".
"This is how Kahneman says people work: most of what we do runs on fast, automatic System 1, and slow, careful System 2 starts only when something needs real thought."
The case in this talk uses exactly this pattern, on RenderATL's own "Ask Your Agent" idea: Jev routes an attendee's question, code answers the facts, and an LLM writes the plan or the email.
The IBM video also suggests Jev as a guardrail for jailbreak attempts. TypeSafe itself lists adversarial content as a known failure mode, so test that use carefully before you rely on it.
Bridge: "Here is the same pattern on a tool that RenderATL runs every weekday."


## Slide 27 (section 5)

### On the slide

Use cases · at RenderATL
Our sponsor pipeline makes small decisions all day.
CodeIs the deal due? On the Do Not Contact list? Did the email bounce?
Jev, System 1What does the prospect want? Send the deck? Follow up, stop, or escalate?
Claude, System 2Writes the draft in the rep's voice. The rep approves and sends.
The steps come from RenderATL's pipeline follow-up tool. Today one LLM prompt makes every one of these decisions. The next slides show what we built and measured.

### Speaker notes

Say: "RenderATL has a sales tool that an AI coding agent helped us build. Every weekday it finds the sponsor deals that are due, reads the email threads and the call notes, and writes follow-up drafts for each rep. Today one big LLM prompt does all of it: every judgment and every draft. That is an assistance design. The rep must read everything."
"But most of the work is small decisions. Which of eight actions does this thread owe: answer a question, send the contract, send the deck, send pricing, schedule, an intro, another promise, or nothing? Which sales stage is it in? Did they say 'not this year'? Does this need a senior person now? Those are System 1 questions."
"So split it. Code keeps the exact rules: the due date, the Do Not Contact list, the bounce check, the pricing gate. Jev answers the judgment questions in one call, with a probability for each. Claude writes only the drafts that need writing. And the confidence decides how much the rep reads: high confidence on 'nothing owed' is one line; low confidence, or a security flag, means the rep reads the thread."
The new "Jev Explained" video (Mr. Cloud Book, 6 October 2026) uses a sponsor form as its first example: is it a sponsor inquiry, what product, how specific, then code sends the rate card or queues a person. Same shape.
How we would test it: run Jev beside the current flow for a week in shadow mode, log every answer, and compare with what the reps decided. Let Jev skip threads only after that. We have not done this yet. The threads hold prospect names and prices, so check the data rules first.
Tie-in to the Devin workshop: an agent helped build the tool, with a person who reviews each change. That is assistance. Jev is the automation primitive inside the finished tool.
Tie-in to Obvious, our sponsor: Obvious runs "factories", always-on agent workflows, with "humans at the points of imagination and judgment". Its support agent flags high-risk requests for a person. Each of those flags is a System 1 gate, the kind of decision Jev makes. Say it as a fit, not a product: there is no public Obvious and Jev integration that we know of.
Other RenderATL decisions with the same shape: the call for speakers (which track, is it a sales pitch), scholarship and Fellowship applications (one yes or no for each requirement), the support inbox (refund, transfer, badge, travel), code of conduct reports (always a person, Jev only flags urgency), and spam in Slack. Details: docs/research/renderatl-jev-opportunities.md.
Bridge: "So we built it."


## Slide 28 (section 5)

### On the slide

Use cases · RenderATL Decision Desk
The Decision Desk: Jev decides, code checks, Claude writes, a person sends.
[VIDEO: media/decision-desk-demo.mp4]
One Jev call: 7 typed decisions for each email that code does not stop first.
Code: Do Not Contact, the pricing gate, no deck twice.
Contracts, money, safety, injection: a person.
The Jev wire shows the raw request and response.
Synthetic emails. Video: media/decision-desk-demo.mp4 (1:46). Repo: William-Hill/renderatl-decision-desk.

### Speaker notes

Say: "This is the desk. Each email gets one Jev request with seven questions: who wrote it, what they want, the sales stage, a 'not this year', an escalation, the urgency, and an injection attempt. Code applies the exact rules. Claude writes only the replies that need writing. A person sends every email."
Point at the dark panel on the right: "That is the Jev wire. It shows the exact request and the exact response for each email. No prompt to parse, no text to trust: typed answers with probabilities."
Show in the video: the pricing request (Jev: send pricing, 99%; code opens the pricing gate), the repeat deck request (code: do not resend the deck), the email that tells the 'AI assistant' to CC a competitor (held for a person, no draft), and the Do Not Contact sender (no Jev call at all).
The 36 emails are synthetic. On them, after one tuning pass: lane 32 of 32, action 30 of 32. Those are tuning numbers.
Bridge: "What does that split save?"


## Slide 29 (section 5)

### On the slide

Use cases · Cost
Same 36 emails: Jev first cost 69% less.
Cost, 36 emails
$0.226
→
$0.070
Claude calls
36
→
25
Time to a decision
6.5 s
→
0.19 s
[VIDEO: media/decision-desk-cost.mp4]
Synthetic emails, one run. Same accuracy (action 27 vs 28 of 32). Claude tokens estimated at Sonnet list price.

### Speaker notes

Say: "We ran both designs on the same 36 emails. LLM only: Claude reads every email, makes every decision, and writes every reply. Jev first: Jev makes the decisions for a fraction of a cent, and Claude writes only where a reply is needed."
"Same accuracy on the decisions. 69 percent less money. And the route is known in under 200 milliseconds, not six and a half seconds. Almost all of the money that remains is the writing. Do not pay a model that writes to make a decision."
Honest limits: synthetic emails, one run, Claude tokens estimated. The real-email test is next.
Bridge: "Synthetic data is easy. So we ran it on real sales email."


## Slide 30 (section 5)

### On the slide

Use cases · Real sales email
Real sales email: Jev matched Sonnet and Haiku at 2% to 4% of the cost.
Held out, 45
Right
Recall, 4 actions
Cost, 138 messages
Median time
Jev, playbook + thread facts
28 (62%)
0.51
$0.012
0.19 s
Sonnet, same context
26 (58%)
0.49
$0.60
4.0 s
Haiku, same context
28 (62%)
0.51
$0.30
13.6 s
Jev, latest message only
19 (42%)
0.41
Always "send contract"
28 (62%)
0.25
$0
One RenderATL sales mailbox, redacted locally; counts only. Tuned on one half, scored once. Context: 19 → 28 (p = 0.012). Jev vs Sonnet: p = 0.69.

### Speaker notes

Say: "We exported William's sales mailbox, kept the sponsor threads, and removed names, emails, phone numbers, and prices on the laptop before anything went to a model. The question: given the thread, what must the rep do next? Send the contract, pricing, the deck, schedule a call, another reply, or nothing."
"First version: Jev saw only the latest message. 19 of 45 right. Then we gave it the stage playbook from our sales tool, facts that code computes from the whole thread, and the rep's own last message. 28 of 45. Same model. Better question, more context. That is the lesson of this talk again."
"With the same context, Sonnet got 26 and Haiku 28. Jev agreed with Sonnet on 33 of 45. Jev cost a cent for 138 messages. Sonnet cost 60 cents. Jev answered in under 200 milliseconds."
Say the limits plainly: "This is one mailbox and 45 scored messages. 'Always send contract' also gets 28, because many of these threads were at the contract stage; the mean recall over the four actions is 0.51 against 0.25. William checked 50 of the automatic labels and 19 were wrong, so we scored only the reliable kinds. Adding call notes did not help. No method is accurate enough to send email on its own. What the data shows is that Jev can replace the LLM for this decision at a small part of the cost."
Earlier version, all 268 messages, latest message only: Jev 108, Sonnet 107, Haiku 109, keyword rules 97 (40 percent each). Details: docs/research/decision-desk-and-ptso-results.md.
Bridge: "The same idea works one step earlier: before the expensive model runs."


## Slide 31 (section 5)

### On the slide

Use cases · PTSO
PTSO: Jev narrows the closet before the model proposes.
CodeWeather, season, a cap of 5 per category.
JevRules out and orders garments for the request.
Model, then ontologyGemini proposes. The ontology checks.
Blind judge, Jev first vs today
16 to
2
17 ties, p = 0.0013
Gemini cost, 39 requests
$1.34
→
$1.29
Same cost, better inputs.
One closet, 39 requests, one run. The judge is Claude, not a person (35 judged pairs). A human check is pending. The "skip the model" gate failed once and stays off.

### Speaker notes

Say: "PTSO, my outfit agent, follows one rule: the model proposes, the ontology disposes. But the ontology runs after the expensive model call. So we asked: what if Jev narrows the closet before the model sees it?"
"The closet has 62 tops and 63 bottoms. The route sends only 5 of each to the model, in database order. For 'gym session after work', none of the gym clothes reached the model. Jev reads the request and puts the right garments first. It can only remove or reorder; the ontology still checks every outfit."
"On 39 requests, a blind judge preferred the Jev-first outfit 16 times to 2. Against a plain 'requested style first' rule: 18 to 5. Same Gemini cost."
Limits: one closet, one run, a Claude judge, not a person. Jev also tried to skip the model for requests that are not outfit requests; it skipped one real outfit request ("Running errands, nothing special"), so that gate stays off. On the synthetic seed closet, 5 of 14 requests skipped the model correctly.
Bridge: "And here is where Jev does not fit at all."


## Slide 32 (section 5)

### On the slide

Use cases
When to use something else.
When
Use
The rule is exact
Code: a comparison, a regex, a date library
You have labeled training data
A trained classifier, with Jev for the hard cases
You need text or code
An LLM
You need many steps of reasoning
A reasoning model
A fixed set of answers about language
Jev, with code around it

### Speaker notes

Say: "Read top to bottom, and stop at the first row that matches. If code can decide exactly, use code. If you have labeled data, a trained classifier can be more accurate, and Jev can take the uncertain cases. If you need words out, use an LLM. If you need a chain of reasoning, use a reasoning model. Jev fits the last row."
Bridge: "We tested the second row on this season of Formula 1."


## Slide 33 (section 5)

### On the slide

Use cases · a test with labels
F1 2026: should this driver pit now? The trained model wins.
Method
All laps
Safety-car laps
Hand-written rule
0.061
0.233
Trained model
0.147
0.292
Jev
0.076
0.381
Jev + Claude
0.082
0.290
Average precision against the teams' real stops (higher is better). Trained on 2026 rounds 1 to 10, tested once on rounds 11 to 16: 6,839 driver-laps, 242 stops. Data: FastF1. The safety-car difference was not tested for significance.

### Speaker notes

Say: "We took every lap of the last six races of this season, Hungary to Bahrain, and asked one question for each driver: must this car pit at the end of this lap? The answer key is what the team really did. Code calculated every fact first: tire age against a typical stint, safety car, the gap behind, the pit loss."
"A logistic regression, trained on the first ten races, wins on all laps: 0.147 against 0.076 for Jev. That is the second row of the last slide. With labels and numbers, train a model."
"But look at the safety-car laps. That is a quick judgment with a clear written rule, 'pit under a safety car when the tires are near the end of their life', plus race-control text. There Jev is the best of the four: 0.381."
"And System 2 did not help here. Claude got the 1 lap in 20 where Jev was unsure, and changed 270 of 390 answers. It found fewer stops, not more. A slow model is not always a better model."
Be exact if asked: the safety-car slice is 632 laps with 102 stops in 6 races. We did not test whether 0.381 against 0.292 is significant. Jev also found the most stops overall (66%), but only 17% of its calls were right, because the rule says "pit" on every lap after the tires pass their typical life. Average precision is the area under the precision-recall curve: it scores the ranking of laps, with no threshold.
Cost: Jev for all 9,122 laps was about $0.28. The Claude calls used about 42 million tokens of a Claude Max plan, because headless Claude Code adds about 76,000 tokens of context to each call. Details: docs/research/f1-pit-results.md.
Bridge: "Now one complete case where Jev does fit: the questions that people ask about this conference."


## Slide 34 (section 6)

### On the slide

Case: Ask Your Agent
One attendee question, two paths.
[IMAGE: The Ask RenderATL demo page. Left: Jev first, labeled SYSTEM 1, 380 ms, 25 words, group_discount at 99 percent, and a one-line answer. Right: LLM only, 5827 ms, 83 words.]
Jev picks the intent: 99%.
Code writes the answer from checked facts.
380 ms against 5,827 ms.
Only the LLM gave the total for 6.

### Speaker notes

Say: "RenderATL's site has an 'Ask Your Agent' idea: attendees ask an AI about the conference. Here are two ways to build it. On the right, every question goes to an LLM with the whole guide in its prompt. On the left, Jev reads the question first."
"Jev answers three questions in one request: which of 11 intents is this, can the facts answer it, and which ticket fits. If the intent is a fact intent, the probability is at least 0.7, and the facts can answer it, code writes the answer from a facts file. Every value in that file is checked against the published guide by a test. That is System 1."
"Otherwise the question goes to the LLM: an email to your manager, a trip plan, 'is this conference for me'. That is System 2."
Point at the right side, and be fair: "The LLM did more here. It multiplied: 6 tickets at $280 is $1,680. The template does not do that. Code could add it, because it is arithmetic, and arithmetic belongs in code. But today the template answer is shorter and less complete."
This is a real run (2026-10-06): real Jev, and Claude Sonnet through headless Claude Code. The page is ask.html in the repository.
Bridge: "One question proves nothing. Here is a measurement."


## Slide 35 (section 6)

### On the slide

Case: Ask Your Agent
On 30 held-out questions: the same checked accuracy, a faster median, a lower cost.
30 held-out questions
Facts right (checked)
Median
p95
Cost / 1,000
Words
LLM only
17 of 19
5,322 ms
13,071 ms
$21 to $86
149
Jev first
17 of 19
237 ms
9,882 ms
$8 to $9
98
19 of 30 questions had a fact check. Jev first sent 19 of 30 to System 1. The high LLM cost includes 3 cache-write outliers. Synthetic questions, one run, list prices.

### Speaker notes

Say: "We wrote 100 attendee questions and labeled each one: the intent, the right ticket, and the facts that a right answer must contain. We tuned on 70. We ran these 30 once, at the end."
"19 questions had facts that a right answer must contain. Both paths got 17 of those 19 right. The other 11, for example the emails, had no automatic check."
"So this is not a story about accuracy. With the whole guide in its prompt, the LLM knows the facts too. The difference is speed, cost, and length."
"The median is the typical question: 237 milliseconds against 5.3 seconds. The p95 of the Jev-first path is still 10 seconds, because 11 questions went to the LLM. You do not remove the slow path. You use it less."
The misses, if asked. Jev first, q098, "director of eng who wants networking with execs, which ticket": Jev picked General Admission plus an application to the Executive Summit. The label says Gold. Its probability was 1. "A probability of 1 is not proof. The code sent that answer with no check." Two other misses, on both paths, are a strict string check: the LLM wrote the right dates in a different form.
How we chose the thresholds: on the 70 tune questions, the pair 0.7 and 0.2 gave 41 right System 1 answers and 0 wrong ones. Any lower threshold added a wrong answer. One fact question in this run (q045, probability 0.51) went to the LLM, which answered it correctly.
Cost: the LLM cost is the list price that Claude Code reports. Three LLM-only calls wrote 114,000 to 209,000 tokens to the prompt cache and cost $2.03 together. Without them, the ratio is 2.6 times, not 10. So say "lower", and give the range. The benchmark now runs the two paths in random order, because the first path paid more cache writes. A Jev request is about 1,360 tokens, at $0.042 for each million.
Limits: synthetic questions, one guide snapshot, one LLM, one run. One question is 3.3 points. Full write-up: docs/research/ask-agent-ab.md.
Bridge: "Now it is your turn. You get two practice fields."


## Slide 36 (section 6)

### On the slide

Build time · Watch it play
Jev plus a code planner clears the maze.
[VIDEO: media/maze-teaser.mp4]
A chosen game (seed 5003, 0 lives lost), shown at 2x. Typical result on 30 held-out games: 28 wins. Full speed: media/maze-full.mp4.

### Speaker notes

Say: "Here is what you will build on. The panel on the right shows each decision: JEV means Jev chose, SYSTEM 2 means the code planner took a hard move, CODE means a corridor with one way forward."
Say plainly that this is a chosen game: "We picked a clean win to show. On 30 new games, this version won 28."
Bridge: "Now your turn."


## Slide 37 (section 6)

### On the slide

Build time
Build time: practice on a game.
[IMAGE: RenderMaze with the Jev panel. The panel shows an OVERRIDE decision, the probability bars for left and right, and the state sent to Jev.]
Code counts the steps to each blocker.
Jev picks a direction at each intersection.
On new games, our best question won 6 of 30.
With a code planner for the hard 1 in 5 moves: 28 of 30.

### Speaker notes

Say: "RenderMaze is a Pac-Man style game. A runner collects 159 items and must not touch 5 blockers; it has 3 lives. At each intersection, code sends Jev the facts for each legal direction: the steps to the nearest item, blocker, and power pellet. Jev picks a direction. Code checks the answer and moves the runner."
The labels on the panel: JEV means Jev decided. FALLBACK means code decided, because the request failed or the confidence was below 0.2. CODE means a corridor with only one way forward. OVERRIDE means your own code changed Jev's move.
Say: "Our first question listed the facts but no priority. It won 6 of 30 games. Our first fix, priority words only, did not help on varied games: 4 of 28. What helped was two things together: one ranked list of rules, with a tie-break, and facts that code calculates, for example 'this blocker moves toward the runner'. That version won 15 of 30. When we also let code mark which direction has the farthest blocker, so that Jev did not compare numbers, it won 20 of 30."
The statistics, if asked: all versions played the same 30 seeds, so we compare game against game. Level 2d won 15 seeds that the first question lost, and lost only 1 that the first question won (exact McNemar p = 0.001). Level 2c against the first question: p = 0.035. Level 2d against level 2c, and level 2d against code only: not significant at 30 games.
Say the mistake openly, because it is a lesson: "Our first measurements used one fixed seed. The maze is almost deterministic, so 20 games were a few routes repeated. Those runs said 90 percent. On varied games it was 67 percent, and words-only fell from 54 to 14. On new games that we did not tune on, it was 20 percent. Test question changes on varied inputs."
And the warning: "We changed one more sentence, about the end of power mode. That version won 2 of 30. The new text changed Jev's first move at the start tile from down to right, and that route ends in a trap. One sentence can break a question that works. Measure every change."
Say the second mistake openly too: "We tuned those questions on the same 30 games that we scored them on. Then we played 30 new games. Level 2d fell from 20 wins to 6, the same as the first question. Keep a held-out set, and score on it once."
Say the System 1 to System 2 result: "Then we added a System 2. When Jev was unsure, below 0.5 confidence, or every direction had a blocker near, code handed the move to a slower step. That was about 1 move in 5. A code planner that looks 8 steps ahead took level 2d from 6 wins to 28 of 30 on the new games. An LLM in the same place won 13, and took about 5 seconds for each move. In that time the runner crosses about 33 tiles, so it works only when the game waits."
Code only, the plain rule "avoid a blocker 3 steps or fewer away, else go to the nearest item", won 26 of 29 new games. Jev with the code planner is level with it (28 of 30, p = 1.000). The maze is mostly numbers, so this fits slide 32.
The statistics, if asked. Seeds 1000 to 1029 (tuning): first question 6 of 30; level 2c 15; level 2d 20; code only 23. Seeds 5000 to 5029 (held out): first question 7 of 30; level 2c 12; level 2d 6; level 2d with the code planner 28; level 2d with the LLM 13; code only 26 of 29. Planner against level 2d: 22 seeds to 0, exact p < 0.001. Planner against LLM: 16 to 1, p < 0.001. Details: docs/research/question-design-finding.md.
Bridge: "Here is what to change, in each track."


## Slide 38 (section 6)

### On the slide

Your turn
Change the question, measure it, and keep the better version.
Track A · The maze
Track B · Attendee questions
1 · Words
Rewrite the text for each direction
Rewrite an intent in INTENT_CRITERIA
2 · Facts
Add a fact that code calculates
Add a fact and its template
3 · Rule
Ask a danger Score, and change combine()
Change the route thresholds
4 · Strategy
Ask a Noul: go for the power pellet now?
Ask a Noul: does this question need a person?
Setup: npm install · Jev key in .env as TYPESAFE_API_KEY · npm run dev · /?jev=1 · a 20-game bench costs under $0.15
A: src/jev/questions.js · npm run bench -- --games 20 --seed 1000 · B: node scripts/ask-bench.mjs --split tune --llm off

### Speaker notes

Say: "Pick one track. Both use the same four rules from this talk."
Track A, the maze: everything is in one file, src/jev/questions.js. Level 1 is rule one: the words. Level 2 is rule two: a fact that code calculates. Level 3 is rules three and four: a narrow question, and a rule in code. Level 4 is a yes or no strategy question. After each change, run the benchmark. Use --seed so that each version plays the same varied games, and use at least 20 games: a difference of one or two wins can be chance. A stretch goal: beat the code-only policy.
Track B, attendee questions: the Jev request is in src/ask/core/system1.js, and the answers are in src/ask/core/templates.js. Run the tune split with --llm off: it calls Jev only, takes about a minute, and costs well under one cent. It prints the intent accuracy and how many questions go to System 2. Do not tune on the held-out split. Run it once, at the end, if you want a fair number.
"In both tracks, measure every change. One sentence can break a question that works."
Bridge: go to the last slide and leave it up for the whole hack.


## Slide 39 (section 6)

### On the slide

What you know now
Jev answers a fixed-option question about text with probabilities, like a classifier whose labels you write.
It does not write, count, or compare dates. Its confidence cannot see a missing rule. Images are new and experimental: test them the same way.
Code owns the workflow. Write the exact condition, test on your own data, and use plain code where code is enough.
Now change the question.
Track A: the maze · Track B: attendee questions
William MJ Hill · @emjay_hill

### Speaker notes

Leave this slide up through questions and the whole build time. Do not replace it with "Questions?" or "Thank you".
Say: "At the start, I promised that you would know when to use Jev, when to use something else, and how to write a question that it answers well. Now test it. Start with the words."
