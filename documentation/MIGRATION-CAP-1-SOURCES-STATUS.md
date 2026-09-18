$ErrorActionPreference = "Continue"
function EMIT([string]$m){ $sbOut.AppendLine($m) | Out-Null }

$sbOut = New-Object System.Text.StringBuilder
$scanFile = "C:\Users\Mohammed Shamaa\source\repos\Wesal-Platform\documentation\MIGRATION-CAP-1-SOURCES-STATUS.md"

# Inspect ONLY (read-only). No writes to git, no commits/pushes.
# Document where the three repositories physically live so a later migration phase
# can copy from SOURCE clones into the CANONICAL working tree.
EMIT "# MIGRATION CAP-1 - where the sources live (inventory, read-only)"
EMIT ""
EMIT ("_generated: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + " (UTC) - inventory only, nothing modified_")
EMIT ""

function Show-Repo([string]$label, [string]$path) {
  EMIT ("## " + $label)
  EMIT ("- path   : " + $path)
  EMIT ("- exists : " + (Test-Path -LiteralPath $path))
  if (-not (Test-Path -LiteralPath $path)) { EMIT ""; return }
  EMIT ("- branch : " + ((& git -C $path rev-parse --abbrev-ref HEAD 2>&1 | Out-String).Trim()))
  EMIT ("- origin : " + ((& git -C $path remote get-url origin 2>&1 | Out-String).Trim()))
  EMIT ("- dirty  : " + ((& git -C $path status --porcelain 2>&1 | Measure-Object).Count) + " changes")
  EMIT "- top-level:"
  Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue | ForEach-Object {
    $k = if ($_.PSIsContainer) { "dir" } else { "file" }
    EMIT ("  - " + $k + " : " + $_.Name)
  }
  EMIT ""
}

# ---- source clones (the two repos whose work must be consolidated into the canonical) ----
$cands = @(
  @{ label = "SOURCE clone - wesal-api (backend, GitHub wessalOrg/wesal-api)"; p = "C:\Users\Mohammed Shamaa\AppData\Local\Temp\opencode\verify-api" },
  @{ label = "SOURCE clone - wesal-api (candidate B)";                        p = "C:\Users\Mohammed Shamaa\AppData\Local\Temp\opencode\api-fix" },
  @{ label = "SOURCE clone - wesal-frontend (frontend, GitHub wessalOrg/wesal-frontend)"; p = "C:\Users\Mohammed Shamaa\AppData\Local\Temp\opencode\verify-frontend" },
  @{ label = "SOURCE clone - wesal-frontend (candidate B)";                   p = "C:\Users\Mohammed Shamaa\AppData\Local\Temp\opencode\frontend-fix" },
  @{ label = "CANONICAL - Wesal-Platform (target of migration)";              p = "C:\Users\Mohammed Shamaa\source\repos\Wesal-Platform" },
  @{ label = "CANONICAL alt - Wesal-Platform-git (feature work backup)";      p = "C:\Users\Mohammed Shamaa\source\repos\Wesal-Platform-git" }
)
$seen = @{}
foreach ($c in $cands) {
  if ($seen[$c.p]) { continue }
  $seen[$c.p] = $true
  Show-Repo $c.label $c.p
}

# ---- confirm git client + repo URLs ----
EMIT "## Git client + repo endpoints"
EMIT ("- git version : " + ((& git --version 2>&1 | Out-String).Trim()))
EMIT "- endpoint wesal-api      : https://github.com/wessalOrg/wesal-api.git  (branch: develop)"
EMIT "- endpoint wesal-frontend : https://github.com/wessalOrg/wesal-frontend.git  (branch: develop)"
EMIT ("- local canonical        : " + "C:\Users\Mohammed Shamaa\source\repos\Wesal-Platform" + "  origin=" + ((& git -C "C:\Users\Mohammed Shamaa\source\repos\Wesal-Platform" remote get-url origin 2>&1 | Out-String).Trim()))
EMIT ""
EMIT "> CONTRACT FOR THIS CAP: all three repositories are on ONE machine. The migration phase will copy"
EMIT "> SOURCE clones (wesal-api, wesal-frontend) into the CANONICAL tree (Wesal-Platform) and commit there."
EMIT "> No deployment to Taqat/Dokku is part of this plan."

$dir = Split-Path -Parent $scanFile
if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
Set-Content -LiteralPath $scanFile -Value $sbOut.ToString() -Encoding UTF8
Write-Output ("scan doc written bytes=" + (Get-Item -LiteralPath $scanFile).Length + "  -> " + $scanFile)