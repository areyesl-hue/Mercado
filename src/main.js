
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

    pixelRatioMaximo: 0.85,
    antialias: false,
    sombras: false,
    limiteDelta: 0.033,

    distanciaCarrito: 1.15,
    suavizadoCarrito: 6,

    velocidadCliente: 1.5,
    velocidadLadron: 1.8,

    probabilidadCompra: 0.75,
    tiempoExaminar: 1.5,
    distanciaRecoger: 2,
    pausaEntreCompras: 1.8,

    tiempoCompraAuto: 60,
    maximoProductosCliente: 3,

    posicionCaja: { x: 0, z: 20 },

    distanciaRegistro: 0.5,
    maximoRegistros: 20000
};

// ============================================================
// RUTAS DE CLIENTES
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
// RUTAS DE LADRONES
// ============================================================

const CONFIG_LADRONES = [
    {
        nombre: 'Ladron1',
        modelo: '/modelos/ladron1.glb',
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
// 21 CÁMARAS ORIGINALES
// ============================================================

const CONFIG_CAMARAS = [
    { nombre: 'Cámara 1 - Góndola izquierda frontal', posicion: { x: -20, y: 3.1, z: 3 }, objetivo: { x: -17, y: 1, z: 0 } },
    { nombre: 'Cámara 2 - Góndola izquierda central', posicion: { x: -12, y: 3.1, z: -4 }, objetivo: { x: -9, y: 1, z: 0 } },
    { nombre: 'Cámara 3 - Góndola derecha central', posicion: { x: 5, y: 3.1, z: 3 }, objetivo: { x: 9, y: 1, z: 0 } },
    { nombre: 'Cámara 4 - Góndola derecha posterior', posicion: { x: 21, y: 3.1, z: -4 }, objetivo: { x: 17, y: 1, z: 0 } },
    { nombre: 'Cámara 5 - Refrigeradores izquierdos', posicion: { x: -30, y: 2.8, z: -22 }, objetivo: { x: -26, y: 1.1, z: -26.5 } },
    { nombre: 'Cámara 6 - Refrigeradores centrales izquierdos', posicion: { x: -19, y: 2.8, z: -22 }, objetivo: { x: -20, y: 1.1, z: -26.5 } },
    { nombre: 'Cámara 7 - Refrigeradores centrales derechos', posicion: { x: 19, y: 2.8, z: -22 }, objetivo: { x: 20, y: 1.1, z: -26.5 } },
    { nombre: 'Cámara 8 - Refrigeradores derechos', posicion: { x: 30, y: 2.8, z: -22 }, objetivo: { x: 26, y: 1.1, z: -26.5 } },
    { nombre: 'Cámara 9 - Mesa de frutas 1', posicion: { x: -28.5, y: 2.8, z: 18 }, objetivo: { x: -25.5, y: 0.9, z: 15 } },
    { nombre: 'Cámara 10 - Mesa de frutas 2', posicion: { x: -19, y: 2.8, z: 18 }, objetivo: { x: -21.7, y: 0.9, z: 15 } },
    { nombre: 'Cámara 11 - Mesa de verduras 3', posicion: { x: -28.5, y: 2.8, z: 8 }, objetivo: { x: -25.5, y: 0.9, z: 10.8 } },
    { nombre: 'Cámara 12 - Mesa de verduras 4', posicion: { x: -19, y: 2.8, z: 8 }, objetivo: { x: -21.7, y: 0.9, z: 10.8 } },
    { nombre: 'Cámara 13 - Entrada principal', posicion: { x: -5, y: 3.5, z: 27 }, objetivo: { x: 0, y: 1.2, z: 20 } },
    { nombre: 'Cámara 14 - Cajas izquierda', posicion: { x: -12, y: 3.2, z: 19 }, objetivo: { x: -5, y: 1, z: 20 } },
    { nombre: 'Cámara 15 - Cajas derecha', posicion: { x: 12, y: 3.2, z: 19 }, objetivo: { x: 5, y: 1, z: 20 } },
    { nombre: 'Cámara 16 - Pasillo principal', posicion: { x: 0, y: 4, z: -12 }, objetivo: { x: 0, y: 1, z: 3 } },
    { nombre: 'Cámara 17 - Entrada de vehículos', posicion: { x: -13, y: 5, z: 32 }, objetivo: { x: 0, y: 1.2, z: 39 } },
    { nombre: 'Cámara 18 - Estacionamiento izquierdo', posicion: { x: -29, y: 5, z: 43 }, objetivo: { x: -16, y: 1.2, z: 43 } },
    { nombre: 'Cámara 19 - Estacionamiento derecho', posicion: { x: 29, y: 5, z: 43 }, objetivo: { x: 16, y: 1.2, z: 43 } },
    { nombre: 'Cámara 20 - Salida de vehículos', posicion: { x: 12, y: 5, z: 54 }, objetivo: { x: 0, y: 1.2, z: 48 } },
    { nombre: 'Cámara 21 - Vista general del estacionamiento', posicion: { x: 0, y: 13, z: 58 }, objetivo: { x: 0, y: 0, z: 40 } }
];

// ============================================================
// VARIABLES
// ============================================================

let escena, camara, renderizador, controles, reloj;
let sistemaVehiculos = null;
let productosLacteos = null;

let luzAmbiente, luzSol, luzLuna;
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

    crearLadrones();
    crearSistemaVehiculos();

    configurarEventos();
    actualizarIluminacion();

    iniciarAnimacion();

    console.info('Supermercado 3D iniciado.');
    console.info(`Cámaras de seguridad: ${CONFIG_CAMARAS.length}`);
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
    renderizador.shadowMap.enabled = CONFIG.sombras;

    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.appendChild(renderizador.domElement);
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
// ESTRUCTURA
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
        console.info('Productos iniciados.');
    } catch (error) {
        console.error('Error al iniciar productos:', error);
    }

    try {
        crearEstacionamiento(escena);
        console.info('Estacionamiento creado.');
    } catch (error) {
        console.error('Error al crear estacionamiento:', error);
    }
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
    for (const config of CONFIG_LADRONES) {
        try {
            const primerPunto = config.ruta[0];

            const ladron = crearClienteSupermercado(escena, {
                id: config.nombre,
                modelo: config.modelo,

                posicion: {
                    x: primerPunto.x,
                    y: 0,
                    z: primerPunto.z
                },

                velocidad: config.velocidad,
                escala: 1,

                ruta: config.ruta.slice(1),
                repetirRuta: true,

                probabilidadCompra: 0,
                tiempoExaminar: 0,
                distanciaRecoger: 0,
                pausaEntreCompras: 0,

                distanciaDestino: 0.8,
                radioColision: 0.42
            });

            if (!ladron) continue;

            ladron.nombre = config.nombre;
            ladron._esLadron = true;

            ladronesSupermercado.push(ladron);

            console.info(`[LADRÓN] ${config.nombre} creado.`);
        } catch (error) {
            console.error(`Error creando ${config.nombre}:`, error);
        }
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
            velocidad: 5.5,
            tiempoEntreLlegadas: 7,
            cochesIniciales: 3,

            alEstacionar: datos => crearClienteParaVehiculo(datos),
            alSalir: datos => limpiarVisitaVehiculo(datos.id)
        });

        console.info('Sistema de vehículos iniciado.');
    } catch (error) {
        console.error('Error al crear vehículos:', error);
    }
}

