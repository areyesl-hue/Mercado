
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

import { crearMercado } from './mercado.js';
import { crearMobiliario } from './mobiliario.js';
import { crearProductosLacteos } from './productos.js';
import { crearAlmacen } from './almacen.js';
import { crearClienteSupermercado } from './cliente.js';
import { crearCarrito } from './carrito.js';
import { crearVehiculos } from './vehiculos.js';
import { crearEstacionamiento } from './estacionamiento.js';

// ============================================================
// CONFIGURACIÓN
// ============================================================

const CONFIG = {
    alturaJugador: 1.7,
    velocidadCaminar: 7,
    velocidadCorrer: 12,
    velocidadSalto: 7,
    gravedad: 19,

    colorCieloDia: 0xa9c9e8,
    colorCieloNoche: 0x101827,

    pixelRatioMaximo: 1,
    sombras: false,

    distanciaCarrito: 1.15,
    suavizadoCarrito: 6,
    correccionModeloCarrito: 0,

    velocidadCliente: 1.5,
    velocidadLadron: 1.8,

    probabilidadCompra: 1,
    tiempoExaminar: 1.5,
    distanciaRecoger: 2,
    pausaEntreCompras: 1.8
};

// ============================================================
// CLIENTES NORMALES
// ============================================================

const CONFIG_CLIENTES = [
    {
        nombre: 'Cliente1',
        modelo: '/modelos/Cliente1.glb',
        ruta: [
            { x: -27, z: 18 },
            { x: -23, z: 15 },
            { x: -21, z: 10.8 },
            { x: -17, z: 6.5 },
            { x: -12, z: 6.5 },
            { x: -5, z: 6.5 },
            { x: -5, z: 0 },
            { x: -12, z: -6 }
        ]
    },
    {
        nombre: 'Cliente2',
        modelo: '/modelos/Cliente2.glb',
        ruta: [
            { x: -27.8, z: 12.2 },
            { x: -29, z: 8 },
            { x: -20, z: 6.5 },
            { x: -12, z: 6.5 },
            { x: 0, z: 6.5 },
            { x: 12, z: 6.5 },
            { x: 22, z: 6.5 },
            { x: 26, z: 2 },
            { x: 21, z: -6 },
            { x: 12, z: -6 },
            { x: 0, z: -6 },
            { x: -12, z: -6 },
            { x: -20, z: -6 }
        ]
    },
    {
        nombre: 'Cliente3',
        modelo: '/modelos/Cliente3.glb',
        ruta: [
            { x: -20, z: 4 },
            { x: -12, z: 6.5 },
            { x: -5, z: 6.5 },
            { x: 0, z: 0 },
            { x: 5, z: -6 },
            { x: 12, z: -6 },
            { x: 20, z: -6 },
            { x: 22, z: -10 },
            { x: 12, z: -22 },
            { x: 0, z: -22 }
        ]
    },
    {
        nombre: 'Cliente4',
        modelo: '/modelos/Cliente4.glb',
        ruta: [
            { x: 20, z: 4 },
            { x: 26, z: 2 },
            { x: 22, z: 6.5 },
            { x: 12, z: 6.5 },
            { x: 5, z: 0 },
            { x: 12, z: -6 },
            { x: 20, z: -6 },
            { x: 22, z: -10 },
            { x: 20, z: -18 },
            { x: 12, z: -22 }
        ]
    },
    {
        nombre: 'Clienta1',
        modelo: '/modelos/Clienta1.glb',
        ruta: [
            { x: -20, z: -6 },
            { x: -26, z: -6 },
            { x: -26, z: -18 },
            { x: -20, z: -22 },
            { x: -10, z: -22 },
            { x: 0, z: -22 },
            { x: 12, z: -22 },
            { x: 20, z: -18 },
            { x: 22, z: -10 },
            { x: 12, z: -6 },
            { x: 0, z: -6 }
        ]
    },
    {
        nombre: 'Clienta2',
        modelo: '/modelos/Clienta2.glb',
        ruta: [
            { x: 20, z: 12 },
            { x: 23, z: 15 },
            { x: 18, z: 8 },
            { x: 17, z: 0 },
            { x: 12, z: -6 },
            { x: 17, z: -10 },
            { x: 20, z: -18 },
            { x: 12, z: -22 }
        ]
    },
    {
        nombre: 'Clienta3',
        modelo: '/modelos/Clienta3.glb',
        ruta: [
            { x: 24, z: -6 },
            { x: 17, z: -10 },
            { x: 12, z: -18 },
            { x: 20, z: -22 },
            { x: 12, z: -18 },
            { x: 17, z: -10 },
            { x: 22, z: -6 },
            { x: 24, z: 0 }
        ]
    }
];

