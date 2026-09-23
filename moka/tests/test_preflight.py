"""CI fixture: the tiny bundle must exist before these tests run.

Gitignores artifacts/, so GitHub Actions has to run
`python scripts/build_tiny_bundle.py` first. This file is the tripwire.
"""

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / "artifacts" / "moka-tiny"
SCRIPT = ROOT / "scripts" / "build_tiny_bundle.py"


def test_ci_tiny_bundle_exists():
    assert (BUNDLE / "model.onnx").is_file(), (
        "artifacts/moka-tiny/model.onnx is missing. "
        "CI must run `python scripts/build_tiny_bundle.py` before pytest. "
        "This is a distilled student, not a Hub checkpoint."
    )
    assert (BUNDLE / "moka_config.json").is_file()
    assert (BUNDLE / "tokenizer" / "tokenizer.json").is_file()


def test_build_script_has_no_hardcoded_workspace():
    text = SCRIPT.read_text(encoding="utf-8")
    assert "/workspace" not in text


def _load_build_script():
    spec = importlib.util.spec_from_file_location("build_tiny_bundle", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_resolve_studio_copy_respects_flag_when_parent_exists(tmp_path, monkeypatch):
    mod = _load_build_script()
    monkeypatch.delenv("MOKA_STUDIO_COPY", raising=False)
    dest_parent = tmp_path / "studio"
    dest_parent.mkdir()
    dest = dest_parent / "moka-tiny"
    resolved = mod.resolve_studio_copy(str(dest))
    assert resolved == dest.resolve()


def test_resolve_studio_copy_skips_missing_parent_outside_repo(tmp_path, monkeypatch):
    mod = _load_build_script()
    monkeypatch.delenv("MOKA_STUDIO_COPY", raising=False)
    missing = tmp_path / "does-not-exist" / "moka-tiny"
    resolved = mod.resolve_studio_copy(str(missing))
    if resolved is not None:
        assert resolved != missing.resolve()
        assert resolved.parent.is_dir()
    assert not missing.parent.exists()
