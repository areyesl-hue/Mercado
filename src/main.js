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
    pausaEntreCompras: 1.8
};

// ============================================================
// MODELOS DE CLIENTES NORMALES
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
//
// Ambos utilizan el archivo que indicaste:
// public/modelos/ladron.glb
//
// No se requieren archivos Ladron1.glb ni Ladron2.glb.
// Cada ladrón tiene una ruta independiente.
// ============================================================

const CONFIG_LADRONES = [
    {
        nombre: 'Ladron1',

        modelo: '/modelos/ladron1.glb',

        posicion: {
            x: -2,
            y: 0,
            z: 34
        },

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

        posicion: {
            x: 2,
            y: 0,
            z: 34
        },

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

const teclas = Object.create(null);

const clientesSupermercado = [];
const ladronesSupermercado = [];
const carritosClientes = [];

const visitantesPorVehiculo = new Map();

let siguienteModeloCliente = 0;
let contadorVisitantes = 0;

const LIMITE_JUGADOR = {
    minX: -31,
    maxX: 31,
    minZ: -55,
    maxZ: 55
};

const vectorAdelante = new THREE.Vector3();
const vectorDerecha = new THREE.Vector3();
const movimientoJugador = new THREE.Vector3();

// ============================================================
// INICIAR APLICACIÓN
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

    // Se crean de forma independiente del sistema de vehículos.
    crearLadrones();

    // Los clientes normales continúan llegando en coches.
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

    escena.fog = new THREE.Fog(
        0xc7d9e9,
        65,
        150
    );
}

// ============================================================
// CÁMARA
// ============================================================

function crearCamara() {
    camara = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        500
    );

    // La entrada principal se encuentra hacia Z positivo.
    camara.position.set(
        0,
        CONFIG.alturaJugador,
        25
    );

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

    renderizador.setSize(
        window.innerWidth,
        window.innerHeight
    );

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

    luzSol = new THREE.DirectionalLight(
        0xffedcf,
        2.4
    );

    luzSol.position.set(-35, 55, 35);
    luzSol.castShadow = CONFIG.sombras;

    escena.add(luzSol);

    luzLuna = new THREE.DirectionalLight(
        0x829bc9,
        0.15
    );

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
        console.error(
            'Error al crear estacionamiento:',
            error
        );
    }
}

