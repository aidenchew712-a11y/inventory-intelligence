export type Role = "owner" | "manager" | "staff" | "viewer";
export type Product = { id: string; sku: string; name: string; category: string; supplier_id: string | null; reorder_point: number; unit_cost_cents: number; quantity: number; value_cents: number; active: boolean };
export type Supplier = { id: string; name: string; email: string; phone: string; lead_time_days: number; active: boolean };
export type Movement = { id: string; product_id: string; kind: "receipt" | "issue" | "adjustment"; quantity_delta: number; value_delta_cents: number; reason: string; occurred_at: string };
export type Workspace = { id: string; name: string; currency_code: string; timezone: string; role: Role };
export type Snapshot = { workspace: Workspace; products: Product[]; suppliers: Supplier[]; movements: Movement[]; email: string; truncated: boolean };
export type StockInput = { productId: string; kind: Movement["kind"]; quantity: number; unitCostCents: number; reason: string; idempotencyKey: string };

export function money(cents: number, currency = "NZD") {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(cents / 100);
}
export function stockStatus(product: Pick<Product, "quantity" | "reorder_point">) {
  return product.quantity === 0 ? "Out of stock" : product.quantity < product.reorder_point ? "Low stock" : "Healthy";
}
export function summarize(products: Product[]) {
  const active = products.filter((p) => p.active);
  return { products: active.length, units: active.reduce((sum, p) => sum + p.quantity, 0), value: active.reduce((sum, p) => sum + p.value_cents, 0), lowStock: active.filter((p) => p.quantity < p.reorder_point).length };
}
export function csvCell(value: string | number) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Report contains an invalid number");
    return String(value);
  }
  const safe = /^\s*[=+\-@]/u.test(value) || /^[\t\r\n]/u.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function inventoryCsv(snapshot: Snapshot) {
  const rows: (string | number)[][] = [["SKU", "Product", "Category", "Supplier", "Quantity", "Reorder point", "Value (" + snapshot.workspace.currency_code + ")", "Status"]];
  for (const p of snapshot.products.filter((p) => p.active)) {
    rows.push([p.sku, p.name, p.category, snapshot.suppliers.find((s) => s.id === p.supplier_id)?.name ?? "", p.quantity, p.reorder_point, p.value_cents / 100, stockStatus(p)]);
  }
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
export function applyStock(product: Product, input: StockInput): { product: Product; quantityDelta: number; valueDelta: number } {
  if (!Number.isSafeInteger(input.quantity) || input.quantity === 0 || Math.abs(input.quantity) > 1000000) throw new Error("Enter a non-zero whole quantity up to 1,000,000.");
  if (!Number.isSafeInteger(input.unitCostCents) || input.unitCostCents < 0 || input.unitCostCents > 100000000) throw new Error("Enter a valid unit cost.");
  if (!product.active) throw new Error("Archived products cannot receive stock movements.");
  const delta = input.kind === "issue" ? -Math.abs(input.quantity) : input.kind === "receipt" ? Math.abs(input.quantity) : input.quantity;
  if (product.quantity + delta < 0) throw new Error("There is not enough stock to post this movement.");
  // Full depletion carries the exact remaining value to avoid rounding residue.
  const valueDelta = delta > 0 ? delta * input.unitCostCents : delta === -product.quantity ? -product.value_cents : -Math.round(product.value_cents * Math.abs(delta) / product.quantity);
  return { product: { ...product, quantity: product.quantity + delta, value_cents: product.value_cents + valueDelta }, quantityDelta: delta, valueDelta };
}
