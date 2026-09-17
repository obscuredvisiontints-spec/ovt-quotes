import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});
const TOKEN_KEY = "qb:tokens";

export async function getStoredTokens() {
  const raw = await redis.get(TOKEN_KEY);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function saveTokens(tokens) {
  await redis.set(TOKEN_KEY, JSON.stringify(tokens));
}

async function refreshTokens(current) {
  const clientId = process.env.QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: current.refresh_token,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("qb_reconnect_needed");

  const next = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || current.refresh_token,
    realmId: current.realmId,
    obtained_at: Date.now(),
    expires_in: data.expires_in,
  };
  await saveTokens(next);
  return next;
}

// Returns a token guaranteed to be valid for the next request, refreshing
// automatically if the current one is about to expire (QuickBooks access
// tokens last ~1 hour; refresh tokens last ~100 days and rotate on use).
export async function getValidTokens() {
  const tokens = await getStoredTokens();
  if (!tokens) return null;
  const ageSeconds = (Date.now() - tokens.obtained_at) / 1000;
  if (ageSeconds < tokens.expires_in - 120) return tokens;
  return refreshTokens(tokens);
}

export function qbBaseUrl() {
  return process.env.QB_ENVIRONMENT === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

export async function qbFetch(url, tokens, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}
