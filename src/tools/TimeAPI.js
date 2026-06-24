'use strict';

/**
 * Time / date tools.
 *   - time.now    -> current time (ISO + epoch + components)
 *   - time.sleep  -> sleep for N milliseconds (capped at 30s)
 */

class TimeAPI {
  constructor({ timezone }) {
    this.timezone = timezone;
  }

  now({ timezone } = {}) {
    const d = new Date();
    const opts = timezone ? { timeZone: timezone } : undefined;
    return {
      iso: d.toISOString(),
      epochMs: d.getTime(),
      epochS: Math.floor(d.getTime() / 1000),
      local: d.toLocaleString('en-US', opts),
      utc: d.toUTCString(),
      components: {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
        hours: d.getHours(),
        minutes: d.getMinutes(),
        seconds: d.getSeconds(),
        weekday: d.toLocaleString('en-US', { weekday: 'long' }),
      },
    };
  }

  async sleep({ ms } = {}) {
    if (typeof ms !== 'number' || ms < 0) throw new Error('params.ms (number >= 0) required');
    const capped = Math.min(ms, 30_000);
    await new Promise((r) => setTimeout(r, capped));
    return { sleptMs: capped, requestedMs: ms, capped: ms > 30_000 };
  }
}

module.exports = TimeAPI;
