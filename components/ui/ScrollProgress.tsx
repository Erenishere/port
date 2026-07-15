"use client";

import { motion, useScroll, useSpring } from "framer-motion";

/** Thin progress bar that runs across the top of the viewport */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="ink-scroll-progress"
      style={{ scaleX: smoothProgress }}
      aria-hidden="true"
    />
  );
}
