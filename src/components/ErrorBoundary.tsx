import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    /** Label shown in the fallback (e.g. "Terminal", "Macro Panel") */
    label?: string;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(`[ErrorBoundary] ${error.message}`, info.componentStack);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: undefined });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center bg-gray-50 dark:bg-[#1a1c20]">
                    <AlertTriangle size={28} className="text-amber-500" />
                    <div>
                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                            {this.props.label ?? 'Component'} crashed
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 font-mono">
                            {this.state.error?.message}
                        </p>
                    </div>
                    <button
                        onClick={this.handleRetry}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
                    >
                        <RefreshCw size={12} /> Retry
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
