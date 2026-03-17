from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from app.models import User

# Création du Blueprint dédié au mobile
bp = Blueprint('mobile_api', __name__, url_prefix='/api/v1/mobile')

@bp.route('/login', methods=['POST'])
def login():
    """
    Route de connexion pour l'application Android.
    Attend un payload JSON : {"username": "...", "password": "..."}
    Retourne un JWT (Access Token) si succès.
    """
    # 1. Récupérer les données envoyées par Android (Retrofit)
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({"error": "Nom d'utilisateur ou mot de passe manquant"}), 400

    # 2. Chercher l'utilisateur dans la BDD
    user = User.query.filter_by(username=data['username']).first()

    # 3. Vérifier l'existence et le mot de passe
    if user is None or not user.check_password(data['password']):
        return jsonify({"error": "Nom d'utilisateur ou mot de passe invalide"}), 401

    # 4. Vérifier si le compte est confirmé (comme sur ton auth.py)
    if not user.confirmed:
        return jsonify({
            "error": "Compte non confirmé. Veuillez vérifier vos emails.",
            "code": "ACCOUNT_NOT_CONFIRMED" # Pratique pour qu'Android affiche un message spécifique
        }), 403

    # 5. Tout est bon ! On génère le Token JWT (qui a pour "identité" l'ID de l'user)
    access_token = create_access_token(identity=str(user.id))

    # 6. On renvoie le Token et quelques infos de base en JSON
    return jsonify({
        "message": "Connexion réussie",
        "access_token": access_token,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
    }), 200