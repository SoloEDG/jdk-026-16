import type {
  CertainCell,
  GameDocument,
  GuideCycle,
  HintNote,
  Mark,
  Puzzle,
} from "../../../shared/types";
import { newDocument, newSession, isSolved } from "../../../shared/document";
import { HINT_LIMIT, NOTE_LIMIT } from "../../assist/model/guide";
const KEY = "gejian.document.v1";
function cleanGuide(value: unknown, size: number): GuideCycle | null {
  if (!value || typeof value !== "object") return null;
  const guide = value as Partial<GuideCycle>;
  const level = Number(guide.level);
  const line = Number(guide.line);
  if (
    ![1, 2, 3].includes(level) ||
    !Number.isInteger(line) ||
    line < 0 ||
    line >= size * 2
  )
    return null;
  return { level: level as 1 | 2 | 3, line, stale: guide.stale === true };
}
function cleanNotes(value: unknown, size: number): HintNote[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (note): note is HintNote =>
        !!note &&
        typeof note.id === "string" &&
        typeof note.label === "string" &&
        Number.isInteger(note.line) &&
        note.line >= 0 &&
        note.line < size * 2 &&
        Array.isArray(note.clue) &&
        note.clue.every((c: unknown) => Number.isFinite(c)) &&
        typeof note.pattern === "string" &&
        Number.isFinite(note.candidates) &&
        Array.isArray(note.certain) &&
        note.certain.every(
          (c: CertainCell) =>
            !!c &&
            Number.isInteger(c.index) &&
            c.index >= 0 &&
            c.index < size ** 2 &&
            (c.mark === "filled" || c.mark === "cross"),
        ) &&
        Number.isFinite(note.createdAt),
    )
    .slice(0, NOTE_LIMIT);
}
export function loadDocument(puzzles: Puzzle[]): {
  document: GameDocument;
  warning: string;
} {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { document: newDocument(puzzles[0]), warning: "" };
    const data = JSON.parse(raw) as GameDocument;
    if (data.version !== 1 || !data.sessions || !Array.isArray(data.records))
      throw Error("unsupported");
    const sessions: GameDocument["sessions"] = {};
    for (const puzzle of puzzles) {
      const saved = data.sessions[puzzle.id];
      if (
        saved &&
        Array.isArray(saved.marks) &&
        saved.marks.length === puzzle.size ** 2 &&
        saved.marks.every((m: Mark) =>
          ["filled", "unknown", "cross"].includes(m),
        )
      ) {
        const session = {
          ...newSession(puzzle),
          marks: saved.marks,
          // 旧存档的已用提示次数折算成已消耗额度，剩余额度不能重复领取
          hints: Math.min(HINT_LIMIT, Math.max(0, Number(saved.hints) || 0)),
          checks: Math.max(0, Number(saved.checks) || 0),
          seconds: Math.max(0, Number(saved.seconds) || 0),
          guide: cleanGuide(saved.guide, puzzle.size),
          notes: cleanNotes(saved.notes, puzzle.size),
          updatedAt: Date.now(),
        };
        sessions[puzzle.id] = { ...session, solved: isSolved(puzzle, session) };
      }
    }
    const active = puzzles.find((p) => p.id === data.activeId) ?? puzzles[0];
    sessions[active.id] ??= newSession(active);
    const records = data.records.filter(
      (r) =>
        r &&
        typeof r.id === "string" &&
        puzzles.some((p) => p.id === r.puzzleId) &&
        Number.isFinite(r.seconds) &&
        Number.isFinite(r.finishedAt) &&
        Number.isFinite(r.hints) &&
        Number.isFinite(r.checks),
    );
    return {
      document: { version: 1, activeId: active.id, sessions, records },
      warning: "",
    };
  } catch {
    return {
      document: newDocument(puzzles[0]),
      warning:
        "存档无法读取，已打开新的解题页。原存档未覆盖，请手动保存新进度。",
    };
  }
}
export function saveDocument(document: GameDocument): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(document));
    return true;
  } catch {
    return false;
  }
}
