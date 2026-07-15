"use client";

import { cancelFrame, frame, useReducedMotion } from "framer-motion";
import { ReactLenis } from "lenis/react";
import type { LenisRef } from "lenis/react";
import { type ReactNode, useEffect, useRef } from "react";

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<LenisRef>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;

    const update = ({ timestamp }: { timestamp: number }) => {
      lenisRef.current?.lenis?.raf(timestamp);
    };

    frame.update(update, true);
    return () => cancelFrame(update);
  }, [reducedMotion]);

  if (reducedMotion) return children;

  return (
    <ReactLenis
      ref={lenisRef}
      root
      options={{
        autoRaf: false,
        anchors: { offset: -64 },
        lerp: 0.075,
        smoothWheel: true,
        syncTouch: false,
        wheelMultiplier: 0.86,
      }}
    >
      {children}
    </ReactLenis>
  );
}
