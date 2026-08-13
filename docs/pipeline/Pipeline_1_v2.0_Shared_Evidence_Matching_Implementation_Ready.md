# TECHNICAL SPECIFICATION — PIPELINE 1
## Candidate Evidence Ingestion, JD Ingestion, Hybrid Matching, Evaluation & Shared Artifact Layer

**Version:** 2.0  
**Status:** Implementation-Ready Baseline  
**Scope:** Pipeline 1  
**Primary objective:** Biến CV/JD thành dữ liệu chuẩn, có provenance, persist và tái sử dụng được; cho phép CV và JD tồn tại độc lập; khi cả Candidate Evidence và JD Requirements tồn tại thì thực hiện Hybrid Matching + Rubric Evaluation; xuất Shared Artifact Manifest cho Pipeline 2 và Pipeline 3 mà không parse/chunk/embed lại dữ liệu không thay đổi.

---

# 0. EXECUTIVE DECISIONS

```text
1. CV và JD có lifecycle ĐỘC LẬP.
2. User có thể upload CV mà chưa có JD.
3. User có thể nhập/upload JD sau và reuse toàn bộ CV artifacts.
4. Một CV/Candidate Evidence có thể match với nhiều JD.
5. Matching phải chạy TRƯỚC CV Optimization.
6. Matching thực chất là Candidate Evidence ↔ Job Requirements.
7. CV chỉ là một nguồn Candidate Evidence.
8. Candidate Evidence Store là shared source of candidate truth.
9. Pipeline 1 persist Structured Data, chunks, requirements, vectors, evidence, match result.
10. Pipeline 2/3 không parse/chunk/embed lại nếu artifact/version còn hợp lệ.
11. Vector bắt buộc persist.
12. Pipeline 2 user-confirmed facts có thể write-back Candidate Evidence Store qua controlled mutation contract.
13. Generated CV wording KHÔNG tự động trở thành candidate truth.
14. Recompute phải incremental khi chỉ một phần dữ liệu thay đổi.
```

# 1. RESPONSIBILITY

Pipeline 1 chịu trách nhiệm:

```text
CV ingestion
JD ingestion
Parsing/OCR
Structured extraction
Normalization
Candidate Evidence construction
CV semantic chunking
JD atomic requirement construction
BM25 indexing
Embedding
Vector persistence
Hybrid retrieval
RRF fusion
Reranking
Evidence selection
Rubric evaluation
Match score
Gap/coverage result
Traceability
Shared downstream artifact manifest
Version/invalidation
```

Pipeline 1 KHÔNG chịu trách nhiệm:

```text
Viết/tối ưu CV
Render CV 1–2 trang
Mock interview
Tự bổ sung candidate facts
```

# 2. CORE DOMAIN MODEL

```text
Candidate
 ├── Candidate Evidence Store
 ├── CV_001 ORIGINAL
 ├── CV_002 ORIGINAL/IMPORTED
 └── ...

Job
 ├── JD_001
 ├── JD_002
 └── ...

Candidate Evidence × Job Requirements
             ↓
           Match
             ↓
 Evidence Mapping + Coverage + Rubric + Score
```

# 3. SOURCE OF TRUTH

## 3.1 Candidate truth

Allowed candidate evidence sources:

```text
ORIGINAL_CV
CANDIDATE_FORM
USER_CONFIRMATION
VERIFIED_PROFILE_DATA
```

Forbidden as candidate truth:

```text
JD
LLM inference
Generated CV wording
Template sample
External web
Question Bank
Interviewer's assumption
```

Absolute rule:

```text
No Source → No Candidate Fact
No Provenance → Not Reusable
```

# 4. SUPPORTED ENTRY FLOWS

## FLOW A — CV ONLY

```text
Upload CV
→ Validate
→ Parse/OCR
→ Structured CV
→ Normalize
→ Candidate Evidence
→ CV Chunks
→ BM25 Index
→ Embedding
→ Persist Vector
→ CV_READY
```

No matching occurs.

Output:

```json
{
  "candidate_id": "CAND_001",
  "cv_id": "CV_001",
  "cv_status": "READY",
  "job_id": null,
  "match_id": null
}
```

## FLOW B — JD ONLY

