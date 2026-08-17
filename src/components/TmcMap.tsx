declare const L: any; // Leaflet loaded via CDN

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { TmcMessage, TmcServiceInfo, TmcResolvedLocation } from '../types';
import { ECC_PI_TO_TMC_CID } from '../constants';
import { resolveLocations, getCacheSize, clearLocationCache, isCountryKnownWithoutCoverage } from '../services/tmcLocationService';

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

// Fallback mapping by PI first character and LTN (Table Code) for supported countries
const PI_LTN_FALLBACK_MAP: Record<string, { cid: number; defaultTabcd: number; country: string }> = {
  "5_1":  { cid: 25,  defaultTabcd: 1,  country: "Italy" },
  "F_49": { cid: 40,  defaultTabcd: 49, country: "Norway" },
  "6_17": { cid: 15,  defaultTabcd: 17, country: "Finland" },
  "E_33": { cid: 50,  defaultTabcd: 33, country: "Sweden" },
  "A_1":  { cid: 4,   defaultTabcd: 1,  country: "Austria" },
  "9_35": { cid: 702, defaultTabcd: 35, country: "Slovenia" },
  "8_1":  { cid: 38,  defaultTabcd: 1,  country: "Netherlands" },
  "D_1":  { cid: 58,  defaultTabcd: 1,  country: "Germany" },
  "1_1":  { cid: 58,  defaultTabcd: 1,  country: "Germany" },
  "4_9":  { cid: 51,  defaultTabcd: 9,  country: "Switzerland" },
};

function deriveCid(ecc: string, pi: string, ltn?: number): { cid: number; defaultTabcd: number; country: string } | null {
  if (!pi || pi.length < 1) return null;
  const piFirst = pi.charAt(0).toUpperCase();
  if (ecc) {
    const key = `${ecc.toUpperCase()}_${piFirst}`;
    if (ECC_PI_TO_TMC_CID[key]) return ECC_PI_TO_TMC_CID[key];
  }

  // Fallback 1: Deduce ECC/CID by PI's first nibble and LTN
  if (ltn !== undefined && ltn > 0) {
    const fallbackKey = `${piFirst}_${ltn}`;
    if (PI_LTN_FALLBACK_MAP[fallbackKey]) {
      return PI_LTN_FALLBACK_MAP[fallbackKey];
    }
    const matchesByPiAndLtn = Object.entries(ECC_PI_TO_TMC_CID).filter(([k, v]) => k.endsWith(`_${piFirst}`) && v.defaultTabcd === ltn);
    if (matchesByPiAndLtn.length === 1) {
      return matchesByPiAndLtn[0][1];
    }
  }

  // If ECC is not yet available, check if piFirst uniquely identifies a country in ECC_PI_TO_TMC_CID
  const matches = Object.entries(ECC_PI_TO_TMC_CID).filter(([k]) => k.endsWith(`_${piFirst}`));
  if (matches.length === 1) {
    return matches[0][1];
  }
  return null;
}

// Supported countries with available location tables
const COUNTRY_LIST: { cid: number; defaultTabcd: number; country: string }[] = [
  { cid: 4,   defaultTabcd: 1,  country: "Austria" },
  { cid: 15,  defaultTabcd: 17, country: "Finland" },
  { cid: 58,  defaultTabcd: 1,  country: "Germany" },
  { cid: 25,  defaultTabcd: 1,  country: "Italy" },
  { cid: 40,  defaultTabcd: 49, country: "Norway" },
  { cid: 702, defaultTabcd: 35, country: "Slovenia" },
  { cid: 50,  defaultTabcd: 33, country: "Sweden" },
  { cid: 51,  defaultTabcd: 9,  country: "Switzerland" },
  { cid: 38,  defaultTabcd: 1,  country: "Netherlands" },
].sort((a, b) => a.country.localeCompare(b.country));

