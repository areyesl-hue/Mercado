
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
    pixelRatioMaximo:  0.50,
    sombras: false,

    // Carritos.
    distanciaCarrito: 1.15,
    suavizadoCarrito: 8,
    correccionModeloCarrito: 0,

    // Clientes.
    velocidadCliente: 1.5,
    probabilidadCompra: 1,
    tiempoExaminar: 1.25,
    distanciaRecoger: 2,
    pausaEntreCompras: 1.5
};

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
// VARIABLES PRINCIPALES
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
// INICIO
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
    crearClientesFijos();
    crearSistemaVehiculos();

    configurarEventos();
    actualizarIluminacion();
    iniciarAnimacion();

    console.info(
        'Supermercado 3D iniciado. ' +
        'Los visitantes que llegan en auto tendrán su carrito al entrar.'
    );
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

    renderizador.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderizador.shadowMap.enabled = CONFIG.sombras;

    if (CONFIG.sombras) {
        renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
    }

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
    luzAmbiente = new THREE.HemisphereLight(
        0xe8f3ff,
        0x6d6250,
        1.8
    );

    luzAmbiente.name = 'LUZ_AMBIENTE';
    escena.add(luzAmbiente);

    luzSol = new THREE.DirectionalLight(
        0xffedcf,
        2.4
    );

    luzSol.name = 'LUZ_SOL';
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

    luzLuna = new THREE.DirectionalLight(
        0x829bc9,
        0.1
    );

    luzLuna.name = 'LUZ_LUNA';
    luzLuna.position.set(20, 35, -25);
    luzLuna.visible = false;

    escena.add(luzLuna);
}

// ============================================================
// SUELO Y ENTORNO
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

    const grid = new THREE.GridHelper(
        64,
        32,
        0x92999c,
        0xb3b8bb
    );

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
        console.error(
            'No se pudo crear el estacionamiento:',
            error
        );
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

    if (mercado) {
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
    }

    try {
        productosLacteos = crearProductosLacteos(escena);
        console.info('Productos creados.');
    } catch (error) {
        console.error('Error al crear productos:', error);
    }
}

// ============================================================
// CREAR UN CARRITO Y SU CONTROL
// ============================================================

function crearCarritoVisitante(cliente, nombreCliente) {
    if (!cliente?.grupo) {
        console.warn(
            `No se pudo crear el carrito de ${nombreCliente}: falta el grupo del cliente.`
        );

        return null;
    }

    const posicionCliente = cliente.grupo.position;
    const rotacion = cliente.grupo.rotation.y;

    // El carrito aparece detrás del cliente, no junto al automóvil.
    const posicionInicial = {
        x: posicionCliente.x - Math.sin(rotacion) * 1.15,
        y: 0,
        z: posicionCliente.z - Math.cos(rotacion) * 1.15
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
            console.error(
                `El carrito de ${nombreCliente} no devolvió la propiedad grupo.`
            );

            carrito?.eliminar?.();
            return null;
        }

        carrito.grupo.position.set(
            posicionInicial.x,
            posicionInicial.y,
            posicionInicial.z
        );

        carrito.grupo.visible = true;

        if (typeof carrito.seguirObjetivo === 'function') {
            carrito.seguirObjetivo(
                cliente.grupo,
                CONFIG.distanciaCarrito
            );
        } else {
            console.warn(
                'El carrito no tiene el método seguirObjetivo(). ' +
                'Revisa carrito.js.'
            );
        }

        carritosClientes.push(carrito);

        console.info(
            `Carrito creado para ${nombreCliente} al entrar al supermercado.`
        );

        return carrito;
    } catch (error) {
        console.error(
            `No se pudo crear el carrito de ${nombreCliente}:`,
            error
        );

        carrito?.eliminar?.();
        return null;
    }
}

// ============================================================
// CLIENTES FIJOS DEL SUPERMERCADO
// ============================================================

