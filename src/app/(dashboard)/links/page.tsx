import { getShortLinks, getPastes, getDomains } from "@/features/links/actions";
import { LinksDashboard } from "@/features/links/LinksDashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Links & URL Shortener | Personal CMS",
  description: "Manage short URLs, markdown pastes, and custom domains.",
};

export default async function LinksPage() {
  const [links, pastes, domains] = await Promise.all([
    getShortLinks(),
    getPastes(),
    getDomains(),
  ]);

  return (
    <LinksDashboard
      initialLinks={links}
      initialPastes={pastes}
      initialDomains={domains}
    />
  );
}
