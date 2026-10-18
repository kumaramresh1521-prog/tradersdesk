import subprocess
import socket
import sys
import time

def is_port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1.0)
        return s.connect_ex(('127.0.0.1', port)) == 0

def start_server(name, cwd, port):
    if is_port_open(port):
        print(f"[OK] {name} is already running on port {port}.")
        return
    print(f"[..] Starting {name} (Port {port})...")
    subprocess.Popen([sys.executable, "-u", "server.py"], cwd=cwd, creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == 'win32' else 0)
    for _ in range(10):
        time.sleep(0.5)
        if is_port_open(port):
            print(f"[OK] {name} is now LIVE on port {port}!")
            return
    print(f"[WARN] {name} process started, waiting on port {port}...")

if __name__ == "__main__":
    start_server("TradersDesk (Main)", r"C:\Users\Admin\Desktop\app breadth 2", 8000)
    start_server("Kotak Algo Engine", r"C:\Users\Admin\Desktop\kotak-algo", 8001)
    print("\nAll servers checked. Ready!")
