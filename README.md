# Shafaq

Shafaq is a pharmacy delivery and pharmacist consultation platform.

## Monorepo structure

- `apps/server` — NestJS + Prisma + PostgreSQL backend
- `apps/mobile` — Expo React Native customer application

The backend and mobile app keep their existing package manifests and lockfiles during this migration to minimize dependency and runtime risk. Root scripts delegate to each application without changing their dependency graphs.

## Backend

Run from the repository root:

```bash
npm run server:build
npm run server:test:e2e
npm run server:prisma:generate
npm run server:dev
```

The authoritative backend workflow remains governed by the Shafaq SRS and its existing Prisma migrations.

## Mobile

```bash
npm run mobile:start
```

## Migration safety

The original backend repository history is preserved as the base history of this repository. The original mobile repository remains unchanged during migration and its files are imported into `apps/mobile`. Existing Prisma migrations are moved intact and must not be reset or recreated.
