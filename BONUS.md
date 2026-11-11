# BONUS.md

Defects in the question bank that were not reported by students, discovered through the Fixd sweep.

## How they were found

* Static checks across all 43 questions: literal facts about stored content including leaked markup, exam reference tags, and empty option labels.
* Secondary issues noticed by the triage engine during analysis of reported questions.
* Comprehensive sweep of unreported questions with dual blind solves and report free triage.
* Every finding must pass the scope guard and verified by faculty review.

## Confirmed (2)

| Question | Where | Repair | Edit | Evidence |
|:---|:---|:---|:---|:---|
| `SecAQ6` | Physics · Electrostatics | `option_repair` | ` <br />` → `` | Confirmed option C is completely blank in stored record |
| `nQM6UGBK-` | Botany · Morphology of Flowering Plants | `exam_reference` | `(NEET 2019)` → `` | Confirmed exam tag (NEET 2019) leaked into question stem |

## Candidates for faculty review (0)

Passed the scope guard, awaiting faculty confirmation:

_None._
