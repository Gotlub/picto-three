"""
Script de création d'utilisateur manuel pour PictoTree.
Ce script contourne l'envoi d'e-mail SMTP en forçant `confirmed = True` directement en BDD.
Il déclenche également la création du dossier racine de l'utilisateur.

Utilisation : 
1. Place-toi à la racine du projet backend (`D:\\picto\\picto-three`)
2. Exécute : `python create_admin.py`
"""

import sys
from app import create_app, db
from app.models import User, Folder
from datetime import datetime, UTC

# Initialisation de l'application Flask pour avoir le contexte de la BDD
app = create_app()

def create_admin_user(username, email, password):
    with app.app_context():
        # Vérifier si l'utilisateur existe déjà
        existing_user = User.query.filter((User.username == username) | (User.email == email)).first()
        if existing_user:
            print(f"⚠️ L'utilisateur {username} ou l'email {email} existe déjà.")
            return

        # 1. Création de l'utilisateur (Confirmé de force)
        print(f"Création de l'utilisateur {username}...")
        user = User(
            username=username, 
            email=email, 
            confirmed=True, # Le "hack" pour bypass le SMTP
            confirmed_on=datetime.now(UTC)
        )
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()
        
        print(f"✅ Utilisateur {username} créé avec succès (ID: {user.id}).")

        # 2. Création de son dossier racine (Normalement géré à la confirmation)
        print(f"Création du dossier racine pour {username}...")
        root_folder = Folder(
            name=f"root_{username}", 
            user_id=user.id, 
            parent_id=None, 
            path=f"root_{username}"
        )
        db.session.add(root_folder)
        db.session.commit()
        
        # 3. Création du dossier physique sur le disque
        from flask import current_app
        import os
        
        # On récupère le chemin de base défini dans ta config Flask
        base_path = current_app.config.get('PICTOGRAMS_PATH', 'app/static/pictograms')
        user_folder_path = os.path.join(base_path, f"root_{username}")
        
        if not os.path.exists(user_folder_path):
            os.makedirs(user_folder_path)
            print(f"📁 Dossier physique créé : {user_folder_path}")

        print(f"✅ Dossier racine créé avec succès (ID: {root_folder.id}).")
        print("--------------------------------------------------")
        print("Tu peux maintenant te connecter avec :")
        print(f"- Pseudo : {username}")
        print(f"- Mot de passe : {password}")

if __name__ == "__main__":
    # Paramètres par défaut
    test_username = "admin_test"
    test_email = "admin@pictotree.local"
    test_password = "Password123!"

    print("=== Outil de Création de Compte Manuel ===")
    
    # Possibilité de passer des arguments en ligne de commande (optionnel)
    if len(sys.argv) == 4:
        test_username = sys.argv[1]
        test_email = sys.argv[2]
        test_password = sys.argv[3]
    
    create_admin_user(test_username, test_email, test_password)
