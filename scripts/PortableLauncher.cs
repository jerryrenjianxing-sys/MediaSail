using System;
using System.IO;
using System.Diagnostics;
using System.Text;
class PortableLauncher {
  // Win32 argv quoting, including trailing backslashes and embedded quotes.
  static string Quote(string s) {
    var b=new StringBuilder("\""); int slashes=0;
    foreach(char c in s) {
      if(c=='\\'){slashes++;continue;}
      if(c=='\"'){b.Append('\\',slashes*2+1);b.Append(c);}else{b.Append('\\',slashes);b.Append(c);}
      slashes=0;
    }
    b.Append('\\',slashes*2);b.Append('"');return b.ToString();
  }
  static int Main(string[] args) {
    var folder=AppDomain.CurrentDomain.BaseDirectory;
    var name=Path.GetFileNameWithoutExtension(Process.GetCurrentProcess().MainModule.FileName);
    var python=Path.GetFullPath(Path.Combine(folder,"../python/cpython-3.11.15-windows-x86_64-none/python.exe"));
    var command=new StringBuilder();
    if(name!="python3" && name!="python") {
      string code;
      if(name=="easel")code="import sys; from easel.cli import main; sys.exit(main())";
      else if(name=="pip" || name=="pip3")code="import runpy; runpy.run_module('pip',run_name='__main__')";
      else code="import sys,importlib.metadata as m; sys.exit(next(e for e in m.entry_points(group='console_scripts') if e.name=="+"'"+name+"'"+").load()())";
      command.Append("-c ").Append(Quote(code)).Append(' ');
    }
    foreach(var arg in args)command.Append(Quote(arg)).Append(' ');
    try {
      var info=new ProcessStartInfo(python,command.ToString());info.UseShellExecute=false;info.CreateNoWindow=true;
      info.RedirectStandardOutput=true;info.RedirectStandardError=true;
      using(var process=new Process()){
        process.StartInfo=info;
        process.Start();
        var output=process.StandardOutput.BaseStream.CopyToAsync(Console.OpenStandardOutput());
        var error=process.StandardError.BaseStream.CopyToAsync(Console.OpenStandardError());
        process.WaitForExit();System.Threading.Tasks.Task.WaitAll(output,error);return process.ExitCode;
      }
    } catch(Exception e){Console.Error.WriteLine(e.Message);return 1;}
  }
}
