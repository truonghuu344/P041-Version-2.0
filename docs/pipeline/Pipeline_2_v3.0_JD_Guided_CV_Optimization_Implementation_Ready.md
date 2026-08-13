# TECHNICAL SPECIFICATION — PIPELINE 2
## JD-Guided, Evidence-Preserving CV Generation, Optimization, CV Variants & Intelligent 1–2 Page Layout

**Version:** 3.0  
**Status:** Implementation-Ready Baseline  
**Scope:** Pipeline 2  
**Primary objective:** Tối ưu CV hiện có hoặc tạo CV mới theo target JD sau khi Candidate Evidence ↔ JD Requirements đã được match; AI được phép viết lại theo JD nhưng chỉ trong phạm vi Candidate Evidence đã được xác minh; tái sử dụng Pipeline 1 artifacts; không chạy lại parsing/embedding/matching toàn bộ; tự động chọn nội dung tốt nhất và render CV chuyên nghiệp 1–2 trang.

---

# 0. EXECUTIVE DECISIONS

```text
1. Matching chạy TRƯỚC Optimization.
2. Pipeline 2 không sở hữu Candidate Truth.
3. Shared Candidate Evidence Store là source of truth.
4. Pipeline 2 reuse Pipeline 1 Artifact Manifest.
5. Mode A: HAS CV + HAS JD → optimize.
6. Mode B: NO CV + HAS JD → template + form → evidence → match → generate.
7. HAS CV + NO JD không phải generation mode của Pipeline 2.
   CV được lưu ở Pipeline 1/Candidate Data Layer và chờ JD.
8. Agent chỉ nhận Generation Contract, không nhận quyền tự do dùng raw CV/JD.
9. JD guides emphasis, never candidate facts.
10. User confirmation may create new facts only through controlled write-back.
11. New verified facts trigger incremental rematch of affected requirements only.
12. Generated CV is a variant, never overwrite original CV.
13. Generated wording never automatically becomes candidate evidence.
14. LLM writes; deterministic validators approve.
15. CP-SAT selects content/variants under page budget.
16. Protected critical evidence cannot be removed to force one page.
17. 1 page preferred only if retention/readability gates pass; otherwise 2 pages.
18. Post-optimization score is stored separately from pre-optimization match.
```

# 1. BUSINESS JOURNEY

Recommended user flow:

```text
Upload/Select CV
+
Upload/Select JD
↓
Pipeline 1 Match
↓
Show:
Match Score
Strong Evidence
Partial Evidence
Missing Evidence
↓
[Optimize CV for this Job]
↓
Pipeline 2
↓
Optimized CV
↓
Optional Post-Optimization Evaluation
↓
Before / After
↓
Mock Interview
```

# 2. MODES

## MODE A — OPTIMIZE_EXISTING_CV

Requirements:

```text
candidate_id
job_id
original_cv_id
Pipeline 1 Artifact Manifest
PRE_OPTIMIZATION_MATCH
```

Flow:

```text
Reuse Pipeline 1
→ Candidate Evidence
→ JD Requirements
→ Match/Evidence/Gap
→ Content Planning
→ Generation Contract
→ Agent Rewrite
→ Claim Validation
→ Factuality Gate
→ Content Selection
→ Page Optimization
→ Layout/Render
→ Final CV Variant
```

## MODE B — CREATE_NEW_CV

Requirements:

```text
candidate_id
job_id
JD Artifact
template_id
Candidate Form
```

Flow:

```text
Template
+
Candidate Form
↓
Candidate Evidence Submission
↓
Shared Evidence Validation
↓
Candidate Evidence Store
↓
Match Candidate Evidence ↔ JD
↓
Gap Detection
↓
Ask User if critical clarification needed
↓
Incremental Evidence Update/Rematch
↓
Content Planning
↓
Generation Contract
↓
Agent Writes CV
↓
Validation
↓
1–2 Page Optimization
↓
Final CV Variant
```

# 3. CV + NO JD

If user only uploads CV:

```text
Pipeline 1
→ CV_READY
```

Pipeline 2:

```text
NO TARGET JD
→ do not run JD-guided optimization
```

UI may offer:

```text
Select/upload a target JD
```

Do not guess target role.

# 4. ABSOLUTE INVARIANTS

