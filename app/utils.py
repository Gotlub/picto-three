import re
from smtplib import SMTPException
from flask_mail import Message
from flask import render_template, current_app
from app import mail
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature

EMAIL_CONFIRMATION_SALT = 'email-confirmation-salt'
PASSWORD_RESET_SALT = 'password-reset-salt'
EMAIL_REGEX = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

def send_email(to, subject, template, **kwargs):
    """Fonction générique pour l'envoi d'e-mails."""
    if not EMAIL_REGEX.match(to):
        current_app.logger.error(f"Adresse e-mail invalide : {to}")
        return False
        
    msg = Message(subject, recipients=[to], sender=current_app.config['MAIL_DEFAULT_SENDER'])
    msg.html = render_template(template, **kwargs)
    try:
        mail.send(msg)
        return True
    except SMTPException as e:
        current_app.logger.error(f"Échec de l'envoi d'e-mail à {to} : {e}")
        return False
    except Exception as e:
        current_app.logger.error(f"Erreur inattendue lors de l'envoi d'e-mail à {to} : {e}")
        return False

def generate_confirmation_token(email):
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    return serializer.dumps(email, salt=EMAIL_CONFIRMATION_SALT)

def confirm_token(token, expiration=3600):
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    try:
        email = serializer.loads(token, salt=EMAIL_CONFIRMATION_SALT, max_age=expiration)
        return email
    except SignatureExpired:
        current_app.logger.info("Token de confirmation expiré.")
        return False
    except BadSignature:
        current_app.logger.warning("Token de confirmation avec signature invalide détecté.")
        return False
    except Exception as e:
        current_app.logger.error(f"Erreur inattendue lors de la validation du token : {e}")
        return False

def generate_password_reset_token(email):
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    return serializer.dumps(email, salt=PASSWORD_RESET_SALT)

def confirm_password_reset_token(token, expiration=3600):
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    try:
        email = serializer.loads(token, salt=PASSWORD_RESET_SALT, max_age=expiration)
        return email
    except SignatureExpired:
        current_app.logger.info("Token de reset expiré.")
        return False
    except BadSignature:
        current_app.logger.warning("Token de reset avec signature invalide détecté.")
        return False
    except Exception as e:
        current_app.logger.error(f"Erreur inattendue lors de la validation du token de reset : {e}")
        return False

