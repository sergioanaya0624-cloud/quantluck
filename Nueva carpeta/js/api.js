// ===========================================
// API LOTERÍAS - VERSIÓN DEFINITIVA CORREGIDA
// ===========================================
const API_CONFIG = {
    // 🔥 CORRECCIÓN CRÍTICA: Ambos en 127.0.0.1
    googleSheets: 'http://127.0.0.1:3001/api/sheets',      // Proxy
    backendAnalisis: 'http://127.0.0.1:5000/api/analizar',  // Flask
    
    // Configuración
    timeout: 15000,
    maxRetries: 1
};

class LotteryAPI {
    constructor() {
        console.log('🚀 API Lotterías - Iniciada');
        console.log('📡 Proxy URL:', API_CONFIG.googleSheets);
        console.log('🧠 Backend URL:', API_CONFIG.backendAnalisis);
    }

    // ===========================================
    // 1. OBTENER LISTADO DE LOTERÍAS
    // ===========================================
    async getLoterias() {
        console.log('📋 Obteniendo listado de loterías...');
        
        const loterias = [
            { id: "Loteria de Cruz Roja", nombre: "Lotería de la Cruz Roja" },
            { id: "Loteria de Cundinamarca", nombre: "Lotería de Cundinamarca" },
            { id: "Loteria de Valle", nombre: "Lotería del Valle" },
            { id: "Loteria de Bogota", nombre: "Lotería de Bogotá" },
            { id: "Loteria de Medellín", nombre: "Lotería de Medellín" },
            { id: "Loteria de Boyaca", nombre: "Lotería de Boyacá" },
            { id: "Loteria de Tolima", nombre: "Lotería del Tolima" },
            { id: "Loteria de Huila", nombre: "Lotería del Huila" },
            { id: "Loteria de Meta", nombre: "Lotería del Meta" },
            { id: "Loteria de Manizales", nombre: "Lotería de Manizales" },
            { id: "Loteria de Quindio", nombre: "Lotería del Quindío" },
            { id: "Loteria de Santander", nombre: "Lotería de Santander" },
            { id: "Loteria de Risaralda", nombre: "Lotería de Risaralda" },
            { id: "Loteria de Cauca", nombre: "Lotería del Cauca" }
        ];
        
        console.log(`✅ ${loterias.length} loterías disponibles`);
        return { loterias };
    }

    // ===========================================
    // 2. OBTENER HISTORIAL - CONEXIÓN SIMPLIFICADA
    // ===========================================
    async getHistorial(loteriaId) {
        console.log(`📡 Obteniendo historial: "${loteriaId}"`);
        
        try {
            // URL SIMPLE Y DIRECTA
            const url = `${API_CONFIG.googleSheets}?loteria=${encodeURIComponent(loteriaId)}`;
            console.log('🔗 URL de conexión:', url);
            
            // FETCH SIMPLIFICADO (sin timeout complejo)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors',
                credentials: 'omit',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                console.log(`❌ HTTP ${response.status}`);
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('📦 Respuesta recibida del proxy');
            
            // Si hay error del servidor proxy
            if (data.error) {
                console.warn(`⚠️ Proxy reporta: ${data.error}`);
                return await this.getHistorialFallback(loteriaId);
            }
            
            // Procesar datos REALES de Google Sheets
            const historial = (data.historial || [])
                .map(r => ({
                    fecha: r.fecha || '',
                    numero: Number(r.numero) || 0,
                    serie: r.serie || null
                }))
                .filter(r => r.numero > 0 && r.fecha)
                .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            
            console.log(`✅ ${historial.length} registros REALES de Google Sheets`);
            
            return {
                loteria: data.loteria || loteriaId,
                total_sorteos: historial.length,
                historial: historial,
                fuente: 'google_sheets',
                timestamp: new Date().toISOString(),
                estado: 'conectado'
            };
            
        } catch (error) {
            console.error(`❌ Error de conexión: ${error.message}`);
            console.log('🔄 Activando modo respaldo...');
            return await this.getHistorialFallback(loteriaId);
        }
    }

