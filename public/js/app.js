// ===========================================
// APP PRINCIPAL - VERSIÓN OPTIMIZADA
// ===========================================
const AppState = {
    loteriaActual: null,
    historial: [],
    resultados: null,
    isLoading: false
};

// ============================
// 1. INICIALIZACIÓN PRINCIPAL
// ============================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎰 Lotería Predictor - Iniciando');
    
    try {
        // Cargar componentes en paralelo
        await Promise.all([
            cargarLoterias(),
            inicializarComponentes()
        ]);
        
        // Auto-seleccionar Bogotá (solo si existe en el selector)
        seleccionarLoteríaPorDefecto();
        
        console.log('✅ App completamente inicializada');
        
    } catch (error) {
        console.error('Error en inicialización:', error);
        mostrarMensaje('⚠️ Error al inicializar la aplicación', 'danger');
    }
});

// ============================
// 2. FUNCIONES DE CARGA
// ============================
async function cargarLoterias() {
    const select = document.getElementById('lotterySelect');
    if (!select) {
        console.warn('Selector de loterías no encontrado');
        return;
    }
    
    try {
        // Mostrar estado de carga
        select.disabled = true;
        select.innerHTML = '<option value="">Cargando loterías...</option>';
        
        const data = await LotteryAPIInstance.getLoterias();
        
        if (!data.loterias || data.loterias.length === 0) {
            select.innerHTML = '<option value="">No hay loterías disponibles</option>';
            return;
        }
        
        // Construir opciones
        select.innerHTML = '<option value="">-- Selecciona lotería --</option>';
        data.loterias.forEach(l => {
            const option = document.createElement('option');
            option.value = l.id;
            option.textContent = l.nombre;
            option.dataset.fuente = l.fuente || 'demo';
            select.appendChild(option);
        });
        
        console.log(`📋 ${data.loterias.length} loterías cargadas correctamente`);
        
    } catch (error) {
        console.error('Error cargando loterías:', error);
        select.innerHTML = '<option value="">Error cargando loterías</option>';
        mostrarMensaje('❌ Error cargando listado de loterías', 'danger');
    } finally {
        select.disabled = false;
    }
}

function inicializarComponentes() {
    return new Promise((resolve) => {
        // Configurar eventos
        configurarEventos();
        
        // Inicializar tooltips de Bootstrap
        if (typeof bootstrap !== 'undefined') {
            const tooltipTriggerList = [].slice.call(
                document.querySelectorAll('[data-bs-toggle="tooltip"]')
            );
            tooltipTriggerList.map(tooltipTriggerEl => {
                return new bootstrap.Tooltip(tooltipTriggerEl);
            });
        }
        
        resolve();
    });
}

// ============================
// 3. CONFIGURACIÓN DE EVENTOS
// ============================
function configurarEventos() {
    const select = document.getElementById('lotterySelect');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    
    // Cambio de lotería
    if (select) {
        select.addEventListener('change', manejarCambioLoteria);
    }
    
    // Botón de análisis
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', ejecutarAnalisis);
        
        // Tooltip para estado deshabilitado
        analyzeBtn.addEventListener('mouseenter', function() {
            if (this.disabled && AppState.historial.length < 2) {
                this.title = 'Necesitas al menos 2 sorteos para analizar';
            } else {
                this.title = '';
            }
        });
    }
    
    // Botón de refrescar (si existe)
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            if (AppState.loteriaActual) {
                await manejarCambioLoteria();
            }
        });
    }
    
    // Evento para recargar loterías (Ctrl + L)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'l') {
            e.preventDefault();
            cargarLoterias();
        }
    });
}

