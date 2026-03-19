import re

files = [
    r'd:\picto\picto-three\tests\conftest.py',
    r'd:\picto\picto-three\tests\test_auth.py',
    r'd:\picto\picto-three\tests\test_api.py'
]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove the get_csrf_token function from conftest
    content = re.sub(r'def get_csrf_token\(html\):.*?(?=\ndef )', '', content, flags=re.DOTALL)
    
    # Remove imports of get_csrf_token
    content = re.sub(r',\s*get_csrf_token', '', content)
    content = re.sub(r'get_csrf_token,\s*', '', content)
    
    # Remove assignments of csrf_token
    content = re.sub(r'^\s*([a-zA-Z_]+_)?csrf_token([a-zA-Z_]+)?\s*=\s*get_csrf_token.*?\n', '', content, flags=re.MULTILINE)
    
    # Remove asserts on csrf_token
    content = re.sub(r'^\s*assert\s+([a-zA-Z_]+_)?csrf_token([a-zA-Z_]+)?\s+is\s+not\s+None.*?\n', '', content, flags=re.MULTILINE)
    
    # Remove csrf_token args in dictionaries
    content = re.sub(r',\s*\'csrf_token\':\s*([a-zA-Z_]+_)?csrf_token([a-zA-Z_]+)?', '', content)
    content = re.sub(r'\'csrf_token\':\s*([a-zA-Z_]+_)?csrf_token([a-zA-Z_]+)?,\s*', '', content)
    content = re.sub(r'\'csrf_token\':\s*([a-zA-Z_]+_)?csrf_token([a-zA-Z_]+)?', '', content)
    
    # Remove kwargs in dict(...)
    content = re.sub(r',\s*csrf_token\s*=\s*([a-zA-Z_]+_)?csrf_token([a-zA-Z_]+)?', '', content)
    content = re.sub(r'csrf_token\s*=\s*([a-zA-Z_]+_)?csrf_token([a-zA-Z_]+)?,\s*', '', content)
    content = re.sub(r'csrf_token\s*=\s*([a-zA-Z_]+_)?csrf_token([a-zA-Z_]+)?', '', content)

    # Note: For test_csrf_protection, maybe it just fails, we'll see next

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
print("Done cleaning!")
