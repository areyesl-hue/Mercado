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

    // Probabilidad de dejar un producto en otro rack
    // cuando el cliente decide no comprarlo.
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

        // Si un producto fue reubicado, conserva su nueva ubicación.
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

        const tipoDevolucion = animacionProducto.tipo;

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

            console.log(
                `[CLIENTE ${id}] Producto colocado en otro rack.`,
                original.rackNuevo
            );

        } else {

            producto.userData.reubicado = false;

            console.log(
                `[CLIENTE ${id}] Producto devuelto a su estante original.`
            );
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
    // ANIMAR PAGO
    // ========================================================

    function animarPagarProcedural() {

        const t = Math.sin(tiempoEstado * 3) * 0.08;

        aplicarRotacion(
            rig.brazoDerecho,
            EJE_X,
            -0.9 + t
        );

        aplicarRotacion(
            rig.antebrazoDerecho,
            EJE_X,
            -0.6
        );

        aplicarRotacion(
            rig.brazoIzquierdo,
            EJE_X,
            -0.7
        );

        aplicarRotacion(
            rig.antebrazoIzquierdo,
            EJE_X,
            -0.4
        );

        aplicarRotacion(
            rig.cabeza,
            EJE_X,
            0.08
        );
    }

    // ========================================================
    // CARGAR MODELO
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
                        accionCaminar.play();
                        accionCaminar.paused = true;
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

        const caminando = [
            ESTADOS.ENTRANDO,
            ESTADOS.ACERCANDO,
            ESTADOS.RUTA,
            ESTADOS.CAJA,
            ESTADOS.REGRESANDO
        ].includes(estado);

        if (accionCaminar) {

            accionCaminar.paused = !caminando;

            if (caminando) {
                accionCaminar.reset().play();
            }
        }

        if (accionReposo) {

            if (caminando) {
                accionReposo.fadeOut(0.15);
            } else {
                accionReposo.reset().fadeIn(0.15).play();
            }
        }

        if (
            !caminando &&
            nuevoEstado !== ESTADOS.DEVOLVIENDO
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

                const caja = new THREE.Box3().setFromObject(obj);

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
            Math.ceil(distancia / 0.25)
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
    // A*
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

            for (
                let radio = 0.4;
                radio <= 2.8;
                radio += 0.4
            ) {

                for (
                    let angulo = 0;
                    angulo < Math.PI * 2;
                    angulo += Math.PI / 4
                ) {

                    const candidato = {

                        x: fin.x + Math.cos(angulo) * radio,
                        z: fin.z + Math.sin(angulo) * radio
                    };

                    if (
                        !puntoLibre(
                            candidato.x,
                            candidato.z
                        )
                    ) {
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

        const abiertos = [{

            x: aX,
            z: aZ,
            g: 0,
            h: Math.hypot(bX - aX, bZ - aZ),
            padre: null
        }];

        const abiertosMapa = new Map([
            [inicioClave, abiertos[0]]
        ]);

        const cerrados = new Set();

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

        while (abiertos.length && iteraciones < 12000) {

            iteraciones++;

            abiertos.sort(
                (a, b) => (a.g + a.h) - (b.g + b.h)
            );

            const actual = abiertos.shift();
                    const direccion = new THREE.Vector3(
            grupo.position.x - posicion.x,
            0,
            grupo.position.z - posicion.z
        );

        if (direccion.lengthSq() < 0.001) {
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

    function acercarseAProducto(producto) {

        if (!producto || !reservarProducto(producto)) {
            return false;
        }

        productoEsInferior =
            productoEstaEnEstanteInferior(producto);

        const punto = obtenerPuntoFrenteProducto(producto);

        if (
            !establecerObjetivo(
                punto,
                ESTADOS.ACERCANDO
            )
        ) {

            liberarReserva();
            return false;
        }

        return true;
    }

    // ========================================================
    // GUARDAR ESTADO ORIGINAL DEL PRODUCTO
    // ========================================================

    function guardarTransformacionOriginal(producto) {

        const posicion = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const escala = new THREE.Vector3();

        producto.updateMatrixWorld(true);

        producto.getWorldPosition(posicion);
        producto.getWorldQuaternion(quaternion);
        producto.getWorldScale(escala);

        return {

            parent: producto.parent,

            posicion: posicion.clone(),
            quaternion: quaternion.clone(),
            escala: escala.clone(),

            visible: producto.visible,

            rackAnterior: obtenerClaveRack(producto),
            rackNuevo: null
        };
    }

    // ========================================================
    // MOVER PRODUCTO A LA MANO
    // ========================================================

    function colocarProductoEnMano(producto) {

        if (!producto) return false;

        productoOriginal =
            guardarTransformacionOriginal(producto);

        productoEnMano = producto;

        const mano = rig.manoDerecha;

        let destinoMano = new THREE.Vector3(
            config.offsetProductoMano.x,
            config.offsetProductoMano.y,
            config.offsetProductoMano.z
        );

        if (mano) {

            mano.updateMatrixWorld(true);

            destinoMano.setFromMatrixPosition(
                mano.matrixWorld
            );

        } else {

            const desplazamiento = new THREE.Vector3(
                0.28,
                1.15,
                0.18
            );

            desplazamiento.applyAxisAngle(
                new THREE.Vector3(0, 1, 0),
                grupo.rotation.y
            );

            destinoMano.set(
                grupo.position.x + desplazamiento.x,
                grupo.position.y + desplazamiento.y,
                grupo.position.z + desplazamiento.z
            );
        }

        const posicionInicial =
            productoOriginal.posicion.clone();

        const quaternionInicial =
            productoOriginal.quaternion.clone();

        const escalaInicial =
            productoOriginal.escala.clone();

        const quaternionFinal = new THREE.Quaternion();

        quaternionFinal.setFromEuler(
            new THREE.Euler(
                config.rotacionProductoMano.x,
                config.rotacionProductoMano.y,
                config.rotacionProductoMano.z
            )
        );

        const escalaFinal = escalaInicial.clone().multiplyScalar(
            config.escalaProductoMano
        );

        producto.parent?.remove(producto);

        grupo.add(producto);

        grupo.updateMatrixWorld(true);

        const destinoLocal = grupo.worldToLocal(
            destinoMano.clone()
        );

        producto.position.copy(posicionInicial);

        producto.quaternion.copy(quaternionInicial);
        producto.scale.copy(escalaInicial);

        const posicionLocalInicial = grupo.worldToLocal(
            posicionInicial.clone()
        );

        producto.position.copy(posicionLocalInicial);

        animacionProducto.activa = true;
        animacionProducto.tipo = 'RECOGER';
        animacionProducto.tiempo = 0;
        animacionProducto.duracion = config.tiempoRecoger;

        animacionProducto.posicionInicial.copy(
            posicionLocalInicial
        );

        animacionProducto.posicionFinal.copy(
            destinoLocal
        );

        animacionProducto.quaternionInicial.copy(
            quaternionInicial
        );

        animacionProducto.quaternionFinal.copy(
            quaternionFinal
        );

        animacionProducto.escalaInicial.copy(
            escalaInicial
        );

        animacionProducto.escalaFinal.copy(
            escalaFinal
        );

        return true;
    }

    // ========================================================
    // INICIAR RECOLECCIÓN
    // ========================================================

    function iniciarRecogida() {

        if (!productoObjetivo) {
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        const producto = productoObjetivo;

        if (!productoDisponible(producto)) {

            liberarReserva();
            cambiarEstado(ESTADOS.BUSCANDO);

            return;
        }

        productoEsInferior =
            productoEstaEnEstanteInferior(producto);

        tiempoEstado = 0;

        cambiarEstado(ESTADOS.RECOGIENDO);
    }

    function recogerProducto() {

        if (!productoObjetivo) {
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        if (!colocarProductoEnMano(productoObjetivo)) {

            liberarReserva();
            cambiarEstado(ESTADOS.BUSCANDO);

            return;
        }

        animacionProducto.activa = false;

        const producto = productoEnMano;

        producto.visible = true;

        cambiarEstado(ESTADOS.INSPECCIONANDO);
    }

    // ========================================================
    // INFORMACIÓN DE PRODUCTO
    // ========================================================

    function obtenerDatosProducto(producto) {

        const datos = producto?.userData ?? {};

        const nombre =
            datos.nombre ??
            datos.producto ??
            producto?.name ??
            'Producto';

        const codigo =
            datos.codigo ??
            datos.sku ??
            datos.id ??
            `PROD-${Date.now()}`;

        const precio = Math.max(
            0,
            numero(datos.precio, 0)
        );

        return {

            nombre: String(nombre),
            codigo: String(codigo),
            precio
        };
    }

    // ========================================================
    // AGREGAR PRODUCTO AL CARRITO
    // ========================================================

    function agregarAlCarrito(producto) {

        if (!producto || !config.carrito) return false;

        const datos = obtenerDatosProducto(producto);

        let agregado = false;

        try {

            if (
                typeof config.carrito.agregarProducto === 'function'
            ) {

                const resultado =
                    config.carrito.agregarProducto(producto);

                agregado = resultado !== false;

            } else if (
                typeof config.carrito.agregar === 'function'
            ) {

                const resultado =
                    config.carrito.agregar(producto);

                agregado = resultado !== false;
            }

        } catch (error) {

            console.error(
                `[CLIENTE ${id}] Error agregando producto al carrito:`,
                error
            );

            return false;
        }

        if (!agregado) return false;

        producto.userData.enCarrito = true;
        producto.userData.reservado = false;

        delete producto.userData.reservadoPor;

        producto.visible = false;

        compras.push({

            objeto: producto,

            nombre: datos.nombre,
            codigo: datos.codigo,
            precio: datos.precio
        });

        try {

            config.alComprar?.({

                cliente: api,
                producto,
                datos
            });

        } catch (error) {

            console.error(error);
        }

        productoEnMano = null;
        productoOriginal = null;
        productoObjetivo = null;

        animacionProducto.activa = false;
        animacionProducto.tipo = null;

        liberarRack();

        return true;
    }

    function guardarProducto() {

        if (!productoEnMano) {

            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        if (!agregarAlCarrito(productoEnMano)) {

            console.warn(
                `[CLIENTE ${id}] No se pudo agregar el producto al carrito.`
            );

            animacionProducto.tipo = 'DEVOLVER';

            devolverProductoAlEstante();

            cambiarEstado(ESTADOS.DEVOLVIENDO);

            return;
        }

        if (
            compras.length >= config.maximoProductos
        ) {

            dirigirseACaja();

        } else {

            cambiarEstado(ESTADOS.ESPERANDO);
        }
    }

    // ========================================================
    // DEVOLVER PRODUCTO AL ESTANTE
    // ========================================================

    function prepararDevolucionEnOtroRack() {

        if (!productoEnMano || !productoOriginal) {
            return false;
        }

        const productos = obtenerProductos();

        const candidatos = [];

        for (const producto of productos) {

            if (producto === productoEnMano) continue;
            if (!productoDisponible(producto)) continue;

            const clave = obtenerClaveRack(producto);

            if (clave === productoOriginal.rackAnterior) {
                continue;
            }

            const posicion = new THREE.Vector3();

            producto.getWorldPosition(posicion);

            const distancia = distanciaXZ(
                grupo.position,
                posicion
            );

            if (distancia > config.distanciaMaximaBusqueda) {
                continue;
            }

            candidatos.push({

                clave,
                posicion,
                distancia
            });
        }

        if (!candidatos.length) return false;

        candidatos.sort(
            (a, b) => a.distancia - b.distancia
        );

        const destino = candidatos[0];

        const posicionFinal = destino.posicion.clone();

        posicionFinal.y += config.separacionProductoRack;

        const destinoLocal = productoEnMano.parent.worldToLocal(
            posicionFinal.clone()
        );

        animacionProducto.posicionInicial.copy(
            productoEnMano.position
        );

        animacionProducto.posicionFinal.copy(
            destinoLocal
        );

        animacionProducto.quaternionInicial.copy(
            productoEnMano.quaternion
        );

        animacionProducto.quaternionFinal.identity();

        animacionProducto.escalaInicial.copy(
            productoEnMano.scale
        );

        animacionProducto.escalaFinal.copy(
            productoOriginal.escala
        );

        animacionProducto.tipo = 'REUBICAR';
        animacionProducto.activa = true;
        animacionProducto.tiempo = 0;
        animacionProducto.duracion = config.tiempoDevolver;

        productoOriginal.rackNuevo = destino.clave;

        return true;
    }

    function devolverProductoAlEstante() {

        if (!productoEnMano || !productoOriginal) {
            return false;
        }

        if (animacionProducto.tipo !== 'REUBICAR') {

            const posicionFinal =
                productoOriginal.posicion.clone();

            const destinoLocal = productoEnMano.parent.worldToLocal(
                posicionFinal.clone()
            );

            animacionProducto.posicionInicial.copy(
                productoEnMano.position
            );

            animacionProducto.posicionFinal.copy(
                destinoLocal
            );

            animacionProducto.quaternionInicial.copy(
                productoEnMano.quaternion
            );

            const quaternionPadre = new THREE.Quaternion();

            productoOriginal.parent?.getWorldQuaternion(
                quaternionPadre
            );

            animacionProducto.quaternionFinal
                .copy(quaternionPadre.invert())
                .multiply(productoOriginal.quaternion);

            animacionProducto.escalaInicial.copy(
                productoEnMano.scale
            );

            animacionProducto.escalaFinal.copy(
                productoOriginal.escala
            );

            animacionProducto.tipo = 'DEVOLVER';
            animacionProducto.activa = true;
            animacionProducto.tiempo = 0;
            animacionProducto.duracion =
                config.tiempoDevolver;
        }

        return true;
    }
        // ========================================================
    // RUTA DE COMPRA
    // ========================================================

    function iniciarPaseo() {

        if (
            compras.length >=
            config.maximoProductos
        ) {

            dirigirseACaja();
            return;
        }

        const producto = buscarProducto();

        if (!producto) {

            if (compras.length > 0) {

                dirigirseACaja();

            } else {

                cambiarEstado(ESTADOS.FINALIZADO);

                try {
                    config.alFinalizar?.(api);
                } catch (error) {
                    console.error(error);
                }
            }

            return;
        }

        if (!acercarseAProducto(producto)) {

            productosExaminados.add(producto);

            cambiarEstado(ESTADOS.ESPERANDO);
        }
    }

    function finalizarEntrada() {

        if (entradaNotificada) return;

        entradaNotificada = true;

        try {
            config.alEntrar?.(api);
        } catch (error) {
            console.error(error);
        }

        iniciarPaseo();
    }

    // ========================================================
    // ENTRAR DESDE EL EXTERIOR
    // ========================================================

    function iniciarDesdeVehiculo(posicion = null) {

        if (eliminado) return false;

        if (posicion) {

            grupo.position.set(
                numero(posicion.x, grupo.position.x),
                numero(posicion.y, 0),
                numero(posicion.z, grupo.position.z)
            );
        }

        entradaNotificada = false;

        const destino = {

            x: config.puertaCentroX,
            z: config.puertaZInterior - 1
        };

        const inicio = {

            x: grupo.position.x,
            z: grupo.position.z
        };

        if (inicio.z < config.puertaZExterior) {

            inicio.z = config.puertaZExterior + 1;
            grupo.position.z = inicio.z;
        }

        const camino = encontrarCamino(
            inicio,
            destino
        );

        if (!camino.length) return false;

        ruta = camino;
        indiceRuta = 0;
        objetivo = camino[camino.length - 1];

        cambiarEstado(ESTADOS.ENTRANDO);

        return true;
    }

    // ========================================================
    // REGRESAR AL VEHÍCULO
    // ========================================================

    function iniciarRegresoVehiculo(posicion = null, callback = null) {

        if (eliminado) return false;

        if (productoEnMano) {

            devolverProductoAlEstante();
        }

        liberarReserva();

        callbackRegreso =
            typeof callback === 'function'
                ? callback
                : null;

        const destino = posicion
            ? {
                x: numero(posicion.x),
                z: numero(posicion.z)
            }
            : {
                x: grupo.position.x,
                z: config.puertaZExterior + 2
            };

        const puntoPuerta = {

            x: config.puertaCentroX,
            z: config.puertaZExterior
        };

        const caminoInterior = encontrarCamino(
            grupo.position,
            puntoPuerta
        );

        if (!caminoInterior.length) return false;

        const caminoExterior = encontrarCamino(
            puntoPuerta,
            destino
        );

        ruta = [
            ...caminoInterior,
            ...caminoExterior
        ];

        if (!ruta.length) return false;

        indiceRuta = 0;
        objetivo = ruta[ruta.length - 1];

        cambiarEstado(ESTADOS.REGRESANDO);

        return true;
    }

    // ========================================================
    // CAJA Y PAGO
    // ========================================================

    function obtenerTicket() {

        const total = compras.reduce(
            (suma, compra) =>
                suma + numero(compra.precio),
            0
        );

        return {

            clienteId: id,

            productos: compras.map(compra => ({

                nombre: compra.nombre,
                codigo: compra.codigo,
                precio: compra.precio
            })),

            cantidad: compras.length,

            total,

            fecha: new Date().toISOString()
        };
    }

    function dirigirseACaja(callback = null) {

        if (eliminado) return false;

        if (compras.length === 0) {

            if (typeof callback === 'function') {
                callback(null);
            }

            return false;
        }

        callbackPagoPendiente =
            typeof callback === 'function'
                ? callback
                : null;

        ticketPendiente = obtenerTicket();

        const destino = {

            x: numero(config.posicionCaja.x),
            z: numero(config.posicionCaja.z)
        };

        const camino = encontrarCamino(
            grupo.position,
            destino
        );

        if (!camino.length) {

            console.warn(
                `[CLIENTE ${id}] No se encontró ruta hacia la caja.`
            );

            callbackPagoPendiente = null;
            ticketPendiente = null;

            return false;
        }

        ruta = camino;
        indiceRuta = 0;
        objetivo = camino[camino.length - 1];

        cambiarEstado(ESTADOS.CAJA);

        return true;
    }

    function comenzarPago() {

        ticketPendiente = obtenerTicket();

        cambiarEstado(ESTADOS.PAGANDO);

        try {

            config.alPagar?.({

                cliente: api,
                ticket: ticketPendiente
            });

        } catch (error) {

            console.error(
                `[CLIENTE ${id}] Error en callback de pago:`,
                error
            );
        }
    }

    function finalizarCliente() {

        try {
            config.alFinalizar?.(api);
        } catch (error) {
            console.error(error);
        }

        if (typeof callbackRegreso === 'function') {

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
    // ACTUALIZAR ESTADOS DE MOVIMIENTO
    // ========================================================

    function actualizarMovimiento() {

        const termino = moverHaciaDestino(
            Math.min(deltaActual, 0.05)
        );

        if (!termino) return;

        switch (estado) {

            case ESTADOS.ENTRANDO:

                finalizarEntrada();

                break;

            case ESTADOS.ACERCANDO:

                iniciarRecogida();

                break;

            case ESTADOS.RUTA:

                if (config.repetirRuta) {

                    indiceRuta = 0;

                } else {

                    cambiarEstado(ESTADOS.BUSCANDO);
                }

                break;

            case ESTADOS.CAJA:

                comenzarPago();

                break;

            case ESTADOS.REGRESANDO:

                cambiarEstado(ESTADOS.FINALIZADO);

                finalizarCliente();

                break;
        }
    }

    // ========================================================
    // ACTUALIZAR CLIENTE
    // ========================================================

    let deltaActual = 0;

    function actualizar(delta = 0.016) {

        if (eliminado || detenido) return;

        delta = limitar(
            numero(delta, 0.016),
            0,
            0.05
        );

        deltaActual = delta;

        tiempoEstado += delta;
        tiempoActualizarObstaculos += delta;

        if (tiempoActualizarObstaculos >= 2) {

            actualizarColisiones();
        }

        if (mixer) {
            mixer.update(delta);
        }

        if (!cargado) return;

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

                actualizarMovimiento();

                break;
            }

            // ------------------------------------------------
            // BUSCAR PRODUCTO
            // ------------------------------------------------

            case ESTADOS.BUSCANDO: {

                if (
                    tiempoEstado >=
                    config.tiempoEntreProductos
                ) {

                    iniciarPaseo();
                }

                break;
            }

            // ------------------------------------------------
            // RECOGER
            // ------------------------------------------------

            case ESTADOS.RECOGIENDO: {

                animarRecogerProcedural();

                if (tiempoEstado >= config.tiempoRecoger) {

                    recogerProducto();
                }

                break;
            }

            // ------------------------------------------------
            // INSPECCIONAR
            // ------------------------------------------------

            case ESTADOS.INSPECCIONANDO: {

                animarInspeccionarProcedural();

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

                        // Iniciar el movimiento del producto.
                        devolverProductoAlEstante();

                        cambiarEstado(ESTADOS.DEVOLVIENDO);
                    }
                }

                break;
            }
                    const candidatos = [];

        for (
            let radio = 1.3;
            radio <= 3.2;
            radio += 0.3
        ) {

            for (
                let angulo = 0;
                angulo < Math.PI * 2;
                angulo += Math.PI / 8
            ) {

                const punto = {

                    x: posicion.x + Math.cos(angulo) * radio,
                    z: posicion.z + Math.sin(angulo) * radio
                };

                if (!puntoLibre(punto.x, punto.z)) continue;

                const camino = encontrarCamino(
                    grupo.position,
                    punto
                );

                if (!camino.length) continue;

                candidatos.push({

                    ...punto,

                    distancia: distanciaXZ(
                        grupo.position,
                        punto
                    )
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

        const cajaProducto = new THREE.Box3()
            .setFromObject(producto);

        const tamanoProducto = new THREE.Vector3();

        cajaProducto.getSize(tamanoProducto);

        productoOriginal = {

            parent: producto.parent,

            posicion: producto.position.clone(),

            quaternion: producto.quaternion.clone(),

            escala: producto.scale.clone(),

            visible: producto.visible,

            tamanoMundo: tamanoProducto.clone()
        };

        productoEnMano = producto;

        productosExaminados.add(producto);

        const mano =
            rig.manoDerecha ||
            rig.brazoDerecho;

        if (!mano) {

            console.warn(
                `[CLIENTE ${id}] No se encontró la mano derecha.`
            );

            productoEnMano = null;
            productoOriginal = null;

            liberarReserva();
            cambiarEstado(ESTADOS.BUSCANDO);

            return;
        }

        grupo.updateMatrixWorld(true);
        mano.updateMatrixWorld(true);

        mano.attach(producto);

        const offset = config.offsetProductoMano;

        producto.position.set(
            numero(offset.x),
            numero(offset.y),
            numero(offset.z)
        );

        const rotacion = config.rotacionProductoMano;

        producto.rotation.set(
            numero(rotacion.x),
            numero(rotacion.y),
            numero(rotacion.z)
        );

        producto.scale.multiplyScalar(
            config.escalaProductoMano
        );

        producto.visible = true;

        cambiarEstado(ESTADOS.INSPECCIONANDO);

        console.log(
            `[CLIENTE ${id}] Inspeccionando ${
                producto.userData?.nombre ??
                producto.name ??
                'producto'
            }`,
            productoEsInferior
                ? '(estante inferior)'
                : '(estante normal)'
        );
    }

    // ========================================================
    // BUSCAR ESPACIO EN OTRO RACK
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

            const cajaAncla = new THREE.Box3()
                .setFromObject(ancla);

            if (cajaAncla.isEmpty()) continue;

            const tamanoAncla = new THREE.Vector3();

            cajaAncla.getSize(tamanoAncla);

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

                if (
                    Math.abs(posicionMundo.x) > config.limiteX ||
                    posicionMundo.z < config.limiteZMin ||
                    posicionMundo.z > config.limiteZMax
                ) {
                    continue;
                }

                let ocupado = false;

                for (const otro of productos) {

                    if (
                        !otro ||
                        otro === producto ||
                        otro === ancla ||
                        !otro.visible
                    ) {
                        continue;
                    }

                    const posicionOtro = new THREE.Vector3();

                    otro.getWorldPosition(posicionOtro);

                    const distancia = distanciaXZ(
                        posicionMundo,
                        posicionOtro
                    );

                    if (
                        distancia <
                        Math.max(
                            tamanoProducto.x,
                            tamanoProducto.z,
                            0.25
                        )
                    ) {

                        ocupado = true;
                        break;
                    }
                }

                if (ocupado) continue;

                const padre = ancla.parent;

                padre.updateMatrixWorld(true);

                const posicionLocal = padre.worldToLocal(
                    posicionMundo.clone()
                );

                const quaternionAncla = new THREE.Quaternion();
                const quaternionPadre = new THREE.Quaternion();

                ancla.getWorldQuaternion(quaternionAncla);
                padre.getWorldQuaternion(quaternionPadre);

                const quaternionLocal = quaternionPadre
                    .invert()
                    .multiply(quaternionAncla);

                candidatos.push({

                    ancla,
                    claveRack,
                    padre,

                    posicionMundo,
                    posicionLocal,
                    quaternionLocal,

                    distancia: distanciaXZ(
                        grupo.position,
                        posicionMundo
                    )
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
            `[CLIENTE ${id}] Decidió dejar el producto en otro rack.`,
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

        grupo.updateMatrixWorld(true);
        producto.updateMatrixWorld(true);
        original.parent.updateMatrixWorld(true);

        const posicionMundo = new THREE.Vector3();
        const quaternionMundo = new THREE.Quaternion();

        producto.getWorldPosition(posicionMundo);
        producto.getWorldQuaternion(quaternionMundo);

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

        // No sobrescribir el tipo REUBICAR.
        if (animacionProducto.tipo !== 'REUBICAR') {
            animacionProducto.tipo = 'DEVOLVER';
        }

        animacionProducto.tiempo = 0;
        animacionProducto.duracion = config.tiempoDevolver;

        animacionProducto.posicionInicial.copy(posicionMundo);
        animacionProducto.posicionFinal.copy(posicionFinal);
                if (!camino.length) {

            console.warn(
                `[CLIENTE ${id}] No pudo entrar por la puerta.`
            );

            return false;
        }

        ruta = camino;
        indiceRuta = 0;

        objetivo = ruta[ruta.length - 1];

        cambiarEstado(ESTADOS.ENTRANDO);

        return true;
    }

    // ========================================================
    // REGRESO AL VEHÍCULO
    // ========================================================

    function iniciarRegresoVehiculo(plaza, callback = null) {

        if (!plaza) return false;

        if (compras.length > 0) {

            console.warn(
                `[CLIENTE ${id}] No puede regresar al vehículo sin pagar.`
            );

            return false;
        }

        liberarReserva();

        if (productoEnMano) {

            devolverProductoAlEstante();
        }

        callbackRegreso =
            typeof callback === 'function'
                ? callback
                : null;

        const destino = {

            x: numero(plaza.x),
            z: numero(plaza.z)
        };

        const camino = crearRutaPorPuerta(
            destino,
            'salida'
        );

        if (!camino.length) {

            callbackRegreso = null;

            console.warn(
                `[CLIENTE ${id}] No pudo encontrar la salida hacia el vehículo.`
            );

            return false;
        }

        ruta = camino;
        indiceRuta = 0;

        objetivo = ruta[ruta.length - 1];

        cambiarEstado(ESTADOS.REGRESANDO);

        return true;
    }

    // ========================================================
    // ACTUALIZAR MOVIMIENTO
    // ========================================================

    function actualizarMovimiento(delta) {

        const terminado = moverHaciaDestino(delta);

        if (!terminado) return;

        switch (estado) {

            case ESTADOS.ENTRANDO: {

                cambiarEstado(ESTADOS.BUSCANDO);

                if (!entradaNotificada) {

                    entradaNotificada = true;

                    try {
                        config.alEntrar?.(api);
                    } catch (error) {
                        console.error(error);
                    }
                }

                break;
            }

            case ESTADOS.ACERCANDO: {

                cambiarEstado(ESTADOS.RECOGIENDO);

                break;
            }

            case ESTADOS.RUTA: {

                if (config.repetirRuta) {

                    indiceRuta = 0;

                } else {

                    cambiarEstado(ESTADOS.BUSCANDO);
                }

                break;
            }

            case ESTADOS.CAJA: {

                completarPago();

                break;
            }

            case ESTADOS.REGRESANDO: {

                cambiarEstado(ESTADOS.FINALIZADO);

                try {

                    callbackRegreso?.(api);

                } catch (error) {

                    console.error(
                        `[CLIENTE ${id}] Error en callback de regreso:`,
                        error
                    );
                }

                callbackRegreso = null;

                break;
            }
        }
    }

    // ========================================================
    // ACTUALIZAR CLIENTE
    // ========================================================

    function actualizar(delta = 0.016) {

        if (eliminado || detenido) return;

        delta = limitar(
            numero(delta, 0.016),
            0,
            0.05
        );

        tiempoEstado += delta;

        tiempoActualizarObstaculos += delta;

        if (tiempoActualizarObstaculos >= 2) {
            actualizarColisiones();
        }

        if (mixer) {
            mixer.update(delta);
        }

        if (!cargado) return;

        switch (estado) {

            // ------------------------------------------------
            // INACTIVO
            // ------------------------------------------------

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

                actualizarMovimiento(delta);

                break;
            }

            // ------------------------------------------------
            // BUSCAR PRODUCTO
            // ------------------------------------------------

            case ESTADOS.BUSCANDO: {

                if (
                    tiempoEstado >=
                    config.tiempoEntreProductos
                ) {

                    decidirCompra();
                }

                break;
            }

            // ------------------------------------------------
            // RECOGER PRODUCTO
            // ------------------------------------------------

            case ESTADOS.RECOGIENDO: {

                animarRecogerProcedural();

                if (
                    tiempoEstado >=
                    config.tiempoRecoger
                ) {

                    tomarProducto();
                }

                break;
            }

            // ------------------------------------------------
            // INSPECCIONAR
            // ------------------------------------------------

            case ESTADOS.INSPECCIONANDO: {

                animarInspeccionarProcedural();

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

                if (tiempoEstado >= 0.5) {

                    decisionCompra =
                        Math.random() <
                        config.probabilidadCompra;

                    if (decisionCompra) {

                        cambiarEstado(ESTADOS.GUARDANDO);

                    } else {

                        const reubicar =
                            Math.random() <
                            config.probabilidadDejarEnOtroRack;

                        if (
                            reubicar &&
                            prepararDevolucionEnOtroRack()
                        ) {

                            console.log(
                                `[CLIENTE ${id}] Reubicará el producto.`
                            );
                        }

                        cambiarEstado(ESTADOS.DEVOLVIENDO);

                        devolverProductoAlEstante();
                    }
                }

                break;
            }

            // ------------------------------------------------
            // GUARDAR EN CARRITO
            // ------------------------------------------------

            case ESTADOS.GUARDANDO: {

                animarGuardarProcedural();

                if (
                    tiempoEstado >=
                    config.tiempoGuardar
                ) {

                    guardarProducto();
                }

                break;
            }

            // ------------------------------------------------
            // DEVOLVER PRODUCTO
            // ------------------------------------------------

            case ESTADOS.DEVOLVIENDO: {

                animarDevolverProcedural();

                actualizarAnimacionProducto(delta);

                if (
                    !animacionProducto.activa &&
                    tiempoEstado >= config.tiempoDevolver
                ) {

                    cambiarEstado(ESTADOS.BUSCANDO);
                }

                break;
            }

            // ------------------------------------------------
            // ESPERAR
            // ------------------------------------------------

            case ESTADOS.ESPERANDO: {

                if (
                    tiempoEstado >=
                    config.tiempoReintento
                ) {

                    cambiarEstado(ESTADOS.BUSCANDO);
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

                    // Confirmar el inventario del carrito una sola vez,
                    // cuando la animación de pago ya terminó.
                    try {

                        if (
                            typeof config.carrito?.confirmarVenta ===
                            'function'
                        ) {

                            config.carrito.confirmarVenta();
                        }

                    } catch (error) {

                        console.error(
                            `[CLIENTE ${id}] Error al confirmar la venta del carrito:`,
                            error
                        );
                    }

                    compras.forEach(compra => {

                        if (compra.objeto) {

                            compra.objeto.userData.vendido = true;
                            compra.objeto.userData.enCarrito = false;
                        }
                    });

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
    // ENTRADA
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

        if (tiempoActualizarObstaculos >= 2) {
            actualizarColisiones();
        }

        if (mixer) {
            mixer.update(delta);
        }

        if (accionCaminar && accionCaminar.isRunning()) {

            accionCaminar.paused = ![

                ESTADOS.ENTRANDO,
                ESTADOS.ACERCANDO,
                ESTADOS.RUTA,
                ESTADOS.CAJA,
                ESTADOS.REGRESANDO

            ].includes(estado);
        }

        switch (estado) {

            // ------------------------------------------------
            // INACTIVO
            // ------------------------------------------------

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

                if (tiempoEstado >= config.tiempoRecoger) {
                    tomarProducto();
                }

                break;
            }

            // ------------------------------------------------
            // INSPECCIONAR
            // ------------------------------------------------

            case ESTADOS.INSPECCIONANDO: {

                animarInspeccionarProcedural();

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

                        // Iniciar el movimiento del producto.
                        devolverProductoAlEstante();

                        cambiarEstado(ESTADOS.DEVOLVIENDO);
                    }
                }

                break;
            }

            // ------------------------------------------------
            // GUARDAR EN CARRITO
            // ------------------------------------------------

            case ESTADOS.GUARDANDO: {

                animarGuardarProcedural();

                if (tiempoEstado >= config.tiempoGuardar) {
                    guardarProducto();
                }

                break;
            }

            // ------------------------------------------------
            // DEVOLVER O REUBICAR
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

                if (
                    tiempoEstado >= config.tiempoReintento
                ) {

                    if (
                        compras.length >=
                        config.maximoProductos
                    ) {

                        dirigirseACaja();

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

                    // Confirmar el inventario del carrito una sola vez,
                    // cuando la animación de pago ya terminó.
                    try {
                        if (typeof config.carrito?.confirmarVenta === 'function') {
                            config.carrito.confirmarVenta();
                        }
                    } catch (error) {
                        console.error(
                            `[CLIENTE ${id}] Error al confirmar la venta del carrito:`,
                            error
                        );
                    }

                    compras.forEach(compra => {
                        if (compra.objeto) {
                            compra.objeto.userData.vendido = true;
                            compra.objeto.userData.enCarrito = false;
                        }
                    });

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
    }

    // ========================================================
    // ANIMACIÓN
    // ========================================================

    function detenerAnimacion() {

        if (detenido || eliminado) return;

        detenido = true;

        mixer?.stopAllAction();
        accionCaminar?.stop();
        accionReposo?.stop();

        restaurarPoseCompleta();
    }

    function reproducirAnimacion() {

        if (eliminado || !detenido) return;

        detenido = false;

        const caminando = [
            ESTADOS.ENTRANDO,
            ESTADOS.ACERCANDO,
            ESTADOS.RUTA,
            ESTADOS.CAJA,
            ESTADOS.REGRESANDO
        ].includes(estado);

        if (caminando && accionCaminar) {

            accionReposo?.fadeOut(0.2);
            accionCaminar.reset();
            accionCaminar.fadeIn(0.2);
            accionCaminar.paused = false;
            accionCaminar.play();

        } else if (accionReposo) {

            accionCaminar?.fadeOut(0.2);
            accionReposo.reset();
            accionReposo.fadeIn(0.2);
            accionReposo.play();

        } else if (accionCaminar) {

            accionCaminar.reset();
            accionCaminar.fadeIn(0.2);
            accionCaminar.paused = false;
            accionCaminar.play();
        }
    }

    // ========================================================
    // ELIMINAR
    // ========================================================

    function eliminar() {

        if (eliminado) return;

        // Restaurar el producto si el cliente desaparece
        // mientras lo lleva en las manos.
        if (productoEnMano) {

            finalizarDevolucionProducto();
        }

        liberarReserva();

        callbackPagoPendiente = null;
        callbackRegreso = null;
        ticketPendiente = null;

        mixer?.stopAllAction();
        mixer = null;

        grupo.parent?.remove(grupo);

        eliminado = true;
        detenido = true;
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
