
import React, { useEffect, useRef, useState } from 'react';
import { X, Zap, Loader2, CheckCircle2, XCircle, AlertCircle, Infinity, Repeat, Pause } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from "html5-qrcode";

interface RecentScan {
   id: number;
   code: string;
   status: 'success' | 'error' | 'loading'; // Added loading status
   message?: string;
}

interface ScannerModalProps {
   isOpen: boolean;
   onClose: () => void;
   onCapture: (barcode: string) => void;
   isProcessing: boolean;
   isContinuousScan?: boolean;
   onToggleContinuous?: () => void;
   recentScans?: RecentScan[];
   toastMessage?: { message: string, type: 'error' | 'success' } | null;
   scanSpeed?: 'SLOW' | 'NORMAL' | 'FAST' | 'TURBO'; // New Prop
   isPaused?: boolean; // Auto-pause scanning when confirmation/acknowledgment is active
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
   isOpen,
   onClose,
   onCapture,
   isProcessing,
   isContinuousScan = false,
   onToggleContinuous,
   recentScans = [],
   toastMessage,
   scanSpeed = 'NORMAL', // Default
   isPaused = false
}) => {
   const [permissionError, setPermissionError] = useState(false);
   const readerId = "reader-canvas";
   const scannerInstanceRef = useRef<Html5Qrcode | null>(null);

   // CRITICAL FIX: Use a Ref for the callback to prevent the useEffect from
   // re-triggering (restarting camera) whenever the parent component updates.
   const onCaptureRef = useRef(onCapture);
   const isPausedRef = useRef(isPaused);

   // Update the refs whenever the parent values change
   useEffect(() => {
      onCaptureRef.current = onCapture;
   }, [onCapture]);

   useEffect(() => {
      isPausedRef.current = isPaused;
   }, [isPaused]);

   // Pastikan keyboard virtual mobile langsung tertutup saat modal kamera terbuka
   useEffect(() => {
      if (isOpen) {
         if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
         }
      }
   }, [isOpen]);

   useEffect(() => {
      let isMounted = true;

      const stopScanner = async () => {
         const scanner = scannerInstanceRef.current;
         if (scanner) {
            try {
               const state = scanner.getState();
               if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
                  await scanner.stop();
               }
               scanner.clear();
            } catch (e) {
               console.warn("Error stopping/clearing scanner:", e);
            }
            scannerInstanceRef.current = null;
         }
      };

      const startScanner = async () => {
         if (!isOpen) return;

         try {
            if (!document.getElementById(readerId)) return;

            // Don't stop if already running and valid (prevent flickering)
            if (scannerInstanceRef.current && scannerInstanceRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
               return;
            }

            await stopScanner();

            const html5QrCode = new Html5Qrcode(readerId);
            scannerInstanceRef.current = html5QrCode;

            // Dynamic FPS based on Speed Setting
            let fps = 15; // Normal
            if (scanSpeed === 'SLOW') fps = 5; // Slow for stability
            if (scanSpeed === 'FAST') fps = 25;
            if (scanSpeed === 'TURBO') fps = 30; // Max reasonable for web

            const config = {
               fps: fps,
               qrbox: { width: 250, height: 250 },
               formatsToSupport: [
                  Html5QrcodeSupportedFormats.CODE_128,
                  Html5QrcodeSupportedFormats.CODE_39,
                  Html5QrcodeSupportedFormats.EAN_13,
                  Html5QrcodeSupportedFormats.QR_CODE,
                  Html5QrcodeSupportedFormats.UPC_A
               ]
            };

            await html5QrCode.start(
               { facingMode: "environment" },
               config,
               (decodedText) => {
                  if (isMounted) {
                     // Check paused state before triggering capture
                     if (isPausedRef.current) return;
                     // Use the REF current value, not the prop directly
                     onCaptureRef.current(decodedText);
                  }
               },
               (errorMessage) => {
                  // ignore scan errors
               }
            );

            if (isMounted) setPermissionError(false);

         } catch (err: any) {
            console.error("Error starting scanner:", err);
            if (isMounted && err?.name !== "Html5QrcodeError") {
               setPermissionError(true);
            }
         }
      };

      if (isOpen) {
         // Added scanSpeed to re-trigger restart if speed changes while open
         const timer = setTimeout(startScanner, 100);
         return () => {
            isMounted = false;
            clearTimeout(timer);
            stopScanner();
         };
      } else {
         stopScanner();
      }
      // IMPORTANT: Removed 'onCapture' from dependency array to prevent camera restart loop
      // Added scanSpeed so changing setting restarts camera with new FPS
   }, [isOpen, scanSpeed]);

   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
         {/* Header Controls */}
         <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-start pointer-events-none">
            {/* Interactive Toggle */}
            <button
               onClick={onToggleContinuous}
               className={`pointer-events-auto backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 shadow-lg ${isContinuousScan
                     ? 'bg-teal-900/60 border-teal-500/50 text-teal-100'
                     : 'bg-black/40 border-white/10 text-white/80 hover:bg-black/60'
                  }`}
            >
               {isContinuousScan ? (
                  <>
                     <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></div>
                     <Infinity size={16} />
                     <span>Continuous</span>
                  </>
               ) : (
                  <>
                     <Repeat size={16} />
                     <span>Single Scan</span>
                  </>
               )}
            </button>

            <button
               onClick={onClose}
               className="pointer-events-auto p-3 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 border border-white/10 transition-all"
            >
               <X size={24} />
            </button>
         </div>

         {/* Main Camera View */}
         <div className="flex-1 relative bg-gray-900 overflow-hidden flex items-center justify-center">
            {!permissionError ? (
               <div className="w-full h-full relative">
                  <div id={readerId} className="w-full h-full"></div>

                  {/* Paused Indicator Overlay Badge */}
                  {isPaused && (
                     <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-amber-500 text-black px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-xl border-2 border-amber-300 animate-pulse pointer-events-none">
                        <Pause size={14} className="fill-black" />
                        <span>Scanner Dijeda (Wajib Konfirmasi)</span>
                     </div>
                  )}

                  {/* Toast Overlay */}
                  {toastMessage && (
                     <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 animate-[shake_0.4s_ease-in-out] w-[90%] max-w-sm flex justify-center pointer-events-none">
                        <div className={`px-5 py-3 rounded-2xl shadow-xl flex items-center justify-center gap-3 border-2 border-white/20 backdrop-blur-md ${toastMessage.type === 'error' ? 'bg-red-500/90 text-white shadow-red-500/30' : 'bg-green-500/90 text-white shadow-green-500/30'}`}>
                           <AlertCircle size={24} className="shrink-0" />
                           <span className="font-bold text-sm text-center whitespace-pre-line leading-tight">{toastMessage.message}</span>
                        </div>
                     </div>
                  )}

                  {/* Dark Overlay with Transparent Center */}
                  <div className="absolute inset-0 bg-black/40 pointer-events-none z-10">
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] aspect-square max-w-xs bg-transparent rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                        {/* Corner Markers */}
                        <div className={`absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 rounded-tl-3xl transition-colors ${isPaused ? 'border-amber-400' : 'border-white'}`}></div>
                        <div className={`absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 rounded-tr-3xl transition-colors ${isPaused ? 'border-amber-400' : 'border-white'}`}></div>
                        <div className={`absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 rounded-bl-3xl transition-colors ${isPaused ? 'border-amber-400' : 'border-white'}`}></div>
                        <div className={`absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 rounded-br-3xl transition-colors ${isPaused ? 'border-amber-400' : 'border-white'}`}></div>

                        {/* Scanning Animation Line (Hide when paused) */}
                        {(!isProcessing || isContinuousScan) && !isPaused && (
                           <div className={`absolute top-0 left-2 right-2 h-0.5 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-scan-line opacity-80 ${scanSpeed === 'TURBO' ? 'duration-700' : scanSpeed === 'FAST' ? 'duration-1000' : scanSpeed === 'SLOW' ? 'duration-[3000ms]' : 'duration-[2000ms]'}`}></div>
                        )}
                     </div>
                  </div>

                  {/* CONTINUOUS MODE OVERLAY LIST */}
                  {isContinuousScan && (
                     <div className="absolute bottom-4 left-0 right-0 z-30 px-6 flex flex-col gap-2 pointer-events-none">
                        {recentScans.slice(0, 4).map((scan) => (
                           <div key={scan.id} className="bg-black/60 backdrop-blur-md rounded-xl p-3 flex items-center justify-between border border-white/10 animate-[slideUp_0.2s_ease-out]">
                              <div className="flex items-center gap-3 overflow-hidden">
                                 {scan.status === 'success' && <CheckCircle2 size={20} className="text-green-400 shrink-0" />}
                                 {scan.status === 'error' && <XCircle size={20} className="text-red-400 shrink-0" />}
                                 {scan.status === 'loading' && <Loader2 size={20} className="text-blue-400 animate-spin shrink-0" />}

                                 <span className="font-mono font-bold text-white text-sm truncate">{scan.code}</span>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${scan.status === 'success' ? 'bg-green-500/20 text-green-300' :
                                    scan.status === 'error' ? 'bg-red-500/20 text-red-300' :
                                       'bg-blue-500/20 text-blue-300'
                                 }`}>
                                 {scan.status === 'success' ? 'OK' : scan.status === 'error' ? 'ERR' : '...'}
                              </span>
                           </div>
                        ))}
                     </div>
                  )}

               </div>
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-white p-6 text-center relative z-20">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4 text-red-500">
                     <Zap size={32} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Camera Access Required</h3>
                  <p className="text-white/60 text-sm mb-6">Please enable camera permissions to scan barcodes.</p>
               </div>
            )}
         </div>

         {/* Bottom Status */}
         <div className={`bg-black/90 p-8 flex flex-col items-center justify-center relative z-20 rounded-t-3xl transition-all ${isContinuousScan ? 'pb-8 pt-4' : 'pb-10'}`}>
            {isPaused ? (
               <div className="flex flex-col items-center">
                  <p className="text-amber-400 text-xs font-bold uppercase tracking-widest animate-pulse mb-1">
                     ⚠️ SCANNER DIJEDA (MENUNGGU KONFIRMASI)
                  </p>
                  <span className="text-[10px] text-gray-400">
                     Konfirmasi peringatan untuk melanjutkan scan
                  </span>
               </div>
            ) : isProcessing && !isContinuousScan ? (
               <div className="flex flex-col items-center gap-2">
                  <Loader2 size={32} className="animate-spin text-white" />
                  <p className="text-white font-medium">Processing...</p>
               </div>
            ) : (
               <div className="flex flex-col items-center">
                  <p className="text-white/60 text-xs font-medium uppercase tracking-widest animate-pulse mb-1">
                     {isContinuousScan ? "Continuous Mode Active" : "Point camera at barcode"}
                  </p>
                  {isContinuousScan && (
                     <span className={`text-[10px] px-2 py-0.5 rounded border ${scanSpeed === 'TURBO' ? 'bg-red-900/50 text-red-300 border-red-500/30' : scanSpeed === 'FAST' ? 'bg-orange-900/50 text-orange-300 border-orange-500/30' : scanSpeed === 'SLOW' ? 'bg-green-900/50 text-green-300 border-green-500/30' : 'bg-blue-900/50 text-blue-300 border-blue-500/30'}`}>
                        Speed: {scanSpeed}
                     </span>
                  )}
               </div>
            )}
         </div>

         <style>{`
          #reader-canvas video { 
             object-fit: contain !important; 
             width: 100% !important; 
             height: 100% !important; 
          }
          #reader-canvas__scan_region { display: none; }
          #reader-canvas__dashboard_section_csr { display: none; }
          @keyframes slideUp {
             from { opacity: 0; transform: translateY(10px); }
             to { opacity: 1; transform: translateY(0); }
          }
          @keyframes shake {
             0%, 100% { transform: translateX(-50%); }
             25% { transform: translateX(calc(-50% - 5px)); }
             75% { transform: translateX(calc(-50% + 5px)); }
          }
      `}</style>
      </div>
   );
};
