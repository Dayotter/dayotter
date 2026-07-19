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

export default function RoutingFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, loading, error, reload } = useAsync<RoutingFormDetail>(async () => {
    const res = await api.get<unknown>(`/api/routing/${id}`);
    return normalizeDetail(res);
  }, [id]);

  // Editable basics; seeded once the form loads.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (data) {
      setTitle(data.title);
      setDescription(data.description ?? "");
      setActive(data.isActive);
    }
  }, [data]);

  const publicUrl = data?.token ? `${getServerUrl().replace(/\/$/, "")}/forms/${data.token}` : null;

  const dirty =
    !!data &&
    (title.trim() !== data.title ||
      description.trim() !== (data.description ?? "") ||
      active !== data.isActive);

  async function save() {
    if (!data) return;
    const name = title.trim();
    if (!name) {
      Alert.alert("Name required", "Give your form a name.");
      return;
    }
    setSaving(true);
    try {
      // PUT replaces the whole form. Preserve the fields/routes/fallback loaded
      // from the server (edited only in the web builder) and change the basics.
      await api.put(`/api/routing/${data.id}`, {
        title: name,
        description: description.trim() || null,
        isActive: active,
        fields: data.fields,
        routes: data.routes,
        fallbackEventTypeId: data.fallbackEventTypeId,
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

  function eventTypeName(eventTypeId: string): string {
    return data?.eventTypes.find((e) => e.id === eventTypeId)?.title ?? "a booking page";
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

          <Pressable
            style={[styles.save, (!dirty || saving) && styles.saveDisabled]}
            onPress={save}
            disabled={!dirty || saving}
          >
            <Text style={styles.saveText}>{saving ? "Saving…" : "Save changes"}</Text>
          </Pressable>

          {/* Read-only: questions */}
          <Text style={styles.section}>Questions</Text>
          <Text style={styles.readonlyNote}>
            Questions and routing rules are edited in the DayOtter web app.
          </Text>
          {data.fields.length > 0 ? (
            data.fields.map((f) => (
              <View key={f.id} style={styles.item}>
                <View style={styles.itemHead}>
                  <Text style={styles.itemTitle} numberOfLines={2}>
                    {f.label || "Untitled question"}
                  </Text>
                  <Text style={styles.itemType}>
                    {FIELD_TYPE_LABEL[f.type]}
                    {f.required ? " · required" : ""}
                  </Text>
                </View>
                {f.type === "select" && f.options && f.options.length > 0 ? (
                  <Text style={styles.itemBody}>{f.options.join(" · ")}</Text>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.emptyLine}>No questions yet.</Text>
          )}

          {/* Read-only: routing rules */}
          <Text style={styles.section}>Where answers go</Text>
          {data.routes.length > 0 ? (
            data.routes.map((r) => {
              const field = data.fields.find((f) => f.id === r.fieldId);
              return (
                <View key={r.id} style={styles.item}>
                  <Text style={styles.itemBody}>
                    <Text style={styles.dim}>If </Text>
                    {field?.label || "a question"}
                    <Text style={styles.dim}> is </Text>“{r.equals}”
                    <Text style={styles.dim}> → </Text>
                    {eventTypeName(r.eventTypeId)}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyLine}>No routing rules yet.</Text>
          )}
          {data.fallbackEventTypeId ? (
            <View style={styles.item}>
              <Text style={styles.itemBody}>
                <Text style={styles.dim}>Otherwise → </Text>
                {eventTypeName(data.fallbackEventTypeId)}
              </Text>
            </View>
          ) : null}

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
