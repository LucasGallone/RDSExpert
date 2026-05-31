import React, { useState } from 'react';
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
    
    // Determine status of TMC service
    const statusLabel = data.hasTmc ? "SERVICE DETECTED" : "NO SERVICE DETECTED";
    const statusColor = data.hasTmc ? "text-green-500" : "text-slate-500";
    const hasMessages = data.tmcMessages.length > 0;
    
    const selectedMsg = data.tmcMessages.find(m => m.id === selectedMsgId) || data.tmcMessages[0];
    
    const messagesCount = data.tmcMessages.length;
    const messagesCountDisplay = messagesCount === 500 ? "500 (Max reached)" : messagesCount;

    return (
        <div className={`border rounded-lg transition-all duration-300 overflow-hidden flex flex-col ${active ? 'bg-slate-950 border-slate-700' : 'bg-slate-900/30 border-slate-800'}`}>
            
            {/* 1. Header Control Bar */}
            <div className="flex justify-between items-center p-2 md:p-3 bg-slate-900 border-b border-slate-800 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2 md:gap-3">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1 md:gap-2 whitespace-nowrap">
                        {/* Car Icon */}
                        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
                        TRAFFIC MESSAGE CHANNEL (TMC)
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

                    <button onClick={onToggle} className={`px-3 py-1 text-[10px] uppercase font-bold rounded border transition-colors whitespace-nowrap shrink-0 ${active ? 'bg-red-500/10 text-red-400 border-red-500/50 hover:bg-red-500/20' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}>
                       {active ? 'Stop' : 'Start'}
                    </button>
                </div>
            </div>

            {/* 2. Service Info Bar (Dark Style) - Only visible when Active */}
            {active && (
                <div className="bg-slate-900 border-b border-slate-700 flex flex-wrap items-center p-1 px-4 gap-y-1 gap-x-8 shadow-inner overflow-x-auto no-scrollbar">
                     <div className="flex items-center gap-1 shrink-0">
                         <span className="text-xs font-bold text-slate-500 font-mono uppercase">Provider Name:</span>
                         <span className="text-xs font-bold text-white font-mono">{data.tmcServiceInfo.providerName}</span>
                     </div>
                     <div className="flex items-center gap-1 shrink-0">
                         <span className="text-xs font-bold text-slate-500 font-mono">LTN:</span>
                         <span className="text-xs font-bold text-slate-300 font-mono">{data.tmcServiceInfo.ltn || "--"}</span>
                     </div>
                     <div className="flex items-center gap-1 shrink-0">
                         <span className="text-xs font-bold text-slate-500 font-mono">SID:</span>
                         <span className="text-xs font-bold text-slate-300 font-mono">{data.tmcServiceInfo.sid || "--"}</span>
                     </div>
                     <div className="flex items-center gap-1 shrink-0">
                         <span className="text-xs font-bold text-slate-500 font-mono">Mode:</span>
                         <span className="text-xs font-bold text-slate-300 font-mono">{data.tmcServiceInfo.mode}</span>
                     </div>
                     <div className="flex items-center gap-1 ml-auto shrink-0">
                         <span className="text-xs font-bold text-slate-500 font-mono">Unique Messages:</span>
                         <span className="text-xs font-bold text-slate-300 font-mono">{messagesCountDisplay}</span>
                     </div>
                </div>
            )}

            {active ? (
                /* 3. Main Split View (Dark Mode) */
                <div className="flex flex-col landscape:flex-row md:flex-row h-80 bg-slate-950 text-slate-300 font-sans text-sm">
                    
                    {/* Left: Message List */}
                    <div className="flex-1 overflow-y-auto border-b landscape:border-b-0 landscape:border-r md:border-b-0 md:border-r border-slate-800 custom-scrollbar">
                         <table className="w-full text-left border-collapse">
                             <thead className="bg-slate-900 sticky top-0 shadow-sm text-slate-400">
                                 <tr>
                                     <th className="px-3 py-2 border-b border-slate-700 font-bold w-16">Loc</th>
                                     <th className="px-3 py-2 border-b border-slate-700 font-bold">Event</th>
                                     <th className="px-3 py-2 border-b border-slate-700 font-bold w-12 text-center">Ext</th>
                                     <th className="px-3 py-2 border-b border-slate-700 font-bold w-16 text-center">Updates</th>
                                 </tr>
                             </thead>
                             <tbody>
                                 {data.tmcMessages.map((msg, idx) => (
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
                                    <div>CC: <span className="font-bold text-slate-200">{selectedMsg.cc}</span>, LTN: <span className="text-slate-200">{data.tmcServiceInfo.ltn}</span></div>
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
                                        Duration Type: <span className="font-bold text-slate-200">{selectedMsg.durationLabel}</span>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-slate-800 text-slate-500">
                                        Last Received: <span className="text-slate-400">{selectedMsg.receivedTime}</span>
                                        <br/>
                                        Expires: <span className="text-slate-400">{selectedMsg.expiresTime}</span>
                                        <br/>
                                        Updates Received: <span className="text-slate-400">{selectedMsg.updateCount || 1}</span>
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
                <div className="p-8 text-center text-slate-400 italic text-xs bg-[#0f172a]">
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
        </div>
    );
};
