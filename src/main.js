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
    gravedad: 19,
    fuerzaSalto: 7,

    modeloLadron: '/modelos/ladron.glb',

    tiempoCompraAuto: 32,
    tiempoCajaAuto: 5,

    colorDia: 0xa9c9e8,
    colorNoche: 0x101827,

    limiteX: 30,
    limiteZMin: -27,
    limiteZMax: 27,

    pixelRatioMaximo: 1.0,
    intervaloHUD: 250
};

// ============================================================
// CONFIGURACIÓN DE CLIENTES
// ============================================================

const CONFIG_CLIENTES = [
    {
        nombre: 'Cliente1',
        modelo: '/modelos/cliente1.glb',
        ruta: [
            { x: -25, z: 8 },
            { x: -22, z: 5 },
            { x: -17, z: 0 },
            { x: -12, z: 5 },
            { x: -7, z: 8 }
        ]
    },
    {
        nombre: 'Cliente2',
        modelo: '/modelos/Cliente2.glb',
        ruta: [
            { x: -25, z: -5 },
            { x: -21, z: -10 },
            { x: -12, z: -16 },
            { x: -5, z: -12 }
        ]
    },
    {
        nombre: 'Cliente3',
        modelo: '/modelos/Cliente3.glb',
        ruta: [
            { x: 5, z: 8 },
            { x: 12, z: 5 },
            { x: 20, z: 7 },
            { x: 24, z: 3 }
        ]
    },
    {
        nombre: 'Cliente4',
        modelo: '/modelos/Cliente4.glb',
        ruta: [
            { x: 5, z: -5 },
            { x: 12, z: -8 },
            { x: 20, z: -12 },
            { x: 24, z: -5 }
        ]
    },
    {
        nombre: 'Clienta1',
        modelo: '/modelos/Clienta1.glb',
        ruta: [
            { x: -25, z: 18 },
            { x: -18, z: 18 },
            { x: -12, z: 13 },
            { x: -5, z: 16 }
        ]
    },
    {
        nombre: 'Clienta2',
        modelo: '/modelos/Clienta2.glb',
        ruta: [
            { x: 5, z: 17 },
            { x: 12, z: 17 },
            { x: 20, z: 18 },
            { x: 24, z: 15 }
        ]
    }
];

// ============================================================
// ESCENA
// ============================================================

const escena = new THREE.Scene();

escena.background = new THREE.Color(CONFIG.colorDia);
escena.fog = new THREE.Fog(0xc7d9e9, 65, 150);

// ============================================================
// CÁMARA
// ============================================================

const camara = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    500
);

camara.position.set(0, CONFIG.alturaJugador, 25);
camara.lookAt(0, CONFIG.alturaJugador, 10);

// ============================================================
// RENDERIZADOR OPTIMIZADO
// ============================================================

const renderizador = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance'
});

renderizador.setSize(
    window.innerWidth,
    window.innerHeight
);

renderizador.setPixelRatio(CONFIG.pixelRatioMaximo);

// Desactivar sombras en tiempo real para reducir la carga gráfica.
renderizador.shadowMap.enabled = false;

renderizador.toneMapping = THREE.ACESFilmicToneMapping;
renderizador.toneMappingExposure = 1.0;
renderizador.outputColorSpace = THREE.SRGBColorSpace;

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.appendChild(renderizador.domElement);

// ============================================================
// CONTROLES DEL JUGADOR
// ============================================================

const controles = new PointerLockControls(
    camara,
    renderizador.domElement
);

const jugador = {
    velocidadY: 0,
    enSuelo: true,
    moviendo: false,
    corriendo: false
};

const teclas = {
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
    ShiftLeft: false,
    ShiftRight: false,
    Space: false
};

let interfazCreada = false;
let modoNoche = false;
let camaraSeguridadActiva = false;
let numeroCamara = 1;

// ============================================================
// LUCES
// ============================================================

const luzAmbiente = new THREE.HemisphereLight(
    0xe5f1ff,
    0x6d6254,
    2.0
);

escena.add(luzAmbiente);

const luzSol = new THREE.DirectionalLight(
    0xfff0d6,
    3.0
);

luzSol.position.set(-25, 40, 20);
luzSol.castShadow = false;

escena.add(luzSol);

// ============================================================
// CONSTRUCCIÓN DEL SUPERMERCADO
// ============================================================

