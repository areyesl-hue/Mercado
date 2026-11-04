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
import { crearLadron } from './ladron.js';

// ============================================================
// CONFIGURACIÓN GENERAL
// ============================================================

const CONFIG = {
    alturaJugador: 1.7,
    velocidadCaminar: 7,
    velocidadCorrer: 12,
    velocidadSalto: 7,
    gravedad: 19,

    colorCieloDia: 0xa9c9e8,
    colorCieloNoche: 0x101827,

    pixelRatioMaximo: 0.75,
    antialias: false,
    sombras: false,
    limiteDelta: 0.033,

    distanciaCarrito: 1.15,
    suavizadoCarrito: 6,

    velocidadCliente: 1.5,
    probabilidadCompra: 0.75,
    tiempoExaminar: 1.5,
    distanciaRecoger: 2,
    pausaEntreCompras: 1.8,

    tiempoCompraAuto: 60,
    maximoProductosCliente: 3,

    cajasRegistradoras: [
        { id: 1, x: -17, z: 23.95 },
        { id: 2, x: -12, z: 23.95 },
        { id: 3, x: 12, z: 23.95 },
        { id: 4, x: 17, z: 23.95 }
    ],

    distanciaRegistro: 0.7,
    maximoRegistros: 20000
};

const INTERVALO_HUD = 0.25;
const INTERVALO_REINTENTO_CAJA = 1;

let acumuladorHUD = 0;

// ============================================================
// CONFIGURACIÓN DE CLIENTES
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
            { x: -27, z: 12.2 },
            { x: -29, z: 8 },
            { x: -20, z: 6.5 },
            { x: -12, z: 6.5 },
            { x: 0, z: 6.5 },
            { x: 12, z: 6.5 },
            { x: 22, z: 6.5 },
            { x: 21, z: -6 },
            { x: 12, z: -6 },
            { x: 0, z: -6 },
            { x: -12, z: -6 }
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
            { x: 20, z: -18 },
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
            { x: 17, z: -10 },
            { x: 22, z: -6 },
            { x: 24, z: 0 }
        ]
    }
];

// ============================================================
// CONFIGURACIÓN DE LADRONES
// ============================================================

const CONFIG_LADRONES = [
    {
        id: 'Ladron1',
        modelo: '/modelos/ladron1.glb',
        posicion: { x: -2, y: 0, z: 31 },
        velocidadCaminar: 1.8,
        velocidadHuida: 5.8,
        productosRobados: 2
    },
    {
        id: 'Ladron2',
        modelo: '/modelos/ladron2.glb',
        posicion: { x: 2, y: 0, z: 31 },
        velocidadCaminar: 2,
        velocidadHuida: 6.2,
        productosRobados: 3
    }
];

const INTERVALO_LADRONES = 25;
const MAXIMO_LADRONES_ACTIVOS = 2;
const MINIMO_INTERVALO_LADRONES = 18;
const MAXIMO_INTERVALO_LADRONES = 32;

let temporizadorLadrones = INTERVALO_LADRONES;
let indiceSiguienteLadron = 0;

// ============================================================
// 30 CÁMARAS DE SEGURIDAD
// ============================================================
// Las cámaras de productos utilizan FOV reducido para acercar
// la imagen. Las posiciones apuntan hacia los estantes.
// ============================================================

const CONFIG_CAMARAS = [

    // --------------------------------------------------------
    // GÓNDOLAS IZQUIERDAS
    // --------------------------------------------------------

    {
        nombre: 'Cámara 1 - Góndola izquierda frontal',
        posicion: { x: -20.5, y: 2.35, z: 10 },
        objetivo: { x: -17, y: 1.15, z: 13 },
        fov: 43
    },
    {
        nombre: 'Cámara 2 - Góndola izquierda frontal opuesta',
        posicion: { x: -13.5, y: 2.35, z: 16 },
        objetivo: { x: -17, y: 1.15, z: 13 },
        fov: 43
    },
    {
        nombre: 'Cámara 3 - Góndola izquierda central',
        posicion: { x: -20.5, y: 2.35, z: -3 },
        objetivo: { x: -17, y: 1.15, z: 0 },
        fov: 43
    },
    {
        nombre: 'Cámara 4 - Góndola izquierda central opuesta',
        posicion: { x: -13.5, y: 2.35, z: 3 },
        objetivo: { x: -17, y: 1.15, z: 0 },
        fov: 43
    },

    // --------------------------------------------------------
    // GÓNDOLAS CENTRALES
    // --------------------------------------------------------

    {
        nombre: 'Cámara 5 - Góndola central izquierda frontal',
        posicion: { x: -12.5, y: 2.35, z: 10 },
        objetivo: { x: -9, y: 1.15, z: 13 },
        fov: 43
    },
    {
        nombre: 'Cámara 6 - Góndola central izquierda posterior',
        posicion: { x: -5.5, y: 2.35, z: 16 },
        objetivo: { x: -9, y: 1.15, z: 13 },
        fov: 43
    },
    {
        nombre: 'Cámara 7 - Góndola central derecha frontal',
        posicion: { x: 5.5, y: 2.35, z: 3 },
        objetivo: { x: 9, y: 1.15, z: 0 },
        fov: 43
    },
    {
        nombre: 'Cámara 8 - Góndola central derecha posterior',
        posicion: { x: 12.5, y: 2.35, z: -3 },
        objetivo: { x: 9, y: 1.15, z: 0 },
        fov: 43
    },

    // --------------------------------------------------------
    // GÓNDOLAS DERECHAS
    // --------------------------------------------------------

    {
        nombre: 'Cámara 9 - Góndola derecha frontal',
        posicion: { x: 12.5, y: 2.35, z: 10 },
        objetivo: { x: 17, y: 1.15, z: 13 },
        fov: 43
    },
    {
        nombre: 'Cámara 10 - Góndola derecha frontal opuesta',
        posicion: { x: 21.5, y: 2.35, z: 16 },
        objetivo: { x: 17, y: 1.15, z: 13 },
        fov: 43
    },
    {
        nombre: 'Cámara 11 - Góndola derecha posterior',
        posicion: { x: 12.5, y: 2.35, z: -16 },
        objetivo: { x: 17, y: 1.15, z: -13 },
        fov: 43
    },
    {
        nombre: 'Cámara 12 - Góndola derecha posterior opuesta',
        posicion: { x: 21.5, y: 2.35, z: -10 },
        objetivo: { x: 17, y: 1.15, z: -13 },
        fov: 43
    },

    // --------------------------------------------------------
    // REFRIGERADORES
    // --------------------------------------------------------

    {
        nombre: 'Cámara 13 - Refrigeradores extremos izquierdos',
        posicion: { x: -30, y: 2.5, z: -21.5 },
        objetivo: { x: -27, y: 1.25, z: -26.5 },
        fov: 42
    },
    {
        nombre: 'Cámara 14 - Refrigeradores centrales izquierdos',
        posicion: { x: -23, y: 2.5, z: -21.5 },
        objetivo: { x: -20, y: 1.25, z: -26.5 },
        fov: 42
    },
    {
        nombre: 'Cámara 15 - Refrigeradores centrales derechos',
        posicion: { x: 23, y: 2.5, z: -21.5 },
        objetivo: { x: 20, y: 1.25, z: -26.5 },
        fov: 42
    },
    {
        nombre: 'Cámara 16 - Refrigeradores extremos derechos',
        posicion: { x: 30, y: 2.5, z: -21.5 },
        objetivo: { x: 27, y: 1.25, z: -26.5 },
        fov: 42
    },

    // --------------------------------------------------------
    // FRUTAS Y VERDURAS
    // --------------------------------------------------------

    {
        nombre: 'Cámara 17 - Frutas mesa exterior izquierda',
        posicion: { x: -29, y: 2.5, z: 19 },
        objetivo: { x: -25.5, y: 0.9, z: 15 },
        fov: 40
    },
    {
        nombre: 'Cámara 18 - Frutas mesa exterior derecha',
        posicion: { x: -18, y: 2.5, z: 19 },
        objetivo: { x: -21.7, y: 0.9, z: 15 },
        fov: 40
    },
    {
        nombre: 'Cámara 19 - Verduras mesa interior izquierda',
        posicion: { x: -29, y: 2.5, z: 7 },
        objetivo: { x: -25.5, y: 0.9, z: 10.8 },
        fov: 40
    },
    {
        nombre: 'Cámara 20 - Verduras mesa interior derecha',
        posicion: { x: -18, y: 2.5, z: 7 },
        objetivo: { x: -21.7, y: 0.9, z: 10.8 },
        fov: 40
    },

    // --------------------------------------------------------
    // PANADERÍA Y VITRINAS
    // --------------------------------------------------------

    {
        nombre: 'Cámara 21 - Vitrinas derecha superior',
        posicion: { x: 20.5, y: 2.5, z: 17.5 },
        objetivo: { x: 25.2, y: 1.1, z: 15.2 },
        fov: 42
    },
    {
        nombre: 'Cámara 22 - Vitrinas derecha inferior',
        posicion: { x: 20.5, y: 2.5, z: 8.5 },
        objetivo: { x: 25.2, y: 1.1, z: 11.4 },
        fov: 42
    },

    // --------------------------------------------------------
    // CAJAS Y ENTRADA
    // --------------------------------------------------------

    {
        nombre: 'Cámara 23 - Cajas registradoras izquierdas',
        posicion: { x: -20, y: 3.2, z: 22 },
        objetivo: { x: -14.5, y: 1.1, z: 23.95 },
        fov: 48
    },
    {
        nombre: 'Cámara 24 - Cajas registradoras derechas',
        posicion: { x: 20, y: 3.2, z: 22 },
        objetivo: { x: 14.5, y: 1.1, z: 23.95 },
        fov: 48
    },
    {
        nombre: 'Cámara 25 - Entrada principal',
        posicion: { x: -5, y: 3.5, z: 28 },
        objetivo: { x: 0, y: 1.2, z: 20 },
        fov: 52
    },
    {
        nombre: 'Cámara 26 - Pasillo central',
        posicion: { x: 0, y: 4, z: -12 },
        objetivo: { x: 0, y: 1.2, z: 5 },
        fov: 55
    },

    // --------------------------------------------------------
    // ESTACIONAMIENTO
    // --------------------------------------------------------

    {
        nombre: 'Cámara 27 - Entrada de vehículos',
        posicion: { x: -13, y: 5, z: 33 },
        objetivo: { x: 0, y: 1.2, z: 39 },
        fov: 55
    },
    {
        nombre: 'Cámara 28 - Estacionamiento izquierdo',
        posicion: { x: -29, y: 5, z: 43 },
        objetivo: { x: -16, y: 1.2, z: 43 },
        fov: 55
    },
    {
        nombre: 'Cámara 29 - Estacionamiento derecho',
        posicion: { x: 29, y: 5, z: 43 },
        objetivo: { x: 16, y: 1.2, z: 43 },
        fov: 55
    },
    {
        nombre: 'Cámara 30 - Vista panorámica estacionamiento',
        posicion: { x: 0, y: 13, z: 58 },
        objetivo: { x: 0, y: 0, z: 40 },
        fov: 65
    }
];

