"""Atomic daily admission limit across workers sharing the configured SQLite file."""
import contextlib
import datetime
from pathlib import Path
import sqlite3


def reserve(path, limit):
    if limit < 1:
        return False
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    day = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    with contextlib.closing(sqlite3.connect(path, timeout=3, isolation_level=None)) as db:
        db.execute('BEGIN IMMEDIATE')
        db.execute('CREATE TABLE IF NOT EXISTS daily_usage (day TEXT PRIMARY KEY, requests INTEGER NOT NULL CHECK(requests >= 0))')
        db.execute('INSERT OR IGNORE INTO daily_usage VALUES (?, 0)', (day,))
        count = db.execute('SELECT requests FROM daily_usage WHERE day=?', (day,)).fetchone()[0]
        if count >= limit:
            db.rollback()
            return False
        db.execute('UPDATE daily_usage SET requests=requests+1 WHERE day=?', (day,))
        db.execute('DELETE FROM daily_usage WHERE day < ?', ((datetime.date.fromisoformat(day)-datetime.timedelta(days=31)).isoformat(),))
        db.commit()
        return True
