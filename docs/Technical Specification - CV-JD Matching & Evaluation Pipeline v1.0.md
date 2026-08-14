# Technical Specification — CV–JD Matching & Evaluation Pipeline

**Version:** 1.0  
**Status:** Ready for Implementation  
**System:** CV–JD Matching & Evaluation  
**Document Type:** Technical / Functional Specification

---

# 1. Mục tiêu hệ thống

Hệ thống nhận:

- 01 CV của ứng viên.
- 01 Job Description (JD).

Hệ thống phải:

1. Đọc được CV/JD từ PDF, DOCX hoặc Image.
2. Parse/OCR tài liệu thành text.
3. Trích xuất text thành JSON có cấu trúc.
4. Chuẩn hóa dữ liệu CV và JD.
5. Chia dữ liệu thành các chunk có ý nghĩa.
6. Index CV bằng BM25.
7. Embedding CV chunks thành vector.
8. Với từng requirement của JD, thực hiện:
   - BM25 Retrieval.
   - Semantic Retrieval.
9. Kết hợp hai retrieval bằng Reciprocal Rank Fusion (RRF).
10. Lấy các evidence phù hợp nhất từ CV.
11. Đánh giá từng requirement/criterion theo rubric.
12. Tính Final Score từ 0–100.
13. Trả về:
   - Điểm tổng.
   - Điểm từng criterion.
   - Requirement nào matched.
   - Requirement nào partially matched.
   - Requirement nào missing.
   - Evidence tương ứng.
   - Giải thích tại sao có số điểm đó.

---

# 2. Nguyên tắc kiến trúc

Hệ thống phải tách biệt 3 lớp:

```text
RETRIEVAL
    ↓
EVIDENCE
    ↓
EVALUATION
```

Không được đánh đồng retrieval score với evaluation score.

Các loại score trong hệ thống:

```text
bm25_score
semantic_score
fusion_score
criterion_score
final_score
```

Các score trên có ý nghĩa hoàn toàn khác nhau.

## 2.1 Quy tắc bắt buộc

```text
BM25 score ≠ Semantic score

Semantic score ≠ Fusion score

Fusion score ≠ Criterion score

Criterion score ≠ Final score
```

`fusion_score` không được so trực tiếp với `semantic_min_score`.

`semantic_score` không được nhân 100 để trở thành Final Score.

---

# 3. High-Level Pipeline

```text
CV / JD
   │
   ▼
File Validation
   │
   ▼
Parse / OCR
   │
   ▼
Raw Text
   │
   ▼
Structured Extraction
   │
   ▼
Normalization
   │
   ▼
Requirement / Chunk Construction
   │
   ├───────────────────────────────┐
   │                               │
   ▼                               ▼
BM25 Index                   Embedding Model
   │                               │
   │                               ▼
   │                         Vector Embedding
   │                               │
   │                               ▼
   │                          Vector Index
   │                               │
   └───────────────┬───────────────┘
                   │
          For each JD Requirement
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
   BM25 Search          Semantic Search
        │                     │
        └──────────┬──────────┘
                   ▼
             Hybrid RRF
                   │
                   ▼
            Top-K Evidence
                   │
                   ▼
             Evidence Mapping
                   │
                   ▼
            Rubric Evaluation
                   │
                   ▼
              Final Score
                   │
                   ▼
       Explanation / Match Report
```

---

# 4. Scope

## 4.1 In Scope

Hệ thống v1 phải hỗ trợ:

- CV PDF.
- CV DOCX.
- CV Image.
- JD PDF.
- JD DOCX.
- JD Image.
- JD plain text.
- OCR.
- Structured extraction.
- Normalization.
- Semantic chunking.
- BM25 Retrieval.
- Semantic Vector Retrieval.
- RRF Hybrid Fusion.
- Requirement → Evidence mapping.
- Rubric evaluation.
- Final scoring.
- Explainable results.

## 4.2 Out of Scope

Version 1 không thực hiện:

- Background check.
- Personality assessment.
- Facial/image analysis ứng viên.
- Salary prediction.
- Interview assessment.
- Tự động quyết định tuyển hoặc loại ứng viên.
- Xác minh thông tin CV có đúng sự thật hay không.

---

# 5. Document Input

## 5.1 Supported File Types

```text
PDF
DOCX
JPG
JPEG
PNG
```

## 5.2 Validation

Default:

```yaml
max_file_size_mb: 20
max_pages: 20

supported_languages:
  - en
  - vi
```

Các giá trị trên phải configurable.

## 5.3 Document Type

```text
CV
JD
```

---

# 6. Core IDs

Mọi object quan trọng phải có ID.

```text
candidate_id
job_id
document_id
chunk_id
requirement_id
evidence_id
criterion_id
match_id
```

ID phải unique trong phạm vi hệ thống.

Khuyến nghị:

```text
CAND_xxx
JOB_xxx

DOC_xxx

CV_CHUNK_xxx
JD_REQ_xxx

EVD_xxx
MATCH_xxx
```

---

# 7. Document Parsing

## 7.1 Input

```text
PDF / DOCX / Image
```

## 7.2 Processing Rules

### PDF text-based

```text
PDF
→ PDF Parser
→ Page Text
```

### DOCX

```text
DOCX
→ DOCX Parser
→ Text
```

### Image

```text
Image
→ OCR
→ Text
```

### Scanned PDF

```text
PDF
→ Detect text layer
→ Không có usable text
→ Render page
→ OCR
```

## 7.3 Output

```json
{
  "document_id": "DOC_001",
  "document_type": "CV",
  "file_name": "candidate.pdf",
  "file_type": "pdf",
  "language": "en",
  "page_count": 3,
  "raw_text": "...",
  "pages": [
    {
      "page_number": 1,
      "text": "..."
    }
  ]
}
```