// ============================================================
// VARIABLES GLOBALES
// ============================================================

let escena;
let camara;
let renderizador;
let controles;
let reloj;

let sistemaVehiculos = null;
let productosLacteos = null;

let luzAmbiente;
let luzSol;
let luzLuna;

let modoNoche = false;
let juegoIniciado = false;
let velocidadVertical = 0;
let jugadorEnSuelo = true;

let vistaSeguridad = null;
let posicionJugadorGuardada = null;
let quaternionJugadorGuardado = null;
let fovJugadorGuardado = null;

let siguienteModeloCliente = 0;
let ultimaPosicionRegistrada = null;
let temporizadorMensaje = null;

const teclas = Object.create(null);

const clientesSupermercado = [];
const ladronesSupermercado = [];
const carritosClientes = [];

const visitantesPorVehiculo = new Map();
const cajasOcupadas = new Map();

const trayectoriaJugador = [];
const ticketsGenerados = [];

const LIMITE_JUGADOR = {
    minX: -31,
    maxX: 31,
    minZ: -55,
    maxZ: 55
};

const vectorAdelante = new THREE.Vector3();
const vectorDerecha = new THREE.Vector3();
const movimientoJugador = new THREE.Vector3();
const ejeVertical = new THREE.Vector3(0, 1, 0);

// ============================================================
// INICIO
// ============================================================

iniciar();

function iniciar() {
    crearEscena();
    crearCamara();
    crearRenderizador();
    crearIluminacion();

    reloj = new THREE.Clock();

    crearControles();
    crearInterfaz();
    crearEstructuraSupermercado();

    optimizarSombrasEscena();

    crearLadrones();
    crearSistemaVehiculos();

    configurarEventos();
    actualizarIluminacion();
    actualizarHUD();

    iniciarAnimacion();

    console.info('Supermercado 3D iniciado.');
    console.info(`Cámaras: ${CONFIG_CAMARAS.length}`);
    console.info(`Cajas: ${CONFIG.cajasRegistradoras.length}`);
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
    camara.lookAt(0, CONFIG.alturaJugador, 15);
}

function crearRenderizador() {
    renderizador = new THREE.WebGLRenderer({
        antialias: CONFIG.antialias,
        powerPreference: 'high-performance',
        alpha: false,
        stencil: false,
        depth: true
    });

    renderizador.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, CONFIG.pixelRatioMaximo)
    );

    renderizador.setSize(window.innerWidth, window.innerHeight);
    renderizador.outputColorSpace = THREE.SRGBColorSpace;
    renderizador.toneMapping = THREE.NoToneMapping;

    renderizador.shadowMap.enabled = false;
    renderizador.shadowMap.autoUpdate = false;

    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.appendChild(renderizador.domElement);
}

// ============================================================
// ILUMINACIÓN
// ============================================================

function crearIluminacion() {
    luzAmbiente = new THREE.HemisphereLight(
        0xe8f3ff,
        0x777064,
        1.45
    );

    escena.add(luzAmbiente);

    luzSol = new THREE.DirectionalLight(0xffedcf, 1.15);
    luzSol.position.set(-35, 55, 35);
    luzSol.castShadow = false;
    escena.add(luzSol);

    luzLuna = new THREE.DirectionalLight(0x829bc9, 0.35);
    luzLuna.position.set(20, 35, -25);
    luzLuna.castShadow = false;
    luzLuna.visible = false;
    escena.add(luzLuna);
}

function actualizarIluminacion() {
    if (modoNoche) {
        escena.background.setHex(CONFIG.colorCieloNoche);
        escena.fog.color.setHex(CONFIG.colorCieloNoche);

        luzAmbiente.intensity = 0.85;
        luzSol.intensity = 0.08;

        luzLuna.visible = true;
        luzLuna.intensity = 0.45;
    } else {
        escena.background.setHex(CONFIG.colorCieloDia);
        escena.fog.color.setHex(0xc7d9e9);

        luzAmbiente.intensity = 1.45;
        luzSol.intensity = 1.15;

        luzLuna.visible = false;
    }
}

