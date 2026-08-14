#!/usr/bin/env bash
# Cross-platform Python launcher for AI log hooks.
# A team member can set AI_LOG_PYTHON to use a specific interpreter. Otherwise
# prefer the project's virtual environment, then try python3 → python → py -3.
# On Windows, Git Bash can have a stripped PATH, so common install locations
# are checked as a final fallback.
# Designed to be sourced or called as: bash scripts/_pyrun.sh <script> [args...]
#
# Exits 0 silently if no Python is found — hooks must never block the AI tool.
set -u

if [ -n "${AI_LOG_PYTHON:-}" ] \
    && "$AI_LOG_PYTHON" -c "import sys; raise SystemExit(sys.version_info < (3, 8))" >/dev/null 2>&1; then
  exec "$AI_LOG_PYTHON" "$@"
fi

for project_python in \
  ".venv/Scripts/python.exe" \
  ".venv/bin/python" \
  "venv/Scripts/python.exe" \
  "venv/bin/python"; do
  if [ -x "$project_python" ] \
      && "$project_python" -c "import sys; raise SystemExit(sys.version_info < (3, 8))" >/dev/null 2>&1; then
    exec "$project_python" "$@"
  fi
done

# `command -v` is not enough on Windows: Microsoft Store aliases can exist on
# PATH but fail with "Permission denied" from Git Bash. Probe the interpreter
# before selecting it, then continue to the next candidate when it is broken.
if command -v python3 >/dev/null 2>&1 \
    && python3 -c "import sys; raise SystemExit(sys.version_info < (3, 8))" >/dev/null 2>&1; then
  exec python3 "$@"
fi

if command -v python >/dev/null 2>&1 \
    && python -c "import sys; raise SystemExit(sys.version_info < (3, 8))" >/dev/null 2>&1; then
  exec python "$@"
fi

if command -v py >/dev/null 2>&1 \
    && py -3 -c "import sys; raise SystemExit(sys.version_info < (3, 8))" >/dev/null 2>&1; then
  exec py -3 "$@"
fi

# PATH lookup failed — probe standard Windows install locations.
shopt -s nullglob 2>/dev/null || true
for cand in \
  /c/Users/*/AppData/Local/Programs/Python/Python*/python.exe \
  "/c/Program Files/Python"*/python.exe \
  "/c/Program Files (x86)/Python"*/python.exe \
  /c/Python*/python.exe; do
  if [ -x "$cand" ] && "$cand" -c "import sys; raise SystemExit(sys.version_info < (3, 8))" >/dev/null 2>&1; then
    exec "$cand" "$@"
  fi
done
shopt -u nullglob 2>/dev/null || true

exit 0
