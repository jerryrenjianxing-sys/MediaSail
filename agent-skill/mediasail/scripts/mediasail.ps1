# Keep argument boundaries intact; never build a shell command from user text.
$ErrorActionPreference = 'Stop'
$taskArgs = @($args)
$dataDir = if ($env:EASEL_DESKTOP_DATA) { $env:EASEL_DESKTOP_DATA } else { Join-Path $env:LOCALAPPDATA 'ElectronEasel' }
$forward = New-Object System.Collections.Generic.List[string]
for ($i=0; $i -lt $taskArgs.Count; $i++) {
    if ($taskArgs[$i] -eq '--data-dir') {
        if ($i+1 -ge $taskArgs.Count) { throw '--data-dir requires a directory' }
        $i++; $dataDir = $taskArgs[$i]
    } else { $forward.Add([string]$taskArgs[$i]) }
}
try {
    $file = Join-Path $dataDir 'agent-connection.json'
    $info = Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($info.product -ne 'MediaSail' -or $info.schema -ne 1) { throw 'Not a compatible MediaSail connection file' }
    if (-not (Test-Path -LiteralPath $info.python)) { throw 'Bundled Python is missing; restart or repair MediaSail' }
    $env:PYTHONUTF8 = '1'; $env:PYTHONIOENCODING = 'utf-8'
    & $info.python (Join-Path $PSScriptRoot 'mediasail.py') --connection $file @forward
    exit $LASTEXITCODE
} catch {
    @{ok=$false; connected=$false; error=$_.Exception.Message; dataDir=$dataDir} | ConvertTo-Json -Compress
    exit 1
}