```text
Upload/Input JD
→ Validate
→ Parse
→ Structured JD
→ Normalize
→ Atomic Requirements
→ BM25/Searchable Index
→ Embedding
→ Persist Vector
→ JD_READY
```

## FLOW C — CV + JD

```text
CV artifacts
+
JD artifacts
→ Match
→ Evidence
→ Rubric
→ Final Score
→ MATCH_READY
```

## FLOW D — EXISTING CV + NEW JD

```text
Reuse:
Structured CV
Candidate Facts
CV Chunks
CV Vectors

Process only NEW JD
→ Match
```

## FLOW E — ONE CV, MANY JD

```text
CV_001 × JD_001 → MATCH_001
CV_001 × JD_002 → MATCH_002
CV_001 × JD_003 → MATCH_003
```

CV ingestion/embedding runs once unless invalidated.

# 5. HIGH-LEVEL ARCHITECTURE

```text
                 ┌───────────────┐
                 │ Candidate CV  │
                 └──────┬────────┘
                        ↓
              Parse / OCR / Extract
                        ↓
                Structured CV
                        ↓
                  Normalize
                        ↓
             Candidate Evidence
                        ↓
                 CV Chunking
                        ↓
              BM25 + Embedding
                        ↓
              Persist OpenSearch
                        │
                        │
                        │      ┌───────────────┐
                        │      │      JD       │
                        │      └──────┬────────┘
                        │             ↓
                        │      Parse / Extract
                        │             ↓
                        │       Structured JD
                        │             ↓
                        │         Normalize
                        │             ↓
                        │   Atomic Requirements
                        │             ↓
                        │      BM25 + Embedding
                        │             ↓
                        │      Persist OpenSearch
                        │             │
                        └──────┬──────┘
                               ↓
                      Candidate ↔ Job Match
                               ↓
               BM25 + Dense → RRF → Rerank
                               ↓
                         Evidence Set
                               ↓
                      Rubric Evaluation
                               ↓
                       Match / Gap Result
                               ↓
                  Shared Artifact Manifest
                    ↓                  ↓
                Pipeline 2         Pipeline 3
```

# 6. REFERENCE STACK

```yaml
runtime:
  python: "3.12+"
  api: "FastAPI"
  validation: "Pydantic v2"
  orm: "SQLAlchemy 2.x"

database:
  relational: "PostgreSQL 16+"
  search: "OpenSearch 3.x"
  object_storage: "S3-compatible / MinIO"
  queue: "Celery"
  cache: "Redis"

models:
  extraction_model: "CONFIGURED_LLM"
  extraction_temperature: 0
  embedding_library: "FlagEmbedding"
  embedding_model: "BAAI/bge-m3"
  embedding_dimension: 1024
  reranker_model: "BAAI/bge-reranker-v2-m3"

retrieval:
  lexical: "BM25"
  vector: "HNSW/cosine"
  fusion: "Weighted RRF"
  baseline_rank_constant: 60
```

Pin model revision/commit where possible.

# 7. DOCUMENT STORAGE

S3/MinIO:

```text
Original CV
Original JD
OCR artifacts if required
```

PostgreSQL:

```text
metadata
parsed text/page refs
Structured CV/JD
normalized entities
Candidate Facts
CV chunks
JD requirements
embedding metadata/status
retrieval results
evidence
rubric/evaluations
match result
artifact manifests
outbox
versions
```

OpenSearch:

```text
CV chunk searchable text + BM25 + vector
JD requirement searchable text + BM25 + vector
```

# 8. CV INPUT

Supported baseline:

```text
PDF
DOCX
Image: PNG/JPG/JPEG
```

Validate:

```text
MIME
extension
magic bytes
size
password protection
malware
empty content
```

# 9. PARSING

```text
PDF text → PyMuPDF
DOCX → python-docx
Image/scanned PDF → OCR adapter
```

Store:

```text
raw_text
page_number
source offsets
parser version
OCR confidence when applicable
```

# 10. STRUCTURED CV SCHEMA

Required top-level logical sections:

```text
CV_PROFILE
CV_SUMMARY
CV_SKILL
CV_EXPERIENCE
CV_PROJECT
CV_EDUCATION
CV_CERTIFICATION
CV_LANGUAGE
CV_AWARD
CV_PUBLICATION
CV_VOLUNTEER
CV_OTHER
```