// ============================================================
// OPTIMIZAR SOMBRAS
// ============================================================

function optimizarSombrasEscena() {
    if (!escena) return;

    escena.traverse(objeto => {
        if (objeto.isLight) {
            objeto.castShadow = false;
        }

        if (objeto.isMesh) {
            objeto.castShadow = false;
            objeto.receiveShadow = false;
        }
    });

    console.info('[RENDIMIENTO] Sombras desactivadas.');
}

// ============================================================
// ESTRUCTURA DEL SUPERMERCADO
// ============================================================

function crearEstructuraSupermercado() {
    try {
        crearMercado(escena);
        console.info('Mercado creado.');
    } catch (error) {
        console.error('Error al crear mercado:', error);
    }

    try {
        crearMobiliario(escena);
        console.info('Mobiliario creado.');
    } catch (error) {
        console.error('Error al crear mobiliario:', error);
    }

    try {
        crearAlmacen(escena);
        console.info('Almacén creado.');
    } catch (error) {
        console.error('Error al crear almacén:', error);
    }

    try {
        productosLacteos = crearProductosLacteos(escena);
        console.info('Productos iniciados:', productosLacteos);
    } catch (error) {
        console.error('Error al iniciar productos:', error);
    }

    try {
        crearEstacionamiento(escena);
        console.info('Estacionamiento creado.');
    } catch (error) {
        console.error('Error al crear estacionamiento:', error);
    }

    optimizarSombrasEscena();
}

// ============================================================
// CONTROLES
// ============================================================

function limpiarTeclas() {
    for (const tecla of Object.keys(teclas)) {
        teclas[tecla] = false;
    }
}

function crearControles() {
    controles = new PointerLockControls(camara, renderizador.domElement);

    controles.addEventListener('unlock', limpiarTeclas);

    renderizador.domElement.addEventListener('click', () => {
        if (
            juegoIniciado &&
            vistaSeguridad === null &&
            !controles.isLocked
        ) {
            controles.lock();
        }
    });
}

// ============================================================
// LADRONES
// ============================================================

function crearLadrones() {
    if (!productosLacteos) {
        console.error('[LADRONES] No se recibieron los productos.');
        return;
    }

    generarSiguienteLadron();
    temporizadorLadrones = INTERVALO_LADRONES;

    console.info(`[LADRONES] Generador activado.`);
}

function generarSiguienteLadron() {
    if (!productosLacteos) return;

    const ladronesActivos =
        ladronesSupermercado.filter(
            ladron => ladron && !ladron.eliminado
        ).length;

    if (ladronesActivos >= MAXIMO_LADRONES_ACTIVOS) {
        temporizadorLadrones =
            MINIMO_INTERVALO_LADRONES +
            Math.random() *
            (MAXIMO_INTERVALO_LADRONES -
                MINIMO_INTERVALO_LADRONES);
        return;
    }

    const config = CONFIG_LADRONES[
        indiceSiguienteLadron % CONFIG_LADRONES.length
    ];

    indiceSiguienteLadron++;

    try {
        const ladron = crearLadron(
            escena,
            productosLacteos,
            {
                ...config,
                altura: 1.75,
                escala: 1,
                distanciaProducto: 1.5,
                tiempoRobo: 1.3,
                margenColision: 0.35,
                tamanoCelda: 0.5,

                alRobar: datos => {
                    console.info(`[LADRÓN] ${datos.id} robó un producto.`, datos);
                    mostrarMensaje(
                        `¡Robo detectado! ${datos.id} tomó ${datos.producto.nombre}.`
                    );
                },

                alEscapar: datos => {
                    console.info(`[LADRÓN] ${datos.id} escapó.`, datos);

                    mostrarMensaje(
                        `${datos.id} escapó con ${datos.cantidadRobada} productos.`
                    );
                }
            }
        );

        if (!ladron) {
            console.error(`[LADRONES] No se pudo crear ${config.id}.`);
            return;
        }

        ladronesSupermercado.push(ladron);

        console.info(`[LADRONES] ${config.id} apareció.`);
        mostrarMensaje(`¡Alerta! ${config.id} entró al supermercado.`);
    } catch (error) {
        console.error(`[LADRONES] Error creando ${config.id}:`, error);
    }
}

function actualizarGeneradorLadrones(delta) {
    if (!productosLacteos) return;
    if (
        ladronesSupermercado.filter(
            ladron => ladron && !ladron.eliminado
        ).length >= MAXIMO_LADRONES_ACTIVOS
    ) {
        return;
    }

    temporizadorLadrones -= delta;

    if (temporizadorLadrones <= 0) {
        generarSiguienteLadron();
        temporizadorLadrones =
            MINIMO_INTERVALO_LADRONES +
            Math.random() *
            (MAXIMO_INTERVALO_LADRONES -
                MINIMO_INTERVALO_LADRONES);
    }
}

// ============================================================
// VEHÍCULOS
// ============================================================

function crearSistemaVehiculos() {
    try {
        sistemaVehiculos = crearVehiculos(escena, {
            modelos: [
                '/modelos/auto.glb',
                '/modelos/auto2.glb',
                '/modelos/auto3.glb',
                '/modelos/auto4.glb',
                '/modelos/auto5.glb',
                '/modelos/auto6.glb',
                '/modelos/auto7.glb'
            ],
            escala: 1,
            longitudVehiculo: 4.3,
            anchoVehiculo: 1.9,
            velocidad: 6,
            aceleracion: 4,
            velocidadMaxima: 7,
            tiempoEntreLlegadas: 5,
            cochesIniciales: 3,
            maximoPorTanda: 3,

            alEstacionar: datos => {
                console.info('[VEHÍCULO] Auto estacionado:', datos);
                crearClienteParaVehiculo(datos);
            },

            alSalir: datos => {
                console.info('[VEHÍCULO] Auto saliendo:', datos);

                const id = datos?.vehiculo?.id;

                if (id !== undefined && id !== null) {
                    limpiarVisitaVehiculo(id);
                }
            }
        });

        if (!sistemaVehiculos) {
            console.error('[VEHÍCULOS] No se pudo inicializar.');
            return;
        }

        console.info('[VEHÍCULOS] Sistema iniciado correctamente.');
    } catch (error) {
        console.error('[VEHÍCULOS] Error:', error);
    }
}

// ============================================================
// CREAR VISITANTE AL ESTACIONARSE
// ============================================================

