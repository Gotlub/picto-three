import json
import os
import shutil
from pathlib import Path
from flask import render_template, flash, redirect, url_for, Blueprint, request, session, jsonify, send_from_directory, current_app
from flask_babel import _
from werkzeug.utils import secure_filename
import io
from markupsafe import Markup
from flask import send_file
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from PIL import Image as PILImage
from app import db
from app.forms import LoginForm, RegistrationForm, ChangePasswordForm, DeleteAccountForm, ForgotPasswordForm, ResetPasswordForm, ResendConfirmationForm
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_
from flask_login import current_user, login_user, logout_user, login_required
from app.models import User, Image, Tree, Folder, PictogramList
from app.utils import send_email, generate_confirmation_token, confirm_token, generate_password_reset_token, confirm_password_reset_token
from datetime import datetime, UTC

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
            flash(_('Invalid username or password'))
            return redirect(url_for('main.login'))

        if not user.confirmed:
            flash(Markup(_('Votre compte n\'est pas confirmé. Veuillez vérifier vos e-mails. <a href="%(url)s">Renvoyer l\'e-mail de confirmation ?</a>', url=url_for('main.resend_confirmation_request'))), 'warning')
            return redirect(url_for('main.login'))

        login_user(user, remember=form.remember_me.data)
        return redirect(url_for('main.index'))
    return render_template('login.html', title='Sign In', form=form)

@bp.route('/forgot_password', methods=['GET', 'POST'])
def forgot_password():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    form = ForgotPasswordForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user:
            token = generate_password_reset_token(user.email)
            reset_url = url_for('main.reset_with_token_route', token=token, _external=True)
            send_email(user.email, 'Réinitialisation de votre mot de passe', 'emails/reset_password.html', reset_url=reset_url)
            flash(_('Un email avec les instructions pour réinitialiser votre mot de passe a été envoyé.'), 'info')
        else:
            flash(_('Aucun compte trouvé avec cette adresse e-mail.'), 'warning')
        return redirect(url_for('main.login'))
    return render_template('forgot_password.html', title='Mot de passe oublié', form=form)

@bp.route('/reset/<token>', methods=['GET', 'POST'])
def reset_with_token_route(token):
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    email = confirm_password_reset_token(token)
    if not email:
        flash(_('Le lien de réinitialisation est invalide ou a expiré.'), 'danger')
        return redirect(url_for('main.login'))

    form = ResetPasswordForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=email).first_or_404()
        user.set_password(form.password.data)
        db.session.commit()
        flash(_('Votre mot de passe a été réinitialisé avec succès.'), 'success')
        return redirect(url_for('main.login'))

    return render_template('reset_password_form.html', form=form)

@bp.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('main.index'))

@bp.route('/account', methods=['GET', 'POST'])
@login_required
def account():
    change_password_form = ChangePasswordForm()
    delete_account_form = DeleteAccountForm()
    return render_template('account.html', title='Account Management',
                           change_password_form=change_password_form,
                           delete_account_form=delete_account_form)

@bp.route('/change_password', methods=['POST'])
@login_required
def change_password():
    form = ChangePasswordForm()
    if form.validate_on_submit():
        user = current_user
        if user.check_password(form.current_password.data):
            user.set_password(form.new_password.data)
            db.session.commit()
            flash(_('Your password has been changed successfully.'), 'success')
        else:
            flash(_('Invalid current password.'), 'danger')
    else:
        for field, errors in form.errors.items():
            for error in errors:
                flash(_('Error in %(field)s: %(error)s', field=getattr(form, field).label.text, error=error), 'danger')
    return redirect(url_for('main.account'))

