import { ScanLine, ArrowUpRight, Sparkles } from "lucide-react";
import type { Mark, Puzzle, Session } from "../../../shared/types";
import { inspect } from "../lib/inspect";
import { RuleGuide } from "./RuleGuide";
import { GuidePanel } from "./GuidePanel";
export function AssistPanel({
  puzzle,
  session,
  message,
  onCheck,
  onGuideOpen,
  onGuideAdvance,
  onGuideLine,
  onGuideApply,
}: {
  puzzle: Puzzle;
  session: Session;
  message: string;
  onCheck: () => void;
  onGuideOpen: () => void;
  onGuideAdvance: () => void;
  onGuideLine: (line: number) => void;
  onGuideApply: (index: number, mark: Mark) => void;
}) {
  const stats = inspect(puzzle, session);
  return (
    <aside className="assist">
      <section className="panel helper">
        <span className="eyebrow">A GENTLE NUDGE</span>
        <h2>换个思路看看</h2>
        <p className="muted">卡住也没关系，让引导陪你一步一步想。</p>
        <GuidePanel
          puzzle={puzzle}
          session={session}
          onOpen={onGuideOpen}
          onAdvance={onGuideAdvance}
          onSelectLine={onGuideLine}
          onApply={onGuideApply}
        />
        <button
          className="check-button"
          onClick={onCheck}
          disabled={session.solved}
        >
          <ScanLine size={17} />
          检查当前标记
          <ArrowUpRight size={16} />
        </button>
        <div className="assist-message" role="status">
          {message || "相信你的推理，也可以随时检查。"}
        </div>
        <div className="assist-stats">
          <div>
            <strong>{stats.filled}</strong>
            <span>已填涂</span>
          </div>
          <div>
            <strong>{stats.crossed}</strong>
            <span>已标空</span>
          </div>
          <div>
            <strong>{session.hints}</strong>
            <span>已用额度</span>
          </div>
        </div>
        <RuleGuide />
      </section>
      <section className="quiet-card">
        <Sparkles size={21} />
        <span>小小的专注时刻</span>
        <p>
          世界很大，
          <br />
          先解开眼前这一格。
        </p>
        <div className="quiet-grid">
          {[0, 1, 0, 1, 1, 1, 0, 1, 0].map((v, i) => (
            <span className={v ? "ink" : ""} key={i} />
          ))}
        </div>
      </section>
    </aside>
  );
}
