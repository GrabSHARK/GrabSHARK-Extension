import { FC } from 'react';
import { CircleNotch, X } from '@phosphor-icons/react';

interface CaptureOverlaysProps {
    isSaving: boolean;
    uploadScreenshot: boolean;
    showCaptureConfirmation: boolean;
    captureOverlayVisible: boolean;
    handleCloseCapture: () => void;
    onStartCapture: () => void;
}

export const CaptureOverlays: FC<CaptureOverlaysProps> = ({
    isSaving,
    uploadScreenshot,
    showCaptureConfirmation,
    captureOverlayVisible,
    handleCloseCapture,
    onStartCapture
}) => {
    return (
        <>
            {/* Loading Overlay */}
            {(isSaving && uploadScreenshot) && (
                <div className="absolute inset-0 bg-black/50 z-50 flex flex-col items-center justify-center text-white backdrop-blur-sm rounded-xl">
                    <CircleNotch className="w-8 h-8 animate-spin text-white/90 mb-3" />
                    <h3 className="text-lg font-medium tracking-tight">Uploading image...</h3>
                    <p className="text-xs text-white/60 mt-1 max-w-[200px] text-center leading-relaxed">
                        Please do not close this window, this may take a few seconds depending on the size of the page.
                    </p>
                </div>
            )}

            {/* Capture Confirmation Overlay */}
            {showCaptureConfirmation && (
                <div className={`absolute inset-0 bg-black/50 z-50 flex flex-col items-center justify-center text-white backdrop-blur-sm rounded-xl p-6 transition-opacity duration-200 ${captureOverlayVisible ? 'opacity-100' : 'opacity-0'}`}>
                    <button
                        onClick={handleCloseCapture}
                        className="absolute top-2 right-2 p-1.5 rounded-full transition-colors text-white/50 hover:text-white bg-white/10 hover:bg-white/20"
                    >
                        <X className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onStartCapture}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full text-sm transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_4px_15px_rgba(0,0,0,0.2),0_0_28px_rgba(37,99,235,0.45)]"
                    >
                        Start
                    </button>
                    <p className="text-xs text-white/80 mt-4 max-w-[280px] text-center leading-relaxed">
                        This menu will be automatically hidden during the process.
                    </p>
                    <p className="text-xs text-white/70 mt-3 max-w-[280px] text-center leading-relaxed">
                        Please do not scroll or move your mouse pointer while capturing in order to get the best result.
                    </p>
                    <p className="text-xs text-white/60 mt-3 max-w-[280px] text-center leading-relaxed">
                        For very long pages or infinite scroll pages, you can end the capturing manually by pressing <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-white/90 font-mono text-[10px]">ESC</kbd>.
                    </p>
                </div>
            )}
        </>
    );
};
