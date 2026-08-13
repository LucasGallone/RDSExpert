
import React, { useState, useEffect } from 'react';
import { RdsData, PTY_RDS, PTY_RBDS, PTY_COMBINED } from '../types';
import { HistoryViewerWrapper } from './HistoryControls';

interface InfoGridProps {
  data: RdsData;
  onEonTaHistoryClick?: () => void;
}

export const InfoGrid: React.FC<InfoGridProps> = ({ data, onEonTaHistoryClick }) => {
  const [sortAf, setSortAf] = useState(() => localStorage.getItem('rds_sort_af') === 'true');
  const [expandedHeader, setExpandedHeader] = useState<string | null>(null);
  const [expandedEon, setExpandedEon] = useState<string | null>(null);
  const [selectedEonPi, setSelectedEonPi] = useState<string | null>(null);
  const [eonSortOrder, setEonSortOrder] = useState<'desc' | 'asc'>(() => {
    const saved = localStorage.getItem('rds_eon_ps_history_sort');
    return (saved === 'asc' || saved === 'desc') ? saved : 'desc';
  });

  const [eonListUnderscores, setEonListUnderscores] = useState(() => {
    const saved = localStorage.getItem('rds_eon_list_underscores');
    return saved !== null ? saved === 'true' : true;
  });

  const [eonHistoryUnderscores, setEonHistoryUnderscores] = useState(() => {
    const saved = localStorage.getItem('rds_eon_history_underscores');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('rds_eon_ps_history_sort', eonSortOrder);
  }, [eonSortOrder]);

  useEffect(() => {
    localStorage.setItem('rds_eon_list_underscores', eonListUnderscores.toString());
  }, [eonListUnderscores]);

  useEffect(() => {
    localStorage.setItem('rds_eon_history_underscores', eonHistoryUnderscores.toString());
  }, [eonHistoryUnderscores]);

  useEffect(() => {
    localStorage.setItem('rds_sort_af', sortAf.toString());
  }, [sortAf]);

  // Method B Logic
  const methodBHeaders = Object.keys(data.afBLists).sort((a, b) => parseFloat(a) - parseFloat(b));
  const isMethodB = data.afType === 'B';
  const methodBCount = methodBHeaders.length;

  const getMethodLabel = () => {
    if (isMethodB) {
        return `METHOD B (${methodBCount} LIST${methodBCount !== 1 ? 'S' : ''})`;
    }
    const afCount = data.af.length;
    const headerStr = data.afHeaderCount !== null ? `EXPECTED: ${data.afHeaderCount} | ` : '';
    return `METHOD A (${headerStr}DECODED: ${afCount})`;
  };

  // Sort function for frequencies (strings)
  const sortFreqs = (arr: string[]) => {
    const fm = arr.filter(f => !f.includes('kHz')).sort((a, b) => parseFloat(a) - parseFloat(b));
    const am = arr.filter(f => f.includes('kHz')).sort((a, b) => {
        const valA = parseInt(a.replace(' kHz', ''));
        const valB = parseInt(b.replace(' kHz', ''));
        return valA - valB;
    });
    return [...fm, ...am];
  };

  // Determine what to display based on Method
  let displayContent;

  if (isMethodB) {
      displayContent = (
          <div className="flex flex-col gap-2">
              {methodBHeaders.length > 0 ? methodBHeaders.map((header) => {
                  const isExpanded = expandedHeader === header;
                  const rawSubList = data.afBLists[header] || [];
                  const subList = sortAf ? sortFreqs(rawSubList) : rawSubList;

                  return (
                    <div key={header} className="bg-slate-900/40 rounded border border-slate-700/50 overflow-hidden">
                        <button 
                            onClick={() => setExpandedHeader(isExpanded ? null : header)}
                            className={`w-full text-left px-4 py-3 font-bold font-mono transition-colors flex justify-between items-center ${isExpanded ? 'bg-blue-900/30 text-blue-200' : 'hover:bg-slate-800 text-slate-300'}`}
                        >
                            <span className="flex items-center gap-3">
                                <span className="text-lg md:text-xl text-white">{header}</span>
                                <span className="text-slate-500 text-[10px] font-sans uppercase tracking-wide mt-1">CLICK TO DISPLAY THE LIST</span>
                            </span>
                            <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400 font-normal">{subList.length} FREQUENCIES</span>
                        </button>
                        
                        {isExpanded && (
                            <div className="p-3 flex flex-wrap gap-2 border-t border-slate-700/50">
                                {subList.map((freq, idx) => (
                                    <span key={idx} className="px-3 py-1 bg-slate-700 text-slate-200 text-xs md:text-sm font-mono rounded border border-slate-600 shadow-sm">
                                        {freq}
                                    </span>
                                ))}
                                {subList.length === 0 && <span className="text-slate-600 text-xs italic">No AFs in this list</span>}
                            </div>
                        )}
                    </div>
                  );
              }) : (
                 <div className="text-slate-600 text-sm italic p-2">Waiting for Method B lists...</div>
              )}
          </div>
      );
  } else {
      // Method A (Cumulative Unique List)
      const rawList = data.af;
      
      // Count frequency of each Alternative Frequency
      const counts: Record<string, number> = {};
      for (const freq of rawList) {
        counts[freq] = (counts[freq] || 0) + 1;
      }

      const uniqueFreqs = Object.keys(counts);
      const head = data.afListHead;
      const remainingFreqs = uniqueFreqs.filter(f => f !== head);

      // Sort remaining frequencies if sortAf is true
      const sortedRemaining = sortAf ? sortFreqs(remainingFreqs) : remainingFreqs;

      // Ensure the head frequency always appears first
      const displayAf = head && counts[head] ? [head, ...sortedRemaining] : sortedRemaining;
      
      displayContent = displayAf.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {displayAf.map((freq, idx) => {
                const isAm = freq.includes('kHz');
                const isHead = data.afListHead === freq;
                const count = counts[freq] || 1;
                let styleClass = "";
                
                if (isHead) {
                    styleClass = "bg-blue-600 border-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.4)]";
                } else if (isAm) {
                    styleClass = "bg-purple-600 border-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]";
                } else {
                    styleClass = "bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600";
                }
                
                return (
                  <span key={idx} className={`px-3 py-1.5 ${styleClass} text-sm font-mono rounded border transition-colors cursor-default shadow-sm flex items-center gap-1.5`}>
                    <span>{freq}</span>
                    {count > 1 && (
                      <span className="text-xs opacity-80 font-bold ml-0.5">
                        (x{count})
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          ) : (
             <div className="flex items-center justify-center h-24 text-slate-400 text-sm italic">
               No AF list detected for now.
             </div>
          );
  }

  // --- RT+ Bit Indicators ---
  const BitIndicator = ({ label, active }: { label: string, active: boolean }) => (
      <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full border border-black/50 shadow-sm transition-all duration-150 ${active ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]' : 'bg-slate-800'}`}></div>
          <span className={`text-[10px] font-bold ${active ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
      </div>
  );

  // EON Data Preparation
  const eonKeys = Object.keys(data.eonData).sort();
  
  // Resolve PTY list based on hybrid standard
  const currentPtyName = (pty: number) => PTY_COMBINED[pty] || "None";

  return (
    <div className="w-full space-y-4">
      {/* AF List Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <div className="flex flex-row justify-between items-center mb-4 gap-2 md:gap-4">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2 min-w-0">
              {/* Radio Tower / Antenna Icon */}
              <i className="fa-solid fa-tower-broadcast text-base shrink-0"></i>
              <span className="truncate">Alternative Frequencies (AF)</span>
              {data.afType !== 'Unknown' && (
                <span className="hidden sm:inline-block ml-2 text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-600 shrink-0">
                  {getMethodLabel()}
                </span>
              )}
            </h3>
            
            <button 
              onClick={() => setSortAf(!sortAf)}
              className={`text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded border transition-colors shrink-0 ${sortAf ? 'bg-blue-600 text-white border-blue-500' : 'bg-transparent text-slate-500 border-slate-700 hover:border-slate-500'}`}
            >
              FREQUENCY SORTING
            </button>
        </div>
        
        <div className="min-h-[6rem]">
          {displayContent}
        </div>
      </div>

      {/* Radiotext+ Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <div className="flex flex-row justify-between items-center mb-4 gap-2 md:gap-4">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
            Radiotext+
            </h3>

            {/* Running/Toggle Bits Indicators */}
            <div className="flex items-center gap-4 bg-slate-900/40 px-3 py-1.5 rounded border border-slate-800/50 shrink-0">
                <BitIndicator label="ITEM RUNNING BIT" active={data.rtPlusItemRunning} />
                <div className="w-px h-3 bg-slate-700"></div>
                <BitIndicator label="ITEM TOGGLE BIT" active={data.rtPlusItemToggle} />
            </div>
        </div>
        
        <div className="overflow-x-auto">
          {data.rtPlus.length > 0 ? (
            <table className="w-full text-left border-collapse font-mono text-sm">
              <thead>
                 <tr className="bg-slate-900/50 text-slate-500 text-[10px] uppercase">
                   <th className="px-4 py-2 border-b border-slate-700 font-bold">TAG</th>
                   <th className="px-4 py-2 border-b border-slate-700 font-bold">Content</th>
                   <th className="px-4 py-2 border-b border-slate-700 font-bold w-24">TAG ID</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.rtPlus.map((tag, i) => (
                  <tr key={i} className={`hover:bg-slate-800/30 ${tag.isCached ? 'opacity-75' : ''}`}>
                    <td className="px-4 py-2 text-slate-400 font-bold flex items-center gap-2">
                        {tag.label}
                        {tag.isCached && <span className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded border border-slate-600">CACHED</span>}
                    </td>
                    <td className="px-4 py-2 text-white">{tag.text}</td>
                    <td className="px-4 py-2 text-slate-400 text-xs">ID {tag.contentType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-slate-400 text-sm italic p-2 flex items-center gap-2">
               <span>No Radiotext+ data detected for now.</span>
            </div>
          )}
        </div>
      </div>

      {/* EON (Enhanced Other Networks) Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="truncate">Enhanced Other Networks (EON)</span>
                {eonKeys.length > 0 && (
                  <span className="hidden sm:inline-block ml-2 text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-600 shrink-0">
                    STATIONS FOUND: {eonKeys.length}
                  </span>
                )}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={onEonTaHistoryClick}
                className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors uppercase flex items-center gap-1.5 ${data.eonTaInfo?.isActive ? 'bg-yellow-500 text-yellow-950 border-yellow-400 hover:bg-yellow-400' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'}`}
                title="View EON TA History"
              >
                EON TA HISTORY
              </button>
              {eonKeys.length > 0 && (
                <button
                  onClick={() => setEonListUnderscores(!eonListUnderscores)}
                  className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors uppercase flex items-center gap-1.5 ${eonListUnderscores ? 'bg-blue-900/40 text-blue-400 border-blue-600 hover:bg-yellow-900/60' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'}`}
                  title="Toggle underscores in EON stations list"
                >
                  {eonListUnderscores ? (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      UNDERSCORES ON
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      UNDERSCORES OFF
                    </>
                  )}
                </button>
              )}
            </div>
        </div>

        {eonKeys.length > 0 ? (
            <div className="flex flex-col gap-2">
                {eonKeys.map((piKey) => {
                    const eon = data.eonData[piKey];
                    const isExpanded = expandedEon === piKey;
                    
                    return (
                        <div key={piKey} className="bg-slate-900/40 rounded border border-slate-700/50 overflow-hidden">
                            <button 
                                onClick={() => setExpandedEon(isExpanded ? null : piKey)}
                                className={`w-full text-left px-4 py-3 font-bold font-mono transition-colors flex justify-between items-center ${isExpanded ? 'bg-blue-900/30 text-blue-200' : 'hover:bg-slate-800 text-slate-300'}`}
                            >
                                <span className="flex items-center gap-4">
                                    <span className="text-lg text-white">{eon.pi}</span>
                                    <span className="text-slate-400 border-l border-slate-600 pl-4">{eonListUnderscores ? (eon.ps || "        ").replace(/ /g, '_') : (eon.ps || "        ")}</span>
                                </span>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5 font-mono">
                                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${eon.tp ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-slate-800/80 text-slate-600 border-slate-700/50'}`}>
                                            TP
                                        </span>
                                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${eon.ta ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-slate-800/80 text-slate-600 border-slate-700/50'}`}>
                                            TA
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                                        {isExpanded ? 'CLICK TO HIDE DETAILS' : 'CLICK TO SHOW DETAILS'}
                                    </span>
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="p-4 bg-slate-900/20 border-t border-slate-700/50 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                                    
                                    {/* Column 1 */}
                                    <div className="space-y-3">
                                        <div className="border border-slate-700 rounded p-2 bg-slate-950/30">
                                            <div className="text-slate-500 text-[10px] uppercase mb-1 font-bold">AF Method A</div>
                                            <div className="flex flex-wrap gap-1">
                                                {eon.af.length > 0 ? eon.af.map((freq, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">{freq}</span>
                                                )) : <span className="text-slate-600 italic">None</span>}
                                            </div>
                                        </div>

                                        <div className="border border-slate-700 rounded p-2 bg-slate-950/30">
                                            <div className="text-slate-500 text-[10px] uppercase mb-1 font-bold">Mapped Frequencies</div>
                                            <div className="grid grid-flow-col grid-rows-4 gap-x-4 gap-y-0.5">
                                                {eon.mappedFreqs.length > 0 ? eon.mappedFreqs.map((mapStr, i) => (
                                                    <span key={i} className="text-slate-300 whitespace-nowrap">{mapStr}</span>
                                                )) : <span className="text-slate-600 italic">None</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 2 */}
                                    <div className="flex flex-col h-full justify-between space-y-2">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                                                <span className="text-slate-500">Linkage Information</span>
                                                <span className="text-white font-bold">{eon.linkageInfo || "0000"}</span>
                                            </div>
                                            <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                                                <span className="text-slate-500">PTY</span>
                                                <span className="text-white">{currentPtyName(eon.pty)} <span className="text-slate-600">[{eon.pty}]</span></span>
                                            </div>
                                            <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                                                <span className="text-slate-500">TP</span>
                                                <span className={eon.tp ? "text-green-400 font-bold" : "text-slate-600"}>{eon.tp ? "Yes" : "No"}</span>
                                            </div>
                                            <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                                                <span className="text-slate-500">TA</span>
                                                <span className={eon.ta ? "text-red-400 font-bold" : "text-slate-600"}>{eon.ta ? "Yes" : "No"}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500">PIN</span>
                                                <span className="text-white">{eon.pin || "No data decoded"}</span>
                                            </div>
                                        </div>
                                        {eon.psHistory && eon.psHistory.length > 1 && (
                                            <div className="flex-1 min-h-[36px] flex items-center justify-end border-t border-slate-800/80 pt-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedEonPi(eon.pi);
                                                    }}
                                                    className="px-2.5 py-1 text-[10px] font-bold uppercase rounded border transition-colors bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white flex items-center gap-1.5"
                                                    title="EON PS HISTORY"
                                                >
                                                    <i className="fa-solid fa-clock-rotate-left w-3 h-3 text-slate-400"></i>
                                                    <span>PS HISTORY</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        ) : (
            <div className="text-slate-400 text-sm italic p-2 flex items-center gap-2">
                <span>No EON data detected for now.</span>
            </div>
        )}
      </div>

      {selectedEonPi && (() => {
        const activeEon = data.eonData[selectedEonPi];
        const rawHistory = activeEon?.psHistory || [];
        const sortedHistory = [...rawHistory];
        if (eonSortOrder === 'asc') {
          sortedHistory.reverse();
        }

        const modalActions = (
          <button
            onClick={() => setEonHistoryUnderscores(!eonHistoryUnderscores)}
            className={`ml-4 px-2 py-1 text-[10px] font-bold rounded border transition-colors uppercase flex items-center gap-1.5 ${eonHistoryUnderscores ? 'bg-blue-900/40 text-blue-400 border-blue-600 hover:bg-yellow-900/60' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'}`}
            title="Toggle underscores in EON PS history"
          >
            {eonHistoryUnderscores ? (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                UNDERSCORES ON
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                UNDERSCORES OFF
              </>
            )}
          </button>
        );

        return (
          <HistoryViewerWrapper
            title={`EON PS HISTORY - PI ${selectedEonPi}`}
            onClose={() => setSelectedEonPi(null)}
            actions={modalActions}
            className="max-w-xl"
          >
            <table className="w-full text-left text-sm font-mono">
              <thead>
                <tr className="border-b border-slate-700 text-slate-500 bg-slate-900 sticky top-0 z-10">
                  <th className="p-3 w-32">
                    <div
                      className="flex items-center gap-1 cursor-pointer hover:text-white select-none transition-colors"
                      onClick={() => setEonSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    >
                      Time
                      <svg
                        className={`w-3 h-3 transition-transform ${eonSortOrder === 'asc' ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </div>
                  </th>
                  <th className="p-3">PS</th>
                </tr>
              </thead>
              <tbody>
                {sortedHistory.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 text-slate-400 border-r border-slate-800/50">{item.time}</td>
                    <td className="p-3">
                      <span className="text-white font-bold tracking-widest whitespace-pre bg-slate-800 px-2 py-1 rounded shadow-sm">
                        {eonHistoryUnderscores ? (item.ps || "").replace(/ /g, '_') : (item.ps || "")}
                      </span>
                    </td>
                  </tr>
                ))}
                {sortedHistory.length === 0 && (
                  <tr>
                    <td colSpan={2} className="p-6 text-center text-slate-500 italic">
                      No EON PS history recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </HistoryViewerWrapper>
        );
      })()}

    </div>
  );
};