```text
JD ≠ Candidate Evidence
Skill Mention ≠ Experience
Participation ≠ Leadership
Plausible ≠ Supported
LLM Inference ≠ Candidate Fact
Generated CV ≠ Candidate Truth
No Fact → No Claim
No Provenance → No Publish
No Match Context → No JD Optimization
Page Limit Must Not Destroy Critical Evidence
```

# 5. SHARED DATA OWNERSHIP

```text
Shared Candidate Evidence Store
          ↑            ↓
     Pipeline 1    Pipeline 2
          ↓            ↓
          └──── Pipeline 3
```

Pipeline 2 may REQUEST fact creation.

Pipeline 2 cannot directly bless agent-generated facts.

# 6. INPUT — MODE A

Client/API:

```json
{
  "candidate_id": "CAND_001",
  "job_id": "JOB_001",
  "source_cv_id": "CV_001",
  "template_id": "TPL_001",
  "optimization": {
    "preferred_pages": "AUTO",
    "max_pages": 2
  }
}
```

Backend resolves:

```text
Artifact Manifest
Candidate Evidence latest version
Structured CV
Structured JD
JD Requirements
Match Result
Evidence Set
Gap Result
CV/JD index versions
```

# 7. INPUT — MODE B

```json
{
  "candidate_id": "CAND_001",
  "job_id": "JOB_001",
  "template_id": "TPL_002",
  "candidate_form_id": "FORM_001",
  "optimization": {
    "preferred_pages": "AUTO",
    "max_pages": 2
  }
}
```

# 8. WHAT PIPELINE 2 REUSES

Mode A must reuse:

```text
Structured CV
Normalized CV
Candidate Facts
Fact provenance
Entity scopes
Fact capabilities
CV chunks
CV vectors/index
Structured JD
Normalized JD
JD Atomic Requirements
JD vectors/index
Candidate–JD Evidence Mapping
Requirement Coverage
Match Result
Gap Result
```

# 9. WHAT PIPELINE 2 MUST NOT REPEAT

When artifact is compatible:

```text
NO CV parsing
NO JD parsing
NO full normalization
NO full CV chunking
NO full embedding
NO full CV↔JD matching
```

# 10. ARTIFACT COMPATIBILITY

Validate:

```text
candidate_id
job_id
candidate_evidence_version
source_cv_id
structured schema versions
embedding revision
match status
artifact freshness
```

If incompatible:

```text
request Pipeline 1 recomputation
```

Pipeline 2 must not silently use stale match.

# 11. CANDIDATE FORM

Mode B fields:

```text
Profile
Summary inputs
Skills
Experience
Projects
Education
Certifications
Languages
Achievements
Links
Preferences if relevant
```

Each field records:

```text
user_input
normalized_value
source_type=CANDIDATE_FORM
timestamp
```

# 12. USER CONFIRMATION

Use only for meaningful missing/partial evidence.

Bad:

```text
"Do you know AWS?"
Yes
```

This only authorizes weak skill knowledge at most.

For contextual experience ask:

```text
Where did you use AWS?
Which project/job?
What did you do?
Approximate period?
Which services?
```

Only confirmed details become scoped facts.

# 13. WRITE-BACK CONTRACT

```text
Pipeline 2 User Confirmation
↓
Candidate Evidence Mutation Request
↓
Shared Evidence Validator
↓
Commit Candidate Fact
↓
New Candidate Evidence Version
↓
Incremental Pipeline 1 Rematch
↓
New Match Artifact
↓
Pipeline 2 resumes
```

# 14. NO GENERATED-WORDING WRITE-BACK

Forbidden:

```text
Agent wrote:
"Designed scalable AWS infrastructure"

↓
create Candidate Fact
```

unless independently supported by user/source evidence.

# 15. CAREER GRAPH

Logical model:

```text
Candidate
├── Experience
│   └── Facts
├── Project
│   └── Facts
├── Education
│   └── Facts
└── Certification
    └── Facts
```

Can be implemented in PostgreSQL with relational IDs/FKs.

Neo4j not required for v1.

# 16. REQUIREMENT GRAPH

Reuse Pipeline 1 JD requirements.

Logical:

```text
Job
├── Mandatory Requirement
├── Preferred Requirement
├── Responsibility
├── Education
├── Domain
└── Other
```

