/**
 * Email-package i18n. The transactional templates in `templates.ts` are rendered
 * on the server for a specific recipient, so they can't reach the web app's i18n
 * catalog (apps depend on packages, never the reverse). This module is the
 * self-contained copy the emails package owns: the supported locales, a per-locale
 * dictionary of the user-facing strings the templates use, and locale-aware
 * date/time formatting.
 *
 * Keep the English ("en") strings reproducing the templates' original wording
 * verbatim so existing behavior (and snapshots/tests) don't regress.
 */

import { DateTime } from "luxon";

/** The languages a booking page / host locale can be. Mirrors the web app's
 * SUPPORTED_LOCALES, duplicated here so the package stays self-contained. */
export const EMAIL_LOCALES = ["en", "es", "fr", "de", "pt", "it", "nl"] as const;
export type EmailLocale = (typeof EMAIL_LOCALES)[number];
export const DEFAULT_EMAIL_LOCALE: EmailLocale = "en";

/** Narrow an arbitrary value to a supported email locale, falling back to the
 * default for anything unknown/undefined (so a stale or bad stored value can
 * never leave an email half-rendered). */
export function resolveEmailLocale(input: string | null | undefined): EmailLocale {
  return input && (EMAIL_LOCALES as readonly string[]).includes(input)
    ? (input as EmailLocale)
    : DEFAULT_EMAIL_LOCALE;
}

/** Interpolate `{name}` placeholders, mirroring the app's `interpolate`. */
function interpolate(s: string, vars?: Record<string, string | number>): string {
  return vars ? s.replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? `{${k}}`)) : s;
}

/**
 * Look up and interpolate a template string for `locale`, falling back to the
 * English copy (and finally the key itself) so a missing translation degrades
 * gracefully rather than throwing.
 */
export function et(
  locale: EmailLocale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const table = STRINGS[locale] ?? STRINGS[DEFAULT_EMAIL_LOCALE];
  const value = table[key] ?? STRINGS[DEFAULT_EMAIL_LOCALE][key] ?? key;
  return interpolate(value, vars);
}

/**
 * The full local date + time, e.g. "Wednesday, August 27, 2026 at 8:00 AM UTC"
 * in English or "mercredi 27 août 2026 à 08:00 UTC" in French. Uses Luxon's
 * locale-aware DATETIME_HUGE preset (includes the weekday, matching the old
 * `cccc, …` format) so each language gets its own month/weekday names AND its
 * own 12h/24h convention - never the old hard-coded `h:mm a`.
 */
export function formatEmailDateTime(date: Date, timezone: string, locale: EmailLocale): string {
  return DateTime.fromJSDate(date)
    .setZone(timezone)
    .setLocale(locale)
    .toLocaleString(DateTime.DATETIME_HUGE);
}

/** A compact localized date + time for subject lines, e.g. "Aug 27, 8:00 AM" /
 * "27 août, 08:00". Honors the locale's 12h/24h convention. */
