/**
 * =========================================================================
 * YOUTUBE SONG URL CONFIGURATION
 * Paste your YouTube link for Humnava Mere inside the quotes below:
 * =========================================================================
 */
export const YOUTUBE_SONG_URL = 'https://youtu.be/TmRgK-pXH9c?si=J1CfjilQ4_GUeQgz';

/**
 * Relationship Counter & Romantic Configuration
 * 
 * Relationship Start Date/Time:
 * 8 April 2026, 02:23 AM
 * Timezone: Asia/Dhaka (Bangladesh, UTC+6)
 */
export const RELATIONSHIP_CONFIG = {
  // ISO-8601 string with Asia/Dhaka (+06:00) offset (Internal permanent start timestamp)
  startDateISO: '2026-04-08T02:23:00+06:00',

  // Permanent timestamp in milliseconds
  startTimestamp: new Date('2026-04-08T02:23:00+06:00').getTime(),

  // Display strings (visible to user - no UTC/timezone text)
  startDateFormatted: '8 April 2026',
  startTimeFormatted: '02:23 AM',
  formattedStartDate: '8 April 2026',
  formattedStartTime: '02:23 AM',
  sinceLabel: 'Since 8 April 2026, 02:23 AM',

  // Main phrase - strictly preserved
  mainPhrase: 'I LOVE YOU, MY HEARTBEAT.',

  // Couple signature
  coupleSignature: 'Ripti ♡ Raufur',

  // Song details
  songName: 'Humnava Mere',
  youtubeUrl: YOUTUBE_SONG_URL,
  audioPath: '/humnava_mere.mp3',
  audioFallbackPath: '/humnava_mere.wav',

  // Special message - strictly preserved
  specialMessage: 'Every second with you matters.',
} as const;

export interface TimeElapsed {
  totalDays: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

/**
 * Calculates exact elapsed time from the configured start timestamp
 * using the current device clock.
 */
export function calculateElapsed(targetTimestamp: number, currentTimestamp = Date.now()): TimeElapsed {
  const diffMs = currentTimestamp - targetTimestamp;
  const isPast = diffMs >= 0;
  const absoluteDiff = Math.max(0, diffMs);

  const totalDays = Math.floor(absoluteDiff / (1000 * 60 * 60 * 24));
  const remainingMsAfterDays = absoluteDiff % (1000 * 60 * 60 * 24);

  const hours = Math.floor(remainingMsAfterDays / (1000 * 60 * 60));
  const remainingMsAfterHours = remainingMsAfterDays % (1000 * 60 * 60);

  const minutes = Math.floor(remainingMsAfterHours / (1000 * 60));
  const remainingMsAfterMinutes = remainingMsAfterHours % (1000 * 60);

  const seconds = Math.floor(remainingMsAfterMinutes / 1000);

  return {
    totalDays,
    hours,
    minutes,
    seconds,
    isPast,
  };
}

/**
 * Helper to pad numbers with leading zero (e.g. 05)
 */
export function padZero(num: number, digits = 2): string {
  return num.toString().padStart(digits, '0');
}
