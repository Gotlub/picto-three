from flask_mail import Message
from flask import render_template, current_app
from app import mail
from itsdangerous import URLSafeTimedSerializer

def send_email(to, subject, template, **kwargs):
    """Fonction générique pour l'envoi d'e-mails."""
    msg = Message(subject, recipients=[to], sender=current_app.config['MAIL_DEFAULT_SENDER'])
    msg.html = render_template(template, **kwargs)
    mail.send(msg)

def generate_confirmation_token(email):
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    return serializer.dumps(email, salt='email-confirmation-salt')

def confirm_token(token, expiration=3600):
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    try:
        email = serializer.loads(token, salt='email-confirmation-salt', max_age=expiration)
        return email
    except:
        return False

def generate_password_reset_token(email):
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    return serializer.dumps(email, salt='password-reset-salt')

def confirm_password_reset_token(token, expiration=3600):
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    try:
        email = serializer.loads(token, salt='password-reset-salt', max_age=expiration)
        return email
    except:
        return False
