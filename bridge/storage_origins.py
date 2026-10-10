"""Enumerate candidate local origins only. Chromium reads all actual live values."""
import contextlib
import io
import json
from pathlib import Path
import re
import sys

sys.path.insert(0, str(Path(__file__).parent / 'third_party'))
import ccl_leveldb

def origins(directory):
    result = {}
    with ccl_leveldb.RawLevelDb(directory) as db:
        for record in db.iterate_records_raw():
            key = record.user_key
            if key.startswith(b'_'):
                candidate = key[1:].split(b'\0', 1)[0]
            elif key.startswith(b'META:'):
                candidate = key[5:]
            else:
                continue
            if re.fullmatch(rb'http://127\.0\.0\.1:[0-9]{1,5}', candidate):
                origin = candidate.decode('ascii')
                if 0 < int(origin.rsplit(':', 1)[1]) <= 65535:
                    result[origin] = max(result.get(origin, 0), record.seq)
    return [{'origin': origin, 'sequence': seq} for origin, seq in result.items()]

if __name__ == '__main__':
    try:
        # Upstream debug messages must never expose stored user values in logs.
        with contextlib.redirect_stdout(io.StringIO()):
            result = origins(Path(sys.argv[1]))
        print(json.dumps(result))
    except Exception:
        print('Cannot enumerate legacy local storage; original backup retained.', file=sys.stderr)
        sys.exit(1)
