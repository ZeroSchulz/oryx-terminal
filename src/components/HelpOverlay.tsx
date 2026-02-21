import { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

interface HelpOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

const SHORTCUTS: { keys: string[]; description: string }[] = [
    { keys: ['Enter'], description: 'Send command' },
    { keys: ['Shift', 'Enter'], description: 'Send without line ending' },
    { keys: ['↑', '↓'], description: 'Browse command history' },
    { keys: ['Esc'], description: 'Exit history browsing' },
    { keys: ['Ctrl', 'L'], description: 'Clear terminal' },
    { keys: ['?'], description: 'Show this help overlay' },
];

export function HelpOverlay({ isOpen, onClose }: HelpOverlayProps) {
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-[#25282e] w-full max-w-sm rounded-xl shadow-2xl border border-gray-200 dark:border-[#303339] overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-[#303339] flex items-center justify-between bg-gray-50/50 dark:bg-[#2a2d33]">
                    <div className="flex items-center gap-2">
                        <Keyboard size={16} className="text-blue-500" />
                        <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 tracking-tight">Keyboard Shortcuts</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5 space-y-0">
                    {SHORTCUTS.map(({ keys, description }) => (
                        <div
                            key={description}
                            className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-[#303339] last:border-0"
                        >
                            <span className="text-xs text-gray-600 dark:text-gray-300">{description}</span>
                            <div className="flex items-center gap-1">
                                {keys.map((k, i) => (
                                    <span key={k} className="flex items-center gap-1">
                                        <kbd className="px-2 py-0.5 text-[10px] font-bold font-mono bg-gray-100 dark:bg-[#1a1c20] border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 shadow-sm">
                                            {k}
                                        </kbd>
                                        {i < keys.length - 1 && (
                                            <span className="text-gray-400 text-[10px]">+</span>
                                        )}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="px-5 py-3 border-t border-gray-100 dark:border-[#303339] bg-gray-50/50 dark:bg-[#2a2d33] flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
