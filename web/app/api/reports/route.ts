import { NextRequest } from "next/server";
import { getSnapshot } from "@/lib/data";
import { demoSnapshot } from "@/lib/demo";
import { inventoryCsv, summarize, stockStatus } from "@/lib/domain";

export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  if (!["csv", "xlsx", "pdf"].includes(format)) return Response.json({ error: "Unsupported report format." }, { status: 400 });
  // Public demo exports contain only the fixed synthetic fixture, never request data.
  const snapshot = request.nextUrl.searchParams.get("demo") === "1" ? demoSnapshot() : await getSnapshot();
  if (snapshot.truncated) return Response.json({ error: "This report exceeds the synchronous export limit." }, { status: 413 });
  const headers = { "Cache-Control": "private, no-store", "Content-Disposition": 'attachment; filename="stockroom-inventory.' + format + '"', "X-Content-Type-Options": "nosniff" };
  if (format === "csv") return new Response(inventoryCsv(snapshot), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
  if (format === "xlsx") {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Stockroom";
    const sheet = workbook.addWorksheet("Inventory");
    sheet.columns = [{ header: "SKU", key: "sku", width: 18 }, { header: "Product", key: "name", width: 32 }, { header: "Category", key: "category", width: 20 }, { header: "Quantity", key: "quantity", width: 14 }, { header: "Reorder point", key: "reorder", width: 16 }, { header: "Value (" + snapshot.workspace.currency_code + ")", key: "value", width: 20 }, { header: "Status", key: "status", width: 20 }];
    snapshot.products.filter((p) => p.active).forEach((p) => sheet.addRow({ sku: p.sku, name: p.name, category: p.category, quantity: p.quantity, reorder: p.reorder_point, value: p.value_cents / 100, status: stockStatus(p) }));
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173B39" } };
    sheet.getColumn("value").numFmt = '#,##0.00';
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = "A1:G1";
    const totals = workbook.addWorksheet("Report context");
    totals.addRows([["Workspace", snapshot.workspace.name], ["Currency", snapshot.workspace.currency_code], ["Generated (UTC)", new Date().toISOString()], ["Valuation method", "Moving weighted average"], ["Total value", summarize(snapshot.products).value / 100]]);
    totals.getColumn(1).width = 28; totals.getColumn(2).width = 40;
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), { headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
  }
  const { renderInventoryPdf } = await import("@/reports/inventory");
  const buffer = await renderInventoryPdf(snapshot);
  return new Response(new Uint8Array(buffer), { headers: { ...headers, "Content-Type": "application/pdf" } });
}
