import hashlib
import os
import re
import shutil
from datetime import UTC, datetime
from pathlib import Path

from flask import Blueprint, abort, current_app, json, jsonify, request
from flask_babel import _
from flask_login import current_user, login_required
from PIL import Image as PILImage
from sqlalchemy import or_
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.utils import secure_filename

from app import db
from app.models import (
    Folder,
    Image,
    PictogramList,
    PrintOption,
    Profile,
    ProfileTree,
    Tree,
    User,
)

bp = Blueprint('api', __name__, url_prefix='/api')

@bp.route('/trees/load', methods=['GET'])
def load_trees():
    user_trees = []
    current_user_id = None
    if current_user.is_authenticated:
        # Fetch all user-owned trees, ignoring the deprecated is_public flag
        user_trees = Tree.query.filter_by(user_id=current_user.id).order_by(Tree.name).all()
        current_user_id = current_user.id
    else:
        demo_user = User.query.filter_by(username=current_app.config.get('DEMO_USERNAME', 'demo')).first()
        if demo_user:
            user_trees = Tree.query.filter_by(user_id=demo_user.id).order_by(Tree.name).all()

    return jsonify({
        'user_trees': [tree.to_dict() for tree in user_trees],
        'current_user_id': current_user_id
    })


@bp.route('/lists', methods=['GET'])
def load_lists():
    user_lists = []
    current_user_id = None
    if current_user.is_authenticated:
        # Private lists are user-owned lists with is_public = False, ordered by name
        user_lists = PictogramList.query.filter_by(user_id=current_user.id, is_public=False).order_by(PictogramList.list_name).all()
        current_user_id = current_user.id
    else:
        demo_user = User.query.filter_by(username=current_app.config.get('DEMO_USERNAME', 'demo')).first()
        if demo_user:
            user_lists = PictogramList.query.filter_by(user_id=demo_user.id, is_public=False).order_by(PictogramList.list_name).all()

    # In to_dict(), the payload is already a string, but if it were an object, we'd need to handle it.
    # The current to_dict returns the payload as is, which is what we want.
    return jsonify({
        'user_lists': [lst.to_dict() for lst in user_lists],
        'current_user_id': current_user_id
    })

@bp.route('/lists', methods=['POST'])
@login_required
def save_list():
    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': _('Invalid data')}), 400

    list_name = data.get('list_name')
    is_public = data.get('is_public', False)
    payload = data.get('payload')

    if not list_name or payload is None:
        return jsonify({'status': 'error', 'message': _('Missing required fields: list_name and payload are required.')}), 400

    # Check if a list with the same name already exists for this user
    existing_list = PictogramList.query.filter_by(user_id=current_user.id, list_name=list_name).first()

    payload_str = json.dumps(payload) if isinstance(payload, (dict, list)) else payload

    if existing_list:
        # If it exists, update it
        existing_list.is_public = is_public
        existing_list.payload = payload_str
        message = _('List updated successfully')
        saved_list = existing_list
    else:
        # If it does not exist, create a new one
        new_list = PictogramList(
            user_id=current_user.id,
            list_name=list_name,
            is_public=is_public,
            payload=payload_str
        )
        db.session.add(new_list)
        message = _('List saved successfully')
        saved_list = new_list

    db.session.commit()

    return jsonify({
        'status': 'success',
        'message': message,
        'list': saved_list.to_dict()
    }), 201


@bp.route('/lists/<int:list_id>', methods=['PUT'])
@login_required
def update_list(list_id):
    plist = db.session.get(PictogramList, list_id)
    if plist is None:
        return jsonify({'status': 'error', 'message': _('List not found')}), 404
    if plist.user_id != current_user.id:
        return jsonify({'status': 'error', 'message': _('Unauthorized')}), 403

    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': _('Invalid data')}), 400

    plist.list_name = data.get('list_name', plist.list_name)
    if 'is_public' in data:
        plist.is_public = bool(data['is_public'])
    payload = data.get('payload')
    if payload is not None:
        plist.payload = json.dumps(payload)

    db.session.commit()

    return jsonify({
        'status': 'success',
        'message': _('List updated successfully'),
        'list': plist.to_dict()
    })

@bp.route('/lists/<int:list_id>', methods=['DELETE'])
@login_required
def delete_list(list_id):
    plist = db.session.get(PictogramList, list_id)
    if plist is None:
        return jsonify({'status': 'error', 'message': _('List not found')}), 404
    if plist.user_id != current_user.id:
        return jsonify({'status': 'error', 'message': _('Unauthorized')}), 403

    db.session.delete(plist)
    db.session.commit()

    return jsonify({'status': 'success', 'message': _('List deleted successfully')})


