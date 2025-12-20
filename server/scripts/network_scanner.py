#!/usr/bin/env python3
"""
Скрипт для сканирования сети и получения детальной информации об устройствах
"""

import json
import sys
import subprocess
import socket
import re
import platform
from typing import Dict, Optional, List, Any, Tuple
from dataclasses import dataclass, asdict
from ipaddress import IPv4Network, IPv4Address
import argparse

try:
    import ping3
except ImportError:
    ping3 = None

try:
    import nmap
except ImportError:
    nmap = None

try:
    from ldap3 import Server, Connection, ALL, SIMPLE, SYNC
except ImportError:
    Connection = None

try:
    import winrm
except ImportError:
    winrm = None


@dataclass
class DeviceInfo:
    """Информация об устройстве"""
    ip: str
    is_alive: bool
    hostname: Optional[str] = None
    mac: Optional[str] = None
    vendor: Optional[str] = None
    response_time: Optional[float] = None
    os: Optional[str] = None
    os_version: Optional[str] = None
    cpu: Optional[str] = None
    ram: Optional[str] = None
    hdd: Optional[str] = None
    domain: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    open_ports: Optional[List[int]] = None
    services: Optional[Dict[str, Any]] = None


class NetworkScanner:
    """Класс для сканирования сети"""
    
    def __init__(self, domain_user: Optional[str] = None, domain_password: Optional[str] = None, 
                 domain_server: Optional[str] = None):
        self.domain_user = domain_user
        self.domain_password = domain_password
        self.domain_server = domain_server
        self.mac_vendor_db = {}
        self._load_mac_vendors()
    
    def _load_mac_vendors(self):
        """Загружает базу данных производителей по MAC адресам (OUI)"""
        # Простая база популярных производителей (первые 3 октета MAC)
        self.mac_vendor_db = {
            '00:50:56': 'VMware',
            '00:0c:29': 'VMware',
            '00:05:69': 'VMware',
            '08:00:27': 'VirtualBox',
            '00:1c:42': 'Parallels',
            '00:21:70': 'Apple',
            '00:23:12': 'Apple',
            '00:25:00': 'Apple',
            '00:25:4b': 'Apple',
            '00:26:08': 'Apple',
            '00:26:4a': 'Apple',
            '00:26:bb': 'Apple',
            '00:50:56': 'VMware',
            'a4:c3:f0': 'Apple',
            'ac:de:48': 'Apple',
            'b8:27:eb': 'Raspberry Pi Foundation',
            'dc:a6:32': 'Raspberry Pi Foundation',
            'e4:5f:01': 'Raspberry Pi Foundation',
            '00:1b:44': 'Cisco',
            '00:1e:13': 'Cisco',
            '00:23:ac': 'Cisco',
            '00:26:ca': 'Cisco',
            '00:50:56': 'VMware',
            '00:50:f2': 'Microsoft',
            '00:15:5d': 'Microsoft',
            '00:0d:3a': 'Microsoft',
            '00:03:ff': 'Microsoft',
            '00:1d:d8': 'Belkin',
            '00:24:01': 'Belkin',
            '00:22:75': 'D-Link',
            '00:1b:11': 'D-Link',
            '00:26:5a': 'D-Link',
            '00:11:95': 'D-Link',
            '00:1e:58': 'TP-Link',
            '00:21:91': 'TP-Link',
            '00:27:19': 'TP-Link',
            '00:1d:0f': 'HP',
            '00:1e:68': 'HP',
            '00:21:5a': 'HP',
            '00:23:7d': 'HP',
            '00:25:b3': 'HP',
            '00:50:56': 'VMware',
            '00:1a:79': 'Lenovo',
            '00:21:86': 'Lenovo',
            '00:25:90': 'Lenovo',
        }
    
    def _get_vendor_by_mac(self, mac: str) -> Optional[str]:
        """Получает производителя по MAC адресу (OUI)"""
        if not mac:
            return None
        
        # Нормализуем MAC адрес
        mac_normalized = mac.replace('-', ':').lower()
        oui = ':'.join(mac_normalized.split(':')[:3])
        
        return self.mac_vendor_db.get(oui)
    
    def _ping_host(self, ip: str, timeout: float = 2.0) -> Tuple[bool, Optional[float]]:
        """Проверяет доступность хоста через ping"""
        try:
            if ping3:
                response_time = ping3.ping(ip, timeout=timeout)
                if response_time is not None:
                    return True, response_time * 1000  # Конвертируем в миллисекунды
                return False, None
            else:
                # Используем системный ping
                if platform.system().lower() == 'windows':
                    result = subprocess.run(
                        ['ping', '-n', '1', '-w', str(int(timeout * 1000)), ip],
                        capture_output=True,
                        timeout=timeout + 1
                    )
                else:
                    result = subprocess.run(
                        ['ping', '-c', '1', '-W', str(int(timeout)), ip],
                        capture_output=True,
                        timeout=timeout + 1
                    )
                return result.returncode == 0, None
        except Exception:
            return False, None
    
    def _get_mac_address(self, ip: str) -> Optional[str]:
        """Получает MAC адрес по IP через ARP таблицу"""
        try:
            if platform.system().lower() == 'windows':
                # Windows: arp -a IP
                result = subprocess.run(
                    ['arp', '-a', ip],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if result.returncode == 0:
                    # Ищем MAC адрес в выводе
                    matches = re.findall(r'([0-9a-f]{2}[:-]){5}([0-9a-f]{2})', result.stdout, re.IGNORECASE)
                    if matches:
                        mac = matches[0][0] + matches[0][1] if len(matches[0]) == 2 else ''.join(matches[0])
                        # Нормализуем формат (убираем лишние символы, оставляем двоеточия)
                        mac = re.sub(r'[:-]', '', mac)
                        mac = ':'.join([mac[i:i+2] for i in range(0, len(mac), 2)])
                        return mac.upper()
            else:
                # Linux/Mac - сначала пробуем ip neighbor (более надежно)
                try:
                    result = subprocess.run(
                        ['ip', 'neighbor', 'show', ip],
                        capture_output=True,
                        text=True,
                        timeout=5
                    )
                    if result.returncode == 0 and result.stdout.strip():
                        lines = result.stdout.strip().split('\n')
                        for line in lines:
                            parts = line.split()
                            if len(parts) >= 5 and ip in parts[0]:
                                mac = parts[4]
                                if re.match(r'^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$', mac, re.IGNORECASE):
                                    # Нормализуем формат
                                    mac = re.sub(r'[:-]', '', mac)
                                    mac = ':'.join([mac[i:i+2] for i in range(0, len(mac), 2)])
                                    return mac.upper()
                except Exception:
                    pass
                
                # Если ip neighbor не сработал, пробуем arp
                try:
                    result = subprocess.run(
                        ['arp', '-n', ip],
                        capture_output=True,
                        text=True,
                        timeout=5
                    )
                    if result.returncode == 0 and result.stdout.strip():
                        # Парсим вывод arp -n
                        # Формат: hostname (192.168.1.1) at aa:bb:cc:dd:ee:ff [ether] on eth0
                        match = re.search(r'(([0-9a-f]{2}[:-]){5}[0-9a-f]{2})', result.stdout, re.IGNORECASE)
                        if match:
                            mac = match.group(1)
                            # Нормализуем формат
                            mac = re.sub(r'[:-]', '', mac)
                            mac = ':'.join([mac[i:i+2] for i in range(0, len(mac), 2)])
                            return mac.upper()
                except Exception:
                    pass
                    
                # Последняя попытка - читаем напрямую /proc/net/arp (Linux)
                try:
                    if platform.system().lower() == 'linux':
                        with open('/proc/net/arp', 'r') as f:
                            for line in f.readlines()[1:]:  # Пропускаем заголовок
                                parts = line.split()
                                if len(parts) >= 6 and parts[0] == ip:
                                    mac = parts[3]
                                    if mac != '00:00:00:00:00:00' and re.match(r'^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$', mac, re.IGNORECASE):
                                        # Нормализуем формат
                                        mac = re.sub(r'[:-]', '', mac)
                                        mac = ':'.join([mac[i:i+2] for i in range(0, len(mac), 2)])
                                        return mac.upper()
                except Exception:
                    pass
                    
        except Exception as e:
            print(f"[DEBUG] Ошибка получения MAC для {ip}: {e}", file=sys.stderr)
        return None
    
    def _get_hostname(self, ip: str) -> Optional[str]:
        """Получает hostname по IP адресу"""
        try:
            # Пытаемся через reverse DNS
            hostname = socket.gethostbyaddr(ip)[0]
            return hostname.lower()
        except Exception:
            return None
    
    def _get_domain_info(self, hostname: str) -> Optional[Dict[str, Any]]:
        """Получает информацию о компьютере из домена через LDAP/Active Directory"""
        if not self.domain_user or not self.domain_password or not self.domain_server:
            return None
        
        try:
            if Connection is None:
                return None
            
            # Подключаемся к Active Directory
            server = Server(self.domain_server, get_info=ALL)
            conn = Connection(
                server,
                user=self.domain_user,
                password=self.domain_password,
                authentication=SIMPLE,
                auto_bind=True
            )
            
            # Ищем компьютер в домене
            search_base = conn.server.info.other.get('rootDomainNamingContext', [''])[0] or \
                         conn.server.info.other.get('defaultNamingContext', [''])[0] or ''
            
            if not search_base:
                conn.unbind()
                return None
            
            # Ищем по имени компьютера
            search_filter = f'(&(objectClass=computer)(name={hostname}))'
            conn.search(search_base, search_filter, attributes=['*'])
            
            if conn.entries:
                entry = conn.entries[0]
                return {
                    'domain': str(entry.get('distinguishedName', '').split(',DC=')[-1:][0] if entry.get('distinguishedName') else ''),
                    'description': str(entry.get('description', '')),
                    'operatingSystem': str(entry.get('operatingSystem', '')),
                    'operatingSystemVersion': str(entry.get('operatingSystemVersion', '')),
                }
            
            conn.unbind()
        except Exception as e:
            # Игнорируем ошибки домена - это не критично, просто не будет дополнительной информации
            pass
        
        return None
    
    def _get_windows_info(self, ip: str, hostname: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Получает информацию о Windows компьютере через WMI/WinRM"""
        if not hostname:
            return None
        
        try:
            # Пытаемся подключиться через WinRM
            if winrm is None:
                return None
            
            # Пытаемся использовать учетные данные домена
            if self.domain_user and self.domain_password:
                session = winrm.Session(
                    ip,
                    auth=(self.domain_user, self.domain_password),
                    transport='ntlm'
                )
            else:
                return None
            
            # Получаем информацию о системе
            info = {}
            
            # CPU
            try:
                result = session.run_cmd('wmic cpu get name')
                if result.status_code == 0:
                    cpu_lines = result.std_out.decode('utf-8', errors='ignore').strip().split('\n')
                    if len(cpu_lines) > 1:
                        info['cpu'] = cpu_lines[1].strip()
            except:
                pass
            
            # RAM
            try:
                result = session.run_cmd('wmic computersystem get TotalPhysicalMemory')
                if result.status_code == 0:
                    mem_lines = result.std_out.decode('utf-8', errors='ignore').strip().split('\n')
                    if len(mem_lines) > 1:
                        total_bytes = int(mem_lines[1].strip())
                        total_gb = total_bytes / (1024 ** 3)
                        info['ram'] = f"{total_gb:.1f} GB"
            except:
                pass
            
            # HDD
            try:
                result = session.run_cmd('wmic logicaldisk where "DeviceID=\'C:\'" get Size,FreeSpace')
                if result.status_code == 0:
                    disk_lines = result.std_out.decode('utf-8', errors='ignore').strip().split('\n')
                    if len(disk_lines) > 1:
                        parts = disk_lines[1].strip().split()
                        if len(parts) >= 2:
                            total = int(parts[0]) / (1024 ** 3)
                            free = int(parts[1]) / (1024 ** 3)
                            info['hdd'] = f"{free:.1f} GB свободно из {total:.1f} GB"
            except:
                pass
            
            # OS
            try:
                result = session.run_cmd('wmic os get Caption,Version')
                if result.status_code == 0:
                    os_lines = result.std_out.decode('utf-8', errors='ignore').strip().split('\n')
                    if len(os_lines) > 1:
                        parts = os_lines[1].strip().split()
                        if parts:
                            info['os'] = ' '.join(parts[:-1]) if len(parts) > 1 else parts[0]
                            if len(parts) > 1:
                                info['os_version'] = parts[-1]
            except:
                pass
            
            # Manufacturer и Model
            try:
                result = session.run_cmd('wmic computersystem get Manufacturer,Model')
                if result.status_code == 0:
                    sys_lines = result.std_out.decode('utf-8', errors='ignore').strip().split('\n')
                    if len(sys_lines) > 1:
                        parts = sys_lines[1].strip().split()
                        if len(parts) >= 2:
                            info['manufacturer'] = parts[0]
                            info['model'] = ' '.join(parts[1:])
            except:
                pass
            
            return info if info else None
            
        except Exception as e:
            # Игнорируем ошибки WMI - это не критично
            pass
        
        return None
    
    def _get_nmap_info(self, ip: str) -> Optional[Dict[str, Any]]:
        """Получает информацию через nmap (если доступен)"""
        if nmap is None:
            return None
        
        try:
            nm = nmap.PortScanner()
            # Быстрое сканирование основных портов
            nm.scan(ip, '22,80,135,139,443,445,3389', arguments='-sV --script smb-os-discovery')
            
            if ip in nm.all_hosts():
                host_info = nm[ip]
                info = {}
                
                # Открытые порты
                if 'tcp' in host_info:
                    open_ports = [port for port in host_info['tcp'] if host_info['tcp'][port]['state'] == 'open']
                    if open_ports:
                        info['open_ports'] = open_ports
                
                # OS detection
                if 'osmatch' in host_info:
                    os_matches = host_info['osmatch']
                    if os_matches:
                        info['os'] = os_matches[0]['name']
                
                # Services
                if 'tcp' in host_info:
                    services = {}
                    for port, port_info in host_info['tcp'].items():
                        if port_info['state'] == 'open':
                            service_name = port_info.get('name', '')
                            service_product = port_info.get('product', '')
                            if service_name or service_product:
                                services[str(port)] = {
                                    'name': service_name,
                                    'product': service_product,
                                    'version': port_info.get('version', '')
                                }
                    if services:
                        info['services'] = services
                
                return info if info else None
        except Exception as e:
            # Игнорируем ошибки nmap - это не критично
            # Не выводим в stderr, чтобы не ломать JSON вывод
            pass
        
        return None
    
    def scan_ip(self, ip: str, verbose: bool = False) -> DeviceInfo:
        """Сканирует один IP адрес и собирает всю доступную информацию"""
        device = DeviceInfo(ip=ip, is_alive=False)
        
        # Проверяем доступность
        is_alive, response_time = self._ping_host(ip)
        device.is_alive = is_alive
        device.response_time = response_time
        
        if not is_alive:
            return device
        
        # Получаем базовую информацию
        device.mac = self._get_mac_address(ip)
        device.hostname = self._get_hostname(ip)
        
        # Если hostname не найден через reverse DNS, пробуем через другие методы
        if not device.hostname:
            # Пытаемся получить hostname из ARP таблицы
            try:
                if platform.system().lower() == 'linux':
                    result = subprocess.run(
                        ['arp', '-n', ip],
                        capture_output=True,
                        text=True,
                        timeout=3
                    )
                    if result.returncode == 0 and result.stdout.strip():
                        # Формат: hostname (192.168.1.1) at aa:bb:cc:dd:ee:ff
                        match = re.match(r'^(\S+)', result.stdout.strip())
                        if match and match.group(1) != '?' and '(' not in match.group(1):
                            device.hostname = match.group(1).lower()
            except Exception:
                pass
        
        device.vendor = self._get_vendor_by_mac(device.mac) if device.mac else None
        
        # Получаем информацию через nmap
        nmap_info = self._get_nmap_info(ip)
        if nmap_info:
            if 'os' in nmap_info:
                device.os = nmap_info['os']
            if 'open_ports' in nmap_info:
                device.open_ports = nmap_info['open_ports']
            if 'services' in nmap_info:
                device.services = nmap_info['services']
        
        # Если устройство в домене, получаем дополнительную информацию
        if device.hostname and self.domain_user:
            domain_info = self._get_domain_info(device.hostname)
            if domain_info:
                device.domain = domain_info.get('domain')
                if domain_info.get('operatingSystem'):
                    device.os = domain_info['operatingSystem']
                if domain_info.get('operatingSystemVersion'):
                    device.os_version = domain_info['operatingSystemVersion']
            
            # Пытаемся получить детальную информацию через WMI (для Windows)
            windows_info = self._get_windows_info(ip, device.hostname)
            if windows_info:
                if 'cpu' in windows_info:
                    device.cpu = windows_info['cpu']
                if 'ram' in windows_info:
                    device.ram = windows_info['ram']
                if 'hdd' in windows_info:
                    device.hdd = windows_info['hdd']
                if 'os' in windows_info:
                    device.os = windows_info['os']
                if 'os_version' in windows_info:
                    device.os_version = windows_info['os_version']
                if 'manufacturer' in windows_info:
                    device.manufacturer = windows_info['manufacturer']
                if 'model' in windows_info:
                    device.model = windows_info['model']
        
        return device
    
    def scan_range(self, start_ip: str, end_ip: str) -> List[DeviceInfo]:
        """Сканирует диапазон IP адресов"""
        devices = []
        
        # Преобразуем IP в числа для итерации
        start_parts = list(map(int, start_ip.split('.')))
        end_parts = list(map(int, end_ip.split('.')))
        
        # Простой случай - только последний октет отличается
        if start_parts[:3] == end_parts[:3]:
            ip_range_size = end_parts[3] - start_parts[3] + 1
            print(f"[PROGRESS] Начало сканирования диапазона {start_ip} - {end_ip}: {ip_range_size} хостов", file=sys.stderr)
            
            for idx, i in enumerate(range(start_parts[3], end_parts[3] + 1), 1):
                if idx % 10 == 0 or idx == 1 or idx == ip_range_size:
                    print(f"[PROGRESS] Сканирование {idx}/{ip_range_size} ({idx*100//ip_range_size}%)", file=sys.stderr)
                
                ip = f"{start_parts[0]}.{start_parts[1]}.{start_parts[2]}.{i}"
                device = self.scan_ip(ip)
                if device.is_alive:
                    devices.append(device)
                    print(f"[PROGRESS] Найдено устройство: {device.ip} ({device.hostname or 'без hostname'})", file=sys.stderr)
            
            print(f"[PROGRESS] Сканирование завершено. Найдено устройств: {len(devices)}", file=sys.stderr)
        else:
            # Сложный случай - нужно обработать более широкий диапазон
            # Для простоты используем простую реализацию
            print(f"[ERROR] Сложные диапазоны пока не поддерживаются", file=sys.stderr)
        
        return devices
    
    def scan_subnet(self, subnet: str) -> List[DeviceInfo]:
        """Сканирует подсеть (CIDR)"""
        devices = []
        
        try:
            network = IPv4Network(subnet, strict=False)
            hosts = list(network.hosts())
            total = len(hosts)
            print(f"[PROGRESS] Начало сканирования подсети {subnet}: {total} хостов", file=sys.stderr)
            
            for idx, ip in enumerate(hosts, 1):
                if idx % 10 == 0 or idx == 1 or idx == total:
                    print(f"[PROGRESS] Сканирование {idx}/{total} ({idx*100//total}%)", file=sys.stderr)
                
                device = self.scan_ip(str(ip))
                if device.is_alive:
                    devices.append(device)
                    print(f"[PROGRESS] Найдено устройство: {device.ip} ({device.hostname or 'без hostname'})", file=sys.stderr)
            
            print(f"[PROGRESS] Сканирование завершено. Найдено устройств: {len(devices)}", file=sys.stderr)
        except Exception as e:
            # Игнорируем ошибки сканирования подсети
            print(f"[ERROR] Ошибка сканирования подсети {subnet}: {e}", file=sys.stderr)
        
        return devices


def main():
    parser = argparse.ArgumentParser(description='Сканирование сети')
    parser.add_argument('--subnet', type=str, help='Подсеть в формате CIDR (например, 192.168.1.0/24)')
    parser.add_argument('--start-ip', type=str, help='Начальный IP адрес')
    parser.add_argument('--end-ip', type=str, help='Конечный IP адрес')
    parser.add_argument('--single-ip', type=str, help='Один IP адрес для сканирования')
    parser.add_argument('--domain-user', type=str, help='Пользователь домена')
    parser.add_argument('--domain-password', type=str, help='Пароль пользователя домена')
    parser.add_argument('--domain-server', type=str, help='Сервер домена (IP или FQDN)')
    
    args = parser.parse_args()
    
    scanner = NetworkScanner(
        domain_user=args.domain_user,
        domain_password=args.domain_password,
        domain_server=args.domain_server
    )
    
    devices = []
    
    if args.subnet:
        devices = scanner.scan_subnet(args.subnet)
    elif args.start_ip and args.end_ip:
        devices = scanner.scan_range(args.start_ip, args.end_ip)
    elif args.single_ip:
        device = scanner.scan_ip(args.single_ip)
        if device.is_alive:
            devices = [device]
    else:
        print("Необходимо указать --subnet, --start-ip и --end-ip, или --single-ip", file=sys.stderr)
        sys.exit(1)
    
    # Выводим результат в формате JSON
    result = [asdict(device) for device in devices]
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()

