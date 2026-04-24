import os

translations = {
    'fr': {
        'about': 'Ce projet est open source et fièrement hébergé sur GitHub. Vous êtes libre de consulter le code source, d\'y contribuer ou de le réutiliser selon les termes de la licence GNU AGPL v3.',
        'license_title': '7. Licence',
        'license_desc': 'Ce logiciel est open source et sous licence GNU AGPL v3.'
    },
    'de': {
        'about': 'Dieses Projekt ist Open Source und wird stolz auf GitHub gehostet. Es steht Ihnen frei, den Quellcode einzusehen, beizutragen oder ihn gemäß den Bedingungen der GNU AGPL v3-Lizenz weiterzuverwenden.',
        'license_title': '7. Lizenz',
        'license_desc': 'Diese Software ist Open Source und unter der GNU AGPL v3 lizenziert.'
    },
    'es': {
        'about': 'Este proyecto es de código abierto y está orgullosamente alojado en GitHub. Eres libre de ver el código fuente, contribuir o reutilizarlo bajo los términos de la licencia GNU AGPL v3.',
        'license_title': '7. Licencia',
        'license_desc': 'Este software es de código abierto y tiene licencia GNU AGPL v3.'
    },
    'it': {
        'about': 'Questo progetto è open source e orgogliosamente ospitato su GitHub. Sei libero di visualizzare il codice sorgente, contribuire o riutilizzarlo secondo i termini della licenza GNU AGPL v3.',
        'license_title': '7. Licenza',
        'license_desc': 'Questo software è open source e concesso in licenza con la GNU AGPL v3.'
    },
    'nl': {
        'about': 'Dit project is open source en wordt met trots gehost op GitHub. Je bent vrij om de broncode te bekijken, bij te dragen of deze te hergebruiken onder de voorwaarden van de GNU AGPL v3-licentie.',
        'license_title': '7. Licentie',
        'license_desc': 'Deze software is open source en gelicentieerd onder de GNU AGPL v3.'
    },
    'pl': {
        'about': 'Ten projekt jest open source i jest dumnie hostowany na GitHub. Możesz swobodnie przeglądać kod źródłowy, wnosić wkład lub używać go ponownie zgodnie z warunkami licencji GNU AGPL v3.',
        'license_title': '7. Licencja',
        'license_desc': 'To oprogramowanie jest typu open source i jest licencjonowane na podstawie GNU AGPL v3.'
    }
}

for lang, texts in translations.items():
    po_path = f'app/translations/{lang}/LC_MESSAGES/messages.po'
    if not os.path.exists(po_path): 
        print(f"Skipping {lang}, file not found.")
        continue
    
    with open(po_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    skip_msgstr = False
    for i, line in enumerate(lines):
        # Supprimer le flag fuzzy si la ligne suivante est notre msgid
        if '#, fuzzy' in line:
            next_line = lines[i+1] if i+1 < len(lines) else ""
            if 'msgid "This project is open source' in next_line or \
               'msgid "7. License"' in next_line or \
               'msgid "This software is open source' in next_line:
                continue
            
        if 'msgid "This project is open source' in line:
            new_lines.append(line)
            new_lines.append(f'msgstr "{texts["about"]}"\n')
            skip_msgstr = True
        elif 'msgid "7. License"' in line:
            new_lines.append(line)
            new_lines.append(f'msgstr "{texts["license_title"]}"\n')
            skip_msgstr = True
        elif 'msgid "This software is open source and licensed under the GNU AGPL v3."' in line:
            new_lines.append(line)
            new_lines.append(f'msgstr "{texts["license_desc"]}"\n')
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
    print(f"Updated {lang} successfully.")