@bp.route('/print_options', methods=['GET'])
def get_print_options():
    current_user_id = None
    options = []
    if current_user.is_authenticated:
        options = PrintOption.query.filter(
            or_(PrintOption.user_id == current_user.id, PrintOption.is_public == True)
        ).order_by(PrintOption.name).all()
        current_user_id = current_user.id
    else:
        demo_user = User.query.filter_by(username=current_app.config.get('DEMO_USERNAME', 'demo')).first()
        if demo_user:
            options = PrintOption.query.filter_by(user_id=demo_user.id).order_by(PrintOption.name).all()
    return jsonify({
        'print_options': [opt.to_dict() for opt in options],
        'current_user_id': current_user_id
    })


@bp.route('/print_options', methods=['POST'])
@login_required
def save_print_option():
    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': _('Invalid data')}), 400

    name = data.get('name')
    is_public = data.get('is_public', False)
    payload = data.get('payload')

    if not name or payload is None:
        return jsonify({'status': 'error', 'message': _('Missing required fields: name and payload are required.')}), 400

    payload_str = json.dumps(payload) if isinstance(payload, (dict, list)) else str(payload)

    existing = PrintOption.query.filter_by(user_id=current_user.id, name=name).first()
    if existing:
        existing.is_public = is_public
        existing.payload = payload_str
        message = _('Print option updated successfully')
        saved_option = existing
    else:
        new_option = PrintOption(
            user_id=current_user.id,
            name=name,
            is_public=is_public,
            payload=payload_str
        )
        db.session.add(new_option)
        message = _('Print option saved successfully')
        saved_option = new_option

    db.session.commit()
    return jsonify({
        'status': 'success',
        'message': message,
        'print_option': saved_option.to_dict()
    }), 201


@bp.route('/print_options/<int:option_id>', methods=['DELETE'])
@login_required
def delete_print_option(option_id):
    opt = db.session.get(PrintOption, option_id)
    if opt is None:
        return jsonify({'status': 'error', 'message': _('Print option not found')}), 404
    if opt.user_id != current_user.id:
        return jsonify({'status': 'error', 'message': _('Unauthorized')}), 403

    db.session.delete(opt)
    db.session.commit()
    return jsonify({
        'status': 'success',
        'message': _('Print option deleted successfully')
    })


@bp.route('/folder/contents', methods=['GET'])
def get_folder_contents():
    parent_id = request.args.get('parent_id', type=int)
    if parent_id is None:
        return jsonify({'status': 'error', 'message': _('parent_id is required')}), 400

    parent_folder = db.session.get(Folder, parent_id)
    if not parent_folder:
        return jsonify({'status': 'error', 'message': _('Folder not found')}), 404

    # Security check: If the folder is not public, user must be logged in and own it
    if parent_folder.user_id is not None and (not current_user.is_authenticated or parent_folder.user_id != current_user.id):
        return jsonify({'status': 'error', 'message': _('Unauthorized')}), 403

    child_folders = [folder.to_dict() for folder in parent_folder.children.order_by(Folder.name).all()]
    child_images = [image.to_dict() for image in parent_folder.images.order_by(Image.name).all()]

    contents = child_folders + child_images

    return jsonify(contents)

def build_forest(folder):
    """
    Recursively builds a JSON-like structure for a folder and its contents.
    """
    # The to_dict(include_children=False) is important to avoid the old logic
    # of serializing children, and to get the 'has_children' flag if we wanted it.
    # Here, we just want the flat data for the folder itself.
    folder_data = folder.to_dict(include_children=False)

    # We don't need the 'has_children' flag in the new format,
    # as the presence of the 'children' array is explicit.
    folder_data.pop('has_children', None)

    folder_node = {
        'type': 'folder',
        'data': folder_data,
        'children': []
    }

    # Add child folders, sorted by name
    child_folders = folder.children.order_by(Folder.name).all()
    for child_folder in child_folders:
        child_node = build_forest(child_folder)
        if child_node:
            folder_node['children'].append(child_node)



    return folder_node

@bp.route('/load_tree_data')
def load_tree_data():
    """
    Loads the entire folder/image tree for the public space and the current user.
    """
    tree_roots = []

    # 1. Get public root folder
    public_root = Folder.query.filter_by(user_id=None, parent_id=None).first()
    if public_root:
        public_tree = build_forest(public_root)
        if public_tree:
            tree_roots.append(public_tree)

    # 2. Get user's root folder if authenticated
    if current_user.is_authenticated:
        user_root = Folder.query.filter_by(user_id=current_user.id, parent_id=None).first()
        if user_root:
            user_tree = build_forest(user_root)
            if user_tree:
                tree_roots.append(user_tree)
    return jsonify(tree_roots)

