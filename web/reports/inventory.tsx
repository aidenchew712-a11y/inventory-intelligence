import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { money, summarize, type Snapshot } from "@/lib/domain";
const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#173b39" },
  brand: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  title: { fontSize: 18, marginBottom: 8 },
  context: { color: "#61716e", marginBottom: 4 },
  row: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: "#dce3de" },
  header: { backgroundColor: "#eef3ee", fontWeight: "bold" },
  sku: { width: "17%" }, product: { width: "40%" }, quantity: { width: "15%", textAlign: "right" }, value: { width: "28%", textAlign: "right" },
  total: { marginTop: 18, fontSize: 13, textAlign: "right", fontWeight: "bold" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#61716e" },
});
export async function renderInventoryPdf(snapshot: Snapshot) {
  return renderToBuffer(<Document title="Inventory valuation" author="Stockroom"><Page size="A4" style={styles.page} wrap>
    <Text style={styles.brand}>stockroom.</Text><Text style={styles.title}>Inventory valuation report</Text>
    <Text style={styles.context}>{snapshot.workspace.name} | {snapshot.workspace.currency_code} | Moving weighted average</Text>
    <Text style={styles.context}>Generated: {new Date().toISOString()} (UTC)</Text>
    <Text style={[styles.context, { marginBottom: 18 }]}>Current operational snapshot | Whole units | One stock location</Text>
    <View style={[styles.row, styles.header]} fixed><Text style={styles.sku}>SKU</Text><Text style={styles.product}>Product</Text><Text style={styles.quantity}>On hand</Text><Text style={styles.value}>Stock value</Text></View>
    {snapshot.products.filter((p) => p.active).map((p) => <View style={styles.row} key={p.id} wrap={false}><Text style={styles.sku}>{p.sku}</Text><Text style={styles.product}>{p.name}</Text><Text style={styles.quantity}>{p.quantity}</Text><Text style={styles.value}>{money(p.value_cents, snapshot.workspace.currency_code)}</Text></View>)}
    <Text style={styles.total}>Total stock value: {money(summarize(snapshot.products).value, snapshot.workspace.currency_code)}</Text>
    <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => "Stockroom | Inventory value is not revenue or profit | Page " + pageNumber + " of " + totalPages} />
  </Page></Document>);
}
