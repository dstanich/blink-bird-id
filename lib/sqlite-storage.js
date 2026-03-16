import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

export class SQLiteStorage {
    constructor() {
        this.dataDir = process.env.DATA_DIR || './data';
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        this.db = new Database(path.join(this.dataDir, 'bird-data.db'));
        this.db.pragma('journal_mode = WAL'); // allow concurrent reads/writes and reduce locking issues
        this.db.pragma('foreign_keys = ON');
        this._createSchema();
    }

    _createSchema() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS clips (
                id INTEGER PRIMARY KEY,
                created_at TEXT,
                updated_at TEXT,
                device_name TEXT,
                network_name TEXT,
                type TEXT,
                source TEXT,
                thumbnail TEXT,
                media TEXT,
                time_zone TEXT,
                local_thumbnail_path TEXT
            );

            CREATE TABLE IF NOT EXISTS identifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                clip_id INTEGER NOT NULL REFERENCES clips(id),
                is_bird BOOLEAN NOT NULL,
                species TEXT,
                gender TEXT,
                count INTEGER,
                confidence REAL,
                non_bird_species TEXT,
                model TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_identifications_species ON identifications(species);
            CREATE INDEX IF NOT EXISTS idx_clips_created_at ON clips(created_at);
        `);
    }

    addClip(clip) {
        const insertClip = this.db.prepare(`
            INSERT OR REPLACE INTO clips (id, created_at, updated_at, device_name, network_name, type, source, thumbnail, media, time_zone, local_thumbnail_path)
            VALUES (@id, @created_at, @updated_at, @device_name, @network_name, @type, @source, @thumbnail, @media, @time_zone, @local_thumbnail_path)
        `);

        const insertIdentification = this.db.prepare(`
            INSERT INTO identifications (clip_id, is_bird, species, gender, count, confidence, non_bird_species, model)
            VALUES (@clip_id, @is_bird, @species, @gender, @count, @confidence, @non_bird_species, @model)
        `);

        const transaction = this.db.transaction((clip) => {
            insertClip.run({
                id: clip.id,
                created_at: clip.created_at || null,
                updated_at: clip.updated_at || null,
                device_name: clip.device_name || null,
                network_name: clip.network_name || null,
                type: clip.type || null,
                source: clip.source || null,
                thumbnail: clip.thumbnail || null,
                media: clip.media || null,
                time_zone: clip.time_zone || null,
                local_thumbnail_path: clip.localThumbnailPath || null,
            });

            let identifications = clip.birdIdentification;
            if (!identifications) return;
            if (!Array.isArray(identifications)) {
                identifications = [identifications];
            }

            for (const ident of identifications) {
                insertIdentification.run({
                    clip_id: clip.id,
                    is_bird: ident.is_bird ? 1 : 0,
                    species: ident.species || null,
                    gender: ident.gender || null,
                    count: ident.count ?? null,
                    confidence: ident.confidence ?? null,
                    non_bird_species: ident.non_bird_species || null,
                    model: ident.model || null,
                });
            }
        });

        transaction(clip);
    }

    commit() {
        // No-op: SQLite writes are immediate
    }

    data(since = null) {
        let rows;
        if (since) {
            const sinceStr = since instanceof Date ? since.toISOString() : String(since);
            rows = this.db.prepare('SELECT id FROM clips WHERE created_at >= ?').all(sinceStr);
        } else {
            rows = this.db.prepare('SELECT id FROM clips').all();
        }
        const result = {};
        for (const row of rows) {
            result[row.id] = true;
        }
        return result;
    }
}