# 17. CANDIDATE–JD MAPPING

Default:

```text
REUSE Pipeline 1 Match/Evidence
```

Only create additional mapping when new verified Candidate Facts require incremental rematch.

Statuses:

```text
SUPPORTED
PARTIAL
NOT_FOUND
CONFLICTING
```

# 18. GAP DETECTION

Gap is not a fact.

```text
JD_REQ AWS
Candidate Evidence NOT_FOUND
→ GAP
```

Does not mean:

```text
candidate definitely has no AWS
```

It means:

```text
no current evidence
```

# 19. GAP POLICY

For each gap:

```text
MANDATORY + potentially user-clarifiable
→ optionally ask user

MANDATORY + no evidence after clarification
→ keep as gap
→ do not add to CV

PREFERRED + no evidence
→ normally omit
```

# 20. CONTENT BLOCKS

Create candidate content blocks from verified facts.

Types:

```text
SUMMARY_BLOCK
SKILL_BLOCK
EXPERIENCE_BULLET
PROJECT_BULLET
EDUCATION_BLOCK
CERTIFICATION_BLOCK
LANGUAGE_BLOCK
ACHIEVEMENT_BLOCK
```

Schema:

```json
{
  "block_id": "BLOCK_001",
  "block_type": "EXPERIENCE_BULLET",
  "fact_ids": ["FACT_001", "FACT_002"],
  "entity_scope": {"experience_id": "EXP_001"},
  "jd_requirement_ids": ["REQ_001"],
  "protected": false
}
```

# 21. CONTENT UTILITY

Baseline:

```text
Utility_i =
0.30 * JDRelevance
+
0.20 * MandatoryCoverage
+
0.15 * EvidenceStrength
+
0.15 * Impact
+
0.10 * Recency
+
0.10 * Specificity
```

Each component:

```text
0..1
```

Weights versioned and benchmarked.

# 22. PROTECTED CONTENT

Protected if needed for:

```text
identity/contact essentials
recent core experience
mandatory JD evidence
critical project evidence
required education/certification
chronological coherence
```

Hard rule:

```text
Protected Content Retention = 100%
```

# 23. GENERATION CONTRACT

This is the ONLY factual writing contract for the Agent.

```json
{
  "generation_contract_id": "GC_001",

  "candidate_id": "CAND_001",
  "job_id": "JOB_001",

  "target_role": "Backend Engineer",

  "allowed_fact_ids": [
    "FACT_001",
    "FACT_005"
  ],

  "allowed_facts": [],

  "target_requirement_ids": [
    "REQ_001",
    "REQ_004"
  ],

  "safe_jd_terms": [
    "REST API",
    "PostgreSQL"
  ],

  "forbidden_candidate_claims": [
    "AWS experience",
    "Kubernetes experience"
  ],

  "selected_block_ids": [],

  "immutable_fields": [],

  "versions": {
    "candidate_evidence": 5,
    "match": 2,
    "contract": "GC_V1"
  }
}
```

# 24. AGENT DATA BOUNDARY

Agent receives:

```text
Generation Contract
Writing instructions
Template semantic constraints if needed
```

Agent must not receive unrestricted access to:

```text
raw CV
raw JD
whole Candidate Evidence DB
external web
unapproved company data
```

# 25. SYSTEM PROMPT CONTRACT

```text
You are a JD-Guided CV Optimization Agent.

The JD determines what should be emphasized.
Candidate Evidence determines what you are allowed to claim.

HARD RULES:
1. Use only allowed facts in GenerationContract.
2. Never turn JD requirements into candidate facts.
3. Never infer missing skill, technology, experience, project,
   responsibility, achievement, metric, title, certification,
   education, leadership, ownership or seniority.
4. Skill mention does not prove professional/project usage.
5. Participation does not prove leadership.
6. Do not create numeric impact.
7. Preserve immutable facts in meaning.
8. Every factual phrase must map to atomic claims with fact_ids.
9. Insufficient evidence → weaker wording or omit.
10. Tailor wording/emphasis to JD only when factual meaning remains supported.
11. Return structured output only.
```

# 26. AGENT OUTPUT

