"""ONNX Runtime session construction. No PyTorch at inference time."""

from __future__ import annotations

import os

PROVIDER_ALIASES = {
    "auto": None,
    "cpu": "CPUExecutionProvider",
    "cuda": "CUDAExecutionProvider",
    "tensorrt": "TensorrtExecutionProvider",
    "openvino": "OpenVINOExecutionProvider",
}


def available_providers():
    import onnxruntime as ort

    return list(ort.get_available_providers())


def resolve_providers(requested="auto"):
    """Pick an execution-provider list.

    Default is CPU. CUDA and TensorRT are used only when requested *and* present.
    TensorRT is never implicit: it can change numerics, so it must be opted into
    and then pass the fidelity gate before anyone treats it as a default.
    OpenVINO is likewise opt-in.
    """
    import onnxruntime as ort

    available = ort.get_available_providers()
    key = "auto" if requested is None else str(requested).lower()
    if key not in PROVIDER_ALIASES:
        raise ValueError(f"provider must be one of {sorted(PROVIDER_ALIASES)}")
    wanted = PROVIDER_ALIASES[key]
    if wanted is None:
        # auto: CPU only. GPU is faster on some boxes and silently wrong on others
        # (TensorRT, mixed CUDA builds). Callers who have a GPU pass provider="cuda".
        if "CPUExecutionProvider" not in available:
            raise RuntimeError(f"ONNX Runtime has no CPU EP; available: {available}")
        return ["CPUExecutionProvider"]
    if wanted not in available:
        raise RuntimeError(
            f"{wanted} is not available in this ONNX Runtime build. "
            f"Installed providers: {available}"
        )
    # Keep CPU as a fallback so a CUDA OOM degrades instead of crashing the process.
    if wanted != "CPUExecutionProvider" and "CPUExecutionProvider" in available:
        return [wanted, "CPUExecutionProvider"]
    return [wanted]


def make_session(model_path, *, providers, intra_op_num_threads=None, deterministic=False):
    import onnxruntime as ort

    options = ort.SessionOptions()
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    threads = intra_op_num_threads
    if deterministic:
        threads = 1
        options.enable_cpu_mem_arena = False
        options.enable_mem_pattern = False
        os.environ.setdefault("ORT_DISABLE_THREAD_AFFINITY", "1")
    if threads is not None:
        options.intra_op_num_threads = int(threads)
        options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(model_path), sess_options=options, providers=providers)
    return session
