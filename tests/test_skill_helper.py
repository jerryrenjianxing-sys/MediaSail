import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import shutil
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / 'agent-skill/mediasail/scripts/mediasail.py'
spec = importlib.util.spec_from_file_location('mediasail_helper_test', HELPER)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)

class HelperTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='MediaSail 中文 空格 ')
        self.folder = Path(self.temp.name)
        self.info = {'schema':1,'product':'MediaSail','version':'0.5.0','instanceId':'test',
                     'workspace':str(self.folder),'skillDir':str(HELPER.parent.parent),
                     'python':sys.executable,'profiles':str(self.folder),'outputs':str(self.folder),
                     'tools':str(self.folder),'baseUrl':None,'environment':{},'selectedProfile':'测试画像'}
        self.connection = self.folder / 'agent-connection.json'
    def tearDown(self):
        self.temp.cleanup()
    def test_offline_local_business_execution_preserves_arguments(self):
        self.info['baseUrl'] = 'http://127.0.0.1:1'
        self.connection.write_text(json.dumps(self.info), encoding='utf-8')
        script = self.folder / '脚本 名称.py'
        script.write_text('import json,os,sys;print(json.dumps({"arg":sys.argv[1],"cwd":os.getcwd(),"root":os.environ["EASEL_ROOT"]},ensure_ascii=False))',encoding='utf-8')
        result = subprocess.run([sys.executable,str(HELPER),'--connection',str(self.connection),'python',str(script),'中文 value with spaces'],capture_output=True,text=True,encoding='utf-8')
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        value=json.loads(result.stdout)
        self.assertEqual(value['arg'],'中文 value with spaces')
        self.assertEqual(Path(value['cwd']),self.folder)
        self.assertEqual(Path(value['root']),self.folder)
    def test_live_identity_without_node_or_gateway(self):
        class Handler(BaseHTTPRequestHandler):
            def do_GET(s):
                body = {'product':'MediaSail','instanceId':'test','selectedProfile':'新画像'} if s.path=='/api/agent-info' else {'serviceReady':True,'gateway':False}
                data=json.dumps(body).encode()
                s.send_response(200);s.send_header('Content-Length',str(len(data)));s.end_headers();s.wfile.write(data)
            def log_message(*args): pass
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            self.info['baseUrl']='http://127.0.0.1:'+str(server.server_port)
            result=helper.check(self.info)
            self.assertTrue(result['ok']);self.assertTrue(result['localToolsReady'])
            self.assertEqual(result['selectedProfile'],'新画像')
            self.assertNotIn('node',result['found']);self.assertNotIn('gateway',result)
            self.info['instanceId']='other'
            self.assertFalse(helper.check(self.info)['connected'])
        finally: server.shutdown();server.server_close()
    def test_offline_reports_local_paths_honestly(self):
        result=helper.check(self.info)
        self.assertFalse(result['connected']);self.assertFalse(result['ok'])
        self.assertTrue(result['localToolsReady']);self.assertEqual(result['selectedProfile'],'测试画像')
    def test_documented_business_io(self):
        self.connection.write_text(json.dumps(self.info),encoding='utf-8')
        files=['skills/shared/scripts/manifest.py','skills/shared/scripts/social_stats.py',
               'skills/openclaw/skill-data-tracker/scripts/track.py',
               'skills/openclaw/skill-social-performance-review/scripts/review.py']
        for rel in files:
            dest=self.folder / rel;dest.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(ROOT/'vendor/easel'/rel,dest)
        def run(rel,*args):
            result=subprocess.run([sys.executable,str(HELPER),'--connection',str(self.connection),'python',rel,*args],capture_output=True,text=True,encoding='utf-8')
            self.assertEqual(result.returncode,0,(result.stdout or '')+(result.stderr or ''))
            return json.loads(result.stdout)
        project=self.folder/'outputs/春季内容';project.mkdir(parents=True)
        (project/'文案.md').write_text('测试成品',encoding='utf-8')
        run(files[0],'meta','--topic','春季内容','--title','春季内容方案','--kind','article','--status','ready','--profile','测试画像','--deliverables','文案.md')
        meta=run(files[0],'read','--topic','春季内容')
        self.assertEqual(meta['deliverables'],['文案.md']);self.assertEqual(meta['profile'],'测试画像')
        run(files[2],'snapshot','--profile','测试画像','--platform','xiaohongshu','--date','2026-10-01','--followers','100')
        run(files[2],'snapshot','--profile','测试画像','--platform','xiaohongshu','--date','2026-10-08','--followers','120')
        trend=run(files[2],'trend','--profile','测试画像','--platform','xiaohongshu','--metric','followers')
        self.assertIn('120',json.dumps(trend))
        input_file=project/'输入数据.json'
        input_file.write_text(json.dumps({'month':'2026-10','platform':'xiaohongshu','posts':[{'title':'测试内容','reach':1000,'likes':30,'comments':4,'saves':8,'shares':2}]}),encoding='utf-8')
        review=run(files[3],'score','--input',str(input_file))
        self.assertAlmostEqual(review['per_post'][0]['engagement_rate_pct'],4.4)
        self.assertTrue(review['warnings'])

if __name__ == '__main__': unittest.main()
