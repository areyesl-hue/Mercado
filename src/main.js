
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
    pixelRatioMaximo: 1.75,

    distanciaCarrito: 0.95,
    suavizadoCarrito: 8,
    correccionModeloCarrito: 0,

    velocidadCliente: 1.5,
    probabilidadCompra: 1,
    tiempoExaminar: 1.25,
    distanciaRecoger: 2,
    pausaEntreCompras: 1.5,

    velocidadLadron: 1.8,
    velocidadHuidaLadron: 5.8,
    productosRobadosLadron: 2,

    modeloLadron: '/modelos/ladron3.glb'
};

// ============================================================
// RUTAS DE LOS CLIENTES
// ============================================================

const CONFIG_CLIENTES = [
    {
        nombre: 'Cliente1',
        modelo: '/modelos/Cliente1.glb',
        ruta: [
            { x: -27, z: 18 }, { x: -23, z: 15 },
            { x: -21, z: 10.8 }, { x: -17, z: 6.5 },
            { x: -12, z: 6.5 }, { x: -5, z: 6.5 },
            { x: -5, z: 0 }, { x: -12, z: -6 }
        ]
    },
    {
        nombre: 'Cliente2',
        modelo: '/modelos/Cliente2.glb',
        ruta: [
            { x: -27.8, z: 12.2 }, { x: -29, z: 8 },
            { x: -20, z: 6.5 }, { x: -12, z: 6.5 },
            { x: 0, z: 6.5 }, { x: 12, z: 6.5 },
            { x: 22, z: 6.5 }, { x: 26, z: 2 },
            { x: 21, z: -6 }, { x: 12, z: -6 },
            { x: 0, z: -6 }, { x: -12, z: -6 },
            { x: -20, z: -6 }
        ]
    },
    {
        nombre: 'Cliente3',
        modelo: '/modelos/Cliente3.glb',
        ruta: [
            { x: -20, z: 4 }, { x: -12, z: 6.5 },
            { x: -5, z: 6.5 }, { x: 0, z: 0 },
            { x: 5, z: -6 }, { x: 12, z: -6 },
            { x: 20, z: -6 }, { x: 22, z: -10 },
            { x: 12, z: -22 }, { x: 0, z: -22 }
        ]
    },
    {
        nombre: 'Cliente4',
        modelo: '/modelos/Cliente4.glb',
        ruta: [
            { x: 20, z: 4 }, { x: 26, z: 2 },
            { x: 22, z: 6.5 }, { x: 12, z: 6.5 },
            { x: 5, z: 0 }, { x: 12, z: -6 },
            { x: 20, z: -6 }, { x: 22, z: -10 },
            { x: 20, z: -18 }, { x: 12, z: -22 }
        ]
    },
    {
        nombre: 'Clienta1',
        modelo: '/modelos/Clienta1.glb',
        ruta: [
            { x: -20, z: -6 }, { x: -26, z: -6 },
            { x: -26, z: -18 }, { x: -20, z: -22 },
            { x: -10, z: -22 }, { x: 0, z: -22 },
            { x: 12, z: -22 }, { x: 20, z: -18 },
            { x: 22, z: -10 }, { x: 12, z: -6 },
            { x: 0, z: -6 }
        ]
    },
    {
        nombre: 'Clienta2',
        modelo: '/modelos/Clienta2.glb',
        ruta: [
            { x: 20, z: 12 }, { x: 23, z: 15 },
            { x: 18, z: 8 }, { x: 17, z: 0 },
            { x: 12, z: -6 }, { x: 17, z: -10 },
            { x: 20, z: -18 }, { x: 12, z: -22 }
        ]
    },
    {
        nombre: 'Clienta3',
        modelo: '/modelos/Clienta3.glb',
        ruta: [
            { x: 24, z: -6 }, { x: 17, z: -10 },
            { x: 12, z: -18 }, { x: 20, z: -22 },
            { x: 12, z: -18 }, { x: 17, z: -10 },
            { x: 22, z: -6 }, { x: 24, z: 0 }
        ]
    }
];

// ============================================================
// 10 CÁMARAS DE SEGURIDAD
// Supermercado, almacén y estacionamiento
// ============================================================

