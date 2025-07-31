from app import db, login
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin

@login.user_loader
def load_user(id):
    return User.query.get(int(id))

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(120), index=True, unique=True)
    password_hash = db.Column(db.String(128))

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return '<User {}>'.format(self.username)

class Image(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    path = db.Column(db.String(256))
    name = db.Column(db.String(64))
    description = db.Column(db.String(256))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    is_public = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'path': self.path,
            'name': self.name,
            'description': self.description,
            'user_id': self.user_id,
            'is_public': self.is_public,
        }

    def __repr__(self):
        return '<Image {}>'.format(self.name)

class Tree(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    name = db.Column(db.String(64))
    is_public = db.Column(db.Boolean, default=False)
    json_data = db.Column(db.Text)

    def __repr__(self):
        return '<Tree {}>'.format(self.name)
