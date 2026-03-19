import Database from "better-sqlite3";
import path from "path";

interface ClipRow {
  id: string;
  created_at: string;
  local_thumbnail_path: string;
  time_zone: string;
  is_bird: number | null;
  species: string | null;
  gender: string | null;
  count: number | null;
  confidence: string | null;
  non_bird_species: string | null;
}

export interface Identification {
  isBird: boolean;
  species: string | null;
  gender: string | null;
  count: number | null;
  confidence: string | null;
  nonBirdSpecies: string | null;
}

export interface Clip {
  id: string;
  createdAt: string;
  thumbnailPath: string;
  identifications: Identification[];
}

export interface DateGroup {
  date: string;
  clips: Clip[];
}

function getDb() {
  const dbPath = path.join(process.cwd(), "data", "bird-data.db");
  return new Database(dbPath, { readonly: true });
}

function toChicagoDate(isoString: string): string {
  // en-CA locale produces YYYY-MM-DD format, safe for use in URL paths
  return new Date(isoString).toLocaleDateString("en-CA", {
    timeZone: "America/Chicago",
  });
}

function toHumanDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function buildClips(rows: ClipRow[]): Clip[] {
  const clipMap = new Map<string, Clip>();
  const clipOrder: string[] = [];

  for (const row of rows) {
    if (!clipMap.has(row.id)) {
      clipMap.set(row.id, {
        id: row.id,
        createdAt: row.created_at,
        thumbnailPath: row.local_thumbnail_path,
        identifications: [],
      });
      clipOrder.push(row.id);
    }

    if (row.is_bird !== null) {
      clipMap.get(row.id)!.identifications.push({
        isBird: row.is_bird === 1,
        species: row.species,
        gender: row.gender,
        count: row.count,
        confidence: row.confidence,
        nonBirdSpecies: row.non_bird_species,
      });
    }
  }

  return clipOrder.map((id) => clipMap.get(id)!);
}

export function getAvailableDates(): string[] {
  const db = getDb();

  const rows = db
    .prepare(`SELECT DISTINCT created_at FROM clips ORDER BY created_at DESC`)
    .all() as { created_at: string }[];

  db.close();

  const seen = new Set<string>();
  const dates: string[] = [];
  for (const row of rows) {
    const d = toChicagoDate(row.created_at);
    if (!seen.has(d)) {
      seen.add(d);
      dates.push(d);
    }
  }
  return dates;
}

export function getClipsForDate(date: string): Clip[] {
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT c.id, c.created_at, c.local_thumbnail_path, c.time_zone,
              i.is_bird, i.species, i.gender, i.count, i.confidence, i.non_bird_species
       FROM clips c
       LEFT JOIN identifications i ON c.id = i.clip_id
       ORDER BY c.created_at DESC`
    )
    .all() as ClipRow[];

  db.close();

  const filtered = rows.filter((r) => toChicagoDate(r.created_at) === date);
  return buildClips(filtered);
}

export function formatDateHeading(date: string): string {
  return toHumanDate(date + "T12:00:00");
}
