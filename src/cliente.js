import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// ESTADOS
// ============================================================

const ESTADOS = {
    INACTIVO: 'INACTIVO',
    ENTRANDO: 'ENTRANDO',
    BUSCANDO: 'BUSCANDO',
    ACERCANDO: 'ACERCANDO',
    RECOGIENDO: 'RECOGIENDO',
    INSPECCIONANDO: 'INSPECCIONANDO',
    GUARDANDO: 'GUARDANDO',
    DEVOLVIENDO: 'DEVOLVIENDO',
    CAJA: 'CAJA',
    PAGANDO: 'PAGANDO',
    SALIENDO: 'SALIENDO',
    FINALIZADO: 'FINALIZADO'
};

// ============================================================
// CONFIGURACIÓN
// ============================================================

const CONFIG_BASE = {
    modelo: '/modelos/Cliente1.glb',
    posicion: { x: 0, y: 0, z: 20 },

    escala: 1,
    correccionRotacion: 0,

    velocidad: 1.8,
    velocidadEntrada: 2,
    velocidadSalida: 2,
    velocidadGiro: 8,

    limiteX: 29,
    limiteZMin: -27,
    limiteZMax: 55,

    radioColision: 0.36,
    margenObstaculos: 0.18,
    tamanoCelda: 0.65,

    puertaCentroX: 0,
    puertaAncho: 8.5,
    puertaZInterior: 27.5,
    puertaZUmbral: 29,
    puertaZExterior: 31.5,

    productos: null,
    mobiliario: null,
    colisiones: null,

    carrito: null,
    crearCarrito: null,
    distanciaCarrito: 1.15,
    suavizadoCarrito: 6,

    puntosCompra: [],
    rutaPersonalizada: null,

    puntoEntrada: { x: 0, z: 31.5 },
    puntoCaja: { x: 0, z: 22.5 },
    puntoSalida: { x: 0, z: 34 },

    probabilidadCompra: 0.85,
    probabilidadDevolver: 0.15,
    probabilidadDejarEnOtroRack: 0.22,

    radioBusquedaProducto: 3.5,
    distanciaProducto: 1.35,
    distanciaLlegada: 0.18,
    distanciaWaypoint: 0.30,
    distanciaAcercamiento: 1.15,

    tiempoAcercamiento: 0.35,
    tiempoRecoger: 1.3,
    tiempoExaminar: 2.5,
    tiempoGuardar: 1.3,
    tiempoDevolver: 1.5,
    tiempoPago: 4,
    tiempoEntreProductos: 0.6,

    maximoProductos: 4,

    escalaProductoMano: 0.65,
    offsetProductoMano: {
        x: 0,
        y: 1.15,
        z: 0.32
    },

    alturaMovimientoProducto: 0.12,

    usarAnimacionesGLB: true,
    velocidadAnimacion: 1,

    intervaloActualizarObstaculos: 2,
    intervaloRecalculoRuta: 0.6,
    maxIteracionesAStar: 4500,
    deltaMaximo: 0.05,

    eliminarAlSalir: false,
    eliminarCarritoAlEliminar: false,
    autoIniciar: true,
    inactivo: false,

    alEntrar: null,
    alComprar: null,
    alPagar: null,
    alFinalizar: null,
    alCambiarEstado: null
};

// ============================================================
// VARIABLES GLOBALES
// ============================================================

const loaderGLTF = new GLTFLoader();
let siguienteIdCliente = 1;

// ============================================================
// UTILIDADES
// ============================================================

function limitar(valor, minimo, maximo) {
    return Math.max(minimo, Math.min(maximo, valor));
}

function numero(valor, defecto = 0) {
    return Number.isFinite(valor) ? valor : defecto;
}

function distanciaXZ(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
}

function normalizarNombre(nombre) {
    return String(nombre ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[\s_-]/g, '');
}

function suavizar(a, b, t) {
    return a + (b - a) * limitar(t, 0, 1);
}

function crearVector(valor, defecto = { x: 0, y: 0, z: 0 }) {
    return new THREE.Vector3(
        numero(valor?.x, defecto.x),
        numero(valor?.y, defecto.y),
        numero(valor?.z, defecto.z)
    );
}

// ============================================================
// COLA DE PRIORIDAD A*
// ============================================================

class MinHeap {
    constructor() {
        this.items = [];
    }

    get size() {
        return this.items.length;
    }

    push(elemento) {
        this.items.push(elemento);

        let i = this.items.length - 1;

        while (i > 0) {
            const padre = Math.floor((i - 1) / 2);

            if (
                this.items[padre].prioridad <=
                this.items[i].prioridad
            ) {
                break;
            }

            [this.items[padre], this.items[i]] =
                [this.items[i], this.items[padre]];

            i = padre;
        }
    }

    pop() {
        if (!this.items.length) return null;

        const minimo = this.items[0];
        const ultimo = this.items.pop();

        if (this.items.length) {
            this.items[0] = ultimo;

            let i = 0;

            while (true) {
                const izquierda = i * 2 + 1;
                const derecha = i * 2 + 2;
                let menor = i;

                if (
                    izquierda < this.items.length &&
                    this.items[izquierda].prioridad <
                    this.items[menor].prioridad
                ) {
                    menor = izquierda;
                }

                if (
                    derecha < this.items.length &&
                    this.items[derecha].prioridad <
                    this.items[menor].prioridad
                ) {
                    menor = derecha;
                }

                if (menor === i) break;

                [this.items[i], this.items[menor]] =
                    [this.items[menor], this.items[i]];

                i = menor;
            }
        }

        return minimo;
    }
}

// ============================================================
// CREAR CLIENTE
// ============================================================

