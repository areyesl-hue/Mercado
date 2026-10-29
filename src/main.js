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

    // Ajustes de rendimiento.
    pixelRatioMaximo: 0.85,
    antialias: false,
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

    distanciaRegistro: 0.5,
    maximoRegistros: 20000
};

// ============================================================
// CLIENTES
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
// LADRONES
// ============================================================

const CONFIG_LADRONES = [
    {
        nombre: 'Ladron1',
        modelo: '/modelos/ladron1.glb',
        posicion: { x: -2, y: 0, z: 24 },
        velocidad: 1.8,
        ruta: [
            { x: -2, z: 21 },
            { x: -5, z: 19 },
            { x: -5, z: 6.5 },
            { x: -5, z: -6 },
            { x: -5, z: -19 },
            { x: 0, z: -22 },
            { x: 5, z: -19 },
            { x: 5, z: -6 },
            { x: 5, z: 6.5 },
            { x: 0, z: 19 }
        ]
    },
    {
        nombre: 'Ladron2',
        modelo: '/modelos/ladron2.glb',
        posicion: { x: 2, y: 0, z: 24 },
        velocidad: 2,
        ruta: [
            { x: 2, z: 21 },
            { x: 5, z: 19 },
            { x: 13, z: 19 },
            { x: 13, z: 6.5 },
            { x: 13, z: -6 },
            { x: 13, z: -19 },
            { x: 5, z: -19 },
            { x: -5, z: -19 },
            { x: -13, z: -19 },
            { x: -13, z: -6 },
            { x: -13, z: 6.5 },
            { x: -13, z: 19 },
            { x: -5, z: 19 }
        ]
    }
];

// ============================================================
// SEIS CÁMARAS DE SEGURIDAD
// ============================================================

const CONFIG_CAMARAS = [
    {
        nombre: 'Cámara 1 - Frutas y verduras',
        posicion: { x: -27.2, y: 3, z: 17 },
        objetivo: { x: -23.5, y: 1, z: 13 }
    },
    {
        nombre: 'Cámara 2 - Vitrinas y productos frescos',
        posicion: { x: 28, y: 3, z: 14 },
        objetivo: { x: 24.8, y: 1.2, z: 13 }
    },
    {
        nombre: 'Cámara 3 - Lácteos',
        posicion: { x: -28, y: 3, z: -23 },
        objetivo: { x: -23, y: 1.2, z: -26 }
    },
    {
        nombre: 'Cámara 4 - Bebidas y refrigeradores',
        posicion: { x: 28, y: 3, z: -23 },
        objetivo: { x: 23, y: 1.2, z: -26 }
    },
    {
        nombre: 'Cámara 5 - Góndolas centrales',
        posicion: { x: -15, y: 3.2, z: -3 },
        objetivo: { x: -9, y: 1.2, z: -6 }
    },
    {
        nombre: 'Cámara 6 - Entrada y cajas',
        posicion: { x: 0, y: 3, z: 24 },
        objetivo: { x: 0, y: 1.2, z: 20 }
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
let juegoIniciado = false;
let velocidadVertical = 0;
let jugadorEnSuelo = true;

let vistaSeguridad = null;
let posicionJugadorGuardada = null;
let quaternionJugadorGuardado = null;

let siguienteModeloCliente = 0;
let contadorVisitantes = 0;
let ultimaPosicionRegistrada = null;
let temporizadorMensaje = null;

const teclas = Object.create(null);
const clientesSupermercado = [];
const ladronesSupermercado = [];
const carritosClientes = [];
const visitantesPorVehiculo = new Map();
const trayectoriaJugador = [];

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
// ARRANQUE
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
    crearLadrones();
    crearSistemaVehiculos();

    configurarEventos();
    actualizarIluminacion();
    iniciarAnimacion();

    console.info('Supermercado 3D iniciado.');
}

// ============================================================
// ESCENA, CÁMARA Y RENDERIZADOR
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
    renderizador.info.autoReset = true;

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

    luzSol = new THREE.DirectionalLight(0xffedcf, 2);
    luzSol.position.set(-35, 55, 35);
    luzSol.castShadow = false;
    escena.add(luzSol);

    luzLuna = new THREE.DirectionalLight(0x829bc9, 0.15);
    luzLuna.position.set(20, 35, -25);
    luzLuna.visible = false;
    escena.add(luzLuna);
}

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
        luzSol.intensity = 2;
        luzLuna.visible = false;
    }
}

