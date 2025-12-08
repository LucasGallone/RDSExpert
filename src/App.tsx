
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { RdsData, ConnectionStatus, PTY_RDS, PTY_RBDS, RtPlusTag, EonNetwork, RawGroup, TmcMessage, TmcServiceInfo, PsHistoryItem, RtHistoryItem, LogEntry } from './types';
import { INITIAL_RDS_DATA, ODA_MAP } from './constants';
import { LcdDisplay } from './components/LcdDisplay';
import { InfoGrid } from './components/InfoGrid';
import { GroupAnalyzer } from './components/GroupAnalyzer';
import { TmcViewer } from './components/TmcViewer';
import { HistoryControls } from './components/HistoryControls';

interface AfBEntry {
  expected: number;
  afs: Set<string>;
  matchCount: number;
  pairCount: number;
}

interface DecoderState {
  psBuffer: string[];
  psMask: boolean[];
  lpsBuffer: string[];
  ptynBuffer: string[];
  rtBuffer0: string[];
  rtBuffer1: string[];
  
  // RT Verification Masks (to ensure full decoding)
  rtMask0: boolean[]; // Array of 64 booleans
  rtMask1: boolean[]; // Array of 64 booleans
  
  // RT Stability
  rtCandidateString: string;
  rtStableSince: number;

  afSet: string[];
  afListHead: string | null;
  lastGroup0A3: number | null;
  afBMap: Map<string, AfBEntry>;
  currentMethodBGroup: string | null; 
  afType: 'A' | 'B' | 'Unknown';
  currentPi: string;
  piCandidate: string;
  piCounter: number;
  ecc: string;
  lic: string;
  pin: string;
  localTime: string;
  utcTime: string;
  pty: number;
  tp: boolean;
  ta: boolean;
  ms: boolean;
  diStereo: boolean;
  diArtificialHead: boolean;
  diCompressed: boolean;
  diDynamicPty: boolean;
  abFlag: boolean;
  rtPlusTags: Map<number, RtPlusTag & { timestamp: number }>; 
  rtPlusItemRunning: boolean;
  rtPlusItemToggle: boolean;
  hasOda: boolean;
  odaApp: { name: string; aid: string; group: string } | undefined;
  odaList: { name: string; aid: string; group: string }[];
  hasRtPlus: boolean;
  hasEon: boolean;
  hasTmc: boolean;
  rtPlusOdaGroup: number | null;
  eonMap: Map<string, EonNetwork>; 
  tmcServiceInfo: TmcServiceInfo;
  tmcBuffer: TmcMessage[]; 
  
  // Analyzer State
  groupCounts: Record<string, number>;
  groupTotal: number;
  groupSequence: string[];
  
  graceCounter: number;
  isDirty: boolean;
  
  // Raw Buffer for Hex Viewer
  rawGroupBuffer: RawGroup[];

  // History Tracking Logic
  piEstablishmentTime: number; // Timestamp when PI was confirmed
  psHistoryLogged: boolean; // Has the current session been logged to history?
  
  // Stability Check for PS History
  psCandidateString: string;
  psStableSince: number;
  
  psHistoryBuffer: PsHistoryItem[];
  rtHistoryBuffer: RtHistoryItem[];
}

// --- RDS Character Set Mapping (Custom Super-Hybrid Table) ---
// Designed to maximize decodability for Central European (CE), Nordic, and Western languages.
// Fixes specific offsets: 
// 0xDB=č, 0xDC=š, 0xDD=ž, 0xDE=đ, 0xFB=ć, 0xF2=æ, 0xF3=œ, 0xF7=ø
const RDS_G2_MAP: Record<number, string> = {
  // 0x80 - 0x8F (Standard E.1 G2 - Western Accents)
  0x80: 'á', 0x81: 'à', 0x82: 'é', 0x83: 'è', 0x84: 'í', 0x85: 'ì', 0x86: 'ó', 0x87: 'ò',
  0x88: 'ú', 0x89: 'ù', 0x8A: 'Ñ', 0x8B: 'Ç', 0x8C: 'Ş', 0x8D: 'β', 0x8E: '¡', 0x8F: 'Ŀ',
  
  // 0x90 - 0x9F (Standard E.1 G2)
  0x90: 'â', 0x91: 'ä', 0x92: 'ê', 0x93: 'ë', 0x94: 'î', 0x95: 'ï', 0x96: 'ô', 0x97: 'ö',
  0x98: 'û', 0x99: 'ü', 0x9A: 'å', 0x9B: 'ç', 0x9C: 'ş', 0x9D: 'ğ', 0x9E: 'ı', 0x9F: 'ĳ',
  // 0x9A: Fixed from 'ñ' to 'å'
  // 0x9B: Fixed from 'Ø' to 'ç' (User report: ç displayed as Ø)

  // 0xA0 - 0xAF (Hybrid: CE + Symbols)
  0xA0: 'ª', 0xA1: 'α', 0xA2: '©', 0xA3: '‰', 0xA4: 'Ğ', 0xA5: 'ě', 0xA6: 'Ň', 0xA7: 'Ő',
  0xA8: 'π', 0xA9: 'Š', 0xAA: '£', 0xAB: '$', 0xAC: '←', 0xAD: '↑', 0xAE: 'Ž', 0xAF: '↓',
  // 0xA5: Fixed from 'Ě' to 'ě'

  // 0xB0 - 0xBF (Hybrid: CE + Math)
  0xB0: '°', 0xB1: '±', 0xB2: '²', 0xB3: '³', 0xB4: '×', 0xB5: 'µ', 0xB6: '¶', 0xB7: '·',
  0xB8: '÷', 0xB9: 'š', 0xBA: 'º', 0xBB: '»', 0xBC: '¼', 0xBD: '½', 0xBE: 'ž', 0xBF: '¿',
  // 0xB9=š (CE), 0xBE=ž (CE)

  // 0xC0 - 0xCF (Hybrid: Western + CE + Nordic)
  0xC0: 'Á', 0xC1: 'À', 0xC2: 'É', 0xC3: 'È', 0xC4: 'Í', 0xC5: 'Ý', 0xC6: 'Ó', 0xC7: 'Ç',
  0xC8: 'Ú', 0xC9: 'Ù', 0xCA: 'Ř', 0xCB: 'Č', 0xCC: 'Š', 0xCD: 'Ž', 0xCE: 'Đ', 0xCF: 'Ď',
  // 0xC0-C4, C6-C9: Previous Fixes (Confirmed)
  // 0xC5: Fixed from 'Å' to 'Ý'
  // 0xCA: Fixed from 'Ę' to 'Ř'
  // 0xCB: Fixed from 'Ë' to 'Č'
  // 0xCC: Fixed from 'Ě' to 'Š'
  // 0xCD: Fixed from 'Í' to 'Ž'
  // 0xCE: Fixed from 'Î' to 'Đ'

  // 0xD0 - 0xDF (Hybrid: Specific Fixes & Uppercase support)
  0xD0: 'Â', 0xD1: 'Ä', 0xD2: 'Ê', 0xD3: 'Œ', 0xD4: 'Î', 0xD5: 'Ï', 0xD6: 'Ô', 0xD7: 'Ö',
  0xD8: 'Û', 0xD9: 'Ü', 0xDA: 'ř', 0xDB: 'č', 0xDC: 'š', 0xDD: 'ž', 0xDE: 'đ', 0xDF: 'ß',
  // 0xD0, D2, D4-D6, D9: Previous Fixes (Confirmed)
  // 0xD1: Fixed from 'Ñ' to 'Ä'
  // 0xD7: Fixed from 'Û' to 'Ö'
  // 0xD8: Fixed from 'Ø' to 'Û'
  // 0xDA: Fixed from 'Ú' to 'ř'

  // 0xE0 - 0xEF (Hybrid)
  0xE0: 'à', 0xE1: 'Å', 0xE2: 'Æ', 0xE3: 'Œ', 0xE4: 'ä', 0xE5: 'Ý', 0xE6: 'ć', 0xE7: 'Ø',
  0xE8: 'è', 0xE9: 'é', 0xEA: 'ę', 0xEB: 'Ć', 0xEC: 'ě', 0xED: 'í', 0xEE: 'î', 0xEF: 'ď',
  // 0xE2, E3: Previous Fixes (Confirmed)
  // 0xE1: Fixed from 'á' to 'Å'
  // 0xE5: Fixed from 'ý' to 'Ý'
  // 0xE7: Fixed from 'ç' to 'Ø' (User report: Ø displayed as ç)
  // 0xEB: Fixed from 'ë' to 'Ć'

  // 0xF0 - 0xFF (Hybrid: Specific Fixes)
  0xF0: 'đ', 0xF1: 'å', 0xF2: 'æ', 0xF3: 'œ', 0xF4: 'ô', 0xF5: 'ő', 0xF6: 'ö', 0xF7: 'ø',
  0xF8: 'ø', 0xF9: 'ů', 0xFA: 'ú', 0xFB: 'ć', 0xFC: 'ü', 0xFD: 'ý', 0xFE: 'ţ', 0xFF: 'ÿ'
  // 0xF1: Fixed from 'ñ' to 'å'
  // 0xF2=æ (Fix "ň" -> "æ")
  // 0xF3=œ (Fix "ó" -> "œ")
  // 0xF7=ø (Fix "÷" -> "ø")
  // 0xFB=ć (Fix "ű" -> "ć")
};

