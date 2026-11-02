import os
import urllib.request
import json

env = {}
with open('.env', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and '=' in line:
            k, v = line.split('=', 1)
            env[k] = v

url = f"{env['VITE_SUPABASE_URL']}/rest/v1/app_settings?id=eq.1"
headers = {
    'apikey': env['VITE_SUPABASE_ANON_KEY'],
    'Authorization': f"Bearer {env['VITE_SUPABASE_ANON_KEY']}"
}

req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        print(response.status)
        print(json.loads(response.read().decode()))
except urllib.error.HTTPError as e:
    print(e.code)
    print(e.read().decode())
