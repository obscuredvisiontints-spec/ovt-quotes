import { getValidTokens, qbBaseUrl, qbFetch } from "./_lib.js";

function escapeForQuery(str) {
  return String(str).replace(/'/g, "\\'");
}

async function findOrCreateCustomer(tokens, name) {
  const base = qbBaseUrl();
  const query = `select * from Customer where DisplayName = '${escapeForQuery(name)}'`;
  const q = await qbFetch(`${base}/v3/company/${tokens.realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`, tokens);
  const existing = q.QueryResponse && q.QueryResponse.Customer && q.QueryResponse.Customer[0];
  if (existing) return existing.Id;

  const created = await qbFetch(`${base}/v3/company/${tokens.realmId}/customer?minorversion=65`, tokens, {
    method: "POST",
    body: JSON.stringify({ DisplayName: name }),
  });
  return created.Customer.Id;
}

async function findItemId(tokens, name) {
  const base = qbBaseUrl();
  const query = `select * from Item where Name = '${escapeForQuery(name)}'`;
  const q = await qbFetch(`${base}/v3/company/${tokens.realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`, tokens);
  const existing = q.QueryResponse && q.QueryResponse.Item && q.QueryResponse.Item[0];
  return existing ? existing.Id : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const tokens = await getValidTokens();
    if (!tokens) {
      res.status(401).json({ error: "not_connected" });
      return;
    }

    const { customerName, lineItems } = req.body;
    if (!lineItems || lineItems.length === 0) {
      res.status(400).json({ error: "no_line_items", message: "This quote has nothing to invoice yet." });
      return;
    }

    const customerId = await findOrCreateCustomer(tokens, customerName || "New Customer");

    // Every line has to reference a real Product/Service item already in
    // QuickBooks — same requirement as the CSV export. First missing name
    // stops the whole invoice rather than creating a partial one.
    const lines = [];
    for (const item of lineItems) {
      const itemId = await findItemId(tokens, item.productName);
      if (!itemId) {
        res.status(422).json({
          error: "missing_item",
          message: `"${item.productName}" doesn't exist yet in your QuickBooks Products & Services list. Add it there once, then try again.`,
        });
        return;
      }
      lines.push({
        DetailType: "SalesItemLineDetail",
        Amount: item.amount,
        Description: item.description || item.productName,
        SalesItemLineDetail: {
          ItemRef: { value: itemId },
          Qty: item.qty || 1,
          UnitPrice: item.rate,
        },
      });
    }

    const base = qbBaseUrl();
    const invoice = await qbFetch(`${base}/v3/company/${tokens.realmId}/invoice?minorversion=65`, tokens, {
      method: "POST",
      body: JSON.stringify({
        CustomerRef: { value: customerId },
        Line: lines,
      }),
    });

    const invoiceId = invoice.Invoice.Id;
    const viewUrl =
      process.env.QB_ENVIRONMENT === "production"
        ? `https://app.qbo.intuit.com/app/invoice?txnId=${invoiceId}`
        : `https://app.sandbox.qbo.intuit.com/app/invoice?txnId=${invoiceId}`;

    res.status(200).json({ success: true, invoiceId, viewUrl });
  } catch (e) {
    res.status(500).json({ error: "failed", message: e.message });
  }
}
