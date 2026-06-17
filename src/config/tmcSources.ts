import { TmcResolvedLocation } from '../types';

// ============================================================================
// TMC Location Sources Configuration
//
// This file defines where and how TMC location codes are resolved to
// coordinates. Sources are tried in this order:
//
//   1. LOCAL JSON files (pre-downloaded national location tables in public/tmc/)
//   2. Overpass API strategies (fallback for countries without local data)
//
// To add a new country:
//   - Download or convert the national TMC location table to JSON format
//   - Save as public/tmc/{CID}_{TABCD}.json
//   - The file format is: { "lcd": [lat, lon, "name", prevLcd, nextLcd], ... }
//   - The local strategy will automatically pick it up
//
// Available local data files:
//   public/tmc/58_1.json  — Germany      (BASt LCL 22.0, CC BY 4.0)
//   public/tmc/17_1.json  — Finland      (Digitraffic, CC BY 4.0)
//   public/tmc/38_1.json  — Netherlands  (NDW VILD, open data)
//   public/tmc/40_49.json — Norway       (Statens vegvesen V.9.2, NLOD)
//
// To regenerate local data, run the scripts in scripts/:
//   bash scripts/convert-ltef.sh <DATA_DIR> <OUTPUT>  (generic LTEF converter)
//   bash scripts/convert-finland.sh                    (Finland — Digitraffic API)
//   bash scripts/convert-ndw.sh                        (Netherlands — NDW WFS)
// ============================================================================

// -- Local JSON file cache ---------------------------------------------------
// Loaded on-demand per country and kept in memory for the session.

const localDataCache = new Map<string, Record<string, [number, number, string, number, number]>>();
const localDataFailed = new Set<string>(); // Track 404s to avoid retrying

export async function lookupLocal(
  lcds: number[],
  cid: number,
  tabcd: number
): Promise<Map<number, TmcResolvedLocation> | null> {
  const key = `${cid}_${tabcd}`;

  // Skip if we already know this file doesn't exist
  if (localDataFailed.has(key)) return null;

  // Load JSON file on first access
  if (!localDataCache.has(key)) {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}tmc/${key}.json`);
      if (!response.ok) {
        localDataFailed.add(key);
        return null;
      }
      const data = await response.json();
      localDataCache.set(key, data);
    } catch {
      localDataFailed.add(key);
      return null;
    }
  }

  const data = localDataCache.get(key)!;
  const resolved = new Map<number, TmcResolvedLocation>();

  for (const lcd of lcds) {
    const entry = data[String(lcd)];
    if (entry) {
      resolved.set(lcd, {
        locationCode: lcd,
        lat: entry[0],
        lon: entry[1],
        name: entry[2] || undefined,
        prevLocationCode: entry[3] || undefined,
        nextLocationCode: entry[4] || undefined,
        status: 'resolved'
      });
    }
  }

  return resolved;
}

export function clearLocalDataCache(): void {
  localDataCache.clear();
  localDataFailed.clear();
}

// -- Overpass API Endpoints (mirrors) ----------------------------------------
// Fallback when no local data is available.
// Add more mirrors here if the existing ones are unreliable.

export interface OverpassEndpoint {
  name: string;
  url: string;
}

export const OVERPASS_ENDPOINTS: OverpassEndpoint[] = [
  { name: 'Overpass DE',   url: 'https://overpass-api.de/api/interpreter' },
  { name: 'Kumi Systems',  url: 'https://overpass.kumi.systems/api/interpreter' },
];

// -- Overpass Query Strategies -----------------------------------------------
// Each strategy knows how to build an Overpass query and parse the response.
// They are tried in order until one returns results.

export interface OverpassElement {
  type: string;
  id: number;
  center?: { lat: number; lon: number };
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

export interface TmcQueryStrategy {
  name: string;
  buildQuery: (lcds: number[], cid: number, tabcd: number) => string;
  parseResponse: (elements: OverpassElement[], cid: number, tabcd: number) => Map<number, TmcResolvedLocation>;
}

export const TMC_QUERY_STRATEGIES: TmcQueryStrategy[] = [

  // Strategy 1: Node-level TMC tags (used by e.g. Germany)
  // Nodes tagged with TMC:cid_XX:tabcd_YY:LocationCode
  {
    name: 'Node tags',
    buildQuery: (lcds, cid, tabcd) => {
      const tagKey = `TMC:cid_${cid}:tabcd_${tabcd}:LocationCode`;
      const lcdPattern = lcds.join('|');
      return `[out:json][timeout:30];\nnode["${tagKey}"~"^(${lcdPattern})$"];\nout;`;
    },
    parseResponse: (elements, cid, tabcd) => {
      const resolved = new Map<number, TmcResolvedLocation>();
      const tagKey = `TMC:cid_${cid}:tabcd_${tabcd}:LocationCode`;
      const tagPrefix = `TMC:cid_${cid}:tabcd_${tabcd}`;

      for (const el of elements) {
        if (el.lat !== undefined && el.lon !== undefined && el.tags) {
          const lcdStr = el.tags[tagKey];
          if (lcdStr) {
            const lcd = parseInt(lcdStr, 10);
            if (!isNaN(lcd)) {
              const prevStr = el.tags[`${tagPrefix}:PrevLocationCode`];
              const nextStr = el.tags[`${tagPrefix}:NextLocationCode`];
              resolved.set(lcd, {
                locationCode: lcd,
                lat: el.lat,
                lon: el.lon,
                name: el.tags.name || undefined,
                prevLocationCode: prevStr ? parseInt(prevStr, 10) : undefined,
                nextLocationCode: nextStr ? parseInt(nextStr, 10) : undefined,
                status: 'resolved'
              });
            }
          }
        }
      }
      return resolved;
    }
  },

  // Strategy 2: tmc:point relations (used by some other countries)
  // Relations with type=tmc:point, table=CID:TABCD, lcd=code
  {
    name: 'Relations',
    buildQuery: (lcds, cid, tabcd) => {
      const lcdPattern = lcds.join('|');
      const table = `${cid}:${tabcd}`;
      return `[out:json][timeout:30];\nrelation["type"="tmc:point"]["table"="${table}"]["lcd"~"^(${lcdPattern})$"];\nout center;`;
    },
    parseResponse: (elements) => {
      const resolved = new Map<number, TmcResolvedLocation>();
      for (const el of elements) {
        if (el.tags?.lcd && el.center) {
          const lcd = parseInt(el.tags.lcd, 10);
          if (!isNaN(lcd)) {
            resolved.set(lcd, {
              locationCode: lcd,
              lat: el.center.lat,
              lon: el.center.lon,
              name: el.tags.name || undefined,
              roadRef: el.tags.road_ref || undefined,
              status: 'resolved'
            });
          }
        }
      }
      return resolved;
    }
  },

  // -------------------------------------------------------------------
  // To add a new Overpass strategy, copy a block above and modify:
  //   name:          A descriptive label (shown in console logs)
  //   buildQuery:    Return an Overpass QL query string
  //   parseResponse: Extract TmcResolvedLocation entries from elements
  // -------------------------------------------------------------------
];

// -- Service Settings --------------------------------------------------------

export const TMC_SERVICE_CONFIG = {
  batchSize: 50,           // Max location codes per Overpass query
  rateLimitMs: 1100,       // Minimum delay between Overpass requests
  queryTimeoutMs: 20000,   // Abort request after this many ms
  maxRetries: 2,           // Number of retry attempts (with endpoint rotation)
};