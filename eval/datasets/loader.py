"""Benchmark dataset loader and schema validation for CV-JD evaluation."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

VALID_ELIGIBILITY = {"ELIGIBLE", "UNKNOWN", "NOT_ELIGIBLE"}
VALID_SPLITS = {"dev", "holdout", "all"}


@dataclass
class CandidateCase:
    cv_id: str
    cv_text: str
    cv_parsed: dict[str, Any]
    human_relevance: int  # 0 to 4
    eligibility: str = "ELIGIBLE"
    edge_case_tags: list[str] = field(default_factory=list)
    notes: str = ""

    def validate(self) -> None:
        if not (0 <= self.human_relevance <= 4):
            raise ValueError(
                f"Candidate {self.cv_id} has invalid human_relevance {self.human_relevance}. "
                f"Must be an integer in 0..4."
            )
        if self.eligibility not in VALID_ELIGIBILITY:
            raise ValueError(
                f"Candidate {self.cv_id} has invalid eligibility '{self.eligibility}'. "
                f"Must be one of {VALID_ELIGIBILITY}."
            )


@dataclass
class JobBenchmarkCase:
    job_id: str
    title: str
    domain: str
    seniority: str
    raw_jd_text: str
    requirements: list[dict[str, Any]]
    candidates: list[CandidateCase]
    split: Literal["dev", "holdout"] = "dev"
    notes: str = ""

    def validate(self) -> None:
        if not self.candidates:
            raise ValueError(f"Job {self.job_id} must have at least one candidate.")
        if self.split not in {"dev", "holdout"}:
            raise ValueError(f"Job {self.job_id} split must be 'dev' or 'holdout', got '{self.split}'.")
        for cand in self.candidates:
            cand.validate()


@dataclass
class BenchmarkDataset:
    dataset_version: str
    description: str
    jobs: list[JobBenchmarkCase]

    def get_split(self, split_name: str) -> list[JobBenchmarkCase]:
        if split_name not in VALID_SPLITS:
            raise ValueError(f"Unknown split '{split_name}'. Must be one of {VALID_SPLITS}.")
        if split_name == "all":
            return self.jobs
        return [j for j in self.jobs if j.split == split_name]

    @property
    def total_candidates(self) -> int:
        return sum(len(j.candidates) for j in self.jobs)


def load_benchmark_dataset(file_path: str | Path) -> BenchmarkDataset:
    """Load and validate benchmark dataset from a JSON file."""
    path = Path(file_path)
    if not path.is_file():
        raise FileNotFoundError(f"Benchmark dataset file not found: {path}")

    raw_data = json.loads(path.read_text(encoding="utf-8"))
    dataset_version = str(raw_data.get("dataset_version", "1.0"))
    description = str(raw_data.get("description", ""))

    jobs: list[JobBenchmarkCase] = []
    for raw_job in raw_data.get("jobs", []):
        candidates = [
            CandidateCase(
                cv_id=str(c["cv_id"]),
                cv_text=str(c["cv_text"]),
                cv_parsed=dict(c.get("cv_parsed", {})),
                human_relevance=int(c["human_relevance"]),
                eligibility=str(c.get("eligibility", "ELIGIBLE")),
                edge_case_tags=list(c.get("edge_case_tags", [])),
                notes=str(c.get("notes", "")),
            )
            for c in raw_job.get("candidates", [])
        ]
        job_case = JobBenchmarkCase(
            job_id=str(raw_job["job_id"]),
            title=str(raw_job["title"]),
            domain=str(raw_job.get("domain", "general")),
            seniority=str(raw_job.get("seniority", "mid")),
            raw_jd_text=str(raw_job.get("raw_jd_text", "")),
            requirements=list(raw_job.get("requirements", [])),
            candidates=candidates,
            split=raw_job.get("split", "dev"),
            notes=str(raw_job.get("notes", "")),
        )
        job_case.validate()
        jobs.append(job_case)

    dataset = BenchmarkDataset(
        dataset_version=dataset_version,
        description=description,
        jobs=jobs,
    )
    return dataset
