import Image from "next/image";
import { ArrowRight, Mail } from "lucide-react";

const capabilities = ["Business systems", "Web applications", "AI workflows"];

export function ChapterArrival() {
  return (
    <section id="arrival" className="ink-hero">
      <Image
        src="/images/webnexus-ink-hero-v2.png"
        alt="An ink-painted systems architect facing a city connected by a crimson path"
        fill
        priority
        sizes="100vw"
        className="ink-hero__art"
      />
      <div className="ink-hero__wash" aria-hidden="true" />
      <div className="ink-hero__side-note" aria-hidden="true">
        <span lang="ja">混沌から明確へ</span>
        <i />
        <small>01</small>
      </div>

      <div className="ink-shell ink-hero__content">
        <p className="ink-kicker">
          <span>Chapter one</span>
          The signal awakens
        </p>
        <h1>
          We build <em>order</em>
          <br />
          out of chaos.
        </h1>
        <p className="ink-hero__lead">
          Business systems, web applications, and practical AI—crafted into one
          dependable path forward.
        </p>

        <div className="ink-hero__actions">
          <a href="#fog" className="ink-button ink-button--primary">
            Begin the journey <ArrowRight size={16} />
          </a>
          <a href="mailto:hello@webnexus.dev" className="ink-button ink-button--ghost">
            <Mail size={15} /> Start a project
          </a>
        </div>

        <ul className="ink-capabilities" aria-label="Core capabilities">
          {capabilities.map((capability) => (
            <li key={capability}>{capability}</li>
          ))}
        </ul>
      </div>

      <a href="#fog" className="ink-scroll-cue">
        <span>Read the scroll</span>
        <i />
      </a>
    </section>
  );
}