// ============================================================
// LADRONES
// Se crean aparte de los clientes y no tienen carritos.
// Se usan modelos existentes como personajes provisionales.
// ============================================================

const CONFIG_LADRONES = [
    {
        nombre: 'Ladron1',
        modelo: '/modelos/Cliente3.glb',
        posicion: { x: -2, z: 38 },
        ruta: [
            { x: -2, z: 28 },
            { x: 0, z: 25 },
            { x: -5, z: 20 },
            { x: -12, z: 13 },
            { x: -12, z: 6.5 },
            { x: -5, z: 0 },
            { x: 5, z: -6 },
            { x: 12, z: -13 },
            { x: 12, z: -22 },
            { x: 0, z: -22 }
        ]
    },
    {
        nombre: 'Ladron2',
        modelo: '/modelos/Clienta3.glb',
        posicion: { x: 2, z: 40 },
        ruta: [
            { x: 2, z: 28 },
            { x: 0, z: 25 },
            { x: 5, z: 20 },
            { x: 12, z: 13 },
            { x: 17, z: 6.5 },
            { x: 17, z: 0 },
            { x: 12, z: -6 },
            { x: 0, z: -6 },
            { x: -12, z: -6 },
            { x: -20, z: -13 },
            { x: -20, z: -22 }
        ]
    }
];

// ============================================================
// VARIABLES
// ============================================================

let escena;
let camara;
let renderizador;
let controles;
let reloj;

let mercado = null;
let mobiliario = null;
let almacen = null;
let productosLacteos = null;
let sistemaVehiculos = null;

let luzAmbiente;
let luzSol;
let luzLuna;

let modoNoche = false;
let horaDia = 12;

let velocidadVertical = 0;
let jugadorEnSuelo = true;
let corriendo = false;

const teclas = Object.create(null);

const clientesSupermercado = [];
const ladronesSupermercado = [];
const carritosClientes = [];

let siguienteModeloCliente = 0;

const visitantesPorVehiculo = new Map();

const tiempoCompraAuto = 32;
const tiempoCajaAuto = 5;

const direccion = new THREE.Vector3();
const vectorAdelante = new THREE.Vector3();
const vectorDerecha = new THREE.Vector3();
const movimientoTemporal = new THREE.Vector3();
const ejeVertical = new THREE.Vector3(0, 1, 0);

// ============================================================
// INICIAR
// ============================================================

iniciar();

function iniciar() {
    crearEscena();
    crearCamara();
    crearRenderizador();

    reloj = new THREE.Clock();

    crearIluminacion();
    crearSuelo();
    crearEntorno();
    crearControles();
    crearInterfaz();
    crearEstructuraSupermercado();

    // CORRECCIÓN: crear los siete clientes al iniciar.
    crearClientesFijos();

    // Los vehículos siguen funcionando para visitas adicionales.
    crearSistemaVehiculos();

    // Ladrones separados, caminando sin carrito.
    crearLadrones();

    configurarEventos();
    actualizarIluminacion();
    iniciarAnimacion();

    console.info('Supermercado 3D iniciado.');
}

// ============================================================
// ESCENA
// ============================================================

function crearEscena() {
    escena = new THREE.Scene();
    escena.name = 'ESCENA_SUPERMERCADO';
    escena.background = new THREE.Color(CONFIG.colorCieloDia);
    escena.fog = new THREE.Fog(0xc7d9e9, 65, 150);
}

function crearCamara() {
    camara = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        500
    );

    camara.position.set(0, CONFIG.alturaJugador, 25);
}

function crearRenderizador() {
    renderizador = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: 'high-performance'
    });

    renderizador.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, CONFIG.pixelRatioMaximo)
    );

    renderizador.setSize(window.innerWidth, window.innerHeight);
    renderizador.shadowMap.enabled = CONFIG.sombras;
    renderizador.outputColorSpace = THREE.SRGBColorSpace;
    renderizador.toneMapping = THREE.ACESFilmicToneMapping;
    renderizador.toneMappingExposure = 1.1;

    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.appendChild(renderizador.domElement);

    Object.assign(renderizador.domElement.style, {
        position: 'fixed',
        inset: '0',
        width: '100%',
        height: '100%',
        display: 'block',
        outline: 'none'
    });
}

