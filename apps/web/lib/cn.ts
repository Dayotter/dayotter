import { type ClassValue, clsx } from "clsx";

/** Merge conditional class names. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
