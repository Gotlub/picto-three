from flask import render_template, Blueprint, request, flash, json
from flask_babel import _
from flask_login import current_user, login_required
from sqlalchemy import or_
from app.models import Folder, Image

bp = Blueprint('builder', __name__)

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
