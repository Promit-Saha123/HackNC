/**
 * The phone has one audio session. Features that play or record (briefing voice, Somni chat) claim it here:
 * claiming stops whoever held it before, so neither feature needs to know about the other.
 */
const holders = new Map<string, () => void>();

/** Register `stop` for `id` and stop every other holder. Call right before playing or recording. */
export function claimAudio(id: string, stop: () => void) {
  holders.forEach((stopOther, other) => {
    if (other !== id) stopOther();
  });
  holders.set(id, stop);
}
