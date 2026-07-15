import { decrypt, encrypt } from "@dayotter/core";
import { and, eq, getDb, schema } from "@dayotter/db";
import type { PluginStorage } from "@dayotter/plugin-sdk";

/**
 * A PluginStorage backed by the `plugin_data` table, scoped to one plugin id and
 * one user. Values are JSON; secrets are AES-256-GCM encrypted at rest. Every
 * query is filtered to (pluginId, userId), so a plugin can only ever touch its
 * own rows.
 */
export function createStorage(pluginId: string, userId: string): PluginStorage {
  const scope = () =>
    and(eq(schema.pluginData.pluginId, pluginId), eq(schema.pluginData.userId, userId));

  async function upsert(key: string, fields: { value?: unknown; secret?: string | null }) {
    await getDb()
      .insert(schema.pluginData)
      .values({ pluginId, userId, key, ...fields })
      .onConflictDoUpdate({
        target: [schema.pluginData.pluginId, schema.pluginData.userId, schema.pluginData.key],
        set: fields,
      });
  }

  return {
    async get<T = unknown>(key: string): Promise<T | null> {
      const row = await getDb().query.pluginData.findFirst({
        where: and(scope(), eq(schema.pluginData.key, key)),
        columns: { value: true },
      });
      return (row?.value ?? null) as T | null;
    },
    async set(key, value) {
      await upsert(key, { value });
    },
    async delete(key) {
      await getDb()
        .delete(schema.pluginData)
        .where(and(scope(), eq(schema.pluginData.key, key)));
    },
    async list<T = unknown>(prefix?: string) {
      const rows = await getDb().query.pluginData.findMany({
        where: scope(),
        columns: { key: true, value: true },
      });
      return rows
        .filter((r) => (prefix ? r.key.startsWith(prefix) : true))
        .map((r) => ({ key: r.key, value: r.value as T }));
    },
    async getSecret(key) {
      const row = await getDb().query.pluginData.findFirst({
        where: and(scope(), eq(schema.pluginData.key, key)),
        columns: { secret: true },
      });
      return row?.secret ? decrypt(row.secret) : null;
    },
    async setSecret(key, value) {
      await upsert(key, { secret: encrypt(value) });
    },
  };
}