function crearClienteParaVehiculo(datos) {
    const idVehiculo = datos?.vehiculo?.id;

    if (
        !datos?.plaza ||
        idVehiculo === undefined ||
        idVehiculo === null
    ) {
        console.warn('[VISITANTE] Datos incompletos.', datos);
        return;
    }

    if (visitantesPorVehiculo.has(idVehiculo)) return;

    const config = CONFIG_CLIENTES[
        siguienteModeloCliente % CONFIG_CLIENTES.length
    ];

    siguienteModeloCliente++;

    const posicionInicio = {
        x: datos.plaza.x,
        y: 0,
        z: Math.min(54.5, datos.plaza.z + 1.8)
    };

    let cliente = null;

    try {
        cliente = crearClienteSupermercado(escena, {
            id: `VISITANTE_${idVehiculo}`,
            modelo: config.modelo,
            posicion: posicionInicio,
            velocidad: CONFIG.velocidadCliente,
            escala: 1,
            ruta: config.ruta,
            repetirRuta: false,
            inactivo: true,
            probabilidadCompra: CONFIG.probabilidadCompra,
            tiempoExaminar: CONFIG.tiempoExaminar,
            distanciaRecoger: CONFIG.distanciaRecoger,
            pausaEntreCompras: CONFIG.pausaEntreCompras,
            maximoProductos: CONFIG.maximoProductosCliente,
            distanciaDestino: 0.8,
            radioColision: 0.42,

            alEntrar: () => {
                const visita = visitantesPorVehiculo.get(idVehiculo);

                if (!visita || visita.fase !== 'entrando') return;

                visita.fase = 'comprando';
                visita.tiempo = 0;

                if (!visita.carrito) {
                    visita.carrito = crearCarritoVisitante(
                        visita.cliente,
                        idVehiculo
                    );
                }

                if (visita.carrito) {
                    visita.cliente.configurarCompras?.({
                        productos: productosLacteos,
                        carrito: visita.carrito
                    });
                }

                mostrarMensaje(
                    `${visita.nombreCliente} entró al supermercado.`
                );
            }
        });

        if (!cliente) {
            console.error(`No se pudo crear el visitante ${idVehiculo}.`);
            sistemaVehiculos?.solicitarSalida?.(idVehiculo);
            return;
        }

        cliente.nombre = config.nombre;

        const visita = {
            id: idVehiculo,
            idVehiculo,
            cliente,
            carrito: null,
            nombreCliente: config.nombre,
            plaza: {
                id: datos.plaza.id,
                x: datos.plaza.x,
                z: datos.plaza.z
            },
            fase: 'entrando',
            tiempo: 0,
            tiempoEsperaCaja: 0,
            pagoSolicitado: false,
            salidaSolicitada: false,
            intentosSalida: 0,
            cajaAsignada: null
        };

        visitantesPorVehiculo.set(idVehiculo, visita);
        clientesSupermercado.push(cliente);

        if (typeof cliente.iniciarDesdeVehiculo !== 'function') {
            console.error('El cliente no tiene iniciarDesdeVehiculo().');
            visita.fase = 'errorEntrada';
            solicitarSalidaVisitante(visita);
            return;
        }

        const iniciado = cliente.iniciarDesdeVehiculo(
            posicionInicio,
            visita.plaza
        );

        if (iniciado === false) {
            console.error(`No se pudo iniciar el visitante ${idVehiculo}.`);
            visita.fase = 'errorEntrada';
            solicitarSalidaVisitante(visita);
            return;
        }

        console.info(`[VISITANTE] ${idVehiculo} comenzó a caminar.`);
    } catch (error) {
        console.error('Error al crear visitante:', error);
        cliente?.eliminar?.();
        limpiarVisitaVehiculo(idVehiculo);
        sistemaVehiculos?.solicitarSalida?.(idVehiculo);
    }
}

// ============================================================
// CREAR CARRITO AL ENTRAR
// ============================================================

function crearCarritoVisitante(cliente, idVisita) {
    const grupoCliente = cliente?.grupo;

    if (!grupoCliente?.isObject3D) {
        console.error(`[CARRITO] No se encontró el grupo de ${idVisita}.`);
        return null;
    }

    try {
        const posicion = new THREE.Vector3();
        grupoCliente.getWorldPosition(posicion);

        const carrito = crearCarrito(escena, {
            modelo: '/modelos/carrito.glb',
            posicion: {
                x: posicion.x,
                y: 0,
                z: posicion.z
            },
            escala: 1,
            distancia: CONFIG.distanciaCarrito,
            suavizado: CONFIG.suavizadoCarrito,
            correccionModelo: Math.PI
        });

        if (!carrito?.grupo) {
            console.error(`[CARRITO] No se pudo crear ${idVisita}.`);
            return null;
        }

        carrito.seguirObjetivo(
            grupoCliente,
            CONFIG.distanciaCarrito
        );

        carritosClientes.push(carrito);

        console.info(`[CARRITO] Creado para ${idVisita}.`);
        return carrito;
    } catch (error) {
        console.error(`[CARRITO] Error creando ${idVisita}:`, error);
        return null;
    }
}

// ============================================================
// RETIRAR CLIENTE Y CARRITO
// ============================================================

function retirarClienteYCarritoDeVisita(visita) {
    if (!visita) return;

    const cliente = visita.cliente;
    const carrito = visita.carrito;

    try {
        carrito?.eliminar?.();
    } catch (error) {
        console.warn('No se pudo retirar el carrito:', error);
    }

    try {
        cliente?.eliminar?.();
    } catch (error) {
        console.warn('No se pudo retirar el cliente:', error);
    }

    const indiceCliente = clientesSupermercado.indexOf(cliente);
    if (indiceCliente !== -1) {
        clientesSupermercado.splice(indiceCliente, 1);
    }

    const indiceCarrito = carritosClientes.indexOf(carrito);
    if (indiceCarrito !== -1) {
        carritosClientes.splice(indiceCarrito, 1);
    }

    visita.cliente = null;
    visita.carrito = null;

    console.info(`[VISITANTE] ${visita.nombreCliente}: retirado.`);
}

// ============================================================
// LIMPIAR VISITA
// ============================================================

function limpiarVisitaVehiculo(idVehiculo) {
    const visita = visitantesPorVehiculo.get(idVehiculo);
    if (!visita) return;

    liberarCajaVisitante(visita);

    try {
        visita.carrito?.eliminar?.();
        visita.cliente?.eliminar?.();
    } catch (error) {
        console.warn('Error retirando visitante:', error);
    }

    const indiceCliente = clientesSupermercado.indexOf(visita.cliente);
    if (indiceCliente !== -1) {
        clientesSupermercado.splice(indiceCliente, 1);
    }

    const indiceCarrito = carritosClientes.indexOf(visita.carrito);
    if (indiceCarrito !== -1) {
        carritosClientes.splice(indiceCarrito, 1);
    }

    visitantesPorVehiculo.delete(idVehiculo);

    console.info(`[VISITANTE] Visita ${idVehiculo} eliminada.`);
}

// ============================================================
// RESERVACIÓN DE CAJAS
// ============================================================

function obtenerCajaDisponible() {
    return CONFIG.cajasRegistradoras.find(
        caja => !cajasOcupadas.has(caja.id)
    ) ?? null;
}

function reservarCaja(visita) {
    if (!visita) return null;
    if (visita.cajaAsignada) return visita.cajaAsignada;

    const caja = obtenerCajaDisponible();
    if (!caja) return null;

    cajasOcupadas.set(caja.id, visita.idVehiculo);
    visita.cajaAsignada = caja;

    console.info(`[CAJA ${caja.id}] Reservada para ${visita.nombreCliente}.`);

    return caja;
}

function liberarCajaVisitante(visita) {
    if (!visita?.cajaAsignada) return;

    const caja = visita.cajaAsignada;

    if (cajasOcupadas.get(caja.id) === visita.idVehiculo) {
        cajasOcupadas.delete(caja.id);
        console.info(`[CAJA ${caja.id}] Liberada.`);
    }

    visita.cajaAsignada = null;
}

// ============================================================
// ACTUALIZAR ENTIDADES
// ============================================================

function actualizarEntidades(delta) {
    actualizarLista(clientesSupermercado, delta);
    actualizarLista(ladronesSupermercado, delta);

    actualizarGeneradorLadrones(delta);

    for (let i = carritosClientes.length - 1; i >= 0; i--) {
        const carrito = carritosClientes[i];

        if (!carrito || carrito.eliminado) {
            carritosClientes.splice(i, 1);
            continue;
        }

        try {
            carrito.actualizar?.(delta);
        } catch (error) {
            console.error('Error actualizando carrito:', error);
        }
    }

    if (typeof sistemaVehiculos?.actualizarCompleto === 'function') {
        sistemaVehiculos.actualizarCompleto(delta);
    } else if (typeof sistemaVehiculos?.actualizar === 'function') {
        sistemaVehiculos.actualizar(delta);
    }

    actualizarFasesVisitantes(delta);
}

