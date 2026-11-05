// Win32 environment blocks avoid .NET's failure on case-duplicate host keys.
using System;
using System.IO;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;
public sealed class MediaSailBrowserResult {public int ExitCode;public string Stdout;public string Stderr;}
public static class MediaSailBrowserProcess {
    const uint StartWithStandardHandles=0x100, CreateNoWindow=0x08000000, ExtendedStartupInfoPresent=0x00080000, CreateUnicodeEnvironment=0x00000400;
    static readonly IntPtr InheritedHandleList=new IntPtr(0x20002);
    [StructLayout(LayoutKind.Sequential)] struct Security {public int size;public IntPtr descriptor;[MarshalAs(UnmanagedType.Bool)] public bool inherit;}
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Startup {
        public uint cb;public string reserved,desktop,title;public uint x,y,cols,rows,charsX,charsY,fill,flags;
        public ushort show,reserved2;public IntPtr reservedPointer,input,output,error;
    }
    [StructLayout(LayoutKind.Sequential)] struct ExtendedStartup {public Startup startup;public IntPtr attributes;}
    [StructLayout(LayoutKind.Sequential)] struct ProcessInfo {public IntPtr process,thread;public uint pid,tid;}
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr GetEnvironmentStringsW();
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern bool FreeEnvironmentStringsW(IntPtr block);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool CreatePipe(out IntPtr read,out IntPtr write,ref Security security,uint size);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetHandleInformation(IntPtr handle,uint mask,uint flags);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateFileW(string name,uint access,uint share,ref Security security,uint creation,uint flags,IntPtr template);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,int flags,ref IntPtr size);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,IntPtr size,IntPtr previous,IntPtr returned);
    [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcessW(string app,StringBuilder cmd,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref ExtendedStartup startup,out ProcessInfo process);
    [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr handle,out uint code);
    [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr handle,uint code);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetNamedPipeServerProcessId(IntPtr handle,out uint pid);
    public static int PipeServerPid(SafePipeHandle handle){uint pid;if(!GetNamedPipeServerProcessId(handle.DangerousGetHandle(),out pid))throw new Win32Exception();return (int)pid;}
    static void Close(ref IntPtr handle){if(handle!=IntPtr.Zero&&handle!=new IntPtr(-1))CloseHandle(handle);handle=IntPtr.Zero;}
    static string Quote(string value) {
        StringBuilder text=new StringBuilder("\"");int slashes=0;
        foreach(char c in value){if(c=='\\'){slashes++;continue;}text.Append('\\',c=='\"'?slashes*2+1:slashes);text.Append(c);slashes=0;}
        return text.Append('\\',slashes*2).Append('"').ToString();
    }
    static string EnvironmentBlock(string home,string group,string extension){
        var raw=new Dictionary<string,string>(StringComparer.Ordinal);
        IntPtr block=GetEnvironmentStringsW();if(block==IntPtr.Zero)throw new Win32Exception();
        try{for(IntPtr item=block;;){string value=Marshal.PtrToStringUni(item);if(value.Length==0)break;int at=value.IndexOf('=');if(at>0)raw[value.Substring(0,at)]=value.Substring(at+1);item=IntPtr.Add(item,(value.Length+1)*2);}}finally{FreeEnvironmentStringsW(block);}
        var retained=new SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase);
        foreach(string key in new string[]{"SystemRoot","WINDIR","ComSpec","SystemDrive","USERPROFILE","HOMEDRIVE","HOMEPATH","APPDATA","LOCALAPPDATA","TEMP","TMP","USERNAME","OS","PROCESSOR_ARCHITECTURE","NUMBER_OF_PROCESSORS","HTTP_PROXY","HTTPS_PROXY","ALL_PROXY","NO_PROXY"}){
            string value;if(raw.TryGetValue(key,out value)){retained[key]=value;continue;}
            foreach(var pair in raw)if(String.Equals(pair.Key,key,StringComparison.OrdinalIgnoreCase)){retained[key]=pair.Value;break;}
        }
        retained["PATH"]=Environment.GetFolderPath(Environment.SpecialFolder.System)+";"+(retained.ContainsKey("WINDIR")?retained["WINDIR"]:"");
        retained["BSK_HOME"]=home;retained["BSK_AUTO_UPDATE"]="off";retained["BSK_AUTO_START"]="0";
        retained["MEDIASAIL_BROWSER_GROUP"]=group;retained["MEDIASAIL_EXTENSION_ID"]=extension;
        retained["NO_PROXY"]=(retained.ContainsKey("NO_PROXY")?retained["NO_PROXY"]+",":"")+"localhost,127.0.0.1,::1";
        var entries=new List<string>();foreach(var pair in retained)entries.Add(pair.Key+"="+pair.Value);
        return String.Join("\0",entries.ToArray())+"\0\0";
    }
    public static MediaSailBrowserResult Run(string executable,string[] arguments,string home,string group,string extension,int timeout){
        IntPtr readOut=IntPtr.Zero,writeOut=IntPtr.Zero,readError=IntPtr.Zero,writeError=IntPtr.Zero,input=IntPtr.Zero,attributes=IntPtr.Zero,handles=IntPtr.Zero,environment=IntPtr.Zero;
        ProcessInfo process=new ProcessInfo();bool initialized=false;
        try{
            Security security=new Security();security.size=Marshal.SizeOf(typeof(Security));security.inherit=true;
            if(!CreatePipe(out readOut,out writeOut,ref security,0)||!CreatePipe(out readError,out writeError,ref security,0))throw new Win32Exception();
            if(!SetHandleInformation(readOut,1,0)||!SetHandleInformation(readError,1,0))throw new Win32Exception();
            input=CreateFileW("NUL",0x80000000u,3,ref security,3,128,IntPtr.Zero);if(input==new IntPtr(-1))throw new Win32Exception();
            IntPtr size=IntPtr.Zero;InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref size);
            attributes=Marshal.AllocHGlobal(size);if(!InitializeProcThreadAttributeList(attributes,1,0,ref size))throw new Win32Exception();initialized=true;
            handles=Marshal.AllocHGlobal(IntPtr.Size*3);Marshal.Copy(new IntPtr[]{input,writeOut,writeError},0,handles,3);
            if(!UpdateProcThreadAttribute(attributes,0,InheritedHandleList,handles,new IntPtr(IntPtr.Size*3),IntPtr.Zero,IntPtr.Zero))throw new Win32Exception();
            ExtendedStartup startup=new ExtendedStartup();startup.startup.cb=(uint)Marshal.SizeOf(typeof(ExtendedStartup));startup.startup.flags=StartWithStandardHandles;startup.startup.input=input;startup.startup.output=writeOut;startup.startup.error=writeError;startup.attributes=attributes;
            var command=new StringBuilder(Quote(executable));foreach(string argument in arguments)command.Append(' ').Append(Quote(argument));
            environment=Marshal.StringToHGlobalUni(EnvironmentBlock(home,group,extension));
            if(!CreateProcessW(executable,command,IntPtr.Zero,IntPtr.Zero,true,CreateNoWindow|ExtendedStartupInfoPresent|CreateUnicodeEnvironment,environment,null,ref startup,out process))throw new Win32Exception();
            Close(ref input);Close(ref writeOut);Close(ref writeError);
            using(var output=new StreamReader(new FileStream(new SafeFileHandle(readOut,true),FileAccess.Read),new UTF8Encoding(false)))
            using(var error=new StreamReader(new FileStream(new SafeFileHandle(readError,true),FileAccess.Read),new UTF8Encoding(false))){
                readOut=IntPtr.Zero;readError=IntPtr.Zero;
                var outputText=output.ReadToEndAsync();var errorText=error.ReadToEndAsync();
                if(WaitForSingleObject(process.process,(uint)timeout)!=0){TerminateProcess(process.process,1);WaitForSingleObject(process.process,5000);throw new InvalidOperationException("Browser tool timed out; operation result is unknown. Inspect the page before retrying.");}
                uint code;if(!GetExitCodeProcess(process.process,out code))throw new Win32Exception();
                return new MediaSailBrowserResult{ExitCode=(int)code,Stdout=outputText.GetAwaiter().GetResult(),Stderr=errorText.GetAwaiter().GetResult()};
            }
        }finally{
            Close(ref process.thread);Close(ref process.process);Close(ref readOut);Close(ref readError);Close(ref input);Close(ref writeOut);Close(ref writeError);
            if(initialized)DeleteProcThreadAttributeList(attributes);if(attributes!=IntPtr.Zero)Marshal.FreeHGlobal(attributes);if(handles!=IntPtr.Zero)Marshal.FreeHGlobal(handles);if(environment!=IntPtr.Zero)Marshal.FreeHGlobal(environment);
        }
    }
}
