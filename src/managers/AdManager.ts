import { SDKManager } from './SDKManager';
import { Analytics } from './AnalyticsManager';

export type AdPlacement = 'pre_level' | 'continue' | 'hint' | 'unlock_all';

class AdManagerImpl {
  private levelStartCounter = 0;
  private interstitialEvery = 2;

  async preLevelInterstitial(): Promise<void> {
    this.levelStartCounter++;
    if (this.levelStartCounter < this.interstitialEvery) return;
    this.levelStartCounter = 0;
    Analytics.log('ad_request', { placement: 'pre_level', type: 'interstitial' });
    await SDKManager.commercialBreak('pre_level');
    Analytics.log('ad_complete', { placement: 'pre_level', type: 'interstitial' });
  }

  async showRewarded(placement: AdPlacement): Promise<boolean> {
    Analytics.log('ad_request', { placement, type: 'rewarded' });
    const ok = await SDKManager.rewarded('medium', placement);
    Analytics.log(ok ? 'ad_complete' : 'ad_error', { placement, type: 'rewarded' });
    return ok;
  }
}

export const AdManager = new AdManagerImpl();