// ============================================================
// SUELO Y ESTACIONAMIENTO
// ============================================================

function crearSuelo() {
    const suelo = new THREE.Mesh(
        new THREE.PlaneGeometry(180, 180),
        new THREE.MeshStandardMaterial({
            color: 0x62696d,
            roughness: 0.95,
            metalness: 0
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
            roughness: 0.9,
            metalness: 0
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
// ESTRUCTURA Y PRODUCTOS
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
// CONTROLES DEL JUGADOR
// ============================================================

function crearControles() {
    controles = new PointerLockControls(camara, renderizador.domElement);

    controles.addEventListener('unlock', () => {
        if (juegoIniciado) {
            mostrarMensaje('Mouse liberado. WASD sigue funcionando.');
        }
    });

    renderizador.domElement.addEventListener('click', () => {
        if (
            juegoIniciado &&
            vistaSeguridad === null &&
            !controles.isLocked
        ) {
            try {
                controles.lock();
            } catch (error) {
                console.warn('No se pudo bloquear el mouse:', error);
            }
        }
    });
}

// ============================================================
// INTERFAZ
// ============================================================

function crearInterfaz() {
    const estilo = document.createElement('style');

    estilo.textContent = `
        #portada-supermercado {
            position:fixed; inset:0; z-index:1000;
            display:flex; align-items:center; justify-content:center;
            flex-direction:column; gap:14px; padding:20px;
            box-sizing:border-box;
            background:linear-gradient(135deg,rgba(8,18,30,.96),rgba(15,54,70,.92));
            color:white; font-family:Arial,sans-serif; text-align:center;
        }
        #portada-supermercado h1 {
            margin:0; font-size:clamp(28px,5vw,50px); letter-spacing:2px;
        }
        #portada-supermercado p { margin:0; line-height:1.7; }
        .boton-supermercado {
            border:1px solid rgba(255,255,255,.28); border-radius:7px;
            padding:9px 12px; background:rgba(14,105,76,.94);
            color:white; font-size:12px; font-weight:bold; cursor:pointer;
        }
        .boton-supermercado:hover { background:#16875f; }
        #hud-supermercado {
            position:fixed; left:10px; top:10px; z-index:100;
            max-width:260px; padding:9px 11px; color:white;
            background:rgba(8,16,24,.8); border:1px solid rgba(255,255,255,.2);
            border-radius:8px; font:12px/1.6 Arial,sans-serif; pointer-events:none;
        }
        #acciones-supermercado {
            position:fixed; right:10px; top:10px; z-index:150;
            display:flex; flex-wrap:wrap; justify-content:flex-end;
            gap:5px; max-width:370px;
        }
        #controles-camaras {
            position:fixed; left:50%; bottom:10px; z-index:150;
            transform:translateX(-50%); display:flex; flex-wrap:wrap;
            justify-content:center; gap:4px; max-width:95vw; padding:6px;
            border-radius:7px; background:rgba(8,16,24,.78);
        }
        #mensaje-supermercado {
            position:fixed; left:50%; bottom:60px; z-index:200;
            transform:translateX(-50%); max-width:80vw; padding:8px 12px;
            border-radius:7px; color:white; background:rgba(0,0,0,.8);
            font:12px Arial,sans-serif; pointer-events:none; text-align:center;
        }
        @media(max-width:650px) {
            #hud-supermercado { top:5px; left:5px; max-width:155px; padding:6px; font-size:10px; }
            #acciones-supermercado { top:5px; right:5px; max-width:185px; }
            #controles-camaras { bottom:5px; gap:3px; padding:4px; }
            .boton-supermercado { padding:6px 7px; font-size:10px; }
        }
    `;

    document.head.appendChild(estilo);

    const portada = document.createElement('div');
    portada.id = 'portada-supermercado';
    portada.innerHTML = `
        <h1>SUPERMERCADO 3D</h1>
        <p>Explora el supermercado y sus departamentos.</p>
        <p><strong>W A S D</strong>: mover |
           <strong>SHIFT</strong>: correr |
           <strong>ESPACIO</strong>: saltar</p>
        <p><strong>1-6</strong>: cámaras de seguridad |
           <strong>0</strong>: volver al jugador</p>
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
    `;
    document.body.appendChild(hud);

    const acciones = document.createElement('div');
    acciones.id = 'acciones-supermercado';
    acciones.innerHTML = `
        <button id="btn-dia-noche" class="boton-supermercado">Día / Noche</button>
        <button id="btn-llegada-coche" class="boton-supermercado">Llega un coche</button>
        <button id="btn-entrada" class="boton-supermercado">Volver a entrada</button>
        <button id="btn-exportar-recorrido" class="boton-supermercado">Exportar recorrido</button>
    `;
    document.body.appendChild(acciones);

    const controlesCamaras = document.createElement('div');
    controlesCamaras.id = 'controles-camaras';
    controlesCamaras.innerHTML = `
        <button class="boton-supermercado" data-vista="1">CAM 1</button>
        <button class="boton-supermercado" data-vista="2">CAM 2</button>
        <button class="boton-supermercado" data-vista="3">CAM 3</button>
        <button class="boton-supermercado" data-vista="4">CAM 4</button>
        <button class="boton-supermercado" data-vista="5">CAM 5</button>
        <button class="boton-supermercado" data-vista="6">CAM 6</button>
        <button class="boton-supermercado" data-vista="0">JUGADOR</button>
    `;
    document.body.appendChild(controlesCamaras);

    const mensaje = document.createElement('div');
    mensaje.id = 'mensaje-supermercado';
    mensaje.textContent = 'Pulsa ENTRAR para comenzar.';
    document.body.appendChild(mensaje);

    document.getElementById('btn-entrar').addEventListener('click', () => {
        juegoIniciado = true;
        portada.style.display = 'none';

        try {
            controles.lock();
        } catch (error) {
            console.warn('No se pudo bloquear el mouse:', error);
        }

        mostrarMensaje('Usa WASD para moverte.');
    });

    document.getElementById('btn-dia-noche').addEventListener('click', () => {
        modoNoche = !modoNoche;
        actualizarIluminacion();
        mostrarMensaje(modoNoche ? 'Iluminación nocturna.' : 'Iluminación diurna.');
    });

    document.getElementById('btn-llegada-coche').addEventListener('click', () => {
        if (typeof sistemaVehiculos?.solicitarLlegada === 'function') {
            sistemaVehiculos.solicitarLlegada();
            mostrarMensaje('Se solicitó la llegada de un vehículo.');
        } else {
            mostrarMensaje('El módulo vehiculos.js no expone solicitarLlegada().');
        }
    });

    document.getElementById('btn-entrada').addEventListener('click', () => {
        volverAlJugador();
        camara.position.set(0, CONFIG.alturaJugador, 25);
        camara.lookAt(0, CONFIG.alturaJugador, 15);
        velocidadVertical = 0;
        jugadorEnSuelo = true;
        registrarTrayectoria(camara.position);
        mostrarMensaje('Has vuelto a la entrada.');
    });

    document.getElementById('btn-exportar-recorrido').addEventListener('click', exportarTrayectoria);

    controlesCamaras.addEventListener('click', evento => {
        const boton = evento.target.closest('[data-vista]');
        if (!boton) return;

        const numero = Number(boton.dataset.vista);
        if (numero === 0) volverAlJugador();
        else cambiarVistaSeguridad(numero);
    });
}

function mostrarMensaje(texto) {
    const elemento = document.getElementById('mensaje-supermercado');
    if (!elemento) return;

    elemento.textContent = texto;
    elemento.style.display = 'block';

    if (temporizadorMensaje) clearTimeout(temporizadorMensaje);

    temporizadorMensaje = setTimeout(() => {
        elemento.style.display = 'none';
    }, 2500);
}

// ============================================================
// CÁMARAS DE SEGURIDAD
// ============================================================

function cambiarVistaSeguridad(numero) {
    if (numero < 1 || numero > CONFIG_CAMARAS.length) return;

    const config = CONFIG_CAMARAS[numero - 1];

    if (vistaSeguridad === null) {
        posicionJugadorGuardada = camara.position.clone();
        quaternionJugadorGuardado = camara.quaternion.clone();
    }

    vistaSeguridad = numero;

    try {
        controles.unlock();
    } catch {
        // Las cámaras también funcionan sin Pointer Lock.
    }

    camara.position.set(config.posicion.x, config.posicion.y, config.posicion.z);
    camara.lookAt(config.objetivo.x, config.objetivo.y, config.objetivo.z);

    actualizarEstadoVista();
    mostrarMensaje(`${config.nombre}. Pulsa 0 para regresar.`);
}

function volverAlJugador() {
    if (vistaSeguridad !== null) {
        if (posicionJugadorGuardada && quaternionJugadorGuardado) {
            camara.position.copy(posicionJugadorGuardada);
            camara.quaternion.copy(quaternionJugadorGuardado);
        }

        vistaSeguridad = null;
        posicionJugadorGuardada = null;
        quaternionJugadorGuardado = null;
    }

    actualizarEstadoVista();
}

function actualizarEstadoVista() {
    const elemento = document.getElementById('estado-vista');
    if (!elemento) return;

    elemento.textContent = vistaSeguridad === null
        ? 'Vista: jugador'
        : `Vista: cámara ${vistaSeguridad}`;
}

// ============================================================
// CREAR Y MOVER LADRONES
// ============================================================

function crearLadrones() {
    for (const config of CONFIG_LADRONES) {
        try {
            const ladron = crearClienteSupermercado(escena, {
                modelo: config.modelo,
                posicion: { ...config.posicion },
                velocidad: config.velocidad,
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
                console.error(`[LADRÓN] No se pudo crear ${config.nombre}.`);
                continue;
            }

            ladron.nombre = config.nombre;
            ladron._esLadron = true;

            // Patrulla propia para evitar que se queden parados
            // esperando a que termine la lógica interna del cliente.
            ladron._patrullaMain = {
                x: config.posicion.x,
                y: config.posicion.y,
                z: config.posicion.z,
                indice: 0,
                velocidad: config.velocidad,
                ruta: config.ruta
            };

            ladronesSupermercado.push(ladron);

            console.info(`[LADRÓN] ${config.nombre}`, {
                modelo: config.modelo,
                posicion: config.posicion,
                cargado: ladron.cargado
            });
        } catch (error) {
            console.error(`[LADRÓN] Error al crear ${config.nombre}:`, error);
        }
    }
}

function actualizarPatrullaLadrones(delta) {
    for (let i = ladronesSupermercado.length - 1; i >= 0; i--) {
        const ladron = ladronesSupermercado[i];

        if (!ladron || ladron.eliminado) {
            ladronesSupermercado.splice(i, 1);
            continue;
        }

        try {
            ladron.actualizar?.(delta);
        } catch (error) {
            if (!ladron._errorActualizacionRegistrado) {
                console.error(`Error al actualizar ${ladron.nombre}:`, error);
                ladron._errorActualizacionRegistrado = true;
            }
        }

        const patrulla = ladron._patrullaMain;
        const grupo = ladron.grupo;

        if (!patrulla || !grupo || patrulla.ruta.length === 0) continue;

        let objetivo = patrulla.ruta[patrulla.indice];
        let dx = objetivo.x - patrulla.x;
        let dz = objetivo.z - patrulla.z;
        let distancia = Math.hypot(dx, dz);

        if (distancia < 0.65) {
            patrulla.indice = (patrulla.indice + 1) % patrulla.ruta.length;
            objetivo = patrulla.ruta[patrulla.indice];
            dx = objetivo.x - patrulla.x;
            dz = objetivo.z - patrulla.z;
            distancia = Math.hypot(dx, dz);
        }

        if (distancia > 0.001) {
            const paso = Math.min(patrulla.velocidad * delta, distancia);
            patrulla.x += (dx / distancia) * paso;
            patrulla.z += (dz / distancia) * paso;
            grupo.rotation.y = Math.atan2(dx, dz);
        }

        grupo.position.set(patrulla.x, patrulla.y, patrulla.z);
    }
}

// ============================================================
// VEHÍCULOS Y CLIENTES QUE LLEGAN EN COCHE
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

            alEstacionar: datos => crearClienteParaVehiculo(datos),

            alSalir: datos => {
                const visita = visitantesPorVehiculo.get(datos.id);

                if (visita) {
                    visita.cliente?.eliminar?.();
                    visita.carrito?.eliminar?.();
                    visitantesPorVehiculo.delete(datos.id);
                }

                sistemaVehiculos?.solicitarLlegada?.();
            }
        });

        console.info('Sistema de vehículos iniciado.');
    } catch (error) {
        console.error('Error al crear sistema de vehículos:', error);
    }
}

function crearClienteParaVehiculo(datos) {
    if (!datos?.plaza) {
        console.warn('El vehículo no proporcionó la posición de su plaza.');
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
                    carrito = crearCarritoVisitante(cliente, config.nombre);
                    if (visita) visita.carrito = carrito;
                }

                if (carrito && typeof cliente.configurarCompras === 'function') {
                    cliente.configurarCompras({
                        productos: productosLacteos,
                        carrito
                    });
                }
            }
        });

        if (!cliente) return;

        clientesSupermercado.push(cliente);

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

        console.info(`[CLIENTE] ${config.nombre} asignado al vehículo.`);
    } catch (error) {
        console.error('Error al crear cliente desde vehículo:', error);
        cliente?.eliminar?.();
        carrito?.eliminar?.();
    }
}

