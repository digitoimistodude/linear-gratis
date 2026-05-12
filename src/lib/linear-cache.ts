import { getCloudflareContext } from '@opennextjs/cloudflare';

const DEFAULT_TTL_SECONDS = 600;

function getKV(): KVNamespace | null {
  try {
    return getCloudflareContext().env.LINEAR_CACHE ?? null;
  } catch {
    return null;
  }
}

export async function getCached<T>(key: string): Promise<T | null> {
  const kv = getKV();
  if (!kv) return null;
  try {
    return await kv.get<T>(key, 'json');
  } catch {
    return null;
  }
}

export async function setCached(
  key: string,
  value: unknown,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  const kv = getKV();
  if (!kv) return;
  try {
    await kv.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  } catch {
    // KV writes are best-effort; failures don't break the response.
  }
}

export async function invalidateCached(key: string): Promise<void> {
  const kv = getKV();
  if (!kv) return;
  try {
    await kv.delete(key);
  } catch {
    // best-effort
  }
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
