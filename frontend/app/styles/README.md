# Frontend stylesheet ownership

`app/globals.css` is the only CSS entrypoint imported by the Next.js layout.

| File | Owns |
| --- | --- |
| `legacy.css` | Existing baseline styles used by the legacy DOM and `app.js`. Avoid new edits here. |
| `theme.css` | Product tokens, shared navigation, controls, and compatibility overrides. |
| `typography.css` | Page-title hierarchy and shared workspace spacing. |
| `dashboard.css` | Dashboard only. |
| `match.css` | CV–JD matching only. |
| `jobs.css` | Job discovery only. |
| `interview.css` | Voice interview only. |
| `assistant.css` | Nova launcher and chat modal only. |

New rules must be scoped to a page root such as `#view-match` or `#view-interview`. Do not add new product rules to `legacy.css`.
