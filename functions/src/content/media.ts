import { HttpsError } from "firebase-functions/v2/https";

export type MediaProvider = "youtube" | "tiktok";

export interface NormalizedMedia {
  provider: MediaProvider;
  id: string;
  canonicalUrl: string;
  embedUrl: string;
}

function cleanYouTubeId(value: string): string | null {
  return /^[A-Za-z0-9_-]{6,20}$/.test(value) ? value : null;
}

function cleanTikTokId(value: string): string | null {
  return /^\d{8,30}$/.test(value) ? value : null;
}

export function normalizeMediaUrl(value: unknown): NormalizedMedia {
  const raw = String(value || "").trim();
  if (!raw || raw.length > 500) {
    throw new HttpsError("invalid-argument", "El enlace de video no es válido.");
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpsError("invalid-argument", "El enlace de video no es válido.");
  }

  if (url.protocol !== "https:") {
    throw new HttpsError("invalid-argument", "El video debe usar HTTPS.");
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = cleanYouTubeId(url.pathname.split("/").filter(Boolean)[0] || "");
    if (!id) throw new HttpsError("invalid-argument", "Video de YouTube no válido.");
    return {
      provider: "youtube",
      id,
      canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    };
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    let candidate = "";
    if (url.pathname === "/watch") candidate = url.searchParams.get("v") || "";
    else {
      const parts = url.pathname.split("/").filter(Boolean);
      if (["shorts", "embed", "live"].includes(parts[0])) candidate = parts[1] || "";
    }
    const id = cleanYouTubeId(candidate);
    if (!id) throw new HttpsError("invalid-argument", "Video de YouTube no válido.");
    return {
      provider: "youtube",
      id,
      canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    };
  }

  if (host === "tiktok.com" || host === "m.tiktok.com") {
    const match = url.pathname.match(/\/video\/(\d{8,30})(?:\/|$)/);
    const id = cleanTikTokId(match?.[1] || "");
    if (!id) throw new HttpsError("invalid-argument", "Video de TikTok no válido.");
    return {
      provider: "tiktok",
      id,
      canonicalUrl: `https://www.tiktok.com/player/v1/${id}`,
      embedUrl: `https://www.tiktok.com/player/v1/${id}`,
    };
  }

  throw new HttpsError(
    "invalid-argument",
    "Solo se admiten enlaces oficiales de YouTube o TikTok.",
  );
}
