# Local named-pipe client only. No process startup, network listener or Python.
function Request-BrowserConnection($Context,[string]$Name,[string]$Url,[string]$RequestId,[bool]$Query=$false) {
    $descriptor=$Context.info.browserTools.connector
    if($Context.info.status -ne 'ready' -or !$descriptor -or $descriptor.schema -ne 1 -or $descriptor.transport -ne 'named-pipe'){
        return @{ok=$false;code='desktop_not_running';error='Open MediaSail before creating a browser connection. Existing session receipts can still be used.'}
    }
    if($descriptor.pipe -notmatch '^\\\\\.\\pipe\\MediaSail-browser-[a-f0-9-]{36}$'){throw 'Invalid desktop browser pipe'}
    if(!$RequestId){$RequestId=[guid]::NewGuid().ToString()}
    if($RequestId -notmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'){throw 'Invalid connection request identifier'}
    $credential=Read-Json $descriptor.credentialFile
    if($credential.instanceId -ne $Context.info.instanceId -or $credential.libraryId -ne $Context.info.libraryId -or $credential.token -notmatch '^[a-f0-9]{64}$'){throw 'Desktop browser credentials do not match this library instance'}
    if(!('MediaSailBrowserProcess' -as [type])){Add-Type -TypeDefinition ([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'browser-native.cs'))) -Language CSharp}
    $request=@{schema=1;token=$credential.token;instanceId=$Context.info.instanceId;libraryId=$Context.info.libraryId;requestId=$RequestId;action=if($Query){'status'}else{'connect'}}
    if(!$Query){if($Name){$request.name=$Name};if($Url){$request.url=$Url}}
    $deadline=[DateTime]::UtcNow.AddSeconds(180)
    try {
        do {
            $pipe=New-Object IO.Pipes.NamedPipeClientStream('.',($descriptor.pipe.Substring(9)),[IO.Pipes.PipeDirection]::InOut,[IO.Pipes.PipeOptions]::Asynchronous,[Security.Principal.TokenImpersonationLevel]::Identification)
            try {
                $pipe.Connect(5000)
                if([MediaSailBrowserProcess]::PipeServerPid($pipe.SafePipeHandle) -ne [int]$Context.info.pid){throw 'The desktop pipe belongs to another process'}
                $process=Get-Process -Id $Context.info.pid -ErrorAction Stop
                if($process.Path -ne $Context.info.executable){throw 'The desktop browser process path changed'}
                $writer=New-Object IO.StreamWriter($pipe,$script:Utf8,1024,$true);$writer.AutoFlush=$true
                $reader=New-Object IO.StreamReader($pipe,$script:Utf8,$false,1024,$true)
                try {
                    $writer.WriteLine(($request|ConvertTo-Json -Depth 8 -Compress))
                    $read=$reader.ReadLineAsync();if(!$read.Wait(10000)){throw 'Desktop browser response timed out'}
                    $response=$read.Result|ConvertFrom-Json
                }finally{$writer.Dispose();$reader.Dispose()}
            }finally{$pipe.Dispose()}
            if($response.state -eq 'completed' -and $response.receipt){$response.receipt|Add-Member NoteProperty requestId $RequestId -Force;return $response.receipt}
            if(!$response.ok -or $response.state -ne 'pending' -or $Query){return $response}
            $request.action='status';$request.Remove('name');$request.Remove('url')
            Start-Sleep -Milliseconds 250
        }while([DateTime]::UtcNow -lt $deadline)
    }catch {
        return @{ok=$false;code='connect_unknown';requestId=$RequestId;error='The connection result is not confirmed. Query this request before retrying. '+$_.Exception.Message}
    }
    return @{ok=$false;code='connect_pending';requestId=$RequestId;error='The connection request is still pending. Query this request before retrying.'}
}
