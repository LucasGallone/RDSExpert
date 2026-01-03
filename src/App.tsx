import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  RdsData, 
  ConnectionStatus, 
  PTY_RDS, 
  PTY_RBDS, 
  RtPlusTag, 
  EonNetwork, 
  RawGroup, 
  TmcMessage, 
  TmcServiceInfo, 
  PsHistoryItem, 
  RtHistoryItem, 
  LogEntry 
} from './types';
import { 
  INITIAL_RDS_DATA, 
  ODA_MAP, 
  TMC_EVENT_MAP 
} from './constants';
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
  rtMask0: boolean[]; 
  rtMask1: boolean[]; 
  
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
  odaApp: { 
    name: string; 
    aid: string; 
    group: string 
  } | undefined;
  odaList: { 
    name: string; 
    aid: string; 
    group: string 
  }[];
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
  piEstablishmentTime: number; 
  psHistoryLogged: boolean; 
  
  // Stability Check for PS History
  psCandidateString: string;
  psStableSince: number;
  
  psHistoryBuffer: PsHistoryItem[];
  rtHistoryBuffer: RtHistoryItem[];
}

// --- RDS Character Set Mapping (Custom Super-Hybrid Table) ---
const RDS_G2_MAP: Record<number, string> = {
  // 0x80 - 0x8F
  0x80: 'á', 
  0x81: 'à', 
  0x82: 'é', 
  0x83: 'è', 
  0x84: 'í', 
  0x85: 'ì', 
  0x86: 'ó', 
  0x87: 'ò',
  0x88: 'ú', 
  0x89: 'ù', 
  0x8A: 'Ñ', 
  0x8B: 'Ç', 
  0x8C: 'Ş', 
  0x8D: 'ß', 
  0x8E: '¡', 
  0x8F: 'Ĳ',
  // 0x90 - 0x9F
  0x90: 'â', 
  0x91: 'ä', 
  0x92: 'ê', 
  0x93: 'ë', 
  0x94: 'î', 
  0x95: 'ï', 
  0x96: 'ô', 
  0x97: 'ö',
  0x98: 'û', 
  0x99: 'ü', 
  0x9A: 'ñ', 
  0x9B: 'ç', 
  0x9C: 'ş', 
  0x9D: 'ğ', 
  0x9E: 'ı', 
  0x9F: 'ĳ',
  // 0xA0 - 0xAF
  0xA0: 'ª', 
  0xA1: 'α', 
  0xA2: '©', 
  0xA3: '‰', 
  0xA4: 'Ğ', 
  0xA5: 'ě', 
  0xA6: 'Ň', 
  0xA7: 'ő',
  0xA8: 'π', 
  0xA9: '€', 
  0xAA: '£', 
  0xAB: '$', 
  0xAC: '←', 
  0xAD: '↑', 
  0xAE: '→', 
  0xAF: '↓',
  // 0xB0 - 0xBF
  0xB0: '⁰',
  0xB1: '¹', 
  0xB2: '²', 
  0xB3: '³', 
  0xB4: '±', 
  0xB5: 'İ', 
  0xB6: 'ń', 
  0xB7: 'ű',
  0xB8: 'μ', 
  0xB9: '¿', 
  0xBA: '÷', 
  0xBB: '°', 
  0xBC: '¼', 
  0xBD: '½', 
  0xBE: '¾', 
  0xBF: '§',
  // 0xC0 - 0xCF
  0xC0: 'Á', 
  0xC1: 'À', 
  0xC2: 'É', 
  0xC3: 'È', 
  0xC4: 'Í', 
  0xC5: 'Ì', 
  0xC6: 'Ó', 
  0xC7: 'Ò',
  0xC8: 'Ú', 
  0xC9: 'Ù', 
  0xCA: 'Ř', 
  0xCB: 'Č', 
  0xCC: 'Š', 
  0xCD: 'Ž', 
  0xCE: 'Đ', 
  0xCF: 'Ŀ',
  // 0xD0 - 0xDF
  0xD0: 'Â', 
  0xD1: 'Ä', 
  0xD2: 'Ê', 
  0xD3: 'Ë', 
  0xD4: 'Î', 
  0xD5: 'Ï', 
  0xD6: 'Ô', 
  0xD7: 'Ö',
  0xD8: 'Û', 
  0xD9: 'Ü', 
  0xDA: 'ř', 
  0xDB: 'č', 
  0xDC: 'š', 
  0xDD: 'ž', 
  0xDE: 'đ', 
  0xDF: 'ŀ',
  // 0xE0 - 0xEF
  0xE0: 'Ã', 
  0xE1: 'Å', 
  0xE2: 'Æ', 
  0xE3: 'Œ', 
  0xE4: 'ŷ', 
  0xE5: 'Ý', 
  0xE6: 'Õ', 
  0xE7: 'Ø',
  0xE8: 'Þ', 
  0xE9: 'Ŋ', 
  0xEA: 'Ŕ', 
  0xEB: 'Ć', 
  0xEC: 'Ś', 
  0xED: 'Ź', 
  0xEE: 'Ŧ', 
  0xEF: 'ð',
  // 0xF0 - 0xFF
  0xF0: 'ã', 
  0xF1: 'å', 
  0xF2: 'æ', 
  0xF3: 'œ', 
  0xF4: 'ŵ', 
  0xF5: 'ý', 
  0xF6: 'õ', 
  0xF7: 'ø',
  0xF8: 'þ', 
  0xF9: 'ŋ', 
  0xFA: 'ŕ', 
  0xFB: 'ć', 
  0xFC: 'ś', 
  0xFD: 'ź', 
  0xFE: 'ŧ', 
  0xFF: 'ÿ'
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
  if (RDS_G2_MAP[b]) {
    return RDS_G2_MAP[b];
  }
  if (b < 0x20) {
    return String.fromCharCode(b);
  }
  if (b >= 0x20 && b <= 0x7F) {
    return String.fromCharCode(b);
  }
  const arr = new Uint8Array([b]);
  const decoder = new TextDecoder("windows-1252");
  return decoder.decode(arr);
};