// ============================================================
// VISITANTES
// ============================================================

function crearClienteParaVehiculo(datos) {
    if (!datos?.plaza) {
        console.warn('El vehículo no proporcionó una plaza.');
        return;
    }

    const config = CONFIG_CLIENTES[
        siguienteModeloCliente % CONFIG_CLIENTES.length
    ];

    siguienteModeloCliente++;

    const idVisita = datos.id ?? `visitante-${++contadorVisitantes}`;

    if (visitantesPorVehiculo.has(idVisita)) {
        console.warn(`La visita ${idVisita} ya existe.`);
        return;
    }

    const posicionEntrada = { x: 0, y: 0, z: 27 };

    try {
        const cliente = crearClienteSupermercado(escena, {
            id: `VISITANTE_${idVisita}`,
            modelo: config.modelo,

            posicion: posicionEntrada,
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
                const visita = visitantesPorVehiculo.get(idVisita);

                if (!visita || visita.fase !== 'entrando') return;

                visita.fase = 'comprando';
                visita.tiempo = 0;

                if (!visita.carrito) {
                    visita.carrito = crearCarritoVisitante(
                        visita.cliente,
                        idVisita
                    );
                }

                visita.cliente.configurarCompras?.({
                    productos: productosLacteos,
                    carrito: visita.carrito
                });
            }
        });

        if (!cliente) {
            console.error(`No se pudo crear el visitante ${idVisita}.`);
            sistemaVehiculos?.solicitarSalida?.(datos.id);
            return;
        }

        cliente.nombre = config.nombre;

        const visita = {
            id: idVisita,
            idVehiculo: datos.id,
            cliente,
            carrito: null,
            plaza: { ...datos.plaza },
            fase: 'entrando',
            tiempo: 0,
            pagoSolicitado: false,
            salidaSolicitada: false
        };

        visitantesPorVehiculo.set(idVisita, visita);
        clientesSupermercado.push(cliente);

        cliente.iniciarDesdeVehiculo?.(
            posicionEntrada,
            datos.plaza
        );

        console.info(`[VISITANTE] ${idVisita} inició su recorrido.`);
    } catch (error) {
        console.error('Error al crear visitante:', error);
        sistemaVehiculos?.solicitarSalida?.(datos.id);
    }
}