// ============================================================
// ESTRUCTURA DEL MERCADO
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
    controles = new PointerLockControls(
        camara,
        renderizador.domElement
    );

    controles.addEventListener('lock', () => {
        const portada = document.getElementById('portada-supermercado');

        if (portada) {
            portada.style.display = 'none';
        }
    });

    controles.addEventListener('unlock', () => {
        const portada = document.getElementById('portada-supermercado');

        if (portada) {
            portada.style.display = 'flex';
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
            position: fixed;
            inset: 0;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 16px;
            background:
                linear-gradient(
                    135deg,
                    rgba(8, 18, 30, .94),
                    rgba(15, 54, 70, .88)
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
            border-radius: 9px;
            padding: 12px 17px;
            background: rgba(14, 105, 76, .94);
            color: white;
            font-size: 14px;
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
            left: 14px;
            top: 14px;
            z-index: 100;
            max-width: 300px;
            padding: 12px 15px;
            color: white;
            background: rgba(8, 16, 24, .78);
            border: 1px solid rgba(255,255,255,.18);
            border-radius: 10px;
            font-family: Arial, sans-serif;
            font-size: 13px;
            line-height: 1.7;
            pointer-events: none;
        }

        #acciones-supermercado {
            position: fixed;
            right: 14px;
            top: 14px;
            z-index: 101;
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-end;
            gap: 8px;
            max-width: 360px;
        }

        #mensaje-supermercado {
            position: fixed;
            left: 50%;
            bottom: 22px;
            z-index: 100;
            transform: translateX(-50%);
            padding: 10px 14px;
            border-radius: 8px;
            color: white;
            background: rgba(0,0,0,.75);
            font-family: Arial, sans-serif;
            font-size: 13px;
            pointer-events: none;
            text-align: center;
        }

        @media (max-width: 600px) {
            #hud-supermercado {
                left: 7px;
                top: 7px;
                font-size: 11px;
                padding: 8px;
            }

            #acciones-supermercado {
                right: 7px;
                top: 7px;
                max-width: 210px;
            }

            .boton-supermercado {
                padding: 9px 10px;
                font-size: 11px;
            }
        }
    `;

    document.head.appendChild(estilo);

    const portada = document.createElement('div');
    portada.id = 'portada-supermercado';

    portada.innerHTML = `
        <h1>SUPERMERCADO 3D</h1>

        <p>
            Explora los pasillos, revisa los productos
            y observa el comportamiento de los clientes.
        </p>

        <p>
            <strong>W A S D</strong>: mover |
            <strong>SHIFT</strong>: correr |
            <strong>ESPACIO</strong>: saltar |
            <strong>ESC</strong>: liberar el mouse
        </p>

        <button id="btn-entrar" class="boton-supermercado">
            ENTRAR AL SUPERMERCADO
        </button>
    `;

    document.body.appendChild(portada);

    const hud = document.createElement('div');
    hud.id = 'hud-supermercado';

    hud.innerHTML = `
        <strong>SUPERMERCADO 3D</strong><br>
        Movimiento: W A S D<br>
        Correr: SHIFT<br>
        Saltar: ESPACIO<br>
        Liberar mouse: ESC
        <div id="estado-entidades" style="margin-top:6px">
            Clientes: 0 | Ladrones: 0
        </div>
    `;

    document.body.appendChild(hud);

    const acciones = document.createElement('div');
    acciones.id = 'acciones-supermercado';

    acciones.innerHTML = `
        <button id="btn-dia-noche" class="boton-supermercado">
            Cambiar iluminación
        </button>

        <button id="btn-llegada-coche" class="boton-supermercado">
            Llega un coche
        </button>

        <button id="btn-entrada" class="boton-supermercado">
            Volver a entrada
        </button>
    `;

    document.body.appendChild(acciones);

    const mensaje = document.createElement('div');
    mensaje.id = 'mensaje-supermercado';
    mensaje.textContent = 'Pulsa ENTRAR para comenzar.';
    document.body.appendChild(mensaje);

    document.getElementById('btn-entrar').addEventListener('click', () => {
        controles.lock();
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
        if (sistemaVehiculos?.solicitarLlegada) {
            sistemaVehiculos.solicitarLlegada();
            mostrarMensaje('Se solicitó la llegada de un vehículo.');
        } else {
            mostrarMensaje('El sistema de vehículos no está disponible.');
        }
    });

    document.getElementById('btn-entrada').addEventListener('click', () => {
        camara.position.set(0, CONFIG.alturaJugador, 25);
        camara.lookAt(0, CONFIG.alturaJugador, 15);

        velocidadVertical = 0;
        jugadorEnSuelo = true;

        mostrarMensaje('Has vuelto a la entrada.');
    });
}

// ============================================================
// MENSAJES
// ============================================================

let temporizadorMensaje = null;

function mostrarMensaje(texto) {
    const mensaje = document.getElementById('mensaje-supermercado');

    if (!mensaje) return;

    mensaje.textContent = texto;
    mensaje.style.display = 'block';

    if (temporizadorMensaje) {
        clearTimeout(temporizadorMensaje);
    }

    temporizadorMensaje = setTimeout(() => {
        mensaje.style.display = 'none';
    }, 2800);
}

// ============================================================
// ILUMINACIÓN DÍA / NOCHE
// ============================================================

function actualizarIluminacion() {
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
    CONFIG_LADRONES.forEach((config) => {
        try {
            const ladron = crearClienteSupermercado(escena, {
                modelo: config.modelo,

                posicion: {
                    x: config.posicion.x,
                    y: config.posicion.y,
                    z: config.posicion.z
                },

                velocidad: config.velocidad,
                escala: 1,
                ruta: config.ruta,

                inactivo: false,

                // No recoger artículos ni simular compras.
                probabilidadCompra: 0,
                tiempoExaminar: 0,
                distanciaRecoger: 0,
                pausaEntreCompras: 0,

                // Parámetros de navegación.
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

            console.info(`[LADRÓN] ${config.nombre} creado.`, {
                modelo: config.modelo,
                posicionInicial: config.posicion,
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
// CREAR CARRITO DE UN CLIENTE
// ============================================================

function crearCarritoVisitante(cliente, nombreCliente) {
    if (!cliente?.grupo) {
        console.warn(
            `No se pudo crear el carrito de ${nombreCliente}: falta el modelo del cliente.`
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

        if (!carrito) {
            return null;
        }

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
            `Error al crear el carrito de ${nombreCliente}:`,
            error
        );

        carrito?.eliminar?.();
        return null;
    }
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

            alEstacionar: (datos) => {
                crearClienteParaVehiculo(datos);
            },

            alSalir: (datos) => {
                const visita = visitantesPorVehiculo.get(datos.id);

                if (visita) {
                    visita.cliente?.eliminar?.();
                    visita.carrito?.eliminar?.();

                    visitantesPorVehiculo.delete(datos.id);
                }

                // Solicita una nueva llegada, si la API lo admite.
                sistemaVehiculos?.solicitarLlegada?.();
            }
        });

        console.info('Sistema de vehículos iniciado.');
    } catch (error) {
        console.error(
            'Error al iniciar el sistema de vehículos:',
            error
        );
    }
}

// ============================================================
// CLIENTE NORMAL QUE BAJA DE UN VEHÍCULO
// ============================================================

function crearClienteParaVehiculo(datos) {
    if (!datos?.plaza) {
        console.warn(
            'El vehículo no proporcionó la información de su plaza.'
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

                if (carrito && typeof cliente.configurarCompras === 'function') {
                    cliente.configurarCompras({
                        carrito
                    });
                }
            }
        });

        if (!cliente) {
            console.error(`No se pudo crear ${config.nombre}.`);
            return;
        }

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

        console.info(
            `[CLIENTE] ${config.nombre} asignado a un vehículo.`,
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
// ACTUALIZAR CLIENTES Y LADRONES
// ============================================================

function actualizarEntidades(delta) {
    try {
        sistemaVehiculos?.actualizar?.(delta);
    } catch (error) {
        console.error('Error al actualizar vehículos:', error);
    }

    // Clientes normales.
    for (let i = clientesSupermercado.length - 1; i >= 0; i--) {
        const cliente = clientesSupermercado[i];

        try {
            if (cliente?.eliminado) {
                clientesSupermercado.splice(i, 1);
                continue;
            }

            cliente?.actualizar?.(delta);
        } catch (error) {
            console.error('Error al actualizar cliente:', error);
        }
    }

    // Los ladrones se actualizan de manera independiente.
    for (let i = ladronesSupermercado.length - 1; i >= 0; i--) {
        const ladron = ladronesSupermercado[i];

        try {
            if (ladron?.eliminado) {
                ladronesSupermercado.splice(i, 1);
                continue;
            }

            ladron?.actualizar?.(delta);
        } catch (error) {
            console.error('Error al actualizar ladrón:', error);
        }
    }

    // Actualizar carritos.
    for (const carrito of carritosClientes) {
        try {
            if (typeof carrito?.actualizar === 'function') {
                carrito.actualizar(delta);
            } else if (
                carrito?.grupo &&
                carrito?._objetivoCliente
            ) {
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

    actualizarHudEntidades();
}

// ============================================================
// SEGUIMIENTO DEL CARRITO
// Se utiliza como alternativa si carrito.js no implementa
// seguirObjetivo() ni actualizar().
// ============================================================

function actualizarSeguimientoCarrito(
    carrito,
    objetivo,
    delta
) {
    if (!carrito?.grupo || !objetivo) return;

    const giro = objetivo.rotation.y;
    const distancia = CONFIG.distanciaCarrito;

    const destinoX = objetivo.position.x - Math.sin(giro) * distancia;
    const destinoZ = objetivo.position.z - Math.cos(giro) * distancia;

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
// HUD
// ============================================================

function actualizarHudEntidades() {
    const estado = document.getElementById('estado-entidades');

    if (!estado) return;

    estado.textContent =
        `Clientes: ${clientesSupermercado.length}` +
        ` | Ladrones: ${ladronesSupermercado.length}`;
}

// ============================================================
// MOVIMIENTO DEL JUGADOR
// ============================================================

function actualizarJugador(delta) {
    if (!controles?.isLocked) return;

    const objeto = controles.getObject();

    if (!objeto) return;

    const velocidad = (
        teclas.ShiftLeft || teclas.ShiftRight
    )
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
        new THREE.Vector3(0, 1, 0)
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

    // Gravedad y salto.
    velocidadVertical -= CONFIG.gravedad * delta;

    objeto.position.y += velocidadVertical * delta;

    if (objeto.position.y <= CONFIG.alturaJugador) {
        objeto.position.y = CONFIG.alturaJugador;
        velocidadVertical = 0;
        jugadorEnSuelo = true;
    }

    // Límites generales del escenario.
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
}

// ============================================================
// EVENTOS DE TECLADO Y VENTANA
// ============================================================

function configurarEventos() {
    window.addEventListener('keydown', (evento) => {
        teclas[evento.code] = true;

        if (
            evento.code === 'Space' &&
            controles?.isLocked &&
            jugadorEnSuelo
        ) {
            velocidadVertical = CONFIG.velocidadSalto;
            jugadorEnSuelo = false;

            evento.preventDefault();
        }
    });

    window.addEventListener('keyup', (evento) => {
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

        renderizador.render(
            escena,
            camara
        );
    });
}
