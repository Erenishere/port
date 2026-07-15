import Image from "next/image";
import { ArrowRight, BriefcaseBusiness, GitBranch, Mail } from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/contact-email";

const startProjectHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT_EMAIL)}&su=${encodeURIComponent("New WebNexus project enquiry")}&body=${encodeURIComponent("Hello WebNexus,\n\nI would like to discuss a new project.")}`;

export function ChapterResolution() {
  return (
    <section id="resolution" className="ink-resolution">
      <div className="ink-resolution__sun" aria-hidden="true" />
      <Image
        className="ink-resolution__blossom-tree"
        src="/images/contact-blossom-tree.png"
        alt=""
        aria-hidden="true"
        width={864}
        height={1821}
        sizes="(max-width: 42rem) 864px, (max-width: 64rem) 864px, 45vw"
      />
      <div className="ink-resolution__mountains" aria-hidden="true" />

      <div className="ink-shell ink-resolution__content">
        <p className="ink-kicker ink-kicker--light">
          <span>Chapter seven</span>
          The resolution
        </p>
        <h2>
          Bring the next system
          <br />
          <em>into focus.</em>
        </h2>
        <p>
          If you have a product to build, an operational workflow to shape, or a
          system that has lost its way—let&apos;s map the first move.
        </p>
        <div className="ink-resolution__actions">
          <a
            href={startProjectHref}
            className="ink-button ink-button--primary"
            target="_blank"
            rel="noreferrer"
          >
            <Mail size={16} /> Start your project <ArrowRight size={16} />
          </a>
          <a href="#proof" className="ink-button ink-button--dark">Review the work</a>
        </div>
      </div>

      <footer className="ink-footer ink-shell">
        <a href="#arrival" className="ink-brand">
          <span className="ink-brand__seal">W</span>
          <span className="ink-brand__copy"><strong>WebNexus</strong><small>Order from complexity</small></span>
        </a>
        <p>Business systems · Web applications · Practical AI</p>
        <div>
          <a href="https://github.com/" aria-label="GitHub"><GitBranch size={17} /></a>
          <a href="https://www.linkedin.com/" aria-label="LinkedIn"><BriefcaseBusiness size={17} /></a>
        </div>
      </footer>
    </section>
  );
}
