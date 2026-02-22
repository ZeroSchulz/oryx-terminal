export type ChecksumType = 'none' | 'xor' | 'lrc' | 'crc8' | 'crc16-modbus' | 'crc-ccitt';

export function computeChecksum(type: ChecksumType, data: number[]): number[] {
    switch (type) {
        case 'xor':          return [data.reduce((a, b) => a ^ b, 0)];
        case 'lrc':          return [(0x100 - (data.reduce((a, b) => a + b, 0) & 0xFF)) & 0xFF];
        case 'crc8':         return crc8(data);
        case 'crc16-modbus': return crc16Modbus(data);
        case 'crc-ccitt':    return crcCcitt(data);
        default:             return [];
    }
}

// CRC-8 (poly 0x07, init 0x00)
function crc8(data: number[]): number[] {
    let crc = 0x00;
    for (const b of data) {
        crc ^= b;
        for (let i = 0; i < 8; i++)
            crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xFF : (crc << 1) & 0xFF;
    }
    return [crc];
}

// CRC-16/Modbus (poly 0x8005 reflected = 0xA001, init 0xFFFF), little-endian output
function crc16Modbus(data: number[]): number[] {
    let crc = 0xFFFF;
    for (const b of data) {
        crc ^= b;
        for (let i = 0; i < 8; i++)
            crc = (crc & 1) ? ((crc >>> 1) ^ 0xA001) : (crc >>> 1);
    }
    return [crc & 0xFF, (crc >> 8) & 0xFF];
}

// CRC-CCITT (poly 0x1021, init 0xFFFF), big-endian output
function crcCcitt(data: number[]): number[] {
    let crc = 0xFFFF;
    for (const b of data) {
        crc ^= b << 8;
        for (let i = 0; i < 8; i++)
            crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
    return [(crc >> 8) & 0xFF, crc & 0xFF];
}