Absence is allowed; hallucinated filling is forbidden.

Example:

```json
{
  "cv_id": "CV_001",
  "candidate_id": "CAND_001",
  "profile": {},
  "summary": null,
  "skills": [],
  "experiences": [],
  "projects": [],
  "education": [],
  "certifications": [],
  "languages": [],
  "source_document_id": "DOC_001",
  "schema_version": "2.0"
}
```

# 11. STRUCTURED JD SCHEMA

Logical sections:

```text
JD_TITLE
JD_LEVEL
JD_REQUIRED_SKILL
JD_PREFERRED_SKILL
JD_EXPERIENCE
JD_EDUCATION
JD_RESPONSIBILITY
JD_CERTIFICATION
JD_DOMAIN
JD_LANGUAGE
JD_REQUIRED_QUALIFICATION
JD_PREFERRED_QUALIFICATION
JD_LOCATION
JD_WORK_MODE
JD_EMPLOYMENT_TYPE
JD_OTHER_REQUIREMENT
```

# 12. NORMALIZATION

Normalize without changing factual meaning:

```text
case
whitespace
dates
skill aliases
technology aliases
degree aliases
language names
employment types
seniority taxonomy
```

Keep both:

```text
original_value
normalized_value
normalization_rule_id
```

Never normalize:

```text
C → C++
Java → JavaScript
AWS → cloud
PostgreSQL → database experience
```

unless taxonomy explicitly defines safe equivalence.

# 13. CANDIDATE EVIDENCE STORE

Candidate Fact schema:

```json
{
  "fact_id": "FACT_001",
  "candidate_id": "CAND_001",
  "fact_type": "EXPERIENCE_TECH_USAGE",
  "value": "PostgreSQL",
  "normalized_value": "postgresql",

  "entity_scope": {
    "experience_id": "EXP_001",
    "project_id": null
  },

  "source": {
    "source_type": "ORIGINAL_CV",
    "document_id": "DOC_001",
    "page": 2,
    "source_path": "experience[0].description",
    "source_span": {}
  },

  "claim_capabilities": [
    "SKILL_MENTION",
    "EXPERIENCE_TECH_USAGE"
  ],

  "status": "VERIFIED",
  "version": 1
}
```

# 14. FACT CAPABILITY

A fact only authorizes specific claims.

Example:

```text
CV skill list contains Docker
→ SKILL_MENTION

does NOT automatically authorize
→ USED_DOCKER_IN_PROJECT
→ DEPLOYED_PRODUCTION_WITH_DOCKER
```

# 15. ENTITY SCOPE

Facts belong to scope:

```text
GLOBAL
EXPERIENCE
PROJECT
EDUCATION
CERTIFICATION
```

Do not cross-join unrelated facts.

Example:

```text
AWS in Project A
+
responsibility in Job B

≠
AWS used in Job B
```

# 16. CV CHUNKING

CV chunk types:

```text
CV_SUMMARY
CV_SKILL
CV_EXPERIENCE
CV_PROJECT
CV_EDUCATION
CV_CERTIFICATION
CV_LANGUAGE
CV_OTHER
```

Do not create one vector for whole CV.

Granularity:

```text
Skill groups → logical chunk
Experience → at least 1; long description → 2..N semantic chunks
Project → at least 1
Education → 1 record/chunk
Certification → 1 record/chunk
```

Every chunk preserves:

```text
chunk_id
candidate_id
cv_id
chunk_type
text
normalized_text
entity_scope
source page/path
fact_ids
chunking_version
content_hash
```

# 17. JD ATOMIC REQUIREMENTS

Do not use whole JD as one retrieval query.

```text
JD
↓
REQ_001 Python
REQ_002 PostgreSQL
REQ_003 Docker
REQ_004 3 years backend
REQ_005 REST API
REQ_006 Bachelor
REQ_007 AWS preferred
```

Schema:

```json
{
  "requirement_id": "REQ_001",
  "job_id": "JOB_001",
  "type": "JD_REQUIRED_SKILL",
  "text": "PostgreSQL",
  "normalized_text": "postgresql",
  "priority": "MANDATORY",
  "weight": 0.10,
  "source_path": "requirements[2]",
  "version": 1
}
```

