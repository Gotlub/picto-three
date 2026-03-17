from flask import render_template, flash, redirect, url_for, Blueprint, request, session, current_app
from flask_babel import _
from flask_login import current_user
from app.forms import ContactForm
from app.utils import send_email

bp = Blueprint('main', __name__)

@bp.route('/')
@bp.route('/index')
def index():
    return render_template('index.html', title='Home')

@bp.route('/legal')
def legal_page():
    return render_template('legal.html', title=_('Legal Information'))

@bp.route('/about', methods=['GET', 'POST'])
def about():
    form = ContactForm()
    if form.validate_on_submit():
        name = form.name.data
        email = form.email.data
        message = form.message.data
        send_email(
            current_app.config['ADMIN_EMAIL'],
            f'New message from {name}',
            'emails/contact_form.html',
            name=name,
            email=email,
            message_body=message
        )
        flash(_('Your message has been sent successfully!'), 'success')
        return redirect(url_for('main.about'))
    return render_template('about.html', title=_('About & Contact'), form=form)

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
        from app import db
        db.session.commit()
        flash(_('Your language has been updated.'))
    # Sinon, on sauvegarde le choix dans la session du navigateur
    else:
        session['locale'] = locale
        flash(_('The language has been updated for this session.'))

    # Redirige l'utilisateur vers la page où il se trouvait précédemment
    return redirect(request.referrer or url_for('main.index'))
