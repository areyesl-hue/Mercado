
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

    pixelRatioMaximo: 1,
    sombras: false,

    distanciaCarrito: 1.15,
    suavizadoCarrito: 6,

    velocidadCliente: 1.5,
    velocidadLadron: 1.8,

    probabilidadCompra: 1,
    tiempoExaminar: 1.5,
    distanciaRecoger: 2,
    pausaEntreCompras: 1.8,

    tiempoCompraAuto: 32,
    tiempoCajaAuto: 5,

    distanciaRegistroTrayectoria: 0.5,
    maximoRegistrosTrayectoria: 20000
};

// ============================================================
// CLIENTES NORMALES
// ============================================================

const CONFIG_CLIENTES = [
    {
        nombre: 'Cliente1',
        modelo: '/modelos/Cliente2.glb',
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
        modelo: '/modelos/Clienta1.glb',
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
// TUS DOS LADRONES
// Se conservan las rutas que aparecen en tu main.js.
// ============================================================

const CONFIG_LADRONES = [
    {
        nombre: 'Ladron1',
        modelo: '/modelos/ladron1.glb',
        posicion: { x: -2, y: 0, z: 34 },
        velocidad: 1.8,
        ruta: [
            { x: -2, z: 24 },
            { x: -7, z: 19 },
            { x: -12, z: 6.5 },
            { x: -5, z: 6.5 },
            { x: 5, z: 0 },
            { x: 12, z: -6 },
            { x: 17, z: -10 },
            { x: 12, z: -18 },
            { x: 0, z: -22 },
            { x: -12, z: -6 }
        ]
    },
    {
        nombre: 'Ladron2',
        modelo: '/modelos/ladron2.glb',
        posicion: { x: 2, y: 0, z: 34 },
        velocidad: 2,
        ruta: [
            { x: 2, z: 24 },
            { x: 7, z: 19 },
            { x: 12, z: 10 },
            { x: 12, z: 6.5 },
            { x: 17, z: 0 },
            { x: 12, z: -6 },
            { x: 0, z: -6 },
            { x: -12, z: -6 },
            { x: -20, z: -6 },
            { x: -20, z: -22 },
            { x: 0, z: -22 }
        ]
    }
];

// ============================================================
// UBICACIONES DE LAS SEIS CÁMARAS DE SEGURIDAD
// Posiciones conservadas de tu sistema de vigilancia.
// ============================================================

const CONFIG_CAMARAS = [
    {
        id: 1,
        nombre: 'Entrada izquierda',
        posicion: { x: -29, y: 5.5, z: 17 },
        objetivo: { x: -12, y: 1.1, z: 10 }
    },
    {
        id: 2,
        nombre: 'Entrada derecha',
        posicion: { x: 29, y: 5.5, z: 17 },
        objetivo: { x: 12, y: 1.1, z: 10 }
    },
    {
        id: 3,
        nombre: 'Pasillo izquierdo',
        posicion: { x: -29, y: 5.5, z: -10 },
        objetivo: { x: -12, y: 1.1, z: -6 }
    },
    {
        id: 4,
        nombre: 'Pasillo derecho',
        posicion: { x: 29, y: 5.5, z: -10 },
        objetivo: { x: 12, y: 1.1, z: -6 }
    },
    {
        id: 5,
        nombre: 'Zona posterior',
        posicion: { x: -20, y: 5.1, z: -28 },
        objetivo: { x: 0, y: 1.1, z: -17 }
    },
    {
        id: 6,
        nombre: 'Estacionamiento',
        posicion: { x: 0, y: 5.8, z: 53 },
        objetivo: { x: 0, y: 1.1, z: 27 }
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

let mercado = null;
let mobiliario = null;
let almacen = null;
let productosLacteos = null;
let sistemaVehiculos = null;

let luzAmbiente;
let luzSol;
let luzLuna;

let modoNoche = false;
let velocidadVertical = 0;
let jugadorEnSuelo = true;

// El juego comienza después de pulsar el botón de entrada.
// El movimiento no depende de que Pointer Lock esté activo.
let juegoIniciado = false;

const teclas = Object.create(null);

const clientesSupermercado = [];
const ladronesSupermercado = [];
const carritosClientes = [];
const camarasSeguridad = [];
const trayectoriaJugador = [];

const visitantesPorVehiculo = new Map();

let siguienteModeloCliente = 0;
let contadorVisitantes = 0;
let camaraSeguridadSeleccionada = 0;
let cctvVisible = true;
let ultimoRegistroTrayectoria = null;
let temporizadorMensaje = null;

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
    crearSuelo();

    reloj = new THREE.Clock();

    crearControles();
    crearInterfaz();
    crearEstructuraSupermercado();

    crearCamarasSeguridad();
    crearLadrones();
    crearSistemaVehiculos();

    configurarEventos();
    actualizarIluminacion();
    iniciarAnimacion();

    console.info('Supermercado 3D iniciado correctamente.');
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

// ============================================================
// CÁMARA DEL JUGADOR
// ============================================================

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

// ============================================================
// RENDERIZADOR
// ============================================================

function crearRenderizador() {
    renderizador = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: 'high-performance'
    });

    renderizador.setPixelRatio(
        Math.min(
            window.devicePixelRatio || 1,
            CONFIG.pixelRatioMaximo
        )
    );

    renderizador.setSize(window.innerWidth, window.innerHeight);
    renderizador.outputColorSpace = THREE.SRGBColorSpace;
    renderizador.toneMapping = THREE.ACESFilmicToneMapping;
    renderizador.toneMappingExposure = 1.1;
    renderizador.shadowMap.enabled = CONFIG.sombras;

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
    luzAmbiente = new THREE.HemisphereLight(
        0xe8f3ff,
        0x6d6250,
        1.8
    );
    escena.add(luzAmbiente);

    luzSol = new THREE.DirectionalLight(0xffedcf, 2.4);
    luzSol.position.set(-35, 55, 35);
    luzSol.castShadow = CONFIG.sombras;
    escena.add(luzSol);

    luzLuna = new THREE.DirectionalLight(0x829bc9, 0.15);
    luzLuna.position.set(20, 35, -25);
    luzLuna.visible = false;
    escena.add(luzLuna);
}

// ============================================================
// SUELO Y ESTACIONAMIENTO
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

    suelo.rotation.x = -Math.PI / 2;
    suelo.position.y = -0.025;
    suelo.name = 'SUELO_GENERAL';
    escena.add(suelo);

    const pisoInterior = new THREE.Mesh(
        new THREE.PlaneGeometry(64, 58),
        new THREE.MeshStandardMaterial({
            color: 0xbfc2c1,
            roughness: 0.8
        })
    );

    pisoInterior.rotation.x = -Math.PI / 2;
    pisoInterior.position.set(0, 0.005, 0);
    pisoInterior.name = 'PISO_INTERIOR';
    escena.add(pisoInterior);

    try {
        crearEstacionamiento(escena);
    } catch (error) {
        console.error('Error al crear estacionamiento:', error);
    }
}

// ============================================================
// ESTRUCTURA DEL SUPERMERCADO
// ============================================================

function crearEstructuraSupermercado() {
    try {
        mercado = crearMercado(escena);
        console.info('Mercado creado.');
    } catch (error) {
        console.error('Error al crear mercado:', error);
    }

    try {
        mobiliario = crearMobiliario(escena, mercado);
        console.info('Mobiliario creado.');
    } catch (error) {
        console.error('Error al crear mobiliario:', error);
    }

    try {
        almacen = crearAlmacen(escena, mercado);
        console.info('Almacén creado.');
    } catch (error) {
        console.error('Error al crear almacén:', error);
    }

    try {
        productosLacteos = crearProductosLacteos(escena);
        console.info('Productos iniciados.');
    } catch (error) {
        console.error('Error al iniciar productos:', error);
    }
}

// ============================================================
// CÁMARAS DE SEGURIDAD
// Incluye objetos visibles en el escenario y cámaras de vigilancia.
// ============================================================

function crearCamarasSeguridad() {
    const materialCuerpo = new THREE.MeshStandardMaterial({
        color: 0x27313b,
        metalness: 0.55,
        roughness: 0.38
    });

    const materialLente = new THREE.MeshStandardMaterial({
        color: 0x101820,
        metalness: 0.7,
        roughness: 0.2
    });

    CONFIG_CAMARAS.forEach(config => {
        const posicion = new THREE.Vector3(
            config.posicion.x,
            config.posicion.y,
            config.posicion.z
        );

        const objetivo = new THREE.Vector3(
            config.objetivo.x,
            config.objetivo.y,
            config.objetivo.z
        );

        // Cámara virtual para observar el supermercado.
        const camaraCCTV = new THREE.PerspectiveCamera(
            72,
            16 / 9,
            0.1,
            180
        );

        camaraCCTV.position.copy(posicion);
        camaraCCTV.lookAt(objetivo);

        // Modelo sencillo de la carcasa de la cámara física.
        const grupo = new THREE.Group();
        grupo.name = `CAMARA_SEGURIDAD_${config.id}`;
        grupo.position.copy(posicion);
        grupo.lookAt(objetivo);

        const cuerpo = new THREE.Mesh(
            new THREE.BoxGeometry(0.48, 0.22, 0.25),
            materialCuerpo
        );
        grupo.add(cuerpo);

        const lente = new THREE.Mesh(
            new THREE.CylinderGeometry(0.065, 0.065, 0.14, 16),
            materialLente
        );

        lente.rotation.x = Math.PI / 2;
        lente.position.z = 0.18;
        grupo.add(lente);

        const soporte = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.24, 0.12),
            materialCuerpo
        );

        soporte.position.y = 0.2;
        grupo.add(soporte);

        escena.add(grupo);

        camarasSeguridad.push({
            id: config.id,
            nombre: config.nombre,
            camara: camaraCCTV,
            grupo,
            objetivo
        });
    });

    actualizarEtiquetaCCTV();

    console.info(
        `${camarasSeguridad.length} cámaras de seguridad creadas.`
    );
}

