import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { documentDir, join } from '@tauri-apps/api/path';
import { save } from '@tauri-apps/plugin-dialog';
import { ConnectionPanel } from './components/ConnectionPanel';
import { StatusBar } from './components/StatusBar';
import { SettingsPanel } from './components/SettingsPanel';
import { Terminal, LogEntry } from './components/Terminal';
import { Sender, parseInput } from './components/Sender';
import { MacroPanel } from './components/MacroPanel';
import './App.css';

interface SerialPayload {
  data: number[]; // Received as array of bytes
}

function App() {
  const [lines, setLines] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [viewMode, setViewMode] = useState<'text' | 'hex' | 'bin' | 'dec' | 'oct' | 'char'>('text');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showMacros, setShowMacros] = useState(false);

  const [breakMode, setBreakMode] = useState<'none' | 'chunk' | 'bytes' | 'beforeSequence' | 'afterSequence' | 'timeout'>('beforeSequence');
  const [breakAfterBytesCount, setBreakAfterBytesCount] = useState(16);
  const [breakBeforeSequenceValue, setBreakBeforeSequenceValue] = useState('');
  const [breakAfterSequenceValue, setBreakAfterSequenceValue] = useState('');
  const [breakAfterTimeoutMs, setBreakAfterTimeoutMs] = useState(5);
  const [eolSequence, setEolSequence] = useState('\\n');
  const [showEol, setShowEol] = useState(false);
  const [showTimestamp, setShowTimestamp] = useState(true);

  // Smart Coloring State
  const [hasSeenAnsi, setHasSeenAnsi] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedPort, setSelectedPort] = useState<string>('');

  // Logging State
  const [logPath, setLogPath] = useState('');
  const [isLogging, setIsLogging] = useState(false);

  // Initialize Default Log Path
  useEffect(() => {
    const initLogPath = async () => {
      try {
        const docDir = await documentDir();
        const defaultPath = await join(docDir, 'ORYX_Logs', 'session_log.txt');
        setLogPath(defaultPath);
        logPathRef.current = defaultPath;
      } catch (e) {
        console.error("Failed to resolve default log path:", e);
        setLogPath('session_log.txt'); // Fallback
        logPathRef.current = 'session_log.txt';
      }
    };
    initLogPath();
  }, []);

  // Serial port configuration state
  const [dataBits, setDataBits] = useState(8);
  const [stopBits, setStopBits] = useState(1);
  const [parity, setParity] = useState('None');
  const [flowControl, setFlowControl] = useState('None');

  // Buffers
  const bufferRef = useRef<number[]>([]);
  const lastFlushTime = useRef<number>(0);
  const viewModeRef = useRef<'text' | 'hex' | 'bin' | 'dec' | 'oct' | 'char'>('text');

  // Refs for logging and line breaking logic
  const isLoggingRef = useRef(false);
  const logPathRef = useRef('session_log.txt');
  const lastReceiveTime = useRef<number>(0);

  // Line breaking refs
  const breakModeRef = useRef<'none' | 'chunk' | 'bytes' | 'beforeSequence' | 'afterSequence' | 'timeout'>('beforeSequence');
  const breakAfterBytesCountRef = useRef(16);
  const breakBeforeSequenceValueRef = useRef('');
  const breakAfterSequenceValueRef = useRef('');
  const breakAfterTimeoutMsRef = useRef(5);
  const eolSequenceRef = useRef('\\n');
  const showEolRef = useRef(false);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    isLoggingRef.current = isLogging;
    logPathRef.current = logPath;
    breakModeRef.current = breakMode;
    breakAfterBytesCountRef.current = breakAfterBytesCount;
    breakBeforeSequenceValueRef.current = breakBeforeSequenceValue;
    breakAfterSequenceValueRef.current = breakAfterSequenceValue;
    breakAfterTimeoutMsRef.current = breakAfterTimeoutMs;
    eolSequenceRef.current = eolSequence;
    showEolRef.current = showEol;
  }, [isLogging, logPath, breakMode, breakAfterBytesCount, breakBeforeSequenceValue, breakAfterSequenceValue, breakAfterTimeoutMs, eolSequence, showEol]);

  // Handle Theme Change
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const getTimestamp = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
  };

  // Safe ID generator
  const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

  const addLog = (text: string, type: LogEntry['type'], originalData?: number[]) => {
    // Check for ANSI codes to update session state
    if (!hasSeenAnsi && text.includes('\x1b')) {
      setHasSeenAnsi(true);
    }

    setLines(prev => [...prev, {
      id: generateId(),
      timestamp: getTimestamp(),
      type,
      text,
      originalData
    }]);
  };

  const hasLoggedWelcome = useRef(false);

  useEffect(() => {
    // Initial welcome message - only log once
    if (!hasLoggedWelcome.current) {
      console.log("[App] Mounting...");
      addLog("Welcome to Oryx Serial Terminal. Ready to connect.", 'system');
      addLog("Select a view mode below (Text, Hex, Bin, etc).", 'system');
      hasLoggedWelcome.current = true;
    }

    const unlisten = listen<SerialPayload>('serial-data', (event) => {
      bufferRef.current.push(...event.payload.data);
      lastReceiveTime.current = Date.now();
    });

    // Sync Connection Status on Mount
    const syncConnection = async () => {
      try {
        const activePort = await invoke<string | null>('get_connection_status');
        if (activePort) {
          setIsConnected(true);
          setSelectedPort(activePort);
          addLog(`Detected active connection to ${activePort}.`, 'system');
        }
      } catch (e) {
        console.error("Failed to sync connection status:", e);
      }
    };
    syncConnection();

    const interval = setInterval(() => {
      const now = Date.now();

      // Check if we should flush based on timeout
      if (breakModeRef.current === 'timeout' && bufferRef.current.length > 0) {
        if (now - lastReceiveTime.current > breakAfterTimeoutMsRef.current) {
          flushBuffer(true);
        }
      }

      // Fallback: flush if buffer has been sitting for too long
      const forceFlushTimeout = viewModeRef.current === 'text' ? 1000 : 50;
      const isStale = now - lastReceiveTime.current > forceFlushTimeout;

      if (bufferRef.current.length > 0) {
        if (isStale) {
          flushBuffer(true);
        } else {
          flushBuffer(false);
        }
      }
    }, 16); // Check every ~16ms (60fps) to reduce render thrashing

    return () => {
      unlisten.then(f => f());
      clearInterval(interval);
    };
  }, []); // hasSeenAnsi dependency added implicitly by addLog closure, but addLog handles it? No, addLog is a closure.
  // Wait, addLog uses setHasSeenAnsi which is fine. But addLog reads hasSeenAnsi.
  // Since addLog is called inside useEffect, it captures the initial state.
  // We need to use specific logic to avoid stale closures if we want it perfect,
  // BUT simpler approach: inside addLog use functional update or ref for hasSeenAnsi?
  // Actually, let's fix the closure issue by NOT using 'hasSeenAnsi' in the condition inside useEffect if possible,
  // OR better: make addLog check a Ref, or just use setHasSeenAnsi(true) always if found?
  // It's a boolean latch. Once true, stays true. So setHasSeenAnsi(true) is safe to call repeatedly.
  // Detection: if (text.includes('\x1b')) setHasSeenAnsi(true);
  // This avoids reading the state. Perfect.

  const flushBuffer = async (force: boolean = false) => {
    if (bufferRef.current.length === 0) return;

    const data = Uint8Array.from(bufferRef.current);
    lastFlushTime.current = Date.now();

    // UI Visualization with Advanced Line Breaking
    const breakPoints: number[] = []; // Indices where we should break
    const currentViewMode = viewModeRef.current;

    if (currentViewMode === 'text') {
      // --- TEXT MODE: Wait strictly for EOL sequence ---
      try {
        const eolBytes = parseInput(eolSequenceRef.current);
        if (eolBytes.length > 0) {
          for (let i = 0; i <= data.length - eolBytes.length; i++) {
            let match = true;
            for (let j = 0; j < eolBytes.length; j++) {
              if (data[i + j] !== eolBytes[j]) {
                match = false;
                break;
              }
            }
            if (match) {
              breakPoints.push(i + eolBytes.length); // Break AFTER the sequence
            }
          }
        }
      } catch (e) {
        console.error("Failed to parse EOL sequence:", e);
      }
    } else {
      // --- BINARY MODES: Use selected breakMode strategy ---

      // 1. Break on every chunk
      if (breakModeRef.current === 'chunk') {
        breakPoints.push(data.length);
      }

      // 2. Break after N bytes
      if (breakModeRef.current === 'bytes') {
        const byteCount = breakAfterBytesCountRef.current;
        for (let i = byteCount; i < data.length; i += byteCount) {
          breakPoints.push(i);
        }
      }

      // 3. Break before sequence
      if (breakModeRef.current === 'beforeSequence' && breakBeforeSequenceValueRef.current) {
        try {
          const sequenceBytes = parseInput(breakBeforeSequenceValueRef.current);
          if (sequenceBytes.length > 0) {
            for (let i = 0; i <= data.length - sequenceBytes.length; i++) {
              let match = true;
              for (let j = 0; j < sequenceBytes.length; j++) {
                if (data[i + j] !== sequenceBytes[j]) {
                  match = false;
                  break;
                }
              }
              if (match && i > 0) {
                breakPoints.push(i); // Break BEFORE the sequence
              }
            }
          }
        } catch (e) {
          console.error("Failed to parse break-before sequence:", e);
        }
      }

      // 4. Break after sequence
      if (breakModeRef.current === 'afterSequence' && breakAfterSequenceValueRef.current) {
        try {
          const sequenceBytes = parseInput(breakAfterSequenceValueRef.current);
          if (sequenceBytes.length > 0) {
            for (let i = 0; i <= data.length - sequenceBytes.length; i++) {
              let match = true;
              for (let j = 0; j < sequenceBytes.length; j++) {
                if (data[i + j] !== sequenceBytes[j]) {
                  match = false;
                  break;
                }
              }
              if (match) {
                breakPoints.push(i + sequenceBytes.length); // Break AFTER the sequence
              }
            }
          }
        } catch (e) {
          console.error("Failed to parse break-after sequence:", e);
        }
      }

      // 5. Global EOL sequence break (Also enabled for Binary modes)
      try {
        const eolBytes = parseInput(eolSequenceRef.current);
        if (eolBytes.length > 0) {
          for (let i = 0; i <= data.length - eolBytes.length; i++) {
            let match = true;
            for (let j = 0; j < eolBytes.length; j++) {
              if (data[i + j] !== eolBytes[j]) {
                match = false;
                break;
              }
            }
            if (match) {
              breakPoints.push(i + eolBytes.length); // Break AFTER the sequence
            }
          }
        }
      } catch (e) {
        console.error("Failed to parse EOL sequence:", e);
      }
    }

    // Sort and deduplicate break points
    const uniqueBreakPoints = Array.from(new Set(breakPoints)).sort((a, b) => a - b);

    // Logging to File (Log EVERYTHING we are about to process)
    if (isLoggingRef.current && logPathRef.current) {
      const logLimit = uniqueBreakPoints.length > 0 ? uniqueBreakPoints[uniqueBreakPoints.length - 1] : (force ? data.length : 0);
      if (logLimit > 0) {
        const logData = data.slice(0, logLimit);
        try {
          await invoke('log_to_file', { path: logPathRef.current, data: Array.from(logData) });
        } catch (e) {
          console.error("Failed to log:", e);
          addLog(`Log Error: ${e}`, 'error');
          setIsLogging(false);
        }
      }
    }

    // Process segments
    let lastIndex = 0;
    if (uniqueBreakPoints.length > 0) {
      for (const breakPoint of uniqueBreakPoints) {
        if (breakPoint > lastIndex && breakPoint <= data.length) {
          const segment = data.slice(lastIndex, breakPoint);
          const text = new TextDecoder().decode(segment);
          addLog(text, 'rx', Array.from(segment));
          lastIndex = breakPoint;
        }
      }
      // Update buffer with remaining data
      const remaining = data.slice(lastIndex);
      if (force && remaining.length > 0) {
        const text = new TextDecoder().decode(remaining);
        addLog(text, 'rx', Array.from(remaining));
        bufferRef.current = [];
      } else {
        bufferRef.current = Array.from(remaining);
      }
    } else if (force) {
      // No break points but forced flush
      const text = new TextDecoder().decode(data);
      addLog(text, 'rx', Array.from(data));
      bufferRef.current = [];
    }
  };

  const handleConnect = async (port: string, baud: number, dataBits: number, stopBits: number, parity: string, flowControl: string) => {
    try {
      await invoke('open_port', {
        portName: port,
        baudRate: baud,
        dataBits: dataBits,
        stopBits: stopBits,
        parity: parity,
        flowControl: flowControl
      });
      setIsConnected(true);
      setHasSeenAnsi(false); // New session starts fresh
      addLog(`Connected to ${port} at ${baud} baud (${dataBits}${parity.charAt(0).toUpperCase()}${stopBits}).`, 'system');
    } catch (e: any) {
      console.error(e);
      addLog(`Failed to connect: ${e}`, 'error');
    }
  };

  const handleDisconnect = async () => {
    try {
      await invoke('close_port');
      setIsConnected(false);
      setHasSeenAnsi(false); // Session ended
      addLog(`Disconnected.`, 'system');
    } catch (e) {
      console.error(e);
    }
  };

  const handleClear = () => {
    setLines([]);
    setHasSeenAnsi(false); // Reset smart coloring state
    addLog("Logs cleared.", 'system');
  };

  const handleLogPathBrowse = async () => {
    try {
      const selected = await save({
        title: 'Select Log File Location',
        defaultPath: logPath || 'session_log.txt',
        filters: [{ name: 'Text Documents', extensions: ['txt', 'log'] }]
      });
      if (selected) {
        setLogPath(selected);
        logPathRef.current = selected;
      }
    } catch (e) {
      console.error("Failed to open save dialog:", e);
      addLog(`Dialog Error: ${e}`, 'error');
    }
  };

  const handleMacroRun = async (command: string) => {
    if (!isConnected) {
      addLog("Cannot send: Not connected.", 'error');
      return;
    }

    const dataBytes = parseInput(command);
    try {
      await invoke('send_data', { data: dataBytes });
      addLog(command, 'tx', dataBytes);
    } catch (e) {
      addLog(`Failed to send macro: ${e}`, 'error');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-100 dark:bg-[#1e1e1e] transition-colors duration-200 overflow-hidden">
      <ConnectionPanel
        isConnected={isConnected}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onOpenSettings={() => setIsSettingsOpen(true)}
        selectedPort={selectedPort}
        setSelectedPort={setSelectedPort}
        dataBits={dataBits}
        stopBits={stopBits}
        parity={parity}
        flowControl={flowControl}
      />

      <div className="flex-grow flex overflow-hidden min-h-0">
        {/* Main Terminal Area */}
        <div className="flex-grow flex flex-col overflow-hidden relative min-w-0">
          <Terminal
            lines={lines}
            autoScroll={autoScroll}
            setAutoScroll={setAutoScroll}
            showTimestamp={showTimestamp}
            setShowTimestamp={setShowTimestamp}
            viewMode={viewMode}
            showEol={showEol}
            eolSequence={eolSequence}
            onClear={handleClear}
            hasSeenAnsi={hasSeenAnsi}
          />

        </div>

        {/* Macro Sidebar */}
        {showMacros && (
          <div className="animate-slide-in-right h-full border-l border-gray-200 dark:border-[#303339]">
            <MacroPanel onRun={handleMacroRun} />
          </div>
        )}
      </div>

      <Sender
        isConnected={isConnected}
        onSend={(text, data) => {
          addLog(text, 'tx', data);
        }}
      />

      <StatusBar
        isConnected={isConnected}
        selectedPort={selectedPort}
        dataBits={dataBits}
        stopBits={stopBits}
        parity={parity}
        flowControl={flowControl}
        theme={theme}
        setTheme={setTheme}
        viewMode={viewMode}
        setViewMode={setViewMode}
        autoScroll={autoScroll}
        setAutoScroll={setAutoScroll}
        showMacros={showMacros}
        setShowMacros={setShowMacros}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onClear={handleClear}
      />

      {/* Settings Panel Overlay */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        dataBits={dataBits}
        setDataBits={setDataBits}
        stopBits={stopBits}
        setStopBits={setStopBits}
        parity={parity}
        setParity={setParity}
        flowControl={flowControl}
        setFlowControl={setFlowControl}
        viewMode={viewMode}
        setViewMode={setViewMode}
        breakMode={breakMode}
        setBreakMode={setBreakMode}
        breakAfterBytesCount={breakAfterBytesCount}
        setBreakAfterBytesCount={setBreakAfterBytesCount}
        breakBeforeSequenceValue={breakBeforeSequenceValue}
        setBreakBeforeSequenceValue={setBreakBeforeSequenceValue}
        breakAfterSequenceValue={breakAfterSequenceValue}
        setBreakAfterSequenceValue={setBreakAfterSequenceValue}
        breakAfterTimeoutMs={breakAfterTimeoutMs}
        setBreakAfterTimeoutMs={setBreakAfterTimeoutMs}
        eolSequence={eolSequence}
        setEolSequence={setEolSequence}
        showEol={showEol}
        setShowEol={setShowEol}
        logPath={logPath}
        setLogPath={(p) => {
          setLogPath(p);
          logPathRef.current = p;
        }}
        isLogging={isLogging}
        setIsLogging={setIsLogging}
        onBrowseLogPath={handleLogPathBrowse}
      />
    </div>
  );
}

export default App;
