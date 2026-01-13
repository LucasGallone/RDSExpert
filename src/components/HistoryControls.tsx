import React, { useState } from 'react';
import { RdsData, PTY_RDS, PTY_RBDS, PTY_COMBINED, PsHistoryItem, RtHistoryItem } from '../types';

interface HistoryControlsProps {
  data: RdsData;
}

export const HistoryControls: React.FC<HistoryControlsProps> = ({ data }) => {
  const [showPsHistory, setShowPsHistory] = useState(false);
  const [showRtHistory, setShowRtHistory] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportContent, setExportContent] = useState('');

  // Resolve PTY list using hybrid standard
  const ptyList = PTY_COMBINED;

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

    // 1. Main RDS information
    content += `[1] MAIN RDS INFORMATION\n`;
    content += `------------------------\n`;
    content += `PI:           ${data.pi}\n`;
    content += `PS:           ${psFormatted}\n`;
    content += `PTY:          ${ptyName} [${data.pty}]\n`;
    const ptynRaw = (data.ptyn || "").replace(/\r/g, '');
    content += `PTYN:         ${ptynRaw.trim() ? ptynRaw : "N/A"}\n`;
    const lpsRaw = (data.longPs || "").replace(/\r/g, '');
    content += `Long PS:      ${lpsRaw.trim() ? lpsRaw : "N/A"}\n`;
    content += `ECC:          ${data.ecc || "N/A"}\n`;
    content += `LIC:          ${data.lic || "N/A"}\n\n`;

    // 2. Flags, decoder identification, clock time and PIN
    content += `[2] FLAGS / DECODER IDENTIFICATION (DI) / CLOCK TIME (CT) / PIN\n`;
    content += `---------------------------------------------------------------\n`;
    content += `Flags:        TP = ${data.tp ? '1' : '0'} | TA = ${data.ta ? '1' : '0'} | MS = ${data.ms ? 'Music' : 'Speech'}\n`;
    content += `DI:           Stereo = ${data.stereo ? '1' : '0'} | Artificial Head = ${data.artificialHead ? '1' : '0'} | Compressed = ${data.compressed ? '1' : '0'} | Dynamic PTY = ${data.dynamicPty ? '1' : '0'}\n`;
    content += `Local Time:   ${data.localTime || "N/A"}\n`;
    content += `UTC Time:     ${data.utcTime || "N/A"}\n`;
    content += `PIN:          ${data.pin || "N/A"}\n\n`;

    // 3. Radiotext
    content += `[3] RADIOTEXT\n`;
    content += `-------------\n`;
    content += `Line A:  ${(data.rtA || "").replace(/\r/g, '')}\n`;
    content += `Line B:  ${(data.rtB || "").replace(/\r/g, '')}\n\n`;

    // 4. AF
    content += `[4] ALTERNATIVE FREQUENCIES (AF)\n`;
    content += `--------------------------------\n`;
    content += `Method: ${data.afType}\n`;
    if (data.afType === 'B') {
        Object.entries(data.afBLists).forEach(([head, list]) => {
            const freqs = list as string[];
            content += `  Tx ${head} MHz: [${freqs.join(' / ')}]\n`;
        });
    } else {
        content += `  List: [${data.af.join(' / ')}]\n`;
    }
    content += `\n`;

    // 5. RT+
    content += `[5] RADIOTEXT+ TAGS\n`;
    content += `-------------------\n`;
    if (data.rtPlus.length > 0) {
        data.rtPlus.forEach(tag => {
            content += `  - ${tag.label} (ID ${tag.contentType}): "${tag.text}"\n`;
        });
    } else {
        content += `  No Radiotext+ tags detected.\n`;
    }
    content += `\n`;

    // 6. EON
    content += `[6] ENHANCED OTHER NETWORKS (EON)\n`;
    content += `---------------------------------\n`;
    const eonKeys = Object.keys(data.eonData);
    if (eonKeys.length > 0) {
        eonKeys.forEach(key => {
            const net = data.eonData[key];
            content += `  PI: ${net.pi} | PS: ${net.ps}\n`;
            if (net.af.length > 0) {
                content += `    AF Method A: [${net.af.join(' / ')}]\n`;
            }
            if (net.mappedFreqs.length > 0) {
                content += `    Mapped Frequencies: [${net.mappedFreqs.join(' / ')}]\n`;
            }
        });
    } else {
        content += `  No EON data decoded.\n`;
    }
    content += `\n`;

    // 7. ODA
    content += `[7] OPEN DATA APPLICATIONS (ODA)\n`;
    content += `--------------------------------\n`;
    if (data.odaList.length > 0) {
        data.odaList.forEach(oda => {
            content += `  - ${oda.name} [AID: ${oda.aid}]\n`;
        });
    } else {
        content += `  No ODA AID detected on Group 3A.\n`;
    }
    content += `\n`;

    // 8. Radiotext History
    content += `[8] RADIOTEXT HISTORY\n`;
    content += `---------------------\n`;
    [...data.rtHistory].reverse().forEach(h => {
        content += `  [${h.time}] ${h.text}\n`;
    });
    content += `\n`;

    // 9. PS, PTY and PTYN History
    content += `[9] PS / PTY / PTYN HISTORY\n`;
    content += `---------------------------\n`;
    
    const psHistory = [...data.psHistory].reverse();

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
            const currentPtynValue = h.ptyn;
            if (currentPtynValue !== lastPtynValue) {
                content += `[${h.time}] ${currentPtynValue}\n`;
                lastPtynValue = currentPtynValue;
            }
        });
    } else {
        content += `No data decoded...\n`;
    }

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

        {/* Modal: PS History using Generic Viewer */}
        {showPsHistory && (
            <HistoryViewer 
                title="PS / PTY / PTYN HISTORY (LIMITED TO 200 ENTRIES)"
                onClose={() => setShowPsHistory(false)}
                data={data.psHistory}
                getCopyText={(item: PsHistoryItem, u: boolean) => `[${item.time}] PS: ${u ? item.ps.replace(/ /g, '_') : item.ps} | PTY: ${ptyList[item.pty] || item.pty} | PTYN: ${item.ptyn}`}
                fullCopyFormatter={(items: PsHistoryItem[], u: boolean) => {
                    const psLines = items.map(item => `[${item.time}] ${u ? item.ps.replace(/ /g, '_') : item.ps}`).join('\n');
                    
                    let ptyLines = "";
                    let lastPty = "";
                    items.forEach(item => {
                        const currentPty = ptyList[item.pty] || item.pty.toString();
                        if (currentPty !== lastPty) {
                            ptyLines += `[${item.time}] ${currentPty}\n`;
                            lastPty = currentPty;
                        }
                    });

                    const ptynEntries = items.filter(h => h.ptyn && h.ptyn.trim().length > 0);
                    let ptynLines = "";
                    let lastPtyn = "";
                    ptynEntries.forEach(item => {
                        const currentPtyn = item.ptyn;
                        if (currentPtyn !== lastPtyn) {
                            ptynLines += `[${item.time}] ${currentPtyn}\n`;
                            lastPtyn = currentPtyn;
                        }
                    });

                    return `--- PS History ---\n${psLines}\n\n--- PTY History ---\n${ptyLines.trim()}\n\n--- PTYN History ---\n${ptynLines.trim() || "N/A"}`;
                }}
                renderHeader={() => (
                    <tr className="border-b border-slate-700 text-slate-500 bg-slate-900 sticky top-0 z-10 text-[10px] uppercase">
                        <th className="p-3 w-24">Time</th>
                        <th className="p-3 w-32">PS</th>
                        <th className="p-3 w-72">PTY</th>
                        <th className="p-3">PTYN</th>
                    </tr>
                )}
                renderRow={(item: PsHistoryItem, i, u: boolean) => (
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 text-slate-400 border-r border-slate-800/50">{item.time}</td>
                        <td className="p-3 border-r border-slate-800/50">
                            <span className="text-white font-bold tracking-widest whitespace-pre bg-slate-800 px-2 py-1 rounded shadow-sm">{u ? item.ps.replace(/ /g, '_') : item.ps}</span>
                        </td>
                        <td className="p-3 text-slate-400 border-r border-slate-800/50">
                            <span className="text-xs">{ptyList[item.pty] || "Unknown"} <span className="opacity-50">[{item.pty}]</span></span>
                        </td>
                        <td className="p-3 text-slate-300">
                             {item.ptyn.trim() ? item.ptyn : <span className="opacity-30">---</span>}
                        </td>
                    </tr>
                )}
                emptyMessage="No PS / PTY / PTYN data recorded for now."
                copyReverse={true}
                allowUnderscoreToggle={true}
            />
        )}

        {/* Modal: RT History using Generic Viewer */}
        {showRtHistory && (
            <HistoryViewer 
                title="RADIOTEXT HISTORY (LIMITED TO 200 ENTRIES)"
                onClose={() => setShowRtHistory(false)}
                data={data.rtHistory}
                getCopyText={(item: RtHistoryItem) => `[${item.time}] ${item.text}`}
                renderHeader={() => (
                    <tr className="border-b border-slate-700 text-slate-500 bg-slate-900 sticky top-0 z-10">
                        <th className="p-3 w-24">Time</th>
                        <th className="p-3">Radiotext</th>
                    </tr>
                )}
                renderRow={(item: RtHistoryItem, i) => (
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 text-slate-400 border-r border-slate-800/50 align-top">{item.time}</td>
                        <td className="p-3 text-white whitespace-pre-wrap leading-relaxed">{item.text}</td>
                    </tr>
                )}
                emptyMessage="No complete Radiotext messages recorded for now."
                copyReverse={true}
            />
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

// --- GENERIC HISTORY VIEWER COMPONENT (Handles Pause & Copy) ---
interface HistoryViewerProps<T> {
    title: string;
    data: T[];
    onClose: () => void;
    renderHeader: () => React.ReactNode;
    renderRow: (item: T, index: number, useUnderscores: boolean) => React.ReactNode;
    getCopyText: (item: T, useUnderscores: boolean) => string;
    fullCopyFormatter?: (items: T[], useUnderscores: boolean) => string;
    emptyMessage: string;
    copyReverse?: boolean;
    allowUnderscoreToggle?: boolean;
}

const HistoryViewer = <T extends any>({ title, data, onClose, renderHeader, renderRow, getCopyText, fullCopyFormatter, emptyMessage, copyReverse, allowUnderscoreToggle }: HistoryViewerProps<T>) => {
    const [paused, setPaused] = useState(false);
    const [frozenData, setFrozenData] = useState<T[]>([]);
    const [copyStatus, setCopyStatus] = useState<'IDLE' | 'COPIED'>('IDLE');
    const [useUnderscores, setUseUnderscores] = useState(true);

    // Display frozen data if paused, otherwise live data
    const displayData = paused ? frozenData : data;

    const togglePause = () => {
        if (!paused) {
            // Freezing current data
            setFrozenData([...data]);
        }
        setPaused(!paused);
    };

    const handleCopy = () => {
        let itemsToCopy = [...displayData];
        if (copyReverse) {
            itemsToCopy.reverse();
        }

        let text = "";
        if (fullCopyFormatter) {
            text = fullCopyFormatter(itemsToCopy, useUnderscores);
        } else {
            text = itemsToCopy.map(item => getCopyText(item, useUnderscores)).join('\n');
        }

        navigator.clipboard.writeText(text).then(() => {
            setCopyStatus('COPIED');
            setTimeout(() => setCopyStatus('IDLE'), 2000);
        });
    };

    const actions = (
        <div className="flex items-center gap-2 ml-4">
             {/* Pause Button */}
             <button 
                onClick={togglePause}
                className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors uppercase flex items-center gap-1.5 ${paused ? 'bg-yellow-900/40 text-yellow-400 border-yellow-600 hover:bg-yellow-900/60' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'}`}
                title={paused ? "Resume scrolling" : "Pause scrolling"}
            >
                {paused ? (
                    <>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        RESUME
                    </>
                ) : (
                    <>
                         <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                         PAUSE
                    </>
                )}
             </button>

             {/* Copy Button */}
             <button 
                onClick={handleCopy}
                className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors uppercase flex items-center gap-1.5 ${copyStatus === 'COPIED' ? 'bg-green-900/40 text-green-400 border-green-600' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'}`}
                title="Copy content to clipboard"
             >
                 {copyStatus === 'COPIED' ? (
                     <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        COPIED
                     </>
                 ) : (
                     <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                        COPY
                     </>
                 )}
             </button>

             {/* Underscores Toggle Button */}
             {allowUnderscoreToggle && (
                 <button 
                    onClick={() => setUseUnderscores(!useUnderscores)}
                    className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors uppercase flex items-center gap-1.5 ${useUnderscores ? 'bg-blue-900/40 text-blue-400 border-blue-600 hover:bg-blue-900/60' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'}`}
                 >
                    {useUnderscores ? (
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
    );

    return (
        <HistoryModal title={title} onClose={onClose} actions={actions}>
            <table className="w-full text-left text-sm font-mono">
                <thead>
                    {renderHeader()}
                </thead>
                <tbody>
                    {displayData.map((item, i) => renderRow(item, i, useUnderscores))}
                    {displayData.length === 0 && (
                        <tr><td colSpan={10} className="p-6 text-center text-slate-500 italic">{emptyMessage}</td></tr>
                    )}
                </tbody>
            </table>
        </HistoryModal>
    );
};

// Added 'actions' prop to HistoryModal
const HistoryModal: React.FC<{ title: string, onClose: () => void, children: React.ReactNode, actions?: React.ReactNode }> = ({ title, onClose, children, actions }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-3 border-b border-slate-800 bg-slate-900">
                    <div className="flex items-center">
                        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {title}
                        </h3>
                        {/* Actions buttons inserted here */}
                        {actions}
                    </div>
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
