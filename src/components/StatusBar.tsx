import { Command, Sun, Moon, Settings as SettingsIcon, Trash2, ChevronUp, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface StatusBarProps {
    isConnected: boolean;
    isReconnecting: boolean;
    reconnectElapsed: number;
    reconnectTimeout: number;
    selectedPort: string;
    dataBits: number;
    stopBits: number;
    parity: string;
    flowControl: string;
    theme: 'dark' | 'light';
    setTheme: (t: 'dark' | 'light' | ((prev: 'dark' | 'light') => 'dark' | 'light')) => void;
    viewMode: string;
    setViewMode: (v: any) => void;
    autoScroll: boolean;
    setAutoScroll: (a: boolean) => void;
    showMacros: boolean;
    setShowMacros: (s: boolean) => void;
    onOpenSettings: () => void;
    onClear: () => void;
}

export function StatusBar({
    isConnected,
    isReconnecting,
    reconnectElapsed,
    reconnectTimeout,
    selectedPort,
    dataBits,
    stopBits,
    parity,
    flowControl,
    theme,
    setTheme,
    viewMode,
    setViewMode,
    autoScroll,
    setAutoScroll,
    showMacros,
    setShowMacros,
    onOpenSettings,
    onClear
}: StatusBarProps) {
    const [isViewOpen, setIsViewOpen] = useState(false);

    // Helper to format serial config shorthand (e.g., 8N1)
    const getConfigShorthand = () => {
        const p = parity.toLowerCase().charAt(0).toUpperCase() || 'N';
        return `${dataBits}${p}${stopBits}`;
    };

    // Helper to format flow control
    const getFlowControlLabel = () => {
        const fc = flowControl.toLowerCase();
        if (fc === 'hardware') return 'HW';
        if (fc === 'software') return 'SW';
        return 'None';
    };

    return (
        <div className="flex items-center justify-between px-4 h-9 bg-white dark:bg-[#1a1c20] border-t border-gray-200 dark:border-[#303339] text-gray-600 dark:text-gray-400 select-none z-30 transition-colors duration-200">
            {/* Left side: Connection & Serial Config */}
            <div className="flex items-center gap-3">
                {/* Status Pill */}
                <div className={`flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-all ${isReconnecting
                        ? 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-200 dark:border-amber-900/30'
                        : isConnected
                            ? 'text-green-700 dark:text-green-400 bg-green-500/10 border-green-200 dark:border-green-900/30'
                            : 'text-gray-500 dark:text-gray-500 bg-gray-500/10 border-gray-200 dark:border-gray-800'
                    }`}>
                    {isReconnecting
                        ? <RefreshCw size={10} className="animate-spin text-amber-500" />
                        : <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                    }
                    <span className="truncate max-w-[160px]">
                        {isReconnecting
                            ? `Reconnecting ${reconnectElapsed}s${reconnectTimeout > 0 ? `/${reconnectTimeout}s` : ''}...`
                            : isConnected ? selectedPort : 'Disconnected'
                        }
                    </span>
                </div>

                <div className="h-4 w-px bg-gray-200 dark:bg-gray-800" />

                {/* Configuration Badges */}
                <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/5 dark:bg-blue-500/10 border border-blue-200/50 dark:border-blue-900/20">
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 leading-none">
                            {getConfigShorthand()}
                        </span>
                        <div className="w-px h-2 bg-blue-200 dark:bg-blue-800" />
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-500 leading-none flex items-center gap-1">
                            <span className="opacity-50 font-normal">FC:</span> {getFlowControlLabel()}
                        </span>
                    </div>
                </div>

                <div className="h-4 w-px bg-gray-200 dark:bg-gray-800" />

                {/* View Mode Selector - Custom Dropdown */}
                <div className="flex items-center gap-2 group relative">
                    <span className="text-[9px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-tighter">View</span>
                    <div className="relative">
                        <div
                            onClick={() => setIsViewOpen(!isViewOpen)}
                            className="flex items-center gap-1 pl-2 pr-3 py-0.5 rounded-md text-[10px] font-bold uppercase bg-white dark:bg-[#1a1c20] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white cursor-pointer hover:border-gray-400 dark:hover:border-gray-600 transition-all min-w-[70px] justify-between shadow-sm h-[26px]"
                        >
                            <span>{viewMode}</span>
                            <ChevronUp size={10} className={`transition-transform duration-200 text-gray-500 dark:text-gray-400 ${isViewOpen ? 'rotate-180' : ''}`} />
                        </div>

                        {/* Dropdown Menu (Opens Upwards) */}
                        {isViewOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setIsViewOpen(false)}
                                />
                                <ul className="absolute bottom-full left-0 mb-1 w-[80px] bg-white dark:bg-[#1a1c20] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden z-50 py-1">
                                    {['text', 'char', 'hex', 'dec', 'oct', 'bin'].map((mode) => (
                                        <li
                                            key={mode}
                                            onClick={() => {
                                                setViewMode(mode as any);
                                                setIsViewOpen(false);
                                            }}
                                            className={`px-3 py-1.5 text-[10px] font-bold uppercase cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-200 ${viewMode === mode ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : ''}`}
                                        >
                                            {mode}
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Right side: App Controls */}
            <div className="flex items-center gap-1">
                {/* Clear Terminal Button */}
                <button
                    onClick={onClear}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all active:scale-90"
                    title="Clear Terminal"
                >
                    <Trash2 size={14} />
                </button>

                <div className="h-3 w-px bg-gray-200 dark:bg-gray-800 mx-0.5" />

                {/* AutoScroll Toggle */}
                <button
                    onClick={() => setAutoScroll(!autoScroll)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition-all hover:bg-gray-100 dark:hover:bg-white/5 ${autoScroll
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-400 dark:text-gray-600'
                        }`}
                    title="Auto-scroll"
                >
                    {autoScroll ? 'AUTO ON' : 'AUTO OFF'}
                </button>

                <div className="h-3 w-px bg-gray-200 dark:bg-gray-800 mx-1" />

                {/* Macro Toggle */}
                <button
                    onClick={() => setShowMacros(!showMacros)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition-all hover:bg-gray-100 dark:hover:bg-white/5 ${showMacros
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-500/5'
                        : 'text-gray-500 dark:text-gray-400'
                        }`}
                    title="Toggle Macros"
                >
                    <Command size={10} />
                    MACROS
                </button>

                <div className="h-3 w-px bg-gray-200 dark:bg-gray-800 mx-1" />

                {/* Settings Toggle */}
                <button
                    onClick={onOpenSettings}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-all active:scale-90"
                    title="Settings"
                >
                    <SettingsIcon size={14} />
                </button>

                <div className="h-3 w-px bg-gray-200 dark:bg-gray-800 mx-0.5" />

                {/* Theme Toggle */}
                <button
                    onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-all active:rotate-12"
                    title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                >
                    {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                </button>
            </div>
        </div>
    );
}
