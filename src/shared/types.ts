export type Mark = "unknown" | "filled" | "cross";
export type Tool = "filled" | "cross" | "unknown";
export interface Puzzle {
  id: string;
  title: string;
  collection: string;
  level: "入门" | "进阶" | "挑战";
  size: number;
  solution: number[];
  color: string;
}
export interface Move {
  index: number;
  before: Mark;
  after: Mark;
}
export type CertainMark = "filled" | "cross";
export interface CertainCell {
  index: number;
  mark: CertainMark;
}
export interface HintNote {
  id: string;
  line: number;
  label: string;
  clue: number[];
  candidates: number;
  certain: CertainCell[];
  /** 展示理由时该行的标记指纹，绑定当时的候选约束集合 */
  pattern: string;
  createdAt: number;
}
export interface GuideCycle {
  /** 本轮已解锁到的层级：1 找行列 / 2 看理由 / 3 确认落格 */
  level: 1 | 2 | 3;
  line: number;
  /** 上次落格前重新证明失败（盘面已变化），结论已按当前盘面更新 */
  stale: boolean;
}
export interface Session {
  puzzleId: string;
  marks: Mark[];
  moves: Move[];
  hints: number;
  checks: number;
  seconds: number;
  solved: boolean;
  guide: GuideCycle | null;
  notes: HintNote[];
  updatedAt: number;
}
export interface SolveRecord {
  id: string;
  puzzleId: string;
  seconds: number;
  hints: number;
  checks: number;
  finishedAt: number;
}
export interface GameDocument {
  version: 1;
  activeId: string;
  sessions: Record<string, Session>;
  records: SolveRecord[];
}
export type GameAction =
  | { type: "open"; id: string }
  | { type: "mark"; index: number; mark: Mark }
  | { type: "undo" }
  | { type: "guide.open" }
  | { type: "guide.advance" }
  | { type: "guide.line"; line: number }
  | { type: "guide.apply"; index: number; mark: Mark }
  | { type: "check" }
  | { type: "tick" }
  | { type: "reset" };
