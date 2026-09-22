"""Resolve a local Moka bundle or a Hugging Face snapshot before inference starts."""

from pathlib import Path

DEFAULT_MODEL = "moka-tiny"
SOURCE_REVISIONS = {
    "laya": "c5d78730f3493e4fe16d61507ef4b78eef7318cf",
    "laya-multilingual": "052592a15d198d9ad47da779604259b10b47b7aa",
    "laya-typed-decisions": "f9ab0b228f0fc0f14d873dbc99038f135c2da1b2",
}
BUNDLE_PATTERNS = [
    "moka_config.json",
    "rl_agent_config.json",
    "encoder/config.json",
    "tokenizer/*",
    "model.onnx",
    "model.onnx.data",
    "checksums.json",
]


def resolve_checkpoint(model, *, revision=None, local_files_only=False):
    path = Path(model).expanduser()
    if path.is_dir():
        return path
    if isinstance(model, Path) or path.is_absolute() or str(model).startswith((".", "~")):
        raise FileNotFoundError(f"Local model directory does not exist: {model}")
    from huggingface_hub import snapshot_download

    return Path(
        snapshot_download(
            str(model),
            revision=revision,
            local_files_only=local_files_only,
            allow_patterns=BUNDLE_PATTERNS,
        )
    )
