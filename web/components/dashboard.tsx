"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { z } from "zod";
import { saveProduct, saveSupplier, postMovement, signOut } from "@/app/actions";
import { applyStock, inventoryCsv, money, stockStatus, summarize, type Product, type Snapshot, type StockInput, type Supplier } from "@/lib/domain";
import { demoSnapshot } from "@/lib/demo";
import { Icon } from "./icon";

type Tab = "overview" | "inventory" | "suppliers" | "movements" | "analytics" | "reports" | "settings";
type DialogState = { kind: "product"; product?: Product } | { kind: "supplier"; supplier?: Supplier } | { kind: "stock"; product?: Product } | null;
const navigation: { id: Tab; title: string }[] = [{ id: "overview", title: "Overview" }, { id: "inventory", title: "Inventory" }, { id: "suppliers", title: "Suppliers" }, { id: "movements", title: "Stock movements" }, { id: "analytics", title: "Analytics" }, { id: "reports", title: "Reports" }];
const demoSchema = z.object({
  workspace: z.object({ id: z.literal("demo"), name: z.string(), currency_code: z.literal("NZD"), timezone: z.literal("Pacific/Auckland"), role: z.literal("owner") }),
  products: z.array(z.object({ id: z.string(), sku: z.string(), name: z.string(), category: z.string(), supplier_id: z.string().nullable(), reorder_point: z.number().int().nonnegative(), unit_cost_cents: z.number().int().nonnegative(), quantity: z.number().int().nonnegative(), value_cents: z.number().int().nonnegative(), active: z.boolean() })).max(500),
  suppliers: z.array(z.object({ id: z.string(), name: z.string(), email: z.string(), phone: z.string(), lead_time_days: z.number(), active: z.boolean() })).max(500),
  movements: z.array(z.object({ id: z.string(), product_id: z.string(), kind: z.enum(["receipt", "issue", "adjustment"]), quantity_delta: z.number(), value_delta_cents: z.number(), reason: z.string(), occurred_at: z.string().datetime() })).max(1000),
  email: z.string(), truncated: z.boolean(),
});

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} onCancel={close} className="modal" aria-labelledby="modal-title">
    <header><div><span className="eyebrow">WORKSPACE ACTION</span><h2 id="modal-title">{title}</h2></div><button type="button" className="icon-button" onClick={close} aria-label="Close dialog"><Icon name="close" /></button></header>
    {children}
  </dialog>;
}
function Status({ product }: { product: Product }) {
  const status = stockStatus(product);
  return <span className={"status " + (status === "Healthy" ? "healthy" : status === "Low stock" ? "low" : "out")}><span />{status}</span>;
}
function ProductTable({ products, suppliers, currency, edit, stock, canManage, canPost }: { products: Product[]; suppliers: Supplier[]; currency: string; edit: (p: Product) => void; stock: (p: Product) => void; canManage: boolean; canPost: boolean }) {
  return <div className="table-scroll"><table><caption className="sr-only">Product inventory and stock status</caption><thead><tr><th scope="col">Product / SKU</th><th scope="col">Supplier</th><th scope="col" className="numeric">On hand</th><th scope="col" className="numeric">Reorder at</th><th scope="col" className="numeric">Stock value</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
    <tbody>{products.map((p) => <tr key={p.id}><th scope="row"><div className="product-cell"><span className="product-symbol"><Icon name="inventory" size={20} /></span><div>{p.name}<small>{p.sku} · {p.category}</small></div></div></th><td>{suppliers.find((s) => s.id === p.supplier_id)?.name ?? "Unassigned"}</td><td className="numeric strong">{p.quantity.toLocaleString("en-NZ")}</td><td className="numeric">{p.reorder_point}</td><td className="numeric">{money(p.value_cents, currency)}</td><td><Status product={p} /></td><td><div className="row-actions">{canPost && <button className="text-button" onClick={() => stock(p)}>Stock</button>}{canManage && <button className="icon-button" aria-label={"Edit " + p.name} onClick={() => edit(p)}><Icon name="more" size={18} /></button>}</div></td></tr>)}</tbody>
  </table>{products.length === 0 && <div className="empty"><Icon name="inventory" size={32} /><h3>No products found</h3><p>Add your first product or adjust the search filters.</p></div>}</div>;
}
function ActivityChart({ snapshot }: { snapshot: Snapshot }) {
  const sorted = [...snapshot.movements].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const end = sorted[0] ? new Date(sorted[0].occurred_at) : new Date("2026-10-13T00:00:00Z");
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(end); date.setUTCDate(end.getUTCDate() - 6 + i);
    const day = date.toISOString().slice(0, 10);
    const rows = snapshot.movements.filter((m) => m.occurred_at.slice(0, 10) === day);
    return { label: new Intl.DateTimeFormat("en-NZ", { weekday: "short", timeZone: "UTC" }).format(date), received: rows.reduce((s, m) => s + Math.max(0, m.quantity_delta), 0), issued: rows.reduce((s, m) => s + Math.max(0, -m.quantity_delta), 0) };
  });
  const maximum = Math.max(1, ...days.map((d) => Math.max(d.received, d.issued)));
  return <><div className="chart-legend"><span><i className="received-dot" />Received</span><span><i className="issued-dot" />Issued</span><small>Latest 7 UTC ledger days</small></div>
    <div className="bar-chart" role="img" aria-label={days.map((d) => d.label + ": " + d.received + " received, " + d.issued + " issued").join(". ")}>{days.map((d, i) => <div className="chart-day" key={i}><div className="bars"><div className="bar received" style={{ height: Math.max(d.received ? 3 : 0, d.received / maximum * 100) + "%" }} /><div className="bar issued" style={{ height: Math.max(d.issued ? 3 : 0, d.issued / maximum * 100) + "%" }} /></div><span>{d.label}</span></div>)}</div>
    <details className="chart-data"><summary>View chart data</summary><table><thead><tr><th>Day</th><th>Received</th><th>Issued</th></tr></thead><tbody>{days.map((d, i) => <tr key={i}><td>{d.label}</td><td>{d.received}</td><td>{d.issued}</td></tr>)}</tbody></table></details></>;
}
export function Dashboard({ initial, demo }: { initial: Snapshot; demo: boolean }) {
  const router = useRouter();
  const [local, setLocal] = useState(initial);
  const data = demo ? local : initial;
  const [tab, setTab] = useState<Tab>("overview");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [mobile, setMobile] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, run] = useTransition();
  const retryKey = useRef("");
  const totals = summarize(data.products);
  const canManage = ["owner", "manager"].includes(data.workspace.role);
  const canPost = ["owner", "manager", "staff"].includes(data.workspace.role);
  const currency = data.workspace.currency_code;
  useEffect(() => {
    if (!demo) return;
    try {
      const saved = localStorage.getItem("stockroom-demo-v1");
      if (saved) { const parsed = demoSchema.safeParse(JSON.parse(saved)); if (parsed.success) startTransition(() => setLocal(parsed.data)); }
    } catch { /* A blocked browser storage API does not prevent demo use. */ }
  }, [demo]);
  function persist(snapshot: Snapshot) {
    setLocal(snapshot);
    try { localStorage.setItem("stockroom-demo-v1", JSON.stringify(snapshot)); } catch { setNotice("Changes are available for this session; browser storage is unavailable."); }
  }
  function navigate(next: Tab) { setTab(next); setQuery(""); setFilter("all"); setPage(1); setMobile(false); setNotice(""); }
  function open(next: DialogState) { setError(""); setDialog(next); retryKey.current = crypto.randomUUID(); }
  async function downloadReport(format: string) {
    setNotice("Preparing your " + format.toUpperCase() + " report…");
    try {
      const response = await fetch("/api/reports?format=" + format + (demo ? "&demo=1" : ""));
      const contentType = response.headers.get("content-type") ?? "";
      const expectedType = format === "pdf" ? "application/pdf" : format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv";
      if (!response.ok || !contentType.includes(expectedType)) throw new Error("Report generation failed.");
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "stockroom-inventory." + format;
      a.click();
      // Keep the object URL alive until the browser has started the download.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(format.toUpperCase() + " report exported.");
    } catch {
      setNotice("The report could not be downloaded. Please try again, or sign in if your session has expired.");
    }
  }
  function downloadCsv() {
    if (data.truncated) { setNotice("Export exceeds this release's 5,000-record limit."); return; }
    if (!demo) { downloadReport("csv"); return; }
    const url = URL.createObjectURL(new Blob([inventoryCsv(data)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "stockroom-demo-inventory.csv"; a.click(); URL.revokeObjectURL(url);
    setNotice("Inventory CSV exported.");
  }
  async function submit(form: FormData) {
    setError("");
    run(async () => {
      try {
        const values = Object.fromEntries(form);
        if (dialog?.kind === "product") {
          const unitCost = Math.round(Number(values.cost) * 100);
          const fields = { id: dialog.product?.id, sku: String(values.sku).trim().toUpperCase(), name: String(values.name).trim(), category: String(values.category).trim(), supplier_id: String(values.supplier) || null, reorder_point: Number(values.reorder), unit_cost_cents: unitCost };
          if (demo) {
            if (data.products.length >= 500 && !fields.id) throw new Error("The demo supports up to 500 products.");
            if (data.products.some((p) => p.sku.toUpperCase() === fields.sku && p.id !== fields.id)) throw new Error("This SKU is already in use.");
            const product: Product = { ...fields, id: fields.id ?? crypto.randomUUID(), quantity: dialog.product?.quantity ?? 0, value_cents: dialog.product?.value_cents ?? 0, active: true };
            persist({ ...data, products: fields.id ? data.products.map((p) => p.id === fields.id ? product : p) : [...data.products, product] });
          } else { const result = await saveProduct(data.workspace.id, fields); if (result.error) throw new Error(result.error); router.refresh(); }
          setNotice("Product saved.");
        } else if (dialog?.kind === "supplier") {
          const fields = { id: dialog.supplier?.id, name: String(values.name).trim(), email: String(values.email).trim(), phone: String(values.phone).trim(), lead_time_days: Number(values.lead) };
          if (demo) {
            if (data.suppliers.length >= 500 && !fields.id) throw new Error("The demo supports up to 500 suppliers.");
            const supplier: Supplier = { ...fields, id: fields.id ?? crypto.randomUUID(), active: true };
            persist({ ...data, suppliers: fields.id ? data.suppliers.map((s) => s.id === fields.id ? supplier : s) : [...data.suppliers, supplier] });
          } else { const result = await saveSupplier(data.workspace.id, fields); if (result.error) throw new Error(result.error); router.refresh(); }
          setNotice("Supplier saved.");
        } else if (dialog?.kind === "stock") {
          const input: StockInput = { productId: String(values.product), kind: String(values.kind) as StockInput["kind"], quantity: Number(values.quantity), unitCostCents: Math.round(Number(values.cost) * 100), reason: String(values.reason).trim(), idempotencyKey: retryKey.current };
          if (demo) {
            const product = data.products.find((p) => p.id === input.productId);
            if (!product) throw new Error("Choose a product.");
            const posted = applyStock(product, input);
            persist({ ...data, products: data.products.map((p) => p.id === product.id ? posted.product : p), movements: [{ id: input.idempotencyKey, product_id: product.id, kind: input.kind, quantity_delta: posted.quantityDelta, value_delta_cents: posted.valueDelta, reason: input.reason, occurred_at: new Date().toISOString() }, ...data.movements].slice(0, 1000) });
          } else { const result = await postMovement(data.workspace.id, input); if (result.error) throw new Error(result.error); router.refresh(); }
          setNotice("Stock movement posted.");
        }
        setDialog(null);
      } catch (e) { setError(e instanceof Error ? e.message : "The operation could not be completed."); }
    });
  }
  const filtered = data.products.filter((p) => p.active && (p.name + " " + p.sku + " " + p.category).toLowerCase().includes(query.toLowerCase()) && (filter === "all" || stockStatus(p) === filter));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const visibleProducts = filtered.slice((Math.min(page, pageCount) - 1) * 10, Math.min(page, pageCount) * 10);
  const low = data.products.filter((p) => p.active && p.quantity < p.reorder_point);
  const inventoryTable = (products: Product[]) => <ProductTable products={products} suppliers={data.suppliers} currency={currency} edit={(product) => open({ kind: "product", product })} stock={(product) => open({ kind: "stock", product })} canManage={canManage} canPost={canPost} />;
  return <div className="workspace">
    <a href="#workspace-main" className="skip-link">Skip to content</a>
    <aside className={"sidebar " + (mobile ? "open" : "")}>
      <Link href="/" className="brand"><span className="brand-mark"><Icon name="boxes" /></span>stockroom<span className="brand-dot">.</span></Link>
      <div className="workspace-badge"><span className="workspace-avatar">{data.workspace.name.slice(0, 1)}</span><div><strong>{data.workspace.name}</strong><small>{demo ? "Demo workspace" : "Business workspace"}</small></div></div>
      <span className="nav-caption">WORKSPACE</span>
      <nav aria-label="Workspace navigation">{navigation.map((item) => <button key={item.id} className={"nav-item " + (tab === item.id ? "selected" : "")} onClick={() => navigate(item.id)} aria-current={tab === item.id ? "page" : undefined}><Icon name={item.id} /><span>{item.title}</span>{item.id === "inventory" && <span className="nav-count">{totals.products}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><button className={"nav-item " + (tab === "settings" ? "selected" : "")} onClick={() => navigate("settings")}><Icon name="settings" />Workspace settings</button><div className="sidebar-note"><Icon name="shield" size={20} /><strong>A clear view. Better decisions.</strong><p>{demo ? "Explore freely. Demo changes stay in this browser." : "Your inventory is protected by organization access policies."}</p>{demo && <Link href="/signup">Create your workspace <Icon name="arrow" size={14} /></Link>}</div><div className="user-badge"><span className="user-avatar">{demo ? "D" : data.email.slice(0, 1).toUpperCase()}</span><div><strong>{demo ? "Demo explorer" : data.email.split("@")[0]}</strong><small>{data.workspace.role}</small></div>{!demo && <form action={signOut}><button className="icon-button" aria-label="Sign out"><Icon name="logout" size={17} /></button></form>}</div></div>
    </aside>
    {mobile && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setMobile(false)} />}
    <div className="workspace-body">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobile(true)}><Icon name="menu" /></button><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{tab === "settings" ? "Settings" : navigation.find((n) => n.id === tab)?.title}</strong></div><div className="topbar-right"><span className="connection"><i />{demo ? "Interactive demo" : "Connected workspace"}</span><Link href={demo ? "/login" : "/"} className="topbar-link">{demo ? "Sign in" : "Public site"}<Icon name="arrow" size={15} /></Link></div></header>
      <main id="workspace-main" className="workspace-main">
        <div className="page-heading"><div><span className="eyebrow">{tab === "overview" ? "YOUR BUSINESS, AT A GLANCE" : "WORKSPACE / " + tab.toUpperCase()}</span><h1>{tab === "overview" ? "Let's take stock." : tab === "inventory" ? "Your inventory." : tab === "suppliers" ? "Your supply network." : tab === "movements" ? "Every movement matters." : tab === "analytics" ? "The story behind your stock." : tab === "reports" ? "Insights you can take away." : "Your workspace."}</h1><p>{tab === "overview" ? "A little clarity goes a long way. Here's where things stand." : tab === "inventory" ? "The right products, in the right quantities, at the right time." : tab === "suppliers" ? "Keep your partners and replenishment lead times in one place." : tab === "movements" ? "An append-only record of what comes in and what goes out." : tab === "analytics" ? "Understand stock composition and replenishment priorities." : tab === "reports" ? "Export current inventory for analysis, review, or print." : "Business identity, access, and reporting preferences."}</p></div><div className="heading-actions">{tab === "suppliers" && canManage ? <button className="button primary" onClick={() => open({ kind: "supplier" })}><Icon name="plus" size={18} />Add supplier</button> : ["overview", "inventory"].includes(tab) && canManage ? <button className="button primary" onClick={() => open({ kind: "product" })}><Icon name="plus" size={18} />Add product</button> : tab === "movements" && canPost ? <button className="button primary" onClick={() => open({ kind: "stock" })}><Icon name="plus" size={18} />Post movement</button> : null}<button className="button secondary" onClick={downloadCsv}><Icon name="reports" size={17} />Export CSV</button></div></div>
        {demo && <div className="demo-banner"><span><Icon name="help" size={17} />You&apos;re exploring synthetic data. Add products, post stock, and export reports.</span><button onClick={() => { persist(demoSnapshot()); setNotice("Demo restored to its original sample data."); }}>Reset demo <Icon name="refresh" size={14} /></button></div>}
        {data.truncated && <div className="form-error" role="alert">This workspace exceeds the 5,000-record release limit. Totals are partial and exports are disabled until the dataset is reduced or the limit is extended.</div>}
        {notice && <div className="notice" role="status"><Icon name="check" size={17} />{notice}<button aria-label="Dismiss notification" onClick={() => setNotice("")}><Icon name="close" size={15} /></button></div>}
        {tab === "overview" && <>
          <section className="metrics" aria-label="Inventory summary">{[
            { label: "Inventory value", value: money(totals.value, currency), detail: "Weighted-average stock valuation", icon: "analytics" as const, tone: "green" },
            { label: "Active products", value: totals.products, detail: totals.units.toLocaleString("en-NZ") + " units across your catalog", icon: "inventory" as const, tone: "blue" },
            { label: "Need attention", value: totals.lowStock, detail: "Products below reorder point", icon: "warning" as const, tone: "amber" },
            { label: "Active suppliers", value: data.suppliers.filter((s) => s.active).length, detail: "Partners in your supply network", icon: "suppliers" as const, tone: "purple" },
          ].map((m) => <article className="metric-card" key={m.label}><div className="metric-top"><span>{m.label}</span><span className={"metric-icon " + m.tone}><Icon name={m.icon} size={19} /></span></div><strong>{m.value}</strong><small>{m.detail}</small></article>)}</section>
          <div className="overview-grid"><section className="panel activity-panel"><div className="panel-heading"><div><h2>Stock activity</h2><p>Units received and issued from the ledger</p></div><span className="small-badge">7 days</span></div><ActivityChart snapshot={data} /></section><section className="panel attention-panel"><div className="panel-heading"><div><h2>A little attention needed</h2><p>Get ahead of your next stockout</p></div><span className="attention-count">{low.length}</span></div><div className="attention-list">{low.slice(0, 3).map((p) => <button key={p.id} onClick={() => canPost ? open({ kind: "stock", product: p }) : navigate("inventory")}><span className="attention-product"><Icon name="inventory" size={19} /><span><strong>{p.name}</strong><small>{p.quantity} on hand · reorder at {p.reorder_point}</small></span></span><Icon name="arrow" size={17} /></button>)}{low.length === 0 && <div className="empty compact"><Icon name="check" /><p>All products meet their reorder points.</p></div>}</div><button className="panel-footer-link" onClick={() => { navigate("inventory"); setFilter("Low stock"); }}>Review inventory <Icon name="arrow" size={15} /></button></section></div>
          <section className="panel"><div className="panel-heading"><div><h2>Your shelves, at a glance</h2><p>Selected products from your active catalog</p></div><button className="text-button" onClick={() => navigate("inventory")}>View all products <Icon name="arrow" size={15} /></button></div>{inventoryTable(data.products.filter((p) => p.active).slice(0, 5))}</section>
        </>}
        {tab === "inventory" && <section className="panel"><div className="table-toolbar"><label className="search-box"><Icon name="search" size={18} /><input aria-label="Search inventory" placeholder="Search products, SKUs, categories…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} /></label><label className="filter-label"><span className="sr-only">Stock status</span><select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}><option value="all">All stock statuses</option><option>Healthy</option><option>Low stock</option><option>Out of stock</option></select></label></div>{inventoryTable(visibleProducts)}<div className="pagination"><span>{filtered.length} products · page {Math.min(page, pageCount)} of {pageCount}</span><div><button className="button secondary small" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="button secondary small" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</button></div></div></section>}
        {tab === "suppliers" && <><label className="search-box supplier-search"><Icon name="search" size={18} /><input aria-label="Search suppliers" placeholder="Search your suppliers…" value={query} onChange={(e) => setQuery(e.target.value)} /></label><div className="supplier-grid">{data.suppliers.filter((s) => s.active && (s.name + s.email).toLowerCase().includes(query.toLowerCase())).map((s) => <article className="panel supplier-card" key={s.id}><div className="supplier-card-top"><span className="supplier-avatar"><Icon name="suppliers" size={25} /></span>{canManage && <button className="icon-button" aria-label={"Edit " + s.name} onClick={() => open({ kind: "supplier", supplier: s })}><Icon name="more" /></button>}</div><h2>{s.name}</h2><p>{data.products.filter((p) => p.supplier_id === s.id).length} products in your catalog</p><dl><div><dt>Email</dt><dd>{s.email || "Not provided"}</dd></div><div><dt>Phone</dt><dd>{s.phone || "Not provided"}</dd></div><div><dt>Lead time</dt><dd>{s.lead_time_days} days</dd></div></dl></article>)}</div>{data.suppliers.length === 0 && <div className="empty panel"><Icon name="suppliers" /><h3>Your supply network starts here</h3><p>Add a supplier to connect products with replenishment partners.</p></div>}</>}
        {tab === "movements" && <section className="panel"><div className="panel-heading"><div><h2>Movement register</h2><p>Latest {Math.min(500, data.movements.length)} postings · newest first · {data.workspace.timezone}</p></div></div><div className="table-scroll"><table><thead><tr><th scope="col">Product</th><th scope="col">Movement</th><th scope="col" className="numeric">Units</th><th scope="col" className="numeric">Value change</th><th scope="col">Reference / reason</th><th scope="col">Posted</th></tr></thead><tbody>{data.movements.slice(0, 500).map((m) => <tr key={m.id}><th scope="row">{data.products.find((p) => p.id === m.product_id)?.name ?? "Product"}</th><td><span className={"movement-kind " + m.kind}><Icon name={m.kind} size={16} />{m.kind}</span></td><td className="numeric strong">{m.quantity_delta > 0 ? "+" : ""}{m.quantity_delta}</td><td className="numeric">{money(m.value_delta_cents, currency)}</td><td>{m.reason}</td><td className="nowrap">{new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: data.workspace.timezone }).format(new Date(m.occurred_at))}</td></tr>)}</tbody></table>{data.movements.length === 0 && <div className="empty"><Icon name="movements" /><h3>No movements yet</h3><p>Receive stock to start your immutable inventory history.</p></div>}</div></section>}
        {tab === "analytics" && <><div className="analytics-grid"><section className="panel"><div className="panel-heading"><div><h2>Value by category</h2><p>Current stock value, not sales revenue</p></div></div><div className="category-list">{[...new Set(data.products.map((p) => p.category))].map((category) => { const value = data.products.filter((p) => p.category === category).reduce((s, p) => s + p.value_cents, 0); return <div key={category}><div><strong>{category}</strong><span>{money(value, currency)}</span></div><div className="progress-track"><span style={{ width: (totals.value ? value / totals.value * 100 : 0) + "%" }} /></div></div>; })}</div></section><section className="panel"><div className="panel-heading"><div><h2>Replenishment priorities</h2><p>Minimum units to reach the reorder point</p></div></div><div className="reorder-list">{low.map((p) => <div key={p.id}><span><strong>{p.name}</strong><small>{data.suppliers.find((s) => s.id === p.supplier_id)?.lead_time_days ?? "—"} day supplier lead time</small></span><span className="reorder-quantity">+{p.reorder_point - p.quantity}<small>units</small></span></div>)}{low.length === 0 && <p className="empty">No replenishment alerts.</p>}</div></section></div><section className="panel integration-panel"><span className="metric-icon amber"><Icon name="analytics" /></span><div><span className="eyebrow">ADVANCED ANALYTICS</span><h2>Power BI integration blueprint</h2><p>This release uses live operational analytics. Power BI embedding requires a separately provisioned Microsoft tenant, semantic model, and paid embedding capacity. Integration requirements are documented in the technical blueprint.</p></div><span className="small-badge">Not connected</span></section></>}
        {tab === "reports" && <div className="report-grid">{[{ title: "Inventory CSV", text: "An interoperable snapshot of your active products, stock levels, and valuation.", format: "csv", icon: "reports" as const }, { title: "Inventory workbook", text: "A formatted Excel workbook with typed numeric cells and stock status.", format: "xlsx", icon: "inventory" as const }, { title: "Valuation report", text: "A print-ready PDF with workspace details, line items, and total stock value.", format: "pdf", icon: "movements" as const }].map((report) => <article className="panel report-card" key={report.format}><span className="report-icon"><Icon name={report.icon} size={26} /></span><span className="eyebrow">{report.format.toUpperCase()} EXPORT</span><h2>{report.title}</h2><p>{report.text}</p><button className="button secondary" disabled={data.truncated} onClick={() => report.format === "csv" ? downloadCsv() : downloadReport(report.format)}>Download {report.format.toUpperCase()}<Icon name="reports" size={17} /></button>{demo && report.format !== "csv" && <small>Uses the original sample dataset. CSV includes your demo edits.</small>}</article>)}</div>}
        {tab === "settings" && <section className="panel settings-panel"><div className="panel-heading"><div><h2>Workspace details</h2><p>Operational identity and access context</p></div></div><dl><div><dt>Business</dt><dd>{data.workspace.name}</dd></div><div><dt>Currency</dt><dd>{currency}</dd></div><div><dt>Business timezone</dt><dd>{data.workspace.timezone}</dd></div><div><dt>Your role</dt><dd className="capitalize">{data.workspace.role}</dd></div><div><dt>Signed-in account</dt><dd>{data.email}</dd></div><div><dt>Inventory method</dt><dd>Moving weighted average · whole units · one stock location</dd></div></dl><div className="settings-note"><Icon name="shield" /><p>Owners and managers maintain the catalog. Staff can post stock. Viewers can read and export. Membership administration and multiple locations are planned extensions.</p></div></section>}
        <footer className="workspace-footer"><span>Built for the businesses that keep things moving.</span><span>stockroom · {demo ? "Synthetic sample data" : "Private business workspace"}</span></footer>
      </main>
    </div>
    {dialog && <Modal title={dialog.kind === "product" ? dialog.product ? "Edit product" : "Add a product" : dialog.kind === "supplier" ? dialog.supplier ? "Edit supplier" : "Add a supplier" : "Post a stock movement"} close={() => { if (!pending) setDialog(null); }}><form action={submit} className="form-stack">
      {dialog.kind === "product" && <><div className="form-row"><label>SKU<input name="sku" required maxLength={40} defaultValue={dialog.product?.sku} placeholder="PKG-004" /></label><label>Category<input name="category" required maxLength={60} defaultValue={dialog.product?.category ?? "General"} /></label></div><label>Product name<input name="name" required maxLength={120} defaultValue={dialog.product?.name} placeholder="Recycled shipping envelopes" /></label><label>Supplier<select name="supplier" defaultValue={dialog.product?.supplier_id ?? ""}><option value="">Unassigned</option>{data.suppliers.map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label><div className="form-row"><label>Reorder point<input name="reorder" type="number" step={1} min={0} max={1000000} required defaultValue={dialog.product?.reorder_point ?? 10} /></label><label>Quoted unit cost ({currency})<input name="cost" type="number" step="0.01" min={0} max={1000000} required defaultValue={(dialog.product?.unit_cost_cents ?? 0) / 100} /></label></div><p className="form-hint">New products start with zero stock. Post a receipt to add inventory.</p></>}
      {dialog.kind === "supplier" && <><label>Supplier name<input name="name" required minLength={2} maxLength={120} defaultValue={dialog.supplier?.name} /></label><label>Contact email<input name="email" type="email" maxLength={254} defaultValue={dialog.supplier?.email} /></label><div className="form-row"><label>Phone<input name="phone" maxLength={40} defaultValue={dialog.supplier?.phone} /></label><label>Lead time (days)<input name="lead" type="number" min={0} max={365} step={1} required defaultValue={dialog.supplier?.lead_time_days ?? 3} /></label></div></>}
      {dialog.kind === "stock" && <><label>Product<select name="product" required defaultValue={dialog.product?.id ?? ""}><option value="" disabled>Select product</option>{data.products.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.quantity} on hand</option>)}</select></label><label>Movement type<select name="kind" defaultValue="receipt"><option value="receipt">Receive stock</option><option value="issue">Issue stock</option><option value="adjustment">Adjust stock (+ or −)</option></select></label><div className="form-row"><label>Quantity (whole units)<input name="quantity" type="number" required step={1} min={-1000000} max={1000000} defaultValue={1} /></label><label>Incoming unit cost ({currency})<input name="cost" type="number" required step="0.01" min={0} max={1000000} defaultValue={(dialog.product?.unit_cost_cents ?? 0) / 100} /></label></div><label>Reference / reason<input name="reason" required minLength={3} maxLength={240} placeholder="Purchase receipt, order number, or adjustment reason" /></label><p className="form-hint">Use positive quantities for receipts and issues. Adjustments accept signed quantities. Outgoing valuation uses the existing weighted-average cost. Postings are permanent.</p></>}
      {error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" disabled={pending} onClick={() => setDialog(null)}>Cancel</button><button className="button primary" disabled={pending}>{pending ? "Saving…" : dialog.kind === "stock" ? "Post movement" : "Save changes"}<Icon name="check" size={16} /></button></div>
    </form></Modal>}
  </div>;
}
