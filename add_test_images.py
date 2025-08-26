# This script will be used to add test images to the database.
import os
import sys

# Add the app directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import create_app, db
from app.models import Image, Folder

def main():
    """Main function to add all pictograms to the database."""
    app = create_app()
    with app.app_context():
        print("Clearing existing public images and folders...")
        Image.query.filter_by(is_public=True).delete()
        # Be careful with this if users can have public folders
        Folder.query.filter(Folder.user_id.is_(None)).delete()
        db.session.commit()

        print("Scanning for pictograms and adding them to the database...")

        # The root of pictograms in the source code
        source_pictograms_path = os.path.join('app', 'static', 'images', 'pictograms')

        # The root from which we start scanning
        scan_root = os.path.join(source_pictograms_path, 'public')

        # Dictionary to store the relationship between physical path and folder id
        path_to_folder_id = {}

        # First pass: create all folders
        for root, dirs, _ in os.walk(scan_root):
            parent_physical_path = os.path.dirname(root)
            parent_id = path_to_folder_id.get(parent_physical_path)

            # The path stored in the DB must be relative to the *pictograms* root folder
            relative_path = os.path.relpath(root, source_pictograms_path)

            folder = Folder(
                name=os.path.basename(root),
                path=relative_path.replace('\\', '/'),
                user_id=None,
                parent_id=parent_id
            )
            db.session.add(folder)
            db.session.commit() # Commit to get the ID
            path_to_folder_id[root] = folder.id

        print(f"Created {len(path_to_folder_id)} folders.")

        # Second pass: create all images
        images_added = 0
        for root, _, files in os.walk(scan_root):
            folder_id = path_to_folder_id.get(root)
            if not folder_id:
                print(f"Warning: Could not find folder ID for path {root}")
                continue

            for file in files:
                if file.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                    # The path stored in the DB must be relative to the *pictograms* root folder
                    relative_path = os.path.relpath(os.path.join(root, file), source_pictograms_path)
                    name = file
                    description = f"Public pictogram: {name}"

                    image = Image(
                        path=relative_path.replace('\\', '/'),
                        name=name,
                        description=description,
                        is_public=True,
                        user_id=None,
                        folder_id=folder_id
                    )
                    db.session.add(image)
                    images_added += 1

        db.session.commit()
        print(f"Scan complete. Added: {images_added} images.")

if __name__ == '__main__':
    main()
