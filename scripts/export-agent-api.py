"""Generate the reference from the pinned, patched backend; no model/platform calls."""
import importlib.util
import json
from pathlib import Path
import sys
root = Path(__file__).resolve().parents[1]
source = root / "vendor/easel/web/app.py"
spec = importlib.util.spec_from_file_location("mediasail_schema", source)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
schema = module.app.openapi()
schema["info"]["title"] = "MediaSail local API"
schema["info"]["version"] = json.loads((root / "package.json").read_text())["version"]
destination = root / "agent-skill/mediasail/references/api-schema.json"
destination.write_text(json.dumps(schema, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
print("Exported", len(schema["paths"]), "API paths")
