import { ApiError, api, getServerUrl } from "@/api";
import { Loading } from "@/components/ui";
import {
  type BookingQuestion,
  CURRENCIES,
  CURRENCY_SYMBOL,
  type Currency,
  EVENT_COLOR_HEX,
  type EventColor,
  type EventTypeDetail,
  type LocationType,
  type QuestionType,
} from "@/models";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

const DURATIONS = [15, 30, 45, 60];

const LOCATIONS: { value: LocationType; label: string }[] = [
  { value: "google_meet", label: "Google Meet" },
  { value: "ms_teams", label: "Teams" },
  { value: "zoom", label: "Zoom" },
  { value: "phone", label: "Phone" },
  { value: "in_person", label: "In person" },
  { value: "custom", label: "Custom" },
];
const NEEDS_DETAIL: LocationType[] = ["zoom", "phone", "in_person", "custom"];

const NOTICE_OPTIONS = [
  { value: 0, label: "None" },
  { value: 60, label: "1h" },
  { value: 120, label: "2h" },
  { value: 240, label: "4h" },
  { value: 720, label: "12h" },
  { value: 1440, label: "1d" },
];

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "select", label: "Select" },
  { value: "checkbox", label: "Check" },
];

function slugify(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function newId() {
  return `q_${Math.random().toString(36).slice(2, 10)}`;
}

export default function EventTypeForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(params.id);

  const [loading, setLoading] = useState(isEdit);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [duration, setDuration] = useState(30);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<LocationType>("google_meet");
  const [locationDetail, setLocationDetail] = useState("");
  const [bufferBefore, setBufferBefore] = useState("0");
  const [bufferAfter, setBufferAfter] = useState("0");
  const [minimumNotice, setMinimumNotice] = useState(60);
  const [bookingWindow, setBookingWindow] = useState("60");
  const [dailyLimitOn, setDailyLimitOn] = useState(false);
  const [dailyLimit, setDailyLimit] = useState("5");
  const [weeklyLimitOn, setWeeklyLimitOn] = useState(false);
  const [weeklyLimit, setWeeklyLimit] = useState("20");
  const [monthlyLimitOn, setMonthlyLimitOn] = useState(false);
  const [monthlyLimit, setMonthlyLimit] = useState("60");
  const [yearlyLimitOn, setYearlyLimitOn] = useState(false);
  const [yearlyLimit, setYearlyLimit] = useState("500");
  const [groupOn, setGroupOn] = useState(false);
  const [maxAttendees, setMaxAttendees] = useState("2");
  const [recurringOn, setRecurringOn] = useState(false);
  const [recurringCount, setRecurringCount] = useState("4");
  const [recurringFrequency, setRecurringFrequency] = useState<"weekly" | "biweekly" | "monthly">(
    "weekly",
  );
  const [accessCodeOn, setAccessCodeOn] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [hadAccessCode, setHadAccessCode] = useState(false);
  // Extra locations beyond the primary above (multi-location; #103). Each booker
  // picks one on the booking page. The primary + these form the offered menu.
  const [extraLocations, setExtraLocations] = useState<{ type: LocationType; detail: string }[]>(
    [],
  );
  const [isPrivate, setIsPrivate] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState("");
  const [color, setColor] = useState<EventColor>("violet");
  const [minGap, setMinGap] = useState("0");
  const [offsetStart, setOffsetStart] = useState("0");
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [durationOptions, setDurationOptions] = useState<number[]>([]);
  const [questions, setQuestions] = useState<BookingQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [priceOn, setPriceOn] = useState(false);
  const [price, setPrice] = useState(""); // major units, e.g. "25.00"
  const [currency, setCurrency] = useState<Currency>("usd");
  const [depositOn, setDepositOn] = useState(false);
  const [deposit, setDeposit] = useState("");

  // Whether this server has Stripe configured (gates the pricing UI).
  useEffect(() => {
    let active = true;
    api
      .get<{ paymentsEnabled?: boolean }>("/api/me")
      .then((d) => active && setPaymentsEnabled(Boolean(d.paymentsEnabled)))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Load the full event type when editing.
  useEffect(() => {
    if (!params.id) return;
    let active = true;
    api
      .get<{ eventType: EventTypeDetail }>(`/api/event-types/${params.id}`)
      .then(({ eventType: e }) => {
        if (!active) return;
        setTitle(e.title);
        setSlug(e.slug);
        setDuration(e.durationMinutes);
        setDescription(e.description ?? "");
        setLocation(e.location);
        setLocationDetail(e.locationDetail ?? "");
        setBufferBefore(String(e.bufferBeforeMinutes));
        setBufferAfter(String(e.bufferAfterMinutes));
        setMinimumNotice(e.minimumNoticeMinutes);
        setBookingWindow(String(e.bookingWindowDays ?? 60));
        setDailyLimitOn(e.dailyBookingLimit != null && e.dailyBookingLimit > 0);
        setDailyLimit(String(e.dailyBookingLimit ?? 5));
        setWeeklyLimitOn(e.weeklyBookingLimit != null && e.weeklyBookingLimit > 0);
        setWeeklyLimit(String(e.weeklyBookingLimit ?? 20));
        setMonthlyLimitOn(e.monthlyBookingLimit != null && e.monthlyBookingLimit > 0);
        setMonthlyLimit(String(e.monthlyBookingLimit ?? 60));
        setYearlyLimitOn(e.yearlyBookingLimit != null && e.yearlyBookingLimit > 0);
        setYearlyLimit(String(e.yearlyBookingLimit ?? 500));
        setGroupOn((e.maxAttendees ?? 1) > 1);
        setMaxAttendees(String(e.maxAttendees && e.maxAttendees > 1 ? e.maxAttendees : 2));
        setRecurringOn((e.recurringCount ?? 1) > 1);
        setRecurringCount(String(e.recurringCount && e.recurringCount > 1 ? e.recurringCount : 4));
        setRecurringFrequency(e.recurringFrequency ?? "weekly");
        setAccessCodeOn(Boolean(e.hasAccessCode));
        setHadAccessCode(Boolean(e.hasAccessCode));
        // Multi-location: first entry is the primary (already set above); the rest
        // are the extra options a booker can choose from.
        if (e.locations && e.locations.length > 1) {
          setExtraLocations(
            e.locations.slice(1).map((l) => ({ type: l.type, detail: l.detail ?? "" })),
          );
        }
        setIsPrivate(e.isPrivate);
        setRedirectUrl(e.redirectUrl ?? "");
        if (e.color && e.color in EVENT_COLOR_HEX) setColor(e.color as EventColor);
        if (e.price != null && e.price > 0) {
          setPriceOn(true);
          setPrice((e.price / 100).toFixed(2));
        }
        if (e.currency) setCurrency(e.currency as Currency);
        if (e.depositAmount != null && e.depositAmount > 0) {
          setDepositOn(true);
          setDeposit((e.depositAmount / 100).toFixed(2));
        }
        setMinGap(String(e.minimumGapMinutes ?? 0));
        setOffsetStart(String(e.offsetStartMinutes ?? 0));
        setRequiresConfirmation(e.requiresConfirmation ?? false);
        setDurationOptions(e.durationOptions ?? []);
        setQuestions(e.questions ?? []);
      })
      .catch(() => setError("Could not load event type"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [params.id]);

  const needsDetail = NEEDS_DETAIL.includes(location);

  function addQuestion() {
    setQuestions((qs) => [...qs, { id: newId(), label: "", type: "text", required: false }]);
  }
  function patchQuestion(id: string, patch: Partial<BookingQuestion>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }
  function removeQuestion(id: string) {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
  }

  async function save() {
    setSaving(true);
    setError(null);
    // Multi-location: the primary + any extras form the offered menu. An empty
    // menu (no extras) sends [] so the API keeps this as a single-location event.
    const extraClean = extraLocations
      .filter((l) => !NEEDS_DETAIL.includes(l.type) || l.detail.trim().length > 0)
      .map((l) => ({
        type: l.type,
        detail: NEEDS_DETAIL.includes(l.type) ? l.detail.trim() : undefined,
      }));
    const locationsPayload = extraClean.length
      ? [{ type: location, detail: needsDetail ? locationDetail : undefined }, ...extraClean]
      : [];
    // Access code: null removes it, a string sets/replaces it, undefined leaves
    // the stored code untouched.
    let accessCodePayload: string | null | undefined;
    if (!accessCodeOn && hadAccessCode) accessCodePayload = null;
    else if (accessCodeOn && accessCode.trim()) accessCodePayload = accessCode.trim();

    const body = {
      title,
      slug: slug || slugify(title),
      durationMinutes: duration,
      description: description || undefined,
      location,
      locationDetail: needsDetail ? locationDetail : undefined,
      locations: locationsPayload,
      weeklyBookingLimit: weeklyLimitOn ? Number(weeklyLimit) || 1 : null,
      monthlyBookingLimit: monthlyLimitOn ? Number(monthlyLimit) || 1 : null,
      yearlyBookingLimit: yearlyLimitOn ? Number(yearlyLimit) || 1 : null,
      maxAttendees: groupOn ? Math.max(2, Number(maxAttendees) || 2) : 1,
      recurringCount: recurringOn ? Math.max(2, Number(recurringCount) || 2) : 1,
      recurringFrequency,
      ...(accessCodePayload === undefined ? {} : { accessCode: accessCodePayload }),
      bufferBeforeMinutes: Number(bufferBefore) || 0,
      bufferAfterMinutes: Number(bufferAfter) || 0,
      minimumNoticeMinutes: minimumNotice,
      bookingWindowDays: Number(bookingWindow) || 60,
      minimumGapMinutes: Number(minGap) || 0,
      offsetStartMinutes: Number(offsetStart) || 0,
      requiresConfirmation,
      durationOptions: durationOptions.length ? [...durationOptions].sort((a, b) => a - b) : null,
      dailyBookingLimit: dailyLimitOn ? Number(dailyLimit) || 1 : null,
      isPrivate,
      redirectUrl: redirectUrl.trim() || null,
      color,
      price: priceOn ? Math.round((Number(price) || 0) * 100) : null,
      currency,
      depositAmount: priceOn && depositOn ? Math.round((Number(deposit) || 0) * 100) : null,
      questions: questions
        .filter((q) => q.label.trim().length > 0)
        .map((q) => ({
          id: q.id,
          label: q.label.trim(),
          type: q.type,
          required: q.required,
          options:
            q.type === "select"
              ? (q.options ?? []).map((o) => o.trim()).filter(Boolean)
              : undefined,
        })),
    };
    try {
      if (isEdit) await api.put(`/api/event-types/${params.id}`, body);
      else await api.post("/api/event-types", body);
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save");
      setSaving(false);
    }
  }

  async function remove() {
    if (!params.id) return;
    setSaving(true);
    try {
      await api.del(`/api/event-types/${params.id}`);
      router.back();
    } catch {
      setError("Could not delete");
      setSaving(false);
    }
  }

  async function createLink() {
    if (!params.id) return;
    setCreatingLink(true);
    try {
      const res = await api.post<{ url: string }>(`/api/event-types/${params.id}/links`, {
        maxUses: 1,
      });
      setLinkUrl(`${getServerUrl()}${res.url}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create a link");
    } finally {
      setCreatingLink(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <View style={styles.safe}>
      <Stack.Screen
        options={{ headerShown: true, title: isEdit ? "Edit event type" : "New event type" }}
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Field
          label="Title"
          value={title}
          onChange={(v) => {
            setTitle(v);
            if (!slugTouched) setSlug(slugify(v));
          }}
          placeholder="Intro call"
        />
        <Field
          label="URL slug"
          value={slug}
          onChange={(v) => {
            setSlugTouched(true);
            setSlug(slugify(v));
          }}
          placeholder="intro-call"
          hint={`Link: /your-handle/${slug || "intro-call"}`}
        />

        <Text style={styles.label}>Duration</Text>
        <View style={styles.pills}>
          {DURATIONS.map((d) => (
            <Pressable
              key={d}
              onPress={() => setDuration(d)}
              style={[styles.pill, d === duration && styles.pillOn]}
            >
              <Text style={[styles.pillText, d === duration && styles.pillTextOn]}>{d}m</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Location</Text>
        <View style={styles.wrapPills}>
          {LOCATIONS.map((l) => (
            <Pressable
              key={l.value}
              onPress={() => setLocation(l.value)}
              style={[styles.chip, l.value === location && styles.pillOn]}
            >
              <Text style={[styles.pillText, l.value === location && styles.pillTextOn]}>
                {l.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {needsDetail ? (
          <Field
            label="Location details"
            value={locationDetail}
            onChange={setLocationDetail}
            placeholder="Link, number, or address"
          />
        ) : (
          <View style={{ height: 18 }} />
        )}

        {/* Extra locations the booker can choose from (multi-location). */}
        {extraLocations.map((row, i) => {
          const rowNeedsDetail = NEEDS_DETAIL.includes(row.type);
          return (
            <View key={`loc-${i}`} style={styles.extraLoc}>
              <View style={styles.extraLocHead}>
                <Text style={styles.hint}>Alternative location {i + 1}</Text>
                <Pressable
                  onPress={() => setExtraLocations((ls) => ls.filter((_, j) => j !== i))}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={20} color={colors.faint} />
                </Pressable>
              </View>
              <View style={styles.wrapPills}>
                {LOCATIONS.map((l) => {
                  // Each location type can appear once (the API rejects duplicates),
                  // so disable a type already used by the primary or another row.
                  const usedElsewhere =
                    l.value !== row.type &&
                    (l.value === location ||
                      extraLocations.some((r, j) => j !== i && r.type === l.value));
                  return (
                    <Pressable
                      key={l.value}
                      disabled={usedElsewhere}
                      onPress={() =>
                        setExtraLocations((ls) =>
                          ls.map((r, j) => (j === i ? { ...r, type: l.value } : r)),
                        )
                      }
                      style={[
                        styles.chip,
                        l.value === row.type && styles.pillOn,
                        usedElsewhere && { opacity: 0.35 },
                      ]}
                    >
                      <Text style={[styles.pillText, l.value === row.type && styles.pillTextOn]}>
                        {l.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {rowNeedsDetail ? (
                <TextInput
                  style={styles.input}
                  value={row.detail}
                  onChangeText={(v) =>
                    setExtraLocations((ls) => ls.map((r, j) => (j === i ? { ...r, detail: v } : r)))
                  }
                  placeholder="Link, number, or address"
                  placeholderTextColor={colors.faint}
                />
              ) : null}
            </View>
          );
        })}
        {extraLocations.length < LOCATIONS.length - 1 ? (
          <Pressable
            onPress={() =>
              setExtraLocations((ls) => {
                const used = new Set<LocationType>([location, ...ls.map((r) => r.type)]);
                const next = LOCATIONS.find((l) => !used.has(l.value))?.value ?? "phone";
                return [...ls, { type: next, detail: "" }];
              })
            }
            style={styles.addLoc}
          >
            <Ionicons name="add" size={16} color={colors.accent} />
            <Text style={styles.addLocText}>Add another location</Text>
          </Pressable>
        ) : null}

        <Field
          label="Description (optional)"
          value={description}
          onChange={setDescription}
          placeholder="What's this meeting about?"
          multiline
        />

        <Text style={styles.section}>Scheduling rules</Text>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Field
              label="Buffer before (min)"
              value={bufferBefore}
              onChange={setBufferBefore}
              placeholder="0"
              numeric
            />
          </View>
          <View style={styles.rowItem}>
            <Field
              label="Buffer after (min)"
              value={bufferAfter}
              onChange={setBufferAfter}
              placeholder="0"
              numeric
            />
          </View>
        </View>

        <Text style={styles.label}>Minimum notice</Text>
        <View style={styles.wrapPills}>
          {NOTICE_OPTIONS.map((o) => (
            <Pressable
              key={o.value}
              onPress={() => setMinimumNotice(o.value)}
              style={[styles.chip, o.value === minimumNotice && styles.pillOn]}
            >
              <Text style={[styles.pillText, o.value === minimumNotice && styles.pillTextOn]}>
                {o.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Field
          label="Bookable up to (days out)"
          value={bookingWindow}
          onChange={setBookingWindow}
          placeholder="60"
          numeric
        />

        <Field
          label="Gap between bookings (min)"
          value={minGap}
          onChange={setMinGap}
          placeholder="0"
          numeric
        />

        <Field
          label="Offset slot start (min)"
          value={offsetStart}
          onChange={setOffsetStart}
          placeholder="0"
          numeric
        />

        <Text style={styles.label}>Offer multiple durations</Text>
        <View style={styles.wrapPills}>
          {[15, 30, 45, 60, 90, 120].map((d) => {
            const on = durationOptions.includes(d);
            return (
              <Pressable
                key={d}
                onPress={() =>
                  setDurationOptions((prev) =>
                    prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                  )
                }
                style={[styles.chip, on && styles.pillOn]}
              >
                <Text style={[styles.pillText, on && styles.pillTextOn]}>{d}m</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.label}>Limit bookings per day</Text>
            <Text style={styles.hint}>Cap how many times this can be booked in a day.</Text>
          </View>
          <Switch
            value={dailyLimitOn}
            onValueChange={setDailyLimitOn}
            trackColor={{ true: colors.accent }}
          />
        </View>
        {dailyLimitOn ? (
          <Field
            label="Max bookings per day"
            value={dailyLimit}
            onChange={setDailyLimit}
            placeholder="5"
            numeric
          />
        ) : null}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.label}>Limit bookings per week</Text>
          </View>
          <Switch
            value={weeklyLimitOn}
            onValueChange={setWeeklyLimitOn}
            trackColor={{ true: colors.accent }}
          />
        </View>
        {weeklyLimitOn ? (
          <Field
            label="Max bookings per week"
            value={weeklyLimit}
            onChange={setWeeklyLimit}
            placeholder="20"
            numeric
          />
        ) : null}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.label}>Limit bookings per month</Text>
          </View>
          <Switch
            value={monthlyLimitOn}
            onValueChange={setMonthlyLimitOn}
            trackColor={{ true: colors.accent }}
          />
        </View>
        {monthlyLimitOn ? (
          <Field
            label="Max bookings per month"
            value={monthlyLimit}
            onChange={setMonthlyLimit}
            placeholder="60"
            numeric
          />
        ) : null}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.label}>Limit bookings per year</Text>
          </View>
          <Switch
            value={yearlyLimitOn}
            onValueChange={setYearlyLimitOn}
            trackColor={{ true: colors.accent }}
          />
        </View>
        {yearlyLimitOn ? (
          <Field
            label="Max bookings per year"
            value={yearlyLimit}
            onChange={setYearlyLimit}
            placeholder="500"
            numeric
          />
        ) : null}

        <Text style={styles.section}>Advanced</Text>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.label}>Private</Text>
            <Text style={styles.hint}>
              Hidden from your public page. Still bookable by direct link.
            </Text>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={setIsPrivate}
            trackColor={{ true: colors.accent }}
          />
        </View>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.label}>Requires confirmation</Text>
            <Text style={styles.hint}>
              Each booking waits as a request until you approve or decline it.
            </Text>
          </View>
          <Switch
            value={requiresConfirmation}
            onValueChange={setRequiresConfirmation}
            trackColor={{ true: colors.accent }}
          />
        </View>

        {/* Group event: several attendees share one slot. */}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.label}>Group event</Text>
            <Text style={styles.hint}>Let several people book the same time slot.</Text>
          </View>
          <Switch value={groupOn} onValueChange={setGroupOn} trackColor={{ true: colors.accent }} />
        </View>
        {groupOn ? (
          <Field
            label="Max attendees per slot"
            value={maxAttendees}
            onChange={setMaxAttendees}
            placeholder="2"
            numeric
          />
        ) : null}

        {/* Recurring: repeat the meeting on a cadence. */}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.label}>Recurring</Text>
            <Text style={styles.hint}>Book a repeating series in one go.</Text>
          </View>
          <Switch
            value={recurringOn}
            onValueChange={setRecurringOn}
            trackColor={{ true: colors.accent }}
          />
        </View>
        {recurringOn ? (
          <>
            <Field
              label="Number of sessions"
              value={recurringCount}
              onChange={setRecurringCount}
              placeholder="4"
              numeric
            />
            <Text style={styles.label}>Frequency</Text>
            <View style={styles.pills}>
              {(["weekly", "biweekly", "monthly"] as const).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setRecurringFrequency(f)}
                  style={[styles.chip, f === recurringFrequency && styles.pillOn]}
                >
                  <Text style={[styles.pillText, f === recurringFrequency && styles.pillTextOn]}>
                    {f === "biweekly" ? "Every 2 weeks" : f === "monthly" ? "Monthly" : "Weekly"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {/* Access code: gate booking behind a shared code. */}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.label}>Require an access code</Text>
            <Text style={styles.hint}>Only people with the code can book.</Text>
          </View>
          <Switch
            value={accessCodeOn}
            onValueChange={setAccessCodeOn}
            trackColor={{ true: colors.accent }}
          />
        </View>
        {accessCodeOn ? (
          <Field
            label={hadAccessCode ? "New access code (leave blank to keep current)" : "Access code"}
            value={accessCode}
            onChange={setAccessCode}
            placeholder={hadAccessCode ? "••••••" : "e.g. vip-2026"}
          />
        ) : null}

        <Field
          label="Redirect after booking (optional)"
          value={redirectUrl}
          onChange={setRedirectUrl}
          placeholder="https://example.com/thanks"
          hint="Send bookers here instead of the DayOtter confirmation."
        />

        <Text style={styles.label}>Colour</Text>
        <View style={styles.swatches}>
          {(Object.keys(EVENT_COLOR_HEX) as EventColor[]).map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[
                styles.swatch,
                { backgroundColor: EVENT_COLOR_HEX[c] },
                color === c && styles.swatchOn,
              ]}
            />
          ))}
        </View>

        <Text style={styles.section}>Booking questions</Text>
        {questions.map((q) => (
          <View key={q.id} style={styles.qCard}>
            <View style={styles.qHeader}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={q.label}
                onChangeText={(v) => patchQuestion(q.id, { label: v })}
                placeholder="Question label"
                placeholderTextColor={colors.faint}
              />
              <Pressable onPress={() => removeQuestion(q.id)} style={styles.qRemove}>
                <Text style={{ color: colors.danger, fontWeight: "600" }}>✕</Text>
              </Pressable>
            </View>
            <View style={styles.wrapPills}>
              {QUESTION_TYPES.map((t) => (
                <Pressable
                  key={t.value}
                  onPress={() => patchQuestion(q.id, { type: t.value })}
                  style={[styles.chipSm, t.value === q.type && styles.pillOn]}
                >
                  <Text style={[styles.pillTextSm, t.value === q.type && styles.pillTextOn]}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {q.type === "select" ? (
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                value={(q.options ?? []).join(", ")}
                onChangeText={(v) => patchQuestion(q.id, { options: v.split(",") })}
                placeholder="Option 1, Option 2"
                placeholderTextColor={colors.faint}
              />
            ) : null}
            <View style={styles.qRequired}>
              <Text style={{ color: colors.muted }}>Required</Text>
              <Switch
                value={q.required}
                onValueChange={(v) => patchQuestion(q.id, { required: v })}
                trackColor={{ true: colors.accent }}
              />
            </View>
          </View>
        ))}
        <Pressable onPress={addQuestion} style={styles.addQ}>
          <Text style={{ color: colors.accent, fontWeight: "600" }}>+ Add question</Text>
        </Pressable>

        {paymentsEnabled ? (
          <View style={styles.priceBox}>
            <View style={styles.priceHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkTitle}>Require payment</Text>
                <Text style={styles.linkHint}>Collect a fee when someone books.</Text>
              </View>
              <Switch value={priceOn} onValueChange={setPriceOn} />
            </View>
            {priceOn ? (
              <>
                <View style={styles.priceRow}>
                  <View style={styles.currencyPills}>
                    {CURRENCIES.map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => setCurrency(c)}
                        style={[styles.curPill, c === currency && styles.curPillOn]}
                      >
                        <Text style={[styles.curText, c === currency && styles.curTextOn]}>
                          {CURRENCY_SYMBOL[c]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.priceInputRow}>
                  <Text style={styles.priceLabel}>Price</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={price}
                    onChangeText={(v) => setPrice(v.replace(/[^0-9.]/g, ""))}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.faint}
                  />
                </View>
                <View style={styles.priceHead}>
                  <Text style={styles.priceLabel}>Take a deposit only</Text>
                  <Switch value={depositOn} onValueChange={setDepositOn} />
                </View>
                {depositOn ? (
                  <View style={styles.priceInputRow}>
                    <Text style={styles.priceLabel}>Deposit</Text>
                    <TextInput
                      style={styles.priceInput}
                      value={deposit}
                      onChangeText={(v) => setDeposit(v.replace(/[^0-9.]/g, ""))}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={colors.faint}
                    />
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

        {isEdit ? (
          <View style={styles.linkBox}>
            <Text style={styles.linkTitle}>One-off booking link</Text>
            <Text style={styles.linkHint}>
              A single-use link to share privately - expires after one booking.
            </Text>
            {linkUrl ? (
              <Text selectable style={styles.linkUrl}>
                {linkUrl}
              </Text>
            ) : null}
            <Pressable style={styles.linkBtn} onPress={createLink} disabled={creatingLink}>
              <Text style={styles.linkBtnText}>
                {creatingLink ? "Creating…" : linkUrl ? "Create another" : "Create link"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.save} onPress={save} disabled={saving || !title}>
          <Text style={styles.saveText}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create event type"}
          </Text>
        </Pressable>
        {isEdit ? (
          <Pressable onPress={remove} disabled={saving} style={styles.delete}>
            <Text style={styles.deleteText}>Delete event type</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  numeric?: boolean;
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={[styles.input, props.multiline && { height: 90, textAlignVertical: "top" }]}
        value={props.value}
        onChangeText={props.onChange}
        placeholder={props.placeholder}
        placeholderTextColor={colors.faint}
        autoCapitalize={props.multiline ? "sentences" : "none"}
        multiline={props.multiline}
        keyboardType={props.numeric ? "number-pad" : "default"}
      />
      {props.hint ? <Text style={styles.hint}>{props.hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  label: { fontWeight: "500", fontSize: 14, marginBottom: 6, color: colors.text },
  section: {
    fontWeight: "600",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.faint,
    marginTop: 8,
    marginBottom: 12,
  },
  hint: { color: colors.faint, fontSize: 12, marginTop: 6 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  pills: { flexDirection: "row", gap: 8, marginBottom: 18 },
  wrapPills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  pill: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipSm: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  pillOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  pillText: { color: colors.muted },
  pillTextSm: { color: colors.muted, fontSize: 13 },
  pillTextOn: { color: colors.text, fontWeight: "600" },
  row: { flexDirection: "row", gap: 12 },
  rowItem: { flex: 1 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  extraLoc: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 12,
  },
  extraLocHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  addLoc: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 18 },
  addLocText: { color: colors.accent, fontWeight: "600", fontSize: 14 },
  swatches: { flexDirection: "row", gap: 12, marginBottom: 18 },
  swatch: { width: 34, height: 34, borderRadius: 999 },
  swatchOn: { borderWidth: 3, borderColor: colors.text },
  qCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 12,
  },
  qHeader: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 8 },
  qRemove: { padding: 8 },
  qRequired: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  addQ: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  error: { color: colors.danger, marginBottom: 12 },
  linkBox: {
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 20,
  },
  priceBox: {
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 20,
  },
  priceHead: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  priceRow: { marginTop: 12 },
  currencyPills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  curPill: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  curPillOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  curText: { color: colors.muted, fontWeight: "600" },
  curTextOn: { color: colors.text },
  priceInputRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  priceLabel: { color: colors.text, fontSize: 14, flex: 1 },
  priceInput: {
    minWidth: 100,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlign: "right",
  },
  linkTitle: { color: colors.text, fontWeight: "600" },
  linkHint: { color: colors.muted, fontSize: 12, marginTop: 2 },
  linkUrl: { color: colors.accent, fontSize: 13, marginTop: 10, fontFamily: "Courier" },
  linkBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: "center",
  },
  linkBtnText: { color: colors.text, fontWeight: "500" },
  save: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveText: { color: colors.white, fontWeight: "600", fontSize: 15 },
  delete: { marginTop: 16, alignItems: "center" },
  deleteText: { color: colors.danger },
});
