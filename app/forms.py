from flask_wtf import FlaskForm
from flask_wtf.recaptcha import RecaptchaField
from wtforms import StringField, PasswordField, BooleanField, SubmitField
from wtforms.validators import DataRequired, ValidationError, Email, EqualTo
from app.models import User
from flask_babel import lazy_gettext as _l
import re

def password_strength_validator(form, field):
    password = field.data
    errors = []
    if len(password) < 9:
        errors.append(str(_l('be at least 9 characters long')))
    if not re.search(r'[A-Z]', password):
        errors.append(str(_l('contain at least one uppercase letter')))
    if not re.search(r'[0-9]', password):
        errors.append(str(_l('contain at least one digit')))

    if errors:
        error_message = str(_l('Password must')) + ' ' + ', '.join(errors) + '.'
        raise ValidationError(error_message)

class LoginForm(FlaskForm):
    username = StringField(_l('Username'), validators=[DataRequired()])
    password = PasswordField(_l('Password'), validators=[DataRequired()])
    remember_me = BooleanField(_l('Remember Me'))
    submit = SubmitField(_l('Sign In'))

class RegistrationForm(FlaskForm):
    username = StringField(_l('Username'), validators=[DataRequired()])
    email = StringField(_l('Email'), validators=[DataRequired(), Email()])
    password = PasswordField(_l('Password'), validators=[DataRequired(), password_strength_validator])
    password2 = PasswordField(
        _l('Repeat Password'), validators=[DataRequired(), EqualTo('password')])
    recaptcha = RecaptchaField()
    submit = SubmitField(_l('Register'))

    def validate_username(self, username):
        user = User.query.filter_by(username=username.data).first()
        if user is not None:
            raise ValidationError(_l('Please use a different username.'))

    def validate_email(self, email):
        user = User.query.filter_by(email=email.data).first()
        if user is not None:
            raise ValidationError(_l('Please use a different email address.'))

class ChangePasswordForm(FlaskForm):
    current_password = PasswordField(_l('Current Password'), validators=[DataRequired()])
    new_password = PasswordField(_l('New Password'), validators=[DataRequired(), password_strength_validator])
    new_password2 = PasswordField(
        _l('Repeat New Password'), validators=[DataRequired(), EqualTo('new_password')])
    submit_change_password = SubmitField(_l('Change Password'))

class DeleteAccountForm(FlaskForm):
    username_confirm = StringField(_l('Username'), validators=[DataRequired()])
    submit_delete_account = SubmitField(_l('Delete My Account'))

class ForgotPasswordForm(FlaskForm):
    email = StringField(_l('Email'), validators=[DataRequired(), Email()])
    submit = SubmitField(_l('Request Password Reset'))

class ResetPasswordForm(FlaskForm):
    password = PasswordField(_l('Password'), validators=[DataRequired(), password_strength_validator])
    password2 = PasswordField(
        _l('Repeat Password'), validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField(_l('Reset Password'))

class ResendConfirmationForm(FlaskForm):
    email = StringField(_l('Email'), validators=[DataRequired(), Email()])
    submit = SubmitField(_l('Resend Confirmation Email'))
