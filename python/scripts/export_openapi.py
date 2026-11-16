"""
FastAPI アプリから OpenAPI 定義をファイルに出力する。

    docker compose exec python python scripts/export_openapi.py

出力先: python/openapi/openapi.json と python/openapi/openapi.yaml
（PyYAML が無い環境では JSON のみ出力）
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from main import app  # noqa: E402

OUT_DIR = os.path.join(ROOT, "openapi")


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    spec = app.openapi()

    json_path = os.path.join(OUT_DIR, "openapi.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(spec, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"wrote {json_path}")

    try:
        import yaml
    except ImportError:
        print("PyYAML が無いため openapi.yaml は出力しません（pip install pyyaml）")
        return
    yaml_path = os.path.join(OUT_DIR, "openapi.yaml")
    with open(yaml_path, "w", encoding="utf-8") as f:
        yaml.safe_dump(spec, f, allow_unicode=True, sort_keys=False)
    print(f"wrote {yaml_path}")


if __name__ == "__main__":
    main()
