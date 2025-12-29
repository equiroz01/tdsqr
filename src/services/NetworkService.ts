import * as Network from 'expo-network';

const PORT = 8765;

export interface ConnectionInfo {
  ip: string;
  port: number;
  pin: string;
}

export async function getLocalIP(): Promise<string> {
  const ip = await Network.getIpAddressAsync();
  return ip;
}

export function generatePIN(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function getConnectionURL(ip: string): string {
  return `tdsqr://${ip}:${PORT}`;
}

export function parseConnectionURL(url: string): { ip: string; port: number } | null {
  try {
    const match = url.match(/tdsqr:\/\/([^:]+):(\d+)/);
    if (match) {
      return { ip: match[1], port: parseInt(match[2]) };
    }
    return null;
  } catch {
    return null;
  }
}

export { PORT };
