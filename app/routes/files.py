import os
from pathlib import Path
from urllib.parse import quote

from flask import Blueprint, current_app, send_from_directory
from flask_login import current_user

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


@bp.route('/pictograms/<img_id>')
def serve_pictogram(img_id):
    """Serves a pictogram from the external data directory by its database ID."""
    try:
        image = db.session.get(Image, int(img_id))
    except (ValueError, TypeError):
        return send_from_directory(current_app.static_folder, 'images/prohibit-bold.png')
        
    if image is None:
        return send_from_directory(current_app.static_folder, 'images/prohibit-bold.png')
        
    if image.user_id is not None and (not current_user.is_authenticated or image.user_id != current_user.id):
        return send_from_directory(current_app.static_folder, 'images/prohibit-bold.png')
            
    pictograms_path = Path(current_app.config['PICTOGRAMS_PATH'])
    response = send_from_directory(pictograms_path, image.path)
    response.headers['X-Image-Description'] = quote(image.description or '')
    response.headers['X-Image-Name'] = quote(image.name or '')
    response.headers['X-Image-Hash'] = image.image_hash or ''
    response.headers['X-Image-Updated-At'] = image.updated_at.isoformat() if image.updated_at else ''
    response.headers['X-Image-Id'] = str(image.id)
    return response


@bp.route('/pictogramsmin/<img_id>')
def serve_pictogram_min(img_id):
    """Serves a pictogram thumbnail from the external data directory by its database ID."""
    try:
        image = db.session.get(Image, int(img_id))
    except (ValueError, TypeError):
        return send_from_directory(current_app.static_folder, 'images/prohibit-bold.png')
        
    if image is None:
        return send_from_directory(current_app.static_folder, 'images/prohibit-bold.png')
        
    if image.user_id is not None and (not current_user.is_authenticated or image.user_id != current_user.id):
        return send_from_directory(current_app.static_folder, 'images/prohibit-bold.png')
            
    filepath_min, _ = os.path.splitext(image.path)
    filepath_min = filepath_min + ".png"
    pictograms_path = Path(current_app.config['PICTOGRAMS_PATH_MIN'])
    response = send_from_directory(pictograms_path, filepath_min)
    response.headers['X-Image-Description'] = quote(image.description or '')
    response.headers['X-Image-Name'] = quote(image.name or '')
    response.headers['X-Image-Hash'] = image.image_hash or ''
    response.headers['X-Image-Updated-At'] = image.updated_at.isoformat() if image.updated_at else ''
    response.headers['X-Image-Id'] = str(image.id)
    return response
