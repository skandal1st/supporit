import ping from 'ping';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ScannedDevice {
  ip: string;
  hostname?: string;
  mac?: string;
  isAlive: boolean;
  responseTime?: number;
  vendor?: string;
}

// Получить локальную сеть (IP и маску подсети)
export function getLocalNetwork(): { network: string; mask: string } | null {
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    const addresses = interfaces[name];
    if (!addresses) continue;
    
    for (const addr of addresses) {
      // Пропускаем IPv6 и внутренние интерфейсы
      if (addr.family === 'IPv4' && !addr.internal && addr.address) {
        // Простое определение маски подсети (можно улучшить)
        const parts = addr.netmask.split('.');
        let maskBits = 0;
        for (const part of parts) {
          const num = parseInt(part);
          maskBits += (num >>> 0).toString(2).split('1').length - 1;
        }
        
        return {
          network: addr.address,
          mask: `${maskBits}`
        };
      }
    }
  }
  
  return null;
}

// Получить MAC адрес по IP (через ARP таблицу)
async function getMacAddress(ip: string): Promise<string | undefined> {
  try {
    const platform = os.platform();
    
    if (platform === 'linux' || platform === 'darwin') {
      // Linux/Mac
      try {
        const { stdout } = await execAsync(`arp -n ${ip} 2>/dev/null || ip neighbor show ${ip} 2>/dev/null | awk '{print $5}'`);
        const mac = stdout.trim();
        // Проверяем формат MAC адреса
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        if (mac && macRegex.test(mac) && mac !== '(incomplete)') {
          return mac;
        }
      } catch {
        // Пытаемся через ip neighbor (Linux)
        try {
          const { stdout } = await execAsync(`ip neighbor show ${ip} 2>/dev/null | head -1 | awk '{print $5}'`);
          const mac = stdout.trim();
          const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
          if (mac && macRegex.test(mac)) {
            return mac;
          }
        } catch {
          // Игнорируем
        }
      }
    } else if (platform === 'win32') {
      // Windows
      try {
        const { stdout } = await execAsync(`arp -a ${ip}`);
        const match = stdout.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/);
        return match ? match[0] : undefined;
      } catch {
        // Игнорируем
      }
    }
  } catch (error) {
    // Игнорируем ошибки, если MAC не найден
  }
  
  return undefined;
}

// Получить hostname по IP (reverse DNS)
async function getHostname(ip: string): Promise<string | undefined> {
  try {
    // Пытаемся через host
    try {
      const { stdout } = await execAsync(`host ${ip} 2>/dev/null | awk '{print $5}' | head -1`);
      let hostname = stdout.trim().replace(/\.$/, '');
      if (hostname && hostname !== '') {
        return hostname.toLowerCase();
      }
    } catch {
      // Пытаемся через getent (Linux)
      try {
        const { stdout } = await execAsync(`getent hosts ${ip} 2>/dev/null | awk '{print $2}' | head -1`);
        let hostname = stdout.trim().replace(/\.$/, '');
        if (hostname && hostname !== '') {
          return hostname.toLowerCase();
        }
      } catch {
        // Игнорируем
      }
    }
  } catch (error) {
    // Игнорируем ошибки
  }
  
  return undefined;
}

// Определить тип устройства по hostname и MAC
function detectDeviceType(hostname?: string, mac?: string): string {
  if (!hostname && !mac) return 'other';
  
  const hostnameLower = (hostname || '').toLowerCase();
  const macLower = (mac || '').toLowerCase();
  
  // Проверка по hostname
  if (hostnameLower.includes('printer') || hostnameLower.includes('hp') || hostnameLower.includes('canon')) {
    return 'printer';
  }
  if (hostnameLower.includes('server') || hostnameLower.includes('srv')) {
    return 'server';
  }
  if (hostnameLower.includes('switch') || hostnameLower.includes('router') || hostnameLower.includes('gateway')) {
    return 'network';
  }
  if (hostnameLower.includes('monitor') || hostnameLower.includes('display')) {
    return 'monitor';
  }
  
  // Проверка по MAC (OUI - первые 3 октета)
  if (mac) {
    const oui = mac.replace(/[:-]/g, '').substring(0, 6).toUpperCase();
    // Можно добавить проверку по базе OUI, но для простоты оставим так
  }
  
  // По умолчанию - компьютер, если есть hostname
  if (hostname) {
    return 'computer';
  }
  
  return 'network';
}

