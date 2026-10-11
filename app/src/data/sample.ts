// Values the API does not return yet. Screens that use these show a "sample/demo data" note.
// TODO(P1/P2): replace with real fields once the contract has them (see HANDOFF.md).

/** Longest streak ever. Overview only has the current streak. */
export const SAMPLE_BEST_STREAK = 14;

/**
 * Bedtime (minutes after 9 pm) and minutes asleep for the last 7 nights, oldest first.
 * Overview only has bed/wake times for last night; earlier nights use these.
 */
export const SAMPLE_NIGHTS: { bedAfter9pm: number; asleepMin: number }[] = [
  { bedAfter9pm: 105, asleepMin: 492 }, // 10:45 pm, 8h 12m
  { bedAfter9pm: 150, asleepMin: 431 }, // 11:30 pm, 7h 11m
  { bedAfter9pm: 210, asleepMin: 362 }, // 12:30 am, 6h 02m
  { bedAfter9pm: 120, asleepMin: 515 }, // 11:00 pm, 8h 35m
  { bedAfter9pm: 240, asleepMin: 334 }, // 1:00 am, 5h 34m
  { bedAfter9pm: 110, asleepMin: 498 }, // 10:50 pm, 8h 18m
  { bedAfter9pm: 105, asleepMin: 522 }, // 10:45 pm, 8h 42m
];

/** Share of a night in each stage. Demo only: there is no real stage tracking yet. */
export const DEMO_STAGE_SPLIT = { deep: 0.17, light: 0.52, rem: 0.24, awake: 0.07 };

/** Invite codes for the seeded demo squads, so "Join" works without a backend. */
export const DEMO_SQUAD_CODES: Record<string, string> = { WOLF23: 'Wolfpack', OWLS42: 'Night Owls' };

/** Default sleep targets: bedtime and wake in minutes after midnight, plus hours. */
export const DEFAULT_GOALS = { bedtime: 22 * 60 + 45, wake: 7 * 60, hours: 8 };
