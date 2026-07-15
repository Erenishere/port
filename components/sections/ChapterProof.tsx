import Image from "next/image";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { projects, type Project } from "@/lib/data";

function SystemArtifact({ artifact }: { artifact: Project["artifact"] }) {
  return (
    <div className="system-artifact" aria-hidden="true">
      <div className="system-artifact__bar">
        <span />
        <span />
        <span />
        <small>{artifact.code}</small>
      </div>
      <div className="system-artifact__body">
        <aside>
          <b>{artifact.mark}</b>
          {artifact.signals.map((s) => <i key={s} />)}
        </aside>
        <div className="system-artifact__main">
          <div className="system-artifact__heading">
            <span>
              <b>{artifact.label}</b>
              <small>Operational system view</small>
            </span>
            <em>{artifact.status}</em>
          </div>
          <div className="system-artifact__metrics">
            {artifact.metrics.map((m) => (
              <div key={m.label}>
                <small>{m.label}</small>
                <b>{m.value}</b>
              </div>
            ))}
          </div>
          <div className="system-artifact__rows">
            {artifact.signals.map((signal) => (
              <span key={signal}><CheckCircle2 size={12} /> {signal}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChapterProof() {
  return (
    <section id="proof" className="ink-section ink-proof">
      <Image
        className="ink-proof__blossom-tree"
        src="/images/project-blossom-tree.png"
        alt=""
        aria-hidden="true"
        width={864}
        height={1821}
        sizes="(max-width: 42rem) 864px, (max-width: 64rem) 864px, 45vw"
      />
      <div className="ink-shell">
        <div className="ink-heading">
          <p className="ink-kicker">
            <span>Chapter five</span>
            Proof of work
          </p>
          <h2>
            Real systems. Real
            <br />
            <em>operational depth.</em>
          </h2>
          <p>
            Three production-minded builds spanning enterprise operations, grounded
            AI, and secure role-based case management.
          </p>
        </div>

        <div className="project-scroll">
          {projects.map((project, index) => (
            <article
              className={project.featured ? "project-case project-case--featured" : "project-case"}
              key={project.title}
            >
              <div className="project-case__artifact">
                <SystemArtifact artifact={project.artifact} />
                <span className="project-case__stamp">
                  {project.featured ? "Featured 01" : "Case 0" + (index + 1)}
                </span>
              </div>
              <div className="project-case__copy">
                {project.featured && (
                  <span className="project-case__featured">Primary featured project</span>
                )}
                <p>{project.category}</p>
                <h3>{project.title}</h3>
                <dl>
                  <div><dt>System</dt><dd>{project.description}</dd></div>
                  <div><dt>My role</dt><dd>{project.role}</dd></div>
                </dl>
                <div className="project-case__features">
                  <h4>Core features</h4>
                  <ul>
                    {project.features.map((feature) => <li key={feature}>{feature}</li>)}
                  </ul>
                </div>
                <ul className="project-case__stack" aria-label="Technology stack">
                  {project.stack.map((item) => <li key={item}>{item}</li>)}
                </ul>
                {project.liveUrl && (
                  <a
                    className="project-case__live"
                    href={project.liveUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View live system <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
