"""Optional INT8 dynamic quantization. Approximate; gated by fidelity, never silent."""

from pathlib import Path


def quantize_dynamic_int8(source, output):
    """Weight-only dynamic quantization of MatMul/Gemm.

    Activations stay FP32. This mirrors laya-coreml's W8 palette intent: smaller
    weights, not a promised speed ratio, and not a default until the fidelity
    gate passes.
    """
    from onnxruntime.quantization import QuantType, quantize_dynamic

    source, output = Path(source), Path(output)
    quantize_dynamic(
        model_input=str(source),
        model_output=str(output),
        weight_type=QuantType.QInt8,
        extra_options={"EnableSubgraph": True},
    )
    return output
