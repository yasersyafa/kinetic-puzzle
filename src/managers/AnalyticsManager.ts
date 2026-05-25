declare const __BUILD_TARGET__: string | undefined;

export type EventName =
  | 'session_start'
  | 'level_started'
  | 'level_completed'
  | 'level_failed'
  | 'block_moved'
  | 'hint_used'
  | 'ad_request'
  | 'ad_complete'
  | 'ad_error'
  | 'daily_started'
  | 'daily_completed'
  | 'streak_milestone'
  | 'star_earned'
  | 'pack_cleared'
  | 'skin_unlocked'
  | 'skin_equipped';

interface AnalyticsEvent {
  name: EventName;
  ts: number;
  meta?: Record<string, unknown>;
}

interface PokiSDKShape {
  customEvent?: (noun: string, verb: string, value?: string, payload?: object) => void;
}
interface CGAnalyticsShape {
  trackEvent?: (event: string, props?: object) => void;
}
interface GDSDKShape {
  preloadAd?: (...args: unknown[]) => void;
  showAd?: (...args: unknown[]) => void;
}
interface PlaygamaBridgeShape {
  platform?: {
    sendMessage?: (msg: string, params?: object) => unknown;
  };
}

const PLAYGAMA_MESSAGE_MAP: Partial<Record<EventName, string>> = {
  level_started: 'level_started',
  level_completed: 'level_completed',
  level_failed: 'level_failed',
  pack_cleared: 'player_got_achievement',
};

class AnalyticsManagerImpl {
  private buffer: AnalyticsEvent[] = [];
  private target: string;

  constructor() {
    this.target = typeof __BUILD_TARGET__ !== 'undefined' ? __BUILD_TARGET__ : 'unknown';
  }

  track(name: EventName, meta?: Record<string, unknown>): void {
    this.log(name, meta);
  }

  log(name: EventName, meta?: Record<string, unknown>): void {
    const e: AnalyticsEvent = { name, ts: Date.now(), meta };
    this.buffer.push(e);
    if (this.buffer.length > 200) this.buffer.shift();

    try {
      this.routeToPlatform(name, meta);
    } catch {
      /* noop */
    }
    console.debug('[analytics]', name, meta || '');
  }

  private routeToPlatform(name: EventName, meta?: Record<string, unknown>): void {
    const w = window as unknown as {
      PokiSDK?: PokiSDKShape;
      CrazyGames?: { SDK?: { analytics?: CGAnalyticsShape } };
      gdsdk?: GDSDKShape;
      bridge?: PlaygamaBridgeShape;
    };

    if (this.target === 'poki' && w.PokiSDK?.customEvent) {
      const sep = name.indexOf('_');
      const noun = sep >= 0 ? name.slice(0, sep) : name;
      const verb = sep >= 0 ? name.slice(sep + 1) : 'event';
      w.PokiSDK.customEvent(noun, verb, '', meta || {});
      return;
    }
    if (this.target === 'crazygames' && w.CrazyGames?.SDK?.analytics?.trackEvent) {
      w.CrazyGames.SDK.analytics.trackEvent(name, meta || {});
      return;
    }
    if (this.target === 'playgama' && w.bridge?.platform?.sendMessage) {
      const msg = PLAYGAMA_MESSAGE_MAP[name];
      if (msg) w.bridge.platform.sendMessage(msg, meta || {});
      return;
    }
    if (this.target === 'discord') {
      // Phase 1: console-only. Phase 2 may forward to Discord activity update API.
      return;
    }
    // itch / gamedistribution / dev: console-only
  }

  recent(): AnalyticsEvent[] {
    return [...this.buffer];
  }
}

export const Analytics = new AnalyticsManagerImpl();
