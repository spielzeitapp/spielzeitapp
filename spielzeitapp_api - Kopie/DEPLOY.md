# SpielzeitApp API – Deployment (FTP + .htaccess)

## 1. Dateien auf FTP

Alle Dateien aus dem Ordner `spielzeitapp_api/` auf den Server kopieren, z. B. nach:

- `https://myquetschnapp.at/spielzeitapp_api/`

**Struktur:**

```
spielzeitapp_api/
├── .htaccess          # Rewrite-Regeln (wichtig)
├── index.php          # Front Controller
├── src/
│   ├── config.php     # DB + JWT (oder Umgebungsvariablen)
│   ├── db.php
│   ├── response.php
│   ├── auth.php
│   ├── middleware.php
│   └── router.php
├── routes/
│   ├── health.php
│   ├── auth.php
│   ├── seasons.php
│   ├── teams.php
│   ├── team_seasons.php
│   ├── matches_v1.php
│   └── events.php
└── schema/
    └── schema.sql     # Einmalig ausführen (MariaDB/MySQL)
```

**Nicht hochladen:** `schema/` kann nur lokal/über SSH ausgeführt werden (DB-Zugriff). Auf dem Server nur, wenn du dort Zugriff auf die Datenbank hast.

## 2. .htaccess (Rewrite-Regeln)

Damit alle Anfragen auf `index.php` geleitet werden:

```apache
RewriteEngine On
RewriteBase /spielzeitapp_api/

# Bestehende Dateien/Ordner nicht umleiten
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

# Alles andere an Front Controller
RewriteRule ^ index.php [L]
```

- `RewriteBase`: anpassen, wenn die API unter einem anderen Pfad liegt (z. B. `/api/`).
- Wenn die API im Document Root liegt: `RewriteBase /` und ggf. `RewriteRule ^ index.php [L]`.

## 3. Konfiguration (DB + JWT)

In `src/config.php` werden per Default Umgebungsvariablen verwendet:

- `SPIELZEITAPP_DB_DSN`  (z. B. `mysql:host=localhost;dbname=spielzeitapp;charset=utf8mb4`)
- `SPIELZEITAPP_DB_USER`
- `SPIELZEITAPP_DB_PASS`
- `SPIELZEITAPP_JWT_SECRET` (starkes Geheimnis für Produktion setzen)

Ohne Setzen der Variablen greifen die Fallbacks in `config.php` (nur für lokale Entwicklung geeignet).

## 4. Datenbank anlegen

1. Datenbank erstellen (z. B. `spielzeitapp`).
2. `schema/schema.sql` ausführen (alle Tabellen anlegen).

Falls die Tabelle `users` bereits existiert und keine Spalte `role` hat:

```sql
ALTER TABLE users ADD COLUMN role ENUM('admin','head_coach','coach','viewer') NOT NULL DEFAULT 'viewer' AFTER display_name;
```

## 5. Kurz-Check

- **GET** `https://myquetschnapp.at/spielzeitapp_api/api/v1/health`  
  → Erwartung: `{"status":"ok", "version":"1.0", "checks":{"database":"ok"}}`
- **POST** Login, dann **GET** `/api/v1/me` mit Header `Authorization: Bearer <token>`  
  → Erwartung: User + Rolle + Teams (evtl. leer).

## 6. CORS

Erlaubte Origins stehen in `index.php` (`$allowedOrigins`). Für deine Frontend-Domain den Eintrag ergänzen (z. B. `https://spielzeitapp.myquetschnapp.at`).