@bp.route('/folder_images/<int:folder_id>', methods=['GET'])
def folder_images(folder_id):
    folder = db.session.get(Folder, folder_id)
    if folder is None:
        abort(404)
    # Vérification des droits : dossier public ou appartenant à l'utilisateur
    if folder.user_id is not None and (not current_user.is_authenticated or folder.user_id != current_user.id):
        return jsonify({'error': 'Unauthorized'}), 403
            
    images = folder.images.order_by(Image.name).all()
    results = [{'type': 'image', 'data': img.to_dict()} for img in images]
    return jsonify(results)

@bp.route('/search_local_images')
def search_local_images():
    q = request.args.get('q', '').strip()
    mode = request.args.get('mode', 'smart').strip().lower()
    if len(q) < 1:
        return jsonify([])
        
    conditions = [
        Image.user_id.is_(None),
        Image.is_public.is_(True)
    ]
    if current_user.is_authenticated:
        conditions.append(Image.user_id == current_user.id)

    base_query = Image.query.filter(or_(*conditions))

    if mode == 'exact':
        filter_clause = or_(
            Image.name.ilike(q),
            Image.description.ilike(q)
        )
        images = base_query.filter(filter_clause).order_by(Image.name).limit(100).all()
    elif mode == 'starts':
        filter_clause = or_(
            Image.name.ilike(f'{q}%'),
            Image.description.ilike(f'{q}%')
        )
        images = base_query.filter(filter_clause).order_by(Image.name).limit(100).all()
    elif mode == 'contains':
        filter_clause = or_(
            Image.name.ilike(f'%{q}%'),
            Image.description.ilike(f'%{q}%')
        )
        images = base_query.filter(filter_clause).order_by(Image.name).limit(100).all()
    else:  # 'smart' / relevance
        filter_clause = or_(
            Image.name.ilike(f'%{q}%'),
            Image.description.ilike(f'%{q}%')
        )
        raw_images = base_query.filter(filter_clause).limit(150).all()
        q_lower = q.lower()

        def rank_image(img):
            name = (img.name or '').lower()
            desc = (img.description or '').lower()
            if name == q_lower or desc == q_lower:
                return (0, len(name), name)
            if name.startswith(q_lower) or desc.startswith(q_lower):
                return (1, len(name), name)
            if q_lower in name:
                return (2, len(name), name)
            return (3, len(desc), name)

        images = sorted(raw_images, key=rank_image)[:100]

    results = [{'type': 'image', 'data': img.to_dict()} for img in images]
    return jsonify(results)
@bp.route('/pictograms', methods=['GET'])
@login_required
def get_pictograms():
    root_folder = Folder.query.filter_by(user_id=current_user.id, parent_id=None).first()
    if not root_folder:
        return jsonify({'error': _('Root folder not found')}), 404

    return jsonify(root_folder.to_dict(include_children=True))

def check_user_quota():
    max_items = current_app.config.get('MAX_ITEMS_LIMIT', 5000)
    user_folders = Folder.query.filter_by(user_id=current_user.id).count()
    user_images = Image.query.filter_by(user_id=current_user.id).count()
    return (user_folders + user_images) < max_items

@bp.route('/folder/create', methods=['POST'])
@login_required
def create_folder():
    if not check_user_quota():
        return jsonify({'status': 'error', 'message': _('L\'espace de stockage maximal est atteint pour ce compte.')}), 429

    data = request.get_json()
    if not data or 'name' not in data or 'parent_id' not in data or not data.get('name').strip():
        return jsonify({'status': 'error', 'message': _('Invalid data')}), 400

    parent_id = data.get('parent_id')
    name = data.get('name').strip()

    # Validate folder name against directory traversal and invalid characters (DB column varchar(64))
    if not re.match(r'^[^\\/:\*\?"<>\|\x00-\x1f]+$', name) or name.startswith('.') or len(name) > 64:
        return jsonify({'status': 'error', 'message': _('Invalid folder name')}), 400

    parent_folder = db.session.get(Folder, parent_id)
    if not parent_folder or parent_folder.user_id != current_user.id:
        return jsonify({'status': 'error', 'message': _('Parent folder not found or not owned by user')}), 404

    # The parent path from DB is relative. Combine it with the base path for physical operations.
    base_path = Path(current_app.config['PICTOGRAMS_PATH']).resolve()
    parent_physical_path = (base_path / parent_folder.path).resolve()

    # Path traversal defense in depth: ensure new path stays within parent directory
    new_physical_path = (parent_physical_path / name).resolve()
    if not new_physical_path.is_relative_to(parent_physical_path) or not new_physical_path.is_relative_to(base_path):
        return jsonify({'status': 'error', 'message': _('Invalid folder name')}), 400

    # Create physical directory
    try:
        new_physical_path.mkdir(exist_ok=True)
    except OSError as e:
        current_app.logger.error(f"Could not create directory {new_physical_path}: {e}")
        return jsonify({'status': 'error', 'message': _('Could not create directory.')}), 500

    # The new path for the DB is also relative.
    new_relative_path = Path(parent_folder.path) / name

    # Create folder in DB
    new_folder = Folder(
        name=name,
        user_id=current_user.id,
        parent_id=parent_id,
        path=str(new_relative_path).replace('\\', '/')
    )
    db.session.add(new_folder)
    try:
        db.session.commit()
    except SQLAlchemyError as e:
        db.session.rollback()
        try:
            if new_physical_path.exists():
                shutil.rmtree(new_physical_path)
        except OSError:
            pass
        current_app.logger.error(f"DB error creating folder: {e}")
        return jsonify({'status': 'error', 'message': _('Could not create folder.')}), 500

    return jsonify({'status': 'success', 'folder': new_folder.to_dict(include_children=False)})

