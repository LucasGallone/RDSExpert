declare const L: any; // Leaflet loaded via CDN

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TmcMessage, TmcServiceInfo, TmcResolvedLocation } from '../types';
import { ECC_PI_TO_TMC_CID } from '../constants';
import { resolveLocations, getCacheSize, clearLocationCache } from '../services/tmcLocationService';

interface TmcMapProps {
  messages: TmcMessage[];
  serviceInfo: TmcServiceInfo;
  ecc: string;
  pi: string;
  isOpen: boolean;
  onClose: () => void;
}

const NATURE_COLORS: Record<string, { color: string; icon: string }> = {
  "Traffic Flow":       { color: '#f59e0b', icon: 'fa-car' },
  "Accident/Incident":  { color: '#ef4444', icon: 'fa-car-burst' },
  "Closure":            { color: '#dc2626', icon: 'fa-ban' },
  "Lane Restriction":   { color: '#f97316', icon: 'fa-road' },
  "Roadworks":          { color: '#a855f7', icon: 'fa-person-digging' },
  "Danger/Obstruction": { color: '#ef4444', icon: 'fa-triangle-exclamation' },
  "Road Condition":     { color: '#3b82f6', icon: 'fa-snowflake' },
  "Meteorological":     { color: '#6366f1', icon: 'fa-cloud' },
  "Public Event":       { color: '#10b981', icon: 'fa-calendar' },
  "Service/Delay":      { color: '#64748b', icon: 'fa-clock' },
  "Information":        { color: '#06b6d4', icon: 'fa-circle-info' },
};

function deriveCid(ecc: string, pi: string): { cid: number; defaultTabcd: number; country: string } | null {
  if (!ecc || !pi || pi.length < 1) return null;
  const key = `${ecc.toUpperCase()}_${pi.charAt(0).toUpperCase()}`;
  return ECC_PI_TO_TMC_CID[key] || null;
}

// Build deduplicated country list sorted alphabetically
const COUNTRY_LIST: { cid: number; defaultTabcd: number; country: string }[] = (() => {
  const seen = new Set<number>();
  const list: { cid: number; defaultTabcd: number; country: string }[] = [];
  for (const entry of Object.values(ECC_PI_TO_TMC_CID)) {
    if (!seen.has(entry.cid)) {
      seen.add(entry.cid);
      list.push(entry);
    }
  }
  return list.sort((a, b) => a.country.localeCompare(b.country));
})();

