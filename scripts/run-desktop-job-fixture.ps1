# A disposable runner has no interactive desktop launcher. Model only the
# desktop owner's lifetime; leave CLI clients in the runner's original Job.
$ErrorActionPreference='Stop'
if($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted'){throw 'Disposable hosted Windows fixture only'}
$forward=@($args)
if($forward.Count -lt 1){throw 'Missing fixture desktop application'}
$source=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'run-browser-job-fixture.ps1'))
$begin=$source.IndexOf("using System;")
$end=$source.IndexOf("'@",$begin)
if($begin -lt 0 -or $end -lt 0){throw 'Desktop fixture Job source is unavailable'}
# Do not kill an installer-launched app when its short-lived installer exits.
# The enclosing GitHub runner Job still owns final cleanup of the entire tree.
$definition=$source.Substring($begin,$end-$begin).Replace('limits.basic.flags=0x2000|0x800;','limits.basic.flags=0x800;')
Add-Type -Language CSharp -TypeDefinition $definition
[MediaSailCommandJob]::Enter()
$start=[Diagnostics.ProcessStartInfo]::new()
$start.FileName=$forward[0]
# Fixture inputs deliberately preserve NSIS's final unquoted /D=... convention.
$start.Arguments=(@($forward|Select-Object -Skip 1)-join ' ')
$start.UseShellExecute=$false
$process=[Diagnostics.Process]::Start($start)
$process.WaitForExit()
exit $process.ExitCode