// ============================================================
// CARRITOS
// ============================================================

function crearCarritoVisitante(cliente, idVisita) {
    if (!cliente?.grupo) return null;

    try {
        const posicion = cliente.grupo.position;

        const carrito = crearCarrito(escena, {
            modelo: '/modelos/carrito.glb',

            posicion: {
                x: posicion.x - CONFIG.distanciaCarrito,
                y: 0,
                z: posicion.z
            },

            escala: 1
        });

        if (!carrito) return null;

        carrito.seguirObjetivo?.(
            cliente.grupo,
            CONFIG.distanciaCarrito
        );

        carritosClientes.push(carrito);

        return carrito;
    } catch (error) {
        console.error(`Error creando carrito ${idVisita}:`, error);
        return null;
    }
}

// ============================================================
// LIMPIEZA DE VISITANTES
// ============================================================

function limpiarVisitaVehiculo(idVehiculo) {
    const visita = visitantesPorVehiculo.get(idVehiculo);

    if (!visita) return;

    visita.cliente?.eliminar?.();
    visita.carrito?.eliminar?.();

    const indiceCliente = clientesSupermercado.indexOf(visita.cliente);

    if (indiceCliente !== -1) {
        clientesSupermercado.splice(indiceCliente, 1);
    }

    const indiceCarrito = carritosClientes.indexOf(visita.carrito);

    if (indiceCarrito !== -1) {
        carritosClientes.splice(indiceCarrito, 1);
    }

    visitantesPorVehiculo.delete(idVehiculo);

    console.info(`[VISITANTE] Visita ${idVehiculo} finalizada.`);
}

// ============================================================
// ACTUALIZAR ENTIDADES
// ============================================================

function actualizarEntidades(delta) {
    actualizarLista(clientesSupermercado, delta);
    actualizarLista(ladronesSupermercado, delta);

    for (let i = carritosClientes.length - 1; i >= 0; i--) {
        const carrito = carritosClientes[i];

        if (!carrito || carrito.eliminado) {
            carritosClientes.splice(i, 1);
            continue;
        }

        carrito.actualizar?.(delta);
    }

    // Se prioriza actualizarCompleto para procesar las llegadas iniciales.
    if (typeof sistemaVehiculos?.actualizarCompleto === 'function') {
        sistemaVehiculos.actualizarCompleto(delta);
    } else if (typeof sistemaVehiculos?.actualizar === 'function') {
        sistemaVehiculos.actualizar(delta);
    }

    actualizarFasesVisitantes(delta);
    actualizarHUD();
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
// COMPRAS Y PAGO
// ============================================================

function actualizarFasesVisitantes(delta) {
    for (const visita of visitantesPorVehiculo.values()) {
        const cliente = visita.cliente;

        if (!cliente || cliente.eliminado) continue;
        if (visita.fase !== 'comprando') continue;
        if (visita.pagoSolicitado) continue;

        visita.tiempo += delta;

        const compras = cliente.obtenerCompras?.() ?? [];
        const estado = String(cliente.estado ?? '').toLowerCase();

        const maximoComprado =
            compras.length >= CONFIG.maximoProductosCliente;

        const tiempoAgotado =
            visita.tiempo >= CONFIG.tiempoCompraAuto;

        const recogiendoProducto = [
            'acercando',
            'recogiendo',
            'acercandoproducto',
            'recogiendoproducto'
        ].includes(estado);

        // No iniciar el pago mientras el cliente recoge un producto.
        if (recogiendoProducto) continue;

        if (!maximoComprado && !tiempoAgotado) continue;

        visita.pagoSolicitado = true;
        visita.fase = 'caja';

        iniciarPagoVisitante(visita);
    }
}

function iniciarPagoVisitante(visita) {
    const cliente = visita.cliente;

    if (!cliente || typeof cliente.iniciarPago !== 'function') {
        visita.fase = 'errorPago';
        visita.pagoSolicitado = false;
        console.error('El cliente no tiene iniciarPago().');
        return;
    }

    mostrarMensaje(`${cliente.nombre} se dirige a la caja.`);

    try {
        const iniciado = cliente.iniciarPago(
            CONFIG.posicionCaja,
            ticket => finalizarPagoVisitante(visita, ticket)
        );

        if (iniciado === false) {
            visita.fase = 'errorPago';
            visita.pagoSolicitado = false;
            mostrarMensaje('No se pudo iniciar el recorrido a caja.');
        }
    } catch (error) {
        visita.fase = 'errorPago';
        visita.pagoSolicitado = false;
        console.error('Error al iniciar pago:', error);
    }
}

function finalizarPagoVisitante(visita, ticket) {
    if (!visita || visita.fase !== 'caja') return;

    visita.fase = 'regresando';

    if (ticket) {
        const ticketGuardado = {
            ...ticket,
            fecha: ticket.fecha ?? new Date().toLocaleString('es-MX')
        };

        ticketsGenerados.push(ticketGuardado);
        mostrarTicket(ticketGuardado, visita.cliente.nombre);
    }

    const cliente = visita.cliente;

    if (typeof cliente.iniciarRegresoVehiculo !== 'function') {
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
                    `${cliente.nombre} regresó a su vehículo.`
                );

                if (!visita.salidaSolicitada) {
                    visita.salidaSolicitada = true;

                    const resultado =
                        sistemaVehiculos?.solicitarSalida?.(
                            visita.idVehiculo
                        );

                    if (resultado === false) {
                        visita.salidaSolicitada = false;
                        console.warn(
                            `El vehículo ${visita.idVehiculo} rechazó la salida.`
                        );
                    }
                }
            }
        );

        if (iniciado === false) {
            visita.fase = 'errorRegreso';
            console.error('No se pudo iniciar el regreso al vehículo.');
        }
    } catch (error) {
        visita.fase = 'errorRegreso';
        console.error('Error en el regreso al vehículo:', error);
    }
}

