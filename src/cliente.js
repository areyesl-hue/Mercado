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

function dividirEscala(escala, divisor) {
    return new THREE.Vector3(
        escala.x / Math.max(Math.abs(divisor.x), 0.0001),
        escala.y / Math.max(Math.abs(divisor.y), 0.0001),
        escala.z / Math.max(Math.abs(divisor.z), 0.0001)
    );
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
    let tiempoReintentoMovimiento = 0;
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
        escalaFinal: new THREE.Vector3(1, 1, 1),

        padreOriginal: null
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

        if (claveExplicita !== undefined && claveExplicita !== null) {
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

        Object.keys(huesos).forEach(nombre => delete huesos[nombre]);
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
            'spine2', 'spine1', 'spine', 'chest'
        );

        rig.cuello = buscarHueso('neck', 'cuello');
        rig.cabeza = buscarHueso('head', 'cabeza');

        rig.brazoIzquierdo = buscarHueso(
            'leftupperarm', 'upperarml', 'leftarm'
        );

        rig.brazoDerecho = buscarHueso(
            'rightupperarm', 'upperarmr', 'rightarm'
        );

        rig.antebrazoIzquierdo = buscarHueso(
            'leftforearm', 'forearml', 'lowerarml'
        );

        rig.antebrazoDerecho = buscarHueso(
            'rightforearm', 'forearmr', 'lowerarmr'
        );

        rig.manoIzquierda = buscarHueso(
            'lefthand', 'handl', 'handleft'
        );

        rig.manoDerecha = buscarHueso(
            'righthand', 'handr', 'handright'
        );

        rig.piernaIzquierda = buscarHueso(
            'leftupleg', 'uplegleft', 'leftthigh', 'thighl'
        );

        rig.piernaDerecha = buscarHueso(
            'rightupleg', 'uplegright', 'rightthigh', 'thighr'
        );

        rig.pantorrillaIzquierda = buscarHueso(
            'leftleg', 'lowerlegleft', 'calfl', 'leftcalf'
        );

        rig.pantorrillaDerecha = buscarHueso(
            'rightleg', 'lowerlegright', 'calfr', 'rightcalf'
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
        const rebote = Math.abs(Math.sin(faseAnimacion)) * 0.025;

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

        aplicarRotacion(rig.brazoIzquierdo, EJE_X, -paso * 0.75);
        aplicarRotacion(rig.brazoDerecho, EJE_X, paso * 0.75);

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

        aplicarRotacion(rig.cadera, EJE_X, 0.30 * intensidad);
        aplicarRotacion(rig.torso, EJE_X, 0.25 * intensidad);

        aplicarRotacion(
            rig.piernaIzquierda, EJE_X, -0.65 * intensidad
        );

        aplicarRotacion(
            rig.piernaDerecha, EJE_X, -0.65 * intensidad
        );

        aplicarRotacion(
            rig.pantorrillaIzquierda, EJE_X, 0.28 * intensidad
        );

        aplicarRotacion(
            rig.pantorrillaDerecha, EJE_X, 0.28 * intensidad
        );
    }

    // ========================================================
    // ANIMACIONES DE ACCIONES
    // ========================================================

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

        aplicarRotacion(
            rig.torso,
            EJE_X,
            0.10 * t + 0.25 * agachado * t
        );

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

        aplicarRotacion(rig.cabeza, EJE_X, 0.22 + movimientoCabeza);
        aplicarRotacion(rig.cuello, EJE_X, 0.10);

        if (productoEsInferior) {
            animarAgacharse(1 - suavizar(tiempoEstado * 1.5));
        }

        if (productoEnMano) {
            productoEnMano.position.y =
                numero(config.offsetProductoMano.y) +
                Math.sin(tiempoEstado * 2.2) * 0.025;
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
        tiempoReintentoMovimiento = 0;

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

        if (!caminando && nuevoEstado !== ESTADOS.DEVOLVIENDO) {
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

        const margen = config.radioColision + config.margenObstaculos;
        const dentroPuerta = estaEnCorredorPuerta(x, z);

        for (const obstaculo of obstaculosCache) {

            if (dentroPuerta && esObstaculoDeFachada(obstaculo)) {
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
        const pasos = Math.max(1, Math.ceil(distancia / 0.25));

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

                    if (!puntoLibre(candidato.x, candidato.z)) continue;

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

            const actualClave = claveCelda(actual.x, actual.z);
            abiertosMapa.delete(actualClave);

            if (actualClave === finClave) {
                encontrado = actual;
                break;
            }

            if (cerrados.has(actualClave)) continue;
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
                const existente = abiertosMapa.get(vecinoClave);

                if (existente && nuevoG >= existente.g) continue;

                const vecino = {
                    x: nx,
                    z: nz,
                    g: nuevoG,
                    h: Math.hypot(bX - nx, bZ - nz),
                    padre: actual
                };

                abiertos.push(vecino);
                abiertosMapa.set(vecinoClave, vecino);
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

            for (let j = camino.length - 1; j >= indice; j--) {

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
    // MOVIMIENTO
    // ========================================================

    function orientarHacia(dx, dz) {

        if (Math.abs(dx) + Math.abs(dz) < 0.0001) return;

        grupo.rotation.y =
            Math.atan2(dx, dz) + config.correccionRotacion;
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

        const camino = encontrarCamino(grupo.position, punto);
        if (!camino.length) return false;

        ruta = camino;
        indiceRuta = 0;
        objetivo = camino[camino.length - 1];

        cambiarEstado(nuevoEstado);

        return true;
    }

    function recuperarMovimiento() {

        if (!objetivo) return false;

        const nuevoCamino = encontrarCamino(
            grupo.position,
            objetivo
        );

        if (!nuevoCamino.length) return false;

        ruta = nuevoCamino;
        indiceRuta = 0;

        return true;
    }

    function moverHaciaDestino(delta) {

        if (!ruta.length || indiceRuta >= ruta.length) {
            return true;
        }

        const destino = ruta[indiceRuta];

        const dx = destino.x - grupo.position.x;
        const dz = destino.z - grupo.position.z;
        const distancia = Math.hypot(dx, dz);

        if (distancia < 0.16) {

            grupo.position.x = destino.x;
            grupo.position.z = destino.z;
            grupo.position.y = 0;

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

        orientarHacia(direccionX, direccionZ);

        const avance = Math.min(distancia, velocidad * delta);

        const nuevoX = grupo.position.x + direccionX * avance;
        const nuevoZ = grupo.position.z + direccionZ * avance;

        if (
            !segmentoLibre(
                grupo.position,
                { x: nuevoX, z: nuevoZ }
            )
        ) {

            tiempoReintentoMovimiento += delta;

            // No recalcular A* en cada fotograma.
            if (tiempoReintentoMovimiento >= 0.35) {

                tiempoReintentoMovimiento = 0;
                intentosMovimiento++;

                if (recuperarMovimiento()) {
                    return false;
                }
            }

            if (intentosMovimiento >= 3) {

                console.warn(
                    `[CLIENTE ${id}] No pudo continuar su ruta.`
                );

                ruta = [];
                objetivo = null;

                if (estado === ESTADOS.REGRESANDO) {
                    cambiarEstado(ESTADOS.ESPERANDO);
                } else {
                    liberarReserva();
                    cambiarEstado(ESTADOS.BUSCANDO);
                }
            }

            return false;
        }

        tiempoReintentoMovimiento = 0;
        intentosMovimiento = 0;

        grupo.position.x = nuevoX;
        grupo.position.z = nuevoZ;

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
            numero(posicion.y, 0),
            numero(posicion.z, grupo.position.z)
        );

        ruta = [];
        objetivo = null;

        return true;
    }
        // ========================================================
    // PRODUCTOS
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
    // BUSCAR PRODUCTOS
    // ========================================================

    function buscarProducto() {

        const productos = obtenerProductos();
        const candidatos = [];

        for (const producto of productos) {

            if (!productoDisponible(producto)) continue;
            if (productosExaminados.has(producto)) continue;

            const claveRack = obtenerClaveRack(producto);

            if (!rackDisponible(producto)) continue;

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

    function obtenerPuntoFrenteProducto(producto) {

        const posicion = new THREE.Vector3();
        producto.getWorldPosition(posicion);

        const candidatos = [];

        for (let radio = 1.3; radio <= 3.2; radio += 0.3) {

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
                    distancia: distanciaXZ(grupo.position, punto)
                });
            }

            if (candidatos.length) break;
        }

        if (!candidatos.length) return null;

        candidatos.sort((a, b) => a.distancia - b.distancia);

        return candidatos[0];
    }

    function acercarseAProducto(producto) {

        if (!reservarProducto(producto)) return false;

        const destino = obtenerPuntoFrenteProducto(producto);

        if (!destino) {
            liberarReserva();
            return false;
        }

        if (!establecerObjetivo(destino, ESTADOS.ACERCANDO)) {
            liberarReserva();
            return false;
        }

        return true;
    }

    // ========================================================
    // ANIMACIÓN DE PRODUCTO
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

        const escalaMundo = new THREE.Vector3().lerpVectors(
            animacionProducto.escalaInicial,
            animacionProducto.escalaFinal,
            suave
        );

        const padre = producto.parent;

        if (padre) {

            padre.updateMatrixWorld(true);

            producto.position.copy(
                padre.worldToLocal(posicion.clone())
            );

            const quaternionPadre = padre.getWorldQuaternion(
                new THREE.Quaternion()
            );

            producto.quaternion
                .copy(quaternionPadre.invert())
                .multiply(quaternion);

            const escalaPadre = padre.getWorldScale(
                new THREE.Vector3()
            );

            producto.scale.copy(
                dividirEscala(escalaMundo, escalaPadre)
            );
        }

        // ----------------------------------------------------
        // FINALIZAR RECOGIDA Y ADJUNTAR A LA MANO
        // ----------------------------------------------------

        if (
            animacionProducto.tipo === 'RECOGER' &&
            t >= 1
        ) {

            const mano =
                rig.manoDerecha ||
                rig.brazoDerecho;

            if (mano) {

                grupo.updateMatrixWorld(true);
                mano.updateMatrixWorld(true);

                // attach conserva la transformación mundial.
                mano.attach(producto);

                mano.updateMatrixWorld(true);

                const offset = config.offsetProductoMano;
                const rotacion = config.rotacionProductoMano;

                const posicionLocal = new THREE.Vector3(
                    numero(offset.x),
                    numero(offset.y),
                    numero(offset.z)
                );

                const quaternionLocal = new THREE.Quaternion()
                    .setFromEuler(
                        new THREE.Euler(
                            numero(rotacion.x),
                            numero(rotacion.y),
                            numero(rotacion.z)
                        )
                    );

                // La escala local se calcula respecto a la mano.
                // Así no se multiplica dos veces la escala anterior.
                const escalaMano = mano.getWorldScale(
                    new THREE.Vector3()
                );

                const escalaDeseada = animacionProducto.escalaFinal
                    .clone();

                producto.position.copy(posicionLocal);
                producto.quaternion.copy(quaternionLocal);

                producto.scale.copy(
                    dividirEscala(escalaDeseada, escalaMano)
                );

                producto.updateMatrixWorld(true);
            }

            animacionProducto.activa = false;
            animacionProducto.tipo = null;
            animacionProducto.tiempo = 0;

            return true;
        }

        // ----------------------------------------------------
        // FINALIZAR DEVOLUCIÓN O REUBICACIÓN
        // ----------------------------------------------------

        if (
            animacionProducto.tipo === 'DEVOLVER' ||
            animacionProducto.tipo === 'REUBICAR'
        ) {

            if (t >= 1) {
                finalizarDevolucionProducto();
                return true;
            }
        }

        return false;
    }

    // ========================================================
    // FINALIZAR DEVOLUCIÓN O REUBICACIÓN
    // ========================================================

    function finalizarDevolucionProducto() {

        if (!productoEnMano || !productoOriginal) {

            animacionProducto.activa = false;
            animacionProducto.tipo = null;
            animacionProducto.tiempo = 0;

            productoEnMano = null;
            productoOriginal = null;

            liberarReserva();

            return;
        }

        const producto = productoEnMano;
        const original = productoOriginal;
        const tipoDevolucion = animacionProducto.tipo;

        producto.parent?.remove(producto);

        if (original.parent) {

            original.parent.add(producto);

            producto.position.copy(original.posicion);
            producto.quaternion.copy(original.quaternion);
            producto.scale.copy(original.escala);

        } else {

            scene.add(producto);

            producto.position.copy(original.posicion);
            producto.quaternion.copy(original.quaternion);
            producto.scale.copy(original.escala);
        }

        producto.visible = original.visible;

        if (
            tipoDevolucion === 'REUBICAR' &&
            original.rackNuevo
        ) {
            producto.userData.rackReubicado =
                original.rackNuevo;
        }

        producto.updateMatrixWorld(true);

        animacionProducto.activa = false;
        animacionProducto.tipo = null;
        animacionProducto.tiempo = 0;

        productoEnMano = null;
        productoOriginal = null;

        liberarReserva();
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

        const cajaProducto = new THREE.Box3().setFromObject(producto);

        const tamanoProducto = new THREE.Vector3();
        cajaProducto.getSize(tamanoProducto);

        const posicionMundo = producto.getWorldPosition(
            new THREE.Vector3()
        );

        const quaternionMundo = producto.getWorldQuaternion(
            new THREE.Quaternion()
        );

        const escalaMundo = producto.getWorldScale(
            new THREE.Vector3()
        );

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

        const mano = rig.manoDerecha || rig.brazoDerecho;

        if (!mano) {

            productoEnMano = null;
            productoOriginal = null;

            liberarReserva();
            cambiarEstado(ESTADOS.BUSCANDO);

            return;
        }

        grupo.updateMatrixWorld(true);
        mano.updateMatrixWorld(true);

        const offset = config.offsetProductoMano;
        const rotacion = config.rotacionProductoMano;

        const posicionFinal = mano.localToWorld(
            new THREE.Vector3(
                numero(offset.x),
                numero(offset.y),
                numero(offset.z)
            )
        );

        const quaternionMano = mano.getWorldQuaternion(
            new THREE.Quaternion()
        );

        const quaternionFinal = quaternionMano.multiply(
            new THREE.Quaternion().setFromEuler(
                new THREE.Euler(
                    numero(rotacion.x),
                    numero(rotacion.y),
                    numero(rotacion.z)
                )
            )
        );

        // Escala mundial deseada del producto en la mano.
        const escalaFinal = escalaMundo.clone().multiplyScalar(
            config.escalaProductoMano
        );

        animacionProducto.activa = true;
        animacionProducto.tipo = 'RECOGER';
        animacionProducto.tiempo = 0;
        animacionProducto.duracion = config.tiempoRecoger;

        animacionProducto.posicionInicial.copy(posicionMundo);
        animacionProducto.posicionFinal.copy(posicionFinal);

        animacionProducto.quaternionInicial.copy(quaternionMundo);
        animacionProducto.quaternionFinal.copy(quaternionFinal);

        animacionProducto.escalaInicial.copy(escalaMundo);
        animacionProducto.escalaFinal.copy(escalaFinal);

        animacionProducto.padreOriginal = producto.parent;

        cambiarEstado(ESTADOS.INSPECCIONANDO);
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

            const cajaAncla = new THREE.Box3().setFromObject(ancla);
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

        candidatos.sort((a, b) => a.distancia - b.distancia);

        const cantidad = Math.min(3, candidatos.length);

        return candidatos[
            Math.floor(Math.random() * cantidad)
        ];
    }

    // ========================================================
    // PREPARAR REUBICACIÓN
    // ========================================================

    function prepararDevolucionEnOtroRack() {

        if (!productoEnMano || !productoOriginal) return false;

        const ubicacion = buscarUbicacionOtroRack(productoEnMano);
        if (!ubicacion) return false;

        const rackAnterior =
            rackReservado ?? obtenerClaveRack(productoEnMano);

        const escalaOriginal = productoOriginal.escala.clone();
        const tamanoOriginal = productoOriginal.tamanoMundo.clone();

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
            animacionProducto.tipo = null;

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

        const posicionMundo = producto.getWorldPosition(
            new THREE.Vector3()
        );

        const quaternionMundo = producto.getWorldQuaternion(
            new THREE.Quaternion()
        );

        const escalaMundo = producto.getWorldScale(
            new THREE.Vector3()
        );

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
        animacionProducto.duracion = config.tiempoDevolver;

        animacionProducto.posicionInicial.copy(posicionMundo);
        animacionProducto.posicionFinal.copy(posicionFinal);

        animacionProducto.quaternionInicial.copy(quaternionMundo);
        animacionProducto.quaternionFinal.copy(quaternionFinal);

        // Ambas escalas deben ser mundiales durante la interpolación.
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

                const resultado = config.carrito.agregarProducto(
                    producto,
                    {
                        nombre: compra.nombre,
                        precio: compra.precio,
                        cantidad: 1
                    }
                );

                // Algunos módulos de carrito no devuelven nada.
                // Solo false significa que rechazaron el producto.
                agregado = resultado !== false;

            } else if (config.carrito?.agregar) {

                const resultado = config.carrito.agregar(producto);

                agregado = resultado !== false;
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
            `[CLIENTE ${id}] Producto agregado al carrito: ${compra.nombre}`,
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

        for (let i = 0; i < puntosRecorrido.length; i++) {

            const indice =
                (indiceRecorrido + i) % puntosRecorrido.length;

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
            console.error(error);
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

        // BUSCANDO e INACTIVO pueden ser estados iniciales
        // de clientes que todavía no han comenzado su visita.
        const estadosOcupados = [
            ESTADOS.ENTRANDO,
            ESTADOS.ACERCANDO,
            ESTADOS.RECOGIENDO,
            ESTADOS.INSPECCIONANDO,
            ESTADOS.DECIDIENDO,
            ESTADOS.GUARDANDO,
            ESTADOS.DEVOLVIENDO,
            ESTADOS.RUTA,
            ESTADOS.CAJA,
            ESTADOS.PAGANDO,
            ESTADOS.REGRESANDO,
            ESTADOS.FINALIZADO
        ];

        if (
            estadosOcupados.includes(estado) ||
            entradaNotificada
        ) {

            console.warn(
                `[CLIENTE ${id}] Ya está realizando una actividad.`
            );

            return false;
        }

        liberarReserva();

        if (productoEnMano) {
            finalizarDevolucionProducto();
        }

        compras = [];

        productosExaminados.clear();
        racksVisitados.clear();

        callbackPagoPendiente = null;
        ticketPendiente = null;
        callbackRegreso = null;

        entradaNotificada = false;

        grupo.position.set(
            numero(posicionEntrada.x, plaza.x),
            0,
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

        actualizarColisiones();

        const destino = {
            x: numero(plaza.x),
            z: numero(plaza.z)
        };

        const camino = crearRutaPorPuerta(destino, 'salida');

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

                    if (compras.length >= config.maximoProductos) {
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

                if (tiempoEstado < config.tiempoEntreProductos) {
                    break;
                }

                if (compras.length >= config.maximoProductos) {
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

                if (animacionProducto.activa) {
                    actualizarAnimacionProducto(delta);
                }

                animarInspeccionarProcedural();

                if (
                    tiempoEstado >= config.tiempoInspeccionar &&
                    !animacionProducto.activa
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
                        Math.random() < config.probabilidadCompra;

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

                if (animacionProducto.activa) {
                    actualizarAnimacionProducto(delta);
                }

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

                if (tiempoEstado >= config.tiempoReintento) {

                    if (compras.length >= config.maximoProductos) {
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

        if (typeof opcionesCompras.probabilidadCompra === 'number') {
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

        if (typeof opcionesCompras.maximoProductos === 'number') {
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

        detenido = true;
        accionCaminar?.fadeOut(0.2);
    }

    function reproducirAnimacion() {
        detenido = false;
    }

    // ========================================================
    // ELIMINAR
    // ========================================================

    function eliminar() {

        if (eliminado) return;

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
            return objetivo ? { ...objetivo } : null;
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
