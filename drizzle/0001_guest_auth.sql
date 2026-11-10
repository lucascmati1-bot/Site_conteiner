CREATE TABLE guest_users (
 id TEXT PRIMARY KEY NOT NULL,
 google_sub TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 email TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE auth_sessions (
 token_hash TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES guest_users(id),
 expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX auth_sessions_expiry_idx ON auth_sessions(expires_at);
--> statement-breakpoint
CREATE TABLE oauth_states (
 state_hash TEXT PRIMARY KEY NOT NULL,
 browser_hash TEXT NOT NULL,
 verifier TEXT NOT NULL,
 nonce TEXT NOT NULL,
 return_to TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
--> statement-breakpoint
ALTER TABLE bookings ADD COLUMN user_id TEXT REFERENCES guest_users(id);