@bp.route('/delete_account', methods=['POST'])
@login_required
def delete_account():
    form = DeleteAccountForm()
    if form.validate_on_submit():
        if form.username_confirm.data == current_user.username:
            user = current_user
            # 1. Delete all trees of the user
            Tree.query.filter_by(user_id=user.id).delete()
            # 2. Delete all lists of the user
            PictogramList.query.filter_by(user_id=user.id).delete()
            # 3. Delete all images belonging to the user
            Image.query.filter_by(user_id=user.id).delete()
            # 4. Delete the user's pictogram directory
            user_pictogram_folder = Path(current_app.config['PICTOGRAMS_PATH']) / user.username
            if user_pictogram_folder.exists():
                shutil.rmtree(user_pictogram_folder)
            # 5. Delete all folders of the user
            Folder.query.filter_by(user_id=user.id).delete()
            # 6. Delete the user account
            db.session.delete(user)
            db.session.commit()
            logout_user()
            flash(_('Your account has been successfully deleted.'), 'success')
            return redirect(url_for('main.index'))
        else:
            flash(_('Invalid username confirmation. Account deletion cancelled.'), 'danger')
            return redirect(url_for('main.account'))
    else:
        flash(_('Invalid form submission.'), 'danger')
        return redirect(url_for('main.account'))

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
        # The physical path is based on the PICTOGRAMS_PATH config
        user_physical_path = Path(current_app.config['PICTOGRAMS_PATH']) / user.username
        user_physical_path.mkdir(exist_ok=True)

        # The path stored in DB is relative to PICTOGRAMS_PATH
        user_relative_path = user.username

        # Create root folder for the user
        root_folder = Folder(
            name=user.username,
            user_id=user.id,
            parent_id=None,
            path=user_relative_path
        )
        db.session.add(root_folder)
        db.session.commit()

        token = generate_confirmation_token(user.email)
        confirm_url = url_for('main.confirm_email_route', token=token, _external=True)
        send_email(user.email, 'Confirmez votre compte', 'emails/confirm_email.html', confirm_url=confirm_url)

        flash(_('Un email de confirmation a été envoyé à votre adresse e-mail.'), 'success')
        return redirect(url_for('main.login'))
    elif form.errors:
        flash(_('Registration failed. Please check the errors below.'), 'danger')
        for field, errors in form.errors.items():
            for error in errors:
                flash(_('Error in %(field)s: %(error)s', field=getattr(form, field).label.text, error=error), 'danger')
    return render_template('register.html', title='Register', form=form)

@bp.route('/confirm/<token>')
def confirm_email_route(token):
    email = confirm_token(token)
    if not email:
        flash(_('Le lien de confirmation est invalide ou a expiré.'), 'danger')
        return redirect(url_for('main.login'))

    user = User.query.filter_by(email=email).first_or_404()
    if user.confirmed:
        flash(_('Compte déjà confirmé. Veuillez vous connecter.'), 'success')
    else:
        user.confirmed = True
        user.confirmed_on = datetime.now(UTC)
        db.session.commit()
        flash(_('Votre compte a été confirmé avec succès !'), 'success')
    return redirect(url_for('main.login'))

@bp.route('/resend_confirmation_request', methods=['GET', 'POST'])
def resend_confirmation_request():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    form = ResendConfirmationForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user:
            if user.confirmed:
                flash(_('Ce compte est déjà confirmé. Veuillez vous connecter.'), 'success')
                return redirect(url_for('main.login'))
            else:
                token = generate_confirmation_token(user.email)
                confirm_url = url_for('main.confirm_email_route', token=token, _external=True)
                send_email(user.email, 'Confirmez votre compte', 'emails/confirm_email.html', confirm_url=confirm_url)
                flash(_('Un nouvel email de confirmation a été envoyé.'), 'success')
                return redirect(url_for('main.login'))
        else:
            flash(_('Aucun compte trouvé avec cette adresse e-mail. Veuillez vous inscrire.'), 'warning')
    return render_template('resend_confirmation_request.html', form=form)

