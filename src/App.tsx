import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  RdsData, 
  ConnectionStatus, 
  PTY_RDS, 
  PTY_RBDS, 
  PTY_COMBINED,
  RtPlusTag, 
  EonNetwork, 
  RawGroup, 
  TmcMessage, 
  TmcServiceInfo, 
  PsHistoryItem, 
  RtHistoryItem, 
  TdcHistoryItem,
  IhHistoryItem,
  RpHistoryItem,
  ErtHistoryItem,
  LogEntry,
  BandscanEntry
} from './types';
import { 
  INITIAL_RDS_DATA, 
  ODA_MAP, 
  TMC_EVENT_MAP,
  ECC_COUNTRY_MAP,
  LIC_LANGUAGE_MAP
} from './constants';
import { LcdDisplay } from './components/LcdDisplay';
import { InfoGrid } from './components/InfoGrid';
import { GroupAnalyzer } from './components/GroupAnalyzer';
import { TmcViewer } from './components/TmcViewer';
import { HistoryControls, HistoryViewer } from './components/HistoryControls';
import JSZip from 'jszip';

interface AfBEntry {
  expected: number;
  afs: Set<string>;
  matchCount: number;
  pairCount: number;
  regionalAfs: Set<string>;
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
  afMethodAG3s: Set<number>;
  afListHead: string | null;
  afHeaderCount: number | null;
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
  localTimeOffset: string | null;
  utcTime: string;
  pty: number;
  ptynAbFlag: boolean;
  tp: boolean;
  ta: boolean;
  ms: boolean;
  diStereo: boolean;
  diArtificialHead: boolean;
  diCompressed: boolean;
  diDynamicPty: boolean;
  abFlag: boolean;
  rtPlusOdaGroup: number | null;
  rtPlusTags: Map<number, RtPlusTag & { timestamp: number }>; 
  rtPlusItemRunning: boolean;
  rtPlusItemToggle: boolean;
  ertPlusOdaGroup: number | null;
  ertPlusTags: Map<number, RtPlusTag & { timestamp: number }>;
  ertPlusItemToggle: boolean | null;
  ertPlusItemRunning: boolean;
  hasOda: boolean;
  odaApp: { 
    name: string; 
    aid: string; 
    group: string;
    extra?: string;
  } | undefined;
  odaList: { 
    name: string; 
    aid: string; 
    group: string;
    extra?: string;
  }[];
  hasRtPlus: boolean;
  hasEon: boolean;
  hasTmc: boolean;
  hasTdc: boolean;
  hasIh: boolean;
  hasRp: boolean;
  hasErt: boolean;
  tdcSeenDuringGrace: boolean;
  ihSeenDuringGrace: boolean;
  rpSeenDuringGrace: boolean;
  hasEws: boolean;
  ewsId: string;
  eonMap: Map<string, EonNetwork>; 
  tmcServiceInfo: TmcServiceInfo;
  tmcBuffer: TmcMessage[]; 
  tmcProviderBuffer: string[];
  tdcHistoryBuffer: TdcHistoryItem[];
  ihHistoryBuffer: IhHistoryItem[];
  rpHistoryBuffer: RpHistoryItem[];
  ertHistoryBuffer: ErtHistoryItem[];
  ertBuffer: string[];
  ertMask: boolean[];
  ertOdaSeen: boolean;
  ertOdaGroup: string | null;
  ertLastAbFlag: boolean | null;
  rpBuffer: string[];
  rpMessageStarted: boolean;
  rpPagerId: string;
  rpLastAbFlag: number | null;
  tdcBuffer5A: string;
  tdcBuffer5B: string;
  lastTdcIndex5A: number;
  lastTdcIndex5B: number;

  // Raw Recording
  isRawRecording: boolean;
  rawRecordingBuffer: string[];

  // Raw Playback
  isPlayingRaw: boolean;
  rawPlaybackCurrent: number;
  rawPlaybackTotal: number;
  
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
  psValidationBuffer: string;
  ptynCandidateString: string;
  ptynStableSince: number;
  ptynValidationBuffer: string;
  
  psHistoryBuffer: PsHistoryItem[];
  rtHistoryBuffer: RtHistoryItem[];

  // Bandscan
  isRecording: boolean;
  bandscanEntries: BandscanEntry[];
  frequencyStartTime: number;

