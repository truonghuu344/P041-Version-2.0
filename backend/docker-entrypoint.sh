#!/bin/sh
set -eu

python -m src.db.migration_runner
exec "$@"