crearMercado(escena);

const mobiliario = crearMobiliario(escena);
const productos = crearProductosLacteos(escena);
const almacen = crearAlmacen(escena);
const estacionamiento = crearEstacionamiento(escena);

console.info('[MAIN] Supermercado creado.');
console.info('[MAIN] Mobiliario:', mobiliario);
console.info('[MAIN] Productos:', productos);
console.info('[MAIN] Almacén:', almacen);
console.info('[MAIN] Estacionamiento:', estacionamiento);

// ============================================================
// TERRENO EXTERIOR
// ============================================================

const terreno = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({
        color: 0x687c59,
        roughness: 1
    })
);

terreno.rotation.x = -Math.PI / 2;
terreno.position.y = -0.08;
terreno.receiveShadow = false;

escena.add(terreno);

// ============================================================
// CARRETERA
// ============================================================

const carretera = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 150),
    new THREE.MeshStandardMaterial({
        color: 0x34383d,
        roughness: 0.95
    })
);

carretera.rotation.x = -Math.PI / 2;
carretera.position.set(0, -0.045, 95);
carretera.receiveShadow = false;

escena.add(carretera);

const materialLinea = new THREE.MeshStandardMaterial({
    color: 0xe9e2c9,
    roughness: 0.8
});

const geometriaLinea = new THREE.BoxGeometry(
    0.18,
    0.025,
    3.5
);

for (let z = 35; z < 160; z += 8) {
    const linea = new THREE.Mesh(
        geometriaLinea,
        materialLinea
    );

    linea.position.set(0, -0.01, z);
    linea.castShadow = false;
    linea.receiveShadow = false;

    escena.add(linea);
}

// ============================================================
// INTERFAZ
// ============================================================

function crearInterfaz() {
    if (interfazCreada) return;

    interfazCreada = true;

    const estilo = document.createElement('style');

    estilo.textContent = `
        #hud-supermercado {
            position: fixed;
            inset: 0;
            pointer-events: none;
            color: white;
            font-family: Arial, sans-serif;
            z-index: 10;
        }

        #panel-superior {
            position: absolute;
            top: 14px;
            left: 14px;
            padding: 12px 16px;
            background: rgba(10, 18, 28, .78);
            border: 1px solid rgba(255,255,255,.2);
            border-radius: 10px;
            line-height: 1.7;
            font-size: 13px;
        }

        #panel-derecho {
            position: absolute;
            top: 14px;
            right: 14px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            align-items: flex-end;
            pointer-events: auto;
        }

        .boton-supermercado {
            color: white;
            background: rgba(20, 30, 42, .92);
            border: 1px solid rgba(255,255,255,.25);
            border-radius: 8px;
            padding: 10px 13px;
            cursor: pointer;
            font-weight: 600;
        }

        .boton-supermercado:hover {
            background: #247a55;
        }

        #mensaje-centro {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            padding: 24px;
            background: rgba(8, 15, 24, .9);
            border: 1px solid rgba(255,255,255,.2);
            border-radius: 14px;
            width: min(420px, 85vw);
            pointer-events: auto;
        }

        #mensaje-centro h2 {
            margin-top: 0;
        }

        #mensaje-centro button {
            margin-top: 12px;
            padding: 12px 18px;
            color: white;
            background: #198754;
            border: 0;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
        }

        #mensaje-centro.oculto {
            display: none;
        }

        #punto-mira {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 5px;
            height: 5px;
            transform: translate(-50%, -50%);
            border-radius: 50%;
            background: white;
            box-shadow: 0 0 4px black;
        }

        #estado-supermercado {
            position: absolute;
            left: 50%;
            bottom: 18px;
            transform: translateX(-50%);
            background: rgba(10,18,28,.8);
            padding: 8px 12px;
            border-radius: 7px;
            font-size: 12px;
            white-space: nowrap;
        }
    `;

    document.head.appendChild(estilo);

    const hud = document.createElement('div');
    hud.id = 'hud-supermercado';

    hud.innerHTML = `
        <div id="panel-superior">
            <strong>SUPERMERCADO 3D</strong><br>
            WASD: moverse<br>
            Shift: correr<br>
            Espacio: saltar<br>
            Esc: liberar cámara<br>
            L: día/noche<br>
            1-6: cámaras de seguridad<br>
            C: volver a la entrada
        </div>

        <div id="panel-derecho">
            <button class="boton-supermercado" id="btn-dia">
                Cambiar día/noche
            </button>
            <button class="boton-supermercado" id="btn-entrada">
                Volver a entrada
            </button>
            <button class="boton-supermercado" id="btn-camara">
                Salir de cámaras
            </button>
        </div>

        <div id="punto-mira"></div>

        <div id="estado-supermercado">
            Preparando supermercado...
        </div>

        <div id="mensaje-centro">
            <h2>SUPERMERCADO 3D</h2>
            <p>Explora los pasillos, observa los productos y visita el estacionamiento.</p>
            <button id="btn-entrar">ENTRAR AL SUPERMERCADO</button>
        </div>
    `;

    document.body.appendChild(hud);

    document.getElementById('btn-entrar').addEventListener(
        'click',
        () => controles.lock()
    );

    document.getElementById('btn-dia').addEventListener(
        'click',
        cambiarDiaNoche
    );

    document.getElementById('btn-entrada').addEventListener(
        'click',
        volverEntrada
    );

    document.getElementById('btn-camara').addEventListener(
        'click',
        salirCamaraSeguridad
    );

    controles.addEventListener('lock', () => {
        document.getElementById('mensaje-centro')
            ?.classList.add('oculto');
    });

    controles.addEventListener('unlock', () => {
        document.getElementById('mensaje-centro')
            ?.classList.remove('oculto');
    });
}