export const TmcMap: React.FC<TmcMapProps> = ({
  messages, serviceInfo, ecc, pi, isOpen, onClose
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const decorationsLayerRef = useRef<any>(null);
  const [resolvedLocations, setResolvedLocations] = useState<Map<number, TmcResolvedLocation>>(new Map());
  const resolvedLocationsRef = useRef<Map<number, TmcResolvedLocation>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [manualCountry, setManualCountry] = useState<{ cid: number; defaultTabcd: number; country: string } | null>(null);
  const [hiddenNatures, setHiddenNatures] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('tmc_map_hidden_natures');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return new Set(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load hidden natures from localStorage', e);
    }
    return new Set();
  });
  const [showManualPrompt, setShowManualPrompt] = useState(false);

  // Persist category filter choices for future sessions
  useEffect(() => {
    try {
      localStorage.setItem('tmc_map_hidden_natures', JSON.stringify(Array.from(hiddenNatures)));
    } catch (e) {
      console.warn('Failed to save hidden natures to localStorage', e);
    }
  }, [hiddenNatures]);

  // Side panel open/close state with persistence
  const [showSidePanel, setShowSidePanel] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tmc_map_show_side_panel');
      if (saved !== null) {
        return saved === 'true';
      }
    } catch (e) {
      console.warn('Failed to load showSidePanel from localStorage', e);
    }
    return true; // default to open
  });

  // Persist showSidePanel choice for future sessions
  useEffect(() => {
    try {
      localStorage.setItem('tmc_map_show_side_panel', String(showSidePanel));
    } catch (e) {
      console.warn('Failed to save showSidePanel to localStorage', e);
    }
  }, [showSidePanel]);

  // When side panel toggles, trigger Leaflet size invalidation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [showSidePanel]);

  // Pause / Resume state
  const [isPaused, setIsPaused] = useState(false);
  const [frozenMessages, setFrozenMessages] = useState<TmcMessage[] | null>(null);

  // Auto-fit mode tracking: enabled by default, disabled only when user manually pans or zooms
  const [isAutoMode, setIsAutoMode] = useState(true);
  const isAutoModeRef = useRef(true);
  isAutoModeRef.current = isAutoMode;

  const isProgrammaticMoveRef = useRef(false);
  const [outsideViewCount, setOutsideViewCount] = useState(0);

  // Bidirectional hover highlight state and references
  const [hoveredLocationCode, setHoveredLocationCode] = useState<number | null>(null);
  const hoveredLocationCodeRef = useRef<number | null>(null);
  hoveredLocationCodeRef.current = hoveredLocationCode;
  const markersByLcdRef = useRef<Map<number, {
    marker: any;
    badge?: any;
    arrow?: any;
    extentLines?: any[];
    flowLine?: any;
    defaultRadius: number;
    defaultColor: string;
  }>>(new Map());
  const sidePanelScrollRef = useRef<HTMLDivElement>(null);

  const displayedMessages = (isPaused && frozenMessages) ? frozenMessages : messages;
  const pendingNewCount = (isPaused && frozenMessages) ? Math.max(0, messages.length - frozenMessages.length) : 0;

  const numericServiceCid = serviceInfo.cid ? parseInt(serviceInfo.cid, 10) : 0;

  const autoInfo = useMemo(() => {
    const fromEccPi = deriveCid(ecc, pi, serviceInfo?.ltn);
    if (fromEccPi) return fromEccPi;
    if (numericServiceCid > 0) {
      const fromList = COUNTRY_LIST.find(e => e.cid === numericServiceCid);
      if (fromList) return fromList;
      return { cid: numericServiceCid, defaultTabcd: serviceInfo.ltn || 1, country: `CID ${numericServiceCid}` };
    }
    return null;
  }, [ecc, pi, numericServiceCid, serviceInfo.ltn]);

  const tmcInfo = autoInfo || manualCountry;
  const cid = tmcInfo?.cid || (numericServiceCid > 0 ? numericServiceCid : undefined);
  const tabcd = serviceInfo.ltn > 0 ? serviceInfo.ltn : (tmcInfo?.defaultTabcd || 1);
  const needsManualSelect = !autoInfo && !manualCountry && numericServiceCid === 0;

  // Reset manual country selection and resolved locations when the station changes.
  // We consider it a station change if the PI changes, or if the ECC changes between two non-empty values.
  // We intentionally ignore transitions from empty ECC to a discovered ECC to prevent UI flashing.
  const prevPiRef = useRef<string>('');
  const prevEccRef = useRef<string>('');
  useEffect(() => {
    const isNewStation = 
      (prevPiRef.current && prevPiRef.current !== pi) || 
      (prevEccRef.current && ecc && prevEccRef.current !== ecc);

    if (isNewStation) {
      setManualCountry(null);
      clearLocationCache();
      resolvedLocationsRef.current = new Map();
      setResolvedLocations(new Map());
      setResolvedCount(0);
      setIsAutoMode(true);
      setIsPaused(false);
      setFrozenMessages(null);
    }
    
    if (pi) prevPiRef.current = pi;
    if (ecc) prevEccRef.current = ecc;
  }, [ecc, pi]);

  // Also reset manual country selection if RDS/TMC is reset (all messages cleared)
  useEffect(() => {
    if (messages.length === 0) {
      setManualCountry(null);
      clearLocationCache();
      resolvedLocationsRef.current = new Map();
      setResolvedLocations(new Map());
      setResolvedCount(0);
      setIsAutoMode(true);
      setIsPaused(false);
      setFrozenMessages(null);
    }
  }, [messages.length]);

  // Function to re-calculate count of events outside current map view (only if user has taken manual control)
  const checkOutsideEvents = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (isAutoModeRef.current) {
      setOutsideViewCount(0);
      return;
    }
    try {
      const mapBounds = map.getBounds();
      let outside = 0;
      const userMsgs = displayedMessages.filter(m => !m.isSystem && !hiddenNatures.has(m.nature));
      const activeCodes = new Set(userMsgs.map(m => m.locationCode));

      activeCodes.forEach(lcd => {
        const loc = resolvedLocationsRef.current.get(lcd);
        if (loc && loc.status === 'resolved') {
          if (!mapBounds.contains([loc.lat, loc.lon])) {
            outside++;
          }
        }
      });
      setOutsideViewCount(outside);
    } catch {
      // Map not initialized yet
    }
  }, [displayedMessages, hiddenNatures]);

  const checkOutsideEventsRef = useRef<() => void>(() => {});
  checkOutsideEventsRef.current = checkOutsideEvents;

  // Fit all visible events in map view and re-enable automatic tracking mode
  const handleFitAll = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const bounds: [number, number][] = [];
    const userMsgs = displayedMessages.filter(m => !m.isSystem && !hiddenNatures.has(m.nature));
    const activeCodes = new Set(userMsgs.map(m => m.locationCode));

    activeCodes.forEach(lcd => {
      const loc = resolvedLocationsRef.current.get(lcd);
      if (loc && loc.status === 'resolved') {
        bounds.push([loc.lat, loc.lon]);
      }
    });

    isAutoModeRef.current = true;
    setIsAutoMode(true);
    setOutsideViewCount(0);

    if (bounds.length > 0) {
      try {
        isProgrammaticMoveRef.current = true;
        if (typeof map.flyToBounds === 'function') {
          map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 13, duration: 0.8 });
        } else {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
        }
      } catch (e) {
        console.warn('Could not fit bounds:', e);
      }
    }
  }, [displayedMessages, hiddenNatures]);

  // Track the location code of the currently open popup to preserve across layer re-renders
  const openPopupLcdRef = useRef<number | null>(null);

  // Focus and zoom smoothly on a specific location (used by both list items and map markers)
  const focusLocation = useCallback((loc: TmcResolvedLocation, locationCode: number) => {
    isAutoModeRef.current = false;
    setIsAutoMode(false);
    openPopupLcdRef.current = locationCode;

    const map = mapInstanceRef.current;
    if (!map) return;

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const targetZoom = Math.max(currentZoom, 14);

    const isAlreadyAtLocation =
      Math.abs(currentCenter.lat - loc.lat) < 0.0002 &&
      Math.abs(currentCenter.lng - loc.lon) < 0.0002;

    const markerEntry = markersByLcdRef.current.get(locationCode);

    if (isAlreadyAtLocation && currentZoom >= 14) {
      // Already centered and zoomed in at target: ensure popup is open and avoid any progressive zooming
      if (markerEntry?.marker && typeof markerEntry.marker.openPopup === 'function') {
        if (!markerEntry.marker.isPopupOpen()) {
          markerEntry.marker.openPopup();
        }
      }
      return;
    }

    isProgrammaticMoveRef.current = true;
    if (typeof map.flyTo === 'function') {
      map.flyTo([loc.lat, loc.lon], targetZoom, { duration: 0.35 });
    } else {
      map.setView([loc.lat, loc.lon], targetZoom);
    }

    if (markerEntry?.marker && typeof markerEntry.marker.openPopup === 'function') {
      setTimeout(() => {
        if (markerEntry.marker && typeof markerEntry.marker.openPopup === 'function') {
          markerEntry.marker.openPopup();
        }
      }, 80);
    }
  }, []);

  const focusLocationRef = useRef(focusLocation);
  focusLocationRef.current = focusLocation;

  // Current active country/table key tracking to avoid unnecessary state clears
  const currentCoverageKeyRef = useRef<string>('');

  // Grace period before displaying the "Country not detected" prompt
  // Prevents false-positive flickering before Group 1A (ECC) is received.
  useEffect(() => {
    if (!isOpen || !needsManualSelect) {
      setShowManualPrompt(false);
      return;
    }
    const timer = setTimeout(() => {
      setShowManualPrompt(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [isOpen, needsManualSelect]);

  // Initialize map ONLY once when modal opens
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current).setView([50.0, 10.0], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    mapInstanceRef.current = map;
    decorationsLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    // Detect user manual interactions (drag, zoom) to switch from Auto mode to Manual mode
    const handleUserInteractionStart = () => {
      if (!isProgrammaticMoveRef.current) {
        isAutoModeRef.current = false;
        setIsAutoMode(false);
      }
    };

    map.on('dragstart', handleUserInteractionStart);
    map.on('zoomstart', handleUserInteractionStart);

    // Global fallback map click handler: detects clicks directly on or near markers for 100% immediate responsiveness
    map.on('click', (e: any) => {
      if (!e || !e.latlng) return;
      const clickPt = map.latLngToContainerPoint(e.latlng);
      let closestLcd: number | null = null;
      let closestDist = 28; // 28px hit radius around any marker
      let closestLoc: TmcResolvedLocation | null = null;

      for (const [lcd] of markersByLcdRef.current.entries()) {
        const loc = resolvedLocationsRef.current.get(lcd);
        if (loc && loc.status === 'resolved') {
          const pt = map.latLngToContainerPoint([loc.lat, loc.lon]);
          const dist = Math.hypot(pt.x - clickPt.x, pt.y - clickPt.y);
          if (dist < closestDist) {
            closestDist = dist;
            closestLcd = lcd;
            closestLoc = loc;
          }
        }
      }

      if (closestLcd !== null && closestLoc) {
        focusLocationRef.current(closestLoc, closestLcd);
      }
    });

    // Track movement/zoom completion
    map.on('moveend zoomend', () => {
      isProgrammaticMoveRef.current = false;
      checkOutsideEventsRef.current?.();
    });

    // Fix grey tiles when map is rendered inside a modal
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 300);

    // Keep map size in sync with container (fixes gray bar after zoom/resize)
    const container = mapContainerRef.current;
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      try {
        map.remove();
      } catch (e) {
        console.warn('Error removing map instance:', e);
      }
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      decorationsLayerRef.current = null;
      markersByLcdRef.current.clear();
      setIsAutoMode(true);
    };
  }, [isOpen]);

  // Close modal on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Stable key of unique location codes in displayed messages to avoid reruns on pure text/timer ticks
  const locationCodesKey = useMemo(() => {
    const userMessages = displayedMessages.filter(m => !m.isSystem);
    return [...new Set(userMessages.map(m => m.locationCode))].sort((a, b) => a - b).join(',');
  }, [displayedMessages]);

  const isResolvingRef = useRef(false);

  // Resolve locations when modal is open
  const doResolve = useCallback(async () => {
    if (!isOpen) return;

    const userMessages = displayedMessages.filter(m => !m.isSystem);
    const uniqueCodes = [...new Set(userMessages.map(m => m.locationCode))];
    setTotalCount(uniqueCodes.length);

    if (uniqueCodes.length === 0) {
      setError(null);
      setLoading(false);
      return;
    }

    // If country is not detected and manual country is not selected yet, prompt user without premature error
    if (needsManualSelect || !cid) {
      setError(null);
      setLoading(false);
      return;
    }

    const effectiveCid = cid;
    const effectiveTabcd = serviceInfo.ltn > 0 ? serviceInfo.ltn : (tabcd || 1);

    // If country (CID) changes, cleanly initialize cache for the new country without causing state flicker on minor LTN adjustments
    const currentCidKey = String(effectiveCid);
    if (currentCoverageKeyRef.current !== currentCidKey) {
      currentCoverageKeyRef.current = currentCidKey;
      resolvedLocationsRef.current = new Map();
      setResolvedLocations(new Map());
      setResolvedCount(0);
    }

    // If this country/network is already known to have no table, resolve instantly in memory without triggering loading state
    if (isCountryKnownWithoutCoverage(effectiveCid, effectiveTabcd)) {
      let newlyAdded = false;
      uniqueCodes.forEach(lcd => {
        if (!resolvedLocationsRef.current.has(lcd)) {
          resolvedLocationsRef.current.set(lcd, { locationCode: lcd, lat: 0, lon: 0, status: 'not_found' });
          newlyAdded = true;
        }
      });
      if (newlyAdded) {
        setResolvedLocations(new Map(resolvedLocationsRef.current));
      }
      setResolvedCount(0);
      setError(`No geolocation table is available for this country/network (CID: ${effectiveCid}, TABCD: ${effectiveTabcd}). Consequently, events cannot be displayed on the map.`);
      setLoading(false);
      return;
    }

    // If all location codes have already been processed in the current session, update status without re-triggering loading
    const unhandledCodes = uniqueCodes.filter(lcd => !resolvedLocationsRef.current.has(lcd));
    if (unhandledCodes.length === 0) {
      const totalMapped = uniqueCodes.filter(lcd => resolvedLocationsRef.current.get(lcd)?.status === 'resolved').length;
      setResolvedCount(totalMapped);
      if (totalMapped === 0 && uniqueCodes.length > 0) {
        setError(`No geolocation table is available for this country/network (CID: ${effectiveCid}, TABCD: ${effectiveTabcd}). Consequently, events cannot be displayed on the map.`);
      } else {
        setError(null);
      }
      setLoading(false);
      return;
    }

    if (isResolvingRef.current) return;
    isResolvingRef.current = true;
    setLoading(true);

    try {
      const resolved = await resolveLocations(uniqueCodes, effectiveCid, effectiveTabcd);

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
        const neighbors = await resolveLocations([...neighborCodes], effectiveCid, effectiveTabcd);
        neighbors.forEach((v, k) => resolved.set(k, v));
      }

      const mergedMap = new Map(resolvedLocationsRef.current);
      resolved.forEach((v, k) => mergedMap.set(k, v));
      resolvedLocationsRef.current = mergedMap;

      const totalMapped = uniqueCodes.filter(lcd => mergedMap.get(lcd)?.status === 'resolved').length;

      setResolvedLocations(mergedMap);
      setResolvedCount(totalMapped);

      if (totalMapped === 0 && uniqueCodes.length > 0) {
        setError(`No geolocation table is available for this country/network (CID: ${effectiveCid}, TABCD: ${effectiveTabcd}). Consequently, events cannot be displayed on the map.`);
      } else {
        setError(null);
      }
    } catch {
      setError(`No geolocation table is available for this country/network (CID: ${effectiveCid}, TABCD: ${effectiveTabcd}). Consequently, events cannot be displayed on the map.`);
    } finally {
      isResolvingRef.current = false;
      setLoading(false);
    }
  }, [isOpen, locationCodesKey, cid, tabcd, needsManualSelect, serviceInfo.ltn]);

  useEffect(() => {
    doResolve();
  }, [doResolve]);

  // Update markers when resolved locations, displayed messages or filters change
  useEffect(() => {
    if (!markersLayerRef.current || !decorationsLayerRef.current || !mapInstanceRef.current) return;

    // Clear and redraw purely decorative overlay elements (lines, arrows, badges)
    decorationsLayerRef.current.clearLayers();
    const bounds: [number, number][] = [];

    const userMessages = displayedMessages.filter(m => !m.isSystem);

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

    const currentActiveLcds = new Set(grouped.keys());

    // 1. Remove markers for locations no longer present in filtered messages
    for (const [lcd, item] of markersByLcdRef.current.entries()) {
      if (!currentActiveLcds.has(lcd)) {
        if (markersLayerRef.current && item.marker) {
          markersLayerRef.current.removeLayer(item.marker);
        }
        markersByLcdRef.current.delete(lcd);
      }
    }

    // 2. Add or update circle markers persistently (reusing DOM elements so clicks are never lost)
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

      // Draw extent polylines for messages with extent > 0 on decorationsLayer
      for (const msg of sorted) {
        if (msg.extent > 0) {
          const extentCoords = walkExtent(loc, msg.extent, msg.direction);
          if (extentCoords.length > 1) {
            const msgConfig = NATURE_COLORS[msg.nature] || NATURE_COLORS["Information"];
            const extentLine = L.polyline(extentCoords, {
              color: msgConfig.color, weight: 6, opacity: 0.4, lineCap: 'round', interactive: false
            });
            extentLine.addTo(decorationsLayerRef.current);
            extentCoords.forEach(c => bounds.push(c));
          }
        }
      }

      // Draw traffic flow dashed line on decorationsLayer
      for (const msg of sorted) {
        if (msg.nature === 'Traffic Flow') {
          const neighborCode = msg.direction ? loc.prevLocationCode : loc.nextLocationCode;
          const neighborLoc = neighborCode ? resolvedLocations.get(neighborCode) : undefined;
          if (neighborLoc && neighborLoc.status === 'resolved') {
            const flowConfig = NATURE_COLORS[msg.nature] || NATURE_COLORS["Information"];
            const polyline = L.polyline(
              [[loc.lat, loc.lon], [neighborLoc.lat, neighborLoc.lon]],
              { color: flowConfig.color, weight: 4, opacity: 0.7, dashArray: '8, 6', interactive: false }
            );
            polyline.addTo(decorationsLayerRef.current);
            bounds.push([neighborLoc.lat, neighborLoc.lon]);
          }
          break; // Only one flow line per location
        }
      }

      const defaultRadius = primary.urgency === 'High Priority' ? 10 : 7;
      const isCurrentlyHovered = (hoveredLocationCodeRef.current === lcd);

      // Tooltip HTML
      const locText = `#${lcd}${loc.name ? ` — ${escapeHtml(loc.name)}` : ''}`;
      const tooltipLines = sorted.slice(0, 3).map(msg => {
        const cfg = NATURE_COLORS[msg.nature] || NATURE_COLORS["Information"];
        const dirText = msg.direction ? 'Positive (+)' : 'Negative (−)';
        const expireStr = msg.expiresTime ? `<br/>Detected: ${escapeHtml(msg.receivedTime)}<br/>Expires: ${escapeHtml(msg.expiresTime)}` : `<br/>Detected: ${escapeHtml(msg.receivedTime)}`;
        return `<div style="margin-bottom:8px;">
          <div style="color:${cfg.color};font-weight:bold;font-size:12px;">${escapeHtml(msg.label)}</div>
          <div style="color:#cbd5e1;font-size:11px;margin-bottom:4px;">${locText}</div>
          <div style="border-top:1px solid #334155;padding-top:4px;color:#94a3b8;font-size:10px;line-height:1.4;">
            Direction: ${dirText}<br/>
            Duration Type: ${escapeHtml(msg.durationType)}
            ${expireStr}
          </div>
        </div>`;
      });
      if (sorted.length > 3) tooltipLines.push(`<div style="color:#64748b;font-style:italic;margin-top:-4px;">+${sorted.length - 3} more</div>`);
      const tooltipContent = `<div style="font-family:'Inter',sans-serif;font-size:11px;">
        ${tooltipLines.join('')}
      </div>`;

      // Popup with all messages at this location
      const popupParts = sorted.map(msg => {
        const cfg = NATURE_COLORS[msg.nature] || NATURE_COLORS["Information"];
        return `<div style="padding:4px 0;">
          <div style="font-weight:bold;font-size:12px;color:${cfg.color};">
            <i class="fa-solid ${cfg.icon}" style="margin-right:4px;"></i>${escapeHtml(msg.label)}
          </div>
          <div style="font-size:11px;color:#94a3b8;line-height:1.5;">
            ${escapeHtml(msg.nature)} · ${escapeHtml(msg.urgency)} · ${escapeHtml(msg.durationLabel)}<br/>
            Direction: ${msg.direction ? 'Positive (+)' : 'Negative (−)'}${msg.extent > 0 ? ` · Extent: ${msg.extent}` : ''}<br/>
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

      const existingEntry = markersByLcdRef.current.get(lcd);

      if (existingEntry) {
        // Reuse persistent marker in DOM: update style, coordinates, tooltip and popup seamlessly
        existingEntry.marker.setLatLng([loc.lat, loc.lon]);
        existingEntry.marker.setStyle({
          radius: isCurrentlyHovered ? defaultRadius + 4 : defaultRadius,
          fillColor: primaryConfig.color,
          color: isCurrentlyHovered ? '#38bdf8' : '#1e293b',
          weight: isCurrentlyHovered ? 3.5 : 2,
          opacity: 1,
          fillOpacity: isCurrentlyHovered ? 1 : 0.85,
        });
        existingEntry.defaultRadius = defaultRadius;
        existingEntry.defaultColor = primaryConfig.color;
        existingEntry.marker.setTooltipContent(tooltipContent);
        existingEntry.marker.setPopupContent(popupContent);
        // We do NOT call bringToFront() here as moving SVG elements in the DOM 
        // during a hover state causes Chrome to lose track of the mouseout event,
        // leading to stuck tooltips. The radius/weight increase is sufficient.
      } else {
        // Create new circle marker with high hit-accuracy and listeners attached
        const marker = L.circleMarker([loc.lat, loc.lon], {
          radius: isCurrentlyHovered ? defaultRadius + 4 : defaultRadius,
          fillColor: primaryConfig.color,
          color: isCurrentlyHovered ? '#38bdf8' : '#1e293b',
          weight: isCurrentlyHovered ? 3.5 : 2,
          opacity: 1,
          fillOpacity: isCurrentlyHovered ? 1 : 0.85,
          bubblingMouseEvents: false,
        });

        // Hover listeners on marker for map -> side panel sync
        marker.on('mouseover', () => {
          setHoveredLocationCode(lcd);
        });
        marker.on('mouseout', () => {
          setHoveredLocationCode(prev => (prev === lcd ? null : prev));
        });

        // Click & mousedown listeners on marker to zoom in automatically and open popup reliably
        const handleMarkerClick = (e: any) => {
          if (e && e.originalEvent) {
            e.originalEvent.stopPropagation();
          }
          focusLocationRef.current(loc, lcd);
        };

        marker.on('click', handleMarkerClick);
        marker.on('mousedown', (e: any) => {
          if (e && e.originalEvent) {
            e.originalEvent.stopPropagation();
          }
        });

        marker.on('popupopen', () => {
          openPopupLcdRef.current = lcd;
        });

        marker.on('popupclose', () => {
          if (openPopupLcdRef.current === lcd) {
            openPopupLcdRef.current = null;
          }
        });

        marker.bindTooltip(tooltipContent, { className: 'tmc-popup custom-dark-tooltip', direction: 'top', offset: [0, -8] });
        marker.bindPopup(popupContent, { className: 'tmc-popup', maxWidth: 350, autoPan: false });
        marker.addTo(markersLayerRef.current);

        markersByLcdRef.current.set(lcd, {
          marker,
          defaultRadius,
          defaultColor: primaryConfig.color,
        });
      }

      // Preserve active open popup across live data updates
      if (openPopupLcdRef.current === lcd) {
        const entry = markersByLcdRef.current.get(lcd);
        if (entry?.marker && !entry.marker.isPopupOpen()) {
          setTimeout(() => {
            if (entry.marker && typeof entry.marker.openPopup === 'function' && !entry.marker.isPopupOpen()) {
              entry.marker.openPopup();
            }
          }, 50);
        }
      }

      bounds.push([loc.lat, loc.lon]);

      // Count badge for multiple messages on decorationsLayer
      if (sorted.length > 1) {
        const badge = L.marker([loc.lat, loc.lon], {
          icon: L.divIcon({
            className: 'pointer-events-none',
            html: `<div style="background:${primaryConfig.color};color:#fff;font-family:'Inter',sans-serif;font-size:9px;font-weight:bold;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid #1e293b;box-shadow:0 1px 3px rgba(0,0,0,0.4);transform:translate(6px,-6px);pointer-events:none;">${sorted.length}</div>`,
            iconSize: [16, 16],
            iconAnchor: [0, 16],
          }),
          interactive: false,
        });
        badge.addTo(decorationsLayerRef.current);
      }
    }

    // Auto-fit mode: automatically keep all visible events framed in view until user manually interacts
    if (bounds.length > 0) {
      if (isAutoModeRef.current) {
        try {
          isProgrammaticMoveRef.current = true;
          mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
        } catch (e) {
          console.warn('Could not fit bounds in auto mode:', e);
        }
      }
    }

    // Check if any events are outside the current viewport (when in manual mode)
    checkOutsideEventsRef.current?.();
  }, [resolvedLocations, displayedMessages, hiddenNatures]);

  // Synchronize hover state between map markers and side panel list
  useEffect(() => {
    for (const [lcd, item] of markersByLcdRef.current.entries()) {
      if (lcd === hoveredLocationCode) {
        item.marker.setStyle({
          radius: item.defaultRadius + 4,
          weight: 3.5,
          color: '#38bdf8', // Cyan highlight border
          fillOpacity: 1,
        });
        // item.marker.bringToFront(); // Removed to prevent Chrome mouseout bug
      } else {
        item.marker.setStyle({
          radius: item.defaultRadius,
          weight: 2,
          color: '#1e293b',
          fillOpacity: 0.85,
        });
      }
    }
  }, [hoveredLocationCode]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full h-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex justify-between items-center p-3 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="text-white text-sm font-bold uppercase tracking-wider flex items-center gap-2 whitespace-nowrap shrink-0">
              <i className="fa-solid fa-map-location-dot text-cyan-400"></i>
              TMC Map
            </h3>
            {loading && !error && (
              <span className="text-[10px] text-cyan-400 font-mono animate-pulse whitespace-nowrap shrink-0">
                Resolving locations...
              </span>
            )}
            {tmcInfo && (
              <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap truncate">
                {tmcInfo.country}{!autoInfo ? ' (Manually selected)' : ''} (CID:{cid}, TABCD:{tabcd})
              </span>
            )}
            <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap shrink-0">
              {resolvedCount}/{totalCount} mapped | Cache: {getCacheSize()}
            </span>
            {isPaused && (
              <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full flex items-center gap-1 animate-pulse whitespace-nowrap shrink-0">
                <i className="fa-solid fa-pause text-[8px]"></i>
                Paused {pendingNewCount > 0 ? `(+${pendingNewCount} queued)` : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Pause / Resume Button */}
            <button
              onClick={() => {
                if (!isPaused) {
                  setIsPaused(true);
                  setFrozenMessages([...messages]);
                } else {
                  setIsPaused(false);
                  setFrozenMessages(null);
                }
              }}
              className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded border transition-colors flex items-center gap-1.5 ${
                isPaused
                  ? 'bg-amber-500 text-slate-950 border-amber-400 hover:bg-amber-400 shadow-md shadow-amber-500/20 font-extrabold'
                  : 'bg-slate-800 text-amber-400 border-amber-500/40 hover:bg-amber-500/10'
              }`}
              title={isPaused ? "Resume live TMC updates and show pending events" : "Pause live map updates"}
            >
              <i className={`fa-solid ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
              <span>{isPaused ? `Resume${pendingNewCount > 0 ? ` (+${pendingNewCount})` : ''}` : 'Pause'}</span>
            </button>

            {/* Side Panel Toggle Button */}
            <button
              onClick={() => setShowSidePanel(prev => !prev)}
              className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded border transition-colors flex items-center gap-1.5 ${
                showSidePanel
                  ? 'bg-slate-800 text-cyan-300 border-cyan-500/50 hover:bg-slate-750 shadow-sm'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-700'
              }`}
              title={showSidePanel ? "Click to hide the active events panel" : "Click to show the active events panel"}
            >
              <i className={`fa-solid ${showSidePanel ? 'fa-table-columns' : 'fa-table-columns'}`}></i>
              <span>{showSidePanel ? 'Hide Panel' : 'Show Panel'}</span>
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

        {/* Country selector when ECC is not available and grace period elapsed */}
        {needsManualSelect && showManualPrompt && (
          <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 shrink-0">
            <div className="text-yellow-400 text-xs mb-2">
              Country not detected (no ECC on Group 1A). Please select a supported country (with available location table):
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COUNTRY_LIST.map(entry => (
                <button
                  key={entry.cid}
                  onClick={() => {
                    setManualCountry(entry);
                    clearLocationCache();
                    resolvedLocationsRef.current = new Map();
                    setResolvedLocations(new Map());
                    setResolvedCount(0);
                    setError(null);
                  }}
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
            title={hiddenNatures.size > 0 ? "Click to enable all categories" : undefined}
            className={`px-1.5 py-0.5 rounded border transition-colors ${hiddenNatures.size === 0 ? 'border-cyan-500/50 text-cyan-400 bg-cyan-900/20' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}
          >All Categories</button>
          <span className="text-slate-700 mx-1">|</span>
          {Object.entries(NATURE_COLORS).map(([nature, config]) => {
            const hidden = hiddenNatures.has(nature);
            return (
              <button
                key={nature}
                title={hidden ? "Click to include this category" : "Click to exclude this category"}
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

        {/* Main Content Area with Right Panel */}
        <div className="relative flex-1 min-h-0 flex flex-row">
          {/* Map container with floating notification badge */}
          <div className="relative flex-1 min-h-0">
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* Floating Pill: Notifications for events outside the current viewport (Manual mode) */}
            {outsideViewCount > 0 && (
              <div className="absolute top-3 inset-x-0 flex justify-center z-[1000] pointer-events-none">
                <button
                  onClick={handleFitAll}
                  className="pointer-events-auto bg-slate-900/95 hover:bg-slate-850 text-slate-100 border border-cyan-400/80 shadow-2xl px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2.5 antialiased transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  title="Click to frame all events and re-enable auto-fit"
                >
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
                  </span>
                  <span className="text-slate-100 font-medium">
                    <strong className="text-cyan-300 font-bold">{outsideViewCount}</strong> {outsideViewCount > 1 ? 'events' : 'event'} outside current view
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded-full border border-cyan-500/60 flex items-center gap-1">
                    <i className="fa-solid fa-arrows-to-eye text-[9px]"></i>
                    Fit View
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Right Side Panel: Active Events */}
          {showSidePanel && (
            <div className="w-[320px] bg-slate-900 border-l border-slate-700 flex flex-col shrink-0 z-[1000]">
              <div className="bg-slate-950 border-b border-slate-800 px-3 py-2 text-xs font-bold text-slate-300 uppercase tracking-wider shrink-0 flex justify-between items-center">
                <span>Active Events</span>
                <span className="bg-slate-800 text-cyan-400 px-1.5 py-0.5 rounded text-[10px] font-mono">
                  {displayedMessages.filter(m => !m.isSystem && !hiddenNatures.has(m.nature) && resolvedLocations.get(m.locationCode)?.status === 'resolved').length}
                </span>
              </div>
              <div ref={sidePanelScrollRef} className="flex-1 overflow-y-auto p-2 space-y-2">
                {(() => {
                  const activeMsgs = displayedMessages
                    .filter(m => !m.isSystem && !hiddenNatures.has(m.nature) && resolvedLocations.get(m.locationCode)?.status === 'resolved')
                    .sort((a, b) => (b.lastUpdatedTimestamp || 0) - (a.lastUpdatedTimestamp || 0));

                  if (activeMsgs.length === 0) {
                    return <div className="text-slate-500 text-xs italic text-center py-4">No active events mapped</div>;
                  }

                  return activeMsgs.map(msg => {
                    const loc = resolvedLocations.get(msg.locationCode);
                    const cfg = NATURE_COLORS[msg.nature] || NATURE_COLORS["Information"];
                    const isHovered = hoveredLocationCode === msg.locationCode;
                    return (
                      <div
                        key={msg.id}
                        data-lcd={msg.locationCode}
                        onMouseEnter={() => setHoveredLocationCode(msg.locationCode)}
                        onMouseLeave={() => setHoveredLocationCode(prev => (prev === msg.locationCode ? null : prev))}
                        className={`border rounded p-2 text-xs transition-all cursor-pointer flex flex-col ${
                          isHovered
                            ? 'bg-slate-850 border-cyan-400 ring-1 ring-cyan-400/60 shadow-lg shadow-cyan-500/10 scale-[1.01]'
                            : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                        }`}
                        onClick={() => {
                          if (loc) {
                            focusLocation(loc, msg.locationCode);
                          }
                        }}
                      >
                        <div style={{ color: cfg.color }} className="font-bold mb-1 flex gap-1.5 items-center">
                          <i className={`fa-solid ${cfg.icon}`}></i>
                          {msg.label}
                        </div>
                        <div className="text-slate-400 mb-1.5 leading-relaxed break-words" title={loc?.name || ''}>
                          <span className="text-slate-500">#{msg.locationCode}</span> {loc?.name ? `— ${loc.name}` : ''} {loc?.roadRef ? `(${loc.roadRef})` : ''}
                        </div>
                        <div className="text-slate-500 text-[10px] space-y-0.5 mt-auto">
                          <div className="flex justify-between">
                            <span><span className="font-medium text-slate-400">Direction:</span> {msg.direction ? 'Positive (+)' : 'Negative (−)'}</span>
                            <span><span className="font-medium text-slate-400">Duration Type:</span> {msg.durationType}</span>
                          </div>
                          {msg.extent > 0 && (
                            <div className="flex justify-start">
                              <span><span className="font-medium text-slate-400">Extent:</span> {msg.extent}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span><span className="font-medium text-slate-400">Detected:</span> {msg.receivedTime}</span>
                            {msg.expiresTime && <span><span className="font-medium text-slate-400">Expires:</span> {msg.expiresTime}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .custom-dark-tooltip.leaflet-tooltip {
          background-color: #0f172a !important; /* Tailwind slate-900 */
          border: 1px solid #334155 !important; /* Tailwind slate-700 */
          color: #f8fafc !important; /* Tailwind slate-50 */
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.5) !important;
          padding: 8px 10px !important;
        }
        .custom-dark-tooltip.leaflet-tooltip::before {
          border-top-color: #0f172a !important;
        }
      `}</style>
    </div>,
    document.body
  );
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}