// ============================================================
// ILUMINACIÓN
// ============================================================

function crearIluminacion() {
    luzAmbiente = new THREE.HemisphereLight(0xe8f3ff, 0x6d6250, 1.8);
    escena.add(luzAmbiente);

    luzSol = new THREE.DirectionalLight(0xffedcf, 2.4);
    luzSol.position.set(-35, 55, 35);
    luzSol.castShadow = CONFIG.sombras;

    if (CONFIG.sombras) {
        luzSol.shadow.mapSize.set(1024, 1024);
        luzSol.shadow.camera.left = -55;
        luzSol.shadow.camera.right = 55;
        luzSol.shadow.camera.top = 55;
        luzSol.shadow.camera.bottom = -55;
        luzSol.shadow.camera.near = 0.5;
        luzSol.shadow.camera.far = 150;
        luzSol.shadow.bias = -0.0002;
    }

    escena.add(luzSol);

    luzLuna = new THREE.DirectionalLight(0x829bc9, 0.1);
    luzLuna.position.set(20, 35, -25);
    luzLuna.visible = false;
    escena.add(luzLuna);
}

// ============================================================
// SUELO Y EXTERIOR
// ============================================================

function crearSuelo() {
    const suelo = new THREE.Mesh(
        new THREE.PlaneGeometry(180, 180),
        new THREE.MeshStandardMaterial({
            color: 0x62696d,
            roughness: 0.88,
            metalness: 0.05
        })
    );

    suelo.name = 'SUELO_GENERAL';
    suelo.rotation.x = -Math.PI / 2;
    suelo.position.y = -0.025;
    suelo.receiveShadow = CONFIG.sombras;
    escena.add(suelo);

    const piso = new THREE.Mesh(
        new THREE.PlaneGeometry(64, 58),
        new THREE.MeshStandardMaterial({
            color: 0xbfc2c1,
            roughness: 0.8
        })
    );

    piso.name = 'PISO_INTERIOR';
    piso.rotation.x = -Math.PI / 2;
    piso.position.set(0, 0.005, 0);
    piso.receiveShadow = CONFIG.sombras;
    escena.add(piso);

    const grid = new THREE.GridHelper(64, 32, 0x92999c, 0xb3b8bb);
    grid.position.y = 0.012;
    grid.name = 'REFERENCIA_PISO';
    grid.material.transparent = true;
    grid.material.opacity = 0.14;
    escena.add(grid);
}

function crearEntorno() {
    const exterior = new THREE.Group();
    exterior.name = 'ENTORNO_EXTERIOR';
    escena.add(exterior);

    const asfalto = new THREE.Mesh(
        new THREE.PlaneGeometry(105, 105),
        new THREE.MeshStandardMaterial({
            color: 0x34393e,
            roughness: 0.94
        })
    );

    asfalto.name = 'AREA_EXTERIOR';
    asfalto.rotation.x = -Math.PI / 2;
    asfalto.position.set(0, -0.018, 42);
    asfalto.receiveShadow = CONFIG.sombras;
    exterior.add(asfalto);

    try {
        crearEstacionamiento(escena);
    } catch (error) {
        console.error('Error creando estacionamiento:', error);
    }
}

// ============================================================
// MERCADO, MOBILIARIO, ALMACÉN Y PRODUCTOS
// ============================================================

function crearEstructuraSupermercado() {
    try {
        mercado = crearMercado(escena);
        console.info('Mercado creado.');
    } catch (error) {
        console.error('Error creando mercado:', error);
    }

    try {
        mobiliario = crearMobiliario(escena, mercado);
    } catch (error) {
        console.error('Error creando mobiliario:', error);
    }

    try {
        almacen = crearAlmacen(escena, mercado);
    } catch (error) {
        console.error('Error creando almacén:', error);
    }

    try {
        productosLacteos = crearProductosLacteos(escena);
    } catch (error) {
        console.error('Error creando productos:', error);
    }
}

// ============================================================
// CARRITOS DE CLIENTES
// ============================================================

