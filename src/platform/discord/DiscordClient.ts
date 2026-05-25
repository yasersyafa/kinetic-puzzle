declare const process: { env: { VITE_DISCORD_CLIENT_ID?: string } };

// Discord Activity client wrapper.
// Phase 1: ready() handshake only — dismisses Discord splash so game iframe renders.
// Phase 2 (deferred): OAuth2 authorize → POST /api/token → authenticate → user-scoped storage.
//
// Isolation: all `@discord/embedded-app-sdk` imports live in this file. Other build
// targets must reach this code through a `__BUILD_TARGET__ === 'discord'` guard so
// DefinePlugin dead-code-elimination strips the dynamic import.

interface DiscordSDKShape {
  ready: () => Promise<void>;
  instanceId?: string;
}

let sdkInstance: DiscordSDKShape | null = null;
let initPromise: Promise<void> | null = null;

async function loadSDK(): Promise<DiscordSDKShape> {
  if (sdkInstance) return sdkInstance;
  // Package only required for the 'discord' build target. Other builds never reach this
  // path (guarded by __BUILD_TARGET__ === 'discord' in SDKManager); webpack IgnorePlugin
  // strips the module from non-discord bundles so this dynamic import is dead code there.
  const mod = (await import(/* webpackChunkName: "discord-sdk" */ '@discord/embedded-app-sdk')) as {
    DiscordSDK: new (clientId: string) => DiscordSDKShape;
  };
  const clientId = process.env.VITE_DISCORD_CLIENT_ID || '';
  if (!clientId) {
    throw new Error('[discord] VITE_DISCORD_CLIENT_ID missing at build time');
  }
  sdkInstance = new mod.DiscordSDK(clientId);
  return sdkInstance;
}

export function ready(): Promise<void> {
  if (!initPromise) {
    initPromise = loadSDK()
      .then((sdk) => sdk.ready())
      .then(() => {
        console.info('[discord] activity ready');
      })
      .catch((e) => {
        console.warn('[discord] init failed', e);
      });
  }
  return initPromise;
}

export function getInstanceId(): string | undefined {
  return sdkInstance?.instanceId;
}