# --- Helper pour la création de miniatures ---
THUMB_SIZE = (300, 300)

def create_thumbnail_for_upload(filepath_relative):
    """Génère une miniature pour une image uploadée."""
    try:
        source_folder = Path(current_app.config['PICTOGRAMS_PATH'])
        thumbs_folder = Path(current_app.config['PICTOGRAMS_PATH_MIN'])

        source_path = source_folder / filepath_relative
        thumb_path_relative = Path(filepath_relative).with_suffix('.png')
        thumb_path_full = thumbs_folder / thumb_path_relative

        thumb_path_full.parent.mkdir(parents=True, exist_ok=True)

        with PILImage.open(source_path) as img:
            img.thumbnail(THUMB_SIZE)
            img.save(thumb_path_full, 'PNG', quality=85, optimize=True)

    except (OSError, ValueError) as e:
        current_app.logger.error(f"Erreur lors de la création de la miniature pour {filepath_relative}: {e}")

def calculate_image_hash(filepath_full, description):
    hasher = hashlib.sha256()
    try:
        with open(filepath_full, 'rb') as f:
            while chunk := f.read(8192):
                hasher.update(chunk)
    except FileNotFoundError:
        pass
    desc_str = description or ""
    hasher.update(desc_str.encode('utf-8'))
    return hasher.hexdigest()

@bp.route('/image/upload', methods=['POST'])
@login_required
def upload_image():
    if not check_user_quota():
        return jsonify({'status': 'error', 'message': _('L\'espace de stockage maximal est atteint pour ce compte.')}), 429

    if 'file' not in request.files:
        return jsonify({'status': 'error', 'message': _('No file part')}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'status': 'error', 'message': _('No selected file')}), 400

    folder_id = request.form.get('folder_id')
    if not folder_id:
        return jsonify({'status': 'error', 'message': _('No folder_id specified')}), 400

    folder = db.session.get(Folder, folder_id)
    if not folder or folder.user_id != current_user.id:
        return jsonify({'status': 'error', 'message': _('Folder not found or not owned by user')}), 404

    if file:
        filename = secure_filename(file.filename)
        if not filename or len(filename) > 64:
            return jsonify({'status': 'error', 'message': _('Nom de fichier invalide.')}), 400

        # Description validation (DB column varchar(256))
        description = request.form.get('description', '').strip()
        if not description:
            description = Path(filename).stem
        if len(description) > 256:
            return jsonify({'status': 'error', 'message': _('La description ne doit pas dépasser 256 caractères.')}), 400

        # The folder path from DB is relative. Combine it with the base path for physical operations.
        base_path = Path(current_app.config['PICTOGRAMS_PATH']).resolve()
        folder_physical_path = (base_path / folder.path).resolve()
        physical_path = (folder_physical_path / filename).resolve()

        if not physical_path.is_relative_to(folder_physical_path) or not physical_path.is_relative_to(base_path):
            return jsonify({'status': 'error', 'message': _('Chemin de fichier invalide.')}), 400

        # The new path for the DB is also relative.
        relative_path = Path(folder.path) / filename

        # Validate MIME and Extension
        allowed_mimetypes = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
        if file.mimetype not in allowed_mimetypes:
            return jsonify({'status': 'error', 'message': _('Format de fichier non autorisé.')}), 400

        # Check individual file size limit
        file.seek(0, os.SEEK_END)
        file_length = file.tell()
        file.seek(0)
        max_bytes = current_app.config.get('MAX_IMAGE_SIZE_KB', 2048) * 1024
        if file_length > max_bytes:
            return jsonify({'status': 'error', 'message': _('File size exceeds allowed limit.')}), 400

        # Deep magic-byte verification (Defense in depth vs Fake Extensions)
        try:
            pil_img = PILImage.open(file)
            pil_img.verify()
            file.seek(0) # Reset stream after reading
        except (OSError, SyntaxError, ValueError):
            return jsonify({'status': 'error', 'message': _('Fichier image invalide ou potentiellement malveillant.')}), 400

        try:
            file.save(physical_path)
        except OSError as e:
            current_app.logger.error(f"Error saving image {physical_path}: {e}")
            return jsonify({'status': 'error', 'message': _('Erreur lors de l\'enregistrement du fichier.')}), 500

        # Calculate hash
        try:
            image_hash = calculate_image_hash(physical_path, description)
        except (OSError, TypeError, ValueError) as e:
            current_app.logger.error(f"Error hashing image: {e}")
            image_hash = None

        new_image = Image(
            name=filename,
            path=str(relative_path).replace('\\', '/'),
            user_id=current_user.id,
            folder_id=folder.id,
            description=description,
            is_public=False,
            image_hash=image_hash,
            updated_at=datetime.now(UTC)
        )
        db.session.add(new_image)
        try:
            db.session.commit()
        except SQLAlchemyError as e:
            db.session.rollback()
            try:
                physical_path.unlink(missing_ok=True)
            except OSError:
                pass
            current_app.logger.error(f"Error committing uploaded image to DB: {e}")
            return jsonify({'status': 'error', 'message': _('Database error.')}), 500

        # --- AJOUTER L'APPEL POUR CRÉER LA MINIATURE ---
        try:
            create_thumbnail_for_upload(new_image.path)
        except (OSError, ValueError) as e:
            current_app.logger.error(f"Échec de la création de miniature pour {new_image.path}: {e}")
        # --- FIN DE L'AJOUT ---

        return jsonify({'status': 'success', 'image': new_image.to_dict()})

    return jsonify({'status': 'error', 'message': _('File upload failed')}), 500


