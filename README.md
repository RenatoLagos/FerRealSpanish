# FerRealSpanish

> Full-stack Spanish learning platform — Astro/React/TypeScript on Supabase/PostgreSQL with row-level security. 500+ waitlist users, automated email cohorts, deployed on Vercel with GitHub Actions CI/CD.

**Live**: [fer-real-spanish.vercel.app](https://fer-real-spanish.vercel.app)

## What it is

A language-learning platform built around cohort-based teaching, not infinite-scroll lesson feeds. Students get scheduled, finite sessions; teachers get a tooling layer that handles enrollment, payments, comms, and progress without a SaaS subscription stack.

## Why it exists

Most language-learning SaaS prices the operator out of running a real business: per-student fees, integration limits, no data ownership. This platform inverts that — the operator owns the data layer (Supabase + PostgreSQL with row-level security), the comms layer (Resend), and the orchestration (Apache Airflow DAGs for email cohorts). Cheap to run, ergonomic to extend.

## Stack

| Layer           | Tech                                                      |
| --------------- | --------------------------------------------------------- |
| Frontend        | **Astro 5** islands · **React** · **TypeScript**          |
| Auth + DB       | **Supabase** · **PostgreSQL** with row-level security     |
| Email           | **Resend** (transactional + cohort sequences)             |
| Orchestration   | **Apache Airflow** DAGs for cohort lifecycle              |
| Deploy          | **Vercel** + **GitHub Actions** CI/CD                     |

## Features

- 500+ waitlist users onboarded with Supabase auth + RLS-enforced multi-tenancy
- Cohort-based course management — students belong to a class, not a feed
- Typed REST APIs for enrollment, scheduling, and progress
- Automated email sequences (drip, reminders, milestone) via Resend + Airflow
- Continuous deploy on every push via GitHub Actions
- Pre-rendered landing pages for fast first-paint via Astro islands

## Repo layout

```
src/
├── pages/         Astro pages (landing, course, dashboard routes)
├── components/    React components (interactive islands)
├── lib/           Supabase client, API typing, utilities
└── content/       MDX content collections
public/
astro.config.mjs
```

## Local dev

```bash
npm install
cp .env.example .env       # set SUPABASE_URL, SUPABASE_ANON_KEY, RESEND_API_KEY
npm run dev                # http://localhost:4321
```

## Deploy

Connected to Vercel — pushes to `main` auto-deploy. The Astro adapter handles the build; environment variables are managed in the Vercel dashboard.

## Status

Live in production. Active development on cohort management UX and Airflow DAG for milestone-based email triggers.

## Backend

The Python backend (FastAPI + PostgreSQL) lives in a separate private repo: `fer_real_spanish_backend`.

---

**Author**: Renato Lagos · [renatolagos.com](https://renatolagos.com) · Full Stack / Backend / AI Engineer · Berlin
