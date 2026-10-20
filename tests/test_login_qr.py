"""QR image publication preserves old snapshots and exposes actual refreshes."""
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'vendor/easel/skills/shared/scripts'))
from login_qr import refresh_snapshot
import login_state


class LoginQr(unittest.TestCase):
    def test_unchanged_pixels_keep_mtime_and_failed_capture_preserves_last_image(self):
        with tempfile.TemporaryDirectory(prefix='MediaSail 二维码 ') as folder:
            destination = Path(folder) / '登录.png'
            def capture(_, file): file.write_bytes(b'synthetic-qr-1')
            self.assertTrue(refresh_snapshot(None, destination, capture))
            before = destination.stat().st_mtime_ns
            self.assertFalse(refresh_snapshot(None, destination, capture))
            self.assertEqual(destination.stat().st_mtime_ns, before)
            def broken(_, file):
                file.write_bytes(b'partial')
                raise OSError('synthetic screenshot failed')
            with self.assertRaises(OSError): refresh_snapshot(None, destination, broken)
            self.assertEqual(destination.read_bytes(), b'synthetic-qr-1')
            self.assertEqual(len(list(Path(folder).iterdir())), 1)
            self.assertTrue(refresh_snapshot(None, destination, lambda _, file: file.write_bytes(b'synthetic-qr-2')))
            self.assertEqual(destination.read_bytes(), b'synthetic-qr-2')

    def test_browser_login_state_survives_status_roundtrip(self):
        with tempfile.TemporaryDirectory() as folder:
            status = str(Path(folder) / 'status.json')
            login_state.write_status(status, 'window_login', '请在浏览器完成登录')
            self.assertEqual(login_state.read_status(status)['state'], 'window_login')
