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
    DECIDIENDO: 'DECIDIENDO',
    GUARDANDO: 'GUARDANDO',
    DEVOLVIENDO: 'DEVOLVIENDO',
    ESPERANDO: 'ESPERANDO',
    RUTA: 'RUTA',
    CAJA: 'CAJA',
    PAGANDO: 'PAGANDO',
    REGRESANDO: 'REGRESANDO',
    FINALIZADO: 'FINALIZADO'
};

// ============================================================
// CONFIGURACIÓN
// ============================================================

const CONFIG_BASE = {
    modelo: '/modelos/Cliente1.glb',
    posicion: { x: 0, y: 0, z: 20 },

    altura: 1.75,
    escala: 1,

    velocidad: 1.75,
    velocidadEntrada: 2.05,
    velocidadRegreso: 2.05,

    limiteX: 29,
    limiteZMin: -27,
    limiteZMax: 55,

    radioColision: 0.38,
    margenObstaculos: 0.22,
    tamanoCelda: 0.75,

    puertaCentroX: 0,
    puertaAncho: 8.5,
    puertaZInterior: 27.5,
    puertaZUmbral: 29,
    puertaZExterior: 31.5,

    probabilidadCompra: 0.85,
    probabilidadDejarEnOtroRack: 0.22,

    distanciaProducto: 1.35,
    distanciaFrenteProducto: 1.25,

    tiempoRecoger: 1.1,
    progresoContactoProducto: 0.78,
    tiempoInspeccionar: 2.2,
    tiempoGuardar: 1.4,
    tiempoDevolver: 1.4,
    tiempoEntreProductos: 0.8,
    tiempoReintento: 1.5,

    tiempoAnimacionAgarre: 0.38,
    escalaProductoMano: 0.65,

    offsetProductoMano: {
        x: 0,
        y: 0.04,
        z: 0.12
    },

    rotacionProductoMano: {
        x: 0,
        y: 0,
        z: 0
    },

    alturaProductoInspeccion: 1.25,
    distanciaProductoInspeccion: 0.32,
    alturaEstanteInferior: 0.90,

    maximoProductos: 8,
    distanciaMaximaBusqueda: 40,

    // Filtros de productos.
    soloPlatanos: false,
    nombreProductoBuscado: '',

    separacionProductoRack: 0.06,
    alturaMovimientoProducto: 0.12,

    // Recuperación de rutas.
    intervaloRecalculoRuta: 0.55,
    maximosIntentosMovimiento: 5,
    distanciaRecalculo: 0.45,

    // Movimiento.
    distanciaLlegada: 0.16,
    distanciaWaypoint: 0.30,

    // Animación.
    usarAnimacionesGLB: true,
    velocidadAnimacionGLB: 1,

    repetirRuta: false,
    inactivo: false,

    aceleracionMovimiento: 3.35,
    suavizadoGiro: 7,

    productos: null,
    carrito: null,
    mobiliario: null,
    colisiones: null,

    posicionCaja: { x: 0, z: 22.5 },

    correccionRotacion: 0,

    alEntrar: null,
    alComprar: null,
    alPagar: null,
    alFinalizar: null,
    alCambiarEstado: null
};

const loaderGLTF = new GLTFLoader();

const reservasProductos = new WeakMap();
const reservasRacks = new Map();

const TAMANO_ZONA_RACK = 3.5;

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
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function suavizar(valor) {
    valor = limitar(valor, 0, 1);
    return valor * valor * (3 - 2 * valor);
}

// ============================================================
// COLA DE PRIORIDAD PARA A*
// ============================================================

class MinHeap {
    constructor() {
        this.elementos = [];
    }

    get length() {
        return this.elementos.length;
    }

    limpiar() {
        this.elementos.length = 0;
    }

    insertar(elemento) {
        const lista = this.elementos;
        lista.push(elemento);

        let indice = lista.length - 1;

        while (indice > 0) {
            const padre = Math.floor((indice - 1) / 2);

            if (lista[padre].f <= lista[indice].f) {
                break;
            }

            [lista[padre], lista[indice]] =
                [lista[indice], lista[padre]];

            indice = padre;
        }
    }

    extraer() {
        const lista = this.elementos;

        if (!lista.length) return null;
        if (lista.length === 1) return lista.pop();

        const primero = lista[0];
        lista[0] = lista.pop();

        let indice = 0;

        while (true) {
            const izquierda = indice * 2 + 1;
            const derecha = izquierda + 1;

            let menor = indice;

            if (
                izquierda < lista.length &&
                lista[izquierda].f < lista[menor].f
            ) {
                menor = izquierda;
            }

            if (
                derecha < lista.length &&
                lista[derecha].f < lista[menor].f
            ) {
                menor = derecha;
            }

            if (menor === indice) break;

            [lista[indice], lista[menor]] =
                [lista[menor], lista[indice]];

            indice = menor;
        }

        return primero;
    }
}

// ============================================================
// CREAR CLIENTE
// ============================================================

