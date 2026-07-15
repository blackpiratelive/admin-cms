import { BaseSyncProvider } from "../../base-provider";
import { ConfigField, ConfigValidationResult, SyncOptions, SyncResult } from "../../types";

export interface MastodonConfig {
  instanceUrl: string;
  accessToken: string;
}

export class MastodonSyncProvider extends BaseSyncProvider {
  id = "mastodon";
  name = "Mastodon";
  slug = "mastodon";
  icon = "🐘";
  description = "Cross-post microblogs automatically to Mastodon fediverse instances";

  getConfigFields(): ConfigField[] {
    return [
      {
        name: "instanceUrl",
        label: "Instance URL",
        type: "text",
        placeholder: "https://mastodon.social",
        required: true,
        description: "The full URL of your Mastodon home instance.",
      },
      {
        name: "accessToken",
        label: "Access Token",
        type: "password",
        placeholder: "Paste your OAuth Access Token",
        required: true,
        description: "Generate an Access Token in Mastodon Account Settings -> Preferences -> Development -> New Application.",
      },
    ];
  }

  async validateConfiguration(config: Record<string, any>): Promise<ConfigValidationResult> {
    if (!config.instanceUrl || typeof config.instanceUrl !== "string" || !config.instanceUrl.trim()) {
      return { valid: false, error: "Mastodon Instance URL is required." };
    }
    if (!config.accessToken || typeof config.accessToken !== "string" || !config.accessToken.trim()) {
      return { valid: false, error: "Mastodon Access Token is required." };
    }
    return { valid: true };
  }

  private normalizeInstanceUrl(instanceUrl: string): string {
    let url = instanceUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    return url.replace(/\/+$/, "");
  }

  private async fetchAccountInfo(config: MastodonConfig) {
    const baseUrl = this.normalizeInstanceUrl(config.instanceUrl);
    const res = await fetch(`${baseUrl}/api/v1/accounts/verify_credentials`, {
      headers: {
        Authorization: `Bearer ${config.accessToken.trim()}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Mastodon verification failed (${res.status}): ${errText || res.statusText}`);
    }

    const account = await res.json();
    return { account, baseUrl };
  }

  async testConnection(config: Record<string, any>): Promise<boolean> {
    const validation = await this.validateConfiguration(config);
    if (!validation.valid) return false;

    try {
      const { account } = await this.fetchAccountInfo(config as MastodonConfig);
      return !!account.id;
    } catch {
      return false;
    }
  }

  async getStatistics(): Promise<Record<string, number | string>> {
    const config = await this.getConfig();
    if (!config.instanceUrl || !config.accessToken) {
      return {};
    }

    try {
      const { account, baseUrl } = await this.fetchAccountInfo(config as MastodonConfig);
      const host = new URL(baseUrl).hostname;
      return {
        Username: `@${account.username}@${host}`,
        Followers: account.followers_count ?? 0,
        Statuses: account.statuses_count ?? 0,
      };
    } catch {
      return { Instance: config.instanceUrl || "Not Connected" };
    }
  }

  protected async executeSync(config: Record<string, any>, options?: SyncOptions): Promise<SyncResult> {
    this.checkCancelled();
    const { account, baseUrl } = await this.fetchAccountInfo(config as MastodonConfig);
    const host = new URL(baseUrl).hostname;
    options?.onProgress?.(`Verified account @${account.username}@${host}`);

    return {
      success: true,
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsDeleted: 0,
      metadata: { username: account.username, instance: host },
    };
  }

  /**
   * Cross-post a microblog to Mastodon with text and attached images.
   */
  async postMicroblog(contentMarkdown: string, imageUrls: string[] = []): Promise<{ success: boolean; url?: string; id?: string; error?: string }> {
    const config = await this.getConfig();
    const validation = await this.validateConfiguration(config);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const { baseUrl } = await this.fetchAccountInfo(config as MastodonConfig);

      // Clean markdown tags for plain text status
      let statusText = contentMarkdown
        .replace(/!\[.*?\]\(.*?\)/g, "") // Remove image markdown
        .replace(/\[(.*?)\]\(.*?\)/g, "$1") // Simplify links
        .replace(/#+\s+/g, "") // Strip headers
        .trim();

      // Mastodon standard limit is 500 characters
      if (statusText.length > 500) {
        statusText = statusText.slice(0, 497) + "...";
      }

      // Upload attached images to Mastodon media endpoint
      const mediaIds: string[] = [];
      for (const imgUrl of imageUrls.slice(0, 4)) { // Mastodon allows max 4 media attachments per status
        try {
          const imgRes = await fetch(imgUrl);
          if (!imgRes.ok) continue;

          const contentType = imgRes.headers.get("content-type") || "image/jpeg";
          const imageBuffer = await imgRes.arrayBuffer();

          const fileName = imgUrl.split("/").pop() || "upload.jpg";
          const blob = new Blob([imageBuffer], { type: contentType });
          const formData = new FormData();
          formData.append("file", blob, fileName);

          let mediaRes = await fetch(`${baseUrl}/api/v2/media`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.accessToken.trim()}`,
            },
            body: formData,
          });

          // Fallback to v1 media endpoint if v2 is unsupported
          if (!mediaRes.ok && mediaRes.status === 404) {
            mediaRes = await fetch(`${baseUrl}/api/v1/media`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${config.accessToken.trim()}`,
              },
              body: formData,
            });
          }

          if (mediaRes.ok) {
            const mediaData = await mediaRes.json();
            if (mediaData.id) {
              mediaIds.push(mediaData.id);
            }
          }
        } catch (imgErr) {
          console.error("Mastodon media upload failed for", imgUrl, imgErr);
        }
      }

      const postRes = await fetch(`${baseUrl}/api/v1/statuses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: statusText,
          media_ids: mediaIds.length > 0 ? mediaIds : undefined,
        }),
      });

      if (!postRes.ok) {
        const errText = await postRes.text().catch(() => "");
        throw new Error(`Mastodon status creation failed (${postRes.status}): ${errText || postRes.statusText}`);
      }

      const postData = await postRes.json();
      return {
        success: true,
        url: postData.url,
        id: postData.id,
      };
    } catch (err: any) {
      console.error("Mastodon cross-post error:", err);
      return {
        success: false,
        error: err.message || String(err),
      };
    }
  }
}
