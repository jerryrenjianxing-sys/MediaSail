import hashlib
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'bridge'))
from branding import sync_defaults, without_runtime_root


class DefaultBrandMigration(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='mediasail-brand-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source, self.workspace = self.root / 'source', self.root / '中文 资料'
        self.source.mkdir()
        self.workspace.mkdir()
        self.old = '# Easel\n\nDefault identity.\n'
        self.new = '# MediaSail\n\nDefault identity.\n'
        self.suffix = '\n## 运行时项目根\n\n`C:\\中文 文件夹`\n'
        defaults = {name: hashlib.sha256(self.old.encode()).hexdigest()
                    for name in ('AGENTS.md', 'SOUL.md')}
        self.patcher = patch('branding.LEGACY_DEFAULTS', defaults)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)
        for name in defaults:
            (self.source / name).write_text(self.new, encoding='utf8')

    def test_known_default_migrates_with_exact_backup_and_is_idempotent(self):
        dest = self.workspace / 'AGENTS.md'
        before = (self.old + self.suffix).replace('\n', '\r\n').encode()
        dest.write_bytes(before)
        sync_defaults(self.source, self.workspace)
        self.assertEqual(dest.read_text(encoding='utf8'), self.new)
        backup = self.workspace / '.mediasail-brand-backup-0.3.2' / 'AGENTS.md'
        self.assertEqual(backup.read_bytes(), before)
        first = dest.stat().st_mtime_ns
        sync_defaults(self.source, self.workspace)
        self.assertEqual(first, dest.stat().st_mtime_ns)
        self.assertEqual(backup.read_bytes(), before)

    def test_custom_identity_and_custom_text_after_runtime_block_survive(self):
        custom = self.old + self.suffix + '\nMy custom instructions.\n'
        for name in ('AGENTS.md', 'SOUL.md'):
            (self.workspace / name).write_text(custom, encoding='utf8')
        sync_defaults(self.source, self.workspace)
        for name in ('AGENTS.md', 'SOUL.md'):
            self.assertEqual((self.workspace / name).read_text(encoding='utf8'), custom)
        self.assertEqual(without_runtime_root(custom), custom)
        self.assertEqual(without_runtime_root(self.old + self.suffix), self.old)
        self.assertFalse((self.workspace / '.mediasail-brand-backup-0.3.2').exists())

    def test_fresh_workspace_gets_new_defaults(self):
        sync_defaults(self.source, self.workspace)
        for name in ('AGENTS.md', 'SOUL.md'):
            self.assertEqual((self.workspace / name).read_text(encoding='utf8'), self.new)

    def test_conflicting_backup_stops_without_changing_existing_identity(self):
        dest = self.workspace / 'SOUL.md'
        dest.write_text(self.old, encoding='utf8')
        backup = self.workspace / '.mediasail-brand-backup-0.3.2' / 'SOUL.md'
        backup.parent.mkdir()
        backup.write_text('Do not overwrite me', encoding='utf8')
        with self.assertRaises(RuntimeError):
            sync_defaults(self.source, self.workspace)
        self.assertEqual(dest.read_text(encoding='utf8'), self.old)
        self.assertEqual(backup.read_text(encoding='utf8'), 'Do not overwrite me')


if __name__ == '__main__':
    unittest.main()
