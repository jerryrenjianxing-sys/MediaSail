"""Exercise source-kit input failures through its actual command-line interface."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class BrowserSourceKitInputs(unittest.TestCase):
    def run_kit(self, directory):
        return subprocess.run(
            [sys.executable, '-B', str(ROOT / 'scripts/browser-source-kit.py'),
             '--audit-root', str(directory / 'absent-audit'),
             '--crate-sources', str(directory / 'sources')],
            cwd=ROOT, text=True, capture_output=True, timeout=15,
        )

    def test_missing_dependency_sources_fail_before_source_assembly(self):
        with tempfile.TemporaryDirectory(prefix='MediaSail source inputs ') as temporary:
            result = self.run_kit(Path(temporary))
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Rust source directory is missing', result.stderr)

    def test_empty_dependency_directory_cannot_produce_a_successful_kit(self):
        with tempfile.TemporaryDirectory(prefix='MediaSail source inputs ') as temporary:
            directory = Path(temporary)
            (directory / 'sources/crates').mkdir(parents=True)
            result = self.run_kit(directory)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Pinned Rust source is missing: crates/adler2-2.0.1.crate', result.stderr)

    def test_modified_dependency_archive_is_rejected(self):
        with tempfile.TemporaryDirectory(prefix='MediaSail source inputs ') as temporary:
            directory = Path(temporary)
            crates = directory / 'sources/crates'
            crates.mkdir(parents=True)
            (crates / 'adler2-2.0.1.crate').write_bytes(b'changed source archive')
            result = self.run_kit(directory)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Pinned Rust source hash mismatch: crates/adler2-2.0.1.crate', result.stderr)


if __name__ == '__main__':
    unittest.main()