## 7.4 Required Traceability

Phải bảo toàn page number.

Sau này mọi evidence phải trace về:

```text
document_id
page_number
source_section
source_text
```

---

# 8. CV Structured Schema

CV phải parse vào các group sau.

## 8.1 CV Taxonomy

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

`CV_OTHER` là fallback.

Không được drop text chỉ vì chưa phân loại được.

---

# 9. CV Profile

Chứa thông tin nhận dạng cơ bản nhưng không dùng trực tiếp cho similarity scoring.

```json
{
  "candidate": {
    "name": "",
    "current_title": "",
    "location": ""
  }
}
```

Email/phone có thể được lưu trong profile riêng nhưng không được dùng làm matching criterion.

---

# 10. CV Summary

Schema:

```json
{
  "summary": {
    "text": "",
    "source_page": 1
  }
}
```

Chunk type:

```text
CV_SUMMARY
```

---

# 11. CV Skills

Không lưu skill chỉ dưới dạng string.

Schema:

```json
{
  "skills": [
    {
      "original_name": "Postgres",
      "normalized_name": "postgresql",
      "category": "database",
      "confidence": 0.96,
      "source_text": "Postgres, Redis, MongoDB",
      "source_page": 1
    }
  ]
}
```

Các category cho skill:

```text
programming_language
framework
library
database
cloud
devops
tool
methodology
soft_skill
domain_skill
other
```

---

# 12. CV Work Experience

Schema:

```json
{
  "experience": [
    {
      "experience_id": "EXP_001",
      "company": "ABC Company",
      "job_title_original": "Sr Backend Dev",
      "job_title_normalized": "backend engineer",
      "seniority": "senior",

      "start_date": "2022-01",
      "end_date": "2025-01",
      "is_current": false,

      "duration_months": 36,

      "domain": [
        "fintech"
      ],

      "descriptions": [
        "Developed REST APIs using FastAPI",
        "Built payment microservices"
      ],

      "skills": [
        "python",
        "fastapi",
        "postgresql"
      ],

      "source_page": 2
    }
  ]
}
```

---

# 13. CV Projects

Schema:

```json
{
  "projects": [
    {
      "project_id": "PROJ_001",
      "name": "",
      "role": "",
      "description": "",
      "skills": [],
      "domain": [],
      "start_date": null,
      "end_date": null,
      "source_page": 2
    }
  ]
}
```

---

# 14. CV Education

Schema:

```json
{
  "education": [
    {
      "education_id": "EDU_001",
      "institution": "",
      "degree_original": "",
      "degree_level": "bachelor",
      "major": "",
      "start_date": null,
      "end_date": null,
      "source_page": 3
    }
  ]
}
```

Enum:

```text
high_school
associate
bachelor
master
doctorate
other
unknown
```

---

# 15. CV Certifications

```json
{
  "certifications": [
    {
      "certification_id": "CERT_001",
      "name_original": "",
      "name_normalized": "",
      "issuer": "",
      "issue_date": null,
      "expiration_date": null,
      "source_page": 3
    }
  ]
}
```

---

# 16. CV Languages

```json
{
  "languages": [
    {
      "language": "English",
      "normalized_language": "en",
      "level_original": "IELTS 7.5",
      "level_normalized": "C1",
      "source_page": 3
    }
  ]
}
```

Không bắt buộc convert tất cả chứng chỉ về CEFR nếu không có mapping đáng tin cậy.

---

# 17. CV Award / Publication / Volunteer

Đây là optional data.

```text
CV_AWARD
CV_PUBLICATION
CV_VOLUNTEER
```

Chỉ tham gia scoring nếu JD/rubric có criterion tương ứng.

---

# 18. JD Structured Schema

JD taxonomy bắt buộc:

```text
JD_JOB_SUMMARY

JD_REQUIRED_SKILL
JD_PREFERRED_SKILL

JD_EXPERIENCE
JD_EDUCATION
JD_CERTIFICATION
JD_LANGUAGE

JD_RESPONSIBILITY
JD_DOMAIN

JD_REQUIRED_QUALIFICATION
JD_PREFERRED_QUALIFICATION

JD_LOCATION
JD_WORK_MODE
JD_EMPLOYMENT_TYPE

JD_OTHER_REQUIREMENT
```

---

# 19. JD Job Information

```json
{
  "job": {
    "job_id": "JOB_001",
    "title_original": "Senior Backend Developer",
    "title_normalized": "backend engineer",
    "seniority": "senior",
    "summary": "",
    "location": "",
    "work_mode": "hybrid",
    "employment_type": "full_time"
  }
}
```

`work_mode`:

```text
onsite
remote
hybrid
unspecified
```

`employment_type`:

```text
full_time
part_time
contract
internship
temporary
unspecified
```

---

# 20. JD Requirement Base Schema

Mọi requirement phải dùng common schema:

```json
{
  "requirement_id": "JD_REQ_001",
  "requirement_type": "JD_REQUIRED_SKILL",

  "text": "Strong Python programming skills.",

  "mandatory": true,
  "priority": "high",

  "normalized_value": null,

  "source_text": "Strong Python programming skills.",
  "source_page": 1,

  "confidence": 0.97
}
```

Priority enum:

```text
critical
high
medium
low
```

---

# 21. JD Required Skills

Ví dụ cấu trúc:

```json
{
  "requirement_id": "JD_REQ_001",
  "requirement_type": "JD_REQUIRED_SKILL",
  "skill_original": "Postgres",
  "skill_normalized": "postgresql",
  "mandatory": true,
  "priority": "high"
}
```

---

# 22. JD Preferred Skills

Schema giống Required Skill nhưng:

```text
requirement_type = JD_PREFERRED_SKILL
mandatory = false
```

