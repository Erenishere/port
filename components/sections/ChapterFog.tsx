import { AlertTriangle, Clock, Unplug, Zap } from "lucide-react";

const problems = [
  {
    icon: Clock,
    code: "LATENCY_01",
    title: "Slow screens",
    copy: "Users leave while critical pages are still deciding what to show.",
  },
  {
    icon: AlertTriangle,
    code: "REGRESSION_12",
    title: "Fragile code",
    copy: "Every small change threatens three unrelated parts of the product.",
  },
  {
    icon: Unplug,
    code: "SYNC_404",
    title: "Disconnected data",
    copy: "Teams become the API, copying information between systems by hand.",
  },
  {
    icon: Zap,
    code: "STATE_NULL",
    title: "Missing states",
    copy: "The happy path works; real customers find everything around it.",
  },
];

export function ChapterFog() {
  return (
    <section id="fog" className="ink-section ink-chaos">
      <div className="ink-chaos__splash" aria-hidden="true" />
      <div className="ink-shell ink-chaos__layout">
        <div className="ink-heading ink-heading--light">
          <p className="ink-kicker ink-kicker--light">
            <span>Chapter two</span>
            The fog
          </p>
          <h2>
            Before clarity,
            <br />
            <em>name the chaos.</em>
          </h2>
          <p>
            Pressure rarely arrives as one clean problem. It arrives as warnings,
            workarounds, and work nobody remembers choosing.
          </p>
          <div className="ink-margin-note">
            <span lang="ja">問題を見つける</span>
            <small>Find the real problem</small>
          </div>
        </div>

        <div className="chaos-board" aria-label="Common system problems">
          <span className="chaos-board__thread" aria-hidden="true" />
          {problems.map((problem, index) => {
            const Icon = problem.icon;
            return (
              <article className="chaos-slip" key={problem.title}>
                <div className="chaos-slip__meta">
                  <Icon size={17} />
                  <span>{problem.code}</span>
                  <b>0{index + 1}</b>
                </div>
                <h3>{problem.title}</h3>
                <p>{problem.copy}</p>
                <i aria-hidden="true" />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
