export type TokenizerSpec = {
  vocab: Record<string, number>;
  unkId: number;
  clsId: number;
  sepId: number;
  maskId: number;
  padId: number;
  maskToken: string;
  clsToken: string;
  sepToken: string;
  padToken: string;
};

function isolatePunctuation(word: string): string[] {
  return word.split(/([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/).filter(Boolean);
}

export function pretokenize(text: string): string[] {
  const out: string[] = [];
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    out.push(...isolatePunctuation(word));
  }
  return out;
}

export class WordLevelTokenizer {
  spec: TokenizerSpec;

  constructor(spec: TokenizerSpec) {
    this.spec = spec;
  }

  get mask_token() {
    return this.spec.maskToken;
  }
  get mask_token_id() {
    return this.spec.maskId;
  }
  get cls_token_id() {
    return this.spec.clsId;
  }
  get sep_token_id() {
    return this.spec.sepId;
  }
  get pad_token_id() {
    return this.spec.padId;
  }

  encode(text: string): number[] {
    return pretokenize(text).map((tok) => this.spec.vocab[tok] ?? this.spec.unkId);
  }

  call(text: string): { input_ids: number[] } {
    return { input_ids: this.encode(text) };
  }
}

export async function loadTokenizer(base = "/models/moka-tiny"): Promise<WordLevelTokenizer> {
  const [tok, cfg] = await Promise.all([
    fetch(`${base}/tokenizer/tokenizer.json`).then((r) => r.json()),
    fetch(`${base}/tokenizer/tokenizer_config.json`).then((r) => r.json()),
  ]);
  const vocab = tok.model.vocab as Record<string, number>;
  const id = (name: string) => {
    const raw = cfg[name];
    const value = typeof raw === "string" ? raw : raw?.content;
    const tokenId = vocab[value];
    if (tokenId == null) throw new Error(`Tokenizer missing ${name}`);
    return { value, tokenId };
  };
  const cls = id("cls_token");
  const sep = id("sep_token");
  const mask = id("mask_token");
  const pad = id("pad_token");
  return new WordLevelTokenizer({
    vocab,
    unkId: vocab["[UNK]"] ?? 0,
    clsId: cls.tokenId,
    sepId: sep.tokenId,
    maskId: mask.tokenId,
    padId: pad.tokenId,
    maskToken: mask.value,
    clsToken: cls.value,
    sepToken: sep.value,
    padToken: pad.value,
  });
}