function crearCarritoVisitante(cliente, nombreCliente) {
    if (!cliente?.grupo) {
        console.warn(`No hay grupo para el carrito de ${nombreCliente}.`);
        return null;
    }

    const p = cliente.grupo.position;
    const r = cliente.grupo.rotation.y;

    const posicionInicial = {
        x: p.x - Math.sin(r) * CONFIG.distanciaCarrito,
        y: 0,
        z: p.z - Math.cos(r) * CONFIG.distanciaCarrito
    };

    let carrito = null;

    try {
        carrito = crearCarrito(escena, {
            modelo: '/modelos/carrito.glb',
            posicion: posicionInicial,
            distancia: CONFIG.distanciaCarrito,
            suavizado: CONFIG.suavizadoCarrito,
            correccionModelo: CONFIG.correccionModeloCarrito,
            escala: 1
        });

        if (!carrito?.grupo) {
            carrito?.eliminar?.();
            return null;
        }

        carrito.grupo.position.set(
            posicionInicial.x,
            0,
            posicionInicial.z
        );

        carrito.grupo.visible = true;
        carrito.seguirObjetivo?.(
            cliente.grupo,
            CONFIG.distanciaCarrito
        );

        carritosClientes.push(carrito);
        return carrito;
    } catch (error) {
        console.error(`Error creando carrito para ${nombreCliente}:`, error);
        carrito?.eliminar?.();
        return null;
    }
}

// ============================================================
// CREAR LOS SIETE CLIENTES INICIALES
// ============================================================

function crearClientesFijos() {
    console.info('Creando clientes iniciales...');

    for (const config of CONFIG_CLIENTES) {
        let cliente = null;
        let carrito = null;

        const inicio = config.ruta[0];

        try {
            cliente = crearClienteSupermercado(escena, {
                modelo: config.modelo,
                posicion: {
                    x: inicio.x,
                    y: 0,
                    z: inicio.z
                },
                velocidad: CONFIG.velocidadCliente,
                escala: 1,
                ruta: config.ruta,
                probabilidadCompra: CONFIG.probabilidadCompra,
                tiempoExaminar: CONFIG.tiempoExaminar,
                distanciaRecoger: CONFIG.distanciaRecoger,
                pausaEntreCompras: CONFIG.pausaEntreCompras
            });

            if (!cliente) {
                console.error(`No se creó ${config.nombre}.`);
                continue;
            }

            clientesSupermercado.push(cliente);

            carrito = crearCarritoVisitante(cliente, config.nombre);

            if (typeof cliente.configurarCompras === 'function') {
                cliente.configurarCompras({
                    productos: productosLacteos,
                    carrito,
                    alRecoger: producto => {
                        console.info(
                            `${config.nombre} recogió un producto:`,
                            producto
                        );
                    }
                });
            }

            console.info(`${config.nombre} creado correctamente.`);
        } catch (error) {
            console.error(`Error creando ${config.nombre}:`, error);

            carrito?.eliminar?.();
            cliente?.eliminar?.();

            const indice = clientesSupermercado.indexOf(cliente);
            if (indice !== -1) {
                clientesSupermercado.splice(indice, 1);
            }
        }
    }

    actualizarContadorClientes();
    console.info(`Clientes iniciales: ${clientesSupermercado.length}`);
}

// ============================================================
// CLIENTES QUE LLEGAN EN AUTOMÓVIL
// ============================================================

function crearSistemaVehiculos() {
    try {
        sistemaVehiculos = crearVehiculos(escena, {
            modelos: [
                '/modelos/auto.glb',
                '/modelos/auto2.glb',
                '/modelos/auto3.glb'
            ],
            escala: 1,
            longitudVehiculo: 4.3,
            velocidad: 5.5,
            tiempoEntreLlegadas: 7,
            cochesIniciales: 3,

            alEstacionar: datos => {
                crearClienteParaVehiculo(datos);
            },

            alSalir: datos => {
                const visita = visitantesPorVehiculo.get(datos.id);

                if (visita) {
                    visita.cliente?.eliminar?.();
                    visita.carrito?.eliminar?.();
                    visitantesPorVehiculo.delete(datos.id);
                }

                sistemaVehiculos?.solicitarLlegada();
            }
        });
    } catch (error) {
        console.error('Error creando sistema de vehículos:', error);
    }
}

