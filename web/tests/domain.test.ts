import assert from "node:assert/strict";
import test from "node:test";
import { applyStock, csvCell, summarize, inventoryCsv } from "../lib/domain";
import { demoSnapshot } from "../lib/demo";
test("demo balances reconcile exactly to its opening and issue ledger", () => {
  const snapshot = demoSnapshot();
  for (const product of snapshot.products) {
    const lines = snapshot.movements.filter((m) => m.product_id === product.id);
    assert.equal(lines.reduce((s, m) => s + m.quantity_delta, 0), product.quantity);
    assert.equal(lines.reduce((s, m) => s + m.value_delta_cents, 0), product.value_cents);
  }
  assert.equal(summarize(snapshot.products).products, 8);
});
test("an issue rejects overselling and does not alter its source product", () => {
  const product = demoSnapshot().products[0];
  assert.throws(() => applyStock(product, { productId: product.id, kind: "issue", quantity: product.quantity + 1, unitCostCents: 0, reason: "Order", idempotencyKey: "test" }), /enough stock/);
  assert.equal(product.quantity, 240);
});
test("weighted-average issue valuation ignores a supplied outgoing cost", () => {
  const product = { ...demoSnapshot().products[0], quantity: 3, value_cents: 100 };
  const issued = applyStock(product, { productId: product.id, kind: "issue", quantity: 1, unitCostCents: 999, reason: "Order", idempotencyKey: "test" });
  assert.equal(issued.product.quantity, 2);
  assert.equal(issued.product.value_cents, 67);
  const depleted = applyStock(issued.product, { productId: product.id, kind: "issue", quantity: 2, unitCostCents: 0, reason: "Order", idempotencyKey: "next" });
  assert.equal(depleted.product.value_cents, 0);
});
test("CSV handles delimiters, embedded quotes, formula prefixes, and literal negative numbers", () => {
  assert.equal(csvCell('Box, "large"'), '"Box, ""large"""');
  assert.equal(csvCell("  =HYPERLINK()"), '"\'  =HYPERLINK()"');
  assert.equal(csvCell(-12), "-12");
  assert.equal(csvCell("\tformula"), '"\'\tformula"');
  assert.match(inventoryCsv(demoSnapshot()), /Kraft shipping boxes/);
});