  // DAB Cross-Referencing tracking
  dabTargetGroup: string | null;
  dabExtraInfo: string;
  lfMfFollows: boolean;
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

const DAB_CHANNELS: Record<string, string> = {
    "174.928": "5A", "176.640": "5B", "178.352": "5C", "180.064": "5D",
    "181.936": "6A", "183.648": "6B", "185.360": "6C", "187.072": "6D",
    "188.928": "7A", "190.640": "7B", "192.352": "7C", "194.064": "7D",
    "195.936": "8A", "197.648": "8B", "199.360": "8C", "201.072": "8D",
    "202.928": "9A", "204.640": "9B", "206.352": "9C", "208.064": "9D",
    "209.936": "10A", "211.648": "10B", "213.360": "10C", "215.072": "10D",
    "216.928": "11A", "218.640": "11B", "220.352": "11C", "222.064": "11D",
    "223.936": "12A", "225.648": "12B", "227.360": "12C", "229.072": "12D",
    "230.784": "13A", "232.496": "13B", "234.208": "13C", "235.776": "13D",
    "237.488": "13E", "239.200": "13F"
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
const renderRdsBuffer = (chars: string[], isErtOrLps: boolean = false, isRt: boolean = false, isPs: boolean = false): string => {
  const bytes = new Uint8Array(
    chars.map((c) => (c ? c.charCodeAt(0) : 0x20))
  );
  
  const hasHighBits = bytes.some((b) => b > 127);
  
  if (hasHighBits) {
    if (isErtOrLps) {
      // For eRT and Long PS, we strictly use UTF-8 if high bits are present.
      // This avoids showing incorrect RDS G2 characters (like 'ń' for 0xB6) during progressive decoding.
      const looseDecoder = new TextDecoder("utf-8", { fatal: false });
      const decoded = looseDecoder.decode(bytes).replace(/\uFFFD/g, ' ');
      return isRt ? decoded : decoded.replace(isPs ? /[\x00-\x1F]/g : /\0/g, isPs ? '-' : ' ');
    }
    try {
      const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
      const decoded = utf8Decoder.decode(bytes);
      return isRt ? decoded : decoded.replace(isPs ? /[\x00-\x1F]/g : /\0/g, isPs ? '-' : ' ');
    } catch (e) {
      // UTF-8 failed. Check if it looks like a valid but incomplete UTF-8 sequence.
      // We look for at least one valid multi-byte character to confirm it's UTF-8.
      let hasValidUtf8 = false;
      for (let i = 0; i < bytes.length; i++) {
        // 2-byte sequence: C2-DF followed by 80-BF
        if (i < bytes.length - 1 && bytes[i] >= 0xC2 && bytes[i] <= 0xDF && bytes[i+1] >= 0x80 && bytes[i+1] <= 0xBF) {
          hasValidUtf8 = true;
          break;
        }
        // 3-byte sequence: E0-EF followed by two 80-BF
        if (i < bytes.length - 2 && bytes[i] >= 0xE0 && bytes[i] <= 0xEF && bytes[i+1] >= 0x80 && bytes[i+1] <= 0xBF && bytes[i+2] >= 0x80 && bytes[i+2] <= 0xBF) {
          hasValidUtf8 = true;
          break;
        }
        // 4-byte sequence: F0-F4 followed by three 80-BF
        if (i < bytes.length - 3 && bytes[i] >= 0xF0 && bytes[i] <= 0xF4 && bytes[i+1] >= 0x80 && bytes[i+1] <= 0xBF && bytes[i+2] >= 0x80 && bytes[i+2] <= 0xBF && bytes[i+3] >= 0x80 && bytes[i+3] <= 0xBF) {
          hasValidUtf8 = true;
          break;
        }
      }

      if (hasValidUtf8) {
        // It's likely UTF-8 but incomplete. Use non-fatal decode and replace errors with spaces.
        const looseDecoder = new TextDecoder("utf-8", { fatal: false });
        const decoded = looseDecoder.decode(bytes).replace(/\uFFFD/g, ' ');
        return isRt ? decoded : decoded.replace(isPs ? /[\x00-\x1F]/g : /\0/g, isPs ? '-' : ' ');
      }
    }
  }
  
  return chars.map((c) => {
    const b = c ? c.charCodeAt(0) : 0x20;
    if (b === 0) {
      if (isRt) return '\0';
      if (isPs) return '-';
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
  const [showSecurityError, setShowSecurityError] = useState<boolean>(false);
  const [showRawMenu, setShowRawMenu] = useState<boolean>(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isDraggingOverRaw, setIsDraggingOverRaw] = useState<boolean>(false);
  const rawPlaybackModeRef = useRef<'normal' | 'instant'>('normal');
  const [analyzerActive, setAnalyzerActive] = useState<boolean>(false);
  const analyzerActiveRef = useRef<boolean>(false);
  const [tmcActive, setTmcActive] = useState<boolean>(false);
  const tmcActiveRef = useRef<boolean>(false);
  const [tmcPaused, setTmcPaused] = useState<boolean>(false);
  const [showTdcHistory, setShowTdcHistory] = useState<boolean>(false);
  const [showIhHistory, setShowIhHistory] = useState<boolean>(false);
  const [showRpHistory, setShowRpHistory] = useState<boolean>(false);
  const [showErtHistory, setShowErtHistory] = useState<boolean>(false);
  const tmcPausedRef = useRef<boolean>(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const packetCountRef = useRef<number>(0);
  const lineBufferRef = useRef<string>(""); 
  const tmcIdCounter = useRef<number>(0);
  const berHistoryRef = useRef<number[]>([]);
  const BER_WINDOW_SIZE = 40; 
  const GRACE_PERIOD_PACKETS = 10; 

  // --- Bandscan Capture Logic ---
  const lastApiDataRef = useRef<any>(null);
  const apiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Decoder State Ref
  const decoderState = useRef<DecoderState>({
    psBuffer: new Array(8).fill('-'),  
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
    afMethodAG3s: new Set<number>(),
    afListHead: null, 
    afHeaderCount: null,
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
    localTimeOffset: null,
    utcTime: "",
    pty: 0,
    ptynAbFlag: false,
    tp: false,
    ta: false,
    ms: false,
    diStereo: false,
    diArtificialHead: false,
    diCompressed: false,
    diDynamicPty: false,
    abFlag: false,
    rtPlusOdaGroup: null,
    rtPlusTags: new Map(),
    rtPlusItemRunning: false,
    rtPlusItemToggle: false,
    ertPlusOdaGroup: null,
    ertPlusTags: new Map(),
    ertPlusItemToggle: null,
    ertPlusItemRunning: false,
    hasOda: false,
    odaApp: undefined,
    odaList: [],
    hasRtPlus: false,
    hasEon: false,
    hasTmc: false,
    hasTdc: false,
    hasIh: false,
    hasRp: false,
    hasErt: false,
    tdcSeenDuringGrace: false,
    ihSeenDuringGrace: false,
    rpSeenDuringGrace: false,
    hasEws: false,
    ewsId: "",
    eonMap: new Map<string, EonNetwork>(), 
    tmcServiceInfo: { 
      ltn: 0, 
      sid: 0, 
      afi: false, 
      mode: 0, 
      providerName: "[Identifying...]" 
    },
    tmcBuffer: [], 
    tmcProviderBuffer: new Array(16).fill(' '),
    tdcHistoryBuffer: [],
    ihHistoryBuffer: [],
    rpHistoryBuffer: [],
    ertHistoryBuffer: [],
    ertBuffer: new Array(128).fill(' '),
    ertMask: new Array(32).fill(false),
    ertOdaSeen: false,
    ertOdaGroup: null,
    ertLastAbFlag: null,
    rpBuffer: [],
    rpMessageStarted: false,
    rpPagerId: "",
    rpLastAbFlag: null,
    tdcBuffer5A: "",
    tdcBuffer5B: "",
    lastTdcIndex5A: -1,
    lastTdcIndex5B: -1,

    // Raw Recording
    isRawRecording: false,
    rawRecordingBuffer: [],

    // Raw Playback
    isPlayingRaw: false,
    rawPlaybackCurrent: 0,
    rawPlaybackTotal: 0,
    
    // Analyzer State
    groupCounts: {},
    groupTotal: 0,
    groupSequence: [],
    
    graceCounter: GRACE_PERIOD_PACKETS,
    isDirty: false,
    
    // Raw Buffer for Hex Viewer
    rawGroupBuffer: [],

    // History Tracking Logic
    piEstablishmentTime: 0, 
    psHistoryLogged: false,
    
    // Stability Check for PS History
    psCandidateString: "        ",
    psStableSince: 0,
    psValidationBuffer: "        ",
    ptynCandidateString: "        ",
    ptynStableSince: 0,
    ptynValidationBuffer: "        ",
    
    psHistoryBuffer: [],
    rtHistoryBuffer: [],

    // Bandscan
    isRecording: false,
    bandscanEntries: [],
    frequencyStartTime: Date.now(),

    // DAB Cross-Referencing tracking
    dabTargetGroup: null,
    dabExtraInfo: "",
    lfMfFollows: false
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

  // --- Bandscan Capture Logic ---
  const generateReportForBandscanSnapshot = (state: DecoderState) => {
    const nowObj = new Date();
    const dateStr = nowObj.toLocaleDateString('fr-FR');
    const timeStr = nowObj.toLocaleTimeString('fr-FR');
    const nowTimestamp = `${dateStr} at ${timeStr}`;
    
    const ptyList = PTY_COMBINED;
    const ptyName = ptyList[state.pty] || `Unknown (${state.pty})`;
    const psHistoryValues = state.psHistoryBuffer.slice(0, 14).reverse().map(h => h.ps.replace(/ /g, '_'));
    const psFormatted = psHistoryValues.length > 0 ? psHistoryValues.join(' / ') : renderRdsBuffer(state.psBuffer, false, false, true).replace(/ /g, '_');
    
    // Frequency formatting helper (consistent with HistoryControls)
    const fmtFreq = (fStr: string) => {
        const f = parseFloat(fStr);
        const mhzBase = Math.floor(f * 10) / 10;
        const khzDecimal = Math.round((f * 1000) % 1000);
        const lastTwoDigits = khzDecimal % 100;
        if (lastTwoDigits === 50) return f.toFixed(2);
        if (lastTwoDigits <= 40) return mhzBase.toFixed(1);
        return (mhzBase + 0.1).toFixed(1);
    };

    // Get signal and location metadata for the TXT header
    const rawFreq = lastApiDataRef.current?.freq || "??.?";
    const freqFormatted = rawFreq !== "??.?" ? fmtFreq(rawFreq) : "??.?";
    const tx = lastApiDataRef.current?.tx || renderRdsBuffer(state.psBuffer, false, false, true).trim() || "Unknown";
    const city = (lastApiDataRef.current?.city || "[Unknown]").split(' | ')[0];
    const dist = lastApiDataRef.current?.dist || "??";
    const power = lastApiDataRef.current?.erp || "?";
    const mod = lastApiDataRef.current?.st ? "Stereo" : "Mono";
    const sigVal = lastApiDataRef.current?.sig || 0;

    // Numerical sort helper for AF list, respecting head if present
    const getSortedAfList = (head: string | null, list: string[]) => {
      const unique = Array.from(new Set(list));
      const headFloat = head ? parseFloat(head) : NaN;
      const others = unique.filter(f => isNaN(headFloat) || parseFloat(f) !== headFloat).sort((a,b) => parseFloat(a) - parseFloat(b));
      return head ? [head, ...others] : unique.sort((a,b) => parseFloat(a) - parseFloat(b));
    };

    // Numerical sort helper for Method A AF list, respecting head and showing repetition counts
    const getSortedAfListWithCounts = (head: string | null, list: string[]) => {
      const counts: Record<string, number> = {};
      for (const freq of list) {
        counts[freq] = (counts[freq] || 0) + 1;
      }
      const unique = Array.from(new Set(list));
      const headFloat = head ? parseFloat(head) : NaN;
      const others = unique.filter(f => isNaN(headFloat) || parseFloat(f) !== headFloat).sort((a,b) => parseFloat(a) - parseFloat(b));

      const formatFreqWithCount = (f: string, isHeadFreq: boolean) => {
        const rawCount = counts[f] || 0;
        const displayCount = isHeadFreq ? rawCount - 1 : rawCount;
        if (displayCount > 1) {
          return `${f} (x${displayCount})`;
        }
        return f;
      };

      if (head) {
        return [formatFreqWithCount(head, true), ...others.map(f => formatFreqWithCount(f, false))];
      } else {
        return unique.sort((a,b) => parseFloat(a) - parseFloat(b)).map(f => formatFreqWithCount(f, false));
      }
    };

    // This report structure matches generateReportContent in HistoryControls.tsx exactly
    let content = `RDSExpert - Text Report\n`;
    content += `Generated on: ${nowTimestamp}\n`;
    content += `---------------------------------------\n`;
    content += `${freqFormatted} MHz -> ${tx} - ${city}\n`;
    content += `${dist} km - ${power} kW\n`;
    content += `Modulation: ${mod}\n`;
    content += `Signal strength: ${sigVal.toFixed(1)} dBf\n`;
    content += `==================================================\n\n`;

    content += `[1] MAIN RDS INFORMATION\n`;
    content += `------------------------\n`;
    content += `PI:           ${state.currentPi}\n`;
    content += `PS:           ${psFormatted}\n`;
    content += `PTY:          ${ptyName} [${state.pty}]\n\n`;
    const protectRdsControls = (t: string) => t.replace(/\n/g, '\uE00A').replace(/\r/g, '\uE00D');
    const ptynRaw = protectRdsControls(renderRdsBuffer(state.ptynBuffer));
    content += `PTYN:         ${ptynRaw.trim() ? ptynRaw : "N/A"}\n`;
    const lpsRaw = protectRdsControls(renderRdsBuffer(state.lpsBuffer));
    content += `Long PS:      ${lpsRaw.trim() ? lpsRaw : "N/A"}\n`;
    
    const piFirstVal = state.currentPi && state.currentPi.length >= 1 ? state.currentPi.charAt(0).toUpperCase() : null;
    const eccCountryVal = (state.ecc && piFirstVal && ECC_COUNTRY_MAP[state.ecc.toUpperCase()]?.[piFirstVal]) || null;
    const licLangVal = (state.lic && LIC_LANGUAGE_MAP[state.lic.toUpperCase()]) || null;
    
    content += `ECC:          ${state.ecc || "N/A"}${eccCountryVal ? ` (${eccCountryVal})` : ""}\n`;
    content += `LIC:          ${state.lic || "N/A"}${licLangVal ? ` (${licLangVal})` : ""}\n\n`;

    content += `[2] FLAGS / DECODER IDENTIFICATION (DI) / CLOCK TIME (CT) / PIN\n`;
    content += `---------------------------------------------------------------\n`;
    content += `Flags:        TP = ${state.tp ? '1' : '0'} | TA = ${state.ta ? '1' : '0'} | MS = ${state.ms ? 'Music' : 'Speech'}\n`;
    // Fix: use diStereo instead of stereo in DecoderState
    content += `DI:           Stereo = ${state.diStereo ? '1' : '0'} | Artificial Head = ${state.diArtificialHead ? '1' : '0'} | Compressed = ${state.diCompressed ? '1' : '0'} | Dynamic PTY = ${state.diDynamicPty ? '1' : '0'}\n`;
    content += `Local Time:   ${state.localTime || "N/A"}\n`;
    content += `UTC Time:     ${state.utcTime || "N/A"}\n`;
    content += `PIN:          ${state.pin || "N/A"}\n\n`;

    content += `[3] RADIOTEXT\n`;
    content += `-------------\n`;
    const rtARaw = protectRdsControls(renderRdsBuffer(state.rtBuffer0, false, true));
    const rtBRaw = protectRdsControls(renderRdsBuffer(state.rtBuffer1, false, true));
    const isRtActive = (state.groupCounts['2A'] || 0) > 0 || (state.groupCounts['2B'] || 0) > 0;

    if (!isRtActive) {
        content += `No Radiotext detected.\n\n`;
    } else if (rtARaw.split('').every(c => c === ' ') && rtBRaw.split('').every(c => c === ' ')) {
        content += `Radiotext enabled but no text decoded.\n\n`;
    } else {
        content += `Line A:  ${rtARaw}\n`;
        content += `Line B:  ${rtBRaw}\n\n`;
    }

    content += `[4] ALTERNATIVE FREQUENCIES (AF)\n`;
    content += `--------------------------------\n`;
    const hasAfB = state.afType === 'B' && state.afBMap.size > 0;
    const hasAfA = state.afType === 'A' && state.afSet.length > 0;
    
    if (hasAfB) {
        content += `Method: ${state.afType}\n`;
        state.afBMap.forEach((entry, head) => {
            const mappedAfs = Array.from(entry.afs || []).map(f => {
                if (entry.regionalAfs && entry.regionalAfs.has(f)) {
                    return `${f} (REG)`;
                }
                return f;
            });
            const sortedSub = getSortedAfList(head, mappedAfs);
            content += `List - ${head}: [${sortedSub.join(' / ')}]\n`;
        });
    } else if (hasAfA) {
        const expected = state.afHeaderCount;
        const decoded = state.afSet.length;
        content += `Method: ${state.afType} (Expected: ${expected !== null ? expected : "?"} | Decoded: ${decoded})\n`;
        const sortedA = getSortedAfListWithCounts(state.afListHead, state.afSet);
        content += `List: [${sortedA.join(' / ')}]\n`;
    } else {
        content += `No AF list found.\n`;
    }
    content += `\n`;

    content += `[5] RADIOTEXT+ TAGS\n`;
    content += `-------------------\n`;
    if (state.rtPlusTags.size > 0) {
        (Array.from(state.rtPlusTags.values()) as Array<RtPlusTag & { timestamp: number }>).sort((a,b) => a.contentType - b.contentType).forEach(tag => {
            content += `  - ${tag.label} (ID ${tag.contentType}): "${tag.text}"\n`;
        });
    } else {
        content += `  No Radiotext+ tags detected.\n`;
    }
    content += `\n`;

    content += `[6] ENHANCED OTHER NETWORKS (EON)\n`;
    content += `---------------------------------\n`;
    if (state.eonMap.size > 0) {
        state.eonMap.forEach((net) => {
            content += `  - PI: ${net.pi} > PS: ${net.ps.replace(/ /g, '_')} (TP = ${net.tp ? '1' : '0'} | TA = ${net.ta ? '1' : '0'} | PTY: ${net.pty})\n`;
            if (net.af.length > 0) content += `    AF Method A: [${net.af.join(' / ')}]\n`;
            if (net.mappedFreqs.length > 0) content += `    Mapped Frequencies: [${net.mappedFreqs.join(' / ')}]\n`;
        });
    } else {
        content += `  No EON data decoded.\n`;
    }
    content += `\n`;

    content += `[7] OPEN DATA APPLICATIONS (ODA)\n`;
    content += `--------------------------------\n`;
    if (state.odaList.length > 0) {
        state.odaList.forEach(oda => {
            content += `  - ${oda.name} [AID: ${oda.aid}] on Group ${oda.group}${oda.extra || ""}\n`;
        });
    } else {
        content += `  No ODA AID detected on Group 3A.\n`;
    }
    content += `\n`;

    // 8. GROUPS COUNTER
    const G_DESC: Record<string, string> = {
      "0A": "PI, PS, AF, PTY, Flags", "0B": "PI, PS, PTY, Flags", "1A": "ECC, LIC, PIN, EWS ID", "1B": "PIN",
      "2A": "Radiotext", "2B": "Radiotext", "3A": "ODA AIDs List", "3B": "ODA",
      "4A": "CT - Time & Date", "4B": "ODA", "5A": "TDC / ODA", "5B": "TDC / ODA",
      "6A": "In House Applications / ODA", "6B": "In House Applications / ODA", "7A": "Radio Paging / ODA", "7B": "Radio Paging / ODA",
      "8A": "TMC / ODA", "8B": "ODA", "9A": "EWS / ODA", "9B": "EWS / ODA",
      "10A": "PTYN", "10B": "ODA", "11A": "ODA", "11B": "ODA", "12A": "ODA", "12B": "ODA",
      "13A": "Enhanced Radio Paging / ODA", "13B": "ODA", "14A": "EON", "14B": "EON TA",
      "15A": "Long PS", "15B": "Fast Basic Tuning"
    };

    content += `[8] GROUPS COUNTER\n`;
    content += `------------------\n`;
    const errorCount = state.groupCounts["--"] || 0;
    const validTotal = Math.max(0, state.groupTotal - errorCount);
    const sortedGroups = Object.keys(state.groupCounts)
      .filter(g => g !== "--")
      .sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (numA !== numB) return numA - numB;
        return a.localeCompare(b);
      });

    if (sortedGroups.length > 0) {
      sortedGroups.forEach(grp => {
        const count = state.groupCounts[grp];
        const percentage = validTotal > 0 ? ((count / validTotal) * 100).toFixed(1) : "0.0";
        const desc = G_DESC[grp] || "Unknown";
        content += `${grp} (${desc}) > ${percentage}%\n`;
      });
    } else {
      content += `No groups detected.\n`;
    }
    content += `\n`;

    // 9. GROUPS SEQUENCE
    content += `[9] GROUPS SEQUENCE (LAST 100 GROUPS DECODED)\n`;
    content += `-------------------------------------------\n`;
    if (state.groupSequence && state.groupSequence.length > 0) {
        const last100 = state.groupSequence.slice(-100);
        for (let i = 0; i < last100.length; i += 20) {
            content += last100.slice(i, i + 20).join(', ') + '\n';
        }
    } else {
        content += `No sequence available.\n`;
    }
    content += `\n`;

    // 10. Radiotext History
    content += `[10] RADIOTEXT HISTORY\n`;
    content += `----------------------\n`;
    [...state.rtHistoryBuffer].reverse().forEach(h => {
        content += `  [${h.time}] ${protectRdsControls(h.text)}\n`;
    });
    content += `\n`;

    // 11. PS, PTY and PTYN History
    content += `[11] PS / PTY / PTYN HISTORY\n`;
    content += `----------------------------\n`;
    
    const psHistory = [...state.psHistoryBuffer].reverse();

    content += `• PS History •\n`;
    if (psHistory.length > 0) {
        psHistory.forEach(h => {
            content += `[${h.time}] ${h.ps.replace(/ /g, '_')}\n`;
        });
    } else {
        content += `No data decoded...\n`;
    }
    content += `\n`;

    content += `• PTY History •\n`;
    if (psHistory.length > 0) {
        let lastPtyValue = "";
        psHistory.forEach(h => {
            const currentPtyValue = ptyList[h.pty] || h.pty.toString();
            if (currentPtyValue !== lastPtyValue) {
                content += `[${h.time}] ${currentPtyValue}\n`;
                lastPtyValue = currentPtyValue;
            }
        });
    } else {
        content += `No data decoded...\n`;
    }
    content += `\n`;

    content += `• PTYN History •\n`;
    const ptynEntries = psHistory.filter(h => h.ptyn && h.ptyn.trim().length > 0);
    if (ptynEntries.length > 0) {
        let lastPtynValue = "";
        ptynEntries.forEach(h => {
            const currentPtyn = h.ptyn;
            if (currentPtyn !== lastPtynValue) {
                content += `[${h.time}] ${currentPtyn}\n`;
                lastPtynValue = currentPtyn;
            }
        });
    } else {
        content += `No data decoded...\n`;
    }
    
    return content;
  };

  const captureBandscanEntry = () => {
    const state = decoderState.current;
    const psRaw = renderRdsBuffer(state.psBuffer, false, false, true).trim();
    // Archive forced: Archive if PI is valid OR if PS has some content (RDS decoded at screen)
    if (state.currentPi === "----" && (psRaw.length === 0 || psRaw === "--------")) return;

    const rdsText = generateReportForBandscanSnapshot(state);

    // Logic for dynamic PS detection and selection of the first valid PS
    const history = state.psHistoryBuffer;
    const firstPsDecoded = history.length > 0 ? history[history.length - 1].ps : renderRdsBuffer(state.psBuffer, false, false, true);
    const isDynamic = history.length > 1;

    const entry: BandscanEntry = {
        freq: lastApiDataRef.current?.freq || "??.?",
        signal: lastApiDataRef.current?.sig || 0,
        stationName: lastApiDataRef.current?.tx || psRaw,
        city: lastApiDataRef.current?.city || "[Unknown]",
        pi: state.currentPi,
        ps: firstPsDecoded,
        isDynamic: isDynamic,
        rdsReport: rdsText,
        ta: state.ta,
        tp: state.tp,
        dist: lastApiDataRef.current?.dist,
        power: lastApiDataRef.current?.erp,
        modulation: lastApiDataRef.current?.st ? "Stereo" : "Mono",
        hasOda: state.hasOda,
        hasRtPlus: state.hasRtPlus,
        hasEon: state.hasEon,
        hasTmc: state.hasTmc,
        hasIh: state.hasIh,
        hasTdc: state.hasTdc,
        hasRp: state.hasRp,
        hasErt: state.hasErt
    };

    state.bandscanEntries.push(entry);
    state.isDirty = true;
    // Note: Do not clear lastApiDataRef here to allow final report generator access if needed
  };

  const fetchBandscanMetadata = async (retryCount = 0) => {
    if (!serverUrl || !decoderState.current.isRecording) return;
    try {
      let inputUrl = serverUrl.trim();
      if (!/^https?:\/\//i.test(inputUrl)) inputUrl = 'http://' + inputUrl;
      const urlObj = new URL(inputUrl);
      urlObj.pathname = urlObj.pathname.replace(/\/rds$/, "").replace(/\/$/, "") + "/api";
      urlObj.search = ''; 
      urlObj.hash = '';
      
      const proxyUrl = `https://cors-proxy.rdsexpert.workers.dev/?url=${encodeURIComponent(urlObj.toString())}`;
      
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const json = await response.json();
        const txValue = json.txInfo?.tx || "";
        
        lastApiDataRef.current = {
            freq: json.freq,
            sig: json.sig,
            tx: txValue || json.ps || "Unknown",
            city: json.txInfo?.city || "[Unknown]",
            dist: json.txInfo?.dist,
            erp: json.txInfo?.erp,
            st: json.st
        };

        // --- Logic retry if TX is empty (Max 9 retries every 5 seconds) ---
        if (decoderState.current.isRecording && !txValue && retryCount < 9) {
            if (apiTimeoutRef.current) clearTimeout(apiTimeoutRef.current);
            apiTimeoutRef.current = setTimeout(() => fetchBandscanMetadata(retryCount + 1), 5000);
        }
      } else {
        (window as any).showRdsApiError?.(response.status.toString());
      }
    } catch(e) {
      (window as any).showRdsApiError?.("Network Error");
    }
  };

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

  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rawPlaybackLinesRef = useRef<string[][]>([]);

  const resetTmc = useCallback(() => {
    decoderState.current.tmcBuffer = [];
    decoderState.current.isDirty = true;
  }, []);
  
  const stopRawPlayback = useCallback(() => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    decoderState.current.isPlayingRaw = false;
    decoderState.current.rawPlaybackCurrent = 0;
    decoderState.current.rawPlaybackTotal = 0;
    rawPlaybackLinesRef.current = [];
    decoderState.current.isDirty = true;
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (decoderState.current.isRecording) {
        e.preventDefault();
        const msg = "A bandscan recording is currently in progress. Are you sure you want to leave and stop the recording?";
        e.returnValue = msg;
        return msg;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const resetData = useCallback(() => {
    const state = decoderState.current;
    
    state.currentPi = "----";
    state.piCandidate = "----";
    state.piCounter = 0;
    state.piEstablishmentTime = 0;
    state.psHistoryLogged = false;

    state.psBuffer.fill('-');
    state.psMask.fill(false);
    state.lpsBuffer.fill(' ');
    state.ptynBuffer.fill(' ');
    state.rtBuffer0.fill(' ');
    state.rtBuffer1.fill(' ');
    state.rtMask0.fill(false);
    state.rtMask1.fill(false);
    state.rtCandidateString = "";
    state.rtStableSince = 0;

    state.afSet = [];
    state.afMethodAG3s.clear();
    state.afListHead = null;
    state.afHeaderCount = null;
    state.afBMap.clear();
    state.currentMethodBGroup = null;
    state.eonMap.clear();
    state.tmcBuffer = [];
    state.tmcProviderBuffer.fill(' ');
    state.rtPlusTags.clear();
    state.tdcHistoryBuffer = [];
    state.ihHistoryBuffer = [];
    state.rpHistoryBuffer = [];
    state.rpBuffer = [];
    state.rpPagerId = "";
    state.rpLastAbFlag = null;
    state.tdcBuffer5A = "";
    state.tdcBuffer5B = "";

    state.rtPlusItemRunning = false;
    state.rtPlusItemToggle = false;
    state.ertPlusItemRunning = false;
    state.ertPlusItemToggle = null;
    state.hasOda = false;
    state.odaApp = undefined;
    state.odaList = [];
    state.hasRtPlus = false;
    state.hasEon = false;
    state.hasTmc = false;
    state.hasTdc = false;
    state.hasIh = false;
    state.hasRp = false;
    state.hasErt = false;
    state.tdcSeenDuringGrace = false;
    state.ihSeenDuringGrace = false;
    state.rpSeenDuringGrace = false;
    state.hasEws = false;
    state.ewsId = "";

    state.ertHistoryBuffer = [];
    state.ertBuffer.fill(' ');
    state.ertMask.fill(false);
    state.ertOdaSeen = false;
    state.ertOdaGroup = null;
    state.ertLastAbFlag = null;
    state.ertPlusTags.clear();

    state.ecc = "";
    state.lic = "";
    state.pin = "";
    state.localTime = "";
    state.localTimeOffset = null;
    state.utcTime = "";
    state.pty = 0;
    state.ptynAbFlag = false;
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
    state.tmcServiceInfo = { ltn: 0, sid: 0, afi: false, mode: 0, providerName: "[Identifying...]" };

    state.groupCounts = {};
    state.groupTotal = 0;
    state.groupSequence = [];

    state.psHistoryBuffer = [];
    state.rtHistoryBuffer = [];
    state.psCandidateString = "        ";
    state.psStableSince = 0;
    state.psValidationBuffer = "        ";
    state.ptynCandidateString = "        ";
    state.ptynStableSince = 0;
    state.ptynValidationBuffer = "        ";

    berHistoryRef.current = [];
    state.graceCounter = GRACE_PERIOD_PACKETS;
    state.rawGroupBuffer = [];
    state.frequencyStartTime = Date.now();

    state.dabTargetGroup = null;
    state.dabExtraInfo = "";
    state.lfMfFollows = false;
    
    state.isDirty = true;
  }, []);

  const decodeRdsGroup = useCallback((g1: number, g2: number, g3: number, g4: number) => {
    const state = decoderState.current;
    state.isDirty = true;

    // Skip decoding if essential blocks are missing
    if (isNaN(g1) || isNaN(g2)) return;

    const piHex = g1.toString(16).toUpperCase().padStart(4, '0');
    
    // Check for TDC/IH grace period expiration
    if (state.currentPi !== "----" && (Date.now() - state.piEstablishmentTime) >= 3000) {
      if (state.tdcSeenDuringGrace) {
        if (!state.odaList.some(oda => oda.group === '5A' || oda.group === '5B')) {
          state.hasTdc = true;
        }
        state.tdcSeenDuringGrace = false;
      }
      if (state.ihSeenDuringGrace) {
        if (!state.odaList.some(oda => oda.group === '6A' || oda.group === '6B')) {
          state.hasIh = true;
        }
        state.ihSeenDuringGrace = false;
      }
      if (state.rpSeenDuringGrace) {
        if (!state.odaList.some(oda => oda.group === '7A')) {
          state.hasRp = true;
        }
        state.rpSeenDuringGrace = false;
      }
    }

    if (piHex === state.piCandidate) {
      state.piCounter++;
    } else {
      state.piCandidate = piHex;
      state.piCounter = 1;
    }

    if (state.piCounter >= 4 || (state.currentPi === "----" && state.piCounter >= 1)) {
      if (state.piCandidate !== state.currentPi) {
        state.currentPi = state.piCandidate;
        
        state.psBuffer.fill('-');
        state.lpsBuffer.fill(' ');
        state.ptynBuffer.fill(' ');
        state.rtBuffer0.fill(' ');
        state.rtBuffer1.fill(' ');
        state.rtMask0.fill(false);
        state.rtMask1.fill(false);
        state.rtCandidateString = "";
        state.rtStableSince = 0;

        state.afSet = [];
        state.afMethodAG3s.clear();
        state.afListHead = null;
        state.afHeaderCount = null;
        state.afBMap.clear();
        state.currentMethodBGroup = null;
        state.eonMap.clear();
        state.tmcBuffer = [];
        state.tmcProviderBuffer.fill(' ');
        state.rtPlusTags.clear();
        state.ertPlusTags.clear();
        state.rtPlusItemRunning = false;
        state.rtPlusItemToggle = false;
        state.hasOda = false;
        state.odaApp = undefined;
        state.odaList = [];
        state.hasRtPlus = false;
        state.hasEon = false;
        state.hasTmc = false;
        state.hasTdc = false;
        state.hasIh = false;
        state.hasRp = false;
        state.hasErt = false;
        state.tdcSeenDuringGrace = false;
        state.ihSeenDuringGrace = false;
        state.rpSeenDuringGrace = false;
        state.hasEws = false;
        state.ewsId = "";
        
        state.ertHistoryBuffer = [];
        state.ertBuffer.fill(' ');
        state.ertMask.fill(false);
        state.ertOdaSeen = false;
        state.ertOdaGroup = null;
        state.ertLastAbFlag = null;

        state.ecc = "";
        state.lic = "";
        state.pin = "";
        state.localTime = "";
        state.localTimeOffset = null;
        state.utcTime = "";
        state.pty = 0;
        state.ptynAbFlag = false;
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
          providerName: "[Identifying...]" 
        };
        
        state.groupSequence = [];
        state.groupCounts = {};
        state.groupTotal = 0;
        state.piEstablishmentTime = Date.now();
        state.psHistoryLogged = false;
        state.psHistoryBuffer = [];
        state.rtHistoryBuffer = [];
        state.tdcHistoryBuffer = [];
        state.rpHistoryBuffer = [];
        state.ertHistoryBuffer = [];
        state.rpBuffer = [];
        state.rpPagerId = "";
        state.rpLastAbFlag = null;
        state.tdcBuffer5A = "";
        state.tdcBuffer5B = "";
        state.psCandidateString = "        ";
        state.psStableSince = 0;
        state.psValidationBuffer = "        ";
        state.ptynCandidateString = "        ";
        state.ptynStableSince = 0;
        state.ptynValidationBuffer = "        ";

        berHistoryRef.current = [];
        state.graceCounter = GRACE_PERIOD_PACKETS;
        
        state.dabTargetGroup = null;
        state.dabExtraInfo = "";

        // --- Trigger API metadata fetch when PI changes during Bandscan recording ---
        if (state.isRecording) {
            if (apiTimeoutRef.current) clearTimeout(apiTimeoutRef.current);
            apiTimeoutRef.current = setTimeout(fetchBandscanMetadata, 2000);
        }
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

    if (state.isRawRecording) {
      const hexLine = [g1, g2, g3, g4].map(b => b.toString(16).toUpperCase().padStart(4, '0')).join(' ');
      state.rawRecordingBuffer.push(hexLine);
    }

    state.groupCounts[groupStr] = (state.groupCounts[groupStr] || 0) + 1;
    state.groupTotal++;
    state.groupSequence.push(groupStr);
    if (state.groupSequence.length > 3000) { 
      state.groupSequence.splice(0, 1000);
    }

    // --- DAB Cross-Referencing Data Decoding (AID 0093) ---
    if (state.dabTargetGroup && groupStr === state.dabTargetGroup) {
      const eid = g4.toString(16).toUpperCase().padStart(4, '0');
      const freqK = g3 * 16;
      const freqM = (freqK / 1000).toFixed(3);
      const channel = DAB_CHANNELS[freqM] || "??";
      const info = ` -> EID = ${eid} / Channel = ${channel}`;
      if (state.dabExtraInfo !== info) {
        state.dabExtraInfo = info;
        const idx = state.odaList.findIndex(o => o.aid === '0093');
        if (idx !== -1) {
          state.odaList[idx].extra = info;
          state.isDirty = true;
        }
      }
    }
    
    state.tp = tp;
    state.pty = pty;

    const decodeAf = (code: number) => (code >= 1 && code <= 204) ? (87.5 + (code * 0.1)).toFixed(1) : null;
    const decodeLfMf = (code: number) => {
      if (code >= 1 && code <= 15) return `${153 + (code - 1) * 9} kHz`;
      if (code >= 16 && code <= 135) return `${531 + (code - 16) * 9} kHz`;
      return null;
    };

    if (groupTypeVal === 0 || groupTypeVal === 1) { 
      const isGroupA = groupTypeVal === 0;
      const ta = !!((g2 >> 4) & 0x01); 
      const ms = !!((g2 >> 3) & 0x01);
      const diBit = (g2 >> 2) & 0x01; 
      const address = g2 & 0x03; 

      state.ta = ta;
      state.ms = ms;

      if (address === 0) {
        /* PS History archival trigger: Synchronized on Segment 0 to capture rapid title changes.
           We check the double validation of the PREVIOUS cycle before starting to overwrite the buffer. */
        const currentPsForArchive = renderRdsBuffer(state.psBuffer, false, false, true);
        const currentPtynForArchive = renderRdsBuffer(state.ptynBuffer);
        const piEstablishedForArchive = state.piEstablishmentTime > 0 && (Date.now() - state.piEstablishmentTime > 1000);
        
        if (piEstablishedForArchive && state.currentPi !== "----") {
            if (currentPsForArchive === state.psValidationBuffer) {
                const last = state.psHistoryBuffer[0];
                const hasContent = !state.psHistoryLogged ? (state.psMask.every(m => m) && currentPsForArchive.trim().length > 0) : true;
                
                if (hasContent) {
                    if (!last || last.ps !== currentPsForArchive || last.pty !== state.pty) { 
                        state.psHistoryBuffer.unshift({ 
                            time: new Date().toLocaleTimeString(), 
                            pi: state.currentPi, 
                            ps: currentPsForArchive, 
                            pty: state.pty,
                            ptyn: currentPtynForArchive
                        }); 
                        if (state.psHistoryBuffer.length > 200) state.psHistoryBuffer.pop();
                        state.psHistoryLogged = true; 
                    } else if (last.ptyn !== currentPtynForArchive && currentPtynForArchive.trim() !== "") {
                        // Same PS/PTY but PTYN just arrived or updated -> Update existing entry to avoid duplicates
                        last.ptyn = currentPtynForArchive;
                    }
                }
            } else {
                state.psValidationBuffer = currentPsForArchive;
                state.ptynValidationBuffer = currentPtynForArchive;
            }
        }
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

      if (!isNaN(g4)) {
        const c1 = (g4 >> 8) & 0xFF;
        const c2 = g4 & 0xFF;
        // Reject PS blocks with control characters
        if (c1 >= 0x20 && c2 >= 0x20) {
          state.psBuffer[address * 2] = String.fromCharCode(c1);
          state.psBuffer[address * 2 + 1] = String.fromCharCode(c2);
          state.psMask[address * 2] = true;
          state.psMask[address * 2 + 1] = true;
        }
      }

      if (isGroupA) {
        if (!isNaN(g3)) {
          const af1 = (g3 >> 8) & 0xFF;
          const af2 = g3 & 0xFF;
          const isAfHeader = (v: number) => v >= 224 && v <= 249;
          const isAfFreq = (v: number) => v >= 1 && v <= 204;

          // Process Method A lists with duplicate preservation
          if (!state.afMethodAG3s.has(g3)) {
            state.afMethodAG3s.add(g3);

            const newAfList: string[] = [];
            let foundHead: string | null = null;
            let foundHeaderCount: number | null = null;
            let lfMfState = false;

            for (const itemG3 of state.afMethodAG3s) {
              const b1 = (itemG3 >> 8) & 0xFF;
              const b2 = itemG3 & 0xFF;

              const handleCode = (code: number) => {
                if (lfMfState) {
                  const amFreq = decodeLfMf(code);
                  if (amFreq) newAfList.push(amFreq);
                  lfMfState = false;
                  return true;
                }
                if (code === 250) {
                  lfMfState = true;
                  return true;
                }
                return false;
              };

              let processedB1 = false;
              if (handleCode(b1)) {
                processedB1 = true;
              } else if (isAfHeader(b1)) {
                foundHeaderCount = b1 - 224;
                const headFreq = decodeAf(b2);
                if (headFreq) {
                  foundHead = headFreq;
                  newAfList.push(headFreq);
                }
                processedB1 = true;
              }

              if (!processedB1) {
                if (isAfFreq(b1)) {
                  const f = decodeAf(b1);
                  if (f) newAfList.push(f);
                }
              }

              if (!isAfHeader(b1)) {
                if (!handleCode(b2)) {
                  if (isAfFreq(b2)) {
                    const f = decodeAf(b2);
                    if (f) newAfList.push(f);
                  }
                }
              }
            }

            state.afSet = newAfList;
            if (foundHead) {
              state.afListHead = foundHead;
              
              if (foundHeaderCount !== null) {
                state.currentMethodBGroup = foundHead;
                const count = foundHeaderCount;
                if (!state.afBMap.has(foundHead)) {
                  state.afBMap.set(foundHead, {
                    expected: count,
                    afs: new Set(),
                    matchCount: 0,
                    pairCount: 0,
                    regionalAfs: new Set()
                  });
                } else {
                  state.afBMap.get(foundHead)!.expected = count;
                }
              }
            }
            if (foundHeaderCount !== null) {
              state.afHeaderCount = foundHeaderCount;
            }
          }

          if (state.currentMethodBGroup && state.afBMap.has(state.currentMethodBGroup)) {
            const entry = state.afBMap.get(state.currentMethodBGroup)!;
            
            // Process af1 for Method B
            let processedAf1 = false;
            if (isAfFreq(af1)) {
              const f1 = decodeAf(af1);
              if (f1) {
                entry.afs.add(f1);
                processedAf1 = true;
              }
            }

            // Process af2 for Method B
            let processedAf2 = false;
            if (isAfFreq(af2)) {
              const f2 = decodeAf(af2);
              if (f2) {
                entry.afs.add(f2);
                processedAf2 = true;
              }
            }

            if (processedAf1 && processedAf2) {
              entry.pairCount++;
              const f1 = decodeAf(af1);
              const f2 = decodeAf(af2);
              if (f1 === state.currentMethodBGroup || f2 === state.currentMethodBGroup) {
                entry.matchCount++;
              }
              if (f1 && f2 && af1 > af2) {
                if (f1 !== state.currentMethodBGroup) {
                  entry.regionalAfs.add(f1);
                }
                if (f2 !== state.currentMethodBGroup) {
                  entry.regionalAfs.add(f2);
                }
              }
            }
          }
          
          const validCandidates = Array.from<AfBEntry>(state.afBMap.values()).filter((entry) => {
            return entry.expected > 0 && (entry.afs.size >= entry.expected * 0.75 || (entry.expected <= 2 && entry.afs.size === entry.expected) || (entry.expected > 5 && entry.afs.size > 4));
          });
          
          state.afType = (validCandidates.length > 1 || (validCandidates.length === 1 && validCandidates[0].pairCount > 0 && (validCandidates[0].matchCount / validCandidates[0].pairCount > 0.35))) ? 'B' : 'A';
        }
      }
    } else if (groupTypeVal === 16 && !state.odaList.some(oda => oda.group === '8A' && oda.aid !== 'CD46')) {
      state.hasTmc = true;
      if (tmcActiveRef.current && !tmcPausedRef.current) {
        const tuningFlag = (g2 >> 4) & 0x01;
        const variant = g2 & 0x0F;
        
        if (tuningFlag === 1) {
          if (variant === 0 || variant === 1) {
            if (!isNaN(g3)) {
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
            }
          } else if (variant >= 4 && variant <= 5) {
            const offset = (variant - 4) * 4;
            if (!isNaN(g3)) {
              state.tmcProviderBuffer[offset] = String.fromCharCode((g3 >> 8) & 0xFF);
              state.tmcProviderBuffer[offset + 1] = String.fromCharCode(g3 & 0xFF);
            }
            if (!isNaN(g4)) {
              state.tmcProviderBuffer[offset + 2] = String.fromCharCode((g4 >> 8) & 0xFF);
              state.tmcProviderBuffer[offset + 3] = String.fromCharCode(g4 & 0xFF);
            }
            const providerName = state.tmcProviderBuffer.join('').trim();
            if (providerName) {
              state.tmcServiceInfo.providerName = providerName;
            }
          }
        } else {
          const cc = g2 & 0x07;
          if (!isNaN(g3) && !isNaN(g4)) {
            const durationCode = (g3 >> 13) & 0x07;
            const diversion = !!((g3 >> 12) & 0x01);
            const direction = !!((g3 >> 11) & 0x01);
            const eventCode = g3 & 0x07FF; 
            const location = g4; 
            
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
      }
    } else if ((groupTypeVal === 10 || groupTypeVal === 11) && !state.odaList.some(oda => oda.group === (groupTypeVal === 10 ? '5A' : '5B'))) {
      // Group 5A or 5B: TDC (Transparent Data Channels)
      const is5A = groupTypeVal === 10;
      const groupLabel = is5A ? '5A' : '5B';
      
      // Check if this group is already assigned to an ODA application
      const isOdaAssigned = state.odaList.some(oda => oda.group === groupLabel);
      
      if (isOdaAssigned) {
        state.hasTdc = false;
        state.tdcSeenDuringGrace = false;
      } else if (state.currentPi !== "----" && (Date.now() - state.piEstablishmentTime) >= 3000) {
        state.hasTdc = true;
        if (!isNaN(g3) && !isNaN(g4)) {
          const bytes = [
            (g3 >> 8) & 0xFF,
            g3 & 0xFF,
            (g4 >> 8) & 0xFF,
            g4 & 0xFF
          ];
          
          let currentBuffer = is5A ? state.tdcBuffer5A : state.tdcBuffer5B;
          let lastIndex = is5A ? state.lastTdcIndex5A : state.lastTdcIndex5B;
          const tdcIndex = g2 & 0x1F;

          // Detection of message start/end via index rollover (e.g. F -> 0)
          // We trigger a new line if the index has wrapped around and we have data
          if (tdcIndex < lastIndex && currentBuffer.trim().length > 0) {
            state.tdcHistoryBuffer.unshift({
              time: new Date().toLocaleTimeString('fr-FR'),
              text: currentBuffer.trim(),
              group: groupLabel,
              channel: lastIndex
            });
            if (state.tdcHistoryBuffer.length > 500) {
              state.tdcHistoryBuffer.pop();
            }
            state.isDirty = true;
            currentBuffer = "";
          }
          
          if (is5A) state.lastTdcIndex5A = tdcIndex;
          else state.lastTdcIndex5B = tdcIndex;

          for (const b of bytes) {
            // Split on NULL (0x00), LF (0x0A), CR (0x0D), ETX (0x03), or EOT (0x04)
            if (b === 0x00 || b === 0x0A || b === 0x0D || b === 0x03 || b === 0x04) {
              let textToSave = currentBuffer.trim();
              if (textToSave.length > 0) {
                if (b === 0x0D) {
                  textToSave += String.fromCharCode(0x0D);
                }
                state.tdcHistoryBuffer.unshift({
                  time: new Date().toLocaleTimeString('fr-FR'),
                  text: textToSave,
                  group: groupLabel,
                  channel: tdcIndex
                });
                if (state.tdcHistoryBuffer.length > 500) {
                  state.tdcHistoryBuffer.pop();
                }
                state.isDirty = true;
              }
              currentBuffer = "";
            } else if ((b >= 0x20 && b <= 0xFF) || b === 0x09) { // Printable RDS or Tab
              const char = decodeRdsByte(b);
              currentBuffer += char;

              // Safety: if buffer gets too long without terminator, push it
              if (currentBuffer.length > 1024) {
                state.tdcHistoryBuffer.unshift({
                  time: new Date().toLocaleTimeString('fr-FR'),
                  text: currentBuffer.trim(),
                  group: groupLabel,
                  channel: tdcIndex
                });
                if (state.tdcHistoryBuffer.length > 500) {
                  state.tdcHistoryBuffer.pop();
                }
                currentBuffer = "";
                state.isDirty = true;
              }
            }
          }
          
          if (is5A) state.tdcBuffer5A = currentBuffer;
          else state.tdcBuffer5B = currentBuffer;
        }
      } else {
        state.tdcSeenDuringGrace = true;
      }
    } else if ((groupTypeVal === 12 || groupTypeVal === 13) && !state.odaList.some(oda => oda.group === (groupTypeVal === 12 ? '6A' : '6B'))) {
      // Group 6A or 6B: IH (In House Applications)
      const is6A = groupTypeVal === 12;
      const groupLabel = is6A ? '6A' : '6B';
      
      // Check if this group is already assigned to an ODA application
      const isOdaAssigned = state.odaList.some(oda => oda.group === groupLabel);
      
      if (isOdaAssigned) {
        state.hasIh = false;
        state.ihSeenDuringGrace = false;
      } else if (state.currentPi !== "----" && (Date.now() - state.piEstablishmentTime) >= 3000) {
        state.hasIh = true;
        if (!isNaN(g3) && !isNaN(g4)) {
          const bytes = [
            (g3 >> 8) & 0xFF,
            g3 & 0xFF,
            (g4 >> 8) & 0xFF,
            g4 & 0xFF
          ];
          
          // Formats: Decimal and Hexadecimal
          const hexStr = bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
          const decStr = bytes.map(b => b.toString().padStart(3, '0')).join(' ');
          const asciiStr = bytes.map(b => (b >= 0x20 && b <= 0xFF) ? decodeRdsByte(b) : '.').join('');
          
          const combinedText = `HEX: ${hexStr} | DEC: ${decStr} | ASC: ${asciiStr}`;
          
          state.ihHistoryBuffer.unshift({
            time: new Date().toLocaleTimeString('fr-FR'),
            text: combinedText,
            group: groupLabel,
            channel: g2 & 0x1F
          });
          
          if (state.ihHistoryBuffer.length > 500) {
            state.ihHistoryBuffer.pop();
          }
          state.isDirty = true;
        }
      } else {
        state.ihSeenDuringGrace = true;
      }
    } else if (groupTypeVal === 14 && !state.odaList.some(oda => oda.group === '7A')) {
      // Group 7A: RP (Radio Paging)
      const groupLabel = '7A';
      
      // Check if this group is already assigned to an ODA application
      const isOdaAssigned = state.odaList.some(oda => oda.group === groupLabel);
      
      if (isOdaAssigned) {
        state.hasRp = false;
        state.rpSeenDuringGrace = false;
      } else if (state.currentPi !== "----" && (Date.now() - state.piEstablishmentTime) >= 3000) {
        state.hasRp = true;
        if (!isNaN(g3) && !isNaN(g4)) {
          const abFlag = (g2 >> 4) & 0x01;
          const addr = g2 & 0x0F;
          
          // Detect new call
          if (state.rpLastAbFlag !== null && state.rpLastAbFlag !== abFlag) {
            state.rpBuffer = [];
            state.rpMessageStarted = false;
            state.rpPagerId = "";
          }
          state.rpLastAbFlag = abFlag;

          let pagingType: 'Numeric' | 'Alphanumeric' | 'Unknown' = 'Unknown';
          let pagerId = "";
          let fullText = "";

          if (addr >= 2 && addr <= 6) {
            pagingType = 'Numeric';
          } else if (addr >= 8 && addr <= 15) {
            pagingType = 'Alphanumeric';
            if (addr === 8) {
              const y1 = (g3 >> 12) & 0x0F;
              const y2 = (g3 >> 8) & 0x0F;
              const z1 = (g3 >> 4) & 0x0F;
              const z2 = g3 & 0x0F;
              const z3 = (g4 >> 12) & 0x0F;
              const z4 = (g4 >> 8) & 0x0F;
              pagerId = `${y1}${y2}${z1}${z2}${z3}${z4}`;
              state.rpPagerId = pagerId;
              state.rpBuffer = [];
              state.rpMessageStarted = false;
            } else if (addr >= 9 && addr <= 14) {
              const bytes = [
                (g3 >> 8) & 0xFF,
                g3 & 0xFF,
                (g4 >> 8) & 0xFF,
                g4 & 0xFF
              ];
              
              for (const b of bytes) {
                const charCode = b & 0x7F;
                // Control characters 0x0F (SI) or 0x15 (NAK) often mark the start of alphanumeric text
                if (charCode === 0x0F || charCode === 0x15) {
                  state.rpMessageStarted = true;
                  continue;
                }
                
                if (state.rpMessageStarted) {
                  if (charCode >= 0x20 && charCode <= 0x7E) {
                    state.rpBuffer.push(String.fromCharCode(charCode));
                  }
                }
              }
            } else if (addr === 15) {
              fullText = state.rpBuffer.join('');
            }
          }

          const bytes = [
            (g3 >> 8) & 0xFF,
            g3 & 0xFF,
            (g4 >> 8) & 0xFF,
            g4 & 0xFF
          ];
          
          const hexStr = bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
          const asciiStr = bytes.map(b => (b >= 0x20 && b <= 0xFF) ? decodeRdsByte(b) : '.').join('');
          
          let combinedText = `FLAG: ${abFlag} | ADDR: ${addr.toString(2).padStart(4, '0')} | HEX: ${hexStr} | ASC: ${asciiStr}`;
          if (fullText) {
            combinedText = `[MSG] ${fullText}`;
          } else if (pagingType === 'Alphanumeric' && addr === 8) {
            combinedText = `[PAGER ID] ${state.rpPagerId}`;
          }

          state.rpHistoryBuffer.unshift({
            time: new Date().toLocaleTimeString('fr-FR'),
            text: combinedText,
            group: '7A',
            address: addr,
            abFlag: abFlag,
            type: pagingType,
            pagerId: state.rpPagerId
          });
          
          if (state.rpHistoryBuffer.length > 500) {
            state.rpHistoryBuffer.pop();
          }
          state.isDirty = true;
        }
      } else {
        state.rpSeenDuringGrace = true;
      }
    } else if (groupTypeVal === 28) {
      if (!isNaN(g4)) {
        state.hasEon = true;
        const eonPi = g4.toString(16).toUpperCase().padStart(4, '0');
        if (!state.eonMap.has(eonPi)) {
          state.eonMap.set(eonPi, {
            pi: eonPi, 
            ps: "--------", 
            psBuffer: new Array(8).fill('-'), 
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
          if (!isNaN(g3)) {
            const c1 = (g3 >> 8) & 0xFF;
            const c2 = g3 & 0xFF;
            if (c1 >= 0x20 && c2 >= 0x20) {
              network.psBuffer[variant * 2] = String.fromCharCode(c1);
              network.psBuffer[variant * 2 + 1] = String.fromCharCode(c2);
              network.ps = renderRdsBuffer(network.psBuffer);
            }
          }
        } else if (variant === 4) {
          if (!isNaN(g3)) {
            const f1 = decodeAf((g3 >> 8) & 0xFF);
            const f2 = decodeAf(g3 & 0xFF);
            if (f1 && !network.af.includes(f1)) {
              network.af.push(f1);
            }
            if (f2 && !network.af.includes(f2)) {
              network.af.push(f2);
            }
            network.af.sort((a,b) => parseFloat(a) - parseFloat(b));
          }
        } else if (variant >= 5 && variant <= 9) {
          if (!isNaN(g3)) {
            const fMain = decodeAf(g3 >> 8);
            const fMapped = decodeAf(g3 & 0xFF);
            if (fMain && fMapped) {
              const mapStr = `${fMain} -> ${fMapped}`;
              if (!network.mappedFreqs.includes(mapStr)) {
                network.mappedFreqs.push(mapStr);
                if (network.mappedFreqs.length > 10) {
                  network.mappedFreqs.shift();
                }
              }
            }
          }
        } else if (variant === 12) {
          if (!isNaN(g3)) {
            network.linkageInfo = g3.toString(16).toUpperCase().padStart(4, '0');
          }
        } else if (variant === 13) {
          if (!isNaN(g3)) {
            network.pty = (g3 >> 11) & 0x1F;
            network.ta = !!(g3 & 0x01);
          }
        } else if (variant === 14) {
          if (!isNaN(g3)) {
            if (g3 !== 0) {
              network.pin = `${(g3 >> 11) & 0x1F}. ${pad((g3 >> 6) & 0x1F)}:${pad(g3 & 0x3F)}`;
            }
          }
        }
      }
    } else if (groupTypeVal === 2 || groupTypeVal === 3) {
      if (groupTypeVal === 2) {
        if (!isNaN(g3)) {
          const variant = (g3 >> 12) & 0x07;
          if (variant === 0) {
            state.ecc = (g3 & 0xFF).toString(16).toUpperCase().padStart(2, '0');
          } else if (variant === 3) {
            state.lic = (g3 & 0xFF).toString(16).toUpperCase().padStart(2, '0');
          } else if (variant === 7) {
            state.hasEws = true;
            state.ewsId = (g3 & 0xFF).toString(16).toUpperCase().padStart(2, '0');
          }
        }
      }
      if (!isNaN(g4)) {
        if (g4 !== 0) {
          state.pin = `${(g4 >> 11) & 0x1F}. ${pad((g4 >> 6) & 0x1F)}:${pad(g4 & 0x3F)}`;
        }
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
          if (!isNaN(g3)) {
            target[idx] = String.fromCharCode((g3 >> 8) & 0xFF); mask[idx] = true;
            target[idx+1] = String.fromCharCode(g3 & 0xFF); mask[idx+1] = true;
          }
          if (!isNaN(g4)) {
            target[idx+2] = String.fromCharCode((g4 >> 8) & 0xFF); mask[idx+2] = true;
            target[idx+3] = String.fromCharCode(g4 & 0xFF); mask[idx+3] = true;
          }
        }
      } else {
        const idx = address * 2;
        if (idx < 32) { 
          if (!isNaN(g4)) {
            target[idx] = String.fromCharCode((g4 >> 8) & 0xFF); mask[idx] = true;
            target[idx+1] = String.fromCharCode(g4 & 0xFF); mask[idx+1] = true;
          }
        }
      }
    } else if (groupTypeVal === 6) {
      state.hasOda = true; 
      if (!isNaN(g4)) {
        const aid = g4.toString(16).toUpperCase().padStart(4, '0');
        const targetGroup = `${(g2 & 0x1F) >> 1}${(g2 & 0x01) ? 'B' : 'A'}`;
        const odaName = ODA_MAP[aid] || "Unknown ODA!";

        // If an ODA is assigned to a TDC or IH group, turn off the corresponding indicator
        if (targetGroup === '5A' || targetGroup === '5B') {
          state.hasTdc = false;
          state.tdcSeenDuringGrace = false;
        } else if (targetGroup === '6A' || targetGroup === '6B') {
          state.hasIh = false;
          state.ihSeenDuringGrace = false;
        } else if (targetGroup === '7A') {
          state.hasRp = false;
          state.rpSeenDuringGrace = false;
        } else if (targetGroup === '8A' && aid !== 'CD46') {
          state.hasTmc = false;
        }

        if (aid === '0093') {
            state.dabTargetGroup = targetGroup;
        }

        const newOda = { name: odaName, aid: aid, group: targetGroup, extra: (aid === '0093' ? state.dabExtraInfo : undefined) };
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
        if (g4 === 0x4BD7) {
          state.rtPlusOdaGroup = (g2 & 0x1F);
          if ((state.rtPlusOdaGroup & 1) !== 0) state.hasRtPlus = false;
        }
        if (g4 === 0x4BD8) {
          state.ertPlusOdaGroup = (g2 & 0x1F);
        }
        if (aid === '6552') {
          state.ertOdaSeen = true;
          state.ertOdaGroup = targetGroup;
        }
      }
    } else if (state.ertOdaSeen && state.ertOdaGroup && groupStr === state.ertOdaGroup) {
      state.hasErt = true;
      const archiveErt = () => {
        // Find the segment containing 0x0D (CR) to determine the logical end of the message
        let endCharIdx = -1;
        for (let i = 0; i < 128; i++) {
          if (state.ertBuffer[i] === '\x0D') {
            endCharIdx = i;
            break;
          }
        }
        
        if (endCharIdx === -1) return; // No end marker yet, message is definitely incomplete
        
        const endSegment = Math.floor(endCharIdx / 4);
        
        // Verification: Ensure all segments from 0 to endSegment have been received
        // This prevents archiving incomplete messages when segments arrive out of order
        for (let i = 0; i <= endSegment; i++) {
          if (!state.ertMask[i]) return; 
        }

        let fullMsg = renderRdsBuffer(state.ertBuffer, true).split('\x0D')[0].trim();
        if (endCharIdx !== -1) {
          fullMsg += '\x0D';
        }
        if (fullMsg.length > 0) {
          const last = state.ertHistoryBuffer[0];
          if (!last || last.text !== fullMsg) {
            // Re-resolve tags from the final message to ensure completeness (e.g. Alok instead of Alo)
            const resolvedTags = Array.from(state.ertPlusTags.values()).map((tag: any) => {
              const length = tag.length + 1;
              let text = "";
              if (tag.start < fullMsg.length) {
                text = fullMsg.substring(tag.start, tag.start + length).replace(/[\x00-\x1F]/g, '').trim();
              }
              return { ...tag, text };
            }).filter(t => t.text.length > 0);

            state.ertHistoryBuffer.unshift({
              time: new Date().toLocaleTimeString('fr-FR'),
              text: fullMsg,
              group: groupStr,
              tags: resolvedTags
            });
            if (state.ertHistoryBuffer.length > 500) state.ertHistoryBuffer.pop();
            state.isDirty = true;
          }
        }
      };
      if (!isNaN(g3) && !isNaN(g4)) {
        // Use Group 2A structure for eRT (4-bit address, bit 4 is A/B flag)
        const abFlag = !!((g2 >> 4) & 0x01);
        const address = g2 & 0x0F;
        

          if (state.ertLastAbFlag !== null && state.ertLastAbFlag !== abFlag) {
            archiveErt();
            state.ertBuffer.fill(' ');
            state.ertMask.fill(false);
            state.ertPlusTags.clear();
          }
          state.ertLastAbFlag = abFlag;

          // Reset buffer and tags if we see a new message start (address 0) 
          // while the buffer still contains the end marker of a previous message.
          // This handles stations that don't toggle the A/B flag correctly.
          if (address === 0 && state.ertBuffer.includes('\x0D')) {
            state.ertBuffer.fill(' ');
            state.ertMask.fill(false);
            state.ertPlusTags.clear();
          }

          const bytes = [
            (g3 >> 8) & 0xFF,
            g3 & 0xFF,
            (g4 >> 8) & 0xFF,
            g4 & 0xFF
          ];

          let segmentText = "";
          let endReached = false;
          for (const b of bytes) {
            segmentText += String.fromCharCode(b);
            if (b === 0x0D) {
              endReached = true;
              break;
            }
          }

          const startIdx = address * 4;
          for (let i = 0; i < segmentText.length; i++) {
            if (startIdx + i < 128) {
              state.ertBuffer[startIdx + i] = segmentText[i];
            }
          }
          state.ertMask[address] = true;

          if (endReached) {
            archiveErt();
          }
      }
    } else if (state.rtPlusOdaGroup !== null && groupTypeVal === state.rtPlusOdaGroup && (groupTypeVal & 1) === 0) {
      state.hasRtPlus = true;
      const g2Spare = g2 & 0x07;
      const rtPlusItemToggle = !!((g2 >> 4) & 0x01);
      state.rtPlusItemToggle = rtPlusItemToggle;
      
      state.rtPlusItemRunning = !!((g2 >> 3) & 0x01);
      const processTag = (id: number, start: number, len: number) => {
        if (id === 0) {
          return;
        }
        const existing = state.rtPlusTags.get(id);
        state.rtPlusTags.set(id, { 
          contentType: id, 
          start: start, 
          length: len, 
          label: RT_PLUS_LABELS[id] || `TAG ${id}`, 
          text: existing ? existing.text : "", 
          isCached: false, 
          timestamp: Date.now() 
        });
        state.isDirty = true;
      };
      if (!isNaN(g3)) {
        const t1Id = (g2Spare << 3) | ((g3 >> 13) & 0x07);
        if (t1Id !== 0 && ((g3 >> 7) & 0x3F) + ((g3 >> 1) & 0x3F) < 70) {
          processTag(t1Id, (g3 >> 7) & 0x3F, (g3 >> 1) & 0x3F);
        }
        if (!isNaN(g4)) {
          const t2Id = ((g3 & 0x01) << 5) | ((g4 >> 11) & 0x1F);
          if (t2Id !== 0 && ((g4 >> 5) & 0x3F) + (g4 & 0x1F) < 70) {
            processTag(t2Id, (g4 >> 5) & 0x3F, g4 & 0x1F);
          }
        }
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
    } else if (state.ertPlusOdaGroup !== null && groupTypeVal === state.ertPlusOdaGroup && (groupTypeVal & 1) === 0) {
      const ertPlusItemToggle = !!((g2 >> 4) & 0x01);
      state.ertPlusItemRunning = !!((g2 >> 3) & 0x01);
      
      // Clear tags if the Item Toggle Bit changes, as per eRT+ specification
      if (state.ertPlusItemToggle !== null && state.ertPlusItemToggle !== ertPlusItemToggle) {
        state.ertPlusTags.clear();
      }
      state.ertPlusItemToggle = ertPlusItemToggle;
      
      const g2Spare = g2 & 0x07;
      const processErtTag = (id: number, start: number, len: number) => {
        if (id === 0) return;
        const existing = state.ertPlusTags.get(id);
        state.ertPlusTags.set(id, {
          contentType: id,
          start: start,
          length: len,
          label: RT_PLUS_LABELS[id] || `TAG ${id}`,
          text: existing ? existing.text : "",
          isCached: false,
          timestamp: Date.now()
        });
        state.isDirty = true;
      };
      if (!isNaN(g3)) {
        const t1Id = (g2Spare << 3) | ((g3 >> 13) & 0x07);
        if (t1Id !== 0 && ((g3 >> 7) & 0x3F) + ((g3 >> 1) & 0x3F) < 128) {
          processErtTag(t1Id, (g3 >> 7) & 0x3F, (g3 >> 1) & 0x3F);
        }
        if (!isNaN(g4)) {
          const t2Id = ((g3 & 0x01) << 5) | ((g4 >> 11) & 0x1F);
          if (t2Id !== 0 && ((g4 >> 5) & 0x3F) + (g4 & 0x1F) < 128) {
            processErtTag(t2Id, (g4 >> 5) & 0x3F, g4 & 0x1F);
          }
        }
      }
      if (state.ertPlusTags.size > 10) {
        const sortedTags = (Array.from(state.ertPlusTags.values()) as Array<RtPlusTag & { timestamp: number }>).sort((a, b) => a.timestamp - b.timestamp);
        while (state.ertPlusTags.size > 10) {
          const oldestKey = sortedTags.shift()?.contentType;
          if (oldestKey !== undefined) state.ertPlusTags.delete(oldestKey);
        }
      }
    } else if (groupTypeVal === 8) {
      if (!isNaN(g2) && !isNaN(g3)) {
        const date = convertMjd(((g2 & 0x03) << 15) | ((g3 & 0xFFFE) >> 1));
        if (date) {
          if (!isNaN(g4)) {
            const g4TR = ((g3 & 0x01) << 15) | (g4 >>> 1);
            const h = (g4TR >>> 11) & 0x1F;
            const m = (g4TR >> 5) & 0x3F;
            state.utcTime = `${pad(date.day)}/${pad(date.month)}/${date.year} ${pad(h)}:${pad(m)}`;
            const offsetHalfHours = g4 & 0x1F;
            const isNegative = ((g4 >> 5) & 0x01) === 1;
            if (offsetHalfHours <= 24) {
              const offsetTotalMinutes = offsetHalfHours * 30;
              const offsetHours = Math.floor(offsetTotalMinutes / 60);
              const offsetMinutes = offsetTotalMinutes % 60;
              state.localTimeOffset = `Time Offset: ${isNegative ? '-' : '+'}${offsetHours}:${pad(offsetMinutes)}`;
              const lDate = new Date(Date.UTC(date.year, date.month - 1, date.day, h, m) + offsetTotalMinutes * 60 * 1000 * (isNegative ? -1 : 1));
              state.localTime = `${pad(lDate.getUTCDate())}/${pad(lDate.getUTCMonth() + 1)}/${lDate.getUTCFullYear()} ${pad(lDate.getUTCHours())}:${pad(lDate.getUTCMinutes())}`;
            } else {
              state.localTimeOffset = null;
              state.localTime = state.utcTime;
            }
          }
        }
      }
    } else if (groupTypeVal === 20) {
      const newFlag = !!((g2 >> 4) & 0x01);
      if (state.ptynAbFlag !== newFlag) {
        state.ptynAbFlag = newFlag;
        state.ptynBuffer.fill(' '); // Force reset of PTYN value specifically when flag changes
      }
      const address = g2 & 0x01; 
      if (!isNaN(g3)) {
        state.ptynBuffer[address * 4] = String.fromCharCode((g3 >> 8) & 0xFF);
        state.ptynBuffer[address * 4 + 1] = String.fromCharCode(g3 & 0xFF);
      }
      if (!isNaN(g4)) {
        state.ptynBuffer[address * 4 + 2] = String.fromCharCode((g4 >> 8) & 0xFF);
        state.ptynBuffer[address * 4 + 3] = String.fromCharCode(g4 & 0xFF);
      }
    } else if (groupTypeVal === 30) {
      const address = g2 & 0x0F; 
      const idx = address * 4;
      if (idx < 32) {
        if (!isNaN(g3)) {
          state.lpsBuffer[idx] = String.fromCharCode((g3 >> 8) & 0xFF);
          state.lpsBuffer[idx+1] = String.fromCharCode(g3 & 0xFF);
        }
        if (!isNaN(g4)) {
          state.lpsBuffer[idx+2] = String.fromCharCode((g4 >> 8) & 0xFF);
          state.lpsBuffer[idx+3] = String.fromCharCode(g4 & 0xFF);
        }
      }
    }
  }, [fetchBandscanMetadata]); 

  useEffect(() => {
    let animationFrameId: number;
    const loop = () => {
      const state = decoderState.current;
      if (state.isDirty || state.rawGroupBuffer.length > 0) {
        const now = Date.now();
        const currentPs = renderRdsBuffer(state.psBuffer, false, false, true);
        const currentPtyn = renderRdsBuffer(state.ptynBuffer);
        const activeRtStr = state.abFlag ? renderRdsBuffer(state.rtBuffer1, false, true) : renderRdsBuffer(state.rtBuffer0, false, true);
        
        state.rtPlusTags.forEach(tag => {
          if (!tag.isCached) {
            if (tag.start < activeRtStr.length) {
              const newText = activeRtStr.substring(tag.start, tag.start + tag.length + 1).replace(/[\x00-\x1F]/g, '').trim();
              if (newText.length > 0) {
                tag.text = newText;
              }
            }
          }
        });

        const activeErtStr = renderRdsBuffer(state.ertBuffer, false, true);
        state.ertPlusTags.forEach(tag => {
          if (!tag.isCached) {
            if (tag.start < activeErtStr.length) {
              const newText = activeErtStr.substring(tag.start, tag.start + tag.length + 1).replace(/[\x00-\x1F]/g, '').trim();
              if (newText.length > 0) {
                tag.text = newText;
              }
            }
          }
        });
        
        if (currentPs !== state.psCandidateString) { 
          state.psCandidateString = currentPs; 
          state.psStableSince = now; 
        }

        if (currentPtyn !== state.ptynCandidateString) {
          state.ptynCandidateString = currentPtyn;
          state.ptynStableSince = now;
        }
        
        /* PS History handling removed from useEffect to use Segment 0 triggering in decodeRdsGroup.
           This ensures capture of fast changes while maintaining double validation integrity. */
        
        const cRtBuf = state.abFlag ? state.rtBuffer1 : state.rtBuffer0; 
        const cRtMsk = state.abFlag ? state.rtMask1 : state.rtMask0;
        const termIdx = cRtBuf.indexOf('\r'); 
        let isRtC = termIdx !== -1 ? cRtMsk.slice(0, termIdx).every(Boolean) : cRtMsk.every(Boolean);
        let rawRt = renderRdsBuffer(cRtBuf, false, true); 
        if (termIdx !== -1) {
          // Include the terminator character in the history for technical code display
          rawRt = rawRt.substring(0, termIdx + 1);
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
          afBLists[key] = Array.from(entry.afs || []).map(f => {
            if (entry.regionalAfs && entry.regionalAfs.has(f)) {
              return `${f} [REG]`;
            }
            return f;
          });
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
          ptynAbFlag: state.ptynAbFlag,
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
          localTimeOffset: state.localTimeOffset,
          utcTime: state.utcTime, 
          textAbFlag: state.abFlag, 
          rtPlus: (Array.from(state.rtPlusTags.values()) as RtPlusTag[]).filter(t => t.text && t.text.length > 0).sort((a, b) => a.contentType - b.contentType), 
          rtPlusItemRunning: state.rtPlusItemRunning, 
          rtPlusItemToggle: state.rtPlusItemToggle,
          hasOda: state.hasOda, 
          odaApp: state.odaApp, 
          odaList: [...state.odaList], 
          hasRtPlus: state.hasRtPlus, 
          hasEon: state.hasEon, 
          hasTmc: state.hasTmc, 
          hasTdc: state.hasTdc,
          hasIh: state.hasIh,
          hasRp: state.hasRp,
          hasErt: state.hasErt,
          hasEws: state.hasEws,
          ewsId: state.ewsId,
          eonData: eonData, 
          tmcServiceInfo: { ...state.tmcServiceInfo }, 
          tmcMessages: [...state.tmcBuffer],
          tdcHistory: [...state.tdcHistoryBuffer],
          ihHistory: [...state.ihHistoryBuffer],
          rpHistory: [...state.rpHistoryBuffer],
          ertHistory: [...state.ertHistoryBuffer],
          ertPlusTags: (Array.from(state.ertPlusTags.values()) as RtPlusTag[]).filter(t => t.text && t.text.length > 0).sort((a, b) => a.contentType - b.contentType),
          ps: currentPs, 
          longPs: renderRdsBuffer(state.lpsBuffer, true), 
          rtA: renderRdsBuffer(state.rtBuffer0, false, true), 
          rtB: renderRdsBuffer(state.rtBuffer1, false, true), 
          af: [...state.afSet], 
          afListHead: state.afListHead, 
          afHeaderCount: state.afHeaderCount,
          afBLists: afBLists, 
          afType: state.afType, 
          ber: (state.currentPi !== "----" && (now - state.piEstablishmentTime) >= 3000 && berHistoryRef.current.length >= 12) ? cBer : -1,
          groupCounts: { ...state.groupCounts }, 
          groupTotal: state.groupTotal, 
          groupSequence: analyzerActiveRef.current ? [...state.groupSequence] : state.groupSequence.slice(-100), 
          recentGroups: recent, 
          rtAMask: [...state.rtMask0],
          rtBMask: [...state.rtMask1],
          psHistory: [...state.psHistoryBuffer], 
          rtHistory: [...state.rtHistoryBuffer],
          isRecording: state.isRecording,
          bandscanEntries: [...state.bandscanEntries],
          isRawRecording: state.isRawRecording,
          rawRecordingBuffer: [...state.rawRecordingBuffer],
          isPlayingRaw: state.isPlayingRaw,
          rawPlaybackCurrent: state.rawPlaybackCurrent,
          rawPlaybackTotal: state.rawPlaybackTotal,
          currentMetadata: lastApiDataRef.current ? {
            freq: lastApiDataRef.current.freq,
            signal: lastApiDataRef.current.sig,
            stationName: lastApiDataRef.current.tx,
            city: lastApiDataRef.current.city,
            dist: lastApiDataRef.current.dist,
            power: lastApiDataRef.current.erp,
            pi: state.currentPi,
            ps: currentPs,
            ta: state.ta,
            tp: state.tp,
            rdsReport: "", // Populated during export
            modulation: lastApiDataRef.current.st ? "Stereo" : "Mono",
            hasOda: state.hasOda,
            hasRtPlus: state.hasRtPlus,
            hasEon: state.hasEon,
            hasTmc: state.hasTmc
          } : undefined
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

    packetCountRef.current = 0;
    setPacketCount(0);

    stopRawPlayback();
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
        
        // --- Bandscan Frequency Change Handler ---
        if (chunk.includes("RESET-------")) {
          // Detect station change -> Archive previous one if recording (min 2s stay)
          const now = Date.now();
          if (decoderState.current.isRecording && (now - decoderState.current.frequencyStartTime >= 2000)) {
              captureBandscanEntry();
          }
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
              const s = decoderState.current; 
              if (s.currentPi !== "----" && (Date.now() - s.piEstablishmentTime) >= 3000) {
                updateBer(true); 
                s.groupTotal++;
                s.groupCounts["--"] = (s.groupCounts["--"] || 0) + 1; 
                s.groupSequence.push("--"); 
                if (s.groupSequence.length > 3000) {
                  s.groupSequence.splice(0, 1000);
                }
              }
              s.rawGroupBuffer.push({
                type: "--",
                blocks: [NaN, NaN, NaN, NaN],
                time: new Date().toLocaleTimeString('fr-FR')
              });
              if (s.isRawRecording) {
                s.rawRecordingBuffer.push("---- ---- ---- ----");
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
        msg = "This version cannot connect to HTTP servers. Please follow the on-screen instructions."; 
        if (window.location.protocol === 'https:') {
          setShowSecurityError(true); 
        }
      } 
      addLog(`Connection Failed: ${msg}`, 'error'); 
    }
  };

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

  const setRecording = (val: boolean) => {
    // Si on arrête l'enregistrement, on archive d'abord la station en cours pour ne pas l'oublier
    if (!val && decoderState.current.isRecording) {
        captureBandscanEntry(); 
    }
    
    decoderState.current.isRecording = val;
    
    if (val) {
        // Start recording: Clear existing and attempt immediate fetch for current freq
        decoderState.current.bandscanEntries = [];
        decoderState.current.frequencyStartTime = Date.now();
        if (apiTimeoutRef.current) clearTimeout(apiTimeoutRef.current);
        apiTimeoutRef.current = setTimeout(fetchBandscanMetadata, 500);
    }
    decoderState.current.isDirty = true;
  };

  const setRawRecording = (val: boolean) => {
    if (!val && decoderState.current.isRawRecording) {
        // Download file logic
        const now = new Date();
        const dateStr = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}`;
        const timeStr = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}-${now.getSeconds().toString().padStart(2, '0')}`;
        
        let currentPi = "----";
        const piGroups = new Map<string, string[]>();
        const unknownLines: string[] = [];

        for (const line of decoderState.current.rawRecordingBuffer) {
            const firstWord = line.substring(0, 4);
            if (firstWord !== '----' && /^[0-9A-F]{4}$/i.test(firstWord)) {
                currentPi = firstWord.toUpperCase();
            }
            if (currentPi === "----") {
                unknownLines.push(line);
            } else {
                if (!piGroups.has(currentPi)) {
                    piGroups.set(currentPi, []);
                    if (unknownLines.length > 0) {
                        piGroups.get(currentPi)!.push(...unknownLines);
                        unknownLines.length = 0;
                    }
                }
                piGroups.get(currentPi)!.push(line);
            }
        }

        if (unknownLines.length > 0) {
            if (piGroups.size > 0) {
                // If we ended up with trailing unknown lines, append to the last active PI
                piGroups.get(currentPi)!.push(...unknownLines);
            } else {
                piGroups.set(decoderState.current.currentPi || "----", unknownLines);
            }
        }

        if (piGroups.size > 1) {
            const zip = new JSZip();
            for (const [pi, lines] of piGroups.entries()) {
                const filename = `RDSExpert Raw Data - ${pi} - ${dateStr} (${timeStr}).rdse`;
                zip.file(filename, lines.join('\n'));
            }
            zip.generateAsync({ type: 'blob' }).then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `RDSExpert Raw Data - Recording Session - ${dateStr} (${timeStr}).zip`;
                a.click();
                URL.revokeObjectURL(url);
            });
        } else {
            const pi = piGroups.keys().next().value || decoderState.current.currentPi;
            const content = decoderState.current.rawRecordingBuffer.join('\n');
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `RDSExpert Raw Data - ${pi} - ${dateStr} (${timeStr}).rdse`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }
    
    decoderState.current.isRawRecording = val;
    if (val) {
        decoderState.current.rawRecordingBuffer = [];
    }
    decoderState.current.isDirty = true;
  };

  const seekRawPlayback = (percent: number) => {
    const state = decoderState.current;
    if (!state.isPlayingRaw || rawPlaybackLinesRef.current.length === 0) return;
    
    const newIndex = Math.floor(percent * rawPlaybackLinesRef.current.length);
    state.rawPlaybackCurrent = Math.min(newIndex, rawPlaybackLinesRef.current.length - 1);
    
    // Reset decoding state (copy from resetData logic but keep playback active)
    state.currentPi = "----";
    state.piCandidate = "----";
    state.piCounter = 0;
    state.piEstablishmentTime = 0;
    state.psHistoryLogged = false;
    state.psBuffer.fill('-');
    state.psMask.fill(false);
    state.lpsBuffer.fill(' ');
    state.ptynBuffer.fill(' ');
    state.rtBuffer0.fill(' ');
    state.rtBuffer1.fill(' ');
    state.rtMask0.fill(false);
    state.rtMask1.fill(false);
    state.rtCandidateString = "";
    state.rtStableSince = 0;
    state.afSet = [];
    state.afMethodAG3s.clear();
    state.afListHead = null;
    state.afHeaderCount = null;
    state.afBMap.clear();
    state.currentMethodBGroup = null;
    state.eonMap.clear();
    state.tmcBuffer = [];
    state.tmcProviderBuffer.fill(' ');
    state.rtPlusTags.clear();
    state.tdcHistoryBuffer = [];
    state.ihHistoryBuffer = [];
    state.tdcBuffer5A = "";
    state.tdcBuffer5B = "";
    state.rtPlusItemRunning = false;
    state.rtPlusItemToggle = false;
    state.hasOda = false;
    state.odaApp = undefined;
    state.odaList = [];
    state.hasRtPlus = false;
    state.hasEon = false;
    state.hasTmc = false;
    state.hasTdc = false;
    state.hasIh = false;
    state.tdcSeenDuringGrace = false;
    state.ihSeenDuringGrace = false;
    state.hasEws = false;
    state.ewsId = "";
    state.ecc = "";
    state.lic = "";
    state.pin = "";
    state.localTime = "";
    state.localTimeOffset = null;
    state.utcTime = "";
    state.pty = 0;
    state.ptynAbFlag = false;
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
    state.tmcServiceInfo = { ltn: 0, sid: 0, afi: false, mode: 0, providerName: "[Identifying...]" };
    state.groupCounts = {};
    state.groupTotal = 0;
    state.groupSequence = [];
    state.psHistoryBuffer = [];
    state.rtHistoryBuffer = [];
    state.psCandidateString = "        ";
    state.psStableSince = 0;
    state.psValidationBuffer = "        ";
    state.ptynCandidateString = "        ";
    state.ptynStableSince = 0;
    state.ptynValidationBuffer = "        ";
    berHistoryRef.current = [];
    state.graceCounter = GRACE_PERIOD_PACKETS;
    state.rawGroupBuffer = [];
    state.frequencyStartTime = Date.now();
    state.dabTargetGroup = null;
    state.dabExtraInfo = "";
    state.lfMfFollows = false;
    
    state.isDirty = true;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const playRawFile = async (file: File) => {
    if (status === ConnectionStatus.CONNECTED || status === ConnectionStatus.CONNECTING) {
      disconnect();
    }
    
    stopRawPlayback();
    
    const text = await file.text();
    const lines = text.split('\n')
      .map(l => l.trim())
      .map(l => {
        const match = l.match(/^([0-9A-F-]{4})\s+([0-9A-F-]{4})\s+([0-9A-F-]{4})\s+([0-9A-F-]{4})/i);
        return match ? [match[1], match[2], match[3], match[4]] : null;
      })
      .filter(l => l !== null) as string[][];
    
    if (lines.length === 0) return;
    
    rawPlaybackLinesRef.current = lines;
    resetData();
    
    decoderState.current.isPlayingRaw = true;
    decoderState.current.rawPlaybackTotal = lines.length;
    decoderState.current.rawPlaybackCurrent = 0;
    decoderState.current.isDirty = true;
    
    if (rawPlaybackModeRef.current === 'instant') {
      const originalDateNow = Date.now;
      let virtualTime = originalDateNow();
      Date.now = () => virtualTime;
      
      try {
        const state = decoderState.current;
        for (let i = 0; i < lines.length; i++) {
          const parts = lines[i];
          const hasError = parts.some(p => p.includes('-'));
          
          if (hasError) {
            if (state.currentPi !== "----" && (virtualTime - state.piEstablishmentTime) >= 3000) {
              updateBer(true);
              state.groupTotal++;
              state.groupCounts["--"] = (state.groupCounts["--"] || 0) + 1;
              state.groupSequence.push("--");
              if (state.groupSequence.length > 3000) {
                state.groupSequence.splice(0, 1000);
              }
            }
            state.rawGroupBuffer.push({
              type: "--",
              blocks: [NaN, NaN, NaN, NaN],
              time: new Date().toLocaleTimeString('fr-FR')
            });
            if (state.isRawRecording) {
              state.rawRecordingBuffer.push("---- ---- ---- ----");
            }
          } else {
            const g1 = parseInt(parts[0], 16);
            const g2 = parseInt(parts[1], 16);
            const g3 = parseInt(parts[2], 16);
            const g4 = parseInt(parts[3], 16);
            
            decodeRdsGroup(g1, g2, g3, g4);
            if (state.currentPi !== "----" && (virtualTime - state.piEstablishmentTime) >= 3000) {
              updateBer(false);
            }
          }
          
          state.rawPlaybackCurrent++;
          virtualTime += 88;
          
          const cRtBuf = state.abFlag ? state.rtBuffer1 : state.rtBuffer0; 
          const cRtMsk = state.abFlag ? state.rtMask1 : state.rtMask0;
          const termIdx = cRtBuf.indexOf('\r'); 
          let isRtC = termIdx !== -1 ? cRtMsk.slice(0, termIdx).every(Boolean) : cRtMsk.every(Boolean);
          let rawRt = renderRdsBuffer(cRtBuf, false, true); 
          if (termIdx !== -1) {
            rawRt = rawRt.substring(0, termIdx + 1);
          }
          if (isRtC) {
            if (rawRt !== state.rtCandidateString) { 
              state.rtCandidateString = rawRt; 
              state.rtStableSince = virtualTime; 
            }
            if (virtualTime - state.rtStableSince >= 2000) {
              const last = state.rtHistoryBuffer[0];
              if ((!last || last.text !== rawRt) && rawRt.trim().length > 0) { 
                state.rtHistoryBuffer.unshift({ 
                  time: new Date(virtualTime).toLocaleTimeString(), 
                  text: rawRt 
                }); 
                if (state.rtHistoryBuffer.length > 200) {
                  state.rtHistoryBuffer.pop();
                }
              }
            }
          }
        }
        state.isDirty = true;
        stopRawPlayback();
      } finally {
        Date.now = originalDateNow;
      }
    } else {
      playbackIntervalRef.current = setInterval(() => {
        const state = decoderState.current;
        if (state.rawPlaybackCurrent >= lines.length) {
          stopRawPlayback();
          return;
        }
        
        const parts = lines[state.rawPlaybackCurrent];
        const hasError = parts.some(p => p.includes('-'));
        
        if (hasError) {
          if (state.currentPi !== "----" && (Date.now() - state.piEstablishmentTime) >= 3000) {
            updateBer(true);
            state.groupTotal++;
            state.groupCounts["--"] = (state.groupCounts["--"] || 0) + 1;
            state.groupSequence.push("--");
            if (state.groupSequence.length > 3000) {
              state.groupSequence.splice(0, 1000);
            }
          }
          state.rawGroupBuffer.push({
            type: "--",
            blocks: [NaN, NaN, NaN, NaN],
            time: new Date().toLocaleTimeString('fr-FR')
          });
          if (state.isRawRecording) {
            state.rawRecordingBuffer.push("---- ---- ---- ----");
          }
        } else {
          const g1 = parseInt(parts[0], 16);
          const g2 = parseInt(parts[1], 16);
          const g3 = parseInt(parts[2], 16);
          const g4 = parseInt(parts[3], 16);
          
          decodeRdsGroup(g1, g2, g3, g4);
          if (state.currentPi !== "----" && (Date.now() - state.piEstablishmentTime) >= 3000) {
            updateBer(false);
          }
        }
        
        state.rawPlaybackCurrent++;
        state.isDirty = true;
      }, 88);
    }
  };

  const handlePlayRawClick = () => {
    setShowRawMenu((prev) => !prev);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      playRawFile(file);
    }
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-300 font-sans selection:bg-blue-500/30">

      {showSecurityError && (
        <SecurityErrorModal onClose={() => setShowSecurityError(false)} serverUrl={serverUrl} />
      )}
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
            <div className="flex items-center justify-center md:justify-start shrink-0 md:mr-2 select-none cursor-default group">
              <span className="font-black text-2xl text-slate-100 tracking-tighter italic group-hover:text-white transition-colors">RDS</span>
              <span className="font-bold text-2xl text-blue-500 tracking-tighter group-hover:text-blue-400 transition-colors">EXPERT</span>
            </div>
            
            <div className="flex flex-row gap-2 w-full md:w-auto items-stretch">
                <a 
                  href="https://github.com/LucasGallone/RDSExpert/wiki" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-slate-900/50 border border-slate-800 rounded px-2 py-1.5 md:px-3 md:py-2 flex items-center justify-center text-slate-500 hover:text-blue-400 hover:border-blue-500/50 transition-colors order-4 md:order-1 flex-none"
                  title="Documentation on GitHub (Opens in a new tab)"
                >
                  <i className="fa-solid fa-circle-info text-sm md:text-base"></i>
                </a>

                <div 
                  className="relative order-3 md:order-2 flex-none"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingOverRaw(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingOverRaw(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingOverRaw(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      setDroppedFile(file);
                      setShowRawMenu(true);
                    }
                  }}
                >
                  <button 
                    onClick={handlePlayRawClick}
                    className={`bg-slate-900/50 border rounded px-2 py-1.5 md:px-3 md:py-2 flex items-center justify-center gap-2 transition-all w-full h-full text-[10px] md:text-xs font-bold uppercase ${isDraggingOverRaw ? 'border-blue-500 bg-blue-500/20 text-blue-400 scale-105 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'border-slate-800 text-slate-500 hover:text-blue-400 hover:border-blue-500/50'}`}
                  >
                    <i className={`fa-solid ${isDraggingOverRaw ? 'fa-upload animate-bounce' : 'fa-play'}`}></i>
                    <span>{droppedFile ? 'CHOOSE PLAYBACK' : (isDraggingOverRaw ? 'DROP FILE' : 'RAW DATA')}</span>
                  </button>
                  {showRawMenu && (
                    <div className="absolute top-full left-0 mt-1 w-40 bg-slate-800 border border-slate-700 rounded shadow-lg z-50 flex flex-col overflow-hidden">
                      <button 
                        onClick={() => {
                          rawPlaybackModeRef.current = 'normal';
                          setShowRawMenu(false);
                          if (droppedFile) {
                            playRawFile(droppedFile);
                            setDroppedFile(null);
                          } else {
                            fileInputRef.current?.click();
                          }
                        }}
                        className="px-3 py-2 text-left text-[10px] md:text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-blue-400 transition-colors"
                      >
                        NORMAL PLAYBACK
                      </button>
                      <button 
                        onClick={() => {
                          rawPlaybackModeRef.current = 'instant';
                          setShowRawMenu(false);
                          if (droppedFile) {
                            playRawFile(droppedFile);
                            setDroppedFile(null);
                          } else {
                            fileInputRef.current?.click();
                          }
                        }}
                        className="px-3 py-2 text-left text-[10px] md:text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-blue-400 transition-colors"
                      >
                        INSTANT PLAYBACK
                      </button>
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".rdse,.txt,.spy,.smp,.log,.rds,.rawrds" 
                  className="hidden" 
                />

                <div className="bg-slate-900/50 border border-slate-800 rounded px-2 py-1.5 md:px-3 md:py-2 flex items-center gap-2 md:gap-3 flex-1 md:flex-none shrink-0 text-[10px] md:text-xs font-mono text-slate-500 order-1 md:order-3">
                  <span>STATUS</span> 
                  <span className={`font-bold ${status === ConnectionStatus.CONNECTED ? 'text-green-400' : status === ConnectionStatus.ERROR ? 'text-red-400' : 'text-slate-400'}`}>
                    {status}
                  </span>
                </div>
                
                <div className="bg-slate-900/50 border border-slate-800 rounded px-2 py-1.5 md:px-3 md:py-2 flex items-center gap-2 md:gap-3 flex-1 md:flex-none shrink-0 text-[10px] md:text-xs font-mono text-slate-500 order-2 md:order-4">
                  <span>PACKETS</span> 
                  <span className="text-slate-200">{packetCount.toLocaleString()}</span>
                </div>
            </div>
            
            <div className="flex items-center gap-2 flex-1">
              <div className="relative group flex-1">
                <input 
                  type="text" 
                  value={serverUrl} 
                  onChange={(e) => setServerUrl(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && connect()} 
                  placeholder="Enter the webserver URL here" 
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
           {rdsData.isPlayingRaw && (
             <div 
               className="w-full bg-green-950/20 h-8 rounded-lg flex items-center px-4 border border-green-900/30 overflow-hidden relative cursor-pointer group/progress"
               onClick={(e) => {
                 const rect = e.currentTarget.getBoundingClientRect();
                 const x = e.clientX - rect.left;
                 const percent = x / rect.width;
                 seekRawPlayback(percent);
               }}
             >
               <div 
                 className="absolute inset-y-0 left-0 bg-green-500/50 transition-all duration-100" 
                 style={{ width: `${(rdsData.rawPlaybackCurrent / rdsData.rawPlaybackTotal) * 100}%` }}
               ></div>
               <div className="relative z-10 w-full flex justify-end items-center gap-3">
                 <span className="text-xs font-mono text-white font-bold">
                   {rdsData.rawPlaybackCurrent}/{rdsData.rawPlaybackTotal}
                 </span>
                 <button 
                   onClick={(e) => { e.stopPropagation(); stopRawPlayback(); }}
                   className="w-5 h-5 flex items-center justify-center bg-red-600 hover:bg-red-500 text-white rounded-full transition-colors shadow-lg"
                   title="Stop playback"
                 >
                   <i className="fa-solid fa-stop text-[10px]"></i>
                 </button>
               </div>
             </div>
           )}
           <LcdDisplay 
             data={rdsData} 
             onReset={resetData} 
             onTdcClick={() => setShowTdcHistory(true)}
             onIhClick={() => setShowIhHistory(true)}
             onRpClick={() => setShowRpHistory(true)}
             onErtClick={() => setShowErtHistory(true)}
             onSetRawRecording={setRawRecording}
           />
           <HistoryControls data={rdsData} onSetRecording={setRecording} serverUrl={serverUrl} />
           <InfoGrid data={rdsData} />
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
             <span>System & Connections Logs</span> 

           </div>
           
           <div className="space-y-1 overflow-y-auto p-4 pt-2 custom-scrollbar flex-1">
             {logs.length === 0 && (
               <div className="text-slate-400 italic p-2 opacity-80">No events recorded.</div>
             )}
             {logs.map((l, i) => ( 
               <div key={i} className={`flex gap-3 pb-0.5 ${getLogColor(l.type)}`}> 
                 <span className="text-slate-500 shrink-0">[{l.time}]</span> 
                 <span>{l.message}</span> 
               </div> 
             ))}
           </div>
        </div>
      </div>

      {showTdcHistory && (
        <HistoryViewer 
          title="TDC HISTORY (TRANSPARENT DATA CHANNELS) [5A / 5B]"
          onClose={() => setShowTdcHistory(false)}
          data={rdsData.tdcHistory}
          getCopyText={(item) => `[${item.time}] [GROUP: ${item.group}] [CHANNEL: ${item.channel}] ${item.text}`}
          renderHeader={() => (
            <tr className="border-b border-slate-700 text-slate-500 bg-slate-900 sticky top-0 z-10">
              <th className="p-3 w-24">Time</th>
              <th className="p-3 w-24">Group</th>
              <th className="p-3 w-24">Channel</th>
              <th className="p-3">Text</th>
            </tr>
          )}
          renderRow={(item, i) => (
            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
              <td className="p-3 text-slate-400 border-r border-slate-800/50 align-top">{item.time}</td>
              <td className="p-3 text-blue-400 border-r border-slate-800/50 align-top font-bold">{item.group}</td>
              <td className="p-3 text-blue-400 border-r border-slate-800/50 align-top font-mono font-bold">{item.channel}</td>
              <td className="p-3 text-white whitespace-pre-wrap leading-relaxed">
                {item.text.split('').map((char, idx) => {
                  const code = char.charCodeAt(0);
                  if (code < 32) {
                    const hex = code.toString(16).toUpperCase().padStart(2, '0');
                    return (
                      <span key={idx} className="inline-block text-[0.6em] align-middle text-slate-500 font-bold bg-slate-900/50 rounded px-0.5 mx-px border border-slate-700 select-none">
                        &lt;{hex}&gt;
                      </span>
                    );
                  }
                  return char;
                })}
              </td>
            </tr>
          )}
          emptyMessage="No TDC data detected on groups 5A or 5B."
          copyReverse={true}
        />
      )}

      {showIhHistory && (
        <HistoryViewer 
          title="IN HOUSE APPLICATIONS HISTORY [6A / 6B]"
          onClose={() => setShowIhHistory(false)}
          data={rdsData.ihHistory}
          getCopyText={(item) => `[${item.time}] [GROUP: ${item.group}] [CHANNEL: ${item.channel}] ${item.text}`}
          renderHeader={() => (
            <tr className="border-b border-slate-700 text-slate-500 bg-slate-900 sticky top-0 z-10">
              <th className="p-3 w-24">Time</th>
              <th className="p-3 w-24">Group</th>
              <th className="p-3 w-24">Channel</th>
              <th className="p-3">Decoded Data</th>
            </tr>
          )}
          renderRow={(item, i) => (
            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
              <td className="p-3 text-slate-400 border-r border-slate-800/50 align-top">{item.time}</td>
              <td className="p-3 text-emerald-400 border-r border-slate-800/50 align-top font-bold">{item.group}</td>
              <td className="p-3 text-blue-400 border-r border-slate-800/50 align-top font-mono font-bold">{item.channel}</td>
              <td className="p-3 text-white font-mono text-sm leading-relaxed">
                {item.text}
              </td>
            </tr>
          )}
          emptyMessage="No In House data detected on groups 6A or 6B."
          copyReverse={true}
        />
      )}

      {showRpHistory && (
        <HistoryViewer 
          title="RADIO PAGING HISTORY [7A]"
          onClose={() => setShowRpHistory(false)}
          data={rdsData.rpHistory}
          getCopyText={(item) => `[${item.time}] [GROUP: ${item.group}] [TYPE: ${item.type || "Unknown"}] [FLAG: ${item.abFlag}] [INDICATOR: ${item.address.toString(2).padStart(4, '0')}] ${item.text}`}
          renderHeader={() => (
            <tr className="border-b border-slate-700 text-slate-500 bg-slate-900 sticky top-0 z-10">
              <th className="p-3 w-24">Time</th>
              <th className="p-3 w-24">Group</th>
              <th className="p-3 w-24">Type</th>
              <th className="p-3 w-24">Flag</th>
              <th className="p-3 w-24">Indicator</th>
              <th className="p-3">Decoded Data</th>
            </tr>
          )}
          renderRow={(item, i) => (
            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
              <td className="p-3 text-slate-400 border-r border-slate-800/50 align-top">{item.time}</td>
              <td className="p-3 text-emerald-400 border-r border-slate-800/50 align-top font-bold">{item.group}</td>
              <td className="p-3 text-purple-400 border-r border-slate-800/50 align-top font-bold">{item.type || "Unknown"}</td>
              <td className="p-3 text-orange-400 border-r border-slate-800/50 align-top font-mono font-bold">{item.abFlag}</td>
              <td className="p-3 text-blue-400 border-r border-slate-800/50 align-top font-mono font-bold">{item.address.toString(2).padStart(4, '0')}</td>
              <td className="p-3 text-white font-mono text-sm leading-relaxed">
                {item.text}
              </td>
            </tr>
          )}
          emptyMessage="No Radio Paging data detected on group 7A."
          copyReverse={true}
        />
      )}

      {showErtHistory && (
        <HistoryViewer 
          title="ENHANCED RADIOTEXT HISTORY"
          onClose={() => setShowErtHistory(false)}
          data={rdsData.ertHistory}
          getCopyText={(item) => {
            const formattedText = item.text.split('').map(char => {
              const code = char.charCodeAt(0);
              return code < 32 ? `<${code.toString(16).toUpperCase().padStart(2, '0')}>` : char;
            }).join('');
            const tagsText = item.tags && item.tags.length > 0 
              ? item.tags.map(tag => `\n  - ${tag.label} (ID ${tag.contentType}): ${tag.text}`).join('')
              : '';
            return `[${item.time}] [GROUP: ${item.group}] ${formattedText}${tagsText}`;
          }}
          renderHeader={() => (
            <tr className="border-b border-slate-700 text-slate-500 bg-slate-900 sticky top-0 z-10">
              <th className="p-3 w-24">Time</th>
              <th className="p-3 w-24">Group</th>
              <th className="p-3">Message</th>
            </tr>
          )}
          renderRow={(item, i) => (
            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
              <td className="p-3 text-slate-400 border-r border-slate-800/50 align-top">{item.time}</td>
              <td className="p-3 text-emerald-400 border-r border-slate-800/50 align-top font-bold">{item.group}</td>
              <td className="p-3 text-white leading-relaxed">
                <div>
                  {item.text.split('').map((char, idx) => {
                    const code = char.charCodeAt(0);
                    if (code < 32) {
                      const hex = code.toString(16).toUpperCase().padStart(2, '0');
                      return (
                        <span key={idx} className="inline-block text-[0.6em] align-middle text-slate-500 font-bold bg-slate-900/50 rounded px-0.5 mx-px border border-slate-700 select-none">
                          &lt;{hex}&gt;
                        </span>
                      );
                    }
                    return char;
                  })}
                </div>
                {item.tags && item.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.tags.map((tag, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-emerald-400">
                        <span className="text-white mr-1">{tag.label} (ID {tag.contentType}):</span>
                        {tag.text}
                      </span>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          )}
          emptyMessage="No Enhanced Radiotext (eRT) data decoded for now."
          copyReverse={true}
        />
      )}
    </div>
  );
};

const SecurityErrorModal: React.FC<{ onClose: () => void; serverUrl: string }> = ({ onClose, serverUrl }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
    <div className="bg-slate-900 border-2 border-red-500/50 rounded-lg shadow-2xl w-full max-w-lg flex flex-col overflow-hidden relative">
      <div className="p-6 text-center space-y-4">
        <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white">Action required to continue</h3>
        <p className="text-slate-300 text-sm leading-relaxed">
          Unfortunately, due to web browser security restrictions, the HTTPS version of this interface can only be used with HTTPS servers.<br /><br />
          You can bypass this limitation and connect to the specified HTTP server by using the HTTP version of this interface, hosted by @Bkram.<br /><br />
          Click the button below to do so. (Opens a new tab)
        </p>
      </div>
      <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-center gap-3">
        <button 
          onClick={onClose} 
          className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded transition-colors uppercase border border-slate-600"
        >
          Close
        </button>
        <a 
          href={`http://rdsexpert.fmdx-webserver.nl:8080/?url=${encodeURIComponent(serverUrl)}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[11px] md:text-sm font-bold rounded transition-colors uppercase border border-blue-500 shadow-lg shadow-blue-500/20 flex items-center text-center"
        >
          SWITCH TO THE HTTP INTERFACE
        </a>
      </div>
    </div>
  </div>
);

export default App;