function crearClientesFijos() {
    for (const config of CONFIG_CLIENTES) {
        const inicio = config.ruta[0];

        let cliente = null;
        let carrito = null;

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

            // Estos clientes ya aparecen dentro del supermercado.
            // Por eso reciben su carrito desde el inicio.
            carrito = crearCarrito(escena, {
                modelo: '/modelos/carrito.glb',
                distancia: CONFIG.distanciaCarrito,
                suavizado: CONFIG.suavizadoCarrito,
                correccionModelo: CONFIG.correccionModeloCarrito,
                escala: 1
            });

            if (carrito?.grupo && cliente?.grupo) {
                const p = cliente.grupo.position;
                const r = cliente.grupo.rotation.y;

                carrito.grupo.position.set(
                    p.x - Math.sin(r) * 1.15,
                    0,
                    p.z - Math.cos(r) * 1.15
                );

                carrito.seguirObjetivo?.(
                    cliente.grupo,
                    CONFIG.distanciaCarrito
                );
            }

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

            clientesSupermercado.push(cliente);

            if (carrito) {
                carritosClientes.push(carrito);
            }
        } catch (error) {
            console.error(
                `No se pudo crear ${config.nombre}:`,
                error
            );

            cliente?.eliminar?.();
            carrito?.eliminar?.();
        }
    }

    actualizarContadorClientes();
}

// ============================================================
// SISTEMA DE VEHÍCULOS
// ============================================================

function crearSistemaVehiculos() {
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

            // Solicitar otro vehículo cuando se libere el anterior.
            sistemaVehiculos?.solicitarLlegada();
        }
    });
}

// ============================================================
// CLIENTE QUE LLEGA EN AUTOMÓVIL
// ============================================================

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

    // MUY IMPORTANTE:
    // No se crea el carrito aquí.
    // Se crea cuando el cliente termina de entrar.
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
                const visita =
                    visitantesPorVehiculo.get(datos.id);

                if (visita) {
                    visita.fase = 'comprando';
                    visita.tiempo = 0;
                }

                // Evita crear más de un carrito para el mismo cliente.
                if (!carrito) {
                    carrito = crearCarritoVisitante(
                        clienteEntrado,
                        config.nombre
                    );
                }

                // El cliente debe usar el mismo carrito que lo sigue.
                clienteEntrado.configurarCompras({
                    productos: productosLacteos,
                    carrito,

                    alRecoger: producto => {
                        console.info(
                            `${config.nombre} recogió:`,
                            producto
                        );

                        mostrarMensaje(
                            `${config.nombre}: producto recogido`
                        );
                    }
                });

                if (!carrito) {
                    console.warn(
                        `${config.nombre} entró, pero no pudo crear su carrito.`
                    );

                    mostrarMensaje(
                        `${config.nombre} entró, pero no se pudo crear el carrito`
                    );

                    return;
                }

                mostrarMensaje(
                    `${config.nombre} entró y tomó un carrito`
                );
            }
        });

        // El cliente comienza sin carrito porque todavía está
        // caminando desde el estacionamiento hasta la entrada.
        cliente.configurarCompras({
            productos: productosLacteos,
            carrito: null
        });

        cliente.iniciarDesdeVehiculo(
            posicion,
            datos.plaza
        );

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

        mostrarMensaje(
            `${config.nombre} estacionó y va hacia la entrada`
        );

        console.info(
            `${config.nombre} creado para el vehículo ${datos.id}.`,
            `Plaza: (${datos.plaza.x}, ${datos.plaza.z}).`
        );
    } catch (error) {
        console.error(
            'No se pudo crear el cliente para el vehículo:',
            error
        );

        cliente?.eliminar?.();
        carrito?.eliminar?.();

        visitantesPorVehiculo.delete(datos.id);
    }
}

// ============================================================
// CONTADOR DE CLIENTES
// ============================================================

