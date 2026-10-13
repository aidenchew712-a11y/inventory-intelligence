import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Recover account", robots: { index: false, follow: false } };
export default function Recovery() { return <AuthForm mode="recovery" />; }
