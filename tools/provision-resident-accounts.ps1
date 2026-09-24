<#
.SYNOPSIS
  Creates sign-in accounts for residents and prepares the SQL that links each one
  to its roster row, so they can use /my-evaluations/.

.DESCRIPTION
  Two jobs, split by who should do them:

  1. ACCOUNTS. For each CSV row with an email, creates a Supabase Auth user through
     the Admin API - already confirmed, with no password, and WITHOUT sending any
     email. No invitation goes out because hospital email security opens links
     before the recipient does, which spends a single-use invite, and because every
     email counts against Supabase's small hourly sending limit. The resident signs
     in the first time with "Email me a sign-in link" on the page itself.

  2. LINKS. Writes one SQL statement that links each roster row to its account, for
     you to paste into the Supabase SQL editor. It is written out rather than run,
     because changes to program data go through the SQL editor by hand.

  Dry run by default: reports exactly what it would do and changes nothing.

.PARAMETER CsvPath
  CSV with columns resident_id, name, email. Make one with -WriteTemplate. Rows with
  an empty email are skipped, so the file can be filled in a few at a time.
  It holds resident names and emails: keep it OUT of this repository, which is
  public and is also the published website. The script refuses paths inside it.

.PARAMETER WriteTemplate
  Writes every active resident who has no account yet - id, name, class year and an
  empty email column - to -CsvPath, then exits.

.PARAMETER Program
  fm (default) or am.

.PARAMETER Apply
  Actually create the accounts and write the linking SQL. Without it, nothing changes.

.EXAMPLE
  .\tools\provision-resident-accounts.ps1 -CsvPath "$env:VCMC_BACKUP_DIR\..\resident-accounts.csv" -WriteTemplate
  (fill in the email column)
  .\tools\provision-resident-accounts.ps1 -CsvPath "...\resident-accounts.csv"          # dry run
  .\tools\provision-resident-accounts.ps1 -CsvPath "...\resident-accounts.csv" -Apply   # create

.NOTES
  Reads the service_role key from SUPABASE_SERVICE_KEY_EVAL, the same variable the
  backup script uses. ASCII only: Windows PowerShell 5.1 reads a .ps1 without a
  byte-order mark as ANSI, and non-ASCII characters here would be corrupted.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string]$CsvPath,
    [switch]$WriteTemplate,
    [ValidateSet('fm','am')] [string]$Program = 'fm',
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Url = 'https://ubqecdyhgejqoweltagl.supabase.co'
$Key = [Environment]::GetEnvironmentVariable('SUPABASE_SERVICE_KEY_EVAL')
if (-not $Key) { $Key = [Environment]::GetEnvironmentVariable('SUPABASE_SERVICE_KEY_EVAL', 'User') }
if (-not $Key) { throw 'SUPABASE_SERVICE_KEY_EVAL is not set. See tools/README.md.' }
$H = @{ apikey = $Key; Authorization = "Bearer $Key" }

