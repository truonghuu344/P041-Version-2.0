"""Human JD Annotation Web Application (Layer A).

Lightweight, interactive UI for reviewing and adjudicating JD ground truth requirements
and Boolean logical groups with atomic saving and schema validation.

Launch with:
    python -m eval.v1_eval.jd_annotation_app
or:
    uvicorn eval.v1_eval.jd_annotation_app:app --port 8501 --reload
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
import uvicorn

from eval.v1_eval.annotation_workspace import (
    allocate_next_gold_grp_id,
    allocate_next_gold_req_id,
    get_jd_annotation_status,
    save_jd_annotations_atomically,
    validate_jd_ground_truth,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("jd_annotation_app")

DATASET_PATH = Path("eval/datasets/real_jd_requirement_annotations_v1.json")

app = FastAPI(title="JD Ground Truth Annotation App (Layer A)")


def _load_dataset() -> list[dict[str, Any]]:
    if not DATASET_PATH.exists():
        raise HTTPException(status_code=404, detail=f"Dataset not found at {DATASET_PATH}")
    return json.loads(DATASET_PATH.read_text(encoding="utf-8"))


@app.get("/api/status")
def api_status():
    status = get_jd_annotation_status(DATASET_PATH)
    return JSONResponse(status)


@app.get("/api/jds")
def api_list_jds():
    jds = _load_dataset()
    summary = []
    for idx, jd in enumerate(jds):
        summary.append({
            "index": idx,
            "jd_id": jd.get("jd_id"),
            "jd_title": jd.get("jd_title"),
            "company_name": jd.get("company_name"),
            "domain_category": jd.get("domain_category"),
            "review_status": jd.get("review_status", "PENDING"),
            "adjudicated": bool(jd.get("adjudicated", False)),
            "proposed_count": len(jd.get("proposed_requirements", [])),
            "reviewed_count": len(jd.get("reviewed_requirements", [])),
        })
    return JSONResponse({"jds": summary, "total": len(summary)})


@app.get("/api/jds/{jd_index}")
def api_get_jd(jd_index: int):
    jds = _load_dataset()
    if jd_index < 0 or jd_index >= len(jds):
        raise HTTPException(status_code=404, detail="JD index out of bounds")
    return JSONResponse(jds[jd_index])


@app.post("/api/jds/{jd_index}/allocate-req-id")
def api_allocate_req_id(jd_index: int):
    jds = _load_dataset()
    if jd_index < 0 or jd_index >= len(jds):
        raise HTTPException(status_code=404, detail="JD index out of bounds")
    jd = jds[jd_index]
    new_id = allocate_next_gold_req_id(jd)
    save_jd_annotations_atomically(jds, DATASET_PATH, create_backup=False)
    return JSONResponse({"gold_requirement_id": new_id})


@app.post("/api/jds/{jd_index}/allocate-grp-id")
def api_allocate_grp_id(jd_index: int):
    jds = _load_dataset()
    if jd_index < 0 or jd_index >= len(jds):
        raise HTTPException(status_code=404, detail="JD index out of bounds")
    jd = jds[jd_index]
    new_id = allocate_next_gold_grp_id(jd)
    save_jd_annotations_atomically(jds, DATASET_PATH, create_backup=False)
    return JSONResponse({"gold_group_id": new_id})


@app.post("/api/jds/{jd_index}/save")
async def api_save_jd(jd_index: int, request: Request):
    jds = _load_dataset()
    if jd_index < 0 or jd_index >= len(jds):
        raise HTTPException(status_code=404, detail="JD index out of bounds")

    updated_jd = await request.json()
    errors = validate_jd_ground_truth(updated_jd)
    if errors:
        return JSONResponse({"success": False, "errors": errors}, status_code=400)

    jds[jd_index] = updated_jd
    try:
        save_jd_annotations_atomically(jds, DATASET_PATH, create_backup=True)
    except Exception as exc:
        return JSONResponse({"success": False, "errors": [str(exc)]}, status_code=500)

    return JSONResponse({"success": True, "message": f"JD {updated_jd.get('jd_id')} saved and backed up successfully."})


@app.get("/", response_class=HTMLResponse)
def index_page():
    return HTMLResponse(r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>JD Ground Truth Annotation Tool (Layer A)</title>
<style>
  :root {
    --bg: #0f172a; --panel: #1e293b; --card: #334155; --text: #f8fafc; --muted: #94a3b8;
    --primary: #38bdf8; --success: #4ade80; --warning: #facc15; --danger: #f87171; --border: #475569;
  }
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  body { background: var(--bg); color: var(--text); margin: 0; padding: 0; display: flex; height: 100vh; overflow: hidden; }
  
  /* Sidebar */
  #sidebar { width: 320px; background: var(--panel); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
  #sidebar-header { padding: 16px; border-bottom: 1px solid var(--border); }
  #sidebar-header h2 { margin: 0 0 8px 0; font-size: 18px; color: var(--primary); }
  #progress-bar { background: #000; border-radius: 6px; height: 12px; overflow: hidden; margin-top: 8px; }
  #progress-fill { background: var(--success); height: 100%; width: 0%; transition: width 0.3s; }
  #jd-list { overflow-y: auto; flex: 1; padding: 8px; }
  .jd-item { padding: 10px; margin-bottom: 6px; border-radius: 6px; background: var(--card); cursor: pointer; border: 1px solid transparent; }
  .jd-item:hover { border-color: var(--primary); }
  .jd-item.active { background: #0284c7; border-color: #fff; }
  .jd-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 4px; font-weight: bold; }
  .badge-pending { background: #64748b; }
  .badge-completed { background: var(--success); color: #000; }

  /* Main Workspace */
  #main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  #topbar { padding: 12px 24px; background: var(--panel); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
  #content { flex: 1; display: flex; overflow: hidden; padding: 16px; gap: 16px; }
  
  /* Left Panel: Raw JD & Metadata */
  .col-left { width: 38%; background: var(--panel); border-radius: 8px; border: 1px solid var(--border); display: flex; flex-direction: column; padding: 16px; }
  .jd-text-box { flex: 1; background: #090d16; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 12px; line-height: 1.5; color: #cbd5e1; overflow-y: auto; white-space: pre-wrap; margin-top: 8px; border: 1px solid #1e293b; }

  /* Right Panel: Proposals & Gold Review */
  .col-right { flex: 1; background: var(--panel); border-radius: 8px; border: 1px solid var(--border); display: flex; flex-direction: column; padding: 16px; overflow-y: auto; }
  
  /* Requirements and Groups */
  .section-title { font-size: 16px; font-weight: bold; color: var(--primary); margin: 0 0 12px 0; display: flex; justify-content: space-between; align-items: center; }
  .card-item { background: var(--card); border: 1px solid var(--border); border-radius: 6px; padding: 12px; margin-bottom: 12px; }
  .card-item.removed { opacity: 0.5; border-color: var(--danger); }
  .row-field { display: flex; gap: 10px; margin-bottom: 8px; align-items: center; }
  .row-field label { width: 140px; font-size: 12px; color: var(--muted); font-weight: bold; }
  .row-field input, .row-field select, .row-field textarea { flex: 1; background: #0f172a; border: 1px solid var(--border); color: #fff; padding: 6px 8px; border-radius: 4px; font-size: 13px; }
  
  /* Buttons */
  .btn { padding: 6px 12px; border-radius: 4px; border: none; font-weight: bold; cursor: pointer; font-size: 12px; transition: opacity 0.2s; }
  .btn:hover { opacity: 0.85; }
  .btn-primary { background: var(--primary); color: #000; }
  .btn-success { background: var(--success); color: #000; }
  .btn-danger { background: var(--danger); color: #000; }
  .btn-warning { background: var(--warning); color: #000; }
  .btn-secondary { background: #64748b; color: #fff; }

  /* Toast Notification */
  #toast { position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; border-radius: 6px; font-weight: bold; display: none; z-index: 1000; }
  .toast-success { background: var(--success); color: #000; }
  .toast-error { background: var(--danger); color: #000; }
</style>
</head>
<body>

<div id="sidebar">
  <div id="sidebar-header">
    <h2>Layer A: JD Review</h2>
    <div id="progress-text" style="font-size: 12px; color: var(--muted);">Loading progress...</div>
    <div id="progress-bar"><div id="progress-fill"></div></div>
  </div>
  <div id="jd-list"></div>
</div>

<div id="main">
  <div id="topbar">
    <div>
      <h3 id="current-jd-header" style="margin:0;">Select a JD to begin</h3>
      <span id="current-jd-meta" style="font-size: 12px; color: var(--muted);"></span>
    </div>
    <div>
      <button class="btn btn-secondary" onclick="prevJD()">Previous</button>
      <button class="btn btn-secondary" onclick="nextJD()">Next</button>
      <button class="btn btn-primary" onclick="initFromProposals()">Initialize Gold from Proposals</button>
      <button class="btn btn-success" onclick="saveCurrentJD()">Save JD Ground Truth</button>
    </div>
  </div>

  <div id="content">
    <!-- Left Column -->
    <div class="col-left">
      <div class="section-title">Original Job Description</div>
      <div id="jd-text" class="jd-text-box">Select a JD to view text...</div>
    </div>

    <!-- Right Column -->
    <div class="col-right">
      <div class="section-title">
        <span>Reviewed Gold Requirements</span>
        <button class="btn btn-primary" onclick="addNewGoldRequirement()">+ Add Gold Req</button>
      </div>
      <div id="requirements-container"></div>

      <div class="section-title" style="margin-top: 24px;">
        <span>Reviewed Boolean Logical Groups</span>
        <button class="btn btn-primary" onclick="addNewGoldGroup()">+ Add Boolean Group</button>
      </div>
      <div id="groups-container"></div>
    </div>
  </div>
</div>

<div id="toast"></div>

<script>
let allJDs = [];
let currentJDIndex = 0;
let currentJD = null;

const ERROR_TYPES = [
  "", "TOKENIZATION_ERROR", "HEADING_LEAK", "BENEFIT_LEAK", "APPLICATION_INSTRUCTION_LEAK",
  "UNDER_SPLIT", "OVER_SPLIT", "DUPLICATE_REQUIREMENT", "WRONG_REQUIRED_LEVEL",
  "WRONG_HARD_GATE", "BOOLEAN_OVERGROUP", "BOOLEAN_SINGLETON", "OTHER"
];

async function loadInitial() {
  const res = await fetch('/api/jds');
  const data = await res.json();
  allJDs = data.jds;
  renderSidebar();
  updateProgress();
  if (allJDs.length > 0) {
    loadJD(0);
  }
}

function renderSidebar() {
  const container = document.getElementById('jd-list');
  container.innerHTML = allJDs.map((j, idx) => `
    <div class="jd-item ${idx === currentJDIndex ? 'active' : ''}" onclick="loadJD(${idx})">
      <div style="font-weight:bold; font-size:13px; margin-bottom:4px;">
        <span class="jd-badge ${j.review_status === 'COMPLETED' ? 'badge-completed' : 'badge-pending'}">
          ${j.review_status}
        </span>
        ${j.jd_id}
      </div>
      <div style="font-size:12px; color:#cbd5e1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        ${j.jd_title}
      </div>
      <div style="font-size:11px; color:var(--muted); margin-top:2px;">
        ${j.company_name} | Pro: ${j.proposed_count} | Gold: ${j.reviewed_count}
      </div>
    </div>
  `).join('');
}

async function updateProgress() {
  const res = await fetch('/api/status');
  const s = await res.json();
  document.getElementById('progress-text').innerText = `${s.completed_jds} / ${s.total_unique_jds} JDs Reviewed (${s.completion_pct}%)`;
  document.getElementById('progress-fill').style.width = `${s.completion_pct}%`;
}

async function loadJD(index) {
  currentJDIndex = index;
  renderSidebar();
  const res = await fetch(`/api/jds/${index}`);
  currentJD = await res.json();
  
  document.getElementById('current-jd-header').innerText = `${currentJD.jd_id}: ${currentJD.jd_title}`;
  document.getElementById('current-jd-meta').innerText = `Company: ${currentJD.company_name} | Domain: ${currentJD.domain_category} | Level: ${currentJD.job_level}`;
  document.getElementById('jd-text').innerText = currentJD.original_jd_text || "No JD text available.";

  renderRequirements();
  renderGroups();
}

function initFromProposals() {
  if (!currentJD) return;
  if (!currentJD.reviewed_requirements || currentJD.reviewed_requirements.length === 0) {
    currentJD.reviewed_requirements = currentJD.proposed_requirements.map((p, idx) => {
      const cleanJid = currentJD.jd_id.replace('-', '').toUpperCase();
      return {
        gold_requirement_id: `GOLD_${cleanJid}_REQ_${String(idx + 1).padStart(3, '0')}`,
        canonical_name: p.canonical_name || p.text || "",
        source_sentence: p.source_sentence || p.text || "",
        source_proposal_ids: [p.requirement_id || p.id],
        required_level: p.required_level || (p.mandatory ? "REQUIRED" : "PREFERRED"),
        expected_proficiency: p.expected_proficiency || "UNSPECIFIED",
        importance: p.importance || 1.0,
        hard_gate: !!p.hard_gate,
        review_action: "APPROVE",
        error_type: null,
        notes: ""
      };
    });
    currentJD.next_gold_requirement_index = currentJD.reviewed_requirements.length + 1;
  }

  if (!currentJD.reviewed_boolean_groups || currentJD.reviewed_boolean_groups.length === 0) {
    currentJD.reviewed_boolean_groups = (currentJD.proposed_boolean_groups || [])
      .filter(g => (g.member_requirement_ids || []).length > 1)
      .map((g, idx) => {
        const cleanJid = currentJD.jd_id.replace('-', '').toUpperCase();
        // map proposal member IDs to gold IDs
        const memberGoldIds = g.member_requirement_ids.map(pid => {
          const match = currentJD.reviewed_requirements.find(r => (r.source_proposal_ids || []).includes(pid));
          return match ? match.gold_requirement_id : null;
        }).filter(Boolean);

        return {
          gold_group_id: `GOLD_${cleanJid}_GRP_${String(idx + 1).padStart(3, '0')}`,
          operator: g.operator || "ANY_OF",
          min_required: g.min_required || 1,
          member_gold_requirement_ids: memberGoldIds,
          source_proposal_group_ids: [g.group_id],
          review_action: "APPROVE",
          notes: ""
        };
      });
    currentJD.next_gold_group_index = currentJD.reviewed_boolean_groups.length + 1;
  }

  renderRequirements();
  renderGroups();
  showToast("Initialized Gold from Proposals. Review and edit fields.", true);
}

function renderRequirements() {
  const container = document.getElementById('requirements-container');
  const reqs = currentJD.reviewed_requirements || [];
  if (reqs.length === 0) {
    container.innerHTML = '<div style="color:var(--muted); font-size:13px;">No reviewed requirements yet. Click "Initialize Gold from Proposals" or "+ Add Gold Req".</div>';
    return;
  }

  container.innerHTML = reqs.map((r, idx) => `
    <div class="card-item ${r.review_action === 'REMOVE' ? 'removed' : ''}">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-weight:bold; color:var(--primary); font-size:14px;">${r.gold_requirement_id}</span>
        <div>
          <select onchange="updateReqAction(${idx}, this.value)" style="background:#0f172a; color:#fff; border:1px solid var(--border); padding:4px 6px; border-radius:4px; font-weight:bold;">
            <option value="APPROVE" ${r.review_action === 'APPROVE' ? 'selected' : ''}>APPROVE</option>
            <option value="EDIT" ${r.review_action === 'EDIT' ? 'selected' : ''}>EDIT</option>
            <option value="SPLIT" ${r.review_action === 'SPLIT' ? 'selected' : ''}>SPLIT</option>
            <option value="MERGE" ${r.review_action === 'MERGE' ? 'selected' : ''}>MERGE</option>
            <option value="REMOVE" ${r.review_action === 'REMOVE' ? 'selected' : ''}>REMOVE</option>
          </select>
          ${r.review_action === 'SPLIT' ? `<button class="btn btn-warning" onclick="splitRequirement(${idx})">+ Split Child</button>` : ''}
          <button class="btn btn-danger" onclick="deleteRequirement(${idx})">X</button>
        </div>
      </div>

      <div class="row-field">
        <label>Canonical Name:</label>
        <input type="text" value="${r.canonical_name || ''}" onchange="currentJD.reviewed_requirements[${idx}].canonical_name = this.value">
      </div>

      <div class="row-field">
        <label>Source Sentence:</label>
        <textarea rows="2" onchange="currentJD.reviewed_requirements[${idx}].source_sentence = this.value">${r.source_sentence || ''}</textarea>
      </div>

      <div class="row-field">
        <label>Required / Pref:</label>
        <select onchange="currentJD.reviewed_requirements[${idx}].required_level = this.value">
          <option value="REQUIRED" ${r.required_level === 'REQUIRED' ? 'selected' : ''}>REQUIRED</option>
          <option value="PREFERRED" ${r.required_level === 'PREFERRED' ? 'selected' : ''}>PREFERRED</option>
        </select>
        <label style="width:80px; text-align:right;">Proficiency:</label>
        <select onchange="currentJD.reviewed_requirements[${idx}].expected_proficiency = this.value">
          <option value="UNSPECIFIED" ${r.expected_proficiency === 'UNSPECIFIED' ? 'selected' : ''}>UNSPECIFIED</option>
          <option value="INTERN" ${r.expected_proficiency === 'INTERN' ? 'selected' : ''}>INTERN</option>
          <option value="JUNIOR" ${r.expected_proficiency === 'JUNIOR' ? 'selected' : ''}>JUNIOR</option>
          <option value="MIDDLE" ${r.expected_proficiency === 'MIDDLE' ? 'selected' : ''}>MIDDLE</option>
          <option value="SENIOR" ${r.expected_proficiency === 'SENIOR' ? 'selected' : ''}>SENIOR</option>
          <option value="LEAD" ${r.expected_proficiency === 'LEAD' ? 'selected' : ''}>LEAD</option>
        </select>
      </div>

      <div class="row-field">
        <label>Hard Gate:</label>
        <input type="checkbox" style="width:auto; flex:none;" ${r.hard_gate ? 'checked' : ''} onchange="currentJD.reviewed_requirements[${idx}].hard_gate = this.checked">
        <label style="width:100px; text-align:right;">Importance (1-5):</label>
        <input type="number" step="0.5" min="1" max="5" value="${r.importance || 1.0}" onchange="currentJD.reviewed_requirements[${idx}].importance = parseFloat(this.value)">
        <label style="width:90px; text-align:right;">Error Type:</label>
        <select onchange="currentJD.reviewed_requirements[${idx}].error_type = this.value || null">
          ${ERROR_TYPES.map(e => `<option value="${e}" ${r.error_type === e ? 'selected' : ''}>${e || 'NONE'}</option>`).join('')}
        </select>
      </div>

      <div class="row-field">
        <label>Notes:</label>
        <input type="text" value="${r.notes || ''}" placeholder="Annotation notes..." onchange="currentJD.reviewed_requirements[${idx}].notes = this.value">
      </div>
    </div>
  `).join('');
}

function updateReqAction(idx, val) {
  currentJD.reviewed_requirements[idx].review_action = val;
  renderRequirements();
}

async function splitRequirement(parentIdx) {
  const parent = currentJD.reviewed_requirements[parentIdx];
  const res = await fetch(`/api/jds/${currentJDIndex}/allocate-req-id`, {method: 'POST'});
  const data = await res.json();
  
  const child = {
    gold_requirement_id: data.gold_requirement_id,
    canonical_name: `${parent.canonical_name} (Part 2)`,
    source_sentence: parent.source_sentence,
    source_proposal_ids: parent.source_proposal_ids ? [...parent.source_proposal_ids] : [],
    required_level: parent.required_level,
    expected_proficiency: parent.expected_proficiency,
    importance: parent.importance,
    hard_gate: parent.hard_gate,
    review_action: "SPLIT",
    error_type: "UNDER_SPLIT",
    notes: `Split from ${parent.gold_requirement_id}`
  };
  parent.review_action = "SPLIT";
  parent.error_type = "UNDER_SPLIT";
  currentJD.reviewed_requirements.splice(parentIdx + 1, 0, child);
  renderRequirements();
  showToast(`Allocated child requirement ${data.gold_requirement_id} for split.`, true);
}

async function addNewGoldRequirement() {
  const res = await fetch(`/api/jds/${currentJDIndex}/allocate-req-id`, {method: 'POST'});
  const data = await res.json();
  currentJD.reviewed_requirements = currentJD.reviewed_requirements || [];
  currentJD.reviewed_requirements.push({
    gold_requirement_id: data.gold_requirement_id,
    canonical_name: "",
    source_sentence: "",
    source_proposal_ids: [],
    required_level: "REQUIRED",
    expected_proficiency: "UNSPECIFIED",
    importance: 1.0,
    hard_gate: false,
    review_action: "APPROVE",
    error_type: null,
    notes: ""
  });
  renderRequirements();
}

function deleteRequirement(idx) {
  const req = currentJD.reviewed_requirements[idx];
  currentJD.tombstoned_requirement_ids = currentJD.tombstoned_requirement_ids || [];
  if (!currentJD.tombstoned_requirement_ids.includes(req.gold_requirement_id)) {
    currentJD.tombstoned_requirement_ids.push(req.gold_requirement_id);
  }
  currentJD.reviewed_requirements.splice(idx, 1);
  renderRequirements();
}

function renderGroups() {
  const container = document.getElementById('groups-container');
  const groups = currentJD.reviewed_boolean_groups || [];
  if (groups.length === 0) {
    container.innerHTML = '<div style="color:var(--muted); font-size:13px;">No Boolean groups. Singletons should remain excluded from gold groups.</div>';
    return;
  }

  const activeGoldReqs = (currentJD.reviewed_requirements || [])
    .filter(r => r.review_action !== 'REMOVE');

  container.innerHTML = groups.map((g, gIdx) => `
    <div class="card-item">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-weight:bold; color:var(--primary); font-size:14px;">${g.gold_group_id}</span>
        <div>
          <select onchange="currentJD.reviewed_boolean_groups[${gIdx}].review_action = this.value" style="background:#0f172a; color:#fff; border:1px solid var(--border); padding:4px 6px; border-radius:4px; font-weight:bold;">
            <option value="APPROVE" ${g.review_action === 'APPROVE' ? 'selected' : ''}>APPROVE</option>
            <option value="CHANGE_OPERATOR" ${g.review_action === 'CHANGE_OPERATOR' ? 'selected' : ''}>CHANGE_OPERATOR</option>
            <option value="SPLIT_GROUP" ${g.review_action === 'SPLIT_GROUP' ? 'selected' : ''}>SPLIT_GROUP</option>
            <option value="MERGE_GROUPS" ${g.review_action === 'MERGE_GROUPS' ? 'selected' : ''}>MERGE_GROUPS</option>
          </select>
          <button class="btn btn-danger" onclick="deleteGroup(${gIdx})">X</button>
        </div>
      </div>

      <div class="row-field">
        <label>Operator:</label>
        <select onchange="currentJD.reviewed_boolean_groups[${gIdx}].operator = this.value">
          <option value="ANY_OF" ${g.operator === 'ANY_OF' ? 'selected' : ''}>ANY_OF (At least N)</option>
          <option value="ALL_OF" ${g.operator === 'ALL_OF' ? 'selected' : ''}>ALL_OF (All required)</option>
        </select>
        <label style="width:100px; text-align:right;">Min Required:</label>
        <input type="number" min="1" max="10" value="${g.min_required || 1}" onchange="currentJD.reviewed_boolean_groups[${gIdx}].min_required = parseInt(this.value)">
      </div>

      <div class="row-field" style="align-items:flex-start;">
        <label>Member Gold Reqs:</label>
        <div style="flex:1; display:flex; flex-wrap:wrap; gap:8px;">
          ${activeGoldReqs.map(r => `
            <label style="width:auto; font-size:12px; color:#fff; cursor:pointer; background:#0f172a; padding:4px 8px; border-radius:4px; border:1px solid var(--border);">
              <input type="checkbox" value="${r.gold_requirement_id}" ${g.member_gold_requirement_ids.includes(r.gold_requirement_id) ? 'checked' : ''} onchange="toggleGroupMember(${gIdx}, '${r.gold_requirement_id}', this.checked)">
              ${r.gold_requirement_id} (${r.canonical_name})
            </label>
          `).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

function toggleGroupMember(gIdx, reqId, isChecked) {
  const group = currentJD.reviewed_boolean_groups[gIdx];
  group.member_gold_requirement_ids = group.member_gold_requirement_ids || [];
  if (isChecked && !group.member_gold_requirement_ids.includes(reqId)) {
    group.member_gold_requirement_ids.push(reqId);
  } else if (!isChecked) {
    group.member_gold_requirement_ids = group.member_gold_requirement_ids.filter(id => id !== reqId);
  }
}

async function addNewGoldGroup() {
  const res = await fetch(`/api/jds/${currentJDIndex}/allocate-grp-id`, {method: 'POST'});
  const data = await res.json();
  currentJD.reviewed_boolean_groups = currentJD.reviewed_boolean_groups || [];
  currentJD.reviewed_boolean_groups.push({
    gold_group_id: data.gold_group_id,
    operator: "ANY_OF",
    min_required: 1,
    member_gold_requirement_ids: [],
    source_proposal_group_ids: [],
    review_action: "APPROVE",
    notes: ""
  });
  renderGroups();
}

function deleteGroup(idx) {
  const grp = currentJD.reviewed_boolean_groups[idx];
  currentJD.tombstoned_group_ids = currentJD.tombstoned_group_ids || [];
  if (!currentJD.tombstoned_group_ids.includes(grp.gold_group_id)) {
    currentJD.tombstoned_group_ids.push(grp.gold_group_id);
  }
  currentJD.reviewed_boolean_groups.splice(idx, 1);
  renderGroups();
}

async function saveCurrentJD() {
  if (!currentJD) return;
  currentJD.review_status = (currentJD.reviewed_requirements && currentJD.reviewed_requirements.length > 0) ? "COMPLETED" : "PENDING";
  currentJD.adjudicated = currentJD.review_status === "COMPLETED";

  const res = await fetch(`/api/jds/${currentJDIndex}/save`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(currentJD)
  });
  const data = await res.json();
  if (res.ok && data.success) {
    showToast(data.message, true);
    allJDs[currentJDIndex].review_status = currentJD.review_status;
    allJDs[currentJDIndex].reviewed_count = (currentJD.reviewed_requirements || []).length;
    renderSidebar();
    updateProgress();
  } else {
    showToast("Save failed:\n" + (data.errors || []).join("\n"), false);
  }
}

function prevJD() {
  if (currentJDIndex > 0) loadJD(currentJDIndex - 1);
}

function nextJD() {
  if (currentJDIndex < allJDs.length - 1) loadJD(currentJDIndex + 1);
}

function showToast(msg, isSuccess) {
  const t = document.getElementById('toast');
  t.innerText = msg;
  t.className = isSuccess ? 'toast-success' : 'toast-error';
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 4000);
}

window.onload = loadInitial;
</script>
</body>
</html>""")


if __name__ == "__main__":
    uvicorn.run("eval.v1_eval.jd_annotation_app:app", host="127.0.0.1", port=8501, reload=True)
