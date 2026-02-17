import { useEffect, useRef, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import clsx from 'clsx';
import { Copy, Trash, MousePointer2 } from 'lucide-react';
import { parseInput } from './Sender';
import { parseAnsi } from '../utils/ansiParser';
import { ContextMenu } from './ContextMenu';

export interface LogEntry {
    id: string;
    timestamp: string;
    type: 'rx' | 'tx' | 'system' | 'error';
    text: string;
    originalData?: number[];
}

interface TerminalProps {
    lines: LogEntry[];
    autoScroll: boolean;
    setAutoScroll: (auto: boolean) => void;
    showTimestamp: boolean;
    setShowTimestamp: (show: boolean) => void;
    viewMode: 'text' | 'hex' | 'bin' | 'dec' | 'oct' | 'char';
    showEol: boolean;
    eolSequence: string;
    onClear: () => void;
    hasSeenAnsi: boolean;
}

const formatData = (data: number[], mode: string): string => {
    return data.map(b => {
        switch (mode) {
            case 'hex': return b.toString(16).padStart(2, '0').toUpperCase();
            case 'bin': return b.toString(2).padStart(8, '0');
            case 'dec': return b.toString(10).padStart(3, '0');
            case 'oct': return b.toString(8).padStart(3, '0');
            case 'char': return (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
            default: return '';
        }
    }).join(' ');
};

export function Terminal({
    lines,
    autoScroll,
    setAutoScroll,
    showTimestamp,
    setShowTimestamp,
    viewMode,
    showEol,
    eolSequence,
    onClear,
    hasSeenAnsi
}: TerminalProps) {
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);

    // Force scroll to bottom when lines change if autoScroll is enabled
    // This is more reliable than followOutput="auto" for high-frequency updates
    useEffect(() => {
        if (autoScroll && virtuosoRef.current) {
            virtuosoRef.current.scrollToIndex({
                index: lines.length - 1,
                align: 'end',
                behavior: 'auto'
            });
        }
    }, [lines.length, autoScroll]);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const handleCopy = () => {
        const selected = window.getSelection()?.toString();
        if (selected) {
            navigator.clipboard.writeText(selected);
        }
    };

    return (
        <div
            className="flex-grow font-mono text-sm overflow-hidden h-full relative bg-white dark:bg-[#1e1e1e] text-gray-950 dark:text-gray-100 transition-colors duration-200"
            onContextMenu={handleContextMenu}
        >
            <Virtuoso
                ref={virtuosoRef}
                data={lines}
                totalCount={lines.length}
                followOutput={autoScroll ? "auto" : false}
                initialTopMostItemIndex={lines.length - 1}
                itemContent={(_, line) => {
                    let content = line.text;
                    if (viewMode !== 'text' && line.originalData && line.originalData.length > 0) {
                        content = formatData(line.originalData, viewMode);
                    }

                    // Check for ANSI codes to decide on hybrid coloring (per line check still useful for mixed content)
                    // But now we use global session state 'hasSeenAnsi' to drive the palette
                    const lineHasAnsi = /\x1b\[[\d;]*m/.test(line.text);

                    // SMART COLORING LOGIC:
                    // 1. Simple Mode (!hasSeenAnsi): Green (RX) / Blue (TX)
                    // 2. ANSI Mode (hasSeenAnsi): Neutral (RX) / Purple (TX) -> Prevents clashes
                    // Note: If the specific line has ANSI, we always want it to be neutral to let the ANSI render.

                    const isRx = line.type === 'rx';
                    const isTx = line.type === 'tx';

                    return (
                        <div className={clsx("px-0 py-0.5 leading-tight break-all flex border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 group", {
                            // SIMPLE MODE (Green/Blue) - Only if we haven't seen ANSI globally, AND this specific line has no ANSI
                            "text-green-600 dark:text-green-400": isRx && !hasSeenAnsi && !lineHasAnsi,
                            "text-blue-600 dark:text-blue-400": isTx && !hasSeenAnsi && !lineHasAnsi,

                            // ANSI MODE (Neutral/Purple) - If we HAVE seen ANSI globally (or this specific line has ANSI)
                            // RX defaults to inherit (Neutral Gray/White)
                            // TX gets Purple to be readable but distinct
                            "text-purple-700 dark:text-purple-300": isTx && (hasSeenAnsi || lineHasAnsi),

                            // System/Error always distinct
                            "text-gray-600 dark:text-gray-400": line.type === 'system',
                            "text-red-600 dark:text-red-400": line.type === 'error',
                        })}>
                            {/* Metadata Gutter (Timestamp + Direction) */}
                            <div className="flex items-center gap-2 px-2 bg-gray-50/5 dark:bg-white/[0.01] border-r border-gray-100 dark:border-white/5 select-none flex-shrink-0">
                                {showTimestamp && (
                                    <span className="text-gray-600 dark:text-white text-xs w-[95px] flex-shrink-0 font-mono tracking-tight text-right pr-1 border-r border-gray-200/50 dark:border-white/10 mr-1 opacity-80">
                                        {line.timestamp}
                                    </span>
                                )}

                                <span className={clsx("w-4 flex-shrink-0 font-bold text-center text-xs", {
                                    "text-blue-500": line.type === 'tx',
                                    "text-green-500": line.type === 'rx',
                                    "opacity-0": line.type === 'system' || line.type === 'error'
                                })}>
                                    {line.type === 'tx' ? '→' : line.type === 'rx' ? '←' : ''}
                                </span>
                            </div>

                            <span className="flex-grow whitespace-pre-wrap font-medium font-mono relative px-3 py-0.5">
                                {viewMode === 'text' ? (
                                    parseAnsi(content).map((segment, idx) => (
                                        <span
                                            key={idx}
                                            style={segment.style}
                                            className={clsx({
                                                "font-bold": segment.bold,
                                                "underline": segment.underline
                                            })}
                                        >
                                            {segment.text}
                                        </span>
                                    ))
                                ) : (
                                    content
                                )}
                                {showEol && line.originalData && (() => {
                                    try {
                                        const eolBytes = parseInput(eolSequence);
                                        if (eolBytes.length > 0) {
                                            const data = line.originalData;
                                            if (data.length >= eolBytes.length) {
                                                let match = true;
                                                for (let i = 0; i < eolBytes.length; i++) {
                                                    if (data[data.length - eolBytes.length + i] !== eolBytes[i]) {
                                                        match = false;
                                                        break;
                                                    }
                                                }
                                                if (match) {
                                                    return (
                                                        <span className="inline-flex items-center ml-1 text-blue-500/50 dark:text-blue-400/30 select-none font-bold" title="EOL">
                                                            ↵
                                                        </span>
                                                    );
                                                }
                                            }
                                        }
                                    } catch (e) { /* ignore */ }
                                    return null;
                                })()}
                            </span>
                        </div>
                    );
                }}
                style={{ height: '100%' }}
            />

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    options={[
                        { label: 'Copy Selected', icon: Copy, onClick: handleCopy },
                        { label: 'Clear Terminal', icon: Trash, onClick: onClear, variant: 'danger' },
                        {
                            label: autoScroll ? 'Disable Auto-Scroll' : 'Enable Auto-Scroll',
                            icon: MousePointer2,
                            onClick: () => setAutoScroll(!autoScroll)
                        },
                        {
                            label: showTimestamp ? 'Hide Timestamp' : 'Show Timestamp',
                            icon: MousePointer2,
                            onClick: () => setShowTimestamp(!showTimestamp)
                        },
                    ]}
                />
            )}
        </div>
    );
}
