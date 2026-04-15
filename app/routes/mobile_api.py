from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.models import User, Tree, Image
from app import db 
import json
from pathlib import Path
import posixpath
import urllib.parse
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

    return jsonify({
        "message": "Connexion réussie",
        "access_token": access_token,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
    }), 200


@bp.route('/trees', methods=['GET'])
@jwt_required()
def list_trees():
    """Retourne la liste simplifiée des arbres accessibles (Métadonnées) avec pagination et recherche."""
    current_user_id = int(get_jwt_identity())
    
    is_public_param = request.args.get('is_public', 'true').lower() == 'true'
    search_query = request.args.get('search', '').strip()
    limit_param = max(1, min(100, request.args.get('limit', 50, type=int)))
    page_param = max(1, request.args.get('page', 1, type=int))

    query = Tree.query
    
    if is_public_param:
        query = query.filter(Tree.is_public)
    else:
        query = query.filter(Tree.user_id == current_user_id, Tree.is_public.is_(False))
        
    if search_query:
        search_pattern = f"%{search_query.lower()}%"
        query = query.join(User, Tree.user_id == User.id, isouter=True)
        query = query.filter(
            db.or_(
                db.func.lower(Tree.name).like(search_pattern),
                db.func.lower(User.username).like(search_pattern)
            )
        )
        
    offset_param = (page_param - 1) * limit_param
    trees = query.offset(offset_param).limit(limit_param).all()
    
    result = []
    for t in trees:
        thumbnail_url = t.root_url or ""
        if thumbnail_url and not thumbnail_url.startswith('http'):
            norm_path = posixpath.normpath(urllib.parse.urlparse(thumbnail_url).path).lstrip('/')
            if norm_path.startswith('pictograms/'):
                norm_path = norm_path[len('pictograms/'):]
            thumbnail_url = f"{request.host_url.rstrip('/')}/api/v1/mobile/pictograms/{norm_path}"
            
        result.append({
            'id': t.id,
            'name': t.name,
            'owner': t.user.username if t.user else 'System',
            'is_public': t.is_public,
            'root_image_url': thumbnail_url
        })
        
    return jsonify(result), 200


def _extract_description_from_path(filepath):
    """
    Système évolutif pour extraire la description d'une image selon sa banque d'origine,
    si celle-ci n'est pas répertoriée dans la base de données relationnelle.
    """
    import os
    basename = os.path.basename(filepath)
    name_without_ext = os.path.splitext(basename)[0]
    
    # Stratégie pour la banque Arasaac
    if "public/arasaac/" in filepath:
        # Ex: '1234_manger_du_pain.png' -> 'manger du pain'
        clean_name = re.sub(r'^\d+_', '', name_without_ext)
        clean_name = clean_name.replace('_', ' ').replace('-', ' ')
        return clean_name.capitalize()
        
    # [Placeholder] Stratégie pour une future banque
    # elif "public/sclera/" in filepath:
    #     ...
        
    # Stratégie par défaut (nettoyage simple)
    return name_without_ext.replace('_', ' ').capitalize()


def _map_node_to_android_structure(web_node, host_url, current_username):
    """Transcripteur de noeuds pour Android avec injection de la bonne URL."""
    image_url = web_node.get('image') or web_node.get('url') or ''
    web_label = web_node.get('text') or web_node.get('name') or ''
    description = web_node.get('description') or web_label
    
    # On utilise la description comme label principal pour l'affichage Android (Demande utilisateur)
    label = description
    
    if image_url:
        if image_url.startswith(('http://', 'https://')):
            pass
        else:
            norm_path = posixpath.normpath(urllib.parse.urlparse(image_url).path).lstrip('/')
            if norm_path.startswith('pictograms/'):
                norm_path = norm_path[len('pictograms/'):]
            elif norm_path.startswith('images/'):
                norm_path = norm_path[len('images/'):]
                
            if not (norm_path.startswith('public/') or norm_path.startswith(f"{current_username}/")):
                image_url = "" 
            else:
                image_url = f"{host_url.rstrip('/')}/api/v1/mobile/pictograms/{norm_path}"
        
    children = web_node.get('children', [])
    mapped_children = [_map_node_to_android_structure(c, host_url, current_username) for c in children]
    
    return {
        'node_id': str(web_node.get('id', 'unsaved')),
        'label': label,
        'description': description,
        'image_url': image_url,
        'children': mapped_children
    }


