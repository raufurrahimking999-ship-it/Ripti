import React from 'react';
import { BackgroundAura } from './components/BackgroundAura';
import { CounterDisplay } from './components/CounterDisplay';
import { MusicPlayerCard } from './components/MusicPlayerCard';
import { SpecialMessageCard } from './components/SpecialMessageCard';
import { InitialOpeningTransition } from './components/InitialOpeningTransition';

export default function App() {
  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-between overflow-x-hidden selection:bg-indigo-500/30">
      {/* Premium Initial Opening Experience (Fade-in -> Short Hold -> Seamless Reveal) */}
      <InitialOpeningTransition />

      {/* Background Nocturnal Romantic Atmosphere */}
      <BackgroundAura />

      {/* Main Single-Screen Mobile Content Container (Seamlessly reveals in lockstep with opening dissolve) */}
      <main className="relative z-10 w-full max-w-lg mx-auto flex-1 flex flex-col items-center justify-between px-4 sm:px-6 py-6 sm:py-8 pt-[max(1.75rem,env(safe-area-inset-top))] pb-[max(1.75rem,env(safe-area-inset-bottom))] animate-main-ui-reveal">
        {/* Top Space / Subtle Anchor */}
        <div className="w-full flex justify-center py-1">
          <div className="w-8 h-1 rounded-full bg-white/[0.08]" aria-hidden="true" />
        </div>

        {/* Centerpiece: Romantic Phrase & Real-Time Relationship Day Counter */}
        <div className="w-full my-auto py-4 sm:py-6 flex flex-col items-center">
          <CounterDisplay />
        </div>

        {/* Bottom Section: Music Player ("Humnava Mere") & Special Message */}
        <div className="w-full flex flex-col items-center gap-2 mt-auto">
          <MusicPlayerCard />
          <SpecialMessageCard />
          {/* Subtle Secondary Romantic Line */}
          <p className="text-[11px] sm:text-xs text-indigo-200/50 font-romantic tracking-[0.2em] uppercase select-none text-center pt-1 pb-0.5">
            You make every second worth counting.
          </p>
        </div>
      </main>
    </div>
  );
}
