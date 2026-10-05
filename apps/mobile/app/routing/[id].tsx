import { ApiError, api, getServerUrl } from "@/api";
import { ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

/** A question on a routing form (mirrors @dayotter/db RoutingField). */
interface RoutingField {
  id: string;
  label: string;
  type: "select" | "text" | "email";
  options?: string[];
  required?: boolean;
}

/** One ordered rule (mirrors @dayotter/db RoutingRoute). */
interface RoutingRoute {
  id: string;
  fieldId: string;
  equals: string;
  eventTypeId: string;
}

/** A routing target the host owns (subset of the event type record). */
interface EventTypeOpt {
  id: string;
  title: string;
  slug?: string;
}

/** GET /api/routing/[id] shape (mirrors getFormForHost + hostEventTypes). */
interface RoutingFormDetail {
  id: string;
  title: string;
  description: string | null;
  token: string;
  isActive: boolean;
  fields: RoutingField[];
  routes: RoutingRoute[];
  fallbackEventTypeId: string | null;
  responseCount: number;
  eventTypes: EventTypeOpt[];
}

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/**
 * The detail GET may return the form directly or a `{ form, eventTypes }`
 * wrapper. Normalize both, and derive the response count / event-type list from
 * whatever the payload carries.
 */
function normalizeDetail(res: unknown): RoutingFormDetail {
  const root = (res ?? {}) as Record<string, unknown>;
  const f = (root.form && typeof root.form === "object" ? root.form : root) as Record<
    string,
    unknown
  >;
  const responsesArr = asArray<unknown>(f.responses);
  const responseCount = typeof f.responseCount === "number" ? f.responseCount : responsesArr.length;
  const eventTypes = asArray<Record<string, unknown>>(root.eventTypes ?? f.eventTypes).map((e) => ({
    id: String(e.id ?? ""),
    title: typeof e.title === "string" ? e.title : "Untitled",
    slug: typeof e.slug === "string" ? e.slug : undefined,
  }));
  return {
    id: String(f.id ?? ""),
    title: typeof f.title === "string" ? f.title : "Untitled form",
    description: typeof f.description === "string" ? f.description : null,
    token: typeof f.token === "string" ? f.token : "",
    isActive: f.isActive !== false,
    fields: asArray<RoutingField>(f.fields),
    routes: asArray<RoutingRoute>(f.routes),
    fallbackEventTypeId: typeof f.fallbackEventTypeId === "string" ? f.fallbackEventTypeId : null,
    responseCount,
    eventTypes,
  };
}

const FIELD_TYPE_LABEL: Record<RoutingField["type"], string> = {
  select: "Choice",
  text: "Short text",
  email: "Email",
};

const FIELD_TYPES: RoutingField["type"][] = ["select", "text", "email"];

const newId = () => `r_${Math.random().toString(36).slice(2, 10)}`;

export default function RoutingFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, loading, error, reload } = useAsync<RoutingFormDetail>(async () => {
    const res = await api.get<unknown>(`/api/routing/${id}`);
    return normalizeDetail(res);
  }, [id]);

  // Editable state; seeded once the form loads.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [fields, setFields] = useState<RoutingField[]>([]);
  const [routes, setRoutes] = useState<RoutingRoute[]>([]);
  const [fallbackId, setFallbackId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (data) {
      setTitle(data.title);
      setDescription(data.description ?? "");
      setActive(data.isActive);
      setFields(data.fields);
      setRoutes(data.routes);
      setFallbackId(data.fallbackEventTypeId);
    }
  }, [data]);

  const publicUrl = data?.token ? `${getServerUrl().replace(/\/$/, "")}/forms/${data.token}` : null;

  const dirty =
    !!data &&
    (title.trim() !== data.title ||
      description.trim() !== (data.description ?? "") ||
      active !== data.isActive ||
      JSON.stringify(fields) !== JSON.stringify(data.fields) ||
      JSON.stringify(routes) !== JSON.stringify(data.routes) ||
      fallbackId !== data.fallbackEventTypeId);

  function addField() {
    setFields((f) => [...f, { id: newId(), label: "", type: "text" }]);
  }
  function patchField(fid: string, patch: Partial<RoutingField>) {
    setFields((f) => f.map((x) => (x.id === fid ? { ...x, ...patch } : x)));
  }
  function removeField(fid: string) {
    setFields((f) => f.filter((x) => x.id !== fid));
    setRoutes((r) => r.filter((x) => x.fieldId !== fid)); // drop rules that referenced it
  }
  function addRoute() {
    setRoutes((r) => [
      ...r,
      {
        id: newId(),
        fieldId: fields[0]?.id ?? "",
        equals: "",
        eventTypeId: data?.eventTypes[0]?.id ?? "",
      },
    ]);
  }
  function patchRoute(rid: string, patch: Partial<RoutingRoute>) {
    setRoutes((r) => r.map((x) => (x.id === rid ? { ...x, ...patch } : x)));
  }
  function removeRoute(rid: string) {
    setRoutes((r) => r.filter((x) => x.id !== rid));
  }

  async function save() {
    if (!data) return;
    const name = title.trim();
    if (!name) {
      Alert.alert("Name required", "Give your form a name.");
      return;
    }
    // Keep only complete entries so the server's schema accepts the payload.
    const cleanFields = fields
      .filter((f) => f.label.trim().length > 0)
      .map((f) => ({
        ...f,
        label: f.label.trim(),
        options:
          f.type === "select" ? (f.options ?? []).map((o) => o.trim()).filter(Boolean) : undefined,
      }));
    const fieldIds = new Set(cleanFields.map((f) => f.id));
    const cleanRoutes = routes.filter(
      (r) => fieldIds.has(r.fieldId) && r.eventTypeId && r.equals.trim().length > 0,
    );
    setSaving(true);
    try {
      await api.put(`/api/routing/${data.id}`, {
        title: name,
        description: description.trim() || null,
        isActive: active,
        fields: cleanFields,
        routes: cleanRoutes,
        fallbackEventTypeId: fallbackId,
      });
      reload();
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof ApiError ? e.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!data) return;
    Alert.alert("Delete form?", data.title, [
      { text: "Keep", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await api.del(`/api/routing/${data.id}`);
            router.back();
          } catch (e) {
            setDeleting(false);
            Alert.alert("Couldn't delete", e instanceof ApiError ? e.message : "Please try again.");
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Routing form" }} />
      {loading && !data ? (
        <Loading />
      ) : error || !data ? (
        <ErrorText message={error ?? "Not found"} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Share + status */}
          {publicUrl ? (
            <View style={styles.shareBox}>
              <Text style={styles.shareLabel}>Public link</Text>
              <Text style={styles.shareUrl} numberOfLines={1}>
                {publicUrl}
              </Text>
              <View style={styles.shareActions}>
                <Pressable
                  style={styles.shareBtn}
                  onPress={() => Linking.openURL(publicUrl)}
                  hitSlop={6}
                >
                  <Ionicons name="open-outline" size={16} color={colors.accent} />
                  <Text style={styles.shareBtnText}>Open</Text>
                </Pressable>
                <Pressable
                  style={styles.shareBtn}
                  onPress={() => Share.share({ message: publicUrl }).catch(() => {})}
                  hitSlop={6}
                >
                  <Ionicons name="share-outline" size={16} color={colors.accent} />
                  <Text style={styles.shareBtnText}>Share</Text>
                </Pressable>
                <Text style={styles.responses}>{data.responseCount} responses</Text>
              </View>
            </View>
          ) : null}

          {/* Editable basics */}
          <Text style={styles.label}>Form name</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Form name"
            placeholderTextColor={colors.faint}
            maxLength={120}
          />

          <Text style={styles.label}>Intro (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Answer a couple of questions and we'll get you to the right person."
            placeholderTextColor={colors.faint}
            multiline
            maxLength={1000}
          />

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Form is live</Text>
              <Text style={styles.toggleSub}>Visitors can only submit a live form.</Text>
            </View>
            <Switch value={active} onValueChange={setActive} />
          </View>

          {/* Questions editor */}
          <Text style={styles.section}>Questions</Text>
          {fields.map((f) => (
            <View key={f.id} style={styles.item}>
              <View style={styles.itemHead}>
                <TextInput
                  style={styles.fieldLabel}
                  value={f.label}
                  onChangeText={(v) => patchField(f.id, { label: v })}
                  placeholder="Question label"
                  placeholderTextColor={colors.faint}
                />
                <Pressable onPress={() => removeField(f.id)} hitSlop={8}>
                  <Ionicons name="close" size={18} color={colors.faint} />
                </Pressable>
              </View>
              <View style={styles.typeRow}>
                {FIELD_TYPES.map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => patchField(f.id, { type: t })}
                    style={[styles.typePill, f.type === t && styles.typePillOn]}
                  >
                    <Text style={[styles.typePillText, f.type === t && styles.typePillTextOn]}>
                      {FIELD_TYPE_LABEL[t]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {f.type === "select" ? (
                <TextInput
                  style={styles.optionsInput}
                  value={(f.options ?? []).join(", ")}
                  onChangeText={(v) =>
                    patchField(f.id, { options: v.split(",").map((o) => o.trimStart()) })
                  }
                  placeholder="Choices, comma-separated"
                  placeholderTextColor={colors.faint}
                />
              ) : null}
              <Pressable
                style={styles.requiredRow}
                onPress={() => patchField(f.id, { required: !f.required })}
              >
                <Switch
                  value={Boolean(f.required)}
                  onValueChange={(v) => patchField(f.id, { required: v })}
                />
                <Text style={styles.requiredText}>Required</Text>
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.addDashed} onPress={addField}>
            <Ionicons name="add" size={16} color={colors.accent} />
            <Text style={styles.addDashedText}>Add question</Text>
          </Pressable>

          {/* Routing rules editor */}
          <Text style={styles.section}>Where answers go</Text>
          <Text style={styles.readonlyNote}>
            Rules are checked top to bottom; the first match wins.
          </Text>
          {routes.map((r) => {
            const field = fields.find((f) => f.id === r.fieldId);
            return (
              <View key={r.id} style={styles.item}>
                <View style={styles.itemHead}>
                  <Text style={styles.ruleLead}>If answer is…</Text>
                  <Pressable onPress={() => removeRoute(r.id)} hitSlop={8}>
                    <Ionicons name="close" size={18} color={colors.faint} />
                  </Pressable>
                </View>
                {/* Which question */}
                <View style={styles.chipRow}>
                  {fields.map((f) => (
                    <Pressable
                      key={f.id}
                      onPress={() => patchRoute(r.id, { fieldId: f.id })}
                      style={[styles.chip, r.fieldId === f.id && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, r.fieldId === f.id && styles.chipTextOn]}>
                        {f.label || "Untitled"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {/* equals value — pills for a choice field, else free text */}
                {field?.type === "select" && (field.options ?? []).length > 0 ? (
                  <View style={styles.chipRow}>
                    {(field.options ?? []).map((opt) => (
                      <Pressable
                        key={opt}
                        onPress={() => patchRoute(r.id, { equals: opt })}
                        style={[styles.chip, r.equals === opt && styles.chipOn]}
                      >
                        <Text style={[styles.chipText, r.equals === opt && styles.chipTextOn]}>
                          {opt || "—"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <TextInput
                    style={styles.optionsInput}
                    value={r.equals}
                    onChangeText={(v) => patchRoute(r.id, { equals: v })}
                    placeholder="equals this answer"
                    placeholderTextColor={colors.faint}
                  />
                )}
                {/* route to which event type */}
                <Text style={styles.ruleLead}>→ book</Text>
                <View style={styles.chipRow}>
                  {data.eventTypes.map((et) => (
                    <Pressable
                      key={et.id}
                      onPress={() => patchRoute(r.id, { eventTypeId: et.id })}
                      style={[styles.chip, r.eventTypeId === et.id && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, r.eventTypeId === et.id && styles.chipTextOn]}>
                        {et.title}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}
          <Pressable
            style={[styles.addDashed, fields.length === 0 && styles.saveDisabled]}
            onPress={addRoute}
            disabled={fields.length === 0}
          >
            <Ionicons name="add" size={16} color={colors.accent} />
            <Text style={styles.addDashedText}>Add rule</Text>
          </Pressable>

          {/* Fallback */}
          <Text style={styles.section}>Otherwise book</Text>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setFallbackId(null)}
              style={[styles.chip, fallbackId === null && styles.chipOn]}
            >
              <Text style={[styles.chipText, fallbackId === null && styles.chipTextOn]}>None</Text>
            </Pressable>
            {data.eventTypes.map((et) => (
              <Pressable
                key={et.id}
                onPress={() => setFallbackId(et.id)}
                style={[styles.chip, fallbackId === et.id && styles.chipOn]}
              >
                <Text style={[styles.chipText, fallbackId === et.id && styles.chipTextOn]}>
                  {et.title}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.save, (!dirty || saving) && styles.saveDisabled]}
            onPress={save}
            disabled={!dirty || saving}
          >
            <Text style={styles.saveText}>{saving ? "Saving…" : "Save changes"}</Text>
          </Pressable>

          <Pressable style={styles.delete} onPress={confirmDelete} disabled={deleting}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.deleteText}>{deleting ? "Deleting…" : "Delete form"}</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  shareBox: {
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 20,
  },
  shareLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  shareUrl: { color: colors.text, fontSize: 13, marginTop: 4 },
  shareActions: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 12 },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  shareBtnText: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  responses: { color: colors.faint, fontSize: 12, marginLeft: "auto" },
  label: { color: colors.muted, fontWeight: "600", marginBottom: 8, fontSize: 13 },
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
    marginBottom: 18,
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 16,
  },
  toggleTitle: { color: colors.text, fontWeight: "600" },
  toggleSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  save: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: colors.white, fontWeight: "600", fontSize: 15 },
  section: { marginTop: 26, marginBottom: 8, fontWeight: "700", color: colors.text, fontSize: 16 },
  readonlyNote: { color: colors.faint, fontSize: 12, marginBottom: 12 },
  item: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
  },
  itemHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  itemTitle: { color: colors.text, fontWeight: "600", flexShrink: 1 },
  itemType: { color: colors.faint, fontSize: 11 },
  itemBody: { color: colors.text, fontSize: 14, marginTop: 6, lineHeight: 20 },
  dim: { color: colors.muted },
  emptyLine: { color: colors.muted, fontSize: 13, marginBottom: 10 },
  fieldLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    paddingVertical: 2,
  },
  typeRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  typePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  typePillOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  typePillText: { color: colors.muted, fontSize: 12 },
  typePillTextOn: { color: colors.text, fontWeight: "600" },
  optionsInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  requiredRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  requiredText: { color: colors.muted, fontSize: 13 },
  addDashed: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: "dashed",
    borderRadius: radius.md,
    paddingVertical: 12,
    marginBottom: 6,
  },
  addDashedText: { color: colors.accent, fontWeight: "600", fontSize: 14 },
  ruleLead: { color: colors.muted, fontSize: 13, marginTop: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { color: colors.muted, fontSize: 12 },
  chipTextOn: { color: colors.text, fontWeight: "600" },
  delete: {
    marginTop: 24,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: 13,
  },
  deleteText: { color: colors.danger, fontWeight: "600" },
});
