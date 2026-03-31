from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.models import User, Tree
from app import db # Seulement besoin de db pour User et Tree maintenant
import json
from pathlib import Path
import posixpath
import urllib.parse

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
    limit_param = request.args.get('limit', 50, type=int)
    page_param = request.args.get('page', 1, type=int)

    query = Tree.query
    
    if is_public_param:
        query = query.filter(Tree.is_public == True)
    else:
        query = query.filter(Tree.user_id == current_user_id, Tree.is_public == False)
        
    if search_query:
        search_pattern = f"%{search_query.lower()}%"
        # Outer join pour sécuriser l'accès au User.username même si manquant
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
            # On nettoie le chemin pour garder juste "public/..." ou "username/..."
            norm_path = posixpath.normpath(urllib.parse.urlparse(thumbnail_url).path).lstrip('/')
            if norm_path.startswith('pictograms/'):
                norm_path = norm_path[len('pictograms/'):]
                
            # ON POINTE VERS LA NOUVELLE ROUTE MOBILE
            thumbnail_url = f"{request.host_url.rstrip('/')}/api/v1/mobile/pictograms/{norm_path}"
            
        result.append({
            'id': t.id,
            'name': t.name,
            'owner': t.user.username if t.user else 'System',
            'is_public': t.is_public,
            'root_image_url': thumbnail_url
        })
        
    return jsonify(result), 200


def _map_node_to_android_structure(web_node, host_url, current_username):
    """Transcripteur de noeuds pour Android avec injection de la bonne URL."""
    image_url = web_node.get('image') or web_node.get('url') or ''
    label = web_node.get('text') or web_node.get('name') or ''
    
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
                # ON POINTE VERS LA NOUVELLE ROUTE MOBILE ICI AUSSI !
                image_url = f"{host_url.rstrip('/')}/api/v1/mobile/pictograms/{norm_path}"
        
    children = web_node.get('children', [])
    mapped_children = [_map_node_to_android_structure(c, host_url, current_username) for c in children]
    
    return {
        'node_id': str(web_node.get('id', 'unsaved')),
        'label': label,
        'image_url': image_url,
        'children': mapped_children
    }


@bp.route('/trees/<int:tree_id>', methods=['GET'])
@jwt_required()
def get_tree(tree_id):
    """Renvoie le composite structuré d'un Arbre précis."""
    current_user_id = int(get_jwt_identity())
    current_user = db.session.get(User, current_user_id)
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
        return jsonify({'error': f'Erreur de formatage: {str(e)}'}), 500



@bp.route('/pictograms/<path:filepath>', methods=['GET'])
@jwt_required()
def serve_mobile_pictogram(filepath):
    """
    Route ultra-rapide pour Android : On vérifie juste les dossiers !
    """
    pictograms_path = Path(current_app.config['PICTOGRAMS_PATH'])
    
    # 1. Accès public = On envoie direct
    if filepath.startswith("public/"):
        return send_from_directory(pictograms_path, filepath)
        
    # 2. Récupération de l'utilisateur mobile via son Token JWT
    current_user_id = int(get_jwt_identity())
    current_user = db.session.get(User, current_user_id)
    
    if not current_user:
        return jsonify({"error": "Utilisateur introuvable"}), 404
    
    # 3. Vérification magique : Si le fichier demandé est dans le dossier qui porte son pseudo, c'est bon !
    if filepath.startswith(f"{current_user.username}/"):
        return send_from_directory(pictograms_path, filepath)
        
    # 4. Blocage pour tout le reste
    return send_from_directory(current_app.static_folder, 'images/prohibit-bold.png'), 403