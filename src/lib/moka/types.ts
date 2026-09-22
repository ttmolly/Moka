export type QuestionType = "choice" | "score" | "noul";

export type Question = {
  type: QuestionType;
  instructions: unknown;
  criteria?: Record<string, unknown> | string[] | unknown;
};

export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
  action: { act_probability: number };
};

export type ScoreAnswer = {
  type: "score";
  score: number;
  legend: Record<string, unknown>;
  probabilities: Record<string, number>;
  confidence: number;
  action: { act_probability: number };
};

export type NoulAnswer = {
  type: "noul";
  noul: number;
  confidence: number;
  action: { act_probability: number };
};

export type Answer = ChoiceAnswer | ScoreAnswer | NoulAnswer;

export type PredictResult = {
  model: string;
  runtime: string;
  answers: Record<string, Answer>;
  usage: { input_tokens: number; output_tokens: number };
};

export type InternalQuestion = {
  t: QuestionType;
  ins: string;
  crit: Record<string, unknown> | unknown[] | undefined;
};

export type PreparedItem = {
  ids: number[];
  markers: number[];
  qtype: number;
};

export const QTYPES: Record<QuestionType, number> = {
  choice: 0,
  score: 1,
  noul: 2,
};
