
export function crearSeguridad({ scene, cameraViews, seleccionarCamara }) {
    const estilo = document.createElement('style');

    estilo.textContent = `
        #panel-seguridad {
            position: fixed;
            top: 12px;
            right: 12px;
            width: 280px;
            max-width: calc(100vw - 24px);
            max-height: calc(100vh - 24px);
            overflow-y: auto;
            box-sizing: border-box;
            z-index: 1000;
            padding: 12px;
            border: 1px solid rgba(96, 165, 250, 0.4);
            border-radius: 12px;
            background: rgba(10, 18, 32, 0.96);
            color: #f1f5f9;
            font: 12px/1.45 Arial, sans-serif;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.32);
            scrollbar-width: thin;
            scrollbar-color: #475569 #0a1220;
        }

        #panel-seguridad * {
            box-sizing: border-box;
        }

        #panel-seguridad h2 {
            margin: 0;
            font-size: 16px;
            color: #93c5fd;
        }

        #panel-seguridad h3 {
            margin: 12px 0 6px;
            font-size: 13px;
            color: #e2e8f0;
        }

        #panel-seguridad button {
            border: 1px solid rgba(148, 163, 184, 0.3);
            border-radius: 7px;
            padding: 8px;
            background: #1e293b;
            color: #f8fafc;
            cursor: pointer;
            font-size: 11px;
            transition: background 0.15s, border-color 0.15s;
        }

        #panel-seguridad button:hover {
            background: #334155;
            border-color: #64748b;
        }

        #panel-seguridad button:focus-visible {
            outline: 2px solid #60a5fa;
            outline-offset: 2px;
        }

        #panel-seguridad .seg-encabezado {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
        }

        #panel-seguridad .seg-minimizar {
            min-width: 32px;
            font-size: 16px;
            font-weight: bold;
        }

        #panel-seguridad .cam-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6px;
            margin: 10px 0;
        }

        #panel-seguridad .cam-grid button {
            min-width: 0;
            overflow-wrap: anywhere;
        }

        #panel-seguridad .cam-grid button.activa {
            background: #1d4ed8;
            border-color: #60a5fa;
            color: #ffffff;
        }

        #panel-seguridad .seg-acciones {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin: 9px 0;
        }

        #panel-seguridad .seg-acciones button {
            flex: 1 1 auto;
        }

        #panel-seguridad .seg-evento {
            padding: 8px;
            margin: 6px 0;
            border: 1px solid rgba(148, 163, 184, 0.12);
            border-radius: 8px;
            background: rgba(30, 41, 59, 0.9);
            overflow-wrap: anywhere;
        }

        #panel-seguridad .seg-evento strong {
            display: block;
            margin-bottom: 3px;
            color: #f8fafc;
        }

        #panel-seguridad .seg-secundario {
            color: #94a3b8;
            font-size: 10px;
        }

        #panel-seguridad .seg-lista {
            max-height: 180px;
            overflow-y: auto;
            scrollbar-width: thin;
        }

        #panel-seguridad .seg-vacio {
            padding: 10px;
            color: #94a3b8;
            background: rgba(30, 41, 59, 0.55);
            border-radius: 8px;
        }

        #panel-seguridad .seg-estado {
            display: inline-block;
            margin-top: 5px;
            padding: 3px 6px;
            border-radius: 5px;
            background: rgba(234, 179, 8, 0.13);
            color: #fde68a;
            font-size: 10px;
        }

        #panel-seguridad .seg-estado.revisado {
            background: rgba(34, 197, 94, 0.13);
            color: #86efac;
        }

        #panel-seguridad .seg-pie {
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px solid rgba(148, 163, 184, 0.16);
            color: #94a3b8;
            font-size: 10px;
            line-height: 1.5;
        }

        @media (max-width: 700px) {
            #panel-seguridad {
                top: 10px;
                right: 10px;
                width: 245px;
                max-height: 65vh;
                padding: 10px;
            }

            #panel-seguridad .seg-lista {
                max-height: 120px;
            }
        }

        @media (max-width: 420px) {
            #panel-seguridad {
                width: 210px;
                max-height: 58vh;
                font-size: 11px;
            }

            #panel-seguridad .cam-grid button {
                padding: 6px 4px;
                font-size: 10px;
            }
        }
    `;

    document.head.appendChild(estilo);

    const panel = document.createElement('div');
    panel.id = 'panel-seguridad';
    panel.setAttribute('aria-label', 'Panel de seguridad');
    document.body.appendChild(panel);

    const clave = 'supermercado_seguridad_eventos';

    let eventos = [];
    let camaraSeleccionada = 1;
    let minimizado = false;

    // Cargar registros guardados en este navegador.
    try {
        const guardados = JSON.parse(
            localStorage.getItem(clave) || '[]'
        );

        if (Array.isArray(guardados)) {
            eventos = guardados
                .filter(evento => evento && typeof evento === 'object')
                .slice(0, 200);
        }
    } catch (error) {
        console.warn('No se pudieron cargar los eventos:', error);
        eventos = [];
    }

    function guardarEventos() {
        try {
            localStorage.setItem(clave, JSON.stringify(eventos));
        } catch (error) {
            console.warn('No se pudieron guardar los eventos:', error);
        }
    }

    function escapar(valor) {
        return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[caracter]);
    }

    function registrarEvento(tipo, detalle, camara = camaraSeleccionada) {
        const evento = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            fecha: new Date().toLocaleString('es-MX'),
            tipo: String(tipo),
            detalle: String(detalle),
            camara: Number(camara),
            estado: 'Pendiente'
        };

        eventos.unshift(evento);
        eventos = eventos.slice(0, 200);

        guardarEventos();
        renderizar();

        return { ...evento };
    }

    function seleccionar(id) {
        const numero = Number(id);

        if (
            !Number.isInteger(numero) ||
            numero < 1 ||
            numero > cameraViews.length
        ) {
            return;
        }

        camaraSeleccionada = numero;

        if (typeof seleccionarCamara === 'function') {
            seleccionarCamara(numero - 1);
        }

        renderizar();
    }

    function exportarCSV() {
        const filas = [
            ['Fecha', 'Tipo', 'Detalle', 'Camara', 'Estado'],
            ...eventos.map(evento => [
                evento.fecha,
                evento.tipo,
                evento.detalle,
                evento.camara,
                evento.estado
            ])
        ];

        const csv = filas
            .map(fila =>
                fila.map(valor =>
                    '"' + String(valor ?? '').replace(/"/g, '""') + '"'
                ).join(',')
            )
            .join('\r\n');

        const blob = new Blob(
            ['\uFEFF' + csv],
            { type: 'text/csv;charset=utf-8;' }
        );

        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');

        enlace.href = url;
        enlace.download = 'eventos_seguridad.csv';

        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function marcarRevisado(id) {
        const evento = eventos.find(
            elemento => String(elemento.id) === String(id)
        );

        if (!evento) return;

        evento.estado = 'Revisado';

        guardarEventos();
        renderizar();
    }

    function limpiarEventos() {
        const confirmar = window.confirm(
            '¿Deseas borrar todos los eventos de seguridad?'
        );

        if (!confirmar) return;

        eventos = [];
        guardarEventos();
        renderizar();
    }

    function renderizar() {
        if (minimizado) {
            panel.innerHTML = `
                <button
                    id="seg-mostrar"
                    type="button"
                    style="width:100%"
                    aria-label="Mostrar panel de seguridad">
                    🛡️ Mostrar seguridad
                </button>
            `;

            panel.querySelector('#seg-mostrar').onclick = () => {
                minimizado = false;
                renderizar();
            };

            return;
        }

        const botonesCamaras = cameraViews.map((_, indice) => `
            <button
                type="button"
                class="${camaraSeleccionada === indice + 1 ? 'activa' : ''}"
                data-camara="${indice + 1}"
                aria-pressed="${camaraSeleccionada === indice + 1}">
                📹 Cámara ${indice + 1}
            </button>
        `).join('');

        const listaEventos = eventos.length
            ? eventos.map(evento => `
                <div class="seg-evento">
                    <strong>${escapar(evento.tipo)}</strong>

                    <div>${escapar(evento.detalle)}</div>

                    <div class="seg-secundario">
                        ${escapar(evento.fecha)}
                        · Cámara ${escapar(evento.camara)}
                    </div>

                    <div>
                        <span class="seg-estado ${
                            evento.estado === 'Revisado' ? 'revisado' : ''
                        }">
                            ${escapar(evento.estado)}
                        </span>
                    </div>

                    ${
                        evento.estado !== 'Revisado'
                            ? `
                                <button
                                    type="button"
                                    data-revisar="${escapar(evento.id)}"
                                    style="margin-top:7px">
                                    Marcar revisado
                                </button>
                            `
                            : ''
                    }
                </div>
            `).join('')
            : `
                <div class="seg-vacio">
                    Todavía no hay eventos registrados.
                    <br>
                    Puedes generar una alerta para probar el sistema.
                </div>
            `;

        panel.innerHTML = `
            <div class="seg-encabezado">
                <h2>🛡️ Seguridad</h2>

                <button
                    id="seg-minimizar"
                    class="seg-minimizar"
                    type="button"
                    aria-label="Minimizar panel">
                    −
                </button>
            </div>

            <div class="seg-secundario" style="margin-top:6px">
                Cámaras: ${cameraViews.length}
                · Seleccionada: ${camaraSeleccionada}
            </div>

            <div class="cam-grid">
                ${botonesCamaras}
            </div>

            <div class="seg-acciones">
                <button id="seg-alerta" type="button">
                    ⚠ Probar alerta
                </button>

                <button id="seg-exportar" type="button">
                    ↓ Exportar CSV
                </button>
            </div>

            <h3>Registro de eventos (${eventos.length})</h3>

            <div class="seg-lista">
                ${listaEventos}
            </div>

            <div class="seg-acciones">
                <button id="seg-limpiar" type="button">
                    Limpiar registros
                </button>
            </div>

            <div class="seg-pie">
                Los registros se guardan en este navegador.
                Las alertas de prueba son manuales y no representan
                detecciones automáticas de una cámara.
            </div>
        `;

        panel.querySelector('#seg-minimizar').onclick = () => {
            minimizado = true;
            renderizar();
        };

        panel.querySelectorAll('[data-camara]').forEach(boton => {
            boton.onclick = () => seleccionar(boton.dataset.camara);
        });

        panel.querySelector('#seg-alerta').onclick = () => {
            registrarEvento(
                'Alerta de prueba',
                'Evento de prueba generado manualmente',
                camaraSeleccionada
            );
        };

        panel.querySelector('#seg-exportar').onclick = exportarCSV;
        panel.querySelector('#seg-limpiar').onclick = limpiarEventos;

        panel.querySelectorAll('[data-revisar]').forEach(boton => {
            boton.onclick = () => {
                marcarRevisado(boton.dataset.revisar);
            };
        });
    }

    renderizar();

    return {
        registrarEvento,

        seleccionar,

        obtenerEventos() {
            return eventos.map(evento => ({ ...evento }));
        },

        destruir() {
            panel.remove();
            estilo.remove();
        }
    };
}