function crearCarritoVisitante(cliente, nombreCliente) {
    if (!cliente?.grupo) {
        console.warn(`No se pudo crear el carrito de ${nombreCliente}.`);
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
            carrito.seguirObjetivo(cliente.grupo, CONFIG.distanciaCarrito);
        } else {
            carrito._objetivoCliente = cliente.grupo;
        }

        carritosClientes.push(carrito);
        return carrito;
    } catch (error) {
        console.error(`Error al crear carrito de ${nombreCliente}:`, error);
        carrito?.eliminar?.();
        return null;
    }
}

function actualizarSeguimientoCarrito(carrito, objetivo, delta) {
    if (!carrito?.grupo || !objetivo) return;

    const giro = objetivo.rotation.y;
    const distancia = CONFIG.distanciaCarrito;
    const destinoX = objetivo.position.x - Math.sin(giro) * distancia;
    const destinoZ = objetivo.position.z - Math.cos(giro) * distancia;
    const factor = 1 - Math.exp(-CONFIG.suavizadoCarrito * delta);

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
// ACTUALIZAR CLIENTES, LADRONES, VEHÍCULOS Y CARRITOS
// ============================================================

function actualizarEntidades(delta) {
    try {
        sistemaVehiculos?.actualizar?.(delta);
    } catch (error) {
        console.error('Error al actualizar vehículos:', error);
    }

    actualizarListaEntidades(clientesSupermercado, delta, 'cliente');
    actualizarPatrullaLadrones(delta);

    for (let i = carritosClientes.length - 1; i >= 0; i--) {
        const carrito = carritosClientes[i];

        try {
            if (!carrito || carrito.eliminado) {
                carritosClientes.splice(i, 1);
                continue;
            }

            if (typeof carrito.actualizar === 'function') {
                carrito.actualizar(delta);
            } else if (carrito.grupo && carrito._objetivoCliente) {
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
    actualizarHUD();
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

function actualizarFasesVisitantes(delta) {
    for (const visita of visitantesPorVehiculo.values()) {
        if (!visita?.cliente) continue;

        if (visita.fase === 'comprando') {
            visita.tiempo += delta;

            if (visita.tiempo >= CONFIG.tiempoCompraAuto) {
                visita.fase = 'caja';
                visita.tiempo = 0;
                visita.cliente.establecerRuta?.([{ x: 0, z: 20 }]);
            }
        } else if (visita.fase === 'caja') {
            visita.tiempo += delta;

            if (visita.tiempo >= CONFIG.tiempoCajaAuto) {
                visita.fase = 'regresando';
                visita.tiempo = 0;

                if (typeof visita.cliente.iniciarRegresoVehiculo === 'function') {
                    visita.cliente.iniciarRegresoVehiculo(
                        visita.plaza,
                        () => {
                            visita.fase = 'esperandoSalida';
                            visita.tiempo = 0;
                        }
                    );
                } else {
                    visita.fase = 'esperandoSalida';
                }
            }
        }
    }
}

// ============================================================
// MOVIMIENTO DEL JUGADOR
// ============================================================

function actualizarJugador(delta) {
    if (!juegoIniciado || vistaSeguridad !== null) return;

    movimientoJugador.set(0, 0, 0);

    controles.getDirection(vectorAdelante);
    vectorAdelante.y = 0;

    if (vectorAdelante.lengthSq() > 0) vectorAdelante.normalize();

    vectorDerecha.crossVectors(vectorAdelante, ejeVertical).normalize();

    const velocidad = (
        teclas.ShiftLeft || teclas.ShiftRight
    ) ? CONFIG.velocidadCorrer : CONFIG.velocidadCaminar;

    if (teclas.KeyW || teclas.ArrowUp) movimientoJugador.add(vectorAdelante);
    if (teclas.KeyS || teclas.ArrowDown) movimientoJugador.sub(vectorAdelante);
    if (teclas.KeyD || teclas.ArrowRight) movimientoJugador.add(vectorDerecha);
    if (teclas.KeyA || teclas.ArrowLeft) movimientoJugador.sub(vectorDerecha);

    if (movimientoJugador.lengthSq() > 0) {
        movimientoJugador.normalize();
        camara.position.addScaledVector(movimientoJugador, velocidad * delta);
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
// REGISTRO Y EXPORTACIÓN DEL RECORRIDO
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
    if (trayectoriaJugador.length === 0) {
        mostrarMensaje('Muévete primero para registrar el recorrido.');
        return;
    }

    const filas = [
        'fecha,x,y,z',
        ...trayectoriaJugador.map(p => `${p.fecha},${p.x},${p.y},${p.z}`)
    ];

    const blob = new Blob([filas.join('\n')], {
        type: 'text/csv;charset=utf-8;'
    });

    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');

    enlace.href = url;
    enlace.download = 'recorrido_supermercado.csv';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);

    mostrarMensaje('Recorrido exportado.');
}

// ============================================================
// HUD
// ============================================================

function actualizarHUD() {
    const entidades = document.getElementById('estado-entidades');
    const recorrido = document.getElementById('estado-recorrido');

    if (entidades) {
        entidades.textContent =
            `Clientes: ${clientesSupermercado.length}` +
            ` | Ladrones: ${ladronesSupermercado.length}`;
    }

    if (recorrido) {
        recorrido.textContent = `Recorrido: ${trayectoriaJugador.length} puntos`;
    }

    actualizarEstadoVista();
}

// ============================================================
// EVENTOS DEL TECLADO Y VENTANA
// ============================================================

function configurarEventos() {
    window.addEventListener('keydown', evento => {
        teclas[evento.code] = true;

        if (
            evento.code === 'Space' &&
            juegoIniciado &&
            vistaSeguridad === null &&
            jugadorEnSuelo
        ) {
            velocidadVertical = CONFIG.velocidadSalto;
            jugadorEnSuelo = false;
            evento.preventDefault();
        }

        if (/^Digit[1-6]$/.test(evento.code)) {
            cambiarVistaSeguridad(Number(evento.code.slice(-1)));
        }

        if (/^Numpad[1-6]$/.test(evento.code)) {
            cambiarVistaSeguridad(Number(evento.code.slice(-1)));
        }

        if (evento.code === 'Digit0' || evento.code === 'Numpad0') {
            volverAlJugador();
        }

        if (evento.code === 'Space' || evento.code.startsWith('Arrow')) {
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

        renderizador.setSize(window.innerWidth, window.innerHeight);
        renderizador.setPixelRatio(
            Math.min(window.devicePixelRatio || 1, CONFIG.pixelRatioMaximo)
        );
    });
}

// ============================================================
// BUCLE PRINCIPAL
// ============================================================

function iniciarAnimacion() {
    renderizador.setAnimationLoop(() => {
        const delta = Math.min(reloj.getDelta(), 0.05);

        actualizarJugador(delta);
        actualizarEntidades(delta);

        renderizador.render(escena, camara);
    });
}
