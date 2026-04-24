import os

date_translations = {
    'fr': '25 avril 2026',
    'de': '25. April 2026',
    'es': '25 de abril de 2026',
    'it': '25 aprile 2026',
    'nl': '25 april 2026',
    'pl': '25 kwietnia 2026'
}

for lang, date_str in date_translations.items():
    po_path = f'app/translations/{lang}/LC_MESSAGES/messages.po'
    if not os.path.exists(po_path): continue
    
    with open(po_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    skip_msgstr = False
    for i, line in enumerate(lines):
        if 'msgid "April 25, 2026"' in line:
            new_lines.append(line)
            new_lines.append(f'msgstr "{date_str}"\n')
            skip_msgstr = True
        elif skip_msgstr:
            if line.startswith('msgstr') or line.startswith('"'):
                continue
            else:
                skip_msgstr = False
                new_lines.append(line)
        else:
            new_lines.append(line)

    with open(po_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print(f"Updated date for {lang}")
