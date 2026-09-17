import { saveTokens } from "./_lib.js";

export default async function handler(req, res) {
  try {
    const { code, realmId, state } = req.query;
    const cookieHeader = req.headers.cookie || "";
    const cookieState = (cookieHeader.match(/qb_oauth_state=([^;]+)/) || [])[1];

    if (!code || !realmId) {
      res.writeHead(302, { Location: "/?qb=error" });
      return res.end();
    }
    if (cookieState && state && cookieState !== state) {
      res.writeHead(302, { Location: "/?qb=error" });
      return res.end();
    }

    const clientId = process.env.QB_CLIENT_ID;
    const clientSecret = process.env.QB_CLIENT_SECRET;
    const redirectUri = process.env.QB_REDIRECT_URI;
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      res.writeHead(302, { Location: "/?qb=error" });
      return res.end();
    }

    await saveTokens({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      realmId,
      obtained_at: Date.now(),
      expires_in: tokenData.expires_in,
    });

    res.writeHead(302, { Location: "/?qb=connected" });
    res.end();
  } catch (e) {
    res.writeHead(302, { Location: "/?qb=error" });
    res.end();
  }
}