@bp.route('/image/<int:image_id>', methods=['PUT'])
@login_required
def update_image_details(image_id):
    """
    Update an image's details, such as its description and public status.
    """
    image = db.session.get(Image, image_id)
    if not image:
        return jsonify({'status': 'error', 'message': _('Image not found')}), 404

    # Security check: Only the owner of the image can edit it.
    if image.user_id != current_user.id:
        return jsonify({'status': 'error', 'message': _('Unauthorized to edit this image')}), 403

    data = request.get_json()
    if data is None:
        return jsonify({'status': 'error', 'message': _('Invalid JSON data')}), 400

    # Update fields if they are present in the request payload
    if 'description' in data:
        desc = data['description']
        if desc is not None and len(str(desc)) > 256:
            return jsonify({'status': 'error', 'message': _('La description ne doit pas dépasser 256 caractères.')}), 400
        image.description = desc

    # is_public is forced to False for security - no public user images
    image.is_public = False

    # Recalculate hash and update modification time
    try:
        base_path = Path(current_app.config['PICTOGRAMS_PATH'])
        physical_path = base_path / image.path
        image.image_hash = calculate_image_hash(physical_path, image.description)
    except (OSError, TypeError, ValueError) as e:
        current_app.logger.error(f"Error rehashing image on update: {e}")
    image.updated_at = datetime.now(UTC)

    db.session.commit()

    return jsonify({
        'status': 'success',
        'message': _('Image updated successfully'),
        'image': image.to_dict()
    })