// ============================================================
// CONTROLES DEL JUGADOR
// ============================================================

function crearControles() {
    controles = new PointerLockControls(
        camara,
        renderizador.domElement
    );

    controles.addEventListener('lock', () => {
        mostrarMensaje('Control de cámara activado.');
    });

    controles.addEventListener('unlock', () => {
        // No se vuelve a mostrar la pantalla de entrada al pulsar ESC.
        if (juegoIniciado) {
            mostrarMensaje(
                'Mouse liberado. Puedes seguir usando WASD.'
            );
        }
    });

    // Si el jugador pulsa el escenario, puede volver a capturar el mouse.
    renderizador.domElement.addEventListener('click', () => {
        if (juegoIniciado && !controles.isLocked) {
            controles.lock();
        }
    });
}

// ============================================================
// INTERFAZ Y ESTILOS
// ============================================================

function crearInterfaz() {
    const estilo = document.createElement('style');

    estilo.textContent = `
        #portada-supermercado {
            position: fixed;
            inset: 0;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 16px;
            background: linear-gradient(
                135deg,
                rgba(8, 18, 30, .96),
                rgba(15, 54, 70, .92)
            );
            color: white;
            font-family: Arial, sans-serif;
            text-align: center;
        }

        #portada-supermercado h1 {
            margin: 0;
            padding: 0 20px;
            font-size: clamp(28px, 5vw, 52px);
            letter-spacing: 2px;
        }

        #portada-supermercado p {
            margin: 0;
            padding: 0 20px;
            line-height: 1.7;
        }

        .boton-supermercado {
            border: 1px solid rgba(255,255,255,.3);
            border-radius: 8px;
            padding: 10px 13px;
            background: rgba(14, 105, 76, .94);
            color: white;
            font-size: 12px;
            font-weight: bold;
            cursor: pointer;
            transition: background .2s, transform .2s;
        }

        .boton-supermercado:hover {
            background: #16875f;
            transform: translateY(-1px);
        }

        #hud-supermercado {
            position: fixed;
            left: 12px;
            top: 12px;
            z-index: 100;
            max-width: 290px;
            padding: 11px 13px;
            color: white;
            background: rgba(8, 16, 24, .82);
            border: 1px solid rgba(255,255,255,.2);
            border-radius: 9px;
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.65;
            pointer-events: none;
        }

        #acciones-supermercado {
            position: fixed;
            right: 12px;
            top: 12px;
            z-index: 150;
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-end;
            gap: 6px;
            max-width: 390px;
        }

        #mensaje-supermercado {
            position: fixed;
            left: 50%;
            bottom: 14px;
            z-index: 180;
            transform: translateX(-50%);
            max-width: 80vw;
            padding: 9px 12px;
            border-radius: 7px;
            color: white;
            background: rgba(0,0,0,.78);
            font-family: Arial, sans-serif;
            font-size: 12px;
            pointer-events: none;
            text-align: center;
        }

        #panel-camaras {
            position: fixed;
            right: 12px;
            bottom: 48px;
            z-index: 130;
            width: 310px;
            max-width: calc(100vw - 24px);
            color: white;
            font-family: Arial, sans-serif;
            pointer-events: auto;
        }

        #cabecera-cctv {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            padding: 8px 10px;
            background: rgba(8, 16, 24, .92);
            border: 1px solid rgba(255,255,255,.2);
            border-bottom: none;
            border-radius: 8px 8px 0 0;
            font-size: 11px;
        }

        #cctv-feed {
            width: 100%;
            height: 174px;
            box-sizing: border-box;
            position: relative;
            background: rgba(0,0,0,.04);
            border: 1px solid rgba(255,255,255,.28);
            overflow: hidden;
            pointer-events: none;
        }

        #cctv-info {
            padding: 6px 9px;
            background: rgba(8, 16, 24, .9);
            font-size: 11px;
        }

        #botones-camaras {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 4px;
            padding: 7px;
            background: rgba(8, 16, 24, .94);
            border-radius: 0 0 8px 8px;
        }

        .boton-cctv {
            border: 1px solid rgba(255,255,255,.25);
            padding: 7px 0;
            border-radius: 5px;
            background: #283744;
            color: white;
            cursor: pointer;
            font-weight: bold;
        }

        .boton-cctv.activa {
            background: #16875f;
            border-color: #8ef0bf;
        }

        @media (max-width: 700px) {
            #panel-camaras {
                width: 240px;
                right: 7px;
                bottom: 38px;
            }

            #cctv-feed {
                height: 135px;
            }

            #hud-supermercado {
                top: 7px;
                left: 7px;
                font-size: 10px;
                padding: 7px;
                max-width: 175px;
            }

            #acciones-supermercado {
                top: 7px;
                right: 7px;
                max-width: 190px;
            }

            .boton-supermercado {
                padding: 7px 8px;
                font-size: 10px;
            }
        }
    `;

    document.head.appendChild(estilo);

    // Pantalla inicial.
    const portada = document.createElement('div');
    portada.id = 'portada-supermercado';

    portada.innerHTML = `
        <h1>SUPERMERCADO 3D</h1>

        <p>
            Explora los pasillos, los productos y el estacionamiento.
        </p>

        <p>
            <strong>W A S D</strong>: mover |
            <strong>SHIFT</strong>: correr |
            <strong>ESPACIO</strong>: saltar
        </p>

        <p>
            <strong>1 a 6</strong>: seleccionar cámara |
            <strong>C</strong>: mostrar u ocultar cámaras
        </p>

        <p>
            Si pulsas ESC, podrás seguir moviéndote con el teclado.
        </p>

        <button id="btn-entrar" class="boton-supermercado">
            ENTRAR AL SUPERMERCADO
        </button>
    `;

    document.body.appendChild(portada);

    // HUD.
    const hud = document.createElement('div');
    hud.id = 'hud-supermercado';

    hud.innerHTML = `
        <strong>SUPERMERCADO 3D</strong><br>
        W A S D: movimiento<br>
        SHIFT: correr | ESPACIO: saltar<br>
        1-6: cámaras | C: ocultar cámaras
        <div id="estado-entidades" style="margin-top:6px">
            Clientes: 0 | Ladrones: 0<br>
            Recorrido registrado: 0
        </div>
    `;

    document.body.appendChild(hud);

    // Botones principales.
    const acciones = document.createElement('div');
    acciones.id = 'acciones-supermercado';

    acciones.innerHTML = `
        <button id="btn-dia-noche" class="boton-supermercado">
            Día / Noche
        </button>

        <button id="btn-llegada-coche" class="boton-supermercado">
            Llega un coche
        </button>

        <button id="btn-entrada" class="boton-supermercado">
            Volver a entrada
        </button>

        <button id="btn-camaras" class="boton-supermercado">
            Ocultar cámaras
        </button>

        <button id="btn-exportar-recorrido" class="boton-supermercado">
            Exportar recorrido
        </button>
    `;

    document.body.appendChild(acciones);

    // Panel de CCTV: una vista seleccionable entre seis cámaras.
    const panel = document.createElement('div');
    panel.id = 'panel-camaras';

    panel.innerHTML = `
        <div id="cabecera-cctv">
            <strong>CCTV · SEGURIDAD</strong>
            <span id="cctv-numero">CAM 1</span>
        </div>

        <div id="cctv-feed"></div>

        <div id="cctv-info">Entrada izquierda</div>

        <div id="botones-camaras">
            <button class="boton-cctv activa" data-camara="0">1</button>
            <button class="boton-cctv" data-camara="1">2</button>
            <button class="boton-cctv" data-camara="2">3</button>
            <button class="boton-cctv" data-camara="3">4</button>
            <button class="boton-cctv" data-camara="4">5</button>
            <button class="boton-cctv" data-camara="5">6</button>
        </div>
    `;

    document.body.appendChild(panel);

    const mensaje = document.createElement('div');
    mensaje.id = 'mensaje-supermercado';
    mensaje.textContent = 'Pulsa ENTRAR para comenzar.';
    document.body.appendChild(mensaje);

    // Al pulsar entrar, oculta la portada aunque Pointer Lock falle.
    document.getElementById('btn-entrar').addEventListener('click', () => {
        juegoIniciado = true;
        portada.style.display = 'none';

        try {
            controles.lock();
        } catch (error) {
            console.warn(
                'El navegador no activó el bloqueo del mouse. Puedes usar WASD.',
                error
            );
        }

        mostrarMensaje('Usa WASD para moverte por el supermercado.');
    });

    document.getElementById('btn-dia-noche').addEventListener('click', () => {
        modoNoche = !modoNoche;
        actualizarIluminacion();

        mostrarMensaje(
            modoNoche
                ? 'Iluminación nocturna activada.'
                : 'Iluminación diurna activada.'
        );
    });

    document.getElementById('btn-llegada-coche').addEventListener('click', () => {
        if (typeof sistemaVehiculos?.solicitarLlegada === 'function') {
            sistemaVehiculos.solicitarLlegada();
            mostrarMensaje('Se solicitó la llegada de un vehículo.');
        } else {
            mostrarMensaje(
                'La función de llegada no está disponible en vehiculos.js.'
            );
        }
    });

    document.getElementById('btn-entrada').addEventListener('click', () => {
        controles.unlock();

        camara.position.set(0, CONFIG.alturaJugador, 25);
        camara.lookAt(0, CONFIG.alturaJugador, 15);

        velocidadVertical = 0;
        jugadorEnSuelo = true;

        mostrarMensaje('Has vuelto a la entrada.');
    });

    document.getElementById('btn-camaras').addEventListener('click', () => {
        cambiarVisibilidadCCTV();
    });

    document.getElementById('btn-exportar-recorrido').addEventListener('click', () => {
        exportarTrayectoria();
    });

    document.getElementById('botones-camaras').addEventListener('click', evento => {
        const boton = evento.target.closest('[data-camara]');

        if (!boton) return;

        seleccionarCamara(Number(boton.dataset.camara));
    });
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
    }, 2800);
}