```json
{
  "blocks": [
    {
      "block_id": "BLOCK_001",
      "variants": {
        "LONG": "...",
        "MEDIUM": "...",
        "SHORT": "..."
      },
      "atomic_claims": []
    }
  ]
}
```

# 27. LONG / MEDIUM / SHORT

All variants must preserve:

```text
same factual meaning
same entity scope
same fact_ids
same ownership/seniority
```

Purpose:

```text
generate once
→ page optimizer selects variant
```

instead of repeatedly asking LLM to rewrite entire CV.

# 28. ATOMIC CLAIMS

Example:

```json
{
  "claim_id": "CLAIM_001",
  "claim_type": "EXPERIENCE_TECH_USAGE",
  "claim_text": "Used PostgreSQL",
  "fact_ids": ["FACT_012"],
  "entity_scope": {
    "experience_id": "EXP_001"
  }
}
```

# 29. DETERMINISTIC CLAIM VALIDATORS

Run first:

```text
FactIdValidator
CandidateIsolationValidator
SourceTypeValidator
GenerationContractValidator
EntityScopeValidator
ClaimCapabilityValidator
SkillEquivalenceValidator
MetricValidator
DateValidator
JobTitleValidator
SeniorityValidator
OwnershipEscalationValidator
JDLeakageValidator
ImmutableFactValidator
```

# 30. SEMANTIC ENTAILMENT

Input:

```text
one atomic claim
+
only referenced facts
```

Output:

```text
ENTAILED
NOT_ENTAILED
UNCERTAIN
```

`NOT_ENTAILED` / `UNCERTAIN` cannot publish without resolution.

# 31. JD LEAKAGE

Example:

```text
JD: Kubernetes required
Candidate: no Kubernetes evidence
Generated CV: "Experienced with Kubernetes"
→ BLOCK
```

# 32. SKILL ESCALATION

```text
Skill list says Docker
Generated:
"Deployed production systems with Docker"
→ BLOCK unless scoped usage evidence exists
```

# 33. OWNERSHIP/SENIORITY ESCALATION

```text
"participated in"
→ cannot become
"led"

"software engineer"
→ cannot become
"senior engineer"
```

without evidence.

# 34. METRIC GUARDRAIL

Never invent:

```text
20% improvement
10k users
99.9% uptime
$1M revenue
```

unless exact metric evidence exists.

# 35. FACTUALITY HARD GATE

Final publish requires:

```text
unsupported_claim_count = 0
jd_leakage_count = 0
skill_escalation_count = 0
ownership_escalation_count = 0
metric_hallucination_count = 0
invalid_provenance_count = 0
uncertain_claim_count = 0
```

# 36. CONTENT SELECTION — CP-SAT

Each block has choices:

```text
LONG
MEDIUM
SHORT
OMIT
```

Decision:

```text
y[i,v] ∈ {0,1}
Σ_v y[i,v] = 1
```

Protected:

```text
y[i,OMIT] = 0
```

Objective:

```text
maximize Σ Utility_i * RetentionFactor_iv * y[i,v]
```

Constraints:

```text
page/space budget
protected content
section minimums
chronological coherence
mandatory evidence
readability
```

Recommended:

```text
Google OR-Tools CP-SAT
```

# 37. INFORMATION RETENTION SCORE

```text
IRS =
Σ Utility_i * retention_i
/
Σ Utility_i
```

Development baseline:

```text
1 page → IRS >= 0.85
2 pages → IRS >= 0.93
```

But:

```text
Protected Content Retention = 1.00
Mandatory Evidence Retention = 1.00
```

always.

Thresholds benchmarked.

# 38. PAGE POLICY

```text
Try 1 page
↓
Retention + readability pass?
├── YES → use 1
└── NO → use 2
```

Do not:

```text
shrink font below safe minimum
destroy margins
remove mandatory evidence
```

to force 1 page.

# 39. CV AST

Canonical generated document representation:

```json
{
  "cv_variant_id": "CVV_001",
  "sections": [
    {
      "type": "EXPERIENCE",
      "items": []
    }
  ]
}
```

Content and layout are separated.

# 40. TEMPLATE SYSTEM

Template defines:

```text
section ordering constraints
font family
font size range
margins
spacing
heading styles
column structure
page geometry
```

Template sample text:

