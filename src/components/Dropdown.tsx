import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';

export interface DropdownOption {
    label: string;
    value: string | number;
}

interface DropdownProps {
    label?: string;
    value: string | number;
    options: DropdownOption[];
    onChange: (value: any) => void;
    disabled?: boolean;
    /** 'down' opens below (default), 'up' opens above */
    direction?: 'up' | 'down';
    /** Minimum width of the trigger */
    minWidth?: string;
    /** Size variant */
    size?: 'sm' | 'md';
    /** Optional custom trigger class overrides */
    className?: string;
}

export function Dropdown({
    label,
    value,
    options,
    onChange,
    disabled = false,
    direction = 'down',
    minWidth = '85px',
    size = 'md',
    className,
}: DropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find(opt => String(opt.value) === String(value));

    const sizeClasses = size === 'sm'
        ? 'text-[10px] h-[26px] pl-2 pr-3 py-0.5'
        : 'text-xs h-[34px] pl-3 pr-3 py-2';

    const labelSize = size === 'sm' ? 'text-[9px]' : 'text-[8px]';
    const optionSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

    return (
        <div className="relative flex flex-col">
            {label && (
                <label className={clsx(labelSize, "uppercase font-bold text-gray-500 tracking-wider mb-0.5 ml-1")}>
                    {label}
                </label>
            )}
            <div className="relative">
                <div
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    className={clsx(
                        "flex items-center gap-1 rounded-md font-mono bg-gray-100 dark:bg-[#1e1e1e] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 cursor-pointer hover:border-blue-500 transition-all justify-between shadow-sm font-bold uppercase",
                        sizeClasses,
                        disabled && "opacity-60 cursor-not-allowed",
                        className
                    )}
                    style={{ minWidth }}
                >
                    <span className="truncate">{selectedOption?.label || String(value)}</span>
                    <ChevronDown
                        size={size === 'sm' ? 10 : 12}
                        className={clsx(
                            "transition-transform duration-200 text-gray-500",
                            isOpen && (direction === 'up' ? "" : "rotate-180")
                        )}
                    />
                </div>

                {isOpen && !disabled && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <ul
                            className={clsx(
                                "absolute left-0 w-full bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden z-50 py-1",
                                direction === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
                            )}
                        >
                            {options.map((opt) => (
                                <li
                                    key={String(opt.value)}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                    }}
                                    className={clsx(
                                        optionSize,
                                        "px-3 py-1.5 font-medium cursor-pointer transition-colors",
                                        String(value) === String(opt.value)
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
