# BONUS.md

Defects in the data that **no student reported**, found by `npm run sweep` and written by `npm run bonus`. Nothing here is hand edited.

## How they were found

* **Static checks** over all 43 questions: leaked LaTeX, stray MathML alignment markers, exam tags, blank or duplicate options, malformed keys.
* **Noticed while triaging**: defects the triage model saw on a reported question that the report itself was not about.
* **Sweep** of the 1 questions nobody reported: two blind solves plus report free triage.

Every edit went through the same scope guard as the main pipeline. **Verified** means the guard passed and confidence is at least 0.85, or it is a certain static fact. **Candidates** need a faculty decision (editorial calls such as chapter, or edits the guard could not confirm).

## Verified (18)

| Question | Topic | Where | Repair | Edit | Evidence |
|:---|:---|:---|:---|:---|:---|
| `uiKqpBTMj` | Zoology · Biotechnology and its Applications | reported question, different defect | `spelling` | `riceis` → `rice is` | Words run together: 'riceis' should be 'rice is'. |
| `uiKqpBTMj` | Zoology · Biotechnology and its Applications | reported question, different defect | `spelling` | `producebeta-carotene` → `produce beta-carotene` | Words run together: 'producebeta-carotene' should be 'produce beta-carotene'. |
| `uiKqpBTMj` | Zoology · Biotechnology and its Applications | reported question, different defect | `spelling` | `ofvitamin` → `of vitamin` | Words run together: 'ofvitamin' should be 'of vitamin'. |
| `uiKqpBTMj` | Zoology · Biotechnology and its Applications | reported question, different defect | `spelling` | `helpprevent` → `help prevent` | Words run together: 'helpprevent' should be 'help prevent'. |
| `uiKqpBTMj` | Zoology · Biotechnology and its Applications | reported question, different defect | `spelling` | `tonight blindness` → `to night blindness` | Words run together: 'tonight blindness' should be 'to night blindness'. |
| `SecAQ5` | Physics · Photoelectric effect and matter waves | reported question, different defect | `markup_leak` | `<mi>K</mi><mi>&</mi><mo>&#x0003D;</mo><mfrac><mro…` → `<mi>K</mi><mo>&#x0003D;</mo><mfrac><mrow><mn>1.57…` | Stray LaTeX alignment marker '&' leaked into the MathML expression. |
| `pbMm2pKu_` | Physics · Photoelectric effect and matter waves | reported question, different defect | `markup_leak` | `\AA` → `Å` | markup_leak: raw LaTeX visible: \AA |
| `SecAQ3` | Physics · Mathematics in physics | reported question, different defect | `wrong_chapter` | faculty decision | The question is about radioactive decay and mean life, which belongs to the chapter 'Nuclei' rather than 'Mathematics in physics'. |
| `a3e579` | Zoology · Chemical Coordination and Integration | reported question, different defect | `notation` | `(C) Aldosterone Atrial Natriuretic Factor` → `(C) Aldosterone - Atrial Natriuretic Factor` | Missing hyphen/separator between the pair of hormones in option (C). |
| `ooPnTRb-EH` | Zoology · Evolution | reported question, different defect | `spelling` | `wheater` → `whether` | Spelling mistake: 'wheater' instead of 'whether'. |
| `SecAQ14` | Physics · Geometrical optics and optical instruments | nobody reported this question | `spelling` | `<mtext> eqcu </mtext>` → `<mtext> each </mtext>` | Misspelling of subscript 'each' as 'eqcu' |
| `SecAQ14` | Physics · Geometrical optics and optical instruments | nobody reported this question | `spelling` | `<mtext> eqch </mtext>` → `<mtext> each </mtext>` | Misspelling of subscript 'each' as 'eqch' |
| `MHCET_BvpWWm7z2cY7YB0TjCzV_PHY_150` | Physics · AC Circuits | reported question, different defect | `markup_leak` | `<mi>&amp;</mi><mi>P</mi>` → `<mi>P</mi>` | Remove stray LaTeX alignment marker '&' leaked into MathML |
| `F-eZtasNL` | Physics · Properties of matter and fluid mechanics | reported question, different defect | `spelling` | `hemispherial` → `hemispherical` | "hemispherial" is a misspelling of "hemispherical". |
| `nQM6UGBK-` | Botany · Morphology of Flowering Plants | reported question, different defect | `spelling` | `of<span style="color:#000000">leaf` → `of <span style="color:#000000">leaf` | Add missing space between 'of' and 'leaf'. |
| `jxJrYy6ka` | Physics · Centre of mass and momentum conservation (collision) | reported question, different defect | `markup_leak` | `<msub><mi>v</mi><mrow><mrow><mi mathvariant="norm…` → `<msub><mi>v</mi><mrow><mrow><mi mathvariant="norm…` | Remove stray LaTeX alignment marker '&' leaked into MathML as <mi>&</mi>. |
| `MHCET_gNlzG0ZcBlNSzwBSMUak_PHY_129` | Physics · Oscillations | reported question, different defect | `notation` | `<mo>&minus;</mo><mfrac><mrow><mi> d </mi><mi> x <…` → `<mo>=</mo><mfrac><mrow><mi> d </mi><mi> x </mi></…` | Equals signs were replaced by minus signs in the expression for velocity. |
| `nQM6UGBK-` | Botany · Morphology of Flowering Plants | reported question, different defect | `spelling` | `part of<span style="color:#000000">leaf` → `part of <span style="color:#000000">leaf` | Missing space between 'of' and 'leaf'. |

## Candidates for faculty (0)

_None._

## Refused by the guard (4)

Proposed by the model, blocked by code. Listed for transparency; none of these would be applied.

| Question | Topic | Where | Repair | Edit | Evidence |
|:---|:---|:---|:---|:---|:---|
| `20c422` | Physics · Temperature and thermal properties of matter | reported question, different defect | `spelling` | `It&rsquo;s` → `Its` | 'It’s' is a contraction of 'it is'; the possessive form 'Its' is required here. |
| `jxJrYy6ka` | Physics · Centre of mass and momentum conservation (collision) | reported question, different defect | `markup_leak` | `<mi>&</mi>` → `(removed)` | LaTeX alignment ampersand leaked into MathML solution |
| `MHCET_BvpWWm7z2cY7YB0TjCzV_PHY_150` | Physics · AC Circuits | reported question, different defect | `markup_leak` | `<mi>&amp;</mi>P` → `<mi>P</mi>` | Remove stray LaTeX table alignment character rendering as '&' |
| `MHCET_BvpWWm7z2cY7YB0TjCzV_PHY_150` | Physics · AC Circuits | reported question, different defect | `markup_leak` | `<mi>&amp;</mi>ϕ` → `<mi>ϕ</mi>` | Remove stray LaTeX table alignment character rendering as '&' |