---

# 23. JD Experience

Schema:

```json
{
  "requirement_id": "JD_REQ_010",
  "requirement_type": "JD_EXPERIENCE",

  "minimum_years": 3,
  "preferred_years": 5,

  "role": "backend engineer",
  "seniority": null,
  "skill": null,
  "domain": null,

  "mandatory": true,

  "text": "At least 3 years of backend development experience."
}
```

Experience requirement có thể gắn với:

```text
role
skill
domain
```

Ví dụ:

```text
3 years of Java
5 years in banking
2 years as team lead
```

phải trở thành các requirement riêng nếu cần.

---

# 24. JD Education

```json
{
  "requirement_id": "JD_REQ_020",
  "requirement_type": "JD_EDUCATION",

  "minimum_degree": "bachelor",
  "preferred_degree": null,
  "major": "computer science",

  "mandatory": false
}
```

---

# 25. JD Certification

```json
{
  "requirement_id": "JD_REQ_030",
  "requirement_type": "JD_CERTIFICATION",

  "certification_name": "AWS Certified Developer",
  "normalized_name": "aws certified developer",

  "mandatory": false
}
```

---

# 26. JD Language

```json
{
  "requirement_id": "JD_REQ_040",
  "requirement_type": "JD_LANGUAGE",

  "language": "English",
  "normalized_language": "en",

  "minimum_level": "B2",

  "mandatory": true
}
```

---

# 27. JD Responsibility

Mỗi responsibility là một requirement riêng.

Không gom toàn bộ responsibility thành một đoạn lớn.

```json
{
  "requirement_id": "JD_REQ_050",
  "requirement_type": "JD_RESPONSIBILITY",

  "text": "Design and develop RESTful APIs.",

  "mandatory": false
}
```

---

# 28. JD Domain

```json
{
  "requirement_id": "JD_REQ_060",
  "requirement_type": "JD_DOMAIN",

  "domain": "fintech",

  "minimum_years": null,

  "mandatory": false
}
```

---

# 29. JD Qualification

Dùng cho requirement không thuộc skill/education/certification rõ ràng.

Ví dụ:

```text
Strong analytical thinking
Excellent communication
Ability to lead a small team
```

Phân loại:

```text
JD_REQUIRED_QUALIFICATION
JD_PREFERRED_QUALIFICATION
```

---

# 30. Extraction Rules

Structured Extraction phải tuân thủ:

## Rule EX-01

Không được invent thông tin không tồn tại trong document.

## Rule EX-02

Nếu không chắc:

```text
confidence < extraction_min_confidence
```

phải giữ giá trị nhưng mark:

```text
uncertain = true
```

## Rule EX-03

Mọi extracted field quan trọng phải giữ:

```text
source_text
source_page
confidence
```

## Rule EX-04

Không được drop unknown content.

Unknown content → `CV_OTHER` hoặc `JD_OTHER_REQUIREMENT`.

---

# 31. Normalization

Normalization không được xóa original value.

Mọi normalized field phải giữ:

```text
original_value
normalized_value
```

---

# 32. Skill Normalization

Ví dụ taxonomy:

```text
Postgres
PostgreSQL
postgres sql
→ postgresql
```

```text
AWS
Amazon Web Services
→ aws
```

```text
React.js
ReactJS
React
→ react
```

Nhưng:

```text
Java ≠ JavaScript

C ≠ C++

C++ ≠ C#

.NET ≠ ASP.NET

React ≠ React Native
```

Không được merge chỉ vì tên tương tự.

---

# 33. Job Title Normalization

Output:

```text
original_title
normalized_title
seniority
job_family
```

Ví dụ:

```text
Sr. Backend Developer

normalized_title = backend engineer
seniority = senior
job_family = software_engineering
```

---

# 34. Date Normalization

Format chuẩn:

```text
YYYY-MM
```

Nếu CV ghi:

```text
Present
Current
Now
```

thì:

```json
{
  "end_date": null,
  "is_current": true
}
```

---

# 35. Experience Duration Calculation

Không cộng double khoảng thời gian overlap.

Ví dụ:

```text
Company A: Jan 2022 → Dec 2023
Company B: Jan 2023 → Dec 2024
```

Chronological unique duration:

```text
Jan 2022 → Dec 2024
= 36 tháng
```

Không phải:

```text
24 + 24 = 48 tháng
```

---

# 36. Chunking Strategy

Không sử dụng fixed-token chunking làm chiến lược chính.

Primary strategy:

```text
Semantic / structural chunking
```

Chunk theo meaning.

---

# 37. CV Chunk Types