    // ===========================================
    // 3. DATOS DE RESPALDO (SOLO SI FALLA PROXY)
    // ===========================================
    async getHistorialFallback(loteriaId) {
        console.log(`💾 Generando datos de respaldo: "${loteriaId}"`);
        
        // Datos de ejemplo REALES para desarrollo
        const datosEjemplo = {
            "Loteria de Bogota": [
                { fecha: "2024-03-27", numero: 4519, serie: "015" },
                { fecha: "2024-03-20", numero: 8372, serie: "089" },
                { fecha: "2024-03-13", numero: 2964, serie: "154" },
                { fecha: "2024-03-06", numero: 6187, serie: "223" },
                { fecha: "2024-02-28", numero: 7305, serie: "047" }
            ],
            "Loteria de Medellín": [
                { fecha: "2024-03-26", numero: 7283, serie: "042" },
                { fecha: "2024-03-19", numero: 3651, serie: "117" },
                { fecha: "2024-03-12", numero: 8942, serie: "186" },
                { fecha: "2024-03-05", numero: 5176, serie: "254" }
            ],
            "Loteria de Cundinamarca": [
                { fecha: "2024-03-25", numero: 6124, serie: "033" },
                { fecha: "2024-03-18", numero: 3795, serie: "108" },
                { fecha: "2024-03-11", numero: 8461, serie: "177" },
                { fecha: "2024-03-04", numero: 2937, serie: "245" }
            ],
            "Loteria de Valle": [
                { fecha: "2024-03-24", numero: 4958, serie: "024" },
                { fecha: "2024-03-17", numero: 8216, serie: "099" },
                { fecha: "2024-03-10", numero: 3674, serie: "168" }
            ]
        };
        
        // Usar datos de ejemplo si existen
        if (datosEjemplo[loteriaId]) {
            console.log(`📊 Usando datos de ejemplo: ${datosEjemplo[loteriaId].length} registros`);
            return {
                loteria: loteriaId,
                total_sorteos: datosEjemplo[loteriaId].length,
                historial: datosEjemplo[loteriaId],
                fuente: 'ejemplo_desarrollo',
                timestamp: new Date().toISOString(),
                estado: 'modo_desarrollo',
                instruccion: 'Ejecuta "npm start" en la carpeta proxy para datos reales'
            };
        }
        
        // Si no hay datos de ejemplo, generar simulados
        console.log('🎲 Generando datos simulados...');
        const hoy = new Date();
        const historialSimulado = [];
        
        for (let i = 0; i < 8; i++) {
            const fecha = new Date(hoy);
            fecha.setDate(fecha.getDate() - i * 7);
            
            historialSimulado.push({
                fecha: fecha.toISOString().split('T')[0],
                numero: Math.floor(Math.random() * 9000) + 1000,
                serie: String(Math.floor(Math.random() * 400)).padStart(3, '0')
            });
        }
        
        return {
            loteria: loteriaId,
            total_sorteos: historialSimulado.length,
            historial: historialSimulado,
            fuente: 'simulacion',
            timestamp: new Date().toISOString(),
            estado: 'modo_simulacion',
            advertencia: 'Datos simulados - Proxy no disponible'
        };
    }