@bp.route('/trees/<int:tree_id>', methods=['GET'])
@jwt_required()
def get_tree(tree_id):
    """Renvoie le composite structuré d'un Arbre précis."""
    current_user_id = int(get_jwt_identity())
    current_user = db.session.get(User, current_user_id)
    
    if not current_user:
        return jsonify({'error': 'Utilisateur non trouvé'}), 404

    tree = db.session.get(Tree, tree_id)
    
    if not tree:
        return jsonify({'error': 'Arbre non trouvé'}), 404
        
    if not tree.is_public and tree.user_id != current_user_id:
        return jsonify({'error': 'Accès refusé.'}), 403
        
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
        current_app.logger.error(f"Erreur de formatage dans get_tree (ID: {tree_id}): {str(e)}")
        return jsonify({'error': "Une erreur interne est survenue lors du formatage de l'arbre."}), 500



@bp.route('/pictograms/<path:filepath>', methods=['GET'])
@jwt_required(optional=True)
def serve_mobile_pictogram(filepath):
    """Distribution des images."""
    from flask import abort
    filepath = posixpath.normpath(filepath)
    if filepath.startswith('..') or posixpath.isabs(filepath):
        return abort(400)

    pictograms_path = Path(current_app.config['PICTOGRAMS_PATH'])
    
    response = None
    
    if filepath.startswith('public/'):
        response = send_from_directory(pictograms_path, filepath)
    else:
        current_user_id = get_jwt_identity()
        if not current_user_id:
            return jsonify({'error': 'Non autorisé. Token manquant ou invalide.'}), 401
            
        current_user = db.session.get(User, int(current_user_id))
        
        if not current_user:
            return jsonify({"error": "Utilisateur introuvable"}), 404
        
        if filepath.startswith(f"{current_user.username}/"):
            response = send_from_directory(pictograms_path, filepath)
        else:
            return send_from_directory(current_app.static_folder, 'images/prohibit-bold.png'), 403

    if response:
        # Récupération de la description ou du nom depuis la base de données
        img = Image.query.filter(Image.path.endswith(filepath)).first()
        
        real_desc = None
        if img:
            real_desc = img.description if img.description and img.description.strip() else img.name
            
        # Fallback évolutif selon les banques (Arasaac, etc.) si absente ou vide de la DB
        if not real_desc or not str(real_desc).strip():
            real_desc = _extract_description_from_path(filepath)
            
        if real_desc:
            response.headers['X-Image-Description'] = urllib.parse.quote(str(real_desc).encode('utf-8'))
        return response


@bp.route('/pictograms/search', methods=['GET'])
@jwt_required()
def search_pictograms():
    """Recherche des pictogrammes (Public + Perso) pour l'application mobile."""
    from app.models import Image
    from sqlalchemy import or_
    
    current_user_id = int(get_jwt_identity())
    current_user = db.session.get(User, current_user_id)
    if not current_user:
        return jsonify({'error': 'User not found'}), 404

    q = request.args.get('q', '').strip()
    if len(q) < 1:
        return jsonify([])
        
    conditions = [
        Image.user_id.is_(None),
        Image.is_public.is_(True),
        Image.user_id == current_user_id
    ]
        
    images = Image.query.filter(or_(*conditions)).filter(Image.name.ilike(f'%{q}%')).limit(100).all()
    
    results = []
    for img in images:
        raw_url = img.path
        # Nettoyage et formatage URL Mobile
        norm_path = re.sub(r'^/+', '', raw_url)
        norm_path = re.sub(r'^(pictograms/|images/)', '', norm_path)
        full_url = f"{request.host_url.rstrip('/')}/api/v1/mobile/pictograms/{norm_path}"
        
        results.append({
            'id': img.id,
            'name': img.name,
            'image_url': full_url
        })
        
    return jsonify(results), 200