// ============================
// 4. MANEJO DE LOTERÍA
// ============================
async function manejarCambioLoteria() {
    const select = document.getElementById('lotterySelect');
    const loteriaId = select.value;
    
    if (!loteriaId) {
        limpiarTodo();
        return;
    }
    
    if (AppState.isLoading) {
        console.log('⚠️ Ya hay una operación en curso');
        return;
    }
    
    AppState.loteriaActual = loteriaId;
    AppState.isLoading = true;
    
    const analyzeBtn = document.getElementById('analyzeBtn');
    const optionSeleccionada = select.options[select.selectedIndex];
    const fuente = optionSeleccionada.dataset.fuente || 'desconocida';
    
    try {
        // Actualizar UI de carga
        actualizarEstadoUI('loading', 'Cargando sorteos...');
        
        // Obtener historial
        const datos = await LotteryAPIInstance.getHistorial(loteriaId);
        
        // Validar datos recibidos
        if (!datos || !Array.isArray(datos.historial)) {
            throw new Error('Formato de datos inválido');
        }
        
        AppState.historial = datos.historial;
        console.log(`📊 ${AppState.historial.length} sorteos cargados (Fuente: ${datos.fuente || fuente})`);
        
        // Renderizar datos
        renderizarHistorial();
        limpiarResultados();
        
        // Habilitar/deshabilitar análisis
        const tieneSuficientesDatos = AppState.historial.length >= 2;
        if (analyzeBtn) {
            analyzeBtn.disabled = !tieneSuficientesDatos;
            analyzeBtn.textContent = 'Analizar';
            
            if (!tieneSuficientesDatos) {
                analyzeBtn.title = `Solo tienes ${AppState.historial.length} sorteo(s). Se necesitan al menos 2.`;
            }
        }
        
        // Mostrar mensaje informativo
        let mensaje = `📈 ${AppState.historial.length} sorteos cargados`;
        let tipo = 'info';
        
        if (datos.fuente === 'google_sheets') {
            mensaje += ' (datos reales de Google Sheets)';
            tipo = 'success';
        } else if (datos.fuente === 'demo') {
            mensaje += ' (datos de demostración)';
            tipo = 'warning';
        }
        
        mostrarMensaje(mensaje, tipo);
        
    } catch (error) {
        console.error('❌ Error cargando datos:', error);
        
        let mensajeError = 'Error cargando datos históricos';
        if (error.message.includes('network') || error.message.includes('Network')) {
            mensajeError = '❌ Error de conexión. Verifica tu internet.';
        } else if (error.message.includes('CORS')) {
            mensajeError = '⚠️ Problema de CORS. Revisa tu proxy.';
        }
        
        mostrarMensaje(mensajeError, 'danger');
        
        // Limpiar estado
        AppState.historial = [];
        renderizarHistorial();
        
        if (analyzeBtn) {
            analyzeBtn.disabled = true;
            analyzeBtn.textContent = 'Analizar';
        }
        
    } finally {
        AppState.isLoading = false;
        actualizarEstadoUI('ready');
    }
}

// ============================
// 5. EJECUCIÓN DE ANÁLISIS
// ============================
async function ejecutarAnalisis() {
    // Validaciones previas
    if (AppState.historial.length < 2) {
        mostrarMensaje('❌ Necesitas al menos 2 sorteos para analizar', 'warning');
        return;
    }
    
    if (AppState.isLoading) {
        mostrarMensaje('⏳ Ya hay un análisis en curso', 'info');
        return;
    }
    
    AppState.isLoading = true;
    
    const analyzeBtn = document.getElementById('analyzeBtn');
    const tiempoInicio = Date.now();
    
    try {
        // Preparar UI
        actualizarEstadoUI('analyzing', 'Analizando patrones...');
        
        // Ejecutar análisis
        const resultados = await LotteryAPIInstance.analizar(
            AppState.historial,
            { 
                analisis: 'completo',
                timestamp: tiempoInicio 
            }
        );
        
        // Validar resultados
        if (!resultados || !resultados.recomendacion_principal) {
            throw new Error('Resultados de análisis inválidos');
        }
        
        // Actualizar estado y UI
        AppState.resultados = resultados;
        renderizarResultados(resultados);
        
        // Calcular tiempo transcurrido
        const tiempoTotal = Date.now() - tiempoInicio;
        console.log(`✅ Análisis completado en ${tiempoTotal}ms`);
        
        // Mostrar mensaje de éxito
        mostrarMensaje(
            `✅ Análisis completado en ${tiempoTotal}ms`,
            'success'
        );
        
    } catch (error) {
        console.error('❌ Error en análisis:', error);
        
        let mensajeError = 'Error durante el análisis';
        if (error.message.includes('timeout') || error.message.includes('Timeout')) {
            mensajeError = '⏰ Timeout en el análisis. Intenta nuevamente.';
        } else if (error.message.includes('network')) {
            mensajeError = '🌐 Error de conexión con el servidor.';
        }
        
        mostrarMensaje(mensajeError, 'danger');
        
    } finally {
        AppState.isLoading = false;
        actualizarEstadoUI('ready');
    }
}