crearInterfaz();

// ============================================================
// DÍA Y NOCHE
// ============================================================

function cambiarDiaNoche() {
    modoNoche = !modoNoche;

    if (modoNoche) {
        escena.background.setHex(CONFIG.colorNoche);
        escena.fog.color.setHex(CONFIG.colorNoche);

        luzAmbiente.intensity = 0.45;
        luzSol.intensity = 0.35;

        renderizador.toneMappingExposure = 0.8;
    } else {
        escena.background.setHex(CONFIG.colorDia);
        escena.fog.color.setHex(0xc7d9e9);

        luzAmbiente.intensity = 2.0;
        luzSol.intensity = 3.0;

        renderizador.toneMappingExposure = 1.0;
    }
}

// ============================================================
// REGRESO A LA ENTRADA
// ============================================================

function volverEntrada() {
    camaraSeguridadActiva = false;

    camara.position.set(
        0,
        CONFIG.alturaJugador,
        25
    );

    camara.rotation.set(0, 0, 0);

    if (controles.isLocked) {
        controles.unlock();
    }
}

// ============================================================
// CÁMARAS DE SEGURIDAD
// ============================================================

const CAMARAS_SEGURIDAD = [
    { x: -29, y: 5.5, z: 17, mirarX: -15, mirarZ: 8 },
    { x: 29, y: 5.5, z: 17, mirarX: 15, mirarZ: 8 },
    { x: -29, y: 5.5, z: -10, mirarX: -15, mirarZ: -10 },
    { x: 29, y: 5.5, z: -10, mirarX: 15, mirarZ: -10 },
    { x: -20, y: 5.1, z: -28, mirarX: -10, mirarZ: -15 },
    { x: 0, y: 5.8, z: 53, mirarX: 0, mirarZ: 25 }
];

const camaraJugador = {
    posicion: new THREE.Vector3(),
    quaternion: new THREE.Quaternion()
};

function activarCamaraSeguridad(numero) {
    const datos = CAMARAS_SEGURIDAD[numero - 1];

    if (!datos) return;

    if (!camaraSeguridadActiva) {
        camaraJugador.posicion.copy(camara.position);
        camaraJugador.quaternion.copy(camara.quaternion);
    }

    camaraSeguridadActiva = true;
    numeroCamara = numero;

    camara.position.set(datos.x, datos.y, datos.z);
    camara.lookAt(datos.mirarX, 1.4, datos.mirarZ);

    if (controles.isLocked) {
        controles.unlock();
    }
}

function salirCamaraSeguridad() {
    if (!camaraSeguridadActiva) return;

    camaraSeguridadActiva = false;

    camara.position.copy(camaraJugador.posicion);
    camara.quaternion.copy(camaraJugador.quaternion);
}

// ============================================================
// ENTRADAS DE TECLADO
// ============================================================

