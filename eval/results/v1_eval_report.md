# 📊 V1 CV–JD Matching Engine Audit & Benchmark Report

- **Run Timestamp (UTC)**: `2026-08-29T08:18:28.147642+00:00`
- **Pipeline Version**: `1.0`
- **Total Benchmark Cases**: `2` (`1` REAL, `1` SYNTHETIC)

## 1. Executive Summary & REAL vs SYNTHETIC Performance

| Metric Domain | Metric Name | OVERALL | REAL Data | SYNTHETIC Data | Description |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Retrieval** | Recall@1 (RRF) | `0.0714` | `0.0000` | `0.1000` | Evidence chunk in Top 1 |
| **Retrieval** | Recall@3 (RRF) | `0.8571` | `1.0000` | `0.8000` | Evidence chunk in Top 3 |
| **Retrieval** | Recall@5 (RRF) | `0.9286` | `1.0000` | `0.9000` | Evidence chunk in Top 5 |
| **Retrieval** | MRR | `0.5238` | `0.4167` | `0.5667` | Mean Reciprocal Rank |
| **Retrieval** | nDCG@5 | `0.6117` | `0.5655` | `0.6302` | Graded ranking quality Top-5 |
| **Evidence Relation** | Macro F1 | `0.7949` | `0.6667` | `1.0000` | Unweighted F1 across 6 relations |
| **Evidence Relation** | Weighted F1 | `0.8910` | `0.6667` | `1.0000` | Support-weighted F1 |
| **Evidence Relation** | NO_EVIDENCE FP Rate | `0.00%` | `0.00%` | `0.00%` | Hallucinated evidence rate |
| **Evidence Relation** | Evidence FN Rate | `14.29%` | `50.00%` | `0.00%` | Missed evidence rate |
| **Evidence Relation** | INFERRED F1 | `0.0000` | `0.0000` | `0.0000` | Semantic inference precision/recall |
| **Evidence Relation** | ADJACENT F1 | `0.0000` | `0.0000` | `0.0000` | Related skill precision/recall |
| **Requirement Outcome** | Macro F1 | `1.0000` | `1.0000` | `1.0000` | Outcome (SATISFIED/PARTIAL/etc) |
| **Requirement Outcome** | Accuracy | `100.00%` | `100.00%` | `100.00%` | Exact outcome accuracy |
| **Critical Gap** | Precision | `1.0000` | `1.0000` | `0.0000` | Blocker detection precision |
| **Critical Gap** | Recall | `1.0000` | `1.0000` | `0.0000` | Blocker detection recall |
| **Critical Gap** | F1-Score | `1.0000` | `1.0000` | `0.0000` | Harmonic mean blocker F1 |
| **Boolean Logic** | Group Accuracy | `0.00%` | `0.00%` | `0.00%` | ANY_OF / ALL_OF accuracy |
| **Overall Rating (0..100)** | Spearman $\rho$ | `1.0000` | `0.0000` | `0.0000` | Monotonic rank alignment |
| **Overall Rating (0..100)** | Score MAE | `4.95` | `0.00` | `0.00` | Mean Absolute Error (pts) |

## 2. Multi-Layer Retrieval Progression Breakdown

| Retrieval Stage | Recall@1 | Recall@3 | Recall@5 | MRR | nDCG@5 | Evaluated Queries |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Lexical BM25 Search** | `0.0000` | `0.8571` | `0.9286` | `0.4524` | `0.5866` | `7` |
| **2. Dense Vector Search** | `0.0714` | `0.0714` | `0.0714` | `0.1429` | `0.0876` | `7` |
| **3. RRF Hybrid Fusion** | `0.0714` | `0.8571` | `0.9286` | `0.5238` | `0.6117` | `7` |
| **4. Final Evidence Selection** | `0.7143` | `0.9286` | `0.9286` | `1.0000` | `0.9103` | `7` |

## 3. Evidence Relation Confusion Matrix

| Ground Truth \ Engine Predicted | DIRECT | EQUIVALENT | INFERRED | ADJACENT | WEAK_EVIDENCE | NO_EVIDENCE |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **DIRECT** | 6 | 0 | 0 | 0 | 0 | 1 |
| **EQUIVALENT** | 0 | 0 | 0 | 0 | 0 | 0 |
| **INFERRED** | 0 | 0 | 0 | 0 | 0 | 0 |
| **ADJACENT** | 0 | 0 | 0 | 0 | 0 | 0 |
| **WEAK_EVIDENCE** | 0 | 0 | 0 | 0 | 0 | 0 |
| **NO_EVIDENCE** | 0 | 0 | 0 | 0 | 0 | 1 |

## 4. Requirement Outcome Confusion Matrix

| Ground Truth \ Engine Predicted | SATISFIED | PARTIAL | UNSATISFIED | UNKNOWN |
| :--- | :---: | :---: | :---: | :---: |
| **SATISFIED** | 6 | 0 | 0 | 0 |
| **PARTIAL** | 0 | 0 | 0 | 0 |
| **UNSATISFIED** | 0 | 0 | 2 | 0 |
| **UNKNOWN** | 0 | 0 | 0 | 0 |

## 6. Failure Analysis Breakdown

Total Prediction Mismatches: **1** / 8 requirements (Mismatch Rate: `12.50%`)

| Failure Category | Count | Share | Description |
| :--- | :---: | :---: | :--- |
| `PARSING_ERROR` | **0** | `0.0%` | PARSING_ERROR |
| `RETRIEVAL_MISS` | **0** | `0.0%` | RETRIEVAL_MISS |
| `RERANKING_ERROR` | **0** | `0.0%` | RERANKING_ERROR |
| `SEMANTIC_VALIDATION_ERROR` | **1** | `100.0%` | SEMANTIC_VALIDATION_ERROR |
| `BOOLEAN_GROUP_ERROR` | **0** | `0.0%` | BOOLEAN_GROUP_ERROR |
| `SCORING_ERROR` | **0** | `0.0%` | SCORING_ERROR |
| `EXPLANATION_ERROR` | **0** | `0.0%` | EXPLANATION_ERROR |

### Detailed Failure Diagnostics (Top Root Causes)

| Case ID | Requirement | Human Rel / Out | Engine Rel / Out | Score | Failure Category | Reason |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `CASE_SAMPLE_002_DURATION_GAP` | REQ_PY_EXP (Python Experience) | **DIRECT / UNSATISFIED** | **NO_EVIDENCE / UNSATISFIED** | `0.00` | `SEMANTIC_VALIDATION_ERROR` | Phân loại quan hệ ngữ nghĩa sai: Ground truth là 'DIRECT', matcher phân loại thành 'NO_EVIDENCE'. |