@bp.route('/image/<int:image_id>/replace', methods=['POST'])
@login_required
def replace_image_file(image_id):
    """
    Replace the physical image file of an existing image while preserving its ID.
    Updates the file content, regenerates thumbnail, recalculates hash and updated_at.
    """
    image = db.session.get(Image, image_id)
    if not image:
        return jsonify({'status': 'error', 'message': _('Image not found')}), 404

    if image.user_id != current_user.id:
        return jsonify({'status': 'error', 'message': _('Unauthorized to edit this image')}), 403

    if 'file' not in request.files:
        return jsonify({'status': 'error', 'message': _('No file part')}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'status': 'error', 'message': _('No selected file')}), 400

    filename = secure_filename(file.filename)
    if not filename or len(filename) > 64:
        return jsonify({'status': 'error', 'message': _('Nom de fichier invalide.')}), 400

    allowed_mimetypes = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
    if file.mimetype not in allowed_mimetypes:
        return jsonify({'status': 'error', 'message': _('Format de fichier non autorisé.')}), 400

    # Check individual file size limit
    file.seek(0, os.SEEK_END)
    file_length = file.tell()
    file.seek(0)
    max_bytes = current_app.config.get('MAX_IMAGE_SIZE_KB', 2048) * 1024
    if file_length > max_bytes:
        return jsonify({'status': 'error', 'message': _('File size exceeds allowed limit.')}), 400

    # Deep magic-byte verification
    try:
        pil_img = PILImage.open(file)
        pil_img.verify()
        file.seek(0)
    except (OSError, SyntaxError, ValueError):
        return jsonify({'status': 'error', 'message': _('Fichier image invalide ou potentiellement malveillant.')}), 400

    base_path = Path(current_app.config['PICTOGRAMS_PATH']).resolve()
    thumb_base = Path(current_app.config.get('PICTOGRAMS_PATH_MIN', current_app.config['PICTOGRAMS_PATH'])).resolve()

    old_physical_path = (base_path / image.path).resolve()
    old_thumb_path = (thumb_base / Path(image.path).with_suffix('.png')).resolve()

    folder_path = Path(image.path).parent
    folder_physical_path = (base_path / folder_path).resolve()
    new_physical_path = (folder_physical_path / filename).resolve()

    if not new_physical_path.is_relative_to(folder_physical_path) or not new_physical_path.is_relative_to(base_path):
        return jsonify({'status': 'error', 'message': _('Chemin de fichier invalide.')}), 400

    new_relative_path = str(folder_path / filename).replace('\\', '/')

    # If physical path changed (e.g. extension changed or different filename), remove old physical files
    if new_physical_path != old_physical_path and old_physical_path.exists():
        try:
            old_physical_path.unlink()
        except OSError as e:
            current_app.logger.warning(f"Failed to remove old image file {old_physical_path}: {e}")
        if old_thumb_path.exists():
            try:
                old_thumb_path.unlink()
            except OSError as e:
                current_app.logger.warning(f"Failed to remove old thumbnail {old_thumb_path}: {e}")

    try:
        new_physical_path.parent.mkdir(parents=True, exist_ok=True)
        file.save(new_physical_path)
    except OSError as e:
        current_app.logger.error(f"Error saving replaced image {new_physical_path}: {e}")
        return jsonify({'status': 'error', 'message': _('Erreur lors de l\'enregistrement du fichier.')}), 500

    image.name = filename
    image.path = new_relative_path
    image.updated_at = datetime.now(UTC)

    description = request.form.get('description')
    if description is not None and description.strip():
        desc_clean = description.strip()
        if len(desc_clean) > 256:
            return jsonify({'status': 'error', 'message': _('La description ne doit pas dépasser 256 caractères.')}), 400
        image.description = desc_clean

    try:
        image.image_hash = calculate_image_hash(new_physical_path, image.description)
    except (OSError, TypeError, ValueError) as e:
        current_app.logger.error(f"Error rehashing image on replace: {e}")

    # Regenerate thumbnail
    try:
        create_thumbnail_for_upload(image.path)
    except (OSError, ValueError) as e:
        current_app.logger.error(f"Failed to recreate thumbnail for {image.path}: {e}")

    try:
        db.session.commit()
    except SQLAlchemyError as e:
        db.session.rollback()
        current_app.logger.error(f"DB commit error on image replacement: {e}")
        return jsonify({'status': 'error', 'message': _('Database error.')}), 500

    return jsonify({
        'status': 'success',
        'message': _('Image replaced successfully'),
        'image': image.to_dict()
    })


@bp.route('/image/<int:image_id>/usage', methods=['GET'])
@login_required
def get_image_usage(image_id):
    """
    Returns the list of user-owned trees that contain this image.
    """
    image = db.session.get(Image, image_id)
    if not image:
        return jsonify({'status': 'error', 'message': _('Image not found')}), 404

    if image.user_id != current_user.id and not image.is_public:
        return jsonify({'status': 'error', 'message': _('Unauthorized')}), 403

    trees = Tree.query.filter_by(user_id=current_user.id).order_by(Tree.name).all()
    used_in_trees = []

    for tree in trees:
        if not tree.json_data:
            continue
        try:
            data = json.loads(tree.json_data)
            ids = get_image_ids_from_tree(data)
            if image_id in ids or tree.root_id == image_id:
                used_in_trees.append({
                    'id': tree.id,
                    'name': tree.name
                })
        except (json.JSONDecodeError, TypeError, ValueError):
            if f'"id": {image_id}' in tree.json_data or f'"id": "{image_id}"' in tree.json_data:
                used_in_trees.append({
                    'id': tree.id,
                    'name': tree.name
                })

    return jsonify({
        'status': 'success',
        'image_id': image_id,
        'count': len(used_in_trees),
        'trees': used_in_trees
    })


def get_image_ids_from_tree(nodes):
    """Recursively extracts all image IDs from a tree structure."""
    image_ids = set()
    if not isinstance(nodes, list):
        nodes = [nodes]
    for node in nodes:
        if not isinstance(node, dict):
            continue
        node_id = node.get('id')
        if node_id not in (None, -1, 'root', '-1'):
            try:
                image_ids.add(int(node_id))
            except (ValueError, TypeError):
                pass
        img_obj = node.get('image')
        if isinstance(img_obj, dict):
            img_id = img_obj.get('id')
            if img_id not in (None, -1, 'root', '-1'):
                try:
                    image_ids.add(int(img_id))
                except (ValueError, TypeError):
                    pass
        if node.get('children'):
            image_ids.update(get_image_ids_from_tree(node['children']))
    return image_ids


