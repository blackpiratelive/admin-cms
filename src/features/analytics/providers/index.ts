import { AnalyticsProvider, SupportedModule } from "../types";
import { journalAnalyticsProvider } from "./journal";
import { microblogAnalyticsProvider } from "./microblog";
import { todoAnalyticsProvider } from "./todos";
import { galleryAnalyticsProvider } from "./gallery";
import { movieAnalyticsProvider } from "./movies";
import { tvAnalyticsProvider } from "./tv";
import { musicAnalyticsProvider } from "./music";
import { peopleAnalyticsProvider } from "./people";
import { locationAnalyticsProvider } from "./locations";
import { tripAnalyticsProvider } from "./trips";

const providerRegistry: Map<SupportedModule, AnalyticsProvider> = new Map([
  ["journal", journalAnalyticsProvider],
  ["microblog", microblogAnalyticsProvider],
  ["todos", todoAnalyticsProvider],
  ["gallery", galleryAnalyticsProvider],
  ["movies", movieAnalyticsProvider],
  ["tv", tvAnalyticsProvider],
  ["music", musicAnalyticsProvider],
  ["people", peopleAnalyticsProvider],
  ["locations", locationAnalyticsProvider],
  ["trips", tripAnalyticsProvider],
]);

export function registerAnalyticsProvider(provider: AnalyticsProvider) {
  providerRegistry.set(provider.name, provider);
}

export function getAnalyticsProvider(name: SupportedModule): AnalyticsProvider | undefined {
  return providerRegistry.get(name);
}

export function getAllAnalyticsProviders(): AnalyticsProvider[] {
  return Array.from(providerRegistry.values());
}