function actualizarLista(lista, delta) {
    for (let i = lista.length - 1; i >= 0; i--) {
        const entidad = lista[i];

        if (!entidad || entidad.eliminado) {
            lista.splice(i, 1);
            continue;
        }

        try {
            entidad.actualizar?.(delta);
        } catch (error) {
            console.error('Error actualizando entidad:', error);
        }
    }
}

// ============================================================
// ESTADO DE CLIENTES
// ============================================================

function obtenerEstadoCliente(cliente) {
    return String(cliente?.estado ?? '').toLowerCase();
}

function clienteEstaOcupadoComprando(estado) {
    return [
        'entrando',
        'entrandosupermercado',
        'acercandose',
        'acercandoseproducto',
        'recogiendo',
        'recogiendoproducto',
        'inspeccionando',
        'decidiendo',
        'guardando',
        'guardandoproducto',
        'devolviendo',
        'devolviendoproducto',
        'ruta',
        'yendocaja',
        'caja',
        'pagando',
        'regresando',
        'regresandovehiculo'
    ].includes(estado);
}

function obtenerComprasCliente(cliente) {
    if (typeof cliente?.obtenerCompras === 'function') {
        const compras = cliente.obtenerCompras();
        return Array.isArray(compras) ? compras : [];
    }

    if (typeof cliente?.obtenerResumen === 'function') {
        const resumen = cliente.obtenerResumen();

        if (Array.isArray(resumen?.compras)) return resumen.compras;
        if (Array.isArray(resumen?.productos)) return resumen.productos;
    }

    if (Array.isArray(cliente?.compras)) return cliente.compras;

    return [];
}

// ============================================================
// CICLO DE VISITANTES
// ============================================================

function actualizarFasesVisitantes(delta) {
    for (const visita of visitantesPorVehiculo.values()) {
        const cliente = visita.cliente;

        if (!cliente || cliente.eliminado) continue;

        if (visita.fase === 'esperandoCaja') {
            visita.tiempoEsperaCaja =
                (visita.tiempoEsperaCaja ?? 0) + delta;

            if (visita.tiempoEsperaCaja >= INTERVALO_REINTENTO_CAJA) {
                visita.tiempoEsperaCaja = 0;
                iniciarPagoVisitante(visita);
            }

            continue;
        }

        if (visita.fase !== 'comprando') continue;
        if (visita.pagoSolicitado) continue;

        visita.tiempo += delta;

        const compras = obtenerComprasCliente(cliente);
        const estado = obtenerEstadoCliente(cliente);

        const maximoComprado =
            compras.length >= CONFIG.maximoProductosCliente;

        const tiempoAgotado =
            visita.tiempo >= CONFIG.tiempoCompraAuto;

        if (clienteEstaOcupadoComprando(estado)) continue;
        if (!maximoComprado && !tiempoAgotado) continue;

        visita.pagoSolicitado = true;
        iniciarPagoVisitante(visita);
    }

    for (const visita of visitantesPorVehiculo.values()) {
        if (visita.fase !== 'esperandoSalida') continue;
        if (visita.salidaSolicitada) continue;

        visita.intentosSalida++;

        if (visita.intentosSalida % 60 === 0) {
            solicitarSalidaVisitante(visita);
        }
    }
}

// ============================================================
// PAGO
// ============================================================

function iniciarPagoVisitante(visita) {
    if (!visita) return;

    const cliente = visita.cliente;

    if (!cliente || typeof cliente.iniciarPago !== 'function') {
        visita.fase = 'errorPago';
        visita.pagoSolicitado = false;
        console.error('El cliente no tiene iniciarPago().');
        return;
    }

    const caja = reservarCaja(visita);

    if (!caja) {
        visita.fase = 'esperandoCaja';
        visita.pagoSolicitado = false;
        visita.tiempoEsperaCaja = 0;

        mostrarMensaje(
            `${visita.nombreCliente} está esperando una caja libre.`
        );

        return;
    }

    visita.fase = 'caja';
    visita.pagoSolicitado = true;

    mostrarMensaje(
        `${visita.nombreCliente} se dirige a la caja ${caja.id}.`
    );

    try {
        const iniciado = cliente.iniciarPago(
            { x: caja.x, z: caja.z },
            ticket => {
                liberarCajaVisitante(visita);
                finalizarPagoVisitante(visita, ticket);
            }
        );

        if (iniciado === false) {
            liberarCajaVisitante(visita);
            visita.fase = 'errorPago';
            visita.pagoSolicitado = false;
            mostrarMensaje('No se pudo iniciar el recorrido a caja.');
        }
    } catch (error) {
        liberarCajaVisitante(visita);
        visita.fase = 'errorPago';
        visita.pagoSolicitado = false;
        console.error('Error al iniciar pago:', error);
    }
}

// ============================================================
// FINALIZAR PAGO Y REGRESAR AL VEHÍCULO
// ============================================================

function finalizarPagoVisitante(visita, ticket) {
    if (!visita || visita.fase !== 'caja') return;

    liberarCajaVisitante(visita);
    visita.fase = 'regresando';

    if (ticket) {
        const ticketGuardado = {
            ...ticket,
            fecha: ticket.fecha ?? new Date().toLocaleString('es-MX')
        };

        ticketsGenerados.push(ticketGuardado);

        mostrarTicket(
            ticketGuardado,
            visita.nombreCliente ?? 'Cliente'
        );
    }

    const cliente = visita.cliente;

    if (!cliente || typeof cliente.iniciarRegresoVehiculo !== 'function') {
        console.error('El cliente no tiene iniciarRegresoVehiculo().');
        visita.fase = 'errorRegreso';
        return;
    }

    try {
        const iniciado = cliente.iniciarRegresoVehiculo(
            visita.plaza,
            () => {
                if (visita.fase !== 'regresando') return;

                visita.fase = 'esperandoSalida';

                mostrarMensaje(
                    `${visita.nombreCliente} regresó a su vehículo.`
                );

                retirarClienteYCarritoDeVisita(visita);
                solicitarSalidaVisitante(visita);
            }
        );

        if (iniciado === false) {
            visita.fase = 'errorRegreso';
            console.error('No se pudo iniciar el regreso al vehículo.');
        }
    } catch (error) {
        visita.fase = 'errorRegreso';
        console.error('Error en el regreso:', error);
    }
}

// ============================================================
// SOLICITAR SALIDA DEL VEHÍCULO
// ============================================================

function solicitarSalidaVisitante(visita) {
    if (!visita || visita.salidaSolicitada) return false;

    if (typeof sistemaVehiculos?.solicitarSalida !== 'function') {
        console.error('El sistema de vehículos no tiene solicitarSalida().');
        return false;
    }

    const resultado = sistemaVehiculos.solicitarSalida(
        visita.idVehiculo
    );

    if (resultado === true) {
        visita.salidaSolicitada = true;
        visita.fase = 'saliendo';

        mostrarMensaje(
            `El vehículo de ${visita.nombreCliente ?? 'el cliente'} está saliendo.`
        );

        return true;
    }

    visita.salidaSolicitada = false;
    return false;
}

// ============================================================
// MOVIMIENTO DEL JUGADOR
// ============================================================

