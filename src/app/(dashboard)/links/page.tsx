import { getShortLinks, getPastes, getDomains, checkRapidLinkApiStatus } from "@/features/links/actions";
import { LinksDashboard } from "@/features/links/LinksDashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Links & URL Shortener | Personal CMS",
  description: "Manage short URLs, markdown pastes, and custom domains via RapidLink API.",
};

export default async function LinksPage() {
  const [links, pastes, domains, apiStatus] = await Promise.all([
    getShortLinks(),
    getPastes(),
    getDomains(),
    checkRapidLinkApiStatus(),
  ]);

  return (
    <LinksDashboard
      initialLinks={links}
      initialPastes={pastes}
      initialDomains={domains}
      apiStatus={apiStatus}
    />
  );
}