const CAMARAS_SEGURIDAD = [
    // 1. Frutas y verduras
    {
        nombre: 'Cámara 1: Frutas y verduras',
        posicion: new THREE.Vector3(-29, 5.5, 24),
        objetivo: new THREE.Vector3(-20, 0, 12)
    },

    // 2. Refrigeradores y bebidas
    {
        nombre: 'Cámara 2: Refrigeradores',
        posicion: new THREE.Vector3(29, 5.5, 24),
        objetivo: new THREE.Vector3(23, 0, 8)
    },

    // 3. Pasillo izquierdo
    {
        nombre: 'Cámara 3: Pasillo izquierdo',
        posicion: new THREE.Vector3(-29, 5.5, -15),
        objetivo: new THREE.Vector3(-10, 0, -5)
    },

    // 4. Pasillo derecho
    {
        nombre: 'Cámara 4: Pasillo derecho',
        posicion: new THREE.Vector3(29, 5.5, -15),
        objetivo: new THREE.Vector3(10, 0, -5)
    },

    // 5. Almacén
    {
        nombre: 'Cámara 5: Interior del almacén',
        posicion: new THREE.Vector3(-24, 5.5, -35),
        objetivo: new THREE.Vector3(0, 1, -43)
    },

    // 6. Entrada principal
    {
        nombre: 'Cámara 6: Entrada principal',
        posicion: new THREE.Vector3(0, 5.5, 27),
        objetivo: new THREE.Vector3(0, 0, 15)
    },

    // 7. Estacionamiento izquierdo
    {
        nombre: 'Cámara 7: Estacionamiento izquierdo',
        posicion: new THREE.Vector3(-29, 7, 43),
        objetivo: new THREE.Vector3(-8, 0, 43)
    },

    // 8. Estacionamiento derecho
    {
        nombre: 'Cámara 8: Estacionamiento derecho',
        posicion: new THREE.Vector3(29, 7, 43),
        objetivo: new THREE.Vector3(8, 0, 43)
    },

    // 9. Acceso vehicular y carretera
    {
        nombre: 'Cámara 9: Acceso vehicular',
        posicion: new THREE.Vector3(0, 8, 68),
        objetivo: new THREE.Vector3(0, 0, 43)
    },

    // 10. Vista general exterior
    {
        nombre: 'Cámara 10: Vista general exterior',
        posicion: new THREE.Vector3(0, 12, 34),
        objetivo: new THREE.Vector3(0, 0, 49)
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
let horaDia = 12;

let velocidadVertical = 0;
let jugadorEnSuelo = true;
let corriendo = false;

let siguienteModeloCliente = 0;
let siguienteLadron = 0;

let camarasAbiertas = false;
let camaraAnteriorPosicion = null;
let camaraAnteriorQuaternion = null;

const teclas = Object.create(null);
const clientesSupermercado = [];
const carritosClientes = [];
const ladrones = [];
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

    console.info('Supermercado 3D iniciado.');
    console.info('L: día/noche | M: vehículo | N: ladrón | C: cámaras');
    console.info('Cámaras: 1-9 y 0 para la cámara 10.');
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
}

function crearRenderizador() {
    renderizador = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance'
    });

    renderizador.setPixelRatio(
        Math.min(window.devicePixelRatio, CONFIG.pixelRatioMaximo)
    );
    renderizador.setSize(window.innerWidth, window.innerHeight);
    renderizador.shadowMap.enabled = true;
    renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
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
    escena.add(luzAmbiente);

    luzSol = new THREE.DirectionalLight(0xffedcf, 2.4);
    luzSol.position.set(-35, 55, 35);
    luzSol.castShadow = true;
    luzSol.shadow.mapSize.set(2048, 2048);
    luzSol.shadow.camera.left = -55;
    luzSol.shadow.camera.right = 55;
    luzSol.shadow.camera.top = 55;
    luzSol.shadow.camera.bottom = -55;
    luzSol.shadow.camera.near = 0.5;
    luzSol.shadow.camera.far = 150;
    luzSol.shadow.bias = -0.0002;
    escena.add(luzSol);

    luzLuna = new THREE.DirectionalLight(0x829bc9, 0.1);
    luzLuna.position.set(20, 35, -25);
    luzLuna.visible = false;
    escena.add(luzLuna);
}

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

    renderizador.toneMappingExposure = modoNoche ? 0.85 : 1.1;
    horaDia = modoNoche ? 22 : 12;
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
    suelo.receiveShadow = true;
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
    piso.receiveShadow = true;
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
    asfalto.receiveShadow = true;
    exterior.add(asfalto);

    try {
        crearEstacionamiento(escena);
    } catch (error) {
        console.error('Error al crear estacionamiento:', error);
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
        console.info('Productos creados.');
    } catch (error) {
        console.error('Error al crear productos:', error);
    }
}

