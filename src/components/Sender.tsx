import { useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Send, Terminal, ChevronDown, Clock, X, BookmarkPlus } from 'lucide-react';
import clsx from 'clsx';

interface SenderProps {
    isConnected: boolean;
    onSend?: (text: string, data: number[]) => void;
}

export const parseInput = (input: string): number[] => {
    const bytes: number[] = [];
    let i = 0;

    while (i < input.length) {
        const char = input[i];

        // Check for C-style 0x... 0b...
        if (char === '0' && i + 1 < input.length) {
            const next = input[i + 1].toLowerCase();
            if (next === 'x') {
                // Hex 0x...
                let end = i + 2;
                while (end < input.length && /[0-9a-fA-F]/.test(input[end])) {
                    end++;
                }
                if (end > i + 2) {
                    const hexStr = input.substring(i + 2, end);
                    // Parse 2 chars at a time if possible, or just the whole value? 
                    // Usually 0x4F is one byte. 0x1234 is two bytes? 
                    // Let's assume user might type 0x1234.
                    // But strictly 0x should handle byte by byte or big int?
                    // Standard terminals often treat 0xXX as a byte.

                    // Let's parse as a sequence of bytes if even length, or just one number?
                    // User request: "C-style "0x4F"" -> byte 79.
                    // If user types 0x1234, is it [0x12, 0x34]?
                    // Let's implement generic hex parsing for the block to be safe.
                    // But for 0x, let's treat it as a single number if it fits in 255? 
                    // Or just parse the whole hex string into bytes.

                    // Simple approach: Take pairs. Left pad if odd?
                    let cleanHex = hexStr;
                    if (cleanHex.length % 2 !== 0) cleanHex = '0' + cleanHex;

                    for (let k = 0; k < cleanHex.length; k += 2) {
                        bytes.push(parseInt(cleanHex.substring(k, k + 2), 16));
                    }
                    i = end;
                    continue;
                }
            } else if (next === 'b') {
                // Bin 0b...
                let end = i + 2;
                while (end < input.length && /[01]/.test(input[end])) {
                    end++;
                }
                if (end > i + 2) {
                    const binStr = input.substring(i + 2, end);
                    // Parse into bytes (8 bits)
                    // Pad to multiple of 8? Or just parse value?
                    // "0b01001111" is 8 chars.
                    // If user types 0b1, is it 1?
                    // Let's parse as integer and push byte?
                    const val = parseInt(binStr, 2);
                    if (val <= 255) {
                        bytes.push(val);
                    } else {
                        // Split into bytes... handling big numbers is tricky. 
                        // Let's pad to bytes.
                        const needed = Math.ceil(binStr.length / 8) * 8;
                        const padded = binStr.padStart(needed, '0');
                        for (let k = 0; k < padded.length; k += 8) {
                            bytes.push(parseInt(padded.substring(k, k + 8), 2));
                        }
                    }
                    i = end;
                    continue;
                }
            }
        }

        if (char === '\\') {
            const next = input[i + 1];

            // Block parsers \h(...)
            if (['h', 'b', 'd', 'o'].includes(next) && input[i + 2] === '(') {
                const end = input.indexOf(')', i + 3);
                if (end !== -1) {
                    const content = input.substring(i + 3, end);
                    const tokens = content.split(/[\s,]+/); // Split by space or comma

                    tokens.forEach(t => {
                        if (!t) return;
                        let val = 0;
                        if (next === 'h') val = parseInt(t, 16);
                        else if (next === 'b') val = parseInt(t, 2);
                        else if (next === 'd') val = parseInt(t, 10);
                        else if (next === 'o') val = parseInt(t, 8);

                        if (!isNaN(val)) bytes.push(val & 0xFF);
                    });

                    i = end + 1;
                    continue;
                }
            }

            // Standard escapes
            if (next === 'r') { bytes.push(13); i += 2; continue; }
            if (next === 'n') { bytes.push(10); i += 2; continue; }
            if (next === 't') { bytes.push(9); i += 2; continue; }
            if (next === '\\') { bytes.push(92); i += 2; continue; }
            // Hex escape \xFF
            if (next === 'x') {
                const hex = input.substring(i + 2, i + 4);
                if (hex.length === 2 && /^[0-9a-fA-F]+$/.test(hex)) {
                    bytes.push(parseInt(hex, 16));
                    i += 4;
                    continue;
                }
            }
        }

        // Regular char
        bytes.push(char.charCodeAt(0));
        i++;
    }
    return bytes;
};

