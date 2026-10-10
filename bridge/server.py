"""Desktop-only adapter. The upstream web application and frontend stay intact."""
import importlib.util, json, os, sys, time
if os.environ.get('EASEL_DESKTOP_DIAGNOSTICS') == '1':
    import faulthandler
    faulthandler.dump_traceback_later(25,repeat=True)
from pathlib import Path

root = Path(os.environ['EASEL_DESKTOP_WORKSPACE'])
sys.path.insert(0, str(root))
spec = importlib.util.spec_from_file_location('easel_original_web', root / 'web/app.py')
original = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = original
spec.loader.exec_module(original)
original.app.title = 'MediaSail'
if os.environ.get('EASEL_AGENT_CONNECTION_JSON'):
    from agent_skill import register
    register(original.app, json.loads(os.environ['EASEL_AGENT_CONNECTION_JSON']))

# Track in-flight operations without changing the upstream publishing workflow.
class DesktopState:
    def __init__(self, app):
        self.app = app
        self.inflight = 0

    async def __call__(self, scope, receive, send):
        if scope['type'] == 'http' and scope['path'] == '/_desktop/state':
            header = dict(scope.get('headers', [])).get(b'x-desktop-token', b'').decode()
            if header != os.environ['EASEL_DESKTOP_TOKEN']:
                await send({'type':'http.response.start','status':403,'headers':[]})
                await send({'type':'http.response.body','body':b'Forbidden'})
                return
            active = self.inflight + len(original._BG_TASKS)
            active += sum(p.poll() is None for p in original.LOGIN_PROCESSES.values())
            active += sum(j.get('state') == 'running' for j in original._ENV_JOBS.values())
            # These status files are written by upstream detached worker threads.
            for directory in (original.PUBLISH_DIR, original.PROFILE_BUILD_DIR):
                for file in directory.glob('*.json'):
                    try:
                        entry = json.loads(file.read_text(encoding='utf8'))
                        active += entry.get('state', entry.get('status')) in ('starting','running','sms_required','verifying')
                    except (OSError, ValueError): pass
            body = json.dumps({'ready':True, 'active':active, 'instance':os.environ['EASEL_DESKTOP_TOKEN']}).encode()
            await send({'type':'http.response.start','status':200,'headers':[(b'content-type',b'application/json')]})
            await send({'type':'http.response.body','body':body})
            return
        tracked = scope['type'] == 'http' and scope.get('method') in ('POST','PUT','PATCH','DELETE')
        if tracked: self.inflight += 1
        try: await self.app(scope, receive, send)
        finally:
            if tracked: self.inflight -= 1

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(DesktopState(original.app), host='127.0.0.1', port=int(os.environ['EASEL_PORT']), log_level='warning')
