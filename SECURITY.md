# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| `main`  | Yes       |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Report privately via:

- [GitHub private security advisory](https://github.com/YukaC/OpenBalance/security/advisories/new) for this repository, or
- Email: **agusyuk25@gmail.com**

Include steps to reproduce, affected area (auth, sync API, client storage), and impact if known. We aim to acknowledge reports within a few business days.

## Scope

OpenBalance is a personal finance PWA (Next.js, optional Auth.js + Postgres sync, local-first storage). Reports about session handling, credential storage, sync authorization, or exposure of financial data in logs/backups are in scope. Third-party dependency alerts without a demonstrated exploit in this app may be treated as informational.