// ============================================================
// SELECCIÓN DE CÁMARAS
// ============================================================

function seleccionarCamara(indice) {
    if (
        !Number.isInteger(indice) ||
        indice < 0 ||
        indice >= camarasSeguridad.length
    ) {
        return;
    }

    camaraSeguridadSeleccionada = indice;
    cctvVisible = true;

    const panel = document.getElementById('panel-camaras');
    const botonCamaras = document.getElementById('btn-camaras');

    if (panel) panel.style.display = 'block';
    if (botonCamaras) botonCamaras.textContent = 'Ocultar cámaras';

    actualizarEtiquetaCCTV();
}

function actualizarEtiquetaCCTV() {
    const camaraSeleccionada =
        camarasSeguridad[camaraSeguridadSeleccionada];

    const numero = document.getElementById('cctv-numero');
    const info = document.getElementById('cctv-info');

    if (numero) {
        numero.textContent = `CAM ${camaraSeguridadSeleccionada + 1}`;
    }

    if (info) {
        info.textContent = camaraSeleccionada
            ? camaraSeleccionada.nombre
            : 'Cámara no disponible';
    }

    document.querySelectorAll('.boton-cctv').forEach(boton => {
        const indice = Number(boton.dataset.camara);

        boton.classList.toggle(
            'activa',
            indice === camaraSeguridadSeleccionada
        );
    });
}

