import json
from flask import render_template, flash, redirect, url_for, Blueprint, request, session, jsonify
from app import db
from app.forms import LoginForm, RegistrationForm
from flask_login import current_user, login_user, logout_user, login_required
from app.models import User, Image, Tree

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

@bp.route('/language/<language>')
def set_language(language=None):
    session['language'] = language
    return redirect(request.referrer)

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
