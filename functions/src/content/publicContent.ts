export function isPublishedBlogPost(record: Record<string, unknown>): boolean {
  return record.status === "published" && record.public === true;
}

export function isActiveBanner(
  record: Record<string, unknown>,
  now = new Date(),
): boolean {
  if (record.active !== true || record.public !== true) return false;

  const start = record.startAt instanceof Date ? record.startAt : null;
  const end = record.endAt instanceof Date ? record.endAt : null;

  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}