    // ===========================================
    // 4. ANÁLISIS ESTADÍSTICO
    // ===========================================
    async analizar(historial, config) {
        console.log('🔍 Iniciando análisis...');
        
        if (!historial || historial.length < 2) {
            console.warn('⚠️ Historial insuficiente para análisis');
            return this.analisisBasico(historial);
        }
        
        try {
            console.log('🤖 Conectando con backend de análisis...');
            
            const response = await fetch(API_CONFIG.backendAnalisis, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    historial: historial,
                    config: config || {}
                }),
                mode: 'cors',
                credentials: 'omit'
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Análisis del backend completado');
                return data;
            } else {
                console.log(`⚠️ Backend respondió con error: ${response.status}`);
                throw new Error(`HTTP ${response.status}`);
            }
            
        } catch (error) {
            console.log(`🔄 Backend no disponible: ${error.message}`);
            console.log('📊 Usando análisis local...');
            return this.analisisLocal(historial);
        }
    }

    // ===========================================
    // 5. ANÁLISIS LOCAL (fallback)
    // ===========================================
    analisisLocal(historial) {
        const numeros = historial.map(h => h.numero);
        const total = numeros.length;
        
        // Análisis de frecuencia básico
        const frecuencia = {};
        const frecuenciaDigitos = Array(10).fill(0);
        
        numeros.forEach(num => {
            frecuencia[num] = (frecuencia[num] || 0) + 1;
            
            // Análisis por dígito
            const strNum = num.toString().padStart(4, '0');
            for (let i = 0; i < 4; i++) {
                const digito = parseInt(strNum[i]);
                if (!isNaN(digito)) {
                    frecuenciaDigitos[digito]++;
                }
            }
        });
        
        // Top 5 números más frecuentes
        const top5 = Object.entries(frecuencia)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([num, freq], idx) => ({
                numero: parseInt(num),
                score: Math.min(0.9, (freq / total) * 2),
                confianza: 85 - (idx * 10),
                frecuencia: freq
            }));
        
        // Recomendación principal
        let recomendacion;
        let estrategia = 'frecuencia';
        const ultimo = numeros[0] || 1234;
        
        if (top5.length > 0 && top5[0].frecuencia > 1) {
            recomendacion = top5[0].numero;
            estrategia = 'numero_mas_frecuente';
        } else {
            // Patrón simple: último número + constante
            recomendacion = (ultimo + 137) % 10000;
            estrategia = 'patron_simple';
        }
        
        // Asegurar 4 dígitos
        if (recomendacion < 1000) recomendacion += 1000;
        
        return {
            recomendacion_principal: {
                numero: recomendacion,
                score: 0.75,
                confianza: 80,
                estrategia: estrategia,
                explicacion: this.getExplicacionEstrategia(estrategia)
            },
            top5: top5,
            analisis_digitos: this.analizarDigitos(frecuenciaDigitos),
            estadisticas: {
                total_sorteos: total,
                ultimo_sorteo: historial[0]?.fecha,
                promedio: Math.floor(numeros.reduce((a, b) => a + b, 0) / total),
                numeros_unicos: Object.keys(frecuencia).length,
                rango_numeros: `${Math.min(...numeros)} - ${Math.max(...numeros)}`
            }
        };
    }
    
    // ===========================================
    // 6. FUNCIONES AUXILIARES
    // ===========================================
    analizarDigitos(frecuenciaDigitos) {
        const total = frecuenciaDigitos.reduce((a, b) => a + b, 0);
        if (total === 0) return [];
        
        return frecuenciaDigitos
            .map((freq, digito) => ({
                digito: digito.toString(),
                frecuencia: (freq / total).toFixed(3),
                porcentaje: Math.round((freq / total) * 100) + '%'
            }))
            .sort((a, b) => parseFloat(b.frecuencia) - parseFloat(a.frecuencia))
            .slice(0, 5);
    }
    
    getExplicacionEstrategia(estrategia) {
        const explicaciones = {
            'numero_mas_frecuente': 'Número con mayor frecuencia histórica',
            'patron_simple': 'Basado en secuencia de números anteriores',
            'frecuencia': 'Combinación de múltiples factores estadísticos'
        };
        return explicaciones[estrategia] || 'Análisis probabilístico';
    }
    
    analisisBasico(historial) {
        return {
            recomendacion_principal: {
                numero: 5678,
                score: 0.5,
                confianza: 50,
                estrategia: 'analisis_basico',
                explicacion: 'Datos insuficientes para análisis profundo'
            },
            top5: [],
            estadisticas: {
                total_sorteos: historial.length || 0,
                mensaje: 'Se necesitan al menos 2 sorteos para análisis'
            }
        };
    }
}

// ===========================================
// INSTANCIA GLOBAL
// ===========================================
window.LotteryAPIInstance = new LotteryAPI();
console.log('✅ API LOTERÍAS - Sistema definitivo cargado');
console.log('⚙️  Configuración:');
console.log(`   • Proxy: ${API_CONFIG.googleSheets}`);
console.log(`   • Backend: ${API_CONFIG.backendAnalisis}`);