# 18. MATCHING MATRIX

| JD Requirement | Allowed Candidate/CV Evidence |
|---|---|
| JD_REQUIRED_SKILL | CV_SKILL, CV_EXPERIENCE, CV_PROJECT, CV_CERTIFICATION |
| JD_PREFERRED_SKILL | CV_SKILL, CV_EXPERIENCE, CV_PROJECT, CV_CERTIFICATION |
| JD_EXPERIENCE | CV_EXPERIENCE, CV_PROJECT |
| JD_EDUCATION | CV_EDUCATION |
| JD_CERTIFICATION | CV_CERTIFICATION |
| JD_LANGUAGE | CV_LANGUAGE, CV_CERTIFICATION |
| JD_RESPONSIBILITY | CV_EXPERIENCE, CV_PROJECT |
| JD_DOMAIN | CV_EXPERIENCE, CV_PROJECT, CV_SUMMARY |
| JD_REQUIRED_QUALIFICATION | CV_EXPERIENCE, CV_PROJECT, CV_SUMMARY, CV_CERTIFICATION |
| JD_PREFERRED_QUALIFICATION | CV_EXPERIENCE, CV_PROJECT, CV_SUMMARY, CV_CERTIFICATION |
| JD_LOCATION | structured profile |
| JD_WORK_MODE | structured preference |
| JD_EMPLOYMENT_TYPE | structured preference |
| JD_OTHER_REQUIREMENT | CV_OTHER, CV_SUMMARY, CV_EXPERIENCE, CV_PROJECT |

# 19. EMBEDDING

Input:

```text
normalized semantic text
```

Model baseline:

```text
BAAI/bge-m3
dimension 1024
normalized embeddings
```

Persist:

```text
embedding_model
revision
dimension
content_hash
embedding_status
indexed_at
```

# 20. EMBEDDING REUSE

Re-embed only if:

```text
content_hash changed
OR embedding model/revision changed
OR normalization/chunking output changed materially
```

Otherwise:

```text
REUSE VECTOR
```

# 21. INDEXING CONSISTENCY

Use Outbox pattern:

```text
PostgreSQL transaction
→ source data + index_outbox
→ Celery worker
→ embed/index OpenSearch
→ mark search_index_status=READY
```

Do not claim artifact READY until indexing succeeds.

# 22. HYBRID RETRIEVAL

For each requirement:

```text
Requirement
↓
Allowed chunk filter
↓
BM25 Top-K
+
Dense Top-K
↓
Weighted RRF
↓
Reranker
↓
Evidence Candidates
```

Baseline:

```yaml
bm25_top_k: 20
dense_top_k: 20
rrf_rank_constant: 60
bm25_weight: 0.5
dense_weight: 0.5
fusion_top_k: 10
reranker_top_k: 5
```

Production values must be benchmarked.

# 23. RRF

```text
RRF(d) = Σ_i w_i / (k + rank_i(d))
```

Never:

```text
raw_bm25_score + cosine_score
```

Never compare RRF score to semantic similarity threshold.

# 24. EVIDENCE

Evidence schema:

```json
{
  "evidence_id": "EVD_001",
  "match_id": "MATCH_001",
  "requirement_id": "REQ_001",
  "chunk_id": "CHUNK_010",
  "fact_ids": ["FACT_010"],
  "semantic_score": 0.84,
  "bm25_score": 7.12,
  "fusion_score": 0.031,
  "reranker_score": 0.91,
  "status": "SUPPORTED",
  "source_trace": {}
}
```

No evidence:

```text
NOT_FOUND
```

not:

```text
candidate does not know X
```

# 25. COVERAGE STATUS

```text
SUPPORTED
PARTIAL
NOT_FOUND
CONFLICTING
NOT_APPLICABLE
```

Important:

```text
NOT_FOUND = no evidence in current candidate data.
NOT_FOUND ≠ candidate definitely lacks competency.
```

# 26. RUBRIC

Rubric is versioned.

Example criteria:

```text
Required Skills
Relevant Experience
Responsibilities
Education
Certifications
Preferred Skills
Domain
```

Enabled criterion weights must sum to 1.0.