```text
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

---

# 38. CV Chunk Schema

Mọi chunk phải có:

```json
{
  "chunk_id": "CV_CHUNK_001",
  "candidate_id": "CAND_001",
  "document_id": "DOC_001",

  "chunk_type": "CV_EXPERIENCE",

  "text": "Developed REST APIs using FastAPI and PostgreSQL.",

  "normalized_text": "developed rest api using fastapi and postgresql",

  "source_section": "experience[0]",
  "source_page": 2,

  "metadata": {}
}
```

---

# 39. Chunk Granularity

## CV_SKILL

Có thể group skills có liên quan thành một chunk.

Không tạo 1 vector cho toàn bộ CV.

## CV_EXPERIENCE

Một work experience phải tạo ít nhất 1 chunk.

Nếu description dài:

```text
1 experience
→ 2..N semantic chunks
```

Mỗi chunk vẫn giữ:

```text
experience_id
company
role
date range
```

## CV_PROJECT

Một project → ít nhất 1 chunk.

## CV_EDUCATION

Một education record → 1 chunk.

## CV_CERTIFICATION

Một certification → 1 chunk.

---

# 40. JD Requirement Construction

JD không search dưới dạng toàn bộ document.

Phải convert JD thành danh sách atomic requirements.

Sai:

```text
1 JD = 1 query
```

Đúng:

```text
JD
↓
REQ-001 Python
REQ-002 PostgreSQL
REQ-003 Docker
REQ-004 3 years backend
REQ-005 REST API
REQ-006 Bachelor
REQ-007 AWS preferred
...
```

Mỗi requirement được retrieval độc lập.

---

# 41. Matching Matrix

Retriever không search mọi CV chunk cho mọi JD requirement.

Phải áp dụng matrix sau.

| JD Requirement | CV Chunk được phép search |
|---|---|
| `JD_REQUIRED_SKILL` | `CV_SKILL`, `CV_EXPERIENCE`, `CV_PROJECT`, `CV_CERTIFICATION` |
| `JD_PREFERRED_SKILL` | `CV_SKILL`, `CV_EXPERIENCE`, `CV_PROJECT`, `CV_CERTIFICATION` |
| `JD_EXPERIENCE` | `CV_EXPERIENCE`, `CV_PROJECT` |
| `JD_EDUCATION` | `CV_EDUCATION` |
| `JD_CERTIFICATION` | `CV_CERTIFICATION` |
| `JD_LANGUAGE` | `CV_LANGUAGE`, `CV_CERTIFICATION` |
| `JD_RESPONSIBILITY` | `CV_EXPERIENCE`, `CV_PROJECT` |
| `JD_DOMAIN` | `CV_EXPERIENCE`, `CV_PROJECT`, `CV_SUMMARY` |
| `JD_REQUIRED_QUALIFICATION` | `CV_EXPERIENCE`, `CV_PROJECT`, `CV_SUMMARY`, `CV_CERTIFICATION` |
| `JD_PREFERRED_QUALIFICATION` | `CV_EXPERIENCE`, `CV_PROJECT`, `CV_SUMMARY`, `CV_CERTIFICATION` |
| `JD_LOCATION` | Structured CV profile |
| `JD_WORK_MODE` | Structured CV preference nếu có |
| `JD_EMPLOYMENT_TYPE` | Structured CV preference nếu có |
| `JD_OTHER_REQUIREMENT` | `CV_OTHER`, `CV_SUMMARY`, `CV_EXPERIENCE`, `CV_PROJECT` |

---

# 42. BM25 Index

Index unit:

```text
CV Chunk
```

Indexed fields:

```text
chunk_id
candidate_id
chunk_type
text
normalized_text
metadata
```

Filters:

```text
candidate_id
allowed_chunk_types
```

---

# 43. BM25 Query

Input:

```text
JD Requirement text
```

Output:

```json
[
  {
    "chunk_id": "CV_CHUNK_010",
    "bm25_score": 10.83,
    "bm25_rank": 1
  }
]
```

Default:

```yaml
bm25:
  top_k: 20
```

Không sử dụng BM25 score như percentage.

---

# 44. Embedding

Embedding unit:

```text
CV Chunk
```

Embedding input:

```text
normalized_text
```

Store:

```text
embedding_id
chunk_id
candidate_id
model_name
model_version
vector
created_at
```

---

# 45. Semantic Query

Mỗi JD Requirement được embedding riêng.

```text
JD Requirement
↓
Embedding
↓
Vector Search
```

Filters:

```text
candidate_id
allowed_chunk_types
```

Similarity:

```text
Cosine Similarity
```

Default:

```yaml
semantic:
  top_k: 20
  min_score: 0.45
```

`0.45` là default config, không phải universal constant.

---

# 46. Semantic Result

```json
[
  {
    "chunk_id": "CV_CHUNK_010",
    "semantic_score": 0.91,
    "semantic_rank": 1
  }
]
```

---

# 47. Hybrid Fusion

Version 1 sử dụng:

```text
Reciprocal Rank Fusion
```

Không dùng raw weighted sum của BM25 score và cosine score.

---

# 48. RRF Formula

Với document/chunk `d`:

```text
RRF(d) =
Σ 1 / (k + rank_i(d))
```

Default:

```yaml
hybrid:
  method: rrf
  rrf_k: 60
  top_k: 10
```

Nếu chunk không xuất hiện trong một retriever:

```text
retriever đó không đóng góp score.
```

---

# 49. Hybrid Output

```json
[
  {
    "chunk_id": "CV_CHUNK_010",

    "semantic_score": 0.91,
    "semantic_rank": 1,

    "bm25_score": 10.83,
    "bm25_rank": 2,

    "fusion_score": 0.0325,
    "fusion_rank": 1
  }
]
```

---

# 50. Retrieval Filtering Order

Phải theo thứ tự:

```text
Semantic Search
↓
semantic_min_score
↓
Top-K Semantic

BM25 Search
↓
Top-K BM25

Semantic Results + BM25 Results
↓
RRF
↓
Top-K Hybrid
```

Không làm:

```text
fusion_score < semantic_min_score
```

---

# 51. Evidence Selection

Mỗi JD Requirement chọn tối đa:

```yaml
evidence:
  max_per_requirement: 3
