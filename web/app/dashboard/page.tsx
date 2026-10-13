import { Suspense } from "react";
import { getSnapshot } from "@/lib/data";
import { Dashboard } from "@/components/dashboard";
export const metadata = { title: "Workspace", robots: { index: false, follow: false } };
async function WorkspaceContent() { return <Dashboard initial={await getSnapshot()} demo={false} />; }
export default function WorkspacePage() { return <Suspense fallback={<div className="loading">Loading your inventory workspace…</div>}><WorkspaceContent /></Suspense>; }