```text
NEVER candidate evidence
```

# 41. RENDERING STACK

```yaml
template_engine: Jinja2
pdf_renderer: WeasyPrint
pdf_validation: PyMuPDF
docx_renderer: python-docx
```

Pin renderer versions.

# 42. LAYOUT RULES

Baseline:

```text
A4
consistent margins
consistent section spacing
consistent typography
no overlaps
no clipped text
no orphan headings
no excessive whitespace
1–2 pages
```

# 43. VISUAL VALIDATION

Validate actual output:

```text
page_count
overflow
overlap
clipping
minimum font
minimum margins
orphan/widow rules
section balance
```

Do not trust estimated page count only.

# 44. CV VARIANT MODEL

```text
Original:
CV_001

Optimized for JD_001:
CVV_001
parent_cv_id=CV_001
target_job_id=JD_001

Optimized for JD_002:
CVV_002
parent_cv_id=CV_001
target_job_id=JD_002
```

Original is never overwritten.

# 45. VARIANT PROVENANCE

Every final block/claim keeps:

```text
fact_ids
source document IDs
source paths/pages
generation run
prompt/model version
validation results
```

# 46. POST-OPTIMIZATION EVALUATION

Optional but recommended UX:

```text
PRE Match: 78
↓
Verified Optimization
↓
POST Presentation Match: 86
```

Important:

```text
POST score improvement may come from
better selection/wording/coverage presentation.

It may NOT come from invented candidate capability.
```

Store:

```text
pre_match_id
post_match_id
cv_variant_id
```

# 47. POST EVALUATION REUSE

Do not blindly:

```text
parse → chunk → embed → full match
```

again.

Preferred:

```text
Verified CV AST
+
known fact/requirement mappings
→ presentation coverage evaluation
```

If search-index evaluation is required:

```text
index only generated verified blocks
```

not original pipeline from scratch.

# 48. TOKEN OPTIMIZATION

Create:

```text
OptimizationContextManifest
```

containing IDs:

```text
candidate evidence version
match ID
target requirements
selected facts
gap IDs
protected block IDs
```

Agent context only includes selected data.

# 49. CONTEXT BUDGET

Baseline:

```yaml
generation:
  max_allowed_facts: 40
  max_target_requirements: 15
  max_blocks_per_call: 12

validation:
  claim_batch_size: 20

entailment:
  source_facts_per_claim: "referenced_only"
```

Benchmark actual limits.

# 50. CACHE

Cache key:

```text
hash(
candidate_evidence_version
+ job_requirement_version
+ match_version
+ generation_contract_version
+ model_version
+ prompt_version
)
```

Cache:

```text
content variants
validated claims
layout measurements where renderer/template unchanged
```

# 51. PERSISTENCE

PostgreSQL:

```text
optimization_runs
optimization_context_manifests
generation_contracts
content_blocks
content_variants
atomic_claims
claim_fact_links
claim_validation_results
content_selection_runs
page_optimization_runs
cv_asts
cv_variants
render_runs
render_validation_results
post_optimization_evaluations
audit_events
model_runs
```

Object storage:

```text
PDF
DOCX
render previews if required
```

# 52. PIPELINE 2 OUTPUT

```json
{
  "optimization_id": "OPT_001",
  "status": "COMPLETED",

  "candidate_id": "CAND_001",
  "job_id": "JOB_001",

  "source_cv_id": "CV_001",
  "cv_variant_id": "CVV_001",

  "pre_match_id": "MATCH_001",
  "post_match_id": "MATCH_POST_001",

  "quality": {
    "grounding": 1.0,
    "unsupported_claims": 0,
    "jd_leakage": 0,
    "protected_content_retention": 1.0,
    "mandatory_evidence_retention": 1.0,
    "information_retention_score": 0.95,
    "pages": 2,
    "overflow": 0,
    "overlap": 0
  },

  "outputs": {
    "pdf_asset_id": "ASSET_001",
    "docx_asset_id": "ASSET_002"
  },

  "versions": {}
}
```

# 53. API — OPTIMIZE EXISTING

```http
POST /api/v3/cv-optimizations
```

Mode A request:

```json
{
  "mode": "OPTIMIZE_EXISTING_CV",
  "candidate_id": "CAND_001",
  "job_id": "JOB_001",
  "source_cv_id": "CV_001",
  "template_id": "TPL_001"
}
```

