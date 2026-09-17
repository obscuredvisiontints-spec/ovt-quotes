import { getStoredTokens } from "./_lib.js";

export default async function handler(req, res) {
  try {
    const tokens = await getStoredTokens();
    res.status(200).json({
      connected: !!tokens,
      environment: process.env.QB_ENVIRONMENT === "production" ? "production" : "sandbox",
    });
  } catch (e) {
    res.status(200).json({ connected: false });
  }
}