// ============================================================
// CLIENTES FIJOS Y CARRITOS
// ============================================================

function crearClientesFijos() {
    for (const config of CONFIG_CLIENTES) {
        const inicio = config.ruta[0];

        let cliente = null;
        let carrito = null;

        try {
            cliente = crearClienteSupermercado(escena, {
                modelo: config.modelo,
                posicion: { x: inicio.x, y: 0, z: inicio.z },
                velocidad: CONFIG.velocidadCliente,
                escala: 1,
                ruta: config.ruta,
                probabilidadCompra: CONFIG.probabilidadCompra,
                tiempoExaminar: CONFIG.tiempoExaminar,
                distanciaRecoger: CONFIG.distanciaRecoger,
                pausaEntreCompras: CONFIG.pausaEntreCompras
            });

            carrito = crearCarrito(escena, {
                modelo: '/modelos/carrito.glb',
                distancia: CONFIG.distanciaCarrito,
                suavizado: CONFIG.suavizadoCarrito,
                correccionModelo: CONFIG.correccionModeloCarrito,
                escala: 1
            });

            if (typeof cliente?.configurarCompras === 'function') {
                cliente.configurarCompras({
                    productos: productosLacteos,
                    carrito,
                    alRecoger: producto => {
                        console.info(`${config.nombre} recogió un producto`, producto);
                    }
                });
            }

            if (
                carrito &&
                typeof carrito.seguirObjetivo === 'function' &&
                cliente?.grupo
            ) {
                carrito.seguirObjetivo(
                    cliente.grupo,
                    CONFIG.distanciaCarrito
                );
            }

            clientesSupermercado.push(cliente);
            carritosClientes.push(carrito);
        } catch (error) {
            console.error(`No se pudo crear ${config.nombre}:`, error);
            cliente?.eliminar?.();
            carrito?.eliminar?.();
        }
    }
}

// ============================================================
// VEHÍCULOS Y VISITANTES
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
            }
        });
    } catch (error) {
        console.error('Error al crear vehículos:', error);
    }
}

function crearClienteParaVehiculo(datos) {
    const config =
        CONFIG_CLIENTES[siguienteModeloCliente % CONFIG_CLIENTES.length];

    siguienteModeloCliente++;

    const posicion = {
        x: datos.plaza.x,
        y: 0,
        z: datos.plaza.z
    };

    let carrito = null;
    let cliente = null;

    try {
        carrito = crearCarrito(escena, {
            modelo: '/modelos/carrito.glb',
            distancia: CONFIG.distanciaCarrito,
            suavizado: CONFIG.suavizadoCarrito,
            correccionModelo: CONFIG.correccionModeloCarrito,
            escala: 1
        });

        if (carrito?.grupo) {
            carrito.grupo.position.set(0, 0, 27.2);
        }

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
            pausaEntreCompras: CONFIG.pausaEntreCompras
        });

        if (typeof cliente?.configurarCompras === 'function') {
            cliente.configurarCompras({
                productos: productosLacteos,
                carrito,
                alRecoger: producto => {
                    console.info(`${config.nombre} recogió:`, producto);
                }
            });
        }

        if (typeof cliente?.iniciarDesdeVehiculo === 'function') {
            cliente.iniciarDesdeVehiculo(posicion, datos.plaza);
        }

        if (
            carrito &&
            cliente?.grupo &&
            typeof carrito.seguirObjetivo === 'function'
        ) {
            carrito.seguirObjetivo(cliente.grupo, CONFIG.distanciaCarrito);
        }

        clientesSupermercado.push(cliente);
        carritosClientes.push(carrito);

        visitantesPorVehiculo.set(datos.id, {
            id: datos.id,
            plaza: datos.plaza,
            cliente,
            carrito,
            fase: 'entrando',
            tiempo: 0,
            nombre: config.nombre
        });
    } catch (error) {
        console.error('No se pudo crear el visitante del vehículo:', error);
        cliente?.eliminar?.();
        carrito?.eliminar?.();
    }
}

// ============================================================
// LADRÓN
// ============================================================