@bp.route('/tree/save', methods=['POST'])
@login_required
def save_tree():
    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': _('Invalid data')}), 400

    tree_name = data.get('name')
    is_public = False
    root_id = data.get('root_id', -1)
    root_url = data.get('root_url')
    json_data = data.get('json_data')

    if not tree_name or not json_data:
        return jsonify({'status': 'error', 'message': _('Missing required fields')}), 400

    # Check if a tree with the same name already exists for this user
    tree = Tree.query.filter_by(user_id=current_user.id, name=tree_name).first()

    if tree:
        # If it exists, update it
        tree.is_public = is_public
        tree.root_id = root_id
        tree.root_url = root_url
        tree.json_data = json.dumps(json_data)
        message = _('Tree updated successfully')
    else:
        # If it does not exist, create a new one
        tree = Tree(
            user_id=current_user.id,
            name=tree_name,
            is_public=is_public,
            root_id=root_id,
            root_url=root_url,
            json_data=json.dumps(json_data)
        )
        db.session.add(tree)
        message = _('Tree saved successfully')

    db.session.commit()

    return jsonify({
        'status': 'success',
        'message': message,
        'tree_id': tree.id,
        'tree_data': json_data
    })

@bp.route('/tree/<int:tree_id>', methods=['DELETE'])
@login_required
def delete_tree(tree_id):
    tree = db.session.get(Tree, tree_id)
    if tree is None:
        return jsonify({'status': 'error', 'message': _('Tree not found')}), 404
    if tree.user_id != current_user.id:
        return jsonify({'status': 'error', 'message': _('Unauthorized')}), 403

    # Delete references in ProfileTree association table
    db.session.execute(db.delete(ProfileTree).filter_by(tree_id=tree_id))

    db.session.delete(tree)
    db.session.commit()

    return jsonify({'status': 'success', 'message': _('Tree deleted successfully')})

@bp.route('/profiles/load', methods=['GET'])
def load_profiles():
    profiles = []
    if current_user.is_authenticated:
        profiles = Profile.query.filter_by(user_id=current_user.id).order_by(Profile.name).all()
    else:
        demo_user = User.query.filter_by(username=current_app.config.get('DEMO_USERNAME', 'demo')).first()
        if demo_user:
            profiles = Profile.query.filter_by(user_id=demo_user.id).order_by(Profile.name).all()

    profiles_data = []
    for profile in profiles:
        profile_dict = {
            'id': profile.id,
            'name': profile.name,
            'remote_avatar_url': profile.remote_avatar_url,
            'trees': []
        }
        # Order by display_order
        trees_assoc = sorted(profile.profile_trees, key=lambda x: x.display_order)
        for assoc in trees_assoc:
            if assoc.tree is None:
                continue
            tree_dict = assoc.tree.to_dict()
            tree_dict['colorCode'] = assoc.colorCode
            tree_dict['display_order'] = assoc.display_order
            profile_dict['trees'].append(tree_dict)
        profiles_data.append(profile_dict)
    
    return jsonify({
        'profiles': profiles_data
    })

@bp.route('/profile/save', methods=['POST'])
@login_required
def save_profile():
    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': _('Invalid data')}), 400

    profile_name = data.get('name')
    remote_avatar_url = data.get('remote_avatar_url')
    trees_data = data.get('trees', [])

    if not profile_name or len(profile_name.strip()) == 0 or len(profile_name.strip()) > 64:
        return jsonify({'status': 'error', 'message': _('Nom de profil invalide (1 à 64 caractères).')}), 400

    profile_name = profile_name.strip()
    if remote_avatar_url and len(str(remote_avatar_url)) > 256:
        return jsonify({'status': 'error', 'message': _('URL de l\'avatar trop longue.')}), 400

    profile = Profile.query.filter_by(user_id=current_user.id, name=profile_name).first()

    if profile:
        # Update existing
        profile.remote_avatar_url = remote_avatar_url
        ProfileTree.query.filter_by(profile_id=profile.id).delete()
        message = _('Profile updated successfully')
    else:
        # Create new
        profile = Profile(user_id=current_user.id, name=profile_name, remote_avatar_url=remote_avatar_url)
        db.session.add(profile)
        db.session.flush() # To get the profile.id
        message = _('Profile saved successfully')

    tree_ids = [t.get('treeId') for t in trees_data if t.get('treeId')]
    valid_trees = {t.id for t in Tree.query.filter(Tree.id.in_(tree_ids), Tree.user_id == current_user.id).all()} if tree_ids else set()

    seen_tree_ids = set()
    order = 1
    for t_data in trees_data:
        tid = t_data.get('treeId')
        if tid in valid_trees and tid not in seen_tree_ids:
            seen_tree_ids.add(tid)
            tree_assoc = ProfileTree(
                profile_id=profile.id,
                tree_id=tid,
                user_id=current_user.id,
                display_order=order,
                colorCode=t_data.get('colorCode', '#000000')
            )
            db.session.add(tree_assoc)
            order += 1

    db.session.commit()

    return jsonify({
        'status': 'success',
        'message': message,
        'profile_id': profile.id
    })