function crearClienteParaVehiculo(datos) {
    const config =
        CONFIG_CLIENTES[
            siguienteModeloCliente % CONFIG_CLIENTES.length
        ];

    siguienteModeloCliente++;

    const posicion = {
        x: datos.plaza.x,
        y: 0,
        z: datos.plaza.z
    };

    let carrito = null;
    let cliente = null;

    try {
        cliente = crearClienteSupermercado(escena, {
            modelo: config.modelo,
            posicion,
            velocidad: CONFIG.velocidadCliente,
            escala: 1,
            ruta: config.ruta,
            inactivo: true,
            probabilidadCompra: CONFIG.probabilidadCompra,
            tiempoExaminar: CONFIG.tiempoExaminar,
            distanciaRecoger: CONFIG.distanciaRecoger,
            pausaEntreCompras: CONFIG.pausaEntreCompras,

            alEntrar: clienteEntrado => {
                const visita = visitantesPorVehiculo.get(datos.id);

                if (visita) {
                    visita.fase = 'comprando';
                    visita.tiempo = 0;
                }

                if (!carrito) {
                    carrito = crearCarritoVisitante(
                        clienteEntrado,
                        config.nombre
                    );
                }

                clienteEntrado.configurarCompras({
                    productos: productosLacteos,
                    carrito
                });

                mostrarMensaje(`${config.nombre} entró al supermercado.`);
            }
        });

        if (!cliente) return;

        cliente.configurarCompras({
            productos: productosLacteos,
            carrito: null
        });

        cliente.iniciarDesdeVehiculo(posicion, datos.plaza);
        clientesSupermercado.push(cliente);

        visitantesPorVehiculo.set(datos.id, {
            id: datos.id,
            plaza: datos.plaza,
            cliente,
            get carrito() {
                return carrito;
            },
            fase: 'entrando',
            tiempo: 0,
            nombre: config.nombre
        });

        actualizarContadorClientes();
        mostrarMensaje(`${config.nombre} estacionó.`);
    } catch (error) {
        console.error('Error creando cliente del vehículo:', error);
        cliente?.eliminar?.();
        carrito?.eliminar?.();
    }
}

// ============================================================
// LADRONES, SIN CARRITO
// ============================================================

function crearLadrones() {
    for (const config of CONFIG_LADRONES) {
        let ladron = null;

        try {
            ladron = crearClienteSupermercado(escena, {
                modelo: config.modelo,
                posicion: { ...config.posicion },
                velocidad: CONFIG.velocidadLadron,
                escala: 1,
                ruta: config.ruta,
                probabilidadCompra: 0,
                tiempoExaminar: 0,
                distanciaRecoger: 0,
                pausaEntreCompras: 0
            });

            if (!ladron) {
                console.error(`No se creó ${config.nombre}.`);
                continue;
            }

            // No crear carrito para los ladrones.
            if (typeof ladron.configurarCompras === 'function') {
                ladron.configurarCompras({
                    productos: null,
                    carrito: null
                });
            }

            ladronesSupermercado.push(ladron);
            console.info(`${config.nombre} creado sin carrito.`);
        } catch (error) {
            console.error(`Error creando ${config.nombre}:`, error);
            ladron?.eliminar?.();
        }
    }

    actualizarContadorClientes();
}

// ============================================================
// CONTROLES
// ============================================================

function crearControles() {
    controles = new PointerLockControls(camara, renderizador.domElement);
    escena.add(controles.object);

    controles.object.position.set(0, CONFIG.alturaJugador, 25);

    controles.addEventListener('lock', () => {
        ocultarPantallaInicio();
        mostrarMensaje('Explora el supermercado');
    });

    controles.addEventListener('unlock', () => {
        mostrarPantallaInicio();

        for (const tecla in teclas) {
            teclas[tecla] = false;
        }

        corriendo = false;
    });
}

// ============================================================
// INTERFAZ
// ============================================================

