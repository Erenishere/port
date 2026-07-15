import { pillars } from "@/lib/data";

export function ChapterThread() {
  return (
    <section id="thread" className="ink-section ink-principles">
      <div className="ink-shell">
        <div className="ink-heading ink-heading--center">
          <p className="ink-kicker">
            <span>Chapter three</span>
            The crimson thread
          </p>
          <h2>
            Four disciplines.
            <br />
            <em>One unbroken line.</em>
          </h2>
          <p>
            The visual style can be expressive. The work underneath it must remain
            exact, readable, and supportable.
          </p>
        </div>

        <div className="principle-map">
          <svg
            className="principle-map__path"
            viewBox="0 0 1100 320"
            role="img"
            aria-label="A crimson path connects the four WebNexus principles"
          >
            <path d="M35 190 C150 30 265 295 405 150 S660 40 735 175 S940 290 1065 115" />
          </svg>

          <div className="principle-map__grid">
            {pillars.map((pillar, index) => {
              const Icon = pillar.icon;
              return (
                <article className="principle-seal" key={pillar.title}>
                  <span className="principle-seal__mark">
                    <Icon size={22} strokeWidth={1.5} />
                  </span>
                  <small>0{index + 1} / {pillar.tagline}</small>
                  <h3>{pillar.title}</h3>
                  <p>{pillar.copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
