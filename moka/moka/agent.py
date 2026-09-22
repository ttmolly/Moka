"""ONNX Runtime inference. No Transformers or PyTorch dependency at runtime."""

from __future__ import annotations

import json

import numpy as np

from .common import read_temperatures
from .hub import DEFAULT_MODEL, resolve_checkpoint
from .prompt import PromptMixin
from .result import ResultMixin
from .runtime import make_session, resolve_providers
from .tokenizer import Tokenizer

FORMATS = {"moka-onnx"}


class Agent(PromptMixin, ResultMixin):
    def __init__(
        self,
        model_dir,
        *,
        provider="auto",
        revision=None,
        local_files_only=False,
        intra_op_num_threads=None,
        deterministic=False,
    ):
        self.model_dir = resolve_checkpoint(
            model_dir, revision=revision, local_files_only=local_files_only
        )
        self.manifest = json.loads((self.model_dir / "moka_config.json").read_text())
        if (
            self.manifest.get("format") not in FORMATS
            or self.manifest.get("format_version") != 1
        ):
            raise ValueError("Unsupported Moka export format")
        if self.manifest.get("approximate"):
            import warnings

            warnings.warn(
                "moka: this bundle is labelled approximate "
                f"({self.manifest.get('precision')}). Do not treat it as the "
                "default FP32 port. See docs/FIDELITY.md.",
                RuntimeWarning,
                stacklevel=2,
            )
        self.shape = self.manifest["shape"]
        self.cfg = json.loads((self.model_dir / "rl_agent_config.json").read_text())
        (
            self.temperature,
            self.temperature_by_options,
            self.temperature_raw,
            self.temperature_by_options_raw,
        ) = read_temperatures(self.cfg)
        self.tok = Tokenizer(self.model_dir / "tokenizer")
        self.batch_size = int(self.shape.get("batch_size") or 1)
        if self.shape.get("dynamic_batch"):
            self.batch_size = int(self.shape.get("batch_size") or 8)
        self.pad_to_multiple = int(self.shape.get("pad_to_multiple") or 16)
        self.providers = resolve_providers(provider)
        self.deterministic = deterministic
        self.session = make_session(
            self.model_dir / "model.onnx",
            providers=self.providers,
            intra_op_num_threads=intra_op_num_threads,
            deterministic=deterministic,
        )
        self.input_names = [item.name for item in self.session.get_inputs()]
        self.output_names = [item.name for item in self.session.get_outputs()]

    @property
    def provider(self):
        return self.session.get_providers()[0]

    def forward(self, batch):
        feeds = {}
        for name in self.input_names:
            value = np.asarray(batch[name])
            # Exported graph uses int64; collate emits int32.
            if value.dtype == np.int32:
                value = value.astype(np.int64)
            feeds[name] = value
        outputs = self.session.run(self.output_names, feeds)
        by_name = dict(zip(self.output_names, outputs))
        logits = np.asarray(by_name["logits"], np.float32)
        action = np.asarray(by_name["action_logits"], np.float32)
        return logits, action


def load(
    model_dir=DEFAULT_MODEL,
    *,
    revision=None,
    local_files_only=False,
    provider="auto",
    intra_op_num_threads=None,
    deterministic=False,
):
    return Agent(
        model_dir,
        provider=provider,
        revision=revision,
        local_files_only=local_files_only,
        intra_op_num_threads=intra_op_num_threads,
        deterministic=deterministic,
    )