const RT_PLUS_LABELS: Record<number, string> = {
    1: "Title",
    2: "Album",
    3: "Track Number",
    4: "Artist",
    5: "Composition",
    6: "Movement",
    7: "Conductor",
    8: "Composer",
    9: "Band",
    10: "Comment (Music)",
    11: "Genre (Music)",
    12: "News",
    13: "Local News",
    14: "Stockmarket",
    15: "Sport",
    16: "Lottery",
    17: "Horoscope",
    18: "Daily Diversion (Info)",
    19: "Health Info",
    20: "Event",
    21: "Scene (Info)",
    22: "Cinema",
    23: "Stupidity Machine",
    24: "Date & Time",
    25: "Weather",
    26: "Traffic Info",
    27: "Alarm (Info)",
    28: "Advertisement",
    29: "Website/URL",
    30: "Other (Info)",
    31: "Station Name (Short)",
    32: "Station Name (Long)",
    33: "Current program",
    34: "Next program",
    35: "Part (Program)",
    36: "Host (Program)",
    37: "Editorial Staff (Program)",
    38: "Frequency",
    39: "Homepage",
    40: "Sub-channel",
    41: "Phone: Hotline",
    42: "Phone: Studio",
    43: "Phone: Other",
    44: "SMS: Studio",
    45: "SMS: Other",
    46: "Email: Hotline",
    47: "Email: Studio",
    48: "MMS: Other",
    49: "Chat",
    50: "Chat: Centre",
    51: "Vote: Question",
    52: "Vote: Centre",
    53: "Unassigned Tag 53",
    54: "Unassigned Tag 54",
    55: "Unassigned Tag 55",
    56: "Unassigned Tag 56",
    57: "Unassigned Tag 57",
    58: "Unassigned Tag 58",
    59: "Place",
    60: "Appointment",
    61: "Identifier",
    62: "Purchase",
    63: "Get Data"
};

// --- Custom RDS Byte Decoder ---
const decodeRdsByte = (b: number): string => {
    // 1. Check our Hybrid Universal Map first (Covers 0x80 - 0xFF)
    if (RDS_G2_MAP[b]) {
        return RDS_G2_MAP[b];
    }
    
    // 2. Standard ASCII Control Codes (0x00 - 0x1F)
    if (b < 0x20) {
        return String.fromCharCode(b);
    }
    
    // 3. Basic ASCII (0x20 - 0x7F)
    if (b >= 0x20 && b <= 0x7F) {
        return String.fromCharCode(b);
    }

    // 4. Fallback
    const arr = new Uint8Array([b]);
    return new TextDecoder("windows-1252").decode(arr);
};

const pad = (n: number) => n.toString().padStart(2, '0');

// TMC Duration Decoder (ISO 14819-1)
const getDurationLabel = (code: number): { label: string, minutes: number } => {
    switch(code) {
        case 0: return { label: "No duration", minutes: 0 };
        case 1: return { label: "15 minutes", minutes: 15 };
        case 2: return { label: "30 minutes", minutes: 30 };
        case 3: return { label: "1 hour", minutes: 60 };
        case 4: return { label: "2 hours", minutes: 120 };
        case 5: return { label: "3 hours", minutes: 180 };
        case 6: return { label: "4 hours", minutes: 240 };
        case 7: return { label: "Longer Lasting", minutes: 0 }; // Indefinite
        default: return { label: "Unknown", minutes: 0 };
    }
};

const getEventNature = (code: number, diversion: boolean): string => {
    return "Information"; 
};

// Basic Category mapper based on Code Ranges
const getEventCategory = (code: number): string => {
   if (code === 0) return "Unknown";
   if (code <= 100) return "Traffic Problem";
   if (code <= 199) return "Accident"; 
   if (code <= 300) return "Congestion"; 
   if (code <= 400) return "Delay";
   if (code <= 500) return "Road Works";
   if (code <= 600) return "Road Closure";
   if (code <= 700) return "Restriction";
   if (code <= 800) return "Exit/Entry";
   if (code <= 900) return "Weather"; 
   if (code <= 1000) return "Road Cond."; 
   return "Event";
};

const convertMjd = (mjd: number): { day: number, month: number, year: number } | null => {
    if (mjd === 0) return null;
    const yp = Math.floor((mjd - 15078.2) / 365.25);
    const mp = Math.floor((mjd - 14956.1 - Math.floor(yp * 365.25)) / 30.6001);
    
    const term1 = Math.floor(yp * 365.25);
    const term2 = Math.floor(mp * 30.6001);
    
    // Explicitly cast to number to resolve potential TS arithmetic errors
    const day = Number(mjd) - 14956 - Number(term1) - Number(term2);

    const k = (mp === 14 || mp === 15) ? 1 : 0;
    const year = 1900 + yp + k;
    const month = Number(mp) - 1 - Number(k) * 12;
    return { day, month, year };
};

