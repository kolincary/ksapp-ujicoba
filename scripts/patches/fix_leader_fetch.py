import sys

path = 'components/AdminDashboard.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the offending function calls
content = content.replace('fetchLeaderOrders();', '')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
