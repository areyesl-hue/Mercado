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
    tiempoInspeccionar: 3.2,
    tiempoGuardar: 1.4,
    tiempoDevolver: 1.8,
    tiempoEntreProductos: 0.8,
    tiempoReintento: 1.5,

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

    maximoProductos: 3,
    distanciaMaximaBusqueda: 40,

    separacionProductoRack: 0.06,
    alturaMovimientoProducto: 0.12,

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
    // VARIABLES
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
    let intentosMovimiento = 0;

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

    let pagoConfirmado = false;
    let callbackPagoEjecutado = false;

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
        escalaFinal: new THREE.Vector3(1, 1, 1)
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

        const posicion = new THREE.Vector3();
        producto.getWorldPosition(posicion);

        const x = Math.round(posicion.x / TAMANO_ZONA_RACK);
        const z = Math.round(posicion.z / TAMANO_ZONA_RACK);

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
    // ESQUELETO
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

        rig.cuello = buscarHueso(
            'neck',
            'cuello'
        );

        rig.cabeza = buscarHueso(
            'head',
            'cabeza'
        );

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

    function aplicarRotacion(hueso, eje, angulo) {

        if (!hueso) return;

        const base = huesosBase.get(hueso);
        if (!base) return;

        hueso.quaternion.copy(base.quaternion);

        hueso.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(eje, angulo)
        );
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

        grupo.position.y = 0;
    }

    // ========================================================
    // ALTURA DEL PRODUCTO
    // ========================================================

    function productoEstaEnEstanteInferior(producto) {

        if (!producto) return false;

        producto.updateMatrixWorld(true);

        const caja = new THREE.Box3().setFromObject(producto);

        if (caja.isEmpty()) return false;

        const alturaCentro = (caja.min.y + caja.max.y) / 2;

        return alturaCentro < config.alturaEstanteInferior;
    }

    // ========================================================
    // ANIMACIÓN DE CAMINAR
    // ========================================================

    function animarCaminarProcedural(delta) {

        faseAnimacion += delta * 8.5;

        const paso = Math.sin(faseAnimacion) * 0.32;

        const rebote =
            Math.abs(Math.sin(faseAnimacion)) * 0.025;

        aplicarRotacion(
            rig.piernaIzquierda,
            EJE_X,
            paso
        );

        aplicarRotacion(
            rig.piernaDerecha,
            EJE_X,
            -paso
        );

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

        grupo.position.y = rebote;
    }

    // ========================================================
    // AGACHARSE
    // ========================================================

    function animarAgacharse(intensidad = 1) {

        intensidad = limitar(intensidad, 0, 1);

        aplicarRotacion(
            rig.cadera,
            EJE_X,
            0.30 * intensidad
        );

        aplicarRotacion(
            rig.torso,
            EJE_X,
            0.25 * intensidad
        );

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

    // ========================================================
    // RECOGER PRODUCTO
    // ========================================================

    function animarRecogerProcedural() {

        const t = suavizar(
            tiempoEstado / Math.max(config.tiempoRecoger, 0.01)
        );

        const agachado = productoEsInferior ? 1 : 0;

        animarAgacharse(
            agachado * suavizar(t * 1.5)
        );

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

        aplicarRotacion(
            rig.brazoIzquierdo,
            EJE_X,
            -0.2 * t
        );

        aplicarRotacion(
            rig.antebrazoIzquierdo,
            EJE_X,
            -0.15 * t
        );

        aplicarRotacion(
            rig.torso,
            EJE_X,
            0.10 * t + 0.25 * agachado * t
        );

        aplicarRotacion(
            rig.cabeza,
            EJE_X,
            0.18 * t
        );

        aplicarRotacion(
            rig.cuello,
            EJE_X,
            0.12 * t
        );
    }

    // ========================================================
    // INSPECCIONAR PRODUCTO
    // ========================================================

    function animarInspeccionarProcedural() {

        const oscilacion =
            Math.sin(tiempoEstado * 2.5) * 0.035;

        const movimientoCabeza =
            Math.sin(tiempoEstado * 1.4) * 0.045;

        aplicarRotacion(
            rig.brazoDerecho,
            EJE_X,
            -1.10 + oscilacion
        );

        aplicarRotacion(
            rig.antebrazoDerecho,
            EJE_X,
            -1.0 + oscilacion
        );

        aplicarRotacion(
            rig.brazoIzquierdo,
            EJE_X,
            -0.72
        );

        aplicarRotacion(
            rig.antebrazoIzquierdo,
            EJE_X,
            -0.85
        );

        aplicarRotacion(
            rig.cabeza,
            EJE_X,
            0.22 + movimientoCabeza
        );

        aplicarRotacion(
            rig.cuello,
            EJE_X,
            0.10
        );

        if (productoEsInferior) {

            animarAgacharse(
                1 - suavizar(tiempoEstado * 1.5)
            );
        }

        if (productoEnMano) {

            productoEnMano.position.y =
                numero(config.offsetProductoMano.y) +
                Math.sin(tiempoEstado * 2.2) * 0.025;
        }
    }

    // ========================================================
    // GUARDAR EN CARRITO
    // ========================================================

    function animarGuardarProcedural() {

        const t = Math.sin(tiempoEstado * 5) * 0.08;

        aplicarRotacion(
            rig.brazoDerecho,
            EJE_X,
            -0.75 + t
        );

        aplicarRotacion(
            rig.antebrazoDerecho,
            EJE_X,
            -0.8
        );

        aplicarRotacion(
            rig.brazoIzquierdo,
            EJE_X,
            -0.45
        );

        aplicarRotacion(
            rig.antebrazoIzquierdo,
            EJE_X,
            -0.55
        );

        aplicarRotacion(
            rig.cabeza,
            EJE_X,
            0.10
        );
    }

    // ========================================================
    // DEVOLVER PRODUCTO
    // ========================================================

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

    // ========================================================
    // ANIMAR PRODUCTO ENTRE UBICACIONES
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

        const posicion = new THREE.Vector3().lerpVectors(
            animacionProducto.posicionInicial,
            animacionProducto.posicionFinal,
            suave
        );

        posicion.y +=
            Math.sin(Math.PI * t) *
            config.alturaMovimientoProducto;

        const quaternion = new THREE.Quaternion().slerpQuaternions(
            animacionProducto.quaternionInicial,
            animacionProducto.quaternionFinal,
            suave
        );

        const padre = producto.parent;

        if (padre) {

            padre.updateMatrixWorld(true);

            const posicionLocal = padre.worldToLocal(
                posicion.clone()
            );

            producto.position.copy(posicionLocal);

            const quaternionPadre = new THREE.Quaternion();

            padre.getWorldQuaternion(quaternionPadre);

            producto.quaternion
                .copy(quaternionPadre.invert())
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

        producto.userData.enMano = false;
        producto.userData.enCarrito = false;
        producto.userData.reservadoPor = null;

        animacionProducto.activa = false;
        animacionProducto.tipo = null;

        productoEnMano = null;
        productoOriginal = null;
        productoObjetivo = null;

        productoEsInferior = false;

        restaurarPoseCompleta();

        liberarRack();
    }

    // ========================================================
    // ANIMACIÓN DE PRODUCTO
    // ========================================================

    function iniciarAnimacionProducto(
        tipo,
        posicionFinal,
        quaternionFinal,
        escalaFinal,
        duracion
    ) {

        if (!productoEnMano) return false;

        productoEnMano.updateMatrixWorld(true);

        const posicionActual = new THREE.Vector3();
        const quaternionActual = new THREE.Quaternion();

        productoEnMano.getWorldPosition(posicionActual);
        productoEnMano.getWorldQuaternion(quaternionActual);

        animacionProducto.activa = true;
        animacionProducto.tipo = tipo;
        animacionProducto.tiempo = 0;
        animacionProducto.duracion = Math.max(duracion, 0.01);

        animacionProducto.posicionInicial.copy(posicionActual);
        animacionProducto.posicionFinal.copy(posicionFinal);

        animacionProducto.quaternionInicial.copy(quaternionActual);
        animacionProducto.quaternionFinal.copy(quaternionFinal);

        animacionProducto.escalaInicial.copy(productoEnMano.scale);
        animacionProducto.escalaFinal.copy(escalaFinal);

        return true;
    }

    // ========================================================
    // TOMAR PRODUCTO
    // ========================================================

    function tomarProducto(producto) {

        if (!producto || !producto.parent) return false;

        const mano = rig.manoDerecha ?? rig.brazoDerecho;

        if (!mano) return false;

        producto.updateMatrixWorld(true);

        const padreOriginal = producto.parent;

        const posicionOriginal = producto.position.clone();
        const quaternionOriginal = producto.quaternion.clone();
        const escalaOriginal = producto.scale.clone();
        const visibleOriginal = producto.visible;

        productoOriginal = {
            parent: padreOriginal,
            posicion: posicionOriginal,
            quaternion: quaternionOriginal,
            escala: escalaOriginal,
            visible: visibleOriginal
        };

        productoEnMano = producto;
        productoObjetivo = producto;

        productoEsInferior = productoEstaEnEstanteInferior(producto);

        const posicionMundo = new THREE.Vector3();
        const quaternionMundo = new THREE.Quaternion();

        producto.getWorldPosition(posicionMundo);
        producto.getWorldQuaternion(quaternionMundo);

        mano.attach(producto);

        producto.position.set(
            numero(config.offsetProductoMano.x),
            numero(config.offsetProductoMano.y),
            numero(config.offsetProductoMano.z)
        );

        producto.rotation.set(
            numero(config.rotacionProductoMano.x),
            numero(config.rotacionProductoMano.y),
            numero(config.rotacionProductoMano.z)
        );

        producto.scale.multiplyScalar(config.escalaProductoMano);

        producto.userData.enMano = true;
        producto.userData.reservadoPor = id;

        animacionProducto.activa = false;
        animacionProducto.tipo = null;

        return true;
    }

    // ========================================================
    // DEVOLVER PRODUCTO AL ESTANTE
    // ========================================================

    function devolverProductoAlEstante() {

        if (!productoEnMano || !productoOriginal) {
            return false;
        }

        const original = productoOriginal;

        const destino = new THREE.Vector3();

        if (original.parent) {

            original.parent.updateMatrixWorld(true);

            destino.copy(original.posicion);

            original.parent.localToWorld(destino);

        } else {

            destino.copy(original.posicion);
        }

        const quaternionDestino = new THREE.Quaternion();

        if (original.parent) {

            const quaternionPadre = new THREE.Quaternion();

            original.parent.getWorldQuaternion(quaternionPadre);

            quaternionDestino
                .copy(quaternionPadre)
                .multiply(original.quaternion);

        } else {

            quaternionDestino.copy(original.quaternion);
        }

        return iniciarAnimacionProducto(
            'DEVOLVER',
            destino,
            quaternionDestino,
            original.escala,
            config.tiempoDevolver
        );
    }

    // ========================================================
    // DEVOLVER PRODUCTO A OTRO RACK
    // ========================================================

    function prepararDevolucionEnOtroRack() {

        if (!productoEnMano || !productoOriginal) {
            return false;
        }

        const ubicacion = buscarUbicacionDevolucion(productoEnMano);

        if (!ubicacion) {
            return devolverProductoAlEstante();
        }

        const producto = productoEnMano;

        const padreNuevo = ubicacion.ancla.parent;

        if (!padreNuevo) {
            return devolverProductoAlEstante();
        }

        padreNuevo.updateMatrixWorld(true);

        const posicionNueva = ubicacion.ancla.position.clone();
        const quaternionNuevo = ubicacion.ancla.quaternion.clone();
        const escalaNueva = productoOriginal.escala.clone();

        const posicionMundo = new THREE.Vector3();
        const quaternionMundo = new THREE.Quaternion();

        padreNuevo.localToWorld(posicionNueva.clone());

        posicionMundo.copy(posicionNueva);
        padreNuevo.getWorldQuaternion(quaternionMundo);
        quaternionMundo.multiply(quaternionNuevo);

        liberarRack();

        productoOriginal = {
            parent: padreNuevo,
            posicion: posicionNueva,
            quaternion: quaternionNuevo,
            escala: escalaNueva,
            visible: true
        };

        producto.userData.rackReubicado = obtenerClaveRack(
            ubicacion.ancla
        );

        reservarRack(ubicacion.ancla);

        return iniciarAnimacionProducto(
            'REUBICAR',
            posicionMundo,
            quaternionMundo,
            escalaNueva,
            config.tiempoDevolver
        );
    }

    // ========================================================
    // UBICACIÓN DE DEVOLUCIÓN
    // ========================================================

    function buscarUbicacionDevolucion(producto) {

        const productos = obtenerListaProductos();

        let mejor = null;
        let mejorDistancia = Infinity;

        for (const candidato of productos) {

            if (!candidato || candidato === producto) continue;
            if (!candidato.parent) continue;
            if (!candidato.visible) continue;

            const datos = candidato.userData ?? {};

            if (
                datos.enCarrito ||
                datos.enMano ||
                datos.vendido ||
                datos.reservadoPor
            ) {
                continue;
            }

            const clave = obtenerClaveRack(candidato);

            if (racksVisitados.has(clave)) continue;
            if (!rackDisponible(candidato)) continue;

            const posicion = new THREE.Vector3();
            candidato.getWorldPosition(posicion);

            const distancia = grupo.position.distanceTo(posicion);

            if (distancia < 2.5 || distancia > 18) continue;

            if (distancia < mejorDistancia) {

                mejorDistancia = distancia;

                mejor = {
                    ancla: candidato,
                    posicion
                };
            }
        }

        return mejor;
    }

    // ========================================================
    // OBTENER PRODUCTOS
    // ========================================================

    function obtenerListaProductos() {

        const lista = [];

        const fuente = config.productos;

        if (Array.isArray(fuente)) {

            for (const producto of fuente) {

                if (producto?.isObject3D) {
                    lista.push(producto);
                }
            }

            return lista;
        }

        if (fuente?.isObject3D) {

            fuente.traverse(obj => {

                if (
                    obj.isMesh &&
                    (
                        obj.userData?.esProducto ||
                        obj.userData?.producto ||
                        obj.userData?.codigo ||
                        obj.userData?.precio !== undefined
                    )
                ) {
                    lista.push(obj);
                }
            });

            return lista;
        }

        scene.traverse(obj => {

            if (!obj.isMesh) return;

            const datos = obj.userData ?? {};

            if (
                datos.esProducto ||
                datos.producto ||
                datos.codigo ||
                datos.precio !== undefined
            ) {
                lista.push(obj);
            }
        });

        return lista;
    }

    // ========================================================
    // PRODUCTO DISPONIBLE
    // ========================================================

    function productoDisponible(producto) {

        if (!producto || !producto.parent || !producto.visible) {
            return false;
        }

        const datos = producto.userData ?? {};

        if (
            datos.enCarrito ||
            datos.enMano ||
            datos.vendido ||
            datos.noDisponible ||
            datos.reservadoPor
        ) {
            return false;
        }

        const propietario = reservasProductos.get(producto);

        if (propietario !== undefined && propietario !== id) {
            return false;
        }

        return rackDisponible(producto);
    }

    // ========================================================
    // RESERVAR PRODUCTO
    // ========================================================

    function reservarProducto(producto) {

        if (!productoDisponible(producto)) return false;

        reservasProductos.set(producto, id);

        producto.userData.reservadoPor = id;

        return reservarRack(producto);
    }

    function liberarProducto(producto) {

        if (!producto) return;

        if (reservasProductos.get(producto) === id) {
            reservasProductos.delete(producto);
        }

        if (producto.userData?.reservadoPor === id) {
            delete producto.userData.reservadoPor;
        }
    }

    // ========================================================
    // BUSCAR PRODUCTO
    // ========================================================

    function buscarProducto() {

        const productos = obtenerListaProductos();

        let mejorProducto = null;
        let mejorDistancia = Infinity;

        for (const producto of productos) {

            if (!productoDisponible(producto)) continue;
            if (productosExaminados.has(producto)) continue;

            producto.updateMatrixWorld(true);

            const posicion = new THREE.Vector3();
            producto.getWorldPosition(posicion);

            const distancia = grupo.position.distanceTo(posicion);

            if (distancia > config.distanciaMaximaBusqueda) {
                continue;
            }

            if (distancia < mejorDistancia) {

                mejorDistancia = distancia;
                mejorProducto = producto;
            }
        }

        if (!mejorProducto) return false;

        if (!reservarProducto(mejorProducto)) {
            return false;
        }

        productoObjetivo = mejorProducto;

        const posicionProducto = new THREE.Vector3();
        mejorProducto.getWorldPosition(posicionProducto);

        const destino = calcularPuntoFrenteProducto(
            posicionProducto,
            mejorProducto
        );

        if (!establecerObjetivo(destino, ESTADOS.ACERCANDO)) {

            liberarProducto(mejorProducto);
            liberarRack();

            productoObjetivo = null;

            return false;
        }

        return true;
    }

    // ========================================================
    // PUNTO FRENTE AL PRODUCTO
    // ========================================================

    function calcularPuntoFrenteProducto(posicion, producto) {

        const centro = new THREE.Vector3();
        producto.getWorldPosition(centro);

        const direccion = new THREE.Vector3()
            .subVectors(grupo.position, centro);

        direccion.y = 0;

        if (direccion.lengthSq() < 0.0001) {
            direccion.set(0, 0, 1);
        }

        direccion.normalize();

        return {

            x: centro.x + direccion.x * config.distanciaFrenteProducto,
            z: centro.z + direccion.z * config.distanciaFrenteProducto
        };
    }

    // ========================================================
    // COLISIONES
    // ========================================================

    let obstaculos = [];

    function estaMarcadoSinColision(objeto) {

        let actual = objeto;

        while (actual) {

            const datos = actual.userData ?? {};

            if (
                datos.sinColision ||
                datos.noColision ||
                datos.esProducto
            ) {
                return true;
            }

            actual = actual.parent;
        }

        return false;
    }

    function actualizarColisiones() {

        obstaculos = [];

        const fuentes = [];

        if (config.colisiones) {
            fuentes.push(config.colisiones);
        }

        if (config.mobiliario) {
            fuentes.push(config.mobiliario);
        }

        for (const fuente of fuentes) {

            if (Array.isArray(fuente)) {

                for (const elemento of fuente) {

                    if (elemento?.isObject3D) {
                        agregarObstaculoObjeto(elemento);
                    }
                }

                continue;
            }

            if (fuente?.isObject3D) {

                fuente.traverse(obj => {

                    if (obj.isMesh) {
                        agregarObstaculoObjeto(obj);
                    }
                });
            }
        }

        obstaculos = obstaculos.filter(obstaculo => {

            return (
                Number.isFinite(obstaculo.x) &&
                Number.isFinite(obstaculo.z) &&
                obstaculo.ancho > 0.05 &&
                obstaculo.profundidad > 0.05
            );
        });
    }

    function agregarObstaculoObjeto(objeto) {

        if (!objeto?.isMesh) return;
        if (estaMarcadoSinColision(objeto)) return;

        objeto.updateMatrixWorld(true);

        const caja = new THREE.Box3().setFromObject(objeto);

        if (caja.isEmpty()) return;

        const tamano = new THREE.Vector3();
        const centro = new THREE.Vector3();

        caja.getSize(tamano);
        caja.getCenter(centro);

        if (
            tamano.x < 0.08 ||
            tamano.z < 0.08 ||
            tamano.y < 0.05
        ) {
            return;
        }

        obstaculos.push({

            x: centro.x,
            z: centro.z,

            ancho: tamano.x,
            profundidad: tamano.z
        });
    }

    // ========================================================
    // PUNTO LIBRE
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

        if (estaEnCorredorPuerta(x, z)) {
            return true;
        }

        const radio =
            config.radioColision +
            config.margenObstaculos;

        for (const obstaculo of obstaculos) {

            const mitadX =
                obstaculo.ancho / 2 + radio;

            const mitadZ =
                obstaculo.profundidad / 2 + radio;

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
    // CAMINO A*
    // ========================================================

    function claveCelda(x, z) {
        return `${x},${z}`;
    }

    function encontrarCamino(origen, destino) {

        if (!origen || !destino) return [];

        const tamano = config.tamanoCelda;

        const inicio = {

            x: Math.round(origen.x / tamano),
            z: Math.round(origen.z / tamano)
        };

        const fin = {

            x: Math.round(destino.x / tamano),
            z: Math.round(destino.z / tamano)
        };

        const convertir = celda => ({

            x: celda.x * tamano,
            z: celda.z * tamano
        });

        const inicioClave = claveCelda(inicio.x, inicio.z);
        const finClave = claveCelda(fin.x, fin.z);

        const abiertos = new Map();
        const cerrados = new Set();

        const nodos = new Map();

        const heuristica = (a, b) => {

            const dx = Math.abs(a.x - b.x);
            const dz = Math.abs(a.z - b.z);

            return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz);
        };

        const nodoInicial = {

            ...inicio,

            g: 0,
            h: heuristica(inicio, fin),

            padre: null
        };

        nodoInicial.f = nodoInicial.g + nodoInicial.h;

        abiertos.set(inicioClave, nodoInicial);
        nodos.set(inicioClave, nodoInicial);

        const direcciones = [

            [1, 0, 1],
            [-1, 0, 1],
            [0, 1, 1],
            [0, -1, 1],

            [1, 1, Math.SQRT2],
            [1, -1, Math.SQRT2],
            [-1, 1, Math.SQRT2],
            [-1, -1, Math.SQRT2]
        ];

        let iteraciones = 0;
        const maxIteraciones = 12000;

        while (
            abiertos.size > 0 &&
            iteraciones < maxIteraciones
        ) {

            iteraciones++;

            let actual = null;
            let claveActual = null;

            for (const [clave, nodo] of abiertos) {

                if (!actual || nodo.f < actual.f) {

                    actual = nodo;
                    claveActual = clave;
                }
            }

            if (!actual) break;

            if (claveActual === finClave) {

                const camino = [];

                let nodo = actual;

                while (nodo) {

                    camino.unshift(convertir(nodo));
                    nodo = nodo.padre;
                }

                return suavizarCamino(camino);
            }

            abiertos.delete(claveActual);
            cerrados.add(claveActual);

            for (const [dx, dz, costo] of direcciones) {

                const nx = actual.x + dx;
                const nz = actual.z + dz;

                const clave = claveCelda(nx, nz);

                if (cerrados.has(clave)) continue;

                const punto = convertir({ x: nx, z: nz });

                if (!puntoLibre(punto.x, punto.z)) {
                    continue;
                }

                if (dx !== 0 && dz !== 0) {

                    const lateralX = convertir({
                        x: actual.x + dx,
                        z: actual.z
                    });

                    const lateralZ = convertir({
                        x: actual.x,
                        z: actual.z + dz
                    });

                    if (
                        !puntoLibre(lateralX.x, lateralX.z) ||
                        !puntoLibre(lateralZ.x, lateralZ.z)
                    ) {
                        continue;
                    }
                }

                const g = actual.g + costo;

                let vecino = nodos.get(clave);

                if (!vecino) {

                    vecino = {

                        x: nx,
                        z: nz,

                        g: Infinity,
                        h: heuristica({ x: nx, z: nz }, fin),

                        f: Infinity,

                        padre: null
                    };

                    nodos.set(clave, vecino);
                }

                if (g >= vecino.g) continue;

                vecino.g = g;
                vecino.f = vecino.g + vecino.h;
                vecino.padre = actual;

                abiertos.set(clave, vecino);
            }
        }

        if (puntoLibre(destino.x, destino.z)) {
            return [{ x: destino.x, z: destino.z }];
        }

        return [];
    }

    // ========================================================
    // SUAVIZAR CAMINO
    // ========================================================

    function suavizarCamino(camino) {

        if (camino.length <= 2) return camino;

        const resultado = [];

        let indice = 0;

        resultado.push(camino[0]);

        while (indice < camino.length - 1) {

            let siguiente = camino.length - 1;

            while (siguiente > indice + 1) {

                if (
                    lineaLibre(
                        camino[indice],
                        camino[siguiente]
                    )
                ) {
                    break;
                }

                siguiente--;
            }

            resultado.push(camino[siguiente]);

            indice = siguiente;
        }

        return resultado;
    }

    function lineaLibre(a, b) {

        const distancia = distanciaXZ(a, b);

        const pasos = Math.max(
            2,
            Math.ceil(distancia / 0.3)
        );

        for (let i = 1; i < pasos; i++) {

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
    // ESTABLECER OBJETIVO
    // ========================================================

    function establecerObjetivo(destino, nuevoEstado = ESTADOS.RUTA) {

        if (!destino) return false;

        const puntoDestino = {

            x: limitar(
                numero(destino.x),
                -config.limiteX,
                config.limiteX
            ),

            z: limitar(
                numero(destino.z),
                config.limiteZMin,
                config.limiteZMax
            )
        };

        if (!puntoLibre(puntoDestino.x, puntoDestino.z)) {
            return false;
        }

        const origen = {

            x: grupo.position.x,
            z: grupo.position.z
        };

        const nuevoCamino = encontrarCamino(
            origen,
            puntoDestino
        );

        if (!nuevoCamino.length) {
            return false;
        }

        ruta = nuevoCamino;
        indiceRuta = 0;

        objetivo = puntoDestino;

        intentosMovimiento = 0;

        cambiarEstado(nuevoEstado);

        return true;
    }

    // ========================================================
    // ESTADOS
    // ========================================================

    function cambiarEstado(nuevoEstado) {

        if (estado === nuevoEstado) return;

        const anterior = estado;

        estado = nuevoEstado;
        tiempoEstado = 0;

        try {

            config.alCambiarEstado?.({

                cliente: api,
                id,
                anterior,
                estado: nuevoEstado
            });

        } catch (error) {

            console.error(
                `[CLIENTE ${id}] Error en callback de estado:`,
                error
            );
        }
    }

    // ========================================================
    // ORIENTACIÓN
    // ========================================================

    function orientarHacia(destino, delta) {

        const dx = destino.x - grupo.position.x;
        const dz = destino.z - grupo.position.z;

        if (Math.abs(dx) + Math.abs(dz) < 0.0001) {
            return;
        }

        const anguloObjetivo = Math.atan2(dx, dz);

        const actual = grupo.rotation.y;

        let diferencia = anguloObjetivo - actual;

        while (diferencia > Math.PI) {
            diferencia -= Math.PI * 2;
        }

        while (diferencia < -Math.PI) {
            diferencia += Math.PI * 2;
        }

        grupo.rotation.y += limitar(
            diferencia,
            -config.velocidadRotacion * delta,
            config.velocidadRotacion * delta
        );
    }

    // ========================================================
    // MOVER CLIENTE
    // ========================================================

    function moverHaciaDestino(delta) {

        if (!objetivo || !ruta.length) return false;

        if (indiceRuta >= ruta.length) {
            return true;
        }

        const punto = ruta[indiceRuta];

        const distancia = distanciaXZ(
            grupo.position,
            punto
        );

        if (distancia < 0.18) {

            indiceRuta++;

            if (indiceRuta >= ruta.length) {
                return true;
            }

            return false;
        }

        orientarHacia(punto, delta);

        const direccion = new THREE.Vector3(
            punto.x - grupo.position.x,
            0,
            punto.z - grupo.position.z
        );

        direccion.normalize();

        const velocidad = estado === ESTADOS.ENTRANDO
            ? config.velocidadEntrada
            : estado === ESTADOS.REGRESANDO
                ? config.velocidadRegreso
                : config.velocidad;

        const paso = velocidad * delta;

        const nuevaX = grupo.position.x + direccion.x * paso;
        const nuevaZ = grupo.position.z + direccion.z * paso;

        if (puntoLibre(nuevaX, nuevaZ)) {

            grupo.position.x = nuevaX;
            grupo.position.z = nuevaZ;

            intentosMovimiento = 0;

            return false;
        }

        intentosMovimiento++;

        if (intentosMovimiento >= 3) {

            const nuevaRuta = encontrarCamino(
                {
                    x: grupo.position.x,
                    z: grupo.position.z
                },
                objetivo
            );

            if (nuevaRuta.length) {

                ruta = nuevaRuta;
                indiceRuta = 0;

            } else {

                recuperarMovimiento();
            }

            intentosMovimiento = 0;
        }

        return false;
    }

    // ========================================================
    // RECUPERAR MOVIMIENTO
    // ========================================================

    function recuperarMovimiento() {

        const direcciones = [

            { x: 1, z: 0 },
            { x: -1, z: 0 },
            { x: 0, z: 1 },
            { x: 0, z: -1 },

            { x: 1, z: 1 },
            { x: -1, z: 1 },
            { x: 1, z: -1 },
            { x: -1, z: -1 }
        ];

        for (const direccion of direcciones) {

            const x = grupo.position.x + direccion.x * 0.8;
            const z = grupo.position.z + direccion.z * 0.8;

            if (puntoLibre(x, z)) {

                grupo.position.x = x;
                grupo.position.z = z;

                return true;
            }
        }

        return false;
    }

    // ========================================================
    // CAMINAR
    // ========================================================

    function actualizarAnimacionCaminar(delta) {

        if (accionCaminar) {

            accionCaminar.enabled = true;
            accionCaminar.paused = false;

            accionCaminar.setEffectiveWeight(1);
            accionCaminar.setEffectiveTimeScale(1);

            if (!accionCaminar.isRunning()) {
                accionCaminar.play();
            }

        } else {

            animarCaminarProcedural(delta);
        }
    }

    function actualizarAnimacionReposo(delta) {

        if (accionCaminar) {

            accionCaminar.setEffectiveWeight(0);

            if (accionReposo) {

                accionReposo.enabled = true;
                accionReposo.setEffectiveWeight(1);

                if (!accionReposo.isRunning()) {
                    accionReposo.play();
                }
            }

        } else {

            restaurarPoseCompleta();

            faseAnimacion += delta * 0.6;

            aplicarRotacion(
                rig.cabeza,
                EJE_X,
                Math.sin(faseAnimacion) * 0.025
            );
        }
    }

    // ========================================================
    // ANIMACIÓN DEL MODELO
    // ========================================================

    function cargarModelo() {

        if (!config.modelo) {

            cargado = true;

            iniciarComportamientoInicial();

            return;
        }

        loaderGLTF.load(

            config.modelo,

            gltf => {

                if (eliminado) return;

                modelo = gltf.scene;

                modelo.name = `MODELO_CLIENTE_${id}`;

                modelo.scale.setScalar(config.escala);

                modelo.position.set(0, 0, 0);

                modelo.traverse(obj => {

                    if (obj.isMesh) {

                        obj.castShadow = false;
                        obj.receiveShadow = false;

                        obj.frustumCulled = true;
                    }
                });

                grupo.add(modelo);

                detectarHuesos(modelo);
                actualizarRig();

                if (gltf.animations?.length) {

                    mixer = new THREE.AnimationMixer(modelo);

                    const clips = gltf.animations;

                    const clipCaminar = clips.find(clip =>
                        /walk|caminar|walking/i.test(clip.name)
                    );

                    const clipReposo = clips.find(clip =>
                        /idle|rest|reposo/i.test(clip.name)
                    );

                    if (clipCaminar) {

                        accionCaminar = mixer.clipAction(clipCaminar);

                        accionCaminar.enabled = true;
                        accionCaminar.setLoop(
                            THREE.LoopRepeat,
                            Infinity
                        );
                    }

                    if (clipReposo) {

                        accionReposo = mixer.clipAction(clipReposo);

                        accionReposo.enabled = true;
                        accionReposo.setLoop(
                            THREE.LoopRepeat,
                            Infinity
                        );

                        accionReposo.play();
                    }
                }

                cargado = true;

                iniciarComportamientoInicial();

            },

            undefined,

            error => {

                console.error(
                    `[CLIENTE ${id}] Error al cargar modelo:`,
                    config.modelo,
                    error
                );

                cargado = true;

                iniciarComportamientoInicial();
            }
        );
    }

    // ========================================================
    // COMPORTAMIENTO INICIAL
    // ========================================================

    function iniciarComportamientoInicial() {

        if (eliminado) return;

        if (config.inactivo) {

            cambiarEstado(ESTADOS.INACTIVO);

            return;
        }

        if (!entradaNotificada) {

            entradaNotificada = true;

            try {

                config.alEntrar?.({

                    cliente: api,
                    id
                });

            } catch (error) {

                console.error(error);
            }
        }

        if (estado === ESTADOS.ENTRANDO) {
            return;
        }

        if (!config.inactivo) {
            cambiarEstado(ESTADOS.BUSCANDO);
        }
    }

    // ========================================================
    // RECOGER PRODUCTO
    // ========================================================

    function iniciarRecogida() {

        if (!productoObjetivo) {

            cambiarEstado(ESTADOS.BUSCANDO);

            return false;
        }

        if (!tomarProducto(productoObjetivo)) {

            liberarProducto(productoObjetivo);
            liberarRack();

            productoObjetivo = null;

            cambiarEstado(ESTADOS.BUSCANDO);

            return false;
        }

        tiempoEstado = 0;

        cambiarEstado(ESTADOS.RECOGIENDO);

        return true;
    }

    // ========================================================
    // INSPECCIONAR
    // ========================================================

    function iniciarInspeccion() {

        if (!productoEnMano) {

            cambiarEstado(ESTADOS.BUSCANDO);

            return false;
        }

        cambiarEstado(ESTADOS.INSPECCIONANDO);

        return true;
    }

    // ========================================================
    // DECIDIR COMPRA
    // ========================================================

    function decidirCompraProducto() {

        decisionCompra =
            Math.random() <= config.probabilidadCompra;

        cambiarEstado(ESTADOS.DECIDIENDO);
    }

    // ========================================================
    // GUARDAR PRODUCTO
    // ========================================================

    function guardarProducto() {

        if (!productoEnMano || !config.carrito) {
            return false;
        }

        let resultado = false;

        try {

            resultado = config.carrito.agregarProducto(
                productoEnMano,
                {
                    cliente: id
                }
            );

        } catch (error) {

            console.error(
                `[CLIENTE ${id}] No se pudo agregar producto al carrito:`,
                error
            );

            return false;
        }

        if (resultado === false) {
            return false;
        }

        const producto = productoEnMano;

        producto.userData.enMano = false;
        producto.userData.enCarrito = true;
        producto.userData.reservadoPor = null;

        compras.push({

            objeto: producto,

            nombre:
                producto.userData.nombre ??
                producto.name ??
                'Producto',

            codigo:
                producto.userData.codigo ??
                '',

            precio: numero(
                producto.userData.precio,
                0
            )
        });

        try {

            config.alComprar?.({

                cliente: api,
                producto,
                compra: compras[compras.length - 1],
                totalProductos: compras.length
            });

        } catch (error) {

            console.error(error);
        }

        liberarProducto(producto);

        productoEnMano = null;
        productoOriginal = null;
        productoObjetivo = null;

        animacionProducto.activa = false;
        animacionProducto.tipo = null;

        liberarRack();

        restaurarPoseCompleta();

        return true;
    }

    // ========================================================
    // FINALIZAR PRODUCTO
    // ========================================================

    function terminarProducto() {

        if (decisionCompra) {

            if (!guardarProducto()) {

                if (productoEnMano) {
                    devolverProductoAlEstante();
                }

                cambiarEstado(ESTADOS.DEVOLVIENDO);

                return;
            }

        } else {

            const otroRack =
                Math.random() <
                config.probabilidadDejarEnOtroRack;

            if (otroRack) {

                prepararDevolucionEnOtroRack();

            } else {

                devolverProductoAlEstante();
            }

            cambiarEstado(ESTADOS.DEVOLVIENDO);

            return;
        }

        if (compras.length >= config.maximoProductos) {

            dirigirseACaja();

            return;
        }

        cambiarEstado(ESTADOS.ESPERANDO);
    }

    // ========================================================
    // RUTA DE RECORRIDO
    // ========================================================

    const puntosRecorrido = [

        { x: -25, z: 16 },
        { x: -15, z: 16 },
        { x: -5, z: 16 },
        { x: 5, z: 16 },
        { x: 15, z: 16 },
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

        const destino = {

            x: numero(
                posicionCaja?.x,
                config.posicionCaja.x
            ),

            z: numero(
                posicionCaja?.z,
                config.posicionCaja.z
            )
        };

        callbackPagoPendiente =
            typeof callback === 'function'
                ? callback
                : null;

        if (!establecerObjetivo(destino, ESTADOS.CAJA)) {

            callbackPagoPendiente = null;

            console.warn(
                `[CLIENTE ${id}] No se pudo encontrar la caja.`
            );

            return false;
        }

        return true;
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

        ticketPendiente = ticket;

        pagoConfirmado = false;
        callbackPagoEjecutado = false;

        cambiarEstado(ESTADOS.PAGANDO);

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
                `[CLIENTE ${id}] Error en callback de pago:`,
                error
            );
        }
    }

    function confirmarVentaCarrito() {

        if (pagoConfirmado) return true;

        const carrito = config.carrito;

        if (carrito?.confirmarVenta) {

            try {

                const resultado = carrito.confirmarVenta();

                if (resultado === false) {
                    return false;
                }

            } catch (error) {

                console.error(
                    `[CLIENTE ${id}] Error confirmando venta:`,
                    error
                );

                return false;
            }

        } else if (carrito?.vaciarInventario) {

            try {

                carrito.vaciarInventario();

            } catch (error) {

                console.error(
                    `[CLIENTE ${id}] Error vaciando carrito:`,
                    error
                );

                return false;
            }
        }

        compras.forEach(compra => {

            if (!compra.objeto) return;

            compra.objeto.userData.vendido = true;
            compra.objeto.userData.enCarrito = false;
            compra.objeto.userData.enMano = false;
            compra.objeto.userData.reservadoPor = null;
        });

        pagoConfirmado = true;

        return true;
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

            actual = punto;
        }

        return caminoCompleto;
    }

    // ========================================================
    // ENTRAR DESDE VEHÍCULO
    // ========================================================

    function iniciarDesdeVehiculo(
        posicionEntrada,
        plaza = null
    ) {

        if (eliminado) return false;

        if (!posicionEntrada) return false;

        if (
            estado !== ESTADOS.INACTIVO &&
            estado !== ESTADOS.FINALIZADO &&
            estado !== ESTADOS.ESPERANDO
        ) {
            return false;
        }

        grupo.position.set(
            numero(posicionEntrada.x),
            0,
            numero(posicionEntrada.z)
        );

        if (!puntoLibre(grupo.position.x, grupo.position.z)) {
            recuperarMovimiento();
        }

        const destino = {

            x: numero(config.posicion.x),
            z: numero(config.posicion.z)
        };

        const camino = crearRutaPorPuerta(
            destino,
            'entrada'
        );

        if (!camino.length) return false;

        ruta = camino;
        indiceRuta = 0;

        objetivo = destino;

        entradaNotificada = false;

        cambiarEstado(ESTADOS.ENTRANDO);

        return true;
    }

    // ========================================================
    // REGRESAR A VEHÍCULO
    // ========================================================

    function iniciarRegresoVehiculo(
        posicionVehiculo,
        callback = null
    ) {

        if (eliminado || !posicionVehiculo) {
            return false;
        }

        callbackRegreso =
            typeof callback === 'function'
                ? callback
                : null;

        const destino = {

            x: numero(posicionVehiculo.x),
            z: numero(posicionVehiculo.z)
        };

        const camino = crearRutaPorPuerta(
            destino,
            'salida'
        );

        if (!camino.length) {

            callbackRegreso = null;

            return false;
        }

        ruta = camino;
        indiceRuta = 0;

        objetivo = destino;

        cambiarEstado(ESTADOS.REGRESANDO);

        return true;
    }

    // ========================================================
    // FINALIZAR CLIENTE
    // ========================================================

    function finalizarCliente() {

        liberarRack();

        if (productoObjetivo) {
            liberarProducto(productoObjetivo);
        }

        productoObjetivo = null;

        cambiarEstado(ESTADOS.FINALIZADO);

        try {

            config.alFinalizar?.({

                cliente: api,
                id,
                compras: compras.length,
                ticket: ticketPendiente
            });

        } catch (error) {

            console.error(error);
        }

        if (callbackRegreso) {

            const callback = callbackRegreso;

            callbackRegreso = null;

            try {
                callback(api);
            } catch (error) {
                console.error(error);
            }
        }
    }

    // ========================================================
    // ACTUALIZAR ANIMACIONES
    // ========================================================

    function actualizarAnimaciones(delta) {

        if (mixer) {
            mixer.update(delta);
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

            case ESTADOS.BUSCANDO:
            case ESTADOS.ACER CANDO:
            case ESTADOS.ENTRANDO:
            case ESTADOS.RUTA:
            case ESTADOS.CAJA:
            case ESTADOS.REGRESANDO:
                actualizarAnimacionCaminar(delta);
                break;

            default:
                actualizarAnimacionReposo(delta);
                break;
        }
    }

    // ========================================================
    // ACTUALIZAR CLIENTE
    // ========================================================

    function actualizar(delta) {

        if (eliminado || detenido || !cargado) {
            return;
        }

        delta = limitar(numero(delta, 0), 0, 0.05);

        if (delta <= 0) return;

        tiempoEstado += delta;
        tiempoActualizarObstaculos += delta;

        if (tiempoActualizarObstaculos >= 1.5) {

            actualizarColisiones();

            tiempoActualizarObstaculos = 0;
        }

        actualizarAnimaciones(delta);

        if (animacionProducto.activa) {
            actualizarAnimacionProducto(delta);
        }

        switch (estado) {

            case ESTADOS.INACTIVO:
                break;

            case ESTADOS.ENTRANDO: {

                const llego = moverHaciaDestino(delta);

                if (llego) {

                    objetivo = null;
                    ruta = [];

                    cambiarEstado(ESTADOS.BUSCANDO);
                }

                break;
            }

            case ESTADOS.BUSCANDO: {

                if (compras.length >= config.maximoProductos) {

                    dirigirseACaja();

                    break;
                }

                if (!buscarProducto()) {

                    if (compras.length > 0) {

                        dirigirseACaja();

                    } else {

                        iniciarPaseo();
                    }
                }

                break;
            }

            case ESTADOS.ACERCANDO: {

                const llego = moverHaciaDestino(delta);

                if (llego) {

                    iniciarRecogida();
                }

                break;
            }

            case ESTADOS.RECOGIENDO: {

                if (
                    tiempoEstado >= config.tiempoRecoger &&
                    !animacionProducto.activa
                ) {

                    iniciarInspeccion();
                }

                break;
            }

            case ESTADOS.INSPECCIONANDO: {

                if (tiempoEstado >= config.tiempoInspeccionar) {

                    decidirCompraProducto();
                }

                break;
            }

            case ESTADOS.DECIDIENDO: {

                if (tiempoEstado >= 0.45) {

                    terminarProducto();
                }

                break;
            }

            case ESTADOS.GUARDANDO: {

                if (tiempoEstado >= config.tiempoGuardar) {

                    cambiarEstado(ESTADOS.ESPERANDO);
                }

                break;
            }

            case ESTADOS.DEVOLVIENDO: {

                if (
                    !animacionProducto.activa &&
                    tiempoEstado >= config.tiempoDevolver
                ) {

                    restaurarPoseCompleta();

                    cambiarEstado(ESTADOS.ESPERANDO);
                }

                break;
            }

            case ESTADOS.ESPERANDO: {

                if (tiempoEstado >= config.tiempoEntreProductos) {

                    if (compras.length >= config.maximoProductos) {

                        dirigirseACaja();

                    } else {

                        cambiarEstado(ESTADOS.BUSCANDO);
                    }
                }

                break;
            }

            case ESTADOS.RUTA: {

                const llego = moverHaciaDestino(delta);

                if (llego) {

                    objetivo = null;
                    ruta = [];

                    if (config.repetirRuta) {

                        iniciarPaseo();

                    } else {

                        cambiarEstado(ESTADOS.ESPERANDO);
                    }
                }

                break;
            }

            case ESTADOS.CAJA: {

                const llego = moverHaciaDestino(delta);

                if (llego) {

                    objetivo = null;
                    ruta = [];

                    completarPago();
                }

                break;
            }

            case ESTADOS.PAGANDO: {

                if (tiempoEstado >= 2.5) {

                    if (!confirmarVentaCarrito()) {

                        console.warn(
                            `[CLIENTE ${id}] No se pudo confirmar la venta.`
                        );

                        break;
                    }

                    if (
                        callbackPagoPendiente &&
                        !callbackPagoEjecutado
                    ) {

                        callbackPagoEjecutado = true;

                        const callback = callbackPagoPendiente;

                        callbackPagoPendiente = null;

                        try {
                            callback(ticketPendiente);
                        } catch (error) {
                            console.error(error);
                        }
                    }

                    if (config.repetirRuta) {

                        compras = [];
                        ticketPendiente = null;

                        pagoConfirmado = false;

                        cambiarEstado(ESTADOS.BUSCANDO);

                    } else {

                        finalizarCliente();
                    }
                }

                break;
            }

            case ESTADOS.REGRESANDO: {

                const llego = moverHaciaDestino(delta);

                if (llego) {

                    objetivo = null;
                    ruta = [];

                    finalizarCliente();
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

    function configurarCompras(nuevasOpciones = {}) {

        Object.assign(config, nuevasOpciones);

        if (nuevasOpciones.posicionCaja) {

            config.posicionCaja = {

                ...config.posicionCaja,
                ...nuevasOpciones.posicionCaja
            };
        }

        if (nuevasOpciones.offsetProductoMano) {

            config.offsetProductoMano = {

                ...config.offsetProductoMano,
                ...nuevasOpciones.offsetProductoMano
            };
        }

        if (nuevasOpciones.rotacionProductoMano) {

            config.rotacionProductoMano = {

                ...config.rotacionProductoMano,
                ...nuevasOpciones.rotacionProductoMano
            };
        }

        actualizarColisiones();

        return api;
    }

    // ========================================================
    // ESTABLECER RUTA MANUAL
    // ========================================================

    function establecerRuta(puntos = [], repetir = false) {

        if (!Array.isArray(puntos) || !puntos.length) {
            return false;
        }

        config.repetirRuta = Boolean(repetir);

        const caminoCompleto = [];

        let actual = {

            x: grupo.position.x,
            z: grupo.position.z
        };

        for (const punto of puntos) {

            const destino = {

                x: numero(punto.x),
                z: numero(punto.z)
            };

            const tramo = encontrarCamino(actual, destino);

            if (!tramo.length) {
                continue;
            }

            caminoCompleto.push(...tramo);

            actual = destino;
        }

        if (!caminoCompleto.length) {
            return false;
        }

        ruta = caminoCompleto;
        indiceRuta = 0;

        objetivo = caminoCompleto[caminoCompleto.length - 1];

        cambiarEstado(ESTADOS.RUTA);

        return true;
    }

    // ========================================================
    // ESTABLECER POSICIÓN
    // ========================================================

    function establecerPosicion(posicion) {

        if (!posicion) return false;

        const x = numero(posicion.x);
        const z = numero(posicion.z);

        if (!puntoLibre(x, z)) {
            return false;
        }

        grupo.position.set(x, 0, z);

        objetivo = null;
        ruta = [];
        indiceRuta = 0;

        return true;
    }

    // ========================================================
    // DETENER ANIMACIÓN
    // ========================================================

    function detenerAnimacion() {

        detenido = true;

        if (mixer) {
            mixer.timeScale = 0;
        }

        return true;
    }

    // ========================================================
    // REPRODUCIR ANIMACIÓN
    // ========================================================

    function reproducirAnimacion() {

        detenido = false;

        if (mixer) {
            mixer.timeScale = 1;
        }

        return true;
    }

    // ========================================================
    // ELIMINAR CLIENTE
    // ========================================================

    function eliminar() {

        if (eliminado) return;

        eliminado = true;

        liberarRack();

        if (productoObjetivo) {
            liberarProducto(productoObjetivo);
        }

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

            producto.userData.enMano = false;
            producto.userData.reservadoPor = null;
        }

        productoEnMano = null;
        productoOriginal = null;
        productoObjetivo = null;

        animacionProducto.activa = false;

        if (mixer) {
            mixer.stopAllAction();
            mixer = null;
        }

        grupo.parent?.remove(grupo);

        grupo.clear();

        ruta = [];
        objetivo = null;

        callbackPagoPendiente = null;
        callbackRegreso = null;

        compras = [];
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

    cargarModelo();

    return api;
}
