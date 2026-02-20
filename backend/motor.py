# -*- coding: utf-8 -*-
import numpy as np
import pandas as pd
from itertools import product
from scipy.stats import entropy
import warnings
warnings.filterwarnings('ignore')


def analizar_sorteos(historial, config=None):
    """
    Adaptación del MOTOR V4
    Compatible con tu estructura original de la app.
    """

    # =========================
    # CONFIG BASE
    # =========================
    DEFAULT_CONFIG = {
        "decay_factor": 0.97,
        "topDigitos": 5,
        "topCombinaciones": 5,
        "ventana_tendencia": None,
        "penalizar_repetidos": True,
        "penalizar_secuencias": True,
        "bonus_recientes": True,
        "pesos": {
            "freq": 1.0,
            "bayes": 1.0,
            "markov": 1.2,
            "trend": 0.8,
            "season": 0.6
        }
    }

    if config is None:
        config = DEFAULT_CONFIG
    else:
        for k, v in DEFAULT_CONFIG.items():
            if k not in config:
                config[k] = v
            elif k == "pesos":
                for pk, pv in v.items():
                    if pk not in config["pesos"]:
                        config["pesos"][pk] = pv

    W_FREQ   = config["pesos"]["freq"]
    W_BAYES  = config["pesos"]["bayes"]
    W_MARKOV = config["pesos"]["markov"]
    W_TREND  = config["pesos"]["trend"]
    W_SEASON = config["pesos"]["season"]

    total_w = W_FREQ + W_BAYES + W_MARKOV + W_TREND + W_SEASON
    W_FREQ   /= total_w
    W_BAYES  /= total_w
    W_MARKOV /= total_w
    W_TREND  /= total_w
    W_SEASON /= total_w

    decay_factor = config["decay_factor"]
    top_digitos = config["topDigitos"]
    topN = config["topCombinaciones"]

    # =========================
    # DATAFRAME
    # =========================
    df = pd.DataFrame(historial)
    if len(df) == 0:
        return {
            "recomendacion_principal": None,
            "top5": [],
            "analisis_digitos": [],
            "estadisticas": {"error": "Sin datos"}
        }

    df["fecha"] = pd.to_datetime(df["fecha"])
    df = df.sort_values("fecha").reset_index(drop=True)

    df["Numero"] = df["numero"].astype(int).astype(str).str.zfill(4)

    for i in range(4):
        df[f"d{i}"] = df["Numero"].str[i].astype(int)

    n = len(df)
    df["peso"] = np.array([decay_factor ** (n - i - 1) for i in range(n)])
    peso_norm = df["peso"] / df["peso"].sum()

    digitos = df[[f"d{i}" for i in range(4)]].values
    ultimo = digitos[-1]

    if config["ventana_tendencia"] is None:
        ventana = max(10, min(50, int(n * 0.2)))
    else:
        ventana = min(config["ventana_tendencia"], n)

    # =========================
    # SEÑALES
    # =========================
    freq, bayes, markov, trend, season, entropy_pos = {}, {}, {}, {}, {}, {}

    for i in range(4):
        dig_i = digitos[:, i]

        # Frecuencia
        freq_i = np.zeros(10)
        for d in range(10):
            freq_i[d] = peso_norm[dig_i == d].sum()
        freq[i] = {d: freq_i[d] for d in range(10)}

        # Bayes
        alpha = 1
        total = freq_i.sum() + alpha * 10
        bayes[i] = {d: (freq_i[d] + alpha) / total for d in range(10)}

        # Markov
        matrix = np.zeros((10, 10))
        for j in range(len(dig_i) - 1):
            matrix[dig_i[j], dig_i[j + 1]] += df["peso"].iloc[j]
        row_sums = matrix.sum(axis=1, keepdims=True)
        matrix = np.divide(matrix, row_sums, where=row_sums > 0)
        matrix[row_sums.flatten() == 0] = np.ones(10) / 10
        markov[i] = matrix

        # Tendencia
        recientes = dig_i[-ventana:]
        trend_i = np.array([(recientes == d).sum() for d in range(10)])
        trend_i = trend_i / trend_i.sum() if trend_i.sum() > 0 else np.ones(10)/10
        trend[i] = {d: trend_i[d] for d in range(10)}

        # Estacionalidad simple
        season[i] = {d: 1/10 for d in range(10)}

        # Entropía
        p = freq_i / freq_i.sum() if freq_i.sum() > 0 else np.ones(10)/10
        entropy_pos[i] = entropy(p)

    # =========================
    # SCORE
    # =========================
    scores = {}

    for i in range(4):
        s = {}
        max_freq = max(freq[i].values()) or 1
        for d in range(10):
            base = (
                W_FREQ * np.log1p(freq[i][d] / max_freq) +
                W_BAYES * np.log1p(bayes[i][d]) +
                W_MARKOV * np.log1p(markov[i][ultimo[i], d]) +
                W_TREND * np.log1p(trend[i][d]) +
                W_SEASON * np.log1p(season[i][d])
            )
            factor_ent = 1 + 0.3 * (1 - entropy_pos[i] / np.log(10))
            s[d] = np.exp(base) * factor_ent

        scores[i] = dict(sorted(s.items(), key=lambda x: x[1], reverse=True))

    # =========================
    # COMBINACIONES
    # =========================
    top_digits = {i: list(scores[i].keys())[:top_digitos] for i in range(4)}
    candidatos = []

    for combo in product(*[top_digits[i] for i in range(4)]):
        numero_str = "".join(map(str, combo))
        score_base = np.mean([scores[i][combo[i]] for i in range(4)])

        pen = 0
        if config["penalizar_repetidos"]:
            if len(set(combo)) == 1:
                pen += 0.1

        if config["penalizar_secuencias"]:
            if all(combo[j] == combo[0] + j for j in range(4)):
                pen += 0.06

        score_final = score_base * (1 - pen)

        candidatos.append({
            "numero": int(numero_str),
            "score": score_final,
            "digitos": list(combo)
        })

    candidatos = sorted(candidatos, key=lambda x: x["score"], reverse=True)
    top5 = candidatos[:topN]

    # =========================
    # NORMALIZAR UI
    # =========================
    max_s = top5[0]["score"]
    min_s = top5[-1]["score"] if len(top5) > 1 else 0

    for rank, c in enumerate(top5):
        if max_s > min_s:
            c["score"] = round(0.5 + 0.5*(c["score"]-min_s)/(max_s-min_s), 4)
        else:
            c["score"] = round(1 - rank*0.05, 4)

        c["confianza"] = round(85 - rank*7, 1)
        c["diferencia"] = 0 if rank == 0 else round(
            (top5[0]["score"] - c["score"]) / top5[0]["score"] * 100, 1
        )

    # =========================
    # ANALISIS POR DIGITO
    # =========================
    analisis_digitos = []

    for i in range(4):
        detalle = []
        for d, s in list(scores[i].items())[:5]:
            detalle.append({
                "digito": d,
                "score": round(s, 4),
                "frecuencia": round(freq[i][d], 4),
                "probabilidad": round(bayes[i][d], 4)
            })

        analisis_digitos.append({
            "posicion": i,
            "top_digitos": top_digits[i],
            "detalle": detalle
        })

    # =========================
    # RETURN FINAL
    # =========================
    return {
        "recomendacion_principal": top5[0] if top5 else None,
        "top5": top5,
        "analisis_digitos": analisis_digitos,
        "estadisticas": {
            "total_sorteos": n,
            "fecha_inicio": df["fecha"].min().strftime("%Y-%m-%d"),
            "fecha_fin": df["fecha"].max().strftime("%Y-%m-%d"),
            "confianza_global": round(top5[0]["score"]*100,1) if top5 else 0,
            "configuracion": config
        }
    }
