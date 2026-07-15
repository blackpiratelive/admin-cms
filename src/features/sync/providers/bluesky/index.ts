import { BaseSyncProvider } from "../../base-provider";
import { ConfigField, ConfigValidationResult, SyncOptions, SyncResult } from "../../types";

export interface BlueskyConfig {
  identifier: string;
  appPassword: string;
  serviceUrl?: string;
}

export class BlueskySyncProvider extends BaseSyncProvider {
  id = "bluesky";
  name = "Bluesky";
  slug = "bluesky";
  icon = "🦋";
  description = "Cross-post microblogs automatically to Bluesky via AT Protocol";

  getConfigFields(): ConfigField[] {
    return [
      {
        name: "identifier",
        label: "Handle or Email",
        type: "text",
        placeholder: "username.bsky.social",
        required: true,
        description: "Your Bluesky handle or account email address.",
      },
      {
        name: "appPassword",
        label: "App Password",
        type: "password",
        placeholder: "xxxx-xxxx-xxxx-xxxx",
        required: true,
        description: "Generate an App Password in Bluesky Settings -> Advanced -> App Passwords.",
      },
      {
        name: "serviceUrl",
        label: "Service URL",
        type: "text",
        placeholder: "https://bsky.social",
        required: false,
        description: "Defaults to https://bsky.social if left blank.",
      },
    ];
  }

  async validateConfiguration(config: Record<string, any>): Promise<ConfigValidationResult> {
    if (!config.identifier || typeof config.identifier !== "string" || !config.identifier.trim()) {
      return { valid: false, error: "Bluesky Handle or Email is required." };
    }
    if (!config.appPassword || typeof config.appPassword !== "string" || !config.appPassword.trim()) {
      return { valid: false, error: "Bluesky App Password is required." };
    }
    return { valid: true };
  }

  private normalizeServiceUrl(serviceUrl?: string): string {
    if (!serviceUrl || !serviceUrl.trim()) return "https://bsky.social";
    let url = serviceUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    return url.replace(/\/+$/, "");
  }

  private async createSession(config: BlueskyConfig) {
    const serviceUrl = this.normalizeServiceUrl(config.serviceUrl);
    const res = await fetch(`${serviceUrl}/xrpc/com.atproto.server.createSession`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: config.identifier.trim(),
        password: config.appPassword.trim(),
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Bluesky authentication failed (${res.status}): ${errText || res.statusText}`);
    }

    const session = await res.json();
    return {
      accessJwt: session.accessJwt as string,
      did: session.did as string,
      handle: session.handle as string,
      serviceUrl,
    };
  }

  async testConnection(config: Record<string, any>): Promise<boolean> {
    const validation = await this.validateConfiguration(config);
    if (!validation.valid) return false;

    try {
      const session = await this.createSession(config as BlueskyConfig);
      return !!session.accessJwt;
    } catch {
      return false;
    }
  }

  async getStatistics(): Promise<Record<string, number | string>> {
    const config = await this.getConfig();
    if (!config.identifier || !config.appPassword) {
      return {};
    }

    try {
      const session = await this.createSession(config as BlueskyConfig);
      const res = await fetch(`${session.serviceUrl}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(session.did)}`, {
        headers: { Authorization: `Bearer ${session.accessJwt}` },
      });

      if (!res.ok) {
        return { Handle: `@${session.handle || config.identifier}` };
      }

      const profile = await res.json();
      return {
        Handle: `@${profile.handle || session.handle}`,
        Followers: profile.followersCount ?? 0,
        Posts: profile.postsCount ?? 0,
      };
    } catch {
      return { Handle: config.identifier ? `@${config.identifier}` : "Not Connected" };
    }
  }

  protected async executeSync(config: Record<string, any>, options?: SyncOptions): Promise<SyncResult> {
    this.checkCancelled();
    const session = await this.createSession(config as BlueskyConfig);
    options?.onProgress?.(`Authenticated as @${session.handle}`);

    return {
      success: true,
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsDeleted: 0,
      metadata: { handle: session.handle, did: session.did },
    };
  }

  /**
   * Cross-post a microblog to Bluesky with text and attached images.
   */
  async postMicroblog(contentMarkdown: string, imageUrls: string[] = []): Promise<{ success: boolean; uri?: string; cid?: string; error?: string }> {
    const config = await this.getConfig();
    const validation = await this.validateConfiguration(config);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const session = await this.createSession(config as BlueskyConfig);

      // Clean markdown tags for plain text post
      let postText = contentMarkdown
        .replace(/!\[.*?\]\(.*?\)/g, "") // Remove image markdown
        .replace(/\[(.*?)\]\(.*?\)/g, "$1") // Simplify links
        .replace(/#+\s+/g, "") // Strip headers
        .trim();

      // Bluesky max limit is 300 graphemes
      if (postText.length > 300) {
        postText = postText.slice(0, 297) + "...";
      }

      // Upload attached images as AT Protocol blobs
      const uploadedBlobs: any[] = [];
      for (const imgUrl of imageUrls.slice(0, 4)) { // Bluesky allows max 4 images
        try {
          const imgRes = await fetch(imgUrl);
          if (!imgRes.ok) continue;

          const contentType = imgRes.headers.get("content-type") || "image/jpeg";
          const imageBuffer = await imgRes.arrayBuffer();

          const blobRes = await fetch(`${session.serviceUrl}/xrpc/com.atproto.repo.uploadBlob`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.accessJwt}`,
              "Content-Type": contentType,
            },
            body: Buffer.from(imageBuffer),
          });

          if (blobRes.ok) {
            const blobData = await blobRes.json();
            if (blobData.blob) {
              uploadedBlobs.push(blobData.blob);
            }
          }
        } catch (imgErr) {
          console.error("Bluesky image upload failed for", imgUrl, imgErr);
        }
      }

      const embed = uploadedBlobs.length > 0
        ? {
            $type: "app.bsky.embed.images",
            images: uploadedBlobs.map((blob) => ({
              image: blob,
              alt: "",
            })),
          }
        : undefined;

      const recordBody: Record<string, any> = {
        repo: session.did,
        collection: "app.bsky.feed.post",
        record: {
          $type: "app.bsky.feed.post",
          text: postText,
          createdAt: new Date().toISOString(),
          ...(embed ? { embed } : {}),
        },
      };

      const postRes = await fetch(`${session.serviceUrl}/xrpc/com.atproto.repo.createRecord`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessJwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(recordBody),
      });

      if (!postRes.ok) {
        const errText = await postRes.text().catch(() => "");
        throw new Error(`Bluesky post creation failed (${postRes.status}): ${errText || postRes.statusText}`);
      }

      const postData = await postRes.json();
      return {
        success: true,
        uri: postData.uri,
        cid: postData.cid,
      };
    } catch (err: any) {
      console.error("Bluesky cross-post error:", err);
      return {
        success: false,
        error: err.message || String(err),
      };
    }
  }
}
