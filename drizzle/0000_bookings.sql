CREATE TABLE bookings (
 id TEXT PRIMARY KEY NOT NULL,
 access_hash TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 checkin TEXT NOT NULL,
 checkout TEXT NOT NULL,
 total_cents INTEGER NOT NULL,
 guest_name TEXT NOT NULL,
 guest_email TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'creating',
 order_id TEXT UNIQUE,
 order_payload TEXT NOT NULL,
 qr_code TEXT,
 qr_base64 TEXT,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 last_checked INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE night_locks (
 night TEXT PRIMARY KEY NOT NULL,
 booking_id TEXT NOT NULL REFERENCES bookings(id)
);
--> statement-breakpoint
CREATE INDEX locks_booking_idx ON night_locks(booking_id);
--> statement-breakpoint
CREATE TABLE request_limits (
 bucket TEXT PRIMARY KEY NOT NULL,
 count INTEGER NOT NULL DEFAULT 0
);