function agregarLadron() {
    if (!productosLacteos) {
        console.warn('Los productos todavía no están disponibles.');
        mostrarMensaje('Los productos todavía no están preparados.');
        return;
    }

    const posiciones = [
        { x: -25, y: 0, z: 20 },
        { x: 25, y: 0, z: 20 },
        { x: -20, y: 0, z: 5 },
        { x: 20, y: 0, z: 5 },
        { x: 0, y: 0, z: 18 },
        { x: 0, y: 0, z: -18 }
    ];

    const posicion = posiciones[
        siguienteLadron % posiciones.length
    ];

    siguienteLadron++;

    try {
        const ladron = crearLadron(
            escena,
            productosLacteos,
            {
                modelo: CONFIG.modeloLadron,
                posicion: { ...posicion },
                velocidadCaminar: CONFIG.velocidadLadron,
                velocidadHuida: CONFIG.velocidadHuidaLadron,
                productosRobados: CONFIG.productosRobadosLadron,
                mobiliario
            }
        );

        if (ladron) {
            ladrones.push(ladron);
            mostrarMensaje('Ladrón solicitado.');
            console.info('Ladrón creado con modelo:', CONFIG.modeloLadron);
        } else {
            console.error(
                'crearLadron no devolvió un objeto. Revisa ladron.js.'
            );
            mostrarMensaje('No se pudo crear el ladrón.');
        }
    } catch (error) {
        console.error('Error al crear el ladrón:', error);
        mostrarMensaje('Error al crear el ladrón. Revisa la consola.');
    }
}

// ============================================================
// CONTROLES DEL JUGADOR
// ============================================================

function crearControles() {
    controles = new PointerLockControls(camara, renderizador.domElement);
    escena.add(controles.object);

    controles.object.position.set(0, CONFIG.alturaJugador, 25);

    controles.addEventListener('lock', () => {
        ocultarPantallaInicio();
    });

    controles.addEventListener('unlock', () => {
        if (!camarasAbiertas) {
            mostrarPantallaInicio();
        }

        for (const tecla in teclas) {
            teclas[tecla] = false;
        }

        corriendo = false;
    });
}

// ============================================================
// INTERFAZ MÍNIMA
// ============================================================

function crearInterfaz() {
    const estilo = document.createElement('style');

    estilo.textContent = `
        #super-start {
            position: fixed;
            inset: 0;
            z-index: 100;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            padding: 24px;
            box-sizing: border-box;
            color: white;
            background: rgba(7, 18, 28, 0.94);
            font-family: Arial, Helvetica, sans-serif;
            text-align: center;
        }

        #super-start h1 {
            margin: 0;
            font-size: clamp(28px, 5vw, 54px);
            letter-spacing: 2px;
        }

        #super-start p {
            max-width: 580px;
            line-height: 1.8;
            color: #d3e1e9;
        }

        #super-start button {
            padding: 14px 24px;
            border: 0;
            border-radius: 8px;
            color: white;
            background: #1479e8;
            font-weight: bold;
            cursor: pointer;
        }

        #super-message {
            position: fixed;
            z-index: 110;
            left: 50%;
            bottom: 28px;
            transform: translateX(-50%);
            display: none;
            padding: 10px 16px;
            border-radius: 8px;
            color: white;
            background: rgba(0, 0, 0, 0.78);
            font: 14px Arial, sans-serif;
            text-align: center;
            pointer-events: none;
        }

        #super-camera-label {
            position: fixed;
            z-index: 110;
            left: 18px;
            top: 18px;
            display: none;
            padding: 12px 16px;
            border-radius: 8px;
            color: white;
            background: rgba(0, 0, 0, 0.8);
            font: 14px/1.8 Arial, sans-serif;
            pointer-events: none;
        }
    `;

    document.head.appendChild(estilo);

    const inicio = document.createElement('div');
    inicio.id = 'super-start';
    inicio.innerHTML = `
        <h1>SUPERMERCADO 3D</h1>
        <p>
            W A S D: moverte<br>
            Shift: correr · Espacio: saltar<br>
            L: día/noche · M: agregar carro<br>
            N: agregar ladrón · C: cámaras<br>
            Teclas 1-9: cámaras 1-9 · Tecla 0: cámara 10<br>
            C o Esc: salir de cámaras
        </p>
        <button id="super-enter">ENTRAR AL SUPERMERCADO</button>
    `;

    document.body.appendChild(inicio);

    const mensaje = document.createElement('div');
    mensaje.id = 'super-message';
    document.body.appendChild(mensaje);

    const etiquetaCamara = document.createElement('div');
    etiquetaCamara.id = 'super-camera-label';
    etiquetaCamara.textContent =
        'CÁMARAS DE SEGURIDAD | 1-9: cambiar | 0: cámara 10 | C o ESC: salir';
    document.body.appendChild(etiquetaCamara);

    document.getElementById('super-enter').addEventListener('click', () => {
        controles.lock();
    });
}

