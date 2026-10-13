import type { Snapshot } from "./domain";

export function demoSnapshot(): Snapshot {
  const suppliers = [
    { id: "s1", name: "Pacific Packaging", email: "orders@pacific.example", phone: "+64 9 555 0101", lead_time_days: 4, active: true },
    { id: "s2", name: "Office Supply Co.", email: "hello@office.example", phone: "+64 9 555 0102", lead_time_days: 3, active: true },
    { id: "s3", name: "Southern Distribution", email: "sales@southern.example", phone: "+64 3 555 0103", lead_time_days: 7, active: true },
  ];
  const rows = [
    ["PKG-001", "Kraft shipping boxes", "Packaging", "s1", 240, 100, 325],
    ["PKG-002", "Recycled packing tape", "Packaging", "s1", 18, 30, 680],
    ["OFF-001", "Thermal shipping labels", "Office", "s2", 0, 20, 1450],
    ["PKG-003", "Compostable mailers", "Packaging", "s1", 420, 150, 110],
    ["HOM-001", "Ceramic travel cups", "Homeware", "s3", 64, 25, 1850],
    ["HOM-002", "Linen storage baskets", "Homeware", "s3", 12, 20, 2400],
    ["OFF-002", "A5 recycled notebooks", "Office", "s2", 96, 40, 590],
    ["HOM-003", "Glass water bottles", "Homeware", "s3", 48, 15, 1690],
  ] as const;
  const products = rows.map((r, i) => ({ id: "p" + i, sku: r[0], name: r[1], category: r[2], supplier_id: r[3], quantity: r[4], reorder_point: r[5], unit_cost_cents: r[6], value_cents: r[4] * r[6], active: true }));
  const reference = Date.UTC(2026, 9, 13, 3);
  const movements = products.flatMap((p, i) => {
    const issued = 8 + i * 3;
    return [
      { id: "m-receipt-" + i, product_id: p.id, kind: "receipt" as const, quantity_delta: p.quantity + issued, value_delta_cents: (p.quantity + issued) * p.unit_cost_cents, reason: "Opening stock receipt", occurred_at: new Date(reference - (12 - i) * 86400000).toISOString() },
      { id: "m-issue-" + i, product_id: p.id, kind: "issue" as const, quantity_delta: -issued, value_delta_cents: -issued * p.unit_cost_cents, reason: "Customer order dispatch", occurred_at: new Date(reference - (7 - i) * 86400000).toISOString() },
    ];
  }).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  return { workspace: { id: "demo", name: "Harbour & Field", currency_code: "NZD", timezone: "Pacific/Auckland", role: "owner" }, products, suppliers, movements, email: "demo@harbour.example", truncated: false };
}
