-- SpielzeitApp API – Multi-Team + Saison + Archiv
-- MariaDB/MySQL 10.x, UTF8MB4

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Benutzer (Rolle global: admin, head_coach, coach, viewer)
CREATE TABLE IF NOT EXISTS users (
    id              VARCHAR(32)  NOT NULL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(255) NOT NULL DEFAULT '',
    role            ENUM('admin','head_coach','coach','viewer') NOT NULL DEFAULT 'viewer',
    created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    last_login_at   DATETIME(3)  NULL,
    INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Saisonen (z. B. 2025/26)
CREATE TABLE IF NOT EXISTS seasons (
    id           VARCHAR(32)  NOT NULL PRIMARY KEY,
    name         VARCHAR(32)  NOT NULL COMMENT 'z.B. 2025/26',
    year_start   SMALLINT     NOT NULL COMMENT 'Jahr Start',
    year_end     SMALLINT     NOT NULL COMMENT 'Jahr Ende',
    is_archived  TINYINT(1)   NOT NULL DEFAULT 0,
    created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_seasons_years (year_start, year_end),
    INDEX idx_seasons_archived (is_archived)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Teams (ein Verein, mehrere Teams)
CREATE TABLE IF NOT EXISTS teams (
    id          VARCHAR(32)  NOT NULL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL COMMENT 'z.B. U11 A – SPG Rohrbach',
    short_name  VARCHAR(64)  NOT NULL DEFAULT '' COMMENT 'z.B. SPG Rohrbach',
    created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_teams_name (name(64))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Team-Saison (Verknüpfung Team + Saison, kann archiviert werden)
CREATE TABLE IF NOT EXISTS team_seasons (
    id           VARCHAR(32)  NOT NULL PRIMARY KEY,
    team_id      VARCHAR(32)  NOT NULL,
    season_id    VARCHAR(32)  NOT NULL,
    is_archived  TINYINT(1)   NOT NULL DEFAULT 0,
    created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_team_season (team_id, season_id),
    INDEX idx_team_seasons_team (team_id),
    INDEX idx_team_seasons_season (season_id),
    INDEX idx_team_seasons_archived (is_archived),
    CONSTRAINT fk_ts_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT fk_ts_season FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Benutzer-Zugehörigkeit zu Teams (Berechtigung)
CREATE TABLE IF NOT EXISTS team_memberships (
    id         VARCHAR(32)  NOT NULL PRIMARY KEY,
    user_id    VARCHAR(32)  NOT NULL,
    team_id    VARCHAR(32)  NOT NULL,
    role       ENUM('admin','head_coach','coach','viewer') NOT NULL DEFAULT 'viewer',
    status     VARCHAR(16)  NOT NULL DEFAULT 'active',
    created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_user_team (user_id, team_id),
    INDEX idx_tm_user (user_id),
    INDEX idx_tm_team (team_id),
    CONSTRAINT fk_tm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_tm_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Spieler (Stammdaten, vereinsweit)
CREATE TABLE IF NOT EXISTS players (
    id          VARCHAR(32)  NOT NULL PRIMARY KEY,
    first_name  VARCHAR(128) NOT NULL,
    last_name   VARCHAR(128) NOT NULL,
    display_name VARCHAR(255) NULL,
    created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_players_name (last_name, first_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kader: Spieler pro Team-Saison (Roster)
CREATE TABLE IF NOT EXISTS team_season_players (
    id              VARCHAR(32)  NOT NULL PRIMARY KEY,
    team_season_id  VARCHAR(32)  NOT NULL,
    player_id       VARCHAR(32)  NOT NULL,
    shirt_number    SMALLINT     NULL,
    position        VARCHAR(32)  NULL,
    created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_ts_player (team_season_id, player_id),
    INDEX idx_tsp_team_season (team_season_id),
    INDEX idx_tsp_player (player_id),
    CONSTRAINT fk_tsp_team_season FOREIGN KEY (team_season_id) REFERENCES team_seasons(id) ON DELETE CASCADE,
    CONSTRAINT fk_tsp_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Spiele (gehören immer zu einer Team-Saison)
CREATE TABLE IF NOT EXISTS matches (
    id            VARCHAR(32)  NOT NULL PRIMARY KEY,
    team_season_id VARCHAR(32)  NOT NULL,
    opponent_name VARCHAR(255) NOT NULL,
    is_home       TINYINT(1)   NOT NULL DEFAULT 1,
    match_date    DATE         NOT NULL,
    kickoff_time  TIME         NOT NULL,
    status        ENUM('planned','live','finished') NOT NULL DEFAULT 'planned',
    goals_home    SMALLINT     NOT NULL DEFAULT 0,
    goals_away    SMALLINT     NOT NULL DEFAULT 0,
    home_logo     VARCHAR(512)  NULL,
    away_logo     VARCHAR(512)  NULL,
    created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_matches_team_season (team_season_id),
    INDEX idx_matches_date (match_date),
    INDEX idx_matches_status (status),
    INDEX idx_matches_ts_status (team_season_id, status),
    CONSTRAINT fk_matches_team_season FOREIGN KEY (team_season_id) REFERENCES team_seasons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
