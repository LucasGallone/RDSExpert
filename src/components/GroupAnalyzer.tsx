
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { RdsData } from '../types';
import { ODA_MAP } from '../constants';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface GroupAnalyzerProps {
  data: RdsData;
  active: boolean;
  onToggle: () => void;
  onReset: () => void;
}

type ViewMode = 'STREAM' | 'HEX' | 'DETAIL';

interface LogItem {
    id: number;
    text: string;
}

const GROUP_COLORS: Record<string, string> = {
    // 0: Basic Tuning (Gray/White)
    "0A": "text-slate-300",
    "0B": "text-slate-300",
    // 1: PIN/ECC (Gray)
    "1A": "text-slate-400",
    "1B": "text-slate-400",
    // 2: RT (Cyan)
    "2A": "text-cyan-400",
    "2B": "text-cyan-400",
    // 3: ODA (Green)
    "3A": "text-green-500",
    "3B": "text-green-500",
    // 4: Clock (Pink)
    "4A": "text-pink-500",
    "4B": "text-pink-500",
    // 5: TDC (Purple)
    "5A": "text-violet-400",
    "5B": "text-violet-400",
    // 6: IH (Purple)
    "6A": "text-violet-400",
    "6B": "text-violet-400",
    // 7: RP (Purple)
    "7A": "text-violet-400",
    "7B": "text-violet-400",
    // 8: TMC (Red)
    "8A": "text-red-500",
    "8B": "text-red-500",
    // 9: EWS (Purple)
    "9A": "text-violet-400",
    "9B": "text-violet-400",
    // 10: PTYN (Orange)
    "10A": "text-orange-400",
    "10B": "text-orange-400",
    // 11: ODA (Purple)
    "11A": "text-violet-400",
    "11B": "text-violet-400",
    // 12: RT+ (Purple)
    "12A": "text-violet-400",
    "12B": "text-violet-400",
    // 13: RP (Purple)
    "13A": "text-violet-400",
    "13B": "text-violet-400",
    // 14: EON (Yellow)
    "14A": "text-yellow-400",
    "14B": "text-yellow-400",
    // 15: Long PS (Teal)
    "15A": "text-teal-400",
    "15B": "text-teal-400",
    // Error Group
    "--": "text-slate-400 font-bold opacity-50",
    // Default fallback
    "default": "text-slate-200"
};

const HEX_COLORS: Record<string, string> = {
    "text-slate-300": "#cbd5e1",
    "text-slate-400": "#94a3b8",
    "text-cyan-400": "#22d3ee",
    "text-green-500": "#22c55e",
    "text-pink-500": "#ec4899",
    "text-violet-400": "#a78bfa",
    "text-red-500": "#ef4444",
    "text-orange-400": "#fb923c",
    "text-yellow-400": "#facc15",
    "text-teal-400": "#2dd4bf",
    "text-slate-200": "#e2e8f0",
    "text-slate-400 font-bold opacity-50": "#94a3b8"
};

