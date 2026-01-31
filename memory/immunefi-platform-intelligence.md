# IMMUNEFI PLATFORM INTELLIGENCE
*Topic: Immunefi Platform Rules & Triage Behavior*  
*Priority: High | Scope: Global*  
*Auto-apply when user references Immunefi, bug bounty, or vulnerability submission work*

## TRIAGE PROCESS & REJECTION PATTERNS

### 1. FIRST-PASS FORMAT GATE
Immunefi uses a **FIRST-PASS FORMAT GATE** before evaluating exploit substance. Format failures = immediate rejection regardless of vulnerability validity.

### 2. COMMON AUTOMATIC REJECTION REASONS
- **Missing or mislabeled required sections** (structure non-compliance)
- **Impact framed theoretically instead of practically** (hypothetical vs. demonstrable)
- **Severity label not aligned with demonstrated impact** (classification mismatch)
- **Non-reproducible or assumption-heavy PoCs** (theoretical demonstrations)

### 3. DOS/AVAILABILITY REPORT SCRUTINY
DoS/Availability reports receive **enhanced scrutiny** for:
- **Clear attacker model** (who can trigger, how, when)
- **Demonstrated real-world impact** (not just degradation/slowdown)
- **Explicit reproducibility steps** (executable instructions)

## REPORT STRUCTURE & FRAMING

### 4. IMPACT-FIRST APPROACH
Immunefi favors **IMPACT-FIRST framing** over root-cause-first explanations:
- Title emphasizes consequences, not technical mechanism
- Impact section quantifies operational/financial effects
- Root cause explanation supports impact claims

### 5. REQUIRED REPORT STRUCTURE
**Program-dependent** but typically includes:
- **Title** (Vulnerability + Impact)
- **Summary/Brief** (One paragraph overview)
- **Description** (Often multi-subsection: Brief/Vulnerability/Impact/References)
- **Impact Details** (Quantified consequences)
- **Proof of Concept** (Executable demonstration)
- **Mitigation/Recommendation** (Fix suggestions)

### 6. SEVERITY CLASSIFICATION RULES
- **Must strictly match demonstrated consequences**
- **Mislabeling severity = common rejection trigger** (even for valid vulnerabilities)
- **Program-specific impact classifications** override generic severity guidelines

## AI ASSISTANCE & ORIGINALITY

### 7. AI DISCLOSURE POLICY
- **AI assistance disclosure NOT globally required** by Immunefi
- **Do NOT volunteer AI usage** unless specific program explicitly requests it
- **Originality and clarity matter** more than authorship method

### 8. ACKNOWLEDGMENT REQUIREMENTS
- **Some programs require originality/good-faith acknowledgment**
- **Safe default language available** when required
- **Use only when program explicitly requests** acknowledgment section

## TRIAGE PRIORITIES

### 9. EVALUATION HIERARCHY
Triagers prioritize:
1. **Clarity** (easy to understand and follow)
2. **Reproducibility** (executable without assumptions)
3. **Scope alignment** (matches program's in-scope impacts)
4. **Technical accuracy** (correct vulnerability analysis)

**Stylistic polish is secondary** to substance and structure.

## STRATEGIC INSIGHTS

### 10. SUCCESS FACTORS
- **Format compliance** gates technical evaluation
- **Impact quantification** drives severity classification
- **Executable demonstrations** prove reality over theory  
- **Program-specific alignment** prevents scope rejections
- **Clear causality chains** (technical flaw → operational impact)

---

*Gathered through comprehensive analysis and submission experience*  
*Apply automatically for all Immunefi-related work*