# 27. DETERMINISTIC SCORING

Criterion:

```text
CriterionScore_i =
Coverage_i * CriterionWeight_i
```

Final:

```text
FinalScore = Σ CriterionScore_i * 100
```

Where coverage policy is explicit/versioned.

LLM may classify semantic support if needed but cannot perform hidden final arithmetic.

# 28. MATCH RESULT

```json
{
  "match_id": "MATCH_001",
  "candidate_id": "CAND_001",
  "job_id": "JOB_001",

  "score": 78.0,

  "coverage": {
    "supported": ["REQ_001"],
    "partial": ["REQ_002"],
    "not_found": ["REQ_003"]
  },

  "evidence_set_id": "EVSET_001",

  "versions": {
    "pipeline": "2.0",
    "retrieval": "RET_V1",
    "rubric": "RUBRIC_V1",
    "scoring": "SCORE_V1"
  }
}
```

# 29. PRE-OPTIMIZATION MATCH

Pipeline 1 result consumed by Pipeline 2 is:

```text
PRE_OPTIMIZATION_MATCH
```

It describes current evidence/presentation before CV optimization.

# 30. POST-OPTIMIZATION EVALUATION

Pipeline 2 may request:

```text
POST_OPTIMIZATION_MATCH
```

This must:

```text
reuse same JD Requirements
reuse candidate truth
evaluate verified optimized CV representation
not allow generated unsupported facts
```

Store separately.

Never overwrite PRE result.

# 31. SHARED ARTIFACT MANIFEST

This is the official downstream contract.

```json
{
  "artifact_manifest_id": "AM_001",

  "candidate_id": "CAND_001",
  "job_id": "JOB_001",

  "candidate_evidence_set_id": "CFS_001",
  "candidate_evidence_version": 5,

  "structured_cv_id": "SCV_001",
  "structured_jd_id": "SJD_001",

  "cv_chunk_set_id": "CVCH_001",
  "jd_requirement_set_id": "JDR_001",

  "cv_index_alias": "cv_chunks_current",
  "jd_index_alias": "jd_requirements_current",

  "match_id": "MATCH_001",
  "evidence_set_id": "EVSET_001",

  "versions": {
    "pipeline": "2.0",
    "cv_schema": "2.0",
    "jd_schema": "2.0",
    "normalization": "NORM_V1",
    "chunking": "CHUNK_V1",
    "embedding_model": "BAAI/bge-m3@REV",
    "retrieval": "RET_V1",
    "rubric": "RUBRIC_V1",
    "scoring": "SCORE_V1"
  },

  "status": "READY_FOR_DOWNSTREAM"
}
```

For CV-only:

```text
job_id = null
structured_jd_id = null
match_id = null
status = CANDIDATE_READY
```

# 32. DOWNSTREAM REUSE RULE

Pipeline 2/3 MUST NOT:

```text
parse CV again
normalize CV again
chunk CV again
embed CV again
parse JD again
embed JD again
rematch entire CV/JD
```

unless manifest invalidation requires it.

# 33. INVALIDATION GRAPH

```text
Original CV changed
→ invalidate Structured CV
→ Candidate Facts from that CV
→ CV chunks
→ CV embeddings
→ affected Matches
→ downstream manifests

JD changed
→ invalidate Structured JD
→ JD requirements
→ JD embeddings
→ affected Matches

Embedding model changed
→ invalidate embeddings/index compatibility
→ retrieval/matches

Rubric/scoring changed
→ keep retrieval/evidence if compatible
→ recompute evaluation only
```

# 34. INCREMENTAL RECOMPUTATION

If Pipeline 2 adds verified fact:

```text
FACT_NEW
↓
determine affected entity/skill/topic
↓
create/update relevant candidate chunk
↓
embed only changed chunk
↓
identify affected JD requirements
↓
rerun retrieval/evidence only for affected requirements
↓
recompute affected criteria
↓
aggregate Match Result
↓
new artifact manifest version
```

Never rerun entire pipeline without reason.

# 35. CONTROLLED WRITE-BACK FROM PIPELINE 2

Allowed:

```text
USER_CONFIRMATION
CANDIDATE_FORM
```

Pipeline 2 submits:

```json
{
  "candidate_id": "CAND_001",
  "source_type": "USER_CONFIRMATION",
  "facts": [],
  "provenance": {},
  "requested_by": "PIPELINE_2"
}
```

Pipeline 1/shared evidence service validates before commit.

Forbidden:

```text
generated CV text → fact
JD requirement → fact
agent inference → fact
```

# 36. CV VARIANTS

Original CV is immutable source artifact.

Generated/optimized CV:

```text
must not overwrite original
```

Model:

```text
CV_001 ORIGINAL
CV_002 GENERATED parent=CV_001 target_job=JD_001
CV_003 GENERATED parent=CV_001 target_job=JD_002
```

Generated variant may be indexed for presentation evaluation, but not treated as independent candidate truth.

# 37. CORE DATABASE TABLES

```text
candidates
jobs
documents

cv_documents
jd_documents

cv_profiles
cv_experiences
cv_projects
cv_skills
cv_education
cv_certifications
cv_languages

candidate_evidence_sets
candidate_facts
candidate_fact_sources

cv_chunks
jd_requirements

embedding_records
index_outbox

matches
retrieval_results
evidence_sets
evidences

rubrics
rubric_criteria
criterion_evaluations
match_results

artifact_manifests
artifact_dependencies
artifact_invalidations

cv_variants
audit_events
model_runs
```

# 38. API — UPLOAD CV

```http
POST /api/v2/candidates/{candidate_id}/cvs
```

Response:

```json
{
  "cv_id": "CV_001",
  "status": "PROCESSING"
}
```

# 39. API — CREATE/UPLOAD JD

```http
POST /api/v2/jobs
```

# 40. API — MATCH

```http
POST /api/v2/matches
```

Request:

```json
{
  "candidate_id": "CAND_001",
  "job_id": "JOB_001",
  "cv_id": "CV_001"
}
```

Backend resolves reusable artifacts.

# 41. API — ARTIFACT MANIFEST

```http
GET /api/v2/matches/{match_id}/artifact-manifest
```

# 42. API — CANDIDATE ARTIFACT

For no-JD state:

```http
GET /api/v2/candidates/{candidate_id}/artifact-manifest
```

# 43. API — WRITE-BACK VERIFIED FACT

Internal/authorized:

```http
POST /api/v2/candidates/{candidate_id}/evidence
```

Must require provenance.

# 44. ERROR CODES

```text
UPLOAD_001 file too large
UPLOAD_002 unsupported format
PARSER_001 parse failed
OCR_001 OCR failed
EXTRACTION_001 extraction failed
NORMALIZATION_001 normalization failed
FACT_001 invalid candidate fact
FACT_002 forbidden source
CHUNK_001 chunking failed
EMBEDDING_001 embedding failed
VECTOR_001 index unavailable
BM25_001 lexical index unavailable
FUSION_001 fusion failed
RERANK_001 reranker failed
EVIDENCE_001 evidence invalid
RUBRIC_001 rubric invalid
MATCH_001 match failed
ARTIFACT_001 manifest incompatible
ARTIFACT_002 artifact stale
WRITEBACK_001 ungrounded write-back rejected
```

# 45. TRACEABILITY

Required chain:

```text
Final Match Score
↓
Criterion
↓
JD Requirement
↓
Evidence
↓
Candidate Fact / CV Chunk
↓
Source Page/Path
↓
Original CV/User Confirmation
```

# 46. VERSIONING

Version:

```text
pipeline
schemas
parser/OCR
extraction prompt/model
normalization
taxonomy
chunking
embedding model/revision
OpenSearch index mapping
retrieval
reranker
rubric
scoring
artifact contract
```

# 47. SECURITY

```text
Authentication
Authorization
TLS
Encryption at rest
Tenant isolation
PII access control
Malware scanning
Audit logging
Deletion support
```

Sensitive fields excluded from matching by default:

```text
name
email
phone
photo
date of birth
gender
marital status
nationality
religion
political affiliation
health information
```

# 48. BENCHMARK — EXTRACTION

Metrics:

```text
Field Precision
Field Recall
Field F1
Unsupported Extraction Rate
Source Trace Accuracy
```

# 49. BENCHMARK — RETRIEVAL

