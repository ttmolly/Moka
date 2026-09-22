"""Shape handling for exported ONNX signatures (fixed or dynamic batch/sequence)."""

import numpy as np


def collate_items(items, pad_id, *, shape, pad_to_multiple=16, max_length=None):
    if not items:
        raise ValueError("Batch must contain at least one question")
    dynamic_batch = bool(shape.get("dynamic_batch", False))
    max_batch = shape.get("batch_size")
    if not dynamic_batch:
        if max_batch is None:
            raise ValueError("Fixed-batch exports must declare shape.batch_size")
        if not 1 <= len(items) <= max_batch:
            raise ValueError("Batch must contain 1..exported batch_size questions")
        batch_size = max_batch
    else:
        if max_batch is not None and len(items) > max_batch:
            raise ValueError(
                f"Batch has {len(items)} questions, but this export supports at most {max_batch}"
            )
        batch_size = len(items)

    length = max(len(item["ids"]) for item in items)
    limit = shape["max_length"]
    if max_length is not None:
        limit = min(limit, int(max_length))
    if length > limit:
        raise ValueError(f"Input has {length} tokens, but this export supports at most {limit}")
    if any(len(item["markers"]) > shape["max_options"] for item in items):
        raise ValueError("Question exceeds the exported max_options; convert with a larger value")

    if shape.get("lengths"):
        length = next(n for n in shape["lengths"] if n >= length)
    elif shape.get("flexible", True) or shape.get("dynamic_sequence", True):
        multiple = pad_to_multiple or 1
        min_length = int(shape.get("min_length", 1))
        padded = max(min_length, ((length + multiple - 1) // multiple) * multiple)
        length = min(limit, padded)
    else:
        length = limit

    option_slots = shape["max_options"]
    arrays = {
        "input_ids": np.full((batch_size, length), pad_id, np.int32),
        "attention_mask": np.zeros((batch_size, length), np.int32),
        "marker_pos": np.zeros((batch_size, option_slots), np.int32),
        "marker_mask": np.zeros((batch_size, option_slots), np.int32),
        "qtype": np.zeros((batch_size,), np.int32),
    }
    # Dummy rows in a fixed batch still need one valid key so attention is well-defined.
    if batch_size > len(items):
        arrays["attention_mask"][:, 0] = 1
    for row, item in enumerate(items):
        n, count = len(item["ids"]), len(item["markers"])
        arrays["input_ids"][row, :n] = item["ids"]
        arrays["attention_mask"][row, :n] = 1
        arrays["marker_pos"][row, :count] = item["markers"]
        arrays["marker_mask"][row, :count] = 1
        arrays["qtype"][row] = item["qtype"]
    return arrays