// ============================
// 6. RENDERIZADO DE UI
// ============================
function renderizarHistorial() {
    const table = document.getElementById('historyTable');
    if (!table) return;
    
    const historial = AppState.historial;
    const maxMostrar = 20; // Límite para no sobrecargar UI
    
    if (!historial || historial.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="3" class="text-center text-muted py-4">
                    <i class="bi bi-database-exclamation me-2"></i>
                    No hay datos disponibles
                </td>
            </tr>
        `;
        return;
    }
    
    // Mostrar solo los más recientes
    const mostrar = historial.slice(0, maxMostrar);
    const hayMas = historial.length > maxMostrar;
    
    table.innerHTML = mostrar.map((sorteo, i) => `
        <tr class="${i === 0 ? 'table-success' : ''}">
            <td>
                <span class="badge bg-secondary me-2">#${historial.length - i}</span>
                ${formatearFecha(sorteo.fecha)}
            </td>
            <td>
                <span class="lottery-number ${i === 0 ? 'fw-bold text-success' : ''}">
                    ${sorteo.numero.toString().padStart(4, '0')}
                </span>
                ${sorteo.serie ? `<small class="text-muted ms-2">S:${sorteo.serie}</small>` : ''}
            </td>
            <td class="text-end">
                <small class="text-muted">${calcularDiasDesde(sorteo.fecha)}</small>
            </td>
        </tr>
    `).join('') + (hayMas ? `
        <tr class="text-center">
            <td colspan="3" class="text-muted small">
                ... y ${historial.length - maxMostrar} sorteos más
            </td>
        </tr>
    ` : '');
}

function renderizarResultados(resultados) {
    if (!resultados) return;
    
    // 1. Número principal recomendado
    const display = document.querySelector('.display-1');
    if (display && resultados.recomendacion_principal) {
        const num = resultados.recomendacion_principal.numero;
        display.textContent = num.toString().padStart(4, '0');
        display.className = 'display-1 text-success fw-bold animate__animated animate__pulse';
        
        // Tooltip con detalles
        display.title = `Score: ${(resultados.recomendacion_principal.score * 100).toFixed(1)}%`;
    }
    
    // 2. Tabla Top 5
    const top5Table = document.getElementById('top5Table');
    if (top5Table) {
        if (!resultados.top5 || resultados.top5.length === 0) {
            top5Table.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center text-muted py-3">
                        <i class="bi bi-info-circle me-2"></i>
                        No hay recomendaciones disponibles
                    </td>
                </tr>
            `;
        } else {
            top5Table.innerHTML = resultados.top5.map((item, i) => `
                <tr class="${i === 0 ? 'table-success' : ''}">
                    <td class="text-center">
                        <span class="badge ${i === 0 ? 'bg-success' : 'bg-secondary'}">
                            ${i + 1}
                        </span>
                    </td>
                    <td>
                        <strong class="lottery-number">
                            ${item.numero.toString().padStart(4, '0')}
                        </strong>
                    </td>
                    <td class="text-end">
                        <div class="progress" style="height: 20px;">
                            <div class="progress-bar ${i === 0 ? 'bg-success' : 'bg-info'}" 
                                 style="width: ${item.score * 100}%">
                                ${(item.score * 100).toFixed(1)}%
                            </div>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    }
    
    // 3. Estadísticas (si existen)
    if (resultados.estadisticas) {
        actualizarEstadisticas(resultados.estadisticas);
    }
}

// ============================
// 7. FUNCIONES AUXILIARES
// ============================
function formatearFecha(fechaStr) {
    if (!fechaStr) return 'Fecha desconocida';
    
    try {
        // Manejar diferentes formatos de fecha
        let date;
        if (fechaStr.includes('-')) {
            const [y, m, d] = fechaStr.split('-').map(Number);
            date = new Date(y, m - 1, d);
        } else if (fechaStr.includes('/')) {
            const [d, m, y] = fechaStr.split('/').map(Number);
            date = new Date(y, m - 1, d);
        } else {
            date = new Date(fechaStr);
        }
        
        return date.toLocaleDateString('es-CO', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return fechaStr;
    }
}

function calcularDiasDesde(fechaStr) {
    try {
        const [y, m, d] = fechaStr.split('-').map(Number);
        const fechaSorteo = new Date(y, m - 1, d);
        const hoy = new Date();
        const diffTime = hoy - fechaSorteo;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Hoy';
        if (diffDays === 1) return 'Ayer';
        if (diffDays < 30) return `Hace ${diffDays} días`;
        if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`;
        return `Hace ${Math.floor(diffDays / 365)} años`;
    } catch {
        return '';
    }
}

function actualizarEstadoUI(estado, mensaje = '') {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const select = document.getElementById('lotterySelect');
    
    switch (estado) {
        case 'loading':
            if (analyzeBtn) {
                analyzeBtn.disabled = true;
                analyzeBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Cargando...';
            }
            if (select) select.disabled = true;
            break;
            
        case 'analyzing':
            if (analyzeBtn) {
                analyzeBtn.disabled = true;
                analyzeBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${mensaje || 'Analizando...'}`;
            }
            if (select) select.disabled = true;
            break;
            
        case 'ready':
            if (analyzeBtn) {
                analyzeBtn.disabled = AppState.historial.length < 2;
                analyzeBtn.textContent = 'Analizar';
                analyzeBtn.innerHTML = '<i class="bi bi-graph-up me-2"></i>Analizar';
            }
            if (select) select.disabled = false;
            break;
    }
}

function mostrarMensaje(texto, tipo = 'info', duracion = 5000) {
    // Eliminar mensajes anteriores
    const anteriores = document.querySelectorAll('.alert-dismissible.fixed-alert');
    anteriores.forEach(el => {
        const bsAlert = bootstrap.Alert.getInstance(el);
        if (bsAlert) bsAlert.close();
        el.remove();
    });
    
    // Icono según tipo
    const iconos = {
        success: 'bi-check-circle',
        danger: 'bi-exclamation-triangle',
        warning: 'bi-exclamation-circle',
        info: 'bi-info-circle'
    };
    
    // Crear nuevo mensaje
    const mensaje = document.createElement('div');
    mensaje.className = `alert alert-${tipo} alert-dismissible fade show fixed-alert shadow`;
    mensaje.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1060;
        min-width: 300px;
        max-width: 500px;
        animation: slideInRight 0.3s ease-out;
    `;
    
    mensaje.innerHTML = `
        <i class="bi ${iconos[tipo] || 'bi-info-circle'} me-2"></i>
        ${texto}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(mensaje);
    
    // Auto-eliminar
    setTimeout(() => {
        if (mensaje.parentNode) {
            const bsAlert = bootstrap.Alert.getInstance(mensaje) || new bootstrap.Alert(mensaje);
            bsAlert.close();
        }
    }, duracion);
}

function limpiarTodo() {
    AppState.loteriaActual = null;
    AppState.historial = [];
    AppState.resultados = null;
    AppState.isLoading = false;
    
    // Limpiar tablas
    const historyTable = document.getElementById('historyTable');
    if (historyTable) {
        historyTable.innerHTML = `
            <tr>
                <td colspan="3" class="text-center text-muted py-4">
                    <i class="bi bi-folder-x me-2"></i>
                    Selecciona una lotería para ver el historial
                </td>
            </tr>
        `;
    }
    
    limpiarResultados();
}

function limpiarResultados() {
    // Resetear display principal
    const display = document.querySelector('.display-1');
    if (display) {
        display.textContent = '----';
        display.className = 'display-1 text-muted fw-bold';
        display.title = '';
    }
    
    // Resetear tabla top 5
    const top5Table = document.getElementById('top5Table');
    if (top5Table) {
        top5Table.innerHTML = `
            <tr>
                <td colspan="3" class="text-center text-muted py-4">
                    <i class="bi bi-graph-up me-2"></i>
                    Los resultados aparecerán aquí después del análisis
                </td>
            </tr>
        `;
    }
    
    // Resetear estadísticas si existen
    const statsContainer = document.getElementById('estadisticasContainer');
    if (statsContainer) {
        statsContainer.innerHTML = '';
    }
}

function seleccionarLoteríaPorDefecto() {
    setTimeout(() => {
        const select = document.getElementById('lotterySelect');
        if (!select || select.options.length <= 1) return;
        
        // Buscar Bogotá por nombre o ID
        for (let i = 0; i < select.options.length; i++) {
            const option = select.options[i];
            if (option.value && (
                option.value.includes('bogota') || 
                option.text.toLowerCase().includes('bogotá') ||
                option.text.toLowerCase().includes('bogota')
            )) {
                select.value = option.value;
                select.dispatchEvent(new Event('change'));
                console.log('📍 Bogotá seleccionada por defecto');
                return;
            }
        }
        
        // Si no encuentra Bogotá, seleccionar la primera disponible
        if (select.options.length > 1) {
            select.selectedIndex = 1;
            select.dispatchEvent(new Event('change'));
        }
    }, 800);
}

function actualizarEstadisticas(estadisticas) {
    const container = document.getElementById('estadisticasContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="row">
            <div class="col-md-4">
                <div class="card border-0 shadow-sm">
                    <div class="card-body text-center">
                        <h6 class="text-muted">Rango más frecuente</h6>
                        <h4 class="text-primary">${estadisticas.rango_frecuente || 'N/A'}</h4>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card border-0 shadow-sm">
                    <div class="card-body text-center">
                        <h6 class="text-muted">Promedio últimos 10</h6>
                        <h4 class="text-success">${estadisticas.promedio_ultimos || 'N/A'}</h4>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card border-0 shadow-sm">
                    <div class="card-body text-center">
                        <h6 class="text-muted">Variación</h6>
                        <h4 class="${estadisticas.variacion > 0 ? 'text-danger' : 'text-info'}">
                            ${estadisticas.variacion ? `${estadisticas.variacion}%` : 'N/A'}
                        </h4>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ============================
// 8. AGREGAR SORTEOS
// ============================
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('agregarSorteoModal');
    
    if (modal) {
        modal.addEventListener('show.bs.modal', async function() {
            // Cargar loterías en el selector del modal
            const selectLoteria = document.getElementById('sorteoLoteria');
            selectLoteria.innerHTML = '<option value="">-- Selecciona una lotería --</option>';
            
            try {
                const data = await LotteryAPIInstance.getLoterias();
                data.loterias.forEach(l => {
                    const option = document.createElement('option');
                    option.value = l.id;
                    option.textContent = l.nombre;
                    selectLoteria.appendChild(option);
                });
                
                // Pre-seleccionar la lotería actual si existe
                if (AppState.loteriaActual) {
                    selectLoteria.value = AppState.loteriaActual;
                    document.getElementById('sorteoLoteriaConfirm').textContent = AppState.loteriaActual;
                    document.getElementById('alertLoteriaSeleccionada').style.display = 'block';
                }
            } catch (error) {
                console.error('Error cargando loterías en modal:', error);
            }
            
            // Fecha de hoy por defecto
            const hoy = new Date().toISOString().split('T')[0];
            document.getElementById('sorteoFecha').value = hoy;
        });
        
        // Actualizar mensaje cuando cambie la lotería
        const selectLoteria = document.getElementById('sorteoLoteria');
        if (selectLoteria) {
            selectLoteria.addEventListener('change', function() {
                const loteriaSeleccionada = this.value;
                const alert = document.getElementById('alertLoteriaSeleccionada');
                const confirm = document.getElementById('sorteoLoteriaConfirm');
                
                if (loteriaSeleccionada) {
                    confirm.textContent = loteriaSeleccionada;
                    alert.style.display = 'block';
                } else {
                    alert.style.display = 'none';
                }
            });
        }
    }
    
    const btnGuardar = document.getElementById('btnGuardarSorteo');
    if (btnGuardar) {
        btnGuardar.addEventListener('click', guardarNuevoSorteo);
    }
});

async function guardarNuevoSorteo() {
    const loteria = document.getElementById('sorteoLoteria').value;
    const fecha = document.getElementById('sorteoFecha').value;
    const numero = document.getElementById('sorteoNumero').value;
    const serie = document.getElementById('sorteoSerie').value;
    
    if (!loteria) {
        mostrarMensaje('❌ Selecciona una lotería', 'warning');
        return;
    }
    
    if (!fecha || !numero || !serie) {
        mostrarMensaje('❌ Completa todos los campos', 'warning');
        return;
    }
    
    if (numero < 0 || numero > 9999) {
        mostrarMensaje('❌ El número debe estar entre 0 y 9999', 'warning');
        return;
    }
    
    const btnGuardar = document.getElementById('btnGuardarSorteo');
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';
    
    try {
        const resultado = await LotteryAPIInstance.agregarSorteo({
            loteria,
            fecha,
            numero: parseInt(numero),
            serie
        });
        
        if (resultado.success) {
            mostrarMensaje('✅ Sorteo agregado correctamente a ' + loteria, 'success');
            
            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('agregarSorteoModal'));
            modal.hide();
            
            // Limpiar formulario
            document.getElementById('formAgregarSorteo').reset();
            document.getElementById('alertLoteriaSeleccionada').style.display = 'none';
            
            // Recargar historial si estamos viendo esa lotería
            if (AppState.loteriaActual === loteria) {
                setTimeout(() => {
                    manejarCambioLoteria();
                }, 1000);
            }
        } else {
            throw new Error(resultado.error || 'Error desconocido');
        }
        
    } catch (error) {
        console.error('Error guardando sorteo:', error);
        mostrarMensaje('❌ Error al guardar: ' + error.message, 'danger');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = '<i class="bi bi-save me-1"></i> Guardar';
    }
}

// ============================
// 9. EXPORTACIÓN Y UTILIDADES
// ============================
// Para debugging y extensión
window.AppState = AppState;
window.LotteryApp = {
    recargar: cargarLoterias,
    analizar: ejecutarAnalisis,
    limpiar: limpiarTodo,
    getEstado: () => ({ ...AppState })
};

console.log('✅ App.js completamente optimizado y listo');