const GROUP_DESCRIPTIONS: Record<string, string> = {
    "0A": "PI, PS, AF, PTY, Flags",
    "0B": "PI, PS, PTY, Flags",
    "1A": "ECC, LIC, PIN, EWS ID",
    "1B": "PIN",
    "2A": "Radiotext",
    "2B": "Radiotext (Max. 32 characters)",
    "3A": "ODA AIDs List",
    "3B": "ODA",
    "4A": "CT (Time & Date)",
    "4B": "ODA",
    "5A": "TDC / ODA",
    "5B": "TDC / ODA",
    "6A": "In House Applications / ODA",
    "6B": "In House Applications / ODA",
    "7A": "Radio Paging / ODA",
    "7B": "Radio Paging / ODA",
    "8A": "TMC / ODA",
    "8B": "ODA",
    "9A": "EWS / ODA",
    "9B": "EWS / ODA",
    "10A": "PTYN",
    "10B": "ODA",
    "11A": "ODA",
    "11B": "ODA",
    "12A": "ODA",
    "12B": "ODA",
    "13A": "Enhanced Radio Paging / ODA",
    "13B": "ODA",
    "14A": "EON",
    "14B": "EON TA",
    "15A": "Long PS",
    "15B": "Fast Basic Tuning"
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

const getGroupColor = (grp: string) => GROUP_COLORS[grp] || GROUP_COLORS["default"];

// Generate list of all possible RDS groups (0A-15B)
const ALL_GROUPS = Array.from({ length: 16 }, (_, i) => [`${i}A`, `${i}B`]).flat();

// Helper to format binary with spacing
const toBin = (val: number, bits: number) => {
    let bin = val.toString(2).padStart(bits, '0');
    // Add space every 4 bits for readability if long
    if (bits > 8) {
        return bin.replace(/(.{4})/g, '$1 ').trim();
    }
    return bin;
};

// --- RDS Character Set Mapping (Custom Super-Hybrid Table) ---
const RDS_G2_MAP: Record<number, string> = {
  // 0x80 - 0x8F
  0x80: 'á', 0x81: 'à', 0x82: 'é', 0x83: 'è', 0x84: 'í', 0x85: 'ì', 0x86: 'ó', 0x87: 'ò',
  0x88: 'ú', 0x89: 'ù', 0x8A: 'Ñ', 0x8B: 'Ç', 0x8C: 'Ş', 0x8D: 'ß', 0x8E: '¡', 0x8F: 'Ĳ',
  // 0x90 - 0x9F
  0x90: 'â', 0x91: 'ä', 0x92: 'ê', 0x93: 'ë', 0x94: 'î', 0x95: 'ï', 0x96: 'ô', 0x97: 'ö',
  0x98: 'û', 0x99: 'ü', 0x9A: 'ñ', 0x9B: 'ç', 0x9C: 'ş', 0x9D: 'ğ', 0x9E: 'ı', 0x9F: 'ĳ',
  // 0xA0 - 0xAF
  0xA0: 'ª', 0xA1: 'α', 0xA2: '©', 0xA3: '‰', 0xA4: 'Ğ', 0xA5: 'ě', 0xA6: 'Ň', 0xA7: 'ő',
  0xA8: 'π', 0xA9: '€', 0xAA: '£', 0xAB: '$', 0xAC: '←', 0xAD: '↑', 0xAE: '→', 0xAF: '↓',
  // 0xB0 - 0xBF
  0xB0: '⁰', 0xB1: '¹', 0xB2: '²', 0xB3: '³', 0xB4: '±', 0xB5: 'İ', 0xB6: 'ń', 0xB7: 'ű',
  0xB8: 'μ', 0xB9: '¿', 0xBA: '÷', 0xBB: '°', 0xBC: '¼', 0xBD: '½', 0xBE: '¾', 0xBF: '§',
  // 0xC0 - 0xCF
  0xC0: 'Á', 0xC1: 'À', 0xC2: 'É', 0xC3: 'È', 0xC4: 'Í', 0xC5: 'Ì', 0xC6: 'Ó', 0xC7: 'Ò',
  0xC8: 'Ú', 0xC9: 'Ù', 0xCA: 'Ř', 0xCB: 'Č', 0xCC: 'Š', 0xCD: 'Ž', 0xCE: 'Đ', 0xCF: 'Ŀ',
  // 0xD0 - 0xDF
  0xD0: 'Â', 0xD1: 'Ä', 0xD2: 'Ê', 0xD3: 'Ë', 0xD4: 'Î', 0xD5: 'Ï', 0xD6: 'Ô', 0xD7: 'Ö',
  0xD8: 'Û', 0xD9: 'Ü', 0xDA: 'ř', 0xDB: 'č', 0xDC: 'š', 0xDD: 'ž', 0xDE: 'đ', 0xDF: 'ŀ',
  // 0xE0 - 0xEF
  0xE0: 'Ã', 0xE1: 'Å', 0xE2: 'Æ', 0xE3: 'Œ', 0xE4: 'ŷ', 0xE5: 'Ý', 0xE6: 'Õ', 0xE7: 'Ø',
  0xE8: 'Þ', 0xE9: 'Ŋ', 0xEA: 'Ŕ', 0xEB: 'Ć', 0xEC: 'Ś', 0xED: 'Ź', 0xEE: 'Ŧ', 0xEF: 'ð',
  // 0xF0 - 0xFF
  0xF0: 'ã', 0xF1: 'å', 0xF2: 'æ', 0xF3: 'œ', 0xF4: 'ŵ', 0xF5: 'ý', 0xF6: 'õ', 0xF7: 'ø',
  0xF8: 'þ', 0xF9: 'ŋ', 0xFA: 'ŕ', 0xFB: 'ć', 0xFC: 'ś', 0xFD: 'ź', 0xFE: 'ŧ', 0xFF: 'ÿ'
};

const decodeRdsByte = (b: number): string => {
  if (b >= 0x20 && b <= 0x7E) return String.fromCharCode(b);
  if (RDS_G2_MAP[b]) return RDS_G2_MAP[b];
  return '.';
};

// Helper to get safe ASCII character
const toAscii = (val: number) => {
    return decodeRdsByte(val);
};

const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const renderHighlightedPart = (text: string, query: string) => {
    if (!query) return text;
    const escapedQuery = escapeRegExp(query);
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
    return (
        <>
            {parts.map((p, i) => 
                p.toLowerCase() === query.toLowerCase() 
                    ? <span key={i} className="bg-yellow-400 text-black font-bold rounded-sm px-[1px]">{p}</span> 
                    : p
            )}
        </>
    );
};

const GroupStatItem: React.FC<{
    grp: string;
    count: number;
    percentage: string;
    hasData: boolean;
    bgStyle: string;
    colorClass: string;
    onClick?: () => void;
}> = ({ grp, count, percentage, hasData, bgStyle, colorClass, onClick }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleMouseEnter = () => {
        timerRef.current = setTimeout(() => {
            setShowTooltip(true);
        }, 200);
    };

    const handleMouseLeave = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setShowTooltip(false);
    };

    const description = GROUP_DESCRIPTIONS[grp];

    return (
        <div 
            className={`relative flex flex-col items-center justify-center p-1.5 rounded border ${bgStyle} transition-colors group cursor-default`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={onClick}
        >
            {/* Wrap content in a div to apply opacity only to content, not the tooltip */}
            <div className={`flex flex-col items-center w-full ${!hasData ? 'opacity-50' : ''}`}>
                <span className={`text-[10px] font-bold ${colorClass}`}>{grp}</span>
                <div className="flex flex-col items-center leading-none mt-1">
                    <span className="text-xs font-mono font-bold">{percentage}%</span>
                    <span className="text-[9px] text-white mt-0.5">{count}</span>
                </div>
            </div>
            
            {showTooltip && description && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-slate-800 text-white text-[10px] font-mono rounded border border-slate-600 shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-50 animate-in fade-in zoom-in-95 duration-200 whitespace-nowrap pointer-events-none">
                    {description}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-slate-600"></div>
                </div>
            )}
        </div>
    );
};

