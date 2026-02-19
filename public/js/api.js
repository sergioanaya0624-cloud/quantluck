// ===========================================
// API LOTERÍAS - VERSIÓN PRODUCCIÓN + LOCAL
// ===========================================

// Detectar entorno automáticamente
const ES_LOCAL = false;  // Forzado a producción (sin proxy)

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyziCYj3nvYA79k3YitM3GZmqKE-7U5kPJqxcMjbJKAW48BeMCxfJCAtRP-kv58vKtb/exec';

const API_CONFIG = {
    // En local usa el proxy. En producción llama directo al Apps Script
    googleSheets: ES_LOCAL
        ? 'http://127.0.0.1:3001/api/sheets'
        : APPS_SCRIPT_URL,

    // En local usa Flask local. En producción usa Render
    // ⚠️ Cuando tengas la URL de Render, reemplaza 'TU_URL_RENDER' 
    backendAnalisis: ES_LOCAL
        ? 'http://127.0.0.1:5000/api/analizar'
        : 'https://TU_URL_RENDER.onrender.com/api/analizar',

    timeout: 20000
};

console.log(`🌍 Entorno: ${ES_LOCAL ? 'LOCAL' : 'PRODUCCIÓN'}`);
console.log(`📡 Sheets:  ${API_CONFIG.googleSheets}`);
console.log(`🧠 Backend: ${API_CONFIG.backendAnalisis}`);

class LotteryAPI {
    constructor() {
        console.log('🚀 API Loterías - Iniciada');
    }

    // ===========================================
    // 1. LISTADO DE LOTERÍAS
    // ===========================================
    async getLoterias() {
        const loterias = [
            { id: "Loteria de Cruz Roja",    nombre: "Lotería de la Cruz Roja" },
            { id: "Loteria de Cundinamarca", nombre: "Lotería de Cundinamarca" },
            { id: "Loteria de Valle",        nombre: "Lotería del Valle" },
            { id: "Loteria de Bogota",       nombre: "Lotería de Bogotá" },
            { id: "Loteria de Medellín",     nombre: "Lotería de Medellín" },
            { id: "Loteria de Boyaca",       nombre: "Lotería de Boyacá" },
            { id: "Loteria de Tolima",       nombre: "Lotería del Tolima" },
            { id: "Loteria de Huila",        nombre: "Lotería del Huila" },
            { id: "Loteria de Meta",         nombre: "Lotería del Meta" },
            { id: "Loteria de Manizales",    nombre: "Lotería de Manizales" },
            { id: "Loteria de Quindio",      nombre: "Lotería del Quindío" },
            { id: "Loteria de Santander",    nombre: "Lotería de Santander" },
            { id: "Loteria de Risaralda",    nombre: "Lotería de Risaralda" },
            { id: "Loteria de Cauca",        nombre: "Lotería del Cauca" }
        ];
        return { loterias };
    }

    // ===========================================
    // 2. HISTORIAL DESDE GOOGLE SHEETS
    // ===========================================
    async getHistorial(loteriaId) {
        console.log(`📡 Obteniendo historial: "${loteriaId}"`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

            const url = `${API_CONFIG.googleSheets}?loteria=${encodeURIComponent(loteriaId)}`;

            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            if (data.error) throw new Error(data.error);

            const historial = (data.historial || [])
                .map(r => ({
                    fecha:  r.fecha  || '',
                    numero: Number(r.numero) || 0,
                    serie:  r.serie  || ''
                }))
                .filter(r => r.numero > 0 && r.fecha)
                .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

            console.log(`✅ ${historial.length} registros reales`);

            return {
                loteria:       data.loteria || loteriaId,
                total_sorteos: historial.length,
                historial,
                fuente:        'google_sheets',
                timestamp:     new Date().toISOString()
            };

        } catch (error) {
            console.error(`❌ Error historial: ${error.message}`);
            throw error;
        }
    }

    // ===========================================
    // 3. ANÁLISIS ESTADÍSTICO (Flask / motor.py)
    // ===========================================
    async analizar(historial, config) {
        console.log('🔍 Iniciando análisis...');

        if (!historial || historial.length < 2) {
            throw new Error('Se necesitan al menos 2 sorteos');
        }

        try {
            console.log('🤖 Conectando con backend...');

            const response = await fetch(API_CONFIG.backendAnalisis, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ historial, config: config || {} })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            console.log('✅ Análisis del backend completado');
            return data;

        } catch (error) {
            console.error(`❌ Backend no disponible: ${error.message}`);
            console.log('📊 Usando análisis local de respaldo...');
            return this.analisisLocal(historial);
        }
    }

    // ===========================================
    // 4. ANÁLISIS LOCAL (respaldo si Flask falla)
    // ===========================================
    analisisLocal(historial) {
        const numeros = historial.map(h => h.numero);
        const total   = numeros.length;

        const frecuencia = {};
        const freqDigitos = Array(10).fill(0);

        numeros.forEach(num => {
            frecuencia[num] = (frecuencia[num] || 0) + 1;
            num.toString().padStart(4, '0').split('').forEach(d => {
                freqDigitos[parseInt(d)]++;
            });
        });

        const top5 = Object.entries(frecuencia)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([num, freq], i) => ({
                numero:    parseInt(num),
                score:     Math.min(0.95, 0.95 - i * 0.08),
                confianza: 85 - i * 8,
                frecuencia: freq
            }));

        const recomendacion = top5[0]?.numero || ((numeros[0] + 137) % 10000);

        return {
            recomendacion_principal: {
                numero:    recomendacion < 1000 ? recomendacion + 1000 : recomendacion,
                score:     0.75,
                confianza: 75,
                estrategia: 'analisis_local'
            },
            top5,
            estadisticas: {
                total_sorteos: total,
                promedio:      Math.floor(numeros.reduce((a, b) => a + b, 0) / total),
                ultimo_sorteo: historial[0]?.fecha
            }
        };
    }

    // ===========================================
    // 5. AGREGAR NUEVO SORTEO (VIA GET)
    // ===========================================
    async agregarSorteo(datos) {
        console.log('💾 Guardando nuevo sorteo:', datos);
        
        try {
            // Google Apps Script no permite POST con CORS, usamos GET con parámetros
            const params = new URLSearchParams({
                action: 'agregar',
                loteria: datos.loteria,
                fecha: datos.fecha,
                numero: datos.numero,
                serie: datos.serie
            });
            
            const url = `${APPS_SCRIPT_URL}?${params.toString()}`;
            
            const response = await fetch(url, {
                method: 'GET'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('✅ Sorteo guardado:', result);
            return result;
            
        } catch (error) {
            console.error('❌ Error guardando sorteo:', error);
            throw error;
        }
    }
}

window.LotteryAPIInstance = new LotteryAPI();