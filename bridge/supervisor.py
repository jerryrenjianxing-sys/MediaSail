"""Own every backend descendant in a Windows Job; EOF stops the whole tree."""
import ctypes, json, os, subprocess, sys, threading, time
from ctypes import wintypes
from pathlib import Path

def attach_job():
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    class BASIC(ctypes.Structure):
        _fields_=[('PerProcessUserTimeLimit',ctypes.c_int64),('PerJobUserTimeLimit',ctypes.c_int64),('LimitFlags',wintypes.DWORD),('MinimumWorkingSetSize',ctypes.c_size_t),('MaximumWorkingSetSize',ctypes.c_size_t),('ActiveProcessLimit',wintypes.DWORD),('Affinity',ctypes.c_size_t),('PriorityClass',wintypes.DWORD),('SchedulingClass',wintypes.DWORD)]
    class IO(ctypes.Structure):
        _fields_=[(name,ctypes.c_uint64) for name in ('ReadOperationCount','WriteOperationCount','OtherOperationCount','ReadTransferCount','WriteTransferCount','OtherTransferCount')]
    class EXTENDED(ctypes.Structure):
        _fields_=[('BasicLimitInformation',BASIC),('IoInfo',IO),('ProcessMemoryLimit',ctypes.c_size_t),('JobMemoryLimit',ctypes.c_size_t),('PeakProcessMemoryUsed',ctypes.c_size_t),('PeakJobMemoryUsed',ctypes.c_size_t)]
    kernel.CreateJobObjectW.argtypes=[ctypes.c_void_p,wintypes.LPCWSTR]; kernel.CreateJobObjectW.restype=wintypes.HANDLE
    kernel.SetInformationJobObject.argtypes=[wintypes.HANDLE,ctypes.c_int,ctypes.c_void_p,wintypes.DWORD]
    kernel.GetCurrentProcess.restype=wintypes.HANDLE
    kernel.AssignProcessToJobObject.argtypes=[wintypes.HANDLE,wintypes.HANDLE]
    job=kernel.CreateJobObjectW(None,None)
    limits=EXTENDED(); limits.BasicLimitInformation.LimitFlags=0x2000
    if not job or not kernel.SetInformationJobObject(job,9,ctypes.byref(limits),ctypes.sizeof(limits)) or not kernel.AssignProcessToJobObject(job,kernel.GetCurrentProcess()):
        raise ctypes.WinError(ctypes.get_last_error())
    return job  # deliberately keep the non-inheritable handle alive until this process ends

def emit(event, **kwargs):
    print(json.dumps({'event':event,**kwargs},ensure_ascii=False),flush=True)

job = attach_job()
root = Path(os.environ['EASEL_DESKTOP_WORKSPACE'])
logs = Path(os.environ['EASEL_DESKTOP_LOGS'])
logs.mkdir(parents=True,exist_ok=True)
children=[]
stopping=threading.Event()

def watch_input():
    for line in sys.stdin:
        if line.strip() == 'shutdown': break
    stopping.set()
    # Closing this process also closes its job and terminates all descendants.
    os._exit(0)

threading.Thread(target=watch_input,daemon=True).start()
try:
    import bootstrap
    bootstrap.prepare(root)
    if stopping.is_set(): sys.exit(0)
    node=Path(os.environ['EASEL_DESKTOP_NODE'])
    command=[str(node),str(node.parent/'node_modules/openclaw/openclaw.mjs'),'--profile','easel','gateway','run','--allow-unconfigured','--bind','loopback']
    for name,argv in [('gateway',command),('web',[sys.executable,str(Path(__file__).with_name('server.py'))])]:
        stream=(logs/f'{name}.log').open('ab',buffering=0)
        proc=subprocess.Popen(argv,cwd=root,stdin=subprocess.DEVNULL,stdout=stream,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
        children.append((name,proc)); emit('started',service=name,pid=proc.pid)
    while not stopping.wait(0.5):
        for name,proc in children:
            if proc.poll() is not None:
                emit('error',message=f'{name} 服务已停止（{proc.returncode}），请查看日志后重试。')
                sys.exit(1)
except BaseException as error:
    if not isinstance(error,SystemExit): emit('error',message=str(error))
    raise