function actualizarJugador(delta) {
    if (
        !juegoIniciado ||
        !controles.isLocked ||
        vistaSeguridad !== null
    ) {
        return;
    }

    movimientoJugador.set(0, 0, 0);

    controles.getDirection(vectorAdelante);
    vectorAdelante.y = 0;

    if (vectorAdelante.lengthSq() > 0) {
        vectorAdelante.normalize();
    }

    vectorDerecha.crossVectors(
        vectorAdelante,
        ejeVertical
    ).normalize();

    const velocidad = (
        teclas.ShiftLeft || teclas.ShiftRight
    )
        ? CONFIG.velocidadCorrer
        : CONFIG.velocidadCaminar;

    if (teclas.KeyW || teclas.ArrowUp) {
        movimientoJugador.add(vectorAdelante);
    }

    if (teclas.KeyS || teclas.ArrowDown) {
        movimientoJugador.sub(vectorAdelante);
    }

    if (teclas.KeyD || teclas.ArrowRight) {
        movimientoJugador.add(vectorDerecha);
    }

    if (teclas.KeyA || teclas.ArrowLeft) {
        movimientoJugador.sub(vectorDerecha);
    }

    if (movimientoJugador.lengthSq() > 0) {
        movimientoJugador.normalize();

        camara.position.addScaledVector(
            movimientoJugador,
            velocidad * delta
        );
    }

    velocidadVertical -= CONFIG.gravedad * delta;
    camara.position.y += velocidadVertical * delta;

    if (camara.position.y <= CONFIG.alturaJugador) {
        camara.position.y = CONFIG.alturaJugador;
        velocidadVertical = 0;
        jugadorEnSuelo = true;
    }

    camara.position.x = THREE.MathUtils.clamp(
        camara.position.x,
        LIMITE_JUGADOR.minX,
        LIMITE_JUGADOR.maxX
    );

    camara.position.z = THREE.MathUtils.clamp(
        camara.position.z,
        LIMITE_JUGADOR.minZ,
        LIMITE_JUGADOR.maxZ
    );

    registrarTrayectoria(camara.position);
}

// ============================================================
// REGISTRO DEL RECORRIDO
// ============================================================

function registrarTrayectoria(posicion) {
    if (ultimaPosicionRegistrada) {
        const dx = posicion.x - ultimaPosicionRegistrada.x;
        const dz = posicion.z - ultimaPosicionRegistrada.z;

        if (Math.hypot(dx, dz) < CONFIG.distanciaRegistro) return;
    }

    trayectoriaJugador.push({
        fecha: new Date().toISOString(),
        x: Number(posicion.x.toFixed(3)),
        y: Number(posicion.y.toFixed(3)),
        z: Number(posicion.z.toFixed(3))
    });

    ultimaPosicionRegistrada = {
        x: posicion.x,
        y: posicion.y,
        z: posicion.z
    };

    if (trayectoriaJugador.length > CONFIG.maximoRegistros) {
        trayectoriaJugador.shift();
    }
}

function exportarTrayectoria() {
    if (!trayectoriaJugador.length) {
        mostrarMensaje('Muévete primero para registrar el recorrido.');
        return;
    }

    const filas = [
        'fecha,x,y,z',
        ...trayectoriaJugador.map(
            p => `${p.fecha},${p.x},${p.y},${p.z}`
        )
    ];

    descargarCSV(
        filas.join('\n'),
        'recorrido_supermercado.csv'
    );

    mostrarMensaje('Recorrido exportado.');
}

// ============================================================
// TICKETS
// ============================================================

function obtenerArticulosTicket(ticket) {
    if (Array.isArray(ticket?.articulos)) return ticket.articulos;
    if (Array.isArray(ticket?.productos)) return ticket.productos;
    if (Array.isArray(ticket?.items)) return ticket.items;
    return [];
}

function obtenerSubtotalArticulo(articulo) {
    const cantidad = Number(articulo.cantidad ?? 1);

    if (
        articulo.subtotal !== undefined &&
        Number.isFinite(Number(articulo.subtotal))
    ) {
        return Number(articulo.subtotal);
    }

    if (
        articulo.total !== undefined &&
        Number.isFinite(Number(articulo.total))
    ) {
        return Number(articulo.total);
    }

    const precio = Number(
        articulo.precioUnitario ?? articulo.precio ?? 0
    );

    return precio * cantidad;
}

function exportarTickets() {
    if (!ticketsGenerados.length) {
        mostrarMensaje('Todavía no hay tickets generados.');
        return;
    }

    const filas = [
        'ticket,cliente,fecha,producto,cantidad,precio_unitario,subtotal,total'
    ];

    for (const ticket of ticketsGenerados) {
        for (const articulo of obtenerArticulosTicket(ticket)) {
            const cantidad = Number(articulo.cantidad ?? 1);
            const subtotal = obtenerSubtotalArticulo(articulo);

            const valores = [
                ticket.idTicket ?? '',
                ticket.idCliente ?? '',
                ticket.fecha ?? '',
                articulo.nombre ?? articulo.nombreProducto ?? '',
                cantidad,
                articulo.precioUnitario ?? articulo.precio ?? 0,
                subtotal,
                ticket.total ?? 0
            ];

            filas.push(
                valores.map(valor =>
                    `"${String(valor).replaceAll('"', '""')}"`
                ).join(',')
            );
        }
    }

    descargarCSV(
        filas.join('\n'),
        'tickets_supermercado.csv'
    );

    mostrarMensaje('Tickets exportados.');
}

