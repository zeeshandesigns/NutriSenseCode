from flask import Blueprint, jsonify
from predict import get_class_index, is_model_loaded

health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model_loaded": is_model_loaded(),
        "classes": len(get_class_index()),
    })
