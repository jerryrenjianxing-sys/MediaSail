"""HTTP hotlist contract; only upstream HTTP and time are synthetic."""
import json
import unittest
from unittest.mock import Mock, patch
import test_account_api as fixture


class TrendsApi(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.fixture = fixture.AccountApi()
        await self.fixture.asyncSetUp()
        self.client = self.fixture.client
        self.web = self.fixture.web

    async def asyncTearDown(self):
        await self.fixture.asyncTearDown()
        self.fixture.doCleanups()
        self.fixture.temp.cleanup()

    def response(self, data):
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = json.dumps(data).encode('utf-8')
        return response

    async def test_string_hotlist_is_visible_through_http(self):
        with patch('urllib.request.urlopen', return_value=self.response({'data': ['中文热点']})):
            response = await self.client.get('/api/trends?platforms=douyin')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['trends'][0]['items'][0]['title'], '中文热点')

    async def test_failure_keeps_original_cache_time_and_reports_stale(self):
        with patch('time.time', return_value=1000), patch('urllib.request.urlopen', return_value=self.response({'data': [{'Title': '旧热点', 'HotValue': '42'}]})):
            first = (await self.client.get('/api/trends?platforms=weibo')).json()['trends'][0]
        with patch('time.time', return_value=1400), patch('urllib.request.urlopen', side_effect=TimeoutError('synthetic')):
            cached = (await self.client.get('/api/trends?platforms=weibo')).json()['trends'][0]
        self.assertEqual(first['status'], 'live')
        self.assertEqual(cached['status'], 'cached')
        self.assertEqual(cached['fetchedAt'], 1000)
        self.assertTrue(cached['stale'])
        self.assertTrue(cached['error'])

    async def test_empty_success_and_unavailable_are_different(self):
        with patch('urllib.request.urlopen', return_value=self.response({'data': []})):
            empty = (await self.client.get('/api/trends?platforms=zhihu')).json()['trends'][0]
        self.assertEqual(empty['status'], 'live')
        self.assertEqual(empty['items'], [])
        with patch('urllib.request.urlopen', return_value=self.response({'error': 'upstream changed'})):
            failed = (await self.client.get('/api/trends?platforms=toutiao')).json()['trends'][0]
        self.assertEqual(failed['status'], 'unavailable')
        self.assertIsNone(failed['fetchedAt'])

    async def test_nested_target_url_is_a_web_link(self):
        with patch('urllib.request.urlopen', return_value=self.response({'data': [{'target': {'title': '知乎题目', 'url': 'https://api.zhihu.com/questions/123'}}]})):
            item = (await self.client.get('/api/trends?platforms=zhihu')).json()['trends'][0]['items'][0]
        self.assertEqual(item['url'], 'https://www.zhihu.com/question/123')

    async def test_explicit_upstream_error_with_empty_data_does_not_replace_cache(self):
        with patch('time.time', return_value=1000), patch('urllib.request.urlopen', return_value=self.response({'data':['已取得热点']})):
            await self.client.get('/api/trends?platforms=douyin')
        for payload in [{'status':'error','error':'upstream unavailable','data':[]}, {'code':500,'message':'source failed','data':[]}]:
            with patch('time.time', return_value=1400), patch('urllib.request.urlopen', return_value=self.response(payload)):
                group = (await self.client.get('/api/trends?platforms=douyin')).json()['trends'][0]
            self.assertEqual(group['status'], 'cached')
            self.assertEqual(group['items'][0]['title'], '已取得热点')
            self.assertEqual(group['fetchedAt'], 1000)


if __name__ == '__main__': unittest.main()
