using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class BrowserEnvironmentFixture {
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Startup {public uint cb;public string reserved,desktop,title;public uint x,y,cols,rows,charsX,charsY,fill,flags;public ushort show,reserved2;public IntPtr reservedPointer,input,output,error;}
    [StructLayout(LayoutKind.Sequential)] struct ProcessInfo {public IntPtr process,thread;public uint pid,tid;}
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcessW(string app,StringBuilder cmd,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref Startup si,out ProcessInfo pi);
    [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr handle,uint code);
    static string Self {get{return typeof(BrowserEnvironmentFixture).Assembly.Location;}}
    static string Esc(string text){return text.Replace("\\","\\\\").Replace("\"","\\\"").Replace("\r","\\r").Replace("\n","\\n");}
    public static int Main(string[] args){
        if(args[0]=="echo"){
            Console.OutputEncoding=new UTF8Encoding(false);
            Console.Write("{\"proxy\":\""+Esc(Environment.GetEnvironmentVariable("HTTPS_PROXY")??"")+"\",\"bypass\":\""+Esc(Environment.GetEnvironmentVariable("NO_PROXY")??"")+"\",\"argument\":\""+Esc(args[1])+"\"}");
            Console.Error.Write("中文诊断");return 0;
        }
        if(args[0]=="worker"){
            try{var result=MediaSailBrowserProcess.Run(Self,new string[]{"echo","中文 空格 \"quote\" \\end\\"},Path.GetDirectoryName(Self),new string('a',64),new string('b',32),5000);
                File.WriteAllText(args[1],"{\"ok\":true,\"exitCode\":"+result.ExitCode+",\"stdout\":\""+Esc(result.Stdout)+"\",\"stderr\":\""+Esc(result.Stderr)+"\"}",new UTF8Encoding(false));
            }catch(Exception error){File.WriteAllText(args[1],"{\"ok\":false,\"message\":\""+Esc(error.Message)+"\"}",new UTF8Encoding(false));}return 0;
        }
        var entries=new List<string>();
        foreach(string name in new string[]{"SystemRoot","WINDIR","ComSpec","SystemDrive","USERPROFILE","APPDATA","LOCALAPPDATA","TEMP","TMP"}){string value=Environment.GetEnvironmentVariable(name);if(value!=null)entries.Add(name+"="+value);}
        if(args[0]!="none")entries.Add("HTTPS_PROXY=http://127.0.0.1:9");
        if(args[0]=="duplicate")entries.Add("https_proxy=http://127.0.0.1:10");
        if(args[0]=="lower"){entries.Remove("HTTPS_PROXY=http://127.0.0.1:9");entries.Add("https_proxy=http://127.0.0.1:10");}
        entries.Add("no_proxy=example.invalid");entries.Sort(StringComparer.OrdinalIgnoreCase);
        IntPtr block=Marshal.StringToHGlobalUni(String.Join("\0",entries.ToArray())+"\0\0");
        Startup startup=new Startup();startup.cb=(uint)Marshal.SizeOf(typeof(Startup));ProcessInfo process;
        bool created=CreateProcessW(Self,new StringBuilder("\""+Self+"\" worker \""+args[1]+"\""),IntPtr.Zero,IntPtr.Zero,false,0x08000400u,block,Path.GetDirectoryName(Self),ref startup,out process);
        Marshal.FreeHGlobal(block);if(!created)throw new Exception("Fixture process failed: "+Marshal.GetLastWin32Error());
        try{if(WaitForSingleObject(process.process,10000)!=0){TerminateProcess(process.process,2);throw new Exception("Fixture timed out");}}finally{CloseHandle(process.thread);CloseHandle(process.process);}return 0;
    }
}
