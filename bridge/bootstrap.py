"""Prepare the writable business workspace without provisioning an Agent."""
import shutil
from pathlib import Path


def prepare(root):
    root = Path(root)
    for name in ('profiles', 'outputs', 'assets'):
        (root / name).mkdir(parents=True, exist_ok=True)
    # Existing configuration remains byte-for-byte; no Agent configuration,
    # workspace junctions or global installation are created.
    example = root / '.env.example'
    if not (root / '.env').exists() and example.is_file():
        shutil.copy2(example, root / '.env')
