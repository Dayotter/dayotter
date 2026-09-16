import { POSTS, getPost } from "@/lib/blog";
import { OG_CONTENT_TYPE, OG_SIZE, ogClamp, ogImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "DayOtter blog";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug);
  return ogImage({
    eyebrow: "Blog",
    title: post?.title ?? "DayOtter blog",
    subtitle: ogClamp(post?.excerpt ?? "Scheduling, focus, and building in the open."),
  });
}
