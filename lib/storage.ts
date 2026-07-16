import AsyncStorage from '@react-native-async-storage/async-storage';

import type { StorageSchema } from '@/types/models';

// AsyncStorage over SQLite: every collection here is small (tens of items),
// always read whole, and never queried relationally — JSON blobs behind a typed
// API are simpler and require no extra dependency. If V2 outgrows this (e.g.
// heavy analytics over TriggerLogs), swap the internals of this file for
// expo-sqlite; the exported API surface is the contract screens depend on.

const KEY_PREFIX = 'redirect/';
const VERSION_KEY = `${KEY_PREFIX}schemaVersion`;
const SCHEMA_VERSION = 2;

// Keys whose values are arrays of { id } items, usable with the collection helpers.
type CollectionKey = {
  [K in keyof StorageSchema]: StorageSchema[K] extends { id: string }[] ? K : never;
}[keyof StorageSchema];

export async function getItem<K extends keyof StorageSchema>(
  key: K
): Promise<StorageSchema[K] | null> {
  const raw = await AsyncStorage.getItem(KEY_PREFIX + key);
  if (raw === null) return null;
  return JSON.parse(raw) as StorageSchema[K];
}

export async function setItem<K extends keyof StorageSchema>(
  key: K,
  value: StorageSchema[K]
): Promise<void> {
  await AsyncStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
}

export async function getCollection<K extends CollectionKey>(key: K): Promise<StorageSchema[K]> {
  return (await getItem(key)) ?? ([] as unknown as StorageSchema[K]);
}

export async function upsertInCollection<K extends CollectionKey>(
  key: K,
  item: StorageSchema[K][number]
): Promise<void> {
  const items = (await getCollection(key)) as StorageSchema[K][number][];
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index >= 0) {
    items[index] = item;
  } else {
    items.push(item);
  }
  await setItem(key, items as StorageSchema[K]);
}

export async function removeFromCollection<K extends CollectionKey>(
  key: K,
  id: string
): Promise<void> {
  const items = (await getCollection(key)) as StorageSchema[K][number][];
  await setItem(key, items.filter((item) => item.id !== id) as StorageSchema[K]);
}

// Dev-only full reset: removes every key this app owns, including the
// schemaVersion stamp, so the next launch is indistinguishable from a fresh
// install. Image files on disk are lib/images.ts#deleteAllImageFiles's job.
export async function clearAllData(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((key) => key.startsWith(KEY_PREFIX)));
}

// Ordered map of migrations to run when the stored version is older than
// SCHEMA_VERSION, e.g. { 2: migrateV1toV2 }. V2 shape changes land here instead
// of as ad-hoc parsing guards scattered through the app.
const MIGRATIONS: Record<number, () => Promise<void>> = {
  // V2 (goals-first model): failure points gain goalIds. A migration can't
  // invent goals, so V1 patterns start unlinked; the Plans tab requires a goal
  // link on next edit.
  2: async () => {
    const failurePoints = await getItem('failurePoints');
    if (!failurePoints) return;
    await setItem(
      'failurePoints',
      // Stored V1 items predate the goalIds field the type now requires.
      failurePoints.map((fp) => ({ ...fp, goalIds: fp.goalIds ?? [] }))
    );
  },
};

// Called once at app start (hooks/use-onboarding-status.tsx load effect), before
// any other storage read.
export async function runMigrations(): Promise<void> {
  const raw = await AsyncStorage.getItem(VERSION_KEY);
  const storedVersion = raw === null ? SCHEMA_VERSION : (JSON.parse(raw) as number);
  for (let v = storedVersion + 1; v <= SCHEMA_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (migrate) await migrate();
  }
  if (raw === null || storedVersion !== SCHEMA_VERSION) {
    await AsyncStorage.setItem(VERSION_KEY, JSON.stringify(SCHEMA_VERSION));
  }
}
