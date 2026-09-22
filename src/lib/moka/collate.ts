import type { PreparedItem } from "./types";

export type Shape = {
  batch_size: number;
  max_length: number;
  min_length: number;
  max_options: number;
  dynamic_batch?: boolean;
  dynamic_sequence?: boolean;
  flexible?: boolean;
  pad_to_multiple?: number;
};

export function collateItems(
  items: PreparedItem[],
  padId: number,
  shape: Shape,
): Record<string, Int32Array> {
  if (!items.length) throw new Error("Batch must contain at least one question");
  const dynamicBatch = Boolean(shape.dynamic_batch);
  if (!dynamicBatch && items.length > shape.batch_size) {
    throw new Error("Batch exceeds exported batch_size");
  }
  if (dynamicBatch && items.length > shape.batch_size) {
    throw new Error("Batch exceeds exported batch_size");
  }
  const batchSize = dynamicBatch ? items.length : shape.batch_size;
  let length = Math.max(...items.map((it) => it.ids.length));
  if (length > shape.max_length) {
    throw new Error(`Input has ${length} tokens, but this export supports at most ${shape.max_length}`);
  }
  if (items.some((it) => it.markers.length > shape.max_options)) {
    throw new Error("Question exceeds the exported max_options");
  }
  const multiple = shape.pad_to_multiple || 16;
  const minLength = shape.min_length || 1;
  const padded = Math.max(minLength, Math.ceil(length / multiple) * multiple);
  length = Math.min(shape.max_length, padded);
  const k = shape.max_options;
  const inputIds = new Int32Array(batchSize * length).fill(padId);
  const attention = new Int32Array(batchSize * length);
  const markerPos = new Int32Array(batchSize * k);
  const markerMask = new Int32Array(batchSize * k);
  const qtype = new Int32Array(batchSize);
  if (batchSize > items.length) {
    for (let r = 0; r < batchSize; r++) attention[r * length] = 1;
  }
  items.forEach((item, row) => {
    const n = item.ids.length;
    for (let i = 0; i < n; i++) {
      inputIds[row * length + i] = item.ids[i]!;
      attention[row * length + i] = 1;
    }
    item.markers.forEach((m, j) => {
      markerPos[row * k + j] = m;
      markerMask[row * k + j] = 1;
    });
    qtype[row] = item.qtype;
  });
  return {
    input_ids: inputIds,
    attention_mask: attention,
    marker_pos: markerPos,
    marker_mask: markerMask,
    qtype,
    _batch: new Int32Array([batchSize]) as unknown as Int32Array,
    _length: new Int32Array([length]) as unknown as Int32Array,
  };
}

export function dims(batch: Record<string, Int32Array>, name: string): number[] {
  const b = batch._batch[0]!;
  if (name === "qtype") return [b];
  if (name === "marker_pos" || name === "marker_mask") {
    return [b, batch.marker_pos.length / b];
  }
  return [b, batch._length[0]!];
}
