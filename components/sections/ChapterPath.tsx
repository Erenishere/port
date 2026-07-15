import { processSteps } from "@/lib/data";

export function ChapterPath() {
  return (
    <section id="path" className="ink-section ink-path">
      <div className="ink-shell">
        <div className="ink-path__heading">
          <div className="ink-heading">
            <p className="ink-kicker">
              <span>Chapter six</span>
              The route
            </p>
            <h2>
              A visible path
              <br />
              <em>to launch.</em>
            </h2>
          </div>
          <p>
            Every stage reduces uncertainty and leaves something the next stage can
            trust: a decision, a screen, a model, or working code.
          </p>
        </div>

        <div className="process-map">
          <div className="process-map__terrain" aria-hidden="true" />
          <svg viewBox="0 0 1160 410" className="process-map__route" aria-hidden="true">
            <path d="M60 285 C170 70 330 360 465 215 S710 45 785 220 S1010 335 1105 105" />
            {["60,285", "275,250", "500,185", "790,220", "1105,105"].map((point) => {
              const [cx, cy] = point.split(",");
              return <circle key={point} cx={cx} cy={cy} r="10" />;
            })}
          </svg>

          <ol className="process-map__steps">
            {processSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title}>
                  <span className="process-map__node"><Icon size={18} /></span>
                  <small>Step 0{index + 1}</small>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
