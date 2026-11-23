import { useEffect, useReducer, useState, useRef } from "react";
import { findPuzzle, puzzles } from "../features/catalog";
import {
  HINT_LIMIT,
  deriveLine,
  derivePlan,
  inspect,
} from "../features/assist";
import { loadDocument, saveDocument } from "../features/journal";
import type { Mark } from "../shared/types";
import { transition } from "./reducer";
export function useGame() {
  const [initial] = useState(() => loadDocument(puzzles));
  const [document, dispatch] = useReducer(
    (d: typeof initial.document, a: Parameters<typeof transition>[1]) =>
      transition(d, a, puzzles),
    initial.document,
  );
  const [message, setMessage] = useState(initial.warning);
  const [saveState, setSaveState] = useState(
    initial.warning ? "手动保存" : "进度已保存",
  );
  const allowSave = useRef(!initial.warning);
  const puzzle = findPuzzle(document.activeId);
  const session = document.sessions[puzzle.id];
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (globalThis.document.visibilityState === "visible")
        dispatch({ type: "tick" });
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!allowSave.current) return;
    const timer = setTimeout(
      () =>
        setSaveState(
          saveDocument(document) ? "进度已保存" : "保存失败 · 点击重试",
        ),
      300,
    );
    return () => clearTimeout(timer);
  }, [document]);
  const save = () => {
    allowSave.current = true;
    setSaveState(saveDocument(document) ? "进度已保存" : "保存失败 · 点击重试");
  };
  const guideOpen = () => {
    if (session.solved || session.guide) return;
    if (session.hints >= HINT_LIMIT) {
      setMessage("本题提示额度已用完，试试检查当前标记。");
      return;
    }
    if (!derivePlan(puzzle, session.marks).lines.length) {
      setMessage(
        "当前盘面没有必然结论：没有哪一行或列能确定新的格子。继续标记几格，或先检查已有标记。",
      );
      return;
    }
    dispatch({ type: "guide.open" });
    setMessage("第 1 步：这些行列现在能推出确定的格子。");
  };
  const guideAdvance = () => {
    const guide = session.guide;
    if (!guide || session.solved) return;
    if (guide.level === 1) {
      if (session.hints >= HINT_LIMIT) {
        setMessage("本题提示额度已用完，无法进入下一层。");
        return;
      }
      if (!derivePlan(puzzle, session.marks).lines.length) {
        setMessage("当前盘面没有必然结论，暂时没有可讲的理由。");
        return;
      }
      dispatch({ type: "guide.advance" });
      setMessage("第 2 步：理由只来自线索和当前标记。");
    } else if (guide.level === 2) {
      dispatch({ type: "guide.advance" });
      setMessage("第 3 步：确认后才会落格。");
    }
  };
  const guideLine = (line: number) => dispatch({ type: "guide.line", line });
  const guideApply = (index: number, mark: Mark) => {
    const guide = session.guide;
    if (!guide || session.solved) return;
    const proven = deriveLine(puzzle, session.marks, guide.line).certain.some(
      (c) => c.index === index && c.mark === mark,
    );
    dispatch({ type: "guide.apply", index, mark });
    setMessage(
      proven
        ? "已按你的确认落下一格，行列状态与进度已同步更新。"
        : "盘面已有变化，刚才的结论不再成立：未落格，也未消耗额度。",
    );
  };
  const check = () => {
    const { errors } = inspect(puzzle, session);
    dispatch({ type: "check" });
    setMessage(
      errors
        ? `目前有 ${errors} 处标记与答案不符。检查不会直接揭示位置。`
        : "已填写的标记都正确，继续你的发现吧。",
    );
  };
  return {
    document,
    puzzle,
    session,
    message,
    saveState,
    dispatch,
    save,
    guideOpen,
    guideAdvance,
    guideLine,
    guideApply,
    check,
    clearMessage: () => setMessage(""),
  };
}
