# This script will be used to add test images to the database.
import os
import sys

# Add the app directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import create_app, db
from app.models import Image

def main():
    """Main function to add all pictograms to the database."""
    app = create_app()
    with app.app_context():
        print("Scanning for pictograms and adding them to the database...")

        pictograms_path = os.path.join('app', 'static', 'images', 'pictograms')
        images_added = 0
        images_skipped = 0

        for root, _, files in os.walk(pictograms_path):
            for file in files:
                if file.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                    image_path = os.path.join(root, file).replace('\\', '/')

                    if Image.query.filter_by(path=image_path).first():
                        images_skipped += 1
                        continue

                    name = os.path.splitext(file)[0]
                    category = os.path.basename(root)
                    description = f"Pictogramme de la catégorie '{category}' représentant '{name}'."

                    image = Image(
                        path=image_path,
                        name=name,
                        description=description,
                        is_public=(False, True)[image_path.startswith('app/static/images/pictograms/public')],
                        user_id=None
                    )
                    db.session.add(image)
                    images_added += 1

        db.session.commit()
        print(f"Scan complete. Added: {images_added}, Skipped (already exist): {images_skipped}")

if __name__ == '__main__':
    main()
