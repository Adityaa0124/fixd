# PRODUCT.md

## Who loses the most when a question is broken

**The student who trusted the key and never reported it.**

The student who reports is fine: they noticed. The one who loses is the quiet student two days later who solves it correctly, gets marked wrong, and *changes their correct method to match the wrong key*. A wrong answer key does not just cost marks. It teaches wrong physics, at scale, to the students least likely to push back. The second loser is faculty time: hours spent reading "wrong" and "asdfgh" instead of fixing the questions that are actually broken.

**How Fixd reflects this**

* **Urgency is ordered by harm, not by arrival.** A wrong key on a question many students met outranks a typo with ten reports. Ten reports of the same typo are one case, not ten.
* **Every reporter gets a real answer.** When the student is right, they hear "fixed" or "a teacher is checking it", never silence. When they are wrong, the reply shows the step they missed, because a reporting student who was wrong is still a student who wants to learn.
* **Fixes are versioned, not overwritten.** Every change can be traced and reverted, so moving fast on real defects never makes the bank less trustworthy.
* **Defects nobody reported are hunted too** (the sweep), because the quiet student never files a report.

## What the AI will never auto apply

| Never auto applied | Why |
|:---|:---|
| An answer key change without **three way agreement**: two blind solves and the stored solution | Changing which option is "correct" changes every student's score. One model's opinion is not enough evidence for that. |
| Any answer key change on recall based questions (biology facts) | There is no computation to cross check. Two confident solves can share the same wrong memory. |
| Anything triggered by a comment that tried to give instructions | A student must never be able to steer the bank, even if the edit looks harmless. |
| Any change to the physics of a question: altering conditions, formulas, diagrams, or swapping the question | Edits that change the physics need someone accountable to sign off. Never change the physics. Missing stem values that the stored solution states clearly are verifiable and exempt. |
| Chapter, syllabus, "unsound question" or "wrong question" calls | These are editorial judgement, not error correction. |
| Any edit the scope guard rejects, or below 0.85 confidence | When the system is unsure, a human is the cheapest insurance. |

What *does* auto apply is reversible, verifiable and local: a stray "(JEE Main 2019)" tag, a leaked `\frac`, "Space for rough work", a misspelling, a missing unit stated in the solution. Those still land in a **spot check lane**, so faculty can see what the AI did on its own.

## The one metric for week 1

**Auto fix revert rate:** the share of AI applied fixes that faculty later revert.

It is the one number that tells us whether auto apply has earned trust. Target under 2%. If it climbs, the threshold goes up and the offending repair type goes back to human review, the same day. Time to fix and faculty hours saved only matter if this one is near zero.

## One idea beyond the brief: Silent Defect Radar

Stop waiting for reports. Acadza already has every student's answer on every question. When strong students (high overall accuracy) pick option C far more often than the keyed option B, **the key is probably wrong**, and the data knows before anyone types "ans galat hai". Radar ranks the bank by that disagreement, sends the top questions through the same Fixd pipeline, and closes the loop once a key is fixed: **regrade every past attempt and tell each affected student** their score went up. That turns a broken question from a silent tax on lakhs of students into a visible moment where Acadza did right by them.
