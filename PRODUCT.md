# PRODUCT.md

## Who loses the most when a question is broken

**The student who trusted the key and never reported it.** The reporter noticed. The quiet student two days later solves it correctly, is marked wrong, and *changes a correct method to match a wrong key*. A broken key does not just cost marks; it teaches wrong physics, at scale, to the students least likely to push back. The second loser is faculty time spent reading "wrong" and "asdfgh" instead of fixing what is actually broken.

How Fixd reflects this:

* **Ordered by harm, not arrival.** Severity × students affected × age, so a wrong key outranks ten reports of one typo, and ten reports of one question are one case.
* **Fixes that are provably safe go live without waiting**, because every hour a wrong key stays up it marks more correct students wrong.
* **Every reporter gets a real answer** in their own language: "fixed", "a teacher is checking", or the exact step they missed. Never silence, never a promise that is not true.
* **The quiet student is protected too:** a sweep and proofreader find defects nobody reported (18 in this data set).

## What the AI will never auto apply

| Never auto applied | Why |
|:---|:---|
| An answer key change without **three way agreement** (two blind solves by different methods, and the stored solution) | Changing the correct option changes every student's score. One model's opinion is not evidence enough. |
| Any answer key change on recall subjects (biology facts) | Nothing to compute, so two solves can share the same wrong memory. |
| Anything that changes the physics of a question: conditions, formulas, diagrams, swapping the question | Needs an accountable human. The one exception is a stem value the stored solution states outright **and** that makes the repaired question solve to the key. |
| Chapter, syllabus, unsound or wrong question calls | Editorial judgement, not error correction. |
| Anything a flagged comment drove, anything the scope guard refuses, anything under 0.85 confidence after evidence checks | When the system is unsure, a human is the cheapest insurance. |

What does auto apply is local, verifiable and reversible: a wrong key with three way agreement, a stray "(NEET 2019)", a leaked `\frac`, a misspelling, a missing unit. All of it lands in the **AI fixed** lane as a new version with an audit entry, one key to revert.

## The one metric for week 1

**Auto fix revert rate:** reverted AI fixes ÷ AI applied fixes. Target under 2%.

It is the single number that says whether auto apply has earned trust, and the API already reports it live (`GET /api/stats` → `autoFixRevertRate`). If it climbs, the confidence bar goes up and that repair type goes back to human review the same day. Time to fix and faculty hours saved only matter once this is near zero.

## One idea beyond the brief: Silent Defect Radar

Stop waiting for reports. Acadza already has every attempt on every question. When strong students (high overall accuracy) pick C far more often than the keyed B, **the key is probably wrong**, and the data knows before anyone types "ans galat hai". Radar ranks the bank by that disagreement, sends the top questions through the same Fixd pipeline, and closes the loop once a key is fixed: **regrade every past attempt and tell each affected student their score went up.** A broken question stops being a silent tax on lakhs of students and becomes a visible moment where Acadza did right by them.
