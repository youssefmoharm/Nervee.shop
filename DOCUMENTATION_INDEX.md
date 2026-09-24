# Documentation Index

Canonical documentation for NERVE. One-shot status reports and completed-session notes were removed during the 2026 production cleanup; only living guides remain.

## Core

| Document                                                       | Purpose                                       |
| -------------------------------------------------------------- | --------------------------------------------- |
| **[README.md](./README.md)**                                   | Overview, quick start, scripts                |
| **[SETUP.md](./SETUP.md)**                                     | Local environment, Supabase, deployment setup |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)**                       | Design decisions & architecture               |
| **[SECURITY_IMPLEMENTATION.md](./SECURITY_IMPLEMENTATION.md)** | Security controls & policies                  |
| **[TESTING.md](./TESTING.md)**                                 | Pre-launch testing checklist                  |
| **[PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md)**       | Deploy checklist                              |

## Operations

| Document                                                       | Purpose                      |
| -------------------------------------------------------------- | ---------------------------- |
| **[VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md)** | Vercel hosting & env vars    |
| **[ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)**     | Full env var reference       |
| **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)**                   | Database schema & migrations |
| **[IMAGE_SETUP_GUIDE.md](./IMAGE_SETUP_GUIDE.md)**             | Product image pipeline       |
| **[EMAIL_AUTOMATION_README.md](./EMAIL_AUTOMATION_README.md)** | Email automation overview    |
| **[EMAIL_AUTOMATION_SETUP.md](./EMAIL_AUTOMATION_SETUP.md)**   | Email configuration          |

## Community

| Document                                       | Purpose                 |
| ---------------------------------------------- | ----------------------- |
| **[CONTRIBUTING.md](./CONTRIBUTING.md)**       | Contribution guidelines |
| **[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)** | Community standards     |

## Recommended reading order

1. New contributors: README → SETUP → ARCHITECTURE → TESTING
2. Deploying: SETUP → VERCEL_DEPLOYMENT_GUIDE → PRODUCTION_READINESS → ENVIRONMENT_VARIABLES
3. Security review: SECURITY_IMPLEMENTATION → SUPABASE_SETUP (RLS)
