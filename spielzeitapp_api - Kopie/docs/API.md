# SpielzeitApp API – Endpoints & Fehlercodes

Basis-URL: `https://myquetschnapp.at/spielzeitapp_api`  
Alle Antworten: **JSON**. Auth: Header `Authorization: Bearer <JWT>` (außer Health und Login/Register).

---

## Fehlercodes (einheitlich)

| HTTP | error.code       | Bedeutung |
|------|------------------|-----------|
| 400  | validation_error | Pflichtfeld fehlt oder Wert ungültig |
| 400  | invalid_json     | Request-Body ist kein gültiges JSON |
| 401  | unauthorized     | Kein Bearer-Token |
| 401  | invalid_token    | Token ungültig oder abgelaufen |
| 401  | user_not_found   | User zum Token existiert nicht mehr |
| 401  | invalid_credentials | Login: E-Mail/Passwort falsch |
| 403  | forbidden        | Keine Berechtigung (Rolle/Team) |
| 404  | not_found        | Ressource nicht gefunden |
| 409  | conflict         | z. B. Team-Saison existiert bereits |
| 409  | email_exists     | E-Mail bei Register schon vergeben |
| 503  | –                | Health: DB nicht erreichbar |

Fehler-Response-Format:

```json
{
  "error": {
    "code": "validation_error",
    "message": "teamSeasonId, opponentName und matchDate sind Pflicht."
  }
}
```

---

## Endpoints

### GET /api/v1/health

Ohne Auth. Prüft API und DB.

**Response 200:**

```json
{
  "status": "ok",
  "version": "1.0",
  "checks": { "database": "ok" }
}
```

**503** wenn DB nicht erreichbar: `"status": "degraded"`, `"database": "error"`.

---

### GET /api/v1/me

Auth erforderlich. Aktueller User inkl. Rolle und Teams mit Team-Saisonen.

**Response 200:**

```json
{
  "user": {
    "id": "abc123",
    "email": "trainer@example.com",
    "displayName": "Max Trainer",
    "role": "head_coach"
  },
  "teams": [
    {
      "teamId": "t1",
      "teamName": "U11 A – SPG Rohrbach",
      "shortName": "SPG Rohrbach",
      "role": "head_coach",
      "teamSeasons": [
        {
          "id": "ts1",
          "seasonId": "s1",
          "seasonName": "2025/26",
          "isArchived": false
        }
      ]
    }
  ]
}
```

---

### GET /api/v1/seasons

Auth. Liste Saisonen. Query: `archived=0` (Default) oder `1`.

**Response 200:**

```json
{
  "seasons": [
    {
      "id": "s1",
      "name": "2025/26",
      "yearStart": 2025,
      "yearEnd": 2026,
      "isArchived": false,
      "createdAt": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

### POST /api/v1/seasons

Auth. Rolle: **admin**, **head_coach**. Legt eine Saison an.

**Body:** `{ "name": "2026/27", "yearStart": 2026, "yearEnd": 2027 }`  
**Response 201:** `{ "season": { "id": "...", "name": "2026/27", ... } }`

---

### GET /api/v1/teams

Auth. Liste Teams, auf die der User Zugriff hat (team_memberships).

**Response 200:** `{ "teams": [ { "id", "name", "shortName", "createdAt" } ] }`

### POST /api/v1/teams

Auth. Rolle: **admin**, **head_coach**.

**Body:** `{ "name": "U11 A – SPG Rohrbach", "shortName": "SPG Rohrbach" }`  
**Response 201:** `{ "team": { "id", "name", "shortName", "createdAt" } }`

---

### GET /api/v1/team-seasons

Auth. Optionale Filter: `teamId`, `seasonId` (Query).

**Response 200:**

```json
{
  "teamSeasons": [
    {
      "id": "ts1",
      "teamId": "t1",
      "seasonId": "s1",
      "teamName": "U11 A – SPG Rohrbach",
      "seasonName": "2025/26",
      "yearStart": 2025,
      "yearEnd": 2026,
      "isArchived": false,
      "createdAt": "..."
    }
  ]
}
```

### POST /api/v1/team-seasons

Auth. Rolle: **admin**, **head_coach**.

**Body:** `{ "teamId": "t1", "seasonId": "s1" }`  
**Response 201:** `{ "teamSeason": { "id", "teamId", "seasonId", ... } }`

### POST /api/v1/team-seasons/:id/archive

Auth. Rolle: **admin**, **head_coach**. Setzt Team-Saison auf archiviert.

**Response 200:** `{ "ok": true, "message": "Team-Saison archiviert." }`

### POST /api/v1/team-seasons/:id/clone-roster?fromTeamSeasonId=...

Auth. Rolle: **admin**, **head_coach**, **coach**. Kopiert Kader aus einer anderen Team-Saison.

**Response 200:** `{ "ok": true, "clonedCount": 14 }`

---

### GET /api/v1/matches

Auth. **Pflicht-Query:** `teamSeasonId`. Optional: `status=planned|live|finished`.

**Response 200:**

```json
{
  "matches": [
    {
      "id": "m1",
      "teamSeasonId": "ts1",
      "opponentName": "Pottenbrunn",
      "isHome": true,
      "matchDate": "2026-03-15",
      "kickoffTime": "10:30:00",
      "status": "planned",
      "goalsHome": 0,
      "goalsAway": 0,
      "homeLogo": null,
      "awayLogo": null,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

### POST /api/v1/matches

Auth. Rolle: **coach**, **head_coach**, **admin**.

**Body (Beispiel):**

```json
{
  "teamSeasonId": "ts1",
  "opponentName": "Pottenbrunn",
  "isHome": true,
  "matchDate": "2026-03-15",
  "kickoffTime": "10:30",
  "status": "planned",
  "goalsHome": 0,
  "goalsAway": 0,
  "homeLogo": null,
  "awayLogo": null
}
```

**Response 201:** `{ "match": { ... } }`

### GET /api/v1/matches/:matchId

Auth. Einzelnes Match.

### PUT /api/v1/matches/:matchId

Auth. Rolle: **coach**, **head_coach**, **admin**. Teilupdate (nur mitgesendete Felder).

**Body (Beispiel):** `{ "status": "live", "goalsHome": 1, "goalsAway": 0 }`

### DELETE /api/v1/matches/:matchId

Auth. Rolle: **coach**, **head_coach**, **admin**.  
**Response 204** (kein Body).

---

## Rollen

- **admin** – Vollzugriff, Saison/Team/Team-Saison anlegen, archivieren, Kader klonen.
- **head_coach** – Wie admin für Saison/Team/Team-Saison und Matches.
- **coach** – Matches lesen/schreiben, Kader klonen; keine Saison-/Team-Anlage.
- **viewer** – Nur lesen (Teams, Team-Saisonen, Matches).

Rolle wird serverseitig aus `users.role` bzw. `team_memberships.role` gelesen. In Prod darf die Rolle nicht im UI umgeschaltet werden; für Tests kann später ein „Impersonate“ nur für **admin** ergänzt werden.
