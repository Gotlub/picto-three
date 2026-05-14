from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from app.models import User, Tree, Profile, ProfileTree
from app import db 
import json
from pathlib import Path
import posixpath
import re

# Création du Blueprint dédié au mobile
bp = Blueprint('mobile_api', __name__, url_prefix='/api/v1/mobile')

@bp.route('/login', methods=['POST'])
def login():
    """Route de connexion pour l'application Android."""
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({"error": "Nom d'utilisateur ou mot de passe manquant"}), 400

    user = User.query.filter_by(username=data['username']).first()

    if user is None or not user.check_password(data['password']):
        return jsonify({"error": "Nom d'utilisateur ou mot de passe invalide"}), 401

    if not user.confirmed:
        return jsonify({
            "error": "Compte non confirmé. Veuillez vérifier vos emails.",
            "code": "ACCOUNT_NOT_CONFIRMED"
        }), 403

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        "message": "Connexion réussie",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
    }), 200


@bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Renouvellement du access_token via un refresh_token valide."""
    identity = get_jwt_identity()
    access_token = create_access_token(identity=identity)
    return jsonify(access_token=access_token), 200


@bp.route('/trees', methods=['GET'])
@jwt_required()
def list_trees():
    """Retourne la liste simplifiée des arbres accessibles avec URLs normalisées."""
    current_user_id = int(get_jwt_identity())
    
    search_query = request.args.get('search', '').strip()
    limit_param = max(1, min(100, request.args.get('limit', 50, type=int)))
    page_param = max(1, request.args.get('page', 1, type=int))

    query = Tree.query.filter(Tree.user_id == current_user_id)
        
    if search_query:
        search_pattern = f"%{search_query.lower()}%"
        query = query.filter(Tree.name.ilike(search_pattern))
        
    offset_param = (page_param - 1) * limit_param
    trees = query.offset(offset_param).limit(limit_param).all()
    
    result = []
    host_url = request.host_url
    for t in trees:
        result.append({
            'id': t.id,
            'name': t.name,
            'owner': t.user.username if t.user else 'System',
            'is_public': t.is_public,
            'root_image_url': _get_full_url(t.root_url, host_url),
            'root_thumbnail_url': _get_thumb_url(t.root_url, host_url)
        })
        
    return jsonify(result), 200


@bp.route('/profiles', methods=['GET'])
@jwt_required()
def list_profiles():
    """Liste les profils de l'utilisateur pour synchronisation."""
    current_user_id = int(get_jwt_identity())
    profiles = Profile.query.filter_by(user_id=current_user_id).all()
    
    result = []
    host_url = request.host_url
    for p in profiles:
        p_dict = p.to_dict()
        # Normalisation intelligente de l'avatar
        p_dict['remote_avatar_url'] = _get_full_url(p.remote_avatar_url, host_url)
        result.append(p_dict)
        
    return jsonify(result), 200


@bp.route('/profiles/<int:profile_id>', methods=['GET'])
@jwt_required()
def get_profile_details(profile_id):
    """Renvoie les détails d'un profil avec arbres et avatar normalisés."""
    current_user_id = int(get_jwt_identity())
    profile = Profile.query.filter_by(id=profile_id, user_id=current_user_id).first()
    
    if not profile:
        return jsonify({"error": "Profil introuvable"}), 404
        
    tree_refs = ProfileTree.query.filter_by(profile_id=profile_id).order_by(ProfileTree.display_order).all()
    
    trees_config = []
    for ref in tree_refs:
        trees_config.append({
            'tree_id': ref.tree_id,
            'colorCode': ref.colorCode or '#000000'
        })
    
    result = profile.to_dict()
    result['remote_avatar_url'] = _get_full_url(profile.remote_avatar_url, request.host_url)
    result['trees'] = trees_config
    
    return jsonify(result), 200


