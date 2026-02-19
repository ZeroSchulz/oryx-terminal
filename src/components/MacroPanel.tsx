import { useState, useEffect, useRef } from 'react';
import { PlusSquare, Trash2, Play, Save, X, Edit2, FileDown, FileUp, Zap, RotateCcw } from 'lucide-react';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import clsx from 'clsx';

export interface Macro {
    id: string;
    name: string;
    command: string; // The command string (supports \h, 0x, etc. as per Sender)
    color?: string;
}

interface MacroPanelProps {
    onRun: (command: string) => void;
}

export function MacroPanel({ onRun }: MacroPanelProps) {
    const [macros, setMacros] = useState<Macro[]>(() => {
        const saved = localStorage.getItem('oryx_macros');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Failed to load macros", e);
            }
        }
        // Defaults if nothing saved or error
        return [
            { id: '1', name: 'Ping', command: 'PING\r\n', color: 'blue' },
            { id: '2', name: 'Version', command: 'VER?\n', color: 'green' },
            { id: '3', name: 'Reset', command: '\h(AA 55 00)', color: 'red' },
        ];
    });
    const [isEditing, setIsEditing] = useState<string | null>(null); // ID of macro being edited, or 'new'
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Edit Form State
    const [editName, setEditName] = useState('');
    const [editCommand, setEditCommand] = useState('');
    const [editColor, setEditColor] = useState('blue');
    const [filterColor, setFilterColor] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const COLORS = ['blue', 'red', 'green', 'purple', 'orange', 'gray'];

    useEffect(() => {
        localStorage.setItem('oryx_macros', JSON.stringify(macros));
    }, [macros]);

    useEffect(() => {
        const handleAddMacro = (e: any) => {
            const { command } = e.detail;
            startEdit();
            setEditCommand(command);
            setEditName(`Macro ${new Date().toLocaleTimeString()}`);
        };

        window.addEventListener('oryx-add-macro', handleAddMacro);
        return () => window.removeEventListener('oryx-add-macro', handleAddMacro);
    }, []);

    const handleSave = () => {
        if (!editName || !editCommand) return;

        if (isEditing === 'new') {
            const newMacro: Macro = {
                id: Date.now().toString(),
                name: editName,
                command: editCommand,
                color: editColor
            };
            setMacros((prev: Macro[]) => [...prev, newMacro]);
        } else {
            setMacros((prev: Macro[]) => prev.map((m: Macro) => m.id === isEditing ? { ...m, name: editName, command: editCommand, color: editColor } : m));
        }
        setIsEditing(null);
        setEditName('');
        setEditCommand('');
    };

    const handleDelete = (id: string) => {
        setDeleteConfirmId(id);
    };

    const confirmDelete = (id: string) => {
        setMacros((prev: Macro[]) => prev.filter((m: Macro) => m.id !== id));
        setDeleteConfirmId(null);
    };

    const handleExport = async () => {
        try {
            const path = await save({
                title: 'Save Macro List',
                defaultPath: `oryx_macros_${new Date().toISOString().split('T')[0]}.json`,
                filters: [{ name: 'JSON', extensions: ['json'] }]
            });

            if (path) {
                const dataStr = JSON.stringify(macros, null, 2);
                const bytes = new TextEncoder().encode(dataStr);
                await invoke('write_to_file', { path, data: Array.from(bytes) });
            }
        } catch (error) {
            console.error("Failed to export macros", error);
            alert(`Failed to export macros: ${error}`);
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target?.result as string);
                if (Array.isArray(imported)) {
                    if (confirm(`Import ${imported.length} macros? This will replace your current ones.`)) {
                        setMacros(imported);
                    }
                } else {
                    alert("Invalid macro file format.");
                }
            } catch (error) {
                console.error("Failed to import macros", error);
                alert("Failed to parse macro file.");
            }
            // Clear input so same file can be selected again
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    const startEdit = (m?: Macro) => {
        if (m) {
            setIsEditing(m.id);
            setEditName(m.name);
            setEditCommand(m.command);
            setEditColor(m.color || 'blue');
        } else {
            setIsEditing('new');
            setEditName('');
            setEditCommand('');
            setEditColor('blue');
        }
    };

    const getColorClass = (color: string | undefined, type: 'bg' | 'text' | 'border' | 'accent') => {
        const c = color || 'blue';
        const map: any = {
            blue: {
                bg: 'bg-blue-50/30 dark:bg-blue-900/10',
                text: 'text-blue-700 dark:text-blue-300',
                border: 'border-blue-200/50 dark:border-blue-800/30',
                accent: 'bg-blue-500'
            },
            red: {
                bg: 'bg-red-50/30 dark:bg-red-900/10',
                text: 'text-red-700 dark:text-red-300',
                border: 'border-red-200/50 dark:border-red-800/30',
                accent: 'bg-red-500'
            },
            green: {
                bg: 'bg-green-50/30 dark:bg-green-900/10',
                text: 'text-green-700 dark:text-green-300',
                border: 'border-green-200/50 dark:border-green-800/30',
                accent: 'bg-green-500'
            },
            purple: {
                bg: 'bg-purple-50/30 dark:bg-purple-900/10',
                text: 'text-purple-700 dark:text-purple-300',
                border: 'border-purple-200/50 dark:border-purple-800/30',
                accent: 'bg-purple-500'
            },
            orange: {
                bg: 'bg-orange-50/30 dark:bg-orange-900/10',
                text: 'text-orange-700 dark:text-orange-300',
                border: 'border-orange-200/50 dark:border-orange-800/30',
                accent: 'bg-orange-500'
            },
            gray: {
                bg: 'bg-gray-50/30 dark:bg-gray-800/30',
                text: 'text-gray-700 dark:text-gray-300',
                border: 'border-gray-200/50 dark:border-gray-700/30',
                accent: 'bg-gray-400'
            },
        };
        return map[c]?.[type] || map['blue'][type];
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-[#181818] border-l border-gray-200 dark:border-[#1e1e1e] w-full transition-colors duration-200 shadow-xl z-30 overflow-hidden">
            {/* Ultra-Premium Header */}
            <div className="p-3 border-b border-gray-200 dark:border-[#303339] flex justify-between items-center bg-white dark:bg-[#2b2d31]">
                <div className="flex items-center gap-2">
                    <Zap size={14} className="text-amber-500 fill-amber-500/20" />
                    <h3 className="font-bold text-[10px] uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
                        Macros
                        <span className="ml-2 opacity-50 font-mono">[{macros.length}]</span>
                    </h3>
                </div>

                {/* Integrated Action Bar */}
                <div className="flex items-center bg-gray-50 dark:bg-black/20 p-0.5 rounded-lg border border-gray-200 dark:border-gray-700/50">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 text-gray-500 hover:text-blue-500 hover:bg-white dark:hover:bg-white/5 rounded-md transition-all group"
                        title="Import"
                    >
                        <FileUp size={14} />
                    </button>
                    <button
                        onClick={handleExport}
                        className="p-1.5 text-gray-500 hover:text-blue-500 hover:bg-white dark:hover:bg-white/5 rounded-md transition-all"
                        title="Export"
                    >
                        <FileDown size={14} />
                    </button>
                    <div className="w-[1px] h-3 bg-gray-200 dark:bg-gray-700 mx-0.5" />
                    <button
                        onClick={() => startEdit()}
                        className="p-1.5 text-blue-500 hover:text-blue-600 hover:bg-white dark:hover:bg-white/10 rounded-md transition-all flex items-center gap-1.5"
                        title="Add Macro"
                    >
                        <PlusSquare size={14} />
                    </button>
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImport}
                    accept=".json"
                    className="hidden"
                />
            </div>

            {/* Executive Filter Bar */}
            <div className="px-4 py-2.5 bg-gray-100/50 dark:bg-white/5 border-b border-gray-200 dark:border-[#303339] flex items-center gap-4">
                <div className="flex items-center gap-1.5 opacity-80">
                    <span className="text-[9px] uppercase font-black tracking-widest text-gray-600 dark:text-gray-400">Filter</span>
                </div>
                <div className="flex gap-2 items-center flex-grow">
                    {COLORS.map(c => (
                        <button
                            key={c}
                            onClick={() => setFilterColor(filterColor === c ? null : c)}
                            className={clsx(
                                "w-2.5 h-2.5 rounded-full transition-all ring-offset-2 dark:ring-offset-[#181818]",
                                filterColor === c
                                    ? "ring-2 ring-blue-500 scale-125 opacity-100"
                                    : "opacity-30 hover:opacity-100 hover:scale-125"
                            )}
                            style={{ backgroundColor: c }}
                            title={`Filter by ${c}`}
                        />
                    ))}
                </div>
                {filterColor && (
                    <button
                        onClick={() => setFilterColor(null)}
                        className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                        title="Clear filter"
                    >
                        <RotateCcw size={12} />
                    </button>
                )}
            </div>

            <div className="flex-grow overflow-y-auto p-3 space-y-3">
                {macros
                    .filter(m => !filterColor || m.color === filterColor)
                    .map(m => (
                        <div
                            key={m.id}
                            className="group relative bg-white dark:bg-[#202124] rounded-md border border-gray-200 dark:border-[#303339] shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all overflow-hidden"
                        >
                            {/* Vertical Accent Bar */}
                            <div className={`absolute left-0 top-0 bottom-0 w-[4px] ${getColorClass(m.color, 'accent')}`} />

                            <div className="pl-4 pr-3 py-3 flex justify-between items-center min-w-0">
                                <div className="flex-grow cursor-pointer min-w-0" onClick={() => onRun(m.command)}>
                                    <div className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate pr-16 mb-0.5">
                                        {m.name}
                                    </div>
                                    <div className="text-[10px] font-mono text-gray-500 dark:text-gray-400 truncate pr-16 uppercase tracking-tight opacity-80" title={m.command}>
                                        {m.command}
                                    </div>
                                </div>

                                {/* Consolidated Action Bar */}
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all bg-white/90 dark:bg-[#2b2d31]/90 backdrop-blur-sm rounded-md border border-gray-200 dark:border-gray-700 px-1 py-1 shadow-sm">
                                    {deleteConfirmId === m.id ? (
                                        <>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); confirmDelete(m.id); }}
                                                className="text-red-600 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/40 rounded transition-colors"
                                                title="Confirm Delete"
                                            >
                                                <X size={14} className="stroke-[3px]" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                                                className="text-gray-500 hover:text-blue-600 p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors"
                                                title="Cancel"
                                            >
                                                <RotateCcw size={12} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onRun(m.command); }}
                                                className="text-blue-600 p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded transition-colors"
                                                title="Run macro"
                                            >
                                                <Play size={14} fill="currentColor" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); startEdit(m); }}
                                                className="text-gray-500 hover:text-blue-600 p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}
                                                className="text-gray-500 hover:text-red-600 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/40 rounded transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
            </div>

            {/* Macro Modal Overlay */}
            {isEditing && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                        onClick={() => setIsEditing(null)}
                    />
                    <div className="relative w-full max-w-sm bg-white dark:bg-[#2b2d31] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                            <h3 className="text-xs uppercase font-bold tracking-wider text-gray-500">
                                {isEditing === 'new' ? 'Add New Macro' : 'Edit Macro'}
                            </h3>
                            <button
                                onClick={() => setIsEditing(null)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 ml-1">Macro Name</label>
                                <input
                                    autoFocus
                                    className="w-full text-sm px-3 py-2 border rounded-lg bg-gray-50 dark:bg-[#1e1e1e] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    placeholder="e.g., Get Version"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 ml-1">Command String</label>
                                <input
                                    className="w-full text-xs font-mono px-3 py-2 border rounded-lg bg-gray-50 dark:bg-[#1e1e1e] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    placeholder="PING\r\n or \h(AA BB)"
                                    value={editCommand}
                                    onChange={e => setEditCommand(e.target.value)}
                                />
                                <p className="mt-1 text-[9px] text-gray-500 italic ml-1">Supports: \h(FF), \d(10), \r, \n, etc.</p>
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-2 ml-1">Color Tag</label>
                                <div className="flex gap-2 p-1 bg-gray-100/50 dark:bg-black/20 rounded-lg w-fit">
                                    {COLORS.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setEditColor(c)}
                                            className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${c === editColor ? 'ring-2 ring-offset-2 ring-blue-500 ring-offset-white dark:ring-offset-[#2b2d31]' : ''}`}
                                            style={{ backgroundColor: c }}
                                            title={c}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50/50 dark:bg-white/5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
                            <button
                                onClick={() => setIsEditing(null)}
                                className="px-4 py-2 text-xs font-bold uppercase text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <Save size={14} />
                                {isEditing === 'new' ? 'Create Macro' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
