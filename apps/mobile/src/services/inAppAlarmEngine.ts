type TimeoutHandle = ReturnType<typeof setTimeout>;

export type InAppAlarmEvent = {
  id: string;
  eclipseId: string;
  contactKey: string;
  contactLabel: string;
  eventIso: string;
  eventMs: number;
};

export type InAppAlarmEngineArmInput = {
  enabled: boolean;
  events: InAppAlarmEvent[];
  alarmLeadSecondsA1: number;
  alarmCountdownStartSecondsA2: number;
};

type InAppAlarmEngineClock = {
  now: () => number;
  setTimeout: (callback: () => void, delayMs: number) => TimeoutHandle;
  clearTimeout: (handle: TimeoutHandle) => void;
};

type InAppAlarmEngineOptions = {
  speak: (text: string) => void;
  clock?: InAppAlarmEngineClock;
};

export type InAppAlarmEngine = {
  arm: (input: InAppAlarmEngineArmInput) => void;
  dispose: () => void;
};

const SPOKEN_KEY_TTL_MS = 12 * 60 * 60 * 1000;

function defaultClock(): InAppAlarmEngineClock {
  return {
    now: () => Date.now(),
    setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
    clearTimeout: (handle) => clearTimeout(handle),
  };
}

function clampPositiveSeconds(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.round(value));
}

function eventBaseKey(event: InAppAlarmEvent) {
  return `${event.eclipseId}:${event.contactKey}:${event.eventIso}`;
}

function dedupeAndSortEvents(events: InAppAlarmEvent[]) {
  const deduped = new Map<string, InAppAlarmEvent>();
  for (const event of events) {
    if (!event.id || !Number.isFinite(event.eventMs)) continue;
    deduped.set(event.id, event);
  }
  return [...deduped.values()].sort((a, b) => a.eventMs - b.eventMs);
}

export function createInAppAlarmEngine(options: InAppAlarmEngineOptions): InAppAlarmEngine {
  const clock = options.clock ?? defaultClock();
  const activeTimeouts = new Set<TimeoutHandle>();
  const spokenByKey = new Map<string, number>();

  const clearAllTimeouts = () => {
    for (const handle of activeTimeouts) {
      clock.clearTimeout(handle);
    }
    activeTimeouts.clear();
  };

  const scheduleAt = (targetMs: number, callback: () => void) => {
    const delayMs = Math.max(0, targetMs - clock.now());
    const handle = clock.setTimeout(() => {
      activeTimeouts.delete(handle);
      callback();
    }, delayMs);
    activeTimeouts.add(handle);
  };

  const pruneSpokenKeys = () => {
    const cutoff = clock.now() - SPOKEN_KEY_TTL_MS;
    for (const [key, spokenAtMs] of spokenByKey.entries()) {
      if (spokenAtMs < cutoff) spokenByKey.delete(key);
    }
  };

  const speakOnce = (key: string, text: string) => {
    if (spokenByKey.has(key)) return;
    spokenByKey.set(key, clock.now());
    options.speak(text);
  };

  const startCountdown = (event: InAppAlarmEvent, configuredStartSeconds: number) => {
    const baseKey = eventBaseKey(event);
    const startSeconds = clampPositiveSeconds(configuredStartSeconds);

    const tick = () => {
      const remainingSeconds = Math.ceil((event.eventMs - clock.now()) / 1000);
      if (remainingSeconds <= 0) return;
      if (remainingSeconds > startSeconds) {
        const startTargetMs = event.eventMs - startSeconds * 1000;
        scheduleAt(startTargetMs, tick);
        return;
      }

      speakOnce(`${baseKey}:countdown:${remainingSeconds}`, String(remainingSeconds));
      if (remainingSeconds <= 1) return;

      const nextTargetMs = event.eventMs - (remainingSeconds - 1) * 1000;
      scheduleAt(nextTargetMs, tick);
    };

    tick();
  };

  const arm = (input: InAppAlarmEngineArmInput) => {
    clearAllTimeouts();
    pruneSpokenKeys();
    if (!input.enabled) return;

    const nowMs = clock.now();
    const a1Seconds = clampPositiveSeconds(input.alarmLeadSecondsA1);
    const a2Seconds = clampPositiveSeconds(input.alarmCountdownStartSecondsA2);
    const sortedEvents = dedupeAndSortEvents(input.events);

    for (const event of sortedEvents) {
      if (event.eventMs <= nowMs) continue;

      const baseKey = eventBaseKey(event);
      const a1TargetMs = event.eventMs - a1Seconds * 1000;
      const a2TargetMs = event.eventMs - a2Seconds * 1000;
      const a1Phrase = `${a1Seconds} seconds to ${event.contactLabel}`;
      const finalPhrase = `We're at ${event.contactLabel}`;

      if (nowMs >= a1TargetMs && nowMs < a2TargetMs) {
        speakOnce(`${baseKey}:a1`, a1Phrase);
      } else if (a1TargetMs > nowMs) {
        scheduleAt(a1TargetMs, () => speakOnce(`${baseKey}:a1`, a1Phrase));
      }

      if (a2TargetMs <= nowMs) {
        startCountdown(event, a2Seconds);
      } else {
        scheduleAt(a2TargetMs, () => startCountdown(event, a2Seconds));
      }

      scheduleAt(event.eventMs, () => speakOnce(`${baseKey}:final`, finalPhrase));
    }
  };

  const dispose = () => {
    clearAllTimeouts();
    spokenByKey.clear();
  };

  return {
    arm,
    dispose,
  };
}
