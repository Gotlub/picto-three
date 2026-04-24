# [👉 Visit PictoTree.eu](https://pictotree.eu)

## 🌟 Overview
**PictoTree** is a comprehensive and flexible platform designed for **Augmentative and Alternative Communication (AAC)**. Aiming to foster connection, it empowers communication partners to build personalized pictogram trees, supporting individuals with diverse communication and accessibility needs.

More information here 👉 [PictoTree.eu](https://pictotree.eu) 

This repository contains the **Web Backend & Dashboard** (built with Flask). It works in tandem with our **Native Android App**, which provides a unique spatial navigation interface for the end-user:

### 📱 [Get the Android App here (PictoTreeApp)](https://github.com/Gotlub/pictotreeApp)

---

### ⚠️ Project Status: Alpha
This project is currently in the **Alpha stage** and under active development. Features are subject to change. Contributions and feedback are highly welcome!

**License:** GNU AGPL v3 (See [LICENSE](LICENSE) file for details).

---

## 🛠 Technical Stack
- **Backend:** Python 3.10+ / [Flask](https://flask.palletsprojects.com/)
- **Database:** SQLite (SQLAlchemy) - Default path: `../data/app.db`
- **Frontend:** HTML5 / Bootstrap 5 / Treant.js / Vanilla JS
- **Internationalization (i18n):** [Flask-Babel](https://python-babel.github.io/flask-babel/)
- **Testing:** [Pytest](https://docs.pytest.org/)

---

## 🚀 Installation & Setup

### 1. Create Virtual Environment
```bash
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Database Setup
The database is expected to be located at `../data/app.db`.
```bash
flask db upgrade
```

### 4. Run the Application
```bash
flask run
# or
python -m flask run
```
The dashboard will be available at `http://127.0.0.1:5000`.

---

## 🔧 Developer Tools & Workarounds

### Creating an Admin User
Since the registration flow requires SMTP (Email) and Google reCAPTCHA secrets, you can use the following script to create a user manually:
```bash
python create_admin.py <username> <email> "<password>"
# Example:
python create_admin.py test teste@teste.com "Password123!"
```

### Importing Pictograms
To scan and add images to the database, place your images in `../data/pictograms/public` and run:
```bash
python add_test_images.py
```

---

## 🌐 Internationalization & Testing

### Running Tests
We use Pytest for backend and API coverage:
```bash
pytest -v
```

### Managing Translations
The project supports multiple languages (de, es, fr, it, nl, pl). To update translations after modifying templates:
```bash
# Extract strings
pybabel extract -F babel.cfg -k _l -o messages.pot .
# Update existing catalogs
pybabel update -i messages.pot -d app/translations
# Compile binary catalogs
pybabel compile -d app/translations
```