@bp.route('/builder', methods=['GET', 'POST'])
def builder():
    initial_folders = []
    tree_data_from_post = None

    if request.method == 'POST':
        tree_data_str = request.form.get('tree_data')
        if tree_data_str:
            try:
                tree_data_from_post = json.loads(tree_data_str)
            except json.JSONDecodeError:
                flash(_('Invalid tree data received.'), 'danger')
                tree_data_from_post = None

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

    # Load only images that are public or owned by the current user.
    conditions = [
        Image.user_id == None,  # Global public images
        Image.is_public == True   # User-owned but public images
    ]
    if current_user.is_authenticated:
        conditions.append(Image.user_id == current_user.id)

    visible_images = Image.query.filter(or_(*conditions)).all()
    images_json = json.dumps([image.to_dict() for image in visible_images])


    return render_template(
        'builder.html',
        title='Tree Builder',
        initial_tree_data_json=initial_tree_data_json,
        images_json=images_json,
        tree_data_from_post=tree_data_from_post
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

    # Load only images that are public or owned by the current user.
    conditions = [
        Image.user_id == None,  # Global public images
        Image.is_public == True   # User-owned but public images
    ]
    if current_user.is_authenticated:
        conditions.append(Image.user_id == current_user.id)

    visible_images = Image.query.filter(or_(*conditions)).all()
    all_images_json = json.dumps([image.to_dict() for image in visible_images])

    return render_template(
        'list.html',
        title='List Builder',
        initial_tree_data_json=initial_tree_data_json,
        all_images_json=all_images_json
    )


@bp.route('/change-language/<locale>')
def change_language(locale):
    """
    Permet à n'importe quel utilisateur de changer la langue.
    Sauvegarde la préférence dans le profil si l'utilisateur est connecté,
    sinon dans la session du navigateur.
    """
    # Vérifie si la langue demandée est supportée
    if locale not in current_app.config['LANGUAGES']:
        return redirect(url_for('main.index'))

    # Si l'utilisateur est connecté, on sauvegarde son choix dans son profil
    if current_user.is_authenticated:
        current_user.locale = locale
        db.session.commit()
        flash(_('Your language has been updated.'))
    # Sinon, on sauvegarde le choix dans la session du navigateur
    else:
        session['locale'] = locale
        flash(_('The language has been updated for this session.'))

    # Redirige l'utilisateur vers la page où il se trouvait précédemment
    return redirect(request.referrer or url_for('main.index'))

# This route will ensure that JS files are served with the correct MIME type.
@bp.route('/static/js/<path:filename>')
def serve_js(filename):
    return send_from_directory(
        os.path.join(bp.root_path, 'static', 'js'),
        filename,
        mimetype='application/javascript'
    )

@bp.route('/pictograms/<path:filepath>')
def serve_pictogram(filepath):
    """Serves a pictogram from the external data directory."""
    pictograms_path = Path(current_app.config['PICTOGRAMS_PATH'])
    # send_from_directory is security-conscious and will prevent path traversal attacks.
    return send_from_directory(pictograms_path, filepath)

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
                    'message': _('Les listes publiques ne peuvent contenir que des images publiques globales. Veuillez retirer les images appartenant à des utilisateurs avant de sauvegarder publiquement.')
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


@api_bp.route('/lists/<int:list_id>', methods=['PUT'])
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

@api_bp.route('/lists/<int:list_id>', methods=['DELETE'])
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


@api_bp.route('/folder/contents', methods=['GET'])
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


@api_bp.route('/pictograms', methods=['GET'])
@login_required
def get_pictograms():
    root_folder = Folder.query.filter_by(user_id=current_user.id, parent_id=None).first()
    if not root_folder:
        return jsonify({'error': _('Root folder not found')}), 404

    return jsonify(root_folder.to_dict(include_children=True))

@api_bp.route('/folder/create', methods=['POST'])
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

@api_bp.route('/image/upload', methods=['POST'])
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

        return jsonify({'status': 'success', 'image': new_image.to_dict()})

    return jsonify({'status': 'error', 'message': _('File upload failed')}), 500


@api_bp.route('/image/<int:image_id>', methods=['PUT'])
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

@api_bp.route('/tree/save', methods=['POST'])
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
                    'message': _('Les arbres publics ne peuvent contenir que des images publiques globales. Veuillez retirer les images appartenant à des utilisateurs avant de sauvegarder publiquement.')
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

    # Recursively delete children folders
    for sub_folder in folder.children:
        delete_folder_recursive(sub_folder)

    # Delete images in the folder
    for image in folder.images:
        try:
            physical_path = base_path / image.path
            physical_path.unlink(missing_ok=True)
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

    # Delete the folder from DB
    db.session.delete(folder)

@api_bp.route('/item/delete', methods=['DELETE'])
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
        except OSError as e:
            return jsonify({'status': 'error', 'message': _('Could not delete file: %(error)s', error=e)}), 500

        db.session.delete(image)
        db.session.commit()
        return jsonify({'status': 'success', 'message': _('Image deleted')})

    return jsonify({'status': 'error', 'message': _('Invalid item type')}), 400


@api_bp.route('/export_pdf', methods=['POST'])
def export_pdf():
    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': 'Invalid data'}), 400

    image_data = data.get('image_data', [])
    max_size = data.get('image_size', 100)
    layout_mode = data.get('layout_mode', 'chain')

    if not image_data:
        # Since this is an API endpoint, returning a JSON error is appropriate
        return jsonify({'status': 'error', 'message': _('No images to export')}), 400

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    # Define margins
    margin = 50
    x = margin
    y = height - margin
    row_max_height = 0

    for item in image_data:
        image_path_relative = item.get('path')
        description = item.get('description', '')

        if not image_path_relative:
            print(f"Image path is null")
            continue

        # The path from the client is relative to the pictograms folder
        base_path = Path(current_app.config['PICTOGRAMS_PATH'])
        image_path_absolute = base_path / image_path_relative

        if not image_path_absolute.exists():
            # Let's also check the legacy path for built-in images (e.g. folder icons)
            # This is a fallback for images that are not in the external pictograms folder.
            legacy_path = Path(current_app.root_path) / 'static' / image_path_relative
            if not legacy_path.exists():
                print(f"Image not found in primary or legacy path: {image_path_absolute}")
                continue
            image_path_absolute = legacy_path

        try:
            # Get original dimensions using Pillow
            with PILImage.open(image_path_absolute) as img:
                img_width, img_height = img.size

            # Calculate scaled dimensions preserving aspect ratio
            aspect = img_height / float(img_width) if img_width else 0
            if img_width >= img_height:
                scaled_width = max_size
                scaled_height = max_size * aspect
            else:
                scaled_height = max_size
                scaled_width = max_size / aspect if aspect else 0

            # --- Layout Logic ---
            if layout_mode == 'chain':
                # Check for page break (image + description)
                desc_height = 15 if description else 0
                if y - scaled_height - desc_height < margin:
                    c.showPage()
                    y = height - margin

                # Draw image (centered)
                img_x = (width - scaled_width) / 2
                y -= scaled_height
                c.drawImage(ImageReader(image_path_absolute), img_x, y, width=scaled_width, height=scaled_height, mask='auto')

                # Draw description (centered)
                if description:
                    y -= desc_height
                    c.setFont("Helvetica", 10)
                    c.drawCentredString(width / 2.0, y, description)

                y -= 10 # Padding between items

            elif layout_mode == 'grid':
                # Check if image fits on the current line
                if x + scaled_width > width - margin:
                    x = margin # Reset to left margin
                    y -= (row_max_height + 10) # Move down by height of previous row
                    row_max_height = 0 # Reset row height

                # Check if the new line fits on the page
                if y - scaled_height < margin:
                    c.showPage()
                    x = margin
                    y = height - margin
                    row_max_height = 0

                # Draw image
                c.drawImage(ImageReader(image_path_absolute), x, y - scaled_height, width=scaled_width, height=scaled_height, mask='auto')
                row_max_height = max(row_max_height, scaled_height) # Update max height for the current row
                x += scaled_width + 10 # Move x for next image

        except Exception as e:
            print(f"Error processing image {image_path}: {e}")
            continue

    c.save()
    buffer.seek(0)

    return send_file(
        buffer,
        as_attachment=True,
        download_name='pictogram_list.pdf',
        mimetype='application/pdf'
    )
