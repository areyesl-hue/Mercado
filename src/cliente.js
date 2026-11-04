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
// CONFIGURACIÓN ORIGINAL
// ============================================================

const CONFIG_BASE = {
    modelo: '/modelos/Cliente1.glb',
    posicion: { x: 0, y: 0, z: 20 },

    altura: 1.75,
    escala: 1,

    velocidad: 1.5,
    velocidadEntrada: 1.8,
    velocidadRegreso: 1.8,

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

    maximoProductos: 4,
    distanciaMaximaBusqueda: 40,

    separacionProductoRack: 0.06,
    alturaMovimientoProducto: 0.12,

    intervaloRecalculoRuta: 0.45,
    maximosIntentosMovimiento: 5,
    distanciaRecalculo: 0.45,

    distanciaLlegada: 0.18,
    distanciaWaypoint: 0.30,

    usarAnimacionesGLB: true,
    velocidadAnimacionGLB: 1,

    repetirRuta: false,
    inactivo: false,

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

    insertar(elemento) {
        const lista = this.elementos;
        lista.push(elemento);

        let indice = lista.length - 1;

        while (indice > 0) {
            const padre = Math.floor((indice - 1) / 2);

            if (lista[padre].f <= lista[indice].f) break;

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
    let tiempoMuestraMovimiento = 0;

    const posicionMuestraMovimiento = new THREE.Vector3();
    let movimientoInicializado = false;

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

    const EJE_X = new THREE.Vector3(1, 0, 0);
    const quaternionTemporal = new THREE.Quaternion();
    const vectorTemporal = new THREE.Vector3();
    const vectorTemporal2 = new THREE.Vector3();
    const escalaTemporal = new THREE.Vector3();
    const cajaTemporal = new THREE.Box3();
    const tamanoTemporal = new THREE.Vector3();

    // ========================================================
    // ANIMACIONES DE PRODUCTO
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
        quaternionPadreTemporal: new THREE.Quaternion()
    };

    // ========================================================
    // PUERTA
    // ========================================================

    function estaEnCorredorPuerta(x, z) {
        return (
            Math.abs(x - config.puertaCentroX) <=
                config.puertaAncho / 2 &&
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
    // RACKS Y RESERVAS
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

        const x = Math.round(
            vectorTemporal.x / TAMANO_ZONA_RACK
        );

        const z = Math.round(
            vectorTemporal.z / TAMANO_ZONA_RACK
        );

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
            if (
                patrones.some(patron => nombre.includes(patron))
            ) {
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
    // ANIMACIONES GLB
    // ========================================================

    function detenerAccionesGLB() {
        accionCaminar?.fadeOut(0.12);
        accionReposo?.fadeOut(0.12);
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
    // PRODUCTO EN ESTANTE INFERIOR
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
            return;
        }

        faseAnimacion += delta * 8.5;

        const paso = Math.sin(faseAnimacion) * 0.32;
        const rebote =
            Math.abs(Math.sin(faseAnimacion)) * 0.025;

        aplicarRotacion(rig.piernaIzquierda, EJE_X, paso);
        aplicarRotacion(rig.piernaDerecha, EJE_X, -paso);

        aplicarRotacion(
            rig.pantorrillaIzquierda,
            EJE_X,
            Math.max(0, -paso) * 0.65
        );

        aplicarRotacion(
            rig.pantorrillaDerecha,
            EJE_X,
            Math.max(0, paso) * 0.65
        );

        aplicarRotacion(
            rig.brazoIzquierdo,
            EJE_X,
            -paso * 0.75
        );

        aplicarRotacion(
            rig.brazoDerecho,
            EJE_X,
            paso * 0.75
        );

        aplicarRotacion(
            rig.antebrazoIzquierdo,
            EJE_X,
            Math.max(0, paso) * 0.25
        );

        aplicarRotacion(
            rig.antebrazoDerecho,
            EJE_X,
            Math.max(0, -paso) * 0.25
        );

        restaurarHueso(rig.torso, 0.12);
        restaurarHueso(rig.cadera, 0.12);
        restaurarHueso(rig.cabeza, 0.12);

        grupo.position.y =
            numero(config.posicion.y) + rebote;
    }

    // ========================================================
    // ANIMACIONES DE ACCIONES
    // ========================================================

    function animarAgacharse(intensidad = 1) {
        intensidad = limitar(intensidad, 0, 1);

        aplicarRotacion(rig.cadera, EJE_X, 0.30 * intensidad);
        aplicarRotacion(rig.torso, EJE_X, 0.25 * intensidad);

        aplicarRotacion(
            rig.piernaIzquierda,
            EJE_X,
            -0.65 * intensidad
        );

        aplicarRotacion(
            rig.piernaDerecha,
            EJE_X,
            -0.65 * intensidad
        );

        aplicarRotacion(
            rig.pantorrillaIzquierda,
            EJE_X,
            0.28 * intensidad
        );

        aplicarRotacion(
            rig.pantorrillaDerecha,
            EJE_X,
            0.28 * intensidad
        );
    }

    function animarRecogerProcedural() {
        const t = suavizar(
            tiempoEstado / Math.max(config.tiempoRecoger, 0.01)
        );

        const agachado = productoEsInferior ? 1 : 0;

        animarAgacharse(agachado * suavizar(t * 1.5));

        aplicarRotacion(
            rig.brazoDerecho,
            EJE_X,
            THREE.MathUtils.lerp(-0.15, -0.85, t)
        );

        aplicarRotacion(
            rig.antebrazoDerecho,
            EJE_X,
            THREE.MathUtils.lerp(-0.1, -0.65, t)
        );

        aplicarRotacion(rig.brazoIzquierdo, EJE_X, -0.2 * t);
        aplicarRotacion(rig.antebrazoIzquierdo, EJE_X, -0.15 * t);
        aplicarRotacion(rig.torso, EJE_X, 0.10 * t + 0.25 * agachado * t);
        aplicarRotacion(rig.cabeza, EJE_X, 0.18 * t);
        aplicarRotacion(rig.cuello, EJE_X, 0.12 * t);
    }

    function animarInspeccionarProcedural() {
        const oscilacion = Math.sin(tiempoEstado * 2.5) * 0.035;
        const movimientoCabeza = Math.sin(tiempoEstado * 1.4) * 0.045;

        aplicarRotacion(rig.brazoDerecho, EJE_X, -1.10 + oscilacion);
        aplicarRotacion(rig.antebrazoDerecho, EJE_X, -1.0 + oscilacion);
        aplicarRotacion(rig.brazoIzquierdo, EJE_X, -0.72);
        aplicarRotacion(rig.antebrazoIzquierdo, EJE_X, -0.85);

        aplicarRotacion(
            rig.cabeza,
            EJE_X,
            0.22 + movimientoCabeza
        );

        aplicarRotacion(rig.cuello, EJE_X, 0.10);

        if (productoEsInferior) {
            animarAgacharse(
                1 - suavizar(tiempoEstado * 1.5)
            );
        }
    }

    function animarGuardarProcedural() {
        const t = Math.sin(tiempoEstado * 5) * 0.08;

        aplicarRotacion(rig.brazoDerecho, EJE_X, -0.75 + t);
        aplicarRotacion(rig.antebrazoDerecho, EJE_X, -0.8);
        aplicarRotacion(rig.brazoIzquierdo, EJE_X, -0.45);
        aplicarRotacion(rig.antebrazoIzquierdo, EJE_X, -0.55);
        aplicarRotacion(rig.cabeza, EJE_X, 0.10);
    }

    function animarDevolverProcedural() {
        const t = suavizar(
            tiempoEstado / Math.max(config.tiempoDevolver, 0.01)
        );

        if (productoEsInferior) {
            animarAgacharse(1 - t * 0.25);
        }

        aplicarRotacion(
            rig.brazoDerecho,
            EJE_X,
            THREE.MathUtils.lerp(-1.0, -0.15, t)
        );

        aplicarRotacion(
            rig.antebrazoDerecho,
            EJE_X,
            THREE.MathUtils.lerp(-0.8, -0.1, t)
        );

        aplicarRotacion(
            rig.brazoIzquierdo,
            EJE_X,
            THREE.MathUtils.lerp(-0.45, -0.1, t)
        );

        aplicarRotacion(
            rig.antebrazoIzquierdo,
            EJE_X,
            THREE.MathUtils.lerp(-0.55, -0.1, t)
        );

        aplicarRotacion(
            rig.cabeza,
            EJE_X,
            THREE.MathUtils.lerp(0.15, 0, t)
        );
    }

    function animarPagarProcedural() {
        const t = Math.sin(tiempoEstado * 3) * 0.08;

        aplicarRotacion(rig.brazoDerecho, EJE_X, -0.9 + t);
        aplicarRotacion(rig.antebrazoDerecho, EJE_X, -0.6);
        aplicarRotacion(rig.brazoIzquierdo, EJE_X, -0.7);
        aplicarRotacion(rig.antebrazoIzquierdo, EJE_X, -0.4);
        aplicarRotacion(rig.cabeza, EJE_X, 0.08);
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

    function reiniciarDetectorMovimiento() {
        tiempoRecalculoRuta = 0;
        tiempoMuestraMovimiento = 0;
        intentosMovimiento = 0;

        posicionMuestraMovimiento.copy(grupo.position);
        movimientoInicializado = true;
    }

    function cambiarEstado(nuevoEstado) {
        if (estado === nuevoEstado) return;

        const anterior = estado;

        estado = nuevoEstado;
        tiempoEstado = 0;

        reiniciarDetectorMovimiento();

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
            if (!activarCaminarGLB()) {
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

                if (
                    tamanoTemporal.x < 0.08 ||
                    tamanoTemporal.z < 0.08
                ) {
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
        const pasos = Math.max(1, Math.ceil(distancia / 0.30));

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

            const actualClave = claveCelda(actual.x, actual.z);

            if (cerrados.has(actualClave)) continue;
            if (nodos.get(actualClave) !== actual) continue;

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

                const h = Math.hypot(bX - nx, bZ - nz);

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

        // Suavizado de ruta sin atravesar obstáculos.
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
    // ORIENTACIÓN
    // ========================================================

    function orientarHacia(dx, dz) {
        if (Math.abs(dx) + Math.abs(dz) < 0.0001) {
            return;
        }

        grupo.rotation.y =
            Math.atan2(dx, dz) +
            config.correccionRotacion;
    }

    function orientarHaciaPunto(punto) {
        if (!punto) return;

        orientarHacia(
            punto.x - grupo.position.x,
            punto.z - grupo.position.z
        );
    }

    // ========================================================
    // RECUPERACIÓN DE MOVIMIENTO
    // ========================================================

    function manejarMovimientoBloqueado() {
        console.warn(
            `[CLIENTE ${id}] Detectado posible atasco.`,
            {
                estado,
                posicion: {
                    x: grupo.position.x,
                    z: grupo.position.z
                },
                objetivo
            }
        );

        intentosMovimiento = 0;
        tiempoRecalculoRuta = 0;
        tiempoMuestraMovimiento = 0;

        posicionMuestraMovimiento.copy(grupo.position);

        if (estado === ESTADOS.ACERCANDO) {
            ruta = [];
            objetivo = null;
            liberarReserva();
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        if (estado === ESTADOS.RUTA) {
            ruta = [];
            objetivo = null;
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        if (
            estado === ESTADOS.ENTRANDO ||
            estado === ESTADOS.CAJA ||
            estado === ESTADOS.REGRESANDO
        ) {
            tiempoRecalculoRuta =
                config.intervaloRecalculoRuta;

            return;
        }

        ruta = [];
        objetivo = null;
        liberarReserva();
        cambiarEstado(ESTADOS.BUSCANDO);
    }

    function recuperarMovimiento(forzar = false) {
        if (!objetivo || !ruta.length) return false;

        if (
            !forzar &&
            tiempoRecalculoRuta < config.intervaloRecalculoRuta
        ) {
            return false;
        }

        tiempoRecalculoRuta = 0;
        intentosMovimiento++;

        const destinoActual = ruta[indiceRuta] ?? objetivo;

        const nuevoCamino = encontrarCamino(
            grupo.position,
            destinoActual
        );

        if (nuevoCamino.length > 0) {
            // CORRECCIÓN: reemplazar solo el waypoint actual.
            // No borrar los siguientes destinos de la ruta.
            ruta.splice(indiceRuta, 1, ...nuevoCamino);

            tiempoMuestraMovimiento = 0;
            posicionMuestraMovimiento.copy(grupo.position);

            console.log(
                `[CLIENTE ${id}] Ruta recuperada. Intento ${intentosMovimiento}.`
            );

            if (
                intentosMovimiento >=
                config.maximosIntentosMovimiento
            ) {
                manejarMovimientoBloqueado();
            }

            return true;
        }

        console.warn(
            `[CLIENTE ${id}] No se pudo recuperar el waypoint.`,
            destinoActual
        );

        if (
            intentosMovimiento >=
            config.maximosIntentosMovimiento
        ) {
            manejarMovimientoBloqueado();
        }

        return false;
    }

    // ========================================================
    // MOVER HACIA EL DESTINO
    // ========================================================

    function moverHaciaDestino(delta) {
        if (!ruta.length || indiceRuta >= ruta.length) {
            return true;
        }

        if (!movimientoInicializado) {
            reiniciarDetectorMovimiento();
        }

        const destino = ruta[indiceRuta];
        if (!destino) return true;

        const dx = destino.x - grupo.position.x;
        const dz = destino.z - grupo.position.z;
        const distancia = Math.hypot(dx, dz);

        if (distancia < config.distanciaLlegada) {
            grupo.position.x = destino.x;
            grupo.position.z = destino.z;
            grupo.position.y = numero(config.posicion.y);

            indiceRuta++;
            reiniciarDetectorMovimiento();

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

        orientarHacia(direccionX, direccionZ);

        const avance = Math.min(distancia, velocidad * delta);

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

            if (
                tiempoRecalculoRuta >=
                config.intervaloRecalculoRuta
            ) {
                recuperarMovimiento(true);
            }

            return false;
        }

        grupo.position.x = nuevoX;
        grupo.position.z = nuevoZ;
        grupo.position.y = numero(config.posicion.y);

        tiempoMuestraMovimiento += delta;

        if (tiempoMuestraMovimiento >= 0.40) {
            const desplazamiento = distanciaXZ(
                grupo.position,
                posicionMuestraMovimiento
            );

            if (desplazamiento < 0.035) {
                tiempoRecalculoRuta += tiempoMuestraMovimiento;

                if (
                    tiempoRecalculoRuta >=
                    config.intervaloRecalculoRuta
                ) {
                    recuperarMovimiento(true);
                }
            } else {
                intentosMovimiento = 0;
                tiempoRecalculoRuta = 0;
            }

            posicionMuestraMovimiento.copy(grupo.position);
            tiempoMuestraMovimiento = 0;
        }

        animarCaminarProcedural(delta);

        return false;
    }

    // ========================================================
    // ESTABLECER OBJETIVO O RUTA
    // ========================================================

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

        reiniciarDetectorMovimiento();
        cambiarEstado(nuevoEstado);

        return true;
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

            // CORRECCIÓN: no saltar silenciosamente un tramo imposible.
            if (!segmento.length) {
                console.warn(
                    `[CLIENTE ${id}] No se pudo calcular un tramo de la ruta.`,
                    punto
                );

                return false;
            }

            camino.push(...segmento);
            actual = segmento[segmento.length - 1];
        }

        if (!camino.length) return false;

        ruta = camino;
        indiceRuta = 0;
        objetivo = camino[camino.length - 1];

        config.repetirRuta = repetir;

        reiniciarDetectorMovimiento();
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
        indiceRuta = 0;
        objetivo = null;

        reiniciarDetectorMovimiento();

        return true;
    }
    // ========================================================
    // BUSCAR PRODUCTOS EN LA ESCENA
    // ========================================================

    function obtenerListaProductos() {
        if (Array.isArray(config.productos)) {
            return config.productos.filter(Boolean);
        }

        const encontrados = [];

        scene.traverse(obj => {
            if (!obj.isMesh && !obj.isGroup) return;

            if (
                obj.userData?.esProducto ||
                obj.userData?.producto ||
                obj.userData?.idProducto ||
                obj.userData?.codigoProducto
            ) {
                encontrados.push(obj);
            }
        });

        return encontrados;
    }

    function productoDisponible(producto) {
        if (!producto || !producto.visible) return false;
        if (producto === productoEnMano) return false;

        const datos = producto.userData ?? {};

        if (
            datos.reservado &&
            datos.reservadoPor !== id
        ) {
            return false;
        }

        if (
            datos.vendido ||
            datos.agotado ||
            datos.eliminado ||
            datos.enCarrito
        ) {
            return false;
        }

        const propietario = reservasProductos.get(producto);

        if (
            propietario !== undefined &&
            propietario !== id
        ) {
            return false;
        }

        if (!rackDisponible(producto)) return false;

        return true;
    }

    // ========================================================
    // RESERVAR Y LIBERAR PRODUCTOS
    // ========================================================

    function reservarProducto(producto) {
        if (!productoDisponible(producto)) return false;

        const claveRack = obtenerClaveRack(producto);
        const propietarioRack = reservasRacks.get(claveRack);

        if (
            propietarioRack !== undefined &&
            propietarioRack !== id
        ) {
            return false;
        }

        reservasProductos.set(producto, id);

        producto.userData.reservado = true;
        producto.userData.reservadoPor = id;

        if (!reservarRack(producto)) {
            reservasProductos.delete(producto);

            producto.userData.reservado = false;
            delete producto.userData.reservadoPor;

            return false;
        }

        return true;
    }

    function liberarReserva() {
        if (productoObjetivo) {
            if (
                reservasProductos.get(productoObjetivo) === id
            ) {
                reservasProductos.delete(productoObjetivo);
            }

            if (
                productoObjetivo.userData?.reservadoPor === id
            ) {
                productoObjetivo.userData.reservado = false;

                delete productoObjetivo.userData.reservadoPor;
            }
        }

        productoObjetivo = null;
        liberarRack();
    }

    function liberarTodasLasReservas() {
        liberarReserva();

        if (productoEnMano) {
            if (
                reservasProductos.get(productoEnMano) === id
            ) {
                reservasProductos.delete(productoEnMano);
            }

            if (
                productoEnMano.userData?.reservadoPor === id
            ) {
                productoEnMano.userData.reservado = false;

                delete productoEnMano.userData.reservadoPor;
            }
        }
    }

    // ========================================================
    // POSICIÓN DE PRODUCTOS
    // ========================================================

    function obtenerPosicionProducto(producto) {
        producto.updateMatrixWorld(true);

        const caja = new THREE.Box3().setFromObject(producto);
        const centro = new THREE.Vector3();

        caja.getCenter(centro);

        return centro;
    }

    function obtenerPuntoFrenteProducto(producto) {
        const posicion = obtenerPosicionProducto(producto);

        const direccion = new THREE.Vector3(
            grupo.position.x - posicion.x,
            0,
            grupo.position.z - posicion.z
        );

        if (direccion.lengthSq() < 0.0001) {
            direccion.set(0, 0, 1);
        }

        direccion.normalize();

        return {
            x: posicion.x +
                direccion.x * config.distanciaFrenteProducto,

            z: posicion.z +
                direccion.z * config.distanciaFrenteProducto
        };
    }

    // ========================================================
    // BUSCAR PRODUCTO MÁS CERCANO
    // ========================================================

    function buscarProductoCercano() {
        const productos = obtenerListaProductos();

        let mejorProducto = null;
        let mejorDistancia = Infinity;

        for (const producto of productos) {
            if (!productoDisponible(producto)) continue;
            if (productosExaminados.has(producto)) continue;

            // CORRECCIÓN: no volver a seleccionar racks visitados.
            const claveRack = obtenerClaveRack(producto);

            if (racksVisitados.has(claveRack)) {
                continue;
            }

            const posicion = obtenerPosicionProducto(producto);

            const distancia = distanciaXZ(
                grupo.position,
                posicion
            );

            if (
                distancia > config.distanciaMaximaBusqueda ||
                distancia >= mejorDistancia
            ) {
                continue;
            }

            mejorProducto = producto;
            mejorDistancia = distancia;
        }

        return mejorProducto;
    }

    // ========================================================
    // BUSCAR PRODUCTO DE OTRO RACK
    // ========================================================

    function buscarProductoDeOtroRack() {
        const productos = obtenerListaProductos();
        const candidatos = [];

        for (const producto of productos) {
            if (!productoDisponible(producto)) continue;
            if (productosExaminados.has(producto)) continue;

            const claveRack = obtenerClaveRack(producto);

            if (claveRack === rackReservado) continue;
            if (racksVisitados.has(claveRack)) continue;

            const posicion = obtenerPosicionProducto(producto);

            const distancia = distanciaXZ(
                grupo.position,
                posicion
            );

            if (
                distancia > config.distanciaMaximaBusqueda
            ) {
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

        return candidatos[0]?.producto ?? null;
    }

    // ========================================================
    // SELECCIONAR PRODUCTO
    // ========================================================

    function seleccionarProducto(producto) {
        if (!producto || !reservarProducto(producto)) {
            return false;
        }

        productoObjetivo = producto;

        productoEsInferior =
            productoEstaEnEstanteInferior(producto);

        const punto = obtenerPuntoFrenteProducto(producto);

        const exito = establecerObjetivo(
            punto,
            ESTADOS.ACERCANDO
        );

        if (!exito) {
            productosExaminados.add(producto);
            liberarReserva();

            return false;
        }

        return true;
    }

    // ========================================================
    // GUARDAR TRANSFORMACIÓN ORIGINAL
    // ========================================================

    function guardarTransformacionOriginal(producto) {
        producto.updateMatrixWorld(true);

        const posicionLocal = producto.position.clone();
        const quaternionLocal = producto.quaternion.clone();
        const escalaLocal = producto.scale.clone();

        const posicionMundo = producto.getWorldPosition(
            new THREE.Vector3()
        );

        const quaternionMundo = producto.getWorldQuaternion(
            new THREE.Quaternion()
        );

        const escalaMundo = producto.getWorldScale(
            new THREE.Vector3()
        );

        return {
            parent: producto.parent,

            // Transformación local original.
            posicionLocal,
            quaternionLocal,
            escalaLocal,

            // Transformación mundial original.
            posicionMundo,
            quaternionMundo,
            escalaMundo,

            visible: producto.visible,

            rackAnterior: obtenerClaveRack(producto),
            rackNuevo: null
        };
    }

    // ========================================================
    // OBTENER MANO DEL CLIENTE
    // ========================================================

    function obtenerMano() {
        return (
            rig.manoDerecha ||
            rig.antebrazoDerecho ||
            rig.brazoDerecho ||
            modelo ||
            grupo
        );
    }

    // ========================================================
    // INICIAR AGARRE DE PRODUCTO
    // ========================================================

    function iniciarAgarreProducto(producto) {
        if (!producto || producto !== productoObjetivo) {
            return false;
        }

        if (productoEnMano) return false;

        const mano = obtenerMano();
        if (!mano) return false;

        const original = guardarTransformacionOriginal(producto);

        productoOriginal = original;
        productoEnMano = producto;

        producto.parent?.remove(producto);
        mano.add(producto);

        producto.position.set(
            config.offsetProductoMano.x,
            config.offsetProductoMano.y,
            config.offsetProductoMano.z
        );

        producto.rotation.set(
            config.rotacionProductoMano.x,
            config.rotacionProductoMano.y,
            config.rotacionProductoMano.z
        );

        producto.scale.setScalar(
            config.escalaProductoMano
        );

        animacionAgarre.posicionInicial.set(
            0,
            -0.18,
            0.28
        );

        animacionAgarre.posicionFinal.copy(
            producto.position
        );

        animacionAgarre.quaternionInicial.identity();
        animacionAgarre.quaternionFinal.copy(
            producto.quaternion
        );

        animacionAgarre.escalaInicial.setScalar(
            config.escalaProductoMano * 0.7
        );

        animacionAgarre.escalaFinal.copy(
            producto.scale
        );

        producto.position.copy(
            animacionAgarre.posicionInicial
        );

        producto.quaternion.copy(
            animacionAgarre.quaternionInicial
        );

        producto.scale.copy(
            animacionAgarre.escalaInicial
        );

        animacionAgarre.tiempo = 0;
        animacionAgarre.activa = true;

        return true;
    }

    // ========================================================
    // POSICIONAR PRODUCTO PARA INSPECCIÓN
    // ========================================================

    function posicionarProductoParaInspeccion() {
        if (!productoEnMano) return;

        productoEnMano.position.set(
            0,
            config.alturaProductoInspeccion - config.altura,
            config.distanciaProductoInspeccion
        );

        productoEnMano.rotation.set(
            0,
            Math.PI / 2,
            0
        );

        productoEnMano.scale.setScalar(
            config.escalaProductoMano
        );
    }

    // ========================================================
    // ACTUALIZAR ANIMACIÓN DE AGARRE
    // ========================================================

    function actualizarAnimacionAgarre(delta) {
        if (!animacionAgarre.activa || !productoEnMano) {
            return false;
        }

        const producto = productoEnMano;

        animacionAgarre.tiempo += delta;

        const duracion = Math.max(
            animacionAgarre.duracion,
            0.01
        );

        const t = limitar(
            animacionAgarre.tiempo / duracion,
            0,
            1
        );

        const suave = suavizar(t);

        producto.position.lerpVectors(
            animacionAgarre.posicionInicial,
            animacionAgarre.posicionFinal,
            suave
        );

        producto.quaternion.slerpQuaternions(
            animacionAgarre.quaternionInicial,
            animacionAgarre.quaternionFinal,
            suave
        );

        producto.scale.lerpVectors(
            animacionAgarre.escalaInicial,
            animacionAgarre.escalaFinal,
            suave
        );

        if (t >= 1) {
            producto.position.copy(
                animacionAgarre.posicionFinal
            );

            producto.quaternion.copy(
                animacionAgarre.quaternionFinal
            );

            producto.scale.copy(
                animacionAgarre.escalaFinal
            );

            animacionAgarre.activa = false;
            animacionAgarre.tiempo = 0;

            return true;
        }

        return false;
    }

    // ========================================================
    // ACTUALIZAR ANIMACIÓN DE DEVOLUCIÓN
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

        posicion.y +=
            Math.sin(Math.PI * t) *
            config.alturaMovimientoProducto;

        quaternion.slerpQuaternions(
            animacionProducto.quaternionInicial,
            animacionProducto.quaternionFinal,
            suave
        );

        const padre = producto.parent;

        if (padre) {
            padre.updateMatrixWorld(true);

            const posicionLocal =
                animacionProducto.posicionLocalTemporal.copy(
                    posicion
                );

            padre.worldToLocal(posicionLocal);
            producto.position.copy(posicionLocal);

            padre.getWorldQuaternion(
                animacionProducto.quaternionPadreTemporal
            );

            producto.quaternion
                .copy(
                    animacionProducto.quaternionPadreTemporal
                )
                .invert()
                .multiply(quaternion);

            producto.scale.lerpVectors(
                animacionProducto.escalaInicial,
                animacionProducto.escalaFinal,
                suave
            );
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

            return;
        }

        const producto = productoEnMano;
        const original = productoOriginal;
        const tipoDevolucion = animacionProducto.tipo;

        const rackNuevo = original.rackNuevo;

        producto.parent?.remove(producto);

        const padreOriginal = original.parent ?? scene;

        padreOriginal.add(producto);

        if (tipoDevolucion === 'REUBICAR' && original.posicionDestinoLocal) {
            producto.position.copy(
                original.posicionDestinoLocal
            );

            producto.quaternion.copy(
                original.quaternionDestinoLocal ??
                original.quaternionLocal
            );

            producto.scale.copy(
                original.escalaLocal
            );

            producto.userData.reubicado = true;
            producto.userData.rackAnterior =
                original.rackAnterior;

            producto.userData.rackNuevo = rackNuevo;
            producto.userData.rackReubicado = rackNuevo;
        } else {
            // Restaurar exactamente la transformación local original.
            producto.position.copy(original.posicionLocal);
            producto.quaternion.copy(original.quaternionLocal);
            producto.scale.copy(original.escalaLocal);

            producto.userData.reubicado = false;

            delete producto.userData.rackNuevo;
            delete producto.userData.rackReubicado;
        }

        producto.visible = original.visible;

        producto.userData.reservado = false;
        delete producto.userData.reservadoPor;

        producto.updateMatrixWorld(true);

        // Marcarlo como examinado antes de liberar la referencia.
        productosExaminados.add(producto);

        if (reservasProductos.get(producto) === id) {
            reservasProductos.delete(producto);
        }

        productoEnMano = null;
        productoOriginal = null;
        productoObjetivo = null;

        animacionProducto.activa = false;
        animacionProducto.tipo = null;
        animacionProducto.tiempo = 0;

        animacionAgarre.activa = false;
        animacionAgarre.tiempo = 0;

        liberarRack();
    }

    // ========================================================
    // CARRITO
    // ========================================================

    function obtenerGrupoCarrito() {
        if (!config.carrito) return null;

        if (config.carrito.isObject3D) {
            return config.carrito;
        }

        if (config.carrito.grupo?.isObject3D) {
            return config.carrito.grupo;
        }

        if (config.carrito.group?.isObject3D) {
            return config.carrito.group;
        }

        if (config.carrito.modelo?.isObject3D) {
            return config.carrito.modelo;
        }

        return null;
    }

    function obtenerPosicionCarrito() {
        const carrito = config.carrito;

        if (!carrito) return null;

        if (carrito.position?.isVector3) {
            return carrito.position;
        }

        const grupoCarrito = obtenerGrupoCarrito();

        if (grupoCarrito) {
            grupoCarrito.getWorldPosition(vectorTemporal);
            return vectorTemporal;
        }

        return null;
    }

    function obtenerZonaProductosCarrito() {
        const carrito = config.carrito;

        if (!carrito) return null;

        if (
            typeof carrito.obtenerPuntoProductos === 'function'
        ) {
            const punto = carrito.obtenerPuntoProductos();

            if (punto?.isVector3) return punto;

            if (punto && Number.isFinite(punto.x)) {
                return new THREE.Vector3(
                    punto.x,
                    punto.y ?? 0.8,
                    punto.z
                );
            }
        }

        if (
            typeof carrito.getProductPosition === 'function'
        ) {
            const punto = carrito.getProductPosition();

            if (punto?.isVector3) return punto;
        }

        const grupoCarrito = obtenerGrupoCarrito();

        if (grupoCarrito) {
            grupoCarrito.getWorldPosition(vectorTemporal);

            return new THREE.Vector3(
                vectorTemporal.x,
                vectorTemporal.y + 0.85,
                vectorTemporal.z
            );
        }

        return null;
    }

    function guardarProductoEnCarrito(producto) {
        if (!producto || !config.carrito) return false;

        const carrito = config.carrito;

        // Primero se intenta usar la función del módulo de carrito.
        if (typeof carrito.agregarProducto === 'function') {
            const resultado = carrito.agregarProducto(producto);

            return resultado !== false;
        }

        if (typeof carrito.addProduct === 'function') {
            const resultado = carrito.addProduct(producto);

            return resultado !== false;
        }

        // Adaptador alternativo si el carrito es un Object3D.
        const grupoCarrito = obtenerGrupoCarrito();

        if (!grupoCarrito) {
            console.warn(
                `[CLIENTE ${id}] No se encontró el grupo del carrito.`
            );

            return false;
        }

        const zona = obtenerZonaProductosCarrito();

        if (!zona) return false;

        const posicionLocal = zona.clone();

        grupoCarrito.updateMatrixWorld(true);
        grupoCarrito.worldToLocal(posicionLocal);

        producto.parent?.remove(producto);
        grupoCarrito.add(producto);

        producto.position.copy(posicionLocal);
        producto.position.y = Math.max(
            producto.position.y,
            0.85
        );

        producto.rotation.set(0, 0, 0);
        producto.scale.setScalar(0.45);

        producto.userData.enCarrito = true;
        producto.userData.idCliente = id;

        return true;
    }

    function guardarProducto() {
        if (!productoEnMano) return false;

        const producto = productoEnMano;

        const guardado = guardarProductoEnCarrito(producto);

        if (!guardado) {
            console.warn(
                `[CLIENTE ${id}] No se pudo guardar el producto en el carrito.`
            );

            return false;
        }

        producto.userData.enCarrito = true;
        producto.userData.reservado = false;

        delete producto.userData.reservadoPor;

        compras.push(producto);

        if (reservasProductos.get(producto) === id) {
            reservasProductos.delete(producto);
        }

        productoEnMano = null;
        productoOriginal = null;
        productoObjetivo = null;

        animacionAgarre.activa = false;
        animacionProducto.activa = false;

        liberarRack();

        try {
            config.alComprar?.({
                cliente: api,
                producto,
                totalProductos: compras.length
            });
        } catch (error) {
            console.error(error);
        }

        return true;
    }

    // ========================================================
    // DEVOLVER PRODUCTO A SU RACK
    // ========================================================

    function iniciarDevolucion(tipo = 'DEVOLVER') {
        if (!productoEnMano || !productoOriginal) {
            return false;
        }

        const producto = productoEnMano;
        const original = productoOriginal;

        const padreDestino = original.parent ?? scene;

        // Posición final en coordenadas mundiales.
        const destinoMundo = original.posicionMundo.clone();

        // Para una devolución normal se restaura el lugar exacto.
        // Para una reubicación se usa la posición del nuevo rack.
        if (
            tipo === 'REUBICAR' &&
            original.posicionDestinoMundo
        ) {
            destinoMundo.copy(original.posicionDestinoMundo);
        }

        padreDestino.updateMatrixWorld(true);

        const destinoLocal = destinoMundo.clone();
        padreDestino.worldToLocal(destinoLocal);

        // El quaternion del padre se obtiene una sola vez.
        const quaternionPadre = padreDestino.getWorldQuaternion(
            new THREE.Quaternion()
        );

        const inversaQuaternionPadre =
            quaternionPadre.clone().invert();

        const quaternionFinalLocal =
            inversaQuaternionPadre
                .clone()
                .multiply(
                    tipo === 'REUBICAR'
                        ? original.quaternionDestinoMundo
                        : original.quaternionMundo
                );

        const escalaFinalLocal =
            tipo === 'REUBICAR'
                ? original.escalaDestinoLocal.clone()
                : original.escalaLocal.clone();

        const posicionMundoActual = producto.getWorldPosition(
            new THREE.Vector3()
        );

        const quaternionMundoActual = producto.getWorldQuaternion(
            new THREE.Quaternion()
        );

        const escalaMundoActual = producto.getWorldScale(
            new THREE.Vector3()
        );

        producto.parent?.remove(producto);
        padreDestino.add(producto);

        const posicionLocalActual =
            posicionMundoActual.clone();

        padreDestino.worldToLocal(posicionLocalActual);

        const quaternionLocalActual =
            inversaQuaternionPadre
                .clone()
                .multiply(quaternionMundoActual);

        producto.position.copy(posicionLocalActual);
        producto.quaternion.copy(quaternionLocalActual);
        producto.scale.copy(escalaMundoActual);

        animacionProducto.posicionInicial.copy(
            posicionLocalActual
        );

        animacionProducto.posicionFinal.copy(
            destinoLocal
        );

        animacionProducto.quaternionInicial.copy(
            quaternionLocalActual
        );

        animacionProducto.quaternionFinal.copy(
            quaternionFinalLocal
        );

        animacionProducto.escalaInicial.copy(
            escalaMundoActual
        );

        animacionProducto.escalaFinal.copy(
            escalaFinalLocal
        );

        animacionProducto.tipo = tipo;
        animacionProducto.tiempo = 0;
        animacionProducto.duracion = config.tiempoDevolver;
        animacionProducto.activa = true;

        return true;
    }

    // ========================================================
    // BUSCAR DESTINO DE REUBICACIÓN
    // ========================================================

    function buscarDestinoReubicacion() {
        const productos = obtenerListaProductos();
        const candidatos = [];

        for (const producto of productos) {
            if (
                !producto ||
                producto === productoEnMano ||
                !producto.visible
            ) {
                continue;
            }

            if (
                producto.userData?.vendido ||
                producto.userData?.enCarrito ||
                producto.userData?.agotado
            ) {
                continue;
            }

            const clave = obtenerClaveRack(producto);

            if (clave === rackReservado) continue;
            if (!rackDisponible(producto)) continue;

            const posicion = obtenerPosicionProducto(producto);

            if (
                posicion.x < -config.limiteX ||
                posicion.x > config.limiteX ||
                posicion.z < config.limiteZMin ||
                posicion.z > config.limiteZMax
            ) {
                continue;
            }

            candidatos.push({
                posicion: posicion.clone(),
                clave,
                referencia: producto
            });
        }

        if (!candidatos.length) return null;

        candidatos.sort((a, b) => {
            const da = distanciaXZ(grupo.position, a.posicion);
            const db = distanciaXZ(grupo.position, b.posicion);

            return da - db;
        });

        return candidatos[0];
    }

    function iniciarReubicacionProducto() {
        if (!productoEnMano || !productoOriginal) {
            return false;
        }

        const destino = buscarDestinoReubicacion();

        if (!destino) return false;

        const original = productoOriginal;
        const referencia = destino.referencia;

        referencia.updateMatrixWorld(true);

        // Se calcula una posición junto al producto de referencia.
        const cajaReferencia = new THREE.Box3().setFromObject(
            referencia
        );

        const tamano = new THREE.Vector3();
        cajaReferencia.getSize(tamano);

        const posicionDestinoMundo = destino.posicion.clone();

        posicionDestinoMundo.x +=
            tamano.x / 2 + config.separacionProductoRack;

        posicionDestinoMundo.y =
            cajaReferencia.min.y +
            Math.max(0.05, tamano.y / 2);

        posicionDestinoMundo.z +=
            config.separacionProductoRack;

        const padreDestino = original.parent ?? scene;

        padreDestino.updateMatrixWorld(true);

        const posicionDestinoLocal =
            posicionDestinoMundo.clone();

        padreDestino.worldToLocal(posicionDestinoLocal);

        const quaternionDestinoMundo =
            referencia.getWorldQuaternion(
                new THREE.Quaternion()
            );

        const quaternionPadre =
            padreDestino.getWorldQuaternion(
                new THREE.Quaternion()
            );

        const quaternionDestinoLocal =
            quaternionPadre
                .clone()
                .invert()
                .multiply(quaternionDestinoMundo);

        const escalaDestinoLocal =
            original.escalaLocal.clone();

        original.rackNuevo = destino.clave;
        original.posicionDestinoMundo =
            posicionDestinoMundo;

        original.posicionDestinoLocal =
            posicionDestinoLocal;

        original.quaternionDestinoMundo =
            quaternionDestinoMundo;

        original.quaternionDestinoLocal =
            quaternionDestinoLocal;

        original.escalaDestinoLocal =
            escalaDestinoLocal;

        return iniciarDevolucion('REUBICAR');
    }

    // ========================================================
    // SELECCIONAR SIGUIENTE PRODUCTO
    // ========================================================

    function seleccionarSiguienteProducto() {
        liberarReserva();

        if (compras.length >= config.maximoProductos) {
            iniciarRutaCaja();
            return;
        }

        let producto = buscarProductoCercano();

        if (
            producto &&
            Math.random() < config.probabilidadDejarEnOtroRack
        ) {
            const otro = buscarProductoDeOtroRack();

            if (otro) producto = otro;
        }

        if (!producto) {
            iniciarRutaCaja();
            return;
        }

        if (!seleccionarProducto(producto)) {
            tiempoEstado = 0;
            cambiarEstado(ESTADOS.BUSCANDO);
        }
    }

    // ========================================================
    // PROCESAR COMPRA
    // ========================================================

    function procesarCompra() {
        if (!productoEnMano) {
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        decisionCompra =
            Math.random() < config.probabilidadCompra;

        cambiarEstado(ESTADOS.DECIDIENDO);
    }

    function finalizarDecision() {
        if (!productoEnMano) {
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        if (decisionCompra) {
            cambiarEstado(ESTADOS.GUARDANDO);
        } else {
            cambiarEstado(ESTADOS.DEVOLVIENDO);
        }
    }

    // ========================================================
    // FINALIZAR ACCIÓN DE PRODUCTO
    // ========================================================

    function finalizarAccionProducto() {
        if (estado === ESTADOS.GUARDANDO) {
            const guardado = guardarProducto();

            if (!guardado) {
                if (productoEnMano) {
                    iniciarDevolucion('DEVOLVER');
                    cambiarEstado(ESTADOS.DEVOLVIENDO);
                    return;
                }

                cambiarEstado(ESTADOS.BUSCANDO);
                return;
            }

            if (compras.length >= config.maximoProductos) {
                iniciarRutaCaja();
            } else {
                cambiarEstado(ESTADOS.BUSCANDO);
            }

            return;
        }

        if (estado === ESTADOS.DEVOLVIENDO) {
            if (
                Math.random() <
                config.probabilidadDejarEnOtroRack
            ) {
                if (iniciarReubicacionProducto()) {
                    return;
                }
            }

            iniciarDevolucion('DEVOLVER');
        }
    }

    // ========================================================
    // RUTA HACIA LA CAJA
    // ========================================================

    function iniciarRutaCaja() {
        liberarReserva();

        const destino = {
            x: numero(config.posicionCaja.x),
            z: numero(config.posicionCaja.z)
        };

        if (
            !establecerObjetivo(
                destino,
                ESTADOS.CAJA
            )
        ) {
            console.warn(
                `[CLIENTE ${id}] No pudo encontrar ruta a la caja.`
            );

            const alternativa = {
                x: 0,
                z: 21
            };

            if (
                !establecerObjetivo(
                    alternativa,
                    ESTADOS.CAJA
                )
            ) {
                cambiarEstado(ESTADOS.ESPERANDO);
            }
        }
    }

    function iniciarPago() {
        ruta = [];
        indiceRuta = 0;
        objetivo = null;

        cambiarEstado(ESTADOS.PAGANDO);
    }

    // ========================================================
    // COMPLETAR PAGO
    // ========================================================

    function completarPago() {
        const total = compras.reduce((suma, producto) => {
            const precio = Number(
                producto.userData?.precio ??
                producto.userData?.price ??
                producto.userData?.costo ??
                0
            );

            return suma + (
                Number.isFinite(precio) ? precio : 0
            );
        }, 0);

        ticketPendiente = {
            idCliente: id,
            productos: [...compras],
            cantidad: compras.length,
            total,
            fecha: new Date()
        };

        try {
            config.alPagar?.({
                cliente: api,
                ticket: ticketPendiente,
                total,
                productos: [...compras]
            });
        } catch (error) {
            console.error(error);
        }

        if (typeof callbackPagoPendiente === 'function') {
            try {
                callbackPagoPendiente(ticketPendiente);
            } catch (error) {
                console.error(error);
            }

            callbackPagoPendiente = null;
        }

        for (const producto of compras) {
            if (!producto) continue;

            producto.userData.vendido = true;
            producto.userData.enCarrito = false;
        }

        iniciarRegreso();
    }

    // ========================================================
    // VACIAR CARRITO
    // ========================================================

    function vaciarCarrito() {
        const carrito = config.carrito;

        if (!carrito) return;

        if (typeof carrito.limpiar === 'function') {
            carrito.limpiar();
            return;
        }

        if (typeof carrito.clear === 'function') {
            carrito.clear();
            return;
        }

        const grupoCarrito = obtenerGrupoCarrito();

        if (!grupoCarrito) return;

        const elementos = [];

        grupoCarrito.traverse(obj => {
            if (obj.userData?.enCarrito) {
                elementos.push(obj);
            }
        });

        for (const elemento of elementos) {
            elemento.parent?.remove(elemento);
        }
    }
        // ========================================================
    // RUTAS DE ENTRADA Y SALIDA
    // ========================================================

    function crearRutaEntrada(destino) {
        return [
            {
                x: config.puertaCentroX,
                z: config.puertaZExterior
            },
            {
                x: config.puertaCentroX,
                z: config.puertaZUmbral
            },
            {
                x: config.puertaCentroX,
                z: config.puertaZInterior
            },
            {
                x: destino.x,
                z: destino.z
            }
        ];
    }

    function crearRutaSalida(destino) {
        return [
            {
                x: config.puertaCentroX,
                z: config.puertaZInterior
            },
            {
                x: config.puertaCentroX,
                z: config.puertaZUmbral
            },
            {
                x: config.puertaCentroX,
                z: config.puertaZExterior
            },
            {
                x: destino.x,
                z: destino.z
            }
        ];
    }

    function entrarSupermercado(
        destino = { x: 0, z: 18 }
    ) {
        const puntos = crearRutaEntrada(destino);

        if (!establecerRuta(puntos, false)) {
            console.warn(
                `[CLIENTE ${id}] No se pudo crear ruta de entrada.`
            );

            return false;
        }

        cambiarEstado(ESTADOS.ENTRANDO);

        return true;
    }

    function iniciarRegreso(destino) {
        if (!destino) {
            destino = {
                x: grupo.position.x >= 0 ? 7 : -7,
                z: 48
            };
        }

        const puntos = crearRutaSalida(destino);

        if (!establecerRuta(puntos, false)) {
            console.warn(
                `[CLIENTE ${id}] No se pudo crear ruta de salida.`
            );

            return false;
        }

        cambiarEstado(ESTADOS.REGRESANDO);

        return true;
    }

    function establecerDestinoEstacionamiento(posicion) {
        if (!posicion) return false;

        const destino = {
            x: limitar(
                numero(posicion.x),
                -config.limiteX,
                config.limiteX
            ),

            z: limitar(
                numero(posicion.z, 45),
                config.puertaZExterior + 1,
                config.limiteZMax
            )
        };

        callbackRegreso = destino;

        return iniciarRegreso(destino);
    }

    function llegoAlObjetivo() {
        if (objetivo) {
            return distanciaXZ(
                grupo.position,
                objetivo
            ) <= config.distanciaLlegada;
        }

        return ruta.length === 0;
    }

    // ========================================================
    // REINTENTAR BÚSQUEDA
    // ========================================================

    function reintentarBusqueda() {
        if (compras.length >= config.maximoProductos) {
            iniciarRutaCaja();
            return;
        }

        const producto = buscarProductoCercano();

        if (producto) {
            seleccionarProducto(producto);
            return;
        }

        // Si ya no hay productos disponibles, va a caja.
        iniciarRutaCaja();
    }

    // ========================================================
    // ACTUALIZAR ANIMACIONES PROCEDURALES
    // ========================================================

    function actualizarAnimacionesProcedurales() {
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
                animarPagarProcedural();
                break;

            default:
                break;
        }
    }

    // ========================================================
    // ACTUALIZAR PRODUCTO EN MANO
    // ========================================================

    function actualizarProductoEnMano(delta) {
        if (!productoEnMano) return;

        if (animacionAgarre.activa) {
            actualizarAnimacionAgarre(delta);
            return;
        }

        if (animacionProducto.activa) {
            actualizarAnimacionProducto(delta);
            return;
        }

        if (estado === ESTADOS.INSPECCIONANDO) {
            posicionarProductoParaInspeccion();
        }
    }

    // ========================================================
    // ACTUALIZAR MIXER
    // ========================================================

    function actualizarMixer(delta) {
        if (mixer) {
            mixer.update(delta);
        }
    }

    // ========================================================
    // CONSULTAS PÚBLICAS
    // ========================================================

    function obtenerProductosComprados() {
        return [...compras];
    }

    function obtenerCantidadProductos() {
        return compras.length;
    }

    function obtenerTotalCompra() {
        return compras.reduce((total, producto) => {
            const precio = Number(
                producto.userData?.precio ??
                producto.userData?.price ??
                producto.userData?.costo ??
                0
            );

            return total + (
                Number.isFinite(precio) ? precio : 0
            );
        }, 0);
    }

    // ========================================================
    // CONFIGURAR PRODUCTOS
    // ========================================================

    function configurarProductos(lista) {
        if (!Array.isArray(lista)) {
            console.warn(
                `[CLIENTE ${id}] La lista de productos debe ser un array.`
            );

            return false;
        }

        config.productos = lista;

        return true;
    }

    // ========================================================
    // CONFIGURAR CARRITO
    // ========================================================

    function configurarCarrito(carrito) {
        config.carrito = carrito;
        return true;
    }

    // ========================================================
    // CONFIGURAR COLISIONES
    // ========================================================

    function configurarColisiones(colisiones) {
        config.colisiones = Array.isArray(colisiones)
            ? colisiones
            : [];

        actualizarColisiones();

        return true;
    }

    // ========================================================
    // CONFIGURAR MOBILIARIO
    // ========================================================

    function configurarMobiliario(mobiliario) {
        config.mobiliario = mobiliario;

        actualizarColisiones();

        return true;
    }

    // ========================================================
    // OBTENER POSICIÓN Y ESTADO
    // ========================================================

    function obtenerPosicion() {
        return grupo.position.clone();
    }

    function obtenerEstado() {
        return estado;
    }

    function obtenerObjetivo() {
        return objetivo
            ? {
                x: objetivo.x,
                z: objetivo.z
            }
            : null;
    }

    // ========================================================
    // DETENER Y REANUDAR
    // ========================================================

    function detener() {
        detenido = true;

        detenerAccionesGLB();
        activarReposoGLB();

        return true;
    }

    function reanudar() {
        detenido = false;

        if (ruta.length) {
            activarCaminarGLB();
        } else {
            activarReposoGLB();
        }

        return true;
    }

    // ========================================================
    // LIMPIAR RESERVAS
    // ========================================================

    function limpiarReservas() {
        liberarTodasLasReservas();

        for (const [clave, propietario] of reservasRacks) {
            if (propietario === id) {
                reservasRacks.delete(clave);
            }
        }
    }

    // ========================================================
    // INFORMACIÓN DEL CLIENTE
    // ========================================================

    function obtenerInformacion() {
        return {
            id,
            estado,

            posicion: {
                x: grupo.position.x,
                y: grupo.position.y,
                z: grupo.position.z
            },

            objetivo: obtenerObjetivo(),

            productosComprados: compras.length,

            productoEnMano:
                productoEnMano?.name ?? null,

            rutaPendiente: Math.max(
                0,
                ruta.length - indiceRuta
            ),

            intentosMovimiento,

            cargado,
            detenido,
            eliminado
        };
    }

    // ========================================================
    // DEVOLVER PRODUCTO INMEDIATAMENTE
    // ========================================================

    function devolverProductoInmediatamente() {
        if (!productoEnMano || !productoOriginal) {
            return false;
        }

        const producto = productoEnMano;
        const original = productoOriginal;

        producto.parent?.remove(producto);

        const padre = original.parent ?? scene;

        padre.add(producto);

        producto.position.copy(original.posicionLocal);
        producto.quaternion.copy(original.quaternionLocal);
        producto.scale.copy(original.escalaLocal);

        producto.visible = original.visible;

        producto.userData.reservado = false;
        delete producto.userData.reservadoPor;

        producto.userData.reubicado = false;

        delete producto.userData.rackNuevo;
        delete producto.userData.rackReubicado;

        if (reservasProductos.get(producto) === id) {
            reservasProductos.delete(producto);
        }

        producto.updateMatrixWorld(true);

        productoEnMano = null;
        productoOriginal = null;
        productoObjetivo = null;

        animacionAgarre.activa = false;
        animacionProducto.activa = false;

        animacionProducto.tipo = null;

        liberarRack();

        return true;
    }

    // ========================================================
    // ACTUALIZAR ESTADO DEL CLIENTE
    // ========================================================

    function actualizarEstado(delta) {
        tiempoEstado += delta;

        switch (estado) {

            // ------------------------------------------------
            // INACTIVO
            // ------------------------------------------------

            case ESTADOS.INACTIVO: {
                activarReposoGLB();
                break;
            }

            // ------------------------------------------------
            // ENTRANDO
            // ------------------------------------------------

            case ESTADOS.ENTRANDO: {
                const terminado = moverHaciaDestino(delta);

                if (terminado) {
                    if (!entradaNotificada) {
                        entradaNotificada = true;

                        try {
                            config.alEntrar?.({
                                cliente: api,
                                posicion: obtenerPosicion()
                            });
                        } catch (error) {
                            console.error(error);
                        }
                    }

                    cambiarEstado(ESTADOS.BUSCANDO);
                }

                break;
            }

            // ------------------------------------------------
            // BUSCANDO PRODUCTOS
            // ------------------------------------------------

            case ESTADOS.BUSCANDO: {
                activarReposoGLB();

                if (
                    tiempoEstado <
                    config.tiempoReintento
                ) {
                    break;
                }

                reintentarBusqueda();

                break;
            }

            // ------------------------------------------------
            // ACERCÁNDOSE AL PRODUCTO
            // ------------------------------------------------

            case ESTADOS.ACERCANDO: {
                const terminado = moverHaciaDestino(delta);

                if (terminado) {
                    if (
                        !productoObjetivo ||
                        (
                            !productoDisponible(productoObjetivo) &&
                            reservasProductos.get(productoObjetivo) !== id
                        )
                    ) {
                        liberarReserva();
                        cambiarEstado(ESTADOS.BUSCANDO);
                        break;
                    }

                    const distancia = distanciaXZ(
                        grupo.position,
                        obtenerPosicionProducto(productoObjetivo)
                    );

                    if (
                        distancia >
                        config.distanciaProducto + 0.7
                    ) {
                        const nuevoPunto =
                            obtenerPuntoFrenteProducto(
                                productoObjetivo
                            );

                        if (
                            !establecerObjetivo(
                                nuevoPunto,
                                ESTADOS.ACERCANDO
                            )
                        ) {
                            productosExaminados.add(
                                productoObjetivo
                            );

                            liberarReserva();
                            cambiarEstado(ESTADOS.BUSCANDO);
                        }

                        break;
                    }

                    orientarHaciaPunto(
                        obtenerPosicionProducto(productoObjetivo)
                    );

                    cambiarEstado(ESTADOS.RECOGIENDO);
                }

                break;
            }

            // ------------------------------------------------
            // RECOGER PRODUCTO
            // ------------------------------------------------

            case ESTADOS.RECOGIENDO: {
                if (
                    tiempoEstado >=
                    config.tiempoRecoger * 0.45
                ) {
                    if (
                        productoObjetivo &&
                        !productoEnMano &&
                        !animacionAgarre.activa
                    ) {
                        const agarre =
                            iniciarAgarreProducto(
                                productoObjetivo
                            );

                        if (!agarre) {
                            productosExaminados.add(
                                productoObjetivo
                            );

                            liberarReserva();

                            cambiarEstado(ESTADOS.BUSCANDO);
                            break;
                        }
                    }
                }

                if (
                    tiempoEstado >=
                    config.tiempoRecoger
                ) {
                    if (!productoEnMano) {
                        if (productoObjetivo) {
                            productosExaminados.add(
                                productoObjetivo
                            );
                        }

                        liberarReserva();

                        cambiarEstado(ESTADOS.BUSCANDO);
                        break;
                    }

                    cambiarEstado(ESTADOS.INSPECCIONANDO);
                }

                break;
            }

            // ------------------------------------------------
            // INSPECCIONAR PRODUCTO
            // ------------------------------------------------

            case ESTADOS.INSPECCIONANDO: {
                if (
                    tiempoEstado >=
                    config.tiempoInspeccionar
                ) {
                    procesarCompra();
                }

                break;
            }

            // ------------------------------------------------
            // DECIDIR SI COMPRA
            // ------------------------------------------------

            case ESTADOS.DECIDIENDO: {
                if (tiempoEstado >= 0.45) {
                    finalizarDecision();
                }

                break;
            }

            // ------------------------------------------------
            // GUARDAR PRODUCTO
            // ------------------------------------------------

            case ESTADOS.GUARDANDO: {
                if (
                    tiempoEstado >=
                    config.tiempoGuardar
                ) {
                    finalizarAccionProducto();
                }

                break;
            }

            // ------------------------------------------------
            // DEVOLVER PRODUCTO
            // ------------------------------------------------

            case ESTADOS.DEVOLVIENDO: {
                // La animación se inicia una sola vez.
                if (
                    productoEnMano &&
                    !animacionProducto.activa
                ) {
                    finalizarAccionProducto();
                }

                // La actualización real de la animación se hace
                // una sola vez en actualizarProductoEnMano().
                if (
                    !productoEnMano &&
                    !animacionProducto.activa
                ) {
                    cambiarEstado(ESTADOS.BUSCANDO);
                }

                break;
            }

            // ------------------------------------------------
            // ESPERANDO
            // ------------------------------------------------

            case ESTADOS.ESPERANDO: {
                activarReposoGLB();

                if (tiempoEstado >= 2) {
                    if (compras.length > 0) {
                        iniciarRutaCaja();
                    } else {
                        cambiarEstado(ESTADOS.BUSCANDO);
                    }
                }

                break;
            }

            // ------------------------------------------------
            // RUTA PERSONALIZADA
            // ------------------------------------------------

            case ESTADOS.RUTA: {
                const terminado = moverHaciaDestino(delta);

                if (terminado) {
                    if (
                        config.repetirRuta &&
                        rutaRepeticion.length
                    ) {
                        // Volver a crear la ruta desde la posición actual.
                        const nuevaRuta = encontrarCamino(
                            grupo.position,
                            rutaRepeticion[0]
                        );

                        if (nuevaRuta.length) {
                            ruta = [
                                ...nuevaRuta,
                                ...rutaRepeticion.slice(1)
                            ];

                            indiceRuta = 0;
                            objetivo = ruta[ruta.length - 1];

                            reiniciarDetectorMovimiento();
                        } else {
                            cambiarEstado(ESTADOS.BUSCANDO);
                        }
                    } else {
                        cambiarEstado(ESTADOS.BUSCANDO);
                    }
                }

                break;
            }

            // ------------------------------------------------
            // CAMINAR HACIA LA CAJA
            // ------------------------------------------------

            case ESTADOS.CAJA: {
                const terminado = moverHaciaDestino(delta);

                if (terminado) {
                    iniciarPago();
                }

                break;
            }

            // ------------------------------------------------
            // PAGAR
            // ------------------------------------------------

            case ESTADOS.PAGANDO: {
                if (tiempoEstado >= 3.2) {
                    completarPago();
                }

                break;
            }

            // ------------------------------------------------
            // REGRESAR AL ESTACIONAMIENTO
            // ------------------------------------------------

            case ESTADOS.REGRESANDO: {
                const terminado = moverHaciaDestino(delta);

                if (terminado) {
                    vaciarCarrito();

                    const posicionFinal = obtenerPosicion();

                    compras = [];

                    productosExaminados.clear();
                    racksVisitados.clear();

                    limpiarReservas();

                    cambiarEstado(ESTADOS.FINALIZADO);

                    try {
                        config.alFinalizar?.({
                            cliente: api,
                            posicion: posicionFinal,
                            ticket: ticketPendiente
                        });
                    } catch (error) {
                        console.error(error);
                    }

                    if (typeof callbackRegreso === 'function') {
                        try {
                            callbackRegreso(posicionFinal);
                        } catch (error) {
                            console.error(error);
                        }

                        callbackRegreso = null;
                    }
                }

                break;
            }

            // ------------------------------------------------
            // FINALIZADO
            // ------------------------------------------------

            case ESTADOS.FINALIZADO: {
                activarReposoGLB();
                break;
            }

            default: {
                cambiarEstado(ESTADOS.BUSCANDO);
                break;
            }
        }
    }

    // ========================================================
    // ACTUALIZACIÓN GENERAL
    // ========================================================

    function actualizar(delta) {
        if (eliminado || detenido) return;

        if (!Number.isFinite(delta) || delta <= 0) return;

        delta = Math.min(delta, 0.05);

        if (!cargado) return;

        actualizarMixer(delta);

        tiempoActualizarObstaculos += delta;

        if (tiempoActualizarObstaculos >= 1.5) {
            actualizarColisiones();
        }

        actualizarEstado(delta);

        // Las animaciones se actualizan una sola vez por fotograma.
        actualizarAnimacionesProcedurales();

        // El producto también se actualiza una sola vez.
        actualizarProductoEnMano(delta);
    }

    // ========================================================
    // INICIAR AUTOMÁTICAMENTE
    // ========================================================

    function iniciar() {
        if (eliminado) return false;

        detenido = false;

        if (estado === ESTADOS.INACTIVO) {
            cambiarEstado(ESTADOS.BUSCANDO);
        }

        return true;
    }

    // ========================================================
    // REINICIAR CLIENTE
    // ========================================================

    function reiniciar(opciones = {}) {
        if (eliminado) return false;

        // No dejar productos pegados a la mano al reiniciar.
        devolverProductoInmediatamente();

        limpiarReservas();

        ruta = [];
        indiceRuta = 0;
        objetivo = null;

        productoObjetivo = null;
        productoEnMano = null;
        productoOriginal = null;

        compras = [];

        productosExaminados.clear();
        racksVisitados.clear();

        animacionAgarre.activa = false;
        animacionProducto.activa = false;

        animacionProducto.tipo = null;

        ticketPendiente = null;
        callbackPagoPendiente = null;
        callbackRegreso = null;

        entradaNotificada = false;
        detenido = false;

        if (opciones.posicion) {
            establecerPosicion(opciones.posicion);
        }

        if (opciones.carrito) {
            configurarCarrito(opciones.carrito);
        }

        if (opciones.productos) {
            configurarProductos(opciones.productos);
        }

        if (opciones.mobiliario) {
            configurarMobiliario(opciones.mobiliario);
        }

        cambiarEstado(ESTADOS.BUSCANDO);

        return true;
    }

    // ========================================================
    // COMENZAR COMPRA DESDE EL EXTERIOR
    // ========================================================

    function comenzarCompra(opciones = {}) {
        if (eliminado) return false;

        if (opciones.carrito) {
            configurarCarrito(opciones.carrito);
        }

        if (opciones.productos) {
            configurarProductos(opciones.productos);
        }

        if (opciones.mobiliario) {
            configurarMobiliario(opciones.mobiliario);
        }

        if (opciones.colisiones) {
            configurarColisiones(opciones.colisiones);
        }

        if (opciones.posicion) {
            establecerPosicion(opciones.posicion);
        }

        if (opciones.posicionCaja) {
            config.posicionCaja = {
                ...config.posicionCaja,
                ...opciones.posicionCaja
            };
        }

        entradaNotificada = false;

        productosExaminados.clear();
        racksVisitados.clear();

        compras = [];

        return entrarSupermercado(
            opciones.destino ?? { x: 0, z: 18 }
        );
    }

    // ========================================================
    // CONFIGURAR CAJA
    // ========================================================

    function configurarCaja(posicion) {
        if (!posicion) return false;

        config.posicionCaja = {
            x: numero(
                posicion.x,
                config.posicionCaja.x
            ),

            z: numero(
                posicion.z,
                config.posicionCaja.z
            )
        };

        return true;
    }

    // ========================================================
    // FORZAR PAGO
    // ========================================================

    function pagar(callback) {
        if (typeof callback === 'function') {
            callbackPagoPendiente = callback;
        }

        if (estado === ESTADOS.FINALIZADO) {
            return false;
        }

        if (estado === ESTADOS.PAGANDO) {
            return true;
        }

        if (compras.length === 0) {
            return false;
        }

        iniciarRutaCaja();

        return true;
    }

    // ========================================================
    // SALIR MANUALMENTE
    // ========================================================

    function salir(posicion) {
        if (eliminado) return false;

        // Si llevaba un producto en la mano, se devuelve antes
        // de iniciar la salida. Así no se marcha con él pegado.
        if (productoEnMano) {
            devolverProductoInmediatamente();
        }

        liberarReserva();

        return iniciarRegreso(posicion);
    }

    // ========================================================
    // CAMBIAR VELOCIDAD
    // ========================================================

    function establecerVelocidad(velocidad) {
        if (
            !Number.isFinite(velocidad) ||
            velocidad <= 0
        ) {
            return false;
        }

        config.velocidad = velocidad;

        return true;
    }

    // ========================================================
    // CAMBIAR MODELO
    // ========================================================

    function establecerModelo(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }

        config.modelo = url;

        if (modelo) {
            grupo.remove(modelo);
            modelo = null;
        }

        mixer?.stopAllAction();

        mixer = null;
        accionCaminar = null;
        accionReposo = null;

        cargado = false;

        cargarModelo();

        return true;
    }

    // ========================================================
    // ELIMINAR CLIENTE
    // ========================================================

    function eliminar() {
        if (eliminado) return;

        eliminado = true;
        detenido = true;

        // Devolver el producto si el cliente lo llevaba.
        devolverProductoInmediatamente();

        limpiarReservas();

        detenerAccionesGLB();

        mixer?.stopAllAction();

        if (mixer && modelo) {
            mixer.uncacheRoot(modelo);
        }

        mixer = null;

        ruta = [];
        objetivo = null;

        scene.remove(grupo);

        // IMPORTANTE:
        // No destruir geometrías ni materiales porque pueden
        // estar compartidos con otros clientes o modelos.
        modelo = null;

        console.log(
            `[CLIENTE ${id}] Cliente eliminado.`
        );
    }

    // ========================================================
    // API PÚBLICA
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

        get eliminado() {
            return eliminado;
        },

        get detenido() {
            return detenido;
        },

        get posicion() {
            return obtenerPosicion();
        },

        get productosComprados() {
            return obtenerProductosComprados();
        },

        get cantidadProductos() {
            return obtenerCantidadProductos();
        },

        get totalCompra() {
            return obtenerTotalCompra();
        },

        get productoEnMano() {
            return productoEnMano;
        },

        get objetivo() {
            return obtenerObjetivo();
        },

        get ticket() {
            return ticketPendiente;
        },

        actualizar,

        iniciar,
        detener,
        reanudar,
        reiniciar,

        comenzarCompra,
        entrarSupermercado,
        iniciarRegreso,
        establecerDestinoEstacionamiento,

        establecerObjetivo,
        establecerRuta,
        establecerPosicion,

        configurarProductos,
        configurarCarrito,
        configurarColisiones,
        configurarMobiliario,
        configurarCaja,

        establecerVelocidad,
        establecerModelo,

        buscarProductoCercano,
        seleccionarProducto,

        pagar,
        salir,

        obtenerPosicion,
        obtenerEstado,
        obtenerObjetivo,
        obtenerInformacion,

        obtenerProductosComprados,
        obtenerCantidadProductos,
        obtenerTotalCompra,

        eliminar
    };

    // ========================================================
    // INICIALIZACIÓN
    // ========================================================

    actualizarColisiones();

    if (!config.inactivo) {
        cambiarEstado(ESTADOS.BUSCANDO);
    }

    console.log(
        `[CLIENTE ${id}] Cliente creado.`,
        {
            modelo: config.modelo,
            posicion: grupo.position,
            estado
        }
    );

    return api;
}

// ============================================================
// FUNCIONES AUXILIARES PARA CREAR VARIOS CLIENTES
// ============================================================

export function crearGrupoClientes(scene, configuraciones = []) {
    const clientes = [];

    for (const configuracion of configuraciones) {
        const cliente = crearClienteSupermercado(
            scene,
            configuracion
        );

        clientes.push(cliente);
    }

    return clientes;
}

// ============================================================
// ACTUALIZAR TODOS LOS CLIENTES
// ============================================================

export function actualizarClientes(clientes, delta) {
    if (!Array.isArray(clientes)) return;

    for (const cliente of clientes) {
        if (!cliente || cliente.eliminado) continue;

        cliente.actualizar(delta);
    }
}

// ============================================================
// ELIMINAR TODOS LOS CLIENTES
// ============================================================

export function eliminarClientes(clientes) {
    if (!Array.isArray(clientes)) return;

    for (const cliente of clientes) {
        cliente?.eliminar?.();
    }

    clientes.length = 0;
}