```text
Recall@5
Recall@10
MRR
nDCG@10
Precision@5
latency p50/p95
```

Compare:

```text
BM25
Dense
BM25 + Dense + RRF
BM25 + Dense + RRF + Reranker
```

# 50. BENCHMARK — MATCHING

```text
Requirement Coverage Accuracy
Evidence Precision
Evidence Recall
Criterion MAE vs human
Final Score MAE
Explanation Support Rate
```

# 51. REUSE METRICS

```text
cv_parse_reuse_rate
cv_embedding_reuse_rate
jd_embedding_reuse_rate
incremental_recompute_rate
full_recompute_rate
artifact_cache_hit_rate
```

Target:

```text
Valid unchanged artifact → no repeated parse/chunk/embed.
```

# 52. ACCEPTANCE — CV ONLY

```text
AC-CV-01 CV can be processed without JD.
AC-CV-02 Candidate Evidence persists.
AC-CV-03 CV chunks persist.
AC-CV-04 CV vectors persist.
AC-CV-05 Result status is CANDIDATE_READY/CV_READY.
AC-CV-06 No fake match is created.
```

# 53. ACCEPTANCE — JD ONLY

```text
AC-JD-01 JD can exist independently.
AC-JD-02 Atomic requirements persist.
AC-JD-03 JD vectors persist.
AC-JD-04 No candidate assumptions are generated.
```

# 54. ACCEPTANCE — REUSE

```text
AC-REUSE-01 Existing CV + new JD does not parse CV again.
AC-REUSE-02 Existing CV + new JD does not embed unchanged CV again.
AC-REUSE-03 One CV supports multiple Match records.
AC-REUSE-04 Pipeline 2/3 consume Artifact Manifest.
AC-REUSE-05 Changed fact triggers incremental recomputation.
AC-REUSE-06 Generated CV wording never becomes truth automatically.
```

# 55. ACCEPTANCE — MATCH

```text
AC-MATCH-01 Each requirement is queried independently.
AC-MATCH-02 Matching Matrix is enforced.
AC-MATCH-03 BM25 score remains separate.
AC-MATCH-04 Semantic score remains separate.
AC-MATCH-05 RRF uses ranks.
AC-MATCH-06 Reranker is second-stage.
AC-MATCH-07 Evidence references requirement + candidate source.
AC-MATCH-08 Missing evidence outputs NOT_FOUND.
AC-MATCH-09 Final score is deterministic aggregation.
```

# 56. DEFINITION OF DONE

```text
✓ CV-only ingestion works.
✓ JD-only ingestion works.
✓ CV+JD matching works.
✓ One CV → many JD works.
✓ Candidate Evidence Store works.
✓ Provenance works.
✓ CV chunking works.
✓ JD atomic requirements work.
✓ BM25 works.
✓ BGE-M3 embeddings persist.
✓ OpenSearch vector search works.
✓ RRF works.
✓ Reranker works.
✓ Evidence mapping works.
✓ Rubric evaluation works.
✓ Match score works.
✓ Gap/coverage works.
✓ Artifact Manifest works.
✓ Pipeline 2/3 reuse contract works.
✓ Incremental invalidation works.
✓ Controlled Pipeline 2 write-back works.
✓ Original CV is immutable.
✓ CV variants are separate.
✓ Benchmark/regression works.
✓ Audit/versioning works.
```

# 57. FINAL CONTRACT

```text
Candidate Source
→ Candidate Evidence
→ Persist
→ Reusable Candidate Artifacts

JD
→ Atomic Requirements
→ Persist
→ Reusable Job Artifacts

Candidate Evidence + JD Requirements
→ Match
→ Evidence
→ Rubric
→ Score
→ Shared Artifact Manifest

Shared Artifact Manifest
→ Pipeline 2 CV Optimization
→ Pipeline 3 Mock Interview
```

**Absolute architecture rule:**

```text
MATCH FIRST.
OPTIMIZE SECOND.

Candidate Evidence decides WHAT IS TRUE.
JD Requirements decide WHAT MATTERS.
Evidence decides WHAT IS PROVEN.
Rubric decides HOW IT IS EVALUATED.
Artifact Manifest decides WHAT DOWNSTREAM MAY REUSE.
```

**End — Pipeline 1 v2.0**
