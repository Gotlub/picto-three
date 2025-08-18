from app import db, login
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from sqlalchemy import UniqueConstraint
from datetime import datetime, UTC

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

class Folder(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    parent_id = db.Column(db.Integer, db.ForeignKey('folder.id'))
    path = db.Column(db.String(256), nullable=False)

    user = db.relationship('User', backref=db.backref('folders', lazy=True))
    parent = db.relationship('Folder', remote_side=[id], backref=db.backref('children', lazy='dynamic'))
    images = db.relationship('Image', backref='folder', lazy='dynamic')

    def to_dict(self, include_children=False):
        data = {
            'id': self.id,
            'type': 'folder',
            'name': self.name,
            'user_id': self.user_id,
            'parent_id': self.parent_id,
            'path': self.path,
        }
        if include_children:
            data['children'] = [child.to_dict(include_children=True) for child in self.children] + \
                               [image.to_dict() for image in self.images]
        else:
            # Add a has_children flag to indicate that the folder is expandable
            has_subfolders = self.children.first() is not None
            has_images = self.images.first() is not None
            data['has_children'] = has_subfolders or has_images
        return data

    def __repr__(self):
        return f'<Folder {self.name}>'

class Image(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    path = db.Column(db.String(256))
    name = db.Column(db.String(64))
    description = db.Column(db.String(256))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    is_public = db.Column(db.Boolean, default=False)
    folder_id = db.Column(db.Integer, db.ForeignKey('folder.id'))

    def to_dict(self):
        return {
            'id': self.id,
            'type': 'image',
            'path': self.path,
            'name': self.name,
            'description': self.description,
            'user_id': self.user_id,
            'is_public': self.is_public,
            'folder_id': self.folder_id,
        }

    def __repr__(self):
        return '<Image {}>'.format(self.name)

class Tree(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    name = db.Column(db.String(64))
    is_public = db.Column(db.Boolean, default=False)
    json_data = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    user = db.relationship('User', backref=db.backref('trees', lazy=True))

    __table_args__ = (
        db.UniqueConstraint('user_id', 'name', name='_user_id_name_uc'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.user.username if self.user else None,
            'name': self.name,
            'is_public': self.is_public,
            'json_data': self.json_data,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

    def __repr__(self):
        return '<Tree {}>'.format(self.name)

class PictogramList(db.Model):
    __tablename__ = 'pictogram_list'
    id = db.Column(db.Integer, primary_key=True)
    list_name = db.Column(db.String(64), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True, index=True)
    is_public = db.Column(db.Boolean, default=False, index=True)
    payload = db.Column(db.Text, nullable=False) # Storing as JSON text
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    user = db.relationship('User', backref=db.backref('pictogram_lists', lazy=True))

    __table_args__ = (
        db.UniqueConstraint('user_id', 'list_name', name='_user_id_list_name_uc'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'list_name': self.list_name,
            'user_id': self.user_id,
            'username': self.user.username if self.user else None,
            'is_public': self.is_public,
            'payload': self.payload,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

    def __repr__(self):
        return f'<PictogramList {self.list_name}>'