function mostrarMensaje(texto) {
    const elemento = document.getElementById('super-message');
    if (!elemento) return;

    elemento.textContent = texto;
    elemento.style.display = 'block';

    if (elemento._temporizador) {
        clearTimeout(elemento._temporizador);
    }

    elemento._temporizador = setTimeout(() => {
        elemento.style.display = 'none';
    }, 2200);
}

function ocultarPantallaInicio() {
    const pantalla = document.getElementById('super-start');
    if (pantalla) pantalla.style.display = 'none';
}

function mostrarPantallaInicio() {
    const pantalla = document.getElementById('super-start');

    if (pantalla && !camarasAbiertas) {
        pantalla.style.display = 'flex';
    }
}

// ============================================================
// CÁMARAS DE SEGURIDAD
// ============================================================

function entrarCamara(indice) {
    const config = CAMARAS_SEGURIDAD[indice];
    if (!config) return;

    if (!camarasAbiertas) {
        camaraAnteriorPosicion = camara.position.clone();
        camaraAnteriorQuaternion = camara.quaternion.clone();
    }

    camarasAbiertas = true;

    if (controles.isLocked) {
        controles.unlock();
    }

    camara.position.copy(config.posicion);
    camara.lookAt(config.objetivo);

    const etiqueta = document.getElementById('super-camera-label');

    if (etiqueta) {
        etiqueta.style.display = 'block';
        etiqueta.textContent =
            `${config.nombre} | 1-9: cambiar | 0: cámara 10 | C o ESC: salir`;
    }

    mostrarMensaje(config.nombre);
}

function salirDeCamaras() {
    if (!camarasAbiertas) return;

    camarasAbiertas = false;

    if (camaraAnteriorPosicion) {
        camara.position.copy(camaraAnteriorPosicion);
    }

    if (camaraAnteriorQuaternion) {
        camara.quaternion.copy(camaraAnteriorQuaternion);
    }

    camaraAnteriorPosicion = null;
    camaraAnteriorQuaternion = null;

    const etiqueta = document.getElementById('super-camera-label');
    if (etiqueta) etiqueta.style.display = 'none';

    if (!controles.isLocked) {
        controles.lock();
    }
}

// ============================================================
// EVENTOS DE TECLADO Y VENTANA
// ============================================================

