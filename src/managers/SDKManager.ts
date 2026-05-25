import { AudioManager } from './AudioManager';

type Platform = 'poki' | 'crazygames' | 'gamedistribution' | 'playgama' | 'discord' | 'none';
type RewardedSize = 'small' | 'medium' | 'large';

type PlaygamaMessage =
  | 'game_ready'
  | 'in_game_loading_started'
  | 'in_game_loading_stopped'
  | 'level_started'
  | 'level_completed'
  | 'level_failed'
  | 'level_paused'
  | 'level_resumed'
  | 'player_got_achievement';

type PlaygamaAdState = 'loading' | 'opened' | 'closed' | 'rewarded' | 'failed';

interface PlaygamaBridge {
  initialize?: () => Promise<void>;
  EVENT_NAME?: {
    INTERSTITIAL_STATE_CHANGED?: string;
    REWARDED_STATE_CHANGED?: string;
    PAUSE_STATE_CHANGED?: string;
    AUDIO_STATE_CHANGED?: string;
  };
  platform?: {
    id?: string;
    language?: string;
    isPaused?: boolean;
    isAudioEnabled?: boolean;
    sendMessage?: (msg: PlaygamaMessage, params?: object) => Promise<void> | void;
    on?: (event: string, cb: (...args: unknown[]) => void) => void;
    off?: (event: string, cb: (...args: unknown[]) => void) => void;
  };
  advertisement?: {
    isInterstitialSupported?: boolean;
    isRewardedSupported?: boolean;
    showInterstitial?: (placement?: string) => void;
    showRewarded?: (placement?: string) => void;
    on?: (event: string, cb: (state: PlaygamaAdState) => void) => void;
    off?: (event: string, cb: (state: PlaygamaAdState) => void) => void;
  };
  storage?: {
    get?: (key: string | string[]) => Promise<unknown>;
    set?: (key: string | string[], value: unknown) => Promise<void> | void;
    delete?: (key: string | string[]) => Promise<void> | void;
  };
}

interface PokiAPI {
  init?: () => Promise<void>;
  gameLoadingFinished?: () => void;
  gameplayStart?: () => void;
  gameplayStop?: () => void;
  commercialBreak?: (onStart?: () => void) => Promise<void>;
  rewardedBreak?: (opts?: { size?: RewardedSize; onStart?: () => void }) => Promise<boolean>;
  customEvent?: (noun: string, verb: string, value?: string, payload?: object) => void;
}

interface CrazyAPI {
  SDK?: {
    init?: () => Promise<void>;
    environment?: 'local' | 'staging' | 'crazygames';
    game?: {
      gameplayStart?: () => void;
      gameplayStop?: () => void;
      loadingStart?: () => void;
      loadingStop?: () => void;
      happytime?: () => void;
    };
    ad?: {
      requestAd?: (type: 'midgame' | 'rewarded') => Promise<void>;
    };
  };
}

interface GDSDK {
  showAd?: (type?: string) => Promise<void>;
  preloadAd?: (type?: string) => Promise<void>;
}

declare const __BUILD_TARGET__: string;

declare global {
  interface Window {
    PokiSDK?: PokiAPI;
    CrazyGames?: CrazyAPI;
    gdsdk?: GDSDK;
    GD_OPTIONS?: { gameId?: string };
    bridge?: PlaygamaBridge;
  }
}

const AD_TIMEOUT_MS = 15000;

class SDKManagerImpl {
  private platform: Platform = 'none';
  private ready = false;
  private adInFlight = false;

  detect(): Platform {
    if (typeof __BUILD_TARGET__ !== 'undefined') {
      if (__BUILD_TARGET__ === 'itch') return 'none';
      if (__BUILD_TARGET__ === 'poki') return 'poki';
      if (__BUILD_TARGET__ === 'crazygames') return 'crazygames';
      if (__BUILD_TARGET__ === 'gamedistribution') return 'gamedistribution';
      if (__BUILD_TARGET__ === 'playgama') return 'playgama';
      if (__BUILD_TARGET__ === 'discord') return 'discord';
    }
    const host = window.location.hostname;
    if (host.includes('poki') || window.PokiSDK) return 'poki';
    if (host.includes('crazygames') || window.CrazyGames) return 'crazygames';
    if (host.includes('gamedistribution') || window.gdsdk) return 'gamedistribution';
    if (host.includes('playgama') || window.bridge) return 'playgama';
    if (host.includes('discordsays.com')) return 'discord';
    return 'none';
  }

  getPlatform(): Platform {
    return this.platform;
  }

  hasRewardedAds(): boolean {
    return (
      this.platform === 'poki' ||
      this.platform === 'crazygames' ||
      this.platform === 'gamedistribution' ||
      this.platform === 'playgama'
    );
  }

  hasCloudStorage(): boolean {
    return this.platform === 'playgama' && !!window.bridge?.storage?.get;
  }

