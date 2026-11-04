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

    intervaloRecalculoRuta: 0.55,
    maximosIntentosMovimiento: 5,
    distanciaRecalculo: 0.45,

    distanciaLlegada: 0.16,
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
let siguienteIdCliente = 1;

const TAMANO_ZONA_RACK = 3.5;

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
// COLA DE PRIORIDAD
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

        let i = lista.length - 1;

        while (i > 0) {
            const padre = Math.floor((i - 1) / 2);

            if (lista[padre].f <= lista[i].f) break;

            [lista[padre], lista[i]] =
                [lista[i], lista[padre]];

            i = padre;
        }
    }

    extraer() {
        const lista = this.elementos;

        if (!lista.length) return null;
        if (lista.length === 1) return lista.pop();

        const primero = lista[0];
        lista[0] = lista.pop();

        let i = 0;

        while (true) {
            const izquierda = i * 2 + 1;
            const derecha = izquierda + 1;

            let menor = i;

            if (
                izquierda < lista.length &&
                lista[izquierda].f < lista[menor].f
            ) menor = izquierda;

            if (
                derecha < lista.length &&
                lista[derecha].f < lista[menor].f
            ) menor = derecha;

            if (menor === i) break;

            [lista[i], lista[menor]] =
                [lista[menor], lista[i]];

            i = menor;
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
    let tiempoRecalculoRuta = 0;

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
    const quaternionTemporal = new THREE.Quaternion();
    const vectorTemporal = new THREE.Vector3();
    const vectorTemporal2 = new THREE.Vector3();
    const escalaTemporal = new THREE.Vector3();
    const cajaTemporal = new THREE.Box3();
    const tamanoTemporal = new THREE.Vector3();

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
        quaternionTemporal: new THREE.Quaternion()
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
        const z = config.puertaZUmbral;

        return (
            Math.abs(obstaculo.z - z) < 2.5 &&
            obstaculo.z - obstaculo.profundidad / 2 <= z + 1 &&
            obstaculo.z + obstaculo.profundidad / 2 >= z - 1
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

        const explicita =
            datos.idRack ??
            datos.rackId ??
            datos.estante ??
            datos.departamento ??
            datos.categoria;

        if (explicita !== undefined && explicita !== null) {
            return `rack:${explicita}`;
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
        return !!producto;
    }

    function reservarRack(producto) {
        if (!producto) return false;

        rackReservado = obtenerClaveRack(producto);
        racksVisitados.add(rackReservado);

        return true;
    }

    function liberarRack() {
        rackReservado = null;
    }

    function productoDisponible(producto) {
        if (!producto || !producto.visible) return false;

        const datos = producto.userData ?? {};

        if (datos.vendido) return false;
        if (datos.enCarrito) return false;
        if (datos.enMano) return false;
        if (datos.enProcesoDeDevolucion) return false;

        const propietario = reservasProductos.get(producto);

        if (propietario !== undefined && propietario !== id) {
            return false;
        }

        if (
            datos.reservado &&
            datos.reservadoPor !== id
        ) {
            return false;
        }

        return true;
    }

    function reservarProducto(producto) {
        if (!productoDisponible(producto)) return false;

        reservasProductos.set(producto, id);

        producto.userData.reservado = true;
        producto.userData.reservadoPor = id;

        productoObjetivo = producto;

        reservarRack(producto);

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
            if (patrones.some(p => nombre.includes(p))) {
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

        hueso.quaternion.slerp(
            base.quaternion,
            intensidad
        );
    }

    function restaurarPoseCompleta() {
        for (const [hueso, base] of huesosBase) {
            hueso.quaternion.copy(base.quaternion);
            hueso.position.copy(base.posicion);
        }

        grupo.position.y = numero(config.posicion.y);
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
            ![
                ESTADOS.DEVOLVIENDO,
                ESTADOS.INSPECCIONANDO,
                ESTADOS.RECOGIENDO
            ].includes(nuevoEstado)
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
            for (const c of config.colisiones) {
                if (!c) continue;

                obstaculos.push({
                    x: numero(c.x),
                    z: numero(c.z),
                    ancho: numero(c.ancho, c.width ?? 1),
                    profundidad: numero(
                        c.profundidad,
                        c.depth ?? 1
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
                ) return;

                cajaTemporal.setFromObject(obj);

                if (cajaTemporal.isEmpty()) return;

                cajaTemporal.getCenter(vectorTemporal);
                cajaTemporal.getSize(tamanoTemporal);

                if (tamanoTemporal.y > 3.5) return;

                if (
                    tamanoTemporal.x < 0.08 ||
                    tamanoTemporal.z < 0.08
                ) return;

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
        obstaculosCache = obtenerObstaculos().filter(obstaculo =>
            Number.isFinite(obstaculo.x) &&
            Number.isFinite(obstaculo.z) &&
            obstaculo.ancho > 0 &&
            obstaculo.profundidad > 0
        );

        tiempoActualizarObstaculos = 0;
    }

    function puntoLibre(x, z) {
        if (
            x < -config.limiteX ||
            x > config.limiteX ||
            z < config.limiteZMin ||
            z > config.limiteZMax
        ) return false;

        const margen =
            config.radioColision +
            config.margenObstaculos;

        const dentroPuerta = estaEnCorredorPuerta(x, z);

        for (const obstaculo of obstaculosCache) {
            if (
                dentroPuerta &&
                esObstaculoDeFachada(obstaculo)
            ) continue;

            const mitadX = obstaculo.ancho / 2 + margen;
            const mitadZ = obstaculo.profundidad / 2 + margen;

            if (
                Math.abs(x - obstaculo.x) < mitadX &&
                Math.abs(z - obstaculo.z) < mitadZ
            ) return false;
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
            [1, 0, 1], [-1, 0, 1],
            [0, 1, 1], [0, -1, 1],
            [1, 1, 1.414], [1, -1, 1.414],
            [-1, 1, 1.414], [-1, -1, 1.414]
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
                    ) continue;
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
    }    // ========================================================
    // MOVIMIENTO Y ORIENTACIÓN
    // ========================================================

    function orientarHacia(x, z, suavidad = 8, delta = 1 / 60) {
        const dx = x - grupo.position.x;
        const dz = z - grupo.position.z;

        if (Math.abs(dx) + Math.abs(dz) < 0.0001) return;

        const anguloObjetivo = Math.atan2(dx, dz)
            + config.correccionRotacion;

        const diferencia = Math.atan2(
            Math.sin(anguloObjetivo - grupo.rotation.y),
            Math.cos(anguloObjetivo - grupo.rotation.y)
        );

        grupo.rotation.y += diferencia *
            (1 - Math.exp(-suavidad * delta));
    }

    function establecerRuta(destino, forzar = false) {
        if (!destino) return false;

        const origen = {
            x: grupo.position.x,
            z: grupo.position.z
        };

        const final = {
            x: numero(destino.x),
            z: numero(destino.z)
        };

        if (!puntoLibre(final.x, final.z)) {
            return false;
        }

        const nuevaRuta = encontrarCamino(origen, final);

        if (!nuevaRuta.length) {
            if (!forzar) return false;

            ruta = [];
            indiceRuta = 0;
            return false;
        }

        ruta = nuevaRuta;
        indiceRuta = 0;
        objetivo = final;

        intentosMovimiento = 0;
        tiempoRecalculoRuta = 0;

        return true;
    }

    function avanzarPorRuta(delta, velocidad = config.velocidad) {
        if (!ruta.length || indiceRuta >= ruta.length) {
            return true;
        }

        const punto = ruta[indiceRuta];

        const distancia = distanciaXZ(grupo.position, punto);

        if (distancia <= config.distanciaWaypoint) {
            indiceRuta++;

            if (indiceRuta >= ruta.length) {
                ruta = [];
                indiceRuta = 0;
                return true;
            }

            return false;
        }

        orientarHacia(punto.x, punto.z, 10, delta);

        const dx = punto.x - grupo.position.x;
        const dz = punto.z - grupo.position.z;

        const longitud = Math.hypot(dx, dz) || 1;

        const paso = Math.min(
            distancia,
            velocidad * delta
        );

        const nuevoX = grupo.position.x +
            dx / longitud * paso;

        const nuevoZ = grupo.position.z +
            dz / longitud * paso;

        if (!puntoLibre(nuevoX, nuevoZ)) {
            intentosMovimiento++;
            tiempoRecalculoRuta = config.intervaloRecalculoRuta;
            return false;
        }

        grupo.position.x = nuevoX;
        grupo.position.z = nuevoZ;

        return false;
    }

    function moverHaciaDestino(delta, destino, velocidad) {
        if (!destino) return false;

        if (!ruta.length) {
            if (
                distanciaXZ(grupo.position, destino) <=
                config.distanciaLlegada
            ) return true;

            if (!establecerRuta(destino)) {
                intentosMovimiento++;

                if (
                    intentosMovimiento >=
                    config.maximosIntentosMovimiento
                ) {
                    manejarFalloMovimiento();
                }

                return false;
            }
        }

        tiempoRecalculoRuta += delta;

        if (
            tiempoRecalculoRuta >=
            config.intervaloRecalculoRuta
        ) {
            tiempoRecalculoRuta = 0;

            const siguiente = ruta[indiceRuta];

            if (
                siguiente &&
                !segmentoLibre(grupo.position, siguiente)
            ) {
                ruta = [];
                indiceRuta = 0;
                intentosMovimiento++;
            }
        }

        const llego = avanzarPorRuta(delta, velocidad);

        if (llego) {
            intentosMovimiento = 0;
            return true;
        }

        if (
            intentosMovimiento >=
            config.maximosIntentosMovimiento
        ) {
            manejarFalloMovimiento();
        }

        return false;
    }

    function manejarFalloMovimiento() {
        ruta = [];
        indiceRuta = 0;

        switch (estado) {
            case ESTADOS.REGRESANDO:
                callbackRegreso = null;
                cambiarEstado(ESTADOS.ESPERANDO);
                break;

            case ESTADOS.ACERCANDO:
                liberarReserva();
                detenerMovimiento();
                cambiarEstado(ESTADOS.BUSCANDO);
                break;

            case ESTADOS.CAJA:
                console.warn(
                    `[CLIENTE ${id}] No pudo llegar a la caja.`
                );
                cambiarEstado(ESTADOS.ESPERANDO);
                break;

            default:
                liberarReserva();
                cambiarEstado(ESTADOS.BUSCANDO);
                break;
        }
    }

    function detenerMovimiento() {
        ruta = [];
        indiceRuta = 0;
        objetivo = null;
    }

    // ========================================================
    // ANIMACIÓN PROCEDURAL DEL CUERPO
    // ========================================================

    function animarCaminar(delta) {
        if (accionCaminar) return;

        faseAnimacion += delta * 9;

        const intensidad = Math.sin(faseAnimacion);

        aplicarRotacion(
            rig.brazoIzquierdo,
            EJE_X,
            intensidad * 0.42
        );

        aplicarRotacion(
            rig.brazoDerecho,
            EJE_X,
            -intensidad * 0.42
        );

        aplicarRotacion(
            rig.piernaIzquierda,
            EJE_X,
            -intensidad * 0.50
        );

        aplicarRotacion(
            rig.piernaDerecha,
            EJE_X,
            intensidad * 0.50
        );

        aplicarRotacion(
            rig.pantorrillaIzquierda,
            EJE_X,
            Math.max(0, intensidad) * 0.30
        );

        aplicarRotacion(
            rig.pantorrillaDerecha,
            EJE_X,
            Math.max(0, -intensidad) * 0.30
        );

        grupo.position.y =
            numero(config.posicion.y) +
            Math.abs(Math.sin(faseAnimacion * 2)) * 0.025;
    }

    function animarReposo(delta) {
        if (accionReposo) return;

        faseAnimacion += delta * 1.7;

        grupo.position.y =
            numero(config.posicion.y) +
            Math.sin(faseAnimacion) * 0.008;

        restaurarHueso(rig.brazoIzquierdo, 0.12);
        restaurarHueso(rig.brazoDerecho, 0.12);
        restaurarHueso(rig.piernaIzquierda, 0.12);
        restaurarHueso(rig.piernaDerecha, 0.12);
    }

    function animarRecogida(delta) {
        const progreso = suavizar(
            tiempoEstado / Math.max(config.tiempoRecoger, 0.01)
        );

        const bajar = Math.sin(progreso * Math.PI);

        aplicarRotacion(rig.torso, EJE_X, -0.12 * bajar);
        aplicarRotacion(rig.cuello, EJE_X, 0.10 * bajar);
        aplicarRotacion(rig.brazoDerecho, EJE_X, -0.85 * bajar);
        aplicarRotacion(rig.antebrazoDerecho, EJE_X, -0.45 * bajar);
        aplicarRotacion(rig.brazoIzquierdo, EJE_X, -0.20 * bajar);

        animarBrazoProducto(progreso);
    }

    function animarInspeccion(delta) {
        const balanceo = Math.sin(tiempoEstado * 2.2) * 0.035;

        aplicarRotacion(rig.torso, EJE_X, -0.025);
        aplicarRotacion(rig.cuello, EJE_X, -0.12);
        aplicarRotacion(rig.brazoDerecho, EJE_X, -0.55 + balanceo);
        aplicarRotacion(rig.antebrazoDerecho, EJE_X, -0.65);
        aplicarRotacion(rig.brazoIzquierdo, EJE_X, -0.35);
        aplicarRotacion(rig.antebrazoIzquierdo, EJE_X, -0.25);
    }

    function animarGuardar(delta) {
        const progreso = suavizar(
            tiempoEstado / Math.max(config.tiempoGuardar, 0.01)
        );

        aplicarRotacion(
            rig.brazoDerecho,
            EJE_X,
            THREE.MathUtils.lerp(-0.55, 0.05, progreso)
        );

        aplicarRotacion(
            rig.antebrazoDerecho,
            EJE_X,
            THREE.MathUtils.lerp(-0.65, 0, progreso)
        );

        aplicarRotacion(
            rig.brazoIzquierdo,
            EJE_X,
            THREE.MathUtils.lerp(-0.35, 0.05, progreso)
        );

        aplicarRotacion(
            rig.antebrazoIzquierdo,
            EJE_X,
            THREE.MathUtils.lerp(-0.25, 0, progreso)
        );
    }

    function animarDevolucion(delta) {
        const progreso = suavizar(
            tiempoEstado / Math.max(config.tiempoDevolver, 0.01)
        );

        const bajar = Math.sin(progreso * Math.PI);

        aplicarRotacion(rig.torso, EJE_X, -0.13 * bajar);

        aplicarRotacion(
            rig.brazoDerecho,
            EJE_X,
            THREE.MathUtils.lerp(-0.55, -0.95, bajar)
        );

        aplicarRotacion(
            rig.antebrazoDerecho,
            EJE_X,
            -0.50 * bajar
        );

        animarBrazoProducto(progreso);
    }

    function animarPago(delta) {
        const movimiento = Math.sin(tiempoEstado * 3) * 0.06;

        aplicarRotacion(rig.brazoDerecho, EJE_X, -0.40 + movimiento);
        aplicarRotacion(rig.antebrazoDerecho, EJE_X, -0.45);
        aplicarRotacion(rig.brazoIzquierdo, EJE_X, -0.25);
        aplicarRotacion(rig.antebrazoIzquierdo, EJE_X, -0.25);
        aplicarRotacion(rig.cabeza, EJE_X, 0.04);
    }

    // ========================================================
    // MANO PARA PRODUCTOS
    // ========================================================

    function obtenerMano() {
        return (
            rig.manoDerecha ||
            rig.manoIzquierda ||
            rig.brazoDerecho ||
            modelo ||
            grupo
        );
    }

    function obtenerPosicionMano() {
        const mano = obtenerMano();

        mano.updateWorldMatrix(true, false);

        const posicion = new THREE.Vector3();

        mano.getWorldPosition(posicion);

        if (!rig.manoDerecha && !rig.manoIzquierda) {
            posicion.y += 0.20;
            posicion.z += 0.12;
        }

        return posicion;
    }

    function prepararProductoEnMano(producto) {
        if (!producto) return false;

        const mano = obtenerMano();

        if (!mano) return false;

        producto.updateWorldMatrix(true, false);

        const escalaMundo = producto.getWorldScale(
            new THREE.Vector3()
        );

        const posicionMundo = producto.getWorldPosition(
            new THREE.Vector3()
        );

        const quaternionMundo = producto.getWorldQuaternion(
            new THREE.Quaternion()
        );

        mano.attach(producto);

        producto.position.copy(
            mano.worldToLocal(posicionMundo)
        );

        const quaternionMano = mano.getWorldQuaternion(
            new THREE.Quaternion()
        );

        producto.quaternion
            .copy(quaternionMano.invert())
            .multiply(quaternionMundo);

        const escalaMano = mano.getWorldScale(
            new THREE.Vector3()
        );

        producto.scale.set(
            escalaMundo.x / Math.max(escalaMano.x, 0.0001),
            escalaMundo.y / Math.max(escalaMano.y, 0.0001),
            escalaMundo.z / Math.max(escalaMano.z, 0.0001)
        );

        producto.userData.enMano = true;
        producto.userData.clienteEnMano = id;

        productoEnMano = producto;

        return true;
    }

    function animarBrazoProducto(progreso = 0) {
        if (!productoEnMano) return;

        const mano = obtenerMano();

        const objetivoMano = new THREE.Vector3(
            config.offsetProductoMano.x,
            config.offsetProductoMano.y,
            config.offsetProductoMano.z
        );

        mano.updateMatrixWorld(true);

        productoEnMano.position.lerp(
            objetivoMano,
            0.22
        );

        productoEnMano.rotation.x = config.rotacionProductoMano.x;
        productoEnMano.rotation.y = config.rotacionProductoMano.y;
        productoEnMano.rotation.z = config.rotacionProductoMano.z;
    }

    function iniciarAnimacionAgarre(producto) {
        if (!producto) return false;

        if (!prepararProductoEnMano(producto)) {
            return false;
        }

        animacionAgarre.activa = true;
        animacionAgarre.tiempo = 0;
        animacionAgarre.duracion = Math.max(
            config.tiempoAnimacionAgarre,
            0.05
        );

        animacionAgarre.posicionInicial.copy(producto.position);

        animacionAgarre.posicionFinal.set(
            config.offsetProductoMano.x,
            config.offsetProductoMano.y,
            config.offsetProductoMano.z
        );

        animacionAgarre.quaternionInicial.copy(producto.quaternion);

        animacionAgarre.quaternionFinal.setFromEuler(
            new THREE.Euler(
                config.rotacionProductoMano.x,
                config.rotacionProductoMano.y,
                config.rotacionProductoMano.z
            )
        );

        animacionAgarre.escalaInicial.copy(producto.scale);

        animacionAgarre.escalaFinal.copy(producto.scale)
            .multiplyScalar(config.escalaProductoMano);

        return true;
    }

    function actualizarAnimacionAgarre(delta) {
        if (!animacionAgarre.activa || !productoEnMano) {
            animacionAgarre.activa = false;
            return true;
        }

        animacionAgarre.tiempo += delta;

        const progreso = limitar(
            animacionAgarre.tiempo /
                animacionAgarre.duracion,
            0,
            1
        );

        const t = suavizar(progreso);

        productoEnMano.position.lerpVectors(
            animacionAgarre.posicionInicial,
            animacionAgarre.posicionFinal,
            t
        );

        productoEnMano.quaternion.slerpQuaternions(
            animacionAgarre.quaternionInicial,
            animacionAgarre.quaternionFinal,
            t
        );

        productoEnMano.scale.lerpVectors(
            animacionAgarre.escalaInicial,
            animacionAgarre.escalaFinal,
            t
        );

        if (progreso >= 1) {
            animacionAgarre.activa = false;
            return true;
        }

        return false;
    }

    // ========================================================
    // BUSCAR PRODUCTOS
    // ========================================================

    function obtenerListaProductos() {
        const fuente = config.productos;

        if (!fuente) return [];

        if (Array.isArray(fuente)) return fuente;

        if (fuente instanceof Map) {
            return [...fuente.values()].flat();
        }

        if (fuente.children) {
            const lista = [];

            fuente.traverse(obj => {
                if (
                    obj !== fuente &&
                    (
                        obj.userData?.esProducto ||
                        obj.userData?.producto ||
                        obj.userData?.codigoProducto ||
                        obj.userData?.precio !== undefined
                    )
                ) {
                    lista.push(obj);
                }
            });

            return lista;
        }

        if (typeof fuente === 'object') {
            return Object.values(fuente).flatMap(valor => {
                if (Array.isArray(valor)) return valor;
                return valor?.isObject3D ? [valor] : [];
            });
        }

        return [];
    }

    function obtenerNombreProducto(producto) {
        return (
            producto.userData?.nombre ||
            producto.userData?.nombreProducto ||
            producto.userData?.codigoProducto ||
            producto.name ||
            'Producto'
        );
    }

    function obtenerPuntoFrenteProducto(producto) {
        producto.updateWorldMatrix(true, false);

        const posicion = producto.getWorldPosition(
            new THREE.Vector3()
        );

        const candidatos = [];

        const direcciones = [
            [0, 1],
            [0, -1],
            [1, 0],
            [-1, 0],
            [0.7, 0.7],
            [-0.7, 0.7],
            [0.7, -0.7],
            [-0.7, -0.7]
        ];

        for (const [dx, dz] of direcciones) {
            const punto = {
                x: posicion.x + dx * config.distanciaFrenteProducto,
                z: posicion.z + dz * config.distanciaFrenteProducto
            };

            if (!puntoLibre(punto.x, punto.z)) continue;

            const camino = encontrarCamino(
                grupo.position,
                punto
            );

            if (!camino.length) continue;

            const costoRuta = camino.reduce(
                (total, puntoRuta, indice) => {
                    const anterior = indice === 0
                        ? grupo.position
                        : camino[indice - 1];

                    return total + distanciaXZ(
                        anterior,
                        puntoRuta
                    );
                },
                0
            );

            candidatos.push({
                ...punto,
                costoRuta
            });
        }

        candidatos.sort(
            (a, b) => a.costoRuta - b.costoRuta
        );

        return candidatos[0] ?? null;
    }

    function buscarProductoDisponible() {
        const productos = obtenerListaProductos();

        if (!productos.length) return null;

        const candidatos = [];

        for (const producto of productos) {
            if (!producto?.isObject3D) continue;
            if (!productoDisponible(producto)) continue;
            if (productosExaminados.has(producto)) continue;

            const posicion = producto.getWorldPosition(
                new THREE.Vector3()
            );

            const distancia = distanciaXZ(
                grupo.position,
                posicion
            );

            if (distancia > config.distanciaMaximaBusqueda) {
                continue;
            }

            const frente = obtenerPuntoFrenteProducto(producto);

            if (!frente) continue;

            const variedad = obtenerClaveRack(producto);

            const penalizacionRack =
                racksVisitados.has(variedad) ? 1.8 : 0;

            candidatos.push({
                producto,
                frente,
                costo: distancia + penalizacionRack
            });
        }

        candidatos.sort((a, b) => a.costo - b.costo);

        for (const candidato of candidatos) {
            if (reservarProducto(candidato.producto)) {
                return candidato;
            }
        }

        return null;
    }

    // ========================================================
    // INICIAR BÚSQUEDA Y RECOGIDA
    // ========================================================

    function iniciarBusqueda() {
        if (eliminado || detenido) return;

        liberarReserva();

        const encontrado = buscarProductoDisponible();

        if (!encontrado) {
            detenerMovimiento();
            cambiarEstado(ESTADOS.ESPERANDO);
            return;
        }

        productoObjetivo = encontrado.producto;

        productoOriginal = {
            parent: encontrado.producto.parent,
            posicion: encontrado.producto.position.clone(),
            quaternion: encontrado.producto.quaternion.clone(),
            escala: encontrado.producto.scale.clone()
        };

        productoEsInferior =
            encontrado.producto.getWorldPosition(
                new THREE.Vector3()
            ).y < config.alturaEstanteInferior;

        objetivo = encontrado.frente;

        if (!establecerRuta(encontrado.frente)) {
            liberarReserva();
            cambiarEstado(ESTADOS.ESPERANDO);
            return;
        }

        cambiarEstado(ESTADOS.ACERCANDO);
    }

    function tomarProducto() {
        if (!productoObjetivo) {
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        if (!productoDisponible(productoObjetivo)) {
            liberarReserva();
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        const producto = productoObjetivo;

        productosExaminados.add(producto);

        if (!iniciarAnimacionAgarre(producto)) {
            liberarReserva();
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        cambiarEstado(ESTADOS.INSPECCIONANDO);
        tiempoEstado = 0;
    }

    // ========================================================
    // DEVOLVER PRODUCTO AL ESTANTE ORIGINAL
    // ========================================================

    function obtenerPosicionOriginalProducto() {
        if (!productoObjetivo || !productoOriginal) {
            return null;
        }

        const posicion = productoOriginal.posicion.clone();

        if (productoOriginal.parent) {
            productoOriginal.parent.updateWorldMatrix(true, false);
            productoOriginal.parent.localToWorld(posicion);
        }

        return posicion;
    }

    function obtenerParentOriginal() {
        if (
            productoOriginal?.parent &&
            productoOriginal.parent !== grupo
        ) {
            return productoOriginal.parent;
        }

        return scene;
    }

    function devolverProductoAlEstante() {
        if (!productoEnMano || !productoOriginal) return false;

        const producto = productoEnMano;
        const parentDestino = obtenerParentOriginal();

        if (!parentDestino) return false;

        producto.updateWorldMatrix(true, false);

        // Pasar al padre original conservando transformación mundial.
        parentDestino.attach(producto);

        animacionProducto.activa = true;
        animacionProducto.tipo = 'devolver-original';
        animacionProducto.tiempo = 0;
        animacionProducto.duracion = Math.max(
            config.tiempoDevolver,
            0.1
        );

        animacionProducto.posicionInicial.copy(producto.position);
        animacionProducto.quaternionInicial.copy(producto.quaternion);
        animacionProducto.escalaInicial.copy(producto.scale);

        animacionProducto.posicionFinal.copy(
            productoOriginal.posicion
        );

        animacionProducto.quaternionFinal.copy(
            productoOriginal.quaternion
        );

        animacionProducto.escalaFinal.copy(
            productoOriginal.escala
        );

        producto.userData.enMano = false;
        delete producto.userData.clienteEnMano;

        return true;
    }

    // ========================================================
    // SOLTAR PRODUCTO EN OTRO RACK
    // ========================================================

    function soltarProductoEnDestino() {
        if (!productoEnMano) return false;

        const producto = productoEnMano;
        const destino = producto.userData.destinoDevolucion;

        if (!destino) return false;

        const parentDestino = productoOriginal?.parent || scene;

        producto.updateWorldMatrix(true, false);

        const posicionMundo = producto.getWorldPosition(
            new THREE.Vector3()
        );

        const quaternionMundo = producto.getWorldQuaternion(
            new THREE.Quaternion()
        );

        const escalaMundo = producto.getWorldScale(
            new THREE.Vector3()
        );

        parentDestino.attach(producto);

        const puntoMundo = new THREE.Vector3(
            destino.x,
            posicionMundo.y,
            destino.z
        );

        parentDestino.updateWorldMatrix(true, false);

        const puntoLocal = parentDestino.worldToLocal(
            puntoMundo.clone()
        );

        const quaternionPadre = parentDestino.getWorldQuaternion(
            new THREE.Quaternion()
        );

        const escalaPadre = parentDestino.getWorldScale(
            new THREE.Vector3()
        );

        const quaternionLocal = quaternionPadre
            .invert()
            .multiply(quaternionMundo);

        const escalaLocal = new THREE.Vector3(
            escalaMundo.x / Math.max(escalaPadre.x, 0.0001),
            escalaMundo.y / Math.max(escalaPadre.y, 0.0001),
            escalaMundo.z / Math.max(escalaPadre.z, 0.0001)
        );

        animacionProducto.activa = true;
        animacionProducto.tipo = 'soltar-otro-rack';
        animacionProducto.tiempo = 0;
        animacionProducto.duracion = Math.max(
            config.tiempoDevolver,
            0.1
        );

        animacionProducto.posicionInicial.copy(producto.position);
        animacionProducto.posicionFinal.copy(puntoLocal);

        animacionProducto.quaternionInicial.copy(producto.quaternion);
        animacionProducto.quaternionFinal.copy(quaternionLocal);

        animacionProducto.escalaInicial.copy(producto.scale);
        animacionProducto.escalaFinal.copy(escalaLocal);

        producto.userData.enMano = false;
        delete producto.userData.clienteEnMano;

        return true;
    }

    // ========================================================
    // FINALIZAR DEVOLUCIÓN
    // ========================================================

    function finalizarDevolucionProducto() {
        if (!productoEnMano) {
            animacionProducto.activa = false;
            return;
        }

        const producto = productoEnMano;
        const tipo = animacionProducto.tipo;

        if (tipo === 'devolver-original') {
            const parentOriginal = productoOriginal?.parent || scene;

            parentOriginal.attach(producto);

            producto.position.copy(productoOriginal.posicion);
            producto.quaternion.copy(productoOriginal.quaternion);
            producto.scale.copy(productoOriginal.escala);

            delete producto.userData.rackReubicado;
        } else if (tipo === 'soltar-otro-rack') {
            // Se conserva la nueva ubicación del producto.
            producto.userData.rackReubicado =
                producto.userData.rackReubicado ||
                `reubicado:${id}`;

            producto.userData.reubicadoPorCliente = id;
        }

        producto.userData.enMano = false;

        delete producto.userData.clienteEnMano;
        delete producto.userData.destinoDevolucion;
        delete producto.userData.enProcesoDeDevolucion;

        productoEnMano = null;
        productoObjetivo = null;
        productoOriginal = null;

        animacionProducto.activa = false;
        animacionProducto.tipo = null;
        animacionAgarre.activa = false;

        liberarReserva();
    }

    // ========================================================
    // ACTUALIZAR ANIMACIÓN DEL PRODUCTO
    // ========================================================

    function actualizarAnimacionProducto(delta) {
        if (!animacionProducto.activa || !productoEnMano) {
            return;
        }

        const producto = productoEnMano;

        animacionProducto.tiempo += delta;

        const progreso = limitar(
            animacionProducto.tiempo /
                Math.max(animacionProducto.duracion, 0.01),
            0,
            1
        );

        const t = suavizar(progreso);

        animacionProducto.posicionTemporal.lerpVectors(
            animacionProducto.posicionInicial,
            animacionProducto.posicionFinal,
            t
        );

        animacionProducto.quaternionTemporal.slerpQuaternions(
            animacionProducto.quaternionInicial,
            animacionProducto.quaternionFinal,
            t
        );

        escalaTemporal.lerpVectors(
            animacionProducto.escalaInicial,
            animacionProducto.escalaFinal,
            t
        );

        producto.position.copy(
            animacionProducto.posicionTemporal
        );

        producto.quaternion.copy(
            animacionProducto.quaternionTemporal
        );

        producto.scale.copy(escalaTemporal);

        if (progreso >= 1) {
            producto.position.copy(animacionProducto.posicionFinal);
            producto.quaternion.copy(animacionProducto.quaternionFinal);
            producto.scale.copy(animacionProducto.escalaFinal);

            finalizarDevolucionProducto();
        }
    }

    // ========================================================
    // DECISIÓN DE COMPRA
    // ========================================================

    function decidirCompra() {
        if (!productoEnMano) {
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        const compra = Math.random() <= config.probabilidadCompra;

        if (compra) {
            decisionCompra = true;
            cambiarEstado(ESTADOS.GUARDANDO);
            return;
        }

        decisionCompra = false;

        const devolverEnOtroRack =
            Math.random() < config.probabilidadDejarEnOtroRack;

        if (devolverEnOtroRack) {
            prepararDevolucionEnOtroRack();
        } else {
            prepararDevolucionOriginal();
        }
    }

    function prepararDevolucionOriginal() {
        if (!productoEnMano) {
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        const posicion = obtenerPosicionOriginalProducto();

        if (!posicion) {
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        const frente = obtenerPuntoFrenteProducto(productoObjetivo);

        if (!frente || !establecerRuta(frente)) {
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        productoEnMano.userData.destinoDevolucion = {
            x: posicion.x,
            z: posicion.z
        };

        productoEnMano.userData.enProcesoDeDevolucion = true;

        cambiarEstado(ESTADOS.DEVOLVIENDO);
    }

    function prepararDevolucionEnOtroRack() {
        if (!productoEnMano) {
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        const productos = obtenerListaProductos();

        let candidato = null;
        let mejorDistancia = Infinity;

        const posicionActual = grupo.position;

        for (const producto of productos) {
            if (
                !producto?.isObject3D ||
                producto === productoObjetivo ||
                !producto.visible ||
                producto.userData?.enCarrito ||
                producto.userData?.enMano
            ) continue;

            const posicion = producto.getWorldPosition(
                new THREE.Vector3()
            );

            const distancia = distanciaXZ(
                posicionActual,
                posicion
            );

            if (distancia < mejorDistancia && distancia > 2) {
                const punto = obtenerPuntoFrenteProducto(producto);

                if (!punto) continue;

                candidato = {
                    punto,
                    producto,
                    posicion
                };

                mejorDistancia = distancia;
            }
        }

        if (!candidato) {
            prepararDevolucionOriginal();
            return;
        }

        productoEnMano.userData.destinoDevolucion = {
            x: candidato.posicion.x,
            z: candidato.posicion.z
        };

        productoEnMano.userData.rackReubicado =
            obtenerClaveRack(candidato.producto);

        productoEnMano.userData.enProcesoDeDevolucion = true;

        if (!establecerRuta(candidato.punto)) {
            delete productoEnMano.userData.rackReubicado;
            prepararDevolucionOriginal();
            return;
        }

        cambiarEstado(ESTADOS.DEVOLVIENDO);
    }
        // ========================================================
    // GUARDAR PRODUCTO EN CARRITO
    // ========================================================

    function guardarProducto() {
        if (!productoEnMano) {
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        const producto = productoEnMano;
        let agregado = false;

        try {
            if (config.carrito) {
                if (
                    typeof config.carrito.agregarProducto === 'function'
                ) {
                    agregado =
                        config.carrito.agregarProducto(producto) !== false;
                } else if (
                    typeof config.carrito.agregar === 'function'
                ) {
                    agregado =
                        config.carrito.agregar(producto) !== false;
                }
            }
        } catch (error) {
            console.error(
                `[CLIENTE ${id}] Error agregando producto al carrito:`,
                error
            );
        }

        if (!agregado) {
            console.warn(
                `[CLIENTE ${id}] No se pudo agregar el producto al carrito.`
            );

            prepararDevolucionOriginal();
            return;
        }

        producto.userData.enMano = false;
        producto.userData.enCarrito = true;

        delete producto.userData.clienteEnMano;
        delete producto.userData.enProcesoDeDevolucion;

        const registro = {
            nombre: obtenerNombreProducto(producto),
            codigo: producto.userData?.codigoProducto ?? null,
            precio: numero(producto.userData?.precio, 0),
            producto
        };

        compras.push(registro);

        try {
            config.alComprar?.({
                cliente: api,
                producto,
                compra: registro,
                totalProductos: compras.length
            });
        } catch (error) {
            console.error(error);
        }

        productoEnMano = null;
        productoObjetivo = null;
        productoOriginal = null;

        animacionAgarre.activa = false;
        animacionProducto.activa = false;

        liberarReserva();

        if (compras.length >= config.maximoProductos) {
            iniciarRutaCaja();
        } else {
            cambiarEstado(ESTADOS.BUSCANDO);
        }
    }

    // ========================================================
    // CAJA Y COMPRA
    // ========================================================

    function iniciarRutaCaja() {
        detenerMovimiento();

        const caja = {
            x: numero(config.posicionCaja.x),
            z: numero(config.posicionCaja.z)
        };

        if (!establecerRuta(caja)) {
            cambiarEstado(ESTADOS.ESPERANDO);
            return;
        }

        cambiarEstado(ESTADOS.CAJA);
    }

    function calcularTotal() {
        return compras.reduce(
            (total, compra) => total + numero(compra.precio),
            0
        );
    }

    function generarTicket() {
        return {
            clienteId: id,
            productos: compras.map(compra => ({
                nombre: compra.nombre,
                codigo: compra.codigo,
                precio: compra.precio
            })),
            cantidad: compras.length,
            subtotal: calcularTotal(),
            total: calcularTotal(),
            fecha: new Date()
        };
    }

    function iniciarPago() {
        if (!compras.length) {
            finalizarCompra();
            return;
        }

        ticketPendiente = generarTicket();

        detenerMovimiento();
        cambiarEstado(ESTADOS.PAGANDO);

        try {
            config.alPagar?.({
                cliente: api,
                ticket: ticketPendiente,
                total: ticketPendiente.total,
                productos: ticketPendiente.productos
            });
        } catch (error) {
            console.error(
                `[CLIENTE ${id}] Error en callback de pago:`,
                error
            );
        }
    }

    function confirmarPago(resultado = true) {
        if (estado !== ESTADOS.PAGANDO) return false;

        if (resultado === false) {
            console.warn(
                `[CLIENTE ${id}] El pago no fue aprobado.`
            );

            cambiarEstado(ESTADOS.ESPERANDO);
            return false;
        }

        for (const compra of compras) {
            if (compra.producto) {
                compra.producto.userData.vendido = true;
            }
        }

        finalizarCompra();

        return true;
    }

    function finalizarCompra() {
        const ticket = ticketPendiente || generarTicket();

        try {
            config.alFinalizar?.({
                cliente: api,
                ticket,
                compras: [...compras],
                total: ticket.total
            });
        } catch (error) {
            console.error(
                `[CLIENTE ${id}] Error al finalizar compra:`,
                error
            );
        }

        ticketPendiente = null;

        if (callbackRegreso) {
            iniciarRegresoVehiculo();
        } else {
            cambiarEstado(ESTADOS.FINALIZADO);
        }
    }

    // ========================================================
    // ENTRADA Y SALIDA DEL SUPERMERCADO
    // ========================================================

    function iniciarEntrada() {
        const entrada = {
            x: config.puertaCentroX,
            z: config.puertaZInterior
        };

        if (!establecerRuta(entrada)) {
            cambiarEstado(ESTADOS.ESPERANDO);
            return false;
        }

        cambiarEstado(ESTADOS.ENTRANDO);

        return true;
    }

    function notificarEntrada() {
        if (entradaNotificada) return;

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

    function iniciarDesdeVehiculo(posicion = null) {
        if (eliminado) return false;

        detenerMovimiento();
        liberarReserva();

        if (productoEnMano) {
            const producto = productoEnMano;

            if (productoOriginal?.parent) {
                productoOriginal.parent.attach(producto);

                producto.position.copy(productoOriginal.posicion);
                producto.quaternion.copy(productoOriginal.quaternion);
                producto.scale.copy(productoOriginal.escala);
            } else {
                scene.attach(producto);
            }

            producto.userData.enMano = false;

            delete producto.userData.clienteEnMano;
            delete producto.userData.enProcesoDeDevolucion;

            productoEnMano = null;
        }

        animacionAgarre.activa = false;
        animacionProducto.activa = false;

        compras = [];

        productosExaminados.clear();
        racksVisitados.clear();

        productoObjetivo = null;
        productoOriginal = null;
        productoEsInferior = false;

        entradaNotificada = false;
        tiempoEstado = 0;
        intentosMovimiento = 0;
        decisionCompra = true;

        callbackRegreso = null;
        callbackPagoPendiente = null;
        ticketPendiente = null;

        restaurarPoseCompleta();

        if (posicion) {
            grupo.position.set(
                numero(posicion.x),
                numero(posicion.y),
                numero(posicion.z)
            );
        }

        return iniciarEntrada();
    }

    function iniciarRegresoVehiculo(callback = null) {
        if (eliminado) return false;

        callbackRegreso = callback || callbackRegreso;

        detenerMovimiento();

        const salida = {
            x: config.puertaCentroX,
            z: config.puertaZExterior
        };

        if (!establecerRuta(salida)) {
            cambiarEstado(ESTADOS.ESPERANDO);
            return false;
        }

        cambiarEstado(ESTADOS.REGRESANDO);

        return true;
    }

    function terminarRegresoVehiculo() {
        cambiarEstado(ESTADOS.FINALIZADO);

        if (typeof callbackRegreso === 'function') {
            try {
                callbackRegreso(api);
            } catch (error) {
                console.error(error);
            }
        }

        callbackRegreso = null;
    }

    // ========================================================
    // REINTENTAR BÚSQUEDA
    // ========================================================

    function reintentarBusqueda(delta) {
        if (tiempoEstado < config.tiempoReintento) {
            return;
        }

        tiempoEstado = 0;

        if (productosExaminados.size > 12) {
            productosExaminados.clear();
        }

        const encontrado = buscarProductoDisponible();

        if (encontrado) {
            productoObjetivo = encontrado.producto;

            productoOriginal = {
                parent: encontrado.producto.parent,
                posicion: encontrado.producto.position.clone(),
                quaternion: encontrado.producto.quaternion.clone(),
                escala: encontrado.producto.scale.clone()
            };

            objetivo = encontrado.frente;

            if (establecerRuta(encontrado.frente)) {
                cambiarEstado(ESTADOS.ACERCANDO);
            }
        }
    }

    // ========================================================
    // CONTROL DE ESTADOS
    // ========================================================

    function actualizarEstados(delta) {
        tiempoEstado += delta;

        switch (estado) {
            case ESTADOS.INACTIVO: {
                animarReposo(delta);
                break;
            }

            case ESTADOS.ENTRANDO: {
                animarCaminar(delta);

                const llego = moverHaciaDestino(
                    delta,
                    {
                        x: config.puertaCentroX,
                        z: config.puertaZInterior
                    },
                    config.velocidadEntrada
                );

                if (llego) {
                    notificarEntrada();
                    cambiarEstado(ESTADOS.BUSCANDO);
                }

                break;
            }

            case ESTADOS.BUSCANDO: {
                animarReposo(delta);

                if (tiempoEstado >= config.tiempoEntreProductos) {
                    tiempoEstado = 0;
                    iniciarBusqueda();
                }

                break;
            }

            case ESTADOS.ACERCANDO: {
                animarCaminar(delta);

                if (
                    !productoObjetivo ||
                    !productoDisponible(productoObjetivo)
                ) {
                    liberarReserva();
                    cambiarEstado(ESTADOS.BUSCANDO);
                    break;
                }

                const frente = obtenerPuntoFrenteProducto(
                    productoObjetivo
                );

                if (!frente) {
                    liberarReserva();
                    cambiarEstado(ESTADOS.ESPERANDO);
                    break;
                }

                const llego = moverHaciaDestino(
                    delta,
                    frente,
                    config.velocidad
                );

                if (llego) {
                    const posicionProducto =
                        productoObjetivo.getWorldPosition(
                            new THREE.Vector3()
                        );

                    orientarHacia(
                        posicionProducto.x,
                        posicionProducto.z,
                        12,
                        delta
                    );

                    cambiarEstado(ESTADOS.RECOGIENDO);
                }

                break;
            }

            case ESTADOS.RECOGIENDO: {
                animarRecogida(delta);

                if (tiempoEstado >= config.tiempoRecoger) {
                    tomarProducto();
                }

                break;
            }

            case ESTADOS.INSPECCIONANDO: {
                animarInspeccion(delta);

                if (animacionAgarre.activa) break;

                if (tiempoEstado >= config.tiempoInspeccionar) {
                    cambiarEstado(ESTADOS.DECIDIENDO);
                }

                break;
            }

            case ESTADOS.DECIDIENDO: {
                animarInspeccion(delta);

                if (tiempoEstado >= 0.45) {
                    decidirCompra();
                }

                break;
            }

            case ESTADOS.GUARDANDO: {
                animarGuardar(delta);

                if (tiempoEstado >= config.tiempoGuardar) {
                    guardarProducto();
                }

                break;
            }

            case ESTADOS.DEVOLVIENDO: {
                animarDevolucion(delta);

                if (
                    !ruta.length &&
                    distanciaXZ(
                        grupo.position,
                        objetivo || grupo.position
                    ) > config.distanciaLlegada
                ) {
                    const destino = productoEnMano?.userData
                        ?.destinoDevolucion;

                    if (destino) {
                        const frente = obtenerPuntoFrenteProducto(
                            productoObjetivo
                        );

                        if (frente) establecerRuta(frente);
                    }
                }

                if (tiempoEstado >= config.tiempoDevolver) {
                    if (productoEnMano && !animacionProducto.activa) {
                        const destino =
                            productoEnMano.userData.destinoDevolucion;

                        if (destino) {
                            const posicionOriginal =
                                obtenerPosicionOriginalProducto();

                            const esOriginal =
                                posicionOriginal &&
                                Math.abs(
                                    destino.x - posicionOriginal.x
                                ) < 0.05 &&
                                Math.abs(
                                    destino.z - posicionOriginal.z
                                ) < 0.05;

                            if (esOriginal) {
                                devolverProductoAlEstante();
                            } else {
                                soltarProductoEnDestino();
                            }
                        }
                    }
                }

                if (
                    !productoEnMano &&
                    !animacionProducto.activa
                ) {
                    productoOriginal = null;
                    cambiarEstado(ESTADOS.BUSCANDO);
                }

                break;
            }

            case ESTADOS.ESPERANDO: {
                animarReposo(delta);
                reintentarBusqueda(delta);
                break;
            }

            case ESTADOS.RUTA: {
                animarCaminar(delta);

                if (!objetivo) {
                    cambiarEstado(ESTADOS.BUSCANDO);
                    break;
                }

                if (
                    moverHaciaDestino(
                        delta,
                        objetivo,
                        config.velocidad
                    )
                ) {
                    cambiarEstado(ESTADOS.BUSCANDO);
                }

                break;
            }

            case ESTADOS.CAJA: {
                animarCaminar(delta);

                const llego = moverHaciaDestino(
                    delta,
                    {
                        x: config.posicionCaja.x,
                        z: config.posicionCaja.z
                    },
                    config.velocidad
                );

                if (llego) {
                    orientarHacia(
                        config.posicionCaja.x,
                        config.posicionCaja.z + 1,
                        10,
                        delta
                    );

                    iniciarPago();
                }

                break;
            }

            case ESTADOS.PAGANDO: {
                animarPago(delta);

                if (
                    !config.alPagar &&
                    tiempoEstado >= 2.5
                ) {
                    confirmarPago(true);
                }

                break;
            }

            case ESTADOS.REGRESANDO: {
                animarCaminar(delta);

                const llego = moverHaciaDestino(
                    delta,
                    {
                        x: config.puertaCentroX,
                        z: config.puertaZExterior
                    },
                    config.velocidadRegreso
                );

                if (llego) {
                    terminarRegresoVehiculo();
                }

                break;
            }

            case ESTADOS.FINALIZADO: {
                animarReposo(delta);
                break;
            }
        }
    }

    // ========================================================
    // ACTUALIZACIÓN PRINCIPAL
    // ========================================================

    function actualizar(delta = 1 / 60) {
        if (eliminado || detenido) return;

        delta = limitar(
            numero(delta, 1 / 60),
            0,
            0.05
        );

        if (!cargado) return;

        tiempoActualizarObstaculos += delta;

        if (tiempoActualizarObstaculos >= 1.2) {
            actualizarColisiones();
        }

        if (mixer) {
            mixer.update(delta);
        }

        if (animacionAgarre.activa) {
            const agarreTerminado =
                actualizarAnimacionAgarre(delta);

            if (
                agarreTerminado &&
                estado === ESTADOS.INSPECCIONANDO
            ) {
                tiempoEstado = 0;
            }
        }

        if (animacionProducto.activa) {
            actualizarAnimacionProducto(delta);
        }

        actualizarEstados(delta);
    }

    // ========================================================
    // CONTROL DE ANIMACIONES EXTERNO
    // ========================================================

    function detenerAnimacion() {
        detenido = true;

        detenerAccionesGLB();

        if (mixer) {
            mixer.timeScale = 0;
        }
    }

    function reproducirAnimacion() {
        detenido = false;

        if (mixer) {
            mixer.timeScale = 1;
        }

        if (
            estado === ESTADOS.BUSCANDO ||
            estado === ESTADOS.ESPERANDO ||
            estado === ESTADOS.INACTIVO
        ) {
            activarReposoGLB();
        } else {
            activarCaminarGLB();
        }
    }

    // ========================================================
    // CONFIGURAR COMPRAS
    // ========================================================

    function configurarCompras(opciones = {}) {
        Object.assign(config, opciones);

        config.tiempoRecoger = Math.max(
            0.05,
            numero(config.tiempoRecoger, 1.1)
        );

        config.tiempoInspeccionar = Math.max(
            0.05,
            numero(config.tiempoInspeccionar, 2.2)
        );

        config.tiempoGuardar = Math.max(
            0.05,
            numero(config.tiempoGuardar, 1.4)
        );

        config.tiempoDevolver = Math.max(
            0.05,
            numero(config.tiempoDevolver, 1.4)
        );

        config.tiempoAnimacionAgarre = Math.max(
            0.05,
            numero(config.tiempoAnimacionAgarre, 0.38)
        );

        config.distanciaMaximaBusqueda = Math.max(
            1,
            numero(config.distanciaMaximaBusqueda, 40)
        );

        config.probabilidadCompra = limitar(
            numero(config.probabilidadCompra, 0.85),
            0,
            1
        );

        config.probabilidadDejarEnOtroRack = limitar(
            numero(config.probabilidadDejarEnOtroRack, 0.22),
            0,
            1
        );

        config.maximoProductos = Math.max(
            1,
            Math.floor(numero(config.maximoProductos, 4))
        );

        animacionAgarre.duracion =
            config.tiempoAnimacionAgarre;

        return api;
    }

    // ========================================================
    // OBTENER INFORMACIÓN
    // ========================================================

    function obtenerObjetivo() {
        return objetivo
            ? { ...objetivo }
            : null;
    }

    function obtenerCompras() {
        return compras.map(compra => ({
            nombre: compra.nombre,
            codigo: compra.codigo,
            precio: compra.precio
        }));
    }

    function obtenerResumen() {
        return {
            id,
            estado,
            cargado,
            eliminado,
            detenido,
            productos: compras.length,
            total: calcularTotal(),

            posicion: {
                x: grupo.position.x,
                y: grupo.position.y,
                z: grupo.position.z
            },

            productoEnMano: productoEnMano
                ? obtenerNombreProducto(productoEnMano)
                : null
        };
    }

    function obtenerEstado() {
        return estado;
    }

    // ========================================================
    // ELIMINAR CLIENTE
    // ========================================================

    function eliminar() {
        if (eliminado) return;

        eliminado = true;

        detenerMovimiento();
        liberarReserva();

        if (productoEnMano) {
            const producto = productoEnMano;

            if (productoOriginal?.parent) {
                productoOriginal.parent.attach(producto);

                producto.position.copy(productoOriginal.posicion);
                producto.quaternion.copy(productoOriginal.quaternion);
                producto.scale.copy(productoOriginal.escala);
            } else {
                scene.attach(producto);
            }

            producto.userData.enMano = false;

            delete producto.userData.clienteEnMano;
            delete producto.userData.enProcesoDeDevolucion;

            productoEnMano = null;
        }

        animacionAgarre.activa = false;
        animacionProducto.activa = false;

        if (mixer) {
            mixer.stopAllAction();

            if (modelo) {
                mixer.uncacheRoot(modelo);
            }
        }

        detenerAccionesGLB();

        if (grupo.parent) {
            grupo.parent.remove(grupo);
        }

        grupo.traverse(obj => {
            if (!obj.isMesh) return;

            if (obj.geometry) {
                obj.geometry.dispose();
            }

            // No destruir materiales compartidos de otros modelos.
        });

        console.log(`[CLIENTE ${id}] Eliminado.`);
    }

    // ========================================================
    // API PÚBLICA
    // ========================================================

    const api = {
        grupo,

        actualizar,

        establecerRuta(destino) {
            return establecerRuta(destino, true);
        },

        establecerPosicion(x, y = 0, z = 0) {
            grupo.position.set(
                numero(x),
                numero(y),
                numero(z)
            );

            detenerMovimiento();

            return api;
        },

        configurarCompras,

        detenerAnimacion,
        reproducirAnimacion,

        iniciarDesdeVehiculo,
        iniciarRegresoVehiculo,

        iniciarPago,
        confirmarPago,

        obtenerObjetivo,
        obtenerCompras,
        obtenerResumen,
        obtenerEstado,

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
        },

        get id() {
            return id;
        },

        get ticket() {
            return ticketPendiente;
        },

        get total() {
            return calcularTotal();
        }
    };

    actualizarColisiones();

    return api;
}
