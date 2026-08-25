<#
.SYNOPSIS
  Snapshots every Supabase table behind the VCMC evaluation apps to timestamped JSON.

.DESCRIPTION
  Supabase is the only copy of this data. This writes a complete, structure-preserving
  snapshot of each table to a directory you choose - intended to be an institutional
  location (OneDrive, a department network share), NOT this repository, which is public.

  JSON rather than the dashboards' CSV export: CSV flattens scores, milestone_scores
  and scores_detail into text and cannot round-trip them. This preserves them exactly.

  Requires no installed tooling beyond Windows PowerShell.

.PARAMETER OutDir
  Destination directory. Defaults to $env:VCMC_BACKUP_DIR.

.PARAMETER KeepDays
  Delete snapshot folders older than this. Pruning is SKIPPED if any table failed,
  so a broken run can never age out the last good snapshot. 0 disables pruning.

.PARAMETER TestOnly
  Verify connectivity, credentials and row counts, then exit without writing.
  Run this once after setup, and any time a project may have been paused.

.NOTES
  Credentials are read from environment variables and never stored here:
    SUPABASE_SERVICE_KEY_EVAL      service_role key for ubqecdyhgejqoweltagl
    SUPABASE_SERVICE_KEY_CAMPHOPE  service_role key for zwfbppgkodhlpgsxcdry
  A service_role key bypasses Row Level Security and can read everything. Treat it
  like a password: set it as a user environment variable, never commit it, and never
  paste it into a chat or a shared document.
#>
[CmdletBinding()]
param(
    [string]$OutDir = $env:VCMC_BACKUP_DIR,
    [int]$KeepDays  = 180,
    [switch]$TestOnly
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Projects = @(
    @{ Name = 'eval'
       Ref  = 'ubqecdyhgejqoweltagl'
       KeyVar = 'SUPABASE_SERVICE_KEY_EVAL'
       Tables = @('epa_submissions','faculty_submissions','residents','faculty') },
    @{ Name = 'camphope'
       Ref  = 'zwfbppgkodhlpgsxcdry'
       KeyVar = 'SUPABASE_SERVICE_KEY_CAMPHOPE'
       Tables = @('camp_hope_responses') }
)

# Pages through a table by id. PostgREST caps a response at 1000 rows by default, so
# a single unpaged request would silently truncate a large table - the failure mode a
# backup must never have. Ordering by id keeps paging stable across requests.
function Get-TableRows {
    param([string]$Ref, [string]$Key, [string]$Table, [int]$PageSize = 1000)

    $headers = @{ apikey = $Key; Authorization = "Bearer $Key"; Prefer = 'count=exact' }
    $rows    = New-Object System.Collections.ArrayList
    $offset  = 0
    $total   = -1

    while ($true) {
        $url  = "https://$Ref.supabase.co/rest/v1/$Table" + "?select=*&order=id.asc&limit=$PageSize&offset=$offset"
        try {
            $resp = Invoke-WebRequest -Uri $url -Headers $headers -UseBasicParsing
        }
        catch {
            # Surface PostgREST's own explanation. Without this the caller sees only
            # "(403) Forbidden" and loses the response body, which is where the actual
            # cause lives - e.g. "GRANT SELECT ON public.residents TO service_role".
            $r = $_.Exception.Response
            if ($r) {
                $code   = [int]$r.StatusCode
                $detail = ''
                try { $detail = (New-Object IO.StreamReader($r.GetResponseStream())).ReadToEnd() } catch { }
                throw "HTTP $code $detail"
            }
            throw
        }

        $range = $resp.Headers['Content-Range']
        if ($range -and $total -lt 0) {
            $tail = ($range -split '/')[-1]
            if ($tail -match '^\d+$') { $total = [int]$tail }
        }

        # Do NOT wrap this in @(). Windows PowerShell 5.1 emits a decoded JSON array
        # as ONE pipeline item, so @(...) wraps it a second time and every page
        # collapses to Count 1. Direct assignment binds the array itself.
        $batch = $resp.Content | ConvertFrom-Json
        if ($null -eq $batch)            { $batch = @() }
        if ($batch -isnot [System.Array]) { $batch = ,$batch }
        if ($batch.Count -eq 0) { break }
        [void]$rows.AddRange($batch)
        $offset += $batch.Count
        if ($batch.Count -lt $PageSize) { break }
    }

    return [pscustomobject]@{ Rows = $rows.ToArray(); Fetched = $rows.Count; Reported = $total }
}

if (-not $TestOnly) {
    if ([string]::IsNullOrWhiteSpace($OutDir)) {
        throw "No destination. Pass -OutDir, or set VCMC_BACKUP_DIR to an institutional location (not this repo - it is public)."
    }
    if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
}

$stamp    = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$runDir   = if ($TestOnly) { $null } else { Join-Path $OutDir $stamp }
if ($runDir -and -not (Test-Path $runDir)) { New-Item -ItemType Directory -Path $runDir -Force | Out-Null }

$manifest = New-Object System.Collections.ArrayList
$failed   = 0

foreach ($p in $Projects) {
    # Process scope first, then User scope. Without the fallback a terminal opened
    # before the variables were set reports "not set" and the fix looks like a
    # credential problem rather than a stale environment.
    $key = [Environment]::GetEnvironmentVariable($p.KeyVar)
    if ([string]::IsNullOrWhiteSpace($key)) { $key = [Environment]::GetEnvironmentVariable($p.KeyVar, 'User') }
    if ([string]::IsNullOrWhiteSpace($key)) {
        Write-Warning "$($p.Name): $($p.KeyVar) is not set - skipping this project."
        $failed++
        continue
    }

    foreach ($table in $p.Tables) {
        try {
            $result = Get-TableRows -Ref $p.Ref -Key $key -Table $table

            # A short read means paging stopped early. Never overwrite a good snapshot with one.
            if ($result.Reported -ge 0 -and $result.Fetched -ne $result.Reported) {
                throw "row count mismatch: fetched $($result.Fetched), server reports $($result.Reported)"
            }

            if (-not $TestOnly) {
                $file = Join-Path $runDir "$($p.Name)__$table.json"
                $tmp  = "$file.partial"
                # -InputObject, never the pipeline: piping unrolls the array, writing an
                # EMPTY file for a 0-row table and a bare {object} for a 1-row table.
                # Both are unrestorable and neither announces itself. -InputObject always
                # emits a JSON array. Written BOM-less so other tools can read it.
                $json = ConvertTo-Json -InputObject @($result.Rows) -Depth 100
                [System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding($false)))
                Move-Item -Path $tmp -Destination $file -Force
            }

            Write-Host ("  {0,-12} {1,-22} {2,6} rows  OK" -f $p.Name, $table, $result.Fetched)
            [void]$manifest.Add([pscustomobject]@{ project=$p.Name; table=$table; rows=$result.Fetched; status='ok' })
        }
        catch {
            $failed++
            Write-Warning ("  {0,-12} {1,-22} FAILED: {2}" -f $p.Name, $table, $_.Exception.Message)
            [void]$manifest.Add([pscustomobject]@{ project=$p.Name; table=$table; rows=$null; status="failed: $($_.Exception.Message)" })
        }
    }
}