function crearInterfaz() {
    const estilo = document.createElement('style');

    estilo.textContent = `
        #super-ui {
            position: fixed;
            inset: 0;
            z-index: 10;
            pointer-events: none;
            color: #fff;
            font-family: Arial, Helvetica, sans-serif;
        }

        #super-start {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 14px;
            padding: 24px;
            box-sizing: border-box;
            background: linear-gradient(135deg, rgba(7,18,28,.94), rgba(13,39,52,.86));
            pointer-events: auto;
            text-align: center;
        }

        #super-start h1 {
            margin: 0;
            font-size: clamp(30px,5vw,60px);
            letter-spacing: 3px;
        }

        #super-start p {
            max-width: 620px;
            line-height: 1.7;
            color: #d3e1e9;
        }

        #super-start button,
        #super-ui button {
            padding: 12px 20px;
            border: 1px solid rgba(255,255,255,.3);
            border-radius: 8px;
            color: white;
            background: rgba(31,105,129,.92);
            cursor: pointer;
            font-size: 15px;
            pointer-events: auto;
        }

        #super-hud {
            position: absolute;
            left: 16px;
            top: 16px;
            padding: 12px 15px;
            border: 1px solid rgba(255,255,255,.18);
            border-radius: 10px;
            background: rgba(9,17,24,.72);
            line-height: 1.8;
            font-size: 13px;
        }

        #super-crosshair {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: white;
            box-shadow: 0 0 4px #000;
            transform: translate(-50%,-50%);
        }

        #super-message {
            position: absolute;
            left: 50%;
            bottom: 10%;
            transform: translateX(-50%);
            padding: 10px 16px;
            border-radius: 8px;
            background: rgba(0,0,0,.72);
            opacity: 0;
            transition: opacity .2s;
            white-space: nowrap;
        }

        #super-controls {
            position: absolute;
            right: 16px;
            bottom: 16px;
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-end;
            gap: 8px;
            pointer-events: auto;
        }

        @media(max-width:650px) {
            #super-hud { font-size: 11px; }
            #super-controls { max-width: 230px; }
            #super-ui button { font-size: 12px; padding: 9px 12px; }
        }
    `;

    document.head.appendChild(estilo);

    const ui = document.createElement('div');
    ui.id = 'super-ui';

    ui.innerHTML = `
        <div id="super-start">
            <h1>SUPERMERCADO 3D</h1>
            <p>Explora los pasillos, refrigeradores, productos y diferentes áreas del supermercado.</p>
            <p>W A S D: moverte · Shift: correr · Espacio: saltar · Mouse: mirar · Esc: liberar cursor</p>
            <button id="super-enter">ENTRAR AL SUPERMERCADO</button>
        </div>

        <div id="super-hud">
            <strong>SUPERMERCADO</strong><br>
            Estado: <span id="super-state">Preparado</span><br>
            Velocidad: <span id="super-speed">0 m/s</span><br>
            Hora: <span id="super-time">12:00</span><br>
            Modo: <span id="super-mode">Día</span><br>
            Personas: <span id="super-client-count">0</span><br>
            Vehículos: <span id="super-car-count">0</span>
        </div>

        <div id="super-crosshair"></div>
        <div id="super-message"></div>

        <div id="super-controls">
            <button id="super-day">Día / Noche</button>
            <button id="super-arrival">Llega un coche</button>
            <button id="super-home">Volver a entrada</button>
        </div>
    `;

    document.body.appendChild(ui);

    document.getElementById('super-enter').addEventListener(
        'click',
        () => controles.lock()
    );

    document.getElementById('super-day').addEventListener('click', () => {
        modoNoche = !modoNoche;
        horaDia = modoNoche ? 22 : 12;
        actualizarIluminacion();
    });

    document.getElementById('super-arrival').addEventListener('click', () => {
        if (!sistemaVehiculos?.solicitarLlegada()) {
            mostrarMensaje('No hay vehículos disponibles o plazas libres');
        } else {
            mostrarMensaje('Nuevo vehículo en camino');
        }
    });

    document.getElementById('super-home').addEventListener('click', () => {
        controles.object.position.set(0, CONFIG.alturaJugador, 25);
        velocidadVertical = 0;
        jugadorEnSuelo = true;
        mostrarMensaje('Has vuelto a la entrada');
    });
}

// ============================================================
// EVENTOS
// ============================================================