document.addEventListener('keydown', evento => {
    if (evento.code in teclas) {
        teclas[evento.code] = true;
    }

    if (evento.code === 'KeyL') {
        cambiarDiaNoche();
    }

    if (evento.code === 'KeyC') {
        volverEntrada();
    }

    if (/^Digit[1-6]$/.test(evento.code)) {
        activarCamaraSeguridad(
            Number(evento.code.replace('Digit', ''))
        );
    }

    if (evento.code === 'Escape') {
        salirCamaraSeguridad();
    }
});

document.addEventListener('keyup', evento => {
    if (evento.code in teclas) {
        teclas[evento.code] = false;
    }
});

// ============================================================
// MOVIMIENTO DEL JUGADOR
// ============================================================

function jugadorPuedeMoverse(x, z) {
    return (
        x >= -31 &&
        x <= 31 &&
        z >= -29 &&
        z <= 110
    );
}

function actualizarJugador(delta) {
    if (!controles.isLocked || camaraSeguridadActiva) {
        return;
    }

    const dt = Math.min(delta, 0.05);

    const direccion = new THREE.Vector3();
    const adelante = new THREE.Vector3();

    camara.getWorldDirection(adelante);
    adelante.y = 0;
    adelante.normalize();

    const derecha = new THREE.Vector3()
        .crossVectors(adelante, camara.up)
        .normalize()
        .negate();

    if (teclas.KeyW) direccion.add(adelante);
    if (teclas.KeyS) direccion.sub(adelante);
    if (teclas.KeyD) direccion.add(derecha);
    if (teclas.KeyA) direccion.sub(derecha);

    jugador.moviendo = direccion.lengthSq() > 0;

    jugador.corriendo =
        teclas.ShiftLeft || teclas.ShiftRight;

    if (jugador.moviendo) {
        direccion.normalize();

        const velocidad = jugador.corriendo
            ? CONFIG.velocidadCorrer
            : CONFIG.velocidadCaminar;

        const paso = velocidad * dt;

        const nx = camara.position.x + direccion.x * paso;
        const nz = camara.position.z + direccion.z * paso;

        if (jugadorPuedeMoverse(nx, camara.position.z)) {
            camara.position.x = nx;
        }

        if (jugadorPuedeMoverse(camara.position.x, nz)) {
            camara.position.z = nz;
        }
    }

    if (teclas.Space && jugador.enSuelo) {
        jugador.velocidadY = CONFIG.fuerzaSalto;
        jugador.enSuelo = false;
    }

    jugador.velocidadY -= CONFIG.gravedad * dt;
    camara.position.y += jugador.velocidadY * dt;

    if (camara.position.y <= CONFIG.alturaJugador) {
        camara.position.y = CONFIG.alturaJugador;
        jugador.velocidadY = 0;
        jugador.enSuelo = true;
    }
}

// ============================================================
// CARRITOS Y CLIENTES
// ============================================================

const visitantes = new Map();
const carritosCreados = [];

let siguienteModeloCliente = 0;

function crearCarritoVisitante(posicion) {
    let resultado = null;

    try {
        resultado = crearCarrito(escena, {
            posicion: {
                x: posicion.x,
                y: 0,
                z: posicion.z
            },
            escala: 1
        });
    } catch (error) {
        console.warn(
            '[MAIN] No se pudo crear el carrito.',
            error
        );
    }

    let grupoCarrito = resultado?.grupo;

    if (resultado?.isObject3D) {
        grupoCarrito = resultado;
    }

    if (!grupoCarrito?.isObject3D) {
        grupoCarrito = new THREE.Group();
        grupoCarrito.name = 'CARRITO_VISITANTE_FALLBACK';

        const materialMetal = new THREE.MeshStandardMaterial({
            color: 0x9da9b1,
            metalness: 0.65,
            roughness: 0.35
        });

        const cesta = new THREE.Mesh(
            new THREE.BoxGeometry(0.65, 0.32, 0.48),
            materialMetal
        );

        cesta.position.y = 0.75;
        grupoCarrito.add(cesta);

        const manija = new THREE.Mesh(
            new THREE.BoxGeometry(0.62, 0.05, 0.06),
            materialMetal
        );

        manija.position.set(0, 0.96, -0.28);
        grupoCarrito.add(manija);

        const materialRueda = new THREE.MeshStandardMaterial({
            color: 0x25282c
        });

        for (const x of [-0.25, 0.25]) {
            for (const z of [-0.17, 0.17]) {
                const rueda = new THREE.Mesh(
                    new THREE.CylinderGeometry(
                        0.055,
                        0.055,
                        0.045,
                        8
                    ),
                    materialRueda
                );

                rueda.rotation.z = Math.PI / 2;
                rueda.position.set(x, 0.12, z);

                grupoCarrito.add(rueda);
            }
        }

        escena.add(grupoCarrito);
    }

    grupoCarrito.position.set(
        posicion.x,
        0,
        posicion.z
    );

    grupoCarrito.visible = true;

    const carritoAPI = {
        grupo: grupoCarrito,
        original: resultado,

        eliminar() {
            if (resultado?.eliminar) {
                resultado.eliminar();
            } else if (grupoCarrito.parent) {
                grupoCarrito.parent.remove(grupoCarrito);
            }
        }
    };

    carritosCreados.push(carritoAPI);

    return carritoAPI;
}

