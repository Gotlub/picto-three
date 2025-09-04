from flask import Flask, request, current_app, session, jsonify, redirect, url_for
from pathlib import Path
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from config import Config
from flask_wtf.csrf import CSRFProtect
from flask_login import LoginManager, current_user
from flask_babel import Babel, _
from flask_mail import Mail
from flask_bootstrap import Bootstrap

db = SQLAlchemy()
migrate = Migrate()
login = LoginManager()
login.login_view = 'main.login'
mail = Mail()
bootstrap = Bootstrap()

@login.unauthorized_handler
def unauthorized():
    if request.path.startswith('/api/'):
        return jsonify(error="unauthorized"), 401
    return redirect(url_for('main.login'))

babel = Babel()
config_class = Config

def create_app( config_override = None):
    app = Flask(__name__)
    app.config.from_object(config_class)
    if config_override:
        app.config.update(config_override)

    # Ensure the instance folder exists for sqlite
    if app.config['SQLALCHEMY_DATABASE_URI'].startswith('sqlite'):
        # In a Posix system, the path is absolute, so it starts with a '/'
        # and the replace will result in a path like '/path/to/db'
        # In Windows, the path is 'C:/path/to/db', so it does not start with '/'
        # and the replace will result in a path like 'C:/path/to/db'
        db_uri = app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', '')
        db_path = Path(db_uri)
        db_path.parent.mkdir(parents=True, exist_ok=True)

    # Ensure the pictograms folder exists
    pictograms_path = Path(app.config['PICTOGRAMS_PATH'])
    pictograms_path.mkdir(parents=True, exist_ok=True)

    csrf = CSRFProtect(app)
    from app.routes import api_bp
    csrf.exempt(api_bp)
    db.init_app(app)
    migrate.init_app(app, db)
    login.init_app(app)
    mail.init_app(app)
    babel.init_app(app, locale_selector=get_locale)
    bootstrap.init_app(app)
    app.babel_localeselector = get_locale
    from app.routes import bp as main_bp, api_bp
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp)

    return app

def get_locale():
    if current_user.is_authenticated and current_user.locale:
        return current_user.locale
    if 'locale' in session and session['locale'] in current_app.config['LANGUAGES']:
        return session['locale']
    return request.accept_languages.best_match(current_app.config['LANGUAGES'])