interface SenderDropdownProps {
    label: string;
    value: string;
    options: { label: string; value: string }[];
    onChange: (value: any) => void;
}

function SenderDropdown({ label, value, options, onChange }: SenderDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className="relative group flex flex-col">
            <label className="text-[8px] uppercase font-bold text-gray-500 tracking-wider mb-0.5 ml-1">{label}</label>
            <div className="relative">
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1 pl-3 pr-3 py-2 rounded-md text-xs font-mono bg-gray-100 dark:bg-[#1e1e1e] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 cursor-pointer hover:border-blue-500 transition-all min-w-[85px] justify-between shadow-sm h-[34px]"
                >
                    <span className="truncate">{selectedOption?.label || value}</span>
                    <ChevronDown size={12} className={clsx("transition-transform duration-200 text-gray-500", isOpen && "rotate-180")} />
                </div>

                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <ul className="absolute bottom-full left-0 mb-1 w-full bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden z-50 py-1">
                            {options.map((opt) => (
                                <li
                                    key={opt.value}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                    }}
                                    className={clsx(
                                        "px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors",
                                        value === opt.value
                                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                            : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
                                    )}
                                >
                                    {opt.label}
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </div>
    );
}

const HISTORY_MAX = 100;
const HISTORY_KEY = 'oryx_sendHistory';

function loadHistory(): string[] {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(h: string[]) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

export function Sender({ isConnected, onSend }: SenderProps) {
    const [input, setInput] = useState('');
    const [lineEnding, setLineEnding] = useState<'None' | 'CR' | 'LF' | 'CRLF'>('CRLF');

    // History state
    const historyRef = useRef<string[]>(loadHistory());
    const historyIndexRef = useRef<number>(-1); // -1 = not browsing
    const draftRef = useRef<string>('');         // saved draft while browsing

    const pushHistory = (text: string) => {
        const h = historyRef.current;
        // Don't add duplicate of last entry
        if (h[0] === text) return;
        const next = [text, ...h].slice(0, HISTORY_MAX);
        historyRef.current = next;
        saveHistory(next);
    };

    const handleSend = async () => {
        if (!isConnected || !input) return;

        // Parse input to bytes
        const dataBytes = parseInput(input);

        // Append line ending
        if (lineEnding === 'CR') dataBytes.push(13);
        if (lineEnding === 'LF') dataBytes.push(10);
        if (lineEnding === 'CRLF') { dataBytes.push(13); dataBytes.push(10); }

        try {
            await invoke('send_data', { data: dataBytes });
            onSend?.(input, dataBytes);
            pushHistory(input);
            historyIndexRef.current = -1;
            draftRef.current = '';
            setInput('');
        } catch (e) {
            console.error('Failed to send:', e);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
            return;
        }

        const h = historyRef.current;
        if (h.length === 0) return;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndexRef.current === -1) {
                // Save current draft before browsing
                draftRef.current = input;
            }
            const next = Math.min(historyIndexRef.current + 1, h.length - 1);
            historyIndexRef.current = next;
            setInput(h[next]);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndexRef.current <= 0) {
                // Back to draft
                historyIndexRef.current = -1;
                setInput(draftRef.current);
            } else {
                const next = historyIndexRef.current - 1;
                historyIndexRef.current = next;
                setInput(h[next]);
            }
        } else if (e.key === 'Escape') {
            historyIndexRef.current = -1;
            setInput(draftRef.current);
        }
    };

    const isBrowsingHistory = historyIndexRef.current !== -1;
    const [historyOpen, setHistoryOpen] = useState(false);

    const selectHistoryEntry = (entry: string) => {
        historyIndexRef.current = -1;
        draftRef.current = '';
        setInput(entry);
        setHistoryOpen(false);
    };

    const clearHistory = () => {
        historyRef.current = [];
        saveHistory([]);
        historyIndexRef.current = -1;
        setHistoryOpen(false);
    };

    return (
        <div className="flex items-center gap-3 p-3 bg-white dark:bg-[#2b2d31] border-t border-gray-200 dark:border-[#1e1e1e] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)] z-10 transition-colors duration-200">
            <SenderDropdown
                label="Line End"
                value={lineEnding}
                options={[
                    { label: 'None', value: 'None' },
                    { label: 'CR (\\r)', value: 'CR' },
                    { label: 'LF (\\n)', value: 'LF' },
                    { label: 'CRLF', value: 'CRLF' },
                ]}
                onChange={setLineEnding}
            />

            <div className="flex-grow min-w-0 relative flex flex-col group/input">
                <label className="text-[8px] uppercase font-bold text-gray-500 tracking-wider mb-0.5 ml-1">
                    Data / Command
                    {historyRef.current.length > 0 && (
                        <span className="ml-2 normal-case text-[8px] font-normal italic">
                            {isBrowsingHistory
                                ? <span className="text-amber-500">&#8593;&#8595; history ({historyIndexRef.current + 1}/{historyRef.current.length})</span>
                                : <span className="text-gray-400 dark:text-gray-500">&#8593;&#8595; history</span>
                            }
                        </span>
                    )}
                </label>
                <div className="relative w-full">
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 pointer-events-none">
                        <Terminal size={13} />
                    </div>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => { historyIndexRef.current = -1; setInput(e.target.value); }}
                        onKeyDown={handleKeyDown}
                        disabled={!isConnected}
                        placeholder={isConnected ? "Try: \\h(48 69) or 0x4F" : "Connect to send"}
                        className={clsx(
                            "w-full bg-gray-100 dark:bg-[#151515] border rounded pl-8 py-2 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-600 focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed font-mono shadow-inner transition-all",
                            historyRef.current.length > 0 ? "pr-14" : "pr-4",
                            isBrowsingHistory
                                ? "border-amber-400 dark:border-amber-600 focus:border-amber-400 focus:ring-amber-400"
                                : "border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500"
                        )}
                    />

                    {/* Integrated History Dropdown Button */}
                    {historyRef.current.length > 0 && (
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center h-[28px] border-l border-gray-300 dark:border-gray-700 pl-1">
                            <button
                                type="button"
                                onClick={() => setHistoryOpen(!historyOpen)}
                                className={clsx(
                                    "flex items-center gap-0.5 px-1.5 py-1 rounded transition-all hover:bg-gray-200 dark:hover:bg-white/10",
                                    historyOpen
                                        ? "text-amber-500 bg-amber-500/5"
                                        : "text-gray-400 dark:text-gray-500"
                                )}
                                title="Show search history"
                            >
                                <Clock size={13} />
                                <ChevronDown size={12} className={clsx("transition-transform duration-200", historyOpen && "rotate-180")} />
                            </button>
                        </div>
                    )}

                    {/* History Dropdown List */}
                    {historyOpen && historyRef.current.length > 0 && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setHistoryOpen(false)} />
                            <div className="absolute bottom-full left-0 w-full mb-1 bg-white dark:bg-[#1a1c20] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden animasi-fade-in">
                                <ul className="max-h-64 overflow-y-auto py-1 custom-scrollbar">
                                    {historyRef.current.map((entry, i) => (
                                        <li
                                            key={i}
                                            className={clsx(
                                                "group/item flex items-center justify-between px-3 py-2 text-xs font-mono cursor-pointer transition-colors border-l-2",
                                                i === historyIndexRef.current
                                                    ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-500"
                                                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 border-transparent"
                                            )}
                                        >
                                            <span className="truncate flex-grow" onClick={() => selectHistoryEntry(entry)}>{entry}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.dispatchEvent(new CustomEvent('oryx-add-macro', { detail: { command: entry } }));
                                                    setHistoryOpen(false);
                                                }}
                                                className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded transition-all"
                                                title="Save as macro"
                                            >
                                                <BookmarkPlus size={14} />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-1.5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">{historyRef.current.length} items</span>
                                    <button
                                        onClick={clearHistory}
                                        className="flex items-center gap-1.5 text-[10px] text-red-400 hover:text-red-500 transition-colors font-bold uppercase"
                                    >
                                        <X size={11} /> Clear
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <div className="absolute right-0 -bottom-5 text-[9px] text-gray-400 dark:text-gray-500 opacity-0 group-hover/input:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Supports: \h(4F), \d(10), \b(01), 0x..., 0b..., \r, \n
                </div>
            </div>

            <button
                onClick={handleSend}
                disabled={!isConnected || !input}
                className="mt-4 p-2.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 shadow-lg flex-shrink-0"
                title="Send Data"
            >
                <Send size={18} />
            </button>
        </div>
    );
}
