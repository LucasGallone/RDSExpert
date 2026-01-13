import React, { useRef, useEffect, useState } from 'react';
import { RdsData } from '../types';
import { ODA_MAP } from '../constants';

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
    // 5: TDC (Violet)
    "5A": "text-violet-400",
    "5B": "text-violet-400",
    // 6: IH (Violet)
    "6A": "text-violet-400",
    "6B": "text-violet-400",
    // 7: RP (Violet)
    "7A": "text-violet-400",
    "7B": "text-violet-400",
    // 8: TMC (Red)
    "8A": "text-red-500",
    "8B": "text-red-500",
    // 9: EWS (Violet)
    "9A": "text-violet-400",
    "9B": "text-violet-400",
    // 10: PTYN (Orange)
    "10A": "text-orange-400",
    "10B": "text-orange-400",
    // 11: ODA (Violet)
    "11A": "text-violet-400",
    "11B": "text-violet-400",
    // 12: RT+ (Violet)
    "12A": "text-violet-400",
    "12B": "text-violet-400",
    // 13: RP (Violet)
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

const GROUP_DESCRIPTIONS: Record<string, string> = {
    "0A": "PI, PS, AF, PTY, Flags",
    "0B": "PI, PS, PTY, Flags",
    "1A": "ECC, LIC, PIN",
    "1B": "ECC, LIC, PIN",
    "2A": "Radiotext",
    "2B": "Radiotext",
    "3A": "ODA AIDs List",
    "3B": "ODA AIDs List",
    "4A": "CT (Time & Date)",
    "4B": "CT (Time & Date)",
    "5A": "TDC / ODA",
    "5B": "TDC / ODA",
    "6A": "ODA / In-House Applications",
    "6B": "ODA / In-House Applications",
    "7A": "ODA / Paging",
    "7B": "ODA / Paging",
    "8A": "TMC",
    "8B": "TMC",
    "9A": "EWS (Emergency Warning System)",
    "9B": "EWS (Emergency Warning System)",
    "10A": "PTYN",
    "10B": "PTYN",
    "11A": "ODA",
    "11B": "ODA",
    "12A": "ODA",
    "12B": "ODA",
    "13A": "ODA / Enhanced Paging",
    "13B": "ODA / Enhanced Paging",
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

// Helper to get safe ASCII char
const toAscii = (val: number) => {
    if (val >= 32 && val <= 126) return String.fromCharCode(val);
    return '.';
};

const GroupStatItem: React.FC<{
    grp: string;
    count: number;
    percentage: string;
    hasData: boolean;
    bgStyle: string;
    colorClass: string;
}> = ({ grp, count, percentage, hasData, bgStyle, colorClass }) => {
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

export const GroupAnalyzer: React.FC<GroupAnalyzerProps> = ({ data, active, onToggle, onReset }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const detailLogRef = useRef<HTMLDivElement>(null);
  // Refs for the 4 hex columns
  const hexLogRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  const [viewMode, setViewMode] = useState<ViewMode>('STREAM');
  
  // Pause State
  const [isPaused, setIsPaused] = useState(false);
  const [frozenSequence, setFrozenSequence] = useState<string[]>([]);

  // Hex Viewer State
  const [hexCols, setHexCols] = useState<string[]>(["0A", "2A", "3A", "15A"]);
  // Use stable objects with IDs for logs to prevent rendering artifacts/jumping
  const [hexLogs, setHexLogs] = useState<Record<number, LogItem[]>>({ 0: [], 1: [], 2: [], 3: [] });

  // Detailed Viewer State
  const [detailGroup, setDetailGroup] = useState<string>("0A");
  const [detailLogs, setDetailLogs] = useState<LogItem[]>([]);

  // ODA Detection State
  const [odaLogs, setOdaLogs] = useState<string[]>([]);
  const dabTargetGroupRef = useRef<string | null>(null);
  const dabInfoRef = useRef<string>("");

  // Unique ID generator for log items
  const logIdCounter = useRef<number>(0);

  // Helper to ensure scroll happens after paint
  const scrollToBottom = (element: HTMLElement | null) => {
      if (!element) return;
      requestAnimationFrame(() => {
          element.scrollTop = element.scrollHeight;
      });
  };

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
                  
                  const odaName = ODA_MAP[aidHex] || "Unknown ODA";

                  if (aidHex === '0093') {
                      dabTargetGroupRef.current = targetGroup;
                  }
                  
                  let logLine = `ODA detected (3A): ${odaName} [${aidHex}] on Group ${targetGroup}`;
                  
                  // If info is already available for DAB ODA, format line according to user request
                  if (aidHex === '0093' && dabInfoRef.current) {
                      logLine = `ODA detected (3A): ${odaName} [${aidHex}] on Group ${targetGroup}${dabInfoRef.current}`;
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
                              next[idx] = `ODA detected (3A): DAB Cross-Referencing [0093] on Group ${dabTargetGroupRef.current}${newInfo}`;
                              return next;
                          }
                          return prev;
                      });
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
                    const packetHex = grp.blocks.map(b => b.toString(16).toUpperCase().padStart(4, '0')).join(' ');
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
                        const hex = grp.blocks.map(b => b.toString(16).toUpperCase().padStart(4, '0')).join(' ');
                        
                        // Detailed Breakdown
                        const b2Bin = toBin(g2, 16); 
                        const b3Bin = toBin(g3, 16);
                        const b4Bin = toBin(g4, 16);

                        // ASCII decoding for Blocks 3 & 4 (High byte / Low byte)
                        const chars = [
                            toAscii((g3 >> 8) & 0xFF), toAscii(g3 & 0xFF),
                            toAscii((g4 >> 8) & 0xFF), toAscii(g4 & 0xFF)
                        ].map(c => `'${c}'`).join(' ');

                        // Layout: TIME (8 chars) | HEX (19 chars) | BINS | ASCII
                        const line = `${grp.time}      ${hex}      ${b2Bin}  ${b3Bin}  ${b4Bin}      ${chars}`;
                        
                        // Append to bottom, keep last 100 lines
                        const newItem: LogItem = { id: logIdCounter.current++, text: line };
                        next = [...next, newItem].slice(-100); 
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
      } else {
          setViewMode(mode);
          if (mode === 'DETAIL') setDetailLogs([]);
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
          setHexLogs({ 0: [], 1: [], 2: [], 3: [] });
          setDetailLogs([]);
          setIsPaused(false);
          setFrozenSequence([]);
          dabTargetGroupRef.current = null;
          dabInfoRef.current = "";
      }
  }, [data.groupTotal]);

  // Explicitly reset ODA logs when PI changes (station change)
  useEffect(() => {
      setOdaLogs([]);
      dabTargetGroupRef.current = null;
      dabInfoRef.current = "";
  }, [data.pi]);

  // Determine what to display for Stream View
  const displaySequence = isPaused ? frozenSequence : data.groupSequence;

  return (
    <div className={`border rounded-lg transition-all duration-300 overflow-hidden relative ${active ? 'bg-black border-slate-700' : 'bg-slate-900/30 border-slate-800'}`}>
      
      {/* Header / Controls */}
      <div className="flex justify-between items-center p-3 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-3">
              <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002 2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                Groups Monitor
              </h3>
              {active && !isPaused && <span className="text-[10px] text-green-500 font-mono animate-pulse">● LIVE</span>}
              {active && isPaused && <span className="text-[10px] text-yellow-500 font-mono">● PAUSED</span>}
          </div>
          
          <div className="flex items-center gap-2">
              <button
                  onClick={() => toggleMode('DETAIL')}
                  className={`px-2 py-1 text-[10px] uppercase font-bold rounded border transition-colors ${viewMode === 'DETAIL' ? 'bg-blue-900 text-blue-200 border-blue-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
              >
                  {viewMode === 'DETAIL' ? 'CLOSE GROUPS CONTENT' : 'SHOW GROUPS CONTENT'}
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
            {/* ODA Detection Display */}
            {odaLogs.length > 0 && (
                <div className="bg-slate-950 border-b border-slate-800 p-2">
                    {odaLogs.map((log, index) => (
                        <div key={index} className="text-[11px] font-mono text-green-400 border-l-2 border-green-500/50 pl-2 mb-0.5 last:mb-0">
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
                     <div className="p-2 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                         <div className="flex items-center gap-2">
                             <span className="text-slate-400 text-[10px] font-bold uppercase">Select Group to Monitor:</span>
                             <select 
                                 value={detailGroup}
                                 onChange={(e) => updateDetailGroup(e.target.value)}
                                 className="bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded border border-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer hover:bg-slate-700"
                             >
                                 {ALL_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                             </select>
                         </div>
                         <span className="text-[10px] text-slate-500 font-mono uppercase">Binary & ASCII Decoding</span>
                     </div>
                     
                     <div className="flex-1 overflow-y-auto p-4 font-mono text-xs custom-scrollbar bg-black" ref={detailLogRef}>
                         {detailLogs.map((item) => (
                             <div key={item.id} className="text-green-400 whitespace-pre hover:bg-slate-900/50">
                                 <span className="hidden md:inline">{item.text.substring(0, 14)}</span>
                                 {item.text.substring(14)}
                             </div>
                         ))}
                         {detailLogs.length === 0 && (
                             <div className="text-slate-700 italic text-center mt-10">
                                {isPaused ? 'Viewer Paused' : `Waiting for ${detailGroup} groups...`}
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
                                 <select 
                                     value={hexCols[colIdx]}
                                     onChange={(e) => updateHexCol(colIdx, e.target.value)}
                                     className="w-full bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded border border-slate-700 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer hover:bg-slate-700 text-center"
                                     style={{ backgroundImage: 'none' }}
                                 >
                                     {ALL_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                 </select>
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
                                         {isPaused ? 'Paused' : 'Waiting...'}
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
                     <span className="text-[10px] uppercase font-bold text-slate-500">Group Distribution Statistics</span>
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
                            />
                        );
                    })}
                </div>
            </div>
        </>
      )}
      
      {!active && (
         <div className="p-8 text-center text-slate-400 italic text-xs bg-[#0f172a]">
            Groups Monitor is not currently enabled. Click "Start" to visualize the stream and initiate the analysis.
         </div>
      )}

    </div>
  );
};
