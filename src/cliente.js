// Archivos modificados durante esta tarea: src/cliente.js, src/vehiculos.js, src/main.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';





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




const CONFIG_BASE = {
    modelo: '/modelos/Cliente2.glb',
    posicion: { x: 0, y: 0, z: 20 },

    
    altura: 1.75,
    escala: 1,

    
    velocidad: 2.9,
    velocidadEntrada: 2.5,
    velocidadRegreso: 2.7,

    
    aceleracion: 5.5,
    aceleracionMovimiento: 5.5,
    suavizadoGiro: 9.0,

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
    variarComportamiento: true,

    
    distanciaProducto: 1.35,
    distanciaFrenteProducto: 1.25,

    
    tiempoRecoger: 1.5,
    progresoContactoProducto: 0.70,
    tiempoInspeccionar: 2.8,
    tiempoGuardar: 1.4,
    tiempoDevolver: 1.4,
    tiempoEntreProductos: 0.8,
    tiempoReintento: 1.5,

    
    tiempoAnimacionAgarre: 0.40,
    escalaProductoMano: 1,

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

    
    soloPlatanos: false,
    nombreProductoBuscado: '',

    
    separacionProductoRack: 0.06,
    alturaMovimientoProducto: 0.12,

    
    intervaloRecalculoRuta: 0.55,
    tiempoMaximoAtasco: 3.5,
    maximosIntentosMovimiento: 5,
    distanciaRecalculo: 0.45,

    
    distanciaLlegada: 0.16,
    distanciaWaypoint: 0.30,

    
    usarAnimacionesGLB: true,
    velocidadAnimacionGLB: 1.5,

    
    repetirRuta: false,
    inactivo: false,

    
    productos: null,
    carrito: null,
    mobiliario: null,
    colisiones: null,

    
    posicionCaja: {
        x: 0,
        z: 22.5
    },

    
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

    const idGenerado = siguienteIdCliente++;
    const id = config.id ?? idGenerado;
    const variacionVelocidad = config.variarComportamiento
        ? 0.92 + Math.random() * 0.16
        : 1;
    const variacionInspeccion = config.variarComportamiento
        ? 0.85 + Math.random() * 0.30
        : 1;
    const variacionEspera = config.variarComportamiento
        ? 0.75 + Math.random() * 0.50
        : 1;

    const grupo = new THREE.Group();
    grupo.name = `CLIENTE_SUPERMERCADO_${id}`;

    grupo.position.set(
        numero(config.posicion.x),
        numero(config.posicion.y),
        numero(config.posicion.z)
    );

    grupo.rotation.y = numero(config.correccionRotacion);

    grupo.userData.tipo = 'CLIENTE_SUPERMERCADO';
    grupo.userData.id = id;

    scene.add(grupo);

    let modelo = null;
    let mixer = null;

    let accionCaminar = null;
    let accionReposo = null;

    let cargado = false;
    let eliminado = false;
    let detenido = Boolean(config.inactivo);

    let estado = ESTADOS.INACTIVO;
    let tiempoEstado = 0;
    let tiempoIdle = 0;
    let tiempoInspeccionActual =
        config.tiempoInspeccionar * variacionInspeccion;
    let pausaBusquedaActual =
        config.tiempoEntreProductos * variacionEspera;

    let velocidadActual = 0;
    let movimientoSuave = 0;
    let faseAnimacion = 0;

    let intensidadGiro = 0;
    let inclinacionTorsoObjetivo = 0;
    let inclinacionCabezaObjetivo = 0;
    let giroCabezaObjetivo = 0;

    let productoObjetivo = null;
    let productoEnMano = null;
    let productoOriginal = null;

    let productoEsInferior = false;

    let rackReservado = null;

    let compras = [];

    let decisionCompra = false;

    let callbackPagoPendiente = null;
    let callbackRegreso = null;

    let ticketPendiente = null;

    let entradaNotificada = false;

    let tiempoActualizarObstaculos = 0;
    let tiempoRecalculoRuta = 0;
    let tiempoSinMovimiento = 0;

    const ultimaPosicionMovimiento = new THREE.Vector3();

    let ruta = [];
    let indiceRuta = 0;
    let objetivo = null;

    const productosExaminados = new Set();
    const productosConRutaFallida = new Set();
    const racksVisitados = new Set();

    const obstaculos = [];
    const celdasOcupadas = new Set();

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
    const matrizTemporal = new THREE.Matrix4();

    
    
    

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
        quaternionPadreTemporal: new THREE.Quaternion(),
        escalaLocalTemporal: new THREE.Vector3(),
        matrizMundoTemporal: new THREE.Matrix4(),
        matrizLocalTemporal: new THREE.Matrix4()
    };

    
    
    

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

    
    
    

    function productoEstaEnEstanteInferior(producto) {
        if (!producto) return false;

        producto.updateMatrixWorld(true);

        cajaTemporal.setFromObject(producto);

        if (cajaTemporal.isEmpty()) return false;

        const alturaCentro =
            (cajaTemporal.min.y + cajaTemporal.max.y) / 2;

        return alturaCentro < config.alturaEstanteInferior;
    }

    
    
    

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

    
    
    

    function animarRecogerProcedural() {
        const progreso = limitar(
            tiempoEstado / Math.max(config.tiempoRecoger, 0.01),
            0,
            1
        );

        const contactoObjetivo = limitar(
            numero(config.progresoContactoProducto, 0.78),
            0.55,
            0.88
        );

        const acercarse = suavizar(
            limitar(progreso / contactoObjetivo, 0, 1)
        );

        const contacto = suavizar(
            limitar(
                (progreso - contactoObjetivo) /
                Math.max(1 - contactoObjetivo, 0.12),
                0,
                1
            )
        );

        const retirada = suavizar(
            Math.max(0, Math.min(progreso, 1))
        );

        const agachado = productoEsInferior ? 1 : 0;

        
        animarAgacharse(
            agachado * suavizar(progreso * 1.35)
        );

        let cercaniaReal = acercarse;

        
        if (productoObjetivo && rig.manoDerecha) {
            grupo.updateMatrixWorld(true);
            rig.manoDerecha.updateWorldMatrix(true, true);
            productoObjetivo.updateMatrixWorld(true);

            const palma = rig.manoDerecha.localToWorld(
                new THREE.Vector3(
                    numero(config.offsetProductoMano.x),
                    numero(config.offsetProductoMano.y),
                    numero(config.offsetProductoMano.z)
                )
            );

            const productoCentro = new THREE.Vector3();

            cajaTemporal.setFromObject(productoObjetivo);

            if (!cajaTemporal.isEmpty()) {
                cajaTemporal.getCenter(productoCentro);

                cercaniaReal = THREE.MathUtils.lerp(
                    acercarse,
                    1 - limitar(
                        palma.distanceTo(productoCentro) / 1.5,
                        0,
                        1
                    ),
                    0.35
                );
            }
        }

        cercaniaReal = suavizar(
            limitar(cercaniaReal, 0, 1)
        );

        
        const hombro = THREE.MathUtils.lerp(
            -0.08,
            -1.08 * (productoEsInferior ? 0.72 : 1),
            cercaniaReal
        );

        const antebrazo = THREE.MathUtils.lerp(
            -0.08,
            -0.78,
            cercaniaReal
        );

        aplicarRotacionEuler(
            rig.brazoDerecho,
            hombro,
            -0.06 * cercaniaReal,
            0.08 * cercaniaReal
        );

        aplicarRotacionEuler(
            rig.antebrazoDerecho,
            antebrazo,
            -0.12 * cercaniaReal,
            0.06 * cercaniaReal
        );

        
        aplicarRotacionEuler(
            rig.manoDerecha,
            -0.18 - contacto * 0.58,
            contacto * 0.08,
            -0.18 * contacto
        );

        
        aplicarRotacionEuler(
            rig.brazoIzquierdo,
            -0.12 - 0.22 * retirada,
            0,
            0.06 * retirada
        );

        aplicarRotacionEuler(
            rig.antebrazoIzquierdo,
            -0.12 - 0.28 * retirada,
            0.04,
            -0.04
        );

        aplicarRotacion(
            rig.manoIzquierda,
            EJE_X,
            -0.08 - contacto * 0.16
        );

        
        aplicarRotacionEuler(
            rig.torso,
            0.08 * acercarse + 0.28 * agachado * acercarse,
            -0.10 * acercarse,
            -0.04 * acercarse
        );

        
        aplicarRotacionEuler(
            rig.cabeza,
            0.14 + 0.12 * acercarse +
                Math.sin(tiempoEstado * 2.1) * 0.018,
            -0.12 * acercarse,
            0.025 * Math.sin(tiempoEstado * 1.6)
        );

        aplicarRotacion(
            rig.cuello,
            EJE_X,
            0.08 + 0.08 * acercarse
        );
    }

    
    
    

    function animarInspeccionarProcedural() {
        const entrada = suavizar(Math.min(tiempoEstado / 0.55, 1));
        const salida = suavizar(Math.min((tiempoInspeccionActual - tiempoEstado) / 0.45, 1));
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

        aplicarRotacionEuler(rig.brazoIzquierdo, -0.20 - bajar * 0.30,
            0.08, -0.12);
        aplicarRotacionEuler(rig.antebrazoIzquierdo, -0.25 - bajar * 0.30,
            0.05, 0.12);

        aplicarRotacionEuler(rig.torso, 0.10 * bajar, 0, 0);
        aplicarRotacionEuler(rig.cabeza, 0.12 + Math.sin(tiempoEstado * 2) * 0.02,
            0.08, 0);
    }

    
    
    

    function animarDevolverProcedural() {
        const progreso = limitar(
            tiempoEstado / Math.max(config.tiempoDevolver, 0.01),
            0,
            1
        );

        const bajar = suavizar(
            limitar(progreso / 0.68, 0, 1)
        );

        const soltar = suavizar(
            limitar((progreso - 0.68) / 0.32, 0, 1)
        );

        aplicarRotacionEuler(
            rig.brazoDerecho,
            THREE.MathUtils.lerp(-0.92, -0.10, bajar),
            -0.08,
            0.08
        );

        aplicarRotacionEuler(
            rig.antebrazoDerecho,
            THREE.MathUtils.lerp(-0.85, -0.12, bajar),
            0,
            0.04
        );

        aplicarRotacionEuler(
            rig.manoDerecha,
            -0.25 + soltar * 0.18,
            0,
            0.08
        );

        aplicarRotacionEuler(
            rig.torso,
            0.12 * bajar,
            -0.04 * bajar,
            0
        );

        aplicarRotacionEuler(
            rig.cabeza,
            0.14 + 0.08 * bajar,
            -0.08,
            0
        );

        if (productoEsInferior) {
            animarAgacharse(1 - bajar);
        }
    }

    
    
    

    function animarPagarProcedural() {
        const movimiento = Math.sin(tiempoEstado * 3.2) * 0.035;
        const cabeza = Math.sin(tiempoEstado * 1.4) * 0.025;

        aplicarRotacionEuler(
            rig.brazoDerecho,
            -0.45 + movimiento,
            -0.08,
            0.12
        );

        aplicarRotacionEuler(
            rig.antebrazoDerecho,
            -0.55 + movimiento * 0.6,
            0,
            0.08
        );

        aplicarRotacionEuler(
            rig.manoDerecha,
            -0.18 + movimiento,
            0.04,
            0.12
        );

        aplicarRotacionEuler(
            rig.brazoIzquierdo,
            -0.40 - movimiento,
            0.08,
            -0.10
        );

        aplicarRotacionEuler(
            rig.antebrazoIzquierdo,
            -0.50 - movimiento * 0.5,
            0,
            -0.08
        );

        aplicarRotacionEuler(
            rig.cabeza,
            0.08 + cabeza,
            Math.sin(tiempoEstado * 0.8) * 0.08,
            0
        );

        aplicarRotacionEuler(
            rig.torso,
            0.025 + movimiento * 0.2,
            0,
            0
        );
    }

    
    
    

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

                modelo.position.set(0, 0, 0);

                modelo.rotation.y +=
                    numero(config.correccionRotacion);

                modelo.traverse(obj => {
                    if (obj.isMesh) {
                        obj.castShadow = true;
                        obj.receiveShadow = true;

                        if (obj.material) {
                            obj.material.side = THREE.FrontSide;
                        }
                    }
                });

                grupo.add(modelo);

                detectarHuesos(modelo);
                actualizarRig();

                if (gltf.animations?.length) {
                    mixer = new THREE.AnimationMixer(modelo);

                    const caminar = gltf.animations.find(animacion => {
                        const nombre = normalizarNombre(animacion.name);

                        return (
                            nombre.includes('walk') ||
                            nombre.includes('walking') ||
                            nombre.includes('caminar')
                        );
                    });

                    const reposo = gltf.animations.find(animacion => {
                        const nombre = normalizarNombre(animacion.name);

                        return (
                            nombre.includes('idle') ||
                            nombre.includes('stand') ||
                            nombre.includes('breath') ||
                            nombre.includes('reposo')
                        );
                    });

                    if (caminar) {
                        accionCaminar = mixer.clipAction(caminar);
                        accionCaminar.setLoop(
                            THREE.LoopRepeat,
                            Infinity
                        );
                    }

                    if (reposo) {
                        accionReposo = mixer.clipAction(reposo);
                        accionReposo.setLoop(
                            THREE.LoopRepeat,
                            Infinity
                        );
                    }
                }

                cargado = true;

                restaurarPoseCompleta();

                if (detenido) {
                    activarReposoGLB();
                } else {
                    activarReposoGLB();
                }

                console.log(
                    `[CLIENTE ${id}] Modelo cargado: ${config.modelo}`
                );
            },
            undefined,
            error => {
                console.error(
                    `[CLIENTE ${id}] Error cargando modelo ${config.modelo}:`,
                    error
                );
            }
        );
    }

    cargarModelo();

    
    
    

    function cambiarEstado(nuevoEstado) {
        if (estado === nuevoEstado) return;

        const anterior = estado;

        estado = nuevoEstado;
        tiempoEstado = 0;

        if (nuevoEstado === ESTADOS.INSPECCIONANDO) {
            tiempoInspeccionActual =
                config.tiempoInspeccionar * variacionInspeccion;
        } else if (nuevoEstado === ESTADOS.BUSCANDO) {
            pausaBusquedaActual =
                config.tiempoEntreProductos * variacionEspera;
        }

        actualizarSeguimientoCarrito(nuevoEstado);

        if (
            nuevoEstado === ESTADOS.ENTRANDO ||
            nuevoEstado === ESTADOS.ACERCANDO ||
            nuevoEstado === ESTADOS.RUTA ||
            nuevoEstado === ESTADOS.CAJA ||
            nuevoEstado === ESTADOS.REGRESANDO
        ) {
            activarCaminarGLB();
        } else {
            activarReposoGLB();
        }

        try {
            config.alCambiarEstado?.({
                cliente: api,
                anterior,
                nuevo: nuevoEstado
            });
        } catch (error) {
            console.error(
                `[CLIENTE ${id}] Error en alCambiarEstado:`,
                error
            );
        }
    }

    function actualizarSeguimientoCarrito(nuevoEstado) {
        const carrito = config.carrito;

        if (!carrito) return;

        const detener = [
            ESTADOS.INACTIVO,
            ESTADOS.RECOGIENDO,
            ESTADOS.INSPECCIONANDO,
            ESTADOS.DECIDIENDO,
            ESTADOS.GUARDANDO,
            ESTADOS.DEVOLVIENDO,
            ESTADOS.ESPERANDO,
            ESTADOS.PAGANDO,
            ESTADOS.FINALIZADO
        ].includes(nuevoEstado);

        if (detener) {
            carrito.detenerSeguimiento?.();
            return;
        }

        if (
            typeof carrito.seguirObjetivo === 'function' &&
            carrito.seguirObjetivo(grupo) === false
        ) {
            console.warn(
                `[CLIENTE ${id}] No se pudo reanudar el seguimiento del carrito.`
            );
        }
    }

    
    
    

    function obtenerObstaculosDesdeObjeto(objeto, salida = []) {
        if (!objeto) return salida;

        if (Array.isArray(objeto)) {
            for (const elemento of objeto) {
                obtenerObstaculosDesdeObjeto(elemento, salida);
            }
            return salida;
        }

        if (objeto.isObject3D) {
            objeto.updateMatrixWorld(true);

            objeto.traverse(elemento => {
                if (!elemento.isMesh || !elemento.visible) return;

                const caja = new THREE.Box3().setFromObject(elemento);

                if (caja.isEmpty()) return;

                const tamano = new THREE.Vector3();
                const centro = new THREE.Vector3();

                caja.getSize(tamano);
                caja.getCenter(centro);

                if (tamano.x < 0.12 || tamano.z < 0.12) return;

                salida.push({
                    x: centro.x,
                    z: centro.z,
                    ancho: tamano.x,
                    profundidad: tamano.z,
                    minX: caja.min.x,
                    maxX: caja.max.x,
                    minZ: caja.min.z,
                    maxZ: caja.max.z,
                    objeto: elemento
                });
            });

            return salida;
        }

        if (typeof objeto === 'object') {
            const minX = numero(objeto.minX, NaN);
            const maxX = numero(objeto.maxX, NaN);
            const minZ = numero(objeto.minZ, NaN);
            const maxZ = numero(objeto.maxZ, NaN);

            if (
                Number.isFinite(minX) &&
                Number.isFinite(maxX) &&
                Number.isFinite(minZ) &&
                Number.isFinite(maxZ)
            ) {
                salida.push({
                    x: (minX + maxX) / 2,
                    z: (minZ + maxZ) / 2,
                    ancho: maxX - minX,
                    profundidad: maxZ - minZ,
                    minX,
                    maxX,
                    minZ,
                    maxZ,
                    objeto
                });
                return salida;
            }

            const x = numero(objeto.x, NaN);
            const z = numero(objeto.z, NaN);

            if (!Number.isFinite(x) || !Number.isFinite(z)) {
                if (objeto.children) {
                    obtenerObstaculosDesdeObjeto(objeto.children, salida);
                }
                return salida;
            }

            const ancho = numero(
                objeto.ancho ?? objeto.width ?? objeto.sizeX,
                1
            );

            const profundidad = numero(
                objeto.profundidad ?? objeto.fondo ?? objeto.depth ?? objeto.sizeZ,
                1
            );

            salida.push({
                x,
                z,
                ancho,
                profundidad,
                minX: x - ancho / 2,
                maxX: x + ancho / 2,
                minZ: z - profundidad / 2,
                maxZ: z + profundidad / 2,
                objeto
            });
        }

        return salida;
    }

    function actualizarColisiones() {
        obstaculos.length = 0;
        celdasOcupadas.clear();

        const fuentes = [
            config.mobiliario,
            config.colisiones
        ];

        for (const fuente of fuentes) {
            obtenerObstaculosDesdeObjeto(fuente, obstaculos);
        }

        tiempoActualizarObstaculos = 0;

        return obstaculos.length;
    }

    function puntoLibre(x, z, radio = config.radioColision) {
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

        for (const obstaculo of obstaculos) {
            if (esObstaculoDeFachada(obstaculo)) continue;

            const minX = obstaculo.minX - config.margenObstaculos;
            const maxX = obstaculo.maxX + config.margenObstaculos;
            const minZ = obstaculo.minZ - config.margenObstaculos;
            const maxZ = obstaculo.maxZ + config.margenObstaculos;

            const cercanoX = limitar(x, minX, maxX);
            const cercanoZ = limitar(z, minZ, maxZ);

            const dx = x - cercanoX;
            const dz = z - cercanoZ;

            if (dx * dx + dz * dz < radio * radio) {
                return false;
            }
        }

        return true;
    }

    
    
    

    function claveCelda(cx, cz) {
        return `${cx},${cz}`;
    }

    function mundoACelda(x, z) {
        const tamano = config.tamanoCelda;

        return {
            x: Math.round(x / tamano),
            z: Math.round(z / tamano)
        };
    }

    function celdaAMundo(cx, cz) {
        const tamano = config.tamanoCelda;

        return {
            x: cx * tamano,
            z: cz * tamano
        };
    }

    function celdaLibre(cx, cz) {
        const punto = celdaAMundo(cx, cz);

        return puntoLibre(punto.x, punto.z);
    }

    function heuristica(a, b) {
        const dx = Math.abs(a.x - b.x);
        const dz = Math.abs(a.z - b.z);

        return Math.max(dx, dz) +
            (Math.SQRT2 - 1) * Math.min(dx, dz);
    }

    function encontrarCamino(origen, destino) {
        const inicio = mundoACelda(origen.x, origen.z);
        const final = mundoACelda(destino.x, destino.z);

        const inicioClave = claveCelda(inicio.x, inicio.z);
        const finalClave = claveCelda(final.x, final.z);

        if (
            inicioClave === finalClave ||
            distanciaXZ(origen, destino) < config.distanciaLlegada
        ) {
            return [destino];
        }

        const abiertos = new MinHeap();
        const gScore = new Map();
        const fScore = new Map();
        const padres = new Map();
        const cerrados = new Set();

        gScore.set(inicioClave, 0);
        fScore.set(
            inicioClave,
            heuristica(inicio, final)
        );

        abiertos.insertar({
            x: inicio.x,
            z: inicio.z,
            clave: inicioClave,
            g: 0,
            f: fScore.get(inicioClave)
        });

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
            abiertos.length > 0 &&
            iteraciones < maxIteraciones
        ) {
            iteraciones++;

            const actual = abiertos.extraer();

            if (!actual) break;

            if (cerrados.has(actual.clave)) continue;

            if (actual.clave === finalClave) {
                const camino = [];

                let clave = finalClave;

                while (clave !== inicioClave) {
                    const [cx, cz] = clave.split(',').map(Number);

                    camino.push(celdaAMundo(cx, cz));

                    clave = padres.get(clave);

                    if (!clave) break;
                }

                camino.reverse();

                camino.push({
                    x: destino.x,
                    z: destino.z
                });

                return camino;
            }

            cerrados.add(actual.clave);

            for (const [dx, dz, costo] of direcciones) {
                const nx = actual.x + dx;
                const nz = actual.z + dz;

                const vecinoClave = claveCelda(nx, nz);

                if (cerrados.has(vecinoClave)) continue;

                if (!celdaLibre(nx, nz)) continue;

                if (dx !== 0 && dz !== 0) {
                    if (
                        !celdaLibre(actual.x + dx, actual.z) ||
                        !celdaLibre(actual.x, actual.z + dz)
                    ) {
                        continue;
                    }
                }

                const gTentativo = actual.g + costo;

                if (
                    gTentativo >=
                    (gScore.get(vecinoClave) ?? Infinity)
                ) {
                    continue;
                }

                padres.set(vecinoClave, actual.clave);
                gScore.set(vecinoClave, gTentativo);

                const f = gTentativo + heuristica(
                    { x: nx, z: nz },
                    final
                );

                fScore.set(vecinoClave, f);

                abiertos.insertar({
                    x: nx,
                    z: nz,
                    clave: vecinoClave,
                    g: gTentativo,
                    f
                });
            }
        }

        
        
        const directa = [];
        const distancia = distanciaXZ(origen, destino);
        const pasos = Math.max(
            1,
            Math.ceil(distancia / config.tamanoCelda)
        );

        for (let i = 1; i <= pasos; i++) {
            const t = i / pasos;

            const x = THREE.MathUtils.lerp(
                origen.x,
                destino.x,
                t
            );

            const z = THREE.MathUtils.lerp(
                origen.z,
                destino.z,
                t
            );

            if (!puntoLibre(x, z)) {
                return [];
            }

            directa.push({ x, z });
        }

        return directa;
    }

    
    
    

    function establecerObjetivo(destino, nuevoEstado) {
        if (!destino) return false;

        actualizarColisiones();

        const origen = {
            x: grupo.position.x,
            z: grupo.position.z
        };

        const camino = encontrarCamino(origen, destino);

        if (!camino.length) {
            return false;
        }

        ruta = camino;
        indiceRuta = 0;

        objetivo = {
            x: destino.x,
            z: destino.z
        };

        cambiarEstado(nuevoEstado);

        return true;
    }

    function establecerRuta(puntos, nuevoEstado = ESTADOS.RUTA) {
        if (!Array.isArray(puntos) || !puntos.length) {
            return false;
        }

        const caminoCompleto = [];

        let origen = {
            x: grupo.position.x,
            z: grupo.position.z
        };

        for (const punto of puntos) {
            const destino = {
                x: numero(punto.x, NaN),
                z: numero(punto.z, NaN)
            };

            if (
                !Number.isFinite(destino.x) ||
                !Number.isFinite(destino.z)
            ) {
                continue;
            }

            const tramo = encontrarCamino(origen, destino);

            if (!tramo.length) return false;

            caminoCompleto.push(...tramo);

            origen = destino;
        }

        if (!caminoCompleto.length) return false;

        ruta = caminoCompleto;
        indiceRuta = 0;

        objetivo = {
            ...caminoCompleto[caminoCompleto.length - 1]
        };

        cambiarEstado(nuevoEstado);

        return true;
    }

    function establecerPosicion(posicion) {
        if (!posicion) return false;

        grupo.position.set(
            numero(posicion.x, grupo.position.x),
            numero(posicion.y, grupo.position.y),
            numero(posicion.z, grupo.position.z)
        );

        actualizarColisiones();

        ultimaPosicionMovimiento.copy(grupo.position);

        return true;
    }

    
    
    

    function orientarHaciaPunto(punto, delta = 0.016) {
        if (!punto) return;

        const dx = punto.x - grupo.position.x;
        const dz = punto.z - grupo.position.z;

        if (Math.abs(dx) + Math.abs(dz) < 0.001) return;

        const angulo = Math.atan2(dx, dz);
        const diferencia = Math.atan2(
            Math.sin(angulo - grupo.rotation.y),
            Math.cos(angulo - grupo.rotation.y)
        );

        grupo.rotation.y += diferencia * (
            1 - Math.exp(-config.suavizadoGiro * delta)
        );
    }

    function orientarHaciaObjetivo(delta) {
        if (!objetivo) return;

        const dx = objetivo.x - grupo.position.x;
        const dz = objetivo.z - grupo.position.z;

        if (Math.abs(dx) + Math.abs(dz) < 0.001) return;

        const angulo = Math.atan2(dx, dz);

        let diferencia = angulo - grupo.rotation.y;

        while (diferencia > Math.PI) diferencia -= Math.PI * 2;
        while (diferencia < -Math.PI) diferencia += Math.PI * 2;

        intensidadGiro = limitar(
            diferencia,
            -1,
            1
        );

        grupo.rotation.y += diferencia * (
            1 - Math.exp(-config.suavizadoGiro * delta)
        );
    }

    
    
    

    function resolverClienteAtascado() {
        if (!objetivo) {
            tiempoSinMovimiento = 0;
            return false;
        }

        const destinoAnterior = { ...objetivo };

        actualizarColisiones();

        const nuevoCamino = encontrarCamino(
            {
                x: grupo.position.x,
                z: grupo.position.z
            },
            destinoAnterior
        );

        const rutaActual = ruta.slice(indiceRuta);
        const mismaRuta = (camino) => {
            return (
                camino.length === rutaActual.length &&
                camino.every((punto, indice) => {
                    return distanciaXZ(punto, rutaActual[indice]) < 0.08;
                })
            );
        };

        if (nuevoCamino.length && !mismaRuta(nuevoCamino)) {
            ruta = nuevoCamino;
            indiceRuta = 0;
            tiempoSinMovimiento = 0;

            return true;
        }

        
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

        for (const [dx, dz] of direcciones) {
            const x = grupo.position.x + dx * config.tamanoCelda;
            const z = grupo.position.z + dz * config.tamanoCelda;

            if (puntoLibre(x, z)) {
                const camino = encontrarCamino(
                    { x, z },
                    destinoAnterior
                );

                if (camino.length && !mismaRuta(camino)) {
                    ruta = camino;
                    indiceRuta = 0;
                    tiempoSinMovimiento = 0;

                    return true;
                }
            }
        }

        const direccionesDestino = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [0.707, 0.707],
            [-0.707, 0.707],
            [0.707, -0.707],
            [-0.707, -0.707]
        ];
        const origen = {
            x: grupo.position.x,
            z: grupo.position.z
        };

        if (estado !== ESTADOS.ACERCANDO) {
            for (const distancia of [
                config.tamanoCelda,
                config.tamanoCelda * 2
            ]) {
                for (const [dx, dz] of direccionesDestino) {
                    const destinoAlternativo = {
                        x: destinoAnterior.x + dx * distancia,
                        z: destinoAnterior.z + dz * distancia
                    };

                    if (!puntoLibre(destinoAlternativo.x, destinoAlternativo.z)) {
                        continue;
                    }

                    const camino = encontrarCamino(
                        origen,
                        destinoAlternativo
                    );

                    if (!camino.length) continue;

                    ruta = camino;
                    indiceRuta = 0;
                    objetivo = destinoAlternativo;
                    tiempoSinMovimiento = 0;

                    console.warn(
                        `[CLIENTE ${id}] Recalculó la ruta hacia un punto cercano transitable.`
                    );

                    return true;
                }
            }
        }

        tiempoSinMovimiento = 0;

        return false;
    }

    function recuperarTrasAtasco() {
        if (estado === ESTADOS.ACERCANDO && productoObjetivo) {
            productosConRutaFallida.add(productoObjetivo);
            liberarReserva();
            ruta = [];
            objetivo = null;

            if (compras.length >= config.maximoProductos) {
                if (!dirigirseACaja()) {
                    cambiarEstado(ESTADOS.ESPERANDO);
                }
            } else {
                cambiarEstado(ESTADOS.BUSCANDO);
            }

            console.warn(
                `[CLIENTE ${id}] Omitió un producto cuyo acceso quedó bloqueado.`
            );
            return;
        }

        if (estado === ESTADOS.RUTA) {
            ruta = [];
            objetivo = null;
            cambiarEstado(ESTADOS.BUSCANDO);

            console.warn(
                `[CLIENTE ${id}] Canceló una ruta sin progreso y retomó la búsqueda.`
            );
        }
    }

    function moverHaciaDestino(delta) {
        if (!ruta.length || indiceRuta >= ruta.length) {
            velocidadActual = 0;
            movimientoSuave = 0;
            return true;
        }

        const waypoint = ruta[indiceRuta];

        if (!waypoint) {
            ruta = [];
            return true;
        }

        orientarHaciaObjetivo(delta);

        const dx = waypoint.x - grupo.position.x;
        const dz = waypoint.z - grupo.position.z;

        const distancia = Math.hypot(dx, dz);

        const esUltimoWaypoint = indiceRuta === ruta.length - 1;
        const toleranciaLlegada = esUltimoWaypoint
            ? config.distanciaLlegada
            : config.distanciaWaypoint;

        if (distancia <= toleranciaLlegada) {
            if (
                esUltimoWaypoint &&
                puntoLibre(waypoint.x, waypoint.z)
            ) {
                grupo.position.x = waypoint.x;
                grupo.position.z = waypoint.z;
            }

            indiceRuta++;

            if (indiceRuta >= ruta.length) {
                ruta = [];
                velocidadActual = 0;
                movimientoSuave = 0;

                return true;
            }

            return false;
        }

        const velocidadObjetivo = (
            estado === ESTADOS.ENTRANDO
                ? config.velocidadEntrada
                : estado === ESTADOS.REGRESANDO
                    ? config.velocidadRegreso
                    : config.velocidad
        ) * variacionVelocidad;

        velocidadActual = THREE.MathUtils.lerp(
            velocidadActual,
            velocidadObjetivo,
            1 - Math.exp(-config.aceleracionMovimiento * delta)
        );

        movimientoSuave = THREE.MathUtils.lerp(
            movimientoSuave,
            1,
            1 - Math.exp(-config.aceleracion * delta)
        );

        const paso = Math.min(
            velocidadActual * delta,
            distancia
        );

        const siguienteX = grupo.position.x + (dx / distancia) * paso;
        const siguienteZ = grupo.position.z + (dz / distancia) * paso;

        if (!puntoLibre(siguienteX, siguienteZ)) {
            tiempoRecalculoRuta += delta;

            if (tiempoRecalculoRuta >= config.intervaloRecalculoRuta) {
                tiempoRecalculoRuta = 0;

                const nuevoCamino = encontrarCamino(
                    {
                        x: grupo.position.x,
                        z: grupo.position.z
                    },
                    objetivo
                );

                if (nuevoCamino.length) {
                    ruta = nuevoCamino;
                    indiceRuta = 0;
                }
            }

            velocidadActual = 0;

            return false;
        }

        grupo.position.x = siguienteX;
        grupo.position.z = siguienteZ;

        animarCaminarProcedural(delta);

        ultimaPosicionMovimiento.copy(grupo.position);

        return false;
    }

    
    
    

    function obtenerProductos() {
        const fuente = config.productos;

        if (!fuente) return [];

        if (Array.isArray(fuente)) return fuente;

        if (typeof fuente.userData?.listarUnidades === 'function') {
            const unidades = fuente.userData.listarUnidades();

            if (Array.isArray(unidades)) return unidades;
        }

        if (fuente.isObject3D) {
            const lista = [];

            fuente.traverse(objeto => {
                if (objeto.userData?.esProducto) {
                    lista.push(objeto);
                }
            });

            return lista;
        }

        if (Array.isArray(fuente.productos)) {
            return fuente.productos;
        }

        if (Array.isArray(fuente.children)) {
            return fuente.children;
        }

        return [];
    }

    function productoDisponible(producto) {
        if (!producto || !producto.visible) return false;

        const datos = producto.userData ?? {};

        if (
            datos.vendido ||
            datos.enCarrito ||
            datos.oculto ||
            datos.agotado
        ) {
            return false;
        }

        if (
            datos.reservado &&
            datos.reservadoPor !== id
        ) {
            return false;
        }

        if (reservasProductos.has(producto)) {
            return reservasProductos.get(producto) === id;
        }

        return true;
    }

    function reservarProducto(producto) {
        if (!productoDisponible(producto)) return false;

        reservasProductos.set(producto, id);

        producto.userData ??= {};
        producto.userData.reservado = true;
        producto.userData.reservadoPor = id;

        return true;
    }

    function liberarReserva() {
        if (productoEnMano && productoOriginal) {
            const producto = productoEnMano;
            const original = productoOriginal;

            if (producto.parent) {
                producto.parent.remove(producto);
            }

            const destino = original.parent ?? null;

            if (destino) {
                destino.add(producto);
                producto.position.copy(original.posicion);
                producto.quaternion.copy(original.quaternion);
                producto.scale.copy(original.escala);
                producto.visible = original.visible !== false;
            }

            producto.userData ??= {};
            producto.userData.enCarrito = false;
            producto.userData.reservado = false;
            delete producto.userData.reservadoPor;

            productoEnMano = null;
            productoOriginal = null;
        }

        if (productoObjetivo) {
            if (reservasProductos.get(productoObjetivo) === id) {
                reservasProductos.delete(productoObjetivo);
            }

            if (productoObjetivo.userData) {
                productoObjetivo.userData.reservado = false;
                delete productoObjetivo.userData.reservadoPor;
            }
        }

        productoObjetivo = null;
        animacionProducto.activa = false;
        animacionProducto.tipo = null;
        animacionProducto.tiempo = 0;
        animacionAgarre.activa = false;
        animacionAgarre.tiempo = 0;

        liberarRack();
    }

    function esProductoBuscado(producto) {
        if (!producto) return false;

        const datos = producto.userData ?? {};

        const nombre = normalizarNombre(
            datos.nombre ??
            producto.name ??
            ''
        );

        const categoria = normalizarNombre(
            datos.categoria ??
            datos.departamento ??
            ''
        );

        if (config.soloPlatanos) {
            return (
                nombre.includes('platano') ||
                nombre.includes('banana') ||
                categoria.includes('platano')
            );
        }

        if (config.nombreProductoBuscado) {
            const buscado = normalizarNombre(
                config.nombreProductoBuscado
            );

            return (
                nombre.includes(buscado) ||
                categoria.includes(buscado)
            );
        }

        return true;
    }

    function buscarProducto() {
        const productos = obtenerProductos();

        if (!productos.length) return null;

        const candidatos = [];

        for (const producto of productos) {
            if (!productoDisponible(producto)) continue;
            if (productosConRutaFallida.has(producto)) continue;
            if (!esProductoBuscado(producto)) continue;

            const claveRack = obtenerClaveRack(producto);

            if (racksVisitados.has(claveRack)) continue;
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
                distancia,
                claveRack
            });
        }

        if (!candidatos.length) {
            
            
            racksVisitados.clear();

            for (const producto of productos) {
                if (!productoDisponible(producto)) continue;
                if (productosConRutaFallida.has(producto)) continue;
                if (!esProductoBuscado(producto)) continue;
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
                    distancia,
                    claveRack: obtenerClaveRack(producto)
                });
            }
        }

        if (!candidatos.length) return null;

        
        
        candidatos.sort((a, b) => a.distancia - b.distancia);

        const cantidadAleatoria = Math.min(
            candidatos.length,
            Math.max(1, Math.ceil(candidatos.length * 0.35))
        );

        const seleccionado = candidatos[
            Math.floor(Math.random() * cantidadAleatoria)
        ];

        if (!reservarRack(seleccionado.producto)) {
            return null;
        }

        if (!reservarProducto(seleccionado.producto)) {
            liberarRack();
            return null;
        }

        productoObjetivo = seleccionado.producto;

        return productoObjetivo;
    }

    
    
    

    function obtenerPuntoFrenteProducto(producto) {
        producto.getWorldPosition(vectorTemporal);

        const centro = {
            x: vectorTemporal.x,
            z: vectorTemporal.z
        };

        const direcciones = [
            { x: 0, z: 1 },
            { x: 0, z: -1 },
            { x: 1, z: 0 },
            { x: -1, z: 0 },
            { x: 0.7, z: 0.7 },
            { x: -0.7, z: 0.7 },
            { x: 0.7, z: -0.7 },
            { x: -0.7, z: -0.7 }
        ];

        let mejor = null;
        let mejorDistancia = Infinity;

        for (const direccion of direcciones) {
            const punto = {
                x: centro.x + direccion.x * config.distanciaFrenteProducto,
                z: centro.z + direccion.z * config.distanciaFrenteProducto
            };

            if (!puntoLibre(punto.x, punto.z)) continue;

            const distancia = distanciaXZ(grupo.position, punto);

            if (distancia < mejorDistancia) {
                mejorDistancia = distancia;
                mejor = punto;
            }
        }

        return mejor;
    }

    function acercarseAProducto(producto) {
        if (!producto) return false;

        const punto = obtenerPuntoFrenteProducto(producto);

        if (!punto) return false;

        return establecerObjetivo(
            punto,
            ESTADOS.ACERCANDO
        );
    }

    
    
    

    function palmaAlcanzaProducto(producto) {
        if (!producto || !rig.manoDerecha) return false;

        grupo.updateMatrixWorld(true);
        rig.manoDerecha.updateWorldMatrix(true, true);
        producto.updateMatrixWorld(true);

        const caja = new THREE.Box3().setFromObject(producto);

        if (caja.isEmpty()) return false;

        const origenMano = rig.manoDerecha.getWorldPosition(
            new THREE.Vector3()
        );

        const palma = rig.manoDerecha.localToWorld(
            new THREE.Vector3(
                numero(config.offsetProductoMano.x),
                numero(config.offsetProductoMano.y),
                numero(config.offsetProductoMano.z)
            )
        );

        const radioContacto = Math.max(
            config.distanciaProductoInspeccion,
            0.18
        );

        const puntoMasCercano = palma.clone().clamp(
            caja.min,
            caja.max
        );

        const puntoMasCercanoDesdeOrigen = origenMano.clone().clamp(
            caja.min,
            caja.max
        );

        return palma.distanceToSquared(puntoMasCercano) <=
            radioContacto * radioContacto ||
            origenMano.distanceToSquared(
                puntoMasCercanoDesdeOrigen
            ) <= radioContacto * radioContacto;
    }

    
    
    

    function actualizarAnimacionProducto(delta) {
        if (!animacionProducto.activa || !productoEnMano) {
            return false;
        }

        const producto = productoEnMano;

        animacionProducto.tiempo += delta;

        const duracion = Math.max(animacionProducto.duracion, 0.01);

        const t = limitar(
            animacionProducto.tiempo / duracion,
            0,
            1
        );

        const suave = suavizar(t);
        const tipo = animacionProducto.tipo;

        
        
        

        if (tipo === 'TOMAR') {
            
            
            producto.position.lerpVectors(
                animacionProducto.posicionInicial,
                animacionProducto.posicionFinal,
                suave
            );

            producto.quaternion.slerpQuaternions(
                animacionProducto.quaternionInicial,
                animacionProducto.quaternionFinal,
                suave
            );

            producto.scale.lerpVectors(
                animacionProducto.escalaInicial,
                animacionProducto.escalaFinal,
                suave
            );

            if (t >= 1) {
                producto.position.copy(
                    animacionProducto.posicionFinal
                );

                producto.quaternion.copy(
                    animacionProducto.quaternionFinal
                );

                producto.scale.copy(
                    animacionProducto.escalaFinal
                );

                animacionProducto.activa = false;
                animacionProducto.tipo = null;
                animacionProducto.tiempo = 0;

                return true;
            }

            return false;
        }

        
        
        

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
        const escala = animacionProducto.escalaTemporal.lerpVectors(
            animacionProducto.escalaInicial,
            animacionProducto.escalaFinal,
            suave
        );

        const padre = producto.parent;

        if (padre) {
            padre.updateMatrixWorld(true);

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
                producto.position,
                producto.quaternion,
                producto.scale
            );
        }

        if (t < 1) return false;

        if (tipo === 'GUARDAR') {
            animacionProducto.activa = false;
            animacionProducto.tipo = null;
            animacionProducto.tiempo = 0;

            confirmarGuardarProducto();

            return true;
        }

        finalizarDevolucionProducto();

        return true;
    }

    
    
    

    function finalizarDevolucionProducto() {
        if (!productoEnMano) {
            productoOriginal = null;
            animacionProducto.activa = false;
            animacionProducto.tipo = null;
            animacionAgarre.activa = false;
            animacionAgarre.tiempo = 0;
            return;
        }

        const producto = productoEnMano;
        const original = productoOriginal ?? {
            parent: producto.parent ?? null,
            posicion: producto.position.clone(),
            quaternion: producto.quaternion.clone(),
            escala: producto.scale.clone(),
            visible: producto.visible
        };
        const tipoDevolucion = animacionProducto.tipo;

        animacionAgarre.activa = false;
        animacionAgarre.tiempo = 0;

        if (producto.parent) {
            producto.parent.remove(producto);
        }

        const padreDestino = original.parent ?? producto.parent ?? null;

        if (padreDestino) {
            padreDestino.add(producto);
            producto.position.copy(original.posicion);
            producto.quaternion.copy(original.quaternion);
            producto.scale.copy(original.escala);
            producto.visible = original.visible;
        }

        producto.userData ??= {};

        if (tipoDevolucion === 'REUBICAR') {
            producto.userData.rackReubicado =
                original.rackNuevo ?? obtenerClaveRack(producto);

            producto.userData.reubicado = true;
        }

        productoEnMano = null;
        productoOriginal = null;

        animacionProducto.activa = false;
        animacionProducto.tipo = null;
        animacionProducto.tiempo = 0;

        liberarReserva();
    }

    
    
    

    function buscarUbicacionOtroRack(producto) {
        if (!producto || !productoOriginal) return null;

        const productos = obtenerProductos();

        const rackActual =
            rackReservado ?? obtenerClaveRack(producto);

        const tamanoProducto =
            productoOriginal.tamanoMundo ??
            new THREE.Vector3(0.3, 0.3, 0.3);

        let mejor = null;
        let mejorDistancia = Infinity;

        for (const candidato of productos) {
            if (!candidato || candidato === producto) continue;
            if (!candidato.parent) continue;
            if (!candidato.visible) continue;

            const claveRack = obtenerClaveRack(candidato);

            if (claveRack === rackActual) continue;

            if (!rackDisponible(candidato)) continue;

            candidato.getWorldPosition(vectorTemporal);

            const distancia = distanciaXZ(
                grupo.position,
                vectorTemporal
            );

            if (distancia < mejorDistancia) {
                mejorDistancia = distancia;

                mejor = {
                    ancla: candidato,
                    padre: candidato.parent,
                    claveRack,
                    posicionLocal: candidato.position.clone(),
                    quaternionLocal: candidato.quaternion.clone()
                };
            }
        }

        if (!mejor) return null;

        const padre = mejor.padre;

        padre.updateMatrixWorld(true);

        const posicionLocal = mejor.posicionLocal.clone();

        posicionLocal.x +=
            (Math.random() - 0.5) *
            config.separacionProductoRack;

        posicionLocal.z +=
            (Math.random() - 0.5) *
            config.separacionProductoRack;

        return {
            ...mejor,
            posicionLocal,
            quaternionLocal: mejor.quaternionLocal.clone(),
            tamanoProducto
        };
    }

    
    
    

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
            productosConRutaFallida.add(producto);
            liberarReserva();
            cambiarEstado(ESTADOS.ESPERANDO);
        }
    }

    
    
    

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

    
    
    

   function iniciarDesdeVehiculo(posicionEntrada, plaza) {
    if (!posicionEntrada || !plaza) {
        console.warn(`[CLIENTE ${id}] Faltan datos del vehículo.`);
        return false;
    }

    if (eliminado) return false;

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
        console.warn(`[CLIENTE ${id}] Ya está realizando una actividad.`);
        return false;
    }

    detenido = false;
    liberarReserva();

    compras = [];

    productosExaminados.clear();
    productosConRutaFallida.clear();
    racksVisitados.clear();
    celdasOcupadas.clear();

    callbackPagoPendiente = null;
    ticketPendiente = null;
    callbackRegreso = null;

    entradaNotificada = false;

    grupo.position.set(
        numero(posicionEntrada.x, plaza.x),
        numero(config.posicion.y),
        numero(posicionEntrada.z, plaza.z)
    );

    grupo.visible = true;

    actualizarColisiones();

    const camino = crearRutaPorPuerta(
        {
            x: 0,
            z: config.puertaZInterior
        },
        'entrada'
    );

    if (!Array.isArray(camino) || camino.length === 0) {
        console.warn(
            `[CLIENTE ${id}] No se encontró una ruta de entrada.`
        );

        cambiarEstado(ESTADOS.INACTIVO);
        detenido = false;
        return false;
    }

    ruta = camino;
    indiceRuta = 0;
    objetivo = camino[camino.length - 1];

    cambiarEstado(ESTADOS.ENTRANDO);
    reproducirAnimacion();

    if (mixer) {
        mixer.timeScale = 1;
    }

    if (accionCaminar) {
        accionCaminar.reset();
        accionCaminar.play();
    }

    console.log(
        `[CLIENTE ${id}] Visitante iniciado desde vehículo.`
    );

    return true;
}

    
    
    

    function iniciarRegresoVehiculo(plaza, callback) {
        if (!plaza || eliminado) return false;

        if (
            estado === ESTADOS.REGRESANDO ||
            estado === ESTADOS.FINALIZADO
        ) {
            return false;
        }

        detenido = false;
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
        reproducirAnimacion();

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

            if (tiempoSinMovimiento >= config.tiempoMaximoAtasco) {
                if (!resolverClienteAtascado()) {
                    recuperarTrasAtasco();
                }
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

        
        
        if (animacionProducto.activa) {
            actualizarAnimacionProducto(delta);
        }

        switch (estado) {
            case ESTADOS.INACTIVO:
                break;

            
            
            

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

            
            
            

            case ESTADOS.BUSCANDO: {
                if (
                    tiempoEstado <
                    pausaBusquedaActual
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

            
            
            

            case ESTADOS.RECOGIENDO: {
                if (productoObjetivo && !productoEnMano) {
                    productoObjetivo.getWorldPosition(vectorTemporal);
                    orientarHaciaPunto(
                        {
                            x: vectorTemporal.x,
                            z: vectorTemporal.z
                        },
                        delta
                    );
                }

                animarRecogerProcedural();

                if (!productoEnMano) {
                    const momentoContacto = limitar(
                        numero(config.progresoContactoProducto, 0.70),
                        0.55,
                        0.88
                    );

                    const puedeAgarrar =
                        tiempoEstado >=
                        config.tiempoRecoger * momentoContacto;

                    if (
                        puedeAgarrar &&
                        productoObjetivo &&
                        palmaAlcanzaProducto(productoObjetivo)
                    ) {
                        tomarProducto();
                    }

                    
                    
                    if (
                        tiempoEstado >= config.tiempoRecoger &&
                        !productoEnMano
                    ) {
                        if (productoObjetivo) {
                            productosConRutaFallida.add(productoObjetivo);
                        }

                        liberarReserva();
                        productoObjetivo = null;
                        cambiarEstado(ESTADOS.BUSCANDO);
                    }
                } else if (!animacionProducto.activa) {
                    
                    cambiarEstado(ESTADOS.INSPECCIONANDO);
                }

                break;
            }

            
            
            

            case ESTADOS.INSPECCIONANDO: {
                animarInspeccionarProcedural();
                grupo.updateMatrixWorld(true);

                if (productoEnMano) {
                    productoEnMano.updateMatrixWorld(true);
                }

                if (
                    tiempoEstado >=
                    tiempoInspeccionActual
                ) {
                    cambiarEstado(ESTADOS.DECIDIENDO);
                }

                break;
            }

            
            
            

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

            
            
            

            case ESTADOS.GUARDANDO: {
                animarGuardarProcedural();

                if (tiempoEstado >= config.tiempoGuardar) {
                    guardarProducto();
                }

                break;
            }

            
            
            

            case ESTADOS.DEVOLVIENDO: {
                animarDevolverProcedural();

                if (
                    tiempoEstado >= config.tiempoDevolver &&
                    !animacionProducto.activa
                ) {
                    cambiarEstado(ESTADOS.BUSCANDO);
                }

                break;
            }

            
            
            

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
                        
                        
                        
                        cambiarEstado(ESTADOS.BUSCANDO);

                    } else {
                        iniciarPaseo();
                    }
                }

                break;
            }

            
            
            

            case ESTADOS.PAGANDO: {
                animarPagarProcedural();

                if (tiempoEstado >= 2.5) {
                    const ticket = ticketPendiente;

                    ticketPendiente = null;

                    if (config.repetirRuta) {
                        compras = [];

                        productosExaminados.clear();
                        productosConRutaFallida.clear();
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

    
    
    

    function tomarProducto() {
        if (
            animacionProducto.activa ||
            !productoObjetivo ||
            !productoDisponible(productoObjetivo)
        ) {
            if (!animacionProducto.activa) {
                liberarReserva();
                cambiarEstado(ESTADOS.BUSCANDO);
            }

            return;
        }

        const producto = productoObjetivo;

        producto.updateMatrixWorld(true);

        productoEsInferior = productoEstaEnEstanteInferior(producto);

        const cajaProducto = new THREE.Box3().setFromObject(producto);
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

        const mano = rig.manoDerecha;

        if (!mano) {
            console.warn(
                `[CLIENTE ${id}] No se encontró la mano derecha.`
            );

            productoOriginal = null;
            liberarReserva();
            cambiarEstado(ESTADOS.BUSCANDO);

            return;
        }

        grupo.updateMatrixWorld(true);
        mano.updateMatrixWorld(true);

        mano.attach(producto);
        mano.updateMatrixWorld(true);

        const posicionInicialLocal = producto.position.clone();
        const quaternionInicial = producto.quaternion.clone();
        const escalaInicial = producto.scale.clone();

        const offset = config.offsetProductoMano;
        const rotacion = config.rotacionProductoMano;

        const posicionFinal = new THREE.Vector3(
            numero(offset.x),
            numero(offset.y),
            numero(offset.z)
        );

        const quaternionFinal = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(
                numero(rotacion.x),
                numero(rotacion.y),
                numero(rotacion.z)
            )
        );

        const escalaFinal = escalaInicial.clone().multiplyScalar(
            config.escalaProductoMano
        );

        producto.position.copy(posicionInicialLocal);
        producto.quaternion.copy(quaternionInicial);
        producto.scale.copy(escalaInicial);

        productoEnMano = producto;

        productosExaminados.add(producto);

        producto.visible = true;

        animacionProducto.activa = true;
        animacionProducto.tipo = 'TOMAR';
        animacionProducto.tiempo = 0;
        animacionProducto.duracion = 0.65;

        animacionProducto.posicionInicial.copy(posicionInicialLocal);
        animacionProducto.posicionFinal.copy(posicionFinal);

        animacionProducto.quaternionInicial.copy(quaternionInicial);
        animacionProducto.quaternionFinal.copy(quaternionFinal);

        animacionProducto.escalaInicial.copy(escalaInicial);
        animacionProducto.escalaFinal.copy(escalaFinal);

        console.log(
            `[CLIENTE ${id}] Agarrando ${
                producto.userData?.nombre ??
                producto.name ??
                'producto'
            }`
        );
    }

    
    
    

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
            typeof opcionesCompras.tiempoInspeccionar === 'number'
        ) {
            config.tiempoInspeccionar = Math.max(
                0,
                opcionesCompras.tiempoInspeccionar
            );
        }

        if (
            typeof opcionesCompras.tiempoRecoger === 'number'
        ) {
            config.tiempoRecoger = Math.max(
                0,
                opcionesCompras.tiempoRecoger
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

        
        if (typeof opcionesCompras.soloPlatanos === 'boolean') {
            config.soloPlatanos = opcionesCompras.soloPlatanos;
        }

        if (typeof opcionesCompras.nombreProductoBuscado === 'string') {
            config.nombreProductoBuscado =
                opcionesCompras.nombreProductoBuscado;
        }
    }

    
    
    

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

    
    
    

    function eliminar() {
        if (eliminado) return;

        liberarReserva();

        productosExaminados.clear();
        productosConRutaFallida.clear();
        racksVisitados.clear();
        celdasOcupadas.clear();

        animacionAgarre.activa = false;
        animacionProducto.activa = false;

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
