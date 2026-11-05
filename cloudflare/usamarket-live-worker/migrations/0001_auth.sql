-- USAMarket account and authentication schema
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 display_name TEXT NOT NULL DEFAULT '',
 avatar_url TEXT NOT NULL DEFAULT '',
 password_hash TEXT,
 email_verified_at TEXT,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 last_login_at TEXT
);
CREATE TABLE IF NOT EXISTS oauth_accounts (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 provider TEXT NOT NULL,
 provider_user_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 UNIQUE(provider, provider_user_id),
 UNIQUE(user_id, provider)
);
CREATE TABLE IF NOT EXISTS auth_sessions (
 id_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 last_seen_at TEXT NOT NULL,
 ip_hash TEXT,
 user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS email_action_tokens (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 purpose TEXT NOT NULL CHECK(purpose IN ('verify_email','reset_password')),
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_action_tokens(user_id,purpose);
CREATE TABLE IF NOT EXISTS auth_rate_limits (
 bucket_key TEXT PRIMARY KEY,
 attempts INTEGER NOT NULL DEFAULT 0,
 window_started_at TEXT NOT NULL,
 blocked_until TEXT
);
