import React, { useState, useEffect } from 'react';

export const InitialOpeningTransition: React.FC = () => {
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    // Safety timeout to completely unmount the overlay after the 3400ms sequence completes
    const timer = setTimeout(() => {
      setIsDone(true);
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  if (isDone) return null;

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-[#040711] animate-opening-backdrop select-none overflow-hidden"
      aria-hidden="true"
      onAnimationEnd={() => setIsDone(true)}
    >
      {/* Subtle Ambient Vignette & Faint Glow Behind Opening Text */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08)_0%,transparent_70%)]" />

      {/* Centered Minimal Romantic Title: “Our little story ♡” */}
      <div className="relative px-6 py-4 flex items-center justify-center animate-opening-text">
        <h1 className="font-romantic text-2xl sm:text-3xl font-light tracking-[0.24em] sm:tracking-[0.28em] text-slate-100 flex items-center gap-2.5 drop-shadow-[0_2px_18px_rgba(165,180,252,0.35)]">
          <span className="italic">Our little story</span>
          <span className="text-rose-300/90 font-serif font-normal text-xl sm:text-2xl -mt-0.5">
            ♡
          </span>
        </h1>
      </div>
    </div>
  );
};
