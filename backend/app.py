# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import motor

app = Flask(__name__)

# CORS abierto: acepta desde Vercel, local y cualquier origen
CORS(app, origins="*")


LOTERIAS = [
    {"id": "Loteria de Cruz Roja",    "nombre": "Lotería de la Cruz Roja"},
    {"id": "Loteria de Cundinamarca", "nombre": "Lotería de Cundinamarca"},
    {"id": "Loteria de Valle",        "nombre": "Lotería del Valle"},
    {"id": "Loteria de Bogota",       "nombre": "Lotería de Bogotá"},
    {"id": "Loteria de Medellín",     "nombre": "Lotería de Medellín"},
    {"id": "Loteria de Boyaca",       "nombre": "Lotería de Boyacá"},
    {"id": "Loteria de Tolima",       "nombre": "Lotería del Tolima"},
    {"id": "Loteria de Huila",        "nombre": "Lotería del Huila"},
    {"id": "Loteria de Meta",         "nombre": "Lotería del Meta"},
    {"id": "Loteria de Manizales",    "nombre": "Lotería de Manizales"},
    {"id": "Loteria de Quindio",      "nombre": "Lotería del Quindío"},
    {"id": "Loteria de Santander",    "nombre": "Lotería de Santander"},
    {"id": "Loteria de Risaralda",    "nombre": "Lotería de Risaralda"},
    {"id": "Loteria de Cauca",        "nombre": "Lotería del Cauca"}
]


@app.route("/")
def index():
    return jsonify({"status": "online", "servicio": "Lotería Predictor API"})


@app.route("/api/loterias", methods=["GET"])
def get_loterias():
    return jsonify({"loterias": LOTERIAS, "total": len(LOTERIAS)})


@app.route("/api/analizar", methods=["POST", "OPTIONS"])
def analizar():
    if request.method == 'OPTIONS':
        return '', 200

    try:
        payload   = request.get_json(silent=True) or {}
        historial = payload.get("historial", [])
        config    = payload.get("config", {})

        if not historial or len(historial) < 2:
            return jsonify({"error": "Se necesitan al menos 2 sorteos"}), 400

        resultado = motor.analizar_sorteos(historial, config)
        return jsonify(resultado)

    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/status", methods=["GET"])
def status():
    return jsonify({
        "status": "online",
        "version": "3.0",
        "timestamp": datetime.now().isoformat()
    })


if __name__ == "__main__":
    app.run(debug=False, host='0.0.0.0', port=5000)