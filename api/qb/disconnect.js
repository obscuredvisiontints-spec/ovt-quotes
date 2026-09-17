import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  try {
    await redis.del("qb:tokens");
    res.status(200).json({ disconnected: true });
  } catch (e) {
    res.status(500).json({ error: "failed" });
  }
}
