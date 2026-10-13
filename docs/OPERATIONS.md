# Operations and release notes

## Infrastructure

- Vercel project: inventory-intelligence, Next.js, repository root directory web.
- Supabase project: inventory-intelligence, PostgreSQL 17, Seoul (ap-northeast-2).
- Vercel functions: Seoul (icn1).
- Supabase URL and publishable key are public configuration. User sessions and RLS authorize data access.
- The application does not require a Supabase privileged secret or direct database password.

## Authentication configuration

In Supabase Authentication → URL Configuration, set Site URL to https://inventory-intelligence-potaiden.vercel.app and allow these callback URLs:

    https://inventory-intelligence-potaiden.vercel.app/auth/callback
    http://localhost:3000/auth/callback

Account signup requires email confirmation when enabled by the project. Recovery links use the same callback with a supported next destination. Use custom SMTP and appropriate rate controls before opening registration beyond portfolio evaluation. No shared public demo login is used.

## Database migrations

Tracked migration versions match the versions applied to the hosted project. The db/schema.sql file is the consolidated schema reference, not a migration to rerun against the existing database.

For a fresh local database with Docker running:

    npx.cmd supabase start

Use the Supabase CLI's help to inspect reset, diff, push, and advisor commands before using them. Reset only a disposable local database. New changes must preserve tenant policies, column grants, and protected ledger writes.

The db/security-tests.sql script runs disposable fixtures in a transaction and rolls them back. It tests tenant isolation, viewer permissions, idempotency, payload conflicts, negative-stock rejection, and valuation depletion. Execute it in a suitable test database, not as a customer operation.

## Releases

CI runs lint, type checks, domain tests, production dependency audit, production build, and public browser tests. The disposable authenticated fixture is never committed; its test skips when the fixture is absent. Production schema tests and full-stack verification remain explicit release checks.

Application rollback does not reverse schema changes. Use backward-compatible migrations. Keep backup and recovery arrangements appropriate to the Supabase plan; a paid backup capability has not been provisioned by this release.

## Current boundaries

- Whole stock units, one location per workspace, current valuation snapshots.
- One initial owned workspace per account.
- Catalog snapshots are capped at 5,000 products/suppliers. The interface marks truncation and prevents exporting incomplete snapshots.
- UI movement history displays at most the latest 500 records.
- Synchronous reports are bounded; durable large-report workers are an extension.
- Power BI is not provisioned or connected. Its app-owns-data architecture is documented in the technical blueprint.
- Purchase orders, reservations, multi-location transfers, team invitations, automated forecasting, billing, and self-service account deletion are extensions.

## Dependency notes

Production dependencies are audited separately from development tools. ExcelJS's UUID dependency is scoped to patched uuid@11.1.1 through an override; XLSX generation is verified by browser tests. The braces advisory in Next.js's lint chain has no upstream patch at this release date. Forced audit remediation would downgrade Next.js lint configuration and is not used.

## Diagnostics

The /api/health endpoint returns application health without account or configuration values. Operational failures return user-safe messages. Never log environment contents, session tokens, passwords, or report bodies.