function cambiarVisibilidadCCTV() {
    cctvVisible = !cctvVisible;

    const panel = document.getElementById('panel-camaras');
    const boton = document.getElementById('btn-camaras');

    if (panel) {
        panel.style.display = cctvVisible ? 'block' : 'none';
    }

    if (boton) {
        boton.textContent = cctvVisible
            ? 'Ocultar cámaras'
            : 'Mostrar cámaras';
    }
}

// ============================================================
// RENDERIZAR LA VISTA CCTV DENTRO DE LA PANTALLA
// ============================================================

function renderizarVistaCCTV() {
    if (!cctvVisible || camarasSeguridad.length === 0) return;

    const feed = document.getElementById('cctv-feed');

    if (!feed || feed.offsetWidth <= 0 || feed.offsetHeight <= 0) {
        return;
    }

    const camaraSeleccionada =
        camarasSeguridad[camaraSeguridadSeleccionada];

    if (!camaraSeleccionada?.camara) return;

    const rect = feed.getBoundingClientRect();
    const rectCanvas = renderizador.domElement.getBoundingClientRect();

    const x = rect.left - rectCanvas.left;
    const y = rectCanvas.bottom - rect.bottom;
    const ancho = rect.width;
    const alto = rect.height;

    if (ancho < 1 || alto < 1) return;

    const camaraCCTV = camaraSeleccionada.camara;
    camaraCCTV.aspect = ancho / alto;
    camaraCCTV.updateProjectionMatrix();

    // Renderiza únicamente dentro del área del monitor CCTV.
    renderizador.setScissorTest(true);
    renderizador.setViewport(x, y, ancho, alto);
    renderizador.setScissor(x, y, ancho, alto);
    renderizador.clear(true, true, true);
    renderizador.render(escena, camaraCCTV);

    // Devuelve el renderizador al tamaño completo de la pantalla.
    renderizador.setScissorTest(false);
    renderizador.setViewport(
        0,
        0,
        window.innerWidth,
        window.innerHeight
    );
}

