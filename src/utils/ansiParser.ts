export interface AnsiSegment {
    text: string;
    style?: React.CSSProperties;
    bold?: boolean;
    underline?: boolean;
}

const colorMap: Record<number, string> = {
    // Standard colors
    30: 'var(--ansi-black)',
    31: 'var(--ansi-red)',
    32: 'var(--ansi-green)',
    33: 'var(--ansi-yellow)',
    34: 'var(--ansi-blue)',
    35: 'var(--ansi-magenta)',
    36: 'var(--ansi-cyan)',
    37: 'var(--ansi-white)',
    // Bright colors
    90: 'var(--ansi-bright-black)',
    91: 'var(--ansi-bright-red)',
    92: 'var(--ansi-bright-green)',
    93: 'var(--ansi-bright-yellow)',
    94: 'var(--ansi-bright-blue)',
    95: 'var(--ansi-bright-magenta)',
    96: 'var(--ansi-bright-cyan)',
    97: 'var(--ansi-bright-white)',
    // Background colors
    40: 'var(--ansi-black)',
    41: 'var(--ansi-red)',
    42: 'var(--ansi-green)',
    43: 'var(--ansi-yellow)',
    44: 'var(--ansi-blue)',
    45: 'var(--ansi-magenta)',
    46: 'var(--ansi-cyan)',
    47: 'var(--ansi-white)',
    // Bright background colors
    100: 'var(--ansi-bright-black)',
    101: 'var(--ansi-bright-red)',
    102: 'var(--ansi-bright-green)',
    103: 'var(--ansi-bright-yellow)',
    104: 'var(--ansi-bright-blue)',
    105: 'var(--ansi-bright-magenta)',
    106: 'var(--ansi-bright-cyan)',
    107: 'var(--ansi-bright-white)',
};

// Module-level regex avoids recompilation on every call.
// Must reset lastIndex before each use because of the `g` flag.
const ANSI_REGEX = /\x1b\[([\d;]*)m/g;

export function parseAnsi(text: string): AnsiSegment[] {
    const segments: AnsiSegment[] = [];
    ANSI_REGEX.lastIndex = 0;

    let lastIndex = 0;
    let currentFg: string | undefined = undefined;
    let currentBg: string | undefined = undefined;
    let currentBold = false;
    let currentUnderline = false;

    let match;
    while ((match = ANSI_REGEX.exec(text)) !== null) {
        const plainText = text.substring(lastIndex, match.index);
        if (plainText) {
            segments.push({
                text: plainText,
                style: {
                    color: currentFg,
                    backgroundColor: currentBg,
                },
                bold: currentBold,
                underline: currentUnderline,
            });
        }

        const codes = match[1].split(';').map(n => parseInt(n || '0'));
        for (const code of codes) {
            if (code === 0) {
                currentFg = undefined;
                currentBg = undefined;
                currentBold = false;
                currentUnderline = false;
            } else if (code === 1) {
                currentBold = true;
            } else if (code === 4) {
                currentUnderline = true;
            } else if (code >= 30 && code <= 37) {
                currentFg = colorMap[code];
            } else if (code >= 90 && code <= 97) {
                currentFg = colorMap[code];
            } else if (code >= 40 && code <= 47) {
                currentBg = colorMap[code];
            } else if (code >= 100 && code <= 107) {
                currentBg = colorMap[code];
            } else if (code === 39) {
                currentFg = undefined;
            } else if (code === 49) {
                currentBg = undefined;
            }
        }

        lastIndex = ANSI_REGEX.lastIndex;
    }

    const remainingText = text.substring(lastIndex);
    if (remainingText) {
        segments.push({
            text: remainingText,
            style: {
                color: currentFg,
                backgroundColor: currentBg,
            },
            bold: currentBold,
            underline: currentUnderline,
        });
    }

    return segments;
}
