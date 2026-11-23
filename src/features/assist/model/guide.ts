import { clueSet } from "../../../shared/clues";
import type {
  CertainCell,
  HintNote,
  Mark,
  Puzzle,
} from "../../../shared/types";

/** 三个引导层级共享的本题额度上限 */
export const HINT_LIMIT = 3;
export const NOTE_LIMIT = 20;

export interface LineDerivation {
  line: number;
  label: string;
  clue: number[];
  /** 这条线对应的棋盘格下标 */
  cells: number[];
  /** 推导时这条线的标记指纹，绑定当时的候选约束集合 */
  pattern: string;
  /** 与线索和当前标记一致的排布数量 */
  candidates: number;
  /** 所有一致排布中都相同、且当前尚未标记的格子 */
  certain: CertainCell[];
}

export interface HintPlan {
  /** 能推出确定格子的行列 */
  lines: LineDerivation[];
  /** 标记与线索矛盾的行列 */
  contradictions: LineDerivation[];
}

export function lineCells(size: number, line: number): number[] {
  return Array.from({ length: size }, (_, i) =>
    line < size ? line * size + i : i * size + line - size,
  );
}

export function lineLabel(size: number, line: number): string {
  return line < size ? `第 ${line + 1} 行` : `第 ${line - size + 1} 列`;
}

export function linePattern(size: number, marks: Mark[], line: number): string {
  return lineCells(size, line)
    .map((i) =>
      marks[i] === "filled" ? "F" : marks[i] === "cross" ? "X" : ".",
    )
    .join("");
}

const placementCache = new Map<string, number[][]>();
/** 枚举一条线上满足线索的全部 0/1 排布（只依据线索，不看答案） */
function placements(clue: number[], size: number): number[][] {
  const key = `${clue.join(",")}|${size}`;
  const cached = placementCache.get(key);
  if (cached) return cached;
  const result: number[][] = [];
  if (clue.length === 1 && clue[0] === 0) {
    result.push(Array(size).fill(0));
  } else {
    const row = Array(size).fill(0);
    const place = (ci: number, start: number) => {
      if (ci === clue.length) {
        result.push([...row]);
        return;
      }
      const len = clue[ci];
      let rest = 0;
      for (let j = ci + 1; j < clue.length; j++) rest += clue[j] + 1;
      for (let s = start; s + len + rest <= size; s++) {
        for (let k = s; k < s + len; k++) row[k] = 1;
        place(ci + 1, s + len + 1);
        for (let k = s; k < s + len; k++) row[k] = 0;
      }
    };
    place(0, 0);
  }
  placementCache.set(key, result);
  return result;
}

/**
 * 推导一条线：只用线索和当前标记枚举一致排布，取所有排布都一致的格子。
 * 绝不读取答案；标记与线索矛盾时 candidates 为 0，不给任何"结论"。
 */
export function deriveLine(
  puzzle: Puzzle,
  marks: Mark[],
  line: number,
): LineDerivation {
  const size = puzzle.size;
  const clue = clueSet(size, puzzle.solution)[line];
  const cells = lineCells(size, line);
  const pattern = linePattern(size, marks, line);
  const consistent = placements(clue, size).filter((p) =>
    cells.every((_, i) =>
      pattern[i] === "F" ? p[i] === 1 : pattern[i] === "X" ? p[i] === 0 : true,
    ),
  );
  const certain: CertainCell[] = [];
  if (consistent.length) {
    for (let i = 0; i < size; i++) {
      if (pattern[i] !== ".") continue;
      const value = consistent[0][i];
      if (consistent.every((p) => p[i] === value))
        certain.push({ index: cells[i], mark: value ? "filled" : "cross" });
    }
  }
  return {
    line,
    label: lineLabel(size, line),
    clue,
    cells,
    pattern,
    candidates: consistent.length,
    certain,
  };
}

/** 扫描全部行列，找出当前能推出确定格子的线，以及自相矛盾的线 */
export function derivePlan(puzzle: Puzzle, marks: Mark[]): HintPlan {
  const lines: LineDerivation[] = [];
  const contradictions: LineDerivation[] = [];
  for (let line = 0; line < puzzle.size * 2; line++) {
    const derivation = deriveLine(puzzle, marks, line);
    if (derivation.candidates === 0) contradictions.push(derivation);
    else if (derivation.certain.length) lines.push(derivation);
  }
  return { lines, contradictions };
}

/** 手记是否仍绑定当前盘面：该行标记指纹未变才仍有效 */
export function noteCurrent(
  puzzle: Puzzle,
  marks: Mark[],
  note: HintNote,
): boolean {
  return linePattern(puzzle.size, marks, note.line) === note.pattern;
}

export function toNote(derivation: LineDerivation): HintNote {
  return {
    id: crypto.randomUUID(),
    line: derivation.line,
    label: derivation.label,
    clue: derivation.clue,
    candidates: derivation.candidates,
    certain: derivation.certain,
    pattern: derivation.pattern,
    createdAt: Date.now(),
  };
}

/** 同一条线、同一候选约束集合的理由只记一次 */
export function addNote(notes: HintNote[], note: HintNote): HintNote[] {
  if (notes.some((n) => n.line === note.line && n.pattern === note.pattern))
    return notes;
  return [note, ...notes].slice(0, NOTE_LIMIT);
}
