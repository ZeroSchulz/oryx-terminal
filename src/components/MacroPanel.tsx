import { useState, useEffect } from 'react';
import { Plus, Trash2, Play, Save, X, Edit2 } from 'lucide-react';

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
    const [macros, setMacros] = useState<Macro[]>([]);
    const [isEditing, setIsEditing] = useState<string | null>(null); // ID of macro being edited, or 'new'

    // Edit Form State
    const [editName, setEditName] = useState('');
    const [editCommand, setEditCommand] = useState('');
    const [editColor, setEditColor] = useState('blue');

    const COLORS = ['blue', 'red', 'green', 'purple', 'orange', 'gray'];

    useEffect(() => {
        const saved = localStorage.getItem('oryx_macros');
        if (saved) {
            try {
                setMacros(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load macros", e);
            }
        } else {
            // Defaults
            setMacros([
                { id: '1', name: 'Ping', command: 'PING\\r\\n', color: 'blue' },
                { id: '2', name: 'Version', command: 'VER?\\n', color: 'green' },
                { id: '3', name: 'Reset', command: '\\h(AA 55 00)', color: 'red' },
            ]);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('oryx_macros', JSON.stringify(macros));
    }, [macros]);

    const handleSave = () => {
        if (!editName || !editCommand) return;

        if (isEditing === 'new') {
            const newMacro: Macro = {
                id: Date.now().toString(),
                name: editName,
                command: editCommand,
                color: editColor
            };
            setMacros(prev => [...prev, newMacro]);
        } else {
            setMacros(prev => prev.map(m => m.id === isEditing ? { ...m, name: editName, command: editCommand, color: editColor } : m));
        }
        setIsEditing(null);
        setEditName('');
        setEditCommand('');
    };

    const handleDelete = (id: string) => {
        if (confirm('Delete this macro?')) {
            setMacros(prev => prev.filter(m => m.id !== id));
        }
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

    const getColorClass = (color: string | undefined, type: 'bg' | 'text' | 'border') => {
        const c = color || 'blue';
        const map: any = {
            blue: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
            red: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' },
            green: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-800' },
            purple: { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
            orange: { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
            gray: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-200 dark:border-gray-700' },
        };
        return map[c]?.[type] || map['blue'][type];
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-[#181818] border-l border-gray-200 dark:border-[#1e1e1e] w-64 transition-colors duration-200 shadow-xl z-30">
            <div className="p-3 border-b border-gray-200 dark:border-[#1e1e1e] flex justify-between items-center bg-white dark:bg-[#2b2d31]">
                <h3 className="font-bold text-xs uppercase tracking-wider text-gray-500">Macros</h3>
                <button onClick={() => startEdit()} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-blue-600 dark:text-blue-400">
                    <Plus size={16} />
                </button>
            </div>

            <div className="flex-grow overflow-y-auto p-2 space-y-2">
                {isEditing && (
                    <div className="p-3 bg-white dark:bg-[#2b2d31] rounded shadow-md border border-blue-200 dark:border-blue-900 mb-2 animate-fade-in">
                        <input
                            className="w-full mb-2 text-sm px-2 py-1 border rounded bg-gray-50 dark:bg-[#1e1e1e] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                            placeholder="Name"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                        />
                        <input
                            className="w-full mb-2 text-xs font-mono px-2 py-1 border rounded bg-gray-50 dark:bg-[#1e1e1e] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                            placeholder="Command (\h, 0x...)"
                            value={editCommand}
                            onChange={e => setEditCommand(e.target.value)}
                        />
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex gap-1">
                                {COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setEditColor(c)}
                                        className={`w-4 h-4 rounded-full ${c === editColor ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsEditing(null)} className="text-gray-500 p-1 hover:bg-gray-100 rounded"><X size={14} /></button>
                            <button onClick={handleSave} className="text-blue-600 p-1 hover:bg-blue-50 rounded"><Save size={14} /></button>
                        </div>
                    </div>
                )}

                {macros.map(m => (
                    <div key={m.id} className={`group relative p-2 rounded border ${getColorClass(m.color, 'bg')} ${getColorClass(m.color, 'border')} hover:shadow-sm transition-all`}>
                        <div className="flex justify-between items-start">
                            <div className="flex-grow cursor-pointer" onClick={() => onRun(m.command)}>
                                <div className={`font-bold text-sm ${getColorClass(m.color, 'text')}`}>{m.name}</div>
                                <div className="text-[10px] text-gray-500 font-mono truncate max-w-[140px]" title={m.command}>{m.command}</div>
                            </div>
                            <button onClick={() => onRun(m.command)} className="opacity-0 group-hover:opacity-100 text-blue-600 p-1 hover:bg-white/50 rounded absolute right-8 top-1 transition-opacity">
                                <Play size={14} fill="currentColor" />
                            </button>
                            <div className="absolute right-1 top-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => startEdit(m)} className="text-gray-500 hover:text-blue-600"><Edit2 size={12} /></button>
                                <button onClick={() => handleDelete(m.id)} className="text-gray-500 hover:text-red-600"><Trash2 size={12} /></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
