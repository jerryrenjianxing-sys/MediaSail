# Test-owned command lifetime. The outer hosted runner Job is never changed.
$ErrorActionPreference='Stop'
if($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted'){throw 'Disposable hosted Windows fixture only'}
$forward=@($args)
if($forward.Count -lt 1){throw 'Missing fixture entry'}
Add-Type -Language CSharp -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class MediaSailCommandJob {
    // The static handle intentionally lives until this command host exits.
    // Closing it then cleans up children which did not explicitly break away.
    private static IntPtr ownedJob;
    [StructLayout(LayoutKind.Sequential)] struct Basic {
        public long processTime, jobTime;
        public uint flags;
        public UIntPtr minimumWorkingSet, maximumWorkingSet;
        public uint activeProcesses;
        public UIntPtr affinity;
        public uint priorityClass, schedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)] struct Counters {
        public ulong readOperations, writeOperations, otherOperations;
        public ulong readBytes, writeBytes, otherBytes;
    }
    [StructLayout(LayoutKind.Sequential)] struct Limits {
        public Basic basic;
        public Counters io;
        public UIntPtr processMemory, jobMemory, peakProcessMemory, peakJobMemory;
    }
    [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int kind, ref Limits limits, uint size);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    public static void Enter() {
        IntPtr job=CreateJobObject(IntPtr.Zero, null);
        if(job==IntPtr.Zero)throw new Win32Exception();
        Limits limits=new Limits();
        // KILL_ON_JOB_CLOSE | BREAKAWAY_OK, on our new nested Job only.
        limits.basic.flags=0x2000|0x800;
        if(!SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(typeof(Limits))) || !AssignProcessToJobObject(job,GetCurrentProcess())) {
            int error=Marshal.GetLastWin32Error();CloseHandle(job);throw new Win32Exception(error);
        }
        ownedJob=job;
    }
}
'@
[MediaSailCommandJob]::Enter()
$entry=$forward[0]
$remaining=@($forward|Select-Object -Skip 1)
& $entry @remaining
if($null -ne $LASTEXITCODE){exit $LASTEXITCODE}
