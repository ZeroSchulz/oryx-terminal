import { useEffect, useRef, useState, useMemo, memo } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import clsx from 'clsx';
import { Copy, Trash, MousePointer2 } from 'lucide-react';
import { parseInput } from '../utils/parser';
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

// ─── Memoized Row Component ──────────────────────────────────────────────────

interface TerminalRowProps {
    line: LogEntry;
    viewMode: string;
    showTimestamp: boolean;
    showEol: boolean;
    eolBytes: number[];
    hasSeenAnsi: boolean;
}

const TerminalRow = memo(function TerminalRow({
    line,
    viewMode,
    showTimestamp,
    showEol,
    eolBytes,
    hasSeenAnsi
}: TerminalRowProps) {
    let content = line.text;
    if (viewMode !== 'text' && line.originalData && line.originalData.length > 0) {
        content = formatData(line.originalData, viewMode);
    }

    const lineHasAnsi = /\x1b\[[\d;]*m/.test(line.text);
    const isRx = line.type === 'rx';
    const isTx = line.type === 'tx';

    // Compute EOL match once per row
    let hasEolMatch = false;
    if (showEol && line.originalData && eolBytes.length > 0) {
        const data = line.originalData;
        if (data.length >= eolBytes.length) {
            hasEolMatch = true;
            for (let i = 0; i < eolBytes.length; i++) {
                if (data[data.length - eolBytes.length + i] !== eolBytes[i]) {
                    hasEolMatch = false;
                    break;
                }
            }
        }
    }

    return (
        <div className={clsx("px-0 py-0.5 leading-tight break-all flex border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 group", {
            // SIMPLE MODE (Green/Blue)
            "text-green-600 dark:text-green-400": isRx && !hasSeenAnsi && !lineHasAnsi,
            "text-blue-600 dark:text-blue-400": isTx && !hasSeenAnsi && !lineHasAnsi,
            // ANSI MODE (Neutral/Purple)
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
                {hasEolMatch && (
                    <span className="inline-flex items-center ml-1 text-blue-500/50 dark:text-blue-400/30 select-none font-bold" title="EOL">
                        ↵
                    </span>
                )}
            </span>
        </div>
    );
});

// ─── Terminal Component ──────────────────────────────────────────────────────

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

    // Memoize EOL bytes — computed once when eolSequence changes, not per-line
    const eolBytes = useMemo(() => {
        try {
            return parseInput(eolSequence);
        } catch {
            return [];
        }
    }, [eolSequence]);

    // Force scroll to bottom when lines change if autoScroll is enabled
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
                itemContent={(_, line) => (
                    <TerminalRow
                        line={line}
                        viewMode={viewMode}
                        showTimestamp={showTimestamp}
                        showEol={showEol}
                        eolBytes={eolBytes}
                        hasSeenAnsi={hasSeenAnsi}
                    />
                )}
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
