"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { navItems } from "@/lib/data";

export function SiteHeader() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (value) => setScrolled(value > 48));

  return (
    <header className={`ink-header ${scrolled ? "ink-header--scrolled" : ""}`}>
      <div className="ink-header__inner">
        <a href="#arrival" className="ink-brand" aria-label="WebNexus home">
          <span className="ink-brand__seal">W</span>
          <span className="ink-brand__copy">
            <strong>WebNexus</strong>
            <small>Systems · Apps · Growth</small>
          </span>
        </a>

        <nav className="ink-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ink-header__actions">
          <a href="mailto:hello@webnexus.dev" className="ink-button ink-button--header">
            Let&apos;s build
          </a>
          <button
            type="button"
            className="ink-menu-button"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            className="ink-mobile-nav"
            aria-label="Mobile navigation"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            {navItems.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                {item.label}
              </a>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