# 54. API — CREATE NEW

Same endpoint:

```json
{
  "mode": "CREATE_NEW_CV",
  "candidate_id": "CAND_001",
  "job_id": "JOB_001",
  "candidate_form_id": "FORM_001",
  "template_id": "TPL_002"
}
```

# 55. API — CONFIRM GAP

```http
POST /api/v3/cv-optimizations/{id}/confirmations
```

This creates evidence mutation request, not direct generated fact.

# 56. API — RESULT

```http
GET /api/v3/cv-optimizations/{id}
```

# 57. STATE MACHINE

```text
PENDING
RESOLVING_ARTIFACTS
WAITING_FOR_MATCH
ANALYZING_GAPS
WAITING_FOR_USER_CONFIRMATION
REFRESHING_MATCH
PLANNING_CONTENT
BUILDING_GENERATION_CONTRACT
GENERATING
VALIDATING_CLAIMS
SELECTING_CONTENT
OPTIMIZING_PAGES
RENDERING
VALIDATING_LAYOUT
POST_EVALUATING
COMPLETED
FAILED
```

# 58. ERROR CODES

```text
ARTIFACT_001 Pipeline 1 artifact missing
ARTIFACT_002 stale/incompatible artifact
MATCH_001 pre-match missing
EVIDENCE_001 invalid candidate evidence
CONFIRM_001 insufficient confirmation
CONTRACT_001 invalid generation contract
GEN_001 generation failed
CLAIM_001 unsupported claim
CLAIM_002 invalid provenance
CLAIM_003 JD leakage
CLAIM_004 skill escalation
CLAIM_005 ownership escalation
CLAIM_006 metric hallucination
ENTAIL_001 claim not entailed
CONTENT_001 content selection infeasible
PAGE_001 one-page infeasible
PAGE_002 two-page infeasible
RENDER_001 render failed
LAYOUT_001 visual validation failed
POSTMATCH_001 post evaluation failed
```

# 59. SECURITY / ISOLATION

Every read/write scopes:

```text
tenant_id
candidate_id
job_id
```

Agent must never receive facts from another candidate.

# 60. BENCHMARK — FACTUALITY

Permanent cases:

```text
JD skill absent from candidate evidence
→ must not appear as candidate skill.

Skill list only
→ must not become professional usage.

Participation
→ must not become leadership.

No metric
→ no invented metric.

Template sample
→ never candidate fact.

Generated wording
→ never write-back truth.
```

Targets:

```text
Critical unsupported factual claim rate = 0
JD leakage critical rate = 0
Invalid provenance publish rate = 0
```

# 61. BENCHMARK — CONTENT

Human-labeled set:

```text
fact relevance
mandatory coverage
evidence strength
impact
recency
specificity
protected status
```

Evaluate:

```text
selected content precision
critical evidence recall
information retention
```

# 62. BENCHMARK — PAGE OPTIMIZATION

Compare:

```text
heuristic truncation
vs
CP-SAT LONG/MEDIUM/SHORT/OMIT
```

Metrics:

```text
Protected Retention
Mandatory Evidence Retention
IRS
page count
readability
layout defects
```

# 63. BENCHMARK — AGENT

Compare:

```text
model
prompt version
temperature
generation contract version
```

Metrics:

```text
Grounding
Claim Entailment
JD Relevance
Conciseness
Unsupported Claim Rate
Revision Rate
Token Cost
Latency
```

# 64. OBSERVABILITY

```text
artifact_reuse_rate
stale_artifact_rate
incremental_rematch_rate
user_confirmation_rate

generation_token_usage
generation_latency
claim_validation_failure_rate
jd_leakage_rate
skill_escalation_rate
ownership_escalation_rate

one_page_success_rate
two_page_fallback_rate
protected_retention
information_retention_score
render_failure_rate
layout_failure_rate

pre_post_match_delta
cost_per_cv
```

# 65. ACCEPTANCE — MODE A

