export default function handler(req, res) {
  const clientId = process.env.QB_CLIENT_ID;
  const redirectUri = process.env.QB_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    res.status(500).send("QuickBooks isn't configured yet — QB_CLIENT_ID / QB_REDIRECT_URI missing.");
    return;
  }

  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  res.setHeader("Set-Cookie", `qb_oauth_state=${state}; Path=/; HttpOnly; Max-Age=600; SameSite=Lax`);

  const authUrl =
    `https://appcenter.intuit.com/connect/oauth2` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent("com.intuit.quickbooks.accounting")}` +
    `&state=${state}`;

  res.writeHead(302, { Location: authUrl });
  res.end();
}
