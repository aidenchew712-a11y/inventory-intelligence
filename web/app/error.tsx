"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="loading"><h1>This workspace could not be loaded.</h1><p>Check your connection and try again. Your saved inventory has not been changed.</p><button className="button primary" onClick={reset}>Try again</button><Link href="/login">Return to sign in</Link></main>;
}
