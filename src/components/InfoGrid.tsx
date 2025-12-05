
import React, { useState } from 'react';
import { RdsData, PTY_RDS, PTY_RBDS } from '../types';

interface InfoGridProps {
  data: RdsData;
  rdsStandard: 'RDS' | 'RBDS';
}

export const InfoGrid: React.FC<InfoGridProps> = ({ data, rdsStandard }) => {
  const [sortAf, setSortAf] = useState(false);
  const [expandedHeader, setExpandedHeader] = useState<string | null>(null);
  const [expandedEon, setExpandedEon] = useState<string | null>(null);

  // Method B Logic
  const methodBHeaders = Object.keys(data.afBLists).sort((a, b) => parseFloat(a) - parseFloat(b));
  const isMethodB = data.afType === 'B';
  const methodBCount = methodBHeaders.length;

  const getMethodLabel = () => {
    if (data.afType === 'Unknown') return 'Method ?';
    if (isMethodB) {
        return `METHOD B (${methodBCount} LIST${methodBCount !== 1 ? 'S' : ''})`;
    }
    return 'METHOD A';
  };

  // Sort function for frequencies (strings)
  const sortFreqs = (arr: string[]) => [...arr].sort((a, b) => parseFloat(a) - parseFloat(b));

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
      
      const displayAf = sortAf 
        ? [...rawList].sort((a, b) => parseFloat(a) - parseFloat(b))
        : rawList;
      
      displayContent = displayAf.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {displayAf.map((freq, idx) => {
                const isHead = data.afListHead === freq;
                const styleClass = isHead 
                    ? "bg-blue-600 border-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.4)]" 
                    : "bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600";
                
                return (
                  <span key={idx} className={`px-3 py-1.5 ${styleClass} text-sm font-mono rounded border transition-colors cursor-default shadow-sm flex items-center gap-1`}>
                    {freq}
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
  
  // Resolve PTY list based on standard
  const ptyList = rdsStandard === 'RDS' ? PTY_RDS : PTY_RBDS;

  return (
    <div className="w-full space-y-4">
      {/* AF List Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              {/* Radio Tower / Antenna Icon - Replaced by FontAwesome as requested */}
              <i className="fa-solid fa-tower-broadcast text-base"></i>
              Alternative Frequencies (AF) 
              <span className="ml-2 text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-600">
                {getMethodLabel()}
              </span>
            </h3>
            
            <button 
              onClick={() => setSortAf(!sortAf)}
              className={`text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded border transition-colors ${sortAf ? 'bg-blue-600 text-white border-blue-500' : 'bg-transparent text-slate-500 border-slate-700 hover:border-slate-500'}`}
            >
              {sortAf ? 'FREQUENCY SORTING ENABLED' : 'FREQUENCY SORTING DISABLED'}
            </button>
        </div>
        
        <div className="min-h-[6rem]">
          {displayContent}
        </div>
      </div>

      {/* Radiotext+ Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
            Radiotext+
            </h3>

            {/* Running/Toggle Bits Indicators */}
            <div className="flex items-center gap-4 bg-slate-900/40 px-3 py-1.5 rounded border border-slate-800/50">
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
                   <th className="px-4 py-2 border-b border-slate-700 font-bold">TAG/LABEL</th>
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
               <span>No RT+ data detected for now.</span>
            </div>
          )}
        </div>
      </div>

      {/* EON (Enhanced Other Networks) Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            EON (Enhanced Other Networks)
        </h3>

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
                                    <span className="text-slate-400 border-l border-slate-600 pl-4">{eon.ps || "        "}</span>
                                </span>
                                <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                                    {isExpanded ? 'HIDE DETAILS' : 'SHOW DETAILS'}
                                </span>
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
                                            <div className="flex flex-col gap-1">
                                                {eon.mappedFreqs.length > 0 ? eon.mappedFreqs.map((mapStr, i) => (
                                                    <span key={i} className="text-slate-300">{mapStr}</span>
                                                )) : <span className="text-slate-600 italic">None</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 2 */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                                            <span className="text-slate-500">Linkage Information</span>
                                            <span className="text-white font-bold">{eon.linkageInfo || "0000"}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                                            <span className="text-slate-500">PTY</span>
                                            <span className="text-white">{ptyList[eon.pty] || "None"} <span className="text-slate-600">[{eon.pty}]</span></span>
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

    </div>
  );
};