```

Evidence phải ưu tiên:

1. Fusion rank.
2. Semantic relevance.
3. Source quality.
4. Không duplicate.

---

# 52. Evidence Schema

```json
{
  "evidence_id": "EVD_001",

  "requirement_id": "JD_REQ_001",

  "chunk_id": "CV_CHUNK_010",

  "text": "Developed REST APIs using FastAPI.",

  "source_page": 2,
  "source_section": "experience[0]",

  "semantic_score": 0.91,
  "semantic_rank": 1,

  "bm25_score": 10.83,
  "bm25_rank": 2,

  "fusion_score": 0.0325,
  "fusion_rank": 1
}
```

---

# 53. Evidence Status

Mỗi requirement phải được classify:

```text
SUPPORTED
PARTIALLY_SUPPORTED
NOT_FOUND
CONFLICTING
UNCERTAIN
```

Ý nghĩa:

## SUPPORTED

CV có evidence đủ đáp ứng requirement.

## PARTIALLY_SUPPORTED

Có evidence nhưng chưa đáp ứng toàn bộ.

Ví dụ:

```text
JD: 5 years Java
CV: 3 years Java
```

## NOT_FOUND

Không tìm thấy evidence đáng tin cậy.

## CONFLICTING

Evidence tồn tại nhưng mâu thuẫn với requirement.

## UNCERTAIN

Có evidence nhưng extraction/retrieval confidence chưa đủ để kết luận.

---

# 54. Rule khi không có Evidence

Không được viết:

```text
Candidate does not know AWS.
```

Phải viết:

```text
No reliable evidence of AWS experience was found in the CV.
```

Hệ thống chỉ đánh giá dữ liệu được cung cấp.

---

# 55. Skill Match Classification

Một skill match phải classify:

```text
EXACT_MATCH
NORMALIZED_MATCH
SEMANTIC_MATCH
PARTIAL_MATCH
NOT_FOUND
```

## EXACT_MATCH

```text
Python ↔ Python
```

## NORMALIZED_MATCH

```text
AWS ↔ Amazon Web Services
Postgres ↔ PostgreSQL
```

## SEMANTIC_MATCH

Ví dụ responsibility/capability có meaning gần nhau.

Semantic match không được dùng để coi các technology khác nhau là identical.

Ví dụ:

```text
C++ ≠ C#
Java ≠ JavaScript
```

---

# 56. Rubric v1

Default rubric:

| Criterion | Weight |
|---|---:|
| Required Skills | 35 |
| Relevant Experience | 30 |
| Education | 10 |
| Preferred Skills | 10 |
| Domain Experience | 15 |
| **Total** | **100** |

Rubric phải configurable theo Job.

---

# 57. Rubric Configuration Schema

```json
{
  "rubric_id": "RUBRIC_001",
  "version": "1.0",

  "criteria": [
    {
      "criterion_id": "CRIT_REQUIRED_SKILL",
      "weight": 35,
      "enabled": true
    }
  ]
}
```

Validation:

```text
Sum(enabled weights) = 100
```

Nếu không bằng 100:

```text
RUBRIC_INVALID_WEIGHT
```

---

# 58. Required Skill Scoring

Với mỗi required skill:

```text
EXACT_MATCH       = 1.00
NORMALIZED_MATCH  = 1.00
SEMANTIC_MATCH    = 0.80
PARTIAL_MATCH     = 0.50
NOT_FOUND         = 0.00
```

Raw required-skill score:

```text
Σ individual skill score
────────────────────────
number of required skills
× 100
```

Weighted:

```text
required_skill_points
=
raw_score / 100 × criterion_weight
```

---

# 59. Preferred Skill Scoring

Sử dụng cùng match factors:

```text
EXACT_MATCH       1.00
NORMALIZED_MATCH  1.00
SEMANTIC_MATCH    0.80
PARTIAL_MATCH     0.50
NOT_FOUND         0
```

Preferred skills không được trigger mandatory failure.

---

# 60. Experience Scoring

Đầu tiên xác định:

```text
required_years
candidate_relevant_years
```

Relevant experience phải liên quan tới role/skill/domain requirement.

Formula:

```text
experience_ratio =
min(
  candidate_relevant_years / required_years,
  1
)
```

Raw score:

```text
experience_ratio × 100
```

Weighted:

```text
raw_score / 100 × experience_weight
```

Nếu JD không quy định minimum years:

Evaluation dựa trên relevant experience coverage thay vì tự gán 0 years.

---

# 61. Experience Relevance

Không tính toàn bộ career experience khi JD yêu cầu experience cụ thể.

Ví dụ:

```text
JD:
3 years Java

CV:
5 years total engineering
1 year Java
```

Relevant Java experience:

```text
1 year
```

không phải 5 years.

---

# 62. Education Scoring

Degree hierarchy:

```text
high_school = 1
associate   = 2
bachelor    = 3
master      = 4
doctorate   = 5
```

Nếu:

```text
candidate_degree >= required_degree
```

→ Degree component full.

Major relevance được đánh riêng.

Default education breakdown:

```text
degree = 70%
major relevance = 30%
```

Ví dụ:

```text
Bachelor Computer Science
vs
Bachelor Computer Science