// ============================================================
// DÍA / NOCHE
// ============================================================

function actualizarIluminacion() {
    if (!escena || !luzAmbiente || !luzSol || !luzLuna) return;

    if (modoNoche) {
        escena.background.setHex(CONFIG.colorCieloNoche);
        escena.fog.color.setHex(CONFIG.colorCieloNoche);

        luzAmbiente.intensity = 0.65;
        luzSol.intensity = 0.15;

        luzLuna.visible = true;
        luzLuna.intensity = 0.8;
    } else {
        escena.background.setHex(CONFIG.colorCieloDia);
        escena.fog.color.setHex(0xc7d9e9);

        luzAmbiente.intensity = 1.8;
        luzSol.intensity = 2.4;

        luzLuna.visible = false;
    }
}

// ============================================================
// CREAR LOS DOS LADRONES
// ============================================================

function crearLadrones() {
    CONFIG_LADRONES.forEach(config => {
        try {
            const ladron = crearClienteSupermercado(escena, {
                modelo: config.modelo,
                posicion: { ...config.posicion },
                velocidad: config.velocidad || CONFIG.velocidadLadron,
                escala: 1,
                ruta: config.ruta,
                inactivo: false,

                probabilidadCompra: 0,
                tiempoExaminar: 0,
                distanciaRecoger: 0,
                pausaEntreCompras: 0,

                distanciaDestino: 0.8,
                radioColision: 0.42,
                repetirRuta: true
            });

            if (!ladron) {
                console.error(
                    `[LADRÓN] No se pudo crear ${config.nombre}.`
                );
                return;
            }

            ladron.nombre = config.nombre;
            ladron._esLadron = true;

            ladronesSupermercado.push(ladron);

            console.info(`[LADRÓN] ${config.nombre} inicializado.`, {
                modelo: config.modelo,
                posicion: config.posicion,
                cargado: ladron.cargado,
                estado: ladron.estado
            });
        } catch (error) {
            console.error(
                `[LADRÓN] Error al crear ${config.nombre}:`,
                error
            );
        }
    });
}

