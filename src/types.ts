export interface RdsData {
  pi: string;          // PI - Program Identification (e.g., F204)
  ps: string;          // PS - Program Service (e.g., F I P)
  longPs: string;      // Long PS - Long Program Service (Max 32 chars, via Group 15A/15B)
  rtA: string;         // Radio Text A (Text A/B Flag = 0)
  rtB: string;         // Radio Text B (Text A/B Flag = 1)
  textAbFlag: boolean; // Current active flag (false=A, true=B)
  rtPlus: RtPlusTag[]; // RadioText+ Tags
  rtPlusItemRunning: boolean; // RT+ Item Running Bit (Group 12A Block 2 Bit 4)
  rtPlusItemToggle: boolean;  // RT+ Item Toggle Bit (Group 12A Block 2 Bit 3)
  hasOda: boolean;     // ODA activity flag (Latched)
  odaApp?: { name: string; aid: string; group: string; extra?: string }; // Last detected ODA details (Legacy)
  odaList: { name: string; aid: string; group: string; extra?: string }[]; // List of up to 5 detected ODAs
  hasRtPlus: boolean;  // RT+ activity flag (Latched)
  hasEon: boolean;     // EON activity flag (Latched)
  hasTmc: boolean;     // TMC activity flag (Latched)
  hasTdc: boolean;     // TDC activity flag (Latched)
  hasIh: boolean;      // IH activity flag (Latched)
  hasRp: boolean;      // RP activity flag (Latched)
  hasErt: boolean;     // eRT activity flag (Latched)
  hasEws: boolean;     // EWS activity flag (Latched)
  ewsId: string;       // EWS ID (decoded from Group 1A)
  pty: number;         // PTY - Program Type (0-31)
  ptyName?: string;    // Decoded PTYN - Program Type Name
  ptyn: string;        // PTYN - Program Type Name (8 chars, via Group 10A)
  ptynAbFlag: boolean; // PTYN A/B Flag (Group 10A Block 2 Bit 4)
  af: string[];        // AF - Alternative Frequencies (Method A flat list)
  afListHead: string | null; // Head of AF List (Method A)
  afHeaderCount: number | null; // Number of AFs advertised in header
  afBLists: Record<string, string[]>; // Method B Grouping (Key=Tx Freq, Value=AF List)
  afType: 'A' | 'B' | 'Unknown'; // AF Method detection
  tp: boolean;         // TP - Traffic Program
  ta: boolean;         // TA - Traffic Announcement
  ms: boolean;         // M/S - Music/Speech flag
  stereo: boolean;     // DI - Stereo flag (DI Bit via Group 0A)
  artificialHead: boolean; // DI - Artificial Head (DI Bit via Group 0A)
  compressed: boolean;     // DI - Compressed (DI Bit via Group 0A)
  dynamicPty: boolean;     // DI - Dynamic PTY (DI Bit via Group 0A)
  ecc: string;         // ECC - Extended Country Code (Group 1A)
  lic: string;         // LIC - Language Identification Code (Group 1A)
  pin: string;         // PIN - Program Item Number (Day HH:MM, via Group 1A)
  localTime: string;   // Local Clock Time (Group 4A)
  localTimeOffset: string | null; // Local Time Offset (Group 4A)
  utcTime: string;     // UTC Clock Time (Group 4A)
  ctTimeError: string | null; // Difference between CT and computer time
  eonData: Record<string, EonNetwork>; // EON Data keyed by PI
  tmcServiceInfo: TmcServiceInfo; // Service Provider Info (SID, LTN, etc.)
  tmcMessages: TmcMessage[]; // Buffer of decoded TMC messages
  tdcHistory: TdcHistoryItem[]; // Buffer of decoded TDC messages
  ihHistory: IhHistoryItem[];  // Buffer of decoded IH messages
  rpHistory: RpHistoryItem[];  // Buffer of decoded RP messages
  ertHistory: ErtHistoryItem[]; // Buffer of decoded eRT messages
  ertPlusTags: RtPlusTag[];    // eRT+ Tags
  ber: number;         // Bit Error Rate (Signal quality indicator)
  rssi: number;        // Signal Strength
  snr: number;         // Signal to Noise Ratio
  // Analyzer Data
  groupCounts: Record<string, number>; // Key: "0A", "14B" etc.
  groupTotal: number;
  groupSequence: string[]; // History of last N groups ["0A", "2A", ...]
  recentGroups: RawGroup[]; // Buffer of raw groups received since last frame
  
  // RadioText Decoding Masks
  rtAMask: boolean[];
  rtBMask: boolean[];

  // History
  psHistory: PsHistoryItem[];
  rtHistory: RtHistoryItem[];

  // Bandscan
  isRecording: boolean;
  bandscanEntries: BandscanEntry[];
  currentMetadata?: BandscanEntry;

  // Raw Recording
  isRawRecording: boolean;
  rawRecordingBuffer: string[];
  rawRecordingPacketCount: number;

  // Raw Playback
  isPlayingRaw: boolean;
  rawPlaybackCurrent: number;
  rawPlaybackTotal: number;
}

export interface BandscanEntry {
    freq: string;
    signal: number;
    stationName: string;
    city: string;
    pi: string;
    ps: string;
    rdsReport: string;
    ta?: boolean;
    tp?: boolean;
    dist?: string;
    power?: number;
    modulation?: string;
    hasOda?: boolean;
    hasRtPlus?: boolean;
    hasEon?: boolean;
    hasTmc?: boolean;
    hasIh?: boolean;
    hasTdc?: boolean;
    hasRp?: boolean;
    hasErt?: boolean;
    isDynamic?: boolean;
}