@bp.route('/profile/<int:profile_id>', methods=['DELETE'])
@login_required
def delete_profile(profile_id):
    profile = db.session.get(Profile, profile_id)
    if profile is None:
        return jsonify({'status': 'error', 'message': _('Profile not found')}), 404
    if profile.user_id != current_user.id:
        return jsonify({'status': 'error', 'message': _('Unauthorized')}), 403

    db.session.delete(profile)
    db.session.commit()

    return jsonify({'status': 'success', 'message': _('Profile deleted successfully')})

def delete_folder_recursive(folder):
    base_path = Path(current_app.config['PICTOGRAMS_PATH']).resolve()
    base_path_min = Path(current_app.config['PICTOGRAMS_PATH_MIN']).resolve()

    # Recursively delete children folders
    for sub_folder in folder.children:
        delete_folder_recursive(sub_folder)

    # Delete images in the folder
    for image in folder.images:
        try:
            physical_path = (base_path / image.path).resolve()
            if physical_path.is_relative_to(base_path):
                physical_path.unlink(missing_ok=True)
            physical_path_min = (base_path_min / image.path).with_suffix('.png').resolve()
            if physical_path_min.is_relative_to(base_path_min):
                physical_path_min.unlink(missing_ok=True)
        except OSError as e:
            current_app.logger.warning(f"Error deleting file for image {image.id}: {e}")
        db.session.delete(image)

    # Delete the folder directory itself
    try:
        physical_path = (base_path / folder.path).resolve()
        if physical_path.is_relative_to(base_path) and physical_path.exists():
            shutil.rmtree(physical_path)
    except OSError as e:
        current_app.logger.warning(f"Error deleting directory {physical_path}: {e}")

    # Delete the miniature folder directory itself
    try:
        physical_path_min = (base_path_min / folder.path).resolve()
        if physical_path_min.is_relative_to(base_path_min) and physical_path_min.exists():
            shutil.rmtree(physical_path_min)
    except OSError as e:
        current_app.logger.warning(f"Error deleting directory {physical_path_min}: {e}")

    # Delete the folder from DB
    db.session.delete(folder)

@bp.route('/item/delete', methods=['DELETE'])
@login_required
def delete_item():
    data = request.get_json()
    if not data or 'id' not in data or 'type' not in data:
        return jsonify({'status': 'error', 'message': _('Invalid data')}), 400

    item_id = data.get('id')
    item_type = data.get('type')

    if item_type == 'folder':
        folder = db.session.get(Folder, item_id)
        if not folder or folder.user_id != current_user.id:
            return jsonify({'status': 'error', 'message': _('Folder not found or not owned by user')}), 404

        if folder.parent_id is None:
             return jsonify({'status': 'error', 'message': _('Cannot delete root folder')}), 400

        delete_folder_recursive(folder)
        db.session.commit()
        return jsonify({'status': 'success', 'message': _('Folder and all its contents deleted')})

    elif item_type == 'image':
        image = db.session.get(Image, item_id)
        if not image or image.user_id != current_user.id:
            return jsonify({'status': 'error', 'message': _('Image not found or not owned by user')}), 404

        base_path = Path(current_app.config['PICTOGRAMS_PATH']).resolve()
        physical_path = (base_path / image.path).resolve()
        base_path_min = Path(current_app.config['PICTOGRAMS_PATH_MIN']).resolve()
        physical_path_min = (base_path_min / image.path).with_suffix('.png').resolve()

        if not physical_path.is_relative_to(base_path) or not physical_path_min.is_relative_to(base_path_min):
            return jsonify({'status': 'error', 'message': _('Chemin de fichier invalide.')}), 400

        try:
            physical_path.unlink(missing_ok=True)
            physical_path_min.unlink(missing_ok=True)
        except OSError as e:
            current_app.logger.error(f"Error deleting physical files for image {image.id}: {e}")
            return jsonify({'status': 'error', 'message': _('Could not delete file.')}), 500

        db.session.delete(image)
        db.session.commit()
        return jsonify({'status': 'success', 'message': _('Image deleted')})

    return jsonify({'status': 'error', 'message': _('Invalid item type')}), 400


