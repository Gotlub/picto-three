import json
import os
import shutil
from flask import render_template, flash, redirect, url_for, Blueprint, request, session, jsonify
from werkzeug.utils import secure_filename
from app import db
from app.forms import LoginForm, RegistrationForm
from sqlalchemy.exc import IntegrityError
from flask_login import current_user, login_user, logout_user, login_required
from app.models import User, Image, Tree, Folder, PictogramList

bp = Blueprint('main', __name__)
api_bp = Blueprint('api', __name__, url_prefix='/api')

@bp.route('/')
@bp.route('/index')
def index():
    return render_template('index.html', title='Home')

@bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user is None or not user.check_password(form.password.data):
            flash('Invalid username or password')
            return redirect(url_for('main.login'))
        login_user(user, remember=form.remember_me.data)
        return redirect(url_for('main.index'))
    return render_template('login.html', title='Sign In', form=form)

@bp.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('main.index'))

@bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    form = RegistrationForm()
    if form.validate_on_submit():
        user = User(username=form.username.data, email=form.email.data)
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()

        # Create user's personal pictogram directory
        user_path = os.path.join('app', 'static', 'images', 'pictograms', user.username)
        os.makedirs(user_path, exist_ok=True)

        # Create root folder for the user
        root_folder = Folder(
            name=user.username,
            user_id=user.id,
            parent_id=None,
            path=user_path.replace('\\', '/')
        )
        db.session.add(root_folder)
        db.session.commit()

        flash('Congratulations, you are now a registered user!', 'success')
        return redirect(url_for('main.login'))
    elif form.errors:
        flash('Registration failed. Please check the errors below.', 'danger')
        for field, errors in form.errors.items():
            for error in errors:
                flash(f"Error in {getattr(form, field).label.text}: {error}", 'danger')
    return render_template('register.html', title='Register', form=form)

@bp.route('/builder')
def builder():
    initial_folders = []

    # Get public root folder
    public_root = Folder.query.filter_by(user_id=None, parent_id=None).first()
    if public_root:
        initial_folders.append(public_root.to_dict())

    # Get user's root folder if authenticated
    if current_user.is_authenticated:
        user_root = Folder.query.filter_by(user_id=current_user.id, parent_id=None).first()
        if user_root:
            initial_folders.append(user_root.to_dict())

    # The initial data for the right sidebar tree
    initial_tree_data_json = json.dumps(initial_folders)

    # We still need all images for the left panel's "load tree" functionality for now.
    # This could be refactored later.
    all_images = Image.query.all()
    images_json = json.dumps([image.to_dict() for image in all_images])


    return render_template(
        'builder.html',
        title='Tree Builder',
        initial_tree_data_json=initial_tree_data_json,
        images_json=images_json # Still needed for existing logic
    )

@bp.route('/pictogram-bank')
@login_required
def pictogram_bank():
    root_folder = Folder.query.filter_by(user_id=current_user.id, parent_id=None).first()
    if not root_folder:
        pictograms_json = json.dumps({'id': 'root', 'type': 'folder', 'name': 'root', 'children': []})
    else:
        pictograms_json = json.dumps(root_folder.to_dict(include_children=True))

    return render_template('pictogram_bank.html', title='Pictogram Bank', pictograms_json=pictograms_json)


@bp.route('/list')
def list_page():
    # This logic is similar to the builder, providing the necessary data for the UI components
    initial_folders = []

    # Get public root folder
    public_root = Folder.query.filter_by(user_id=None, parent_id=None).first()
    if public_root:
        initial_folders.append(public_root.to_dict())

    # Get user's root folder if authenticated
    if current_user.is_authenticated:
        user_root = Folder.query.filter_by(user_id=current_user.id, parent_id=None).first()
        if user_root:
            initial_folders.append(user_root.to_dict())

    initial_tree_data_json = json.dumps(initial_folders)

    # The list builder needs all images to reconstruct lists from saved data (which only has IDs)
    all_images = Image.query.all()
    all_images_json = json.dumps([image.to_dict() for image in all_images])

    return render_template(
        'list.html',
        title='List Builder',
        initial_tree_data_json=initial_tree_data_json,
        all_images_json=all_images_json
    )

@bp.route('/language/<language>')
def set_language(language=None):
    session['language'] = language
    return redirect(request.referrer)

@api_bp.route('/trees/load', methods=['GET'])
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