// --- Hybrid Decoder Function ---
const renderRdsBuffer = (chars: string[]): string => {
  const bytes = new Uint8Array(
    chars.map((c) => {
      if (c) {
        return c.charCodeAt(0);
      }
      return 0x20;
    })
  );
  
  // High bit detection for UTF-8
  const hasHighBits = bytes.some((b) => b > 127);
  
  if (hasHighBits) {
    try {
      const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
      const decoded = utf8Decoder.decode(bytes);
      return decoded.replace(/\0/g, ' ');
    } catch (e) {
      // Switching to standard RDS decoding in case of UTF-8 failure
    }
  }
  
  return chars.map((c) => {
    const b = c ? c.charCodeAt(0) : 0x20;
    if (b === 0) {
      return ' ';
    }
    return decodeRdsByte(b);
  }).join("");
};

const pad = (n: number) => {
  return n.toString().padStart(2, '0');
};

const getDurationLabel = (code: number): { label: string, minutes: number } => {
  switch(code) {
    case 0: 
      return { label: "No duration", minutes: 0 };
    case 1: 
      return { label: "15 minutes", minutes: 15 };
    case 2: 
      return { label: "30 minutes", minutes: 30 };
    case 3: 
      return { label: "1 hour", minutes: 60 };
    case 4: 
      return { label: "2 hours", minutes: 120 };
    case 5: 
      return { label: "3 hours", minutes: 180 };
    case 6: 
      return { label: "4 hours", minutes: 240 };
    case 7: 
      return { label: "Longer Lasting", minutes: 0 };
    default: 
      return { label: "Unknown", minutes: 0 };
  }
};

// Determining the nature of the TMC events
const getEventNature = (code: number): string => {
  if (code >= 1 && code <= 150) return "Traffic Flow";
  if (code >= 200 && code <= 399) return "Accident/Incident";
  if (code >= 400 && code <= 499) return "Closure";
  if (code >= 500 && code <= 699) return "Lane Restriction";
  if (code >= 700 && code <= 899) return "Roadworks";
  if (code >= 900 && code <= 1000) return "Danger/Obstruction";
  if (code >= 1001 && code <= 1100) return "Road Condition";
  if (code >= 1101 && code <= 1400) return "Meteorological";
  if (code >= 1401 && code <= 1600) return "Public Event";
  if (code >= 1601 && code <= 2000) return "Service/Delay";
  return "Information"; 
};

// Determining the emergency level of the TMC events
const getEventUrgency = (code: number): string => {
  if (code >= 900 && code <= 1000) return "High Priority";
  if (code >= 200 && code <= 250) return "High Priority";
  if (code >= 401 && code <= 410) return "High Priority";
  if (code === 2) return "High Priority"; // Stationary traffic danger
  return "Normal";
};

const getEventCategory = (code: number): string => {
  if (TMC_EVENT_MAP[code]) {
    return TMC_EVENT_MAP[code];
  }
  return `Unidentified event [Code: ${code}]`;
};

const convertMjd = (mjd: number): { day: number, month: number, year: number } | null => {
  if (mjd === 0) {
    return null;
  }
  const yp = Math.floor((mjd - 15078.2) / 365.25);
  const mp = Math.floor((mjd - 14956.1 - Math.floor(yp * 365.25)) / 30.6001);
  const term1 = Math.floor(yp * 365.25);
  const term2 = Math.floor(mp * 30.6001);
  const day = Number(mjd) - 14956 - Number(term1) - Number(term2);
  const k = (mp === 14 || mp === 15) ? 1 : 0;
  const year = 1900 + yp + k;
  const month = Number(mp) - 1 - Number(k) * 12;
  return { 
    day: day, 
    month: month, 
    year: year 
  };
};

