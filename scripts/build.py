#!/usr/bin/env python3
"""Build an offline-safe content bundle using only Python's standard library."""
import argparse
import json
from pathlib import Path
import re
import sys


def load_content(root):
    root = Path(root).resolve()
    manifest_path = root / "docs" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or not isinstance(manifest.get("documents"), list):
        raise ValueError("manifest 必须是含 documents 数组的对象")
    if not isinstance(manifest.get("version"), str):
        raise ValueError("manifest.version 必须是字符串")
    documents, seen = [], set()
    for entry in manifest["documents"]:
        if not isinstance(entry, dict):
            raise ValueError("文档条目必须是对象")
        for key in ("id", "title", "section", "description", "file", "status"):
            if not isinstance(entry.get(key), str) or (key != "description" and not entry[key]):
                raise ValueError(f"文档缺少字符串字段：{key}")
        doc_id = entry["id"]
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", doc_id) or doc_id in seen:
            raise ValueError(f"文档 ID 无效或重复：{doc_id}")
        if entry["section"] not in {"foundations", "guidelines", "templates"}:
            raise ValueError(f"未知栏目：{entry['section']}")
        relative = Path(entry["file"])
        source = (root / relative).resolve()
        docs_root = (root / "docs").resolve()
        if relative.is_absolute() or not source.is_relative_to(docs_root) or source.suffix != ".md":
            raise ValueError(f"文档路径必须指向 docs 内的 Markdown：{entry['file']}")
        if "sourceFile" in entry:
            source_file = entry["sourceFile"]
            if (not isinstance(source_file, str) or not source_file.startswith("docs/")
                    or re.search(r"[\x00-\x20\x7f\\\\%?#:]", source_file)
                    or any(part in {"", ".", ".."} for part in source_file.split("/"))):
                raise ValueError("sourceFile 必须是 docs 内的规范相对 Markdown 路径")
            original = (root / source_file).resolve()
            if not original.is_relative_to(docs_root) or original.suffix != ".md" or not original.is_file():
                raise ValueError("sourceFile 必须指向 docs 内已存在的 Markdown 文件")
        text = source.read_text(encoding="utf-8")
        if not text.strip():
            raise ValueError(f"文档正文为空：{entry['file']}")
        documents.append({**entry, "markdown": text})
        seen.add(doc_id)
    if not documents:
        raise ValueError("documents 不能为空")
    return {"version": manifest["version"], "documents": documents}


def build(root):
    content = load_content(root)
    # Escaping '<' also makes this safe if a future delivery embeds this script.
    payload = json.dumps(content, ensure_ascii=False, separators=(",", ":"))
    payload = payload.replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    output = Path(root).resolve() / "assets" / "content.js"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("/* Generated from docs/manifest.json and docs/*.md. Do not edit. */\nwindow.BOSSUI_CONTENT = " + payload + ";\n", encoding="utf-8")
    return output, len(content["documents"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    try:
        path, count = build(args.root)
    except (OSError, ValueError, TypeError) as error:
        print(f"Build failed: {error}", file=sys.stderr)
        return 1
    print(f"Built {count} documents → {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
