# CV Variant evaluation corpus

`claims.jsonl` contains 100 release-gate cases: 50 supported, 25 unsupported,
15 conflicting/scope-inflated and 10 numeric edge cases. The automated benchmark
asserts zero unsafe publish candidates, 100% evidence coverage for publishable
claims, and at least 95% successful one/two-page PDF renders across three templates.

Run:

```powershell
$env:APP_ENV="test"
$env:PYTHONPATH="backend"
python -m pytest -q backend/tests/test_cv_variant_evaluation.py
```
