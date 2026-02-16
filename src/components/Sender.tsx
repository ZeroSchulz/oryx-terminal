import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Send, Terminal, ChevronDown } from 'lucide-react';
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

export function Sender({ isConnected, onSend }: SenderProps) {
    const [input, setInput] = useState('');
    const [lineEnding, setLineEnding] = useState<'None' | 'CR' | 'LF' | 'CRLF'>('CRLF');

    const handleSend = async () => {
        if (!isConnected || !input) return;

        // Parse input to bytes
        const dataBytes = parseInput(input);

        // Append line ending
        if (lineEnding === 'CR') dataBytes.push(13);
        if (lineEnding === 'LF') dataBytes.push(10);
        if (lineEnding === 'CRLF') { dataBytes.push(13); dataBytes.push(10); }

        try {
            // Send as number array (which Tauri/Serde serializes to Vec<u8>)
            await invoke('send_data', { data: dataBytes });

            // Log with raw data
            onSend?.(input, dataBytes);
            setInput('');
        } catch (e) {
            console.error('Failed to send:', e);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
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

            <div className="flex-grow relative flex flex-col">
                <label className="text-[8px] uppercase font-bold text-gray-500 tracking-wider mb-0.5 ml-1">Data / Command</label>
                <div className="relative w-full">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={!isConnected}
                        placeholder={isConnected ? "Try: \\h(48 69) or 0x4F or 0b1010" : "Connect to send"}
                        className="w-full bg-gray-100 dark:bg-[#151515] border border-gray-300 dark:border-gray-600 rounded px-4 py-2 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono shadow-inner transition-all pr-8"
                    />
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-600 pointer-events-none">
                        <Terminal size={14} />
                    </div>
                </div>
                <div className="absolute right-0 -bottom-5 text-[9px] text-gray-400 dark:text-gray-500 hidden group-hover:block whitespace-nowrap">
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