// ============================================================
// MOVIMIENTO DEL JUGADOR
// ============================================================

function actualizarJugador(delta) {
    if (
        !juegoIniciado ||
        !controles.isLocked ||
        vistaSeguridad !== null
    ) return;

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
// RECORRIDO
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

    descargarCSV(filas.join('\n'), 'recorrido_supermercado.csv');
    mostrarMensaje('Recorrido exportado.');
}

// ============================================================
// TICKETS Y CSV
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
        articulo.precioUnitario ??
        articulo.precio ??
        0
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

    descargarCSV(filas.join('\n'), 'tickets_supermercado.csv');
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
// TICKET VISUAL
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
        articulos.appendChild(fila);
    }

    const total = Number.isFinite(Number(ticket.total))
        ? Number(ticket.total)
        : totalCalculado;

    totalElemento.textContent = `$${total.toFixed(2)}`;
    ventana.style.display = 'flex';
}

// ============================================================
// CÁMARAS
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
    ) return;

    const config = CONFIG_CAMARAS[numero - 1];

    if (vistaSeguridad === null) {
        posicionJugadorGuardada = camara.position.clone();
        quaternionJugadorGuardado = camara.quaternion.clone();
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

        vistaSeguridad = null;
        posicionJugadorGuardada = null;
        quaternionJugadorGuardado = null;
    }

    limpiarTeclas();
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
        }

        @media print {
            body * { visibility:hidden !important; }

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
        <p>1-9: cámaras | 0: volver al jugador</p>
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
            modoNoche ? 'Modo nocturno activado.' : 'Modo diurno activado.'
        );
    };

    document.getElementById('btn-llegada').onclick = () => {
        if (typeof sistemaVehiculos?.solicitarLlegada !== 'function') {
            mostrarMensaje('El sistema de vehículos no está disponible.');
            return;
        }

        const resultado = sistemaVehiculos.solicitarLlegada();

        if (resultado === false) {
            mostrarMensaje('No hay plazas disponibles o no se pudo solicitar el vehículo.');
            return;
        }

        mostrarMensaje('Llegada de vehículo solicitada.');
    };

    document.getElementById('btn-entrada').onclick = () => {
        volverAlJugador();

        camara.position.set(0, CONFIG.alturaJugador, 25);
        camara.lookAt(0, CONFIG.alturaJugador, 15);

        velocidadVertical = 0;
        jugadorEnSuelo = true;

        registrarTrayectoria(camara.position);
    };

    document.getElementById('btn-recorrido').onclick = exportarTrayectoria;
    document.getElementById('btn-tickets').onclick = exportarTickets;

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
        compras.textContent = `Tickets: ${ticketsGenerados.length}`;
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

        if (/^Digit[1-9]$/.test(evento.code)) {
            cambiarVistaSeguridad(Number(evento.code.slice(-1)));
        }

        if (/^Numpad[1-9]$/.test(evento.code)) {
            cambiarVistaSeguridad(Number(evento.code.slice(-1)));
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
        if (document.hidden) limpiarTeclas();
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

        renderizador.render(escena, camara);
    });
}