export function formatEmailDateTimeShort(
  date: Date,
  timezone: string,
  locale: EmailLocale,
): string {
  return DateTime.fromJSDate(date)
    .setZone(timezone)
    .setLocale(locale)
    .toLocaleString({ month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** A localized weekday + date + time for inline summaries (poll options). */
export function formatEmailDateTimeMedium(
  date: Date,
  timezone: string,
  locale: EmailLocale,
): string {
  return DateTime.fromJSDate(date).setZone(timezone).setLocale(locale).toLocaleString({
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Per-locale strings for the transactional templates. Keys are grouped by
 * template. `{tokens}` are interpolated by `et`. Brand names ("DayOtter") and
 * URLs are never translated. English is authoritative and mirrors the original
 * hard-coded copy exactly.
 */
const STRINGS: Record<EmailLocale, Record<string, string>> = {
  en: {
    "confirmation.subject": "Confirmed: {title} - {date}",
    "confirmation.textIntro": "Your booking is confirmed.",
    "confirmation.textWith": "With: {host}",
    "confirmation.textWhen": "When: {when}",
    "confirmation.textManage": "Manage or cancel: {url}",
    "confirmation.join": "Join: {url}",
    "confirmation.location": "Location: {location}",
    "confirmation.bookedBy": "Booked by: {person}",
    "confirmation.alsoAttending": "Also attending: {people}",
    "confirmation.heading": "Your booking is confirmed 🎉",
    "confirmation.htmlWith": "{title} with {host}",
    "confirmation.cta": "View booking",

    "reminder.subject": "Reminder: {title} {lead}",
    "reminder.textLine": "Reminder - {title} with {host} is {lead}.",
    "reminder.textWhen": "When: {when}",
    "reminder.join": "Join: {url}",
    "reminder.textManage": "Manage: {url}",
    "reminder.heading": "Reminder: your meeting is {lead}",
    "reminder.htmlWith": "{title} with {host}",
    "reminder.ctaJoin": "Join call",
    "reminder.ctaView": "View booking",

    "rescheduled.subject": "Rescheduled: {title} - {date}",
    "rescheduled.reason": "Reason: {reason}",
    "rescheduled.textIntro": "Your booking has been moved to a new time.",
    "rescheduled.textTitleWith": "{title} with {host}",
    "rescheduled.textNewTime": "New time: {when}",
    "rescheduled.join": "Join: {url}",
    "rescheduled.location": "Location: {location}",
    "rescheduled.textManage": "Manage: {url}",
    "rescheduled.heading": "Your booking was rescheduled",
    "rescheduled.htmlHasNewTime": "{title} with {host} has a new time:",
    "rescheduled.cta": "View booking",

    "cancellation.subject": "Cancelled: {title} - {date}",
    "cancellation.reason": "Reason: {reason}",
    "cancellation.textIntro": "This booking has been cancelled.",
    "cancellation.textTitleWith": "{title} with {host}",
    "cancellation.textWas": "Was: {when}",
    "cancellation.heading": "Booking cancelled",
    "cancellation.htmlCancelled": "{title} with {host} has been cancelled.",
    "cancellation.htmlWas": "Was: {when}",

    "followUp.subject": "Thanks for meeting - {title}",
    "followUp.text":
      "Thanks for taking the time to meet about {title} with {host}. If anything came up or you'd like to follow up, just reply - or book another time: {url}",
    "followUp.heading": "Thanks for meeting 🙌",
    "followUp.htmlLine1": "Thanks for taking the time to meet about {title} with {host}.",
    "followUp.htmlLine2":
      "If anything came up, just reply to this email - or grab another time below.",
    "followUp.cta": "Book another time",

    "noShow.subject": "Sorry we missed you - {title}",
    "noShow.text":
      "We had {title} with {host} on the calendar but didn't get to connect. No worries - grab a new time whenever it suits you: {url}",
    "noShow.heading": "Sorry we missed you",
    "noShow.htmlLine1": "We had {title} with {host} on the calendar but didn't get to connect.",
    "noShow.htmlLine2": "No worries at all - grab a new time whenever it suits you.",
    "noShow.cta": "Pick a new time",

    "pollInvitation.subject": "Vote on a time: {title}",
    "pollInvitation.textInvited": "{host} invited you to vote on a time for {title}.",
    "pollInvitation.textProposed": "There are {count} proposed times.",
    "pollInvitation.textVoteHere": "Vote here: {url}",
    "pollInvitation.heading": "{host} is finding a time",
    "pollInvitation.htmlInvited": "You were invited to vote on {title}.",
    "pollInvitation.htmlChoose": "Choose what works for you from {count} proposed times.",
    "pollInvitation.cta": "Vote on times",

    "pollVoteUpdate.subject": "New vote: {title}",
    "pollVoteUpdate.optionSummary": "{when}: {yes} yes, {maybe} maybe, {no} no",
    "pollVoteUpdate.textSubmitted": "{voter} ({email}) submitted or updated a vote on {title}.",
    "pollVoteUpdate.statusOpen": "Open",
    "pollVoteUpdate.pollStatus": "Poll status: {status} · {label}",
    "pollVoteUpdate.textViewResults": "View results: {url}",
    "pollVoteUpdate.heading": "New vote on {title}",
    "pollVoteUpdate.htmlSubmitted": "{voter} ({email}) submitted or updated a vote.",
    "pollVoteUpdate.cta": "View poll results",
  },

  es: {
    "confirmation.subject": "Confirmada: {title} - {date}",
    "confirmation.textIntro": "Tu reserva está confirmada.",
    "confirmation.textWith": "Con: {host}",
    "confirmation.textWhen": "Cuándo: {when}",
    "confirmation.textManage": "Gestionar o cancelar: {url}",
    "confirmation.join": "Unirse: {url}",
    "confirmation.location": "Ubicación: {location}",
    "confirmation.bookedBy": "Reservado por: {person}",
    "confirmation.alsoAttending": "También asisten: {people}",
    "confirmation.heading": "Tu reserva está confirmada 🎉",
    "confirmation.htmlWith": "{title} con {host}",
    "confirmation.cta": "Ver reserva",

    "reminder.subject": "Recordatorio: {title} {lead}",
    "reminder.textLine": "Recordatorio: {title} con {host} es {lead}.",
    "reminder.textWhen": "Cuándo: {when}",
    "reminder.join": "Unirse: {url}",
    "reminder.textManage": "Gestionar: {url}",
    "reminder.heading": "Recordatorio: tu reunión es {lead}",
    "reminder.htmlWith": "{title} con {host}",
    "reminder.ctaJoin": "Unirse a la llamada",
    "reminder.ctaView": "Ver reserva",

    "rescheduled.subject": "Reprogramada: {title} - {date}",
    "rescheduled.reason": "Motivo: {reason}",
    "rescheduled.textIntro": "Tu reserva se ha movido a una nueva hora.",
    "rescheduled.textTitleWith": "{title} con {host}",
    "rescheduled.textNewTime": "Nueva hora: {when}",
    "rescheduled.join": "Unirse: {url}",
    "rescheduled.location": "Ubicación: {location}",
    "rescheduled.textManage": "Gestionar: {url}",
    "rescheduled.heading": "Tu reserva se ha reprogramado",
    "rescheduled.htmlHasNewTime": "{title} con {host} tiene una nueva hora:",
    "rescheduled.cta": "Ver reserva",

    "cancellation.subject": "Cancelada: {title} - {date}",
    "cancellation.reason": "Motivo: {reason}",
    "cancellation.textIntro": "Esta reserva se ha cancelado.",
    "cancellation.textTitleWith": "{title} con {host}",
    "cancellation.textWas": "Era: {when}",
    "cancellation.heading": "Reserva cancelada",
    "cancellation.htmlCancelled": "{title} con {host} se ha cancelado.",
    "cancellation.htmlWas": "Era: {when}",

    "followUp.subject": "Gracias por la reunión - {title}",
    "followUp.text":
      "Gracias por sacar tiempo para hablar sobre {title} con {host}. Si surgió algo o quieres dar seguimiento, solo responde, o reserva otra hora: {url}",
    "followUp.heading": "Gracias por la reunión 🙌",
    "followUp.htmlLine1": "Gracias por sacar tiempo para hablar sobre {title} con {host}.",
    "followUp.htmlLine2": "Si surgió algo, solo responde a este correo, o reserva otra hora abajo.",
    "followUp.cta": "Reservar otra hora",

    "noShow.subject": "Lamentamos no coincidir - {title}",
    "noShow.text":
      "Teníamos {title} con {host} en el calendario, pero no pudimos coincidir. No pasa nada: reserva una nueva hora cuando te venga bien: {url}",
    "noShow.heading": "Lamentamos no coincidir",
    "noShow.htmlLine1": "Teníamos {title} con {host} en el calendario, pero no pudimos coincidir.",
    "noShow.htmlLine2": "No pasa nada: reserva una nueva hora cuando te venga bien.",
    "noShow.cta": "Elegir una nueva hora",

    "pollInvitation.subject": "Vota una hora: {title}",
    "pollInvitation.textInvited": "{host} te invitó a votar una hora para {title}.",
    "pollInvitation.textProposed": "Hay {count} horas propuestas.",
    "pollInvitation.textVoteHere": "Vota aquí: {url}",
    "pollInvitation.heading": "{host} está buscando una hora",
    "pollInvitation.htmlInvited": "Te invitaron a votar sobre {title}.",
    "pollInvitation.htmlChoose": "Elige la que mejor te venga entre {count} horas propuestas.",
    "pollInvitation.cta": "Votar horas",

    "pollVoteUpdate.subject": "Nuevo voto: {title}",
    "pollVoteUpdate.optionSummary": "{when}: {yes} sí, {maybe} quizás, {no} no",
    "pollVoteUpdate.textSubmitted": "{voter} ({email}) envió o actualizó un voto en {title}.",
    "pollVoteUpdate.statusOpen": "Abierta",
    "pollVoteUpdate.pollStatus": "Estado de la encuesta: {status} · {label}",
    "pollVoteUpdate.textViewResults": "Ver resultados: {url}",
    "pollVoteUpdate.heading": "Nuevo voto en {title}",
    "pollVoteUpdate.htmlSubmitted": "{voter} ({email}) envió o actualizó un voto.",
    "pollVoteUpdate.cta": "Ver resultados de la encuesta",
  },

  fr: {
    "confirmation.subject": "Confirmée : {title} - {date}",
    "confirmation.textIntro": "Votre réservation est confirmée.",
    "confirmation.textWith": "Avec : {host}",
    "confirmation.textWhen": "Quand : {when}",
    "confirmation.textManage": "Gérer ou annuler : {url}",
    "confirmation.join": "Rejoindre : {url}",
    "confirmation.location": "Lieu : {location}",
    "confirmation.bookedBy": "Réservé par : {person}",
    "confirmation.alsoAttending": "Participent aussi : {people}",
    "confirmation.heading": "Votre réservation est confirmée 🎉",
    "confirmation.htmlWith": "{title} avec {host}",
    "confirmation.cta": "Voir la réservation",

    "reminder.subject": "Rappel : {title} {lead}",
    "reminder.textLine": "Rappel - {title} avec {host} est {lead}.",
    "reminder.textWhen": "Quand : {when}",
    "reminder.join": "Rejoindre : {url}",
    "reminder.textManage": "Gérer : {url}",
    "reminder.heading": "Rappel : votre réunion est {lead}",
    "reminder.htmlWith": "{title} avec {host}",
    "reminder.ctaJoin": "Rejoindre l'appel",
    "reminder.ctaView": "Voir la réservation",

    "rescheduled.subject": "Reprogrammée : {title} - {date}",
    "rescheduled.reason": "Motif : {reason}",
    "rescheduled.textIntro": "Votre réservation a été déplacée à un nouvel horaire.",
    "rescheduled.textTitleWith": "{title} avec {host}",
    "rescheduled.textNewTime": "Nouvel horaire : {when}",
    "rescheduled.join": "Rejoindre : {url}",
    "rescheduled.location": "Lieu : {location}",
    "rescheduled.textManage": "Gérer : {url}",
    "rescheduled.heading": "Votre réservation a été reprogrammée",
    "rescheduled.htmlHasNewTime": "{title} avec {host} a un nouvel horaire :",
    "rescheduled.cta": "Voir la réservation",

    "cancellation.subject": "Annulée : {title} - {date}",
    "cancellation.reason": "Motif : {reason}",
    "cancellation.textIntro": "Cette réservation a été annulée.",
    "cancellation.textTitleWith": "{title} avec {host}",
    "cancellation.textWas": "C'était : {when}",
    "cancellation.heading": "Réservation annulée",
    "cancellation.htmlCancelled": "{title} avec {host} a été annulée.",
    "cancellation.htmlWas": "C'était : {when}",

    "followUp.subject": "Merci pour cet échange - {title}",
    "followUp.text":
      "Merci d'avoir pris le temps d'échanger sur {title} avec {host}. Si quelque chose est ressorti ou si vous souhaitez faire le point, répondez simplement, ou réservez un autre créneau : {url}",
    "followUp.heading": "Merci pour cet échange 🙌",
    "followUp.htmlLine1": "Merci d'avoir pris le temps d'échanger sur {title} avec {host}.",
    "followUp.htmlLine2":
      "Si quelque chose est ressorti, répondez simplement à cet e-mail, ou réservez un autre créneau ci-dessous.",
    "followUp.cta": "Réserver un autre créneau",

    "noShow.subject": "Désolé de vous avoir manqué - {title}",
    "noShow.text":
      "Nous avions {title} avec {host} au calendrier, mais nous n'avons pas pu nous voir. Pas de souci : réservez un nouveau créneau quand cela vous convient : {url}",
    "noShow.heading": "Désolé de vous avoir manqué",
    "noShow.htmlLine1":
      "Nous avions {title} avec {host} au calendrier, mais nous n'avons pas pu nous voir.",
    "noShow.htmlLine2": "Pas de souci : réservez un nouveau créneau quand cela vous convient.",
    "noShow.cta": "Choisir un nouveau créneau",

    "pollInvitation.subject": "Votez pour un horaire : {title}",
    "pollInvitation.textInvited": "{host} vous a invité à voter pour un horaire pour {title}.",
    "pollInvitation.textProposed": "Il y a {count} horaires proposés.",
    "pollInvitation.textVoteHere": "Votez ici : {url}",
    "pollInvitation.heading": "{host} cherche un horaire",
    "pollInvitation.htmlInvited": "Vous avez été invité à voter pour {title}.",
    "pollInvitation.htmlChoose": "Choisissez ce qui vous convient parmi {count} horaires proposés.",
    "pollInvitation.cta": "Voter pour les horaires",

    "pollVoteUpdate.subject": "Nouveau vote : {title}",
    "pollVoteUpdate.optionSummary": "{when} : {yes} oui, {maybe} peut-être, {no} non",
    "pollVoteUpdate.textSubmitted": "{voter} ({email}) a soumis ou mis à jour un vote sur {title}.",
    "pollVoteUpdate.statusOpen": "Ouvert",
    "pollVoteUpdate.pollStatus": "Statut du sondage : {status} · {label}",
    "pollVoteUpdate.textViewResults": "Voir les résultats : {url}",
    "pollVoteUpdate.heading": "Nouveau vote sur {title}",
    "pollVoteUpdate.htmlSubmitted": "{voter} ({email}) a soumis ou mis à jour un vote.",
    "pollVoteUpdate.cta": "Voir les résultats du sondage",
  },

  de: {
    "confirmation.subject": "Bestätigt: {title} - {date}",
    "confirmation.textIntro": "Deine Buchung ist bestätigt.",
    "confirmation.textWith": "Mit: {host}",
    "confirmation.textWhen": "Wann: {when}",
    "confirmation.textManage": "Verwalten oder stornieren: {url}",
    "confirmation.join": "Beitreten: {url}",
    "confirmation.location": "Ort: {location}",
    "confirmation.bookedBy": "Gebucht von: {person}",
    "confirmation.alsoAttending": "Ebenfalls dabei: {people}",
    "confirmation.heading": "Deine Buchung ist bestätigt 🎉",
    "confirmation.htmlWith": "{title} mit {host}",
    "confirmation.cta": "Buchung ansehen",

    "reminder.subject": "Erinnerung: {title} {lead}",
    "reminder.textLine": "Erinnerung - {title} mit {host} ist {lead}.",
    "reminder.textWhen": "Wann: {when}",
    "reminder.join": "Beitreten: {url}",
    "reminder.textManage": "Verwalten: {url}",
    "reminder.heading": "Erinnerung: dein Termin ist {lead}",
    "reminder.htmlWith": "{title} mit {host}",
    "reminder.ctaJoin": "Anruf beitreten",
    "reminder.ctaView": "Buchung ansehen",

    "rescheduled.subject": "Verschoben: {title} - {date}",
    "rescheduled.reason": "Grund: {reason}",
    "rescheduled.textIntro": "Deine Buchung wurde auf eine neue Zeit verschoben.",
    "rescheduled.textTitleWith": "{title} mit {host}",
    "rescheduled.textNewTime": "Neue Zeit: {when}",
    "rescheduled.join": "Beitreten: {url}",
    "rescheduled.location": "Ort: {location}",
    "rescheduled.textManage": "Verwalten: {url}",
    "rescheduled.heading": "Deine Buchung wurde verschoben",
    "rescheduled.htmlHasNewTime": "{title} mit {host} hat eine neue Zeit:",
    "rescheduled.cta": "Buchung ansehen",

    "cancellation.subject": "Storniert: {title} - {date}",
    "cancellation.reason": "Grund: {reason}",
    "cancellation.textIntro": "Diese Buchung wurde storniert.",
    "cancellation.textTitleWith": "{title} mit {host}",
    "cancellation.textWas": "War: {when}",
    "cancellation.heading": "Buchung storniert",
    "cancellation.htmlCancelled": "{title} mit {host} wurde storniert.",
    "cancellation.htmlWas": "War: {when}",

    "followUp.subject": "Danke für das Treffen - {title}",
    "followUp.text":
      "Danke, dass du dir die Zeit für {title} mit {host} genommen hast. Falls etwas aufkam oder du nachfassen möchtest, antworte einfach, oder buche eine neue Zeit: {url}",
    "followUp.heading": "Danke für das Treffen 🙌",
    "followUp.htmlLine1": "Danke, dass du dir die Zeit für {title} mit {host} genommen hast.",
    "followUp.htmlLine2":
      "Falls etwas aufkam, antworte einfach auf diese E-Mail, oder sichere dir unten eine neue Zeit.",
    "followUp.cta": "Neue Zeit buchen",

    "noShow.subject": "Schade, dass es nicht geklappt hat - {title}",
    "noShow.text":
      "Wir hatten {title} mit {host} im Kalender, konnten uns aber nicht treffen. Kein Problem - buche eine neue Zeit, wann immer es dir passt: {url}",
    "noShow.heading": "Schade, dass es nicht geklappt hat",
    "noShow.htmlLine1":
      "Wir hatten {title} mit {host} im Kalender, konnten uns aber nicht treffen.",
    "noShow.htmlLine2": "Kein Problem - buche eine neue Zeit, wann immer es dir passt.",
    "noShow.cta": "Neue Zeit wählen",

    "pollInvitation.subject": "Stimme für eine Zeit ab: {title}",
    "pollInvitation.textInvited":
      "{host} hat dich eingeladen, über eine Zeit für {title} abzustimmen.",
    "pollInvitation.textProposed": "Es gibt {count} vorgeschlagene Zeiten.",
    "pollInvitation.textVoteHere": "Hier abstimmen: {url}",
    "pollInvitation.heading": "{host} sucht eine Zeit",
    "pollInvitation.htmlInvited": "Du wurdest eingeladen, über {title} abzustimmen.",
    "pollInvitation.htmlChoose": "Wähle aus {count} vorgeschlagenen Zeiten, was dir passt.",
    "pollInvitation.cta": "Über Zeiten abstimmen",

    "pollVoteUpdate.subject": "Neue Stimme: {title}",
    "pollVoteUpdate.optionSummary": "{when}: {yes} ja, {maybe} vielleicht, {no} nein",
    "pollVoteUpdate.textSubmitted":
      "{voter} ({email}) hat bei {title} eine Stimme abgegeben oder aktualisiert.",
    "pollVoteUpdate.statusOpen": "Offen",
    "pollVoteUpdate.pollStatus": "Umfragestatus: {status} · {label}",
    "pollVoteUpdate.textViewResults": "Ergebnisse ansehen: {url}",
    "pollVoteUpdate.heading": "Neue Stimme bei {title}",
    "pollVoteUpdate.htmlSubmitted":
      "{voter} ({email}) hat eine Stimme abgegeben oder aktualisiert.",
    "pollVoteUpdate.cta": "Umfrageergebnisse ansehen",
  },

  pt: {
    "confirmation.subject": "Confirmada: {title} - {date}",
    "confirmation.textIntro": "A tua reserva está confirmada.",
    "confirmation.textWith": "Com: {host}",
    "confirmation.textWhen": "Quando: {when}",
    "confirmation.textManage": "Gerir ou cancelar: {url}",
    "confirmation.join": "Entrar: {url}",
    "confirmation.location": "Local: {location}",
    "confirmation.bookedBy": "Reservado por: {person}",
    "confirmation.alsoAttending": "Também participam: {people}",
    "confirmation.heading": "A tua reserva está confirmada 🎉",
    "confirmation.htmlWith": "{title} com {host}",
    "confirmation.cta": "Ver reserva",

    "reminder.subject": "Lembrete: {title} {lead}",
    "reminder.textLine": "Lembrete - {title} com {host} é {lead}.",
    "reminder.textWhen": "Quando: {when}",
    "reminder.join": "Entrar: {url}",
    "reminder.textManage": "Gerir: {url}",
    "reminder.heading": "Lembrete: a tua reunião é {lead}",
    "reminder.htmlWith": "{title} com {host}",
    "reminder.ctaJoin": "Entrar na chamada",
    "reminder.ctaView": "Ver reserva",

    "rescheduled.subject": "Reagendada: {title} - {date}",
    "rescheduled.reason": "Motivo: {reason}",
    "rescheduled.textIntro": "A tua reserva foi movida para um novo horário.",
    "rescheduled.textTitleWith": "{title} com {host}",
    "rescheduled.textNewTime": "Novo horário: {when}",
    "rescheduled.join": "Entrar: {url}",
    "rescheduled.location": "Local: {location}",
    "rescheduled.textManage": "Gerir: {url}",
    "rescheduled.heading": "A tua reserva foi reagendada",
    "rescheduled.htmlHasNewTime": "{title} com {host} tem um novo horário:",
    "rescheduled.cta": "Ver reserva",

    "cancellation.subject": "Cancelada: {title} - {date}",
    "cancellation.reason": "Motivo: {reason}",
    "cancellation.textIntro": "Esta reserva foi cancelada.",
    "cancellation.textTitleWith": "{title} com {host}",
    "cancellation.textWas": "Era: {when}",
    "cancellation.heading": "Reserva cancelada",
    "cancellation.htmlCancelled": "{title} com {host} foi cancelada.",
    "cancellation.htmlWas": "Era: {when}",

    "followUp.subject": "Obrigado pela reunião - {title}",
    "followUp.text":
      "Obrigado por reservares tempo para falar sobre {title} com {host}. Se surgiu algo ou quiseres dar seguimento, basta responder, ou marca outro horário: {url}",
    "followUp.heading": "Obrigado pela reunião 🙌",
    "followUp.htmlLine1": "Obrigado por reservares tempo para falar sobre {title} com {host}.",
    "followUp.htmlLine2":
      "Se surgiu algo, basta responder a este e-mail, ou marca outro horário abaixo.",
    "followUp.cta": "Marcar outro horário",

    "noShow.subject": "Lamentamos não te termos encontrado - {title}",
    "noShow.text":
      "Tínhamos {title} com {host} no calendário, mas não nos conseguimos encontrar. Sem problema - marca um novo horário quando te der jeito: {url}",
    "noShow.heading": "Lamentamos não te termos encontrado",
    "noShow.htmlLine1":
      "Tínhamos {title} com {host} no calendário, mas não nos conseguimos encontrar.",
    "noShow.htmlLine2": "Sem problema - marca um novo horário quando te der jeito.",
    "noShow.cta": "Escolher um novo horário",

    "pollInvitation.subject": "Vota num horário: {title}",
    "pollInvitation.textInvited": "{host} convidou-te a votar num horário para {title}.",
    "pollInvitation.textProposed": "Há {count} horários propostos.",
    "pollInvitation.textVoteHere": "Vota aqui: {url}",
    "pollInvitation.heading": "{host} está a procurar um horário",
    "pollInvitation.htmlInvited": "Foste convidado a votar em {title}.",
    "pollInvitation.htmlChoose": "Escolhe o que te der jeito entre {count} horários propostos.",
    "pollInvitation.cta": "Votar nos horários",

    "pollVoteUpdate.subject": "Novo voto: {title}",
    "pollVoteUpdate.optionSummary": "{when}: {yes} sim, {maybe} talvez, {no} não",
    "pollVoteUpdate.textSubmitted": "{voter} ({email}) enviou ou atualizou um voto em {title}.",
    "pollVoteUpdate.statusOpen": "Aberta",
    "pollVoteUpdate.pollStatus": "Estado da sondagem: {status} · {label}",
    "pollVoteUpdate.textViewResults": "Ver resultados: {url}",
    "pollVoteUpdate.heading": "Novo voto em {title}",
    "pollVoteUpdate.htmlSubmitted": "{voter} ({email}) enviou ou atualizou um voto.",
    "pollVoteUpdate.cta": "Ver resultados da sondagem",
  },

  it: {
    "confirmation.subject": "Confermata: {title} - {date}",
    "confirmation.textIntro": "La tua prenotazione è confermata.",
    "confirmation.textWith": "Con: {host}",
    "confirmation.textWhen": "Quando: {when}",
    "confirmation.textManage": "Gestisci o annulla: {url}",
    "confirmation.join": "Partecipa: {url}",
    "confirmation.location": "Luogo: {location}",
    "confirmation.bookedBy": "Prenotato da: {person}",
    "confirmation.alsoAttending": "Partecipano anche: {people}",
    "confirmation.heading": "La tua prenotazione è confermata 🎉",
    "confirmation.htmlWith": "{title} con {host}",
    "confirmation.cta": "Vedi prenotazione",

    "reminder.subject": "Promemoria: {title} {lead}",
    "reminder.textLine": "Promemoria - {title} con {host} è {lead}.",
    "reminder.textWhen": "Quando: {when}",
    "reminder.join": "Partecipa: {url}",
    "reminder.textManage": "Gestisci: {url}",
    "reminder.heading": "Promemoria: la tua riunione è {lead}",
    "reminder.htmlWith": "{title} con {host}",
    "reminder.ctaJoin": "Partecipa alla chiamata",
    "reminder.ctaView": "Vedi prenotazione",

    "rescheduled.subject": "Riprogrammata: {title} - {date}",
    "rescheduled.reason": "Motivo: {reason}",
    "rescheduled.textIntro": "La tua prenotazione è stata spostata a un nuovo orario.",
    "rescheduled.textTitleWith": "{title} con {host}",
    "rescheduled.textNewTime": "Nuovo orario: {when}",
    "rescheduled.join": "Partecipa: {url}",
    "rescheduled.location": "Luogo: {location}",
    "rescheduled.textManage": "Gestisci: {url}",
    "rescheduled.heading": "La tua prenotazione è stata riprogrammata",
    "rescheduled.htmlHasNewTime": "{title} con {host} ha un nuovo orario:",
    "rescheduled.cta": "Vedi prenotazione",

    "cancellation.subject": "Annullata: {title} - {date}",
    "cancellation.reason": "Motivo: {reason}",
    "cancellation.textIntro": "Questa prenotazione è stata annullata.",
    "cancellation.textTitleWith": "{title} con {host}",
    "cancellation.textWas": "Era: {when}",
    "cancellation.heading": "Prenotazione annullata",
    "cancellation.htmlCancelled": "{title} con {host} è stata annullata.",
    "cancellation.htmlWas": "Era: {when}",

    "followUp.subject": "Grazie per l'incontro - {title}",
    "followUp.text":
      "Grazie per aver dedicato del tempo a parlare di {title} con {host}. Se è emerso qualcosa o vuoi dare seguito, rispondi pure, oppure prenota un altro orario: {url}",
    "followUp.heading": "Grazie per l'incontro 🙌",
    "followUp.htmlLine1": "Grazie per aver dedicato del tempo a parlare di {title} con {host}.",
    "followUp.htmlLine2":
      "Se è emerso qualcosa, rispondi pure a questa email, oppure prenota un altro orario qui sotto.",
    "followUp.cta": "Prenota un altro orario",

    "noShow.subject": "Ci è dispiaciuto non incontrarti - {title}",
    "noShow.text":
      "Avevamo {title} con {host} in calendario, ma non siamo riusciti a incontrarci. Nessun problema: prenota un nuovo orario quando ti è comodo: {url}",
    "noShow.heading": "Ci è dispiaciuto non incontrarti",
    "noShow.htmlLine1":
      "Avevamo {title} con {host} in calendario, ma non siamo riusciti a incontrarci.",
    "noShow.htmlLine2": "Nessun problema: prenota un nuovo orario quando ti è comodo.",
    "noShow.cta": "Scegli un nuovo orario",

    "pollInvitation.subject": "Vota un orario: {title}",
    "pollInvitation.textInvited": "{host} ti ha invitato a votare un orario per {title}.",
    "pollInvitation.textProposed": "Ci sono {count} orari proposti.",
    "pollInvitation.textVoteHere": "Vota qui: {url}",
    "pollInvitation.heading": "{host} sta cercando un orario",
    "pollInvitation.htmlInvited": "Sei stato invitato a votare su {title}.",
    "pollInvitation.htmlChoose": "Scegli quello che ti è comodo tra {count} orari proposti.",
    "pollInvitation.cta": "Vota gli orari",

    "pollVoteUpdate.subject": "Nuovo voto: {title}",
    "pollVoteUpdate.optionSummary": "{when}: {yes} sì, {maybe} forse, {no} no",
    "pollVoteUpdate.textSubmitted": "{voter} ({email}) ha inviato o aggiornato un voto su {title}.",
    "pollVoteUpdate.statusOpen": "Aperto",
    "pollVoteUpdate.pollStatus": "Stato del sondaggio: {status} · {label}",
    "pollVoteUpdate.textViewResults": "Vedi risultati: {url}",
    "pollVoteUpdate.heading": "Nuovo voto su {title}",
    "pollVoteUpdate.htmlSubmitted": "{voter} ({email}) ha inviato o aggiornato un voto.",
    "pollVoteUpdate.cta": "Vedi risultati del sondaggio",
  },

  nl: {
    "confirmation.subject": "Bevestigd: {title} - {date}",
    "confirmation.textIntro": "Je boeking is bevestigd.",
    "confirmation.textWith": "Met: {host}",
    "confirmation.textWhen": "Wanneer: {when}",
    "confirmation.textManage": "Beheren of annuleren: {url}",
    "confirmation.join": "Deelnemen: {url}",
    "confirmation.location": "Locatie: {location}",
    "confirmation.bookedBy": "Geboekt door: {person}",
    "confirmation.alsoAttending": "Ook aanwezig: {people}",
    "confirmation.heading": "Je boeking is bevestigd 🎉",
    "confirmation.htmlWith": "{title} met {host}",
    "confirmation.cta": "Boeking bekijken",

    "reminder.subject": "Herinnering: {title} {lead}",
    "reminder.textLine": "Herinnering - {title} met {host} is {lead}.",
    "reminder.textWhen": "Wanneer: {when}",
    "reminder.join": "Deelnemen: {url}",
    "reminder.textManage": "Beheren: {url}",
    "reminder.heading": "Herinnering: je afspraak is {lead}",
    "reminder.htmlWith": "{title} met {host}",
    "reminder.ctaJoin": "Deelnemen aan gesprek",
    "reminder.ctaView": "Boeking bekijken",

    "rescheduled.subject": "Verzet: {title} - {date}",
    "rescheduled.reason": "Reden: {reason}",
    "rescheduled.textIntro": "Je boeking is naar een nieuw tijdstip verzet.",
    "rescheduled.textTitleWith": "{title} met {host}",
    "rescheduled.textNewTime": "Nieuw tijdstip: {when}",
    "rescheduled.join": "Deelnemen: {url}",
    "rescheduled.location": "Locatie: {location}",
    "rescheduled.textManage": "Beheren: {url}",
    "rescheduled.heading": "Je boeking is verzet",
    "rescheduled.htmlHasNewTime": "{title} met {host} heeft een nieuw tijdstip:",
    "rescheduled.cta": "Boeking bekijken",

    "cancellation.subject": "Geannuleerd: {title} - {date}",
    "cancellation.reason": "Reden: {reason}",
    "cancellation.textIntro": "Deze boeking is geannuleerd.",
    "cancellation.textTitleWith": "{title} met {host}",
    "cancellation.textWas": "Was: {when}",
    "cancellation.heading": "Boeking geannuleerd",
    "cancellation.htmlCancelled": "{title} met {host} is geannuleerd.",
    "cancellation.htmlWas": "Was: {when}",

    "followUp.subject": "Bedankt voor de afspraak - {title}",
    "followUp.text":
      "Bedankt dat je de tijd nam om over {title} te spreken met {host}. Als er iets naar boven kwam of je wilt opvolgen, reageer gerust, of boek een nieuw tijdstip: {url}",
    "followUp.heading": "Bedankt voor de afspraak 🙌",
    "followUp.htmlLine1": "Bedankt dat je de tijd nam om over {title} te spreken met {host}.",
    "followUp.htmlLine2":
      "Als er iets naar boven kwam, reageer gerust op deze e-mail, of kies hieronder een nieuw tijdstip.",
    "followUp.cta": "Nieuw tijdstip boeken",

    "noShow.subject": "Jammer dat we elkaar misliepen - {title}",
    "noShow.text":
      "We hadden {title} met {host} in de agenda staan, maar we troffen elkaar niet. Geen zorgen - boek een nieuw tijdstip wanneer het je uitkomt: {url}",
    "noShow.heading": "Jammer dat we elkaar misliepen",
    "noShow.htmlLine1":
      "We hadden {title} met {host} in de agenda staan, maar we troffen elkaar niet.",
    "noShow.htmlLine2": "Geen zorgen - boek een nieuw tijdstip wanneer het je uitkomt.",
    "noShow.cta": "Kies een nieuw tijdstip",

    "pollInvitation.subject": "Stem op een tijdstip: {title}",
    "pollInvitation.textInvited":
      "{host} heeft je uitgenodigd om op een tijdstip voor {title} te stemmen.",
    "pollInvitation.textProposed": "Er zijn {count} voorgestelde tijdstippen.",
    "pollInvitation.textVoteHere": "Stem hier: {url}",
    "pollInvitation.heading": "{host} zoekt een tijdstip",
    "pollInvitation.htmlInvited": "Je bent uitgenodigd om op {title} te stemmen.",
    "pollInvitation.htmlChoose": "Kies wat jou uitkomt uit {count} voorgestelde tijdstippen.",
    "pollInvitation.cta": "Op tijdstippen stemmen",

    "pollVoteUpdate.subject": "Nieuwe stem: {title}",
    "pollVoteUpdate.optionSummary": "{when}: {yes} ja, {maybe} misschien, {no} nee",
    "pollVoteUpdate.textSubmitted":
      "{voter} ({email}) heeft een stem uitgebracht of bijgewerkt op {title}.",
    "pollVoteUpdate.statusOpen": "Open",
    "pollVoteUpdate.pollStatus": "Pollstatus: {status} · {label}",
    "pollVoteUpdate.textViewResults": "Resultaten bekijken: {url}",
    "pollVoteUpdate.heading": "Nieuwe stem op {title}",
    "pollVoteUpdate.htmlSubmitted": "{voter} ({email}) heeft een stem uitgebracht of bijgewerkt.",
    "pollVoteUpdate.cta": "Pollresultaten bekijken",
  },
};
