PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS accounts(
 id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,verifier TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1)),
 used_bytes INTEGER NOT NULL DEFAULT 0 CHECK(used_bytes BETWEEN 0 AND 10485760),
 entity_count INTEGER NOT NULL DEFAULT 0 CHECK(entity_count BETWEEN 0 AND 10000),revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions(
 token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_owner ON sessions(user_id,created_at);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS login_attempts(bucket TEXT PRIMARY KEY,window INTEGER NOT NULL,count INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS attempts_window ON login_attempts(window);
CREATE TABLE IF NOT EXISTS entries(
 user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,key TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version>0),payload TEXT NOT NULL CHECK(json_valid(payload)),
 deleted INTEGER NOT NULL CHECK(deleted IN(0,1)),modified_at INTEGER NOT NULL,write_id TEXT NOT NULL,
 bytes INTEGER GENERATED ALWAYS AS(CASE WHEN deleted=1 THEN 0 ELSE length(CAST(payload AS BLOB)) END) STORED CHECK(bytes<=262144),
 PRIMARY KEY(user_id,key)
);
CREATE TRIGGER IF NOT EXISTS entries_quota_insert BEFORE INSERT ON entries
 WHEN NOT EXISTS(SELECT 1 FROM entries WHERE user_id=NEW.user_id AND key=NEW.key)
 BEGIN
  SELECT RAISE(ABORT,'ACCOUNT_QUOTA') WHERE (SELECT used_bytes+NEW.bytes>10485760 OR entity_count>=10000 FROM accounts WHERE id=NEW.user_id);
 END;
CREATE TRIGGER IF NOT EXISTS entries_quota_update BEFORE UPDATE ON entries BEGIN
 SELECT RAISE(ABORT,'ACCOUNT_QUOTA') WHERE (SELECT used_bytes-OLD.bytes+NEW.bytes>10485760 FROM accounts WHERE id=NEW.user_id);
END;
CREATE TRIGGER IF NOT EXISTS entries_count_insert AFTER INSERT ON entries BEGIN
 UPDATE accounts SET used_bytes=used_bytes+NEW.bytes,entity_count=entity_count+1,revision=revision+1 WHERE id=NEW.user_id;
END;
CREATE TRIGGER IF NOT EXISTS entries_count_update AFTER UPDATE ON entries BEGIN
 UPDATE accounts SET used_bytes=used_bytes-OLD.bytes+NEW.bytes,revision=revision+1 WHERE id=NEW.user_id;
END;
CREATE TRIGGER IF NOT EXISTS entries_count_delete AFTER DELETE ON entries BEGIN
 UPDATE accounts SET used_bytes=used_bytes-OLD.bytes,entity_count=entity_count-1,revision=revision+1 WHERE id=OLD.user_id;
END;
CREATE TRIGGER IF NOT EXISTS changed_credential AFTER UPDATE OF verifier,enabled ON accounts BEGIN
 DELETE FROM sessions WHERE user_id=NEW.id;
END;
