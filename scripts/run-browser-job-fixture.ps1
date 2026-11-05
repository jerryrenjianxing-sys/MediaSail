# Test-owned command lifetime. The outer hosted runner Job is never changed.
$ErrorActionPreference='Stop'
if($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted'){throw 'Disposable hosted Windows fixture only'}
$forward=@($args)
if($forward.Count -lt 1){throw 'Missing fixture entry'}
Add-Type -Path (Join-Path $PSScriptRoot 'fixture-job.cs')
[MediaSailCommandJob]::Enter($true)
$entry=$forward[0]
$remaining=@($forward|Select-Object -Skip 1)
& $entry @remaining
if($null -ne $LASTEXITCODE){exit $LASTEXITCODE}
