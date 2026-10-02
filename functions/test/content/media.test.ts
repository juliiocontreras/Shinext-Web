import assert from "node:assert/strict";
import test from "node:test";

import { HttpsError } from "firebase-functions/v2/https";

import { normalizeMediaUrl } from "../../src/content/media.js";
import {
  isActiveBanner,
  isPublishedBlogPost,
} from "../../src/content/publicContent.js";

test("normalizes supported YouTube links", () => {
  const watch = normalizeMediaUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(watch.provider, "youtube");
  assert.equal(watch.id, "dQw4w9WgXcQ");
  assert.match(watch.embedUrl, /youtube-nocookie\.com\/embed/);

  const short = normalizeMediaUrl("https://youtu.be/dQw4w9WgXcQ");
  assert.equal(short.id, "dQw4w9WgXcQ");
});

test("normalizes supported TikTok links", () => {
  const media = normalizeMediaUrl(
    "https://www.tiktok.com/@shinext/video/7412345678901234567",
  );
  assert.equal(media.provider, "tiktok");
  assert.equal(media.id, "7412345678901234567");
});

test("rejects arbitrary HTML javascript URLs and unsupported hosts", () => {
  for (const value of [
    '<iframe src="https://example.com"></iframe>',
    "javascript:alert(1)",
    "https://example.com/video/123",
  ]) {
    assert.throws(
      () => normalizeMediaUrl(value),
      (error: unknown) =>
        error instanceof HttpsError && error.code === "invalid-argument",
    );
  }
});

test("public content helpers require explicit publication flags", () => {
  assert.equal(
    isPublishedBlogPost({ status: "published", public: true }),
    true,
  );
  assert.equal(
    isPublishedBlogPost({ status: "draft", public: true }),
    false,
  );
  assert.equal(isActiveBanner({ active: true, public: true }), true);
  assert.equal(isActiveBanner({ active: false, public: true }), false);
});