  async cloudLoad(key: string): Promise<unknown> {
    if (!this.hasCloudStorage()) return null;
    try {
      const storage = window.bridge?.storage;
      if (!storage?.get) return null;
      const raw = await storage.get(key);
      if (raw == null) return null;
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      }
      return raw;
    } catch (e) {
      console.warn('[cloud] load failed', e);
      return null;
    }
  }

  cloudSave(key: string, value: unknown): void {
    if (!this.hasCloudStorage()) return;
    const storage = window.bridge?.storage;
    if (!storage?.set) return;
    try {
      const payload = typeof value === 'string' ? value : JSON.stringify(value);
      const result = storage.set(key, payload);
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch((e) => console.warn('[cloud] save rejected', e));
      }
    } catch (e) {
      console.warn('[cloud] save threw', e);
    }
  }

  onPauseChanged(cb: (paused: boolean) => void): void {
    if (this.platform !== 'playgama') return;
    const platform = window.bridge?.platform;
    const evt = window.bridge?.EVENT_NAME?.PAUSE_STATE_CHANGED;
    if (!platform?.on || !evt) return;
    platform.on(evt, () => cb(!!platform.isPaused));
  }

  onAudioChanged(cb: (enabled: boolean) => void): void {
    if (this.platform !== 'playgama') return;
    const platform = window.bridge?.platform;
    const evt = window.bridge?.EVENT_NAME?.AUDIO_STATE_CHANGED;
    if (!platform?.on || !evt) return;
    platform.on(evt, () => cb(platform.isAudioEnabled !== false));
  }

  async init(): Promise<void> {
    this.platform = this.detect();
    try {
      if (this.platform === 'poki' && window.PokiSDK?.init) {
        await window.PokiSDK.init();
      } else if (this.platform === 'crazygames' && window.CrazyGames?.SDK?.init) {
        await window.CrazyGames.SDK.init();
        window.CrazyGames.SDK.game?.loadingStart?.();
      } else if (this.platform === 'gamedistribution') {
        // SDK auto-inits via GD_OPTIONS in HTML; nothing to await
        await this.waitFor(() => !!window.gdsdk, 2000);
      } else if (this.platform === 'playgama') {
        await this.waitFor(() => !!window.bridge?.initialize, 3000);
        if (window.bridge?.initialize) {
          await window.bridge.initialize();
          window.bridge.platform?.sendMessage?.('in_game_loading_started');
        }
      } else if (this.platform === 'discord') {
        const { ready } = await import(
          /* webpackChunkName: "discord-client" */ '../platform/discord/DiscordClient'
        );
        await ready();
      }
      this.ready = true;
      console.info('[SDK]', this.platform, 'ready');
    } catch (e) {
      console.warn('[SDK] init failed', e);
    }
  }

  loadingFinished(): void {
    if (!this.ready) return;
    window.PokiSDK?.gameLoadingFinished?.();
    window.CrazyGames?.SDK?.game?.loadingStop?.();
    if (this.platform === 'playgama') {
      window.bridge?.platform?.sendMessage?.('in_game_loading_stopped');
      window.bridge?.platform?.sendMessage?.('game_ready');
    }
  }

  gameplayStart(): void {
    window.PokiSDK?.gameplayStart?.();
    window.CrazyGames?.SDK?.game?.gameplayStart?.();
    if (this.platform === 'playgama') {
      window.bridge?.platform?.sendMessage?.('level_started');
    }
  }

  gameplayStop(): void {
    window.PokiSDK?.gameplayStop?.();
    window.CrazyGames?.SDK?.game?.gameplayStop?.();
    if (this.platform === 'playgama') {
      window.bridge?.platform?.sendMessage?.('level_paused');
    }
  }

  happytime(): void {
    window.CrazyGames?.SDK?.game?.happytime?.();
  }

  isAdInFlight(): boolean {
    return this.adInFlight;
  }

  private withTimeout<T>(p: Promise<T>, fallback: T, ms = AD_TIMEOUT_MS): Promise<T> {
    return Promise.race([
      p,
      new Promise<T>((resolve) =>
        setTimeout(() => {
          console.warn('[ad] timeout after', ms, 'ms');
          resolve(fallback);
        }, ms)
      ),
    ]);
  }

  // Poki spec: call BEFORE gameplayStart() at natural breaks (level start).
  // Wraps platform call. Stops gameplay during ad, resumes after.
  async commercialBreak(placement = 'pre_level'): Promise<void> {
    if (this.adInFlight) return;
    this.adInFlight = true;
    AudioManager.duckForAd(true);
    try {
      if (this.platform === 'poki' && window.PokiSDK?.commercialBreak) {
        this.gameplayStop();
        await this.withTimeout(window.PokiSDK.commercialBreak(), undefined);
      } else if (this.platform === 'crazygames' && window.CrazyGames?.SDK?.ad?.requestAd) {
        this.gameplayStop();
        await this.withTimeout(window.CrazyGames.SDK.ad.requestAd('midgame'), undefined);
      } else if (this.platform === 'gamedistribution' && window.gdsdk?.showAd) {
        this.gameplayStop();
        await this.withTimeout(window.gdsdk.showAd(), undefined);
      } else if (this.platform === 'playgama' && window.bridge?.advertisement?.showInterstitial) {
        this.gameplayStop();
        await this.withTimeout(this.playgamaInterstitial(placement), undefined);
      }
    } catch (e) {
      console.warn('[ad] commercialBreak failed', e);
    } finally {
      this.adInFlight = false;
      AudioManager.duckForAd(false);
    }
  }

  async rewarded(size: RewardedSize = 'medium', placement = 'rewarded'): Promise<boolean> {
    if (this.adInFlight) return false;
    this.adInFlight = true;
    AudioManager.duckForAd(true);
    this.gameplayStop();
    try {
      if (this.platform === 'poki' && window.PokiSDK?.rewardedBreak) {
        const result = await this.withTimeout(
          window.PokiSDK.rewardedBreak({ size }),
          false
        );
        return result !== false;
      }
      if (this.platform === 'crazygames' && window.CrazyGames?.SDK?.ad?.requestAd) {
        await this.withTimeout(window.CrazyGames.SDK.ad.requestAd('rewarded'), undefined);
        return true;
      }
      if (this.platform === 'gamedistribution' && window.gdsdk?.showAd) {
        await this.withTimeout(window.gdsdk.showAd('rewarded'), undefined);
        return true;
      }
      if (this.platform === 'playgama') {
        if (!window.bridge?.advertisement?.showRewarded) return false;
        return await this.withTimeout(this.playgamaRewarded(placement), false);
      }
      return await this.dummyRewarded();
    } catch (e) {
      console.warn('[ad] rewarded failed', e);
      return false;
    } finally {
      this.adInFlight = false;
      AudioManager.duckForAd(false);
      this.gameplayStart();
    }
  }

  customEvent(name: string, meta?: object): void {
    try {
      const sep = name.indexOf('_');
      const noun = sep >= 0 ? name.slice(0, sep) : name;
      const verb = sep >= 0 ? name.slice(sep + 1) : 'event';
      window.PokiSDK?.customEvent?.(noun, verb, '', meta || {});
    } catch {
      /* noop */
    }
  }

  private dummyRewarded(): Promise<boolean> {
    return new Promise((resolve) => setTimeout(() => resolve(true), 700));
  }

  private playgamaInterstitial(placement = 'pre_level'): Promise<void> {
    const ad = window.bridge?.advertisement;
    const evt = window.bridge?.EVENT_NAME?.INTERSTITIAL_STATE_CHANGED;
    if (!ad?.showInterstitial) return Promise.resolve();
    if (!ad.on || !evt) {
      ad.showInterstitial(placement);
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      let settled = false;
      const onState = (state: PlaygamaAdState): void => {
        console.info('[playgama] interstitial state:', state);
        if (state !== 'closed' && state !== 'failed') return;
        if (settled) return;
        settled = true;
        ad.off?.(evt, onState);
        resolve();
      };
      ad.on!(evt, onState);
      ad.showInterstitial!(placement);
    });
  }

  private playgamaRewarded(placement = 'rewarded'): Promise<boolean> {
    const ad = window.bridge?.advertisement;
    const evt = window.bridge?.EVENT_NAME?.REWARDED_STATE_CHANGED;
    if (!ad?.showRewarded) return Promise.resolve(false);
    if (!ad.on || !evt) {
      ad.showRewarded(placement);
      return Promise.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finalize = (result: boolean): void => {
        if (settled) return;
        settled = true;
        ad.off?.(evt, onState);
        resolve(result);
      };
      const onState = (state: PlaygamaAdState): void => {
        console.info('[playgama] rewarded state:', state);
        // Playgama spec: grant ONLY in response to the 'rewarded' state.
        // 'closed' arriving without a prior 'rewarded' means the user
        // dismissed the ad before completion — no grant.
        if (state === 'rewarded') {
          finalize(true);
          return;
        }
        if (state === 'closed') {
          finalize(false);
          return;
        }
        if (state === 'failed') finalize(false);
      };
      ad.on!(evt, onState);
      ad.showRewarded!(placement);
    });
  }

  private waitFor(cond: () => boolean, ms: number): Promise<void> {
    const start = Date.now();
    return new Promise((resolve) => {
      const tick = () => {
        if (cond() || Date.now() - start >= ms) resolve();
        else setTimeout(tick, 100);
      };
      tick();
    });
  }
}

export const SDKManager = new SDKManagerImpl();
