param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$GhArgs
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$env:GH_CONFIG_DIR = Join-Path $repoRoot ".gh-config"

if (-not (Test-Path -LiteralPath $env:GH_CONFIG_DIR)) {
  New-Item -ItemType Directory -Force -Path $env:GH_CONFIG_DIR | Out-Null
}

$ghExe = (Get-Command gh.exe -ErrorAction Stop).Source
& $ghExe @GhArgs
$exitCode = $LASTEXITCODE
exit $exitCode
