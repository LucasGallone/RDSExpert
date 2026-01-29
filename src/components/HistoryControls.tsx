import React, { useState, useEffect, useMemo } from 'react';
import { RdsData, PTY_RDS, PTY_RBDS, PTY_COMBINED, PsHistoryItem, RtHistoryItem, BandscanEntry } from '../types';
import { ECC_COUNTRY_MAP, LIC_LANGUAGE_MAP } from '../constants';
import { jsPDF } from 'jspdf';

const GROUP_DESCRIPTIONS: Record<string, string> = {
  "0A": "PI, PS, AF, PTY, Flags",
  "0B": "PI, PS, PTY, Flags",
  "1A": "ECC, LIC, PIN",
  "1B": "ECC, LIC, PIN",
  "2A": "Radiotext",
  "2B": "Radiotext",
  "3A": "ODA AIDs List",
  "3B": "ODA AIDs List",
  "4A": "CT - Time & Date",
  "4B": "CT - Time & Date",
  "5A": "TDC / ODA",
  "5B": "TDC / ODA",
  "6A": "ODA / In-House Applications",
  "6B": "ODA / In-House Applications",
  "7A": "ODA / Paging",
  "7B": "ODA / Paging",
  "8A": "TMC",
  "8B": "TMC",
  "9A": "EWS - Emergency Warning System",
  "9B": "EWS - Emergency Warning System",
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

interface HistoryControlsProps {
  data: RdsData;
  onSetRecording?: (val: boolean) => void;
  serverUrl?: string;
}

export const HistoryControls: React.FC<HistoryControlsProps> = ({ data, onSetRecording, serverUrl }) => {
  const [showPsHistory, setShowPsHistory] = useState(false);
  const [showRtHistory, setShowRtHistory] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showBandscanModal, setShowBandscanModal] = useState(false);
  const [exportContent, setExportContent] = useState('');
  const [bandscanContent, setBandscanContent] = useState('');
  const [waitingForFinalReport, setWaitingForFinalReport] = useState(false);
  const [singleMetadata, setSingleMetadata] = useState<BandscanEntry | null>(null);
  const [serverName, setServerName] = useState<string>('');

  // Resolve PTY list using hybrid standard
  const ptyList = PTY_COMBINED;

  // Custom frequency formatting per user rules:
  // de .x00 à .x40 : .x
  // si x50 : .x5 (exemple 88.450 = 88.45)
  // si entre x60 et x90, convertir avec la fréquence supérieure à .0 (exemple 88.470 = 88.5)
  const formatFrequency = (fStr: string) => {
    const f = parseFloat(fStr);
    const mhzBase = Math.floor(f * 10) / 10;
    const khzDecimal = Math.round((f * 1000) % 1000);
    const lastTwoDigits = khzDecimal % 100;
    
    if (lastTwoDigits === 50) return f.toFixed(2); // 88.450 -> 88.45
    if (lastTwoDigits <= 40) return mhzBase.toFixed(1); // 88.400 -> 88.4, 88.420 -> 88.4
    return (mhzBase + 0.1).toFixed(1); // 88.470 -> 88.5
  };

  // --- EXPORT LOGIC ---

  const generateReportContent = (overrideMeta?: BandscanEntry) => {
    // Format date as DD/MM/YYYY at HH:mm:ss
    const nowObj = new Date();
    const dateStr = nowObj.toLocaleDateString('fr-FR');
    const timeStr = nowObj.toLocaleTimeString('fr-FR');
    const now = `${dateStr} at ${timeStr}`;
    
    const ptyName = ptyList[data.pty] || `Unknown (${data.pty})`;
    const psFormatted = data.ps.replace(/ /g, '_'); // Replace spaces with underscores
    
    // Get signal metadata for the TXT header
    const meta = overrideMeta || data.currentMetadata;
    const freqStr = meta?.freq ? formatFrequency(meta.freq) : "??.?";
    const tx = meta?.stationName || data.ps.trim() || "Unknown";
    const city = (meta?.city || "Unknown").split(' | ')[0];
    const dist = meta?.dist || "??";
    const power = meta?.power || "?";
    const mod = meta?.modulation || (data.stereo ? "Stereo" : "Mono");
    const sigVal = meta?.signal || 0;

    // Numerical sort helper for AF list, respecting head if present
    const getSortedAfList = (head: string | null, list: string[]) => {
      const unique = Array.from(new Set(list));
      const others = unique.filter(f => f !== head).sort((a,b) => parseFloat(a) - parseFloat(b));
      return head ? [head, ...others] : unique.sort((a,b) => parseFloat(a) - parseFloat(b));
    };

    // Header with new signal information block
    let content = `RDSExpert - Text Report\n`;
    content += `Generated on: ${now}\n`;
    content += `------------------------------------\n`;
    content += `${freqStr} MHz > ${tx} - ${city}\n`;
    content += `${dist} km - ${power} kW\n`;
    content += `Modulation: ${mod}\n`;
    content += `Signal strength: ${sigVal.toFixed(1)} dBf\n`;
    content += `==================================================\n\n`;

    // 1. Main RDS information
    content += `[1] MAIN RDS INFORMATION\n`;
    content += `------------------------\n`;
    content += `PI:           ${data.pi}\n`;
    content += `PS:           ${psFormatted}\n`;
    content += `PTY:          ${ptyName} [${data.pty}]\n\n`;
    const ptynRaw = (data.ptyn || "").replace(/\r/g, '');
    content += `PTYN:         ${ptynRaw.trim() ? ptynRaw : "N/A"}\n`;
    const lpsRaw = (data.longPs || "").replace(/\r/g, '');
    content += `Long PS:      ${lpsRaw.trim() ? lpsRaw : "N/A"}\n`;
    
    const piFirstVal = data.pi && data.pi.length >= 1 ? data.pi.charAt(0).toUpperCase() : null;
    const eccCountryVal = (data.ecc && piFirstVal && ECC_COUNTRY_MAP[data.ecc.toUpperCase()]?.[piFirstVal]) || null;
    const licLangVal = (data.lic && LIC_LANGUAGE_MAP[data.lic.toUpperCase()]) || null;
    
    content += `ECC:          ${data.ecc || "N/A"}${eccCountryVal ? ` (${eccCountryVal})` : ""}\n`;
    content += `LIC:          ${data.lic || "N/A"}${licLangVal ? ` (${licLangVal})` : ""}\n\n`;

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
    const rtAVal = (data.rtA || "").replace(/\r/g, '').trim();
    const rtBVal = (data.rtB || "").replace(/\r/g, '').trim();
    if (!rtAVal && !rtBVal) {
        content += `No Radiotext detected.\n\n`;
    } else {
        content += `Line A:  ${(data.rtA || "").replace(/\r/g, '')}\n`;
        content += `Line B:  ${(data.rtB || "").replace(/\r/g, '')}\n\n`;
    }

    // 4. AF
    content += `[4] ALTERNATIVE FREQUENCIES (AF)\n`;
    content += `--------------------------------\n`;
    const hasAfB = data.afType === 'B' && Object.keys(data.afBLists).length > 0;
    const hasAfA = data.afType === 'A' && data.af.length > 0;
    if (hasAfB) {
        content += `Method: ${data.afType}\n`;
        Object.entries(data.afBLists).forEach(([head, list]) => {
            const sortedSub = getSortedAfList(head, list as string[]);
            content += `List - ${head}: [${sortedSub.join(' / ')}]\n`;
        });
    } else if (hasAfA) {
        content += `Method: ${data.afType}\n`;
        const sortedA = getSortedAfList(data.afListHead, data.af);
        content += `List: [${sortedA.join(' / ')}]\n`;
    } else {
        content += `No AF list found.\n`;
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

    // 8. GROUPS COUNTER
    content += `[8] GROUPS COUNTER\n`;
    content += `------------------\n`;
    const errorCount = data.groupCounts["--"] || 0;
    const validTotal = Math.max(0, data.groupTotal - errorCount);
    const sortedGroups = Object.keys(data.groupCounts)
      .filter(g => g !== "--")
      .sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (numA !== numB) return numA - numB;
        return a.localeCompare(b);
      });

    if (sortedGroups.length > 0) {
      sortedGroups.forEach(grp => {
        const count = data.groupCounts[grp];
        const percentage = validTotal > 0 ? ((count / validTotal) * 100).toFixed(1) : "0.0";
        const desc = GROUP_DESCRIPTIONS[grp] || "Unknown";
        content += `${grp} (${desc}) > ${percentage}%\n`;
      });
    } else {
      content += `No groups detected.\n`;
    }
    content += `\n`;

    // 9. Radiotext History
    content += `[9] RADIOTEXT HISTORY\n`;
    content += `---------------------\n`;
    [...data.rtHistory].reverse().forEach(h => {
        content += `  [${h.time}] ${h.text}\n`;
    });
    content += `\n`;

    // 10. PS / PTY / PTYN HISTORY
    content += `[10] PS / PTY / PTYN HISTORY\n`;
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

    // • PTY History •
    content += `• PTY History •\n`;
    if (psHistory.length > 0) {
        let lastPtyValue = "";
        psHistory.forEach(h => {
            const currentPtyValue = ptyList[h.pty] || h.pty.toString();
            if (currentPtyValue !== lastPtyValue) {
                content += `[${h.time}] ${currentPtyValue}\n`;
                /* DO add comment above each fix. */
                /* Fix: Corrected 'lastPty' to 'lastPtyValue' to match the declared variable name. */
                lastPtyValue = currentPtyValue;
            }
        });
    } else {
        content += `No data decoded...\n`;
    }
    content += `\n`;

    // • PTYN History •
    content += `• PTYN History •\n`;
    const ptynEntries = psHistory.filter(h => h.ptyn && h.ptyn.trim().length > 0);
    if (ptynEntries.length > 0) {
        let lastPtynValue = "";
        ptynEntries.forEach(h => {
            const currentPtyn = h.ptyn;
            if (currentPtyn !== lastPtynValue) {
                content += `[${h.time}] ${currentPtyn}\n`;
                /* DO add comment above each fix. */
                /* Fix: Ensure name consistency for lastPtynValue. */
                lastPtynValue = currentPtyn;
            }
        });
    } else {
        content += `No data decoded...\n`;
    }

    return content;
  };

  // --- Bandscan Report Generator ---
  const generateBandscanReport = (overrideServerName?: string) => {
    const nowObj = new Date();
    const now = `${nowObj.toLocaleDateString('fr-FR')} at ${nowObj.toLocaleTimeString('fr-FR')}`;
    const srv = overrideServerName !== undefined ? overrideServerName : serverName;
    let content = `RDSExpert - BANDSCAN REPORT\n`;
    if (srv) content += `Server: ${srv}\n`;
    content += `Generated on: ${now}\n`;
    content += `==================================================\n\n`;

    // 1. Bandscan List with Column Alignment
    content += `[BANDSCAN SUMMARY]\n`;
    content += `------------------\n`;
    data.bandscanEntries.forEach(entry => {
        const f = formatFrequency(entry.freq);
        const pi = entry.pi;
        const ps = entry.ps.replace(/ /g, '_');
        const sig = entry.signal.toFixed(1);
        const st = entry.stationName || "Unknown";
        const city = (entry.city || "Unknown").split(' | ')[0];
        // Updated formatting: [Fréquence] MHz -> PI: [PI] | PS: [PS] | [dBf] -> [Station] - [Ville]
        content += `${f} MHz -> PI: ${pi} | PS: ${ps} | ${sig} dBf -> ${st} - ${city}\n`;
    });
    content += `\n`;

    // 2. Detailed reports
    content += `[DETAILED REPORTS]\n`;
    content += `------------------\n`;
    data.bandscanEntries.forEach(entry => {
        // Detailed Reports: Only show the internal RDS Report without duplicate headers
        content += entry.rdsReport;
        content += `\n==================================================\n\n`;
    });

    return content;
  };

  const handleOpenExport = async () => {
      let metaToUse: BandscanEntry | null = null;
      // Logic call API to get real metadata for the current station
      if (serverUrl) {
          try {
              let inputUrl = serverUrl.trim();
              if (!/^https?:\/\//i.test(inputUrl)) inputUrl = 'http://' + inputUrl;
              const urlObj = new URL(inputUrl);
              urlObj.pathname = urlObj.pathname.replace(/\/rds$/, "").replace(/\/$/, "") + "/api";
              const proxyUrl = `https://cors-proxy.rdsexpert.workers.dev/?url=${encodeURIComponent(urlObj.toString())}`;
              
              const res = await fetch(proxyUrl);
              if (res.ok) {
                  const json = await res.json();
                  metaToUse = {
                      freq: json.freq,
                      signal: json.sig,
                      stationName: json.txInfo?.tx || json.ps || data.ps.trim() || "Unknown",
                      city: json.txInfo?.city || "Unknown city and power",
                      pi: data.pi,
                      ps: data.ps,
                      ta: data.ta,
                      tp: data.tp,
                      rdsReport: "", // Uses the exportContent fallback in PDF generator
                      dist: json.txInfo?.dist,
                      power: json.txInfo?.erp,
                      modulation: json.st ? "Stereo" : "Mono",
                      hasOda: data.hasOda,
                      hasRtPlus: data.hasRtPlus,
                      hasEon: data.hasEon,
                      hasTmc: data.hasTmc
                  };
                  setSingleMetadata(metaToUse);
              } else {
                  setSingleMetadata(null);
              }
          } catch (e) {
              setSingleMetadata(null);
          }
      } else {
          setSingleMetadata(null);
      }

      // Pass the fetched metadata directly to avoid waiting for React state update
      const content = generateReportContent(metaToUse || undefined);
      setExportContent(content);
      setShowExportModal(true);
  };

  // Define handleToggleRecording to manage bandscan recording state
  const handleToggleRecording = () => {
    if (onSetRecording) {
      const isCurrentlyRecording = data.isRecording;
      if (isCurrentlyRecording) {
        // Stopping recording: signal intent to generate final report once state updates
        setWaitingForFinalReport(true);
      }
      onSetRecording(!isCurrentlyRecording);
    }
  };

  // Ce hook garantit que le rapport de bandscan s'affiche uniquement après que l'état local "waitingForFinalReport"
  // soit actif ET que React ait fini de mettre à jour "data.isRecording" (ce qui confirme que la dernière station a été capturée).
  useEffect(() => {
    const fetchFinalData = async () => {
        if (!serverUrl) return '';
        try {
            let inputUrl = serverUrl.trim();
            if (!/^https?:\/\//i.test(inputUrl)) inputUrl = 'http://' + inputUrl;
            const urlObj = new URL(inputUrl);
            urlObj.pathname = urlObj.pathname.replace(/\/rds$/, "").replace(/\/$/, "") + "/static_data";
            const proxyUrl = `https://cors-proxy.rdsexpert.workers.dev/?url=${encodeURIComponent(urlObj.toString())}`;
            const res = await fetch(proxyUrl);
            if (res.ok) {
                const json = await res.json();
                if (json.tunerName) {
                    setServerName(json.tunerName);
                    return json.tunerName;
                }
            }
        } catch (e) {}
        return '';
    };

    if (waitingForFinalReport && !data.isRecording) {
        fetchFinalData().then((fetchedName) => {
            setWaitingForFinalReport(false);
            const report = generateBandscanReport(fetchedName);
            setBandscanContent(report);
            setShowBandscanModal(true);
        });
    }
  }, [data.isRecording, data.bandscanEntries.length, waitingForFinalReport, serverUrl]);

  return (
    <div className="flex justify-center w-full my-4">
        {/* Main Controls Group */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-2 flex flex-row flex-nowrap overflow-x-auto no-scrollbar gap-2 md:gap-4 shadow-sm backdrop-blur-sm max-w-full">
            <button 
                onClick={() => setShowPsHistory(true)}
                className="px-3 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs font-bold uppercase rounded border transition-colors bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white flex items-center justify-center gap-2 whitespace-nowrap"
            >
                <i className="fa-solid fa-clock-rotate-left w-3 h-3"></i>
                PS / PTY / PTYN HISTORY
            </button>
            <button 
                onClick={() => setShowRtHistory(true)}
                className="px-3 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs font-bold uppercase rounded border transition-colors bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white flex items-center justify-center gap-2 whitespace-nowrap"
            >
                <i className="fa-solid fa-clock-rotate-left w-3 h-3"></i>
                RADIOTEXT HISTORY
            </button>
            <button 
                onClick={handleOpenExport}
                className="px-3 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs font-bold uppercase rounded border transition-colors bg-blue-900/30 text-blue-200 border-blue-500/50 hover:bg-blue-800/40 hover:text-white flex items-center justify-center gap-2 whitespace-nowrap"
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                EXPORT DATA
            </button>
            <button 
                onClick={handleToggleRecording}
                className={`px-3 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs font-bold uppercase rounded border transition-all flex items-center justify-center gap-2 whitespace-nowrap ${data.isRecording ? 'bg-red-600 text-white border-red-500 animate-pulse' : 'bg-red-900/30 text-red-400 border-red-500/50 hover:bg-red-500/40 hover:text-white'}`}
            >
                <i className={`fa-solid ${data.isRecording ? 'fa-stop' : 'fa-circle'} text-[10px]`}></i>
                {data.isRecording ? 'STOP RECORDING' : 'RECORD BANDSCAN'}
            </button>
        </div>

        {/* Modal: PS History using Generic Viewer */}
        {showPsHistory && (
            <HistoryViewer 
                title="PS / PTY / PTYN HISTORY (MAX: 200 ENTRIES)"
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
                            /* DO add comment above each fix. */
                            /* Fix: Corrected variable name to 'lastPtyn' to match the declaration in this scope. */
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
                bandscanEntries={singleMetadata ? [singleMetadata] : [{
                    freq: "??.?",
                    signal: 0,
                    stationName: data.ps.trim() || "Unknown Station",
                    city: "Unknown City",
                    pi: data.pi,
                    ps: data.ps,
                    ta: data.ta,
                    tp: data.tp,
                    rdsReport: "" // Fallback to auto-filtered displayContent in PDF logic
                }]}
                formatFreq={formatFrequency}
                serverName={serverName}
            />
        )}

        {/* Modal: Bandscan Export */}
        {showBandscanModal && (
            <ExportModal 
                title="BANDSCAN EXPORT" 
                content={bandscanContent}
                pi="BANDSCAN"
                bandscanEntries={data.bandscanEntries}
                onClose={() => setShowBandscanModal(false)} 
                formatFreq={formatFrequency}
                serverName={serverName}
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

    const displayData = paused ? frozenData : data;

    const togglePause = () => {
        if (!paused) {
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

             {allowUnderscoreToggle && (
                 <button 
                    onClick={() => setUseUnderscores(!useUnderscores)}
                    className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors uppercase flex items-center gap-1.5 ${useUnderscores ? 'bg-blue-900/40 text-blue-400 border-blue-600 hover:bg-yellow-900/60' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'}`}
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
        /* DO add comment above each fix. */
        /* Fix: Use HistoryModal instead of HistoryViewer recursively to fix the property 'children' error. */
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

const ExportModal: React.FC<{ title: string, content: string, pi: string, onClose: () => void, bandscanEntries?: BandscanEntry[], formatFreq?: (f: string) => string, serverName?: string }> = ({ title, content, pi, onClose, bandscanEntries, formatFreq, serverName }) => {
    const [copyStatus, setCopyStatus] = useState<'IDLE' | 'COPIED'>('IDLE');
    
    // States for optional history inclusion (disabled by default)
    const [includeRtHistory, setIncludeRtHistory] = useState(false);
    const [includePsHistory, setIncludePsHistory] = useState(false);

    // Filter report content based on checkboxes with improved global regex
    const getFilteredReport = (rawContent: string) => {
        let filtered = rawContent;
        if (!includeRtHistory) {
            filtered = filtered.replace(/\[9\] RADIOTEXT HISTORY[\s\S]*?(?=\[10\]|={20,}|$)/g, "");
        }
        if (!includePsHistory) {
            filtered = filtered.replace(/\[10\] PS \/ PTY \/ PTYN HISTORY[\s\S]*?(?=={20,}|$)/g, "");
        }
        return filtered.trim();
    };

    const displayContent = useMemo(() => getFilteredReport(content), [content, includeRtHistory, includePsHistory]);

    const handleCopy = () => {
        navigator.clipboard.writeText(displayContent).then(() => {
            setCopyStatus('COPIED');
            setTimeout(() => setCopyStatus('IDLE'), 2000);
        });
    };

    const handleDownload = () => {
        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR').replace(/\//g, '-'); // DD-MM-YYYY
        const timeStr = now.toLocaleTimeString('fr-FR', { hour12: false }).replace(/:/g, '-'); // HH-MM-SS
        const piSafe = pi.trim() || "XXXX";
        const filename = `RDSExpert_${piSafe}_${dateStr}_${timeStr}.txt`;

        const blob = new Blob([displayContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDownloadPDF = () => {
        if (!bandscanEntries || !formatFreq) return;

        const doc = new jsPDF();
        const nowObj = new Date();
        const dateStrNow = nowObj.toLocaleDateString('fr-FR');
        const timeStrNow = nowObj.toLocaleTimeString('fr-FR');
        const now = `${dateStrNow} at ${timeStrNow}`;
        
        // --- PAGE 1: INDEX (Only if multi-station) ---
        const isBandscan = bandscanEntries.length > 1;

        // Correctly calculate the summary pages count based on dynamic heights
        let summaryPagesCount = 1;
        if (isBandscan) {
            let checkY = 78;
            bandscanEntries.forEach((entry) => {
                const cityShort = entry.city.split(' | ')[0];
                const infoText = `${entry.stationName} - ${cityShort}`;
                const wrappedInfo = doc.splitTextToSize(infoText, 60);
                const textHeight = wrappedInfo.length * 4;
                const hasServices = entry.hasOda || entry.hasRtPlus || entry.hasEon || entry.hasTmc || entry.tp || entry.ta;
                const minHeight = hasServices ? 13 : 10;
                const rowHeight = Math.max(minHeight, textHeight + 5);
                
                if (checkY + rowHeight > 285) {
                    summaryPagesCount++;
                    checkY = 22 + rowHeight;
                } else {
                    checkY += rowHeight;
                }
            });
        }
        
        const stationStartPages: number[] = [];

        if (isBandscan) {
            doc.setFillColor(15, 23, 42); // Ardoise 900
            doc.rect(0, 0, 210, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(24);
            doc.text("RDS", 15, 25);
            doc.setTextColor(59, 130, 246); // Bleu 500
            doc.text("Expert", 33, 25);
            doc.setFontSize(10);
            doc.setTextColor(148, 163, 184); // Ardoise 400
            doc.setFont("helvetica", "normal");
            doc.text("DETAILED BANDSCAN REPORT", 15, 33);
            
            // Inclusion nom du serveur et date à droite
            const rightMargin = 195;
            doc.setFontSize(10);
            const genText = `Generated on: ${now}`;
            const genWidth = doc.getTextWidth(genText);
            doc.text(genText, rightMargin - genWidth, 33);
            
            if (serverName) {
                doc.setFontSize(10);
                // Aggressive removal of non-standard characters and emojis
                const sanitizedServerName = serverName.replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
                const srvText = `Server: ${sanitizedServerName}`;
                const srvWidth = doc.getTextWidth(srvText);
                doc.text(srvText, rightMargin - srvWidth, 28);
            }

            // Table Header Title
            doc.setTextColor(15, 23, 42); // Ardoise 900
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("Bandscan Summary", 15, 55);
            doc.setDrawColor(37, 99, 235); // Bleu 600
            doc.setLineWidth(0.5);
            doc.line(15, 58, 65, 58);

            // Column Titles - EXACT TEXTS AS REQUESTED
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139); // Slate 500
            doc.text("FREQ.", 15, 68);
            doc.text("PI", 38, 68);
            doc.text("PS", 55, 68);
            doc.text("MOD.", 84, 68);
            doc.text("SIGNAL", 100, 68);
            doc.text("STATION - CITY", 135, 68);
            
            doc.setDrawColor(226, 232, 240); // Slate 200
            doc.setLineWidth(0.2);
            doc.line(15, 70, 195, 70);

            // Logic setup for dynamic summary heights
            let yPos = 78;
            bandscanEntries.forEach((entry, index) => {
                const cityShort = entry.city.split(' | ')[0];
                const infoText = `${entry.stationName} - ${cityShort}`;
                const wrappedInfo = doc.splitTextToSize(infoText, 60);
                const textHeight = wrappedInfo.length * 4;
                const hasServices = !!(entry.hasOda || entry.hasRtPlus || entry.hasEon || entry.hasTmc || entry.tp || entry.ta);
                const minHeight = hasServices ? 13 : 10;
                const rowHeight = Math.max(minHeight, textHeight + 5);
                
                // Page break check
                if (yPos + rowHeight > 285) {
                    doc.addPage();
                    yPos = 20;
                    // Redraw sub-header (Bold + Ligne grise)
                    doc.setFontSize(8);
                    doc.setTextColor(100, 116, 139);
                    doc.setFont("helvetica", "bold");
                    doc.text("FREQ.", 15, 12);
                    doc.text("PI", 38, 12);
                    doc.text("PS", 55, 12);
                    doc.text("MOD.", 84, 12);
                    doc.text("SIGNAL", 100, 12);
                    doc.text("STATION - CITY", 135, 12);
                    doc.setDrawColor(226, 232, 240);
                    doc.setLineWidth(0.2);
                    doc.line(15, 14, 195, 14);
                    yPos = 22;
                }

                // Alternating row background
                if (index % 2 === 0) {
                    doc.setFillColor(248, 250, 252); // Slate 50
                    doc.rect(12, yPos - 7, 186, rowHeight, 'F');
                }

                const freqStr = formatFreq(entry.freq);
                const psFormatted = entry.ps.replace(/ /g, '_');
                
                // Frequency
                doc.setFont("helvetica", "bold");
                doc.setFontSize(11.7);
                doc.setTextColor(37, 99, 235); // Blue 600
                doc.text(`${freqStr}`, 15, yPos);

                // Ajout indicateurs TP et TA sous la fréquence
                let badgeX = 15;
                if (entry.tp) {
                    doc.setFillColor(21, 128, 61); // Vert foncé
                    // @ts-ignore
                    doc.roundedRect(badgeX, yPos + 1.5, 6.5, 2.5, 0.3, 0.3, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(4.5);
                    doc.setFont("helvetica", "bold");
                    const tW = doc.getTextWidth("TP");
                    doc.text("TP", badgeX + (6.5 - tW) / 2, yPos + 1.5 + 1.8);
                    badgeX += 7.5;
                }
                if (entry.ta) {
                    doc.setFillColor(153, 27, 27); // Rouge foncé
                    // @ts-ignore
                    doc.roundedRect(badgeX, yPos + 1.5, 6.5, 2.5, 0.3, 0.3, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(4.5);
                    doc.setFont("helvetica", "bold");
                    const tW = doc.getTextWidth("TA");
                    doc.text("TA", badgeX + (6.5 - tW) / 2, yPos + 1.5 + 1.8);
                }
                
                // PI
                doc.setFont("helvetica", "normal");
                doc.setFontSize(10); // Correction taille de police
                doc.setTextColor(100, 116, 139); // Slate 500
                doc.text(entry.pi, 38, yPos);
                
                // PS
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10); // Correction taille de police
                doc.setTextColor(15, 23, 42); // Slate 900
                doc.text(psFormatted, 55, yPos);

                // Column MOD. at 84 (Stereo Icon)
                if (entry.modulation === "Stereo") {
                    doc.setDrawColor(30, 41, 59);
                    doc.setLineWidth(0.3);
                    const iconCenterX = 87.5;
                    const iconCenterY = yPos - 1.6;
                    const radius = 1.5;
                    const offset = 1.0;
                    doc.circle(iconCenterX - offset, iconCenterY, radius, 'S');
                    doc.circle(iconCenterX + offset, iconCenterY, radius, 'S');
                }

                // Mini Badges in Summary List - Centered from PI column (38) to PS column end (~80)
                if (hasServices) {
                    const badges = [];
                    if (entry.hasOda) badges.push({ label: "ODA", color: [168, 85, 247] });
                    if (entry.hasRtPlus) badges.push({ label: "RT+", color: [34, 197, 94] });
                    if (entry.hasEon) badges.push({ label: "EON", color: [234, 179, 8] });
                    if (entry.hasTmc) badges.push({ label: "TMC", color: [239, 68, 68] });

                    const bW = 6.5;
                    const bH = 2.5;
                    const bG = 1.0;
                    const totalW = (badges.length * bW) + ((badges.length - 1) * bG);
                    
                    // Centered horizontal area: between x=38 (PI) and x=80 (PS end)
                    const centerPointX = (38 + 80) / 2;
                    let bX = centerPointX - (totalW / 2);
                    const bY = yPos + 1.5;

                    badges.forEach(b => {
                        doc.setFillColor(b.color[0], b.color[1], b.color[2]);
                        // @ts-ignore
                        doc.roundedRect(bX, bY, bW, bH, 0.3, 0.3, 'F');
                        doc.setTextColor(255, 255, 255);
                        doc.setFontSize(4.5);
                        doc.setFont("helvetica", "bold");
                        const tW = doc.getTextWidth(b.label);
                        doc.text(b.label, bX + (bW - tW) / 2, bY + 1.8);
                        bX += bW + bG;
                    });
                }

                // Signal Block (Value above, Gauge below)
                const sig = entry.signal;
                doc.setFontSize(7);
                doc.setTextColor(71, 85, 105);
                doc.setFont("helvetica", "normal");
                doc.text(`${sig.toFixed(1)} dBf`, 100, yPos - 1.5);

                // Mini Gauge below value
                doc.setFillColor(226, 232, 240); // Slate 200
                doc.rect(100, yPos + 0.5, 20, 2, 'F');
                if (sig <= 25.0) doc.setFillColor(239, 68, 68);
                else if (sig <= 50.0) doc.setFillColor(217, 119, 6);
                else doc.setFillColor(34, 197, 94);
                const gaugeWidth = Math.min(20, Math.max(0, (sig / 100) * 20));
                doc.rect(100, yPos + 0.5, gaugeWidth, 2, 'F');

                // Station - City
                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(100, 116, 139);
                doc.text(wrappedInfo, 135, yPos);
                
                yPos += rowHeight;
            });
        }
        
        // --- PAGES DE DÉTAILS ---
        bandscanEntries.forEach((entry, idx) => {
            if (isBandscan || idx > 0) doc.addPage();
            stationStartPages[idx] = doc.getNumberOfPages();
            
            // En-tête de station modernisé
            doc.setFillColor(241, 245, 249); // Ardoise 100
            doc.rect(0, 0, 210, 42, 'F');
            
            const freqStr = formatFreq(entry.freq);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.setTextColor(37, 99, 235); // Bleu
            doc.text(`${freqStr} MHz`, 15, 20);
            
            // Add modulation below frequency
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 116, 139);
            doc.text(`Modulation: ${entry.modulation || "Mono"}`, 15, 26);
            
            // Case TP verte et TA rouge foncée
            let detBadgeX = 15;
            if (entry.tp) {
                doc.setFillColor(21, 128, 61); // Vert foncé
                doc.rect(detBadgeX, 28, 7, 4, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(7);
                doc.setFont("helvetica", "bold");
                const tW = doc.getTextWidth("TP");
                doc.text("TP", detBadgeX + (7 - tW) / 2, 31);
                detBadgeX += 8.5;
            }
            if (entry.ta) {
                doc.setFillColor(153, 27, 27); // Rouge foncé
                doc.rect(detBadgeX, 28, 7, 4, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(7);
                doc.setFont("helvetica", "bold");
                const tW = doc.getTextWidth("TA");
                doc.text("TA", detBadgeX + (7 - tW) / 2, 31);
            }
            
            doc.setFont("helvetica", "bold").setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text(`${entry.stationName}`, 60, 20);
            
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.setFont("helvetica", "normal");
            const cleanCity = entry.city.split(' | ')[0];
            doc.text(`${cleanCity}`, 60, 26);
            
            if (entry.dist || entry.power) {
                const metaStr = `${entry.dist ? entry.dist + ' km' : ''}${entry.dist && entry.power ? ' - ' : ''}${entry.power ? entry.power + ' kW' : ''}`;
                doc.text(metaStr, 60, 31);
            }
            
            // Indicateur de signal visuel
            const sig = entry.signal;
            doc.setFillColor(226, 232, 240); // Ardoise 200
            doc.rect(140, 25, 50, 4, 'F');
            
            // Strictly correct color logic:
            if (sig <= 25.0) {
                doc.setFillColor(239, 68, 68); // Rouge 500
            } else if (sig <= 50.0) {
                doc.setFillColor(217, 119, 6); // Jaune foncé (Amber 600)
            } else {
                doc.setFillColor(34, 197, 94); // Vert 500
            }
            
            const visualWidth = Math.min(50, Math.max(0, (sig / 100) * 50)); 
            doc.rect(140, 25, visualWidth, 4, 'F');
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.text(`SIGNAL: ${sig.toFixed(1)} dBf`, 140, 23);

            // --- RDS Services Badges on Detail Page ---
            const badges = [];
            if (entry.hasOda) badges.push({ label: "ODA", color: [168, 85, 247] });
            if (entry.hasRtPlus) badges.push({ label: "RT+", color: [34, 197, 94] });
            if (entry.hasEon) badges.push({ label: "EON", color: [234, 179, 8] });
            if (entry.hasTmc) badges.push({ label: "TMC", color: [239, 68, 68] });

            if (badges.length > 0) {
                const bW = 10;
                const bH = 4;
                const bG = 1.5;
                const totalW = (badges.length * bW) + ((badges.length - 1) * bG);
                const gCenter = 140 + 25;
                let bX = gCenter - (totalW / 2);
                const bY = 33.5; 

                badges.forEach(b => {
                    doc.setFillColor(b.color[0], b.color[1], b.color[2]);
                    // @ts-ignore
                    doc.roundedRect(bX, bY, bW, bH, 0.5, 0.5, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(6.5);
                    doc.setFont("helvetica", "bold");
                    const tW = doc.getTextWidth(b.label);
                    doc.text(b.label, bX + (bW - tW) / 2, bY + 3);
                    bX += bW + bG;
                });
            }

            if (isBandscan) {
                doc.setTextColor(37, 99, 235);
                doc.setFontSize(7);
                /* DO add comment above each fix. */
                // Fix: Force normal font to prevent bold inheritance for the return link
                doc.setFont("helvetica", "normal");
                const returnLabel = "Return to the summary ^";
                const labelWidth = doc.getTextWidth(returnLabel);
                doc.text(returnLabel, 195 - labelWidth, 12);
                doc.link(195 - labelWidth, 8, labelWidth, 6, { pageNumber: 1 });
            }

            // --- Generation Timestamp Line (Station specific) ---
            const stationGenTimeMatch = entry.rdsReport.match(/Generated on: (.*)/);
            const stationGenTime = stationGenTimeMatch ? stationGenTimeMatch[1] : now;
            
            doc.setFontSize(10);
            doc.setTextColor(71, 85, 105); // Ardoise 600
            doc.setFont("helvetica", "bold");
            doc.text(`Generated on: ${stationGenTime}`, 15, 48.5);
            
            doc.setDrawColor(203, 213, 225); // Ardoise 300
            doc.setLineWidth(0.3);
            doc.line(15, 52, 195, 52);
            
            // --- Content Rendering ---
            let detailY = 62;
            let historyPageStarted = false; // Flag reset for each station loop
            const sourceReport = entry.rdsReport || displayContent;
            const filteredEntryReport = getFilteredReport(sourceReport);
            const sections = filteredEntryReport.split(/\n\s*\n/).filter(s => !s.includes('MHz >') && !s.includes('Generated on:') && !s.includes('km -') && !s.includes('Modulation:') && !s.includes('Signal strength:')); 
            
            sections.forEach((section, sIdx) => {
                const lines = section.split('\n').filter(l => l.trim().length > 0 && !l.includes('-----') && !l.includes('===='));
                if (lines.length === 0) return;

                let sectionTitle = "";
                if (lines[0].startsWith('[')) {
                    sectionTitle = lines[0];
                    
                    // Logic to isolate BOTH history sections [9] and [10] on the SAME dedicated block of pages
                    const isHistorySection = sectionTitle.includes('[9]') || sectionTitle.includes('[10]');
                    if (isHistorySection && !historyPageStarted) {
                        doc.addPage();
                        detailY = 20;
                        historyPageStarted = true;
                    } else if (detailY > 270) {
                        doc.addPage();
                        detailY = 20;
                    }
                    
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(11);
                    doc.setTextColor(37, 99, 235); 
                    doc.text(sectionTitle, 15, detailY);
                    detailY += 6;
                    lines.shift(); 
                }

                const isNoFormatSection = sectionTitle.includes('[6]') || sectionTitle.includes('[8]') || sectionTitle.includes('[9]') || sectionTitle.includes('[10]');

                doc.setFontSize(9);
                doc.setFont("helvetica", "normal");
                lines.forEach((line, lIdx) => {
                    const trimmedLine = line.trim();
                    const isHistoryLine = trimmedLine.startsWith('[') || trimmedLine.startsWith('•');
                    const isBulletLine = trimmedLine.startsWith('- ');
                    const colonIdx = line.indexOf(':');

                    if (colonIdx !== -1 && !isHistoryLine && !isBulletLine && !isNoFormatSection) {
                        const label = line.substring(0, colonIdx + 1);
                        const valueRaw = line.substring(colonIdx + 1);
                        const value = sectionTitle.includes('[3]') ? valueRaw.substring(2) : valueRaw.trim();
                        
                        doc.setFont("helvetica", "bold");
                        doc.setTextColor(71, 85, 105); 
                        doc.text(label, 15, detailY);
                        doc.setFont("helvetica", "normal");
                        doc.setTextColor(0, 0, 0);
                        
                        const valueX = 45; 
                        const maxWidth = 195 - valueX;

                        // Special logic for Section [2] (Flags/DI) styling
                        if (sectionTitle.includes('[2]')) {
                            const parts = value.split(' | ');
                            let currentX = valueX;
                            parts.forEach((part, pIdx) => {
                                const trimmedPart = part.trim();
                                const isTA1 = trimmedPart === "TA = 1";
                                const isTP1 = trimmedPart === "TP = 1";
                                const isOne = trimmedPart.includes("= 1");
                                
                                if (isTA1) {
                                    doc.setFont("helvetica", "bold");
                                    doc.setTextColor(220, 38, 38); // Rouge clair
                                } else if (isTP1) {
                                    doc.setFont("helvetica", "bold");
                                    doc.setTextColor(22, 163, 74); // Vert clair
                                } else if (isOne) {
                                    doc.setFont("helvetica", "bold");
                                    doc.setTextColor(0, 0, 0);
                                } else {
                                    doc.setFont("helvetica", "normal");
                                    doc.setTextColor(0, 0, 0);
                                }
                                
                                doc.text(part, currentX, detailY);
                                currentX += doc.getTextWidth(part);
                                
                                if (pIdx < parts.length - 1) {
                                    doc.setFont("helvetica", "normal");
                                    doc.setTextColor(100, 116, 139);
                                    const sep = " | ";
                                    doc.text(sep, currentX, detailY);
                                    currentX += doc.getTextWidth(sep);
                                }
                            });
                        } else if (sectionTitle.includes('[3]')) {
                            // For Section [3] (Radiotext), use text() directly to preserve leading spaces exactly.
                            doc.text(value, valueX, detailY);
                        } else {
                            const wrappedValue = doc.splitTextToSize(value, maxWidth);
                            wrappedValue.forEach((vLine: string, vIdx: number) => {
                                if (vIdx > 0) {
                                    detailY += 5;
                                    if (detailY > 280 && (vIdx < wrappedValue.length - 1 || lIdx < lines.length - 1 || sIdx < sections.length - 1)) {
                                        doc.addPage();
                                        detailY = 20;
                                    }
                                }
                                doc.text(vLine, valueX, detailY);
                            });
                        }
                    } else {
                        doc.setFont("helvetica", "normal");
                        doc.setTextColor(0, 0, 0);
                        
                        const wrappedLine = doc.splitTextToSize(line, 180);
                        wrappedLine.forEach((lLine: string, lIdxWrapped: number) => {
                            if (lIdxWrapped > 0) {
                                detailY += 5;
                                if (detailY > 280 && (lIdxWrapped < wrappedLine.length - 1 || lIdx < lines.length - 1 || sIdx < sections.length - 1)) {
                                    doc.addPage();
                                    detailY = 20;
                                }
                            }
                            doc.text(lLine, 15, detailY);
                        });
                    }
                    detailY += 5;
                    // FIX: Ensure new page is only created if there are remaining lines or sections to write.
                    if (detailY > 280 && (lIdx < lines.length - 1 || sIdx < sections.length - 1)) {
                        doc.addPage();
                        detailY = 20;
                    }
                });
                detailY += 4; 
            });
        });

        // --- DEUXIÈME PASSE : CRÉATION DES LIENS DU RÉSUMÉ ---
        if (isBandscan) {
            let currentSummaryPage = 1;
            doc.setPage(1);
            let yLink = 78;
            bandscanEntries.forEach((entry, index) => {
                const cityShort = entry.city.split(' | ')[0];
                const infoText = `${entry.stationName} - ${cityShort}`;
                const wrappedInfo = doc.splitTextToSize(infoText, 60);
                const textHeight = wrappedInfo.length * 4;
                const hasServices = !!(entry.hasOda || entry.hasRtPlus || entry.hasEon || entry.hasTmc || entry.tp || entry.ta);
                const minHeight = hasServices ? 13 : 10;
                const rowHeight = Math.max(minHeight, textHeight + 5);
                
                if (yLink + rowHeight > 285) {
                    currentSummaryPage++;
                    doc.setPage(currentSummaryPage);
                    yLink = 22;
                }
                doc.link(12, yLink - 7, 186, rowHeight, { pageNumber: stationStartPages[index] });
                yLink += rowHeight;
            });
        }

        // --- TROISIÈME PASSE : LIENS DE NAVIGATION ENTRE STATIONS ---
        if (isBandscan) {
            bandscanEntries.forEach((_, index) => {
                doc.setPage(stationStartPages[index]);
                doc.setTextColor(37, 99, 235);
                doc.setFontSize(7);
                /* DO add comment above each fix. */
                // Fix: Force normal font for nav links to prevent inheritance issues
                doc.setFont("helvetica", "normal");
                
                const spacing = 8;
                const nextLabel = "Next station >";
                const prevLabel = "< Previous station";
                const nextWidth = doc.getTextWidth(nextLabel);
                const prevWidth = doc.getTextWidth(prevLabel);

                if (index < bandscanEntries.length - 1) {
                    // Position Next at far right
                    const nextX = 195 - nextWidth;
                    doc.text(nextLabel, nextX, 16);
                    doc.link(nextX, 13, nextWidth, 5, { pageNumber: stationStartPages[index + 1] });
                }
                
                if (index > 0) {
                    // Position Previous to the left of Next (if Next exists) or at far right
                    const nextPartWidth = (index < bandscanEntries.length - 1) ? (nextWidth + spacing) : 0;
                    const prevX = 195 - nextPartWidth - prevWidth;
                    doc.text(prevLabel, prevX, 16);
                    doc.link(prevX, 13, prevWidth, 5, { pageNumber: stationStartPages[index - 1] });
                }
            });
        }
        
        const nowFile = new Date();
        const dateStrFile = nowFile.toLocaleDateString('fr-FR').replace(/\//g, '-');
        const timeStrFile = nowFile.toLocaleTimeString('fr-FR', { hour12: false }).replace(/:/g, '-');
        const filename = isBandscan ? `RDSExpert Bandscan Report - ${dateStrFile} - ${timeStrFile}.pdf` : `RDSExpert Report - ${pi.trim() || "XXXX"} - ${dateStrFile} - ${timeStrFile}.pdf`;
        doc.save(filename);
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
                
                <div className="bg-slate-900/50 p-3 border-b border-slate-800 flex flex-row items-center justify-center gap-6 whitespace-nowrap overflow-x-auto no-scrollbar">
                    <label className="flex items-center gap-2 cursor-pointer group shrink-0">
                        <input 
                            type="checkbox" 
                            checked={includeRtHistory} 
                            onChange={(e) => setIncludeRtHistory(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500/50 focus:ring-offset-slate-950 transition-all cursor-pointer"
                        />
                        <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-300 transition-colors uppercase tracking-tight">Include RT History</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group shrink-0">
                        <input 
                            type="checkbox" 
                            checked={includePsHistory} 
                            onChange={(e) => setIncludePsHistory(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500/50 focus:ring-offset-slate-950 transition-all cursor-pointer"
                        />
                        <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-300 transition-colors uppercase tracking-tight">Include PS / PTY / PTYN History</span>
                    </label>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950 p-4">
                    <textarea 
                        readOnly 
                        value={displayContent} 
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

                    {bandscanEntries && (
                        <button 
                            onClick={handleDownloadPDF}
                            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded transition-colors uppercase border border-red-500 shadow-sm flex items-center gap-2"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            DOWNLOAD PDF
                        </button>
                    )}

                    <button 
                        onClick={handleDownload}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded transition-colors uppercase border border-blue-500 shadow-sm flex items-center gap-2"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        DOWNLOAD TXT
                    </button>
                    
                    <button onClick={onClose} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded transition-colors uppercase border border-slate-700 shadow-sm">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
