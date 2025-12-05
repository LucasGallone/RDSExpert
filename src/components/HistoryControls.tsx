import React, { useState } from 'react';
import { RdsData, PTY_RDS, PTY_RBDS } from '../types';

interface HistoryControlsProps {
  data: RdsData;
  rdsStandard: 'RDS' | 'RBDS';
}

export const HistoryControls: React.FC<HistoryControlsProps> = ({ data, rdsStandard }) => {
  const [showPsHistory, setShowPsHistory] = useState(false);
  const [showRtHistory, setShowRtHistory] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportContent, setExportContent] = useState('');

  // Resolve PTY list
  const ptyList = rdsStandard === 'RDS' ? PTY_RDS : PTY_RBDS;

  // --- EXPORT LOGIC ---

  const generateReportContent = () => {
    // Format date as DD/MM/YYYY HH:mm:ss
    const nowObj = new Date();
    const dateStr = nowObj.toLocaleDateString('fr-FR');
    const timeStr = nowObj.toLocaleTimeString('fr-FR');
    const now = `${dateStr} ${timeStr}`;
    
    const ptyName = ptyList[data.pty] || `Unknown (${data.pty})`;
    const psFormatted = data.ps.replace(/ /g, '_'); // Replace spaces with underscores
    
    // Header
    let content = `RDSExpert - Text Report\n`;
    content += `Generated on: ${now}\n`;
    content += `==================================================\n\n`;

    // 1. Basic Station Info
    content += `[1] MAIN RDS INFORMATION\n`;
    content += `------------------------\n`;
    content += `PI Code:      ${data.pi}\n`;
    content += `PS Name:      ${psFormatted}\n`;
    content += `PTY:          ${ptyName}\n`;
    content += `PTYN:         ${data.ptyn || "N/A"}\n`;
    content += `Long PS:      ${data.longPs || "N/A"}\n`;
    content += `ECC:          ${data.ecc || "N/A"}\n`;
    content += `LIC:          ${data.lic || "N/A"}\n\n`;

    // 2. Times & Flags
    content += `[2] CLOCK TIME (CT), PIN & FLAGS\n`;
    content += `--------------------------------\n`;
    content += `Local Time:   ${data.localTime || "N/A"}\n`;
    content += `UTC Time:     ${data.utcTime || "N/A"}\n`;
    content += `PIN:          ${data.pin || "N/A"}\n`;
    content += `Main Flags:   TP = ${data.tp ? '1' : '0'} | TA = ${data.ta ? '1' : '0'} | MS = ${data.ms ? 'Music' : 'Speech'}\n`;
    content += `Secondary Flags: Stereo = ${data.stereo ? '1' : '0'} | Artificial Head = ${data.artificialHead ? '1' : '0'} | Compressed = ${data.compressed ? '1' : '0'} | Dynamic PTY = ${data.dynamicPty ? '1' : '0'}\n\n`;

    // 3. Current Text
    content += `[3] CURRENT RADIOTEXT\n`;
    content += `---------------------\n`;
    content += `Radiotext A:  ${data.rtA || ""}\n`;
    content += `Radiotext B:  ${data.rtB || ""}\n\n`;

    // 4. Frequencies
    content += `[4] ALTERNATIVE FREQUENCIES (AF)\n`;
    content += `--------------------------------\n`;
    content += `Method:       ${data.afType}\n`;
    if (data.afType === 'B') {
        Object.entries(data.afBLists).forEach(([head, list]) => {
            const freqs = list as string[];
            content += `  Tx ${head} MHz: [${freqs.join(', ')}]\n`;
        });
    } else {
        content += `  List: [${data.af.join(', ')}]\n`;
    }
    content += `\n`;

    // 5. RT+
    content += `[5] RADIOTEXT+\n`;
    content += `--------------\n`;
    if (data.rtPlus.length > 0) {
        data.rtPlus.forEach(tag => {
            content += `  - ${tag.label} (ID ${tag.contentType}): "${tag.text}"\n`;
        });
    } else {
        content += `  No RT+ tags detected.\n`;
    }
    content += `\n`;

    // 6. EON
    content += `[6] EON (ENHANCED OTHER NETWORKS)\n`;
    content += `--------------------------------\n`;
    const eonKeys = Object.keys(data.eonData);
    if (eonKeys.length > 0) {
        eonKeys.forEach(key => {
            const net = data.eonData[key];
            content += `  PI: ${net.pi} | PS: ${net.ps} | Freqs: [${net.af.join(', ')}]\n`;
        });
    } else {
        content += `  No EON data.\n`;
    }
    content += `\n`;

    // 7. TMC
    content += `[7] TMC MESSAGES (${data.tmcMessages.length})\n`;
    content += `--------------------------\n`;
    if (data.tmcMessages.length > 0) {
        data.tmcMessages.forEach(msg => {
            content += `  [${msg.receivedTime}] Loc ${msg.locationCode}: ${msg.label} (${msg.nature})\n`;
        });
    } else {
        content += `  No TMC messages.\n`;
    }
    content += `\n`;

    // 8. History Dump
    content += `[8] RADIOTEXT HISTORY (LIMITED TO 200 ENTRIES)\n`;
    content += `----------------------------------------------\n`;
    data.rtHistory.forEach(h => {
        content += `  [${h.time}] ${h.text}\n`;
    });
    content += `\n`;

    content += `[9] PS / PTY HISTORY (LIMITED TO 200 ENTRIES)\n`;
    content += `---------------------------------------------\n`;
    data.psHistory.forEach(h => {
        content += `  [${h.time}] ${h.ps} (PTY: ${h.pty})\n`;
    });

    return content;
  };

  const handleOpenExport = () => {
      // Capture content at the moment of click to freeze time/data
      const content = generateReportContent();
      setExportContent(content);
      setShowExportModal(true);
  };

  return (
    <div className="flex justify-center w-full my-4">
        {/* Main Controls Group */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-2 flex gap-4 shadow-sm backdrop-blur-sm">
            <button 
                onClick={() => setShowPsHistory(true)}
                className="px-4 py-2 text-xs font-bold uppercase rounded border transition-colors bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white flex items-center justify-center gap-2"
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                PS / PTY HISTORY
            </button>
            <button 
                onClick={() => setShowRtHistory(true)}
                className="px-4 py-2 text-xs font-bold uppercase rounded border transition-colors bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white flex items-center justify-center gap-2"
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                RADIOTEXT HISTORY
            </button>
            <button 
                onClick={handleOpenExport}
                className="px-4 py-2 text-xs font-bold uppercase rounded border transition-colors bg-blue-900/30 text-blue-200 border-blue-500/50 hover:bg-blue-800/40 hover:text-white flex items-center justify-center gap-2"
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                EXPORT DATA TO TEXT
            </button>
        </div>

        {/* Modal: PS History */}
        {showPsHistory && (
            <HistoryModal title="PS / PTY HISTORY (LIMITED TO 200 ENTRIES)" onClose={() => setShowPsHistory(false)}>
                <table className="w-full text-left text-sm font-mono">
                    <thead>
                        <tr className="border-b border-slate-700 text-slate-500 bg-slate-900 sticky top-0">
                            <th className="p-3 w-24">Time</th>
                            <th className="p-3 w-32">PS</th>
                            <th className="p-3">PTY</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.psHistory.map((item, i) => (
                            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                <td className="p-3 text-slate-400 border-r border-slate-800/50">{item.time}</td>
                                <td className="p-3 border-r border-slate-800/50">
                                    <span className="text-white font-bold tracking-widest whitespace-pre bg-slate-800 px-2 py-1 rounded shadow-sm">{item.ps}</span>
                                </td>
                                <td className="p-3 text-slate-400">
                                    {ptyList[item.pty] || "Unknown"} <span className="text-xs opacity-50 ml-1">[{item.pty}]</span>
                                </td>
                            </tr>
                        ))}
                        {data.psHistory.length === 0 && (
                            <tr><td colSpan={3} className="p-6 text-center text-slate-500 italic">No PS / PTY data recorded for now.</td></tr>
                        )}
                    </tbody>
                </table>
            </HistoryModal>
        )}

        {/* Modal: RT History */}
        {showRtHistory && (
            <HistoryModal title="RADIOTEXT HISTORY (LIMITED TO 200 ENTRIES)" onClose={() => setShowRtHistory(false)}>
                <table className="w-full text-left text-sm font-mono">
                    <thead>
                        <tr className="border-b border-slate-700 text-slate-500 bg-slate-900 sticky top-0">
                            <th className="p-3 w-24">Time</th>
                            <th className="p-3">Radiotext</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.rtHistory.map((item, i) => (
                            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                <td className="p-3 text-slate-400 border-r border-slate-800/50 align-top">{item.time}</td>
                                <td className="p-3 text-white whitespace-pre-wrap leading-relaxed">{item.text}</td>
                            </tr>
                        ))}
                        {data.rtHistory.length === 0 && (
                            <tr><td colSpan={2} className="p-6 text-center text-slate-500 italic">No complete Radiotext messages recorded for now.</td></tr>
                        )}
                    </tbody>
                </table>
            </HistoryModal>
        )}

        {/* Modal: Export Text */}
        {showExportModal && (
            <ExportModal 
                title="EXPORT DATA" 
                content={exportContent}
                pi={data.pi}
                onClose={() => setShowExportModal(false)} 
            />
        )}
    </div>
  );
};

