from flask import Blueprint, jsonify, request, current_app, json, send_file
from flask_login import current_user, login_required
from flask_babel import _
from werkzeug.utils import secure_filename
from app import db
from app.models import Tree, PictogramList, Folder, Image
from pathlib import Path
import shutil
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape, portrait
from reportlab.lib.utils import ImageReader
from reportlab.lib.colors import HexColor
from PIL import Image as PILImage

bp = Blueprint('api', __name__, url_prefix='/api')

@bp.route('/trees/load', methods=['GET'])
def load_trees():
    # Public trees are all trees with is_public = True, ordered by name
    public_trees = Tree.query.filter_by(is_public=True).order_by(Tree.name).all()

    user_trees = []
    if current_user.is_authenticated:
        # Private trees are user-owned trees with is_public = False, ordered by name
        user_trees = Tree.query.filter_by(user_id=current_user.id, is_public=False).order_by(Tree.name).all()

    return jsonify({
        'public_trees': [tree.to_dict() for tree in public_trees],
        'user_trees': [tree.to_dict() for tree in user_trees]
    })


@bp.route('/lists', methods=['GET'])
def load_lists():
    # Public lists are all lists with is_public = True, ordered by name
    public_lists = PictogramList.query.filter_by(is_public=True).order_by(PictogramList.list_name).all()

    user_lists = []
    if current_user.is_authenticated:
        # Private lists are user-owned lists with is_public = False, ordered by name
        user_lists = PictogramList.query.filter_by(user_id=current_user.id, is_public=False).order_by(PictogramList.list_name).all()

    # In to_dict(), the payload is already a string, but if it were an object, we'd need to handle it.
    # The current to_dict returns the payload as is, which is what we want.
    return jsonify({
        'public_lists': [l.to_dict() for l in public_lists],
        'user_lists': [l.to_dict() for l in user_lists]
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

    # Validate images if saving a public list
    if is_public:
        image_ids = set()
        if isinstance(payload, list):
            for item in payload:
                if isinstance(item, dict) and 'image_id' in item:
                    image_ids.add(item['image_id'])

        if image_ids:
            # Public lists cannot contain any user-owned images (user_id is not NULL)
            user_owned_images = Image.query.filter(Image.id.in_(image_ids), Image.user_id != None).all()
            if user_owned_images:
                return jsonify({
                    'status': 'error',
                    'message': _('Public lists can only contain global public images. Please remove any user-owned images before saving publicly.')
                }), 400

    payload_str = json.dumps(payload)

    # Check if a list with the same name already exists for this user
    existing_list = PictogramList.query.filter_by(user_id=current_user.id, list_name=list_name).first()

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
    plist.is_public = data.get('is_public', plist.is_public)
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

@bp.route('/folder/contents', methods=['GET'])
def get_folder_contents():
    parent_id = request.args.get('parent_id', type=int)
    if parent_id is None:
        return jsonify({'status': 'error', 'message': _('parent_id is required')}), 400

    parent_folder = db.session.get(Folder, parent_id)
    if not parent_folder:
        return jsonify({'status': 'error', 'message': _('Folder not found')}), 404

    # Security check: If the folder is not public, user must be logged in and own it
    if parent_folder.user_id is not None:
        if not current_user.is_authenticated or parent_folder.user_id != current_user.id:
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

    # Add child images, sorted by name
    child_images = folder.images.order_by(Image.name).all()
    for image in child_images:
        image_node = {
            'type': 'image',
            'data': image.to_dict()
        }
        folder_node['children'].append(image_node)

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


@bp.route('/pictograms', methods=['GET'])
@login_required
def get_pictograms():
    root_folder = Folder.query.filter_by(user_id=current_user.id, parent_id=None).first()
    if not root_folder:
        return jsonify({'error': _('Root folder not found')}), 404

    return jsonify(root_folder.to_dict(include_children=True))

@bp.route('/folder/create', methods=['POST'])
@login_required
def create_folder():
    data = request.get_json()
    if not data or 'name' not in data or 'parent_id' not in data or not data.get('name').strip():
        return jsonify({'status': 'error', 'message': _('Invalid data')}), 400

    parent_id = data.get('parent_id')
    name = data.get('name').strip()

    parent_folder = db.session.get(Folder, parent_id)
    if not parent_folder or parent_folder.user_id != current_user.id:
        return jsonify({'status': 'error', 'message': _('Parent folder not found or not owned by user')}), 404

    # The parent path from DB is relative. Combine it with the base path for physical operations.
    base_path = Path(current_app.config['PICTOGRAMS_PATH'])
    parent_physical_path = base_path / parent_folder.path

    # Create physical directory
    new_physical_path = parent_physical_path / name
    try:
        new_physical_path.mkdir(exist_ok=True)
    except OSError as e:
        return jsonify({'status': 'error', 'message': _('Could not create directory: %(error)s', error=e)}), 500

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
    db.session.commit()

    return jsonify({'status': 'success', 'folder': new_folder.to_dict(include_children=False)})

# --- Helper pour la création de miniatures ---
THUMB_SIZE = (48, 48)

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

    except Exception as e:
        current_app.logger.error(f"Erreur lors de la création de la miniature pour {filepath_relative}: {e}")

@bp.route('/image/upload', methods=['POST'])
@login_required
def upload_image():
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

        # The folder path from DB is relative. Combine it with the base path for physical operations.
        base_path = Path(current_app.config['PICTOGRAMS_PATH'])
        physical_path = base_path / folder.path / filename

        # The new path for the DB is also relative.
        relative_path = Path(folder.path) / filename

        # Check for file type/extension here if needed

        file.save(physical_path)

        new_image = Image(
            name=filename,
            path=str(relative_path).replace('\\', '/'),
            user_id=current_user.id,
            folder_id=folder.id,
            description="" # Or get from form
        )
        db.session.add(new_image)
        db.session.commit()

        # --- AJOUTER L'APPEL POUR CRÉER LA MINIATURE ---
        try:
            create_thumbnail_for_upload(new_image.path)
        except Exception as e:
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
        image.description = data['description']

    if 'is_public' in data:
        image.is_public = bool(data['is_public'])

    db.session.commit()

    return jsonify({
        'status': 'success',
        'message': _('Image updated successfully'),
        'image': image.to_dict()
    })

def get_image_ids_from_tree(nodes):
    """Recursively extracts all image IDs from a tree structure."""
    image_ids = set()
    for node in nodes:
        # The 'id' in the tree data corresponds to the image ID
        if 'id' in node:
            image_ids.add(node['id'])
        if 'children' in node and node['children']:
            image_ids.update(get_image_ids_from_tree(node['children']))
    return image_ids

@bp.route('/tree/save', methods=['POST'])
@login_required
def save_tree():
    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': _('Invalid data')}), 400

    tree_name = data.get('name')
    is_public = data.get('is_public', False)
    json_data = data.get('json_data')

    if not tree_name or not json_data:
        return jsonify({'status': 'error', 'message': _('Missing required fields')}), 400

    # Validate images if saving a public tree
    if is_public:
        if not json_data.get('roots'):
            return jsonify({'status': 'error', 'message': _('Cannot save an empty tree as public.')}), 400

        image_ids = get_image_ids_from_tree(json_data['roots'])
        if image_ids:
            # Public trees cannot contain any user-owned images (user_id is not NULL)
            user_owned_images = Image.query.filter(Image.id.in_(image_ids), Image.user_id != None).all()
            if user_owned_images:
                return jsonify({
                    'status': 'error',
                    'message': _('Public trees can only contain global public images. Please remove any user-owned images before saving publicly.')
                }), 400

    # Check if a tree with the same name already exists for this user
    tree = Tree.query.filter_by(user_id=current_user.id, name=tree_name).first()

    if tree:
        # If it exists, update it
        tree.is_public = is_public
        tree.json_data = json.dumps(json_data)
        message = _('Tree updated successfully')
    else:
        # If it does not exist, create a new one
        tree = Tree(
            user_id=current_user.id,
            name=tree_name,
            is_public=is_public,
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

def delete_folder_recursive(folder):
    # The path from DB is relative. Combine it with the base path for physical operations.
    base_path = Path(current_app.config['PICTOGRAMS_PATH'])
    base_path_min = Path(current_app.config['PICTOGRAMS_PATH_MIN'])
    # Recursively delete children folders
    for sub_folder in folder.children:
        delete_folder_recursive(sub_folder)

    # Delete images in the folder
    for image in folder.images:
        try:
            physical_path = base_path / image.path
            physical_path.unlink(missing_ok=True)
            physical_path_min = base_path_min / image.path
            physical_path_min = physical_path_min.with_suffix('.png')
            physical_path_min.unlink(missing_ok=True)
        except OSError as e:
            print(f"Error deleting file {physical_path}: {e}") # Or use proper logging
        db.session.delete(image)

    # Delete the folder directory itself
    try:
        physical_path = base_path / folder.path
        if physical_path.exists():
            shutil.rmtree(physical_path)
    except OSError as e:
        print(f"Error deleting directory {physical_path}: {e}")

    # Delete the miniature folder directory itself
    try:
        physical_path_min = base_path_min / folder.path
        if physical_path_min.exists():
            shutil.rmtree(physical_path_min)
    except OSError as e:
        print(f"Error deleting directory {physical_path_min}: {e}")

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

        try:
            base_path = Path(current_app.config['PICTOGRAMS_PATH'])
            physical_path = base_path / image.path
            physical_path.unlink(missing_ok=True)
            base_path_min = Path(current_app.config['PICTOGRAMS_PATH_MIN'])
            physical_path_min = base_path_min / image.path
            physical_path_min = physical_path_min.with_suffix('.png')
            physical_path_min.unlink()
        except OSError as e:
            return jsonify({'status': 'error', 'message': _('Could not delete file: %(error)s', error=e)}), 500

        db.session.delete(image)
        db.session.commit()
        return jsonify({'status': 'success', 'message': _('Image deleted')})

    return jsonify({'status': 'error', 'message': _('Invalid item type')}), 400


@bp.route('/export_pdf', methods=['POST'])
def export_pdf():
    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': 'Invalid data'}), 400

    image_data = data.get('image_data', [])
    
    # Layout Options
    layout_mode = data.get('layout_mode', 'chain')
    orientation = data.get('orientation', 'portrait')
    image_size = data.get('image_size', 100)
    
    # Style Options
    border_color = data.get('border_color', '#000000')
    border_width = data.get('border_width', 0)
    border_radius = data.get('border_radius', 0)
    bg_color = data.get('bg_color', '#ffffff')
    show_shadow = data.get('show_shadow', False)
    
    # Text Options
    show_text = data.get('show_text', True)
    text_position = data.get('text_position', 'bottom')
    font_family = data.get('font_family', 'Helvetica')
    font_size = data.get('font_size', 12)
    text_color = data.get('text_color', '#000000')

    if not image_data:
        return jsonify({'status': 'error', 'message': _('No images to export')}), 400

    buffer = io.BytesIO()
    
    # Set page size and orientation
    page_size = A4
    if orientation == 'landscape':
        page_size = landscape(A4)
    else:
        page_size = portrait(A4)
        
    c = canvas.Canvas(buffer, pagesize=page_size)
    width, height = page_size

    # Define margins and spacing
    margin = 50
    padding = 10 # Padding inside the item box
    item_spacing = 10 # Spacing between items
    
    # Helper to draw a single item
    def draw_item(c, x, y, item_width, item_height, img_path, description):
        # Draw Shadow
        if show_shadow:
            c.setFillColor(HexColor('#cccccc'))
            # Simple offset shadow
            c.roundRect(x + 3, y - 3, item_width, item_height, border_radius, fill=1, stroke=0)

        # Draw Background
        c.setFillColor(HexColor(bg_color))
        c.setStrokeColor(HexColor(border_color))
        c.setLineWidth(border_width)
        # If border_width is 0, we don't stroke, but we might still fill
        stroke = 1 if border_width > 0 else 0
        c.roundRect(x, y, item_width, item_height, border_radius, fill=1, stroke=stroke)

        # Calculate image area
        # We need to fit the image inside the box, accounting for text if present
        
        text_height = font_size + 5 if show_text and description else 0
        
        img_area_height = item_height - (padding * 2) - text_height
        img_area_width = item_width - (padding * 2)
        
        if img_area_height <= 0 or img_area_width <= 0:
            return # Too small to draw

        # Draw Image
        try:
            # We need to calculate the aspect ratio to fit it nicely
            # We can use ImageReader to get size, but we might have it from PIL earlier if we want to optimize
            # For now let's trust reportlab's drawImage with preserveAspectRatio=True (if we used it)
            # But drawImage doesn't auto-scale to box, so we do it manually
            
            # We already have the absolute path logic in the main loop, let's assume img_path is valid
            img_reader = ImageReader(img_path)
            iw, ih = img_reader.getSize()
            aspect = ih / float(iw) if iw else 0
            
            # Fit into img_area
            if iw > 0 and ih > 0:
                scale = min(img_area_width / iw, img_area_height / ih)
                w = iw * scale
                h = ih * scale
                
                # Center image in its area
                ix = x + padding + (img_area_width - w) / 2
                
                # Y position depends on text position
                if show_text and text_position == 'top':
                    iy = y + padding # Image is below text
                else:
                    iy = y + padding + text_height # Image is above text (bottom) or just padding
                
                c.drawImage(img_reader, ix, iy, width=w, height=h, mask='auto')
        except Exception as e:
            print(f"Error drawing image: {e}")

        # Draw Text
        if show_text and description:
            c.setFont(font_family, font_size)
            c.setFillColor(HexColor(text_color))
            
            tx = x + item_width / 2
            if text_position == 'top':
                ty = y + item_height - padding - font_size + 2 # Approximate baseline
            else:
                ty = y + padding + 2
                
            c.drawCentredString(tx, ty, description)


    # Main Loop
    cursor_x = margin
    cursor_y = height - margin
    row_max_height = 0
    
    # Calculate item dimensions based on image_size and options
    # image_size is the target width of the image content
    # We add padding and text space to get the full item box size
    # This is a simplification; ideally we'd calculate per image, but for a grid/strip uniform size is better
    
    # Let's define a fixed box size for grid/strip based on the requested image size
    # We assume the box is square-ish or fixed aspect for the container
    box_width = image_size + (padding * 2)
    # Height needs to accommodate text
    text_allowance = (font_size + 5) if show_text else 0
    box_height = image_size + (padding * 2) + text_allowance

    for item in image_data:
        image_path_relative = item.get('path')
        description = item.get('description', '')

        if not image_path_relative:
            continue

        base_path = Path(current_app.config['PICTOGRAMS_PATH'])
        image_path_absolute = base_path / image_path_relative

        if not image_path_absolute.exists():
            legacy_path = Path(current_app.root_path) / 'static' / image_path_relative
            if not legacy_path.exists():
                continue
            image_path_absolute = legacy_path

        # --- Layout Logic ---
        
        if layout_mode == 'chain':
            # Vertical stack, centered
            # For chain, we can let the height be flexible if we wanted, but let's stick to the box model for consistency
            
            if cursor_y - box_height < margin:
                c.showPage()
                cursor_y = height - margin
            
            # Center horizontally
            item_x = (width - box_width) / 2
            item_y = cursor_y - box_height
            
            draw_item(c, item_x, item_y, box_width, box_height, image_path_absolute, description)
            
            cursor_y -= (box_height + item_spacing)

        elif layout_mode == 'grid':
            # Rows and columns
            if cursor_x + box_width > width - margin:
                cursor_x = margin
                cursor_y -= (box_height + item_spacing)
            
            if cursor_y - box_height < margin:
                c.showPage()
                cursor_x = margin
                cursor_y = height - margin
            
            draw_item(c, cursor_x, cursor_y - box_height, box_width, box_height, image_path_absolute, description)
            
            cursor_x += (box_width + item_spacing)

        elif layout_mode == 'strip':
            # Horizontal line
            # If it overflows, we wrap to next line (essentially a grid), 
            # OR we could just rotate the page? But user selected orientation.
            # Let's treat strip as "fill line then wrap", which is same as grid but maybe we center the row?
            # For now, let's implement it same as grid but maybe with different spacing or alignment intent.
            # Actually, "Strip" usually implies a single sequence. Let's just use the grid logic which handles wrapping naturally.
            # To distinguish, maybe strip centers the content on the page if it's just a few items?
            # Let's stick to standard grid wrapping for robustness.
            
             if cursor_x + box_width > width - margin:
                cursor_x = margin
                cursor_y -= (box_height + item_spacing)
            
             if cursor_y - box_height < margin:
                c.showPage()
                cursor_x = margin
                cursor_y = height - margin
            
             draw_item(c, cursor_x, cursor_y - box_height, box_width, box_height, image_path_absolute, description)
            
             cursor_x += (box_width + item_spacing)

    c.save()
    buffer.seek(0)

    return send_file(
        buffer,
        as_attachment=True,
        download_name='pictogram_list.pdf',
        mimetype='application/pdf'
    )
