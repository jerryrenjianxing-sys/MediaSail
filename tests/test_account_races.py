"""Actual HTTP requests, concurrent external process responses, isolated files."""
import asyncio
import json
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from pathlib import Path
import test_account_api as fixture


class AccountRaces(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.fixture = fixture.AccountApi(); await self.fixture.asyncSetUp()
        self.client, self.web = self.fixture.client, self.fixture.web

    async def asyncTearDown(self):
        await self.fixture.asyncTearDown(); self.fixture.temp.cleanup()

    async def test_late_old_verification_cannot_repopulate_server_cache_or_marker(self):
        entered, release = threading.Event(), threading.Event()
        def run(*args, **kwargs):
            if not entered.is_set():
                entered.set(); release.wait(5)
                data = {'verificationStatus':'verified','accountId':'old','name':'旧账号','loggedIn':True}
            else:
                data = {'verificationStatus':'login_required','loggedIn':False}
            return SimpleNamespace(returncode=0,stdout=json.dumps(data),stderr='')
        with patch.object(self.web.subprocess,'run',side_effect=run):
            first = asyncio.create_task(self.client.get('/api/accounts/douyin/whoami?force=1'))
            try:
                self.assertTrue(await asyncio.to_thread(entered.wait, 3))
                latest = await self.client.get('/api/accounts/douyin/whoami?force=1')
                self.assertEqual(latest.json()['verificationStatus'],'login_required')
            finally: release.set()
            await first
        accounts = (await self.client.get('/api/accounts')).json()
        self.assertEqual(next(a for a in accounts if a['platform']=='douyin')['verificationStatus'],'login_required')

    async def test_login_rounds_have_distinct_outputs_and_running_round_is_reused(self):
        processes, paths = [], []
        def spawn(command, **kwargs):
            process = SimpleNamespace(done=False)
            process.poll = lambda: 0 if process.done else None
            status = Path(command[command.index('--status-file')+1])
            image = Path(command[command.index('--qr-out')+1])
            status.write_text(json.dumps({'state':'qr_ready','message':'本轮二维码'}),encoding='utf-8')
            image.write_bytes(b'synthetic image')
            paths.append(status); processes.append(process)
            return process
        with patch.object(self.web.subprocess,'Popen',side_effect=spawn):
            first = (await self.client.post('/api/login/douyin')).json()
            reused = (await self.client.post('/api/login/douyin')).json()
            self.assertEqual(len(processes),1)
            self.assertEqual(first['sessionId'],reused['sessionId'])
            processes[0].done = True
            second = (await self.client.post('/api/login/douyin')).json()
        self.assertNotEqual(first['sessionId'],second['sessionId'])
        self.assertNotEqual(paths[0],paths[1])
        paths[0].write_text('{"state":"success","message":"旧轮次"}',encoding='utf-8')
        latest = await self.client.get('/api/login/douyin/status',params={'sessionId':second['sessionId']})
        self.assertEqual(latest.json()['state'],'qr_ready')
        stale = await self.client.get('/api/login/douyin/status',params={'sessionId':first['sessionId']})
        self.assertEqual(stale.status_code,409)
        stale_sms = await self.client.post('/api/login/douyin/sms',json={'code':'1234','sessionId':first['sessionId']})
        self.assertEqual(stale_sms.status_code,409)
