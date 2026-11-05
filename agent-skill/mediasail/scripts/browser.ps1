# MediaSail's optional browser tool. Windows PowerShell 5.1; no Python/Node required.
$Arguments=@($args)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
$script:Utf8=New-Object Text.UTF8Encoding($false)
function Read-Json([string]$File,[bool]$Optional=$false) {
    if(!(Test-Path -LiteralPath $File)){if($Optional){return $null};throw ('Required file is missing: '+$File)}
    try {return (Get-Content -LiteralPath $File -Raw -Encoding UTF8|ConvertFrom-Json)} catch {throw ('JSON cannot be read; original retained: '+$File)}
}
function Save-Json([string]$File,$Value) {
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($File))|Out-Null
    $temporary=$File+'.'+[guid]::NewGuid().ToString('N')+'.tmp'
    try {
        $bytes=$script:Utf8.GetBytes(($Value|ConvertTo-Json -Depth 30 -Compress)+"`n")
        $stream=[IO.File]::Open($temporary,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
        try {$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)} finally {$stream.Dispose()}
        if([IO.File]::Exists($File)){[IO.File]::Replace($temporary,$File,$File+'.previous',$true)}else{[IO.File]::Move($temporary,$File)}
    } finally {if([IO.File]::Exists($temporary)){[IO.File]::Delete($temporary)}}
}
function Assert-PlainPath([string]$File) {
    $item=[IO.Path]::GetFullPath($File)
    while($item){
        if(Test-Path -LiteralPath $item){if(([IO.File]::GetAttributes($item) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw ('Directory links are not supported: '+$item)}}
        $parent=[IO.Path]::GetDirectoryName($item)
        if($parent -eq $item){break};$item=$parent
    }
}
function Inside([string]$Root,[string]$Relative) {
    if(!$Relative -or [IO.Path]::IsPathRooted($Relative) -or $Relative -match '[\x00-\x1f]'){throw 'Invalid relative asset path'}
    $base=[IO.Path]::GetFullPath($Root).TrimEnd('\','/')+[IO.Path]::DirectorySeparatorChar
    $result=[IO.Path]::GetFullPath((Join-Path $Root $Relative))
    if(!$result.StartsWith($base,[StringComparison]::OrdinalIgnoreCase)){throw 'Asset path leaves its owned directory'}
    Assert-PlainPath $result
    return $result
}
function Hash-File([string]$File) {
    Assert-PlainPath $File
    $algorithm=[Security.Cryptography.SHA256]::Create();$stream=[IO.File]::OpenRead($File)
    try {return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}finally{$stream.Dispose();$algorithm.Dispose()}
}
function Check-Hash([string]$File,[string]$Expected) {
    if($Expected -notmatch '^[a-f0-9]{64}$' -or !(Test-Path -LiteralPath $File -PathType Leaf) -or (Hash-File $File) -ne $Expected){throw ('Asset verification failed; no browser started: '+$File)}
}
function Expand-Safe([string]$Archive,[string]$Target) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Directory]::CreateDirectory($Target)|Out-Null
    $zip=[IO.Compression.ZipFile]::OpenRead($Archive)
    $seen=@{};$size=[long]0
    try {
        foreach($entry in $zip.Entries){
            $name=$entry.FullName.Replace('\','/')
            if($name.EndsWith('/')){if($name.Length -gt 1){[IO.Directory]::CreateDirectory((Inside $Target $name.TrimEnd('/')))|Out-Null};continue}
            $output=Inside $Target $name
            if($seen.ContainsKey($output)){throw 'Duplicate archive path'};$seen[$output]=$true
            $size+=$entry.Length;if($size -gt 2147483648){throw 'Browser archive exceeds the supported extraction size'}
            [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($output))|Out-Null
            $input=$entry.Open();$stream=[IO.File]::Open($output,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
            try {$input.CopyTo($stream);$stream.Flush($true)} finally {$input.Dispose();$stream.Dispose()}
        }
    } finally {$zip.Dispose()}
}
function Get-Context([string]$Connection) {
    $seen=@{};$file=[IO.Path]::GetFullPath($Connection);$useDiscovery=$true
    for($i=0;$i -lt 8;$i++){
        $info=Read-Json $file
        if($info.schema -ne 1 -or $info.product -ne 'MediaSail'){throw 'Not a MediaSail connection file'}
        if($useDiscovery){$useDiscovery=$false;if($info.discoveryFile -and [IO.Path]::GetFullPath($info.discoveryFile) -ne $file){$file=[IO.Path]::GetFullPath($info.discoveryFile);continue}}
        if($seen.ContainsKey($file)){throw 'Connection discovery loop'};$seen[$file]=$true
        if($info.connectionFile -and [IO.Path]::GetFullPath($info.connectionFile) -ne $file){$file=[IO.Path]::GetFullPath($info.connectionFile);continue}
        break
    }
    if($i -ge 8 -or !$info.libraryRoot -or $info.status -eq 'needs-library'){throw 'Choose a MediaSail library first'}
    $library=[IO.Path]::GetFullPath($info.libraryRoot);Assert-PlainPath $library
    $marker=Read-Json (Join-Path $library '.mediasail-library.json')
    if($marker.product -ne 'MediaSail' -or $marker.state -ne 'ready' -or $marker.libraryId -ne $info.libraryId){throw 'Library identity does not match the connection'}
    if(!$info.browserTools.manifest){throw 'This MediaSail installation does not provide browser assets'}
    $manifestFile=[IO.Path]::GetFullPath($info.browserTools.manifest);Assert-PlainPath $manifestFile
    $manifest=Read-Json $manifestFile
    if($manifest.schema -ne 1 -or $manifest.product -ne 'MediaSailBrowser' -or $manifest.bundleId -notmatch '^[a-f0-9]{64}$'){throw 'Unsupported browser asset manifest'}
    # Keep ordinary Documents/OneDrive paths below PS 5.1's native path limit.
    # The complete fingerprint remains in the verified cache manifest.
    return @{info=$info;library=$library;state=(Join-Path $library 'runtime/browser');manifest=$manifest;source=[IO.Path]::GetDirectoryName($manifestFile);cache=(Join-Path $library ('runtime/cache/browser-tool/'+$manifest.bundleId.Substring(0,24)))}
}
function Check-Cache($Context) {
    foreach($entry in $Context.manifest.cacheFiles){Check-Hash (Inside $Context.cache $entry.path) $entry.sha256}
}
function Prepare($Context) {
    $m=$Context.manifest
    foreach($entry in $m.cacheFiles){
        if((Join-Path $Context.cache $entry.path).Length -gt 247){throw 'The browser cache path is too long for Windows PowerShell 5.1. Choose a shorter library location; existing data is unchanged'}
    }
    if(Test-Path -LiteralPath $Context.cache){
        $cached=Read-Json (Join-Path $Context.cache 'manifest.json')
        if($cached.bundleId -ne $m.bundleId){throw 'Browser cache fingerprint collision; both versions were retained. No browser started'}
        Check-Cache $Context;return @{ok=$true;prepared=$true;reused=$true;libraryId=$Context.info.libraryId;cache=$Context.cache;browserVersion=$m.browser.version;toolVersion=$m.bsk.version}
    }
    $archive=Inside $Context.source $m.browser.archive;Check-Hash $archive $m.browser.sha256
    $extension=Inside $Context.source $m.extension.archive;Check-Hash $extension $m.extension.sha256
    $bsk=Inside $Context.source $m.bsk.file;Check-Hash $bsk $m.bsk.sha256
    # A sibling staging name must not append another UUID to the long fingerprint.
    $stage=Join-Path ([IO.Path]::GetDirectoryName($Context.cache)) ('.staging-'+[guid]::NewGuid().ToString('N'))
    [IO.Directory]::CreateDirectory($stage)|Out-Null
    # An interrupted or failed stage is retained for diagnosis; it is never active.
    Expand-Safe $archive (Join-Path $stage 'browser')
    Expand-Safe $extension (Join-Path $stage 'extension')
    [IO.File]::Copy($bsk,(Join-Path $stage 'bsk.exe'))
    foreach($helper in $m.runtimeHelpers){
        $original=Inside $Context.source $helper.file;Check-Hash $original $helper.sha256
        $destination=Inside $stage $helper.file
        [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination))|Out-Null
        [IO.File]::Copy($original,$destination)
    }
    $candidate=@{manifest=$m;cache=$stage};Check-Cache $candidate
    Save-Json (Join-Path $stage 'manifest.json') $m
    [IO.Directory]::Move($stage,$Context.cache)
    return @{ok=$true;prepared=$true;reused=$false;libraryId=$Context.info.libraryId;cache=$Context.cache;browserVersion=$m.browser.version;toolVersion=$m.bsk.version}
}
function Read-Group([string]$File) {
    $group=Read-Json $File
    if($group.schema -ne 1 -or $group.product -ne 'MediaSailBrowserGroup' -or $group.id -notmatch '^[a-f0-9-]{36}$'){throw 'Invalid browser group record; original retained'}
    Assert-PlainPath $File
    $expected=Inside (Join-Path $group.libraryRoot 'runtime/browser') ('groups/'+$group.id+'/group.json')
    if([IO.Path]::GetFullPath($File) -ne $expected){throw 'Browser group location does not match its library'}
    $marker=Read-Json (Join-Path $group.libraryRoot '.mediasail-library.json')
    if($marker.product -ne 'MediaSail' -or $marker.schema -ne 1 -or $marker.libraryId -ne $group.libraryId -or $marker.state -ne 'ready'){throw 'The original browser library is unavailable or has changed'}
    if($group.bundleId -notmatch '^[a-f0-9]{64}$'){throw 'Invalid browser cache fingerprint'}
    $cache=Inside (Join-Path $group.libraryRoot 'runtime/cache/browser-tool') ([IO.Path]::GetFileName($group.cache))
    if([IO.Path]::GetFileName($cache) -notin @($group.bundleId,$group.bundleId.Substring(0,24)) -or $cache -ne [IO.Path]::GetFullPath($group.cache) -or $group.profile -ne (Join-Path $group.libraryRoot 'runtime/browser/profile')){throw 'Browser group paths do not match their library'}
    $manifest=Read-Json (Join-Path $cache 'manifest.json')
    if($manifest.bundleId -ne $group.bundleId -or $group.directory -ne [IO.Path]::GetDirectoryName($expected) -or $group.browserExecutable -ne (Inside $cache $manifest.browser.executable) -or $group.token -notmatch '^[a-f0-9]{64}$' -or $group.port -lt 1 -or $group.port -gt 65535){throw 'Browser group assets or private endpoint do not match their recorded version'}
    return $group
}
function Owned-Browser($Group) {
    if(!$Group -or !$Group.browserPid){return $false}
    try {
        $process=Get-Process -Id $Group.browserPid -ErrorAction Stop
        return ($process.Path -eq $Group.browserExecutable -and $process.StartTime.ToUniversalTime().Ticks.ToString() -eq $Group.browserStarted)
    } catch {return $false}
}
function Active-Group($Context) {
    $active=Read-Json (Join-Path $Context.state 'active-group.json') $true
    if(!$active){return $null}
    if($active.libraryId -ne $Context.info.libraryId){throw 'Active browser belongs to another library'}
    return (Read-Group (Inside $Context.state ('groups/'+$active.id+'/group.json')))
}
function Tool($Group,[string[]]$NativeArgs,[int]$Timeout=60000) {
    if(!('MediaSailBrowserProcess' -as [type])){Add-Type -TypeDefinition ([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'browser-native.cs'))) -Language CSharp}
    $manifest=Read-Json (Join-Path $Group.cache 'manifest.json')
    $exe=Join-Path $Group.cache 'bsk.exe';Check-Hash $exe $manifest.bsk.sha256
    return [MediaSailBrowserProcess]::Run($exe,$NativeArgs,(Join-Path $Group.directory 'bsk-home'),$Group.token,$manifest.extension.extensionId,$Timeout)
}
function Tool-Json($Group,[string[]]$NativeArgs) {
    $response=Tool $Group $NativeArgs
    if($response.ExitCode -ne 0){throw ('Browser tool failed: '+$response.Stdout+$response.Stderr).Trim()}
    try {return ($response.Stdout|ConvertFrom-Json)}catch{throw 'Browser tool returned an unreadable response; inspect its private log before retrying'}
}
function Ensure-GroupDaemon($Group,[bool]$Start=$false) {
    $manifest=Read-Json (Join-Path $Group.cache 'manifest.json')
    $identity=Tool-Json $Group @('mediasail-info','--json')
    if(!$identity.managed -or $identity.product -ne 'MediaSailBrowserSkill' -or $identity.build -ne $manifest.bsk.build -or $identity.version -ne $manifest.bsk.version -or $identity.protocol -ne $manifest.bsk.protocol -or $identity.target -ne $manifest.bsk.identity.target){throw 'BrowserSkill adapted build identity does not match the verified group'}
    $response=if($Start){$null}else{Tool $Group @('status','--json')}
    if($Start -or $response.ExitCode -ne 0){
        # Explicit connect can restore this group's daemon, never a different
        # endpoint or browser. Normal run/status never perform this recovery.
        $started=Tool $Group @('daemon','start','--port',[string]$Group.port,'--session-idle','24h','--daemon-idle','10m','--json')
        if($started.ExitCode -ne 0){throw ('The original private daemon could not reconnect; browser and login data were retained. '+$started.Stdout+$started.Stderr)}
    }
    $status=Tool-Json $Group @('status','--json')
    $daemon=Get-Process -Id $status.pid -ErrorAction Stop
    if($status.ws_port -ne $Group.port -or $status.daemon_version -ne $Group.toolVersion -or $status.protocol_version -ne $manifest.bsk.protocol -or $daemon.Path -ne (Join-Path $Group.cache 'bsk.exe')){throw 'Private browser daemon identity did not match; no other endpoint was adopted'}
    $Group.daemonPid=$status.pid
    Save-Json (Join-Path $Group.directory 'group.json') $Group
    return $status
}
function Copy-Tree([string]$Source,[string]$Target) {
    Assert-PlainPath $Source;Assert-PlainPath $Target
    [IO.Directory]::CreateDirectory($Target)|Out-Null
    foreach($entry in [IO.Directory]::GetFileSystemEntries($Source)){
        Assert-PlainPath $entry
        $destination=Inside $Target ([IO.Path]::GetFileName($entry))
        if([IO.Directory]::Exists($entry)){Copy-Tree $entry $destination}
        else {
            $input=[IO.File]::Open($entry,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
            $output=[IO.File]::Open($destination,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
            try {$input.CopyTo($output);$output.Flush($true)}finally{$input.Dispose();$output.Dispose()}
            if((Hash-File $entry) -ne (Hash-File $destination)){throw 'Browser profile backup verification failed; original profile is retained'}
        }
    }
}
function Snapshot-Profile($Context,[string]$OldVersion) {
    $profile=Join-Path $Context.state 'profile'
    $parent=Join-Path $Context.state 'profile-backups';[IO.Directory]::CreateDirectory($parent)|Out-Null
    $id=[guid]::NewGuid().ToString('N');$stage=Inside $parent ($id+'.staging');$target=Inside $parent $id
    Copy-Tree $profile (Join-Path $stage 'profile')
    Save-Json (Join-Path $stage 'snapshot.json') @{schema=1;verified=$true;libraryId=$Context.info.libraryId;fromVersion=$OldVersion;toVersion=$Context.manifest.browser.version;createdAt=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()}
    [IO.Directory]::Move($stage,$target)
    return $target
}
function Start-Group($Context) {
    $prepared=Prepare $Context
    $profile=Join-Path $Context.state 'profile'
    $history=Read-Json (Join-Path $Context.state 'profile-version.json') $true
    if((Test-Path -LiteralPath $profile) -and !$history -and [IO.Directory]::GetFileSystemEntries($profile).Length){throw 'Unrecognized browser profile retained; refusing to import or downgrade another profile'}
    if($history -and $history.libraryId -ne $Context.info.libraryId){throw 'Browser profile library identity changed'}
    if($history -and [version]$history.version -gt [version]$Context.manifest.browser.version){throw 'Refusing to open a newer browser profile with an older browser; update MediaSail'}
    # Also refuse a manually started process using this exact dedicated profile.
    $inUse=@(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'"|Where-Object {$_.CommandLine -and $_.CommandLine.IndexOf($profile,[StringComparison]::OrdinalIgnoreCase) -ge 0})
    if($inUse.Count){throw 'The dedicated browser profile is already in use; its process was retained'}
    $backup=$null
    if($history -and [version]$history.version -lt [version]$Context.manifest.browser.version){$backup=Snapshot-Profile $Context $history.version}
    $id=[guid]::NewGuid().ToString();$directory=Inside $Context.state ('groups/'+$id)
    [IO.Directory]::CreateDirectory($directory)|Out-Null
    $listener=New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback,0);$listener.Start();$port=$listener.LocalEndpoint.Port;$listener.Stop()
    $bytes=New-Object byte[] 32;$rng=[Security.Cryptography.RandomNumberGenerator]::Create();try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
    $token=[BitConverter]::ToString($bytes).Replace('-','').ToLowerInvariant()
    $group=@{schema=1;product='MediaSailBrowserGroup';id=$id;libraryId=$Context.info.libraryId;libraryRoot=$Context.library;directory=$directory;cache=$Context.cache;bundleId=$Context.manifest.bundleId;browserVersion=$Context.manifest.browser.version;toolVersion=$Context.manifest.bsk.version;profile=$profile;browserExecutable=(Inside $Context.cache $Context.manifest.browser.executable);token=$token;port=$port;browserPid=$null;browserStarted=$null;backup=$backup}
    Copy-Tree (Join-Path $Context.cache 'extension') (Join-Path $directory 'extension')
    Save-Json (Join-Path $directory 'extension/mediasail-bootstrap.json') @{groupId=$token;build=$Context.manifest.bsk.build;wsUrl=('ws://127.0.0.1:'+ $port+'/?mediasailGroup='+$token)}
    Save-Json (Join-Path $directory 'group.json') $group
    $status=Ensure-GroupDaemon $group $true
    $welcome=Join-Path $directory 'welcome.html'
    [IO.File]::Copy((Join-Path $Context.cache 'browser-welcome.html'),$welcome)
    [IO.File]::Copy((Join-Path $Context.cache 'browser-icon.png'),(Join-Path $directory 'browser-icon.png'))
    Save-Json (Join-Path $Context.state 'profile-version.json') @{schema=1;libraryId=$Context.info.libraryId;version=$group.browserVersion;attemptedAt=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()}
    $launched=Tool-Json $group @('managed-launch','--executable',$group.browserExecutable,'--log',(Join-Path $directory 'browser.log'),'--',('--user-data-dir='+$profile),('--load-extension='+(Join-Path $directory 'extension')),'--no-first-run','--no-default-browser-check','--window-size=1280,900',([uri]$welcome).AbsoluteUri)
    if(!$launched.ok -or !$launched.independent){throw 'Browser independence could not be verified'}
    $process=Get-Process -Id $launched.pid -ErrorAction Stop
    if($process.Path -ne $group.browserExecutable){throw 'Browser process path did not match the verified assets'}
    $group.browserPid=$process.Id;$group.browserStarted=$process.StartTime.ToUniversalTime().Ticks.ToString()
    Save-Json (Join-Path $directory 'group.json') $group
    Save-Json (Join-Path $Context.state 'active-group.json') @{schema=1;libraryId=$group.libraryId;id=$id}
    return $group
}
function Connect($Context,[string]$Name,[string]$Url) {
    $null=Prepare $Context
    $group=Active-Group $Context
    if(!(Owned-Browser $group)){
        if($group){$stopped=Tool $group @('daemon','stop','--json');if($stopped.ExitCode -ne 0){throw 'The previous private daemon could not stop; its files and profile were retained'}}
        $group=Start-Group $Context
    }
    $initialStatus=Ensure-GroupDaemon $group
    $groupManifest=Read-Json (Join-Path $group.cache 'manifest.json')
    $until=[DateTime]::UtcNow.AddSeconds(45);$status=$null
    do {
        $status=Tool-Json $group @('status','--json')
        $browsers=@($status.browsers|Where-Object {!$_.unresponsive -and !$_.version_skew})
        if($browsers.Count -gt 1){throw 'More than one browser connected to this private group; no browser was selected'}
        if($browsers.Count -eq 1){break}
        if(!(Owned-Browser $group)){throw 'The dedicated browser exited before connecting; inspect the private browser log'}
        Start-Sleep -Milliseconds 250
    }while([DateTime]::UtcNow -lt $until)
    if($browsers.Count -ne 1){throw 'The dedicated browser is open but its extension did not connect; browser and login data were retained'}
    if($browsers[0].extension_version -ne $group.toolVersion -or $browsers[0].extension_protocol_version -ne $groupManifest.bsk.protocol -or $status.ws_port -ne $group.port){throw 'Browser group versions or endpoint changed'}
    if(!$Name){$Name='MediaSail Agent'}
    $session=Tool-Json $group @('session','start','--browser',$browsers[0].instance_id,'--name',$Name,'--focus','--json')
    if(!$session.session_id){throw 'Browser did not return a task session'}
    $reference=[guid]::NewGuid().ToString();$entry=Join-Path $Context.cache 'browser.ps1'
    $record=@{schema=1;libraryId=$group.libraryId;sessionRef=$reference;sessionId=$session.session_id;groupFile=(Join-Path $group.directory 'group.json');state='connected'}
    Save-Json (Inside $Context.state ('sessions/'+$reference+'.json')) $record
    $receipt=@{ok=$true;libraryId=$group.libraryId;sessionRef=$reference;sessionId=$session.session_id;toolGroupId=$group.id;entry=$entry;groupConfig=$record.groupFile;browserVersion=$group.browserVersion;toolVersion=$group.toolVersion;pendingUpdate=($group.bundleId -ne $Context.manifest.bundleId)}
    if($Url){
        try {$uri=[uri]$Url;if($uri.Scheme -notin @('http','https')){throw 'Initial navigation must use http or https'};$navigation=Tool $group @('navigate',$Url,'--session',$session.session_id,'--json');if($navigation.ExitCode -ne 0){throw $navigation.Stdout}}
        catch {$receipt.navigationWarning='Connection succeeded; initial navigation could not be confirmed. Inspect the task window before continuing.'}
    }
    return $receipt
}
function Session-Record($Context,[string]$Reference) {
    if($Reference -notmatch '^[a-f0-9-]{36}$'){throw 'Invalid browser session reference'}
    $record=Read-Json (Inside $Context.state ('sessions/'+$Reference+'.json')) $true
    if(!$record){throw 'Browser session not found; use the original receipt or explicitly connect again'}
    if($record.libraryId -ne $Context.info.libraryId -or $record.sessionRef -ne $Reference){throw 'Browser session belongs to another library'}
    if($record.state -ne 'connected'){throw 'Browser session is already disconnected; no new browser was started'}
    return $record
}
try {
    $action=if($Arguments.Count){$Arguments[0]}else{'status'}
    $connection=$null;$groupFile=$null;$reference=$null;$name=$null;$url=$null;$native=@();$desktopOwned=$false;$requestId=$null
    for($i=1;$i -lt $Arguments.Count;$i++){
        if($Arguments[$i] -eq '--connection' -and $i+1 -lt $Arguments.Count){$i++;$connection=$Arguments[$i]}
        elseif($Arguments[$i] -eq '--group-config' -and $i+1 -lt $Arguments.Count){$i++;$groupFile=$Arguments[$i]}
        elseif($Arguments[$i] -eq '--session-ref' -and $i+1 -lt $Arguments.Count){$i++;$reference=$Arguments[$i]}
        elseif($Arguments[$i] -eq '--name' -and $i+1 -lt $Arguments.Count){$i++;$name=$Arguments[$i]}
        elseif($Arguments[$i] -eq '--url' -and $i+1 -lt $Arguments.Count){$i++;$url=$Arguments[$i]}
        elseif($Arguments[$i] -eq '--request-id' -and $i+1 -lt $Arguments.Count){$i++;$requestId=$Arguments[$i]}
        elseif($Arguments[$i] -eq '--desktop-owned'){$desktopOwned=$true}
        elseif($Arguments[$i] -eq '--'){$native=@($Arguments|Select-Object -Skip ($i+1));break}
        else {throw ('Unknown browser argument: '+$Arguments[$i])}
    }
    if($groupFile){
        $fixed=Read-Group $groupFile
        $context=@{info=@{libraryId=$fixed.libraryId};library=$fixed.libraryRoot;state=(Join-Path $fixed.libraryRoot 'runtime/browser');cache=$fixed.cache;manifest=(Read-Json (Join-Path $fixed.cache 'manifest.json'));source=$null}
    }else{if(!$connection){throw 'Missing --connection path'};$context=Get-Context $connection}
    [IO.Directory]::CreateDirectory($context.state)|Out-Null
    $lockFile=Join-Path $context.state 'prepare.lock'
    $lock=$null
    if($action -eq 'prepare' -or ($action -eq 'connect' -and $desktopOwned)){
        $until=[DateTime]::UtcNow.AddSeconds(30)
        do {try{$lock=[IO.File]::Open($lockFile,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}catch [IO.IOException]{if([DateTime]::UtcNow -ge $until){throw 'Another browser preparation is still running'};Start-Sleep -Milliseconds 100}}while(!$lock)
    }
    try {
        switch($action){
            'prepare' {$result=Prepare $context}
            'status' {if($requestId){. (Join-Path $PSScriptRoot 'browser-connector.ps1');$result=Request-BrowserConnection $context $null $null $requestId $true}else{$active=Active-Group $context;$result=@{ok=$true;prepared=(Test-Path -LiteralPath (Join-Path $context.cache 'manifest.json'));running=(Owned-Browser $active);libraryId=$context.info.libraryId;browserVersion=$context.manifest.browser.version;toolVersion=$context.manifest.bsk.version}}}
            'connect' {
                if($desktopOwned){
                    $credential=Read-Json $context.info.browserTools.connector.credentialFile
                    if(!$env:MEDIASAIL_BROWSER_HOST_TOKEN -or $env:MEDIASAIL_BROWSER_HOST_TOKEN -ne $credential.token -or $credential.instanceId -ne $context.info.instanceId -or $credential.libraryId -ne $context.info.libraryId){throw 'Desktop-owned browser startup was not authorized'}
                    $result=Connect $context $name $url
                }else{. (Join-Path $PSScriptRoot 'browser-connector.ps1');$result=Request-BrowserConnection $context $name $url $requestId}
            }
            'run' {
                $record=Session-Record $context $reference;$group=Read-Group $record.groupFile
                if(!(Owned-Browser $group)){throw 'The original browser connection ended; inspect or explicitly reconnect. No browser was started'}
                if(!$native.Count){throw 'Provide a BrowserSkill command after --'}
                $commandsWithoutSession=@('status','browsers','session','daemon','logs','doctor','help','--help','--version')
                if($native[0] -notin $commandsWithoutSession){
                    $position=[array]::IndexOf($native,'--session')
                    if($position -ge 0){if($position+1 -ge $native.Count -or $native[$position+1] -ne $record.sessionId){throw 'Native session does not match the supplied sessionRef'}}
                    else{$native+=@('--session',$record.sessionId)}
                }
                if($native -notcontains '--json'){$native+='--json'}
                $answer=Tool $group $native 180000
                if($answer.Stderr){[Console]::Error.Write($answer.Stderr)}
                Write-Output -NoEnumerate $answer.Stdout.TrimEnd();$nativeExit=$answer.ExitCode
            }
            'disconnect' {
                $record=Session-Record $context $reference;$group=Read-Group $record.groupFile
                $answer=Tool-Json $group @('session','stop',$record.sessionId,'--json')
                if(@($answer.stopped) -notcontains $record.sessionId){throw 'Session closure could not be confirmed; browser was retained'}
                $record.state='disconnected';Save-Json (Inside $context.state ('sessions/'+$reference+'.json')) $record
                $result=@{ok=$true;sessionRef=$reference;disconnected=$true;browserRetained=$true}
            }
            default {throw ('Unsupported browser action: '+$action)}
        }
    } finally {if($lock){$lock.Dispose()}}
    if($null -ne $nativeExit){exit $nativeExit}
    $result|ConvertTo-Json -Depth 20 -Compress
    if($result.ok -eq $false){exit 1};exit 0
} catch {
    @{ok=$false;error=$_.Exception.Message;action=$action}|ConvertTo-Json -Compress
    exit 1
}