const App: React.FC = () => {
  const [rdsData, setRdsData] = useState<RdsData>(INITIAL_RDS_DATA);
  const [serverUrl, setServerUrl] = useState<string>(''); 
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastRawPacket, setLastRawPacket] = useState<string>("Waiting for data...");
  const [packetCount, setPacketCount] = useState<number>(0);
  
  // Settings
  const [rdsStandard, setRdsStandard] = useState<'RDS' | 'RBDS'>('RDS');
  
  // Security Modal State
  const [showSecurityError, setShowSecurityError] = useState<boolean>(false);

  // Analyzer toggle state (User controlled)
  const [analyzerActive, setAnalyzerActive] = useState<boolean>(false);
  const analyzerActiveRef = useRef<boolean>(false);
  
  // TMC Toggle State
  const [tmcActive, setTmcActive] = useState<boolean>(false);
  const tmcActiveRef = useRef<boolean>(false);
  
  // TMC Pause State
  const [tmcPaused, setTmcPaused] = useState<boolean>(false);
  const tmcPausedRef = useRef<boolean>(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const packetCountRef = useRef<number>(0);
  const lineBufferRef = useRef<string>(""); 
  const tmcIdCounter = useRef<number>(0);

  // BER Sliding Window
  const berHistoryRef = useRef<number[]>([]);
  const BER_WINDOW_SIZE = 40; // Changed from 100 to 40 for responsiveness
  const GRACE_PERIOD_PACKETS = 10; 

  // --- Decoder Internal State ---
  const decoderState = useRef<DecoderState>({
    psBuffer: new Array(8).fill(' '),  
    psMask: new Array(8).fill(false),
    lpsBuffer: new Array(32).fill(' '), // Increased to 32 chars
    ptynBuffer: new Array(8).fill(' '), 
    rtBuffer0: new Array(64).fill(' '), 
    rtBuffer1: new Array(64).fill(' '), 
    rtMask0: new Array(64).fill(false),
    rtMask1: new Array(64).fill(false),
    rtCandidateString: "",
    rtStableSince: 0,
    afSet: [], 
    afListHead: null, 
    lastGroup0A3: null, // Initialized correctly
    afBMap: new Map<string, AfBEntry>(),
    currentMethodBGroup: null,
    afType: 'Unknown',
    currentPi: "----",
    piCandidate: "----",
    piCounter: 0,
    ecc: "",
    lic: "",
    pin: "",
    localTime: "",
    utcTime: "",
    pty: 0,
    tp: false,
    ta: false,
    ms: false,
    diStereo: false,
    diArtificialHead: false,
    diCompressed: false,
    diDynamicPty: false,
    abFlag: false,
    rtPlusTags: new Map(), 
    rtPlusItemRunning: false,
    rtPlusItemToggle: false,
    hasOda: false,
    odaApp: undefined,
    odaList: [], // Initialize list
    hasRtPlus: false,
    hasEon: false,
    hasTmc: false,
    rtPlusOdaGroup: null,
    eonMap: new Map<string, EonNetwork>(), 
    tmcServiceInfo: { ltn: 0, sid: 0, afi: false, mode: 0, providerName: "[Unavailable]" },
    tmcBuffer: [], 
    
    // Analyzer State
    groupCounts: {},
    groupTotal: 0,
    groupSequence: [],
    
    graceCounter: GRACE_PERIOD_PACKETS,
    isDirty: false,
    
    // Raw Buffer for Hex Viewer
    rawGroupBuffer: [],

    // History Tracking Logic
    piEstablishmentTime: 0, // Timestamp when PI was confirmed
    psHistoryLogged: false, // Has the current session been logged to history?
  
    // Stability Check for PS History
    psCandidateString: "        ",
    psStableSince: 0,
    
    psHistoryBuffer: [],
    rtHistoryBuffer: []
  });

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setLogs(prev => {
        const entry: LogEntry = { time: new Date().toLocaleTimeString(), message, type };
        return [entry, ...prev].slice(0, 100);
    });
  }, []);

  // Initial Log to verify system is working
  useEffect(() => {
    addLog("Ready. Waiting for a connection to a TEF webserver.", "info");
  }, [addLog]); 

  const updateBer = useCallback((isError: boolean) => {
    berHistoryRef.current.push(isError ? 1 : 0);
    if (berHistoryRef.current.length > BER_WINDOW_SIZE) {
        berHistoryRef.current.shift();
    }
  }, []);

  const toggleAnalyzer = useCallback(() => {
    setAnalyzerActive(prev => {
        const next = !prev;
        analyzerActiveRef.current = next;
        return next;
    });
  }, []);

  const resetAnalyzer = useCallback(() => {
    decoderState.current.groupCounts = {};
    decoderState.current.groupTotal = 0;
    decoderState.current.groupSequence = [];
    decoderState.current.isDirty = true;
  }, []);

  const toggleTmc = useCallback(() => {
    setTmcActive(prev => {
        const next = !prev;
        tmcActiveRef.current = next;
        if (!next) {
            // Also reset pause when stopping
            setTmcPaused(false);
            tmcPausedRef.current = false;
        }
        return next;
    });
  }, []);

  const toggleTmcPause = useCallback(() => {
      setTmcPaused(prev => {
          const next = !prev;
          tmcPausedRef.current = next;
          return next;
      });
  }, []);

  const resetTmc = useCallback(() => {
    decoderState.current.tmcBuffer = [];
    decoderState.current.isDirty = true;
  }, []);
  
  const resetData = useCallback(() => {
      const state = decoderState.current;
      
      // Reset PI tracking
      state.currentPi = "----";
      state.piCandidate = "----";
      state.piCounter = 0;
      state.piEstablishmentTime = 0;
      state.psHistoryLogged = false;

      // Buffers
      state.psBuffer.fill(' ');
      state.lpsBuffer.fill(' ');
      state.ptynBuffer.fill(' ');
      state.rtBuffer0.fill(' ');
      state.rtBuffer1.fill(' ');
      state.rtMask0.fill(false);
      state.rtMask1.fill(false);
      state.rtCandidateString = "";
      state.rtStableSince = 0;
      
      // Lists/Maps
      state.afSet = [];
      state.afListHead = null;
      state.afBMap.clear();
      state.currentMethodBGroup = null;
      state.eonMap.clear();
      state.tmcBuffer = [];
      state.rtPlusTags.clear();
      
      // Flags
      state.rtPlusItemRunning = false;
      state.rtPlusItemToggle = false;
      state.hasOda = false;
      state.odaApp = undefined;
      state.odaList = []; // Reset ODA List
      state.hasRtPlus = false;
      state.hasEon = false;
      state.hasTmc = false;
      
      // Extended info
      state.ecc = "";
      state.lic = "";
      state.pin = "";
      state.localTime = "";
      state.utcTime = "";
      state.pty = 0;
      state.tp = false;
      state.ta = false;
      state.ms = false;
      state.diStereo = false;
      state.diArtificialHead = false;
      state.diCompressed = false;
      state.diDynamicPty = false;
      state.abFlag = false;
      state.rtPlusOdaGroup = null;
      state.lastGroup0A3 = null;
      state.afType = 'Unknown';
      state.tmcServiceInfo = { ltn: 0, sid: 0, afi: false, mode: 0, providerName: "[Unavailable]" };
      
      // Analyzer
      state.groupCounts = {};
      state.groupTotal = 0;
      state.groupSequence = [];
      
      // History
      state.psHistoryBuffer = [];
      state.rtHistoryBuffer = [];
      
      // Reset Stability
      state.psCandidateString = "        ";
      state.psStableSince = 0;

      // Reset BER
      berHistoryRef.current = new Array(BER_WINDOW_SIZE).fill(0);
      state.graceCounter = GRACE_PERIOD_PACKETS;
      
      // Mark dirty to update UI
      state.isDirty = true;
  }, [addLog]);

  // --- RDS Group Decoder ---
  const decodeRdsGroup = useCallback((g1: number, g2: number, g3: number, g4: number) => {
    const state = decoderState.current;
    state.isDirty = true;

    // --- Block A: PI Code ---
    const piHex = g1.toString(16).toUpperCase().padStart(4, '0');
    
    if (piHex === state.piCandidate) {
        state.piCounter++;
    } else {
        state.piCandidate = piHex;
        state.piCounter = 1;
    }

    if (state.piCounter >= 4 || (state.currentPi === "----" && state.piCounter >= 1)) {
        if (state.piCandidate !== state.currentPi) {
            state.currentPi = state.piCandidate;
            
            // --- DEEP RESET OF ALL STATION DATA ---
            state.psBuffer.fill(' ');
            state.lpsBuffer.fill(' ');
            state.ptynBuffer.fill(' ');
            state.rtBuffer0.fill(' ');
            state.rtBuffer1.fill(' ');
            state.rtMask0.fill(false);
            state.rtMask1.fill(false);
            state.rtCandidateString = "";
            state.rtStableSince = 0;

            state.afSet = [];
            state.afListHead = null; // Reset Head
            state.afBMap.clear();
            state.currentMethodBGroup = null;
            state.eonMap.clear(); // Reset EON on PI change
            state.tmcBuffer = []; // Reset TMC
            state.rtPlusTags.clear();
            state.rtPlusItemRunning = false;
            state.rtPlusItemToggle = false;
            // Reset Flags on PI Change
            state.hasOda = false;
            state.odaApp = undefined;
            state.odaList = []; // Reset ODA List
            state.hasRtPlus = false;
            state.hasEon = false;
            state.hasTmc = false;
            
            // Reset Extended Data & Flags
            state.ecc = "";
            state.lic = "";
            state.pin = "";
            state.localTime = "";
            state.utcTime = "";
            state.pty = 0;
            state.tp = false;
            state.ta = false;
            state.ms = false;
            state.diStereo = false;
            state.diArtificialHead = false;
            state.diCompressed = false;
            state.diDynamicPty = false;
            state.abFlag = false;
            state.rtPlusOdaGroup = null;
            state.lastGroup0A3 = null;
            state.afType = 'Unknown';
            state.tmcServiceInfo = { ltn: 0, sid: 0, afi: false, mode: 0, providerName: "[Unavailable]" };
            
            // --- Analyzer Reset on PI Change ---
            state.groupSequence = [];
            state.groupCounts = {};
            state.groupTotal = 0;
            
            // History Reset for new station (Stability Timer)
            state.piEstablishmentTime = Date.now();
            state.psHistoryLogged = false;
            
            // --- CLEAR HISTORY BUFFERS ON PI CHANGE ---
            state.psHistoryBuffer = [];
            state.rtHistoryBuffer = [];
            
            // Reset Stability
            state.psCandidateString = "        ";
            state.psStableSince = 0;

            berHistoryRef.current = new Array(BER_WINDOW_SIZE).fill(0);
            state.graceCounter = GRACE_PERIOD_PACKETS;
        }
    }

    const groupTypeVal = (g2 >> 11) & 0x1F; 
    const tp = !!((g2 >> 10) & 0x01);
    const pty = (g2 >> 5) & 0x1F;
    
    // Determine group string (e.g., "0A")
    const typeNum = groupTypeVal >> 1; // 0-15
    const versionBit = groupTypeVal & 1; // 0=A, 1=B
    const groupStr = `${typeNum}${versionBit === 0 ? 'A' : 'B'}`;

    // --- RAW PACKET BUFFERING (For Hex Viewer) ---
    state.rawGroupBuffer.push({
        type: groupStr,
        blocks: [g1, g2, g3, g4],
        time: new Date().toLocaleTimeString('fr-FR')
    });

    // --- ANALYZER LOGIC ---
    if (analyzerActiveRef.current) {
        state.groupCounts[groupStr] = (state.groupCounts[groupStr] || 0) + 1;
        state.groupTotal++;
        state.groupSequence.push(groupStr);
        if (state.groupSequence.length > 3000) { 
            state.groupSequence.splice(0, 1000);
        }
    }
    
    state.tp = tp;
    state.pty = pty;

    const safeChar = (c: string) => c.replace(/\x00/g, ' ');
    const decodeAf = (code: number) => (code >= 1 && code <= 204) ? (87.5 + (code * 0.1)).toFixed(1) : null;

    // Group 0A or 0B (Basic Tuning)
    if (groupTypeVal === 0 || groupTypeVal === 1) { 
        // ... (Existing Group 0 Logic) ...
        const isGroupA = groupTypeVal === 0;
        const ta = !!((g2 >> 4) & 0x01); 
        const ms = !!((g2 >> 3) & 0x01);
        const diBit = (g2 >> 2) & 0x01; 
        const address = g2 & 0x03; 

        state.ta = ta;
        state.ms = ms;

        if (address === 0) state.diDynamicPty = !!diBit;
        if (address === 1) state.diCompressed = !!diBit;
        if (address === 2) state.diArtificialHead = !!diBit;
        if (address === 3) state.diStereo = !!diBit;

        const char1 = decodeRdsByte((g4 >> 8) & 0xFF);
        const char2 = decodeRdsByte(g4 & 0xFF);

        state.psBuffer[address * 2] = safeChar(char1);
        state.psBuffer[address * 2 + 1] = safeChar(char2);

        if (isGroupA) {
            if (state.lastGroup0A3 !== g3) {
                state.lastGroup0A3 = g3;
                const af1 = (g3 >> 8) & 0xFF;
                const af2 = g3 & 0xFF;
                const isAfHeader = (v: number) => v >= 225 && v <= 249;
                const isAfFreq = (v: number) => v >= 1 && v <= 204;
                const freq1Str = decodeAf(af1);
                const freq2Str = decodeAf(af2);

                const processMethodAFreq = (f: string) => {
                    if (!state.afSet.includes(f)) state.afSet.push(f);
                };

                if (isAfHeader(af1)) {
                    const headFreq = decodeAf(af2);
                    if (headFreq) {
                        // Method A Logic
                        processMethodAFreq(headFreq);
                        state.afListHead = headFreq;
                        const headIdx = state.afSet.indexOf(headFreq);
                        if (headIdx > 0) {
                             state.afSet.splice(headIdx, 1);
                             state.afSet.unshift(headFreq);
                        }

                        // Method B Context Logic
                        // When a header is received (Count > 224 + Tx Freq), we set the context.
                        const count = Number(af1) - 224;
                        state.currentMethodBGroup = headFreq;
                        if (!state.afBMap.has(headFreq)) {
                            state.afBMap.set(headFreq, { expected: count, afs: new Set(), matchCount: 0, pairCount: 0 });
                        } else {
                            state.afBMap.get(headFreq)!.expected = count;
                        }
                    }
                } else {
                    if (freq1Str) processMethodAFreq(freq1Str);
                    if (freq2Str) processMethodAFreq(freq2Str);
                }

                // AF Method B Population
                if (isAfFreq(af1) && isAfFreq(af2)) {
                    const f1 = decodeAf(af1);
                    const f2 = decodeAf(af2);
                    
                    if (f1 && f2) {
                        // 1. Context-based population (SWR style & Standard Method B)
                        // If we are currently "inside" a list for a specific transmitter, add these frequencies to it.
                        if (state.currentMethodBGroup && state.afBMap.has(state.currentMethodBGroup)) {
                            const entry = state.afBMap.get(state.currentMethodBGroup)!;
                            entry.afs.add(f1);
                            entry.afs.add(f2);
                            
                            // Track if pairs contain the Header Frequency (Standard Method B behavior)
                            entry.pairCount++;
                            if (f1 === state.currentMethodBGroup || f2 === state.currentMethodBGroup) {
                                entry.matchCount++;
                            }
                        }
                    }
                }
                
                const methodBCandidates: AfBEntry[] = Array.from(state.afBMap.values());
                const validCandidates = methodBCandidates.filter((entry: AfBEntry) => {
                    const size = entry.afs.size;
                    const expected = entry.expected;
                    if (expected === 0) return false;
                    // Validity Heuristics
                    if (size >= expected * 0.75) return true; 
                    if (expected <= 2 && size === expected) return true;
                    if (expected > 5 && size > 4) return true; 
                    return false;
                });
                
                // --- Method B vs Method A Determination ---
                // We default to Method A unless:
                // 1. We see multiple different lists (validCandidates > 1). This implies cycling headers (e.g. SWR).
                // 2. We see a single list BUT it strongly exhibits Standard Method B structure (Tx freq repeated in pairs).
                const isExplicitStandardB = validCandidates.length === 1 && validCandidates[0].pairCount > 0 && (validCandidates[0].matchCount / validCandidates[0].pairCount > 0.35);
                
                if (validCandidates.length > 1 || isExplicitStandardB) {
                    state.afType = 'B';
                } else {
                    state.afType = 'A';
                }
            }
        }
    }
    
    // Group 8A (TMC)
    else if (groupTypeVal === 16) {
        state.hasTmc = true;

        // Process only if Active AND NOT Paused
        if (tmcActiveRef.current && !tmcPausedRef.current) {
            const tuningFlag = (g2 >> 4) & 0x01;
            const variant = g2 & 0x0F; 

            if (tuningFlag === 1) {
                // --- System Message (Tuning Info) ---
                if ((variant & 0x0F) === 8 || true) { 
                     const ltn = (g3 >> 10) & 0x3F;
                     const afi = !!((g3 >> 9) & 0x01);
                     const mode = (g3 >> 8) & 0x01;
                     const sid = (g3 >> 2) & 0x3F;
                     
                     if (ltn > 0 || sid > 0) {
                         state.tmcServiceInfo = {
                             ...state.tmcServiceInfo,
                             ltn,
                             sid,
                             afi,
                             mode
                         };
                     }
                }
            } else {
                // --- User Message (F=0) ---
                const cc = g2 & 0x07;
                const durationCode = (g3 >> 13) & 0x07;
                const diversion = !!((g3 >> 12) & 0x01);
                const direction = !!((g3 >> 11) & 0x01);
                const extent = (g3 >> 8) & 0x07;
                const eventHigh = g3 & 0x00FF; // 8 bits

                const eventLow = (g4 >> 12) & 0x07; 
                const location = g4 & 0x0FFF;
                
                const eventCode = (eventHigh << 3) | eventLow;
                
                const now = new Date();
                const receivedTime = now.toLocaleTimeString('fr-FR');
                
                const durInfo = getDurationLabel(durationCode);
                let expiresTime = "--:--:--";
                if (durInfo.minutes > 0) {
                     const exp = new Date(now.getTime() + durInfo.minutes * 60000);
                     expiresTime = exp.toLocaleTimeString('fr-FR');
                } else if (durationCode === 7) {
                     expiresTime = "Indefinite";
                }

                const existingIndex = state.tmcBuffer.findIndex(m => 
                    m.locationCode === location && 
                    m.eventCode === eventCode &&
                    m.direction === direction &&
                    m.extent === extent
                );

                if (existingIndex !== -1) {
                    const existing = state.tmcBuffer[existingIndex];
                    existing.receivedTime = receivedTime;
                    existing.expiresTime = expiresTime;
                    existing.updateCount = (existing.updateCount || 1) + 1;
                } else {
                    const newMsg: TmcMessage = {
                        id: tmcIdCounter.current++,
                        receivedTime,
                        expiresTime,
                        isSystem: false,
                        label: getEventCategory(eventCode),
                        cc,
                        eventCode,
                        locationCode: location,
                        extent,
                        durationCode,
                        direction,
                        diversion,
                        urgency: "Normal", 
                        nature: getEventNature(eventCode, diversion),
                        durationLabel: durInfo.label,
                        updateCount: 1
                    };
                    state.tmcBuffer.unshift(newMsg);
                    if (state.tmcBuffer.length > 100) state.tmcBuffer.pop();
                }
            }
        }
    }

    // Group 14A (EON) - (Existing Logic)
    else if (groupTypeVal === 28) {
        state.hasEon = true;
        const eonPi = g4.toString(16).toUpperCase().padStart(4, '0');
        if (!state.eonMap.has(eonPi)) {
            state.eonMap.set(eonPi, {
                pi: eonPi, ps: "        ", psBuffer: new Array(8).fill(' '), tp: false, ta: false, pty: 0, pin: "", linkageInfo: "", af: [], mappedFreqs: [], lastUpdate: Date.now()
            });
        }
        const network = state.eonMap.get(eonPi)!;
        network.lastUpdate = Date.now();
        network.tp = !!((g2 >> 4) & 0x01);
        const variant = g2 & 0x0F;
        if (variant >= 0 && variant <= 3) {
            const address = variant; 
            const c1 = decodeRdsByte((g3 >> 8) & 0xFF);
            const c2 = decodeRdsByte(g3 & 0xFF);
            network.psBuffer[address * 2] = safeChar(c1);
            network.psBuffer[address * 2 + 1] = safeChar(c2);
            network.ps = network.psBuffer.join("");
        } else if (variant === 4) {
             const af1 = (g3 >> 8) & 0xFF;
             const af2 = g3 & 0xFF;
             const f1 = decodeAf(af1);
             const f2 = decodeAf(af2);
             if (f1 && !network.af.includes(f1)) network.af.push(f1);
             if (f2 && !network.af.includes(f2)) network.af.push(f2);
             network.af.sort((a,b) => parseFloat(a) - parseFloat(b));
        } else if (variant >= 5 && variant <= 9) {
             const freqMain = decodeAf(g3 >> 8);
             const freqMapped = decodeAf(g3 & 0xFF);
             if (freqMain && freqMapped) {
                 const mapStr = `${freqMain} -> ${freqMapped}`;
                 if (!network.mappedFreqs.includes(mapStr)) {
                     network.mappedFreqs.push(mapStr);
                     if (network.mappedFreqs.length > 4) network.mappedFreqs.shift();
                 }
             }
        } else if (variant === 12) {
             network.linkageInfo = g3.toString(16).toUpperCase().padStart(4, '0');
        } else if (variant === 13) {
             network.pty = (g3 >> 11) & 0x1F;
             network.ta = !!(g3 & 0x01);
        } else if (variant === 14) {
             const pinDay = (g3 >> 11) & 0x1F;
             const pinHour = (g3 >> 6) & 0x1F;
             const pinMin = g3 & 0x3F;
             if (pinDay !== 0) network.pin = `${pinDay}. ${pad(pinHour)}:${pad(pinMin)}`;
        }
    }

    // Group 1A (2) or 1B (3) - PIN / ECC / LIC
    else if (groupTypeVal === 2 || groupTypeVal === 3) {
        // ECC and LIC are only in Group 1A (Variant 0 and 3 respectively in Block 3)
        // Group 1B uses Block 3 for PI repetition, so we ignore Block 3 for ECC/LIC in 1B.
        if (groupTypeVal === 2) {
            const variant = (g3 >> 12) & 0x07;
            if (variant === 0) state.ecc = (g3 & 0xFF).toString(16).toUpperCase().padStart(2, '0');
            else if (variant === 3) state.lic = (g3 & 0xFF).toString(16).toUpperCase().padStart(2, '0');
        }
        
        // PIN is in Block 4 for BOTH 1A and 1B
        const pinDay = (g4 >> 11) & 0x1F;
        const pinHour = (g4 >> 6) & 0x1F;
        const pinMin = g4 & 0x3F;
        // Valid PIN day is 1-31. 0 is invalid/not set.
        if (pinDay !== 0) state.pin = `${pinDay}. ${pad(pinHour)}:${pad(pinMin)}`;
    }
    // Group 2A/2B (Radiotext)
    else if (groupTypeVal === 4 || groupTypeVal === 5) {
        const textAbFlag = !!((g2 >> 4) & 0x01); 
        if (state.abFlag !== textAbFlag) {
            state.abFlag = textAbFlag;
            state.rtPlusTags.forEach(tag => tag.isCached = true);
            const newTarget = textAbFlag ? state.rtBuffer1 : state.rtBuffer0;
            // Clear the mask for the new active flag
            if (textAbFlag) {
                state.rtMask1.fill(false);
            } else {
                state.rtMask0.fill(false);
            }
            newTarget.fill(' '); 
        }
        
        const isGroup2A = groupTypeVal === 4;
        const address = g2 & 0x0F; 
        const safeCharRT = (c: string) => c; 
        const targetBuffer = textAbFlag ? state.rtBuffer1 : state.rtBuffer0;
        const targetMask = textAbFlag ? state.rtMask1 : state.rtMask0;
        
        if (isGroup2A) {
            const c1 = decodeRdsByte((g3 >> 8) & 0xFF);
            const c2 = decodeRdsByte(g3 & 0xFF);
            const c3 = decodeRdsByte((g4 >> 8) & 0xFF);
            const c4 = decodeRdsByte(g4 & 0xFF);
            const idx = address * 4;
            if (idx < 64) {
                targetBuffer[idx] = safeCharRT(c1); targetMask[idx] = true;
                targetBuffer[idx+1] = safeCharRT(c2); targetMask[idx+1] = true;
                targetBuffer[idx+2] = safeCharRT(c3); targetMask[idx+2] = true;
                targetBuffer[idx+3] = safeCharRT(c4); targetMask[idx+3] = true;
            }
        } else {
            const c1 = decodeRdsByte((g4 >> 8) & 0xFF);
            const c2 = decodeRdsByte(g4 & 0xFF);
            const idx = address * 2;
            if (idx < 32) { 
                targetBuffer[idx] = safeCharRT(c1); targetMask[idx] = true;
                targetBuffer[idx+1] = safeCharRT(c2); targetMask[idx+1] = true;
            }
        }
    }
    // Group 3A: ODA Identification - Strict Dynamic Handshake
    else if (groupTypeVal === 6) {
        state.hasOda = true; 
        
        const b3 = g3;
        const b4 = g4;
        
        const b3Hex = b3.toString(16).toUpperCase().padStart(4, '0');
        const b4Hex = b4.toString(16).toUpperCase().padStart(4, '0');
        
        // AID detection logic: Standard is Block 3, fallback Block 4
        let aidHex = b3Hex;
        if (b3 === 0) aidHex = b4Hex;
        else if (!ODA_MAP[b3Hex] && ODA_MAP[b4Hex]) aidHex = b4Hex;
        
        const appGroupCode = g2 & 0x1F;
        const groupNum = appGroupCode >> 1;
        const groupVer = (appGroupCode & 1) ? 'B' : 'A';
        const targetGroup = `${groupNum}${groupVer}`;
        
        const odaName = ODA_MAP[aidHex] || "Unknown ODA";
        
        const newOda = { name: odaName, aid: aidHex, group: targetGroup };
        
        // Update Legacy Field (for compatibility)
        state.odaApp = newOda;

        // --- Multi-ODA List Management ---
        // Check if AID exists
        const existingIdx = state.odaList.findIndex(o => o.aid === aidHex);
        
        if (existingIdx !== -1) {
             // AID exists, update the record (group might change)
             state.odaList[existingIdx] = newOda;
        } else {
             // New AID, add to top
             state.odaList.unshift(newOda);
             // Keep max 5 items
             if (state.odaList.length > 5) {
                 state.odaList.pop();
             }
        }

        // AID for Radiotext+ is 4BD7
        if (g3 === 0x4BD7 || g4 === 0x4BD7) {
            // Application Group Type Code is in Block 2 bits 4-0 (0-31)
            const appGroup = g2 & 0x1F;
            state.rtPlusOdaGroup = appGroup;
        }
    }
    // RT+ Decoding: Only triggered if AID 4BD7 (Group 3A) assigned this specific group
    // This supports any group (e.g. 11A, 12A, 13A) as long as it was dynamically assigned.
    else if (state.rtPlusOdaGroup !== null && groupTypeVal === state.rtPlusOdaGroup) {
        state.hasRtPlus = true;
        
        // --- UNIVERSAL RT+ DECODING (Universal Mapping: G2 spare + G3 + G4) ---
        // As defined by expert analysis: Tag1 (6), Start1 (6), Len1 (6), Tag2 (6), Start2 (6), Len2 (5).
        // Uses 35 bits total.
        
        // 1. Extract Bits
        // G2 spare bits (3 bits) are the highest bits of the sequence
        const g2Spare = g2 & 0x07;
        
        // Tag 1: ID (6 bits) = G2[2..0] | G3[15..13]
        const tag1Id    = (g2Spare << 3) | ((g3 >> 13) & 0x07);
        // Tag 1: Start (6 bits) = G3[12..7]
        const tag1Start = (g3 >> 7) & 0x3F;
        // Tag 1: Length (6 bits) = G3[6..1]
        const tag1Len   = (g3 >> 1) & 0x3F;
        
        // Tag 2: ID (6 bits) = G3[0] | G4[15..11]
        const tag2Id    = ((g3 & 0x01) << 5) | ((g4 >> 11) & 0x1F);
        // Tag 2: Start (6 bits) = G4[10..5]
        const tag2Start = (g4 >> 5) & 0x3F;
        // Tag 2: Length (5 bits) = G4[4..0]
        const tag2Len   = g4 & 0x1F;

        // 3. Process Tags
        state.rtPlusItemToggle = !!((g2 >> 4) & 0x01);
        state.rtPlusItemRunning = !!((g2 >> 3) & 0x01);

        const processTag = (id: number, start: number, len: number) => {
            if (id === 0) return;
            // Re-fetch current RT in case it changed (it shouldn't have in this scope)
            const currentRtLocal = state.abFlag ? state.rtBuffer1 : state.rtBuffer0;
            const rtStrLocal = currentRtLocal.join(""); 
            
            const lengthCharCount = len + 1; 
            
            // Bounds check
            if (start >= rtStrLocal.length) return;
            
            let text = rtStrLocal.substring(start, start + lengthCharCount);
            
            // Safety clip
            if (text.length > lengthCharCount) text = text.substring(0, lengthCharCount);
            
            text = text.replace(/[\x00-\x1F]/g, '').trim();
            if (text.length > 0) {
                 const newTag = {
                     contentType: id, start: start, length: len, label: RT_PLUS_LABELS[id] || `TAG ${id}`, text: text, isCached: false, timestamp: Date.now()
                 };
                 state.rtPlusTags.set(id, newTag);
                 state.isDirty = true;
            }
        };
        
        // Tag 1
        if (tag1Id !== 0 && (tag1Start + tag1Len) < 70) {
            processTag(tag1Id, tag1Start, tag1Len);
        }
        
        // Tag 2
        if (tag2Id !== 0 && (tag2Start + tag2Len) < 70) {
            processTag(tag2Id, tag2Start, tag2Len);
        }
        
        if (state.rtPlusTags.size > 6) {
            const sortedTags = Array.from(state.rtPlusTags.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
            while (state.rtPlusTags.size > 6) {
                const oldestKey = sortedTags.shift()?.[0];
                if (oldestKey !== undefined) state.rtPlusTags.delete(oldestKey);
            }
        }
    }
    else if (groupTypeVal === 8) {
        const mjdCalc = ((g2 & 0x03) << 15) | ((g3 & 0xFFFE) >> 1);
        const date = convertMjd(mjdCalc);
        const g4TimeReconstructed = ((g3 & 0x01) << 15) | (g4 >>> 1);
        const utcHour = (g4TimeReconstructed >>> 11) & 0x1F;
        const utcMin = (g4TimeReconstructed >> 5) & 0x3F;
        const offsetSign = (g4 >> 4) & 0x01; 
        const offsetVal = g4 & 0x0F;         
        if (date) {
             const dateStr = `${pad(date.day)}/${pad(date.month)}/${date.year}`;
             const utcStr = `${dateStr} ${pad(utcHour)}:${pad(utcMin)}`;
             state.utcTime = utcStr;
             let totalMin = utcHour * 60 + utcMin;
             const offsetMin = offsetVal * 30;
             if (offsetSign === 1) totalMin -= offsetMin;
             else totalMin += offsetMin;
             if (totalMin < 0) totalMin += 1440;
             if (totalMin >= 1440) totalMin -= 1440;
             const locH = Math.floor(totalMin / 60);
             const locM = totalMin % 60;
             state.localTime = `${dateStr} ${pad(locH)}:${pad(locM)}`;
        }
    }
    else if (groupTypeVal === 20) {
        const address = g2 & 0x01; 
        const c1 = decodeRdsByte((g3 >> 8) & 0xFF);
        const c2 = decodeRdsByte(g3 & 0xFF);
        const c3 = decodeRdsByte((g4 >> 8) & 0xFF);
        const c4 = decodeRdsByte(g4 & 0xFF);
        const idx = address * 4;
        if (idx < 8) {
             state.ptynBuffer[idx] = c1; state.ptynBuffer[idx+1] = c2;
             state.ptynBuffer[idx+2] = c3; state.ptynBuffer[idx+3] = c4;
        }
    }
    // Group 15A Only (15B Ignored)
    else if (groupTypeVal === 30) {
         const address = g2 & 0x0F; 
         const c1 = decodeRdsByte((g3 >> 8) & 0xFF);
         const c2 = decodeRdsByte(g3 & 0xFF);
         const c3 = decodeRdsByte((g4 >> 8) & 0xFF);
         const c4 = decodeRdsByte(g4 & 0xFF);
         const idx = address * 4;
         if (idx < 32) {
             state.lpsBuffer[idx] = c1; state.lpsBuffer[idx+1] = c2;
             state.lpsBuffer[idx+2] = c3; state.lpsBuffer[idx+3] = c4;
         }
    }
  }, []); 

  // --- UI Update Loop ---
  useEffect(() => {
    let animationFrameId: number;
    const loop = () => {
        const state = decoderState.current;
        if (state.isDirty || state.rawGroupBuffer.length > 0) {
            
            // --- PS HISTORY LOGIC (3s Delay + Dynamic Updates + Stability Check) ---
            const now = Date.now();
            const currentPs = state.psBuffer.join("");
            
            // Stability Check: Only consider PS "candidate" valid if it doesn't change for 1000ms
            if (currentPs !== state.psCandidateString) {
                state.psCandidateString = currentPs;
                state.psStableSince = now;
            }
            
            const isStable = (now - state.psStableSince) >= 1000;

            if (state.piEstablishmentTime > 0 && 
                (now - state.piEstablishmentTime > 3000) && 
                state.currentPi !== "----" &&
                isStable) 
            {
                const lastEntry = state.psHistoryBuffer.length > 0 ? state.psHistoryBuffer[0] : null;
                
                // Only log if valid, not empty, and DIFFERENT from last recorded entry
                if (currentPs.trim().length > 0 && (!lastEntry || lastEntry.ps !== currentPs)) {
                    state.psHistoryBuffer.unshift({
                        time: new Date().toLocaleTimeString(),
                        pi: state.currentPi,
                        ps: currentPs,
                        pty: state.pty
                    });
                    if (state.psHistoryBuffer.length > 200) state.psHistoryBuffer.pop();
                    state.psHistoryLogged = true;
                }
            }

            // --- RT HISTORY LOGIC (Stability Based) ---
            const currentRtBuffer = state.abFlag ? state.rtBuffer1 : state.rtBuffer0;
            const currentRtMask = state.abFlag ? state.rtMask1 : state.rtMask0;
            
            const termIdx = currentRtBuffer.indexOf('\r');
            let isRtComplete = false;
            let rawRtText = currentRtBuffer.join("");
            
            if (termIdx !== -1) {
                isRtComplete = currentRtMask.slice(0, termIdx).every(Boolean);
                rawRtText = rawRtText.substring(0, termIdx);
            } else {
                isRtComplete = currentRtMask.every(Boolean);
            }

            if (isRtComplete) {
                // Stability Check
                if (rawRtText !== state.rtCandidateString) {
                    state.rtCandidateString = rawRtText;
                    state.rtStableSince = now;
                }

                // 2 seconds stability required to ensure we don't log transient noise or mixed buffers
                if (now - state.rtStableSince >= 2000) {
                     const lastEntry = state.rtHistoryBuffer.length > 0 ? state.rtHistoryBuffer[0] : null;
                     if (!lastEntry || lastEntry.text !== rawRtText) {
                         // Only log if not empty/whitespace
                         if (rawRtText.trim().length > 0) {
                             state.rtHistoryBuffer.unshift({
                                 time: new Date().toLocaleTimeString(),
                                 text: rawRtText
                             });
                             if (state.rtHistoryBuffer.length > 200) state.rtHistoryBuffer.pop();
                         }
                     }
                }
            }

            const afBLists: Record<string, string[]> = {};
            state.afBMap.forEach((entry, key) => {
                afBLists[key] = Array.from(entry.afs);
            });
            const currentBer = berHistoryRef.current.length > 0 ? (berHistoryRef.current.reduce((a, b) => a + b, 0) / berHistoryRef.current.length) * 100 : 0;
            const sortedRtPlusTags = Array.from(state.rtPlusTags.values()).sort((a: RtPlusTag, b: RtPlusTag) => a.contentType - b.contentType);
            const eonDataObj: Record<string, EonNetwork> = {};
            state.eonMap.forEach((val, key) => eonDataObj[key] = val);
            const active = analyzerActiveRef.current;
            const recentGroups = [...state.rawGroupBuffer];
            state.rawGroupBuffer = [];
            
            // We ignore ptyName here, handled in components via standard
            setRdsData(prev => ({
                ...prev,
                pi: state.currentPi, pty: state.pty, ptyn: state.ptynBuffer.join(""),
                tp: state.tp, ta: state.ta, ms: state.ms, stereo: state.diStereo, artificialHead: state.diArtificialHead, compressed: state.diCompressed, dynamicPty: state.diDynamicPty,
                ecc: state.ecc, lic: state.lic, pin: state.pin, localTime: state.localTime, utcTime: state.utcTime,
                textAbFlag: state.abFlag, rtPlus: sortedRtPlusTags, rtPlusItemRunning: state.rtPlusItemRunning, rtPlusItemToggle: state.rtPlusItemToggle,
                hasOda: state.hasOda, odaApp: state.odaApp, odaList: [...state.odaList], // Pass new list
                hasRtPlus: state.hasRtPlus, hasEon: state.hasEon, hasTmc: state.hasTmc,
                eonData: eonDataObj,
                tmcServiceInfo: {...state.tmcServiceInfo}, 
                tmcMessages: [...state.tmcBuffer],
                ps: state.psBuffer.join(""), longPs: state.lpsBuffer.join(""),
                rtA: state.rtBuffer0.join(""), rtB: state.rtBuffer1.join(""), 
                af: [...state.afSet], afListHead: state.afListHead, afBLists: afBLists, afType: state.afType,
                ber: state.graceCounter > 0 ? 0 : currentBer,
                groupCounts: active ? {...state.groupCounts} : prev.groupCounts,
                groupTotal: active ? state.groupTotal : prev.groupTotal,
                groupSequence: active ? [...state.groupSequence] : prev.groupSequence,
                recentGroups: recentGroups,
                // Pass history buffers
                psHistory: [...state.psHistoryBuffer],
                rtHistory: [...state.rtHistoryBuffer]
            }));
            setPacketCount(packetCountRef.current);
            state.isDirty = false;
        }
        animationFrameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // ... (Connect, Disconnect, Log helpers remain same) ...
  const connect = () => {
    if (!serverUrl) return;
    if (wsRef.current) wsRef.current.close();
    try {
        let inputUrl = serverUrl.trim();
        
        // Ensure protocol exists for URL parsing to work (default to http)
        if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(inputUrl)) {
            inputUrl = 'http://' + inputUrl;
        }

        const url = new URL(inputUrl);

        // Protocol Switching: http -> ws, https -> wss
        // We preserve standard behavior: if explicit ws/wss, keep it. 
        // If http/https, switch to ws/wss.
        if (url.protocol === 'https:') {
            url.protocol = 'wss:';
        } else if (url.protocol === 'http:') {
            url.protocol = 'ws:';
        } else if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
             // Fallback for other protocols or missing protocol if regex missed
             url.protocol = 'ws:';
        }

        // Path Handling: Append /rds if not present
        // 1. Remove trailing slash from pathname to normalize (e.g. "/" -> "")
        let path = url.pathname;
        if (path.endsWith('/')) {
             path = path.slice(0, -1);
        }
        // 2. Append /rds if missing
        if (!path.endsWith('/rds')) {
             path += '/rds';
        }
        url.pathname = path;
        
        // CRITICAL FIX: Explicitly remove query string and hash as requested
        url.search = '';
        url.hash = '';

        const finalUrl = url.toString();

      const ws = new WebSocket(finalUrl);
      wsRef.current = ws;
      setStatus(ConnectionStatus.CONNECTING);
      addLog(`Connecting to ${finalUrl}...`, 'info');
      ws.binaryType = 'arraybuffer';
      lineBufferRef.current = "";
      ws.onopen = () => { setStatus(ConnectionStatus.CONNECTED); addLog('Connected successfully.', 'success'); decoderState.current.graceCounter = GRACE_PERIOD_PACKETS; lineBufferRef.current = ""; };
      ws.onclose = (event) => { setStatus(ConnectionStatus.DISCONNECTED); addLog(`Disconnected.`, 'warning'); wsRef.current = null; };
      ws.onerror = () => { setStatus(ConnectionStatus.ERROR); addLog('Connection Error', 'error'); };
      ws.onmessage = (evt) => {
        let chunk = "";
        if (typeof evt.data === "string") chunk = evt.data;
        else if (evt.data instanceof ArrayBuffer) chunk = new TextDecoder("windows-1252").decode(evt.data);
        lineBufferRef.current += chunk;
        if (chunk.trim().length > 0) setLastRawPacket(chunk.substring(0, 40));
        
        // Regex modified to accept '----' or similar 4-char placeholders as valid block delimiters for error handling
        const hexPattern = /([0-9A-Fa-f]{4}|-{2,4})(?:[\s:,-]*)([0-9A-Fa-f]{4}|-{2,4})(?:[\s:,-]*)([0-9A-Fa-f]{4}|-{2,4})(?:[\s:,-]*)([0-9A-Fa-f]{4}|-{2,4})/;
        
        while (true) {
            const jsonStart = lineBufferRef.current.indexOf('{');
            const jsonEnd = lineBufferRef.current.indexOf('}', jsonStart);
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                const jsonStr = lineBufferRef.current.substring(jsonStart, jsonEnd + 1);
                try {
                    const json = JSON.parse(jsonStr);
                    if (typeof json.g1 === 'number') {
                         decodeRdsGroup(json.g1, json.g2, json.g3, json.g4);
                         packetCountRef.current += 1;
                         if (decoderState.current.graceCounter === 0) updateBer(false); else decoderState.current.graceCounter--;
                    }
                } catch(e) {}
                lineBufferRef.current = lineBufferRef.current.substring(jsonEnd + 1);
                continue;
            }
            
            let match = lineBufferRef.current.match(hexPattern);
            if (match && match.index !== undefined) {
                const blocks = [match[1], match[2], match[3], match[4]];
                // Check if any block contains dashes (error marker)
                const isCorrupted = blocks.some(b => b.includes('-'));

                if (isCorrupted) {
                     packetCountRef.current += 1;
                     // Always penalize BER for corrupted frames
                     updateBer(true); 
                     
                     // Analyzer Update: Add "--" to sequence
                     if (analyzerActiveRef.current) {
                         const state = decoderState.current;
                         state.groupTotal++;
                         state.groupSequence.push("--"); 
                         if (state.groupSequence.length > 3000) { 
                             state.groupSequence.splice(0, 1000);
                         }
                         // Track error counts (optional, but good for internal consistency)
                         state.groupCounts["--"] = (state.groupCounts["--"] || 0) + 1;
                     }
                     
                     // Decoder state dirty to trigger UI update (for BER)
                     decoderState.current.isDirty = true;

                } else {
                    const g1 = parseInt(blocks[0], 16); 
                    const g2 = parseInt(blocks[1], 16); 
                    const g3 = parseInt(blocks[2], 16); 
                    const g4 = parseInt(blocks[3], 16);

                    if (!isNaN(g1)) {
                        decodeRdsGroup(g1, g2, g3, g4);
                        packetCountRef.current += 1;
                        if (decoderState.current.graceCounter === 0) updateBer(false); else decoderState.current.graceCounter--;
                    }
                }
                
                lineBufferRef.current = lineBufferRef.current.substring(match.index + match[0].length);
            } else { break; }
        }
        if (lineBufferRef.current.length > 500) { if (decoderState.current.graceCounter === 0) updateBer(true); lineBufferRef.current = lineBufferRef.current.substring(250); decoderState.current.isDirty = true; }
      };
    } catch (e) { 
        setStatus(ConnectionStatus.ERROR); 
        // Changed error handling to avoid "Invalid URL" prefix when the browser blocks Mixed Content
        let msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("The operation is insecure")) {
            msg = "The operation is insecure. Due to web browsers security restrictions, only HTTPS connections are allowed.";
            setShowSecurityError(true);
        }
        addLog(`Connection Failed: ${msg}`, 'error'); 
    }
  };
  const disconnect = () => { if (wsRef.current) { wsRef.current.close(); wsRef.current = null; } };
  
  // getLogColor moved outside component or defined here if simple
  const getLogColor = (type: LogEntry['type']) => { switch(type) { case 'success': return 'text-green-400 font-bold'; case 'error': return 'text-red-400 font-bold'; case 'warning': return 'text-yellow-400'; case 'info': return 'text-blue-300'; default: return 'text-slate-200'; } };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-300 font-sans selection:bg-blue-500/30">
      {/* Security Error Modal */}
      {showSecurityError && (
        <SecurityErrorModal onClose={() => setShowSecurityError(false)} />
      )}

      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
            
            {/* LOGO BRANDING */}
            <div className="flex items-center justify-center md:justify-start shrink-0 md:mr-2 select-none cursor-default group">
                <span className="font-black text-2xl text-slate-100 tracking-tighter italic group-hover:text-white transition-colors">RDS</span>
                <span className="font-bold text-2xl text-blue-500 tracking-tighter group-hover:text-blue-400 transition-colors">EXPERT</span>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded px-3 py-2 flex items-center gap-3 w-full md:w-auto shrink-0 text-xs font-mono text-slate-500">
                <span>STATUS</span> <span className={`font-bold ${status === ConnectionStatus.CONNECTED ? 'text-green-400' : status === ConnectionStatus.ERROR ? 'text-red-400' : 'text-slate-400'}`}>{status}</span>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded px-3 py-2 flex items-center gap-3 w-full md:w-auto shrink-0 text-xs font-mono text-slate-500">
                <span>PACKETS</span> <span className="text-slate-200">{packetCount.toLocaleString()}</span>
            </div>

            {/* RDS / RBDS Selector */}
            <div className="shrink-0">
               <select 
                 value={rdsStandard} 
                 onChange={(e) => setRdsStandard(e.target.value as 'RDS' | 'RBDS')}
                 className="bg-slate-900/50 border border-slate-800 text-slate-300 text-xs font-mono rounded p-2 focus:outline-none focus:border-blue-500 cursor-pointer h-full"
               >
                 <option value="RDS">RDS MODE</option>
                 <option value="RBDS">RBDS MODE</option>
               </select>
            </div>

            <div className="flex items-center gap-2 flex-1">
                <div className="relative group flex-1">
                    <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && connect()} placeholder="Indicate the webserver URL here (HTTPS only!)" className="relative w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600 font-mono" />
                </div>
                {status === ConnectionStatus.CONNECTED ? ( <button onClick={disconnect} className="bg-red-500 hover:bg-red-600 text-white text-sm font-bold px-4 py-2 rounded shadow transition-all whitespace-nowrap">DISCONNECT</button> ) : ( <button onClick={connect} disabled={status === ConnectionStatus.CONNECTING} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">{status === ConnectionStatus.CONNECTING ? '...' : 'CONNECT'}</button> )}
            </div>
        </div>
        <div className="space-y-6">
           <LcdDisplay data={rdsData} rdsStandard={rdsStandard} onReset={resetData} />
           <HistoryControls data={rdsData} rdsStandard={rdsStandard} />
           <InfoGrid data={rdsData} rdsStandard={rdsStandard} />
           <GroupAnalyzer data={rdsData} active={analyzerActive} onToggle={toggleAnalyzer} onReset={resetAnalyzer} />
           <TmcViewer 
              data={rdsData} 
              active={tmcActive} 
              paused={tmcPaused}
              onToggle={toggleTmc} 
              onPause={toggleTmcPause}
              onReset={resetTmc} 
           />
        </div>
        <div className="bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs h-48 shadow-inner flex flex-col">
           <div className="text-slate-400 border-b border-slate-800 p-4 pb-2 font-bold uppercase tracking-wider flex justify-between shrink-0 bg-slate-950 rounded-t-lg z-10">
               <span>System Logs</span> <span className="text-[10px] opacity-50">Real-time Events</span>
           </div>
           <div className="space-y-1 overflow-y-auto p-4 pt-2 custom-scrollbar flex-1">
             {logs.length === 0 && <div className="text-slate-400 italic p-2 opacity-80">No events recorded.</div>}
             {logs.map((l, i) => ( <div key={i} className={`border-b border-slate-900/50 pb-0.5 last:border-0 flex gap-3 ${getLogColor(l.type)}`}> <span className="text-slate-500 shrink-0">[{l.time}]</span> <span>{l.message}</span> </div> ))}
           </div>
        </div>
      </div>
    </div>
  );
};

const SecurityErrorModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-slate-900 border-2 border-red-500/50 rounded-lg shadow-2xl w-full max-w-md flex flex-col overflow-hidden relative">
            <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
                     <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                     </svg>
                </div>
               <h3 className="text-xl font-bold text-white">Connection Failed</h3>
               <p className="text-slate-300 text-sm leading-relaxed">
                    Unfortunately, due to web browser security restrictions,
                    <br />
                    this tool can only be used with HTTPS servers.
                    <br />
                    <br />
                    You can bypass this limitation and connect to an HTTP server
                    <br />
                    by using this version hosted by @Bkram:
                    <br />
                    <a 
                    href="http://rdsexpert.fmdx-webserver.nl:8080/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 underline hover:text-blue-300"
                    >
                    http://rdsexpert.fmdx-webserver.nl:8080/
                    </a>
               </p>
                </div>
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-center">
                <button onClick={onClose} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded transition-colors uppercase border border-slate-600">
                    Close
                </button>
            </div>
        </div>
    </div>
);

export default App;