// ============================================================
// SISTEMA DE VEHÍCULOS
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

                if (
                    typeof sistemaVehiculos?.solicitarLlegada === 'function'
                ) {
                    sistemaVehiculos.solicitarLlegada();
                }
            }
        });

        console.info('Sistema de vehículos iniciado.');
    } catch (error) {
        console.error('Error al iniciar sistema de vehículos:', error);
    }
}

// ============================================================
// CREAR CLIENTE CUANDO ESTACIONA UN VEHÍCULO
// ============================================================

function crearClienteParaVehiculo(datos) {
    if (!datos?.plaza) {
        console.warn(
            'El vehículo no proporcionó la posición de su plaza.'
        );
        return;
    }

    const config = CONFIG_CLIENTES[
        siguienteModeloCliente % CONFIG_CLIENTES.length
    ];

    siguienteModeloCliente++;

    const posicion = {
        x: datos.plaza.x,
        y: 0,
        z: datos.plaza.z
    };

    let cliente = null;
    let carrito = null;

    const idVisita = datos.id ?? `visitante-${++contadorVisitantes}`;

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

            alEntrar: () => {
                const visita = visitantesPorVehiculo.get(idVisita);

                if (visita) {
                    visita.fase = 'comprando';
                    visita.tiempo = 0;
                }

                if (!carrito) {
                    carrito = crearCarritoVisitante(
                        cliente,
                        config.nombre
                    );

                    if (visita) {
                        visita.carrito = carrito;
                    }
                }

                if (
                    carrito &&
                    typeof cliente.configurarCompras === 'function'
                ) {
                    cliente.configurarCompras({ carrito });
                }
            }
        });

        if (!cliente) {
            console.error(`No se pudo crear ${config.nombre}.`);
            return;
        }

        clientesSupermercado.push(cliente);

        // Registrar la visita antes de iniciar su movimiento.
        visitantesPorVehiculo.set(idVisita, {
            id: idVisita,
            cliente,
            carrito,
            plaza: datos.plaza,
            fase: 'entrando',
            tiempo: 0
        });

        if (typeof cliente.iniciarDesdeVehiculo === 'function') {
            cliente.iniciarDesdeVehiculo(posicion, datos.plaza);
        } else {
            cliente.establecerPosicion?.(posicion);
            cliente.establecerRuta?.(config.ruta);
        }

        console.info(
            `[CLIENTE] ${config.nombre} asignado al vehículo.`,
            config.modelo
        );
    } catch (error) {
        console.error(
            'Error al crear cliente desde vehículo:',
            error
        );

        cliente?.eliminar?.();
        carrito?.eliminar?.();
    }
}

// ============================================================
// CREAR CARRITO Y HACER QUE SIGA AL CLIENTE
// ============================================================