= 100
```

---

# 63. Education Not Required

Nếu JD không có education requirement:

Criterion `Education` phải:

```text
enabled = false
```

Sau đó redistribute weights hoặc sử dụng job-specific rubric.

Không được tự cho candidate 10/10.

---

# 64. Domain Experience Scoring

Dựa trên:

```text
CV_EXPERIENCE
CV_PROJECT
CV_SUMMARY
```

Evidence phải chứng minh candidate từng làm trong domain hoặc problem space tương ứng.

Nếu JD không có domain requirement:

```text
criterion disabled
```

---

# 65. Certification Scoring

Certification chỉ được tính khi rubric/job có requirement tương ứng.

`required certification` có thể:

- Gộp vào Required Qualification.
- Hoặc tạo criterion riêng.

Không tự động cộng điểm chỉ vì CV có nhiều certification.

---

# 66. Mandatory Requirements

Requirement có:

```text
mandatory = true
```

Nếu status:

```text
NOT_FOUND
CONFLICTING
```

thì:

```json
{
  "mandatory_requirement_failed": true
}
```

Version 1:

Mandatory failure **không tự động final_score = 0**.

Output phải cảnh báo rõ.

Decision tuyển/loại thuộc business layer.

---

# 67. Criterion Evaluation Schema

```json
{
  "criterion_id": "CRIT_EXPERIENCE",

  "raw_score": 100,

  "weight": 30,

  "weighted_score": 30,

  "status": "SUPPORTED",

  "reason": "Candidate has 3 years of relevant backend experience; JD requires at least 2 years.",

  "requirement_ids": [
    "JD_REQ_010"
  ],

  "evidence_ids": [
    "EVD_004"
  ]
}
```

---

# 68. Final Score

Formula:

```text
Final Score =
Σ criterion.weighted_score
```

Range:

```text
0 ≤ final_score ≤ 100
```

Round:

```yaml
score_decimal_places: 1
```

---

# 69. Rating

Default:

```text
0.0  – 49.9 → POOR
50.0 – 69.9 → AVERAGE
70.0 – 84.9 → GOOD
85.0 – 100  → EXCELLENT
```

Configurable.

---

# 70. Match Summary

Final result phải classify requirements thành:

```text
matched_requirements
partial_requirements
missing_requirements
uncertain_requirements
```

---

# 71. Explanation Rules

Explanation chỉ được tạo từ:

```text
Structured CV data
JD requirement
Evidence
Criterion result
```

Không được tự bổ sung kiến thức về candidate.

Explanation phải trả lời:

```text
1. Candidate đáp ứng gì?
2. Candidate thiếu gì?
3. Evidence nằm ở đâu?
4. Tại sao criterion có điểm này?
```

---

# 72. Final Match Response

```json
{
  "match_id": "MATCH_001",
  "candidate_id": "CAND_001",
  "job_id": "JOB_001",

  "status": "COMPLETED",

  "final_score": 77.0,
  "rating": "GOOD",

  "mandatory_requirement_failed": false,

  "criteria": [
    {
      "criterion_id": "CRIT_REQUIRED_SKILL",
      "raw_score": 77.1,
      "weight": 35,
      "weighted_score": 27.0,
      "reason": "..."
    }
  ],

  "requirements": {
    "matched": [],
    "partial": [],
    "missing": [],
    "uncertain": []
  },

  "matched_skills": [
    "python",
    "postgresql",
    "docker"
  ],

  "missing_skills": [
    "kubernetes"
  ],

  "evidence": [],

  "warnings": [],

  "versions": {
    "pipeline": "1.0",
    "schema": "1.0",
    "normalization": "1.0",
    "embedding_model": "...",
    "rubric": "1.0",
    "scoring": "1.0"
  },

  "created_at": "..."
}
```

---

# 73. Processing State

Match job phải có state machine:

```text
PENDING
↓
PARSING
↓
EXTRACTING
↓
NORMALIZING
↓
CHUNKING
↓
INDEXING
↓
RETRIEVING
↓
EVALUATING
↓
COMPLETED
```

Error ở bất kỳ bước nào:

```text
FAILED
```

Không quay lại `PENDING`.

---

# 74. API Specification

## 74.1 Upload Candidate CV

```text
POST /api/v1/candidates/{candidate_id}/cv
```

Content:

```text
multipart/form-data
```

Response:

```json
{
  "document_id": "DOC_001",
  "status": "UPLOADED"
}
```

---

# 75. Create / Upload Job

```text
POST /api/v1/jobs
```

Hỗ trợ:

```text
multipart file
```

hoặc:

```json
{
  "title": "Backend Engineer",
  "description": "..."
}
```

Response:

```json
{
  "job_id": "JOB_001"
}
```

---

# 76. Start Match

```text
POST /api/v1/matches
```

Request:

```json
{
  "candidate_id": "CAND_001",
  "job_id": "JOB_001",
  "rubric_id": "RUBRIC_001"
}
```

Response:

```json
{
  "match_id": "MATCH_001",
  "status": "PENDING"
}
```

---

# 77. Get Match

```text
GET /api/v1/matches/{match_id}
```

Trả:

```text
status
final_score
criteria
requirements
summary
```

---

# 78. Get Match Evidence

```text
GET /api/v1/matches/{match_id}/evidence
```

Có thể filter:

```text
requirement_id
criterion_id
```

---

# 79. Get Match Report

```text
GET /api/v1/matches/{match_id}/report
```

Return:

```text
JSON
```

PDF report là optional layer.

---

# 80. Configuration

Central config phải có tối thiểu:

```yaml
document:
  max_file_size_mb: 20
  max_pages: 20

extraction:
  min_confidence: 0.50

bm25:
  top_k: 20

semantic:
  top_k: 20
  min_score: 0.45

hybrid:
  method: rrf
  rrf_k: 60
  top_k: 10

evidence:
  max_per_requirement: 3

scoring:
  decimal_places: 1

rating:
  poor_max: 49.9
  average_max: 69.9
  good_max: 84.9
```

---

# 81. Model Configuration

Không hard-code model name trong business logic.

Config:

```yaml
models:
  extraction_model: "..."
  embedding_model: "..."
```

Final Match Result phải lưu model/version đã sử dụng.

---

# 82. Error Model

Standard response:

```json
{
  "error": {
    "code": "PARSER_001",
    "message": "Unsupported file format",
    "retryable": false
  }
}
```

---

# 83. Error Groups

```text
UPLOAD_xxx
PARSER_xxx
OCR_xxx
EXTRACTION_xxx
NORMALIZATION_xxx
CHUNKING_xxx
BM25_xxx
EMBEDDING_xxx
VECTOR_xxx
FUSION_xxx
EVIDENCE_xxx
RUBRIC_xxx
EVALUATION_xxx
MATCH_xxx
```

---

# 84. Minimum Error Codes

```text
UPLOAD_001
File too large

UPLOAD_002
Unsupported file format

PARSER_001
Parsing failed