// Сканировать диапазон IP адресов
export async function scanNetwork(
  startIp?: string,
  endIp?: string,
  subnet?: string
): Promise<ScannedDevice[]> {
  const devices: ScannedDevice[] = [];
  
  // Определяем диапазон для сканирования
  let ipRange: string[] = [];
  
  if (subnet) {
    // Сканируем всю подсеть
    const [networkBase, maskStr] = subnet.split('/');
    const mask = parseInt(maskStr || '24');
    const networkParts = networkBase.split('.').map(Number);
    
    if (networkParts.length !== 4 || networkParts.some(isNaN)) {
      throw new Error('Некорректный формат подсети');
    }
    
    // Простой случай для /24 (255.255.255.0)
    if (mask === 24) {
      for (let i = 1; i < 255; i++) {
        ipRange.push(`${networkParts[0]}.${networkParts[1]}.${networkParts[2]}.${i}`);
      }
    } else {
      throw new Error('Поддерживаются только подсети /24');
    }
  } else if (startIp && endIp) {
    // Сканируем диапазон от startIp до endIp
    const startParts = startIp.split('.').map(Number);
    const endParts = endIp.split('.').map(Number);
    
    for (let a = startParts[0]; a <= endParts[0]; a++) {
      for (let b = (a === startParts[0] ? startParts[1] : 0); b <= (a === endParts[0] ? endParts[1] : 255); b++) {
        for (let c = (b === startParts[1] && a === startParts[0] ? startParts[2] : 0); 
             c <= (b === endParts[1] && a === endParts[0] ? endParts[2] : 255); c++) {
          const startC = (c === startParts[2] && b === startParts[1] && a === startParts[0] ? startParts[3] : 0);
          const endC = (c === endParts[2] && b === endParts[1] && a === endParts[0] ? endParts[3] : 255);
          for (let d = startC; d <= endC; d++) {
            ipRange.push(`${a}.${b}.${c}.${d}`);
          }
        }
      }
    }
  } else if (startIp) {
    // Сканируем один IP или диапазон вида 192.168.1.1-254
    const match = startIp.match(/^(\d+\.\d+\.\d+\.)(\d+)-(\d+)$/);
    if (match) {
      const [, base, start, end] = match;
      for (let i = parseInt(start); i <= parseInt(end); i++) {
        ipRange.push(`${base}${i}`);
      }
    } else {
      ipRange = [startIp];
    }
  } else {
    throw new Error('Необходимо указать subnet, startIp и endIp, или startIp');
  }
  
  if (ipRange.length === 0) {
    throw new Error('Не удалось определить диапазон для сканирования');
  }
  
  console.log(`Сканирование ${ipRange.length} IP адресов...`);
  
  // Сканируем параллельно, но с ограничением
  const batchSize = 50;
  for (let i = 0; i < ipRange.length; i += batchSize) {
    const batch = ipRange.slice(i, i + batchSize);
    
    const promises = batch.map(async (ip) => {
      try {
        // Пинг с коротким таймаутом
        const result = await ping.promise.probe(ip, {
          timeout: 2,
          min_reply: 1,
        });
        
        if (result.alive) {
          // Получаем дополнительную информацию
          const [mac, hostname] = await Promise.all([
            getMacAddress(ip),
            getHostname(ip),
          ]);
          
          const device: ScannedDevice = {
            ip,
            isAlive: true,
            responseTime: result.time,
            mac,
            hostname,
          };
          
          return device;
        }
        
        return null;
      } catch (error) {
        return null;
      }
    });
    
    const results = await Promise.all(promises);
    devices.push(...results.filter((d): d is ScannedDevice => d !== null));
  }
  
  return devices;
}

// Генерировать инвентарный номер на основе IP
export function generateInventoryNumber(ip: string, prefix = 'NET'): string {
  const parts = ip.split('.');
  const networkPart = parts.slice(0, 3).join('');
  const lastOctet = parts[parts.length - 1].padStart(3, '0');
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}-${networkPart}-${lastOctet}-${timestamp}`;
}

// Генерировать название устройства на основе hostname или IP
export function generateDeviceName(device: ScannedDevice): string {
  if (device.hostname) {
    // Убираем домен и делаем первую букву заглавной
    const name = device.hostname.split('.')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return `Сетевое устройство ${device.ip}`;
}

