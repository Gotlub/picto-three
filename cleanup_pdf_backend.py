import os
import re

# 1. Delete standalone PDF tests
for f in [r'd:\picto\picto-three\tests\test_pdf_export_remote.py', r'd:\picto\picto-three\tests\test_export_padding.py']:
    if os.path.exists(f):
        os.remove(f)

# 2. Remove /api/export_pdf from api.py
with open(r'd:\picto\picto-three\app\routes\api.py', 'r', encoding='utf-8') as f:
    api_content = f.read()
api_content = re.sub(r"@bp\.route\('/export_pdf', methods=\['POST'\]\).*?(?=@bp\.route|\Z)", "", api_content, flags=re.DOTALL)
with open(r'd:\picto\picto-three\app\routes\api.py', 'w', encoding='utf-8') as f:
    f.write(api_content)

# 3. Remove test_export_pdf from test_api.py
with open(r'd:\picto\picto-three\tests\test_api.py', 'r', encoding='utf-8') as f:
    test_cont = f.read()
test_cont = re.sub(r"def test_export_pdf\(client\):.*?(?=def test_|\Z)", "", test_cont, flags=re.DOTALL)
with open(r'd:\picto\picto-three\tests\test_api.py', 'w', encoding='utf-8') as f:
    f.write(test_cont)
    
print("Cleanups done.")