function crearClienteParaVehiculo(datos) {
    if (!datos?.plaza || !datos?.grupo) {
        console.warn(
            '[MAIN] El vehículo no entregó plaza o grupo.',
            datos
        );
        return;
    }

    const configCliente =
        CONFIG_CLIENTES[
            siguienteModeloCliente % CONFIG_CLIENTES.length
        ];

    siguienteModeloCliente++;

    const plaza = {
        x: Number(datos.plaza.x),
        z: Number(datos.plaza.z)
    };

    const posicion = {
        x: plaza.x,
        y: 0,
        z: plaza.z
    };

    const idVehiculo = datos.id;

    const carrito = crearCarritoVisitante({
        x: posicion.x + 1.1,
        z: posicion.z
    });

    const visita = {
        id: idVehiculo,
        plaza,
        carrito,
        cliente: null,
        tiempoCompra: 0,
        tiempoCaja: 0,
        fase: 'creando',
        resumen: null
    };

    visitantes.set(idVehiculo, visita);

    const cliente = crearClienteSupermercado(escena, {
        modelo: configCliente.modelo,
        posicion,
        escala: 1,
        velocidad: 1.5,
        ruta: configCliente.ruta,
        inactivo: true,

        alEntrar: clienteEntrado => {
            visita.fase = 'comprando';
            visita.tiempoCompra = 0;

            console.info(
                `[CLIENTES] ${configCliente.nombre} entró al supermercado.`
            );

            clienteEntrado.configurarCompras({
                productos,
                carrito
            });
        }
    });

    visita.cliente = cliente;

    cliente.configurarCompras({
        productos,
        carrito
    });

    cliente.iniciarDesdeVehiculo?.(posicion, plaza);

    visita.fase = 'entrando';

    console.info(
        `[CLIENTES] Creado ${configCliente.nombre} para el auto ${idVehiculo}.`,
        configCliente.modelo
    );
}

// ============================================================
// SISTEMA DE VEHÍCULOS
// ============================================================

let sistemaVehiculos = null;

function crearSistemaVehiculos() {
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
        separacionInicial: 7,

        alEstacionar: datos => {
            crearClienteParaVehiculo(datos);
        },

        alSalir: datos => {
            const visita = visitantes.get(datos.id);

            if (!visita) return;

            visita.cliente?.eliminar?.();
            visita.carrito?.eliminar?.();

            visitantes.delete(datos.id);

            console.info(
                `[CLIENTES] Visita terminada para el auto ${datos.id}.`
            );
        }
    });

    console.info('[MAIN] Sistema de vehículos iniciado.');
}

crearSistemaVehiculos();

// ============================================================
// CICLO DE COMPRA Y REGRESO AL AUTO
// ============================================================

function iniciarSalidaVisitante(visita) {
    if (!visita || visita.fase === 'regresando') {
        return;
    }

    const cliente = visita.cliente;

    if (!cliente || cliente.eliminado) {
        sistemaVehiculos?.solicitarSalida?.(visita.id);
        return;
    }

    const resumen = cliente.obtenerResumenCompra?.();

    if (resumen?.cantidadArticulos > 0) {
        visita.resumen = cliente.confirmarCompra?.();

        console.info(
            `[CAJA] Compra del cliente ${cliente.id}:`,
            visita.resumen
        );
    }

    visita.fase = 'regresando';

    const iniciado = cliente.iniciarRegresoVehiculo?.(
        visita.plaza,
        () => {
            visita.fase = 'esperandoSalida';

            sistemaVehiculos?.solicitarSalida?.(visita.id);
        }
    );

    if (!iniciado) {
        sistemaVehiculos?.solicitarSalida?.(visita.id);
    }
}