@bp.route('/trees/<int:tree_id>', methods=['GET'])
@jwt_required()
def get_tree(tree_id):
    """Renvoie le composite structuré d'un Arbre précis."""
    current_user_id = int(get_jwt_identity())
    current_user = db.session.get(User, current_user_id)
    tree = db.session.get(Tree, tree_id)
    
    if not tree or tree.user_id != current_user_id:
        return jsonify({'error': 'Accès refusé ou introuvable'}), 403
        
    try:
        raw_json_data = json.loads(tree.json_data)
        roots = raw_json_data.get('roots', [])
        root_node = None
        if roots:
            root_node = _map_node_to_android_structure(roots[0], request.host_url, current_user.username)
            
        return jsonify({
            'tree_id': tree.id,
            'name': tree.name,
            'root_node': root_node
        }), 200
    except Exception as e:
        current_app.logger.error(f"Erreur de formatage dans get_tree (ID: {tree_id}): {e}")
        return jsonify({'error': "Une erreur interne est survenue lors du formatage de l'arbre."}), 500


@bp.route('/pictograms/<path:filepath>', methods=['GET'])
@jwt_required(optional=True)
def serve_mobile_pictogram(filepath):
    """Distribution des images standards."""
    filepath = posixpath.normpath(filepath)
    if filepath.startswith('..') or posixpath.isabs(filepath):
        return jsonify({"error": "Invalid path"}), 400

    pictograms_path = Path(current_app.config['PICTOGRAMS_PATH'])
    
    if filepath.startswith('public/'):
        return send_from_directory(pictograms_path, filepath)
    else:
        current_user_id = get_jwt_identity()
        if not current_user_id:
            return jsonify({'error': 'Auth required'}), 401
        current_user = db.session.get(User, int(current_user_id))
        if current_user and filepath.startswith(f"{current_user.username}/"):
            return send_from_directory(pictograms_path, filepath)
        return jsonify({"error": "Forbidden"}), 403


@bp.route('/pictogramsmin/<path:filepath>', methods=['GET'])
@jwt_required(optional=True)
def serve_mobile_pictogram_min(filepath):
    """Distribution des miniatures."""
    import os
    filepath = posixpath.normpath(filepath)
    thumb_filename, _ = os.path.splitext(filepath)
    thumb_path_relative = thumb_filename + ".png"
    
    pictograms_min_path = Path(current_app.config['PICTOGRAMS_PATH_MIN'])
    
    if filepath.startswith('public/'):
        return send_from_directory(pictograms_min_path, thumb_path_relative)
    else:
        current_user_id = get_jwt_identity()
        if not current_user_id:
            return jsonify({'error': 'Auth required'}), 401
        current_user = db.session.get(User, int(current_user_id))
        if current_user and filepath.startswith(f"{current_user.username}/"):
            return send_from_directory(pictograms_min_path, thumb_path_relative)
        return jsonify({"error": "Forbidden"}), 403


def _get_full_url(raw_path, host_url):
    """Normalisateur AGILE : Détecte le bon endpoint (min ou full) et nettoie les doublons."""
    if not raw_path:
        return ""
    if raw_path.startswith(('http://', 'https://')):
        return raw_path
    
    # Détection : Est-ce une miniature ?
    is_min = "pictogramsmin" in raw_path
    
    # Nettoyage des préfixes existants pour éviter pictograms/pictogramsmin/...
    norm_path = re.sub(r'^/+', '', raw_path)
    norm_path = re.sub(r'^(pictograms/|images/|pictogramsmin/)', '', norm_path)
    
    endpoint = "pictogramsmin" if is_min else "pictograms"
    return f"{host_url.rstrip('/')}/api/v1/mobile/{endpoint}/{norm_path}"


def _get_thumb_url(raw_path, host_url):
    """Alias pour forcer le format miniature."""
    if not raw_path:
        return ""
    if raw_path.startswith(('http://', 'https://')):
        return raw_path
    norm_path = re.sub(r'^/+', '', raw_path)
    norm_path = re.sub(r'^(pictograms/|images/|pictogramsmin/)', '', norm_path)
    return f"{host_url.rstrip('/')}/api/v1/mobile/pictogramsmin/{norm_path}"


def _map_node_to_android_structure(web_node, host_url, current_username):
    image_url = web_node.get('image') or web_node.get('url') or ''
    web_label = web_node.get('text') or web_node.get('name') or ''
    description = web_node.get('description') or web_label
    
    full_url = _get_full_url(image_url, host_url)
    
    children = web_node.get('children', [])
    mapped_children = [_map_node_to_android_structure(c, host_url, current_username) for c in children]
    return {
        'node_id': str(web_node.get('id', 'unsaved')),
        'label': description,
        'description': description,
        'image_url': full_url,
        'children': mapped_children
    }
