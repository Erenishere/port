import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { services } from "@/lib/data";

export function ChapterForge() {
  return (
    <section id="forge" className="ink-section ink-forge">
      <Image
        className="ink-forge__art"
        src="/images/forge-disciplines-art.png"
        alt=""
        aria-hidden="true"
        width={1536}
        height={1024}
        sizes="100vw"
      />
      <div className="ink-forge__sun" aria-hidden="true" />
      <div className="ink-shell">
        <div className="ink-forge__intro">
          <div className="ink-heading ink-heading--light">
            <p className="ink-kicker ink-kicker--light">
              <span>Chapter four</span>
              The forge
            </p>
            <h2>
              The work takes
              <br />
              <em>useful form.</em>
            </h2>
          </div>
          <p className="ink-forge__statement">
            New product, operational system, rescue mission, or practical AI—the
            medium changes. The standard does not.
          </p>
        </div>

        <div className="forge-ledger">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <article className="forge-entry" key={service.title}>
                <div className="forge-entry__top">
                  <span>0{index + 1}</span>
                  <Icon size={22} strokeWidth={1.5} />
                </div>
                <small>{service.verb}</small>
                <h3>{service.title}</h3>
                <p>{service.copy}</p>
                <ul>
                  {service.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
                <a href="#resolution">
                  Shape this work <ArrowUpRight size={15} />
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
