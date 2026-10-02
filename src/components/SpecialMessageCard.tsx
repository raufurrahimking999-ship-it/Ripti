import React from 'react';
import { RELATIONSHIP_CONFIG } from '../config';

export const SpecialMessageCard: React.FC = () => {
  return (
    <div className="w-full max-w-md px-2 mt-4 sm:mt-5">
      <div className="glass-panel-subtle rounded-xl sm:rounded-2xl py-3.5 px-6 text-center transition-all duration-300">
        <p className="font-romantic italic text-base sm:text-lg text-indigo-100/90 tracking-wide select-none drop-shadow-[0_1px_14px_rgba(244,114,182,0.18)]">
          &ldquo;{RELATIONSHIP_CONFIG.specialMessage}&rdquo;
        </p>
      </div>
    </div>
  );
};
