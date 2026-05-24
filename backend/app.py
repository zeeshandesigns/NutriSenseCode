import os

from flask import Flask
from flask_cors import CORS

from gradcam_api import load_gradcam_index
from nutrition import load_nutrition_db
from predict import load_model
from routes.classes_bp import classes_bp
from routes.health_bp import health_bp
from routes.lookup_bp import lookup_bp
from routes.predict_bp import predict_bp

app = Flask(__name__)

CORS(app, resources={r"/*": {"origins": [
    "http://localhost:*",
    "https://*.vercel.app",
    "https://nutrisense*.vercel.app",
    "https://nutrisenseai.tech",
    "https://*.nutrisenseai.tech",
    "exp://localhost:*",
    "exp://*",
]}})

app.register_blueprint(predict_bp)
app.register_blueprint(health_bp)
app.register_blueprint(classes_bp)
app.register_blueprint(lookup_bp)

with app.app_context():
    load_model()
    load_nutrition_db()
    load_gradcam_index()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
