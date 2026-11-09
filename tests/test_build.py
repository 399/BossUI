"""Standard-library checks; fixtures stay in memory and create no files."""
import importlib.util
import json
from pathlib import Path
import re
import sys
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("bossui_build", ROOT / "scripts" / "build.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class BuildTests(unittest.TestCase):
    def fixture(self, entry=None, text="# Example\n\nBody", duplicate=False):
        item = {"id":"example", "title":"Example", "section":"guidelines", "description":"", "file":"docs/example.md", "status":"test"}
        item.update(entry or {})
        manifest = json.dumps({"version":"0.1.0", "documents":[item, item] if duplicate else [item]})
        return patch.object(Path, "read_text", autospec=True, side_effect=lambda path, **kwargs: manifest if path.name == "manifest.json" else text)

    def capture_build(self, text="# Example\n\nBody"):
        with self.fixture(text=text), patch.object(Path, "mkdir"), patch.object(Path, "write_text", autospec=True) as write:
            output, count = builder.build(ROOT)
            return output, count, write.call_args.args[1]

    def test_real_manifest(self):
        content = builder.load_content(ROOT)
        self.assertEqual([doc["id"] for doc in content["documents"]], ["time", "search"])
        self.assertEqual(content["documents"][0]["title"], "通知时间展示规则")
        self.assertEqual(content["documents"][1]["title"], "搜索框")
        self.assertEqual(content["documents"][1]["sourceFile"], "docs/后台列表搜索能力设计标准.md")
        self.assertEqual(content["version"], "0.1.0")

    def test_build_safe_payload(self):
        output, count, source = self.capture_build("# Title\n</script>\u2028\u2029")
        self.assertEqual(output, ROOT / "assets" / "content.js")
        self.assertEqual(count, 1)
        self.assertIn("window.BOSSUI_CONTENT = ", source)
        self.assertNotIn("</script>", source)
        self.assertIn("\\u003c", source)
        self.assertIn("\\u2028", source)
        self.assertIn("\\u2029", source)

    def test_path_traversal_rejected(self):
        for path in ["../private.md", "/tmp/private.md", "docs/../../private.md", "assets/example.md"]:
            with self.fixture({"file":path}), self.assertRaises(ValueError):
                builder.load_content(ROOT)

    def test_source_file_is_existing_local_markdown_metadata_only(self):
        original = "docs/后台列表搜索能力设计标准.md"
        with self.fixture({"sourceFile": original}):
            content = builder.load_content(ROOT)
        self.assertEqual(len(content["documents"]), 1)
        self.assertEqual(content["documents"][0]["sourceFile"], original)
        self.assertNotIn("sourceMarkdown", content["documents"][0])

    def test_unsafe_or_missing_source_file_rejected(self):
        paths = [None, "", "/tmp/private.md", "../private.md", "docs/../docs/time.md",
                 "assets/example.md", "docs/missing.md", "docs/example.html", "docs/manifest.json",
                 "https://example.com/original.md", "docs/%2e%2e/private.md", "docs/./time.md",
                 "docs//time.md", "docs/time.md?x", "docs/time.md#anchor", "docs/a\\\\b.md"]
        for source_file in paths:
            with self.subTest(sourceFile=source_file), self.fixture({"sourceFile": source_file}), self.assertRaises(ValueError):
                builder.load_content(ROOT)

    def test_source_file_symlink_escape_rejected(self):
        original_resolve = Path.resolve
        def resolve(path, *args, **kwargs):
            if path.name == "linked.md":
                return ROOT.parent / "outside.md"
            return original_resolve(path, *args, **kwargs)
        with self.fixture({"sourceFile": "docs/linked.md"}), patch.object(Path, "resolve", resolve), self.assertRaises(ValueError):
            builder.load_content(ROOT)

    def test_duplicate_ids_rejected(self):
        with self.fixture(duplicate=True), self.assertRaises(ValueError):
            builder.load_content(ROOT)

    def test_invalid_id_section_or_empty_content(self):
        for entry in [{"id":"../bad"}, {"section":"components"}, {"file":"docs/example.html"}]:
            with self.fixture(entry), self.assertRaises(ValueError):
                builder.load_content(ROOT)
        with self.fixture(text=" "), self.assertRaises(ValueError):
            builder.load_content(ROOT)

    def test_asset_references_are_local_and_present(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        references = re.findall(r'(?:src|href)="(\./assets/[^\"]+)"', html)
        self.assertEqual(len(references), 4)
        for reference in references:
            self.assertTrue((ROOT / reference).is_file(), reference)
        self.assertNotRegex(html, r'(?:src|href)="(?:https?:)?//')
        self.assertNotIn("/Users/", html)

    def test_scripts_do_not_fetch_or_contact_services(self):
        for name in ["app.js", "markdown.js"]:
            text = (ROOT / "assets" / name).read_text(encoding="utf-8")
            self.assertNotRegex(text, r'\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(', name)
            self.assertNotIn("localStorage", text)

    def test_every_internal_markdown_doc_link_resolves(self):
        content = builder.load_content(ROOT)
        ids = {item["id"] for item in content["documents"]}
        for item in content["documents"]:
            for target in re.findall(r'\]\(#/doc/([a-z0-9-]+)\)', item["markdown"]):
                self.assertIn(target, ids, item["id"])
            registered = {(ROOT / doc["file"]).resolve() for doc in content["documents"]}
            if "sourceFile" in item:
                registered.add((ROOT / item["sourceFile"]).resolve())
            for target in re.findall(r'\]\(([^)]+\.md)(?:#[^)]*)?\)', item["markdown"]):
                if not target.startswith(("https://", "http://")):
                    resolved = (ROOT / item["file"]).parent.joinpath(target).resolve()
                    self.assertIn(resolved, registered, f"{item['id']}: {target}")

    def test_generated_content_is_deterministic(self):
        self.assertEqual(self.capture_build()[2], self.capture_build()[2])
        with patch.object(Path, "mkdir"), patch.object(Path, "write_text", autospec=True) as write:
            builder.build(ROOT)
        self.assertEqual(write.call_args.args[1], (ROOT / "assets" / "content.js").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
