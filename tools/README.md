# Backups

`backup-supabase.ps1` writes a complete JSON snapshot of every table behind these apps.
Supabase is the only copy of this data; nothing else in this repo holds it.

Runs on Windows PowerShell with nothing installed.

## Why JSON and not the dashboards' CSV export

The CSV exports are for reading in Excel. They flatten `scores`, `milestone_scores` and
`scores_detail` into text and cannot be loaded back. These snapshots preserve every
column exactly as stored, including the JSON ones.

## What it copies

| Project | Tables |
| --- | --- |
| `ubqecdyhgejqoweltagl` | `epa_submissions`, `faculty_submissions`, `residents`, `faculty` |
| `zwfbppgkodhlpgsxcdry` | `camp_hope_responses` |

Each run creates `<OutDir>\yyyy-MM-dd_HHmmss\` holding one `.json` per table plus a
`manifest.json` recording row counts and any failures.

## One-time setup

**1. Choose where snapshots go.** Somewhere institutional — OneDrive or a department
share, so it is backed up and governed like other clinical records. **Not this folder:**
this repo is public and published to `eval.venturafamilymed.org`.

```powershell
[Environment]::SetEnvironmentVariable('VCMC_BACKUP_DIR', 'C:\path\to\your\backup\folder', 'User')
```

**2. Get a service_role key for each project.** Supabase dashboard -> Project Settings ->
API -> `service_role`. This key bypasses Row Level Security and can read everything, so
treat it like a password: never commit it, never paste it into chat or email.

```powershell
[Environment]::SetEnvironmentVariable('SUPABASE_SERVICE_KEY_EVAL',     '<eval key>',     'User')
[Environment]::SetEnvironmentVariable('SUPABASE_SERVICE_KEY_CAMPHOPE', '<camphope key>', 'User')
```

Open a new terminal afterwards — existing ones keep the old environment.

**3. Verify before trusting it.**

```powershell
.\tools\backup-supabase.ps1 -TestOnly
```

This checks credentials, connectivity and row counts without writing anything. Every
table should report `OK`. Then run it for real once and confirm files appear.

## Scheduling

A task named **`VCMC eval backup`** is already registered: weekly, Mondays at 07:00.
It runs as the logged-on user, so no password is stored anywhere. `-StartWhenAvailable`
means a run missed because the laptop was off happens at the next opportunity rather
than being skipped.

Check on it:

```powershell
Get-ScheduledTaskInfo -TaskName 'VCMC eval backup' | Select-Object LastRunTime, LastTaskResult, NextRunTime
```

`LastTaskResult` of `0` means the last run succeeded. Anything else means read
`_last-run.txt`.

Change the schedule (e.g. to Fridays at 5pm):

```powershell
Set-ScheduledTask -TaskName 'VCMC eval backup' -Trigger (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Friday -At 5pm)
```

Run it on demand -- worth doing right after Camp HOPE each year, since that survey
collects a year of responses in one week:

```powershell
Start-ScheduledTask -TaskName 'VCMC eval backup'
```

Remove it:

```powershell
Unregister-ScheduledTask -TaskName 'VCMC eval backup' -Confirm:$false
```

## Checking it is still working

`_last-run.txt` at the top of the backup folder is rewritten every run and states `OK`
or `FAILED` with the per-table row counts. Glancing at that file is the whole check --
if its date is stale, the task has stopped running.

## Behaviour worth knowing

- **Paging is verified.** PostgREST caps responses at 1000 rows. The script pages by `id`
  and compares what it fetched against the server's own count, failing loudly on a short
  read rather than writing a truncated snapshot.
- **Writes are atomic.** Each file lands as `.partial` and is renamed only once complete,
  so an interrupted run cannot leave a half-written file looking valid.
- **A failed run never prunes.** Retention deletion is skipped whenever any table failed,
  so a broken run cannot age out your last good snapshot. Exit code is `1` on any failure.
- **A paused project shows up as a failure.** Free Supabase projects pause after a period
  of inactivity, which matters for the Camp HOPE project since it is used once a year.
  `-TestOnly` doubles as a check that both projects are awake.

## Restoring

These are snapshots, not an automated restore. To put data back, POST the JSON array to
the table's PostgREST endpoint with a service_role key, or import the file from the
Supabase dashboard. Restore into a scratch table first and compare before touching a
live one.
