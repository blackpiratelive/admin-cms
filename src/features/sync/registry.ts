import { ISyncProvider } from "./types";
import { TraktSyncProvider } from "./providers/trakt";
import { LastfmSyncProvider } from "./providers/lastfm";
import { BlueskySyncProvider } from "./providers/bluesky";
import { MastodonSyncProvider } from "./providers/mastodon";

class SyncProviderRegistry {
  private providersMap: Map<string, ISyncProvider> = new Map();

  constructor() {
    // Register initial providers
    this.registerProvider(new TraktSyncProvider());
    this.registerProvider(new LastfmSyncProvider());
    this.registerProvider(new BlueskySyncProvider());
    this.registerProvider(new MastodonSyncProvider());
  }

  registerProvider(provider: ISyncProvider) {
    this.providersMap.set(provider.slug, provider);
  }

  getProvider(slug: string): ISyncProvider | undefined {
    return this.providersMap.get(slug);
  }

  getAllProviders(): ISyncProvider[] {
    return Array.from(this.providersMap.values());
  }
}

// Global singleton instance
export const syncRegistry = new SyncProviderRegistry();
