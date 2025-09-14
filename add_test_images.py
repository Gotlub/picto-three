# add_test_images.py

import os
from pathlib import Path
from PIL import Image as PILImage # Renommer pour éviter le conflit avec notre modèle Image
from app import create_app, db
from app.models import Image, Folder

# --- Configuration des miniatures ---
THUMB_SIZE = (128, 128) # Taille maximale pour les miniatures

def create_thumbnail(filepath_relative, source_folder, thumbs_folder):
    """
    Génère une miniature pour une image donnée et la sauvegarde en JPEG.
    """
    try:
        source_path = source_folder / filepath_relative
        # Construire le chemin de la miniature en changeant l'extension en .jpeg
        thumb_path_relative = Path(filepath_relative).with_suffix('.jpeg')
        thumb_path_full = thumbs_folder / thumb_path_relative

        # S'assurer que le dossier parent de la miniature existe
        thumb_path_full.parent.mkdir(parents=True, exist_ok=True)

        with PILImage.open(source_path) as img:
            img.thumbnail(THUMB_SIZE)

            # Convertir en RGB pour assurer la compatibilité avec le format JPEG
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')

            # Sauvegarder la miniature avec optimisation
            img.save(thumb_path_full, 'JPEG', quality=85, optimize=True)
            # print(f"Miniature créée : {thumb_path_full}") # Décommenter pour le debug

    except (IOError, FileNotFoundError) as e:
        print(f"Erreur lors de la création de la miniature pour {filepath_relative} : {e}")

def main():
    app = create_app()
    with app.app_context():
        source_pictograms_path = Path(app.config['PICTOGRAMS_PATH'])
        thumbs_folder = Path(app.config['PICTOGRAMS_PATH_MIN']) # Nouveau chemin pour les miniatures
        scan_root = source_pictograms_path / 'public'

        if not scan_root.exists():
            print(f"Le dossier source {scan_root} n'existe pas. Arrêt du script.")
            return

        print("Début du scan et de l'ajout des pictogrammes publics...")

        # S'assurer que le dossier des miniatures existe
        thumbs_folder.mkdir(exist_ok=True)

        path_to_folder_id = {str(scan_root): None} # Le parent de la racine est None
        images_added = 0
        folders_added = 0

        # Parcourir les dossiers
        for root, dirs, files in os.walk(scan_root):
            root_path = Path(root)
            relative_path = root_path.relative_to(source_pictograms_path)
            normalized_path = relative_path.as_posix() # Utiliser des / comme séparateur

            # --- GESTION DES DOSSIERS (Évite les doublons) ---
            existing_folder = db.session.query(Folder).filter_by(path=normalized_path).first()

            if not existing_folder:
                parent_physical_path = str(root_path.parent)
                parent_id = path_to_folder_id.get(parent_physical_path)

                folder = Folder(
                    name=root_path.name,
                    path=normalized_path,
                    user_id=None, # Dossier public
                    parent_id=parent_id
                )
                db.session.add(folder)
                db.session.commit() # Commit pour obtenir l'ID
                folder_id = folder.id
                folders_added += 1
                print(f"Dossier ajouté : {normalized_path}")
            else:
                folder_id = existing_folder.id

            path_to_folder_id[str(root_path)] = folder_id

            # Parcourir les images dans le dossier courant
            for file in files:
                if file.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                    image_relative_path = relative_path / file
                    normalized_image_path = image_relative_path.as_posix()

                    # --- GESTION DES IMAGES (Évite les doublons) ---
                    existing_image = db.session.query(Image).filter_by(path=normalized_image_path).first()

                    thumb_path_relative = Path(normalized_image_path).with_suffix('.jpeg')
                    thumb_path_full = thumbs_folder / thumb_path_relative

                    if existing_image:
                        # L'image existe en BDD, on vérifie juste si la miniature existe physiquement
                        if not thumb_path_full.exists():
                            print(f"L'image '{normalized_image_path}' existe, mais sa miniature est manquante. Création...")
                            create_thumbnail(str(image_relative_path), source_pictograms_path, thumbs_folder)
                    else:
                        # L'image n'existe pas en BDD, on l'ajoute et on crée la miniature
                        image = Image(
                            path=normalized_image_path,
                            name=file,
                            description=f"Public pictogram: {file}",
                            is_public=True,
                            user_id=None,
                            folder_id=folder_id
                        )
                        db.session.add(image)
                        images_added += 1
                        print(f"Image ajoutée à la BDD : {normalized_image_path}")

                        # Création de la miniature
                        create_thumbnail(str(image_relative_path), source_pictograms_path, thumbs_folder)

        db.session.commit()
        print("-" * 20)
        print(f"Opération terminée.")
        print(f"{folders_added} nouveau(x) dossier(s) ajouté(s).")
        print(f"{images_added} nouvelle(s) image(s) ajoutée(s).")
        print("Les miniatures manquantes pour les images existantes ont été créées.")


if __name__ == '__main__':
    main()
