"""
GET /lookup?label=<food_label>&user_goal=<goal>

Returns fresh nutrition + insight for a known food label, without re-running
inference. Used by the mobile/web confirm screen — when the user picks a
top-3 alternative, the client needs the alternative's nutrition + insight
(not the original top-1's), and asking the model again would just return
the same answer. This endpoint short-circuits that.
"""

from flask import Blueprint, jsonify, request

from insights import generate_insight
from nutrition import get_nutrition

lookup_bp = Blueprint("lookup", __name__)


@lookup_bp.route("/lookup", methods=["GET"])
def lookup():
    label = (request.args.get("label") or "").strip()
    if not label:
        return jsonify({"error": "label query parameter is required"}), 400

    user_goal = request.args.get("user_goal", "curious")
    nutrition = get_nutrition(label)
    insight   = generate_insight(label, nutrition, user_goal)

    return jsonify({
        "label":     label,
        "nutrition": nutrition,
        "insight":   insight,
    })