@api_bp.route('/lists', methods=['GET'])
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

@api_bp.route('/lists', methods=['POST'])
@login_required
def save_list():
    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': 'Invalid data'}), 400

    list_name = data.get('list_name')
    is_public = data.get('is_public', False)
    payload = data.get('payload') # This is expected to be a list of dicts

    if not list_name or payload is None:
        return jsonify({'status': 'error', 'message': 'Missing required fields: list_name and payload are required.'}), 400

    # The payload from the client is JSON, but we store it as a string in the DB.
    payload_str = json.dumps(payload)

    new_list = PictogramList(
        user_id=current_user.id,
        list_name=list_name,
        is_public=is_public,
        payload=payload_str
    )
    db.session.add(new_list)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'A list with this name may already exist or another integrity issue occurred.'
        }), 400

    # The to_dict method will handle the payload serialization for the response
    return jsonify({
        'status': 'success',
        'message': 'List saved successfully',
        'list': new_list.to_dict()
    }), 201


@api_bp.route('/lists/<int:list_id>', methods=['PUT'])
@login_required
def update_list(list_id):
    plist = db.session.get(PictogramList, list_id)
    if plist is None:
        return jsonify({'status': 'error', 'message': 'List not found'}), 404
    if plist.user_id != current_user.id:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 403

    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': 'Invalid data'}), 400

    plist.list_name = data.get('list_name', plist.list_name)
    plist.is_public = data.get('is_public', plist.is_public)
    payload = data.get('payload')
    if payload is not None:
        plist.payload = json.dumps(payload)

    db.session.commit()

    return jsonify({
        'status': 'success',
        'message': 'List updated successfully',
        'list': plist.to_dict()
    })

@api_bp.route('/lists/<int:list_id>', methods=['DELETE'])
@login_required
def delete_list(list_id):
    plist = db.session.get(PictogramList, list_id)
    if plist is None:
        return jsonify({'status': 'error', 'message': 'List not found'}), 404
    if plist.user_id != current_user.id:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 403

    db.session.delete(plist)
    db.session.commit()

    return jsonify({'status': 'success', 'message': 'List deleted successfully'})


@api_bp.route('/folder/contents', methods=['GET'])
def get_folder_contents():
    parent_id = request.args.get('parent_id', type=int)
    if parent_id is None:
        return jsonify({'status': 'error', 'message': 'parent_id is required'}), 400

    parent_folder = db.session.get(Folder, parent_id)
    if not parent_folder:
        return jsonify({'status': 'error', 'message': 'Folder not found'}), 404

    # Security check: If the folder is not public, user must be logged in and own it
    if parent_folder.user_id is not None:
        if not current_user.is_authenticated or parent_folder.user_id != current_user.id:
            return jsonify({'status': 'error', 'message': 'Unauthorized'}), 403

    child_folders = [folder.to_dict() for folder in parent_folder.children.order_by(Folder.name).all()]
    child_images = [image.to_dict() for image in parent_folder.images.order_by(Image.name).all()]

    contents = child_folders + child_images

    return jsonify(contents)


@api_bp.route('/pictograms', methods=['GET'])
@login_required
def get_pictograms():
    root_folder = Folder.query.filter_by(user_id=current_user.id, parent_id=None).first()
    if not root_folder:
        return jsonify({'error': 'Root folder not found'}), 404

    return jsonify(root_folder.to_dict(include_children=True))

@api_bp.route('/folder/create', methods=['POST'])
@login_required
def create_folder():
    data = request.get_json()
    if not data or 'name' not in data or 'parent_id' not in data or not data.get('name').strip():
        return jsonify({'status': 'error', 'message': 'Invalid data'}), 400

    parent_id = data.get('parent_id')
    name = data.get('name').strip()

    parent_folder = db.session.get(Folder, parent_id)
    if not parent_folder or parent_folder.user_id != current_user.id:
        return jsonify({'status': 'error', 'message': 'Parent folder not found or not owned by user'}), 404

    # Create physical directory
    new_path = os.path.join(parent_folder.path, name)
    try:
        os.makedirs(new_path, exist_ok=True)
    except OSError as e:
        return jsonify({'status': 'error', 'message': f'Could not create directory: {e}'}), 500

    # Create folder in DB
    new_folder = Folder(
        name=name,
        user_id=current_user.id,
        parent_id=parent_id,
        path=new_path.replace('\\', '/')
    )
    db.session.add(new_folder)
    db.session.commit()

    return jsonify({'status': 'success', 'folder': new_folder.to_dict(include_children=False)})