function descargarCSV(contenido, nombreArchivo) {
    const blob = new Blob(
        ['\uFEFF', contenido],
        { type: 'text/csv;charset=utf-8;' }
    );

    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');

    enlace.href = url;
    enlace.download = nombreArchivo;

    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================
// MOSTRAR TICKET
// ============================================================

function mostrarTicket(ticket, nombreCliente = 'Cliente') {
    const ventana = document.getElementById('ticket-supermercado');
    if (!ventana || !ticket) return;

    const datos = document.getElementById('ticket-datos');
    const articulos = document.getElementById('ticket-articulos');
    const totalElemento = document.getElementById('ticket-total');

    if (!datos || !articulos || !totalElemento) return;

    const lista = obtenerArticulosTicket(ticket);

    datos.textContent =
        `Folio: ${ticket.idTicket ?? 'SIN FOLIO'} | ` +
        `Cliente: ${ticket.idCliente ?? nombreCliente} | ` +
        `Fecha: ${ticket.fecha ?? new Date().toLocaleString('es-MX')}`;

    articulos.replaceChildren();

    let totalCalculado = 0;

    for (const articulo of lista) {
        const fila = document.createElement('tr');

        const nombre = document.createElement('td');
        nombre.textContent =
            articulo.nombre ??
            articulo.nombreProducto ??
            articulo.producto ??
            'Producto';

        const cantidad = document.createElement('td');
        cantidad.textContent = String(articulo.cantidad ?? 1);

        const importe = document.createElement('td');
        const subtotal = obtenerSubtotalArticulo(articulo);

        totalCalculado += subtotal;
        importe.textContent = `$${subtotal.toFixed(2)}`;

        fila.append(nombre, cantidad, importe);
        articulos.append(fila);
    }

    const total = Number.isFinite(Number(ticket.total))
        ? Number(ticket.total)
        : totalCalculado;

    totalElemento.textContent = `$${total.toFixed(2)}`;
    ventana.style.display = 'flex';
}

// ============================================================
// CÁMARAS DE SEGURIDAD
// ============================================================

function crearInterfazCamaras() {
    const panel = document.createElement('div');
    panel.id = 'panel-camaras';

    Object.assign(panel.style, {
        position: 'fixed',
        left: '50%',
        bottom: '10px',
        transform: 'translateX(-50%)',
        zIndex: '150',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '4px',
        width: 'min(950px, 95vw)',
        maxHeight: '145px',
        overflowY: 'auto',
        padding: '7px',
        boxSizing: 'border-box',
        borderRadius: '8px',
        background: 'rgba(8,16,24,.88)'
    });

    CONFIG_CAMARAS.forEach((config, indice) => {
        const boton = document.createElement('button');

        boton.textContent = `CAM ${String(indice + 1).padStart(2, '0')}`;
        boton.title = config.nombre;
        boton.className = 'boton-supermercado';

        boton.addEventListener('click', () => {
            cambiarVistaSeguridad(indice + 1);
        });

        panel.appendChild(boton);
    });

    const botonJugador = document.createElement('button');
    botonJugador.textContent = 'JUGADOR';
    botonJugador.className = 'boton-supermercado';
    botonJugador.addEventListener('click', volverAlJugador);

    panel.appendChild(botonJugador);
    document.body.appendChild(panel);
}

function cambiarVistaSeguridad(numero) {
    if (
        !Number.isInteger(numero) ||
        numero < 1 ||
        numero > CONFIG_CAMARAS.length
    ) {
        return;
    }

    const config = CONFIG_CAMARAS[numero - 1];

    // Guardar la posición, rotación y zoom original del jugador.
    if (vistaSeguridad === null) {
        posicionJugadorGuardada = camara.position.clone();
        quaternionJugadorGuardado = camara.quaternion.clone();
        fovJugadorGuardado = camara.fov;
    }

    limpiarTeclas();
    velocidadVertical = 0;
    vistaSeguridad = numero;

    controles.unlock();

    camara.position.set(
        config.posicion.x,
        config.posicion.y,
        config.posicion.z
    );

    camara.lookAt(
        config.objetivo.x,
        config.objetivo.y,
        config.objetivo.z
    );

    // Zoom de seguridad: FOV más pequeño = imagen más cercana.
    camara.fov = config.fov ?? 48;
    camara.updateProjectionMatrix();

    actualizarEstadoVista();
    mostrarMensaje(config.nombre);
}

function volverAlJugador() {
    if (vistaSeguridad !== null) {
        if (posicionJugadorGuardada) {
            camara.position.copy(posicionJugadorGuardada);
        }

        if (quaternionJugadorGuardado) {
            camara.quaternion.copy(quaternionJugadorGuardado);
        }

        if (fovJugadorGuardado !== null) {
            camara.fov = fovJugadorGuardado;
            camara.updateProjectionMatrix();
        }

        vistaSeguridad = null;
        posicionJugadorGuardada = null;
        quaternionJugadorGuardado = null;
        fovJugadorGuardado = null;
    }

    limpiarTeclas();
    actualizarEstadoVista();
}

function actualizarEstadoVista() {
    const elemento = document.getElementById('estado-vista');
    if (!elemento) return;

    if (vistaSeguridad === null) {
        elemento.textContent = 'Vista: jugador';
    } else {
        const config = CONFIG_CAMARAS[vistaSeguridad - 1];
        elemento.textContent = `Vista: ${config.nombre}`;
    }
}

// ============================================================
// INTERFAZ
// ============================================================

function crearInterfaz() {
    const estilos = document.createElement('style');

    estilos.textContent = `
        .boton-supermercado {
            padding:8px 11px;
            border:1px solid rgba(255,255,255,.2);
            border-radius:6px;
            background:#164d3b;
            color:white;
            font:bold 11px Arial;
            cursor:pointer;
        }

        .boton-supermercado:hover {
            background:#217a59;
        }

        #panel-camaras .boton-supermercado:active {
            background:#2c9b70;
        }

        #hud-supermercado {
            position:fixed;
            left:10px;
            top:10px;
            z-index:100;
            padding:10px;
            color:white;
            background:rgba(0,0,0,.72);
            border-radius:7px;
            font:12px/1.6 Arial;
            pointer-events:none;
        }

        #acciones-supermercado {
            position:fixed;
            top:10px;
            right:10px;
            z-index:150;
            display:flex;
            flex-wrap:wrap;
            justify-content:flex-end;
            gap:5px;
            max-width:420px;
        }

        #mensaje-supermercado {
            position:fixed;
            left:50%;
            bottom:165px;
            transform:translateX(-50%);
            z-index:200;
            padding:8px 13px;
            color:white;
            background:rgba(0,0,0,.8);
            border-radius:6px;
            font:12px Arial;
            pointer-events:none;
        }

        #portada-supermercado {
            position:fixed;
            inset:0;
            z-index:1000;
            display:flex;
            align-items:center;
            justify-content:center;
            flex-direction:column;
            gap:13px;
            padding:20px;
            color:white;
            background:linear-gradient(135deg,#0b1b29,#164d50);
            font-family:Arial;
            text-align:center;
        }

        #portada-supermercado h1 {
            font-size:clamp(28px,5vw,48px);
            margin:0;
        }

        #ticket-supermercado {
            position:fixed;
            inset:0;
            z-index:2000;
            display:none;
            align-items:center;
            justify-content:center;
            padding:15px;
            background:rgba(0,0,0,.78);
            font-family:Arial;
        }

        #ticket-contenido {
            width:min(380px,94vw);
            max-height:85vh;
            overflow:auto;
            padding:22px;
            background:white;
            color:#222;
            border-radius:8px;
        }

        #ticket-contenido h2 {
            text-align:center;
        }

        #ticket-contenido table {
            width:100%;
            border-collapse:collapse;
            font-size:12px;
        }

        #ticket-contenido td,
        #ticket-contenido th {
            padding:7px 3px;
            border-bottom:1px dashed #bbb;
            text-align:left;
        }

        #ticket-contenido .ticket-total {
            display:flex;
            justify-content:space-between;
            margin-top:15px;
            font-weight:bold;
            font-size:19px;
        }

        #ticket-contenido .ticket-botones {
            display:flex;
            gap:8px;
            margin-top:15px;
        }

        #ticket-contenido .ticket-botones button {
            flex:1;
        }

        @media(max-width:650px) {
            #hud-supermercado {
                left:5px;
                top:5px;
                max-width:150px;
                font-size:10px;
            }

            #acciones-supermercado {
                top:5px;
                right:5px;
                max-width:180px;
            }

            .boton-supermercado {
                padding:6px;
                font-size:9px;
            }

            #panel-camaras {
                max-height:120px !important;
            }
        }

        @media print {
            body * {
                visibility:hidden !important;
            }

            #ticket-supermercado,
            #ticket-supermercado * {
                visibility:visible !important;
            }

            #ticket-supermercado {
                position:absolute;
                display:flex !important;
                background:white;
            }

            #ticket-contenido {
                max-height:none;
                box-shadow:none;
            }

            #ticket-contenido .ticket-botones {
                display:none;
            }
        }
    `;

    document.head.appendChild(estilos);

    const portada = document.createElement('div');
    portada.id = 'portada-supermercado';

    portada.innerHTML = `
        <h1>SUPERMERCADO 3D</h1>
        <p>Explora el supermercado virtual.</p>
        <p>WASD: mover | SHIFT: correr | ESPACIO: saltar</p>
        <p>1-9: cámaras | F1-F12: cámaras adicionales | 0: volver</p>
        <button id="btn-entrar" class="boton-supermercado">
            ENTRAR AL SUPERMERCADO
        </button>
    `;

    document.body.appendChild(portada);

    const hud = document.createElement('div');
    hud.id = 'hud-supermercado';

    hud.innerHTML = `
        <strong>SUPERMERCADO 3D</strong><br>
        WASD: mover<br>
        SHIFT: correr<br>
        ESPACIO: saltar<br>
        ESC: liberar mouse
        <div id="estado-entidades">Clientes: 0 | Ladrones: 0</div>
        <div id="estado-recorrido">Recorrido: 0 puntos</div>
        <div id="estado-vista">Vista: jugador</div>
        <div id="estado-compras">Tickets: 0</div>
    `;

    document.body.appendChild(hud);

    const acciones = document.createElement('div');
    acciones.id = 'acciones-supermercado';

    acciones.innerHTML = `
        <button id="btn-dia-noche" class="boton-supermercado">DÍA / NOCHE</button>
        <button id="btn-llegada" class="boton-supermercado">LLEGADA DE AUTO</button>
        <button id="btn-entrada" class="boton-supermercado">VOLVER A ENTRADA</button>
        <button id="btn-recorrido" class="boton-supermercado">EXPORTAR RECORRIDO</button>
        <button id="btn-tickets" class="boton-supermercado">EXPORTAR TICKETS</button>
    `;

    document.body.appendChild(acciones);

    const mensaje = document.createElement('div');
    mensaje.id = 'mensaje-supermercado';
    mensaje.textContent = 'Pulsa ENTRAR para comenzar.';
    document.body.appendChild(mensaje);

    const ticket = document.createElement('div');
    ticket.id = 'ticket-supermercado';

    ticket.innerHTML = `
        <div id="ticket-contenido">
            <h2>SUPERMERCADO 3D</h2>
            <p id="ticket-datos"></p>
            <table>
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Cant.</th>
                        <th>Importe</th>
                    </tr>
                </thead>
                <tbody id="ticket-articulos"></tbody>
            </table>
            <div class="ticket-total">
                <span>TOTAL</span>
                <span id="ticket-total">$0.00</span>
            </div>
            <div class="ticket-botones">
                <button id="ticket-imprimir" class="boton-supermercado">IMPRIMIR</button>
                <button id="ticket-cerrar" class="boton-supermercado">CERRAR</button>
            </div>
        </div>
    `;

    document.body.appendChild(ticket);

    crearInterfazCamaras();

    document.getElementById('btn-entrar').onclick = () => {
        juegoIniciado = true;
        portada.style.display = 'none';
        controles.lock();
    };

    document.getElementById('btn-dia-noche').onclick = () => {
        modoNoche = !modoNoche;
        actualizarIluminacion();

        mostrarMensaje(
            modoNoche
                ? 'Modo nocturno activado.'
                : 'Modo diurno activado.'
        );
    };

    document.getElementById('btn-llegada').onclick = () => {
        if (typeof sistemaVehiculos?.solicitarLlegada !== 'function') {
            mostrarMensaje('El sistema de vehículos no está disponible.');
            return;
        }

        const resultado = sistemaVehiculos.solicitarLlegada();

        if (resultado === false || resultado === 0) {
            mostrarMensaje(
                'No hay plazas disponibles o no se pudo solicitar el vehículo.'
            );
            return;
        }

        mostrarMensaje('Llegada de vehículo solicitada.');
    };

    document.getElementById('btn-entrada').onclick = () => {
        volverAlJugador();

        camara.position.set(
            0,
            CONFIG.alturaJugador,
            25
        );

        camara.lookAt(
            0,
            CONFIG.alturaJugador,
            15
        );

        velocidadVertical = 0;
        jugadorEnSuelo = true;

        registrarTrayectoria(camara.position);
    };

    document.getElementById('btn-recorrido').onclick =
        exportarTrayectoria;

    document.getElementById('btn-tickets').onclick =
        exportarTickets;

    document.getElementById('ticket-cerrar').onclick = () => {
        ticket.style.display = 'none';
    };

    document.getElementById('ticket-imprimir').onclick = () => {
        window.print();
    };
}

// ============================================================
// MENSAJES
// ============================================================

function mostrarMensaje(texto) {
    const elemento = document.getElementById('mensaje-supermercado');
    if (!elemento) return;

    elemento.textContent = texto;
    elemento.style.display = 'block';

    if (temporizadorMensaje) {
        clearTimeout(temporizadorMensaje);
    }

    temporizadorMensaje = setTimeout(() => {
        elemento.style.display = 'none';
    }, 2500);
}

// ============================================================
// HUD
// ============================================================

function actualizarHUD() {
    const entidades = document.getElementById('estado-entidades');
    const recorrido = document.getElementById('estado-recorrido');
    const compras = document.getElementById('estado-compras');

    if (entidades) {
        entidades.textContent =
            `Clientes: ${clientesSupermercado.length}` +
            ` | Ladrones: ${ladronesSupermercado.length}`;
    }

    if (recorrido) {
        recorrido.textContent =
            `Recorrido: ${trayectoriaJugador.length} puntos`;
    }

    if (compras) {
        compras.textContent =
            `Tickets: ${ticketsGenerados.length}`;
    }

    actualizarEstadoVista();
}

// ============================================================
// EVENTOS
// ============================================================

function configurarEventos() {
    window.addEventListener('keydown', evento => {
        if (
            evento.code === 'Space' ||
            evento.code.startsWith('Arrow')
        ) {
            evento.preventDefault();
        }

        teclas[evento.code] = true;

        if (
            evento.code === 'Space' &&
            juegoIniciado &&
            controles.isLocked &&
            vistaSeguridad === null &&
            jugadorEnSuelo
        ) {
            velocidadVertical = CONFIG.velocidadSalto;
            jugadorEnSuelo = false;
        }

        // Cámaras 1 a 9.
        if (/^Digit[1-9]$/.test(evento.code)) {
            cambiarVistaSeguridad(Number(evento.code.slice(-1)));
        }

        if (/^Numpad[1-9]$/.test(evento.code)) {
            cambiarVistaSeguridad(Number(evento.code.slice(-1)));
        }

        // Cámaras 10 a 21 mediante F1 a F12.
        if (/^F([1-9]|1[0-2])$/.test(evento.code)) {
            const numeroFuncion = Number(evento.code.slice(1));
            cambiarVistaSeguridad(9 + numeroFuncion);
        }

        if (
            evento.code === 'Digit0' ||
            evento.code === 'Numpad0'
        ) {
            volverAlJugador();
        }
    });

    window.addEventListener('keyup', evento => {
        teclas[evento.code] = false;
    });

    window.addEventListener('blur', limpiarTeclas);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            limpiarTeclas();
            reloj.getDelta();
        }
    });

    window.addEventListener('resize', () => {
        camara.aspect = window.innerWidth / window.innerHeight;
        camara.updateProjectionMatrix();

        renderizador.setSize(
            window.innerWidth,
            window.innerHeight
        );

        renderizador.setPixelRatio(
            Math.min(
                window.devicePixelRatio || 1,
                CONFIG.pixelRatioMaximo
            )
        );
    });
}

// ============================================================
// BUCLE PRINCIPAL
// ============================================================

function iniciarAnimacion() {
    renderizador.setAnimationLoop(() => {
        const delta = Math.min(
            reloj.getDelta(),
            CONFIG.limiteDelta
        );

        actualizarJugador(delta);

        actualizarEntidades(delta);

        acumuladorHUD += delta;

        if (acumuladorHUD >= INTERVALO_HUD) {
            acumuladorHUD = 0;
            actualizarHUD();
        }

        renderizador.render(escena, camara);
    });
}
