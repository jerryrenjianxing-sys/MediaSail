"""Upgrade only byte-recognizable upstream agent defaults, preserving user edits."""
import hashlib
import re
import shutil
from pathlib import Path

# SHA-256 of LF-normalized templates shipped through 0.3.1 (pinned fb80ae6).
LEGACY_DEFAULTS = {
    'AGENTS.md': 'a4940908c413fd56d3c5fc0de65ed8df53e6457cbb4a5efd19d71bcfb8093911',
    'SOUL.md': '318b09683c03d9686d8d6c1af18cae0183d38a095bda6075fd2a878b997d34b5',
}


def without_runtime_root(text):
    # Remove only our exact generated final block; never truncate custom text.
    return re.sub(r'\n## 运行时项目根\n\n`[^`\n]+`\n?\Z', '', text)


def sync_defaults(source_dir, workspace):
    for source in source_dir.glob('*.md'):
        dest = workspace / source.name
        if not dest.exists():
            shutil.copy2(source, dest)
            continue
        if source.name not in LEGACY_DEFAULTS:
            continue
        text = dest.read_text(encoding='utf8')
        body = without_runtime_root(text) if source.name == 'AGENTS.md' else text
        if hashlib.sha256(body.encode('utf8')).hexdigest() != LEGACY_DEFAULTS[source.name]:
            continue
        replacement = source.read_text(encoding='utf8')
        if replacement == body:
            continue
        backup = workspace / '.mediasail-brand-backup-0.3.2' / source.name
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not backup.exists():
            shutil.copy2(dest, backup)
        elif backup.read_bytes() != dest.read_bytes():
            raise RuntimeError('默认身份备份已存在且内容不同，已保留原文件：' + str(dest))
        temp = dest.with_suffix('.desktop-tmp')
        temp.write_text(replacement, encoding='utf8')
        temp.replace(dest)