export interface LogEntry {
    time: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
}

export interface PsHistoryItem {
    time: string;
    pi: string;
    ps: string;
    pty: number;
    ptyn: string;
}

export interface RtHistoryItem {
    time: string;
    text: string;
}

export interface TdcHistoryItem {
    time: string;
    text: string;
    group: '5A' | '5B';
    channel: number;
}

export interface IhHistoryItem {
    time: string;
    text: string;
    group: '6A' | '6B';
    channel: number;
}

export interface RpHistoryItem {
    time: string;
    text: string;
    group: '7A';
    address: number;
    abFlag: number;
    type?: 'Numeric' | 'Alphanumeric' | 'Unknown';
    pagerId?: string;
}

export interface ErtHistoryItem {
    time: string;
    text: string;
    group: string;
    tags?: RtPlusTag[];
}

export interface RawGroup {
  type: string; // "0A", "2B", etc.
  blocks: [number, number, number, number]; // [g1, g2, g3, g4]
  time: string; // HH:MM:SS
}

export interface EonNetwork {
  pi: string;
  ps: string;
  psBuffer: string[]; // Internal use for building PS
  tp: boolean;
  ta: boolean;
  pty: number;
  pin: string;
  linkageInfo: string; // 4 chars hex
  af: string[];
  mappedFreqs: string[]; // Format "FreqA -> FreqB"
  lastUpdate: number;
  pendingLfmf?: boolean;
}

export interface RtPlusTag {
  contentType: number;
  start: number;
  length: number;
  label: string;
  text: string;
  isCached?: boolean;
}

export interface TmcServiceInfo {
    ltn: number; // Location Table Number
    sid: number; // Service Identifier
    afi: boolean; // Alternative Frequency Indicator
    mode: number; // Mode
    providerName: string; // Placeholder for Provider Name
}

export interface TmcMessage {
    id: number;
    receivedTime: string; // Formatted HH:MM:SS
    expiresTime: string;  // Formatted HH:MM:SS based on duration
    isSystem: boolean; 
    
    // User Msg Fields (Standard Alert-C)
    cc: number;         // Continuity Check (0-7)
    eventCode: number;  // 11-bit Event Code
    locationCode: number; // Location ID
    extent: number;     // Extent (0-7)
    durationCode: number; // Duration Code (0-7)
    direction: boolean; // 0=Positive, 1=Negative
    diversion: boolean; // Diversion advice bit
    
    // Derived/Display Fields
    label: string;      // e.g. "Roadworks"
    urgency: string;    // e.g. "Normal", "Urgent"
    nature: string;     // e.g. "Info", "Forecast"
    durationLabel: string; // e.g. "Longer Lasting", "30 mins"
    updateCount: number; // Number of times this message has been repeated/updated
    
    // System Msg Fields
    rawBlock2?: string;
    rawBlock3?: string;
    rawBlock4?: string;
}

export interface TmcResolvedLocation {
  locationCode: number;
  lat: number;
  lon: number;
  name?: string;
  roadRef?: string;
  prevLocationCode?: number;
  nextLocationCode?: number;
  status: 'resolved' | 'pending' | 'not_found';
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export const PTY_RDS = [
  "None",
  "News",
  "Current Affairs",
  "Information",
  "Sport",
  "Education",
  "Drama",
  "Culture",
  "Science",
  "Varied",
  "Pop Music",
  "Rock Music",
  "Easy Listening",
  "Light Classical",
  "Serious Classical",
  "Other Music",
  "Weather",
  "Finance",
  "Children's Programmes",
  "Social Affairs",
  "Religion",
  "Phone-in",
  "Travel",
  "Leisure",
  "Jazz Music",
  "Country Music",
  "National Music",
  "Oldies Music",
  "Folk Music",
  "Documentary",
  "ALARM TEST",
  "ALARM"
];

export const PTY_RBDS = [
  "None",
  "News",
  "Information",
  "Sports",
  "Talk",
  "Rock",
  "Classic Rock",
  "Adult Hits",
  "Soft Rock",
  "Top 40",
  "Country",
  "Oldies",
  "Soft Music",
  "Nostalgia",
  "Jazz",
  "Classical",
  "Rhythm and Blues",
  "Soft RnB",
  "Language",
  "Religious Music",
  "Religious Talk",
  "Personality",
  "Public",
  "College",
  "Spanish Talk",
  "Spanish Music",
  "Hip-Hop",
  "Unassigned",
  "Unassigned",
  "Weather",
  "EMERGENCY TEST",
  "EMERGENCY"
];

export const PTY_COMBINED = [
  "None",
  "News",
  "Current Affairs | Information",
  "Information | Sports",
  "Sport | Talk",
  "Education | Rock",
  "Drama | Classic Rock",
  "Culture | Adult Hits",
  "Science | Soft Rock",
  "Varied | Top 40",
  "Pop Music | Country",
  "Rock Music | Oldies",
  "Easy Listening | Soft Music",
  "Light Classical | Nostalgia",
  "Serious Classical | Jazz",
  "Other Music | Classical",
  "Weather | Rhythm and Blues",
  "Finance | Soft RnB",
  "Children's Programmes | Language",
  "Social Affairs | Religious Music",
  "Religion | Religious Talk",
  "Phone-in | Personality",
  "Travel | Public",
  "Leisure | College",
  "Jazz Music | Spanish Talk",
  "Country Music | Spanish Music",
  "National Music | Hip-Hop",
  "Oldies Music | Unassigned",
  "Folk Music | Unassigned",
  "Documentary | Weather",
  "ALARM Test | EMERGENCY Test",
  "ALARM! | EMERGENCY!"
];