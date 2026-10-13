import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Snapshot, Product, Supplier, Movement, Workspace } from "./domain";

export async function getSnapshot(workspaceId?: string): Promise<Snapshot> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  let memberQuery = supabase.from("organization_members").select("organization_id, role, organizations(id,name,currency_code,timezone)").eq("user_id", user.id).eq("active", true).order("created_at").limit(1);
  if (workspaceId) memberQuery = memberQuery.eq("organization_id", workspaceId);
  const { data: membership, error: memberError } = await memberQuery.maybeSingle();
  if (memberError) throw new Error("Unable to load workspace access.");
  if (!membership) { if (workspaceId) throw new Error("Workspace access denied."); redirect("/onboarding"); }
  const organization = membership.organizations as unknown as Omit<Workspace, "role">;
  const orgId = membership.organization_id as string;
  const results = await Promise.all([
    supabase.from("products").select("*", { count: "exact" }).eq("organization_id", orgId).order("name").limit(5000),
    supabase.from("suppliers").select("*", { count: "exact" }).eq("organization_id", orgId).order("name").limit(5000),
    supabase.from("inventory_balances").select("*").eq("organization_id", orgId).limit(5000),
    supabase.from("inventory_movements").select("*").eq("organization_id", orgId).order("occurred_at", { ascending: false }).order("id", { ascending: false }).limit(500),
  ]);
  if (results.some((r) => r.error)) throw new Error("Workspace data could not be loaded. Please retry.");
  const [products, suppliers, balances, movements] = results;
  return {
    workspace: { ...organization, role: membership.role as Workspace["role"] },
    products: (products.data ?? []).map((p) => {
      const balance = balances.data?.find((b) => b.product_id === p.id);
      return { id: p.id, sku: p.sku, name: p.name, category: p.category, supplier_id: p.supplier_id, reorder_point: Number(p.reorder_point), unit_cost_cents: Number(p.unit_cost_cents), quantity: Number(balance?.quantity ?? 0), value_cents: Number(balance?.value_cents ?? 0), active: p.active } as Product;
    }),
    suppliers: (suppliers.data ?? []).map((s) => ({ id: s.id, name: s.name, email: s.email ?? "", phone: s.phone ?? "", lead_time_days: s.lead_time_days, active: s.active } as Supplier)),
    movements: (movements.data ?? []).map((m) => ({ id: m.id, product_id: m.product_id, kind: m.kind, quantity_delta: Number(m.quantity_delta), value_delta_cents: Number(m.value_delta_cents), reason: m.reason, occurred_at: m.occurred_at } as Movement)),
    email: user.email ?? "", truncated: (products.count ?? 0) > 5000 || (suppliers.count ?? 0) > 5000,
  };
}