function actualizarContadorClientes() {
    const elemento = document.getElementById(
        'super-client-count'
    );

    if (elemento) {
        elemento.textContent = String(
            clientesSupermercado.filter(
                cliente => cliente && !cliente.eliminado
            ).length
        );
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

    escena.add(controles.object);

    controles.object.position.set(
        0,
        CONFIG.alturaJugador,
        25
    );

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
            background: linear-gradient(
                135deg,
                rgba(7,18,28,.94),
                rgba(13,39,52,.86)
            );
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
            #super-hud {
                font-size: 11px;
            }

            #super-controls {
                max-width: 230px;
            }

            #super-ui button {
                font-size: 12px;
                padding: 9px 12px;
            }
        }
    `;

    document.head.appendChild(estilo);

    const ui = document.createElement('div');
    ui.id = 'super-ui';

    ui.innerHTML = `
        <div id="super-start">
            <h1>SUPERMERCADO 3D</h1>

            <p>
                Explora los pasillos, refrigeradores,
                productos y diferentes áreas del supermercado.
            </p>

            <p>
                W A S D: moverte · Shift: correr · Espacio: saltar
                · Mouse: mirar · Esc: liberar cursor
            </p>

            <button id="super-enter">
                ENTRAR AL SUPERMERCADO
            </button>
        </div>

        <div id="super-hud">
            <strong>SUPERMERCADO</strong><br>
            Estado: <span id="super-state">Preparado</span><br>
            Velocidad: <span id="super-speed">0 m/s</span><br>
            Hora: <span id="super-time">12:00</span><br>
            Modo: <span id="super-mode">Día</span><br>
            Clientes: <span id="super-client-count">0</span><br>
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

    document.getElementById('super-enter')
        .addEventListener('click', () => controles.lock());

    document.getElementById('super-day')
        .addEventListener('click', () => {
            modoNoche = !modoNoche;
            horaDia = modoNoche ? 22 : 12;
            actualizarIluminacion();
        });

    document.getElementById('super-arrival')
        .addEventListener('click', () => {
            if (!sistemaVehiculos?.solicitarLlegada()) {
                mostrarMensaje(
                    'No hay vehículos disponibles o plazas libres'
                );
            } else {
                mostrarMensaje('Nuevo vehículo en camino');
            }
        });

    document.getElementById('super-home')
        .addEventListener('click', () => {
            controles.object.position.set(
                0,
                CONFIG.alturaJugador,
                25
            );

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
        camara.aspect =
            window.innerWidth / window.innerHeight;

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

        if (
            evento.code === 'ShiftLeft' ||
            evento.code === 'ShiftRight'
        ) {
            corriendo = true;
        }
    });

    document.addEventListener('keyup', evento => {
        teclas[evento.code] = false;

        if (
            evento.code === 'ShiftLeft' ||
            evento.code === 'ShiftRight'
        ) {
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

    window.addEventListener('contextmenu', evento => {
        evento.preventDefault();
    });
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

        vectorDerecha
            .crossVectors(vectorAdelante, ejeVertical)
            .normalize();

        movimientoTemporal
            .set(0, 0, 0)
            .addScaledVector(vectorAdelante, direccion.z)
            .addScaledVector(vectorDerecha, direccion.x);

        if (movimientoTemporal.lengthSq() > 0) {
            controles.object.position.add(
                movimientoTemporal
                    .normalize()
                    .multiplyScalar(velocidad * delta)
            );
        }
    }

    velocidadVertical -= CONFIG.gravedad * delta;
    controles.object.position.y += velocidadVertical * delta;

    if (
        controles.object.position.y <= CONFIG.alturaJugador
    ) {
        controles.object.position.y = CONFIG.alturaJugador;
        velocidadVertical = 0;
        jugadorEnSuelo = true;
    }

    controles.object.position.x = THREE.MathUtils.clamp(
        controles.object.position.x,
        -50,
        50
    );

    controles.object.position.z = THREE.MathUtils.clamp(
        controles.object.position.z,
        -55,
        85
    );

    const elementoVelocidad =
        document.getElementById('super-speed');

    const elementoEstado =
        document.getElementById('super-state');

    if (elementoVelocidad) {
        elementoVelocidad.textContent =
            `${moviendo ? velocidad : 0} m/s`;
    }

    if (elementoEstado) {
        elementoEstado.textContent =
            corriendo && moviendo
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
        modoNoche
            ? CONFIG.colorCieloNoche
            : CONFIG.colorCieloDia
    );

    escena.fog.color.setHex(
        modoNoche ? 0x17202e : 0xc7d9e9
    );

    luzAmbiente.intensity = modoNoche ? 0.65 : 1.8;
    luzSol.intensity = modoNoche ? 0.12 : 2.4;
    luzLuna.intensity = modoNoche ? 0.75 : 0.1;

    luzSol.visible = !modoNoche;
    luzLuna.visible = modoNoche;

    const elemento = document.getElementById('super-mode');

    if (elemento) {
        elemento.textContent = modoNoche ? 'Noche' : 'Día';
    }
}

function actualizarHora(delta) {
    horaDia += delta * 0.025;

    if (horaDia >= 24) {
        horaDia = 0;
    }

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
// MENSAJES DE INTERFAZ
// ============================================================

function mostrarMensaje(texto) {
    const elemento = document.getElementById('super-message');

    if (!elemento) return;

    elemento.textContent = texto;
    elemento.style.opacity = '1';

    if (elemento._temporizador) {
        clearTimeout(elemento._temporizador);
    }

    elemento._temporizador = setTimeout(() => {
        elemento.style.opacity = '0';
    }, 2400);
}

function ocultarPantallaInicio() {
    const elemento = document.getElementById('super-start');

    if (elemento) {
        elemento.style.display = 'none';
    }
}

function mostrarPantallaInicio() {
    const elemento = document.getElementById('super-start');

    if (elemento) {
        elemento.style.display = 'flex';
    }
}

// ============================================================
// ACTUALIZACIÓN DE CLIENTES, CARRITOS Y VEHÍCULOS
// ============================================================

function actualizarEntidades(delta) {
    if (sistemaVehiculos) {
        sistemaVehiculos.actualizar(delta);
    }

    // Actualizar clientes una sola vez por fotograma.
    for (const cliente of clientesSupermercado) {
        if (cliente && !cliente.eliminado) {
            cliente.actualizar(delta);
        }
    }

    // Actualizar los carritos, incluidos los creados al entrar.
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

    // Controlar el tiempo de compra, caja y regreso al automóvil.
    for (const visita of visitantesPorVehiculo.values()) {
        if (!visita.cliente || visita.cliente.eliminado) {
            continue;
        }

        visita.tiempo += delta;

        if (
            visita.fase === 'comprando' &&
            visita.tiempo >= tiempoCompraAuto
        ) {
            visita.fase = 'caja';
            visita.tiempo = 0;

            // Destino provisional de cajas.
            visita.cliente.establecerRuta([
                { x: 0, z: 20 }
            ]);

            mostrarMensaje(
                `${visita.nombre} se dirige a cajas`
            );
        } else if (
            visita.fase === 'caja' &&
            visita.tiempo >= tiempoCajaAuto
        ) {
            visita.fase = 'regresando';
            visita.tiempo = 0;

            mostrarMensaje(
                `${visita.nombre} regresa a su auto`
            );

            visita.cliente.iniciarRegresoVehiculo(
                visita.plaza,
                () => {
                    const carrito = visita.carrito;

                    if (carrito?.grupo) {
                        carrito.grupo.visible = false;
                    }

                    if (visita.cliente?.grupo) {
                        visita.cliente.grupo.visible = false;
                    }

                    if (
                        !sistemaVehiculos?.solicitarSalida(visita.id)
                    ) {
                        visita.cliente?.eliminar?.();
                        carrito?.eliminar?.();

                        visitantesPorVehiculo.delete(visita.id);
                    }
                }
            );
        }
    }

    const elementoVehiculos =
        document.getElementById('super-car-count');

    if (elementoVehiculos && sistemaVehiculos) {
        elementoVehiculos.textContent = String(
            sistemaVehiculos
                .obtenerVehiculos()
                .filter(vehiculo => vehiculo.estado === 'estacionado')
                .length
        );
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
            console.error(
                'Error durante la animación:',
                error
            );
        }
    });
}
