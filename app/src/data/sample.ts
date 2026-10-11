// App-side defaults for values the API doesn't cover.

/** Share of a night in each stage, for hand-logged nights that have no stage data. */
export const DEMO_STAGE_SPLIT = { deep: 0.17, light: 0.52, rem: 0.24, awake: 0.07 };

/** Default sleep targets until /me/prefs loads: bedtime and wake in minutes after midnight, plus hours. */
export const DEFAULT_GOALS = { bedtime: 22 * 60 + 45, wake: 7 * 60, hours: 8 };
