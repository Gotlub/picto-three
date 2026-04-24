import re
import os
import textwrap

translations = {
    "PictoTree AAC Platform": {
        "de": "PictoTree AAC-Plattform",
        "es": "Plataforma PictoTree CAA",
        "it": "Piattaforma PictoTree CAA",
        "nl": "PictoTree OC-platform",
        "pl": "Platforma AAC PictoTree"
    },
    "PictoTree is a comprehensive platform (Web Backend + Native Mobile App) designed for Augmentative and Alternative Communication (AAC). Our goal is to empower users—caregivers, speech therapists, and parents—to create, manage, and display personalized communication 'trees' using pictograms (leveraging the open-source ARASAAC library or personal imports). Currently under development, the system is hosted in production and accessible at pictotree.eu.": {
        "de": "PictoTree ist eine umfassende Plattform (Web-Backend + Native Mobile App), die für Unterstützte Kommunikation (UK) entwickelt wurde. Unser Ziel ist es, Nutzer – Betreuer, Logopäden und Eltern – zu befähigen, personalisierte Kommunikations-„Bäume“ mithilfe von Piktogrammen (unter Nutzung der Open-Source-ARASAAC-Bibliothek oder eigener Importe) zu erstellen, zu verwalten und anzuzeigen. Das System befindet sich derzeit in der Entwicklung, wird in der Produktion gehostet und ist unter pictotree.eu erreichbar.",
        "es": "PictoTree es una plataforma integral (Backend Web + App Móvil Nativa) diseñada para la Comunicación Aumentativa y Alternativa (CAA). Nuestro objetivo es capacitar a los usuarios (cuidadores, logopedas y padres) para crear, gestionar y mostrar 'árboles' de comunicación personalizados utilizando pictogramas (aprovechando la biblioteca de código abierto ARASAAC o importaciones personales). Actualmente en desarrollo, el sistema está alojado en producción y es accesible en pictotree.eu.",
        "it": "PictoTree è una piattaforma completa (Backend Web + App Mobile Nativa) progettata per la Comunicazione Aumentativa e Alternativa (CAA). Il nostro obiettivo è consentire agli utenti (caregiver, logopedisti e genitori) di creare, gestire e visualizzare 'alberi' di comunicazione personalizzati utilizzando i pittogrammi (sfruttando la libreria open source ARASAAC o importazioni personali). Attualmente in fase di sviluppo, il sistema è ospitato in produzione e accessibile su pictotree.eu.",
        "nl": "PictoTree is een veelzijdig platform (Web Backend + Native Mobiele App) ontworpen voor Ondersteunde Communicatie (OC). Ons doel is om gebruikers — zorgverleners, logopedisten en ouders — in staat te stellen gepersonaliseerde communicatie-'bomen' te maken, te beheren en weer te geven met behulp van pictogrammen (gebruikmakend van de open-source ARASAAC-bibliotheek of persoonlijke importen). Het systeem is momenteel in ontwikkeling, wordt in productie gehost en is toegankelijk op pictotree.eu.",
        "pl": "PictoTree to kompleksowa platforma (backend internetowy + natywna aplikacja mobilna) zaprojektowana do komunikacji wspomagającej i alternatywnej (AAC). Naszym celem jest umożliwienie użytkownikom — opiekunom, logopedom i rodzicom — tworzenia, zarządzania i wyświetlania spersonalizowanych „drzew” komunikacyjnych przy użyciu piktogramów (korzystając z biblioteki open-source ARASAAC lub własnych obrazów). System jest obecnie w fazie rozwoju, znajduje się na serwerze produkcyjnym i jest dostępny pod adresem pictotree.eu."
    },
    "Login / Register": {
        "de": "Anmelden / Registrieren",
        "es": "Iniciar sesión / Registrarse",
        "it": "Accedi / Registrati",
        "nl": "Inloggen / Registreren",
        "pl": "Zaloguj / Zarejestruj"
    },
    "1. The Tree Builder (Web)": {
        "de": "1. Der Baum-Editor (Web)",
        "es": "1. El Constructor de Árboles (Web)",
        "it": "1. Il Costruttore di Alberi (Web)",
        "nl": "1. De Tree Builder (Web)",
        "pl": "1. Kreator Drzew (Web)"
    },
    "Construct and organize your communication structures using a hierarchical interface. Drag and drop pictograms to build logical paths tailored to the user's specific needs. Once saved, these trees can be easily imported into the mobile application.": {
        "de": "Konstruieren und organisieren Sie Ihre Kommunikationsstrukturen über eine hierarchische Benutzeroberfläche. Ziehen Sie Piktogramme per Drag-and-Drop, um logische Pfade zu erstellen, die auf die spezifischen Bedürfnisse des Nutzers zugeschnitten sind. Einmal gespeichert, können diese Bäume einfach in die mobile Anwendung importiert werden.",
        "es": "Construya y organice sus estructuras de comunicación utilizando una interfaz jerárquica. Arrastre y suelte pictogramas para construir rutas lógicas adaptadas a las necesidades específicas del usuario. Una vez guardados, estos árboles pueden importarse fácilmente en la aplicación móvil.",
        "it": "Costruisci e organizza le tue strutture di comunicazione utilizzando un'interfaccia gerarchica. Trascina e rilascia i pittogrammi per costruire percorsi logici adattati alle esigenze specifiche dell'utente. Una volta salvati, questi alberi possono essere facilmente importati nell'applicazione mobile.",
        "nl": "Bouw en organiseer uw communicatiestructuren met behulp van een hiërarchische interface. Sleep pictogrammen om logische paden te bouwen die zijn afgestemd op de specifieke behoeften van de gebruiker. Eenmaal opgeslagen, kunnen deze bomen eenvoudig in de mobiele aplikatie worden geïmporteerd.",
        "pl": "Buduj i organizuj swoje struktury komunikacyjne za pomocą hierarchicznego interfejsu. Przeciągaj i upuszczaj piktogramy, aby tworzyć logiczne ścieżki dostosowane do specyficznych potrzeb użytkownika. Po zapisaniu drzewa te można łatwo zaimportować do aplikacji mobilnej."
    },
    "2. PictoTree Mobile App (Android)": {
        "de": "2. PictoTree Mobile App (Android)",
        "es": "2. Aplicación Móvil PictoTree (Android)",
        "it": "2. App Mobile PictoTree (Android)",
        "nl": "2. PictoTree Mobiele App (Android)",
        "pl": "2. Aplikacja mobilna PictoTree (Android)"
    },
    "The native mobile application uses a spatial navigation system (View 4) to browse through imported trees. It includes integrated Text-to-Speech (TTS) for vocal feedback and works fully offline to ensure communication is always available.": {
        "de": "Die native mobile Anwendung nutzt ein räumliches Navigationssystem (Ansicht 4), um durch importierte Bäume zu blättern. Sie verfügt über eine integrierte Text-zu-Sprache-Funktion (TTS) für akustisches Feedback und arbeitet vollständig offline, um sicherzustellen, dass die Kommunikation jederzeit möglich ist.",
        "es": "La aplicación móvil nativa utiliza un sistema de navegación espacial (Vista 4) para navegar a través de los árboles importados. Incluye síntesis de voz (TTS) integrada para retroalimentación vocal y funciona completamente fuera de línea para garantizar que la comunicación esté siempre disponible.",
        "it": "L'applicazione mobile nativa utilizza un sistema di navigazione spaziale (Vista 4) per sfogliare gli alberi importati. Include la sintesi vocale (TTS) integrata per il feedback vocale e funziona completamente offline per garantire che la comunicazione sia sempre disponibile.",
        "nl": "De native mobiele applicatie maakt gebruik van een ruimtelijk navigatiesysteem (View 4) om door geïmporteerde bomen te bladeren. Het bevat geïntegreerde Text-to-Speech (TTS) voor vocale feedback und werkt volledig offline om ervoor te zorgen dat communicatie altijd beschikbaar is.",
        "pl": "Natywna aplikacja mobilna wykorzystuje system nawigacji przestrzennej (Widok 4) do przeglądania zaimportowanych drzew. Zawiera zintegrowany syntezator mowy (TTS) dla informacji głosowych i działa w pełni offline, aby zapewnić stały dostęp do komunikacji."
    },
    "3. Pictogram Bank (Management)": {
        "de": "3. Piktogramm-Datenbank (Verwaltung)",
        "es": "3. Banco de Pictogramas (Gestión)",
        "it": "3. Banca dei Pittogrammi (Gestione)",
        "nl": "3. Pictogrammenbank (Beheer)",
        "pl": "3. Bank piktogramów (Zarządzanie)"
    },
    "Centralize your visual vocabulary. Search and import icons from the ARASAAC database or upload your own personal images. Organize them into folders to keep your library structured and ready for use in your trees or lists.": {
        "de": "Zentralisieren Sie Ihr visuelles Vokabular. Suchen und importieren Sie Symbole aus der ARASAAC-Datenbank oder laden Sie Ihre eigenen persönlichen Bilder hoch. Organisieren Sie diese in Ordnern, um Ihre Bibliothek strukturiert und bereit für den Einsatz in Ihren Bäumen oder Listen zu halten.",
        "es": "Centralice su vocabulario visual. Busque e importe iconos de la base de datos ARASAAC o suba sus propias imágenes personales. Organícelos en carpetas para mantener su biblioteca estructurada y lista para usar en sus árboles o listas.",
        "it": "Centralizza il tuo vocabolario visivo. Cerca e importa icone dal database ARASAAC o carica le tue immagini personali. Organizzale in cartelle per mantenere la tua libreria strutturata e pronta per l'uso nei tuoi alberi o liste.",
        "nl": "Centraliseer uw visuele woordenschat. Zoek en importeer iconen uit de ARASAAC-database of upload uw eigen persoonlijke afbeeldingen. Organiseer ze in mappen om uw bibliotheek gestructureerd en klaar voor gebruik in uw bomen of lijsten te houden.",
        "pl": "Centralizuj swoje słownictwo wizualne. Wyszukuj i importuj ikony z bazy danych ARASAAC lub przesyłaj własne zdjęcia. Organizuj je w folderach, aby Twoja biblioteka była uporządkowana i gotowa do użycia w drzewach lub listach."
    },
    "4. List & Print Tool (Paper Support)": {
        "de": "4. Listen- & Druckwerkzeug (Papierunterstützung)",
        "es": "4. Herramienta de Lista e Impresión (Soporte en Papel)",
        "it": "4. Strumento Lista e Stampa (Supporto Cartaceo)",
        "nl": "4. Lijst- & Printtool (Papieren ondersteuning)",
        "pl": "4. Narzędzie do list i drukowania (Wsparcie papierowe)"
    },
    "Generate customizable pictogram lists designed for printing. This tool provides various layout options to create physical communication boards, schedules, or educational materials directly from your digital collection.": {
        "de": "Erstellen Sie anpassbare Piktogrammlisten für den Druck. Dieses Tool bietet verschiedene Layout-Optionen zur Erstellung physischer Kommunikationstafeln, Zeitpläne oder Lernmaterialien direkt aus Ihrer digitalen Sammlung.",
        "es": "Genere listas de pictogramas personalizables diseñadas para imprimir. Esta herramienta ofrece varias opciones de diseño para crear tableros de comunicación físicos, horarios o materiales educativos directamente desde su colección digital.",
        "it": "Genera elenchi di pittogrammi personalizzabili progettati per la stampa. Questo strumento fornisce varie opzioni di layout per creare tabelle di komunikazione fisiche, programmi o materiali didattici direttamente dalla tua collezione digitale.",
        "nl": "Genereer aanpasbare pictogrammenlijsten ontworpen om te printen. Deze tool biedt verschillende lay-outopties om fysieke communicatieborden, schema's of educatief materiaal rechtstreeks uit uw digitale collectie te maken.",
        "pl": "Generuj konfigurowalne listy piktogramów przeznaczone do druku. Narzędzie to zapewnia różne opcje układu do tworzenia fizycznych tablic komunikacyjnych, harmonogramów lub materiałów edukacyjnych bezpośrednio z Twojej cyfrowej kolekcji."
    }
}

