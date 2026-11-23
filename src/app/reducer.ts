import type { GameAction, GameDocument, Puzzle } from "../shared/types";
import { isSolved, newSession } from "../shared/document";
import { applyMark, undoMark } from "../features/board";
import {
  HINT_LIMIT,
  addNote,
  deriveLine,
  derivePlan,
  toNote,
} from "../features/assist";
import { registerSolve } from "../features/journal";
export function transition(
  document: GameDocument,
  action: GameAction,
  puzzles: Puzzle[],
): GameDocument {
  const puzzle = puzzles.find((p) => p.id === document.activeId)!;
  const current = document.sessions[puzzle.id];
  if (action.type === "open") {
    const target = puzzles.find((p) => p.id === action.id);
    return target
      ? {
          ...document,
          activeId: target.id,
          sessions: {
            ...document.sessions,
            [target.id]: document.sessions[target.id] ?? newSession(target),
          },
        }
      : document;
  }
  let next = current;
  if (action.type === "mark")
    next = applyMark(current, action.index, action.mark);
  if (action.type === "undo") next = undoMark(current);
  // 第 1 层：指出可推导的行列。没有必然结论时不开启、不扣额度。
  if (
    action.type === "guide.open" &&
    !current.guide &&
    !current.solved &&
    current.hints < HINT_LIMIT
  ) {
    const plan = derivePlan(puzzle, current.marks);
    if (plan.lines.length)
      next = {
        ...current,
        guide: { level: 1, line: plan.lines[0].line, stale: false },
        hints: current.hints + 1,
      };
  }
  // 进入下一层。1→2 扣一次额度并把手记记下；2→3 免费，额度在落格时结算。
  if (action.type === "guide.advance" && current.guide && !current.solved) {
    const guide = current.guide;
    if (guide.level === 1 && current.hints < HINT_LIMIT) {
      const plan = derivePlan(puzzle, current.marks);
      const line =
        plan.lines.find((l) => l.line === guide.line) ?? plan.lines[0];
      if (line)
        next = {
          ...current,
          guide: { level: 2, line: line.line, stale: false },
          hints: current.hints + 1,
          notes: line.certain.length
            ? addNote(current.notes, toNote(line))
            : current.notes,
        };
    } else if (guide.level === 2) {
      next = { ...current, guide: { ...guide, level: 3, stale: false } };
    }
  }
  // 换一条可推导的行列查看；已进入理由层时，新展示的理由同步记入手记。
  if (action.type === "guide.line" && current.guide && !current.solved) {
    const guide = current.guide;
    const line = derivePlan(puzzle, current.marks).lines.find(
      (l) => l.line === action.line,
    );
    if (line && line.line !== guide.line)
      next = {
        ...current,
        guide: { ...guide, line: line.line, stale: false },
        notes:
          guide.level >= 2 && line.certain.length
            ? addNote(current.notes, toNote(line))
            : current.notes,
      };
  }
  // 第 3 层：确认落格。落格前用当前盘面重新证明，过期结论不落格、不扣费。
  if (
    action.type === "guide.apply" &&
    current.guide &&
    current.guide.level >= 3 &&
    !current.solved
  ) {
    const guide = current.guide;
    const proven = deriveLine(puzzle, current.marks, guide.line).certain.some(
      (c) => c.index === action.index && c.mark === action.mark,
    );
    if (!proven) {
      next = { ...current, guide: { ...guide, stale: true } };
    } else if (current.hints < HINT_LIMIT) {
      const marked = applyMark(current, action.index, action.mark);
      if (marked !== current)
        next = { ...marked, hints: current.hints + 1, guide: null };
    }
  }
  if (action.type === "check" && !current.solved)
    next = { ...current, checks: current.checks + 1 };
  if (action.type === "tick" && !current.solved)
    next = { ...current, seconds: current.seconds + 1 };
  if (action.type === "reset") next = newSession(puzzle);
  if (next === current) return document;
  next = { ...next, solved: isSolved(puzzle, next) };
  const withRecord = registerSolve(document, puzzle, next);
  return {
    ...withRecord,
    sessions: { ...withRecord.sessions, [puzzle.id]: next },
  };
}