PARSER_002
Empty document

PARSER_003
Password protected PDF

OCR_001
OCR failed

EXTRACTION_001
Structured extraction failed

EXTRACTION_002
Schema validation failed

EMBEDDING_001
Embedding generation failed

VECTOR_001
Vector index unavailable

BM25_001
BM25 index unavailable

FUSION_001
Fusion failed

RUBRIC_001
Rubric weights invalid

EVALUATION_001
Evaluation failed

MATCH_001
Match not found
```

---

# 85. Persistence Requirements

Hệ thống phải có khả năng lưu:

```text
Original CV

Original JD

Parsed raw text

Structured CV JSON

Structured JD JSON

Normalized CV

Normalized JD

CV Chunks

JD Requirements

Embeddings

Retrieval results

Evidence

Rubric

Criterion evaluations

Final match result
```

---

# 86. Traceability

Mỗi Match phải trace được:

```text
Final Score
↓
Criterion
↓
Requirement
↓
Evidence
↓
CV Chunk
↓
Source Page
↓
Original CV
```

Nếu một score không trace được theo chain này thì result không hợp lệ.

---

# 87. Versioning

Phải version:

```text
pipeline_version
cv_schema_version
jd_schema_version
normalization_version
chunking_version
embedding_model_version
retrieval_version
rubric_version
scoring_version
```

---

# 88. Reproducibility

Nếu cùng:

```text
CV
JD
Config
Rubric
Model version
Pipeline version
```

thì kết quả deterministic component phải giống nhau.

LLM-based extraction/evaluation nếu không hoàn toàn deterministic phải lưu:

```text
model
version
temperature
prompt_version
```

để debug.

---

# 89. Logging

Log tối thiểu:

```text
trace_id
match_id
candidate_id
job_id
pipeline_step
status
start_time
end_time
duration_ms
error_code
```

Không log full CV vào application log thông thường.

---

# 90. Metrics

Theo dõi:

```text
upload_failure_rate

parse_success_rate
ocr_success_rate

extraction_success_rate
extraction_schema_failure_rate

average_chunk_count

embedding_failure_rate

semantic_empty_result_rate
bm25_empty_result_rate

evidence_not_found_rate

evaluation_failure_rate

match_completed_rate

match_latency_p50
match_latency_p95
match_latency_p99
```

---

# 91. Security

Bắt buộc:

```text
Authentication
Authorization
HTTPS/TLS
Encryption at rest
File type validation
File size validation
Malware scanning
PII access control
Audit logging
Data deletion support
```

Candidate data không được accessible giữa tenant khác nhau nếu hệ thống multi-tenant.

---

# 92. Sensitive Fields

Các field sau không được đưa vào matching/rubric mặc định:

```text
candidate name
email
phone
photo
date of birth
gender
marital status
nationality
```

Trừ những trường hợp pháp lý/business rule rõ ràng và được phép.

---

# 93. Edge Cases — Parsing

Hệ thống phải xử lý:

```text
PDF 2-column

Scanned PDF

CV có table

CV có icon

CV không có section title

CV rất ngắn

CV > 1 ngôn ngữ

DOCX lỗi formatting

Image chất lượng thấp

PDF có text + scanned page

Empty PDF

Password protected PDF
```

---

# 94. Edge Cases — CV

```text
Không có skills section

Không có work experience

Không có education

Có skill nhưng không có evidence dùng skill

Experience overlap

Freelance experience

Multiple roles cùng company

Current job

Project không có date

Certification hết hạn

Skill viết acronym

Technology name gần giống nhau
```

---

# 95. Edge Cases — JD

```text
Không có required skill

Không có years of experience

Không có education requirement

Required và preferred trộn chung

Cùng một skill xuất hiện required và preferred

Requirement nằm trong paragraph dài

JD có duplicated requirement

JD có contradictory requirements

JD chỉ gồm responsibilities
```

---

# 96. Edge Cases — Retrieval

```text
BM25 có result, Semantic không có

Semantic có result, BM25 không có

Hai retriever cùng trả một chunk

Semantic similarity cao nhưng technology sai

BM25 keyword cao nhưng context không phù hợp

Không có evidence nào đạt semantic threshold

Có nhiều evidence duplicate
```

---

# 97. Edge Cases — Evaluation

```text
JD yêu cầu 5 năm, CV có 3 năm

JD yêu cầu Java, CV có JavaScript

JD yêu cầu C++, CV có C#

JD yêu cầu AWS, CV ghi Amazon Web Services

JD yêu cầu PostgreSQL, CV ghi Postgres

JD yêu cầu Bachelor, candidate có Master

JD không yêu cầu Education

Preferred skill bị thiếu