const ChartBody = React.memo(({ chartData, onClose }: { chartData: any[], onClose: () => void }) => {
  const renderLegend = React.useCallback((props: any) => {
    const { payload } = props;
    const sortedPayload = [...(payload || [])].sort((a: any, b: any) => ALL_GROUPS.indexOf(a.value) - ALL_GROUPS.indexOf(b.value));
    
    return (
      <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-xs pt-6">
        {sortedPayload.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-300">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }, []);

  return createPortal(
  <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
    <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <h2 className="text-slate-200 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
          Group Distribution Chart
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="flex-1 p-2 md:p-6 flex flex-row gap-4 md:gap-6 overflow-hidden">
        {chartData.length === 0 ? (
          <div className="flex w-full items-center justify-center text-slate-500 italic">
            Function unavailable: No RDS group has been detected yet.
          </div>
        ) : (
          <>
            {/* Pie Chart */}
            <div className="flex-1 min-w-0 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="percentage"
                    nameKey="name"
                    isAnimationActive={false}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    separator=": "
                    formatter={(value: any, name: any, props: any) => [`${props.payload.percentage}%`, `Group ${name}`]}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Legend content={renderLegend} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Bar Chart */}
            <div className="flex-1 min-w-0 h-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" fontSize={10} tickFormatter={(val) => `${val}%`} />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={40} />
                    <RechartsTooltip 
                      cursor={{fill: '#1e293b'}}
                      labelFormatter={() => ''}
                      labelStyle={{ display: 'none', margin: 0 }}
                      separator=": "
                      formatter={(value: any, name: any, props: any) => [`${props.payload.percentage}%`, `Group ${props.payload.name}`]}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', padding: '10px' }}
                      itemStyle={{ color: '#f8fafc' }}
                    />
                    <Bar dataKey="percentage" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  </div>,
  document.body
  );
});

const generateChartData = (currentData: RdsData) => {
    const errorCount = currentData.groupCounts["--"] || 0;
    const validTotal = Math.max(0, currentData.groupTotal - errorCount);
    
    let newData = ALL_GROUPS.map(grp => {
      const count = currentData.groupCounts[grp] || 0;
      const percentage = validTotal > 0 ? ((count / validTotal) * 100).toFixed(1) : "0.0";
      return {
        name: grp,
        count: count,
        percentage: parseFloat(percentage),
        fill: HEX_COLORS[GROUP_COLORS[grp] || GROUP_COLORS["default"]] || "#cbd5e1"
      };
    }).filter(item => item.percentage > 0);
    
    // Sort by percentage descending
    newData.sort((a, b) => b.percentage - a.percentage);
    return newData;
};

const GroupDistributionChart: React.FC<{
  data: RdsData;
  onClose: () => void;
}> = ({ data, onClose }) => {
  const [chartData, setChartData] = useState<any[]>(() => generateChartData(data));
  const dataRef = useRef(data);

  // We assign current data continuously without causing re-renders of the chart
  dataRef.current = data;

  // Update immediately on mount, then every 3 seconds
  useEffect(() => {
    const updateData = () => {
      setChartData(generateChartData(dataRef.current));
    };

    // No need to update immediately since it's initialized correctly
    const interval = setInterval(updateData, 3000);
    return () => clearInterval(interval);
  }, []);

  return <ChartBody chartData={chartData} onClose={onClose} />;
};

export const GroupAnalyzer: React.FC<GroupAnalyzerProps> = ({ data, active, onToggle, onReset }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const detailLogRef = useRef<HTMLDivElement>(null);
  // References for the 4 hex columns
  const hexLogRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  const [viewMode, setViewMode] = useState<ViewMode>('STREAM');
  
  // Pause State
  const [isPaused, setIsPaused] = useState(false);
  const [frozenSequence, setFrozenSequence] = useState<string[]>([]);

  // Hex Viewer State
  const [hexCols, setHexCols] = useState<string[]>(() => {
      const saved = localStorage.getItem('rds_hex_cols');
      return saved ? JSON.parse(saved) : ["0A", "2A", "3A", "15A"];
  });
  // Use stable objects with IDs for logs to prevent rendering artifacts/jumping
  const [hexLogs, setHexLogs] = useState<Record<number, LogItem[]>>({ 0: [], 1: [], 2: [], 3: [] });

  // Detailed Viewer State
  const [detailGroup, setDetailGroup] = useState<string>(() => localStorage.getItem('rds_detail_group') || "0A");
  const [detailLogs, setDetailLogs] = useState<LogItem[]>([]);
  const [detailSearchQuery, setDetailSearchQuery] = useState<string>('');
  const [showChart, setShowChart] = useState<boolean>(false);
  const handleCloseChart = useCallback(() => setShowChart(false), []);

  // ODA Detection State
  const [odaLogs, setOdaLogs] = useState<string[]>([]);
  const [slcLogs, setSlcLogs] = useState<string[]>([]);
  const dabTargetGroupRef = useRef<string | null>(null);
  const dabInfoRef = useRef<string>("");
  const tmcTargetGroupRef = useRef<string | null>(null);
  const tmcInfoRef = useRef<string>("");

  // Unique ID generator for log items
  const logIdCounter = useRef<number>(0);

  useEffect(() => {
      localStorage.setItem('rds_hex_cols', JSON.stringify(hexCols));
  }, [hexCols]);

  useEffect(() => {
      localStorage.setItem('rds_detail_group', detailGroup);
  }, [detailGroup]);

  // Reset search query when the Group Monitor is closed
  useEffect(() => {
      if (!active) {
          setDetailSearchQuery('');
      }
  }, [active]);

  // Helper to ensure scroll happens after paint
  const scrollToBottom = (element: HTMLElement | null) => {
      if (!element) return;
      requestAnimationFrame(() => {
          element.scrollTop = element.scrollHeight;
      });
  };

  // Monitor TMC Provider Name changes and update ODA logs
  useEffect(() => {
      if (isPaused) return;
      const providerName = data.tmcServiceInfo?.providerName;
      if (providerName && providerName !== "[Identifying...]") {
          const newInfo = ` -> Provider Name: ${providerName}`;
          if (tmcInfoRef.current !== newInfo) {
              tmcInfoRef.current = newInfo;
              if (tmcTargetGroupRef.current) {
                  setOdaLogs(prev => {
                      const idx = prev.findIndex(l => l.includes('TMC (Traffic Message Channel) [CD46]'));
                      if (idx !== -1) {
                          const next = [...prev];
                          next[idx] = `ODA detected: TMC (Traffic Message Channel) [CD46] on Group ${tmcTargetGroupRef.current}${newInfo}`;
                          return next;
                      }
                      return prev;
                  });
              }
          }
      }
  }, [data.tmcServiceInfo?.providerName, isPaused]);

  // Handle auto-scroll for main analyzer (Stream)
  // Only scroll if active AND not paused
  useEffect(() => {
    if (active && !isPaused && containerRef.current && viewMode === 'STREAM') {
        scrollToBottom(containerRef.current);
    }
  }, [data.groupSequence.length, active, viewMode, isPaused]);

  // Handle auto-scroll for Detail Viewer
  useEffect(() => {
    if (viewMode === 'DETAIL' && !isPaused && detailLogRef.current) {
        scrollToBottom(detailLogRef.current);
    }
  }, [detailLogs, viewMode, isPaused]);

  // Handle auto-scroll for Hex Viewer columns
  useEffect(() => {
      if (viewMode === 'HEX' && !isPaused) {
          hexLogRefs.current.forEach(ref => scrollToBottom(ref));
      }
  }, [hexLogs, viewMode, isPaused]);

  // Handle ODA Detection (Independent of View Mode)
  useEffect(() => {
      if (isPaused) return; // Skip updates if paused

      if (data.recentGroups.length > 0) {
          data.recentGroups.forEach(grp => {
              if (grp.type === '3A') {
                  const aidHex = grp.blocks[3].toString(16).toUpperCase().padStart(4, '0');
                  
                  // Decode Target Group from Block 2 (bits 4-0)
                  const appGroupCode = grp.blocks[1] & 0x1F;
                  const groupNum = appGroupCode >> 1;
                  const groupVer = (appGroupCode & 1) ? 'B' : 'A';
                  const targetGroup = `${groupNum}${groupVer}`;
                  
                  const odaName = ODA_MAP[aidHex] || "Unknown ODA!";

                  if (aidHex === '0093') {
                      dabTargetGroupRef.current = targetGroup;
                  }
                  if (aidHex === 'CD46') {
                      tmcTargetGroupRef.current = targetGroup;
                  }
                  
                  let logLine = `ODA detected: ${odaName} [${aidHex}] on Group ${targetGroup}`;
                  
                  // If info is already available for DAB ODA, format line according to user request
                  if (aidHex === '0093' && dabInfoRef.current) {
                      logLine = `ODA detected: ${odaName} [${aidHex}] on Group ${targetGroup}${dabInfoRef.current}`;
                  }
                  if (aidHex === 'CD46' && tmcInfoRef.current) {
                      logLine = `ODA detected: ${odaName} [${aidHex}] on Group ${targetGroup}${tmcInfoRef.current}`;
                  }

                  setOdaLogs(prev => {
                      if (aidHex === '0093') {
                          const existingIdx = prev.findIndex(l => l.includes('DAB Cross-Referencing [0093]'));
                          if (existingIdx !== -1) {
                              if (prev[existingIdx] === logLine) return prev;
                              const next = [...prev];
                              next[existingIdx] = logLine;
                              return next;
                          }
                      }
                      if (aidHex === 'CD46') {
                          const existingIdx = prev.findIndex(l => l.includes('TMC (Traffic Message Channel) [CD46]'));
                          if (existingIdx !== -1) {
                              if (prev[existingIdx] === logLine) return prev;
                              const next = [...prev];
                              next[existingIdx] = logLine;
                              return next;
                          }
                      }
                      if (prev.includes(logLine)) return prev;
                      return [logLine, ...prev].slice(0, 5);
                  });
              }

              // Process data packets for DAB ODA if the target group is known
              if (dabTargetGroupRef.current && grp.type === dabTargetGroupRef.current) {
                  const eid = grp.blocks[3].toString(16).toUpperCase().padStart(4, '0');
                  const freqK = grp.blocks[2] * 16;
                  const freqM = (freqK / 1000).toFixed(3);
                  const channel = DAB_CHANNELS[freqM] || "??";
                  
                  const newInfo = ` -> EID = ${eid} / Channel = ${channel}`;
                  if (dabInfoRef.current !== newInfo) {
                      dabInfoRef.current = newInfo;
                      // Refresh logs to show new data
                      setOdaLogs(prev => {
                          const idx = prev.findIndex(l => l.includes('DAB Cross-Referencing [0093]'));
                          if (idx !== -1) {
                              const next = [...prev];
                              next[idx] = `ODA detected: DAB Cross-Referencing [0093] on Group ${dabTargetGroupRef.current}${newInfo}`;
                              return next;
                          }
                          return prev;
                      });
                  }
              }
          });

          // SLC Detection for Group 1A
          data.recentGroups.forEach(grp => {
              if (grp.type === '1A') {
                  const block3 = grp.blocks[2];
                  if (!isNaN(block3)) {
                      const variant = (block3 >> 12) & 0x7;
                      const services: string[] = [];
                      
                      if (variant === 0) {
                          if (((block3 >> 8) & 0xF) > 0) services.push("Paging");
                          if ((block3 & 0xFF) > 0) services.push("Extended Country Code");
                      } else if (variant === 1) {
                          services.push("TMC identification");
                      } else if (variant === 2) {
                          services.push("Paging identification");
                      } else if (variant === 3) {
                          services.push("Language Identification Code");
                      } else if (variant === 4 || variant === 5) {
                          services.push("Unassigned SLC");
                      } else if (variant === 6) {
                          services.push("Specific application developed by the broadcaster");
                      } else if (variant === 7) {
                          services.push("EWS channel identification");
                      }
                      
                      if (services.length > 0) {
                          setSlcLogs(prev => {
                              let next = [...prev];
                              let changed = false;
                              services.forEach(s => {
                                  if (!next.includes(s)) {
                                      next.push(s);
                                      changed = true;
                                  }
                              });
                              return changed ? next : prev;
                          });
                      }
                  }
              }
          });
      }
  }, [data.recentGroups, isPaused]);

  // Handle Incoming Data for Viewers
  useEffect(() => {
    if (isPaused) return; // Skip updates if paused

    if ((viewMode === 'HEX' || viewMode === 'DETAIL') && data.recentGroups.length > 0) {
        
        if (viewMode === 'HEX') {
            setHexLogs(prev => {
                const next = { ...prev };
                let changed = false;

                data.recentGroups.forEach(grp => {
                    const packetHex = grp.blocks.map(b => isNaN(b) ? '----' : b.toString(16).toUpperCase().padStart(4, '0')).join(' ');
                    // Format: Time PacketHex
                    const line = `${grp.time}   ${packetHex}`;

                    // Check each column
                    hexCols.forEach((colType, colIndex) => {
                        if (grp.type === colType) {
                            const currentLog = next[colIndex] || [];
                            // Append to bottom, keep last 50
                            const newItem: LogItem = { id: logIdCounter.current++, text: line };
                            const newLog = [...currentLog, newItem].slice(-50);
                            next[colIndex] = newLog;
                            changed = true;
                        }
                    });
                });
                return changed ? next : prev;
            });
        } 
        else if (viewMode === 'DETAIL') {
            setDetailLogs(prev => {
                let next = [...prev];
                let changed = false;

                data.recentGroups.forEach(grp => {
                    if (grp.type === detailGroup) {
                        const [g1, g2, g3, g4] = grp.blocks;
                        const hex = grp.blocks.map(b => isNaN(b) ? '----' : b.toString(16).toUpperCase().padStart(4, '0')).join(' ');
                        
                        // Detailed Breakdown
                        const type = (g2 >> 12) & 0xF;
                        const version = (g2 >> 11) & 1;
                        const tp = (g2 >> 10) & 1;
                        const pty = (g2 >> 5) & 0x1F;
                        const b2Rest = g2 & 0x1F;
                        const groupTypeStr = `${type}${version === 0 ? 'A' : 'B'}`;
                        const tpStr = tp.toString();
                        const ptyBin = pty.toString(2).padStart(5, '0');
                        const b2RestBin = b2Rest.toString(2).padStart(5, '0');
                        
                        const b3H = (g3 >> 8) & 0xFF;
                        const b3L = g3 & 0xFF;
                        const b4H = (g4 >> 8) & 0xFF;
                        const b4L = g4 & 0xFF;

                        const b3HighBin = b3H.toString(2).padStart(8, '0');
                        const b3LowBin = b3L.toString(2).padStart(8, '0');
                        const b4HighBin = b4H.toString(2).padStart(8, '0');
                        const b4LowBin = b4L.toString(2).padStart(8, '0');

                        const dec3H = b3H.toString().padStart(3, ' ');
                        const dec3L = b3L.toString().padStart(3, ' ');
                        const dec4H = b4H.toString().padStart(3, ' ');
                        const dec4L = b4L.toString().padStart(3, ' ');

                        const char3H = (b3H >= 0x20 && b3H <= 0x9F) ? decodeRdsByte(b3H) : '.';
                        const char3L = (b3L >= 0x20 && b3L <= 0x9F) ? decodeRdsByte(b3L) : '.';
                        const char4H = (b4H >= 0x20 && b4H <= 0x9F) ? decodeRdsByte(b4H) : '.';
                        const char4L = (b4L >= 0x20 && b4L <= 0x9F) ? decodeRdsByte(b4L) : '.';

                        // Layout: TIME (8 chars) | HEX (19 chars) | NEW FORMAT
                        const line = `${grp.time}      ${hex}\u0003${groupTypeStr.padEnd(3, ' ')} ${tpStr}\u0001${ptyBin} ${b2RestBin}  ${b3HighBin} ${b3LowBin}  ${b4HighBin} ${b4LowBin}\u0002${dec3H} ${dec3L} ${dec4H} ${dec4L}\u0002'${char3H}${char3L}' '${char4H}${char4L}'`;
                        
                        // Append to bottom, keep last 1000 lines for 8A (at least 1 minute of data), 200 for others
                        const newItem: LogItem = { id: logIdCounter.current++, text: line };
                        const limit = detailGroup === "8A" ? 1000 : 200;
                        next = [...next, newItem].slice(-limit); 
                        changed = true;
                    }
                });
                return changed ? next : prev;
            });
        }
    }
  }, [data.recentGroups, viewMode, hexCols, detailGroup, isPaused]);

  const toggleMode = (mode: ViewMode) => {
      if (viewMode === mode) {
          setViewMode('STREAM'); // Toggle off -> go back to stream
          if (mode === 'DETAIL') setDetailSearchQuery('');
      } else {
          setViewMode(mode);
          if (mode === 'DETAIL') {
              setDetailLogs([]);
          } else {
              setDetailSearchQuery('');
          }
          if (mode === 'HEX') setHexLogs({ 0: [], 1: [], 2: [], 3: [] });
      }
  };

  const updateHexCol = (idx: number, type: string) => {
      setHexCols(prev => {
          const next = [...prev];
          next[idx] = type;
          return next;
      });
      setHexLogs(prev => ({ ...prev, [idx]: [] }));
  };

  const updateDetailGroup = (type: string) => {
      setDetailGroup(type);
      setDetailLogs([]);
  };

  const togglePause = () => {
    if (!isPaused) {
        // Pausing: Snapshot current sequence
        setFrozenSequence(data.groupSequence);
    }
    setIsPaused(!isPaused);
  };

  // Reset internal ODA logs and Pause state when reset is called from parent
  useEffect(() => {
      if (data.groupTotal === 0) {
          setOdaLogs([]);
          setSlcLogs([]);
          setHexLogs({ 0: [], 1: [], 2: [], 3: [] });
          setDetailLogs([]);
          setIsPaused(false);
          setFrozenSequence([]);
          dabTargetGroupRef.current = null;
          dabInfoRef.current = "";
          tmcTargetGroupRef.current = null;
          tmcInfoRef.current = "";
      }
  }, [data.groupTotal]);

  // Explicitly reset ODA logs and viewer logs when PI changes (station change)
  useEffect(() => {
      setOdaLogs([]);
      setSlcLogs([]);
      setHexLogs({ 0: [], 1: [], 2: [], 3: [] });
      setDetailLogs([]);
      dabTargetGroupRef.current = null;
      dabInfoRef.current = "";
      tmcTargetGroupRef.current = null;
      tmcInfoRef.current = "";
  }, [data.pi]);

  // Determine what to display for Stream View
  const displaySequence = isPaused ? frozenSequence : data.groupSequence;

  const groupCountDeps = ALL_GROUPS.map(g => !!data.groupCounts[g]).join(',');
  const groupOptions = useMemo(() => {
    return ALL_GROUPS.map(g => (
        <option key={g} value={g} className="bg-slate-800 text-white">
            {g}{data.groupCounts[g] ? ' 🟢' : ''}
        </option>
    ));
  }, [groupCountDeps]);

  const filteredDetailLogs = useMemo(() => {
      if (!detailSearchQuery) return detailLogs;
      return detailLogs.filter(log => log.text.toUpperCase().includes(detailSearchQuery.toUpperCase()));
  }, [detailLogs, detailSearchQuery]);

  return (
    <div className={`border rounded-lg transition-all duration-300 overflow-hidden relative ${active ? 'bg-black border-slate-700' : 'bg-slate-900/30 border-slate-800'}`}>
      
      {/* Header / Controls */}
      <div className="flex justify-between items-center p-3 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-3">
              <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002 2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                Group Monitor
              </h3>
              {active && !isPaused && <span className="text-[10px] text-green-500 font-mono animate-pulse">● RUNNING</span>}
              {active && isPaused && <span className="text-[10px] text-yellow-500 font-mono">● PAUSED</span>}
          </div>
          
          <div className="flex items-center gap-2">
              <button
                  onClick={() => toggleMode('DETAIL')}
                  className={`px-2 py-1 text-[10px] uppercase font-bold rounded border transition-colors ${viewMode === 'DETAIL' ? 'bg-blue-900 text-blue-200 border-blue-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
              >
                  {viewMode === 'DETAIL' ? 'CLOSE GROUP CONTENT' : 'SHOW GROUP CONTENT'}
              </button>

              <button
                  onClick={() => toggleMode('HEX')}
                  className={`px-2 py-1 text-[10px] uppercase font-bold rounded border transition-colors ${viewMode === 'HEX' ? 'bg-blue-900 text-blue-200 border-blue-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
              >
                  {viewMode === 'HEX' ? 'CLOSE HEX VIEWER' : 'SHOW HEX VALUES'}
              </button>
              
              <div className="w-px h-4 bg-slate-700 mx-1"></div>

              <button 
                 onClick={onReset}
                 disabled={!active && data.groupTotal === 0}
                 className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                 Reset
              </button>

              <button 
                onClick={togglePause} 
                disabled={!active}
                className={`px-3 py-1 text-[10px] uppercase font-bold rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isPaused ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/50 hover:bg-yellow-500/20' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
              >
                 {isPaused ? 'Resume' : 'Pause'}
              </button>

              <button 
                 onClick={onToggle}
                 className={`px-3 py-1 text-[10px] uppercase font-bold rounded border transition-colors ${active ? 'bg-red-500/10 text-red-400 border-red-500/50 hover:bg-red-500/20' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
              >
                 {active ? 'Stop' : 'Start'}
              </button>
          </div>
      </div>

      {active && (
        <>
            {/* ODA & SLC Detection Display */}
            {(odaLogs.length > 0 || slcLogs.length > 0) && (
                <div className="bg-slate-950 border-b border-slate-800 p-2">
                    {slcLogs.length > 0 && (
                        <div className="text-[11px] font-mono text-yellow-500 border-l-2 border-yellow-500/50 pl-2 mb-0.5 last:mb-0">
                            {slcLogs.length === 1 ? "Slow Labelling Code found on Group 1A" : "Slow Labelling Codes found on Group 1A"}: {slcLogs.join(" + ")}
                        </div>
                    )}
                    {odaLogs.map((log, index) => (
                        <div key={`oda-${index}`} className="text-[11px] font-mono text-green-400 border-l-2 border-green-500/50 pl-2 mb-0.5 last:mb-0">
                            {log}
                        </div>
                    ))}
                </div>
            )}

            {/* STREAM MODE (Default) */}
            {viewMode === 'STREAM' && (
                <div 
                    ref={containerRef}
                    className="p-3 font-mono text-xs leading-5 break-all shadow-inner h-48 overflow-hidden bg-black text-slate-300 selection:bg-slate-700 border-b border-slate-800"
                >
                    <div className="flex flex-wrap gap-y-1 content-start">
                        {displaySequence.map((grp, i) => (
                            <span key={i} className={`font-bold inline-block w-8 text-center ${getGroupColor(grp)}`}>
                                {grp}
                            </span>
                        ))}
                        {displaySequence.length === 0 && <span className="text-slate-600 italic">Waiting for incoming groups...</span>}
                    </div>
                </div>
            )}

            {/* DETAIL MODE */}
            {viewMode === 'DETAIL' && (
                <div className="h-96 bg-black flex flex-col border-b border-slate-800">
                     <div className="p-2 bg-slate-900 border-b border-slate-800 flex justify-between items-center flex-wrap gap-2">
                         <div className="flex items-center gap-2 flex-wrap">
                             <span className="text-slate-400 text-[10px] font-bold uppercase hidden sm:inline">Select Group to Monitor:</span>
                             <div className="relative min-w-[70px]">
                                 <div className="absolute inset-0 bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded border border-slate-700 pointer-events-none flex items-center justify-between">
                                     <span>{detailGroup}</span>
                                     <svg className="w-2.5 h-2.5 ml-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                 </div>
                                 <select 
                                     value={detailGroup}
                                     onChange={(e) => updateDetailGroup(e.target.value)}
                                     className="w-full text-[10px] font-bold py-1 px-2 rounded border border-transparent focus:outline-none cursor-pointer appearance-none relative z-10"
                                     style={{ color: 'transparent', backgroundColor: 'transparent' }}
                                 >
                                     {groupOptions}
                                 </select>
                             </div>
                             
                             <div className="w-px h-4 bg-slate-700 mx-1 hidden sm:block"></div>
                             
                             <div className="relative flex items-center">
                                 <input 
                                     type="text" 
                                     placeholder="Search..."
                                     value={detailSearchQuery}
                                     onChange={(e) => setDetailSearchQuery(e.target.value.toUpperCase())}
                                     className="bg-slate-800 text-white text-[10px] font-bold py-1 px-2 pr-6 rounded border border-slate-700 focus:outline-none focus:border-slate-500 w-[80px] sm:w-[120px]"
                                 />
                                 {detailSearchQuery && (
                                     <button 
                                         onClick={() => setDetailSearchQuery('')}
                                         className="absolute right-1 text-red-500 hover:text-red-400 p-0.5"
                                     >
                                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                     </button>
                                 )}
                             </div>
                         </div>
                         <span className="text-[10px] text-slate-500 font-mono uppercase hidden md:inline">Binary & ASCII Decoding</span>
                     </div>
                     
                     <div className="flex-1 overflow-y-auto p-4 font-mono text-xs custom-scrollbar bg-black" ref={detailLogRef}>
                         {filteredDetailLogs.map((item) => (
                             <div key={item.id} className="text-green-400 whitespace-pre hover:bg-slate-900/50">
                                 <span className="hidden md:inline">{renderHighlightedPart(item.text.substring(0, 14), detailSearchQuery)}</span>
                                 {item.text.substring(14).split(/(\u0001|\u0002|\u0003)/).map((part, i) => {
                                     if (part === '\u0003') return <React.Fragment key={i}><span className="hidden md:inline">{"      "}</span><span className="md:hidden">{"   "}</span></React.Fragment>;
                                     if (part === '\u0001') return <React.Fragment key={i}><span className="hidden md:inline">{"      "}</span><span className="md:hidden">{" "}</span></React.Fragment>;
                                     if (part === '\u0002') return <React.Fragment key={i}><span className="hidden md:inline">{"      "}</span><span className="md:hidden">{"  "}</span></React.Fragment>;
                                     return <React.Fragment key={i}>{renderHighlightedPart(part, detailSearchQuery)}</React.Fragment>;
                                 })}
                             </div>
                         ))}
                         {filteredDetailLogs.length === 0 && (
                             <div className="text-slate-700 italic text-center mt-10">
                                {isPaused ? 'Viewer Paused' : (detailSearchQuery ? 'No results found' : `Waiting for Group ${detailGroup} data...`)}
                             </div>
                         )}
                     </div>
                </div>
            )}

            {/* HEX VIEWER MODE */}
            {viewMode === 'HEX' && (
                <div className="h-96 bg-black p-4 border-b border-slate-800 grid grid-cols-4 gap-4 overflow-hidden relative z-10">
                     {[0, 1, 2, 3].map(colIdx => (
                         <div key={colIdx} className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded overflow-hidden">
                             {/* Column Header */}
                             <div className="flex justify-between items-center p-2 bg-slate-900 border-b border-slate-800">
                                 <div className="relative w-full">
                                     <div className="absolute inset-0 bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded border border-slate-700 pointer-events-none flex items-center justify-center text-center">
                                         <span>{hexCols[colIdx]}</span>
                                     </div>
                                     <select 
                                         value={hexCols[colIdx]}
                                         onChange={(e) => updateHexCol(colIdx, e.target.value)}
                                         className="w-full text-[10px] font-bold py-1 px-2 rounded border border-transparent focus:outline-none appearance-none cursor-pointer text-center relative z-10"
                                         style={{ color: 'transparent', backgroundColor: 'transparent' }}
                                     >
                                         {groupOptions}
                                     </select>
                                 </div>
                             </div>

                             {/* Log Area */}
                             <div 
                                ref={(el) => { hexLogRefs.current[colIdx] = el; }}
                                className="flex-1 overflow-y-auto p-2 font-mono text-[10px] space-y-0.5 custom-scrollbar bg-black"
                             >
                                 {hexLogs[colIdx]?.map((item) => (
                                     <div key={item.id} className="text-green-400 whitespace-pre">
                                         <span className="hidden md:inline">{item.text.substring(0, 11)}</span>
                                         {item.text.substring(11)}
                                     </div>
                                 ))}
                                 {(!hexLogs[colIdx] || hexLogs[colIdx].length === 0) && (
                                     <div className="text-slate-700 italic text-center mt-10">
                                         
                                     </div>
                                 )}
                             </div>
                         </div>
                     ))}
                </div>
            )}

            {/* Statistics Section (Always visible) */}
            <div className="p-4 bg-slate-900/50">
                <div className="flex items-center justify-between mb-3">
                     <div className="flex items-center gap-2">
                         <span className="text-[10px] uppercase font-bold text-slate-500">Group Distribution Statistics</span>
                         <button 
                            onClick={() => setShowChart(true)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1 rounded transition-colors"
                            title="Show Group Distribution Chart"
                         >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                         </button>
                     </div>
                     <span className="text-[10px] uppercase font-bold text-slate-400">Total Packets: <span className="text-white">{data.groupTotal.toLocaleString()}</span></span>
                </div>
                
                <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                    {ALL_GROUPS.map(grp => {
                        const errorCount = data.groupCounts["--"] || 0;
                        const validTotal = Math.max(0, data.groupTotal - errorCount);

                        const count = data.groupCounts[grp] || 0;
                        const percentage = validTotal > 0 ? ((count / validTotal) * 100).toFixed(1) : "0.0";
                        const hasData = count > 0;
                        
                        let bgStyle = "bg-slate-950/50 border-slate-800";
                        if (hasData) {
                             bgStyle = "bg-slate-800 border-slate-600 text-slate-200 shadow-sm";
                        }

                        return (
                            <GroupStatItem 
                                key={grp}
                                grp={grp}
                                count={count}
                                percentage={percentage}
                                hasData={hasData}
                                bgStyle={bgStyle}
                                colorClass={getGroupColor(grp)}
                                onClick={() => {
                                    if (viewMode !== 'DETAIL') {
                                        setViewMode('DETAIL');
                                    }
                                    updateDetailGroup(grp);
                                }}
                            />
                        );
                    })}
                </div>
            </div>
        </>
      )}
      
      {!active && (
         <div className="p-8 text-center text-slate-400 italic text-xs bg-[#0f172a]">
            Group Monitor is currently disabled. Click "Start" to view and analyze the stream.
         </div>
      )}

      {showChart && <GroupDistributionChart data={data} onClose={handleCloseChart} />}
    </div>
  );
};
