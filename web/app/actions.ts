"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const id = z.string().uuid();
const credentials = z.object({ email: z.string().trim().email().max(254), password: z.string().min(12).max(128) });
type Result = { error?: string; success?: string };

export async function authenticate(form: FormData): Promise<Result> {
  const parsed = credentials.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter a valid email and a password of at least 12 characters." };
  const supabase = await createClient();
  const mode = form.get("mode");
  if (mode === "signup") {
    const origin = process.env.APP_URL;
    if (!origin) return { error: "Account registration is temporarily unavailable." };
    const { data, error } = await supabase.auth.signUp({ ...parsed.data, options: { emailRedirectTo: origin + "/auth/callback" } });
    if (error) return { error: "Registration could not be completed. Check the details or try again later." };
    if (!data.session) return { success: "Check your email to confirm your account, then sign in." };
  } else {
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { error: "Unable to sign in. Check your email, password, and email confirmation." };
  }
  redirect("/dashboard");
}
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
export async function requestRecovery(form: FormData): Promise<Result> {
  const email = z.string().email().safeParse(form.get("email"));
  if (!email.success) return { error: "Enter a valid email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: process.env.APP_URL + "/auth/callback?next=/reset-password" });
  if (error) return { error: "Recovery is temporarily unavailable. Try again later." };
  return { success: "If an account exists, a recovery email will arrive shortly." };
}
export async function resetPassword(form: FormData): Promise<Result> {
  const password = z.string().min(12).max(128).safeParse(form.get("password"));
  if (!password.success) return { error: "Use at least 12 characters." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your recovery link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: "Password could not be updated." };
  redirect("/dashboard");
}
export async function createWorkspace(form: FormData): Promise<Result> {
  const parsed = z.object({ name: z.string().trim().min(2).max(100), currency: z.enum(["NZD", "AUD", "USD", "GBP", "EUR"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter a workspace name and supported currency." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.rpc("create_workspace", { p_name: parsed.data.name, p_currency: parsed.data.currency });
  if (error) return { error: "The workspace could not be created. Please retry." };
  redirect("/dashboard");
}
async function authorize(org: string, roles: string[]) {
  const orgId = id.parse(org);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in again.");
  const { data, error } = await supabase.from("organization_members").select("role").eq("organization_id", orgId).eq("user_id", user.id).eq("active", true).maybeSingle();
  if (error || !data || !roles.includes(data.role)) throw new Error("You do not have permission for this operation.");
  return { supabase, orgId };
}
const productSchema = z.object({ id: id.optional(), sku: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(120), category: z.string().trim().min(1).max(60), supplier_id: id.nullable(), reorder_point: z.number().int().min(0).max(1000000), unit_cost_cents: z.number().int().min(0).max(100000000) });
export async function saveProduct(org: string, input: unknown): Promise<Result> {
  try {
    const { supabase, orgId } = await authorize(org, ["owner", "manager"]);
    const parsed = productSchema.parse(input);
    const { id: productId, ...fields } = parsed;
    const query = productId ? supabase.from("products").update(fields).eq("organization_id", orgId).eq("id", productId).select("id") : supabase.from("products").insert({ ...fields, organization_id: orgId }).select("id");
    const { data, error } = await query;
    if (error?.code === "23505") return { error: "This SKU is already in use." };
    if (error || !data?.length) return { error: "The product could not be saved. Check its supplier and try again." };
    revalidatePath("/dashboard");
    return { success: "Product saved." };
  } catch (error) { return { error: error instanceof z.ZodError ? "Check the product fields." : error instanceof Error ? error.message : "Product could not be saved." }; }
}
export async function saveSupplier(org: string, input: unknown): Promise<Result> {
  try {
    const { supabase, orgId } = await authorize(org, ["owner", "manager"]);
    const parsed = z.object({ id: id.optional(), name: z.string().trim().min(2).max(120), email: z.union([z.string().email().max(254), z.literal("")]), phone: z.string().max(40), lead_time_days: z.number().int().min(0).max(365) }).parse(input);
    const { id: supplierId, ...fields } = parsed;
    const query = supplierId ? supabase.from("suppliers").update(fields).eq("organization_id", orgId).eq("id", supplierId).select("id") : supabase.from("suppliers").insert({ ...fields, organization_id: orgId }).select("id");
    const { data, error } = await query;
    if (error || !data?.length) return { error: "Supplier could not be saved." };
    revalidatePath("/dashboard");
    return { success: "Supplier saved." };
  } catch { return { error: "Check the supplier fields and your workspace permissions." }; }
}
export async function postMovement(org: string, input: unknown): Promise<Result> {
  try {
    const { supabase, orgId } = await authorize(org, ["owner", "manager", "staff"]);
    const parsed = z.object({ productId: id, kind: z.enum(["receipt", "issue", "adjustment"]), quantity: z.number().int().min(-1000000).max(1000000).refine((n) => n !== 0), unitCostCents: z.number().int().min(0).max(100000000), reason: z.string().trim().min(3).max(240), idempotencyKey: id }).parse(input);
    const { error } = await supabase.rpc("post_stock", { p_organization: orgId, p_product: parsed.productId, p_kind: parsed.kind, p_quantity: parsed.quantity, p_unit_cost: parsed.unitCostCents, p_reason: parsed.reason, p_idempotency: parsed.idempotencyKey });
    if (error) return { error: error.message.includes("insufficient stock") ? "There is not enough stock to post this movement." : "Movement could not be posted. Refresh stock and check your inputs." };
    revalidatePath("/dashboard");
    return { success: "Stock movement posted." };
  } catch { return { error: "Check movement fields and your workspace permissions." }; }
}
