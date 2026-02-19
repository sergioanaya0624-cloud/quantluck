# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import motor

app = Flask(__name__)

# CORS ampliado: acepta del proxy (3001), live server (5500) y cualquier localhost
CORS(app, origins=[
    'http://127.0.0.1:3001',
    'http://localhost:3001',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://127.0.0.1:5000',
    'null'  # Para abrir index.html directo desde el sistema de archivos
])

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
    return "API Predictor de Loterías Colombia 🚀"


@app.route("/api/loterias", methods=["GET"])
def get_loterias():
    return jsonify({
        "loterias": LOTERIAS,
        "total": len(LOTERIAS),
        "timestamp": datetime.now().isoformat()
    })


@app.route("/api/analizar", methods=["POST", "OPTIONS"])
def analizar():
    # Preflight CORS
    if request.method == 'OPTIONS':
        return '', 200

    try:
        payload = request.get_json(silent=True) or {}
        historial = payload.get("historial", [])
        config = payload.get("config", {})

        if not historial or len(historial) < 2:
            return jsonify({
                "error": "Se necesitan al menos 2 sorteos",
                "recomendacion_principal": None,
                "top5": []
            }), 400

        # Llamar al motor de análisis
        resultado = motor.analizar_sorteos(historial, config)
        return jsonify(resultado)

    except Exception as e:
        print(f"❌ Error en /api/analizar: {e}")
        return jsonify({
            "error": str(e),
            "recomendacion_principal": None,
            "top5": []
        }), 500


@app.route("/api/status", methods=["GET"])
def status():
    return jsonify({
        "status": "online",
        "version": "3.0",
        "puerto": 5000,
        "timestamp": datetime.now().isoformat()
    })


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Ruta no encontrada", "ruta": request.path}), 404


if __name__ == "__main__":
    print("=" * 50)
    print("🚀 BACKEND LOTERÍA PREDICTOR")
    print("=" * 50)
    print(f"  URL:      http://127.0.0.1:5000")
    print(f"  Análisis: POST /api/analizar")
    print(f"  Loterías: GET  /api/loterias")
    print(f"  Estado:   GET  /api/status")
    print("=" * 50)
    app.run(debug=True, host='127.0.0.1', port=5000)