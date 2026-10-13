import { Dashboard } from "@/components/dashboard";
import { demoSnapshot } from "@/lib/demo";
export const metadata = { title: "Interactive demo", description: "Explore a working inventory dashboard with isolated sample data.", alternates: { canonical: "/demo" } };
export default function Demo() { return <Dashboard initial={demoSnapshot()} demo />; }