```text
AC-A-01 Requires target JD.
AC-A-02 Requires valid pre-match artifact.
AC-A-03 Reuses Pipeline 1 structured data.
AC-A-04 Reuses Candidate Facts.
AC-A-05 Reuses JD Requirements.
AC-A-06 Reuses Match/Evidence.
AC-A-07 Does not re-embed unchanged CV/JD.
AC-A-08 Agent cannot invent facts.
AC-A-09 Original CV is not overwritten.
AC-A-10 Final CV is a job-specific variant.
```

# 66. ACCEPTANCE — MODE B

```text
AC-B-01 User selects template.
AC-B-02 User completes structured Candidate Form.
AC-B-03 Form creates candidate evidence through controlled service.
AC-B-04 Template sample never becomes evidence.
AC-B-05 Candidate Evidence is matched to JD before generation.
AC-B-06 Critical gap may trigger clarification.
AC-B-07 Simple yes cannot authorize contextual experience claim.
AC-B-08 New facts trigger incremental rematch.
AC-B-09 Agent writes only after match/gap context exists.
AC-B-10 Final claims trace to form/user confirmation.
```

# 67. ACCEPTANCE — AGENT

```text
AC-AG-01 Agent receives Generation Contract.
AC-AG-02 Agent receives allowed facts only.
AC-AG-03 Agent may tailor wording/emphasis toward JD.
AC-AG-04 Agent cannot create candidate facts.
AC-AG-05 Agent outputs atomic claims + fact IDs.
AC-AG-06 Agent cannot approve its own factuality.
AC-AG-07 Agent cannot write back generated text as truth.
```

# 68. ACCEPTANCE — VALIDATION

```text
AC-VAL-01 Every factual claim has fact IDs.
AC-VAL-02 Fact IDs belong to same candidate.
AC-VAL-03 Entity scope is valid.
AC-VAL-04 Claim capability is valid.
AC-VAL-05 Immutable facts preserved.
AC-VAL-06 Metrics grounded.
AC-VAL-07 JD leakage blocked.
AC-VAL-08 Ownership/seniority escalation blocked.
AC-VAL-09 Semantic entailment required.
```

# 69. ACCEPTANCE — 1–2 PAGES

```text
AC-PAGE-01 Final PDF is 1 or 2 pages.
AC-PAGE-02 Protected Content Retention = 100%.
AC-PAGE-03 Mandatory Evidence Retention = 100%.
AC-PAGE-04 One-page optimization cannot destroy critical evidence.
AC-PAGE-05 If one page fails retention/readability, use two pages.
AC-PAGE-06 Font/margin stay above safe limits.
AC-PAGE-07 Actual rendered page count is validated.
AC-PAGE-08 Overflow/overlap/clipping = 0.
```

# 70. ACCEPTANCE — REUSE / WRITE-BACK

```text
AC-RW-01 Pipeline 2 consumes Artifact Manifest.
AC-RW-02 Stale artifact is rejected/refreshed.
AC-RW-03 New user-confirmed fact is written through shared evidence service.
AC-RW-04 Generated text cannot create evidence.
AC-RW-05 New fact rematches only affected requirements when possible.
AC-RW-06 Updated Candidate Evidence version is visible to Pipeline 3.
```

# 71. ACCEPTANCE — PRE/POST MATCH

```text
AC-PP-01 PRE match is preserved.
AC-PP-02 POST result is separate.
AC-PP-03 POST score cannot be increased by unsupported claims.
AC-PP-04 POST evaluation reuses verified mappings where possible.
AC-PP-05 User can inspect before/after explanation.
```

# 72. DEFINITION OF DONE

```text
✓ Mode A works.
✓ Mode B works.
✓ CV-only state does not trigger optimization.
✓ Pipeline 1 Artifact Manifest reuse works.
✓ Candidate Evidence Store integration works.
✓ Match-before-optimize works.
✓ Gap Detection works.
✓ Controlled user confirmation works.
✓ Incremental rematch works.
✓ Career/entity scopes work.
✓ Fact capabilities work.
✓ Content Utility works.
✓ Protected Content works.
✓ Generation Contract works.
✓ Agent boundary works.
✓ LONG/MEDIUM/SHORT variants work.
✓ Atomic Claims work.
✓ Deterministic validators work.
✓ Entailment verifier works.
✓ JD leakage guardrail works.
✓ Skill escalation guardrail works.
✓ Ownership/seniority guardrail works.
✓ Metric guardrail works.
✓ Factuality Hard Gate works.
✓ CP-SAT content/page selection works.
✓ Information Retention Gate works.
✓ 1-page → 2-page fallback works.
✓ CV AST works.
✓ Template system works.
✓ Jinja2/WeasyPrint PDF works.
✓ python-docx works.
✓ PyMuPDF validation works.
✓ Original CV remains immutable.
✓ Job-specific CV variants work.
✓ Generated wording does not become truth.
✓ PRE/POST evaluation works.
✓ Pipeline 3 sees latest verified candidate evidence.
✓ Benchmark/regression works.
✓ Audit/versioning works.
```