const App: React.FC = () => {
  const [rdsData, setRdsData] = useState<RdsData>(INITIAL_RDS_DATA);
  const [serverUrl, setServerUrl] = useState<string>(() => {
    // Initialization from the ?url= parameter if present
    const params = new URLSearchParams(window.location.search);
    return params.get('url') || '';
  }); 
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastRawPacket, setLastRawPacket] = useState<string>("Waiting for data...");
  const [packetCount, setPacketCount] = useState<number>(0);
  const [rdsStandard, setRdsStandard] = useState<'RDS' | 'RBDS'>('RDS');
  const [showSecurityError, setShowSecurityError] = useState<boolean>(false);
  const [analyzerActive, setAnalyzerActive] = useState<boolean>(false);
  const analyzerActiveRef = useRef<boolean>(false);
  const [tmcActive, setTmcActive] = useState<boolean>(false);
  const tmcActiveRef = useRef<boolean>(false);
  const [tmcPaused, setTmcPaused] = useState<boolean>(false);
  const tmcPausedRef = useRef<boolean>(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const packetCountRef = useRef<number>(0);
  const lineBufferRef = useRef<string>(""); 
  const tmcIdCounter = useRef<number>(0);
  const berHistoryRef = useRef<number[]>([]);
  const BER_WINDOW_SIZE = 40; 
  const GRACE_PERIOD_PACKETS = 10; 

  const decoderState = useRef<DecoderState>({
    psBuffer: new Array(8).fill(' '),  
    psMask: new Array(8).fill(false),
    lpsBuffer: new Array(32).fill(' '), 
    ptynBuffer: new Array(8).fill(' '), 
    rtBuffer0: new Array(64).fill(' '), 
    rtBuffer1: new Array(64).fill(' '), 
    rtMask0: new Array(64).fill(false),
    rtMask1: new Array(64).fill(false),
    rtCandidateString: "",
    rtStableSince: 0,
    afSet: [], 
    afListHead: null, 
    lastGroup0A3: null,
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
    odaList: [],
    hasRtPlus: false,
    hasEon: false,
    hasTmc: false,
    rtPlusOdaGroup: null,
    eonMap: new Map<string, EonNetwork>(), 
    tmcServiceInfo: { 
      ltn: 0, 
      sid: 0, 
      afi: false, 
      mode: 0, 
      providerName: "[Unavailable]" 
    },
    tmcBuffer: [], 
    
    // Analyzer State
    groupCounts: {},
    groupTotal: 0,
    groupSequence: [],
    
    graceCounter: GRACE_PERIOD_PACKETS,
    isDirty: false,
    
    // Raw Buffer for Hex Viewer
    rawGroupBuffer: [],
    piEstablishmentTime: 0,
    psHistoryLogged: false,
    psCandidateString: "        ",
    psStableSince: 0,
    psHistoryBuffer: [],
    rtHistoryBuffer: []
  });

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setLogs((prev) => {
      const entry: LogEntry = { 
        time: new Date().toLocaleTimeString(), 
        message: message, 
        type: type 
      };
      return [entry, ...prev].slice(0, 100);
    });
  }, []);

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
    setAnalyzerActive((prev) => {
      const next = !prev;
      analyzerActiveRef.current = next;
      return next;
    });
  }, []);

  const resetAnalyzer = useCallback(() => {
    const state = decoderState.current;
    state.groupCounts = {};
    state.groupTotal = 0;
    state.groupSequence = [];
    state.isDirty = true;
  }, []);

  const toggleTmc = useCallback(() => {
    setTmcActive((prev) => {
      const next = !prev;
      tmcActiveRef.current = next;
      if (!next) {
        setTmcPaused(false);
        tmcPausedRef.current = false;
      }
      return next;
    });
  }, []);

  const toggleTmcPause = useCallback(() => {
    setTmcPaused((prev) => {
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
    
    state.currentPi = "----";
    state.piCandidate = "----";
    state.piCounter = 0;
    state.piEstablishmentTime = 0;
    state.psHistoryLogged = false;

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
    // Fix: Changed colon to equals for property assignment
    state.afListHead = null;
    state.afBMap.clear();
    state.currentMethodBGroup = null;
    state.eonMap.clear();
    state.tmcBuffer = [];
    state.rtPlusTags.clear();

    state.rtPlusItemRunning = false;
    state.rtPlusItemToggle = false;
    state.hasOda = false;
    state.odaApp = undefined;
    state.odaList = [];
    state.hasRtPlus = false;
    state.hasEon = false;
    state.hasTmc = false;

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

    state.groupCounts = {};
    state.groupTotal = 0;
    state.groupSequence = [];

    state.psHistoryBuffer = [];
    state.rtHistoryBuffer = [];
    state.psCandidateString = "        ";
    state.psStableSince = 0;

    berHistoryRef.current = [];
    state.graceCounter = GRACE_PERIOD_PACKETS;
    
    state.isDirty = true;
  }, []);

  const decodeRdsGroup = useCallback((g1: number, g2: number, g3: number, g4: number) => {
    const state = decoderState.current;
    state.isDirty = true;

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
        // Fix: Changed colon to equals for property assignment
        state.afListHead = null;
        state.afBMap.clear();
        state.currentMethodBGroup = null;
        state.eonMap.clear();
        state.tmcBuffer = [];
        state.rtPlusTags.clear();
        state.rtPlusItemRunning = false;
        state.rtPlusItemToggle = false;
        state.hasOda = false;
        state.odaApp = undefined;
        state.odaList = [];
        state.hasRtPlus = false;
        state.hasEon = false;
        state.hasTmc = false;
        
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
        state.tmcServiceInfo = { 
          ltn: 0, 
          sid: 0, 
          afi: false, 
          mode: 0, 
          providerName: "[Unavailable]" 
    };
        
        state.groupSequence = [];
        state.groupCounts = {};
        state.groupTotal = 0;
        state.piEstablishmentTime = Date.now();
        state.psHistoryLogged = false;
        state.psHistoryBuffer = [];
        state.rtHistoryBuffer = [];
        state.psCandidateString = "        ";
        state.psStableSince = 0;

        berHistoryRef.current = [];
        state.graceCounter = GRACE_PERIOD_PACKETS;
      }
    }

    const groupTypeVal = (g2 >> 11) & 0x1F; 
    const tp = !!((g2 >> 10) & 0x01);
    const pty = (g2 >> 5) & 0x1F;
    const typeNum = groupTypeVal >> 1; 
    const versionBit = groupTypeVal & 1; 
    const groupStr = `${typeNum}${versionBit === 0 ? 'A' : 'B'}`;

    state.rawGroupBuffer.push({
      type: groupStr,
      blocks: [g1, g2, g3, g4],
      time: new Date().toLocaleTimeString('fr-FR')
    });

    state.groupCounts[groupStr] = (state.groupCounts[groupStr] || 0) + 1;
    state.groupTotal++;
    if (analyzerActiveRef.current) {
      state.groupSequence.push(groupStr);
      if (state.groupSequence.length > 3000) { 
        state.groupSequence.splice(0, 1000);
      }
    }
    
    state.tp = tp;
    state.pty = pty;

    const decodeAf = (code: number) => (code >= 1 && code <= 204) ? (87.5 + (code * 0.1)).toFixed(1) : null;

    if (groupTypeVal === 0 || groupTypeVal === 1) { 
      const isGroupA = groupTypeVal === 0;
      const ta = !!((g2 >> 4) & 0x01); 
      const ms = !!((g2 >> 3) & 0x01);
      const diBit = (g2 >> 2) & 0x01; 
      const address = g2 & 0x03; 

      state.ta = ta;
      state.ms = ms;

      if (address === 0) {
        state.diDynamicPty = !!diBit;
      }
      if (address === 1) {
        state.diCompressed = !!diBit;
      }
      if (address === 2) {
        state.diArtificialHead = !!diBit;
      }
      if (address === 3) {
        state.diStereo = !!diBit;
      }

      state.psBuffer[address * 2] = String.fromCharCode((g4 >> 8) & 0xFF);
      state.psBuffer[address * 2 + 1] = String.fromCharCode(g4 & 0xFF);

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
            if (!state.afSet.includes(f)) {
              state.afSet.push(f);
            }
          };

          if (isAfHeader(af1)) {
            const headFreq = decodeAf(af2);
            if (headFreq) {
              processMethodAFreq(headFreq);
              state.afListHead = headFreq;
              const headIdx = state.afSet.indexOf(headFreq);
              if (headIdx > 0) {
                state.afSet.splice(headIdx, 1);
                state.afSet.unshift(headFreq);
              }
              const count = Number(af1) - 224;
              state.currentMethodBGroup = headFreq;
              if (!state.afBMap.has(headFreq)) {
                state.afBMap.set(headFreq, { 
                  expected: count, 
                  afs: new Set(), 
                  matchCount: 0, 
                  pairCount: 0 
                });
              } else {
                state.afBMap.get(headFreq)!.expected = count;
              }
            }
          } else {
            if (freq1Str) {
              processMethodAFreq(freq1Str);
            }
            if (freq2Str) {
              processMethodAFreq(freq2Str);
            }
          }

          if (isAfFreq(af1) && isAfFreq(af2)) {
            const f1 = decodeAf(af1);
            const f2 = decodeAf(af2);
            if (f1 && f2 && state.currentMethodBGroup && state.afBMap.has(state.currentMethodBGroup)) {
              const entry = state.afBMap.get(state.currentMethodBGroup)!;
              entry.afs.add(f1);
              entry.afs.add(f2);
              entry.pairCount++;
              if (f1 === state.currentMethodBGroup || f2 === state.currentMethodBGroup) {
                entry.matchCount++;
              }
            }
          }
          
          const validCandidates = Array.from<AfBEntry>(state.afBMap.values()).filter((entry) => {
            return entry.expected > 0 && (entry.afs.size >= entry.expected * 0.75 || (entry.expected <= 2 && entry.afs.size === entry.expected) || (entry.expected > 5 && entry.afs.size > 4));
          });
          
          state.afType = (validCandidates.length > 1 || (validCandidates.length === 1 && validCandidates[0].pairCount > 0 && (validCandidates[0].matchCount / validCandidates[0].pairCount > 0.35))) ? 'B' : 'A';
        }
      }
    } else if (groupTypeVal === 16) {
      state.hasTmc = true;
      if (tmcActiveRef.current && !tmcPausedRef.current) {
        const tuningFlag = (g2 >> 4) & 0x01;
        
        if (tuningFlag === 1) {
          const ltn = (g3 >> 10) & 0x3F;
          const sid = (g3 >> 2) & 0x3F;
          if (ltn > 0 || sid > 0) {
            state.tmcServiceInfo = {
              ...state.tmcServiceInfo,
              ltn: ltn,
              sid: sid,
              afi: !!((g3 >> 9) & 0x01),
              mode: (g3 >> 8) & 0x01
            };
          }
        } else {
          const cc = g2 & 0x07;
          
          // Block 3 system messages decoding
          // Alert-C Standard (Single Message 11-bit): 
          // B3: [Duration(3)][Diversion(1)][Direction(1)][Event(11)]
          const durationCode = (g3 >> 13) & 0x07;
          const diversion = !!((g3 >> 12) & 0x01);
          const direction = !!((g3 >> 11) & 0x01);
          const eventCode = g3 & 0x07FF; 
          
          // Block 4 contains the location code on 16 bits
          const location = g4; 
          
          // Ignores if Event and Loc =0
          if (eventCode === 0 && location === 0) {
            return;
          }

          const now = new Date();
          const durInfo = getDurationLabel(durationCode);
          let expiresTime = "--:--:--";
          if (durInfo.minutes > 0) {
            expiresTime = new Date(now.getTime() + durInfo.minutes * 60000).toLocaleTimeString('fr-FR');
          } else if (durationCode === 7) {
            expiresTime = "Indefinite";
          }

          // Dynamic update of the Emergency and Nature values
          const urgency = getEventUrgency(eventCode);
          const nature = getEventNature(eventCode);

          const existingIndex = state.tmcBuffer.findIndex((m) => {
            return m.locationCode === location && m.eventCode === eventCode && m.direction === direction;
          });

          if (existingIndex !== -1) {
            const existing = state.tmcBuffer[existingIndex];
            existing.receivedTime = now.toLocaleTimeString('fr-FR');
            existing.expiresTime = expiresTime;
            existing.updateCount = (existing.updateCount || 1) + 1;
            existing.urgency = urgency;
            existing.nature = nature;
          } else {
            state.tmcBuffer.unshift({
              id: tmcIdCounter.current++,
              receivedTime: now.toLocaleTimeString('fr-FR'),
              expiresTime: expiresTime,
              isSystem: false,
              label: getEventCategory(eventCode),
              cc: cc,
              eventCode: eventCode,
              locationCode: location,
              extent: 0,
              durationCode: durationCode,
              direction: direction,
              diversion: diversion,
              urgency: urgency, 
              nature: nature,
              durationLabel: durInfo.label,
              updateCount: 1
            });
            if (state.tmcBuffer.length > 500) {
              state.tmcBuffer.pop();
            }
          }
        }
      }
    } else if (groupTypeVal === 28) {
      state.hasEon = true;
      const eonPi = g4.toString(16).toUpperCase().padStart(4, '0');
      if (!state.eonMap.has(eonPi)) {
        state.eonMap.set(eonPi, {
          pi: eonPi, 
          ps: "        ", 
          psBuffer: new Array(8).fill(' '), 
          tp: false, 
          ta: false, 
          pty: 0, 
          pin: "", 
          linkageInfo: "", 
          af: [], 
          mappedFreqs: [], 
          lastUpdate: Date.now()
        });
      }
      const network = state.eonMap.get(eonPi)!;
      network.lastUpdate = Date.now();
      network.tp = !!((g2 >> 4) & 0x01);
      const variant = g2 & 0x0F;
      if (variant >= 0 && variant <= 3) {
        network.psBuffer[variant * 2] = String.fromCharCode((g3 >> 8) & 0xFF);
        network.psBuffer[variant * 2 + 1] = String.fromCharCode(g3 & 0xFF);
        network.ps = renderRdsBuffer(network.psBuffer);
      } else if (variant === 4) {
        const f1 = decodeAf((g3 >> 8) & 0xFF);
        const f2 = decodeAf(g3 & 0xFF);
        if (f1 && !network.af.includes(f1)) {
          network.af.push(f1);
        }
        if (f2 && !network.af.includes(f2)) {
          network.af.push(f2);
        }
        network.af.sort((a,b) => parseFloat(a) - parseFloat(b));
      } else if (variant >= 5 && variant <= 9) {
        const fMain = decodeAf(g3 >> 8);
        const fMapped = decodeAf(g3 & 0xFF);
        if (fMain && fMapped) {
          const mapStr = `${fMain} -> ${fMapped}`;
          if (!network.mappedFreqs.includes(mapStr)) {
            network.mappedFreqs.push(mapStr);
            if (network.mappedFreqs.length > 4) {
              network.mappedFreqs.shift();
            }
          }
        }
      } else if (variant === 12) {
        network.linkageInfo = g3.toString(16).toUpperCase().padStart(4, '0');
      } else if (variant === 13) {
        network.pty = (g3 >> 11) & 0x1F;
        network.ta = !!(g3 & 0x01);
      } else if (variant === 14) {
        if (((g3 >> 11) & 0x1F) !== 0) {
          network.pin = `${(g3 >> 11) & 0x1F}. ${pad((g3 >> 6) & 0x1F)}:${pad(g3 & 0x3F)}`;
        }
      }
    } else if (groupTypeVal === 2 || groupTypeVal === 3) {
      if (groupTypeVal === 2) {
        const variant = (g3 >> 12) & 0x07;
        if (variant === 0) {
          state.ecc = (g3 & 0xFF).toString(16).toUpperCase().padStart(2, '0');
        } else if (variant === 3) {
          state.lic = (g3 & 0xFF).toString(16).toUpperCase().padStart(2, '0');
        }
      }
      if (((g4 >> 11) & 0x1F) !== 0) {
        state.pin = `${(g4 >> 11) & 0x1F}. ${pad((g4 >> 6) & 0x1F)}:${pad(g4 & 0x3F)}`;
      }
    } else if (groupTypeVal === 4 || groupTypeVal === 5) {
      const textAbFlag = !!((g2 >> 4) & 0x01); 
      if (state.abFlag !== textAbFlag) {
        state.abFlag = textAbFlag;
        state.rtPlusTags.forEach((tag) => {
          tag.isCached = true;
        });
        if (textAbFlag) {
          state.rtMask1.fill(false);
        } else {
          state.rtMask0.fill(false);
        }
        (textAbFlag ? state.rtBuffer1 : state.rtBuffer0).fill(' '); 
      }
      const isGroup2A = groupTypeVal === 4;
      const address = g2 & 0x0F; 
      const target = textAbFlag ? state.rtBuffer1 : state.rtBuffer0;
      const mask = textAbFlag ? state.rtMask1 : state.rtMask0;
      if (isGroup2A) {
        const idx = address * 4;
        if (idx < 64) {
          target[idx] = String.fromCharCode((g3 >> 8) & 0xFF); mask[idx] = true;
          target[idx+1] = String.fromCharCode(g3 & 0xFF); mask[idx+1] = true;
          target[idx+2] = String.fromCharCode((g4 >> 8) & 0xFF); mask[idx+2] = true;
          target[idx+3] = String.fromCharCode(g4 & 0xFF); mask[idx+3] = true;
        }
      } else {
        const idx = address * 2;
        if (idx < 32) { 
          target[idx] = String.fromCharCode((g4 >> 8) & 0xFF); mask[idx] = true;
          target[idx+1] = String.fromCharCode(g4 & 0xFF); mask[idx+1] = true;
        }
      }
    } else if (groupTypeVal === 6) {
      state.hasOda = true; 
      const aid = g4.toString(16).toUpperCase().padStart(4, '0');
      const targetGroup = `${(g2 & 0x1F) >> 1}${(g2 & 0x01) ? 'B' : 'A'}`;
      const odaName = ODA_MAP[aid] || "Unknown ODA";
      const newOda = { name: odaName, aid: aid, group: targetGroup };
      state.odaApp = newOda;
      const eIdx = state.odaList.findIndex((o) => o.aid === aid);
      if (eIdx !== -1) {
        state.odaList[eIdx] = newOda;
      } else {
        state.odaList.unshift(newOda);
        if (state.odaList.length > 5) {
          state.odaList.pop();
        }
      }
      if (g4 === 0x4BD7 || g4 === 0x4BD8) {
        state.rtPlusOdaGroup = (g2 & 0x1F);
      }
    } else if (state.rtPlusOdaGroup !== null && groupTypeVal === state.rtPlusOdaGroup) {
      state.hasRtPlus = true;
      const g2Spare = g2 & 0x07;
      state.rtPlusItemToggle = !!((g2 >> 4) & 0x01);
      state.rtPlusItemRunning = !!((g2 >> 3) & 0x01);
      const processTag = (id: number, start: number, len: number) => {
        if (id === 0) {
          return;
        }
        const rtStr = renderRdsBuffer(state.abFlag ? state.rtBuffer1 : state.rtBuffer0); 
        const length = len + 1;
        if (start < rtStr.length) {
          let text = rtStr.substring(start, start + length).replace(/[\x00-\x1F]/g, '').trim();
          if (text.length > 0) {
            state.rtPlusTags.set(id, { 
              contentType: id, 
              start: start, 
              length: len, 
              label: RT_PLUS_LABELS[id] || `TAG ${id}`, 
              text: text, 
              isCached: false, 
              timestamp: Date.now() 
            });
            state.isDirty = true;
          }
        }
      };
      const t1Id = (g2Spare << 3) | ((g3 >> 13) & 0x07);
      if (t1Id !== 0 && ((g3 >> 7) & 0x3F) + ((g3 >> 1) & 0x3F) < 70) {
        processTag(t1Id, (g3 >> 7) & 0x3F, (g3 >> 1) & 0x3F);
      }
      const t2Id = ((g3 & 0x01) << 5) | ((g4 >> 11) & 0x1F);
      if (t2Id !== 0 && ((g4 >> 5) & 0x3F) + (g4 & 0x1F) < 70) {
        processTag(t2Id, (g4 >> 5) & 0x3F, g4 & 0x1F);
      }
      if (state.rtPlusTags.size > 6) {
        const sortedTags = (Array.from(state.rtPlusTags.values()) as Array<RtPlusTag & { timestamp: number }>).sort((a, b) => a.timestamp - b.timestamp);
        while (state.rtPlusTags.size > 6) {
          const oldestKey = sortedTags.shift()?.contentType;
          if (oldestKey !== undefined) {
            state.rtPlusTags.delete(oldestKey);
          }
        }
      }
    } else if (groupTypeVal === 8) {
      const date = convertMjd(((g2 & 0x03) << 15) | ((g3 & 0xFFFE) >> 1));
      if (date) {
        const g4TR = ((g3 & 0x01) << 15) | (g4 >>> 1);
        const h = (g4TR >>> 11) & 0x1F;
        const m = (g4TR >> 5) & 0x3F;
        state.utcTime = `${pad(date.day)}/${pad(date.month)}/${date.year} ${pad(h)}:${pad(m)}`;
        const lDate = new Date(Date.UTC(date.year, date.month - 1, date.day, h, m) + (g4 & 0x1F) * 30 * 60 * 1000 * (((g4 >> 5) & 0x01) === 1 ? -1 : 1));
        state.localTime = `${pad(lDate.getUTCDate())}/${pad(lDate.getUTCMonth() + 1)}/${lDate.getUTCFullYear()} ${pad(lDate.getUTCHours())}:${pad(lDate.getUTCMinutes())}`;
      }
    } else if (groupTypeVal === 20) {
      const address = g2 & 0x01; 
      state.ptynBuffer[address * 4] = String.fromCharCode((g3 >> 8) & 0xFF);
      state.ptynBuffer[address * 4 + 1] = String.fromCharCode(g3 & 0xFF);
      state.ptynBuffer[address * 4 + 2] = String.fromCharCode((g4 >> 8) & 0xFF);
      state.ptynBuffer[address * 4 + 3] = String.fromCharCode(g4 & 0xFF);
    } else if (groupTypeVal === 30) {
      const address = g2 & 0x0F; 
      const idx = address * 4;
      if (idx < 32) {
        state.lpsBuffer[idx] = String.fromCharCode((g3 >> 8) & 0xFF);
        state.lpsBuffer[idx+1] = String.fromCharCode(g3 & 0xFF);
        state.lpsBuffer[idx+2] = String.fromCharCode((g4 >> 8) & 0xFF);
        state.lpsBuffer[idx+3] = String.fromCharCode(g4 & 0xFF);
      }
    }
  }, []); 

  useEffect(() => {
    let animationFrameId: number;
    const loop = () => {
      const state = decoderState.current;
      if (state.isDirty || state.rawGroupBuffer.length > 0) {
        const now = Date.now();
        const currentPs = renderRdsBuffer(state.psBuffer);
        
        if (currentPs !== state.psCandidateString) { 
          state.psCandidateString = currentPs; 
          state.psStableSince = now; 
        }
        
        if (state.piEstablishmentTime > 0 && (now - state.piEstablishmentTime > 3000) && state.currentPi !== "----" && (now - state.psStableSince) >= 1000) {
          const last = state.psHistoryBuffer[0];
          if (currentPs.trim().length > 0 && (!last || last.ps !== currentPs)) { 
            state.psHistoryBuffer.unshift({ 
              time: new Date().toLocaleTimeString(), 
              pi: state.currentPi, 
              ps: currentPs, 
              pty: state.pty 
            }); 
            if (state.psHistoryBuffer.length > 200) {
              state.psHistoryBuffer.pop();
            }
            state.psHistoryLogged = true; 
          }
        }
        
        const cRtBuf = state.abFlag ? state.rtBuffer1 : state.rtBuffer0; 
        const cRtMsk = state.abFlag ? state.rtMask1 : state.rtMask0;
        const termIdx = cRtBuf.indexOf('\r'); 
        let isRtC = termIdx !== -1 ? cRtMsk.slice(0, termIdx).every(Boolean) : cRtMsk.every(Boolean);
        let rawRt = renderRdsBuffer(cRtBuf); 
        if (termIdx !== -1) {
          rawRt = rawRt.substring(0, termIdx);
        }
        if (isRtC) {
          if (rawRt !== state.rtCandidateString) { 
            state.rtCandidateString = rawRt; 
            state.rtStableSince = now; 
          }
          if (now - state.rtStableSince >= 2000) {
            const last = state.rtHistoryBuffer[0];
            if ((!last || last.text !== rawRt) && rawRt.trim().length > 0) { 
              state.rtHistoryBuffer.unshift({ 
                time: new Date().toLocaleTimeString(), 
                text: rawRt 
              }); 
              if (state.rtHistoryBuffer.length > 200) {
                state.rtHistoryBuffer.pop();
              }
            }
          }
        }
        const afBLists: Record<string, string[]> = {}; 
        state.afBMap.forEach((entry, key) => {
          afBLists[key] = Array.from(entry.afs);
        });
        const cBer = berHistoryRef.current.length > 0 ? (berHistoryRef.current.reduce((a, b) => a + b, 0) / berHistoryRef.current.length) * 100 : 0;
        const eonData: Record<string, EonNetwork> = {}; 
        state.eonMap.forEach((val, key) => {
          eonData[key] = val;
        });
        const recent = [...state.rawGroupBuffer]; 
        state.rawGroupBuffer = [];
        
        setRdsData((prev) => ({
          ...prev,
          pi: state.currentPi, 
          pty: state.pty, 
          ptyn: renderRdsBuffer(state.ptynBuffer), 
          tp: state.tp, 
          ta: state.ta, 
          ms: state.ms, 
          stereo: state.diStereo, 
          artificialHead: state.diArtificialHead, 
          compressed: state.diCompressed, 
          dynamicPty: state.diDynamicPty,
          ecc: state.ecc, 
          lic: state.lic, 
          pin: state.pin, 
          localTime: state.localTime, 
          utcTime: state.utcTime, 
          textAbFlag: state.abFlag, 
          rtPlus: (Array.from(state.rtPlusTags.values()) as RtPlusTag[]).sort((a, b) => a.contentType - b.contentType), 
          rtPlusItemRunning: state.rtPlusItemRunning, 
          rtPlusItemToggle: state.rtPlusItemToggle,
          hasOda: state.hasOda, 
          odaApp: state.odaApp, 
          odaList: [...state.odaList], 
          hasRtPlus: state.hasRtPlus, 
          hasEon: state.hasEon, 
          hasTmc: state.hasTmc, 
          eonData: eonData, 
          tmcServiceInfo: { ...state.tmcServiceInfo }, 
          tmcMessages: [...state.tmcBuffer],
          ps: currentPs, 
          longPs: renderRdsBuffer(state.lpsBuffer), 
          rtA: renderRdsBuffer(state.rtBuffer0), 
          rtB: renderRdsBuffer(state.rtBuffer1), 
          af: [...state.afSet], 
          afListHead: state.afListHead, 
          afBLists: afBLists, 
          afType: state.afType, 
          ber: (state.currentPi !== "----" && (now - state.piEstablishmentTime) >= 3000 && berHistoryRef.current.length > 0) ? cBer : -1,
          groupCounts: { ...state.groupCounts }, 
          groupTotal: state.groupTotal, 
          groupSequence: analyzerActiveRef.current ? [...state.groupSequence] : prev.groupSequence, 
          recentGroups: recent, 
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

  const connect = () => {
    if (!serverUrl) {
      return;
    }

    // Packets counter reset when a new connection is established
    packetCountRef.current = 0;
    setPacketCount(0);

    // Forced RDS data reset before the new connection is established
    resetData();
    
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    
    try {
      let inputUrl = serverUrl.trim(); 
      if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(inputUrl)) {
        inputUrl = 'http://' + inputUrl;
      }
      const url = new URL(inputUrl); 
      if (url.protocol === 'https:') {
        url.protocol = 'wss:'; 
      } else if (url.protocol === 'http:') {
        url.protocol = 'ws:'; 
      } else if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
        url.protocol = 'ws:';
      }
      let path = url.pathname; 
      if (path.endsWith('/')) {
        path = path.slice(0, -1); 
      }
      if (!path.endsWith('/rds')) {
        path += '/rds'; 
      }
      url.pathname = path; 
      url.search = ''; 
      url.hash = ''; 
      const finalUrl = url.toString();
      const ws = new WebSocket(finalUrl); 
      wsRef.current = ws; 
      setStatus(ConnectionStatus.CONNECTING); 
      addLog(`Connecting to ${finalUrl}...`, 'info'); 
      ws.binaryType = 'arraybuffer'; 
      lineBufferRef.current = "";
      
      ws.onopen = () => { 
        setStatus(ConnectionStatus.CONNECTED); 
        addLog('Connected successfully.', 'success'); 
        decoderState.current.graceCounter = GRACE_PERIOD_PACKETS; 
        lineBufferRef.current = ""; 
      };
      
      ws.onclose = () => { 
        setStatus(ConnectionStatus.DISCONNECTED); 
        addLog(`Disconnected.`, 'warning'); 
        wsRef.current = null; 
      };
      
      ws.onerror = () => { 
        setStatus(ConnectionStatus.ERROR); 
        addLog('Connection Error', 'error'); 
      };
      
      ws.onmessage = (evt) => {
        let chunk = typeof evt.data === "string" ? evt.data : new TextDecoder("windows-1252").decode(evt.data); 
        
        // RDS data reset when a frequency change is detected
        if (chunk.includes("RESET-------")) {
          resetData();
          lineBufferRef.current = "";
        }

        lineBufferRef.current += chunk; 
        if (chunk.trim().length > 0) {
          setLastRawPacket(chunk.substring(0, 40));
        }
        const hexPattern = /([0-9A-Fa-f]{4}|-{2,4})(?:[\s:,-]*)([0-9A-Fa-f]{4}|-{2,4})(?:[\s:,-]*)([0-9A-Fa-f]{4}|-{2,4})(?:[\s:,-]*)([0-9A-Fa-f]{4}|-{2,4})/;
        while (true) {
          const jS = lineBufferRef.current.indexOf('{'); 
          const jE = lineBufferRef.current.indexOf('}', jS);
          if (jS !== -1 && jE !== -1 && jE > jS) { 
            try { 
              const j = JSON.parse(lineBufferRef.current.substring(jS, jE + 1)); 
              if (typeof j.g1 === 'number') { 
                decodeRdsGroup(j.g1, j.g2, j.g3, j.g4); 
                packetCountRef.current++; 
                if (decoderState.current.currentPi !== "----" && (Date.now() - decoderState.current.piEstablishmentTime) >= 3000) {
                  updateBer(false); 
                }
              } 
            } catch(e) {} 
            lineBufferRef.current = lineBufferRef.current.substring(jE + 1); 
            continue; 
          }
          let m = lineBufferRef.current.match(hexPattern);
          if (m && m.index !== undefined) { 
            const b = [m[1], m[2], m[3], m[4]]; 
            if (b.some((x) => x.includes('-'))) { 
              packetCountRef.current++; 
              if (decoderState.current.currentPi !== "----" && (Date.now() - decoderState.current.piEstablishmentTime) >= 3000) {
                updateBer(true); 
              }
              const s = decoderState.current; 
              s.groupTotal++;
              s.groupCounts["--"] = (s.groupCounts["--"] || 0) + 1; 
              if (analyzerActiveRef.current) { 
                s.groupSequence.push("--"); 
              } 
              decoderState.current.isDirty = true; 
            } else { 
              const g1 = parseInt(b[0], 16); 
              if (!isNaN(g1)) { 
                decodeRdsGroup(g1, parseInt(b[1], 16), parseInt(b[2], 16), parseInt(b[3], 16)); 
                packetCountRef.current++; 
                if (decoderState.current.currentPi !== "----" && (Date.now() - decoderState.current.piEstablishmentTime) >= 3000) {
                  updateBer(false); 
                }
              } 
            } 
            lineBufferRef.current = lineBufferRef.current.substring(m.index + m[0].length); 
          } else {
            break;
          }
        }
        if (lineBufferRef.current.length > 500) { 
          if (decoderState.current.currentPi !== "----" && (Date.now() - decoderState.current.piEstablishmentTime) >= 3000) {
            updateBer(true); 
          }
          lineBufferRef.current = lineBufferRef.current.substring(250); 
          decoderState.current.isDirty = true; 
        }
      };
    } catch (e) { 
      setStatus(ConnectionStatus.ERROR); 
      let msg = e instanceof Error ? e.message : String(e); 
      if (msg.includes("insecure")) { 
        msg = "Insecure connection blocked by browser."; 
        setShowSecurityError(true); 
      } 
      addLog(`Connection Failed: ${msg}`, 'error'); 
    }
  };

  // Auto-connect feature to the server websocket when the "?url=" parameter is present in the indicated link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('url')) {
      connect();
    }
  }, []);

  const disconnect = () => { 
    if (wsRef.current) { 
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close(); 
      wsRef.current = null; 
      setStatus(ConnectionStatus.DISCONNECTED);
      addLog(`Disconnected by user.`, 'warning');
    } 
  };

  const getLogColor = (t: LogEntry['type']) => { 
    switch(t) { 
      case 'success': 
        return 'text-green-400 font-bold'; 
      case 'error': 
        return 'text-red-400 font-bold'; 
      case 'warning': 
        return 'text-yellow-400'; 
      default: 
        return 'text-blue-300'; 
    } 
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-300 font-sans selection:bg-blue-500/30">

      {showSecurityError && (
        <SecurityErrorModal onClose={() => setShowSecurityError(false)} />
      )}
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
            <div className="flex items-center justify-center md:justify-start shrink-0 md:mr-2 select-none cursor-default group">
              <span className="font-black text-2xl text-slate-100 tracking-tighter italic group-hover:text-white transition-colors">RDS</span>
              <span className="font-bold text-2xl text-blue-500 tracking-tighter group-hover:text-blue-400 transition-colors">EXPERT</span>
            </div>
            
            <div className="flex flex-row gap-2 w-full md:w-auto items-stretch">
                <div className="bg-slate-900/50 border border-slate-800 rounded px-2 py-1.5 md:px-3 md:py-2 flex items-center gap-2 md:gap-3 flex-1 md:flex-none shrink-0 text-[10px] md:text-xs font-mono text-slate-500">
                  <span>STATUS</span> 
                  <span className={`font-bold ${status === ConnectionStatus.CONNECTED ? 'text-green-400' : status === ConnectionStatus.ERROR ? 'text-red-400' : 'text-slate-400'}`}>
                    {status}
                  </span>
                </div>
                
                <div className="bg-slate-900/50 border border-slate-800 rounded px-2 py-1.5 md:px-3 md:py-2 flex items-center gap-2 md:gap-3 flex-1 md:flex-none shrink-0 text-[10px] md:text-xs font-mono text-slate-500">
                  <span>PACKETS</span> 
                  <span className="text-slate-200">{packetCount.toLocaleString()}</span>
                </div>
                
                <div className="flex-1 md:flex-none shrink-0">
                  <select 
                    value={rdsStandard} 
                    onChange={(e) => setRdsStandard(e.target.value as 'RDS' | 'RBDS')} 
                    className="w-full bg-slate-900/50 border border-slate-800 text-slate-300 text-[10px] md:text-xs font-mono rounded p-1.5 md:p-2 focus:outline-none focus:border-blue-500 cursor-pointer h-full"
                  >
                    <option value="RDS">RDS MODE</option>
                    <option value="RBDS">RBDS MODE</option>
                  </select>
                </div>
            </div>
            
            <div className="flex items-center gap-2 flex-1">
              <div className="relative group flex-1">
                <input 
                  type="text" 
                  value={serverUrl} 
                  onChange={(e) => setServerUrl(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && connect()} 
                  placeholder="Indicate the webserver URL here (HTTPS only!)" 
                  className="relative w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600 font-mono" 
                />
              </div>
              
              {status === ConnectionStatus.CONNECTED ? ( 
                <button 
                  onClick={disconnect} 
                  className="bg-red-500 hover:bg-red-600 text-white text-sm font-bold px-4 py-2 rounded shadow transition-all whitespace-nowrap"
                >
                  DISCONNECT
                </button> 
              ) : ( 
                <button 
                  onClick={connect} 
                  disabled={status === ConnectionStatus.CONNECTING} 
                  className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {status === ConnectionStatus.CONNECTING ? '...' : 'CONNECT'}
                </button> 
              )}
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
             <span>System Logs</span> 
             <span className="text-[10px] opacity-50">Real-time Events</span>
           </div>
           
           <div className="space-y-1 overflow-y-auto p-4 pt-2 custom-scrollbar flex-1">
             {logs.length === 0 && (
               <div className="text-slate-400 italic p-2 opacity-80">No events recorded.</div>
             )}
             {logs.map((l, i) => ( 
               <div key={i} className={`border-b border-slate-900/50 pb-0.5 last:border-0 flex gap-3 ${getLogColor(l.type)}`}> 
                 <span className="text-slate-500 shrink-0">[{l.time}]</span> 
                 <span>{l.message}</span> 
               </div> 
             ))}
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
          Unfortunately, due to web browser security restrictions, this tool can only be used with HTTPS servers.<br /><br />
          You can bypass this limitation and connect to an HTTP server by using this version hosted by @Bkram:<br />
          <a href="http://rdsexpert.fmdx-webserver.nl:8080/" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">
            http://rdsexpert.fmdx-webserver.nl:8080/
          </a>
        </p>
      </div>
      <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-center">
        <button 
          onClick={onClose} 
          className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded transition-colors uppercase border border-slate-600"
        >
          Close
        </button>
      </div>
    </div>
  </div>
);

export default App;
