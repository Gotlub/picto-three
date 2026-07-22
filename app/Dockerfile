# Dockerfile pour la production (Flask + Gunicorn)
FROM python:3.11-slim

# Prévention des fichiers .pyc et activation de l'affichage en direct des logs Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_ENV=production

# Installation des dépendances système requises :
# - libmagic1 : requis par python-magic pour la vérification du type MIME des images
# - libpq-dev & build-essential : requis pour la compilation/liaison native de psycopg2/PostgreSQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
    libpq-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Création d'un utilisateur non-root pour des raisons de sécurité
RUN groupadd -g 1000 appgroup && \
    useradd -u 1000 -g appgroup -s /bin/bash -m appuser

# Définition du répertoire de travail
WORKDIR /app

# Copie et installation des dépendances Python (optimisation du cache des layers Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie du code source complet (image scellée sans bind mount)
COPY . .

# Création préalable des répertoires de stockage des pictogrammes et attribution des droits à appuser
RUN mkdir -p /app/app/static/pictograms /app/app/static/pictogramsmin && \
    chown -R appuser:appgroup /app

# Passage à l'utilisateur non-root
USER appuser

# Exposition du port web interne
EXPOSE 5000

# Commande de démarrage par défaut avec Gunicorn (3 workers adaptés aux 2 vCores du VPS)
# CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "3", "--threads", "2", "pictogram:app"]
CMD ["gunicorn", "--access-logfile", "-", "--bind", "0.0.0.0:5000", "--workers", "3", "--threads", "2", "pictogram:app"]