function crearCarritoVisitante(cliente, nombreCliente) {
    if (!cliente?.grupo) {
        console.warn(
            `No se pudo crear el carrito de ${nombreCliente}.`
        );
        return null;
    }

    const posicion = cliente.grupo.position;
    let carrito = null;

    try {
        carrito = crearCarrito(escena, {
            modelo: '/modelos/carrito.glb',

            posicion: {
                x: posicion.x - CONFIG.distanciaCarrito,
                y: 0,
                z: posicion.z
            },

            escala: 1,
            distancia: CONFIG.distanciaCarrito,
            suavizado: CONFIG.suavizadoCarrito
        });

        if (!carrito) return null;

        if (carrito.grupo) {
            carrito.grupo.position.set(
                posicion.x - CONFIG.distanciaCarrito,
                0,
                posicion.z
            );
        }

        if (typeof carrito.seguirObjetivo === 'function') {
            carrito.seguirObjetivo(
                cliente.grupo,
                CONFIG.distanciaCarrito
            );
        } else {
            carrito._objetivoCliente = cliente.grupo;
        }

        carritosClientes.push(carrito);

        return carrito;
    } catch (error) {
        console.error(
            `Error al crear carrito de ${nombreCliente}:`,
            error
        );

        carrito?.eliminar?.();
        return null;
    }
}

// ============================================================
// ACTUALIZAR ENTIDADES Y VISITAS
// ============================================================

function actualizarEntidades(delta) {
    try {
        sistemaVehiculos?.actualizar?.(delta);
    } catch (error) {
        console.error('Error al actualizar vehículos:', error);
    }

    actualizarListaEntidades(clientesSupermercado, delta, 'cliente');
    actualizarListaEntidades(ladronesSupermercado, delta, 'ladrón');

    for (const carrito of carritosClientes) {
        try {
            if (typeof carrito?.actualizar === 'function') {
                carrito.actualizar(delta);
            } else if (carrito?.grupo && carrito?._objetivoCliente) {
                actualizarSeguimientoCarrito(
                    carrito,
                    carrito._objetivoCliente,
                    delta
                );
            }
        } catch (error) {
            console.error('Error al actualizar carrito:', error);
        }
    }

    actualizarFasesVisitantes(delta);
    actualizarHudEntidades();
}

function actualizarListaEntidades(lista, delta, tipo) {
    for (let i = lista.length - 1; i >= 0; i--) {
        const entidad = lista[i];

        try {
            if (!entidad || entidad.eliminado) {
                lista.splice(i, 1);
                continue;
            }

            entidad.actualizar?.(delta);
        } catch (error) {
            console.error(`Error al actualizar ${tipo}:`, error);
        }
    }
}

// ============================================================
// CICLO DE COMPRA Y CAJA DE LOS CLIENTES
// ============================================================

function actualizarFasesVisitantes(delta) {
    for (const visita of visitantesPorVehiculo.values()) {
        if (!visita?.cliente) continue;

        if (visita.fase === 'comprando') {
            visita.tiempo += delta;

            if (visita.tiempo >= CONFIG.tiempoCompraAuto) {
                visita.fase = 'caja';
                visita.tiempo = 0;

                // Punto aproximado de caja cerca de la entrada.
                visita.cliente.establecerRuta?.([
                    { x: 0, z: 20 }
                ]);

                console.info(
                    `[CLIENTE] ${visita.id}: dirigiéndose a caja.`
                );
            }
        } else if (visita.fase === 'caja') {
            visita.tiempo += delta;

            if (visita.tiempo >= CONFIG.tiempoCajaAuto) {
                visita.fase = 'regresando';
                visita.tiempo = 0;

                if (
                    typeof visita.cliente.iniciarRegresoVehiculo === 'function'
                ) {
                    visita.cliente.iniciarRegresoVehiculo(
                        visita.plaza,
                        () => {
                            visita.fase = 'esperandoSalida';
                            visita.tiempo = 0;
                        }
                    );
                } else {
                    visita.fase = 'esperandoSalida';

                    console.warn(
                        `El cliente ${visita.id} no tiene iniciarRegresoVehiculo().`
                    );
                }
            }
        }
    }
}

// ============================================================
// SEGUIMIENTO DEL CARRITO
// ============================================================

function actualizarSeguimientoCarrito(carrito, objetivo, delta) {
    if (!carrito?.grupo || !objetivo) return;

    const giro = objetivo.rotation.y;
    const distancia = CONFIG.distanciaCarrito;

    const destinoX =
        objetivo.position.x - Math.sin(giro) * distancia;

    const destinoZ =
        objetivo.position.z - Math.cos(giro) * distancia;

    const factor = 1 - Math.exp(
        -CONFIG.suavizadoCarrito * delta
    );

    carrito.grupo.position.x = THREE.MathUtils.lerp(
        carrito.grupo.position.x,
        destinoX,
        factor
    );

    carrito.grupo.position.z = THREE.MathUtils.lerp(
        carrito.grupo.position.z,
        destinoZ,
        factor
    );

    carrito.grupo.position.y = 0;
    carrito.grupo.rotation.y = giro;
}

// ============================================================
// ACTUALIZAR HUD
// ============================================================

function actualizarHudEntidades() {
    const estado = document.getElementById('estado-entidades');

    if (!estado) return;

    estado.innerHTML =
        `Clientes: ${clientesSupermercado.length}` +
        ` | Ladrones: ${ladronesSupermercado.length}<br>` +
        `Cámaras: ${camarasSeguridad.length}` +
        ` | Recorrido: ${trayectoriaJugador.length} puntos`;
}

