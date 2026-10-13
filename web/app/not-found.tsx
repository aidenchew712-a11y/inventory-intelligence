import Link from "next/link";
export default function NotFound() { return <main className="loading"><span className="eyebrow">404</span><h1>This shelf is empty.</h1><p>The page you requested could not be found.</p><Link className="button primary" href="/">Back to home</Link></main>; }
