import { MokaAgent } from "./agent";

let pending: Promise<MokaAgent> | null = null;

export function loadStudioAgent(): Promise<MokaAgent> {
  if (!pending) {
    pending = MokaAgent.load("/models/moka-tiny").catch((err) => {
      pending = null;
      throw err;
    });
  }
  return pending;
}
