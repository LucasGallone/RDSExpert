import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { RdsData, TmcMessage } from '../types';
import { TmcMap } from './TmcMap';

interface TmcViewerProps {
    data: RdsData;
    active: boolean;
    paused: boolean;
    onToggle: () => void;
    onPause: () => void;
    onReset: () => void;
}

export const TmcViewer: React.FC<TmcViewerProps> = ({ data, active, paused, onToggle, onPause, onReset }) => {
    const [selectedMsgId, setSelectedMsgId] = useState<number | null>(null);
    const [showMap, setShowMap] = useState<boolean>(false);

    const [showLinkage, setShowLinkage] = useState<boolean>(false);
    const [sortBy, setSortBy] = useState<'loc' | 'event'>(() => (localStorage.getItem('tmcSortPref') as 'loc' | 'event') || 'loc');
    const [sortDir, setSortDir] = useState<'asc'|'desc'>(() => (localStorage.getItem('tmcSortDirPref') as 'asc'|'desc') || 'asc');

    const handleSortChange = (field: 'loc' | 'event') => {
        if (sortBy === field) {
            const newDir = sortDir === 'asc' ? 'desc' : 'asc';
            setSortDir(newDir);
            localStorage.setItem('tmcSortDirPref', newDir);
        } else {
            setSortBy(field);
            const newDir = 'asc';
            setSortDir(newDir);
            localStorage.setItem('tmcSortPref', field);
            localStorage.setItem('tmcSortDirPref', newDir);
        }
    };

    // Determine status of TMC service
    const statusLabel = data.hasTmc ? "SERVICE DETECTED" : "NO SERVICE DETECTED";
    const statusColor = data.hasTmc ? "text-green-500" : "text-slate-500";
    const hasMessages = data.tmcMessages.length > 0;

    const sortedMessages = [...data.tmcMessages].sort((a, b) => {
        if (sortBy === 'loc') {
            return sortDir === 'asc' ? a.locationCode - b.locationCode : b.locationCode - a.locationCode;
        } else {
            return sortDir === 'asc' ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label);
        }
    });

    const selectedMsg = data.tmcMessages.find(m => m.id === selectedMsgId) || sortedMessages[0];
    
    const messagesCount = data.tmcMessages.length;
    const messagesCountDisplay = messagesCount === 500 ? "500 (Max reached)" : messagesCount;

    return (
        <div className={`border rounded-lg transition-all duration-300 overflow-visible flex flex-col ${active ? 'bg-slate-950 border-slate-700' : 'bg-slate-900/30 border-slate-800'}`}>
            
            {/* 1. Header Control Bar */}
            <div className="flex justify-between items-center p-2 md:p-3 bg-slate-900 border-b border-slate-800 flex-wrap gap-y-2 rounded-t-lg">
                <div className="flex items-center gap-2 md:gap-3">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1 md:gap-2 whitespace-nowrap">
                        {/* Car Icon */}
                        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
                        TRAFFIC MESSAGE CHANNEL (TMC)
                        <div className="group/tmcw relative flex items-center cursor-help">
                            <svg className="w-4 h-4 text-slate-400 hover:text-slate-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <div className="absolute top-full left-0 mt-2 p-3 bg-slate-800 text-slate-200 text-[11px] leading-relaxed font-normal normal-case tracking-normal rounded border border-slate-600 shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-50 hidden group-hover/tmcw:block w-64 whitespace-normal">
                                This decoder is experimental.<br/>Some errors (such as incorrect events) may occur depending on the service provider.<br/><br/>As public documentation regarding TMC technology is relatively limited, creating a perfect decoder requires significant effort.<br/>Improvements are implemented during updates whenever possible.
                            </div>
                        </div>
                    </h3>
                    {active && !paused && <span className="text-[10px] text-green-500 font-mono animate-pulse whitespace-nowrap shrink-0">● DECODING</span>}
                    {active && paused && <span className="text-[10px] text-yellow-500 font-mono whitespace-nowrap shrink-0">● PAUSED</span>}
                    
                    <span className={`text-[10px] font-bold uppercase border px-2 py-0.5 rounded ml-1 md:ml-2 whitespace-nowrap shrink-0 ${data.hasTmc ? 'bg-green-900/20 border-green-500/50 ' + statusColor : 'bg-slate-900 border-slate-700 ' + statusColor}`}>
                        {statusLabel}
                    </span>
                </div>
                
                <div className="flex items-center gap-1 md:gap-2 ml-4">
                    <button onClick={onReset} disabled={!active && data.tmcMessages.length === 0} className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400 hover:text-white disabled:opacity-30 transition-colors whitespace-nowrap shrink-0">
                       Reset
                    </button>
                    
                    <button
                        onClick={() => setShowMap(true)}
                        disabled={!active || data.tmcMessages.length === 0}
                        className="px-2 py-1 text-[10px] uppercase font-bold text-cyan-400 hover:text-cyan-300 disabled:opacity-30 disabled:text-slate-400 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                        <i className="fa-solid fa-map-location-dot"></i> Map
                    </button>

                    <button
                        onClick={onPause}
                        disabled={!active}
                        className={`px-3 py-1 text-[10px] uppercase font-bold rounded border transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap shrink-0 ${paused ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/50 hover:bg-yellow-500/20' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                        title={paused ? "Resume TMC decoding" : "Pause TMC decoding"}
                    >
                        {paused ? 'Resume' : 'Pause'}
                    </button>

                    <button onClick={onToggle} className={`px-3 py-1 text-[10px] uppercase font-bold rounded border transition-colors whitespace-nowrap shrink-0 ${active ? 'bg-red-500/10 text-red-400 border-red-500/50 hover:bg-red-500/20' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}>
                       {active ? 'Stop' : 'Start'}
                    </button>
                </div>
            </div>

            {/* 2. Service Info Bar (Dark Style) - Only visible when Active */}
            {active && (
                <div className="bg-slate-900 border-b border-slate-700 shadow-inner flex flex-col">
                    <div className="flex flex-wrap items-center p-1 px-4 gap-y-1 gap-x-8 overflow-x-auto no-scrollbar">
                         <div className="flex items-center gap-1 shrink-0">
                             <span className="text-xs font-bold text-slate-500 font-mono uppercase">Provider Name:</span>
                             <span className="text-xs font-bold text-white font-mono">{data.tmcServiceInfo.providerName}</span>
                         </div>
                         <div className="flex items-center gap-1 shrink-0">
                             <span className="text-xs font-bold text-slate-500 font-mono uppercase">Linkage:</span>
                             {Object.keys(data.tmcServiceInfo.tuningInfo || {}).length > 0 ? (
                                <button 
                                    onClick={() => setShowLinkage(true)} 
                                    className="text-xs font-bold text-yellow-500 hover:text-yellow-400 font-mono underline decoration-dotted transition-colors"
                                >
                                    YES
                                </button>
                             ) : (
                                <span className="text-xs font-bold text-slate-600 font-mono">NO</span>
                             )}
                         </div>
                         <div className="flex items-center gap-1 shrink-0">
                             <span className="text-xs font-bold text-slate-500 font-mono">LTN:</span>
                             <span className="text-xs font-bold text-slate-300 font-mono">{data.tmcServiceInfo.ltn || "--"}</span>
                         </div>
                         <div className="flex items-center gap-1 shrink-0">
                             <span className="text-xs font-bold text-slate-500 font-mono">SID:</span>
                             <span className="text-xs font-bold text-slate-300 font-mono">{data.tmcServiceInfo.sid || "--"}</span>
                         </div>
                         </div>
                    <div className="bg-slate-950 border-t border-slate-800 p-2 px-4 flex flex-col gap-2">
                             <div className="flex flex-wrap gap-x-8 gap-y-2">
                                 <div className="flex items-center gap-1 shrink-0">
                                     <span className="text-[11px] font-bold text-slate-500 font-mono">CC:</span>
                                     <span className="text-[11px] font-bold text-slate-300 font-mono">{data.tmcServiceInfo.cid || "--"}</span>
                                 </div>
                                 <div className="flex items-center gap-1 shrink-0">
                                     <span className="text-[11px] font-bold text-slate-500 font-mono">ECC:</span>
                                     <span className="text-[11px] font-bold text-slate-300 font-mono">{data.tmcServiceInfo.ltecc ? data.tmcServiceInfo.ltecc.toString(16).toUpperCase() : "--"}</span>
                                 </div>
                                 <div className="flex items-center gap-1 shrink-0 relative group/mgs">
                                     <span className="text-[11px] font-bold text-slate-500 font-mono">MGS:</span>
                                     <span className={`text-[11px] font-bold font-mono ${data.tmcServiceInfo.mgs !== undefined ? 'text-white cursor-default' : 'text-slate-300'}`}>
                                         {data.tmcServiceInfo.mgs !== undefined ? data.tmcServiceInfo.mgs : "--"}
                                     </span>
                                     {data.tmcServiceInfo.mgs !== undefined && (
                                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-white text-[11px] font-mono rounded border border-slate-600 shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-50 hidden group-hover/mgs:block whitespace-nowrap">
                                             {(() => {
                                                 const mgs = data.tmcServiceInfo.mgs;
                                                 const scopes = [];
                                                 if (mgs & 8) scopes.push("Inter-road");
                                                 if (mgs & 4) scopes.push("National");
                                                 if (mgs & 2) scopes.push("Regional");
                                                 if (mgs & 1) scopes.push("Urban");
                                                 return scopes.length > 0 ? scopes.join(", ") : "None";
                                             })()}
                                             <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-slate-600"></div>
                                         </div>
                                     )}
                                 </div>
                                 <div className="flex items-center gap-1 shrink-0">
                                     <span className="text-[11px] font-bold text-slate-500 font-mono">GAP:</span>
                                     <span className="text-[11px] font-bold text-slate-300 font-mono">{data.tmcServiceInfo.gap !== undefined ? data.tmcServiceInfo.gap : "--"}</span>
                                 </div>
                                 <div className="flex items-center gap-1 shrink-0">
                                     <span className="text-[11px] font-bold text-slate-500 font-mono">ENCRYPTION:</span>
                                     <span className="text-[11px] font-bold text-slate-300 font-mono">{data.tmcServiceInfo.isEncrypted !== undefined ? (data.tmcServiceInfo.isEncrypted ? "YES" : "NO") : "--"}</span>
                                 </div>
                                 <div className="flex items-center gap-1 shrink-0">
                                     <span className="text-[11px] font-bold text-slate-500 font-mono">ENC. ID:</span>
                                     <span className="text-[11px] font-bold text-slate-300 font-mono">{data.tmcServiceInfo.encId !== undefined ? data.tmcServiceInfo.encId : "--"}</span>
                                 </div>
                                 <div className="flex items-center gap-1 shrink-0 ml-auto">
                                     <span className="text-[11px] font-bold text-slate-500 font-mono">UNIQUE MESSAGES:</span>
                                     <span className="text-[11px] font-bold text-slate-300 font-mono">{messagesCountDisplay}</span>
                                 </div>
                             </div>
                              
                        </div>
                </div>
            )}

            {active ? (
                /* 3. Main Split View (Dark Mode) */
                <div className="flex flex-col landscape:flex-row md:flex-row h-80 bg-slate-950 text-slate-300 font-sans text-sm rounded-b-lg overflow-hidden">
                    
                    {/* Left: Message List */}
                    <div className="flex-1 overflow-y-auto border-b landscape:border-b-0 landscape:border-r md:border-b-0 md:border-r border-slate-800 custom-scrollbar">
                         <table className="w-full text-left border-collapse">
                             <thead className="bg-slate-900 sticky top-0 shadow-sm text-slate-400">
                                 <tr>
                                     <th 
                                         className="px-3 py-2 border-b border-slate-700 font-bold w-16 cursor-pointer hover:text-white transition-colors"
                                         onClick={() => handleSortChange('loc')}
                                         title="Sort by Location"
                                     >
                                         <div className="flex items-center">Loc {sortBy === 'loc' && (sortDir === 'asc' ? <span className="text-[9px] ml-1">▲</span> : <span className="text-[9px] ml-1">▼</span>)}</div>
                                     </th>
                                     <th 
                                         className="px-3 py-2 border-b border-slate-700 font-bold cursor-pointer hover:text-white transition-colors"
                                         onClick={() => handleSortChange('event')}
                                         title="Sort by Event"
                                     >
                                         <div className="flex items-center">Event {sortBy === 'event' && (sortDir === 'asc' ? <span className="text-[9px] ml-1">▲</span> : <span className="text-[9px] ml-1">▼</span>)}</div>
                                     </th>
                                     <th className="px-3 py-2 border-b border-slate-700 font-bold w-12 text-center">Ext</th>
                                     <th className="px-3 py-2 border-b border-slate-700 font-bold w-16 text-center">Updates</th>
                                 </tr>
                             </thead>
                             <tbody>
                                 {sortedMessages.map((msg, idx) => (
                                     <tr 
                                        key={msg.id} 
                                        onClick={() => setSelectedMsgId(msg.id)}
                                        className={`cursor-pointer border-b border-slate-800/50 hover:bg-slate-800 transition-colors ${selectedMsgId === msg.id ? 'bg-blue-900/30 text-blue-200' : (idx % 2 === 0 ? 'bg-slate-950' : 'bg-slate-900/20')}`}
                                     >
                                         <td className="px-3 py-1 font-mono text-slate-500">#{msg.locationCode}</td>
                                         <td className="px-3 py-1 font-bold">{msg.label}</td>
                                         <td className="px-3 py-1 text-center text-slate-400">{msg.extent}</td>
                                         <td className="px-3 py-1 text-center font-mono text-slate-500">{msg.updateCount || 1}</td>
                                     </tr>
                                 ))}
                                 {data.tmcMessages.length === 0 && (
                                     <tr>
                                         <td colSpan={4} className="p-8 text-center italic text-slate-600">
                                             Waiting for TMC messages on Group 8A...
                                         </td>
                                     </tr>
                                 )}
                             </tbody>
                         </table>
                    </div>

                    {/* Right: Detail View (Dark Mode) */}
                    <div className="w-full landscape:w-2/5 md:w-2/5 flex-1 landscape:flex-none md:flex-none bg-slate-900 p-4 overflow-y-auto flex flex-col gap-3 font-mono text-[11px] leading-relaxed select-text custom-scrollbar">
                        {selectedMsg ? (
                            <>
                                <div className="border-b border-slate-700 pb-2 mb-1">
                                    <span className="font-bold text-white text-sm">{selectedMsg.label} [Code: {selectedMsg.eventCode}]</span>
                                </div>
                                <div className="space-y-1.5 text-slate-400">
                                    <div>
                                        Location Code: <span className="font-bold text-slate-200">{selectedMsg.locationCode}</span>
                                    </div>
                                    <div>
                                        Extent: <span className="font-bold text-slate-200">{selectedMsg.extent}</span>, Direction: <span className={selectedMsg.direction ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>{selectedMsg.direction ? 'Negative (-)' : 'Positive (+)'}</span>
                                    </div>
                                    <div className="mt-3">
                                        Urgency: <span className="font-bold text-slate-200">{selectedMsg.urgency}</span>
                                    </div>
                                    <div>
                                        Nature: <span className="font-bold text-slate-200">{selectedMsg.nature}</span>
                                    </div>
                                    <div>
                                        Duration: <span className="font-bold text-slate-200">{selectedMsg.durationLabel}</span>
                                    </div>
                                    {selectedMsg.durationType && (
                                        <div>
                                            Duration Type: <span className="font-bold text-slate-200">{selectedMsg.durationType}</span>
                                        </div>
                                    )}
                                    <div className="mt-3 pt-3 border-t border-slate-800 text-slate-500">
                                        Received: <span className="text-slate-400">{selectedMsg.receivedTime}</span>
                                        <br/>
                                        Expires: <span className="text-slate-400">{selectedMsg.expiresTime}</span>
                                        <br/>
                                        Updates Received: <span className="text-slate-400">{selectedMsg.updateCount || 1}</span>
                                        {selectedMsg.lastUpdatedTime && (
                                            <>
                                                <br/>
                                                Last Update: <span className="text-slate-400">{selectedMsg.lastUpdatedTime}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                           <div className="h-full flex items-center justify-center text-slate-600 italic">
                               Select a message to view details
                           </div>
                        )}
                    </div>

                </div>
            ) : (
                <div className="p-8 text-center text-slate-400 italic text-xs bg-[#0f172a] rounded-b-lg">
                   TMC Decoder is currently disabled. Click "Start" to view Group 8A content.
                </div>
            )}

            <TmcMap
                messages={data.tmcMessages}
                serviceInfo={data.tmcServiceInfo}
                ecc={data.ecc}
                pi={data.pi}
                isOpen={showMap}
                onClose={() => setShowMap(false)}
            />

            {showLinkage && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-3 border-b border-slate-800 bg-slate-900">
                            <h3 className="text-white font-bold text-sm flex items-center gap-2">
                                <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                TMC LINKAGE
                            </h3>
                            <button onClick={() => setShowLinkage(false)} className="text-slate-400 hover:text-white">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-4 bg-slate-900/50 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {Object.entries(data.tmcServiceInfo.tuningInfo || {}).map(([pi, afs]) => {
                                const onInfo = data.tmcServiceInfo.otherNetworks?.[pi];
                                return (
                                <div key={pi} className="mb-3 last:mb-0 bg-slate-900 border border-slate-800 rounded p-3">
                                    <div className="flex flex-wrap items-center gap-2 mb-2 border-b border-slate-800 pb-1">
                                        <div className="text-yellow-500 font-mono font-bold text-sm">PI: {pi}</div>
                                        {onInfo && (
                                            <div className="flex flex-wrap items-center gap-2 ml-auto">
                                                {onInfo.sid !== undefined && <span className="text-[11px] font-bold text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">SID: {onInfo.sid}</span>}
                                                {onInfo.ltn !== undefined && <span className="text-[11px] font-bold text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">LTN: {onInfo.ltn}</span>}
                                                {onInfo.mgs !== undefined && (
                                                     <div className="relative group/onmgs flex items-center gap-1 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                                                         <span className="text-[11px] font-bold text-slate-400 font-mono cursor-default">MGS: {onInfo.mgs}</span>
                                                         <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-3 py-1.5 bg-slate-800 text-white text-[11px] font-mono rounded border border-slate-600 shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-50 hidden group-hover/onmgs:block whitespace-nowrap">
                                                             {(() => {
                                                                 const mgs = onInfo.mgs;
                                                                 const scopes = [];
                                                                 if (mgs & 8) scopes.push("Inter-road");
                                                                 if (mgs & 4) scopes.push("National");
                                                                 if (mgs & 2) scopes.push("Regional");
                                                                 if (mgs & 1) scopes.push("Urban");
                                                                 return scopes.length > 0 ? scopes.join(", ") : "None";
                                                             })()}
                                                             <div className="absolute left-full top-1/2 -translate-y-1/2 -ml-[1px] border-4 border-transparent border-l-slate-600"></div>
                                                         </div>
                                                     </div>
                                                 )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {afs.length > 0 ? afs.map(af => (
                                            <span key={af} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-xs border border-slate-700 font-mono">
                                                {af} MHz
                                            </span>
                                        )) : (
                                            <span className="text-slate-500 italic text-xs">No AF decoded</span>
                                        )}
                                    </div>
                                </div>
                            )})}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
