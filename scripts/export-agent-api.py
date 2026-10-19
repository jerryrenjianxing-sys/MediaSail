"""Generate the reference from the pinned, patched backend; no model/platform calls."""
import importlib.util
import json
from pathlib import Path
import sys
import argparse
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true', help='Compare with the checked-in reference without changing it')
parser.add_argument('--output', type=Path, help='Write a reference to an explicit output path')
args = parser.parse_args()
if args.check and args.output:
    parser.error('--check and --output are mutually exclusive')
root = Path(__file__).resolve().parents[1]
source = root / "vendor/easel/web/app.py"
spec = importlib.util.spec_from_file_location("mediasail_schema", source)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
bridge_spec = importlib.util.spec_from_file_location("mediasail_skill_schema", root / "bridge/agent_skill.py")
bridge_module = importlib.util.module_from_spec(bridge_spec)
bridge_spec.loader.exec_module(bridge_module)
bridge_module.register(module.app, {"product":"MediaSail", "schema":1,
    "version":json.loads((root / "package.json").read_text())["version"],
    "instanceId":"schema-example", "skillDir":str(root / "agent-skill/mediasail"),
    "baseUrl":"http://127.0.0.1:0", "dataDir":"<dataDir>",
    "connectionFile":"<dataDir>/agent-connection.json", "selectedProfile":None})
# Registration must precede OpenAPI caching so distribution and identity routes
# are exported together with the actual business backend.
module.app.openapi_schema = None
schema = module.app.openapi()
required = {"/api/agent-info", "/api/platform-skill", "/api/v1/skill", "/api/status", "/api/outputs", "/api/personas", "/api/projects/{project}/metadata"}
if not required.issubset(schema["paths"]):
    raise RuntimeError("Missing actual business/connection routes: " + repr(required - schema["paths"].keys()))
if any(p.startswith("/api/chat") or p == "/api/skill" or p.startswith("/api/settings/models") for p in schema["paths"]):
    raise RuntimeError("Retired model executor leaked into the active API schema")
schema["info"]["title"] = "MediaSail local API"
schema["info"]["version"] = json.loads((root / "package.json").read_text())["version"]
destination = root / "agent-skill/mediasail/references/api-schema.json"
content = json.dumps(schema, ensure_ascii=False, indent=2)+"\n"
if args.check:
    if destination.read_text(encoding='utf-8') != content:
        raise SystemExit('API reference is stale. Run scripts/export-agent-api.py deliberately, review and commit the result.')
    print('Verified', len(schema['paths']), 'API paths without modifying the reference')
else:
    destination = args.output or destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(content, encoding='utf-8')
    print('Exported', len(schema['paths']), 'API paths to', destination)
