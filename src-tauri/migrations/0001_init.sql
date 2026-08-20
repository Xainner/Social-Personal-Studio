-- Social Persona Studio — esquema inicial
PRAGMA foreign_keys = ON;

CREATE TABLE personas (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL UNIQUE,
  display_name     TEXT NOT NULL DEFAULT '',
  avatar_asset_id  TEXT REFERENCES assets(id) ON DELETE SET NULL,
  description      TEXT NOT NULL DEFAULT '',
  persona_prompt   TEXT NOT NULL DEFAULT '',
  language         TEXT NOT NULL DEFAULT 'es',
  tone             TEXT NOT NULL DEFAULT '',
  default_platforms TEXT NOT NULL DEFAULT '["x","telegram"]',
  emoji_level      TEXT NOT NULL DEFAULT 'low',
  hashtag_level    TEXT NOT NULL DEFAULT 'none',
  style            TEXT NOT NULL DEFAULT '{}',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE persona_examples (
  id         TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('good','bad')),
  text       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_persona_examples_persona ON persona_examples(persona_id);

CREATE TABLE persona_memories (
  id         TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','learned')),
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_persona_memories_persona ON persona_memories(persona_id);

CREATE TABLE persona_platform_settings (
  id         TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  platform   TEXT NOT NULL,
  guidance   TEXT NOT NULL DEFAULT '',
  max_length INTEGER,
  enabled    INTEGER NOT NULL DEFAULT 1,
  UNIQUE (persona_id, platform)
);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  context    TEXT NOT NULL DEFAULT '',
  notes      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_persona ON sessions(persona_id);

CREATE TABLE assets (
  id             TEXT PRIMARY KEY,
  file_path      TEXT NOT NULL,
  thumbnail_path TEXT,
  file_hash      TEXT NOT NULL UNIQUE,
  mime_type      TEXT NOT NULL,
  width          INTEGER,
  height         INTEGER,
  size           INTEGER NOT NULL DEFAULT 0,
  ai_description TEXT,
  created_at     TEXT NOT NULL
);

CREATE TABLE session_assets (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  asset_id   TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, asset_id)
);

CREATE TABLE generation_requests (
  id             TEXT PRIMARY KEY,
  session_id     TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_context   TEXT NOT NULL DEFAULT '',
  platforms      TEXT NOT NULL,
  provider_id    TEXT NOT NULL,
  vision_model   TEXT,
  writing_model  TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  error          TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX idx_generation_requests_session ON generation_requests(session_id);

CREATE TABLE generation_request_assets (
  request_id TEXT NOT NULL REFERENCES generation_requests(id) ON DELETE CASCADE,
  asset_id   TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  PRIMARY KEY (request_id, asset_id)
);

CREATE TABLE generations (
  id         TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE REFERENCES generation_requests(id) ON DELETE CASCADE,
  raw_output TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE generation_options (
  id                TEXT PRIMARY KEY,
  generation_id     TEXT NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  option_index      INTEGER NOT NULL,
  concept           TEXT NOT NULL DEFAULT '',
  reasoning_summary TEXT NOT NULL DEFAULT '',
  UNIQUE (generation_id, option_index)
);

CREATE TABLE platform_variants (
  id             TEXT PRIMARY KEY,
  option_id      TEXT NOT NULL REFERENCES generation_options(id) ON DELETE CASCADE,
  platform       TEXT NOT NULL,
  generated_text TEXT NOT NULL,
  edited_text    TEXT,
  UNIQUE (option_id, platform)
);

CREATE TABLE saved_posts (
  id             TEXT PRIMARY KEY,
  persona_id     TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  session_id     TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  variant_id     TEXT REFERENCES platform_variants(id) ON DELETE SET NULL,
  platform       TEXT NOT NULL,
  final_text     TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'saved'
                 CHECK (status IN ('draft','saved','used','archived')),
  favorite       INTEGER NOT NULL DEFAULT 0,
  used_at        TEXT,
  notes          TEXT NOT NULL DEFAULT '',
  provider_model TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL
);
CREATE INDEX idx_saved_posts_persona ON saved_posts(persona_id, status);

CREATE TABLE post_tags (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE saved_post_tags (
  post_id TEXT NOT NULL REFERENCES saved_posts(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES post_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE ai_providers (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'openai_compatible',
  base_url     TEXT NOT NULL,
  -- Referencia al secreto en el keychain del SO. La API key NUNCA se guarda acá.
  keyring_ref  TEXT,
  capabilities TEXT NOT NULL DEFAULT '{}',
  timeout_ms   INTEGER NOT NULL DEFAULT 300000,
  enabled      INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL
);

CREATE TABLE ai_models (
  id          TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  model_name  TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'both' CHECK (role IN ('vision','writing','both')),
  is_default  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (provider_id, model_name)
);

CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