function configurarEventos() {
    window.addEventListener('resize', () => {
        camara.aspect = window.innerWidth / window.innerHeight;
        camara.updateProjectionMatrix();

        renderizador.setSize(window.innerWidth, window.innerHeight);
        renderizador.setPixelRatio(
            Math.min(window.devicePixelRatio || 1, CONFIG.pixelRatioMaximo)
        );
    });

    document.addEventListener('keydown', evento => {
        teclas[evento.code] = true;

        if (
            evento.code === 'Space' &&
            jugadorEnSuelo &&
            controles.isLocked &&
            !evento.repeat
        ) {
            velocidadVertical = CONFIG.velocidadSalto;
            jugadorEnSuelo = false;
        }

        if (evento.code === 'ShiftLeft' || evento.code === 'ShiftRight') {
            corriendo = true;
        }
    });

    document.addEventListener('keyup', evento => {
        teclas[evento.code] = false;

        if (evento.code === 'ShiftLeft' || evento.code === 'ShiftRight') {
            corriendo = false;
        }
    });

    window.addEventListener('blur', () => {
        for (const tecla in teclas) {
            teclas[tecla] = false;
        }
        corriendo = false;
    });

    document.addEventListener('visibilitychange', () => {
        reloj.getDelta();
    });

    window.addEventListener('contextmenu', evento => evento.preventDefault());
}

// ============================================================
// MOVIMIENTO DEL JUGADOR
// ============================================================

function actualizarMovimiento(delta) {
    if (!controles?.isLocked) return;

    const velocidad = corriendo
        ? CONFIG.velocidadCorrer
        : CONFIG.velocidadCaminar;

    direccion.set(0, 0, 0);

    if (teclas.KeyW || teclas.ArrowUp) direccion.z += 1;
    if (teclas.KeyS || teclas.ArrowDown) direccion.z -= 1;
    if (teclas.KeyA || teclas.ArrowLeft) direccion.x -= 1;
    if (teclas.KeyD || teclas.ArrowRight) direccion.x += 1;

    const moviendo = direccion.lengthSq() > 0;

    if (moviendo) {
        direccion.normalize();

        camara.getWorldDirection(vectorAdelante);
        vectorAdelante.y = 0;

        if (vectorAdelante.lengthSq() > 0) {
            vectorAdelante.normalize();
        }

        vectorDerecha.crossVectors(vectorAdelante, ejeVertical).normalize();

        movimientoTemporal
            .set(0, 0, 0)
            .addScaledVector(vectorAdelante, direccion.z)
            .addScaledVector(vectorDerecha, direccion.x);

        if (movimientoTemporal.lengthSq() > 0) {
            controles.object.position.add(
                movimientoTemporal.normalize().multiplyScalar(velocidad * delta)
            );
        }
    }

    velocidadVertical -= CONFIG.gravedad * delta;
    controles.object.position.y += velocidadVertical * delta;

    if (controles.object.position.y <= CONFIG.alturaJugador) {
        controles.object.position.y = CONFIG.alturaJugador;
        velocidadVertical = 0;
        jugadorEnSuelo = true;
    }

    controles.object.position.x = THREE.MathUtils.clamp(
        controles.object.position.x, -50, 50
    );

    controles.object.position.z = THREE.MathUtils.clamp(
        controles.object.position.z, -55, 85
    );

    const velocidadUI = document.getElementById('super-speed');
    const estadoUI = document.getElementById('super-state');

    if (velocidadUI) {
        velocidadUI.textContent = `${moviendo ? velocidad : 0} m/s`;
    }

    if (estadoUI) {
        estadoUI.textContent = corriendo && moviendo
            ? 'Corriendo'
            : moviendo
                ? 'Caminando'
                : 'Detenido';
    }
}

// ============================================================
// DÍA Y NOCHE
// ============================================================

function actualizarIluminacion() {
    escena.background.setHex(
        modoNoche ? CONFIG.colorCieloNoche : CONFIG.colorCieloDia
    );

    escena.fog.color.setHex(modoNoche ? 0x17202e : 0xc7d9e9);

    luzAmbiente.intensity = modoNoche ? 0.65 : 1.8;
    luzSol.intensity = modoNoche ? 0.12 : 2.4;
    luzLuna.intensity = modoNoche ? 0.75 : 0.1;

    luzSol.visible = !modoNoche;
    luzLuna.visible = modoNoche;

    const elemento = document.getElementById('super-mode');
    if (elemento) elemento.textContent = modoNoche ? 'Noche' : 'Día';
}

function actualizarHora(delta) {
    horaDia += delta * 0.025;
    if (horaDia >= 24) horaDia = 0;

    const horas = Math.floor(horaDia);
    const minutos = Math.floor((horaDia - horas) * 60);
    const elemento = document.getElementById('super-time');

    if (elemento) {
        elemento.textContent =
            `${String(horas).padStart(2, '0')}:` +
            `${String(minutos).padStart(2, '0')}`;
    }
}

// ============================================================
// MENSAJES Y CONTADORES
// ============================================================