# Refuse to read or write resident names inside the public repository.
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path.TrimEnd('\')
$FullCsv  = [IO.Path]::GetFullPath($CsvPath)
if ($FullCsv.StartsWith($RepoRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing $FullCsv - it is inside the repository, which is public. Put it somewhere private, such as your backup folder."
}

# ---- current state --------------------------------------------------------------
# Assigned first, then wrapped. @(Invoke-RestMethod ...) in Windows PowerShell 5.1
# nests the whole response as ONE element - a 45-row roster becomes a 1-element
# array holding an array, and every filter below silently matches nothing.
$roster = Invoke-RestMethod -Headers $H -Uri "$Url/rest/v1/residents?select=id,name,class_year,program,active,auth_user_id&program=eq.$Program&order=class_year.asc,name.asc&limit=2000"
$roster = @($roster)

# Auth users are paged; read every page, so an existing account is never missed and
# duplicated.
$users = @(); $page = 1
do {
    $r = Invoke-RestMethod -Headers $H -Uri "$Url/auth/v1/admin/users?page=$page&per_page=1000"
    $users += @($r.users); $page++
} while (@($r.users).Count -eq 1000)

$userByEmail = @{}; $userById = @{}
foreach ($u in $users) {
    if ($u.email) { $userByEmail[$u.email.ToLower()] = $u }
    $userById[$u.id] = $u
}
$linkedUserIds = @{}
foreach ($r in $roster) { if ($r.auth_user_id) { $linkedUserIds[$r.auth_user_id] = $r } }

# ---- template ---------------------------------------------------------------------
if ($WriteTemplate) {
    if (Test-Path $FullCsv) { throw "$FullCsv already exists. Not overwriting it - move it or choose another name." }
    $rows = $roster | Where-Object { $_.active -and -not $_.auth_user_id } |
        ForEach-Object { [pscustomobject]@{ resident_id = $_.id; name = $_.name; class_year = $_.class_year; email = '' } }
    $rows | Export-Csv -Path $FullCsv -NoTypeInformation -Encoding UTF8
    "Wrote $(@($rows).Count) residents without an account to:"
    "  $FullCsv"
    "Fill in the email column (blank rows are skipped), then run this again without -WriteTemplate."
    return
}

# ---- plan -------------------------------------------------------------------------
if (-not (Test-Path $FullCsv)) { throw "$FullCsv not found. Make one with -WriteTemplate." }
$csv = @(Import-Csv -Path $FullCsv)
foreach ($col in 'resident_id', 'name', 'email') {
    if ($csv.Count -and -not ($csv[0].PSObject.Properties.Name -contains $col)) { throw "The CSV needs a '$col' column." }
}

$rosterById = @{}; foreach ($r in $roster) { $rosterById[[string]$r.id] = $r }
$wanted = @($csv | Where-Object { $_.email -and $_.email.Trim() })
$emailCount = @{}
foreach ($row in $wanted) { $e = $row.email.Trim().ToLower(); $emailCount[$e] = 1 + [int]$emailCount[$e] }

$plan = foreach ($row in $wanted) {
    $email = $row.email.Trim().ToLower()
    $rid   = ([string]$row.resident_id).Trim()
    $r     = $rosterById[$rid]
    $action = ''; $note = ''

    if ($email -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$')            { $action = 'SKIP'; $note = 'not an email address' }
    elseif ($emailCount[$email] -gt 1)                             { $action = 'SKIP'; $note = 'same email on more than one row' }
    elseif (-not $r)                                               { $action = 'SKIP'; $note = "no $Program roster row with this id" }
    elseif ($r.name.Trim() -ne ([string]$row.name).Trim())         { $action = 'SKIP'; $note = "roster says '$($r.name)' - the email may be on the wrong line" }
    elseif ($r.auth_user_id) {
        $cur = $userById[$r.auth_user_id]
        if ($cur -and $cur.email -and $cur.email.ToLower() -eq $email) { $action = 'DONE'; $note = 'already linked to this email' }
        else { $action = 'SKIP'; $note = 'roster row is already linked to a different account' }
    }
    elseif ($userByEmail.ContainsKey($email)) {
        $u = $userByEmail[$email]
        if ($linkedUserIds.ContainsKey($u.id)) { $action = 'SKIP'; $note = "that account is already linked to $($linkedUserIds[$u.id].name)" }
        else { $action = 'LINK'; $note = 'account exists; needs linking' }
    }
    else { $action = 'CREATE'; $note = 'new account, then link' }

    if ($r -and -not $r.active -and $action -in 'CREATE', 'LINK') { $note += ' (roster row is inactive)' }
    [pscustomobject]@{ resident_id = $rid; name = [string]$row.name; email = $email; action = $action; note = $note }
}
$plan = @($plan)

''
$plan | Sort-Object action, name | Format-Table -AutoSize resident_id, name, email, action, note | Out-String -Width 200
"CREATE $(@($plan | ? action -eq 'CREATE').Count)   LINK $(@($plan | ? action -eq 'LINK').Count)   DONE $(@($plan | ? action -eq 'DONE').Count)   SKIP $(@($plan | ? action -eq 'SKIP').Count)   (rows without an email: $($csv.Count - $wanted.Count))"

if (-not $Apply) {
    ''
    'DRY RUN - nothing was changed. Fix any SKIP rows, then run again with -Apply.'
    return
}

# ---- apply ------------------------------------------------------------------------
$failed = 0
foreach ($p in ($plan | Where-Object action -eq 'CREATE')) {
    $body = @{ email = $p.email; email_confirm = $true } | ConvertTo-Json
    try {
        $null = Invoke-RestMethod -Method Post -Headers $H -ContentType 'application/json' -Body $body -Uri "$Url/auth/v1/admin/users"
        "  created  $($p.email)"
    } catch {
        $msg = $_.ErrorDetails.Message
        if ($msg -match 'already.*registered|email_exists') { "  exists   $($p.email) - will be linked"; }
        else { $failed++; $p.action = 'FAILED'; "  FAILED   $($p.email): $msg" }
    }
}

$toLink = @($plan | Where-Object { $_.action -in 'CREATE', 'LINK' })
if (-not $toLink.Count) { ''; 'Nothing to link.'; return }

$values = ($toLink | ForEach-Object { "  ($($_.resident_id), '$($_.email.Replace("'", "''"))')" }) -join ",`r`n"
$sql = @"
-- Links $($toLink.Count) residents to their sign-in accounts. Generated $(Get-Date -Format 'yyyy-MM-dd HH:mm').
-- Paste into the Supabase SQL editor. Safe to run twice: a row already linked is left alone.
-- Expect one returned row per resident.
with map(resident_id, email) as (values
$values
)
update public.residents r
   set auth_user_id = u.id
  from map m
  join auth.users u on lower(u.email) = lower(m.email)
 where r.id = m.resident_id
   and r.auth_user_id is null
returning r.id, r.name, u.email;
"@

$sqlPath = [IO.Path]::ChangeExtension($FullCsv, $null).TrimEnd('.') + '-link.sql'
Set-Content -Path $sqlPath -Value $sql -Encoding UTF8
''
"Linking SQL for $($toLink.Count) residents written to:"
"  $sqlPath"
'Open it, paste the whole thing into the Supabase SQL editor and run it.'
if ($failed) { ''; "$failed account(s) failed to create and were left out of the SQL. See FAILED above." }