Mandatory certification bị thiếu
```

---

# 98. Acceptance Criteria — Parsing

**AC-PARSE-01**

PDF text-based hợp lệ phải extract được text.

**AC-PARSE-02**

Scanned PDF phải đi qua OCR.

**AC-PARSE-03**

Output phải giữ page number.

**AC-PARSE-04**

File unsupported phải fail với error code.

---

# 99. Acceptance Criteria — Extraction

**AC-EXT-01**

Structured CV phải conform CV schema.

**AC-EXT-02**

Structured JD phải conform JD schema.

**AC-EXT-03**

Không được invent dữ liệu không có trong document.

**AC-EXT-04**

Field quan trọng phải có source reference.

**AC-EXT-05**

Unknown content không được drop.

---

# 100. Acceptance Criteria — Normalization

**AC-NORM-01**

AWS và Amazon Web Services phải normalize cùng canonical value.

**AC-NORM-02**

Postgres và PostgreSQL phải normalize cùng canonical value.

**AC-NORM-03**

Java và JavaScript không được normalize thành cùng skill.

**AC-NORM-04**

C++ và C# không được normalize cùng skill.

---

# 101. Acceptance Criteria — Chunking

**AC-CHUNK-01**

Không embedding toàn bộ CV thành một vector duy nhất.

**AC-CHUNK-02**

Mỗi experience phải có chunk riêng.

**AC-CHUNK-03**

Mỗi chunk phải có source page hoặc source section.

**AC-CHUNK-04**

Mỗi chunk phải có unique `chunk_id`.

---

# 102. Acceptance Criteria — Retrieval

**AC-RET-01**

Mỗi JD requirement được search độc lập.

**AC-RET-02**

Retriever chỉ search allowed CV chunk type theo Matching Matrix.

**AC-RET-03**

Semantic score phải được giữ độc lập.

**AC-RET-04**

BM25 score phải được giữ độc lập.

**AC-RET-05**

RRF score phải được lưu vào `fusion_score`.

**AC-RET-06**

Không sử dụng semantic threshold cho fusion score.

---

# 103. Acceptance Criteria — Evidence

**AC-EVD-01**

Mỗi evidence phải reference `requirement_id`.

**AC-EVD-02**

Mỗi evidence phải reference `chunk_id`.

**AC-EVD-03**

Evidence phải trace được về CV.

**AC-EVD-04**

Không có evidence thì output phải là `NOT_FOUND`, không fabricate.

---

# 104. Acceptance Criteria — Scoring

**AC-SCORE-01**

Final score phải nằm trong:

```text
0..100
```

**AC-SCORE-02**

Rubric enabled weights phải bằng 100%.

**AC-SCORE-03**

Final score phải bằng tổng weighted criterion score.

**AC-SCORE-04**

Missing preferred skill không được trigger mandatory failure.

**AC-SCORE-05**

Relevant experience phải tính theo requirement, không dùng total career experience một cách mù quáng.

---

# 105. Acceptance Criteria — Explainability

**AC-EXP-01**

Mỗi scored criterion phải có reason.

**AC-EXP-02**

Reason phải có evidence hoặc structured-data source.

**AC-EXP-03**

Missing requirement phải ghi là không tìm thấy evidence thay vì khẳng định candidate không có năng lực đó.

---

# 106. Definition of Done

Feature `CV–JD Matching & Evaluation` được xem là hoàn thành khi:

```text
✓ Upload được CV/JD.

✓ Parse/OCR thành công các format supported.

✓ Extract được Structured CV/JD.

✓ Structured data conform schema.

✓ Normalize đúng taxonomy.

✓ Chunk CV đúng semantic structure.

✓ JD được tách thành atomic requirements.

✓ BM25 Retrieval hoạt động theo từng requirement.

✓ Semantic Retrieval hoạt động theo từng requirement.

✓ Matching Matrix được áp dụng.

✓ RRF fusion hoạt động.

✓ Evidence được map requirement → CV source.

✓ Evidence có traceability.

✓ Rubric evaluation hoạt động.

✓ Final score 0–100.

✓ Final score trace về criterion.

✓ Criterion trace về requirement.

✓ Requirement trace về evidence.

✓ Evidence trace về original CV.

✓ Error handling hoạt động.

✓ Logging hoạt động.

✓ Acceptance tests pass.
```

---

# 107. Recommended Module Boundaries

Backend nên chia logic tối thiểu thành:

```text
DocumentService

ParserService

OCRService

CVExtractionService

JDExtractionService

NormalizationService

ChunkingService

RequirementService

BM25Service

EmbeddingService

VectorSearchService

HybridFusionService

EvidenceService

RubricService

EvaluationService

MatchService

ExplanationService

ReportService
```

Không nên đặt toàn bộ pipeline vào một `MatchService`.

---

# 108. Core Domain Models

Tối thiểu phải có:

```text
Candidate

Job

Document

StructuredCV

StructuredJD

CVChunk

JDRequirement

RetrievalResult

Evidence

Rubric

RubricCriterion

CriterionEvaluation

Match

MatchResult
```

---

# 109. Database Entities

Minimum persistence:

```text
candidates

jobs

documents

cv_profiles

cv_experiences

cv_projects

cv_skills

cv_education

cv_certifications

cv_languages

cv_chunks

jd_requirements

rubrics

rubric_criteria

matches

retrieval_results

evidences

criterion_evaluations

match_results
```

Vector storage có thể nằm ở Vector DB thay vì relational DB.

---

# 110. End-to-End Processing Contract

Một match hoàn chỉnh phải tuân thủ:

```text
candidate_id + job_id
        ↓
Load CV/JD
        ↓
Validate Parsed Data
        ↓
Validate Structured Data
        ↓
Normalize
        ↓
Build CV Chunks
        ↓
Build JD Requirements
        ↓
Create/Search BM25 Index
        ↓
Create/Search Vector Index
        ↓
For each JD Requirement:
    ↓
    BM25 Search
    +
    Semantic Search
    ↓
    RRF
    ↓
    Evidence Selection
        ↓
Evaluate Rubric
        ↓
Calculate Final Score
        ↓
Generate Explanation
        ↓
Persist Match Result
        ↓
COMPLETED
```

---

# 111. Quy tắc quan trọng nhất của hệ thống

```text
Requirement là đơn vị QUERY.

CV Chunk là đơn vị RETRIEVAL.

Evidence là đơn vị PROOF.

Criterion là đơn vị EVALUATION.

Final Score là kết quả AGGREGATION.
```

Do đó:

```text
JD Requirement
      ↓
Retrieve
      ↓
CV Evidence
      ↓
Evaluate
      ↓
Criterion Score
      ↓
Aggregate
      ↓
Final Score
```

Đây là contract kiến trúc của version 1.0 và các module implementation phải tuân thủ contract này.