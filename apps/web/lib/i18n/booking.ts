/**
 * Lightweight i18n for the public booking surface. The booker sees the whole
 * booking flow - time selection AND the attendee form - in their own language
 * and locale date formats.
 *
 * Deliberately small and dependency-free: a complete message dictionary per
 * supported locale (so the UI is NEVER half-translated) plus a resolver that
 * maps a browser/Accept-Language string to a supported locale, falling back to
 * English. Luxon handles the actual date/number formatting given the locale.
 */

export const SUPPORTED_LOCALES = ["en", "es", "fr", "de", "pt"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export type BookingKey =
  // Time-selection surface
  | "selectTime"
  | "recommended"
  | "timesIn"
  | "overlayCta"
  | "overlayHelp"
  | "overlayApply"
  | "overlayReading"
  | "overlayClear"
  | "overlaySummaryOne"
  | "overlaySummaryMany"
  | "loading"
  | "noTimes"
  | "busyTooltip"
  // Attendee form + event details
  | "duration"
  | "durationMin"
  | "back"
  | "yourName"
  | "email"
  | "guestsOptional"
  | "add"
  | "notesOptional"
  | "notesPlaceholder"
  | "selectPlaceholder"
  | "confirming"
  | "confirmBooking"
  | "payAndBook"
  | "pleaseAnswer"
  | "bookingFailed"
  | "minutes"
  | "deposit"
  // Access-code gate (password-protected event types)
  | "accessHint"
  | "accessRequired"
  | "accessSubmit"
  | "accessWrong";

const MESSAGES: Record<Locale, Record<BookingKey, string>> = {
  en: {
    selectTime: "Select a time",
    recommended: "Recommended times",
    timesIn: "Times shown in {zone}",
    overlayCta: "Overlay my calendar",
    overlayHelp:
      "Paste your calendar's secret iCal (ICS) address to grey out times you're already busy. It's read once and never stored.",
    overlayApply: "Overlay",
    overlayReading: "Reading…",
    overlayClear: "Clear",
    overlaySummaryOne: "Overlaid 1 commitment - greyed times clash with your calendar.",
    overlaySummaryMany: "Overlaid {n} commitments - greyed times clash with your calendar.",
    loading: "Loading availability…",
    noTimes: "No times available in the next two weeks.",
    busyTooltip: "You have something on your calendar then",
    duration: "Duration",
    durationMin: "{n} min",
    back: "Back",
    yourName: "Your name",
    email: "Email",
    guestsOptional: "Guests (optional)",
    add: "Add",
    notesOptional: "Notes (optional)",
    notesPlaceholder: "Anything to share before the meeting?",
    selectPlaceholder: "Select…",
    confirming: "Confirming…",
    confirmBooking: "Confirm booking",
    payAndBook: "Pay {price} & book",
    pleaseAnswer: "Please answer: {label}",
    bookingFailed: "Could not confirm booking",
    minutes: "{n} minutes",
    deposit: "deposit",
    accessHint: "This booking page is protected.",
    accessRequired: "Access code",
    accessSubmit: "Continue",
    accessWrong: "That code isn't right.",
  },
  es: {
    selectTime: "Elige una hora",
    recommended: "Horas recomendadas",
    timesIn: "Horas en {zone}",
    overlayCta: "Superponer mi calendario",
    overlayHelp:
      "Pega la dirección iCal (ICS) secreta de tu calendario para atenuar las horas en las que ya estás ocupado. Se lee una vez y nunca se guarda.",
    overlayApply: "Superponer",
    overlayReading: "Leyendo…",
    overlayClear: "Borrar",
    overlaySummaryOne: "Se superpuso 1 compromiso - las horas atenuadas chocan con tu calendario.",
    overlaySummaryMany:
      "Se superpusieron {n} compromisos - las horas atenuadas chocan con tu calendario.",
    loading: "Cargando disponibilidad…",
    noTimes: "No hay horas disponibles en las próximas dos semanas.",
    busyTooltip: "Tienes algo en tu calendario a esa hora",
    duration: "Duración",
    durationMin: "{n} min",
    back: "Atrás",
    yourName: "Tu nombre",
    email: "Correo electrónico",
    guestsOptional: "Invitados (opcional)",
    add: "Añadir",
    notesOptional: "Notas (opcional)",
    notesPlaceholder: "¿Algo que quieras compartir antes de la reunión?",
    selectPlaceholder: "Selecciona…",
    confirming: "Confirmando…",
    confirmBooking: "Confirmar reserva",
    payAndBook: "Pagar {price} y reservar",
    pleaseAnswer: "Por favor responde: {label}",
    bookingFailed: "No se pudo confirmar la reserva",
    minutes: "{n} minutos",
    deposit: "depósito",
    accessHint: "Esta página de reserva está protegida.",
    accessRequired: "Código de acceso",
    accessSubmit: "Continuar",
    accessWrong: "Ese código no es correcto.",
  },
  fr: {
    selectTime: "Choisissez un horaire",
    recommended: "Horaires recommandés",
    timesIn: "Horaires affichés en {zone}",
    overlayCta: "Superposer mon agenda",
    overlayHelp:
      "Collez l'adresse iCal (ICS) secrète de votre agenda pour griser les horaires où vous êtes déjà occupé. Elle est lue une fois et jamais conservée.",
    overlayApply: "Superposer",
    overlayReading: "Lecture…",
    overlayClear: "Effacer",
    overlaySummaryOne:
      "1 engagement superposé - les horaires grisés entrent en conflit avec votre agenda.",
    overlaySummaryMany:
      "{n} engagements superposés - les horaires grisés entrent en conflit avec votre agenda.",
    loading: "Chargement des disponibilités…",
    noTimes: "Aucun horaire disponible dans les deux prochaines semaines.",
    busyTooltip: "Vous avez déjà quelque chose à cet horaire",
    duration: "Durée",
    durationMin: "{n} min",
    back: "Retour",
    yourName: "Votre nom",
    email: "E-mail",
    guestsOptional: "Invités (facultatif)",
    add: "Ajouter",
    notesOptional: "Notes (facultatif)",
    notesPlaceholder: "Quelque chose à partager avant la réunion ?",
    selectPlaceholder: "Sélectionner…",
    confirming: "Confirmation…",
    confirmBooking: "Confirmer la réservation",
    payAndBook: "Payer {price} et réserver",
    pleaseAnswer: "Veuillez répondre : {label}",
    bookingFailed: "Impossible de confirmer la réservation",
    minutes: "{n} minutes",
    deposit: "acompte",
    accessHint: "Cette page de réservation est protégée.",
    accessRequired: "Code d’accès",
    accessSubmit: "Continuer",
    accessWrong: "Ce code est incorrect.",
  },
  de: {
    selectTime: "Wähle eine Uhrzeit",
    recommended: "Empfohlene Zeiten",
    timesIn: "Zeiten in {zone}",
    overlayCta: "Meinen Kalender einblenden",
    overlayHelp:
      "Füge die geheime iCal-(ICS-)Adresse deines Kalenders ein, um belegte Zeiten auszugrauen. Sie wird einmal gelesen und nie gespeichert.",
    overlayApply: "Einblenden",
    overlayReading: "Lädt…",
    overlayClear: "Löschen",
    overlaySummaryOne:
      "1 Termin eingeblendet - ausgegraute Zeiten kollidieren mit deinem Kalender.",
    overlaySummaryMany:
      "{n} Termine eingeblendet - ausgegraute Zeiten kollidieren mit deinem Kalender.",
    loading: "Verfügbarkeit wird geladen…",
    noTimes: "In den nächsten zwei Wochen sind keine Zeiten verfügbar.",
    busyTooltip: "Du hast zu dieser Zeit bereits etwas im Kalender",
    duration: "Dauer",
    durationMin: "{n} Min.",
    back: "Zurück",
    yourName: "Dein Name",
    email: "E-Mail",
    guestsOptional: "Gäste (optional)",
    add: "Hinzufügen",
    notesOptional: "Notizen (optional)",
    notesPlaceholder: "Etwas, das du vor dem Meeting teilen möchtest?",
    selectPlaceholder: "Auswählen…",
    confirming: "Wird bestätigt…",
    confirmBooking: "Buchung bestätigen",
    payAndBook: "{price} zahlen & buchen",
    pleaseAnswer: "Bitte beantworten: {label}",
    bookingFailed: "Buchung konnte nicht bestätigt werden",
    minutes: "{n} Minuten",
    deposit: "Anzahlung",
    accessHint: "Diese Buchungsseite ist geschützt.",
    accessRequired: "Zugangscode",
    accessSubmit: "Weiter",
    accessWrong: "Dieser Code stimmt nicht.",
  },
  pt: {
    selectTime: "Escolha um horário",
    recommended: "Horários recomendados",
    timesIn: "Horários em {zone}",
    overlayCta: "Sobrepor meu calendário",
    overlayHelp:
      "Cole o endereço iCal (ICS) secreto do seu calendário para esmaecer os horários em que você já está ocupado. É lido uma vez e nunca armazenado.",
    overlayApply: "Sobrepor",
    overlayReading: "Lendo…",
    overlayClear: "Limpar",
    overlaySummaryOne:
      "1 compromisso sobreposto - horários esmaecidos conflitam com seu calendário.",
    overlaySummaryMany:
      "{n} compromissos sobrepostos - horários esmaecidos conflitam com seu calendário.",
    loading: "Carregando disponibilidade…",
    noTimes: "Nenhum horário disponível nas próximas duas semanas.",
    busyTooltip: "Você já tem algo no calendário nesse horário",
    duration: "Duração",
    durationMin: "{n} min",
    back: "Voltar",
    yourName: "Seu nome",
    email: "E-mail",
    guestsOptional: "Convidados (opcional)",
    add: "Adicionar",
    notesOptional: "Notas (opcional)",
    notesPlaceholder: "Algo para compartilhar antes da reunião?",
    selectPlaceholder: "Selecionar…",
    confirming: "Confirmando…",
    confirmBooking: "Confirmar agendamento",
    payAndBook: "Pagar {price} e agendar",
    pleaseAnswer: "Por favor responda: {label}",
    bookingFailed: "Não foi possível confirmar o agendamento",
    minutes: "{n} minutos",
    deposit: "sinal",
    accessHint: "Esta página de agendamento é protegida.",
    accessRequired: "Código de acesso",
    accessSubmit: "Continuar",
    accessWrong: "Esse código não está correto.",
  },
};

/** Map a browser/Accept-Language value (e.g. "es-419,es;q=0.9") to a supported locale. */
export function resolveLocale(input: string | null | undefined): Locale {
  if (!input) return DEFAULT_LOCALE;
  for (const part of input.split(",")) {
    const tag = part.trim().split(";")[0]?.toLowerCase() ?? "";
    const base = tag.split("-")[0] as Locale;
    if (SUPPORTED_LOCALES.includes(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** Translate a booking-surface key, interpolating `{name}` placeholders. */
export function t(locale: Locale, key: BookingKey, vars?: Record<string, string | number>): string {
  const s = (MESSAGES[locale] ?? MESSAGES.en)[key] ?? MESSAGES.en[key];
  return vars ? s.replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? `{${k}}`)) : s;
}
