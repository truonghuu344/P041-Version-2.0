$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$PayloadFile = [System.IO.Path]::GetTempFileName()

try {
    [Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
    $Payload = [Console]::In.ReadToEnd()
    [System.IO.File]::WriteAllText(
        $PayloadFile,
        $Payload,
        [System.Text.UTF8Encoding]::new($false)
    )
    $env:AI_HOOK_PAYLOAD_FILE = $PayloadFile

    & (Join-Path $RepoRoot 'scripts/_pyrun.cmd') `
        (Join-Path $RepoRoot 'scripts/log_hook.py') `
        '--tool=codex'
    exit $LASTEXITCODE
}
finally {
    Remove-Item Env:AI_HOOK_PAYLOAD_FILE -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $PayloadFile -Force -ErrorAction SilentlyContinue
}
