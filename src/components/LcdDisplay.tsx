import React, { useState, useRef } from 'react';
import { RdsData, PTY_RDS, PTY_RBDS, PTY_COMBINED } from '../types';
import { ECC_COUNTRY_MAP, LIC_LANGUAGE_MAP } from '../constants';

interface LcdDisplayProps {
  data: RdsData;
  onReset: () => void;
}

type UnderscoreMode = 'OFF' | 'ALL' | 'PS_ONLY' | 'RT_ONLY';

export const LcdDisplay: React.FC<LcdDisplayProps> = ({ data, onReset }) => {
  const [underscoreMode, setUnderscoreMode] = useState<UnderscoreMode>('OFF');
  
  // State for ECC Tooltip
  const [showEccTooltip, setShowEccTooltip] = useState(false);
  const eccTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State for LIC Tooltip
  const [showLicTooltip, setShowLicTooltip] = useState(false);
  const licTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cycle through modes: OFF -> ALL -> PS_ONLY -> RT_ONLY -> OFF
  const cycleMode = () => {
    setUnderscoreMode(prev => {
      if (prev === 'OFF') return 'ALL';
      if (prev === 'ALL') return 'PS_ONLY';
      if (prev === 'PS_ONLY') return 'RT_ONLY';
      return 'OFF';
    });
  };

  const getModeLabel = () => {
    switch (underscoreMode) {
      case 'ALL': return 'Underscores ON';
      case 'PS_ONLY': return 'Underscores on PS only';
      case 'RT_ONLY': return 'Underscores on RT only';
      default: return 'Underscores OFF';
    }
  };

  const isRaw = (type: 'rt' | 'lps' | 'ps' | 'ptyn') => {
    if (type === 'ptyn') return false;
    if (underscoreMode === 'ALL') return true;
    if (underscoreMode === 'OFF') return false;
    if (underscoreMode === 'PS_ONLY') return type === 'ps' || type === 'lps';
    if (underscoreMode === 'RT_ONLY') return type === 'rt';
    return false;
  };

  const RenderEnhancedText = ({ text, type }: { text: string, type: 'rt' | 'lps' | 'ps' | 'ptyn' }) => {
      const rawMode = isRaw(type);
      
      // Handle "Empty" states logic first
      if (!text || text.length === 0) {
          if (type === 'rt' && rawMode) return <>{Array(64).fill('_').join('')}</>;
          if (type === 'lps' && rawMode) return <>{Array(32).fill('_').join('')}</>; // Updated to 32
          if (type === 'ps') return <>{Array(8).fill(' ').map((_,i)=><span key={i}>&nbsp;</span>)}</>;
          // For RT, return empty grid structure if empty, to maintain height
          if (type === 'rt') return <>{Array(64).fill(' ').map((_,i)=><span key={i}> </span>)}</>;
          return null; 
      }

      let processedText = text;
      
      // Logic Update: Never trim fixed-width fields (PS, LPS, PTYN) AND Radiotext (RT).
      // We must preserve the spaces sent by the station or the empty buffer slots to respect alignment.
      if (type === 'ps' || type === 'lps' || type === 'ptyn') {
          const len = (type === 'lps') ? 32 : 8; // Updated LPS length to 32
          // Pad or truncate to exact length
          processedText = text.padEnd(len, ' ').substring(0, len);
      } else if (type === 'rt') {
          // For Radiotext, we strictly enforce 64 characters to respect buffer positioning.
          // This ensures that if char 17 is decoded, it appears at pos 17, not collapsed to the left.
          processedText = text.padEnd(64, ' ').substring(0, 64);
      }
      
      const chars = processedText.split('');
      
      return (
        <>
          {chars.map((char, index) => {
             const code = char.charCodeAt(0);
             
             // Technical Codes / Control Characters (0x00 - 0x1F)
             if (code < 32) {
                 const hex = code.toString(16).toUpperCase().padStart(2, '0');
                 return (
                    <span key={index} className="inline-block text-[0.6em] align-middle text-slate-500 font-bold bg-slate-900/50 rounded px-0.5 mx-px border border-slate-700 select-none">
                      &lt;{hex}&gt;
                    </span>
                 );
             }
             
             // Underscore Mode Logic
             if (rawMode && char === ' ') {
                 return <span key={index}>_</span>;
             }
             
             return <span key={index}>{char}</span>;
          })}
        </>
      );
  };

  // Helper for simple string returns (PS title, etc) that don't need code rendering
  const formatTextSimple = (text: string) => text.replace(/[\x00-\x1F]/g, '');

  // Determine BER color
  let berColor = "text-green-500";
  if (data.ber >= 60) {
    berColor = "text-red-500";
  } else if (data.ber >= 20) {
    berColor = "text-orange-500";
  }

  const hasLongPs = data.longPs && data.longPs.trim().length > 0;
  const hasPtyn = data.ptyn && data.ptyn.trim().length > 0;
  
  // Resolve PTY Name based on hybrid standard
  const currentPtyName = PTY_COMBINED[data.pty] || "Unknown";

  // Check if we actually have RT groups received to determine if indicators should be lit
  const isRtActive = (data.groupCounts['2A'] || 0) > 0 || (data.groupCounts['2B'] || 0) > 0;
  const hasRtA = isRtActive; 
  const hasRtB = isRtActive;

  // Prepare ODA Tooltip (Multiline)
  const odaTooltip = data.odaList.length > 0
    ? data.odaList.map(item => `${item.name} [${item.aid}] on Group ${item.group}`).join('\n')
    : (data.odaApp ? `${data.odaApp.name} [${data.odaApp.aid}] on Group ${data.odaApp.group}` : undefined);

  // ECC Country Logic
  const getEccCountry = () => {
      if (!data.ecc) return null;
      const piFirst = data.pi && data.pi.length >= 1 ? data.pi.charAt(0).toUpperCase() : null;
      const eccKey = data.ecc.toUpperCase();
      
      if (eccKey && piFirst && ECC_COUNTRY_MAP[eccKey] && ECC_COUNTRY_MAP[eccKey][piFirst]) {
          return ECC_COUNTRY_MAP[eccKey][piFirst];
      }
      return "Not recognized!";
  };
  
  const eccCountry = getEccCountry();

  const handleEccMouseEnter = () => {
    if (eccCountry) {
      eccTooltipTimerRef.current = setTimeout(() => {
        setShowEccTooltip(true);
      }, 200);
    }
  };

  const handleEccMouseLeave = () => {
    if (eccTooltipTimerRef.current) {
      clearTimeout(eccTooltipTimerRef.current);
      eccTooltipTimerRef.current = null;
    }
    setShowEccTooltip(false);
  };

  // LIC Language Logic
  const getLicLanguage = () => {
      if (!data.lic) return null;
      const licKey = data.lic.toUpperCase();
      if (licKey && LIC_LANGUAGE_MAP[licKey]) {
          return LIC_LANGUAGE_MAP[licKey];
      }
      return "Not recognized!";
  };
  
  const licLanguage = getLicLanguage();

  const handleLicMouseEnter = () => {
    if (licLanguage) {
      licTooltipTimerRef.current = setTimeout(() => {
        setShowLicTooltip(true);
      }, 200);
    }
  };

  const handleLicMouseLeave = () => {
    if (licTooltipTimerRef.current) {
      clearTimeout(licTooltipTimerRef.current);
      licTooltipTimerRef.current = null;
    }
    setShowLicTooltip(false);
  };

  return (
    <div className="bg-[#0f172a] border-4 border-slate-700 rounded-lg p-6 shadow-[0_0_20px_rgba(15,23,42,0.8)] relative overflow-hidden group">
      {/* Screen Glare Overlay */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent pointer-events-none z-10"></div>
      
      {/* Controls */}
      <div className="absolute top-2 right-2 z-20 flex gap-2">
          <button 
            onClick={onReset}
            className="px-2 py-1 text-[10px] font-bold border rounded uppercase transition-colors min-w-[80px] flex items-center justify-center gap-2 bg-orange-900/20 text-orange-400 border-orange-500/50 hover:bg-orange-500/40"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            RESET DATA
          </button>
          <button 
            onClick={cycleMode}
            className={`px-2 py-1 text-[10px] font-bold border rounded uppercase transition-colors min-w-[100px] text-center ${underscoreMode !== 'OFF' ? 'bg-blue-600 text-white border-blue-500' : 'bg-transparent text-slate-500 border-slate-700 hover:border-slate-500'}`}
          >
            {getModeLabel()}
          </button>
      </div>

      {/* Main Row: PI | PS | BER - STRICTLY ONE ROW */}
      <div className="flex flex-row justify-between items-end gap-2 md:gap-4 relative z-0 w-full mb-6 pt-4 overflow-x-auto overflow-y-hidden whitespace-nowrap">
        
        {/* 1. PI Section (Left) */}
        <div className="flex flex-col items-start shrink-0 justify-end h-full">
           <div className="flex space-x-2 mb-6">
             <FlagBadge active={data.tp} label="TP" />
             <FlagBadge active={data.ta} label="TA" alert />
             <FlagBadge active={data.ms} label="MUSIC" />
           </div>

           {/* Alignement vertical PI ajusté avec items-center pour un centrage parfait */}
           <div className="flex items-center space-x-3">
              <span className="text-xl text-slate-400 font-bold pt-1">PI :</span>
              <span className="text-4xl md:text-6xl font-mono font-bold text-white tracking-wider leading-none">
                {data.pi}
              </span>
           </div>
        </div>

        {/* 2. PS Name (Center - Fixed Width 8 Chars) */}
        <div className="flex flex-col items-center shrink-0 mx-auto">
            <span className="text-[10px] md:text-xs text-slate-500 font-mono mb-1 uppercase tracking-widest block">Program Service (PS)</span>
            <div className="bg-slate-900/50 rounded border border-slate-800 p-1 md:p-2 shadow-inner">
                 <div className="bg-slate-800/30 px-2 md:px-4 py-1 rounded border border-slate-700/50 min-w-[180px] md:min-w-[260px] flex justify-center">
                     <span className="text-4xl md:text-6xl font-mono font-bold text-white whitespace-pre tracking-widest leading-none">
                       <RenderEnhancedText text={data.ps} type="ps" />
                     </span>
                 </div>
            </div>
        </div>

        {/* 3. BER (Right) */}
        <div className="flex flex-col items-center shrink-0">
             <span className="text-[10px] md:text-xs text-slate-500 font-mono mb-1 uppercase tracking-widest block">BER</span>
             <div className="bg-slate-900/50 rounded border border-slate-800 p-1 md:p-2 shadow-inner flex justify-center">
               <div className="bg-slate-800/30 px-2 md:px-4 py-1 rounded border border-slate-700/50 min-w-[80px] md:min-w-[100px] flex justify-center">
                 <span className={`text-4xl md:text-5xl font-mono font-bold leading-none ${data.ber === -1 ? 'text-slate-400' : berColor}`}>
                   {data.ber === -1 ? '--' : Math.round(data.ber)}
                   {data.ber !== -1 && <span className="text-xl md:text-2xl ml-1">%</span>}
                 </span>
               </div>
             </div>
        </div>

      </div>

      {/* Middle: Radio Text Lines */}
      <div className="mt-8 border-t border-slate-800/50 pt-6 grid grid-cols-1 gap-4">
        
        {/* Radio Text A */}
        <div className={`flex flex-col md:flex-row items-start md:space-x-4 transition-opacity duration-300 ${!data.textAbFlag ? 'opacity-100' : 'opacity-60'}`}>
          <div className="flex flex-row md:flex-col items-center space-x-2 md:space-x-0 md:space-y-2 pt-2 mb-1 md:mb-0">
             <span className="text-slate-400 font-bold text-xs uppercase shrink-0 px-2 py-1 border border-slate-700 rounded w-16 text-center">RT A</span>
             {/* Blue indicator active if flag is A (false) AND Radiotext groups detected */}
             <div className={`w-3 h-3 rounded-full shadow-[0_0_5px_currentColor] border border-black/50 transition-colors duration-200 ${!data.textAbFlag && hasRtA ? 'bg-blue-500 text-blue-500' : 'bg-slate-800 text-slate-800'}`}></div>
          </div>
          <div className="w-full flex-1 min-w-0 bg-slate-800/30 rounded py-2 px-4 min-h-[56px] flex items-center border border-transparent transition-colors duration-300 relative overflow-x-auto no-scrollbar">
             {/* Selection Border: Active if flag is A AND has content */}
             {!data.textAbFlag && hasRtA && <div className="absolute inset-0 border border-blue-500/30 rounded pointer-events-none"></div>}
             <span className="font-mono text-lg md:text-2xl text-slate-200 whitespace-pre leading-tight shrink-0">
               <RenderEnhancedText text={data.rtA} type="rt" />
             </span>
          </div>
        </div>

        {/* Radio Text B */}
        <div className={`flex flex-col md:flex-row items-start md:space-x-4 transition-opacity duration-300 ${data.textAbFlag ? 'opacity-100' : 'opacity-60'}`}>
          <div className="flex flex-row md:flex-col items-center space-x-2 md:space-x-0 md:space-y-2 pt-2 mb-1 md:mb-0">
            <span className="text-slate-400 font-bold text-xs uppercase shrink-0 px-2 py-1 border border-slate-700 rounded w-16 text-center">RT B</span>
             {/* Blue indicator active if flag is B (true) AND Radiotext groups detected */}
             <div className={`w-3 h-3 rounded-full shadow-[0_0_5px_currentColor] border border-black/50 transition-colors duration-200 ${data.textAbFlag && hasRtB ? 'bg-blue-500 text-blue-500' : 'bg-slate-800 text-slate-800'}`}></div>
          </div>
          <div className="w-full flex-1 min-w-0 bg-slate-800/30 rounded py-2 px-4 min-h-[56px] flex items-center relative overflow-x-auto no-scrollbar">
             {/* Selection Border: Active if flag is B AND has content */}
             {data.textAbFlag && hasRtB && <div className="absolute inset-0 border border-blue-500/30 rounded pointer-events-none"></div>}
             <span className="font-mono text-lg md:text-2xl text-slate-200 whitespace-pre shrink-0">
               <RenderEnhancedText text={data.rtB} type="rt" />
             </span>
          </div>
        </div>

      </div>

      {/* Row: PTY, PTYN and Services Flags */}
      <div className="mt-4 pt-4 border-t border-slate-800/30 flex flex-col md:flex-row gap-4 items-stretch">
        
        {/* Service Flags (RT+, EON, TMC) - TOP on mobile via order-1, RIGHT on PC via md:order-3 */}
        <div className="order-1 md:order-3 shrink-0 flex items-center justify-center gap-2 bg-slate-900/40 rounded p-2 border border-slate-800/50">
            <FlagBadge active={data.hasOda} label="ODA" color="purple" tooltip={odaTooltip} />
            <FlagBadge active={data.hasRtPlus} label="RT+" color="green" />
            <FlagBadge active={data.hasEon} label="EON" color="yellow" />
            <FlagBadge active={data.hasTmc} label="TMC" alert />
        </div>

        {/* Combined PTY & PTYN Wrapper - Grouped for mobile alignment (order-2 on mobile, md:order-1 on PC) */}
        <div className="order-2 md:order-1 flex flex-row gap-4 flex-1 md:flex-[2.3] items-stretch">
          {/* PTY (Hybrid) - Left */}
          <div className="flex-[0.9] md:flex-[1.2] flex items-center space-x-3 bg-slate-900/40 rounded p-2 border border-slate-800/50 overflow-x-auto no-scrollbar">
             <span className="text-[10px] font-bold text-slate-500 uppercase px-1 shrink-0">PTY</span>
             <span className="font-mono text-lg text-white tracking-wide shrink-0">
               {currentPtyName} <span className="text-slate-500 text-sm">[{data.pty}]</span>
             </span>
          </div>

          {/* PTYN - Center */}
          <div className="flex-[0.4] md:flex-[0.5] flex items-center space-x-3 bg-slate-900/40 rounded p-2 border border-slate-800/50 overflow-x-auto no-scrollbar">
             <span className="text-[10px] font-bold text-slate-500 uppercase px-1 shrink-0">PTYN</span>
             <span className="font-mono text-lg text-white tracking-wide whitespace-pre shrink-0">
                {(hasPtyn) ? <RenderEnhancedText text={data.ptyn} type="ptyn" /> : <span className="text-slate-600 italic text-sm">No Data</span>}
             </span>
          </div>
        </div>

      </div>

      {/* Row: Long PS + ECC + LIC */}
      <div className="mt-4 flex flex-row md:flex-row gap-4 items-stretch md:items-center">
        <div className={`flex-[2] md:flex-1 flex items-center space-x-3 bg-slate-900/40 rounded p-2 border border-slate-800/50 min-w-0 md:min-w-[200px] transition-opacity duration-300 ${hasLongPs ? 'opacity-100' : 'opacity-50'}`}>
             <div className="flex flex-col items-center space-y-1">
                 <span className="text-[10px] font-bold text-slate-500 uppercase px-1">LONG PS</span>
                 <div className={`w-2 h-2 rounded-full shadow-[0_0_4px_currentColor] border border-black/50 transition-colors duration-200 ${hasLongPs ? 'bg-blue-500 text-blue-500' : 'bg-slate-800 text-slate-800'}`}></div>
             </div>
             <div className="flex-1 px-3 overflow-x-auto no-scrollbar">
               {(hasLongPs || isRaw('lps')) ? (
                  <span className="font-mono text-lg text-white tracking-wide whitespace-pre block shrink-0">
                    <RenderEnhancedText text={data.longPs} type="lps" />
                  </span>
               ) : (
                 <span className="font-mono text-slate-600 text-sm italic">No Data</span>
               )}
             </div>
        </div>
        
        {/* ECC Box with Tooltip */}
        <div 
          className="relative flex items-center space-x-2 bg-slate-900/40 rounded p-2 border border-slate-800/50 w-24 justify-center group/ecc cursor-default shrink-0"
          onMouseEnter={handleEccMouseEnter}
          onMouseLeave={handleEccMouseLeave}
        >
            <span className="text-[10px] font-bold text-slate-500 uppercase">ECC</span>
            <span className={`font-mono text-lg font-bold ${data.ecc ? 'text-white' : 'text-slate-600'}`}>{data.ecc || "--"}</span>
            {showEccTooltip && eccCountry && (
               <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-2 bg-slate-800 text-white text-sm font-mono rounded border border-slate-600 shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-50 animate-in fade-in zoom-in-95 duration-200 whitespace-nowrap">
                  {eccCountry}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-slate-600"></div>
               </div>
            )}
        </div>

        {/* LIC Box with Tooltip */}
        <div 
          className="relative flex items-center space-x-2 bg-slate-900/40 rounded p-2 border border-slate-800/50 w-24 justify-center group/lic cursor-default shrink-0"
          onMouseEnter={handleLicMouseEnter}
          onMouseLeave={handleLicMouseLeave}
        >
            <span className="text-[10px] font-bold text-slate-500 uppercase">LIC</span>
            <span className={`font-mono text-lg font-bold ${data.lic ? 'text-white' : 'text-slate-600'}`}>{data.lic || "--"}</span>
            {showLicTooltip && licLanguage && (
               <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-2 bg-slate-800 text-white text-sm font-mono rounded border border-slate-600 shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-50 animate-in fade-in zoom-in-95 duration-200 whitespace-nowrap">
                  {licLanguage}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-slate-600"></div>
               </div>
            )}
        </div>
      </div>
      
      {/* Separator */}
      <div className="border-t border-slate-800/50 mt-4 mb-2"></div>

      {/* Row: CT and PIN */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
        {/* Local & UTC CT Wrapper for mobile row alignment */}
        <div className="flex flex-row gap-4 flex-1 items-stretch md:contents">
          {/* Local CT */}
          <div className="flex-1 flex items-center space-x-2 bg-slate-900/40 rounded p-2 border border-slate-800/50 justify-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase mr-2">Local CT</span>
              <span className={`font-mono text-lg tracking-wide ${data.localTime ? 'text-white' : 'text-slate-600'}`}>{data.localTime || "--/--/-- --:--"}</span>
          </div>
          
          {/* UTC CT */}
          <div className="flex-1 flex items-center space-x-2 bg-slate-900/40 rounded p-2 border border-slate-800/50 justify-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase mr-2">UTC CT</span>
              <span className={`font-mono text-lg tracking-wide ${data.utcTime ? 'text-white' : 'text-slate-600'}`}>{data.utcTime || "--/--/-- --:--"}</span>
          </div>
        </div>

        {/* PIN - Separate line on mobile (below CTs) thanks to flex-col on parent, but horizontal on PC */}
        <div className="flex-1 flex items-center space-x-2 bg-slate-900/40 rounded p-2 border border-slate-800/50 justify-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase mr-2">PIN</span>
            <span className="font-mono text-lg text-white tracking-wide">
              {data.pin ? data.pin : <span className="text-slate-600 italic text-sm">No Data</span>}
            </span>
        </div>
      </div>

      {/* Row: DI Flags (Stereo, Art Head, Compressed, Dynamic PTY) */}
      <div className="mt-4 flex flex-row md:flex-row gap-2 md:gap-4 items-stretch justify-between">
          <DiFlag active={data.stereo} label="STEREO" />
          <DiFlag active={data.artificialHead} label="ARTIFICIAL HEAD" />
          <DiFlag active={data.compressed} label="COMPRESSED" />
          <DiFlag active={data.dynamicPty} label="DYNAMIC PTY" />
      </div>

    </div>
  );
};

const FlagBadge: React.FC<{ active: boolean; label: string; alert?: boolean; color?: 'green' | 'yellow' | 'purple'; tooltip?: string }> = ({ active, label, alert, color, tooltip }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (tooltip && active) {
      timerRef.current = setTimeout(() => {
        setShowTooltip(true);
      }, 200);
    }
  };

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setShowTooltip(false);
  };

  let activeClass = "text-blue-300 bg-blue-900/20 border-blue-500/50 shadow-[0_0_8px_rgba(59,130,246,0.3)]";

  if (alert) {
      activeClass = "text-red-500 bg-red-950/40 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]";
  } else if (color === 'green') {
      activeClass = "text-green-400 bg-green-900/20 border-green-500/50 shadow-[0_0_8px_rgba(34,197,94,0.3)]";
  } else if (color === 'yellow') {
      activeClass = "text-yellow-400 bg-yellow-900/20 border-yellow-500/50 shadow-[0_0_8px_rgba(234,179,8,0.3)]";
  } else if (color === 'purple') {
      activeClass = "text-purple-400 bg-purple-900/20 border-purple-500/50 shadow-[0_0_8px_rgba(168,85,247,0.3)]";
  }
  
  const inactiveClass = "text-slate-700 bg-slate-900/50 border-slate-800 opacity-50";

  return (
    <div className="relative inline-block" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${active ? activeClass : inactiveClass} transition-all duration-300 cursor-default`}>
          {label}
        </span>
        {showTooltip && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-white text-xs font-mono rounded border border-slate-600 shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-50 animate-in fade-in zoom-in-95 duration-200 whitespace-pre text-left">
                {tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-slate-600"></div>
            </div>
        )}
    </div>
  );
};

const DiFlag: React.FC<{ active: boolean; label: string }> = ({ active, label }) => {
    // New style matching FlagBadge but flexible width
    const activeClass = "text-blue-300 bg-blue-900/20 border-blue-500/50 shadow-[0_0_8px_rgba(59,130,246,0.3)]";
    const inactiveClass = "text-slate-700 bg-slate-900/40 border-slate-800/50 opacity-60";

    return (
        <div className={`flex-1 flex items-center justify-center p-2 rounded border transition-all duration-300 ${active ? activeClass : inactiveClass}`}>
             <span className="text-[10px] font-bold uppercase truncate">{label}</span>
        </div>
    );
};