export const TmcMap: React.FC<TmcMapProps> = ({
  messages, serviceInfo, ecc, pi, isOpen, onClose
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const [resolvedLocations, setResolvedLocations] = useState<Map<number, TmcResolvedLocation>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [manualCountry, setManualCountry] = useState<{ cid: number; defaultTabcd: number; country: string } | null>(null);
  const [hiddenNatures, setHiddenNatures] = useState<Set<string>>(new Set());

  const autoInfo = deriveCid(ecc, pi);
  const tmcInfo = autoInfo || manualCountry;
  const cid = tmcInfo?.cid;
  const tabcd = serviceInfo.ltn > 0 ? serviceInfo.ltn : (tmcInfo?.defaultTabcd || 0);
  const needsManualSelect = !autoInfo && !manualCountry;

  // Initialize map when modal opens
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current).setView([50.0, 10.0], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    mapInstanceRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);

    // Fix grey tiles when map is rendered inside a modal
    setTimeout(() => map.invalidateSize(), 300);

    // Keep map size in sync with container (fixes gray bar after zoom/resize)
    const container = mapContainerRef.current;
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
    };
  }, [isOpen]);

  // Close modal on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Resolve locations when modal is open
  const doResolve = useCallback(async () => {
    if (!isOpen || !cid || !tabcd) return;

    const userMessages = messages.filter(m => !m.isSystem);
    const uniqueCodes = [...new Set(userMessages.map(m => m.locationCode))];
    setTotalCount(uniqueCodes.length);

    if (uniqueCodes.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const resolved = await resolveLocations(uniqueCodes, cid, tabcd);

      // Collect neighbor codes (Prev/Next) for resolved locations to draw lines
      const neighborCodes = new Set<number>();
      resolved.forEach(loc => {
        if (loc.status === 'resolved') {
          if (loc.prevLocationCode) neighborCodes.add(loc.prevLocationCode);
          if (loc.nextLocationCode) neighborCodes.add(loc.nextLocationCode);
        }
      });
      // Remove codes we already have
      resolved.forEach((_, lcd) => neighborCodes.delete(lcd));

      // Resolve neighbor locations
      if (neighborCodes.size > 0) {
        const neighbors = await resolveLocations([...neighborCodes], cid, tabcd);
        neighbors.forEach((v, k) => resolved.set(k, v));
      }

      setResolvedLocations(prev => {
        const merged = new Map(prev);
        resolved.forEach((v, k) => merged.set(k, v));
        return merged;
      });
      const resolvedItems = [...resolved.values()].filter(l => l.status === 'resolved');
      setResolvedCount(resolvedItems.length);

      if (resolvedItems.length === 0 && uniqueCodes.length > 0) {
        setError(`No TMC location data available for this country (CID:${cid}, TABCD:${tabcd}). No local data file found and no TMC locations in OpenStreetMap. You can add local data by placing a ${cid}_${tabcd}.json file in the tmc/ folder.`);
      }
    } catch (err: any) {
      setError(`Failed to resolve locations: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }, [isOpen, messages.length, cid, tabcd]);

  useEffect(() => {
    doResolve();
  }, [doResolve]);

  // Update markers when resolved locations or filters change
  useEffect(() => {
    if (!markersLayerRef.current || !mapInstanceRef.current) return;

    markersLayerRef.current.clearLayers();
    const bounds: [number, number][] = [];

    const userMessages = messages.filter(m => !m.isSystem);

    // Group messages by locationCode
    const grouped = new Map<number, TmcMessage[]>();
    for (const msg of userMessages) {
      if (hiddenNatures.has(msg.nature)) continue;
      const loc = resolvedLocations.get(msg.locationCode);
      if (!loc || loc.status !== 'resolved') continue;
      const group = grouped.get(msg.locationCode) || [];
      group.push(msg);
      grouped.set(msg.locationCode, group);
    }

    // Helper: walk prev/next chain to collect extent coordinates
    const walkExtent = (startLoc: TmcResolvedLocation, extent: number, direction: boolean): [number, number][] => {
      const coords: [number, number][] = [[startLoc.lat, startLoc.lon]];
      let current = startLoc;
      for (let i = 0; i < extent; i++) {
        const nextCode = direction ? current.nextLocationCode : current.prevLocationCode;
        if (!nextCode) break;
        const nextLoc = resolvedLocations.get(nextCode);
        if (!nextLoc || nextLoc.status !== 'resolved') break;
        coords.push([nextLoc.lat, nextLoc.lon]);
        current = nextLoc;
      }
      return coords;
    };

    // Helper: calculate bearing between two points (degrees)
    const bearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const toRad = (d: number) => d * Math.PI / 180;
      const toDeg = (r: number) => r * 180 / Math.PI;
      const dLon = toRad(lon2 - lon1);
      const y = Math.sin(dLon) * Math.cos(toRad(lat2));
      const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
      return (toDeg(Math.atan2(y, x)) + 360) % 360;
    };

    for (const [lcd, msgs] of grouped) {
      const loc = resolvedLocations.get(lcd)!;
      // Sort: High Priority first, then by nature severity
      const sorted = [...msgs].sort((a, b) => {
        if (a.urgency === 'High Priority' && b.urgency !== 'High Priority') return -1;
        if (b.urgency === 'High Priority' && a.urgency !== 'High Priority') return 1;
        return 0;
      });
      const primary = sorted[0];
      const primaryConfig = NATURE_COLORS[primary.nature] || NATURE_COLORS["Information"];

      // Draw extent polylines for messages with extent > 0
      for (const msg of sorted) {
        if (msg.extent > 0) {
          const extentCoords = walkExtent(loc, msg.extent, msg.direction);
          if (extentCoords.length > 1) {
            const msgConfig = NATURE_COLORS[msg.nature] || NATURE_COLORS["Information"];
            const extentLine = L.polyline(extentCoords, {
              color: msgConfig.color, weight: 6, opacity: 0.4, lineCap: 'round'
            });
            extentLine.addTo(markersLayerRef.current);
            extentCoords.forEach(c => bounds.push(c));
          }
        }
      }

      // Draw traffic flow dashed line
      for (const msg of sorted) {
        if (msg.nature === 'Traffic Flow') {
          const neighborCode = msg.direction ? loc.prevLocationCode : loc.nextLocationCode;
          const neighborLoc = neighborCode ? resolvedLocations.get(neighborCode) : undefined;
          if (neighborLoc && neighborLoc.status === 'resolved') {
            const flowConfig = NATURE_COLORS[msg.nature] || NATURE_COLORS["Information"];
            const polyline = L.polyline(
              [[loc.lat, loc.lon], [neighborLoc.lat, neighborLoc.lon]],
              { color: flowConfig.color, weight: 4, opacity: 0.7, dashArray: '8, 6' }
            );
            polyline.addTo(markersLayerRef.current);
            bounds.push([neighborLoc.lat, neighborLoc.lon]);
          }
          break; // Only one flow line per location
        }
      }

      // Main circle marker (color = primary message)
      const marker = L.circleMarker([loc.lat, loc.lon], {
        radius: primary.urgency === 'High Priority' ? 10 : 7,
        fillColor: primaryConfig.color,
        color: '#1e293b',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85,
      });

      // Tooltip
      const tooltipLines = sorted.slice(0, 3).map(msg => {
        const cfg = NATURE_COLORS[msg.nature] || NATURE_COLORS["Information"];
        return `<b style="color:${cfg.color}">${escapeHtml(msg.label)}</b>`;
      });
      if (sorted.length > 3) tooltipLines.push(`<i>+${sorted.length - 3} more</i>`);
      const tooltipContent = `<div style="font-family:'Inter',sans-serif;font-size:11px;">
        ${tooltipLines.join('<br/>')}
        <div style="color:#64748b;margin-top:2px;">#${lcd}${loc.name ? ` — ${escapeHtml(loc.name)}` : ''}</div>
      </div>`;
      marker.bindTooltip(tooltipContent, { className: 'tmc-popup', direction: 'top', offset: [0, -8] });

      // Popup with all messages at this location
      const popupParts = sorted.map(msg => {
        const cfg = NATURE_COLORS[msg.nature] || NATURE_COLORS["Information"];
        return `<div style="padding:4px 0;">
          <div style="font-weight:bold;font-size:12px;color:${cfg.color};">
            <i class="fa-solid ${cfg.icon}" style="margin-right:4px;"></i>${escapeHtml(msg.label)}
          </div>
          <div style="font-size:11px;color:#94a3b8;line-height:1.5;">
            ${escapeHtml(msg.nature)} · ${escapeHtml(msg.urgency)} · ${escapeHtml(msg.durationLabel)}<br/>
            Direction: ${msg.direction ? 'Negative (−)' : 'Positive (+)'}${msg.extent > 0 ? ` · Extent: ${msg.extent}` : ''}<br/>
            Received: ${escapeHtml(msg.receivedTime)}${msg.diversion ? ' · <span style="color:#f59e0b;">⚠ Diversion</span>' : ''}
          </div>
        </div>`;
      });
      const popupContent = `<div style="font-family:'Inter',sans-serif;min-width:200px;max-height:300px;overflow-y:auto;">
        <div style="font-size:11px;color:#64748b;margin-bottom:4px;">
          <b>#${lcd}</b>${loc.name ? ` — ${escapeHtml(loc.name)}` : ''}${loc.roadRef ? ` (${escapeHtml(loc.roadRef)})` : ''}
        </div>
        ${popupParts.join('<hr style="border-color:#334155;margin:4px 0;"/>')}
      </div>`;
      marker.bindPopup(popupContent, { className: 'tmc-popup', maxWidth: 350 });
      marker.addTo(markersLayerRef.current);
      bounds.push([loc.lat, loc.lon]);

      // Count badge for multiple messages
      if (sorted.length > 1) {
        const badge = L.marker([loc.lat, loc.lon], {
          icon: L.divIcon({
            className: '',
            html: `<div style="background:${primaryConfig.color};color:#fff;font-family:'Inter',sans-serif;font-size:9px;font-weight:bold;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid #1e293b;box-shadow:0 1px 3px rgba(0,0,0,0.4);transform:translate(6px,-6px);">${sorted.length}</div>`,
            iconSize: [16, 16],
            iconAnchor: [0, 16],
          }),
          interactive: false,
        });
        badge.addTo(markersLayerRef.current);
      }

      // Direction arrow
      const dirMsg = sorted[0];
      const neighborCode = dirMsg.direction ? loc.prevLocationCode : loc.nextLocationCode;
      const neighborLoc = neighborCode ? resolvedLocations.get(neighborCode) : undefined;
      if (neighborLoc && neighborLoc.status === 'resolved') {
        const angle = bearing(loc.lat, loc.lon, neighborLoc.lat, neighborLoc.lon);
        const arrow = L.marker([loc.lat, loc.lon], {
          icon: L.divIcon({
            className: '',
            html: `<div style="font-size:10px;color:${primaryConfig.color};opacity:0.8;transform:translate(8px,-14px) rotate(${angle}deg);text-shadow:0 0 2px #000;"><i class="fa-solid fa-location-arrow"></i></div>`,
            iconSize: [12, 12],
            iconAnchor: [0, 12],
          }),
          interactive: false,
        });
        arrow.addTo(markersLayerRef.current);
      }
    }

    if (bounds.length > 0) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }, [resolvedLocations, messages, hiddenNatures]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full h-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex justify-between items-center p-3 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-white text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <i className="fa-solid fa-map-location-dot text-cyan-400"></i>
              TMC Traffic Map
            </h3>
            {loading && (
              <span className="text-[10px] text-cyan-400 font-mono animate-pulse">
                Resolving locations...
              </span>
            )}
            {tmcInfo && (
              <span className="text-[10px] text-slate-500 font-mono">
                {tmcInfo.country}{!autoInfo ? ' (manual)' : ''} (CID:{cid}, TABCD:{tabcd})
              </span>
            )}
            <span className="text-[10px] text-slate-500 font-mono">
              {resolvedCount}/{totalCount} mapped | Cache: {getCacheSize()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {manualCountry && (
              <button
                onClick={() => { setManualCountry(null); clearLocationCache(); setResolvedLocations(new Map()); setResolvedCount(0); }}
                className="px-2 py-1 text-[10px] uppercase font-bold rounded border bg-slate-800 text-yellow-400 border-yellow-500/50 hover:bg-yellow-500/10 transition-colors"
              >
                Change Country
              </button>
            )}
            <button
              onClick={() => { clearLocationCache(); setResolvedLocations(new Map()); setResolvedCount(0); doResolve(); }}
              disabled={loading || !cid}
              className="px-2 py-1 text-[10px] uppercase font-bold rounded border bg-slate-800 text-cyan-400 border-slate-700 hover:bg-slate-700 disabled:opacity-30 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 text-[10px] uppercase font-bold rounded border bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-900/30 border-b border-red-500/30 px-4 py-2 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Country selector when ECC is not available */}
        {needsManualSelect && (
          <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 shrink-0">
            <div className="text-yellow-400 text-xs mb-2">
              Country not detected (no ECC from Group 1A). Please select the country:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COUNTRY_LIST.map(entry => (
                <button
                  key={entry.cid}
                  onClick={() => setManualCountry(entry)}
                  className="px-2.5 py-1 text-[10px] font-bold rounded border bg-slate-800 text-slate-300 border-slate-700 hover:bg-cyan-900/40 hover:text-cyan-300 hover:border-cyan-500/50 transition-colors"
                >
                  {entry.country}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Interactive Legend */}
        <div className="flex flex-wrap items-center gap-1 px-4 py-2 bg-slate-950/50 border-b border-slate-800 text-[10px] shrink-0">
          <button
            onClick={() => setHiddenNatures(new Set())}
            className={`px-1.5 py-0.5 rounded border transition-colors ${hiddenNatures.size === 0 ? 'border-cyan-500/50 text-cyan-400 bg-cyan-900/20' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}
          >All</button>
          <span className="text-slate-700 mx-1">|</span>
          {Object.entries(NATURE_COLORS).map(([nature, config]) => {
            const hidden = hiddenNatures.has(nature);
            return (
              <button
                key={nature}
                onClick={() => setHiddenNatures(prev => {
                  const next = new Set(prev);
                  if (hidden) next.delete(nature); else next.add(nature);
                  return next;
                })}
                className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${hidden ? 'border-slate-800 opacity-30' : 'border-slate-700 hover:border-slate-500'}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: config.color }}
                />
                <span className={`text-slate-400 ${hidden ? 'line-through' : ''}`}>{nature}</span>
              </button>
            );
          })}
        </div>

        {/* Map container */}
        <div ref={mapContainerRef} className="flex-1 min-h-0" />
      </div>
    </div>
  );
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}