# 73. FINAL PIPELINE SUMMARY

## MODE A

```text
Existing CV
+
Target JD
↓
Pipeline 1 PRE Match
↓
Artifact Manifest
↓
Reuse Candidate Evidence + JD Requirements + Evidence Mapping
↓
Gap Detection
↓
Content Utility / Protected Content
↓
Generation Contract
↓
JD-Guided Agent
↓
Atomic Claims
↓
Deterministic Validation
↓
Semantic Entailment
↓
Factuality Hard Gate
↓
LONG/MEDIUM/SHORT Content Variants
↓
CP-SAT Selection
↓
1-page attempt
↓
Retention/readability pass?
├── YES → render 1 page
└── NO → optimize/render 2 pages
↓
Visual Validation
↓
CV Variant
↓
Optional POST Evaluation
```

## MODE B

```text
Target JD
+
Template
+
Candidate Form
↓
Candidate Evidence
↓
Shared Evidence Validation
↓
Candidate Evidence Store
↓
Pipeline 1 Candidate Evidence ↔ JD Match
↓
Gap Detection
↓
Optional User Confirmation
↓
Incremental Rematch
↓
Generation Contract
↓
Agent Writes
↓
Factuality Validation
↓
Content/Page Optimization
↓
Template/Layout
↓
Final CV Variant
```

# 74. FINAL BUSINESS CONTRACT

```text
Candidate Evidence
→ WHAT IS TRUE

JD Requirements
→ WHAT MATTERS

PRE Match
→ WHAT IS CURRENTLY SUPPORTED / PARTIAL / NOT FOUND

Content Utility
→ WHAT SHOULD BE KEPT

Generation Contract
→ WHAT THE AGENT IS ALLOWED TO SAY

JD-Guided Agent
→ HOW VERIFIED CONTENT IS WRITTEN

Validators
→ WHETHER GENERATED CLAIMS ARE SUPPORTED

CP-SAT Optimizer
→ WHICH VERIFIED VARIANT FITS BEST

Layout Engine
→ HOW VERIFIED CONTENT LOOKS

CV Variant
→ JOB-SPECIFIC PRESENTATION, NOT NEW TRUTH
```

Absolute rules:

```text
MATCH BEFORE OPTIMIZE.

No Candidate Evidence
→ No Candidate Claim.

No Provenance
→ No Publish.

JD Requirement
→ May influence emphasis,
→ May NOT become candidate fact.

Generated CV
→ Never overwrites original.
→ Never automatically updates Candidate Truth.

One page
→ only if critical information survives.

Pipeline 2 verified user facts
→ write back to Shared Candidate Evidence
→ Pipeline 3 reuses latest version.
```

# 75. RECOMMENDED IMPLEMENTATION ORDER

```text
PHASE 1
Artifact Manifest Resolver
Candidate Evidence integration
PRE Match requirement
Mode A/Mode B state machine

PHASE 2
Candidate Form
Controlled write-back
Gap clarification
Incremental rematch

PHASE 3
Content Blocks
Utility Score
Protected Content
Generation Contract

PHASE 4
JD-Guided Agent
LONG/MEDIUM/SHORT
Atomic Claims

PHASE 5
Deterministic Validators
Entailment
Factuality Hard Gate

PHASE 6
CP-SAT content/page optimizer
Information Retention
CV AST

PHASE 7
Template System
Jinja2
WeasyPrint
python-docx
PyMuPDF

PHASE 8
CV Variant persistence
PRE/POST evaluation
Before/After UX

PHASE 9
Benchmarks
Regression
Observability
Production Gates
```

**End — Pipeline 2 v3.0**
