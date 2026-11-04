# Ruoli e permessi — comportamento attuale (RC 20261104b)

## Mapping IT → codice

| IT | Codice | Permessi principali |
|---|---|---|
| proprietario | `owner` | edit, invite, roles, delete, expenses, stops, docs, polls, checklist |
| amministratore | `admin` | edit, invite, expenses, stops, docs, polls, checklist (**no** roles/delete) |
| collaboratore | `member` | edit, expenses, stops, polls, checklist, docs-read, polls-vote (**no** invite/roles/delete) |
| visualizzatore | `readonly` | docs-read, polls-vote |

Fonte: `lib/roles.mjs` (`can`, `normalizeRole`, `assertMutationAllowed`).

## Dove sono applicati

| Superficie | Enforcement |
|---|---|
| Hub (`pv-platform.js`) | UI gate + `X-Pronti-Member-Id` + `actorMemberId` su PUT |
| Backend `trips.mjs` | `assertMutationAllowed` → **403** se memberId dichiarato e ruolo insufficiente; merge ruoli bloccato senza permesso `roles` |
| viewToken (sola lettura) | `canEdit:false` — mutazioni rifiutate (401/403) senza edit key |
| SPA React / ux-suite | Usa edit key Bearer; non sempre invia memberId |

## Limite architetturale (compatibilità dati)

I viaggi condividono **una sola edit key**. Senza token per-membro, il server **non può autenticare criptograficamente** l’attore.

Comportamento scelto (compatibile con dati esistenti):

1. **Nessun** `X-Pronti-Member-Id` / `actorMemberId` → **legacy allow** (chi possiede la edit key può mutare). Evita di rompere client pre-RC.
2. **Con** memberId dichiarato → soft RBAC server-side (403 se ruolo insufficiente).
3. Hub invia sempre memberId quando risolvibile dal profilo/membri del viaggio.

## Operazioni vietate (quando memberId è dichiarato)

| Ruolo | Vietato |
|---|---|
| visualizzatore | edit, delete, invite, roles, expenses mutate, stops mutate, docs write, polls create |
| collaboratore | delete, invite, roles |
| amministratore | delete, roles |
| proprietario | — |

## Cosa non è ancora “RBAC forte”

- Un collaboratore con la edit key condivisa può omettere l’header e aggirare il soft check.
- Mitigazione minima futura (fuori scope RC se non approvata): emit `memberToken` per utente al join, verificare lato server, senza schema distruttivo.

## Compatibilità

- Campi ruoli in `trip.meta.roles` (additive).
- Viaggi senza `meta.roles`: primo membro = owner, altri = member (`roleMapFromTrip`).
