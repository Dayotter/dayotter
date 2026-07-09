import { cn } from "@/lib/cn";

/**
 * A host's avatar on public pages: their profile image when set, otherwise the
 * first letter of their name on the (brandable) accent colour.
 */
export function HostAvatar({
  name,
  image,
  size = 64,
  className,
}: {
  name: string;
  image?: string | null;
  size?: number;
  className?: string;
}) {
  const dimension = { width: size, height: size };
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        style={dimension}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }
  return (
    <div
      style={{ ...dimension, fontSize: size * 0.4 }}
      className={cn(
        "flex items-center justify-center rounded-full bg-[var(--color-accent)] font-semibold text-white",
        className,
      )}
    >
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}
