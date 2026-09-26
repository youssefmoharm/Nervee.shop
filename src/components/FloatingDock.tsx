import type { ReactNode } from 'react';

/**
 * Single stacking context for bottom-end floating actions (chat, compare).
 * Children stack vertically above the safe-area inset — no competing fixed
 * positions or z-index fights. Extra clearance is applied via CSS when the
 * cookie banner or PDP sticky CTA is present (see index.css).
 */
export default function FloatingDock({ children }: { children: ReactNode }) {
  return (
    // Positioning container only — no aria-label (axe aria-prohibited-attr:
    // generic divs may not be named). Each child control carries its own label.
    <div className="nv-floating-dock" data-floating-dock>
      {children}
    </div>
  );
}