export function crearClienteSupermercado(scene, opciones = {}) {
    const config = {
        ...CONFIG_BASE,
        ...opciones,

        posicion: {
            ...CONFIG_BASE.posicion,
            ...(opciones.posicion ?? {})
        },

        offsetProductoMano: {
            ...CONFIG_BASE.offsetProductoMano,
            ...(opciones.offsetProductoMano ?? {})
        },

        puntoEntrada: {
            ...CONFIG_BASE.puntoEntrada,
            ...(opciones.puntoEntrada ?? {})
        },

        puntoCaja: {
            ...CONFIG_BASE.puntoCaja,
            ...(opciones.puntoCaja ?? {})
        },

        puntoSalida: {
            ...CONFIG_BASE.puntoSalida,
            ...(opciones.puntoSalida ?? {})
        }
    };

    const id = siguienteIdCliente++;

    const grupo = new THREE.Group();
    grupo.name = `CLIENTE_${id}`;

    grupo.position.set(
        numero(config.posicion.x),
        numero(config.posicion.y),
        numero(config.posicion.z)
    );

    scene.add(grupo);

    // ========================================================
    // VARIABLES DEL CLIENTE
    // ========================================================

    let modelo = null;
    let mixer = null;

    let accionesAnimacion = {};
    let accionActual = null;

    let huesos = {};

    let cargado = false;
    let eliminado = false;

    let estado = config.inactivo
        ? ESTADOS.INACTIVO
        : ESTADOS.ENTRANDO;

    let tiempoEstado = 0;
    let tiempoActualizarObstaculos = 0;
    let tiempoRecalculoRuta = 0;

    let rutaActual = [];
    let indiceRuta = 0;

    let rutaCompra = [];
    let indiceCompra = 0;

    let destinoActual = new THREE.Vector3();

    let obstaculosCache = [];

    let carritoCliente = config.carrito ?? null;

    let productoObjetivo = null;
    let productoEnMano = null;
    let productoOriginal = null;

    let productosComprados = [];
    let productosExaminados = new Set();

    let totalCompra = 0;

    let animacionProducto = {
        activa: false,
        tipo: null,
        tiempo: 0,
        duracion: 1,

        posicionInicial: new THREE.Vector3(),
        posicionFinal: new THREE.Vector3(),

        quaternionInicial: new THREE.Quaternion(),
        quaternionFinal: new THREE.Quaternion(),

        escalaInicial: new THREE.Vector3(1, 1, 1),
        escalaFinal: new THREE.Vector3(1, 1, 1)
    };

    let animacionProcedural = {
        tiempo: 0
    };

    let velocidadActual = 0;

    const vectorTemporal = new THREE.Vector3();
    const vectorTemporal2 = new THREE.Vector3();

    const quaternionTemporal = new THREE.Quaternion();

    // ========================================================
    // ESTADOS
    // ========================================================

    function cambiarEstado(nuevoEstado) {
        if (estado === nuevoEstado || eliminado) return;

        const anterior = estado;
        estado = nuevoEstado;
        tiempoEstado = 0;

        if (typeof config.alCambiarEstado === 'function') {
            config.alCambiarEstado({
                cliente: api,
                id,
                anterior,
                estado: nuevoEstado
            });
        }

        const caminando = [
            ESTADOS.ENTRANDO,
            ESTADOS.BUSCANDO,
            ESTADOS.ACERCANDO,
            ESTADOS.CAJA,
            ESTADOS.SALIENDO
        ].includes(nuevoEstado);

        if (caminando) {
            reproducirAnimacion('walk');
        } else {
            reproducirAnimacion('idle');
        }
    }

    // ========================================================
    // DETECTAR HUESOS
    // ========================================================

    function buscarHueso(nombres) {
        if (!modelo) return null;

        const lista = Array.isArray(nombres)
            ? nombres
            : [nombres];

        const buscados = lista.map(normalizarNombre);

        let resultado = null;

        modelo.traverse(objeto => {
            if (resultado) return;

            if (buscados.includes(normalizarNombre(objeto.name))) {
                resultado = objeto;
            }
        });

        return resultado;
    }

    function detectarHuesos() {
        huesos = {
            cadera: buscarHueso(['Hips', 'Pelvis']),
            columna: buscarHueso(['Spine', 'Spine1']),
            pecho: buscarHueso(['Chest', 'Spine2']),
            cuello: buscarHueso(['Neck']),
            cabeza: buscarHueso(['Head']),

            brazoDerecho: buscarHueso([
                'RightArm', 'UpperArm_R', 'mixamorigRightArm'
            ]),

            antebrazoDerecho: buscarHueso([
                'RightForeArm', 'LowerArm_R', 'mixamorigRightForeArm'
            ]),

            manoDerecha: buscarHueso([
                'RightHand', 'Hand_R', 'mixamorigRightHand'
            ]),

            brazoIzquierdo: buscarHueso([
                'LeftArm', 'UpperArm_L', 'mixamorigLeftArm'
            ]),

            antebrazoIzquierdo: buscarHueso([
                'LeftForeArm', 'LowerArm_L', 'mixamorigLeftForeArm'
            ]),

            manoIzquierda: buscarHueso([
                'LeftHand', 'Hand_L', 'mixamorigLeftHand'
            ]),

            piernaDerecha: buscarHueso([
                'RightUpLeg', 'UpperLeg_R', 'mixamorigRightUpLeg'
            ]),

            piernaIzquierda: buscarHueso([
                'LeftUpLeg', 'UpperLeg_L', 'mixamorigLeftUpLeg'
            ])
        };
    }

    // ========================================================
    // AJUSTAR MODELO
    // ========================================================

    function ajustarModelo() {
        if (!modelo) return;

        modelo.updateMatrixWorld(true);

        const caja = new THREE.Box3().setFromObject(modelo);

        if (caja.isEmpty()) return;

        const centro = new THREE.Vector3();
        caja.getCenter(centro);

        modelo.position.x -= centro.x;
        modelo.position.z -= centro.z;
        modelo.position.y -= caja.min.y;

        modelo.updateMatrixWorld(true);
    }

    // ========================================================
    // ANIMACIONES GLB
    // ========================================================

    function configurarAnimaciones(animaciones = []) {
        if (
            !modelo ||
            !config.usarAnimacionesGLB ||
            !animaciones.length
        ) {
            return;
        }

        mixer = new THREE.AnimationMixer(modelo);
        accionesAnimacion = {};

        for (const clip of animaciones) {
            const clave = normalizarNombre(clip.name);
            const accion = mixer.clipAction(clip);

            accion.enabled = true;
            accion.setEffectiveTimeScale(
                numero(config.velocidadAnimacion, 1)
            );

            accionesAnimacion[clave] = accion;
        }

        reproducirAnimacion('idle');
    }

    function buscarAccion(nombre) {
        const clave = normalizarNombre(nombre);

        if (accionesAnimacion[clave]) {
            return accionesAnimacion[clave];
        }

        const coincidencia = Object.keys(accionesAnimacion).find(
            nombreAnimacion => nombreAnimacion.includes(clave)
        );

        return coincidencia
            ? accionesAnimacion[coincidencia]
            : null;
    }

    function reproducirAnimacion(nombre) {
        if (!mixer) return false;

        const accion = buscarAccion(nombre);

        if (!accion || accion === accionActual) {
            return Boolean(accion);
        }

        if (accionActual) {
            accionActual.fadeOut(0.18);
        }

        accion.reset();
        accion.enabled = true;
        accion.setEffectiveWeight(1);
        accion.setEffectiveTimeScale(
            numero(config.velocidadAnimacion, 1)
        );

        accion.fadeIn(0.18);
        accion.play();

        accionActual = accion;

        return true;
    }

    // ========================================================
    // ANIMACIÓN PROCEDURAL BÁSICA
    // ========================================================

    function actualizarAnimacionProcedural(delta) {
        if (!modelo || mixer) return;

        animacionProcedural.tiempo += delta;

        const caminando = velocidadActual > 0.05;
        const fase = animacionProcedural.tiempo * 8;

        const amplitud = caminando ? 0.42 : 0.025;

        const balanceo = Math.sin(fase) * amplitud;
        const balanceoContrario = Math.sin(fase + Math.PI) * amplitud;

        if (huesos.brazoDerecho) {
            huesos.brazoDerecho.rotation.x = suavizar(
                huesos.brazoDerecho.rotation.x,
                balanceoContrario * 0.65,
                delta * 7
            );
        }

        if (huesos.brazoIzquierdo) {
            huesos.brazoIzquierdo.rotation.x = suavizar(
                huesos.brazoIzquierdo.rotation.x,
                balanceo * 0.65,
                delta * 7
            );
        }

        if (huesos.piernaDerecha) {
            huesos.piernaDerecha.rotation.x = suavizar(
                huesos.piernaDerecha.rotation.x,
                balanceo,
                delta * 7
            );
        }

        if (huesos.piernaIzquierda) {
            huesos.piernaIzquierda.rotation.x = suavizar(
                huesos.piernaIzquierda.rotation.x,
                balanceoContrario,
                delta * 7
            );
        }
    }

    function actualizarAnimaciones(delta) {
        if (mixer) mixer.update(delta);

        actualizarAnimacionProcedural(delta);
    }

    // ========================================================
    // CARGAR MODELO GLB
    // ========================================================

    function cargarModelo() {
        loaderGLTF.load(
            config.modelo,

            gltf => {
                if (eliminado) return;

                modelo = gltf.scene;
                modelo.name = `MODELO_CLIENTE_${id}`;

                modelo.scale.setScalar(
                    numero(config.escala, 1)
                );

                modelo.traverse(objeto => {
                    if (!objeto.isMesh) return;

                    objeto.castShadow = false;
                    objeto.receiveShadow = false;
                    objeto.frustumCulled = true;
                });

                grupo.add(modelo);

                ajustarModelo();
                detectarHuesos();
                configurarAnimaciones(gltf.animations);

                cargado = true;

                if (config.inactivo) {
                    cambiarEstado(ESTADOS.INACTIVO);
                } else {
                    cambiarEstado(ESTADOS.ENTRANDO);

                    if (typeof config.alEntrar === 'function') {
                        config.alEntrar(api);
                    }

                    if (config.puntoEntrada) {
                        asignarRuta(
                            new THREE.Vector3(
                                config.puntoEntrada.x,
                                0,
                                config.puntoEntrada.z
                            )
                        );
                    }
                }

                console.log(
                    `[CLIENTE ${id}] Modelo cargado: ${config.modelo}`
                );
            },

            undefined,

            error => {
                console.error(
                    `[CLIENTE ${id}] No se pudo cargar ${config.modelo}`,
                    error
                );
            }
        );
    }
        // ========================================================
    // POSICIÓN Y ORIENTACIÓN
    // ========================================================

    function obtenerPosicion() {
        return grupo.position.clone();
    }

    function mirarHacia(x, z) {
        const dx = x - grupo.position.x;
        const dz = z - grupo.position.z;

        if (Math.abs(dx) < 0.0001 && Math.abs(dz) < 0.0001) {
            return;
        }

        const angulo = Math.atan2(dx, dz);

        grupo.rotation.y =
            angulo + numero(config.correccionRotacion);
    }

    // ========================================================
    // COLISIONES DEL MOBILIARIO
    // ========================================================

    function obtenerObstaculos() {
        const obstaculos = [];

        if (Array.isArray(config.colisiones)) {
            for (const colision of config.colisiones) {
                if (!colision) continue;

                obstaculos.push({
                    x: numero(colision.x),
                    z: numero(colision.z),
                    ancho: Math.max(
                        0.1,
                        numero(colision.ancho, colision.width ?? 1)
                    ),
                    profundidad: Math.max(
                        0.1,
                        numero(
                            colision.profundidad,
                            colision.depth ?? 1
                        )
                    )
                });
            }
        }

        if (config.mobiliario?.traverse) {
            config.mobiliario.updateMatrixWorld(true);

            config.mobiliario.traverse(objeto => {
                if (
                    !objeto.isMesh ||
                    objeto.userData?.sinColision ||
                    objeto.userData?.esProducto
                ) {
                    return;
                }

                const caja = new THREE.Box3().setFromObject(objeto);

                if (caja.isEmpty()) return;

                const centro = new THREE.Vector3();
                const tamano = new THREE.Vector3();

                caja.getCenter(centro);
                caja.getSize(tamano);

                if (tamano.y > 3.5) return;
                if (tamano.x < 0.08 || tamano.z < 0.08) return;

                obstaculos.push({
                    x: centro.x,
                    z: centro.z,
                    ancho: tamano.x,
                    profundidad: tamano.z
                });
            });
        }

        return obstaculos;
    }

    function actualizarColisiones() {
        obstaculosCache = obtenerObstaculos();
        tiempoActualizarObstaculos = 0;
    }

    // ========================================================
    // CORREDOR DE ENTRADA
    // ========================================================

    function estaEnCorredorPuerta(x, z) {
        const mitadPuerta = config.puertaAncho / 2;

        return (
            Math.abs(x - config.puertaCentroX) <= mitadPuerta &&
            z >= config.puertaZInterior - 1 &&
            z <= config.puertaZExterior + 1
        );
    }

    function esObstaculoDeFachada(obstaculo) {
        return (
            obstaculo.z >= config.puertaZInterior - 1 &&
            obstaculo.z <= config.puertaZExterior + 1
        );
    }

    // ========================================================
    // COMPROBAR SI UN PUNTO ESTÁ LIBRE
    // ========================================================

    function puntoLibre(x, z) {
        if (
            x < -config.limiteX ||
            x > config.limiteX ||
            z < config.limiteZMin ||
            z > config.limiteZMax
        ) {
            return false;
        }

        const margen =
            config.radioColision + config.margenObstaculos;

        const corredor = estaEnCorredorPuerta(x, z);

        for (const obstaculo of obstaculosCache) {
            if (
                corredor &&
                esObstaculoDeFachada(obstaculo)
            ) {
                continue;
            }

            const mitadX = obstaculo.ancho / 2 + margen;
            const mitadZ = obstaculo.profundidad / 2 + margen;

            if (
                Math.abs(x - obstaculo.x) < mitadX &&
                Math.abs(z - obstaculo.z) < mitadZ
            ) {
                return false;
            }
        }

        return true;
    }

    // ========================================================
    // COMPROBAR SEGMENTO LIBRE
    // ========================================================

    function segmentoLibre(a, b) {
        const distancia = distanciaXZ(a, b);

        const pasos = Math.max(
            1,
            Math.ceil(distancia / 0.25)
        );

        for (let i = 0; i <= pasos; i++) {
            const t = i / pasos;

            const x = THREE.MathUtils.lerp(a.x, b.x, t);
            const z = THREE.MathUtils.lerp(a.z, b.z, t);

            if (!puntoLibre(x, z)) {
                return false;
            }
        }

        return true;
    }

    // ========================================================
    // A*
    // ========================================================

    function claveCelda(x, z) {
        return `${x},${z}`;
    }

    function encontrarCamino(origen, destino) {
        if (!origen || !destino) return [];

        const celda = Math.max(
            numero(config.tamanoCelda, 0.65),
            0.25
        );

        const inicio = {
            x: numero(origen.x),
            z: numero(origen.z)
        };

        const final = {
            x: limitar(
                numero(destino.x),
                -config.limiteX + 0.1,
                config.limiteX - 0.1
            ),
            z: limitar(
                numero(destino.z),
                config.limiteZMin + 0.1,
                config.limiteZMax - 0.1
            )
        };

        const convertir = (x, z) => ({
            x: Math.round(x / celda),
            z: Math.round(z / celda)
        });

        const inicioCelda = convertir(inicio.x, inicio.z);
        const finalCelda = convertir(final.x, final.z);

        const heuristica = (a, b) => {
            const dx = Math.abs(a.x - b.x);
            const dz = Math.abs(a.z - b.z);

            return (
                Math.max(dx, dz) +
                (Math.SQRT2 - 1) * Math.min(dx, dz)
            );
        };

        const abiertos = new MinHeap();
        const cerrados = new Set();
        const nodos = new Map();

        const claveInicio = claveCelda(
            inicioCelda.x,
            inicioCelda.z
        );

        const nodoInicio = {
            x: inicioCelda.x,
            z: inicioCelda.z,
            g: 0,
            h: heuristica(inicioCelda, finalCelda),
            padre: null
        };

        nodoInicio.prioridad = nodoInicio.g + nodoInicio.h;

        nodos.set(claveInicio, nodoInicio);
        abiertos.push(nodoInicio);

        const direcciones = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1]
        ];

        let encontrado = null;
        let iteraciones = 0;

        while (
            abiertos.size > 0 &&
            iteraciones < config.maxIteracionesAStar
        ) {
            iteraciones++;

            const actual = abiertos.pop();
            if (!actual) break;

            const claveActual = claveCelda(
                actual.x,
                actual.z
            );

            if (cerrados.has(claveActual)) continue;

            cerrados.add(claveActual);

            if (
                actual.x === finalCelda.x &&
                actual.z === finalCelda.z
            ) {
                encontrado = actual;
                break;
            }

            for (const [dx, dz] of direcciones) {
                const nx = actual.x + dx;
                const nz = actual.z + dz;

                const claveVecino = claveCelda(nx, nz);

                if (cerrados.has(claveVecino)) continue;

                const px = nx * celda;
                const pz = nz * celda;

                const esDestino =
                    nx === finalCelda.x &&
                    nz === finalCelda.z;

                if (!esDestino && !puntoLibre(px, pz)) {
                    continue;
                }

                // Evitar cortar esquinas entre dos obstáculos.
                if (dx !== 0 && dz !== 0) {
                    if (
                        !puntoLibre(
                            (actual.x + dx) * celda,
                            actual.z * celda
                        ) ||
                        !puntoLibre(
                            actual.x * celda,
                            (actual.z + dz) * celda
                        )
                    ) {
                        continue;
                    }
                }

                const costo =
                    dx !== 0 && dz !== 0
                        ? Math.SQRT2
                        : 1;

                const nuevoG = actual.g + costo;

                let vecino = nodos.get(claveVecino);

                if (!vecino) {
                    vecino = {
                        x: nx,
                        z: nz,
                        g: Infinity,
                        h: heuristica(
                            { x: nx, z: nz },
                            finalCelda
                        ),
                        padre: null,
                        prioridad: Infinity
                    };

                    nodos.set(claveVecino, vecino);
                }

                if (nuevoG >= vecino.g) continue;

                vecino.g = nuevoG;
                vecino.padre = actual;
                vecino.prioridad = vecino.g + vecino.h;

                abiertos.push(vecino);
            }
        }

        if (!encontrado) {
            if (segmentoLibre(inicio, final)) {
                return [
                    new THREE.Vector3(final.x, 0, final.z)
                ];
            }

            return [];
        }

        const camino = [];
        let actual = encontrado;

        while (actual) {
            camino.unshift(
                new THREE.Vector3(
                    actual.x * celda,
                    0,
                    actual.z * celda
                )
            );

            actual = actual.padre;
        }

        camino.shift();

        camino.push(
            new THREE.Vector3(final.x, 0, final.z)
        );

        // Reducir puntos intermedios sin atravesar obstáculos.
        const suavizada = [];

        let indice = 0;

        while (indice < camino.length) {
            suavizada.push(camino[indice]);

            let siguiente = camino.length - 1;

            while (siguiente > indice + 1) {
                if (
                    segmentoLibre(
                        camino[indice],
                        camino[siguiente]
                    )
                ) {
                    break;
                }

                siguiente--;
            }

            indice = siguiente;
        }

        return suavizada;
    }

    // ========================================================
    // ASIGNAR RUTA
    // ========================================================

    function asignarRuta(destino) {
        if (!destino || eliminado) return false;

        const origen = new THREE.Vector3(
            grupo.position.x,
            0,
            grupo.position.z
        );

        const final = new THREE.Vector3(
            numero(destino.x),
            0,
            numero(destino.z)
        );

        const nuevaRuta = encontrarCamino(origen, final);

        if (!nuevaRuta.length) {
            console.warn(
                `[CLIENTE ${id}] No se encontró una ruta.`,
                origen,
                final
            );

            rutaActual = [];
            indiceRuta = 0;

            return false;
        }

        rutaActual = nuevaRuta;
        indiceRuta = 0;
        destinoActual.copy(final);

        return true;
    }

    // ========================================================
    // VELOCIDAD SEGÚN ESTADO
    // ========================================================

    function obtenerVelocidadMovimiento() {
        if (estado === ESTADOS.ENTRANDO) {
            return config.velocidadEntrada;
        }

        if (estado === ESTADOS.SALIENDO) {
            return config.velocidadSalida;
        }

        return config.velocidad;
    }

    // ========================================================
    // MOVIMIENTO
    // ========================================================

    function actualizarMovimiento(delta) {
        if (!rutaActual.length) {
            velocidadActual = 0;
            return false;
        }

        const objetivo = rutaActual[indiceRuta];

        if (!objetivo) {
            rutaActual = [];
            velocidadActual = 0;
            return true;
        }

        const dx = objetivo.x - grupo.position.x;
        const dz = objetivo.z - grupo.position.z;

        const distancia = Math.hypot(dx, dz);

        if (distancia <= config.distanciaLlegada) {
            indiceRuta++;

            if (indiceRuta >= rutaActual.length) {
                rutaActual = [];
                indiceRuta = 0;
                velocidadActual = 0;

                return true;
            }

            return false;
        }

        const direccionX = dx / distancia;
        const direccionZ = dz / distancia;

        const velocidad = obtenerVelocidadMovimiento();

        const desplazamiento = Math.min(
            velocidad * delta,
            distancia
        );

        const siguienteX =
            grupo.position.x + direccionX * desplazamiento;

        const siguienteZ =
            grupo.position.z + direccionZ * desplazamiento;

        const libre =
            puntoLibre(siguienteX, siguienteZ) ||
            estaEnCorredorPuerta(siguienteX, siguienteZ);

        if (!libre) {
            velocidadActual = 0;
            tiempoRecalculoRuta += delta;

            if (
                tiempoRecalculoRuta >=
                config.intervaloRecalculoRuta
            ) {
                tiempoRecalculoRuta = 0;
                asignarRuta(destinoActual);
            }

            return false;
        }

        grupo.position.x = siguienteX;
        grupo.position.z = siguienteZ;

        velocidadActual = velocidad;

        // Rotación gradual, sin saltos bruscos.
        const anguloObjetivo = Math.atan2(
            direccionX,
            direccionZ
        );

        const diferencia = THREE.MathUtils.euclideanModulo(
            anguloObjetivo - grupo.rotation.y + Math.PI,
            Math.PI * 2
        ) - Math.PI;

        grupo.rotation.y +=
            diferencia *
            Math.min(1, config.velocidadGiro * delta);

        return false;
    }
        // ========================================================
    // OBTENER PRODUCTOS DISPONIBLES
    // ========================================================

    function obtenerListaProductos() {
        const lista = [];

        if (!config.productos) return lista;

        const agregar = objeto => {
            if (!objeto?.isObject3D) return;

            if (
                objeto.userData?.esEstante ||
                objeto.userData?.esMobiliario
            ) {
                return;
            }

            if (
                objeto.userData?.esProducto ||
                objeto.userData?.producto ||
                objeto.userData?.codigo ||
                objeto.userData?.nombreProducto
            ) {
                lista.push(objeto);
            }
        };

        if (Array.isArray(config.productos)) {
            for (const producto of config.productos) {
                agregar(producto);
            }
        } else if (config.productos.isObject3D) {
            agregar(config.productos);

            config.productos.traverse(objeto => {
                agregar(objeto);
            });
        }

        return [...new Set(lista)];
    }

    // ========================================================
    // NOMBRE Y PRECIO DE PRODUCTOS
    // ========================================================

    function obtenerNombreProducto(producto) {
        return (
            producto.userData?.nombreProducto ||
            producto.userData?.nombre ||
            producto.userData?.producto ||
            producto.name ||
            'Producto'
        );
    }

    function obtenerPrecioProducto(producto) {
        return Math.max(
            0,
            numero(
                producto.userData?.precio ??
                producto.userData?.price ??
                producto.userData?.costo,
                0
            )
        );
    }

    // ========================================================
    // BUSCAR PRODUCTO CERCANO
    // ========================================================

    function buscarProductoCercano() {
        const productos = obtenerListaProductos();

        if (!productos.length) return null;

        const candidatos = [];

        for (const producto of productos) {
            if (
                !producto.visible ||
                producto.userData?.agotado ||
                producto.userData?.noComprar ||
                producto.userData?.enCarrito ||
                producto.userData?.reservado
            ) {
                continue;
            }

            producto.getWorldPosition(vectorTemporal);

            const distancia = Math.hypot(
                vectorTemporal.x - grupo.position.x,
                vectorTemporal.z - grupo.position.z
            );

            if (distancia > config.radioBusquedaProducto) {
                continue;
            }

            if (productosExaminados.has(producto.uuid)) {
                continue;
            }

            candidatos.push({
                producto,
                distancia
            });
        }

        candidatos.sort(
            (a, b) => a.distancia - b.distancia
        );

        for (const candidato of candidatos) {
            const producto = candidato.producto;

            if (
                producto.userData?.reservado ||
                producto.userData?.agotado
            ) {
                continue;
            }

            producto.userData.reservado = true;
            producto.userData.reservadoPor = id;

            productoObjetivo = producto;

            return producto;
        }

        return null;
    }

    // ========================================================
    // RESERVAR PRODUCTO
    // ========================================================

    function reservarProducto(producto) {
        if (!producto || !producto.isObject3D) return false;

        if (
            producto.userData?.reservado &&
            producto.userData?.reservadoPor !== id
        ) {
            return false;
        }

        producto.updateMatrixWorld(true);

        const posicionMundo = new THREE.Vector3();
        const quaternionMundo = new THREE.Quaternion();
        const escalaMundo = new THREE.Vector3();

        producto.getWorldPosition(posicionMundo);
        producto.getWorldQuaternion(quaternionMundo);
        producto.getWorldScale(escalaMundo);

        productoOriginal = {
            parent: producto.parent,
            posicionMundo: posicionMundo.clone(),
            quaternionMundo: quaternionMundo.clone(),
            escalaMundo: escalaMundo.clone(),
            posicion: producto.position.clone(),
            quaternion: producto.quaternion.clone(),
            escala: producto.scale.clone(),
            visible: producto.visible,
            rackId: producto.userData?.rackId ?? null
        };

        producto.userData.reservado = true;
        producto.userData.reservadoPor = id;

        productoEnMano = producto;
        productoObjetivo = producto;

        return true;
    }

    // ========================================================
    // LIBERAR RESERVA
    // ========================================================

    function liberarReserva(producto = productoEnMano) {
        if (!producto) return;

        if (producto.userData?.reservadoPor === id) {
            producto.userData.reservado = false;
            delete producto.userData.reservadoPor;
        }
    }

    // ========================================================
    // COLOCAR PRODUCTO EN LA MANO
    // ========================================================

    function recogerProducto() {
        if (!productoEnMano || !productoOriginal) {
            return false;
        }

        const producto = productoEnMano;

        producto.updateMatrixWorld(true);

        const posicionMundo = new THREE.Vector3();
        const quaternionMundo = new THREE.Quaternion();
        const escalaMundo = new THREE.Vector3();

        producto.getWorldPosition(posicionMundo);
        producto.getWorldQuaternion(quaternionMundo);
        producto.getWorldScale(escalaMundo);

        producto.parent?.remove(producto);
        grupo.add(producto);

        grupo.updateMatrixWorld(true);

        producto.position.copy(
            grupo.worldToLocal(posicionMundo.clone())
        );

        grupo.getWorldQuaternion(quaternionTemporal);

        producto.quaternion
            .copy(quaternionTemporal.invert())
            .multiply(quaternionMundo);

        producto.scale.copy(escalaMundo);

        const destino = crearVector(
            config.offsetProductoMano
        );

        const escalaFinal = escalaMundo.clone().multiplyScalar(
            numero(config.escalaProductoMano, 0.65)
        );

        animacionProducto.activa = true;
        animacionProducto.tipo = 'RECOGER';
        animacionProducto.tiempo = 0;
        animacionProducto.duracion = Math.max(
            0.1,
            config.tiempoRecoger
        );

        animacionProducto.posicionInicial =
            producto.position.clone();

        animacionProducto.posicionFinal = destino;

        animacionProducto.quaternionInicial =
            producto.quaternion.clone();

        animacionProducto.quaternionFinal =
            new THREE.Quaternion();

        animacionProducto.escalaInicial =
            producto.scale.clone();

        animacionProducto.escalaFinal = escalaFinal;

        return true;
    }

    // ========================================================
    // ANIMACIÓN DEL PRODUCTO
    // ========================================================

    function actualizarAnimacionProducto(delta) {
        if (!animacionProducto.activa || !productoEnMano) {
            return false;
        }

        const anim = animacionProducto;
        const producto = productoEnMano;

        anim.tiempo += delta;

        const t = limitar(
            anim.tiempo / Math.max(anim.duracion, 0.01),
            0,
            1
        );

        const suave = t * t * (3 - 2 * t);

        const posicion = new THREE.Vector3().lerpVectors(
            anim.posicionInicial,
            anim.posicionFinal,
            suave
        );

        posicion.y +=
            Math.sin(Math.PI * t) *
            config.alturaMovimientoProducto;

        producto.position.copy(posicion);

        producto.quaternion.slerpQuaternions(
            anim.quaternionInicial,
            anim.quaternionFinal,
            suave
        );

        producto.scale.lerpVectors(
            anim.escalaInicial,
            anim.escalaFinal,
            suave
        );

        if (t >= 1) {
            producto.position.copy(anim.posicionFinal);
            producto.quaternion.copy(anim.quaternionFinal);
            producto.scale.copy(anim.escalaFinal);

            anim.activa = false;

            if (anim.tipo === 'DEVOLVER') {
                finalizarDevolucionProducto();
            }

            if (anim.tipo === 'RECOGER') {
                anim.tipo = null;
            }

            return true;
        }

        return false;
    }

    // ========================================================
    // DEVOLVER PRODUCTO A SU LUGAR ORIGINAL
    // ========================================================

    function devolverProducto() {
        if (!productoEnMano || !productoOriginal) {
            return false;
        }

        const producto = productoEnMano;
        const original = productoOriginal;

        if (!original.parent) {
            return false;
        }

        original.parent.updateMatrixWorld(true);

        const destinoMundo = original.posicionMundo.clone();

        const inicioMundo = new THREE.Vector3();
        const quaternionInicio = new THREE.Quaternion();
        const escalaInicio = new THREE.Vector3();

        producto.updateMatrixWorld(true);

        producto.getWorldPosition(inicioMundo);
        producto.getWorldQuaternion(quaternionInicio);
        producto.getWorldScale(escalaInicio);

        // La animación se realiza en coordenadas del mundo.
        producto.parent?.remove(producto);
        scene.add(producto);

        producto.position.copy(inicioMundo);
        producto.quaternion.copy(quaternionInicio);
        producto.scale.copy(escalaInicio);

        animacionProducto.activa = true;
        animacionProducto.tipo = 'DEVOLVER';
        animacionProducto.tiempo = 0;
        animacionProducto.duracion = Math.max(
            0.1,
            config.tiempoDevolver
        );

        animacionProducto.posicionInicial = inicioMundo;
        animacionProducto.posicionFinal = destinoMundo;

        animacionProducto.quaternionInicial = quaternionInicio;
        animacionProducto.quaternionFinal =
            original.quaternionMundo.clone();

        animacionProducto.escalaInicial = escalaInicio;
        animacionProducto.escalaFinal =
            original.escalaMundo.clone();

        return true;
    }

    function finalizarDevolucionProducto() {
        if (!productoEnMano || !productoOriginal) {
            animacionProducto.activa = false;
            animacionProducto.tipo = null;
            return;
        }

        const producto = productoEnMano;
        const original = productoOriginal;

        producto.parent?.remove(producto);

        if (original.parent) {
            original.parent.add(producto);
        } else {
            scene.add(producto);
        }

        producto.position.copy(original.posicion);
        producto.quaternion.copy(original.quaternion);
        producto.scale.copy(original.escala);
        producto.visible = original.visible;

        producto.userData.enCarrito = false;
        producto.userData.reubicado = false;

        liberarReserva(producto);

        productoEnMano = null;
        productoOriginal = null;
        productoObjetivo = null;

        animacionProducto.activa = false;
        animacionProducto.tipo = null;
        animacionProducto.tiempo = 0;
    }

    // ========================================================
    // BUSCAR CONTENEDOR DEL CARRITO
    // ========================================================

    function obtenerContenedorCarrito() {
        if (!carritoCliente?.isObject3D) return null;

        return (
            carritoCliente.userData?.contenedorProductos ||
            carritoCliente.userData?.grupoProductos ||
            carritoCliente
        );
    }

    // ========================================================
    // ASOCIAR CARRITO
    // ========================================================

    function asociarCarrito(carrito) {
        if (!carrito) return false;

        if (carrito.group?.isObject3D) {
            carritoCliente = carrito.group;
        } else if (carrito.isObject3D) {
            carritoCliente = carrito;
        } else {
            return false;
        }

        carritoCliente.userData =
            carritoCliente.userData || {};

        carritoCliente.userData.clientePropietario = id;

        if (!carritoCliente.parent) {
            scene.add(carritoCliente);
        }

        return true;
    }

    // ========================================================
    // CREAR CARRITO SI SE SOLICITA
    // ========================================================

    function crearCarritoCliente() {
        if (carritoCliente) return carritoCliente;

        if (typeof config.crearCarrito !== 'function') {
            return null;
        }

        try {
            const resultado = config.crearCarrito({
                scene,
                cliente: api,
                posicion: grupo.position.clone()
            });

            if (!asociarCarrito(resultado)) {
                console.warn(
                    `[CLIENTE ${id}] El creador de carrito no devolvió un Object3D válido.`
                );

                return null;
            }

            return carritoCliente;

        } catch (error) {
            console.error(
                `[CLIENTE ${id}] Error al crear carrito:`,
                error
            );

            return null;
        }
    }

    // ========================================================
    // SEGUIR AL CLIENTE
    // ========================================================

    function actualizarCarrito(delta) {
        if (!carritoCliente) return;

        const distancia = numero(
            config.distanciaCarrito,
            1.15
        );

        const atras = new THREE.Vector3(
            0,
            0,
            -distancia
        );

        atras.applyQuaternion(grupo.quaternion);

        const destino = new THREE.Vector3(
            grupo.position.x + atras.x,
            carritoCliente.position.y,
            grupo.position.z + atras.z
        );

        const alpha = 1 - Math.exp(
            -numero(config.suavizadoCarrito, 6) * delta
        );

        carritoCliente.position.lerp(destino, alpha);

        const diferencia = THREE.MathUtils.euclideanModulo(
            grupo.rotation.y -
            carritoCliente.rotation.y +
            Math.PI,
            Math.PI * 2
        ) - Math.PI;

        carritoCliente.rotation.y += diferencia * alpha;
    }

    // ========================================================
    // GUARDAR PRODUCTO EN EL CARRITO
    // ========================================================

    function guardarEnCarrito() {
        if (!productoEnMano) return false;

        const contenedor = obtenerContenedorCarrito();

        if (!contenedor) {
            console.warn(
                `[CLIENTE ${id}] No hay un carrito asociado.`
            );

            return false;
        }

        const producto = productoEnMano;

        producto.updateMatrixWorld(true);

        const posicionMundo = new THREE.Vector3();
        const quaternionMundo = new THREE.Quaternion();
        const escalaMundo = new THREE.Vector3();

        producto.getWorldPosition(posicionMundo);
        producto.getWorldQuaternion(quaternionMundo);
        producto.getWorldScale(escalaMundo);

        producto.parent?.remove(producto);
        contenedor.add(producto);

        contenedor.updateMatrixWorld(true);

        producto.position.copy(
            contenedor.worldToLocal(posicionMundo.clone())
        );

        contenedor.getWorldQuaternion(quaternionTemporal);

        producto.quaternion
            .copy(quaternionTemporal.invert())
            .multiply(quaternionMundo);

        producto.scale.copy(escalaMundo);

        producto.userData.enCarrito = true;
        producto.userData.clientePropietario = id;
        producto.userData.reservado = false;

        delete producto.userData.reservadoPor;

        if (!Array.isArray(carritoCliente.userData.productos)) {
            carritoCliente.userData.productos = [];
        }

        carritoCliente.userData.productos.push(producto);

        productosComprados.push(producto);

        totalCompra += obtenerPrecioProducto(producto);

        try {
            config.alComprar?.({
                cliente: api,
                producto,
                nombre: obtenerNombreProducto(producto),
                precio: obtenerPrecioProducto(producto),
                total: totalCompra,
                carrito: carritoCliente
            });
        } catch (error) {
            console.error(error);
        }

        productoEnMano = null;
        productoOriginal = null;
        productoObjetivo = null;

        animacionProducto.activa = false;
        animacionProducto.tipo = null;

        return true;
    }

    // ========================================================
    // ANIMACIÓN DE INSPECCIÓN Y ACCIONES DE BRAZOS
    // ========================================================

    function rotarHueso(hueso, x, y = 0, z = 0, intensidad = 1) {
        if (!hueso) return;

        hueso.rotation.x = suavizar(
            hueso.rotation.x,
            x,
            intensidad
        );

        hueso.rotation.y = suavizar(
            hueso.rotation.y,
            y,
            intensidad
        );

        hueso.rotation.z = suavizar(
            hueso.rotation.z,
            z,
            intensidad
        );
    }

    function animarRecogerProcedural() {
        if (mixer) return;

        const duracion = Math.max(config.tiempoRecoger, 0.01);
        const t = limitar(tiempoEstado / duracion, 0, 1);

        const inferior =
            productoEnMano &&
            productoOriginal &&
            productoOriginal.posicionMundo.y < 0.75;

        const agachado = inferior ? Math.sin(Math.PI * t) : 0;

        rotarHueso(
            huesos.brazoDerecho,
            THREE.MathUtils.lerp(-0.15, -0.95, t),
            0,
            -0.08,
            0.25
        );

        rotarHueso(
            huesos.antebrazoDerecho,
            THREE.MathUtils.lerp(-0.1, -0.75, t),
            0,
            0,
            0.25
        );

        rotarHueso(
            huesos.brazoIzquierdo,
            -0.2 * t,
            0,
            0.05,
            0.2
        );

        rotarHueso(
            huesos.antebrazoIzquierdo,
            -0.15 * t,
            0,
            0,
            0.2
        );

        rotarHueso(
            huesos.columna,
            0.12 * agachado,
            0,
            0,
            0.2
        );

        rotarHueso(
            huesos.cabeza,
            0.12 * t,
            0,
            0,
            0.2
        );
    }

    function animarInspeccionarProcedural() {
        if (mixer) return;

        const oscilacion =
            Math.sin(tiempoEstado * 2.5) * 0.035;

        rotarHueso(
            huesos.brazoDerecho,
            -1.05 + oscilacion,
            0,
            -0.05,
            0.22
        );

        rotarHueso(
            huesos.antebrazoDerecho,
            -0.95 + oscilacion,
            0,
            0,
            0.22
        );

        rotarHueso(
            huesos.brazoIzquierdo,
            -0.65,
            0,
            0.05,
            0.2
        );

        rotarHueso(
            huesos.antebrazoIzquierdo,
            -0.75,
            0,
            0,
            0.2
        );

        rotarHueso(
            huesos.cabeza,
            0.18 + Math.sin(tiempoEstado * 1.4) * 0.04,
            0.04,
            0,
            0.15
        );

        if (productoEnMano) {
            productoEnMano.position.y =
                numero(config.offsetProductoMano.y) +
                Math.sin(tiempoEstado * 2.2) * 0.025;
        }
    }

    function animarGuardarProcedural() {
        if (mixer) return;

        const oscilacion =
            Math.sin(tiempoEstado * 5) * 0.07;

        rotarHueso(
            huesos.brazoDerecho,
            -0.85 + oscilacion,
            0,
            -0.05,
            0.22
        );

        rotarHueso(
            huesos.antebrazoDerecho,
            -0.8,
            0,
            0,
            0.22
        );

        rotarHueso(
            huesos.brazoIzquierdo,
            -0.45,
            0,
            0.05,
            0.2
        );

        rotarHueso(
            huesos.antebrazoIzquierdo,
            -0.55,
            0,
            0,
            0.2
        );

        rotarHueso(huesos.cabeza, 0.1, 0, 0, 0.15);
    }

    function animarDevolverProcedural() {
        if (mixer) return;

        const t = limitar(
            tiempoEstado / Math.max(config.tiempoDevolver, 0.01),
            0,
            1
        );

        rotarHueso(
            huesos.brazoDerecho,
            THREE.MathUtils.lerp(-1, -0.15, t),
            0,
            -0.05,
            0.2
        );

        rotarHueso(
            huesos.antebrazoDerecho,
            THREE.MathUtils.lerp(-0.8, -0.1, t),
            0,
            0,
            0.2
        );

        rotarHueso(
            huesos.brazoIzquierdo,
            THREE.MathUtils.lerp(-0.45, -0.1, t),
            0,
            0.05,
            0.2
        );

        rotarHueso(
            huesos.antebrazoIzquierdo,
            THREE.MathUtils.lerp(-0.55, -0.1, t),
            0,
            0,
            0.2
        );

        rotarHueso(
            huesos.cabeza,
            THREE.MathUtils.lerp(0.15, 0, t),
            0,
            0,
            0.15
        );
    }

    function animarPagoProcedural() {
        if (mixer) return;

        const movimiento =
            Math.sin(tiempoEstado * 3) * 0.07;

        rotarHueso(
            huesos.brazoDerecho,
            -0.9 + movimiento,
            0,
            -0.05,
            0.2
        );

        rotarHueso(
            huesos.antebrazoDerecho,
            -0.6,
            0,
            0,
            0.2
        );

        rotarHueso(
            huesos.brazoIzquierdo,
            -0.7,
            0,
            0.05,
            0.2
        );

        rotarHueso(
            huesos.antebrazoIzquierdo,
            -0.4,
            0,
            0,
            0.2
        );

        rotarHueso(huesos.cabeza, 0.08, 0, 0, 0.15);
    }
        // ========================================================
    // RUTAS DE COMPRA
    // ========================================================

    function crearRutaCompra() {
        const puntos = Array.isArray(config.rutaPersonalizada)
            ? config.rutaPersonalizada
            : config.puntosCompra;

        if (!Array.isArray(puntos)) return [];

        return puntos.map(punto => ({
            x: numero(punto.x),
            z: numero(punto.z)
        }));
    }

    function obtenerSiguientePuntoCompra() {
        if (indiceCompra >= rutaCompra.length) {
            return null;
        }

        return rutaCompra[indiceCompra];
    }

    function avanzarPuntoCompra() {
        indiceCompra++;

        const siguiente = obtenerSiguientePuntoCompra();

        if (!siguiente) return false;

        return asignarRuta(
            new THREE.Vector3(
                siguiente.x,
                0,
                siguiente.z
            )
        );
    }

    // ========================================================
    // INICIAR RECORRIDO DE COMPRA
    // ========================================================

    function iniciarRecorridoCompra() {
        rutaCompra = crearRutaCompra();
        indiceCompra = 0;

        if (rutaCompra.length > 0) {
            cambiarEstado(ESTADOS.BUSCANDO);

            const punto = obtenerSiguientePuntoCompra();

            asignarRuta(
                new THREE.Vector3(
                    punto.x,
                    0,
                    punto.z
                )
            );

            return;
        }

        // Si no se especificaron puntos, busca productos
        // alrededor de la posición actual.
        cambiarEstado(ESTADOS.ACERCANDO);
    }

    // ========================================================
    // IR A CAJA
    // ========================================================

    function irACaja() {
        cambiarEstado(ESTADOS.CAJA);

        if (config.puntoCaja) {
            asignarRuta(
                new THREE.Vector3(
                    config.puntoCaja.x,
                    0,
                    config.puntoCaja.z
                )
            );
        } else {
            iniciarPago();
        }
    }

    // ========================================================
    // INICIAR PAGO
    // ========================================================

    function iniciarPago() {
        cambiarEstado(ESTADOS.PAGANDO);

        try {
            config.alPagar?.({
                cliente: api,
                carrito: carritoCliente,
                productos: [...productosComprados],
                total: totalCompra
            });
        } catch (error) {
            console.error(
                `[CLIENTE ${id}] Error al iniciar el pago:`,
                error
            );
        }
    }

    // ========================================================
    // FINALIZAR PAGO
    // ========================================================

    function finalizarPago() {
        cambiarEstado(ESTADOS.SALIENDO);

        if (config.puntoSalida) {
            asignarRuta(
                new THREE.Vector3(
                    config.puntoSalida.x,
                    0,
                    config.puntoSalida.z
                )
            );
        } else {
            finalizarSalida();
        }
    }

    // ========================================================
    // FINALIZAR SALIDA
    // ========================================================

    function finalizarSalida() {
        if (eliminado) return;

        cambiarEstado(ESTADOS.FINALIZADO);

        try {
            config.alFinalizar?.({
                cliente: api,
                carrito: carritoCliente,
                productos: [...productosComprados],
                total: totalCompra
            });
        } catch (error) {
            console.error(
                `[CLIENTE ${id}] Error al finalizar:`,
                error
            );
        }

        if (config.eliminarAlSalir) {
            eliminar();
        }
    }

    // ========================================================
    // ACTUALIZAR ESTADO: INACTIVO
    // ========================================================

    function actualizarInactivo() {
        if (!config.autoIniciar || !cargado) return;

        cambiarEstado(ESTADOS.ENTRANDO);

        if (config.puntoEntrada) {
            asignarRuta(
                new THREE.Vector3(
                    config.puntoEntrada.x,
                    0,
                    config.puntoEntrada.z
                )
            );
        }
    }

    // ========================================================
    // ACTUALIZAR ESTADO: ENTRANDO
    // ========================================================

    function actualizarEntrando(delta) {
        const llego = actualizarMovimiento(delta);

        if (!llego) return;

        iniciarRecorridoCompra();
    }

    // ========================================================
    // ACTUALIZAR ESTADO: BUSCANDO
    // ========================================================

    function actualizarBuscando(delta) {
        const punto = obtenerSiguientePuntoCompra();

        if (!punto) {
            irACaja();
            return;
        }

        // Si todavía no tiene ruta, intenta asignarla.
        if (!rutaActual.length) {
            const asignada = asignarRuta(
                new THREE.Vector3(
                    punto.x,
                    0,
                    punto.z
                )
            );

            if (!asignada) {
                indiceCompra++;
            }

            return;
        }

        if (actualizarMovimiento(delta)) {
            cambiarEstado(ESTADOS.ACERCANDO);
        }
    }

    // ========================================================
    // ACTUALIZAR ESTADO: ACERCÁNDOSE
    // ========================================================

    function actualizarAcercando() {
        if (tiempoEstado < config.tiempoAcercamiento) {
            return;
        }

        const producto = buscarProductoCercano();

        if (!producto) {
            productosExaminados.clear();

            if (!avanzarPuntoCompra()) {
                irACaja();
            } else {
                cambiarEstado(ESTADOS.BUSCANDO);
            }

            return;
        }

        producto.getWorldPosition(vectorTemporal);

        mirarHacia(
            vectorTemporal.x,
            vectorTemporal.z
        );

        if (!reservarProducto(producto)) {
            productosExaminados.add(producto.uuid);

            if (!avanzarPuntoCompra()) {
                irACaja();
            } else {
                cambiarEstado(ESTADOS.BUSCANDO);
            }

            return;
        }

        cambiarEstado(ESTADOS.RECOGIENDO);

        recogerProducto();
    }

    // ========================================================
    // ACTUALIZAR ESTADO: RECOGIENDO
    // ========================================================

    function actualizarRecogiendo() {
        if (animacionProducto.activa) return;

        if (!productoEnMano) {
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        cambiarEstado(ESTADOS.INSPECCIONANDO);
    }

    // ========================================================
    // DECIDIR SI COMPRA O DEVUELVE
    // ========================================================

    function decidirProducto() {
        const comprar =
            Math.random() < config.probabilidadCompra;

        if (comprar) {
            cambiarEstado(ESTADOS.GUARDANDO);
            return;
        }

        cambiarEstado(ESTADOS.DEVOLVIENDO);

        if (!devolverProducto()) {
            liberarReserva(productoEnMano);

            productoEnMano = null;
            productoOriginal = null;

            cambiarEstado(ESTADOS.BUSCANDO);
        }
    }

    // ========================================================
    // ACTUALIZAR ESTADO: INSPECCIONANDO
    // ========================================================

    function actualizarInspeccionando() {
        if (tiempoEstado < config.tiempoExaminar) {
            return;
        }

        if (!productoEnMano) {
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        decidirProducto();
    }

    // ========================================================
    // ACTUALIZAR ESTADO: GUARDANDO
    // ========================================================

    function actualizarGuardando() {
        if (tiempoEstado < config.tiempoGuardar) {
            return;
        }

        if (!guardarEnCarrito()) {
            // Si no se pudo guardar, se devuelve el producto
            // para evitar dejarlo reservado o perdido.
            if (productoEnMano && productoOriginal) {
                cambiarEstado(ESTADOS.DEVOLVIENDO);
                devolverProducto();
                return;
            }
        }

        if (
            productosComprados.length >=
            config.maximoProductos
        ) {
            irACaja();
            return;
        }

        if (!avanzarPuntoCompra()) {
            irACaja();
            return;
        }

        cambiarEstado(ESTADOS.BUSCANDO);
    }

    // ========================================================
    // ACTUALIZAR ESTADO: DEVOLVIENDO
    // ========================================================

    function actualizarDevolviendo() {
        if (animacionProducto.activa) return;

        productosExaminados.add(
            productoObjetivo?.uuid
        );

        productoObjetivo = null;

        if (
            productosComprados.length >=
            config.maximoProductos
        ) {
            irACaja();
            return;
        }

        if (!avanzarPuntoCompra()) {
            irACaja();
            return;
        }

        cambiarEstado(ESTADOS.BUSCANDO);
    }

    // ========================================================
    // ACTUALIZAR ESTADO: CAJA
    // ========================================================

    function actualizarCaja(delta) {
        if (rutaActual.length) {
            if (actualizarMovimiento(delta)) {
                iniciarPago();
            }

            return;
        }

        iniciarPago();
    }

    // ========================================================
    // ACTUALIZAR ESTADO: PAGANDO
    // ========================================================

    function actualizarPagando() {
        if (tiempoEstado >= config.tiempoPago) {
            finalizarPago();
        }
    }

    // ========================================================
    // ACTUALIZAR ESTADO: SALIENDO
    // ========================================================

    function actualizarSaliendo(delta) {
        if (rutaActual.length) {
            if (actualizarMovimiento(delta)) {
                finalizarSalida();
            }

            return;
        }

        finalizarSalida();
    }

    // ========================================================
    // MÁQUINA DE ESTADOS
    // ========================================================

    function actualizarEstado(delta) {
        tiempoEstado += delta;

        switch (estado) {
            case ESTADOS.INACTIVO:
                actualizarInactivo();
                break;

            case ESTADOS.ENTRANDO:
                actualizarEntrando(delta);
                break;

            case ESTADOS.BUSCANDO:
                actualizarBuscando(delta);
                break;

            case ESTADOS.ACERCANDO:
                actualizarAcercando();
                break;

            case ESTADOS.RECOGIENDO:
                actualizarRecogiendo();
                break;

            case ESTADOS.INSPECCIONANDO:
                actualizarInspeccionando();
                break;

            case ESTADOS.GUARDANDO:
                actualizarGuardando();
                break;

            case ESTADOS.DEVOLVIENDO:
                actualizarDevolviendo();
                break;

            case ESTADOS.CAJA:
                actualizarCaja(delta);
                break;

            case ESTADOS.PAGANDO:
                actualizarPagando();
                break;

            case ESTADOS.SALIENDO:
                actualizarSaliendo(delta);
                break;

            case ESTADOS.FINALIZADO:
                break;
        }
    }

    // ========================================================
    // ACTUALIZAR ANIMACIONES DE ACCIONES
    // ========================================================

    function actualizarAnimacionesAccion(delta) {
        if (animacionProducto.activa) {
            actualizarAnimacionProducto(delta);
        }

        switch (estado) {
            case ESTADOS.RECOGIENDO:
                animarRecogerProcedural();
                break;

            case ESTADOS.INSPECCIONANDO:
                animarInspeccionarProcedural();
                break;

            case ESTADOS.GUARDANDO:
                animarGuardarProcedural();
                break;

            case ESTADOS.DEVOLVIENDO:
                animarDevolverProcedural();
                break;

            case ESTADOS.PAGANDO:
                animarPagoProcedural();
                break;
        }
    }

    // ========================================================
    // ACTUALIZACIÓN PRINCIPAL
    // ========================================================

    function actualizar(delta = 0.016) {
        if (eliminado || !cargado) return;

        delta = limitar(
            numero(delta, 0.016),
            0,
            config.deltaMaximo
        );

        tiempoActualizarObstaculos += delta;

        if (
            tiempoActualizarObstaculos >=
            config.intervaloActualizarObstaculos
        ) {
            actualizarColisiones();
        }

        actualizarEstado(delta);
        actualizarAnimacionesAccion(delta);
        actualizarAnimaciones(delta);

        const estadosConCarrito = [
            ESTADOS.ENTRANDO,
            ESTADOS.BUSCANDO,
            ESTADOS.ACERCANDO,
            ESTADOS.RECOGIENDO,
            ESTADOS.INSPECCIONANDO,
            ESTADOS.GUARDANDO,
            ESTADOS.DEVOLVIENDO,
            ESTADOS.CAJA,
            ESTADOS.PAGANDO,
            ESTADOS.SALIENDO
        ];

        if (
            carritoCliente &&
            estadosConCarrito.includes(estado)
        ) {
            actualizarCarrito(delta);
        }
    }

    // ========================================================
    // ELIMINAR CLIENTE
    // ========================================================

    function eliminar() {
        if (eliminado) return;

        eliminado = true;

        // Si tenía un producto en la mano, devolverlo
        // a su posición original antes de eliminarlo.
        if (productoEnMano && productoOriginal) {
            const producto = productoEnMano;
            const original = productoOriginal;

            producto.parent?.remove(producto);

            if (original.parent) {
                original.parent.add(producto);
            } else {
                scene.add(producto);
            }

            producto.position.copy(original.posicion);
            producto.quaternion.copy(original.quaternion);
            producto.scale.copy(original.escala);
            producto.visible = original.visible;

            producto.userData.reservado = false;
            delete producto.userData.reservadoPor;
        }

        if (mixer && modelo) {
            mixer.stopAllAction();
            mixer.uncacheRoot(modelo);
        }

        if (carritoCliente) {
            if (config.eliminarCarritoAlEliminar) {
                carritoCliente.parent?.remove(carritoCliente);
            } else {
                carritoCliente.userData.clientePropietario = null;
            }
        }

        grupo.parent?.remove(grupo);
        grupo.clear();

        modelo = null;
        mixer = null;
        accionActual = null;

        accionesAnimacion = {};
        huesos = {};

        productoEnMano = null;
        productoOriginal = null;
        productoObjetivo = null;

        rutaActual = [];
        rutaCompra = [];

        productosComprados = [];
        productosExaminados.clear();

        carritoCliente = null;
    }

    // ========================================================
    // API PÚBLICA DEL CLIENTE
    // ========================================================

    const api = {
        id,
        grupo,

        get modelo() {
            return modelo;
        },

        get estado() {
            return estado;
        },

        get cargado() {
            return cargado;
        },

        get carrito() {
            return carritoCliente;
        },

        get eliminado() {
            return eliminado;
        },

        get total() {
            return totalCompra;
        },

        get productosComprados() {
            return [...productosComprados];
        },

        actualizar,

        cambiarEstado,

        asignarRuta,

        asociarCarrito,

        crearCarritoCliente,

        eliminar,

        obtenerPosicion,

        obtenerEstado() {
            return estado;
        },

        obtenerTotal() {
            return totalCompra;
        },

        obtenerProductos() {
            return [...productosComprados];
        },

        moverA(x, z) {
            return asignarRuta(
                new THREE.Vector3(
                    numero(x),
                    0,
                    numero(z)
                )
            );
        },

        iniciar() {
            if (eliminado || !cargado) return false;

            if (estado === ESTADOS.INACTIVO) {
                actualizarInactivo();
            }

            return true;
        },

        detener() {
            if (eliminado) return;

            cambiarEstado(ESTADOS.INACTIVO);
            rutaActual = [];
            velocidadActual = 0;
        }
    };

    // ========================================================
    // INICIALIZACIÓN
    // ========================================================

    cargarModelo();

    return api;
}
