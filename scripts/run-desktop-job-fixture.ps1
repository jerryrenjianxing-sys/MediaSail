# A disposable runner has no interactive desktop launcher. Model only the
# desktop owner's lifetime; leave CLI clients in the runner's original Job.
$ErrorActionPreference='Stop'
if($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted'){throw 'Disposable hosted Windows fixture only'}
$forward=@($args)
if($forward.Count -lt 1){throw 'Missing fixture desktop application'}
# The outer hosted runner still owns final cleanup of the process tree.
Add-Type -Path (Join-Path $PSScriptRoot 'fixture-job.cs')
[MediaSailCommandJob]::Enter($false)
$start=[Diagnostics.ProcessStartInfo]::new()
$start.FileName=$forward[0]
# Fixture inputs deliberately preserve NSIS's final unquoted /D=... convention.
$start.Arguments=(@($forward|Select-Object -Skip 1)-join ' ')
$start.UseShellExecute=$false
$process=[Diagnostics.Process]::Start($start)
$process.WaitForExit()
exit $process.ExitCode