const HistoryModal: React.FC<{ title: string, onClose: () => void, children: React.ReactNode }> = ({ title, onClose, children }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-3 border-b border-slate-800 bg-slate-900">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1 rounded hover:bg-slate-800">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950">
                    {children}
                </div>
                <div className="p-3 bg-slate-900 border-t border-slate-800 flex justify-end">
                    <button onClick={onClose} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded transition-colors uppercase border border-slate-700 shadow-sm">Close</button>
                </div>
            </div>
        </div>
    );
};

const ExportModal: React.FC<{ title: string, content: string, pi: string, onClose: () => void }> = ({ title, content, pi, onClose }) => {
    const [copyStatus, setCopyStatus] = useState<'IDLE' | 'COPIED'>('IDLE');

    const handleCopy = () => {
        navigator.clipboard.writeText(content).then(() => {
            setCopyStatus('COPIED');
            setTimeout(() => setCopyStatus('IDLE'), 2000);
        });
    };

    const handleDownload = () => {
        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-CA'); // YYYY-MM-DD
        const timeStr = now.toLocaleTimeString('fr-FR', { hour12: false }).replace(/:/g, '-'); // HH-mm-ss
        const piSafe = pi.trim() || "XXXX";
        const filename = `RDSExpert_${piSafe}_${dateStr}_${timeStr}.txt`;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-3 border-b border-slate-800 bg-slate-900">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1 rounded hover:bg-slate-800">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950 p-4">
                    <textarea 
                        readOnly 
                        value={content} 
                        className="w-full h-96 bg-slate-900 border border-slate-700 text-slate-300 font-mono text-xs p-3 rounded focus:outline-none resize-none"
                    />
                </div>
                <div className="p-3 bg-slate-900 border-t border-slate-800 flex justify-end gap-3">
                     <button 
                        onClick={handleCopy}
                        className={`px-4 py-1.5 text-xs font-bold rounded transition-colors uppercase border shadow-sm flex items-center gap-2 ${copyStatus === 'COPIED' ? 'bg-green-900/30 text-green-200 border-green-500/50' : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white'}`}
                    >
                        {copyStatus === 'COPIED' ? (
                            <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                COPIED!
                            </>
                        ) : (
                            <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                COPY
                            </>
                        )}
                    </button>

                    <button 
                        onClick={handleDownload}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded transition-colors uppercase border border-blue-500 shadow-sm flex items-center gap-2"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        DOWNLOAD
                    </button>
                    
                    <button onClick={onClose} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded transition-colors uppercase border border-slate-700 shadow-sm">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};