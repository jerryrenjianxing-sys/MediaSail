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
    $visited = @{}
    for ($attempt=0; $attempt -lt 8; $attempt++) {
        $file = [IO.Path]::GetFullPath($file)
        if ($visited.ContainsKey($file)) { throw 'Connection file redirect loop; reopen MediaSail' }
        $visited[$file] = $true
        $info = Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($info.product -ne 'MediaSail' -or $info.schema -ne 1) { throw 'Not a compatible MediaSail connection file' }
        $canonical = if ($info.connectionFile) { [IO.Path]::GetFullPath([string]$info.connectionFile) } else { $file }
        if ($canonical -eq $file) { break }
        $file = $canonical
    }
    if ($canonical -ne $file -or $attempt -ge 8) { throw 'Too many connection redirects; reopen MediaSail' }
    if (-not (Test-Path -LiteralPath $info.python)) { throw 'Bundled Python is missing; restart or repair MediaSail' }
    $env:PYTHONUTF8 = '1'; $env:PYTHONIOENCODING = 'utf-8'
    & $info.python (Join-Path $PSScriptRoot 'mediasail.py') --connection $file @forward
    exit $LASTEXITCODE
} catch {
    @{ok=$false; connected=$false; error=$_.Exception.Message; dataDir=$dataDir} | ConvertTo-Json -Compress
    exit 1
}
