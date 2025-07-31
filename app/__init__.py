from flask import Flask, request, current_app, session
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from config import Config
from flask_wtf.csrf import CSRFProtect
from flask_login import LoginManager
from flask_babel import Babel, _

db = SQLAlchemy()
migrate = Migrate()
login = LoginManager()
login.login_view = 'main.login'
babel = Babel()
config_class = Config

def create_app( config_override = None):
    app = Flask(__name__)
    app.config.from_object(config_class)
    if config_override:
        app.config.update(config_override)
    csrf = CSRFProtect(app)
    db.init_app(app)
    migrate.init_app(app, db)
    login.init_app(app)
    babel.init_app(app, locale_selector=get_locale)

    from app.routes import bp as main_bp
    app.register_blueprint(main_bp)

    return app

def get_locale():
    if 'language' in session and session['language'] in current_app.config['LANGUAGES']:
        return session['language']
    return request.accept_languages.best_match(current_app.config['LANGUAGES'])