@api_bp.route('/image/upload', methods=['POST'])
@login_required
def upload_image():
    if 'file' not in request.files:
        return jsonify({'status': 'error', 'message': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'status': 'error', 'message': 'No selected file'}), 400

    folder_id = request.form.get('folder_id')
    if not folder_id:
        return jsonify({'status': 'error', 'message': 'No folder_id specified'}), 400

    folder = db.session.get(Folder, folder_id)
    if not folder or folder.user_id != current_user.id:
        return jsonify({'status': 'error', 'message': 'Folder not found or not owned by user'}), 404

    if file:
        filename = secure_filename(file.filename)
        file_path = os.path.join(folder.path, filename)

        # Check for file type/extension here if needed

        file.save(file_path)

        new_image = Image(
            name=filename,
            path=file_path.replace('\\', '/'),
            user_id=current_user.id,
            folder_id=folder.id,
            description="" # Or get from form
        )
        db.session.add(new_image)
        db.session.commit()

        return jsonify({'status': 'success', 'image': new_image.to_dict()})

    return jsonify({'status': 'error', 'message': 'File upload failed'}), 500

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

@api_bp.route('/tree/save', methods=['POST'])
@login_required
def save_tree():
    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': 'Invalid data'}), 400

    tree_name = data.get('name')
    is_public = data.get('is_public', False)
    json_data = data.get('json_data')

    if not tree_name or not json_data:
        return jsonify({'status': 'error', 'message': 'Missing required fields'}), 400

    # Validate images if saving a public tree
    if is_public:
        if not json_data.get('roots'):
            return jsonify({'status': 'error', 'message': 'Cannot save an empty tree as public.'}), 400

        image_ids = get_image_ids_from_tree(json_data['roots'])
        if image_ids:
            private_images = Image.query.filter(Image.id.in_(image_ids), Image.is_public == False).all()
            if private_images:
                return jsonify({
                    'status': 'error',
                    'message': 'Public trees can only contain public images. Please remove private images before saving publicly.'
                }), 400

    tree = Tree(
        user_id=current_user.id,
        name=tree_name,
        is_public=is_public,
        json_data=json.dumps(json_data)
    )
    db.session.add(tree)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'A tree with this name already exists. Please choose a different name.'
        }), 400

    return jsonify({
        'status': 'success',
        'message': 'Tree saved successfully',
        'tree_id': tree.id,
        'tree_data': json_data
    })

def delete_folder_recursive(folder):
    # Recursively delete children folders
    for sub_folder in folder.children:
        delete_folder_recursive(sub_folder)

    # Delete images in the folder
    for image in folder.images:
        try:
            os.remove(image.path)
        except OSError as e:
            print(f"Error deleting file {image.path}: {e}") # Or use proper logging
        db.session.delete(image)

    # Delete the folder directory itself
    try:
        shutil.rmtree(folder.path)
    except OSError as e:
        print(f"Error deleting directory {folder.path}: {e}")

    # Delete the folder from DB
    db.session.delete(folder)

@api_bp.route('/item/delete', methods=['DELETE'])
@login_required
def delete_item():
    data = request.get_json()
    if not data or 'id' not in data or 'type' not in data:
        return jsonify({'status': 'error', 'message': 'Invalid data'}), 400

    item_id = data.get('id')
    item_type = data.get('type')

    if item_type == 'folder':
        folder = db.session.get(Folder, item_id)
        if not folder or folder.user_id != current_user.id:
            return jsonify({'status': 'error', 'message': 'Folder not found or not owned by user'}), 404

        if folder.parent_id is None:
             return jsonify({'status': 'error', 'message': 'Cannot delete root folder'}), 400

        delete_folder_recursive(folder)
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Folder and all its contents deleted'})

    elif item_type == 'image':
        image = db.session.get(Image, item_id)
        if not image or image.user_id != current_user.id:
            return jsonify({'status': 'error', 'message': 'Image not found or not owned by user'}), 404

        try:
            os.remove(image.path)
        except OSError as e:
            return jsonify({'status': 'error', 'message': f'Could not delete file: {e}'}), 500

        db.session.delete(image)
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Image deleted'})

    return jsonify({'status': 'error', 'message': 'Invalid item type'}), 400
