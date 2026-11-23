import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Lightbulb } from "lucide-react";
import type { CertainCell, Mark, Puzzle, Session } from "../../../shared/types";
import {
  HINT_LIMIT,
  deriveLine,
  derivePlan,
  lineCells,
  noteCurrent,
} from "../model/guide";

function certainText(certain: CertainCell[], cells: number[]): string {
  const position = (cell: CertainCell) => cells.indexOf(cell.index) + 1;
  const filled = certain.filter((c) => c.mark === "filled").map(position);
  const cross = certain.filter((c) => c.mark === "cross").map(position);
  const parts: string[] = [];
  if (filled.length) parts.push(`第 ${filled.join("、")} 格必为填涂`);
  if (cross.length) parts.push(`第 ${cross.join("、")} 格必为空`);
  return parts.join("，");
}

function GuideNotes({ puzzle, session }: { puzzle: Puzzle; session: Session }) {
  if (!session.notes.length) return null;
  return (
    <div className="guide-notes">
      <span className="eyebrow">提示手记 · 展示过的理由</span>
      {session.notes.slice(0, 4).map((note) => {
        const current = noteCurrent(puzzle, session.marks, note);
        return (
          <div
            key={note.id}
            className={`guide-note ${current ? "" : "expired"}`}
          >
            <strong>
              {note.label} · 线索 {note.clue.join(" ")}
            </strong>
            <small>
              {note.candidates} 种一致排布 →{" "}
              {certainText(note.certain, lineCells(puzzle.size, note.line))}
            </small>
            <em>{current ? "结论仍有效" : "已过期 · 仅作记录，不能据此落格"}</em>
          </div>
        );
      })}
    </div>
  );
}

export function GuidePanel({
  puzzle,
  session,
  onOpen,
  onAdvance,
  onSelectLine,
  onApply,
}: {
  puzzle: Puzzle;
  session: Session;
  onOpen: () => void;
  onAdvance: () => void;
  onSelectLine: (line: number) => void;
  onApply: (index: number, mark: Mark) => void;
}) {
  const guide = session.guide;
  const remaining = HINT_LIMIT - session.hints;
  const plan = useMemo(
    () => derivePlan(puzzle, session.marks),
    [puzzle, session.marks],
  );
  const level = guide?.level ?? 0;
  const [view, setView] = useState(1);
  useEffect(() => {
    setView(level > 0 ? level : 1);
  }, [level]);

  if (!guide) {
    return (
      <div className="guide">
        <button
          className="hint-button"
          onClick={onOpen}
          disabled={session.solved || remaining <= 0}
        >
          <Lightbulb size={18} />
          <span>开始逐层引导</span>
          <span className="hint-count">
            剩余 {remaining} / {HINT_LIMIT}
          </span>
        </button>
        <p className="hint-note">
          先指出可推导的行列，再讲关键理由，确认后才落下一格；三步共用本题额度，重复查看不重复消耗。
        </p>
        <GuideNotes puzzle={puzzle} session={session} />
      </div>
    );
  }

  const goNext = () => {
    if (view < level) setView(view + 1);
    else onAdvance();
  };
  const derivation = deriveLine(puzzle, session.marks, guide.line);
  const target = derivation.certain[0];
  const targetRow = target ? Math.floor(target.index / puzzle.size) + 1 : 0;
  const targetCol = target ? (target.index % puzzle.size) + 1 : 0;

  return (
    <div className="guide">
      <div className="guide-quota">
        <span>
          剩余额度 {remaining} / {HINT_LIMIT}
        </span>
        <span>已解锁第 {level} 层</span>
      </div>
      <div className="guide-steps">
        {["找行列", "看理由", "落一格"].map((label, i) => (
          <button
            key={label}
            className={view === i + 1 ? "active" : ""}
            disabled={level < i + 1}
            onClick={() => setView(i + 1)}
          >
            {i + 1} · {label}
          </button>
        ))}
      </div>

      {view === 1 && (
        <div className="guide-stage">
          {plan.lines.length ? (
            <>
              <p className="guide-lead">这些行列现在能推出确定的格子：</p>
              <div className="guide-lines">
                {plan.lines.map((line) => (
                  <button
                    key={line.line}
                    className={guide.line === line.line ? "active" : ""}
                    onClick={() => onSelectLine(line.line)}
                  >
                    <strong>{line.label}</strong>
                    <small>
                      线索 {line.clue.join(" ")} · {line.certain.length}{" "}
                      格可确定
                    </small>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="guide-empty">
              当前盘面没有必然结论。继续标记几格，或先检查已有标记。
            </p>
          )}
          {plan.contradictions.length > 0 && (
            <p className="guide-warn">
              {plan.contradictions.map((l) => l.label).join("、")}
              的标记与线索矛盾，建议先检查。
            </p>
          )}
          <button
            className="guide-next"
            onClick={goNext}
            disabled={!plan.lines.length || remaining <= 0}
          >
            看看关键理由 <ArrowRight size={14} />
          </button>
        </div>
      )}

      {view === 2 && (
        <div className="guide-stage">
          <div className="guide-reason">
            <div className="guide-reason-head">
              <strong>{derivation.label}</strong>
              <span>线索 {derivation.clue.join(" ")}</span>
            </div>
            <div className="guide-strip" aria-hidden="true">
              {derivation.pattern.split("").map((ch, i) => (
                <span
                  key={i}
                  className={ch === "F" ? "f" : ch === "X" ? "x" : ""}
                />
              ))}
            </div>
            {derivation.candidates === 0 ? (
              <p>
                当前标记与线索矛盾，没有一致的排布——先检查这条线上的标记。
              </p>
            ) : derivation.certain.length ? (
              <p>
                与线索和当前标记一致的排布共有 {derivation.candidates} 种；
                {certainText(derivation.certain, derivation.cells)}。
              </p>
            ) : (
              <p>
                一致的排布共有 {derivation.candidates}{" "}
                种，但没有哪一格在所有排布中都相同——这条线暂时没有必然结论。
              </p>
            )}
          </div>
          <button
            className="guide-next"
            onClick={goNext}
            disabled={!derivation.certain.length}
          >
            帮我落下一格 <ArrowRight size={14} />
          </button>
        </div>
      )}

      {view === 3 && (
        <div className="guide-stage">
          {guide.stale && (
            <p className="guide-warn">
              盘面刚有变化，之前的结论已失效；以下是按当前盘面重新推导的结果，请重新确认。
            </p>
          )}
          {target ? (
            <>
              <div className="guide-target">
                <strong>
                  第 {targetRow} 行第 {targetCol} 列 →{" "}
                  {target.mark === "filled" ? "填涂" : "标空 ×"}
                </strong>
                <p>
                  理由：{derivation.label}线索 {derivation.clue.join(" ")}{" "}
                  与当前标记一致的 {derivation.candidates}{" "}
                  种排布中，这一格都是
                  {target.mark === "filled" ? "填涂" : "空"}。
                </p>
              </div>
              <button
                className="guide-apply"
                onClick={() => onApply(target.index, target.mark)}
                disabled={remaining <= 0}
              >
                <CheckCircle2 size={15} /> 确认落下这一格
              </button>
            </>
          ) : (
            <p className="guide-empty">
              当前盘面没有必然结论，没有可落下的格子。
            </p>
          )}
        </div>
      )}
      <GuideNotes puzzle={puzzle} session={session} />
    </div>
  );
}