export function crearClienteSupermercado(scene, opciones = {}) {
    if (!scene?.isScene) {
        throw new Error(
            'crearClienteSupermercado necesita una THREE.Scene.'
        );
    }

    const config = {
        ...CONFIG_BASE,
        ...opciones,

        posicion: {
            ...CONFIG_BASE.posicion,
            ...(opciones.posicion ?? {})
        },

        posicionCaja: {
            ...CONFIG_BASE.posicionCaja,
            ...(opciones.posicionCaja ?? {})
        },

        offsetProductoMano: {
            ...CONFIG_BASE.offsetProductoMano,
            ...(opciones.offsetProductoMano ?? {})
        },

        rotacionProductoMano: {
            ...CONFIG_BASE.rotacionProductoMano,
            ...(opciones.rotacionProductoMano ?? {})
        }
    };

    const id = siguienteIdCliente++;

    const grupo = new THREE.Group();
    grupo.name = `CLIENTE_SUPERMERCADO_${id}`;

    grupo.position.set(
        numero(config.posicion.x),
        numero(config.posicion.y),
        numero(config.posicion.z)
    );

    grupo.userData.esCliente = true;
    grupo.userData.idCliente = id;

    scene.add(grupo);

    // ========================================================
    // VARIABLES PRINCIPALES
    // ========================================================

    let modelo = null;
    let mixer = null;

    let accionCaminar = null;
    let accionReposo = null;

    let cargado = false;
    let eliminado = false;
    let detenido = false;
    let entradaNotificada = false;

    let estado = config.inactivo
        ? ESTADOS.INACTIVO
        : ESTADOS.BUSCANDO;

    let objetivo = null;
    let ruta = [];
    let indiceRuta = 0;

    let tiempoEstado = 0;
    let tiempoActualizarObstaculos = 0;

    let tiempoRecalculoRuta = 0;
    let intentosMovimiento = 0;
    let ultimaPosicionMovimiento = new THREE.Vector3();
    let tiempoSinMovimiento = 0;

    let productoObjetivo = null;
    let productoEnMano = null;
    let productoOriginal = null;

    let productoEsInferior = false;

    let rackReservado = null;

    let compras = [];

    const productosExaminados = new Set();
    const racksVisitados = new Set();

    let callbackPagoPendiente = null;
    let ticketPendiente = null;
    let callbackRegreso = null;

    let decisionCompra = true;
    let faseAnimacion = Math.random() * Math.PI * 2;
    let rotacionObjetivo = grupo.rotation.y;
    let velocidadActual = 0;
    let movimientoSuave = 0;
    let tiempoIdle = Math.random() * 8;
    let inclinacionCabezaObjetivo = 0;
    let inclinacionTorsoObjetivo = 0;
    let giroCabezaObjetivo = 0;
    let intensidadGiro = 0;
    let apoyandoPieDerecho = true;

    const huesos = {};
    const huesosBase = new Map();

    const rig = {
        cadera: null,
        torso: null,
        cuello: null,
        cabeza: null,

        brazoIzquierdo: null,
        brazoDerecho: null,

        antebrazoIzquierdo: null,
        antebrazoDerecho: null,

        manoIzquierda: null,
        manoDerecha: null,

        piernaIzquierda: null,
        piernaDerecha: null,

        pantorrillaIzquierda: null,
        pantorrillaDerecha: null
    };

    // Temporales reutilizables.
    const EJE_X = new THREE.Vector3(1, 0, 0);
    const quaternionTemporal = new THREE.Quaternion();
    const vectorTemporal = new THREE.Vector3();
    const vectorTemporal2 = new THREE.Vector3();
    const escalaTemporal = new THREE.Vector3();
    const cajaTemporal = new THREE.Box3();
    const tamanoTemporal = new THREE.Vector3();
    const matrizTemporal = new THREE.Matrix4();

    // ========================================================
    // ANIMACIÓN DE AGARRE
    // ========================================================

    const animacionAgarre = {
        activa: false,
        tiempo: 0,
        duracion: config.tiempoAnimacionAgarre,

        posicionInicial: new THREE.Vector3(),
        posicionFinal: new THREE.Vector3(),

        quaternionInicial: new THREE.Quaternion(),
        quaternionFinal: new THREE.Quaternion(),

        escalaInicial: new THREE.Vector3(1, 1, 1),
        escalaFinal: new THREE.Vector3(1, 1, 1)
    };

    // ========================================================
    // ANIMACIÓN DE DEVOLUCIÓN / REUBICACIÓN
    // ========================================================

    const animacionProducto = {
        activa: false,
        tipo: null,
        tiempo: 0,
        duracion: 0,

        posicionInicial: new THREE.Vector3(),
        posicionFinal: new THREE.Vector3(),

        quaternionInicial: new THREE.Quaternion(),
        quaternionFinal: new THREE.Quaternion(),

        escalaInicial: new THREE.Vector3(1, 1, 1),
        escalaFinal: new THREE.Vector3(1, 1, 1),

        posicionTemporal: new THREE.Vector3(),
        quaternionTemporal: new THREE.Quaternion(),
        posicionLocalTemporal: new THREE.Vector3(),
        quaternionPadreTemporal: new THREE.Quaternion(),
        escalaLocalTemporal: new THREE.Vector3(),
        matrizMundoTemporal: new THREE.Matrix4(),
        matrizLocalTemporal: new THREE.Matrix4()
    };

    // ========================================================
    // PUERTA
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
        const zPuerta = config.puertaZUmbral;

        return (
            Math.abs(obstaculo.z - zPuerta) < 2.5 &&
            obstaculo.z - obstaculo.profundidad / 2 <= zPuerta + 1 &&
            obstaculo.z + obstaculo.profundidad / 2 >= zPuerta - 1
        );
    }

    // ========================================================
    // IDENTIFICAR RACKS
    // ========================================================

    function obtenerClaveRack(producto) {
        const datos = producto.userData ?? {};

        if (datos.rackReubicado) {
            return datos.rackReubicado;
        }

        const claveExplicita =
            datos.idRack ??
            datos.rackId ??
            datos.estante ??
            datos.departamento ??
            datos.categoria;

        if (
            claveExplicita !== undefined &&
            claveExplicita !== null
        ) {
            return `rack:${claveExplicita}`;
        }

        producto.getWorldPosition(vectorTemporal);

        const x = Math.round(vectorTemporal.x / TAMANO_ZONA_RACK);
        const z = Math.round(vectorTemporal.z / TAMANO_ZONA_RACK);

        return `zona:${x},${z}`;
    }

    function rackDisponible(producto) {
        const clave = obtenerClaveRack(producto);
        const propietario = reservasRacks.get(clave);

        return propietario === undefined || propietario === id;
    }

    function reservarRack(producto) {
        const clave = obtenerClaveRack(producto);

        if (!rackDisponible(producto)) return false;

        rackReservado = clave;
        reservasRacks.set(clave, id);

        racksVisitados.add(clave);

        return true;
    }

    function liberarRack() {
        if (!rackReservado) return;

        if (reservasRacks.get(rackReservado) === id) {
            reservasRacks.delete(rackReservado);
        }

        rackReservado = null;
    }

    // ========================================================
    // DETECTAR ESQUELETO
    // ========================================================

    function detectarHuesos(raiz) {
        Object.keys(huesos).forEach(
            nombre => delete huesos[nombre]
        );

        huesosBase.clear();

        raiz.traverse(obj => {
            if (!obj.isBone) return;

            huesos[normalizarNombre(obj.name)] = obj;

            huesosBase.set(obj, {
                quaternion: obj.quaternion.clone(),
                posicion: obj.position.clone()
            });
        });
    }

    function buscarHueso(...patrones) {
        for (const [nombre, hueso] of Object.entries(huesos)) {
            if (patrones.some(patron => nombre.includes(patron))) {
                return hueso;
            }
        }

        return null;
    }

    function actualizarRig() {
        rig.cadera = buscarHueso('hips', 'pelvis');

        rig.torso = buscarHueso(
            'spine2',
            'spine1',
            'spine',
            'chest'
        );

        rig.cuello = buscarHueso('neck', 'cuello');
        rig.cabeza = buscarHueso('head', 'cabeza');

        rig.brazoIzquierdo = buscarHueso(
            'leftupperarm',
            'upperarml',
            'leftarm'
        );

        rig.brazoDerecho = buscarHueso(
            'rightupperarm',
            'upperarmr',
            'rightarm'
        );

        rig.antebrazoIzquierdo = buscarHueso(
            'leftforearm',
            'forearml',
            'lowerarml'
        );

        rig.antebrazoDerecho = buscarHueso(
            'rightforearm',
            'forearmr',
            'lowerarmr'
        );

        rig.manoIzquierda = buscarHueso(
            'lefthand',
            'handl',
            'handleft'
        );

        rig.manoDerecha = buscarHueso(
            'righthand',
            'handr',
            'handright'
        );

        rig.piernaIzquierda = buscarHueso(
            'leftupleg',
            'uplegleft',
            'leftthigh',
            'thighl'
        );

        rig.piernaDerecha = buscarHueso(
            'rightupleg',
            'uplegright',
            'rightthigh',
            'thighr'
        );

        rig.pantorrillaIzquierda = buscarHueso(
            'leftleg',
            'lowerlegleft',
            'calfl',
            'leftcalf'
        );

        rig.pantorrillaDerecha = buscarHueso(
            'rightleg',
            'lowerlegright',
            'calfr',
            'rightcalf'
        );
    }

    // ========================================================
    // CONTROL DE ANIMACIONES
    // ========================================================

    function detenerAccionesGLB() {
        if (accionCaminar) {
            accionCaminar.fadeOut(0.12);
        }

        if (accionReposo) {
            accionReposo.fadeOut(0.12);
        }
    }

    function activarCaminarGLB() {
        if (!config.usarAnimacionesGLB || !accionCaminar) {
            return false;
        }

        accionReposo?.fadeOut(0.12);

        if (!accionCaminar.isRunning()) {
            accionCaminar.reset();
            accionCaminar.enabled = true;
            accionCaminar.setEffectiveTimeScale(
                config.velocidadAnimacionGLB
            );
            accionCaminar.fadeIn(0.12);
            accionCaminar.play();
        }

        accionCaminar.paused = false;

        return true;
    }

    function activarReposoGLB() {
        if (!config.usarAnimacionesGLB || !accionReposo) {
            return false;
        }

        accionCaminar?.fadeOut(0.12);

        if (!accionReposo.isRunning()) {
            accionReposo.reset();
            accionReposo.enabled = true;
            accionReposo.fadeIn(0.15);
            accionReposo.play();
        }

        accionReposo.paused = false;

        return true;
    }

    function aplicarRotacion(hueso, eje, angulo) {
        if (!hueso) return;

        const base = huesosBase.get(hueso);
        if (!base) return;

        hueso.quaternion.copy(base.quaternion);

        quaternionTemporal.setFromAxisAngle(eje, angulo);
        hueso.quaternion.multiply(quaternionTemporal);
    }

    function aplicarRotacionEuler(hueso, x, y = 0, z = 0) {
        if (!hueso) return;

        const base = huesosBase.get(hueso);
        if (!base) return;

        const euler = new THREE.Euler(x, y, z, 'XYZ');
        quaternionTemporal.setFromEuler(euler);

        hueso.quaternion.copy(base.quaternion);
        hueso.quaternion.multiply(quaternionTemporal);
    }

    function restaurarHueso(hueso, intensidad = 0.15) {
        if (!hueso) return;

        const base = huesosBase.get(hueso);
        if (!base) return;

        hueso.quaternion.slerp(base.quaternion, intensidad);
    }

    function restaurarPoseCompleta() {
        for (const [hueso, base] of huesosBase) {
            hueso.quaternion.copy(base.quaternion);
            hueso.position.copy(base.posicion);
        }

        grupo.position.y = numero(config.posicion.y);
    }

    // ========================================================
    // ALTURA DEL PRODUCTO
    // ========================================================

    function productoEstaEnEstanteInferior(producto) {
        if (!producto) return false;

        producto.updateMatrixWorld(true);

        cajaTemporal.setFromObject(producto);

        if (cajaTemporal.isEmpty()) return false;

        const alturaCentro =
            (cajaTemporal.min.y + cajaTemporal.max.y) / 2;

        return alturaCentro < config.alturaEstanteInferior;
    }

    // ========================================================
    // ANIMACIÓN PROCEDURAL DE CAMINAR
    // ========================================================

    function animarCaminarProcedural(delta) {
        if (config.usarAnimacionesGLB && accionCaminar) {
            if (accionCaminar.isRunning()) {
                accionCaminar.setEffectiveTimeScale(
                    config.velocidadAnimacionGLB *
                    THREE.MathUtils.lerp(0.55, 1.32, movimientoSuave)
                );
            }
            return;
        }

        const ritmo = THREE.MathUtils.clamp(
            velocidadActual / Math.max(config.velocidad, 0.1),
            0.35,
            1.25
        );

        faseAnimacion += delta * (7.0 + ritmo * 1.8);

        const paso = Math.sin(faseAnimacion);
        const contrapasado = Math.cos(faseAnimacion);
        const apoyo = paso * 0.42 * movimientoSuave;
        const rebote = (1 - Math.cos(faseAnimacion * 2)) * 0.012 * movimientoSuave;
        const balanceo = contrapasado * 0.026 * movimientoSuave;
        const giroCadera = contrapasado * 0.035 * movimientoSuave;
        const inclinacionGiro = limitar(intensidadGiro * 0.11, -0.11, 0.11);

        aplicarRotacionEuler(rig.piernaIzquierda, apoyo, 0, balanceo * 0.35);
        aplicarRotacionEuler(rig.piernaDerecha, -apoyo, 0, -balanceo * 0.35);

        aplicarRotacion(rig.pantorrillaIzquierda, EJE_X,
            Math.max(0, -apoyo) * 0.9 + Math.max(0, apoyo) * 0.16);
        aplicarRotacion(rig.pantorrillaDerecha, EJE_X,
            Math.max(0, apoyo) * 0.9 + Math.max(0, -apoyo) * 0.16);

        aplicarRotacionEuler(rig.brazoIzquierdo, -apoyo * 0.82, 0, -0.025 * movimientoSuave);
        aplicarRotacionEuler(rig.brazoDerecho, apoyo * 0.82, 0, 0.025 * movimientoSuave);
        aplicarRotacion(rig.antebrazoIzquierdo, EJE_X,
            -0.10 + Math.max(0, apoyo) * 0.28);
        aplicarRotacion(rig.antebrazoDerecho, EJE_X,
            -0.10 + Math.max(0, -apoyo) * 0.28);

        aplicarRotacionEuler(rig.cadera, balanceo * 0.35, giroCadera, balanceo * 0.8);
        aplicarRotacionEuler(rig.torso,
            -balanceo * 0.42 + inclinacionTorsoObjetivo,
            -giroCadera * 0.55,
            -balanceo * 1.05 - inclinacionGiro);
        aplicarRotacionEuler(rig.cabeza,
            -balanceo * 0.48 + inclinacionCabezaObjetivo,
            giroCabezaObjetivo - giroCadera * 0.25,
            -contrapasado * 0.012 * movimientoSuave);

        grupo.position.y = numero(config.posicion.y) + rebote;
    }

    // ========================================================
    // AGACHARSE
    // ========================================================

    function animarAgacharse(intensidad = 1) {
        intensidad = limitar(intensidad, 0, 1);
        const curva = suavizar(intensidad);

        aplicarRotacion(rig.cadera, EJE_X, 0.34 * curva);
        aplicarRotacion(rig.torso, EJE_X, 0.28 * curva);

        aplicarRotacion(rig.piernaIzquierda, EJE_X, -0.72 * curva);
        aplicarRotacion(rig.piernaDerecha, EJE_X, -0.72 * curva);
        aplicarRotacion(rig.pantorrillaIzquierda, EJE_X, 0.38 * curva);
        aplicarRotacion(rig.pantorrillaDerecha, EJE_X, 0.38 * curva);

        grupo.position.y = numero(config.posicion.y) - 0.16 * curva;
    }

    // ========================================================
    // ANIMACIÓN DE RECOGIDA
    // ========================================================

    function animarRecogerProcedural() {
        const progreso = limitar(
            tiempoEstado / Math.max(config.tiempoRecoger, 0.01), 0, 1
        );
        const contactoObjetivo = limitar(
            numero(config.progresoContactoProducto, 0.78), 0.55, 0.88
        );
        const acercarse = suavizar(limitar(progreso / contactoObjetivo, 0, 1));
        const contacto = suavizar(limitar(
            (progreso - contactoObjetivo) / Math.max(1 - contactoObjetivo, 0.12), 0, 1
        ));
        const retirada = suavizar(Math.max(0, Math.min(progreso, 1)));
        const agachado = productoEsInferior ? 1 : 0;

        animarAgacharse(agachado * suavizar(progreso * 1.35));

        const hombro = THREE.MathUtils.lerp(-0.08, -1.08 * (productoEsInferior ? 0.72 : 1), acercarse);
        const antebrazo = THREE.MathUtils.lerp(-0.08, -0.78, acercarse);

        aplicarRotacionEuler(rig.brazoDerecho, hombro, -0.06 * acercarse, 0.08 * acercarse);
        aplicarRotacionEuler(rig.antebrazoDerecho, antebrazo, -0.12 * acercarse, 0.06);
        aplicarRotacionEuler(rig.manoDerecha, -0.18 - contacto * 0.58, contacto * 0.08, -0.18 * contacto);

        aplicarRotacionEuler(rig.brazoIzquierdo,
            -0.12 - 0.22 * retirada, 0, 0.06 * retirada);
        aplicarRotacionEuler(rig.antebrazoIzquierdo,
            -0.12 - 0.28 * retirada, 0.04, -0.04);
        aplicarRotacion(rig.manoIzquierda, EJE_X, -0.08 - contacto * 0.16);

        aplicarRotacionEuler(rig.torso,
            0.08 * acercarse + 0.28 * agachado * acercarse,
            -0.10 * acercarse,
            -0.04 * acercarse);
        aplicarRotacionEuler(rig.cabeza,
            0.14 + 0.12 * acercarse + Math.sin(tiempoEstado * 2.1) * 0.018,
            -0.12 * acercarse,
            0.025 * Math.sin(tiempoEstado * 1.6));
        aplicarRotacion(rig.cuello, EJE_X, 0.08 + 0.08 * acercarse);
    }

    // ========================================================
    // ANIMACIÓN DE INSPECCIÓN
    // ========================================================

    function animarInspeccionarProcedural() {
        const entrada = suavizar(Math.min(tiempoEstado / 0.55, 1));
        const salida = suavizar(Math.min((config.tiempoInspeccionar - tiempoEstado) / 0.45, 1));
        const levantar = entrada * salida;
        const giroProducto = Math.sin(tiempoEstado * 1.22) * 0.09;
        const balanceoProducto = Math.sin(tiempoEstado * 2.05) * 0.035;
        const oscilarCabeza = Math.sin(tiempoEstado * 1.18) * 0.032;
        const respiracion = Math.sin(tiempoEstado * 1.75) * 0.012;

        aplicarRotacionEuler(rig.brazoDerecho, -1.08 * levantar + giroProducto,
            0.12 * levantar, 0.10 * Math.sin(tiempoEstado));
        aplicarRotacionEuler(rig.antebrazoDerecho, -0.92 * levantar + balanceoProducto,
            -0.15 * levantar, -0.18);
        aplicarRotacionEuler(rig.manoDerecha, -0.28 + giroProducto,
            balanceoProducto * 0.8, 0.15);

        aplicarRotacionEuler(rig.brazoIzquierdo, -0.76 * levantar,
            -0.10 * levantar, -0.08);
        aplicarRotacionEuler(rig.antebrazoIzquierdo, -0.82 * levantar,
            0.08, 0.12);
        aplicarRotacion(rig.manoIzquierda, EJE_X, -0.22 + giroProducto * 0.35);

        aplicarRotacionEuler(rig.cabeza, 0.20 + oscilarCabeza,
            Math.sin(tiempoEstado * 0.48) * 0.16,
            Math.sin(tiempoEstado * 0.62) * 0.035);
        aplicarRotacion(rig.cuello, EJE_X, 0.08 + respiracion);
        aplicarRotacionEuler(rig.torso, respiracion * 0.8, 0, Math.sin(tiempoEstado * 0.55) * 0.018);

        if (productoEsInferior) {
            animarAgacharse((1 - suavizar(tiempoEstado * 1.5)) * levantar);
        }
    }

    // ========================================================
    // ANIMACIÓN DE GUARDAR
    // ========================================================

    function animarGuardarProcedural() {
        const progreso = limitar(tiempoEstado / Math.max(config.tiempoGuardar, 0.01), 0, 1);
        const bajar = suavizar(limitar(progreso / 0.72, 0, 1));
        const subir = suavizar(limitar((progreso - 0.72) / 0.28, 0, 1));
        const vacilar = Math.sin(tiempoEstado * 5) * 0.025;

        aplicarRotacionEuler(rig.brazoDerecho,
            THREE.MathUtils.lerp(-0.92, -0.36, subir) + vacilar,
            -0.08, 0.08);
        aplicarRotacionEuler(rig.antebrazoDerecho,
            THREE.MathUtils.lerp(-0.88, -0.55, subir), 0, 0.05);
        aplicarRotacionEuler(rig.manoDerecha, -0.25 + vacilar, 0, 0.10);

        aplicarRotacionEuler(rig.brazoIzquierdo, -0.50 + bajar * 0.18,
            0.05, -0.08);
        aplicarRotacionEuler(rig.antebrazoIzquierdo, -0.58 + subir * 0.12,
            0, -0.04);

        aplicarRotacionEuler(rig.torso, 0.08 + bajar * 0.16, 0, -0.025);
        aplicarRotacionEuler(rig.cabeza, 0.14 + bajar * 0.10,
            -0.08, Math.sin(tiempoEstado * 2.3) * 0.02);
    }

    // ========================================================
    // ANIMACIÓN DE DEVOLUCIÓN
    // ========================================================

    function animarDevolverProcedural() {
        const t = suavizar(
            tiempoEstado / Math.max(config.tiempoDevolver, 0.01)
        );

        if (productoEsInferior) {
            animarAgacharse(1 - t * 0.25);
        }

        aplicarRotacionEuler(rig.brazoDerecho,
            THREE.MathUtils.lerp(-1.05, -0.12, t),
            THREE.MathUtils.lerp(-0.08, 0, t),
            0.08);
        aplicarRotacionEuler(rig.antebrazoDerecho,
            THREE.MathUtils.lerp(-0.82, -0.08, t),
            -0.06, -0.04);
        aplicarRotacion(rig.manoDerecha, EJE_X,
            THREE.MathUtils.lerp(-0.55, -0.08, t));

        aplicarRotacionEuler(rig.brazoIzquierdo,
            THREE.MathUtils.lerp(-0.48, -0.1, t), 0, -0.08);
        aplicarRotacionEuler(rig.antebrazoIzquierdo,
            THREE.MathUtils.lerp(-0.58, -0.1, t), 0, 0.04);

        aplicarRotacionEuler(rig.cabeza,
            THREE.MathUtils.lerp(0.18, 0.03, t),
            -0.08 * (1 - t),
            Math.sin(tiempoEstado * 1.9) * 0.025);
    }

    // ========================================================
    // ANIMACIÓN DE PAGO
    // ========================================================

    function animarPagarProcedural() {
        const entrada = suavizar(Math.min(tiempoEstado / 0.65, 1));
        const salida = suavizar(Math.min((2.5 - tiempoEstado) / 0.45, 1));
        const levantar = entrada * salida;
        const mirarCaja = Math.sin(tiempoEstado * 0.9) * 0.035;
        const respiracion = Math.sin(tiempoEstado * 1.8) * 0.012;
        const movimientoPago = Math.sin(tiempoEstado * 2.4) * 0.035;
        const cambioDePeso = Math.sin(tiempoEstado * 0.72) * 0.018;

        aplicarRotacionEuler(rig.brazoDerecho, (-0.88 + movimientoPago) * levantar,
            -0.12 * levantar, 0.10);
        aplicarRotacionEuler(rig.antebrazoDerecho, -0.58 * levantar,
            movimientoPago * 0.35, -0.08);
        aplicarRotacion(rig.manoDerecha, EJE_X, movimientoPago * 0.35);

        aplicarRotacionEuler(rig.brazoIzquierdo, -0.68 * levantar,
            0.08 * levantar, -0.08);
        aplicarRotacionEuler(rig.antebrazoIzquierdo, -0.42 * levantar,
            movimientoPago * -0.18, 0.04);
        aplicarRotacion(rig.manoIzquierda, EJE_X, movimientoPago * -0.2);

        aplicarRotacionEuler(rig.cabeza, 0.08 + mirarCaja,
            Math.sin(tiempoEstado * 0.55) * 0.10,
            Math.sin(tiempoEstado * 0.38) * 0.025);
        aplicarRotacion(rig.cuello, EJE_X, respiracion);
        aplicarRotacionEuler(rig.torso, respiracion * 0.7, 0, cambioDePeso);
        aplicarRotacionEuler(rig.cadera, respiracion * 0.3, 0, -cambioDePeso);
    }

    // ========================================================
    // ACTUALIZAR ANIMACIÓN DE AGARRE
    // ========================================================

    function actualizarAnimacionAgarre(delta) {
        if (!animacionAgarre.activa || !productoEnMano) {
            return false;
        }

        const producto = productoEnMano;
        const mano =
            rig.manoDerecha ||
            rig.brazoDerecho;

        if (!mano) {
            animacionAgarre.activa = false;
            return false;
        }

        grupo.updateMatrixWorld(true);
        mano.updateWorldMatrix(true, true);
        producto.updateMatrixWorld(true);

        animacionAgarre.activa = false;
        return false;
    }

    // ========================================================
    // ACTUALIZAR ANIMACIÓN DE PRODUCTO
    // ========================================================

    function actualizarAnimacionProducto(delta) {
        if (!animacionProducto.activa || !productoEnMano) {
            return false;
        }

        const producto = productoEnMano;

        animacionProducto.tiempo += delta;

        const duracion = Math.max(
            animacionProducto.duracion,
            0.01
        );

        const t = limitar(
            animacionProducto.tiempo / duracion,
            0,
            1
        );

        const suave = suavizar(t);

        const posicion = animacionProducto.posicionTemporal;
        const quaternion = animacionProducto.quaternionTemporal;

        posicion.lerpVectors(
            animacionProducto.posicionInicial,
            animacionProducto.posicionFinal,
            suave
        );

        quaternion.slerpQuaternions(
            animacionProducto.quaternionInicial,
            animacionProducto.quaternionFinal,
            suave
        );

        const padre = producto.parent;

        if (padre) {
            padre.updateMatrixWorld(true);
            const escala =
                animacionProducto.escalaLocalTemporal.lerpVectors(
                animacionProducto.escalaInicial,
                animacionProducto.escalaFinal,
                suave
            );

            animacionProducto.matrizMundoTemporal.compose(
                posicion,
                quaternion,
                escala
            );

            animacionProducto.matrizLocalTemporal
                .copy(padre.matrixWorld)
                .invert()
                .multiply(animacionProducto.matrizMundoTemporal);

            animacionProducto.matrizLocalTemporal.decompose(
                animacionProducto.posicionLocalTemporal,
                producto.quaternion,
                animacionProducto.escalaLocalTemporal
            );

            producto.position.copy(
                animacionProducto.posicionLocalTemporal
            );
            producto.scale.copy(
                animacionProducto.escalaLocalTemporal
            );
            producto.updateMatrixWorld(true);
        }

        if (t >= 1) {
            finalizarDevolucionProducto();
            return true;
        }

        return false;
    }

    // ========================================================
    // FINALIZAR DEVOLUCIÓN
    // ========================================================

    function finalizarDevolucionProducto() {
        if (!productoEnMano || !productoOriginal) {
            animacionProducto.activa = false;
            animacionProducto.tipo = null;

            animacionAgarre.activa = false;
            animacionAgarre.tiempo = 0;

            return;
        }

        const producto = productoEnMano;
        const original = productoOriginal;
        const tipoDevolucion = animacionProducto.tipo;

        animacionAgarre.activa = false;
        animacionAgarre.tiempo = 0;

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

        if (tipoDevolucion === 'REUBICAR') {
            producto.userData.reubicado = true;
            producto.userData.rackAnterior =
                original.rackAnterior ?? null;

            producto.userData.rackNuevo =
                original.rackNuevo ?? null;

            producto.userData.rackReubicado =
                original.rackNuevo ?? null;
        } else {
            producto.userData.reubicado = false;
        }

        producto.userData.reservado = false;
        delete producto.userData.reservadoPor;

        producto.updateMatrixWorld(true);

        productoEnMano = null;
        productoOriginal = null;

        animacionProducto.activa = false;
        animacionProducto.tipo = null;
        animacionProducto.tiempo = 0;

        liberarReserva();
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

                modelo.scale.setScalar(config.escala);

                modelo.traverse(obj => {
                    if (!obj.isMesh) return;

                    obj.castShadow = false;
                    obj.receiveShadow = false;

                    if (obj.material) {
                        obj.material.side = THREE.FrontSide;
                    }
                });

                const caja = new THREE.Box3().setFromObject(modelo);
                const centro = new THREE.Vector3();

                caja.getCenter(centro);

                modelo.position.x -= centro.x;
                modelo.position.z -= centro.z;
                modelo.position.y -= caja.min.y;

                grupo.add(modelo);

                detectarHuesos(modelo);
                actualizarRig();

                if (gltf.animations?.length) {
                    mixer = new THREE.AnimationMixer(modelo);

                    const caminar = gltf.animations.find(clip =>
                        /walk|walking|caminar/i.test(clip.name)
                    );

                    const reposo = gltf.animations.find(clip =>
                        /idle|stand|rest|reposo/i.test(clip.name)
                    );

                    if (caminar) {
                        accionCaminar = mixer.clipAction(caminar);
                        accionCaminar.setEffectiveTimeScale(
                            config.velocidadAnimacionGLB
                        );
                    }

                    if (reposo) {
                        accionReposo = mixer.clipAction(reposo);
                        accionReposo.play();
                    }
                }

                cargado = true;

                console.log(
                    `[CLIENTE ${id}] Modelo cargado: ${config.modelo}`
                );
            },

            undefined,

            error => {
                console.error(
                    `[CLIENTE ${id}] Error cargando modelo:`,
                    error
                );
            }
        );
    }

    cargarModelo();

    // ========================================================
    // CAMBIAR ESTADO
    // ========================================================

    function cambiarEstado(nuevoEstado) {
        if (estado === nuevoEstado) return;

        const anterior = estado;

        estado = nuevoEstado;
        tiempoEstado = 0;

        intentosMovimiento = 0;
        tiempoRecalculoRuta = 0;
        tiempoSinMovimiento = 0;
        ultimaPosicionMovimiento.set(
            grupo.position.x,
            grupo.position.y,
            grupo.position.z
        );

        const caminando = [
            ESTADOS.ENTRANDO,
            ESTADOS.ACERCANDO,
            ESTADOS.RUTA,
            ESTADOS.CAJA,
            ESTADOS.REGRESANDO
        ].includes(estado);

        const animacionProcedural = [
            ESTADOS.RECOGIENDO,
            ESTADOS.INSPECCIONANDO,
            ESTADOS.GUARDANDO,
            ESTADOS.DEVOLVIENDO,
            ESTADOS.PAGANDO
        ].includes(estado);

        if (caminando) {
            const usaGLB = activarCaminarGLB();

            if (!usaGLB) {
                detenerAccionesGLB();
            }
        } else if (animacionProcedural) {
            detenerAccionesGLB();
        } else {
            detenerAccionesGLB();
            activarReposoGLB();
        }

        if (
            !caminando &&
            nuevoEstado !== ESTADOS.DEVOLVIENDO &&
            nuevoEstado !== ESTADOS.INSPECCIONANDO &&
            nuevoEstado !== ESTADOS.RECOGIENDO
        ) {
            restaurarPoseCompleta();
        }

        try {
            config.alCambiarEstado?.({
                cliente: api,
                anterior,
                estado: nuevoEstado
            });
        } catch (error) {
            console.error(error);
        }
    }

    // ========================================================
    // COLISIONES
    // ========================================================

    let obstaculosCache = [];

    function obtenerObstaculos() {
        const obstaculos = [];

        if (Array.isArray(config.colisiones)) {
            for (const colision of config.colisiones) {
                if (!colision) continue;

                obstaculos.push({
                    x: numero(colision.x),
                    z: numero(colision.z),

                    ancho: numero(
                        colision.ancho,
                        colision.width ?? 1
                    ),

                    profundidad: numero(
                        colision.profundidad,
                        colision.depth ?? 1
                    )
                });
            }
        }

        if (config.mobiliario?.traverse) {
            config.mobiliario.updateMatrixWorld(true);

            config.mobiliario.traverse(obj => {
                if (
                    !obj.isMesh ||
                    obj.userData?.sinColision ||
                    obj.userData?.esProducto
                ) {
                    return;
                }

                cajaTemporal.setFromObject(obj);

                if (cajaTemporal.isEmpty()) return;

                cajaTemporal.getCenter(vectorTemporal);
                cajaTemporal.getSize(tamanoTemporal);

                if (tamanoTemporal.y > 3.5) return;
                if (tamanoTemporal.x < 0.08 || tamanoTemporal.z < 0.08) {
                    return;
                }

                obstaculos.push({
                    x: vectorTemporal.x,
                    z: vectorTemporal.z,
                    ancho: tamanoTemporal.x,
                    profundidad: tamanoTemporal.z
                });
            });
        }

        return obstaculos;
    }

    function actualizarColisiones() {
        obstaculosCache = obtenerObstaculos();
        tiempoActualizarObstaculos = 0;
    }

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
            config.radioColision +
            config.margenObstaculos;

        const dentroPuerta = estaEnCorredorPuerta(x, z);

        for (const obstaculo of obstaculosCache) {
            if (
                dentroPuerta &&
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

    function segmentoLibre(a, b) {
        const distancia = distanciaXZ(a, b);

        const pasos = Math.max(
            1,
            Math.ceil(distancia / 0.30)
        );

        for (let i = 0; i <= pasos; i++) {
            const t = i / pasos;

            const x = THREE.MathUtils.lerp(a.x, b.x, t);
            const z = THREE.MathUtils.lerp(a.z, b.z, t);

            if (!puntoLibre(x, z)) return false;
        }

        return true;
    }

    // ========================================================
    // A* OPTIMIZADO
    // ========================================================

    function claveCelda(x, z) {
        return `${x},${z}`;
    }

    function encontrarCamino(origen, destino) {
        if (!origen || !destino) return [];

        const inicio = {
            x: numero(origen.x),
            z: numero(origen.z)
        };

        const fin = {
            x: numero(destino.x),
            z: numero(destino.z)
        };

        if (!puntoLibre(fin.x, fin.z)) {
            let mejor = null;
            let mejorDistancia = Infinity;

            for (let radio = 0.4; radio <= 2.8; radio += 0.4) {
                for (
                    let angulo = 0;
                    angulo < Math.PI * 2;
                    angulo += Math.PI / 4
                ) {
                    const candidato = {
                        x: fin.x + Math.cos(angulo) * radio,
                        z: fin.z + Math.sin(angulo) * radio
                    };

                    if (!puntoLibre(candidato.x, candidato.z)) {
                        continue;
                    }

                    const d = distanciaXZ(candidato, fin);

                    if (d < mejorDistancia) {
                        mejor = candidato;
                        mejorDistancia = d;
                    }
                }

                if (mejor) break;
            }

            if (!mejor) return [];

            fin.x = mejor.x;
            fin.z = mejor.z;
        }

        if (segmentoLibre(inicio, fin)) {
            return [fin];
        }

        const celda = config.tamanoCelda;

        const aX = Math.round(inicio.x / celda);
        const aZ = Math.round(inicio.z / celda);

        const bX = Math.round(fin.x / celda);
        const bZ = Math.round(fin.z / celda);

        const inicioClave = claveCelda(aX, aZ);
        const finClave = claveCelda(bX, bZ);

        const heap = new MinHeap();

        const nodos = new Map();
        const cerrados = new Set();

        const nodoInicio = {
            x: aX,
            z: aZ,
            g: 0,
            h: Math.hypot(bX - aX, bZ - aZ),
            f: 0,
            padre: null
        };

        nodoInicio.f = nodoInicio.g + nodoInicio.h;

        heap.insertar(nodoInicio);
        nodos.set(inicioClave, nodoInicio);

        const direcciones = [
            [1, 0, 1],
            [-1, 0, 1],
            [0, 1, 1],
            [0, -1, 1],

            [1, 1, 1.414],
            [1, -1, 1.414],
            [-1, 1, 1.414],
            [-1, -1, 1.414]
        ];

        let encontrado = null;
        let iteraciones = 0;

        while (heap.length && iteraciones < 12000) {
            iteraciones++;

            const actual = heap.extraer();

            if (!actual) break;

            const actualClave = claveCelda(
                actual.x,
                actual.z
            );

            if (cerrados.has(actualClave)) continue;

            const mejorNodo = nodos.get(actualClave);

            if (mejorNodo !== actual) continue;

            if (actualClave === finClave) {
                encontrado = actual;
                break;
            }

            cerrados.add(actualClave);

            for (const [dx, dz, costo] of direcciones) {
                const nx = actual.x + dx;
                const nz = actual.z + dz;

                const mundoX = nx * celda;
                const mundoZ = nz * celda;

                const vecinoClave = claveCelda(nx, nz);

                if (cerrados.has(vecinoClave)) continue;
                if (!puntoLibre(mundoX, mundoZ)) continue;

                if (dx !== 0 && dz !== 0) {
                    if (
                        !puntoLibre(
                            actual.x * celda + dx * celda,
                            actual.z * celda
                        ) ||
                        !puntoLibre(
                            actual.x * celda,
                            actual.z * celda + dz * celda
                        )
                    ) {
                        continue;
                    }
                }

                const nuevoG = actual.g + costo;
                const existente = nodos.get(vecinoClave);

                if (existente && nuevoG >= existente.g) {
                    continue;
                }

                const h = Math.hypot(
                    bX - nx,
                    bZ - nz
                );

                const vecino = {
                    x: nx,
                    z: nz,
                    g: nuevoG,
                    h,
                    f: nuevoG + h,
                    padre: actual
                };

                nodos.set(vecinoClave, vecino);
                heap.insertar(vecino);
            }
        }

        if (!encontrado) return [];

        const camino = [];

        let actual = encontrado;

        while (actual) {
            camino.unshift({
                x: actual.x * celda,
                z: actual.z * celda
            });

            actual = actual.padre;
        }

        camino.shift();
        camino.push(fin);

        const suavizado = [];

        let puntoActual = inicio;
        let indice = 0;

        while (indice < camino.length) {
            let siguiente = indice;

            for (
                let j = camino.length - 1;
                j >= indice;
                j--
            ) {
                if (segmentoLibre(puntoActual, camino[j])) {
                    siguiente = j;
                    break;
                }
            }

            suavizado.push(camino[siguiente]);

            puntoActual = camino[siguiente];
            indice = siguiente + 1;
        }

        return suavizado;
    }

    // ========================================================
    // MOVIMIENTO Y RECUPERACIÓN
    // ========================================================

    function orientarHacia(dx, dz, delta = 0.016) {
        if (Math.abs(dx) + Math.abs(dz) < 0.0001) {
            intensidadGiro = THREE.MathUtils.lerp(intensidadGiro, 0, 0.12);
            return;
        }

        rotacionObjetivo =
            Math.atan2(dx, dz) +
            config.correccionRotacion;

        let diferencia = rotacionObjetivo - grupo.rotation.y;

        while (diferencia > Math.PI) diferencia -= Math.PI * 2;
        while (diferencia < -Math.PI) diferencia += Math.PI * 2;

        const velocidadGiro = 1 - Math.exp(-config.suavizadoGiro * Math.max(delta, 0.001));
        grupo.rotation.y += diferencia * velocidadGiro;

        intensidadGiro = THREE.MathUtils.lerp(
            intensidadGiro,
            limitar(Math.abs(diferencia) / 0.6, 0, 1),
            1 - Math.exp(-8 * Math.max(delta, 0.001))
        );

        inclinacionTorsoObjetivo = THREE.MathUtils.lerp(
            inclinacionTorsoObjetivo,
            limitar(diferencia * -0.12, -0.08, 0.08) * movimientoSuave,
            0.12
        );
    }

    function orientarHaciaPunto(punto) {
        if (!punto) return;

        const dx = punto.x - grupo.position.x;
        const dz = punto.z - grupo.position.z;

        orientarHacia(dx, dz);
    }

    function establecerObjetivo(
        destino,
        nuevoEstado = ESTADOS.RUTA
    ) {
        if (!destino) return false;

        const punto = {
            x: limitar(
                numero(destino.x, grupo.position.x),
                -config.limiteX,
                config.limiteX
            ),

            z: limitar(
                numero(destino.z, grupo.position.z),
                config.limiteZMin,
                config.limiteZMax
            )
        };

        const camino = encontrarCamino(
            grupo.position,
            punto
        );

        if (!camino.length) return false;

        ruta = camino;
        indiceRuta = 0;
        objetivo = camino[camino.length - 1];

        intentosMovimiento = 0;
        tiempoRecalculoRuta = 0;

        ultimaPosicionMovimiento.set(
            grupo.position.x,
            grupo.position.y,
            grupo.position.z
        );

        cambiarEstado(nuevoEstado);

        return true;
    }

    function recuperarMovimiento(forzar = false) {
        if (!objetivo) return false;

        if (!forzar && tiempoRecalculoRuta < config.intervaloRecalculoRuta) {
            return false;
        }

        tiempoRecalculoRuta = 0;
        intentosMovimiento++;

        const nuevoCamino = encontrarCamino(
            grupo.position,
            objetivo
        );

        if (nuevoCamino.length) {
            ruta = nuevoCamino;
            indiceRuta = 0;
            intentosMovimiento = 0;

            return true;
        }

        return false;
    }

    function resolverClienteAtascado() {
        console.warn(
            `[CLIENTE ${id}] Se detectó movimiento detenido por 5 segundos.`
        );

        liberarReserva();
        ruta = [];
        objetivo = null;
        intentosMovimiento = 0;
        tiempoSinMovimiento = 0;

        if (estado === ESTADOS.REGRESANDO) {
            cambiarEstado(ESTADOS.ESPERANDO);
            return;
        }

        if (estado === ESTADOS.ENTRANDO) {
            cambiarEstado(ESTADOS.ESPERANDO);
            return;
        }

        if (estado === ESTADOS.CAJA) {
            cambiarEstado(ESTADOS.ESPERANDO);
            return;
        }

        if (compras.length >= config.maximoProductos) {
            if (!dirigirseACaja()) {
                cambiarEstado(ESTADOS.ESPERANDO);
            }
            return;
        }

        iniciarPaseo();
    }

    function moverHaciaDestino(delta) {
        if (!ruta.length || indiceRuta >= ruta.length) {
            return true;
        }

        const destino = ruta[indiceRuta];

        const dx = destino.x - grupo.position.x;
        const dz = destino.z - grupo.position.z;

        const distancia = Math.hypot(dx, dz);

        if (distancia < config.distanciaLlegada) {
            grupo.position.x = destino.x;
            grupo.position.z = destino.z;
            grupo.position.y = numero(config.posicion.y);

            indiceRuta++;

            if (indiceRuta >= ruta.length) {
                ruta = [];
                objetivo = null;
                return true;
            }

            return false;
        }

        let velocidad = config.velocidad;

        if (estado === ESTADOS.ENTRANDO) {
            velocidad = config.velocidadEntrada;
        }

        if (estado === ESTADOS.REGRESANDO) {
            velocidad = config.velocidadRegreso;
        }

        const direccionX = dx / distancia;
        const direccionZ = dz / distancia;

        orientarHacia(direccionX, direccionZ, delta);

        const distanciaFrenado = Math.min(1.5, velocidad * 0.9);
        const factorDestino = limitar(distancia / distanciaFrenado, 0.18, 1);
        const velocidadDeseada = velocidad * factorDestino;
        const tasa = Math.max(1, config.aceleracionMovimiento);

        velocidadActual = THREE.MathUtils.lerp(
            velocidadActual,
            velocidadDeseada,
            1 - Math.exp(-tasa * delta)
        );

        movimientoSuave = THREE.MathUtils.lerp(
            movimientoSuave,
            limitar(velocidadActual / Math.max(velocidad, 0.1), 0, 1),
            1 - Math.exp(-5 * delta)
        );

        const avance = Math.min(
            distancia,
            velocidadActual * delta
        );

        const nuevoX =
            grupo.position.x + direccionX * avance;

        const nuevoZ =
            grupo.position.z + direccionZ * avance;

        if (
            !segmentoLibre(
                grupo.position,
                { x: nuevoX, z: nuevoZ }
            )
        ) {
            tiempoRecalculoRuta += delta;

            recuperarMovimiento();

            if (
                intentosMovimiento >=
                config.maximosIntentosMovimiento
            ) {
                console.warn(
                    `[CLIENTE ${id}] No pudo continuar su ruta.`
                );

                ruta = [];
                objetivo = null;
                intentosMovimiento = 0;

                if (estado === ESTADOS.REGRESANDO) {
                    cambiarEstado(ESTADOS.ESPERANDO);
                } else {
                    liberarReserva();
                    cambiarEstado(ESTADOS.BUSCANDO);
                }
            }

            return false;
        }

        grupo.position.x = nuevoX;
        grupo.position.z = nuevoZ;
        grupo.position.y = numero(config.posicion.y);

        tiempoRecalculoRuta = 0;
        intentosMovimiento = 0;

        animarCaminarProcedural(delta);

        return false;
    }

    function establecerRuta(puntos, repetir = false) {
        if (!Array.isArray(puntos) || !puntos.length) {
            return false;
        }

        const camino = [];

        let actual = {
            x: grupo.position.x,
            z: grupo.position.z
        };

        for (const punto of puntos) {
            const segmento = encontrarCamino(actual, punto);

            if (!segmento.length) continue;

            camino.push(...segmento);
            actual = segmento[segmento.length - 1];
        }

        if (!camino.length) return false;

        ruta = camino;
        indiceRuta = 0;
        objetivo = camino[camino.length - 1];

        config.repetirRuta = repetir;

        cambiarEstado(ESTADOS.RUTA);

        return true;
    }

    function establecerPosicion(posicion) {
        if (!posicion) return false;

        grupo.position.set(
            numero(posicion.x, grupo.position.x),
            numero(posicion.y, numero(config.posicion.y)),
            numero(posicion.z, grupo.position.z)
        );

        ruta = [];
        objetivo = null;

        intentosMovimiento = 0;
        tiempoRecalculoRuta = 0;

        return true;
    }

    // ========================================================
    // OBTENER PRODUCTOS
    // ========================================================

    function obtenerProductos() {
        if (Array.isArray(config.productos)) {
            return config.productos;
        }

        if (config.productos?.traverse) {
            const encontrados = [];

            config.productos.traverse(obj => {
                if (obj.userData?.esProducto) {
                    encontrados.push(obj);
                }
            });

            return encontrados;
        }

        return [];
    }

    function productoDisponible(producto) {
        if (!producto || !producto.visible) return false;

        if (producto.userData?.vendido) return false;
        if (producto.userData?.enCarrito) return false;

        const propietario = reservasProductos.get(producto);

        if (propietario !== undefined && propietario !== id) {
            return false;
        }

        if (
            producto.userData?.reservado &&
            producto.userData?.reservadoPor !== id
        ) {
            return false;
        }

        return true;
    }

    function reservarProducto(producto) {
        if (!productoDisponible(producto)) return false;
        if (!reservarRack(producto)) return false;

        reservasProductos.set(producto, id);

        producto.userData.reservado = true;
        producto.userData.reservadoPor = id;

        productoObjetivo = producto;

        return true;
    }

    function liberarReserva() {
        liberarRack();

        if (productoObjetivo) {
            if (reservasProductos.get(productoObjetivo) === id) {
                reservasProductos.delete(productoObjetivo);

                productoObjetivo.userData.reservado = false;

                delete productoObjetivo.userData.reservadoPor;
            }
        }

        productoObjetivo = null;
    }

    // ========================================================
    // FILTRO DE PRODUCTOS POR CLIENTE
    // ========================================================

    function esProductoBuscado(producto) {
        if (!producto) return false;

        const datos = producto.userData ?? {};

        // Revisar todos los identificadores posibles del producto.
        const identificadores = [
            datos.nombre,
            datos.nombreProducto,
            datos.categoria,
            datos.codigo,
            datos.tipo,
            datos.name,
            producto.name,
            producto.producto?.name,
            producto.producto?.nombre
        ];

        const nombresNormalizados = identificadores
            .filter(valor =>
                valor !== undefined &&
                valor !== null &&
                String(valor).trim() !== ''
            )
            .map(valor => normalizarNombre(valor))
            .filter(Boolean);

        // ----------------------------------------------------
        // CLIENTE ESPECIALIZADO EN PLÁTANOS
        // ----------------------------------------------------

        if (config.soloPlatanos) {
            const aliasPlatanos = [
                'platano',
                'platanos',
                'banana',
                'bananas'
            ];

            const coincidePlatano = nombresNormalizados.some(nombre =>
                aliasPlatanos.some(alias =>
                    nombre.includes(alias)
                )
            );

            // Si está especializado en plátanos,
            // no se aplica ningún otro filtro.
            return coincidePlatano;
        }

        // ----------------------------------------------------
        // FILTRO GENÉRICO PARA OTROS CLIENTES
        // ----------------------------------------------------

        if (config.nombreProductoBuscado) {
            const buscado = normalizarNombre(
                config.nombreProductoBuscado
            );

            if (!buscado) return true;

            return nombresNormalizados.some(nombre =>
                nombre.includes(buscado)
            );
        }

        // Cliente normal: puede comprar cualquier producto.
        return true;
    }

    // ========================================================
    // BUSCAR PRODUCTOS
    // ========================================================

    function buscarProducto() {
        const productos = obtenerProductos();

        const candidatos = [];

        for (const producto of productos) {
            if (!productoDisponible(producto)) continue;

            // El Cliente 2 solo puede elegir plátanos.
            if (!esProductoBuscado(producto)) continue;

            if (productosExaminados.has(producto)) continue;

            const claveRack = obtenerClaveRack(producto);

            if (!rackDisponible(producto)) continue;

            producto.getWorldPosition(vectorTemporal);

            const distancia = distanciaXZ(
                grupo.position,
                vectorTemporal
            );

            if (distancia > config.distanciaMaximaBusqueda) {
                continue;
            }

            candidatos.push({
                producto,
                claveRack,
                distancia
            });
        }

        if (!candidatos.length) return null;

        let sinVisitar = candidatos.filter(
            candidato => !racksVisitados.has(candidato.claveRack)
        );

        if (!sinVisitar.length) {
            racksVisitados.clear();
            sinVisitar = candidatos;
        }

        sinVisitar.sort((a, b) => {
            const puntuacionA = a.distancia + Math.random() * 3;
            const puntuacionB = b.distancia + Math.random() * 3;

            return puntuacionA - puntuacionB;
        });

        return sinVisitar[0]?.producto ?? null;
    }

    // ========================================================
    // POSICIÓN FRENTE AL PRODUCTO
    // ========================================================

    function obtenerPuntoFrenteProducto(producto) {
        producto.getWorldPosition(vectorTemporal);

        const posicionProducto = {
            x: vectorTemporal.x,
            z: vectorTemporal.z
        };

        const candidatos = [];

        const radioMinimo = Math.max(
            0.75,
            numero(config.distanciaProducto, 1.35)
        );

        const radioMaximo = Math.max(
            radioMinimo + 0.4,
            numero(config.distanciaFrenteProducto, 1.25) + 1.2
        );

        for (
            let radio = radioMinimo;
            radio <= radioMaximo;
            radio += 0.3
        ) {
            for (
                let angulo = 0;
                angulo < Math.PI * 2;
                angulo += Math.PI / 8
            ) {
                const punto = {
                    x: posicionProducto.x + Math.cos(angulo) * radio,
                    z: posicionProducto.z + Math.sin(angulo) * radio
                };

                if (!puntoLibre(punto.x, punto.z)) continue;

                const camino = encontrarCamino(
                    grupo.position,
                    punto
                );

                if (!camino.length) continue;

                candidatos.push({
                    ...punto,
                    distancia: distanciaXZ(grupo.position, punto)
                });
            }

            if (candidatos.length) break;
        }

        if (!candidatos.length) return null;

        candidatos.sort(
            (a, b) => a.distancia - b.distancia
        );

        return candidatos[0];
    }

    function acercarseAProducto(producto) {
        if (!reservarProducto(producto)) return false;

        const destino = obtenerPuntoFrenteProducto(producto);

        if (!destino) {
            liberarReserva();
            return false;
        }

        if (
            !establecerObjetivo(
                destino,
                ESTADOS.ACERCANDO
            )
        ) {
            liberarReserva();
            return false;
        }

        return true;
    }

    // ========================================================
    // TOMAR PRODUCTO
    // ========================================================

    function tomarProducto() {
        if (
            !productoObjetivo ||
            !productoDisponible(productoObjetivo)
        ) {
            liberarReserva();
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        const producto = productoObjetivo;

        producto.updateMatrixWorld(true);

        productoEsInferior =
            productoEstaEnEstanteInferior(producto);

        cajaTemporal.setFromObject(producto);

        const tamanoProducto = new THREE.Vector3();

        cajaTemporal.getSize(tamanoProducto);

        productoOriginal = {
            parent: producto.parent,

            posicion: producto.position.clone(),
            quaternion: producto.quaternion.clone(),
            escala: producto.scale.clone(),

            visible: producto.visible,
            tamanoMundo: tamanoProducto.clone()
        };

        const mano =
            rig.manoDerecha ||
            rig.brazoDerecho;

        if (!mano) {
            console.warn(
                `[CLIENTE ${id}] No se encontró la mano derecha.`
            );

            productoOriginal = null;

            liberarReserva();
            cambiarEstado(ESTADOS.BUSCANDO);

            return;
        }

        producto.getWorldPosition(vectorTemporal);

        orientarHaciaPunto({
            x: vectorTemporal.x,
            z: vectorTemporal.z
        });

        grupo.updateMatrixWorld(true);
        mano.updateMatrixWorld(true);
        producto.updateMatrixWorld(true);

        mano.attach(producto);

        producto.updateMatrixWorld(true);

        animacionAgarre.posicionInicial.copy(producto.position);
        animacionAgarre.quaternionInicial.copy(producto.quaternion);
        animacionAgarre.escalaInicial.copy(producto.scale);
        animacionAgarre.posicionFinal.copy(producto.position);
        animacionAgarre.quaternionFinal.copy(producto.quaternion);
        animacionAgarre.escalaFinal.copy(producto.scale);

        animacionAgarre.tiempo = 0;

        animacionAgarre.duracion = Math.max(
            numero(config.tiempoAnimacionAgarre, 0.38),
            0.05
        );

        animacionAgarre.activa = false;

        producto.visible = true;
        productoEnMano = producto;

        productosExaminados.add(producto);

        cambiarEstado(ESTADOS.INSPECCIONANDO);

        console.log(
            `[CLIENTE ${id}] Agarró ${
                producto.userData?.nombre ??
                producto.name ??
                'producto'
            }.`
        );
    }

    // ========================================================
    // BUSCAR UBICACIÓN EN OTRO RACK
    // ========================================================

    function buscarUbicacionOtroRack(producto) {
        if (!producto || !productoOriginal) return null;

        const productos = obtenerProductos();

        const rackActual =
            rackReservado ?? obtenerClaveRack(producto);

        const tamanoProducto =
            productoOriginal.tamanoMundo ??
            new THREE.Vector3(0.3, 0.3, 0.3);

        const candidatos = [];

        for (const ancla of productos) {
            if (!ancla || ancla === producto) continue;
            if (!ancla.visible) continue;

            if (ancla.userData?.vendido) continue;
            if (ancla.userData?.enCarrito) continue;

            if (!ancla.parent) continue;

            const claveRack = obtenerClaveRack(ancla);

            if (claveRack === rackActual) continue;
            if (!rackDisponible(ancla)) continue;

            ancla.updateMatrixWorld(true);

            cajaTemporal.setFromObject(ancla);

            if (cajaTemporal.isEmpty()) continue;

            const tamanoAncla = new THREE.Vector3();

            cajaTemporal.getSize(tamanoAncla);

            const posicionAncla = new THREE.Vector3();

            ancla.getWorldPosition(posicionAncla);

            const separacion = config.separacionProductoRack;

            const desplazamientoX =
                tamanoAncla.x / 2 +
                tamanoProducto.x / 2 +
                separacion;

            const desplazamientoZ =
                tamanoAncla.z / 2 +
                tamanoProducto.z / 2 +
                separacion;

            const posiciones = [
                { x: desplazamientoX, z: 0 },
                { x: -desplazamientoX, z: 0 },
                { x: 0, z: desplazamientoZ },
                { x: 0, z: -desplazamientoZ }
            ];

            for (const desplazamiento of posiciones) {
                const posicionMundo = new THREE.Vector3(
                    posicionAncla.x + desplazamiento.x,
                    posicionAncla.y,
                    posicionAncla.z + desplazamiento.z
                );

                const padre = ancla.parent;

                padre.updateMatrixWorld(true);

                const posicionLocal =
                    padre.worldToLocal(posicionMundo.clone());

                const quaternionLocal = ancla.quaternion.clone();

                let ocupado = false;

                const cajaPosicion = new THREE.Box3()
                    .setFromCenterAndSize(
                        posicionMundo,
                        tamanoProducto
                    );

                for (const otro of productos) {
                    if (
                        !otro ||
                        otro === producto ||
                        otro === ancla ||
                        !otro.visible
                    ) {
                        continue;
                    }

                    otro.updateMatrixWorld(true);

                    const cajaOtro =
                        new THREE.Box3().setFromObject(otro);

                    if (cajaOtro.intersectsBox(cajaPosicion)) {
                        ocupado = true;
                        break;
                    }
                }

                if (ocupado) continue;

                const distancia = distanciaXZ(
                    grupo.position,
                    posicionMundo
                );

                candidatos.push({
                    ancla,
                    claveRack,
                    padre,

                    posicionMundo,
                    posicionLocal,
                    quaternionLocal,

                    escala: productoOriginal.escala.clone(),

                    distancia
                });
            }
        }

        if (!candidatos.length) return null;

        candidatos.sort(
            (a, b) => a.distancia - b.distancia
        );

        const cantidad = Math.min(3, candidatos.length);

        return candidatos[
            Math.floor(Math.random() * cantidad)
        ];
    }

    // ========================================================
    // PREPARAR REUBICACIÓN
    // ========================================================

    function prepararDevolucionEnOtroRack() {
        if (!productoEnMano || !productoOriginal) {
            return false;
        }

        const ubicacion = buscarUbicacionOtroRack(
            productoEnMano
        );

        if (!ubicacion) return false;

        const rackAnterior =
            rackReservado ?? obtenerClaveRack(productoEnMano);

        const escalaOriginal =
            productoOriginal.escala.clone();

        const tamanoOriginal =
            productoOriginal.tamanoMundo.clone();

        liberarReserva();

        if (!reservarRack(ubicacion.ancla)) {
            return false;
        }

        productoOriginal = {
            parent: ubicacion.padre,

            posicion: ubicacion.posicionLocal.clone(),
            quaternion: ubicacion.quaternionLocal.clone(),

            escala: escalaOriginal,
            visible: true,

            tamanoMundo: tamanoOriginal,

            rackAnterior,
            rackNuevo: ubicacion.claveRack
        };

        animacionProducto.tipo = 'REUBICAR';

        console.log(
            `[CLIENTE ${id}] Dejará el producto en otro rack.`,
            ubicacion.claveRack
        );

        return true;
    }

    // ========================================================
    // INICIAR DEVOLUCIÓN O REUBICACIÓN
    // ========================================================

    function devolverProductoAlEstante() {
        if (!productoEnMano || !productoOriginal) {
            productoEnMano = null;
            productoOriginal = null;

            animacionProducto.activa = false;
            animacionAgarre.activa = false;

            liberarReserva();
            return;
        }

        if (animacionProducto.activa) return;

        const producto = productoEnMano;
        const original = productoOriginal;

        if (!original.parent) {
            finalizarDevolucionProducto();
            return;
        }

        animacionAgarre.activa = false;
        animacionAgarre.tiempo = 0;

        grupo.updateMatrixWorld(true);
        producto.updateMatrixWorld(true);
        original.parent.updateMatrixWorld(true);

        const posicionMundo = new THREE.Vector3();
        const quaternionMundo = new THREE.Quaternion();
        const escalaMundo = new THREE.Vector3();

        producto.getWorldPosition(posicionMundo);
        producto.getWorldQuaternion(quaternionMundo);
        producto.getWorldScale(escalaMundo);

        const matrizOriginal = new THREE.Matrix4();

        matrizOriginal.compose(
            original.posicion,
            original.quaternion,
            original.escala
        );

        const matrizMundoOriginal = new THREE.Matrix4();

        matrizMundoOriginal.multiplyMatrices(
            original.parent.matrixWorld,
            matrizOriginal
        );

        const posicionFinal = new THREE.Vector3();
        const quaternionFinal = new THREE.Quaternion();
        const escalaFinal = new THREE.Vector3();

        matrizMundoOriginal.decompose(
            posicionFinal,
            quaternionFinal,
            escalaFinal
        );

        animacionProducto.activa = true;

        if (animacionProducto.tipo !== 'REUBICAR') {
            animacionProducto.tipo = 'DEVOLVER';
        }

        animacionProducto.tiempo = 0;
        animacionProducto.duracion = Math.max(
            config.tiempoDevolver,
            0.05
        );

        animacionProducto.posicionInicial.copy(posicionMundo);
        animacionProducto.posicionFinal.copy(posicionFinal);

        animacionProducto.quaternionInicial.copy(quaternionMundo);
        animacionProducto.quaternionFinal.copy(quaternionFinal);

        animacionProducto.escalaInicial.copy(escalaMundo);
        animacionProducto.escalaFinal.copy(escalaFinal);
    }

    // ========================================================
    // GUARDAR PRODUCTO EN CARRITO
    // ========================================================

    function guardarProducto() {
        if (!productoEnMano) {
            liberarReserva();
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        const producto = productoEnMano;
        const datos = producto.userData ?? {};

        animacionAgarre.activa = false;
        animacionAgarre.tiempo = 0;

        const compra = {
            objeto: producto,

            nombre:
                datos.nombre ??
                producto.name ??
                'Producto',

            codigo: datos.codigo ?? '',

            precio: numero(datos.precio, 0)
        };

        let agregado = false;

        try {
            if (config.carrito?.agregarProducto) {
                agregado =
                    config.carrito.agregarProducto(producto, {
                        nombre: compra.nombre,
                        precio: compra.precio,
                        cantidad: 1
                    }) === true;

            } else if (config.carrito?.agregar) {
                agregado =
                    config.carrito.agregar(producto) === true;
            }
        } catch (error) {
            console.error(
                `[CLIENTE ${id}] Error al agregar al carrito:`,
                error
            );
        }

        if (!agregado) {
            console.error(
                `[CLIENTE ${id}] No se pudo agregar ${compra.nombre} al carrito.`
            );

            if (productoOriginal) {
                animacionProducto.tipo = 'DEVOLVER';

                devolverProductoAlEstante();

                cambiarEstado(ESTADOS.DEVOLVIENDO);
            } else {
                productoEnMano = null;
                productoOriginal = null;

                liberarReserva();

                cambiarEstado(ESTADOS.BUSCANDO);
            }

            return;
        }

        compras.push(compra);

        producto.userData.enCarrito = true;
        producto.userData.reservado = false;

        delete producto.userData.reservadoPor;

        productoEnMano = null;
        productoOriginal = null;

        animacionProducto.activa = false;
        animacionProducto.tipo = null;

        liberarReserva();

        try {
            config.alComprar?.({
                cliente: api,
                producto: compra,
                totalProductos: compras.length
            });
        } catch (error) {
            console.error(
                `[CLIENTE ${id}] Error en alComprar:`,
                error
            );
        }

        console.log(
            `[CLIENTE ${id}] Producto agregado: ${compra.nombre}`,
            `| Total: ${config.carrito?.cantidadProductos ?? 'N/D'}`
        );

        cambiarEstado(ESTADOS.BUSCANDO);
    }

    // ========================================================
    // DECIDIR COMPRA
    // ========================================================

    function decidirCompra() {
        if (compras.length >= config.maximoProductos) {
            dirigirseACaja();
            return;
        }

        const producto = buscarProducto();

        if (!producto) {
            if (compras.length > 0) {
                dirigirseACaja();
            } else {
                cambiarEstado(ESTADOS.ESPERANDO);
            }

            return;
        }

        if (!acercarseAProducto(producto)) {
            liberarReserva();
            cambiarEstado(ESTADOS.ESPERANDO);
        }
    }

    // ========================================================
    // RECORRIDO INTERIOR
    // ========================================================

    const puntosRecorrido = [
        { x: -25, z: 16 },
        { x: -20, z: 10 },
        { x: -15, z: 5 },
        { x: -8, z: 5 },
        { x: 0, z: 5 },
        { x: 8, z: 5 },
        { x: 15, z: 5 },
        { x: 23, z: 10 },
        { x: 25, z: 16 },
        { x: 15, z: -5 },
        { x: 5, z: -10 },
        { x: -5, z: -10 },
        { x: -15, z: -5 }
    ];

    let indiceRecorrido = 0;

    function siguientePuntoRecorrido() {
        for (
            let i = 0;
            i < puntosRecorrido.length;
            i++
        ) {
            const indice =
                (indiceRecorrido + i) %
                puntosRecorrido.length;

            const candidato = puntosRecorrido[indice];

            if (
                puntoLibre(candidato.x, candidato.z) &&
                distanciaXZ(grupo.position, candidato) > 2
            ) {
                indiceRecorrido =
                    (indice + 1) % puntosRecorrido.length;

                return candidato;
            }
        }

        return { x: 0, z: 10 };
    }

    function iniciarPaseo() {
        if (
            !establecerObjetivo(
                siguientePuntoRecorrido(),
                ESTADOS.RUTA
            )
        ) {
            cambiarEstado(ESTADOS.ESPERANDO);
        }
    }

    // ========================================================
    // CAJA Y PAGO
    // ========================================================

    function dirigirseACaja(
        posicionCaja = config.posicionCaja,
        callback = null
    ) {
        if (compras.length === 0) {
            cambiarEstado(ESTADOS.FINALIZADO);
            return false;
        }

        callbackPagoPendiente = callback;

        const destino = {
            x: numero(posicionCaja.x, config.posicionCaja.x),
            z: numero(posicionCaja.z, config.posicionCaja.z)
        };

        return establecerObjetivo(
            destino,
            ESTADOS.CAJA
        );
    }

    function completarPago() {
        const articulos = compras.map(compra => {
            const objeto = compra.objeto ?? null;
            const datos = objeto?.userData ?? {};

            return {
                nombre:
                    compra.nombre ??
                    datos.nombre ??
                    objeto?.name ??
                    'Producto',

                codigo:
                    compra.codigo ??
                    datos.codigo ??
                    '',

                precio: numero(
                    compra.precio,
                    numero(datos.precio, 0)
                ),

                cantidad: 1
            };
        });

        const total = articulos.reduce(
            (suma, articulo) =>
                suma + articulo.precio * articulo.cantidad,
            0
        );

        const ticket = {
            idTicket: `T-${id}-${Date.now()}`,
            idCliente: id,
            fecha: new Date().toLocaleString('es-MX'),

            articulos,
            productos: articulos,

            totalProductos: articulos.length,
            total
        };

        try {
            config.alPagar?.({
                cliente: api,
                productos: compras,
                articulos,
                totalProductos: compras.length,
                total,
                ticket
            });
        } catch (error) {
            console.error(
                `[CLIENTE ${id}] Error al notificar el pago:`,
                error
            );
        }

        compras.forEach(compra => {
            if (compra.objeto) {
                compra.objeto.userData.vendido = true;
                compra.objeto.userData.enCarrito = false;
            }
        });

        ticketPendiente = ticket;

        cambiarEstado(ESTADOS.PAGANDO);
    }

    // ========================================================
    // RUTAS DE PUERTA
    // ========================================================

    function crearRutaPorPuerta(
        destinoFinal,
        tipo = 'salida'
    ) {
        const puertaInterior = {
            x: config.puertaCentroX,
            z: config.puertaZInterior
        };

        const puertaUmbral = {
            x: config.puertaCentroX,
            z: config.puertaZUmbral
        };

        const puertaExterior = {
            x: config.puertaCentroX,
            z: config.puertaZExterior
        };

        const puntos = tipo === 'entrada'
            ? [
                puertaExterior,
                puertaUmbral,
                puertaInterior,
                {
                    x: numero(destinoFinal.x),
                    z: numero(destinoFinal.z)
                }
            ]
            : [
                puertaInterior,
                puertaUmbral,
                puertaExterior,
                {
                    x: numero(destinoFinal.x),
                    z: numero(destinoFinal.z)
                }
            ];

        const caminoCompleto = [];

        let actual = {
            x: grupo.position.x,
            z: grupo.position.z
        };

        for (const punto of puntos) {
            const tramo = encontrarCamino(actual, punto);

            if (!tramo.length) {
                console.warn(
                    `[CLIENTE ${id}] No pudo calcular el tramo de puerta:`,
                    punto
                );

                return [];
            }

            caminoCompleto.push(...tramo);

            actual = tramo[tramo.length - 1];
        }

        return caminoCompleto;
    }

    // ========================================================
    // ENTRADA DESDE VEHÍCULO
    // ========================================================

    function iniciarDesdeVehiculo(posicionEntrada, plaza) {
        if (!posicionEntrada || !plaza) {
            console.warn(
                `[CLIENTE ${id}] Faltan datos del vehículo.`
            );

            return false;
        }

        if ([
            ESTADOS.ENTRANDO,
            ESTADOS.BUSCANDO,
            ESTADOS.ACERCANDO,
            ESTADOS.RECOGIENDO,
            ESTADOS.INSPECCIONANDO,
            ESTADOS.DECIDIENDO,
            ESTADOS.GUARDANDO,
            ESTADOS.DEVOLVIENDO,
            ESTADOS.RUTA,
            ESTADOS.CAJA,
            ESTADOS.PAGANDO,
            ESTADOS.REGRESANDO
        ].includes(estado)) {
            console.warn(
                `[CLIENTE ${id}] Ya está realizando una actividad.`
            );

            return false;
        }

        liberarReserva();

        if (productoEnMano) {
            finalizarDevolucionProducto();
        }

        animacionAgarre.activa = false;
        animacionAgarre.tiempo = 0;

        animacionProducto.activa = false;
        animacionProducto.tipo = null;

        compras = [];

        productosExaminados.clear();
        racksVisitados.clear();

        callbackPagoPendiente = null;
        ticketPendiente = null;
        callbackRegreso = null;

        entradaNotificada = false;

        grupo.position.set(
            numero(posicionEntrada.x, plaza.x),
            numero(config.posicion.y),
            numero(posicionEntrada.z, plaza.z)
        );

        actualizarColisiones();

        const camino = crearRutaPorPuerta(
            {
                x: 0,
                z: config.puertaZInterior
            },
            'entrada'
        );

        if (!camino.length) {
            console.warn(
                `[CLIENTE ${id}] No se encontró ruta de entrada por la puerta.`
            );

            return false;
        }

        ruta = camino;
        indiceRuta = 0;
        objetivo = camino[camino.length - 1];

        cambiarEstado(ESTADOS.ENTRANDO);

        return true;
    }

    // ========================================================
    // REGRESAR AL VEHÍCULO
    // ========================================================

    function iniciarRegresoVehiculo(plaza, callback) {
        if (!plaza || eliminado) return false;

        if (
            estado === ESTADOS.REGRESANDO ||
            estado === ESTADOS.FINALIZADO
        ) {
            return false;
        }

        liberarReserva();

        if (productoEnMano) {
            finalizarDevolucionProducto();
        }

        animacionAgarre.activa = false;
        animacionAgarre.tiempo = 0;

        actualizarColisiones();

        const destino = {
            x: numero(plaza.x),
            z: numero(plaza.z)
        };

        const camino = crearRutaPorPuerta(
            destino,
            'salida'
        );

        if (!camino.length) {
            console.warn(
                `[CLIENTE ${id}] No hay ruta de regreso por la puerta.`,
                {
                    posicion: {
                        x: grupo.position.x,
                        z: grupo.position.z
                    },
                    plaza: destino
                }
            );

            return false;
        }

        ruta = camino;
        indiceRuta = 0;
        objetivo = camino[camino.length - 1];

        callbackRegreso =
            typeof callback === 'function'
                ? callback
                : null;

        cambiarEstado(ESTADOS.REGRESANDO);

        console.log(
            `[CLIENTE ${id}] Regresando a su vehículo.`
        );

        return true;
    }

    function finalizarRegreso() {
        if (estado !== ESTADOS.REGRESANDO) return;

        cambiarEstado(ESTADOS.FINALIZADO);

        const callback = callbackRegreso;

        callbackRegreso = null;

        if (typeof callback === 'function') {
            try {
                callback(api);
            } catch (error) {
                console.error(
                    `[CLIENTE ${id}] Error al finalizar el regreso:`,
                    error
                );
            }
        }

        try {
            config.alFinalizar?.(api);
        } catch (error) {
            console.error(
                `[CLIENTE ${id}] Error en alFinalizar:`,
                error
            );
        }
    }

    // ========================================================
    // NOTIFICAR ENTRADA
    // ========================================================

    function notificarEntrada() {
        if (entradaNotificada) return;

        entradaNotificada = true;

        console.log(
            `[CLIENTE ${id}] Entró al supermercado.`
        );

        try {
            config.alEntrar?.({
                cliente: api,
                posicion: grupo.position.clone(),
                id
            });
        } catch (error) {
            console.error(error);
        }

        cambiarEstado(ESTADOS.BUSCANDO);
    }

    // ========================================================
    // ACTUALIZACIÓN PRINCIPAL
    // ========================================================

    function actualizar(delta) {
        if (eliminado || detenido) return;

        delta = limitar(numero(delta, 0), 0, 0.05);

        tiempoEstado += delta;
        tiempoActualizarObstaculos += delta;

        tiempoRecalculoRuta += delta;

        const moviendo = [
            ESTADOS.ENTRANDO,
            ESTADOS.ACERCANDO,
            ESTADOS.RUTA,
            ESTADOS.CAJA,
            ESTADOS.REGRESANDO
        ].includes(estado);

        if (moviendo) {
            const desplazamiento = distanciaXZ(
                ultimaPosicionMovimiento,
                grupo.position
            );

            if (desplazamiento > 0.04) {
                ultimaPosicionMovimiento.set(
                    grupo.position.x,
                    grupo.position.y,
                    grupo.position.z
                );
                tiempoSinMovimiento = 0;
            } else {
                tiempoSinMovimiento += delta;
            }

            if (tiempoSinMovimiento >= 5) {
                resolverClienteAtascado();
            }
        } else {
            tiempoSinMovimiento = 0;
        }

        if (tiempoActualizarObstaculos >= 2) {
            actualizarColisiones();
        }

        if (mixer) {
            mixer.update(delta);
        }

        tiempoIdle += delta;

        if (
            ![
                ESTADOS.ENTRANDO,
                ESTADOS.ACERCANDO,
                ESTADOS.RUTA,
                ESTADOS.CAJA,
                ESTADOS.REGRESANDO
            ].includes(estado)
        ) {
            const respiracion = Math.sin(tiempoIdle * 1.35) * 0.012;
            const mirarAlrededor = Math.sin(tiempoIdle * 0.31) * 0.035;
            inclinacionCabezaObjetivo = mirarAlrededor;

            if (!animacionProceduralActiva()) {
                aplicarRotacion(rig.torso, EJE_X, respiracion);
                aplicarRotacion(rig.cabeza, EJE_X, mirarAlrededor);
            }
        } else {
            velocidadActual = THREE.MathUtils.lerp(
                velocidadActual,
                0,
                1 - Math.exp(-4 * delta)
            );

            movimientoSuave = THREE.MathUtils.lerp(
                movimientoSuave,
                0,
                1 - Math.exp(-5 * delta)
            );

            giroCabezaObjetivo = THREE.MathUtils.lerp(
                giroCabezaObjetivo,
                0,
                1 - Math.exp(-2.5 * delta)
            );
        }

        if (accionCaminar?.isRunning()) {
            accionCaminar.paused = ![
                ESTADOS.ENTRANDO,
                ESTADOS.ACERCANDO,
                ESTADOS.RUTA,
                ESTADOS.CAJA,
                ESTADOS.REGRESANDO
            ].includes(estado);
        }

        if (accionReposo?.isRunning()) {
            accionReposo.paused = [
                ESTADOS.ENTRANDO,
                ESTADOS.ACERCANDO,
                ESTADOS.RUTA,
                ESTADOS.CAJA,
                ESTADOS.REGRESANDO,
                ESTADOS.RECOGIENDO,
                ESTADOS.INSPECCIONANDO,
                ESTADOS.GUARDANDO,
                ESTADOS.DEVOLVIENDO,
                ESTADOS.PAGANDO
            ].includes(estado);
        }

        if (animacionAgarre.activa) {
            actualizarAnimacionAgarre(delta);
        }

        switch (estado) {
            case ESTADOS.INACTIVO:
                break;

            // ------------------------------------------------
            // MOVIMIENTO
            // ------------------------------------------------

            case ESTADOS.ENTRANDO:
            case ESTADOS.ACERCANDO:
            case ESTADOS.RUTA:
            case ESTADOS.CAJA:
            case ESTADOS.REGRESANDO: {
                const estadoActual = estado;

                const terminado = moverHaciaDestino(delta);

                if (!terminado) break;

                if (estadoActual === ESTADOS.ENTRANDO) {
                    notificarEntrada();

                } else if (estadoActual === ESTADOS.ACERCANDO) {
                    if (productoObjetivo) {
                        productoObjetivo.getWorldPosition(vectorTemporal);

                        orientarHaciaPunto({
                            x: vectorTemporal.x,
                            z: vectorTemporal.z
                        });
                    }

                    cambiarEstado(ESTADOS.RECOGIENDO);

                } else if (estadoActual === ESTADOS.RUTA) {
                    if (
                        compras.length >= config.maximoProductos
                    ) {
                        dirigirseACaja();
                    } else {
                        cambiarEstado(ESTADOS.BUSCANDO);
                    }

                } else if (estadoActual === ESTADOS.CAJA) {
                    completarPago();

                } else if (estadoActual === ESTADOS.REGRESANDO) {
                    finalizarRegreso();
                }

                break;
            }

            // ------------------------------------------------
            // BUSCAR
            // ------------------------------------------------

            case ESTADOS.BUSCANDO: {
                if (
                    tiempoEstado <
                    config.tiempoEntreProductos
                ) {
                    break;
                }

                if (
                    compras.length >=
                    config.maximoProductos
                ) {
                    dirigirseACaja();
                    break;
                }

                decidirCompra();

                break;
            }

            // ------------------------------------------------
            // RECOGER
            // ------------------------------------------------

            case ESTADOS.RECOGIENDO: {
                animarRecogerProcedural();

                const momentoAgarre = limitar(
                    numero(config.progresoContactoProducto, 0.78),
                    0.55,
                    0.88
                );

                if (tiempoEstado >= config.tiempoRecoger * momentoAgarre) {
                    tomarProducto();
                }

                break;
            }

            // ------------------------------------------------
            // INSPECCIONAR
            // ------------------------------------------------

            case ESTADOS.INSPECCIONANDO: {
                animarInspeccionarProcedural();
                grupo.updateMatrixWorld(true);

                if (productoEnMano) {
                    productoEnMano.updateMatrixWorld(true);
                }

                if (
                    tiempoEstado >=
                    config.tiempoInspeccionar
                ) {
                    cambiarEstado(ESTADOS.DECIDIENDO);
                }

                break;
            }

            // ------------------------------------------------
            // DECIDIR
            // ------------------------------------------------

            case ESTADOS.DECIDIENDO: {
                const duda = Math.sin(tiempoEstado * 2.15) * 0.035;

                aplicarRotacionEuler(rig.cabeza,
                    0.08 + duda,
                    Math.sin(tiempoEstado * 0.85) * 0.12,
                    Math.sin(tiempoEstado * 1.35) * 0.045);

                aplicarRotacionEuler(rig.torso, 0.02,
                    -Math.sin(tiempoEstado * 0.85) * 0.04, 0);

                if (tiempoEstado >= 0.5) {
                    decisionCompra =
                        Math.random() <
                        config.probabilidadCompra;

                    if (decisionCompra) {
                        cambiarEstado(ESTADOS.GUARDANDO);

                    } else {
                        const quiereReubicar =
                            Math.random() <
                            config.probabilidadDejarEnOtroRack;

                        let reubicado = false;

                        if (quiereReubicar) {
                            reubicado =
                                prepararDevolucionEnOtroRack();
                        }

                        if (!reubicado) {
                            animacionProducto.tipo = 'DEVOLVER';
                        }

                        devolverProductoAlEstante();

                        cambiarEstado(ESTADOS.DEVOLVIENDO);
                    }
                }

                break;
            }

            // ------------------------------------------------
            // GUARDAR
            // ------------------------------------------------

            case ESTADOS.GUARDANDO: {
                animarGuardarProcedural();

                if (tiempoEstado >= config.tiempoGuardar) {
                    guardarProducto();
                }

                break;
            }

            // ------------------------------------------------
            // DEVOLVER
            // ------------------------------------------------

            case ESTADOS.DEVOLVIENDO: {
                animarDevolverProcedural();

                actualizarAnimacionProducto(delta);

                if (
                    tiempoEstado >= config.tiempoDevolver &&
                    !animacionProducto.activa
                ) {
                    cambiarEstado(ESTADOS.BUSCANDO);
                }

                break;
            }

            // ------------------------------------------------
            // ESPERAR
            // ------------------------------------------------

            case ESTADOS.ESPERANDO: {
                aplicarRotacionEuler(rig.cabeza,
                    0.06 + Math.sin(tiempoEstado * 1.8) * 0.018,
                    Math.sin(tiempoEstado * 0.42) * 0.14,
                    Math.sin(tiempoEstado * 0.58) * 0.035);

                aplicarRotacionEuler(rig.brazoDerecho, -0.12,
                    0, Math.sin(tiempoEstado * 0.7) * 0.025);

                aplicarRotacionEuler(rig.brazoIzquierdo, -0.12,
                    0, -Math.sin(tiempoEstado * 0.7) * 0.025);

                if (
                    tiempoEstado >= config.tiempoReintento
                ) {
                    if (
                        compras.length >=
                        config.maximoProductos
                    ) {
                        dirigirseACaja();

                    } else if (
                        config.soloPlatanos ||
                        config.nombreProductoBuscado
                    ) {
                        // Cliente especializado:
                        // vuelve a buscar su producto sin pasearse
                        // por otros departamentos.
                        cambiarEstado(ESTADOS.BUSCANDO);

                    } else {
                        iniciarPaseo();
                    }
                }

                break;
            }

            // ------------------------------------------------
            // PAGAR
            // ------------------------------------------------

            case ESTADOS.PAGANDO: {
                animarPagarProcedural();

                if (tiempoEstado >= 2.5) {
                    const ticket = ticketPendiente;

                    ticketPendiente = null;

                    if (config.repetirRuta) {
                        compras = [];

                        productosExaminados.clear();
                        racksVisitados.clear();

                        cambiarEstado(ESTADOS.BUSCANDO);

                    } else {
                        const callback = callbackPagoPendiente;

                        callbackPagoPendiente = null;

                        if (typeof callback === 'function') {
                            try {
                                callback(ticket);
                            } catch (error) {
                                console.error(
                                    `[CLIENTE ${id}] Error en callback de pago:`,
                                    error
                                );
                            }
                        }

                        if (estado === ESTADOS.PAGANDO) {
                            cambiarEstado(ESTADOS.FINALIZADO);
                        }
                    }
                }

                break;
            }

            case ESTADOS.FINALIZADO:
                break;
        }
    }

    // ========================================================
    // CONFIGURAR COMPRAS
    // ========================================================

    function animacionProceduralActiva() {
        return [
            ESTADOS.RECOGIENDO,
            ESTADOS.INSPECCIONANDO,
            ESTADOS.GUARDANDO,
            ESTADOS.DEVOLVIENDO,
            ESTADOS.PAGANDO
        ].includes(estado);
    }

    function configurarCompras(opcionesCompras = {}) {
        if (
            typeof opcionesCompras.probabilidadCompra === 'number'
        ) {
            config.probabilidadCompra = limitar(
                opcionesCompras.probabilidadCompra,
                0,
                1
            );
        }

        if (
            typeof opcionesCompras.probabilidadDejarEnOtroRack ===
            'number'
        ) {
            config.probabilidadDejarEnOtroRack = limitar(
                opcionesCompras.probabilidadDejarEnOtroRack,
                0,
                1
            );
        }

        if (
            typeof opcionesCompras.maximoProductos === 'number'
        ) {
            config.maximoProductos = Math.max(
                1,
                Math.floor(opcionesCompras.maximoProductos)
            );
        }

        if (
            typeof opcionesCompras.tiempoEntreProductos === 'number'
        ) {
            config.tiempoEntreProductos = Math.max(
                0,
                opcionesCompras.tiempoEntreProductos
            );
        }

        if (
            typeof opcionesCompras.tiempoAnimacionAgarre === 'number'
        ) {
            config.tiempoAnimacionAgarre = Math.max(
                0.05,
                opcionesCompras.tiempoAnimacionAgarre
            );

            animacionAgarre.duracion =
                config.tiempoAnimacionAgarre;
        }

        if (opcionesCompras.productos) {
            config.productos = opcionesCompras.productos;
        }

        if (opcionesCompras.carrito) {
            config.carrito = opcionesCompras.carrito;
        }

        if (opcionesCompras.mobiliario) {
            config.mobiliario = opcionesCompras.mobiliario;
            actualizarColisiones();
        }

        if (opcionesCompras.colisiones) {
            config.colisiones = opcionesCompras.colisiones;
            actualizarColisiones();
        }

        if (
            typeof opcionesCompras.intervaloRecalculoRuta === 'number'
        ) {
            config.intervaloRecalculoRuta = Math.max(
                0.1,
                opcionesCompras.intervaloRecalculoRuta
            );
        }

        // Permitir cambiar el filtro después de crear el cliente.
        if (typeof opcionesCompras.soloPlatanos === 'boolean') {
            config.soloPlatanos = opcionesCompras.soloPlatanos;
        }

        if (typeof opcionesCompras.nombreProductoBuscado === 'string') {
            config.nombreProductoBuscado =
                opcionesCompras.nombreProductoBuscado;
        }
    }

    // ========================================================
    // DETENER / REANUDAR ANIMACIÓN
    // ========================================================

    function detenerAnimacion() {
        detenido = true;

        accionCaminar?.fadeOut(0.2);
        accionReposo?.fadeOut(0.2);
    }

    function reproducirAnimacion() {
        if (eliminado) return;

        detenido = false;

        if ([
            ESTADOS.ENTRANDO,
            ESTADOS.ACERCANDO,
            ESTADOS.RUTA,
            ESTADOS.CAJA,
            ESTADOS.REGRESANDO
        ].includes(estado)) {
            activarCaminarGLB();
        } else {
            activarReposoGLB();
        }
    }

    // ========================================================
    // ELIMINAR
    // ========================================================

    function eliminar() {
        if (eliminado) return;

        if (productoEnMano) {
            finalizarDevolucionProducto();
        }

        animacionAgarre.activa = false;
        animacionProducto.activa = false;

        liberarReserva();

        callbackPagoPendiente = null;
        callbackRegreso = null;
        ticketPendiente = null;

        mixer?.stopAllAction();
        mixer?.uncacheRoot(modelo);

        mixer = null;

        grupo.parent?.remove(grupo);

        eliminado = true;
        detenido = true;

        ruta = [];
        objetivo = null;
    }

    // ========================================================
    // API PÚBLICA
    // ========================================================

    const api = {
        grupo,

        actualizar,

        establecerRuta,

        establecerPosicion,

        configurarCompras,

        detenerAnimacion,

        reproducirAnimacion,

        iniciarDesdeVehiculo,

        iniciarRegresoVehiculo,

        iniciarPago: dirigirseACaja,

        obtenerObjetivo: () => {
            return objetivo
                ? { ...objetivo }
                : null;
        },

        obtenerCompras: () => {
            return compras.map(compra => ({
                nombre: compra.nombre,
                codigo: compra.codigo,
                precio: compra.precio
            }));
        },

        obtenerResumen: () => ({
            id,
            estado,

            productos: compras.length,

            posicion: {
                x: grupo.position.x,
                z: grupo.position.z
            }
        }),

        obtenerEstado: () => estado,

        actualizarColisiones,

        eliminar,

        get cargado() {
            return cargado;
        },

        get huesos() {
            return huesos;
        },

        get estado() {
            return estado;
        },

        get eliminado() {
            return eliminado;
        },

        get detenido() {
            return detenido;
        },

        get modelo() {
            return modelo;
        },

        get productoEnMano() {
            return productoEnMano;
        }
    };

    actualizarColisiones();

    return api;
}