function mostrarMensaje(texto) {
    const elemento = document.getElementById('super-message');
    if (!elemento) return;

    elemento.textContent = texto;
    elemento.style.opacity = '1';

    if (elemento._temporizador) clearTimeout(elemento._temporizador);

    elemento._temporizador = setTimeout(() => {
        elemento.style.opacity = '0';
    }, 2400);
}

function ocultarPantallaInicio() {
    const elemento = document.getElementById('super-start');
    if (elemento) elemento.style.display = 'none';
}

function mostrarPantallaInicio() {
    const elemento = document.getElementById('super-start');
    if (elemento) elemento.style.display = 'flex';
}

function actualizarContadorClientes() {
    const elemento = document.getElementById('super-client-count');
    if (!elemento) return;

    const clientesActivos = clientesSupermercado.filter(
        cliente => cliente && !cliente.eliminado
    ).length;

    const ladronesActivos = ladronesSupermercado.filter(
        ladron => ladron && !ladron.eliminado
    ).length;

    elemento.textContent = String(clientesActivos + ladronesActivos);
}

// ============================================================
// ACTUALIZAR PERSONAJES, CARRITOS Y VEHÍCULOS
// ============================================================

function actualizarEntidades(delta) {
    if (sistemaVehiculos && typeof sistemaVehiculos.actualizar === 'function') {
        sistemaVehiculos.actualizar(delta);
    }

    // Actualizar clientes normales.
    for (const cliente of clientesSupermercado) {
        if (cliente && !cliente.eliminado) {
            cliente.actualizar(delta);
        }
    }

    // Actualizar ladrones sin asignarles carritos.
    for (const ladron of ladronesSupermercado) {
        if (ladron && !ladron.eliminado) {
            ladron.actualizar(delta);
        }
    }

    // Actualizar carritos normales.
    for (let i = carritosClientes.length - 1; i >= 0; i--) {
        const carrito = carritosClientes[i];

        if (!carrito) {
            carritosClientes.splice(i, 1);
            continue;
        }

        if (typeof carrito.actualizar === 'function') {
            carrito.actualizar(delta);
        }
    }

    // Ciclo de compra, caja y regreso al vehículo.
    for (const visita of visitantesPorVehiculo.values()) {
        if (!visita.cliente || visita.cliente.eliminado) continue;

        visita.tiempo += delta;

        if (
            visita.fase === 'comprando' &&
            visita.tiempo >= tiempoCompraAuto
        ) {
            visita.fase = 'caja';
            visita.tiempo = 0;

            visita.cliente.establecerRuta([{ x: 0, z: 20 }]);
            mostrarMensaje(`${visita.nombre} se dirige a cajas`);
        } else if (
            visita.fase === 'caja' &&
            visita.tiempo >= tiempoCajaAuto
        ) {
            visita.fase = 'regresando';
            visita.tiempo = 0;

            mostrarMensaje(`${visita.nombre} regresa a su auto`);

            visita.cliente.iniciarRegresoVehiculo(visita.plaza, () => {
                const carrito = visita.carrito;

                if (carrito?.grupo) carrito.grupo.visible = false;
                if (visita.cliente?.grupo) visita.cliente.grupo.visible = false;

                if (!sistemaVehiculos?.solicitarSalida(visita.id)) {
                    visita.cliente?.eliminar?.();
                    carrito?.eliminar?.();
                    visitantesPorVehiculo.delete(visita.id);
                }
            });
        }
    }

    const elementoVehiculos = document.getElementById('super-car-count');

    if (elementoVehiculos && sistemaVehiculos) {
        try {
            elementoVehiculos.textContent = String(
                sistemaVehiculos.obtenerVehiculos().filter(
                    vehiculo => vehiculo.estado === 'estacionado'
                ).length
            );
        } catch (error) {
            console.warn('No se pudo actualizar el contador de vehículos.', error);
        }
    }

    actualizarContadorClientes();
}

// ============================================================
// BUCLE PRINCIPAL
// ============================================================

function iniciarAnimacion() {
    renderizador.setAnimationLoop(() => {
        const delta = Math.min(reloj.getDelta(), 0.05);

        try {
            actualizarMovimiento(delta);
            actualizarHora(delta);
            actualizarEntidades(delta);
            renderizador.render(escena, camara);
        } catch (error) {
            console.error('Error durante la animación:', error);
        }
    });
}
