from flask import Blueprint, send_from_directory, current_app
from flask_login import current_user
from pathlib import Path
import os
from app import db
from app.models import Image

bp = Blueprint('files', __name__)

# This route will ensure that JS files are served with the correct MIME type.
@bp.route('/static/js/<path:filename>')
def serve_js(filename):
    return send_from_directory(
        os.path.join(current_app.root_path, 'static', 'js'),
        filename,
        mimetype='application/javascript'
    )


@bp.route('/pictograms/<path:filepath>')
def serve_pictogram(filepath):
    """Serves a pictogram from the external data directory."""
    pictograms_path = Path(current_app.config['PICTOGRAMS_PATH'])
    if filepath.startswith("public/"):
    # send_from_directory is security-conscious and will prevent path traversal attacks.
        return send_from_directory(pictograms_path, filepath)
    image = db.session.scalar(db.select(Image).filter_by(path=filepath))
    # 2. On vérifie si l'image existe ET qu'elle est public
    if image is None or (((current_user.is_authenticated and image.user_id != current_user.id) or not current_user.is_authenticated) and not image.is_public):
        # Si l'image n'existe pas ou n'appartient pas à l'utilisateur, on bloque.
        return send_from_directory(current_app.static_folder, 'images/prohibit-bold.png')
    return send_from_directory(pictograms_path, filepath)


@bp.route('/pictogramsmin/<path:filepath>')
def serve_pictogram_min(filepath):
    """Serves a pictogram from the external data directory."""
    pictograms_path = Path(current_app.config['PICTOGRAMS_PATH_MIN'])
    if filepath.startswith("public/"):
    # send_from_directory is security-conscious and will prevent path traversal attacks.
        return send_from_directory(pictograms_path, filepath)
    image = db.session.scalar(db.select(Image).filter_by(path=filepath))
    # 2. On vérifie si l'image existe ET qu'elle est public
    if image is None or (((current_user.is_authenticated and image.user_id != current_user.id) or not current_user.is_authenticated) and not image.is_public):
        # Si l'image n'existe pas ou n'appartient pas à l'utilisateur, on bloque.
        return send_from_directory(current_app.static_folder, 'images/prohibit-bold.png')
    pictograms_path_min, old_extension= os.path.splitext(filepath)
    pictograms_path_min = pictograms_path_min + ".png"
    return send_from_directory(pictograms_path, pictograms_path_min)