// ============================================================
// MOVIMIENTO DEL JUGADOR
// CORREGIDO: NO REQUIERE QUE POINTER LOCK ESTÉ ACTIVO.
// ============================================================

function actualizarJugador(delta) {
    if (!juegoIniciado || !controles) return;

    const objeto = controles.getObject();

    if (!objeto) return;

    const velocidad =
        (teclas.ShiftLeft || teclas.ShiftRight)
            ? CONFIG.velocidadCorrer
            : CONFIG.velocidadCaminar;

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

        objeto.position.addScaledVector(
            movimientoJugador,
            velocidad * delta
        );
    }

    // Salto y gravedad.
    velocidadVertical -= CONFIG.gravedad * delta;
    objeto.position.y += velocidadVertical * delta;

    if (objeto.position.y <= CONFIG.alturaJugador) {
        objeto.position.y = CONFIG.alturaJugador;
        velocidadVertical = 0;
        jugadorEnSuelo = true;
    }

    // Límites del escenario.
    objeto.position.x = THREE.MathUtils.clamp(
        objeto.position.x,
        LIMITE_JUGADOR.minX,
        LIMITE_JUGADOR.maxX
    );

    objeto.position.z = THREE.MathUtils.clamp(
        objeto.position.z,
        LIMITE_JUGADOR.minZ,
        LIMITE_JUGADOR.maxZ
    );

    registrarTrayectoria(objeto.position);
}

// ============================================================
// REGISTRO DEL RECORRIDO DEL JUGADOR
// ============================================================

function registrarTrayectoria(posicion) {
    const ultima = ultimoRegistroTrayectoria;

    if (ultima) {
        const dx = posicion.x - ultima.x;
        const dz = posicion.z - ultima.z;

        const distancia = Math.sqrt(dx * dx + dz * dz);

        if (distancia < CONFIG.distanciaRegistroTrayectoria) {
            return;
        }
    }

    const registro = {
        fecha: new Date().toISOString(),
        x: Number(posicion.x.toFixed(3)),
        y: Number(posicion.y.toFixed(3)),
        z: Number(posicion.z.toFixed(3))
    };

    trayectoriaJugador.push(registro);
    ultimoRegistroTrayectoria = {
        x: posicion.x,
        y: posicion.y,
        z: posicion.z
    };

    if (
        trayectoriaJugador.length >
        CONFIG.maximoRegistrosTrayectoria
    ) {
        trayectoriaJugador.shift();
    }
}

function exportarTrayectoria() {
    if (trayectoriaJugador.length === 0) {
        mostrarMensaje(
            'Todavía no hay recorrido registrado. Muévete primero.'
        );
        return;
    }

    const cabecera = 'fecha,x,y,z';

    const filas = trayectoriaJugador.map(punto => (
        `${punto.fecha},${punto.x},${punto.y},${punto.z}`
    ));

    const contenido = [cabecera, ...filas].join('\n');

    const archivo = new Blob(
        [contenido],
        { type: 'text/csv;charset=utf-8;' }
    );

    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');

    enlace.href = url;
    enlace.download = 'recorrido_supermercado.csv';

    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    URL.revokeObjectURL(url);

    mostrarMensaje('Recorrido exportado a CSV.');
}

// ============================================================
// EVENTOS DE TECLADO Y VENTANA
// ============================================================

function configurarEventos() {
    window.addEventListener('keydown', evento => {
        teclas[evento.code] = true;

        if (
            evento.code === 'Space' &&
            juegoIniciado &&
            jugadorEnSuelo
        ) {
            velocidadVertical = CONFIG.velocidadSalto;
            jugadorEnSuelo = false;
            evento.preventDefault();
        }

        if (/^Digit[1-6]$/.test(evento.code)) {
            seleccionarCamara(Number(evento.code.slice(-1)) - 1);
        }

        if (evento.code === 'KeyC') {
            cambiarVisibilidadCCTV();
        }

        if (
            juegoIniciado &&
            (
                evento.code === 'Space' ||
                evento.code.startsWith('Arrow')
            )
        ) {
            evento.preventDefault();
        }
    });

    window.addEventListener('keyup', evento => {
        teclas[evento.code] = false;
    });

    window.addEventListener('blur', () => {
        for (const tecla of Object.keys(teclas)) {
            teclas[tecla] = false;
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
            0.05
        );

        actualizarJugador(delta);
        actualizarEntidades(delta);

        // Renderizado normal del supermercado.
        renderizador.setScissorTest(false);
        renderizador.setViewport(
            0,
            0,
            window.innerWidth,
            window.innerHeight
        );

        renderizador.render(escena, camara);

        // Renderizado adicional de la cámara de seguridad seleccionada.
        renderizarVistaCCTV();
    });
}