function configurarEventos() {
    window.addEventListener('resize', () => {
        camara.aspect = window.innerWidth / window.innerHeight;
        camara.updateProjectionMatrix();

        renderizador.setSize(window.innerWidth, window.innerHeight);
        renderizador.setPixelRatio(
            Math.min(window.devicePixelRatio, CONFIG.pixelRatioMaximo)
        );
    });

    document.addEventListener('keydown', evento => {
        const tecla = evento.key.toLowerCase();

        if (tecla === 'escape' && camarasAbiertas) {
            salirDeCamaras();
            return;
        }

        if (evento.repeat) return;

        // Selección de cámaras: 1-9 y 0 para la cámara 10.
        // Se procesa antes de los controles normales del jugador.
        if (camarasAbiertas && /^[0-9]$/.test(tecla)) {
            const indice = tecla === '0'
                ? 9
                : Number(tecla) - 1;

            entrarCamara(indice);
            return;
        }

        if (tecla === 'l') {
            modoNoche = !modoNoche;
            actualizarIluminacion();
            mostrarMensaje(modoNoche ? 'Modo nocturno' : 'Modo diurno');
            return;
        }

        if (tecla === 'm') {
            if (
                sistemaVehiculos &&
                typeof sistemaVehiculos.solicitarLlegada === 'function'
            ) {
                sistemaVehiculos.solicitarLlegada();
                mostrarMensaje('Llegada de carro solicitada.');
            } else {
                console.warn(
                    'El sistema de vehículos no tiene solicitarLlegada().'
                );
                mostrarMensaje('Sistema de vehículos no disponible.');
            }
            return;
        }

        if (tecla === 'n') {
            agregarLadron();
            return;
        }

        if (tecla === 'c') {
            if (camarasAbiertas) {
                salirDeCamaras();
            } else {
                entrarCamara(0);
            }
            return;
        }

        if (camarasAbiertas) return;

        teclas[evento.code] = true;

        if (
            evento.code === 'Space' &&
            jugadorEnSuelo &&
            controles.isLocked
        ) {
            evento.preventDefault();
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
    if (!controles?.isLocked || camarasAbiertas) return;

    const velocidad = corriendo
        ? CONFIG.velocidadCorrer
        : CONFIG.velocidadCaminar;

    direccion.set(0, 0, 0);

    if (teclas.KeyW || teclas.ArrowUp) direccion.z += 1;
    if (teclas.KeyS || teclas.ArrowDown) direccion.z -= 1;
    if (teclas.KeyA || teclas.ArrowLeft) direccion.x -= 1;
    if (teclas.KeyD || teclas.ArrowRight) direccion.x += 1;

    if (direccion.lengthSq() > 0) {
        direccion.normalize();

        camara.getWorldDirection(vectorAdelante);
        vectorAdelante.y = 0;

        if (vectorAdelante.lengthSq() > 0) {
            vectorAdelante.normalize();
        }

        vectorDerecha
            .crossVectors(vectorAdelante, ejeVertical)
            .normalize();

        movimientoTemporal.set(0, 0, 0);
        movimientoTemporal.addScaledVector(vectorAdelante, direccion.z);
        movimientoTemporal.addScaledVector(vectorDerecha, direccion.x);

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

    if (controles.object.position.y <= CONFIG.alturaJugador) {
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
}

// ============================================================
// ACTUALIZACIÓN DE ENTIDADES
// ============================================================

function actualizarEntidades(delta) {
    if (
        sistemaVehiculos &&
        typeof sistemaVehiculos.actualizar === 'function'
    ) {
        sistemaVehiculos.actualizar(delta);
    }

    for (const cliente of clientesSupermercado) {
        if (
            cliente &&
            !cliente.eliminado &&
            typeof cliente.actualizar === 'function'
        ) {
            cliente.actualizar(delta);
        }
    }

    for (const carrito of carritosClientes) {
        if (carrito && typeof carrito.actualizar === 'function') {
            carrito.actualizar(delta);
        }
    }

    for (const ladron of ladrones) {
        if (ladron && typeof ladron.actualizar === 'function') {
            ladron.actualizar(delta);
        }
    }

    for (const visita of visitantesPorVehiculo.values()) {
        if (!visita.cliente || visita.cliente.eliminado) continue;

        visita.tiempo += delta;

        if (
            visita.fase === 'comprando' &&
            visita.tiempo >= tiempoCompraAuto
        ) {
            visita.fase = 'caja';
            visita.tiempo = 0;

            if (typeof visita.cliente.establecerRuta === 'function') {
                visita.cliente.establecerRuta([{ x: 0, z: 20 }]);
            }

            mostrarMensaje(`${visita.nombre} se dirige a cajas.`);
        } else if (
            visita.fase === 'caja' &&
            visita.tiempo >= tiempoCajaAuto
        ) {
            visita.fase = 'regresando';
            visita.tiempo = 0;

            mostrarMensaje(`${visita.nombre} regresa a su auto.`);

            if (
                typeof visita.cliente.iniciarRegresoVehiculo === 'function'
            ) {
                visita.cliente.iniciarRegresoVehiculo(
                    visita.plaza,
                    () => {
                        if (visita.carrito?.grupo) {
                            visita.carrito.grupo.visible = false;
                        }

                        if (visita.cliente?.grupo) {
                            visita.cliente.grupo.visible = false;
                        }

                        if (
                            sistemaVehiculos &&
                            typeof sistemaVehiculos.solicitarSalida === 'function'
                        ) {
                            const salida = sistemaVehiculos.solicitarSalida(
                                visita.id
                            );

                            if (salida === false) {
                                visita.cliente?.eliminar?.();
                                visita.carrito?.eliminar?.();
                                visitantesPorVehiculo.delete(visita.id);
                            }
                        }
                    }
                );
            } else {
                visita.cliente?.eliminar?.();
                visita.carrito?.eliminar?.();
                visitantesPorVehiculo.delete(visita.id);
            }
        }
    }
}

// ============================================================
// BUCLE PRINCIPAL
// ============================================================

function iniciarAnimacion() {
    renderizador.setAnimationLoop(() => {
        const delta = Math.min(reloj.getDelta(), 0.05);

        try {
            actualizarMovimiento(delta);
            actualizarEntidades(delta);
            renderizador.render(escena, camara);
        } catch (error) {
            console.error('Error durante la animación:', error);
        }
    });
}
