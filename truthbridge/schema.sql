-- Bible request database (Cloudflare D1)
CREATE TABLE IF NOT EXISTS requests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  name          TEXT    NOT NULL,
  email         TEXT,
  phone         TEXT,
  address1      TEXT    NOT NULL,
  address2      TEXT,
  city          TEXT    NOT NULL,
  province      TEXT    NOT NULL,
  postal        TEXT    NOT NULL,
  language      TEXT    NOT NULL DEFAULT 'English',
  heard         TEXT,
  message       TEXT,
  status        TEXT    NOT NULL DEFAULT 'new',   -- new | packed | shipped | cancelled
  notes         TEXT,
  shipped_at    TEXT,
  duplicate_of  INTEGER,                          -- earlier request id with same address
  ip_hash       TEXT
);

CREATE INDEX IF NOT EXISTS idx_requests_status  ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_postal  ON requests(postal);
CREATE INDEX IF NOT EXISTS idx_requests_ip      ON requests(ip_hash, created_at);
