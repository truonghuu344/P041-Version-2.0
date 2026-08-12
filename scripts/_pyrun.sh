#!/usr/bin/env bash
# Cross-platform Python launcher for AI log hooks.
# Tries python3 → python → py -3 on PATH; on Windows, falls back to common
# Python install locations because Git Bash launched by some hooks gets a
# stripped PATH that omits the Windows Python directory.
# Designed to be sourced or called as: bash scripts/_pyrun.sh <script> [args...]
#
# Exits 0 silently if no Python is found — hooks must never block the AI tool.
set -u

# `command -v` is not enough on Windows: Microsoft Store aliases can exist on
# PATH but fail with "Permission denied" from Git Bash. Probe the interpreter
# before selecting it, then continue to the next candidate when it is broken.
if command -v python3 >/dev/null 2>&1 \
    && python3 -c "import sys" >/dev/null 2>&1; then
  exec python3 "$@"
fi

if command -v python >/dev/null 2>&1 \
    && python -c "import sys" >/dev/null 2>&1; then
  exec python "$@"
fi

if command -v py >/dev/null 2>&1 \
    && py -3 -c "import sys" >/dev/null 2>&1; then
  exec py -3 "$@"
fi

# PATH lookup failed — probe standard Windows install locations.
shopt -s nullglob 2>/dev/null || true
for cand in \
  /c/Users/*/AppData/Local/Programs/Python/Python*/python.exe \
  "/c/Program Files/Python"*/python.exe \
  "/c/Program Files (x86)/Python"*/python.exe \
  /c/Python*/python.exe; do
  if [ -x "$cand" ] && "$cand" -c "import sys" >/dev/null 2>&1; then
    exec "$cand" "$@"
  fi
done
shopt -u nullglob 2>/dev/null || true

exit 0
