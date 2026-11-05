using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class MediaSailCommandJob {
    // The static handle intentionally lives until this command host exits.
    // Command fixtures clean children; desktop fixtures preserve installer-launched apps.
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
    public static void Enter(bool killOnClose) {
        IntPtr job=CreateJobObject(IntPtr.Zero, null);
        if(job==IntPtr.Zero)throw new Win32Exception();
        Limits limits=new Limits();
        // BREAKAWAY_OK and optional KILL_ON_JOB_CLOSE on the new nested Job only.
        limits.basic.flags=0x800|(killOnClose?0x2000u:0u);
        if(!SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(typeof(Limits))) || !AssignProcessToJobObject(job,GetCurrentProcess())) {
            int error=Marshal.GetLastWin32Error();CloseHandle(job);throw new Win32Exception(error);
        }
        ownedJob=job;
    }
}
