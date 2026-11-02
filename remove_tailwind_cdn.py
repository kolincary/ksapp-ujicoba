import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove <script src="https://cdn.tailwindcss.com"></script>
content = re.sub(r'<script src="https://cdn\.tailwindcss\.com"></script>\s*', '', content)

# Remove the inline tailwind config script block
content = re.sub(r'<script>\s*tailwind\.config = \{.*?</script>\s*', '', content, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Tailwind CDN removed.")