function actualizarVisitantes(delta) {
    for (const visita of visitantes.values()) {
        if (!visita.cliente || visita.cliente.eliminado) {
            continue;
        }

        visita.cliente.actualizar(delta);

        if (visita.fase === 'comprando') {
            visita.tiempoCompra += delta;

            if (visita.tiempoCompra >= CONFIG.tiempoCompraAuto) {
                visita.fase = 'caja';
                visita.tiempoCaja = 0;

                console.info(
                    `[CAJA] Cliente ${visita.cliente.id} se dirige a pagar.`
                );
            }
        } else if (visita.fase === 'caja') {
            visita.tiempoCaja += delta;

            if (visita.tiempoCaja >= CONFIG.tiempoCajaAuto) {
                iniciarSalidaVisitante(visita);
            }
        }
    }
}

// ============================================================
// SISTEMA DE LADRONES
// ============================================================

let sistemaLadrones = null;

function crearSistemaLadrones() {
    try {
        sistemaLadrones = crearLadron(escena, {
            modelo: CONFIG.modeloLadron,

            modelos: [
                '/modelos/ladron.glb',
                '/modelos/ladron1.glb',
                '/modelos/ladron2.glb'
            ],

            productos,
            velocidad: 1.6
        });

        console.info('[MAIN] Sistema de ladrones inicializado.');
    } catch (error) {
        console.error(
            '[MAIN] No se pudo iniciar el sistema de ladrones. Revisa ladron.js.',
            error
        );
    }
}

crearSistemaLadrones();

// ============================================================
// HUD OPTIMIZADO
// ============================================================

let acumuladoHUD = 0;

function actualizarHUD() {
    const elemento = document.getElementById(
        'estado-supermercado'
    );

    if (!elemento) return;

    const clientesActivos = visitantes.size;
    const coches = sistemaVehiculos?.cantidad ?? 0;
    const plazasLibres = sistemaVehiculos?.plazasLibres ?? 0;

    elemento.textContent =
        `${modoNoche ? 'Noche' : 'Día'} | ` +
        `Vehículos: ${coches} | ` +
        `Visitantes: ${clientesActivos} | ` +
        `Plazas libres: ${plazasLibres}` +
        (
            camaraSeguridadActiva
                ? ` | Cámara ${numeroCamara}`
                : ''
        );
}

// ============================================================
// BUCLE PRINCIPAL
// ============================================================

const reloj = new THREE.Clock();

function animar() {
    const delta = Math.min(reloj.getDelta(), 0.05);

    actualizarJugador(delta);

    sistemaVehiculos?.actualizar?.(delta);
    actualizarVisitantes(delta);

    sistemaLadrones?.actualizar?.(delta);
    sistemaLadrones?.sistema?.actualizar?.(delta);

    acumuladoHUD += delta;

    if (acumuladoHUD >= CONFIG.intervaloHUD) {
        acumuladoHUD = 0;
        actualizarHUD();
    }

    renderizador.render(escena, camara);
}

renderizador.setAnimationLoop(animar);

// ============================================================
// CAMBIO DE TAMAÑO DE VENTANA
// ============================================================

window.addEventListener('resize', () => {
    camara.aspect = window.innerWidth / window.innerHeight;
    camara.updateProjectionMatrix();

    renderizador.setSize(
        window.innerWidth,
        window.innerHeight
    );

    // Mantener la resolución en 1.0.
    renderizador.setPixelRatio(CONFIG.pixelRatioMaximo);
});

// ============================================================
// ERRORES GLOBALES
// ============================================================

window.addEventListener('error', evento => {
    console.error(
        '[MAIN] Error JavaScript:',
        evento.error || evento.message
    );
});

window.addEventListener('unhandledrejection', evento => {
    console.error(
        '[MAIN] Promesa rechazada:',
        evento.reason
    );
});

console.info('[MAIN] Aplicación lista.');
