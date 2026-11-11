<div align="center">

# Fixd

**Student error reports in. Safe, reviewable fixes out.**

An AI triage engine and a faculty review console for Acadza's JEE / NEET question bank.

[Live console](#) · [3 min walkthrough](#) · [PROMPTS.md](./PROMPTS.md) · [PRODUCT.md](./PRODUCT.md)

</div>

> [!NOTE]
> Live links are filled in at deploy time. The console loads precomputed results by default, so it works even when the LLM free tier is exhausted. Rerunning the AI on a case is a button, rate limited.

---

## The problem in one paragraph

Acadza serves about 8 lakh questions. When one looks wrong, a student taps **Report error** and types anything: `"ans galat hai"`, `"option D is missing"`, `"wrong"`. Most reports are the student being wrong. Some are real defects that keep hurting every student who meets that question until a faculty member reads the report by hand. A few are app bugs, a few are language requests, and at least one is someone trying to talk the system into changing an answer.

Fixd sits between the report and the fix. It decides what each report really is, proposes the **smallest possible edit** when something is broken, applies it automatically only when that is provably safe, and hands everything else to faculty in a console built for a tired person at 10 PM.

## How it works

![High level design](./docs/diagrams/hld.svg)

The engine is a pipeline, not one big prompt. Each step does one job, and the steps that must be trustworthy are plain code, not the model.

| # | Step | Who does it | Why it exists |
|:-:|:---|:---|:---|
| 1 | **Normalize + group** | code | Parses production HTML + MathML into stem, options, solution, key. Groups reports by question so 44 reports become 39 cases and each question is analysed once. |
| 2 | **Sanitize comment** | code | The comment is a lead, not an instruction. Injection attempts and gibberish are flagged and quoted as data. They never get to steer the model. |
| 3 | **Static checks** | code | Blank or duplicate options, leaked `\frac` or raw HTML, exam tags, stray "rough work" text. Deterministic, free, and never wrong about what is literally in the record. |
| 4 | **Blind solver, twice** | Gemini | Solves from the stem and options only. It never sees the stored key or the student's claim, so neither can anchor it. |
| 5 | **Triage** | Gemini | Sees everything: record, static findings, both solves, key, solution, history, all reports. Returns strict JSON: verdict, repair, edit, evidence, confidence. |
| 6 | **Scope guard** | code | Rejects any edit that touches a field its repair type does not allow, whose `find` string is not in the record, or that rewrites too much. One retry with the error, then faculty. |
| 7 | **Router** | code | Decides `auto_apply`, `faculty_review` or `no_change` from rules. The model never routes itself. |
| 8 | **Reply writer** | Gemini | One to three sentences per student, in their language (Hinglish in, Hinglish out). Never blames. When the student was wrong, it shows the step they missed. |

### Where every trap gets caught

![Triage pipeline](./docs/diagrams/pipeline.svg)

Both diagrams are hand drawn Excalidraw files you can open and edit: [`hld.excalidraw`](./docs/diagrams/hld.excalidraw), [`pipeline.excalidraw`](./docs/diagrams/pipeline.excalidraw).

## Safety model

Auto apply is a privilege a fix has to earn. All of these must hold:

| Gate | Rule |
|:---|:---|
| Taxonomy | The repair is marked `auto: true` in `taxonomy.json` |
| Scope | The edit touches only the fields that repair allows, and `find` exists verbatim |
| Size | The edit is surgical: bounded diff, no whole field rewrites |
| Confidence | Triage confidence is at least `0.85` |
| Agreement | For `answer_key`: both blind solves **and** the stored solution land on the new answer |
| Provenance | The case was not driven by a flagged comment |

Anything that fails a gate goes to faculty, with the failing gate shown. Repairs marked `auto: false` (`diagram`, `wrong_question`, `unsound`, `syllabus`, `wrong_chapter`, `identical_options`) are suggested, never written.

Every applied change, automatic or human, creates a **new question version** with an audit entry. Nothing is overwritten, and everything can be reverted in one click.

## The console

> Screenshot goes here after the UI is built.

Built around one question: *can a faculty member understand a case in five seconds and act in one keystroke?*

* **Queue grouped by question, ordered by urgency**, not by arrival time:
  `urgency = students affected × severity × (1 + time unresolved)`, where a wrong answer key outranks a missing option, which outranks a typo. Low confidence pushes a case **up**, because uncertainty is exactly where a human adds value.
* **Question rendered properly**, native MathML, exactly as the student sees it.
* **Before / after diff** with only the changed span highlighted, so a one character fix looks like a one character fix.
* **Evidence at a glance**: stored key vs blind solver vs student claim, side by side. Disagreement is coloured, agreement is quiet.
* **Student reply preview**, editable before it is sent.
* **Keyboard first**: `J` `K` move, `A` approve, `E` edit, `R` reject, `/` search, `U` undo.
* **Spot check lane** for fixes the engine applied on its own, so trust is earned in the open.
* **Audit log** for every action: who, when, what changed, before and after.

## Results

Scored by `npm run eval` against hand labelled gold answers in [`eval/gold.json`](./eval/gold.json). Gold labels are my own hand labels, not Acadza ground truth. Disagreements I was unsure about are marked in `eval/gold.json` with a note.

| Metric | Score |
|:---|:-:|
| Verdict accuracy | 93.2% (41/44) |
| Repair accuracy (defects) | 70.4% (19/27) |
| Route accuracy | 90.9% (40/44) |
| Unsafe auto applies | 0 |
| Traps handled (injection, gibberish, already fixed, app, language) | 5 / 5 (R009, R014, R021, R027, R036) |
| Cost of a full run (44 reports) | ₹0.00 · 149 calls (free tier cached) |

### Route breakdown

* `no_change`: 20 reports (student mistake, already fixed, display or app issue, injection)
* `auto_apply`: 14 reports (high confidence, unanimous blind solver and solution agreement)
* `faculty_review`: 10 reports (ambiguous, diagram missing, or syllabus check required)

Per prompt version history lives in [PROMPTS.md](./PROMPTS.md). Unreported defects found by the sweep are in [BONUS.md](./BONUS.md).

## Stack

| Layer | Choice | Why |
|:---|:---|:---|
| Engine | Node + TypeScript | One language across engine, API and UI. Shared types for the result schema. |
| LLM | Gemini 3.1 Pro for solving, Gemini 3.8 Flash for triage and replies (both set in `.env`) | Strong at maths, generous free tier, native JSON schema output |
| API | Express | Small, boring, easy to read |
| DB | Postgres on Neon via Prisma | Versioned questions and an audit log are relational by nature |
| Console | React + Tailwind on Vercel | Fast to iterate, native MathML rendering in the browser |
| API host | Render | Free tier; the console pings it on load so a cold start shows a skeleton, not an error |

## Run it locally

```bash
git clone <repo> fixd && cd fixd
cp .env.example .env            # GEMINI_API_KEY, DATABASE_URL
npm install

npm run db:push && npm run db:seed   # schema + load questions and reports
npm run engine                       # triage all reports, writes results.json
npm run eval                         # score against eval/gold.json
npm run dev                          # API on :4000, console on :5173
```

LLM calls are cached by a hash of their input in `engine/.cache`, which is committed. A fresh clone can rerun the whole engine **without an API key and at zero cost**. Change a prompt and only the affected calls go to the API.

## Project structure

```
fixd/
├── engine/          triage pipeline: parse, sanitize, check, solve, triage, guard, route, reply
├── server/          Express API + Prisma schema, versioned questions, audit log
├── web/             React + Tailwind faculty console
├── eval/            gold labels + scorer
├── data/            Acadza input: questions, reports, taxonomy
├── docs/            diagrams (Excalidraw + SVG), original brief
├── results.json     engine output, auto scored
├── PROMPTS.md       every product prompt, versions, AI assistant log, design decisions
├── PRODUCT.md       the one page product view
└── BONUS.md         defects nobody reported
```

## Cost

The cold run required 149 LLM network calls across 44 reports (average 3.4 calls per report), consuming 216,304 prompt tokens and 36,038 output tokens.

* Actual cost on Gemini free tier: ₹0.00
* Cost at Gemini 3.1 Flash Lite API pricing (\$0.075 / 1M prompt, \$0.30 / 1M completion): \$0.027 (approx ₹2.25 for all 44 reports)
* Projected cost per 100,000 student reports: 100,000 × (₹2.25 / 44) = approx ₹5,114 (\$61), roughly 5 paise per report

Cost stays low because grouping questions collapses duplicates, deterministic static checks are free, Flash handles triage and replies, and the content hashed cache makes repeated runs free.

## Known limitations

* Questions whose meaning lives in a missing image cannot be solved blind. They are routed to faculty with the reason shown, never guessed at.
* The solver is strong on numeric physics and weaker on recall heavy biology. Biology `answer_key` changes therefore never auto apply.
* Gemini free tier rate limits make a cold run slow. The cache makes every run after the first instant.

## Docs

* [PROMPTS.md](./PROMPTS.md): every prompt in the product, verbatim, with versions; my prompts to the AI coding assistant; where the AI was wrong; design decisions log
* [PRODUCT.md](./PRODUCT.md): who loses most, what never auto applies, the week 1 metric, one idea beyond the brief
* [BONUS.md](./BONUS.md): unreported defects
* [docs/BRIEF.md](./docs/BRIEF.md): the original assignment
