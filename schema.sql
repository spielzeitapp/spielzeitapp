-- SpielzeitApp V1 Schema
-- Engine: InnoDB, Charset: utf8mb4

SET NAMES utf8mb4;

CREATE TABLE clubs (
  id            VARCHAR(36)    NOT NULL,
  name          VARCHAR(255)   NOT NULL,
  slug          VARCHAR(255)   NOT NULL,
  created_at    DATETIME(3)    NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_clubs_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE teams (
  id            VARCHAR(36)    NOT NULL,
  club_id       VARCHAR(36)    NOT NULL,
  name          VARCHAR(255)   NOT NULL,
  season        VARCHAR(32)    NOT NULL,
  created_at    DATETIME(3)    NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_teams_club_name_season (club_id, name, season),
  KEY idx_teams_club_id (club_id),
  CONSTRAINT fk_teams_club
    FOREIGN KEY (club_id) REFERENCES clubs(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id             VARCHAR(36)   NOT NULL,
  email          VARCHAR(255)  NOT NULL,
  password_hash  VARCHAR(255)  NOT NULL,
  display_name   VARCHAR(255)  NOT NULL,
  created_at     DATETIME(3)   NOT NULL,
  last_login_at  DATETIME(3)   NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE team_memberships (
  id          VARCHAR(36)   NOT NULL,
  team_id     VARCHAR(36)   NOT NULL,
  user_id     VARCHAR(36)   NOT NULL,
  role        ENUM('viewer','parent','trainer','admin') NOT NULL,
  status      ENUM('active','invited','disabled')       NOT NULL,
  created_at  DATETIME(3)   NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_team_membership_team_user (team_id, user_id),
  KEY idx_team_memberships_team_id (team_id),
  KEY idx_team_memberships_user_id (user_id),
  CONSTRAINT fk_team_memberships_team
    FOREIGN KEY (team_id) REFERENCES teams(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_team_memberships_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE players (
  id             VARCHAR(36)   NOT NULL,
  team_id        VARCHAR(36)   NOT NULL,
  first_name     VARCHAR(100)  NOT NULL,
  last_name      VARCHAR(100)  NOT NULL,
  display_name   VARCHAR(255)  NULL,
  shirt_number   INT           NULL,
  active         TINYINT(1)    NOT NULL DEFAULT 1,
  created_at     DATETIME(3)   NOT NULL,
  PRIMARY KEY (id),
  KEY idx_players_team_id (team_id),
  KEY idx_players_active (active),
  CONSTRAINT fk_players_team
    FOREIGN KEY (team_id) REFERENCES teams(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE matches (
  id                  VARCHAR(36)   NOT NULL,
  team_id             VARCHAR(36)   NOT NULL,
  opponent_name       VARCHAR(255)  NOT NULL,
  home_away           ENUM('home','away') NOT NULL,
  kickoff_at          DATETIME(3)   NOT NULL,
  status              ENUM('planned','live','finished') NOT NULL DEFAULT 'planned',
  score_home          INT           NOT NULL DEFAULT 0,
  score_away          INT           NOT NULL DEFAULT 0,
  period              TINYINT       NULL,
  timer_is_running    TINYINT(1)    NOT NULL DEFAULT 0,
  timer_started_at    DATETIME(3)   NULL,
  timer_accum_seconds INT           NOT NULL DEFAULT 0,
  created_at          DATETIME(3)   NOT NULL,
  updated_at          DATETIME(3)   NOT NULL,
  PRIMARY KEY (id),
  KEY idx_matches_team_id (team_id),
  KEY idx_matches_kickoff (kickoff_at),
  CONSTRAINT fk_matches_team
    FOREIGN KEY (team_id) REFERENCES teams(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE match_lineups (
  id        VARCHAR(36)   NOT NULL,
  match_id  VARCHAR(36)   NOT NULL,
  side      ENUM('home','away') NOT NULL,
  player_id VARCHAR(36)   NOT NULL,
  `group`   ENUM('starting','bench') NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_match_lineup (match_id, side, player_id),
  KEY idx_match_lineups_match_id (match_id),
  KEY idx_match_lineups_player_id (player_id),
  CONSTRAINT fk_match_lineups_match
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_match_lineups_player
    FOREIGN KEY (player_id) REFERENCES players(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE match_field_slots (
  id         VARCHAR(36)   NOT NULL,
  match_id   VARCHAR(36)   NOT NULL,
  side       ENUM('home','away') NOT NULL,
  slot_id    VARCHAR(8)    NOT NULL,
  player_id  VARCHAR(36)   NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_match_field_slot (match_id, side, slot_id),
  KEY idx_match_field_slots_match_id (match_id),
  KEY idx_match_field_slots_player_id (player_id),
  CONSTRAINT fk_match_field_slots_match
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_match_field_slots_player
    FOREIGN KEY (player_id) REFERENCES players(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE match_events (
  id                 VARCHAR(36)   NOT NULL,
  match_id           VARCHAR(36)   NOT NULL,
  created_at         DATETIME(3)   NOT NULL,
  created_by_user_id VARCHAR(36)   NULL,
  type               ENUM('kickoff','period_start','period_end','goal','sub','card','note','final_whistle') NOT NULL,
  minute             INT           NULL,
  team_side          ENUM('home','away') NULL,
  player_id          VARCHAR(36)   NULL,
  player_in_id       VARCHAR(36)   NULL,
  player_out_id      VARCHAR(36)   NULL,
  card_type          ENUM('yellow','red','blue','none') NULL,
  note               TEXT          NULL,
  PRIMARY KEY (id),
  KEY idx_match_events_match_id (match_id),
  KEY idx_match_events_created_by (created_by_user_id),
  KEY idx_match_events_player_id (player_id),
  KEY idx_match_events_player_in (player_in_id),
  KEY idx_match_events_player_out (player_out_id),
  CONSTRAINT fk_match_events_match
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_match_events_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_match_events_player
    FOREIGN KEY (player_id) REFERENCES players(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_match_events_player_in
    FOREIGN KEY (player_in_id) REFERENCES players(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_match_events_player_out
    FOREIGN KEY (player_out_id) REFERENCES players(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

