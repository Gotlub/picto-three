from pathlib import Path

from flask import Flask, current_app, jsonify, redirect, request, session, url_for
from flask_babel import Babel
from flask_bootstrap import Bootstrap
from flask_jwt_extended import JWTManager
from flask_login import LoginManager, current_user
from flask_mail import Mail
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask_wtf.csrf import CSRFProtect

from config import Config

from .extensions import sitemap

db = SQLAlchemy()
migrate = Migrate()
login = LoginManager()
login.login_view = 'auth.login'
mail = Mail()
bootstrap = Bootstrap()
jwt = JWTManager()

@login.unauthorized_handler
def unauthorized():
    if request.path.startswith('/api/'):
        return jsonify(error="unauthorized"), 401
    return redirect(url_for('auth.login'))

babel = Babel()
config_class = Config

def create_app(config_override=None):
    app = Flask(__name__)
    app.config.from_object(config_class)
    if config_override:
        app.config.update(config_override)

    # Ensure the instance folder exists for sqlite
    if app.config['SQLALCHEMY_DATABASE_URI'].startswith('sqlite'):
        db_uri = app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', '')
        if db_uri.startswith('/data'):
            db_uri = db_uri.replace('/data', '/app/data', 1)
            app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_uri}'
        db_path = Path(db_uri)
        db_path.parent.mkdir(parents=True, exist_ok=True)

    # Ensure the pictograms folders exist
    pictograms_path = Path(app.config['PICTOGRAMS_PATH'])
    if str(pictograms_path).startswith('/data'):
        pictograms_path = Path(str(pictograms_path).replace('/data', '/app/data', 1))
        app.config['PICTOGRAMS_PATH'] = pictograms_path
    pictograms_path.mkdir(parents=True, exist_ok=True)

    pictograms_path_min = Path(app.config['PICTOGRAMS_PATH_MIN'])
    if str(pictograms_path_min).startswith('/data'):
        pictograms_path_min = Path(str(pictograms_path_min).replace('/data', '/app/data', 1))
        app.config['PICTOGRAMS_PATH_MIN'] = pictograms_path_min
    pictograms_path_min.mkdir(parents=True, exist_ok=True)

    csrf = CSRFProtect(app)
    from app.routes import api
    
    db.init_app(app)
    migrate.init_app(app, db)
    login.init_app(app)
    mail.init_app(app)
    babel.init_app(app, locale_selector=get_locale)
    bootstrap.init_app(app)
    sitemap.init_app(app)

    # JWT Configuration for mobile API
    jwt.init_app(app)

    def public_page_generator():
        yield 'main.index', {}
        yield 'builder.builder', {}
        yield 'builder.list_page', {}
    sitemap.register_generator(public_page_generator)

    app.babel_localeselector = get_locale

    # Register Blueprints
    from app.routes import auth, builder, files, main, mobile_api
    # api is already imported above
    app.register_blueprint(auth.bp)
    app.register_blueprint(main.bp)
    app.register_blueprint(builder.bp)
    app.register_blueprint(api.bp)
    app.register_blueprint(files.bp)
    app.register_blueprint(mobile_api.bp)
    csrf.exempt(mobile_api.bp) #a garder on va utiliser des jeutons pour la partie mobile.

    @app.cli.command('generate-sitemap')
    def generate_sitemap():
        """Génère le fichier sitemap.xml statique."""
        try:
            with app.app_context():
                app.config["SERVER_NAME"] = "pictotree.eu"
                # Removed PREFERRED_URL_SCHEME assignment
                xml_content = sitemap.sitemap()
            sitemap_path = Path(app.static_folder) / 'sitemap.xml'
            with open(sitemap_path, 'w', encoding='utf-8') as f:
                f.write(xml_content)
            print(f"✅ Sitemap généré avec succès dans {sitemap_path}")
        except (OSError, RuntimeError) as e:
            print(f"❌ Erreur lors de la génération du sitemap : {e}")

    # Warn if default insecure secret key is used in non-testing environment
    if app.config.get('SECRET_KEY') == 'you-will-never-guess' and not app.testing and not app.debug:
        app.logger.warning("SECURITY WARNING: Using default insecure SECRET_KEY. Set SECRET_KEY environment variable in production!")

    @app.after_request
    def set_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = 'geolocation=(), camera=(), microphone=()'
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://www.google.com https://www.gstatic.com; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
            "font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com https://cdnjs.cloudflare.com data:; "
            "img-src 'self' data: blob: https://api.arasaac.org https://commons.wikimedia.org; "
            "connect-src 'self' https://api.arasaac.org; "
            "frame-src 'self' https://www.youtube.com https://www.google.com; "
            "object-src 'none'; "
            "base-uri 'self';"
        )
        response.headers['Content-Security-Policy'] = csp
        return response

    # Expose get_locale to templates
    app.jinja_env.globals.update(get_locale=get_locale)

    return app

def get_locale():
    if current_user.is_authenticated and current_user.locale:
        return current_user.locale
    if 'locale' in session and session['locale'] in current_app.config['LANGUAGES']:
        return session['locale']
    return request.accept_languages.best_match(current_app.config['LANGUAGES'])