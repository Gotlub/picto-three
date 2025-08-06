import json
import os
import shutil
from flask import render_template, flash, redirect, url_for, Blueprint, request, session, jsonify
from werkzeug.utils import secure_filename
from app import db
from app.forms import LoginForm, RegistrationForm
from flask_login import current_user, login_user, logout_user, login_required
from app.models import User, Image, Tree, Folder

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
    public_images = Image.query.filter_by(is_public=True).all()
    user_images = []
    if current_user.is_authenticated:
        user_images = Image.query.filter_by(user_id=current_user.id).all()

    all_images = public_images + user_images
    images_json = json.dumps([image.to_dict() for image in all_images])

    return render_template('builder.html', title='Tree Builder', images_json=images_json, images=all_images)

@bp.route('/pictogram-bank')
@login_required
def pictogram_bank():
    root_folder = Folder.query.filter_by(user_id=current_user.id, parent_id=None).first()
    if not root_folder:
        pictograms_json = json.dumps({'id': 'root', 'type': 'folder', 'name': 'root', 'children': []})
    else:
        pictograms_json = json.dumps(root_folder.to_dict())

    return render_template('pictogram_bank.html', title='Pictogram Bank', pictograms_json=pictograms_json)

@bp.route('/language/<language>')
def set_language(language=None):
    session['language'] = language
    return redirect(request.referrer)

@api_bp.route('/trees/load', methods=['GET'])
def load_trees():
    public_trees = Tree.query.filter_by(is_public=True).all()
    user_trees = []
    if current_user.is_authenticated:
        user_trees = Tree.query.filter_by(user_id=current_user.id).all()

    # Combine public and user trees and avoid duplicate
    all_trees = list(set(public_trees + user_trees))
    return jsonify([tree.to_dict() for tree in all_trees])

@api_bp.route('/pictograms', methods=['GET'])
@login_required
def get_pictograms():
    root_folder = Folder.query.filter_by(user_id=current_user.id, parent_id=None).first()
    if not root_folder:
        return jsonify({'error': 'Root folder not found'}), 404

    return jsonify(root_folder.to_dict())

@api_bp.route('/folder/create', methods=['POST'])
@login_required
def create_folder():
    data = request.get_json()
    if not data or 'name' not in data or 'parent_id' not in data:
        return jsonify({'status': 'error', 'message': 'Invalid data'}), 400

    parent_id = data.get('parent_id')
    name = data.get('name')

    parent_folder = Folder.query.get(parent_id)
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

    folder = Folder.query.get(folder_id)
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

    tree = Tree(
        user_id=current_user.id,
        name=tree_name,
        is_public=is_public,
        json_data=json.dumps(json_data) # Ensure json_data is stored as a string
    )
    db.session.add(tree)
    db.session.commit()

    return jsonify({'status': 'success', 'message': 'Tree saved successfully', 'tree_id': tree.id})

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
        folder = Folder.query.get(item_id)
        if not folder or folder.user_id != current_user.id:
            return jsonify({'status': 'error', 'message': 'Folder not found or not owned by user'}), 404

        if folder.parent_id is None:
             return jsonify({'status': 'error', 'message': 'Cannot delete root folder'}), 400

        delete_folder_recursive(folder)
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Folder and all its contents deleted'})

    elif item_type == 'image':
        image = Image.query.get(item_id)
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