langs = ["de", "es", "it", "nl", "pl"]

def format_msgstr(text):
    if len(text) < 70:
        return f'msgstr "{text}"'
    
    # Use textwrap to wrap text while preserving spaces
    wrapped = textwrap.wrap(text, width=70, break_long_words=False, replace_whitespace=False, drop_whitespace=False)
    result = 'msgstr ""\n'
    for line in wrapped:
        # Escape quotes in the line
        escaped_line = line.replace('"', '\\"')
        result += f'"{escaped_line}"\n'
    return result.strip()

for lang in langs:
    file_path = f"D:/picto/picto-three/app/translations/{lang}/LC_MESSAGES/messages.po"
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        continue
    
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Split content by blocks (separated by empty line)
    blocks = re.split(r'\n\s*\n', content)
    new_blocks = []
    
    for block in blocks:
        updated = False
        for msgid, trans_dict in translations.items():
            # Check if this block contains the msgid
            # Reconstruct msgid from block for comparison
            msgid_match = re.search(r'msgid "(.*?)"(?:\n"(.*?)")*', block, re.DOTALL)
            if msgid_match:
                # Reconstruct msgid accurately
                parts = re.findall(r'msgid "(.*?)"|(?<=\n)"(.*?)"', block)
                extracted_msgid = "".join([p[0] or p[1] for p in parts]).replace('\\"', '"')
                
                if extracted_msgid == msgid:
                    # Found it!
                    # Remove fuzzy comment
                    block = re.sub(r'^#, fuzzy.*\n', '', block, flags=re.MULTILINE)
                    
                    # Replace msgstr
                    trans = trans_dict[lang]
                    formatted_msgstr = format_msgstr(trans)
                    
                    # Replace everything from msgstr onwards in this block
                    block = re.sub(r'msgstr "(?:.|\n)*$', formatted_msgstr, block)
                    updated = True
                    break
        new_blocks.append(block)
    
    final_content = "\n\n".join(new_blocks)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(final_content)
    print(f"Correctly updated {file_path}")
