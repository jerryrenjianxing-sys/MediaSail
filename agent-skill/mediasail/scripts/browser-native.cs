// Windows' built-in .NET Framework only. No shell or global environment changes.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Text;
public sealed class MediaSailBrowserResult {
    public int ExitCode;
    public string Stdout;
    public string Stderr;
}
public static class MediaSailBrowserProcess {
    private static string Quote(string value) {
        StringBuilder text=new StringBuilder("\""); int slashes=0;
        foreach(char c in value) {
            if(c=='\\') { slashes++; continue; }
            text.Append('\\', c=='\"' ? slashes*2+1 : slashes);
            text.Append(c); slashes=0;
        }
        text.Append('\\',slashes*2); return text.Append('"').ToString();
    }
    public static MediaSailBrowserResult Run(string executable,string[] arguments,string home,string group,string extension,int timeout) {
        ProcessStartInfo start=new ProcessStartInfo(executable);
        StringBuilder command=new StringBuilder();
        foreach(string argument in arguments) { if(command.Length>0)command.Append(' ');command.Append(Quote(argument)); }
        start.Arguments=command.ToString();start.UseShellExecute=false;start.CreateNoWindow=true;
        start.RedirectStandardOutput=true;start.RedirectStandardError=true;
        start.StandardOutputEncoding=new UTF8Encoding(false);start.StandardErrorEncoding=new UTF8Encoding(false);
        // Keep the real Windows browser environment; do not inherit API keys or business tokens.
        Dictionary<string,string> retained=new Dictionary<string,string>();
        foreach(string key in new string[]{"SystemRoot","WINDIR","ComSpec","SystemDrive","USERPROFILE","HOMEDRIVE","HOMEPATH","APPDATA","LOCALAPPDATA","TEMP","TMP","USERNAME","OS","PROCESSOR_ARCHITECTURE","NUMBER_OF_PROCESSORS","HTTP_PROXY","HTTPS_PROXY","ALL_PROXY","http_proxy","https_proxy","all_proxy"}) {
            string value=Environment.GetEnvironmentVariable(key);if(value!=null)retained[key]=value;
        }
        start.EnvironmentVariables.Clear();foreach(KeyValuePair<string,string> item in retained)start.EnvironmentVariables[item.Key]=item.Value;
        string system=Environment.GetFolderPath(Environment.SpecialFolder.System);
        start.EnvironmentVariables["PATH"]=system+";"+Environment.GetEnvironmentVariable("WINDIR");
        start.EnvironmentVariables["BSK_HOME"]=home;start.EnvironmentVariables["BSK_AUTO_UPDATE"]="off";start.EnvironmentVariables["BSK_AUTO_START"]="0";
        start.EnvironmentVariables["MEDIASAIL_BROWSER_GROUP"]=group;start.EnvironmentVariables["MEDIASAIL_EXTENSION_ID"]=extension;
        start.EnvironmentVariables["NO_PROXY"]="localhost,127.0.0.1,::1";
        using(Process process=Process.Start(start)) {
            var output=process.StandardOutput.ReadToEndAsync();var error=process.StandardError.ReadToEndAsync();
            if(!process.WaitForExit(timeout)) {
                try { process.Kill();process.WaitForExit(5000); }catch {}
                throw new InvalidOperationException("Browser tool timed out; operation result is unknown. Inspect the page before retrying.");
            }
            process.WaitForExit();
            return new MediaSailBrowserResult{ExitCode=process.ExitCode,Stdout=output.GetAwaiter().GetResult(),Stderr=error.GetAwaiter().GetResult()};
        }
    }
}
