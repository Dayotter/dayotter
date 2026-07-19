import { eq, getDb, schema } from "@dayotter/db";
import { type Locale, SUPPORTED_LOCALES, resolveLocale } from "./index";

/**
 * Server-only locale resolution. Kept apart from `./index` (which is isomorphic)
 * because it touches the database.
 */

/** Narrow an arbitrary string to a supported `Locale`. */
export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * The locale for a signed-in user: their stored `userPreferences.locale` if it's
 * a supported language, otherwise the request's `Accept-Language`, otherwise the
 * default. Used to seed the LocaleProvider in the authed app shell so an explicit
 * language choice wins over the browser's header.
 */
export async function resolveUserLocale(
  userId: string,
  acceptLanguage: string | null,
): Promise<Locale> {
  const prefs = await getDb().query.userPreferences.findFirst({
    where: eq(schema.userPreferences.userId, userId),
    columns: { locale: true },
  });
  if (isSupportedLocale(prefs?.locale)) return prefs.locale;
  return resolveLocale(acceptLanguage);
}