if (-not $TestOnly) {
    $summary = [pscustomobject]@{ takenAt = (Get-Date).ToString('o'); failures = $failed; tables = @($manifest) }
    [System.IO.File]::WriteAllText((Join-Path $runDir 'manifest.json'),
        (ConvertTo-Json -InputObject $summary -Depth 10), (New-Object System.Text.UTF8Encoding($false)))

    # One-glance status at the top of the backup folder. When this runs unattended
    # the failure mode that matters is failing every week with nobody noticing, and
    # nobody opens a per-run manifest unprompted. This sits where you will see it.
    $status = if ($failed -gt 0) { "FAILED - $failed table(s)" } else { 'OK' }
    $lines  = @("$status   $(Get-Date -Format 'yyyy-MM-dd HH:mm')", "snapshot: $stamp", '')
    $lines += $manifest | ForEach-Object { "  {0,-12} {1,-22} {2,6}  {3}" -f $_.project, $_.table, $_.rows, $_.status }
    [System.IO.File]::WriteAllText((Join-Path $OutDir '_last-run.txt'),
        (($lines -join "`r`n") + "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
}

if ($failed -gt 0) {
    Write-Warning "$failed table(s) failed. Retention pruning skipped so the last good snapshot is preserved."
    exit 1
}

if (-not $TestOnly -and $KeepDays -gt 0) {
    $cutoff = (Get-Date).AddDays(-$KeepDays)
    Get-ChildItem -Path $OutDir -Directory |
        Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}_\d{6}$' -and $_.CreationTime -lt $cutoff } |
        ForEach-Object { Write-Host "  pruning $($_.Name)"; Remove-Item $_.FullName -Recurse -Force }
}

if ($TestOnly) { Write-Host "`nTest passed - credentials and connectivity are good. No files written." }
else           { Write-Host "`nSnapshot written to $runDir" }
