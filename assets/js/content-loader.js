loadManagedArticleMedia().catch(() => {
  // Static article remains fully usable and indexable if managed media fails.
});

async function loadManagedArticleMedia() {
  const { db } = await import("/assets/js/firebase-client.js");
  const { collection, getDocs, query, where } = await import(
    "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js"
  );

  const slug = location.pathname
    .replace(/^\/blog\//, "")
    .replace(/\/$/, "");

  if (!slug) return;

  const snapshot = await getDocs(
    query(
      collection(db, "mediaEmbeds"),
      where("articleSlug", "==", slug),
      where("active", "==", true),
      where("public", "==", true),
    ),
  );

  if (snapshot.empty) return;

  const media = snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0))[0];

  const article = document.querySelector("article.article");
  if (!article || !media?.embedUrl || !["youtube", "tiktok"].includes(media.provider)) {
    return;
  }

  const section = document.createElement("section");
  section.className = "article-media";
  section.setAttribute("aria-label", "Video relacionado");

  const title = document.createElement("h2");
  title.textContent = media.title || "Video de Shinext";

  const preview = document.createElement("button");
  preview.type = "button";
  preview.className = "article-video-preview";
  preview.textContent = media.provider === "youtube"
    ? "Ver video de YouTube"
    : "Ver video de TikTok";

  preview.addEventListener("click", () => {
    const iframe = document.createElement("iframe");
    iframe.src = media.embedUrl;
    iframe.title = media.title || "Video de Shinext";
    iframe.loading = "lazy";
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    preview.replaceWith(iframe);
  }, { once: true });

  section.append(title, preview);

  if (media.provider === "youtube" && media.thumbnailUrl && media.publishedAt) {
    const published =
      typeof media.publishedAt.toDate === "function"
        ? media.publishedAt.toDate()
        : new Date(media.publishedAt);
    if (!Number.isNaN(published.getTime())) {
      const structured = document.createElement("script");
      structured.type = "application/ld+json";
      structured.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: media.title || "Video de Shinext",
        description: media.description || "Video relacionado de Shinext.",
        thumbnailUrl: [media.thumbnailUrl],
        uploadDate: published.toISOString(),
        embedUrl: media.embedUrl,
        contentUrl: media.canonicalUrl || undefined,
      });
      document.head.append(structured);
    }
  }

  const lead = article.querySelector(".article-lead");
  if (lead?.parentNode) lead.insertAdjacentElement("afterend", section);
  else article.append(section);
}
