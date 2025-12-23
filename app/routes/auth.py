from flask import render_template, flash, redirect, url_for, Blueprint, request, current_app
from flask_login import current_user, login_user, logout_user, login_required
from flask_babel import _
from markupsafe import Markup
from app import db
from app.forms import LoginForm, RegistrationForm, ChangePasswordForm, DeleteAccountForm, ForgotPasswordForm, ResetPasswordForm, ResendConfirmationForm
from app.models import User, Tree, PictogramList, Image, Folder
from app.utils import send_email, generate_confirmation_token, confirm_token, generate_password_reset_token, confirm_password_reset_token
from datetime import datetime, UTC
from pathlib import Path
import shutil

bp = Blueprint('auth', __name__)

@bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user is None or not user.check_password(form.password.data):
            flash(_('Invalid username or password'))
            return redirect(url_for('auth.login'))

        if not user.confirmed:
            flash(Markup(_('Your account is not confirmed. Please check your emails. <a href="%(url)s">Resend confirmation email?</a>', url=url_for('auth.resend_confirmation_request'))), 'warning')
            return redirect(url_for('auth.login'))

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
        confirm_url = url_for('auth.confirm_email_route', token=token, _external=True)
        send_email(user.email, 'Confirm Your Account', 'emails/confirm_email.html', confirm_url=confirm_url)

        flash(_('A confirmation email has been sent to your email address.'), 'success')
        return redirect(url_for('auth.login'))
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
        flash(_('The confirmation link is invalid or has expired.'), 'danger')
        return redirect(url_for('auth.login'))

    user = User.query.filter_by(email=email).first_or_404()
    if user.confirmed:
        flash(_('Account already confirmed. Please login.'), 'success')
    else:
        user.confirmed = True
        user.confirmed_on = datetime.now(UTC)
        db.session.commit()
        flash(_('Your account has been confirmed successfully!'), 'success')
    return redirect(url_for('auth.login'))

@bp.route('/resend_confirmation_request', methods=['GET', 'POST'])
def resend_confirmation_request():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    form = ResendConfirmationForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user:
            if user.confirmed:
                flash(_('This account is already confirmed. Please login.'), 'success')
                return redirect(url_for('auth.login'))
            else:
                token = generate_confirmation_token(user.email)
                confirm_url = url_for('auth.confirm_email_route', token=token, _external=True)
                send_email(user.email, 'Confirm Your Account', 'emails/confirm_email.html', confirm_url=confirm_url)
                flash(_('A new confirmation email has been sent.'), 'success')
                return redirect(url_for('auth.login'))
        else:
            flash(_('No account found with that email address. Please register.'), 'warning')
    return render_template('resend_confirmation_request.html', form=form)

@bp.route('/forgot_password', methods=['GET', 'POST'])
def forgot_password():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    form = ForgotPasswordForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user:
            token = generate_password_reset_token(user.email)
            reset_url = url_for('auth.reset_with_token_route', token=token, _external=True)
            send_email(user.email, 'Reset Your Password', 'emails/reset_password.html', reset_url=reset_url)
            flash(_('An email with instructions to reset your password has been sent.'), 'info')
        else:
            flash(_('No account found with that email address.'), 'warning')
        return redirect(url_for('auth.login'))
    return render_template('forgot_password.html', title='Forgot Password', form=form)

@bp.route('/reset/<token>', methods=['GET', 'POST'])
def reset_with_token_route(token):
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    email = confirm_password_reset_token(token)
    if not email:
        flash(_('The reset link is invalid or has expired.'), 'danger')
        return redirect(url_for('auth.login'))

    form = ResetPasswordForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=email).first_or_404()
        user.set_password(form.password.data)
        db.session.commit()
        flash(_('Your password has been reset successfully.'), 'success')
        return redirect(url_for('auth.login'))

    return render_template('reset_password_form.html', form=form)

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
    return redirect(url_for('auth.account'))

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
            user_pictogram_min_folder = Path(current_app.config['PICTOGRAMS_PATH_MIN']) / user.username
            if user_pictogram_min_folder.exists():
                shutil.rmtree(user_pictogram_min_folder)
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
            return redirect(url_for('auth.account'))
    else:
        flash(_('Invalid form submission.'), 'danger')
        return redirect(url_for('auth.account'))
