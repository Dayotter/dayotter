export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "team"
  );
}

/** Find a value not already taken, appending a short random suffix if needed. */
export async function uniqueSlug(
  base: string,
  exists: (v: string) => Promise<boolean>,
): Promise<string> {
  if (!(await exists(base))) return base;
  for (let i = 0; i < 20; i++) {
    const candidate = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${base}-${Date.now()}`;
}
