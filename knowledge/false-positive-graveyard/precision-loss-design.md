# False Positive: Precision Loss as Vulnerability

## The Mistake
Almost submitted SSV Network "precision loss" as a vulnerability.

## Why It Looked Real
- Cannot set fees below 10M wei (0.00000001 ETH)
- Appeared to be unintended limitation
- Could affect operators wanting micro-fees

## Why It Wasn't Exploitable
**Intentional design choice**, explicitly tested by Quantstamp auditors.
- 10M wei minimum is documented behavior
- Prevents dust attacks and gas waste
- No fund loss, just a design constraint

## Prevention Rule
**BEFORE claiming precision/rounding issues:**
1. Check if it's documented behavior
2. Check if auditors explicitly reviewed it
3. Ask: "Does this cause fund loss or just inconvenience?"
4. Design choices are NOT vulnerabilities

## Impact of Submission
- Would have damaged WhiteRabbit credibility
- Would have wasted Immunefi triager time
- Would have marked us as low-quality researchers

## Verification Checklist Added
- [ ] Verified this isn't documented design behavior
- [ ] Confirmed actual fund loss (not just inconvenience)
- [ ] Checked if previous audits reviewed this

## Golden Rule
**Quality over quantity - one real finding better than ten design complaints.**

---
*Documented: 2026-01-30*
