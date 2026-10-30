
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// SISTEMA DE CLIENTES DEL SUPERMERCADO
// Clientes, clientas y ladrones
// Navegación A*, compras, carrito y caja registradora
// ============================================================

const loader = new GLTFLoader();
const clientesActivos = new Set();

let siguienteIdCliente = 1;

const productosCompradosGlobal = new Set();
const productosReservadosGlobal = new Map();

const LIMITES = {
    minX: -29,
    maxX: 29,
    minZ: -27,
    maxZ: 27
};

const PASO_RUTA = 1.5;
const DISTANCIA_CLIENTES = 1.35;
const MAX_ARTICULOS_VISIBLES = 18;

const ZONAS_CLIENTES = [
    { nombre: 'Frutas', minX: -28, maxX: -19, minZ: 5, maxZ: 22 },
    { nombre: 'Verduras', minX: -18, maxX: -10, minZ: 5, maxZ: 22 },
    { nombre: 'Abarrotes izquierda', minX: -8, maxX: -1, minZ: -22, maxZ: 22 },
    { nombre: 'Abarrotes derecha', minX: 1, maxX: 8, minZ: -22, maxZ: 22 },
    { nombre: 'Bebidas', minX: 16, maxX: 28, minZ: -22, maxZ: -3 },
    { nombre: 'Refrigeradores', minX: -28, maxX: -16, minZ: -25, maxZ: -17 },
    { nombre: 'Lácteos', minX: 16, maxX: 28, minZ: 5, maxZ: 22 }
];

// ============================================================
// CONFIGURACIÓN DE MOVIMIENTO
// ============================================================

const DIRECCIONES = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, -1, Math.SQRT2]
];

// ============================================================
// UTILIDADES
// ============================================================

class ColaPrioridad {
    constructor() {
        this.datos = [];
    }

    get length() {
        return this.datos.length;
    }

    insertar(elemento, prioridad) {
        const nuevo = { elemento, prioridad };
        this.datos.push(nuevo);

        let i = this.datos.length - 1;

        while (i > 0) {
            const padre = Math.floor((i - 1) / 2);

            if (this.datos[padre].prioridad <= prioridad) break;

            this.datos[i] = this.datos[padre];
            i = padre;
        }

        this.datos[i] = nuevo;
    }

    extraer() {
        if (!this.datos.length) return null;

        const primero = this.datos[0];
        const ultimo = this.datos.pop();

        if (this.datos.length && ultimo) {
            let i = 0;

            while (true) {
                const izquierda = i * 2 + 1;
                const derecha = izquierda + 1;

                if (izquierda >= this.datos.length) break;

                let menor = izquierda;

                if (
                    derecha < this.datos.length &&
                    this.datos[derecha].prioridad <
                    this.datos[izquierda].prioridad
                ) {
                    menor = derecha;
                }

                if (
                    this.datos[menor].prioridad >=
                    ultimo.prioridad
                ) break;

                this.datos[i] = this.datos[menor];
                i = menor;
            }

            this.datos[i] = ultimo;
        }

        return primero;
    }
}

function numeroAleatorio(min, max) {
    return min + Math.random() * (max - min);
}

function distancia2D(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
}

function normalizarCodigo(valor) {
    return String(valor ?? '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9áéíóúñ_-]/gi, '');
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

    const id = siguienteIdCliente++;

    const config = {
        modelo: '/modelos/cliente1.glb',
        posicion: { x: -5, y: 0, z: 20 },
        velocidad: 1.5,
        escala: 1,

        distanciaRecoger: 2,
        tiempoExaminar: 1.8,
        pausaEntreCompras: 1.5,
        probabilidadCompra: 0.8,

        radioColision: 0.42,
        distanciaDestino: 0.65,
        tiempoReintento: 1.2,

        ruta: [],
        repetirRuta: false,
        inactivo: false,

        maxProductosPorBusqueda: 80,
        maxCompras: 5,

        // Configuración de caja
        posicionCaja: { x: 0, z: 20 },
        tiempoDuracionPago: 5,

        ...opciones
    };

    const esLadron =
        config.probabilidadCompra <= 0 &&
        config.repetirRuta === true;

    const zonaPersonal = ZONAS_CLIENTES[
        (id - 1) % ZONAS_CLIENTES.length
    ];

    const grupo = new THREE.Group();
    grupo.name = `CLIENTE_SUPERMERCADO_${id}`;

    grupo.position.set(
        Number(config.posicion.x) || 0,
        Number(config.posicion.y) || 0,
        Number(config.posicion.z) || 0
    );

    grupo.userData.idCliente = id;
    grupo.userData.esLadron = esLadron;

    scene.add(grupo);

    const contenedorModelo = new THREE.Group();
    contenedorModelo.name = `MODELO_CLIENTE_${id}`;
    grupo.add(contenedorModelo);

    // ========================================================
    // ESTADO
    // ========================================================

    let modelo = null;
    let cargado = false;
    let eliminado = false;
    let detenido = Boolean(config.inactivo);

    let estado = config.inactivo ? 'esperando' : 'caminando';

    let tiempoEstado = 0;
    let tiempoCompra = 0;
    let tiempoReintento = 0;
    let tiempoAtascado = 0;
    let faseCaminar = 0;

    let contadorCompras = 0;
    let yaEntro = false;

    let rutaPersonalizada = [];
    let indiceRutaPersonalizada = 0;

    let rutaActual = [];
    let indiceRuta = 0;
    let objetivoActual = null;

    let rutaExterior = [];
    let indiceRutaExterior = 0;

    let productosGrupo = null;
    let carrito = null;
    let callbackRecoger = null;
    let callbackEntrada = config.alEntrar;
    let callbackRegreso = null;

    let productoObjetivo = null;
    let productoEnExamen = null;
    let productoEnMano = null;

    let anclaMano = null;

    // Datos de caja
    let posicionCaja = {
        x: Number(config.posicionCaja?.x ?? 0),
        z: Number(config.posicionCaja?.z ?? 20)
    };

    let callbackPago = null;
    let resumenPago = null;
    let pagoConfirmado = false;
    let tiempoAnimacionPago = 0;

    const huesos = {};
    const rotacionesBase = new Map();
    const articulosEnCarrito = [];
    const productosVisitados = new Set();
    const productosRechazados = new Map();

    const ultimaPosicion = grupo.position.clone();
    const centroTemporal = new THREE.Vector3();

    // ========================================================
    // RUTAS PERSONALIZADAS
    // ========================================================

    function establecerRuta(nuevaRuta) {
        rutaPersonalizada = Array.isArray(nuevaRuta)
            ? nuevaRuta.map(p => ({
                x: Number(p.x),
                z: Number(p.z)
            })).filter(p =>
                Number.isFinite(p.x) &&
                Number.isFinite(p.z)
            )
            : [];

        indiceRutaPersonalizada = 0;
        rutaActual = [];
        indiceRuta = 0;
        objetivoActual = null;

        if (!detenido && estado === 'caminando') {
            asignarDestino();
        }
    }

    establecerRuta(config.ruta);

    // ========================================================
    // OBSTÁCULOS
    // ========================================================

    const obstaculos = [];

    function agregarObstaculo(x, z, ancho, fondo) {
        obstaculos.push({
            minX: x - ancho / 2,
            maxX: x + ancho / 2,
            minZ: z - fondo / 2,
            maxZ: z + fondo / 2
        });
    }

    for (const x of [-17, -9, 9, 17]) {
        for (const z of [-13, 0, 13]) {
            agregarObstaculo(x, z, 1.45, 6);
        }
    }

    for (const [x, z] of [
        [-25.5, 15],
        [-21.7, 15],
        [-25.5, 10.8],
        [-21.7, 10.8]
    ]) {
        agregarObstaculo(x, z, 3, 1.6);
    }

    agregarObstaculo(-3.5, -7, 1.9, 1.8);
    agregarObstaculo(3.5, 7, 1.9, 1.8);

    agregarObstaculo(25.2, 15.2, 2.9, 1.3);
    agregarObstaculo(25.2, 11.4, 2.9, 1.3);
    agregarObstaculo(25.1, -7.3, 5.2, 2.4);

    for (const x of [
        -27, -23.5, -20, -16.5,
        16.5, 20, 23.5, 27
    ]) {
        agregarObstaculo(x, -26.5, 2.8, 1.15);
    }

    // ========================================================
    // COLISIONES
    // ========================================================

    function colisiona(x, z, radio = config.radioColision) {
        if (
            x < LIMITES.minX + radio ||
            x > LIMITES.maxX - radio ||
            z < LIMITES.minZ + radio ||
            z > LIMITES.maxZ - radio
        ) {
            return true;
        }

        for (const o of obstaculos) {
            if (
                x + radio > o.minX &&
                x - radio < o.maxX &&
                z + radio > o.minZ &&
                z - radio < o.maxZ
            ) {
                return true;
            }
        }

        return false;
    }

    function transitable(x, z) {
        return !colisiona(x, z, config.radioColision + 0.05);
    }

    function lineaLibre(a, b) {
        const distancia = distancia2D(a, b);
        const pasos = Math.max(1, Math.ceil(distancia / 0.35));

        for (let i = 1; i <= pasos; i++) {
            const t = i / pasos;

            const x = THREE.MathUtils.lerp(a.x, b.x, t);
            const z = THREE.MathUtils.lerp(a.z, b.z, t);

            if (!transitable(x, z)) return false;
        }

        return true;
    }

    // ========================================================
    // NAVEGACIÓN A*
    // ========================================================

    const columnas = Math.floor(
        (LIMITES.maxX - LIMITES.minX - 2) / PASO_RUTA
    ) + 1;

    const filas = Math.floor(
        (LIMITES.maxZ - LIMITES.minZ - 2) / PASO_RUTA
    ) + 1;

    function nodo(ix, iz) {
        return {
            x: LIMITES.minX + 1 + ix * PASO_RUTA,
            z: LIMITES.minZ + 1 + iz * PASO_RUTA,
            ix,
            iz
        };
    }

    function clave(ix, iz) {
        return `${ix},${iz}`;
    }

    function nodoValido(ix, iz) {
        if (
            ix < 0 || iz < 0 ||
            ix >= columnas || iz >= filas
        ) return false;

        const p = nodo(ix, iz);
        return transitable(p.x, p.z);
    }

    function nodoCercano(x, z) {
        const ixCentro = THREE.MathUtils.clamp(
            Math.round((x - LIMITES.minX - 1) / PASO_RUTA),
            0,
            columnas - 1
        );

        const izCentro = THREE.MathUtils.clamp(
            Math.round((z - LIMITES.minZ - 1) / PASO_RUTA),
            0,
            filas - 1
        );

        let mejor = null;
        let mejorDistancia = Infinity;

        for (let radio = 0; radio <= 9 && !mejor; radio++) {
            for (
                let iz = Math.max(0, izCentro - radio);
                iz <= Math.min(filas - 1, izCentro + radio);
                iz++
            ) {
                for (
                    let ix = Math.max(0, ixCentro - radio);
                    ix <= Math.min(columnas - 1, ixCentro + radio);
                    ix++
                ) {
                    if (!nodoValido(ix, iz)) continue;

                    const p = nodo(ix, iz);
                    const d = Math.hypot(p.x - x, p.z - z);

                    if (d < mejorDistancia) {
                        mejorDistancia = d;
                        mejor = p;
                    }
                }
            }
        }

        return mejor;
    }

    function heuristica(a, b) {
        const dx = Math.abs(a.ix - b.ix);
        const dz = Math.abs(a.iz - b.iz);

        return Math.max(dx, dz) +
            (Math.SQRT2 - 1) * Math.min(dx, dz);
    }

    function buscarCamino(inicio, destino) {
        if (!inicio || !destino) return [];

        const a = nodoCercano(inicio.x, inicio.z);
        const b = nodoCercano(destino.x, destino.z);

        if (!a || !b) return [];

        const ka = clave(a.ix, a.iz);
        const kb = clave(b.ix, b.iz);

        if (ka === kb) {
            if (
                transitable(destino.x, destino.z) &&
                lineaLibre(a, destino)
            ) {
                return [{ x: destino.x, z: destino.z }];
            }

            return [];
        }

        const abiertos = new ColaPrioridad();
        const anterior = new Map();
        const costo = new Map();
        const cerrados = new Set();

        costo.set(ka, 0);
        abiertos.insertar(ka, heuristica(a, b));

        let iteraciones = 0;
        const maxIteraciones = columnas * filas * 3;

        while (
            abiertos.length &&
            iteraciones++ < maxIteraciones
        ) {
            const elemento = abiertos.extraer();
            if (!elemento) break;

            const actual = elemento.elemento;

            if (cerrados.has(actual)) continue;

            if (actual === kb) {
                const camino = [];
                let k = actual;

                while (k && k !== ka) {
                    const [ix, iz] = k.split(',').map(Number);
                    camino.unshift(nodo(ix, iz));
                    k = anterior.get(k);
                }

                const suave = [];
                let origen = a;
                let indice = 0;

                while (indice < camino.length) {
                    let mejor = indice;

                    for (let j = camino.length - 1; j > indice; j--) {
                        if (lineaLibre(origen, camino[j])) {
                            mejor = j;
                            break;
                        }
                    }

                    const punto = camino[mejor];

                    suave.push({ x: punto.x, z: punto.z });
                    origen = punto;
                    indice = mejor + 1;
                }

                if (
                    transitable(destino.x, destino.z) &&
                    lineaLibre(origen, destino)
                ) {
                    suave.push({ x: destino.x, z: destino.z });
                }

                return suave;
            }

            cerrados.add(actual);

            const [ix, iz] = actual.split(',').map(Number);
            const gActual = costo.get(actual);

            for (const [dx, dz, peso] of DIRECCIONES) {
                const nx = ix + dx;
                const nz = iz + dz;

                if (!nodoValido(nx, nz)) continue;

                if (dx !== 0 && dz !== 0) {
                    if (
                        !nodoValido(ix + dx, iz) ||
                        !nodoValido(ix, iz + dz)
                    ) continue;
                }

                const nk = clave(nx, nz);

                if (cerrados.has(nk)) continue;

                const nuevoCosto = gActual + peso;

                if (nuevoCosto >= (costo.get(nk) ?? Infinity)) {
                    continue;
                }

                anterior.set(nk, actual);
                costo.set(nk, nuevoCosto);

                abiertos.insertar(
                    nk,
                    nuevoCosto + heuristica(nodo(nx, nz), b)
                );
            }
        }

        return [];
    }

    // ========================================================
    // DESTINOS
    // ========================================================

    function destinoAleatorioZona() {
        for (let i = 0; i < 80; i++) {
            const x = numeroAleatorio(
                zonaPersonal.minX,
                zonaPersonal.maxX
            );

            const z = numeroAleatorio(
                zonaPersonal.minZ,
                zonaPersonal.maxZ
            );

            if (transitable(x, z)) return { x, z };
        }

        return {
            x: (zonaPersonal.minX + zonaPersonal.maxX) / 2,
            z: (zonaPersonal.minZ + zonaPersonal.maxZ) / 2
        };
    }

    function destinoAleatorioGeneral() {
        for (let i = 0; i < 80; i++) {
            const x = numeroAleatorio(-27, 27);
            const z = numeroAleatorio(-24, 24);

            if (transitable(x, z)) return { x, z };
        }

        return { x: 0, z: 18 };
    }

    function buscarDestinoLibre() {
        const inicio = {
            x: grupo.position.x,
            z: grupo.position.z
        };

        for (let intento = 0; intento < 35; intento++) {
            let destino;

            if (esLadron && rutaPersonalizada.length) {
                if (indiceRutaPersonalizada >= rutaPersonalizada.length) {
                    indiceRutaPersonalizada = 0;
                }

                destino = rutaPersonalizada[indiceRutaPersonalizada++];
            } else {
                destino = destinoAleatorioZona();

                if (Math.random() < 0.28) {
                    destino = destinoAleatorioGeneral();
                }
            }

            if (!destino || !transitable(destino.x, destino.z)) {
                continue;
            }

            const camino = buscarCamino(inicio, destino);

            if (camino.length) {
                return { destino, camino };
            }
        }

        return null;
    }

    function asignarDestino() {
        const resultado = buscarDestinoLibre();

        if (!resultado) {
            objetivoActual = null;
            rutaActual = [];
            indiceRuta = 0;
            tiempoReintento = 0.7;
            return false;
        }

        objetivoActual = resultado.destino;
        rutaActual = resultado.camino;
        indiceRuta = 0;

        return true;
    }

    // ========================================================
    // ENVIAR A CAJA
    // ========================================================

    function iniciarPago(posicion = config.posicionCaja, alTerminar = null) {
        if (eliminado || esLadron || pagoConfirmado) return false;

        if (
            estado === 'yendoCaja' ||
            estado === 'pagando' ||
            estado === 'pagoTerminado'
        ) {
            return false;
        }

        liberarReserva();

        const destino = {
            x: Number(posicion?.x ?? 0),
            z: Number(posicion?.z ?? 20)
        };

        if (!Number.isFinite(destino.x) || !Number.isFinite(destino.z)) {
            return false;
        }

        const inicio = {
            x: grupo.position.x,
            z: grupo.position.z
        };

        const ruta = buscarCamino(inicio, destino);

        if (!ruta.length) {
            console.warn(`Cliente ${id}: no se encontró ruta hacia la caja.`);
            return false;
        }

        posicionCaja = destino;
        callbackPago =
            typeof alTerminar === 'function' ? alTerminar : null;

        pagoConfirmado = false;
        resumenPago = null;
        tiempoAnimacionPago = 0;

        detenido = false;
        estado = 'yendoCaja';
        tiempoEstado = 0;

        rutaActual = ruta;
        indiceRuta = 0;
        objetivoActual = destino;

        return true;
    }

    function iniciarAnimacionPago() {
        if (estado !== 'yendoCaja') return;

        estado = 'pagando';
        tiempoEstado = 0;
        tiempoAnimacionPago = 0;

        rutaActual = [];
        indiceRuta = 0;
        objetivoActual = null;

        grupo.rotation.y = Math.atan2(
            posicionCaja.x - grupo.position.x,
            posicionCaja.z - grupo.position.z
        );
    }

    function finalizarPago() {
        if (pagoConfirmado || eliminado) return;

        pagoConfirmado = true;

        resumenPago = confirmarCompra();

        estado = 'pagoTerminado';
        tiempoEstado = 0;

        console.info(
            `Cliente ${id}: compra confirmada`,
            resumenPago
        );

        const callback = callbackPago;
        callbackPago = null;

        if (callback) {
            try {
                callback(resumenPago);
            } catch (error) {
                console.error('Error en callback de pago:', error);
            }
        }
    }

    // ========================================================
    // POSICIÓN
    // ========================================================

    function establecerPosicion(posicion) {
        if (!posicion) return false;

        const x = Number(posicion.x ?? grupo.position.x);
        const y = Number(posicion.y ?? grupo.position.y);
        const z = Number(posicion.z ?? grupo.position.z);

        if (![x, y, z].every(Number.isFinite)) return false;

        grupo.position.set(x, y, z);
        ultimaPosicion.copy(grupo.position);

        rutaActual = [];
        indiceRuta = 0;
        objetivoActual = null;
        tiempoAtascado = 0;

        return true;
    }

    // ========================================================
    // ENTRADA Y SALIDA DEL ESTACIONAMIENTO
    // ========================================================

    function iniciarDesdeVehiculo(posicion, plaza = null) {
        if (eliminado || !posicion) return;

        establecerPosicion(posicion);

        detenido = false;
        estado = 'llegando';
        tiempoEstado = 0;
        tiempoCompra = 0;
        yaEntro = false;
        pagoConfirmado = false;
        resumenPago = null;

        const x = Number(plaza?.x ?? posicion.x);
        const z = Number(plaza?.z ?? posicion.z);

        rutaExterior = [
            { x, z: z + 3 },
            { x: 30.5, z: z + 3 },
            { x: 30.5, z: 34 },
            { x: 8, z: 34 },
            { x: 0, z: 32 },
            { x: 0, z: 27.5 }
        ];

        indiceRutaExterior = 0;
        rutaActual = [];
        objetivoActual = null;
    }

    function iniciarRegresoVehiculo(plaza, alTerminar = null) {
        if (eliminado || !plaza) return false;

        liberarReserva();

        detenido = false;
        estado = 'regresando';
        tiempoEstado = 0;

        rutaExterior = [
            { x: 0, z: 25.5 },
            { x: 0, z: 30.5 },
            { x: 8, z: 34 },
            { x: 30.5, z: 34 },
            { x: 30.5, z: Number(plaza.z) + 3 },
            { x: Number(plaza.x), z: Number(plaza.z) + 3 },
            { x: Number(plaza.x), z: Number(plaza.z) }
        ];

        indiceRutaExterior = 0;

        callbackRegreso =
            typeof alTerminar === 'function' ? alTerminar : null;

        return true;
    }

    function terminarLlegada() {
        estado = 'caminando';
        tiempoEstado = 0;
        tiempoCompra = 0;
        yaEntro = true;

        grupo.position.x = THREE.MathUtils.clamp(
            grupo.position.x, -27, 27
        );

        grupo.position.z = THREE.MathUtils.clamp(
            grupo.position.z, -25, 26
        );

        if (typeof callbackEntrada === 'function') {
            try {
                callbackEntrada(api);
            } catch (error) {
                console.error('Error en callback alEntrar:', error);
            }
        }

        asignarDestino();
    }

    function terminarRegreso() {
        estado = 'esperando';
        detenido = true;

        const callback = callbackRegreso;
        callbackRegreso = null;

        if (callback) callback(api);
    }

    function avanzarExterior(delta) {
        const punto = rutaExterior[indiceRutaExterior];

        if (!punto) {
            if (estado === 'regresando') terminarRegreso();
            else terminarLlegada();

            return;
        }

        const dx = punto.x - grupo.position.x;
        const dz = punto.z - grupo.position.z;
        const distancia = Math.hypot(dx, dz);

        if (distancia < 0.55) {
            indiceRutaExterior++;

            if (indiceRutaExterior >= rutaExterior.length) {
                if (estado === 'regresando') terminarRegreso();
                else terminarLlegada();
            }

            return;
        }

        const paso = Math.min(
            Math.max(0.1, config.velocidad) * delta,
            distancia
        );

        grupo.rotation.y = Math.atan2(dx, dz);
        grupo.position.x += dx / distancia * paso;
        grupo.position.z += dz / distancia * paso;
    }

    // ========================================================
    // COMPRAS Y PRODUCTOS
    // ========================================================

    function configurarCompras(opcionesCompra = {}) {
        const fuente = opcionesCompra.productos ?? null;

        productosGrupo =
            fuente?.grupo ??
            fuente?.group ??
            fuente;

        carrito = opcionesCompra.carrito ?? null;

        callbackRecoger =
            typeof opcionesCompra.alRecoger === 'function'
                ? opcionesCompra.alRecoger
                : null;

        tiempoCompra = 0;
        productosVisitados.clear();
        productosRechazados.clear();

        console.info(
            `Cliente ${id} | Zona: ${zonaPersonal.nombre}`,
            '| Productos:', Boolean(productosGrupo?.traverse),
            '| Carrito:', Boolean(carrito?.grupo)
        );
    }

    function obtenerClaveProducto(objeto) {
        const datos = objeto?.userData ?? {};

        return normalizarCodigo(
            datos.idUnidadProducto ??
            datos.codigoProducto ??
            objeto?.uuid ??
            objeto?.name
        );
    }

    function listarProductosDisponibles() {
        if (!productosGrupo?.traverse) return [];

        const lista = [];

        productosGrupo.traverse(objeto => {
            if (
                objeto === productosGrupo ||
                !objeto.isObject3D ||
                !objeto.visible ||
                objeto.userData.esUnidadProducto !== true ||
                objeto.userData.recogido ||
                objeto.userData.vendido ||
                objeto.userData.reservado ||
                productosVisitados.has(objeto.uuid)
            ) return;

            const claveProducto = obtenerClaveProducto(objeto);

            if (!claveProducto) return;

            if (productosCompradosGlobal.has(claveProducto)) return;

            const reserva = productosReservadosGlobal.get(objeto.uuid);

            if (reserva && reserva !== id) return;

            const rechazoHasta = productosRechazados.get(objeto.uuid);

            if (rechazoHasta && performance.now() < rechazoHasta) {
                return;
            }

            if (rechazoHasta) {
                productosRechazados.delete(objeto.uuid);
            }

            lista.push(objeto);
        });

        return lista;
    }

    function obtenerPosicionesAproximacion(producto) {
        producto.updateWorldMatrix(true, false);
        producto.getWorldPosition(centroTemporal);

        const posiciones = [];

        const direcciones = [
            [1, 0], [-1, 0], [0, 1], [0, -1],
            [0.707, 0.707], [-0.707, 0.707],
            [0.707, -0.707], [-0.707, -0.707]
        ];

        for (const radio of [1.1, 1.6, 2.1, 2.5]) {
            for (const [dx, dz] of direcciones) {
                const x = centroTemporal.x + dx * radio;
                const z = centroTemporal.z + dz * radio;

                if (transitable(x, z)) {
                    posiciones.push({ x, z });
                }
            }
        }

        return posiciones;
    }

    function calcularRutaHastaProducto(producto) {
        if (!producto) return null;

        const posiciones = obtenerPosicionesAproximacion(producto);

        if (!posiciones.length) return null;

        const inicio = {
            x: grupo.position.x,
            z: grupo.position.z
        };

        let mejor = null;
        let mejorCosto = Infinity;

        for (const destino of posiciones) {
            const ruta = buscarCamino(inicio, destino);

            if (!ruta.length) continue;

            let longitud = 0;
            let anterior = inicio;

            for (const punto of ruta) {
                longitud += distancia2D(anterior, punto);
                anterior = punto;
            }

            if (longitud < mejorCosto) {
                mejorCosto = longitud;
                mejor = { ruta, destino, longitud };
            }
        }

        return mejor;
    }

    function productoDentroDeZona(producto) {
        producto.updateWorldMatrix(true, false);
        producto.getWorldPosition(centroTemporal);

        return (
            centroTemporal.x >= zonaPersonal.minX &&
            centroTemporal.x <= zonaPersonal.maxX &&
            centroTemporal.z >= zonaPersonal.minZ &&
            centroTemporal.z <= zonaPersonal.maxZ
        );
    }

    function buscarProductoAlcanzable() {
        if (
            !productosGrupo ||
            estado !== 'caminando' ||
            contadorCompras >= config.maxCompras
        ) return false;

        const disponibles = listarProductosDisponibles();

        if (!disponibles.length) return false;

        const productosZona = disponibles.filter(productoDentroDeZona);

        const candidatos = productosZona.length
            ? productosZona
            : disponibles;

        const posicion = {
            x: grupo.position.x,
            z: grupo.position.z
        };

        candidatos.sort((a, b) => {
            a.updateWorldMatrix(true, false);
            b.updateWorldMatrix(true, false);

            const pa = a.getWorldPosition(new THREE.Vector3());
            const pb = b.getWorldPosition(new THREE.Vector3());

            return distancia2D(posicion, pa) -
                distancia2D(posicion, pb);
        });

        const limite = Math.min(
            candidatos.length,
            config.maxProductosPorBusqueda
        );

        const resultados = [];

        for (let i = 0; i < limite; i++) {
            const producto = candidatos[i];

            const reserva = productosReservadosGlobal.get(producto.uuid);

            if (reserva && reserva !== id) continue;

            const resultado = calcularRutaHastaProducto(producto);

            if (!resultado) continue;

            const distanciaZona = productoDentroDeZona(producto) ? 0 : 4;

            resultados.push({
                producto,
                resultado,
                puntuacion: resultado.longitud + distanciaZona
            });
        }

        if (!resultados.length) return false;

        resultados.sort((a, b) =>
            a.puntuacion - b.puntuacion
        );

        const mejores = resultados.slice(
            0,
            Math.min(3, resultados.length)
        );

        const elegido = mejores[
            Math.floor(Math.random() * mejores.length)
        ];

        productoObjetivo = elegido.producto;

        productosReservadosGlobal.set(
            productoObjetivo.uuid,
            id
        );

        productoObjetivo.userData.reservado = true;
        productoObjetivo.userData.reservadoPor = id;

        rutaActual = elegido.resultado.ruta;
        indiceRuta = 0;
        objetivoActual = elegido.resultado.destino;
        estado = 'yendoProducto';

        return true;
    }

    function liberarObjetivoProducto() {
        if (!productoObjetivo) return;

        if (productosReservadosGlobal.get(productoObjetivo.uuid) === id) {
            productosReservadosGlobal.delete(productoObjetivo.uuid);
        }

        productoObjetivo.userData.reservado = false;
        productoObjetivo.userData.reservadoPor = null;

        productoObjetivo = null;
    }

    // ========================================================
    // PRODUCTO EN MANO
    // ========================================================

    function obtenerAnclaMano() {
        if (anclaMano) return anclaMano;
        if (!modelo) return null;

        modelo.traverse(objeto => {
            if (!objeto.isBone || anclaMano) return;

            const nombre = normalizarCodigo(objeto.name);

            if (
                nombre.includes('hand') &&
                (
                    nombre.includes('right') ||
                    nombre.endsWith('r')
                )
            ) {
                anclaMano = objeto;
            }
        });

        return anclaMano;
    }

    function crearCopiaVisual(producto) {
        const copia = producto.clone(true);

        copia.position.set(0, 0, 0);
        copia.rotation.set(0, 0, 0);
        copia.scale.copy(producto.scale);

        copia.updateMatrixWorld(true);

        const caja = new THREE.Box3().setFromObject(copia);
        const tam = new THREE.Vector3();

        caja.getSize(tam);

        if (!caja.isEmpty()) {
            const factor = Math.min(
                1,
                0.2 / Math.max(tam.x, 0.001),
                0.23 / Math.max(tam.y, 0.001),
                0.2 / Math.max(tam.z, 0.001)
            );

            copia.scale.multiplyScalar(factor);
        }

        return copia;
    }

    function colocarProductoEnMano(producto) {
        if (!producto || productoEnMano) return false;

        productoEnMano = crearCopiaVisual(producto);
        productoEnMano.name = `PRODUCTO_EN_MANO_${id}`;

        const mano = obtenerAnclaMano();

        if (mano) {
            mano.add(productoEnMano);
            productoEnMano.position.set(0, 0, 0.09);
        } else {
            contenedorModelo.add(productoEnMano);
            productoEnMano.position.set(0.32, 1.05, 0.22);
        }

        producto.visible = false;

        return true;
    }

    function retirarProductoDeMano() {
        if (!productoEnMano) return null;

        const objeto = productoEnMano;
        objeto.parent?.remove(objeto);
        productoEnMano = null;

        return objeto;
    }

    function devolverProductoAlEstante() {
        retirarProductoDeMano();

        if (!productoEnExamen) return;

        const producto = productoEnExamen;

        producto.visible = true;
        producto.userData.recogido = false;
        producto.userData.reservado = false;
        producto.userData.reservadoPor = null;

        productosRechazados.set(
            producto.uuid,
            performance.now() + 12000
        );

        if (productosReservadosGlobal.get(producto.uuid) === id) {
            productosReservadosGlobal.delete(producto.uuid);
        }

        productoEnExamen = null;
    }

    function liberarReserva() {
        liberarObjetivoProducto();

        if (productoEnExamen) {
            devolverProductoAlEstante();
        } else {
            retirarProductoDeMano();
        }
    }

    // ========================================================
    // AGREGAR PRODUCTO AL CARRITO
    // ========================================================

    function agregarAlCarrito(producto) {
        if (
            !producto ||
            producto.userData.recogido ||
            producto.userData.vendido ||
            !carrito?.grupo
        ) return false;

        const claveProducto = obtenerClaveProducto(producto);

        if (
            !claveProducto ||
            productosCompradosGlobal.has(claveProducto)
        ) return false;

        const copia = productoEnMano
            ? retirarProductoDeMano()
            : crearCopiaVisual(producto);

        if (!copia) return false;

        contadorCompras++;

        copia.name = `ARTICULO_CARRITO_${id}_${contadorCompras}`;

        const indice = (contadorCompras - 1) % MAX_ARTICULOS_VISIBLES;

        copia.position.set(
            ((indice % 4) - 1.5) * 0.12,
            0.6 + Math.floor(indice / 12) * 0.18,
            (Math.floor((indice % 12) / 4) - 1) * 0.13
        );

        copia.rotation.set(0, 0, 0);
        copia.userData.esArticuloCarrito = true;
        copia.userData.nombreProducto =
            producto.userData.nombreVisible ??
            producto.userData.nombreProducto ??
            producto.name;

        copia.userData.codigoProducto = claveProducto;
        copia.userData.codigoCatalogo =
            producto.userData.codigoCatalogo ?? '';

        copia.userData.precio =
            Number(producto.userData.precio ?? 0);

        copia.userData.idProductoOriginal = producto.uuid;

        if (articulosEnCarrito.length >= MAX_ARTICULOS_VISIBLES) {
            const viejo = articulosEnCarrito.shift();
            viejo?.parent?.remove(viejo);
        }

        carrito.grupo.add(copia);
        articulosEnCarrito.push(copia);

        productosCompradosGlobal.add(claveProducto);

        producto.userData.recogido = true;
        producto.userData.disponible = false;
        producto.userData.reservado = false;
        producto.userData.reservadoPor = null;
        producto.visible = false;

        if (productosReservadosGlobal.get(producto.uuid) === id) {
            productosReservadosGlobal.delete(producto.uuid);
        }

        productosVisitados.add(producto.uuid);

        const datos = {
            id: producto.uuid,
            idUnidadProducto: producto.userData.idUnidadProducto ?? null,
            idCliente: id,
            nombre: producto.userData.nombreVisible ??
                producto.userData.nombreProducto ??
                producto.name,
            codigoProducto: claveProducto,
            codigoCatalogo: producto.userData.codigoCatalogo ?? '',
            precio: Number(producto.userData.precio ?? 0),
            numeroCompra: contadorCompras
        };

        if (callbackRecoger) {
            try {
                callbackRecoger(datos);
            } catch (error) {
                console.error('Error en callback de producto:', error);
            }
        }

        return true;
    }

    // ========================================================
    // EXAMINAR PRODUCTO
    // ========================================================

    function iniciarExamen(producto) {
        if (
            !producto ||
            productoEnExamen ||
            producto.userData.recogido ||
            producto.userData.vendido
        ) {
            liberarObjetivoProducto();
            return;
        }

        const reserva = productosReservadosGlobal.get(producto.uuid);

        if (reserva && reserva !== id) {
            liberarObjetivoProducto();
            estado = 'caminando';
            asignarDestino();
            return;
        }

        productoEnExamen = producto;
        productoObjetivo = null;

        productosReservadosGlobal.set(producto.uuid, id);

        producto.userData.reservado = true;
        producto.userData.reservadoPor = id;

        producto.updateWorldMatrix(true, false);
        producto.getWorldPosition(centroTemporal);

        grupo.rotation.y = Math.atan2(
            centroTemporal.x - grupo.position.x,
            centroTemporal.z - grupo.position.z
        );

        colocarProductoEnMano(producto);

        estado = 'examinando';
        tiempoEstado = 0;
        rutaActual = [];
        indiceRuta = 0;
        objetivoActual = null;
    }

    function comprobarLlegadaProducto() {
        if (!productoObjetivo) {
            estado = 'caminando';
            asignarDestino();
            return;
        }

        const producto = productoObjetivo;

        if (
            producto.userData.recogido ||
            producto.userData.vendido ||
            !producto.visible
        ) {
            liberarObjetivoProducto();
            estado = 'caminando';
            asignarDestino();
            return;
        }

        producto.updateWorldMatrix(true, false);
        producto.getWorldPosition(centroTemporal);

        const distancia = Math.hypot(
            centroTemporal.x - grupo.position.x,
            centroTemporal.z - grupo.position.z
        );

        if (distancia <= config.distanciaRecoger + 0.45) {
            iniciarExamen(producto);
            return;
        }

        const nuevaRuta = calcularRutaHastaProducto(producto);

        if (nuevaRuta?.ruta.length) {
            objetivoActual = nuevaRuta.destino;
            rutaActual = nuevaRuta.ruta;
            indiceRuta = 0;
        } else {
            liberarObjetivoProducto();
            estado = 'caminando';
            tiempoReintento = 0.8;
            asignarDestino();
        }
    }

    function finalizarExamen() {
        if (!productoEnExamen) {
            estado = 'caminando';
            asignarDestino();
            return;
        }

        const producto = productoEnExamen;

        const comprar =
            Math.random() <= THREE.MathUtils.clamp(
                config.probabilidadCompra, 0, 1
            );

        let compraRealizada = false;

        if (comprar && carrito?.grupo) {
            compraRealizada = agregarAlCarrito(producto);
        }

        if (compraRealizada) {
            productoEnExamen = null;
        } else {
            devolverProductoAlEstante();
        }

        estado = 'caminando';
        tiempoEstado = 0;
        tiempoCompra = 0;
        objetivoActual = null;
        rutaActual = [];
        indiceRuta = 0;

        tiempoReintento = 0.6;
        asignarDestino();
    }

    // ========================================================
    // EVITAR QUE LOS CLIENTES SE AMONTONEN
    // ========================================================

    function calcularSeparacion() {
        const fuerza = new THREE.Vector3();

        for (const otro of clientesActivos) {
            if (
                otro === api ||
                otro.eliminado ||
                !otro.grupo ||
                otro.estado === 'esperando' ||
                otro.estado === 'llegando' ||
                otro.estado === 'regresando'
            ) continue;

            const dx = grupo.position.x - otro.grupo.position.x;
            const dz = grupo.position.z - otro.grupo.position.z;
            const distancia = Math.hypot(dx, dz);

            if (
                distancia > 0.001 &&
                distancia < DISTANCIA_CLIENTES
            ) {
                const intensidad =
                    (DISTANCIA_CLIENTES - distancia) /
                    DISTANCIA_CLIENTES;

                fuerza.x += dx / distancia * intensidad;
                fuerza.z += dz / distancia * intensidad;
            }
        }

        return fuerza;
    }

    // ========================================================
    // MOVIMIENTO INTERIOR
    // ========================================================

    function avanzarInterior(delta) {
        if (
            !rutaActual.length ||
            indiceRuta >= rutaActual.length
        ) {
            if (estado === 'yendoProducto') {
                comprobarLlegadaProducto();
            } else if (estado === 'yendoCaja') {
                iniciarAnimacionPago();
            } else if (!asignarDestino()) {
                tiempoReintento = 0.7;
            }

            return;
        }

        const punto = rutaActual[indiceRuta];

        const dx = punto.x - grupo.position.x;
        const dz = punto.z - grupo.position.z;
        const distancia = Math.hypot(dx, dz);

        if (distancia < config.distanciaDestino) {
            indiceRuta++;

            if (indiceRuta >= rutaActual.length) {
                rutaActual = [];
                indiceRuta = 0;
                objetivoActual = null;

                if (estado === 'yendoProducto') {
                    comprobarLlegadaProducto();
                } else if (estado === 'yendoCaja') {
                    iniciarAnimacionPago();
                } else {
                    tiempoCompra = Math.max(
                        tiempoCompra,
                        config.pausaEntreCompras
                    );
                }
            }

            return;
        }

        const separacion = calcularSeparacion();

        let vx = dx / distancia + separacion.x * 0.85;
        let vz = dz / distancia + separacion.z * 0.85;

        const longitud = Math.hypot(vx, vz) || 1;

        vx /= longitud;
        vz /= longitud;

        const paso = Math.min(
            Math.max(0.2, config.velocidad) * delta,
            distancia
        );

        const xAnterior = grupo.position.x;
        const zAnterior = grupo.position.z;

        const nx = xAnterior + vx * paso;
        const nz = zAnterior + vz * paso;

        let movio = false;

        if (!colisiona(nx, nz)) {
            grupo.position.x = nx;
            grupo.position.z = nz;
            movio = true;
        } else if (!colisiona(nx, zAnterior)) {
            grupo.position.x = nx;
            movio = true;
        } else if (!colisiona(xAnterior, nz)) {
            grupo.position.z = nz;
            movio = true;
        }

        if (movio) {
            grupo.rotation.y = Math.atan2(vx, vz);
        }

        const desplazamiento = distancia2D(
            grupo.position,
            ultimaPosicion
        );

        if (!movio || desplazamiento < 0.012) {
            tiempoAtascado += delta;
        } else {
            tiempoAtascado = 0;
        }

        ultimaPosicion.copy(grupo.position);

        if (tiempoAtascado > 1.1) {
            tiempoAtascado = 0;
            rutaActual = [];
            indiceRuta = 0;
            objetivoActual = null;

            if (estado === 'yendoProducto' && productoObjetivo) {
                const nuevaRuta = calcularRutaHastaProducto(
                    productoObjetivo
                );

                if (nuevaRuta?.ruta.length) {
                    rutaActual = nuevaRuta.ruta;
                    indiceRuta = 0;
                    objetivoActual = nuevaRuta.destino;
                } else {
                    liberarObjetivoProducto();
                    estado = 'caminando';
                    tiempoReintento = 0.8;
                    asignarDestino();
                }
            } else if (estado === 'yendoCaja') {
                const nuevaRuta = buscarCamino(
                    {
                        x: grupo.position.x,
                        z: grupo.position.z
                    },
                    posicionCaja
                );

                if (nuevaRuta.length) {
                    rutaActual = nuevaRuta;
                    indiceRuta = 0;
                    objetivoActual = posicionCaja;
                } else {
                    console.warn(`Cliente ${id}: bloqueado al dirigirse a caja.`);
                }
            } else if (!asignarDestino()) {
                tiempoReintento = 0.8;
            }
        }
    }

    // ========================================================
    // ANIMACIÓN MANUAL DEL ESQUELETO
    // ========================================================

    function registrarHuesos() {
        if (!modelo) return;

        modelo.traverse(objeto => {
            if (!objeto.isBone) return;

            const nombre = normalizarCodigo(objeto.name);

            rotacionesBase.set(objeto, objeto.rotation.clone());

            let lado = null;

            if (nombre.includes('left') || nombre.endsWith('l')) {
                lado = 'L';
            } else if (nombre.includes('right') || nombre.endsWith('r')) {
                lado = 'R';
            }

            if (!lado) return;

            if (/thigh|upleg|upperleg/.test(nombre)) {
                huesos[`thigh${lado}`] = objeto;
            } else if (/shin|calf|lowerleg/.test(nombre)) {
                huesos[`shin${lado}`] = objeto;
            } else if (/upperarm|armupper/.test(nombre)) {
                huesos[`arm${lado}`] = objeto;
            } else if (/forearm|lowerarm/.test(nombre)) {
                huesos[`forearm${lado}`] = objeto;
            }
        });

        obtenerAnclaMano();
    }

    function animarManual(delta) {
        if (!modelo) return;

        const caminando = [
            'caminando',
            'yendoProducto',
            'llegando',
            'regresando',
            'yendoCaja'
        ].includes(estado);

        faseCaminar += delta * (caminando ? 8 : 2);

        const balanceo = Math.sin(faseCaminar) *
            (caminando ? 0.48 : 0.02);

        function rotar(nombre, valor) {
            const hueso = huesos[nombre];
            const base = hueso && rotacionesBase.get(hueso);

            if (!hueso || !base) return;

            hueso.rotation.x = base.x + valor;
        }

        rotar('thighL', balanceo);
        rotar('thighR', -balanceo);

        rotar('shinL', Math.max(0, -balanceo) * 0.65);
        rotar('shinR', Math.max(0, balanceo) * 0.65);

        if (estado === 'pagando') {
            const movimiento = Math.sin(faseCaminar * 2.8);

            rotar('armR', -0.85 + movimiento * 0.18);
            rotar('forearmR', -1.15 + Math.abs(movimiento) * 0.35);

            rotar('armL', -0.75 - movimiento * 0.18);
            rotar('forearmL', -1.05 + Math.abs(movimiento) * 0.30);

        } else if (estado === 'examinando') {
            rotar('armR', -0.95);
            rotar('forearmR', -0.8);
            rotar('armL', -0.25);
            rotar('forearmL', -0.45);
        } else {
            rotar('armL', -balanceo * 0.6);
            rotar('armR', balanceo * 0.6);
            rotar('forearmL', 0);
            rotar('forearmR', 0);
        }
    }

    // ========================================================
    // CARGAR MODELO
    // ========================================================

    loader.load(
        config.modelo,
        gltf => {
            if (eliminado) return;

            modelo = gltf.scene;
            modelo.name = `CLIENTE_SUPERMERCADO_RIG_${id}`;

            modelo.scale.setScalar(config.escala);
            modelo.updateMatrixWorld(true);

            const caja = new THREE.Box3().setFromObject(modelo);

            if (!caja.isEmpty()) {
                modelo.position.y -= caja.min.y;
            }

            modelo.traverse(objeto => {
                if (!objeto.isMesh) return;

                objeto.castShadow = false;
                objeto.receiveShadow = false;
            });

            contenedorModelo.add(modelo);

            registrarHuesos();
            cargado = true;

            console.info(
                `Cliente ${id} cargado. Zona asignada: ${zonaPersonal.nombre}`
            );
        },
        undefined,
        error => {
            console.error(
                `No se pudo cargar ${config.modelo}. Comprueba que exista en public.`,
                error
            );
        }
    );

    // ========================================================
    // ACTUALIZACIÓN
    // ========================================================

    function actualizar(delta) {
        if (
            eliminado ||
            detenido ||
            !Number.isFinite(delta) ||
            delta <= 0
        ) return;

        const dt = Math.min(delta, 0.05);

        tiempoEstado += dt;
        tiempoCompra += dt;

        if (estado === 'esperando') return;

        if (estado === 'llegando' || estado === 'regresando') {
            avanzarExterior(dt);
            animarManual(dt);
            return;
        }

        if (estado === 'examinando') {
            if (productoEnExamen) {
                productoEnExamen.updateWorldMatrix(true, false);
                productoEnExamen.getWorldPosition(centroTemporal);

                grupo.rotation.y = Math.atan2(
                    centroTemporal.x - grupo.position.x,
                    centroTemporal.z - grupo.position.z
                );
            }

            if (tiempoEstado >= config.tiempoExaminar) {
                finalizarExamen();
            }

            animarManual(dt);
            return;
        }

        // El cliente permanece en la caja durante la simulación del pago.
        if (estado === 'pagando') {
            tiempoAnimacionPago += dt;
            animarManual(dt);

            if (tiempoAnimacionPago >= config.tiempoDuracionPago) {
                finalizarPago();
            }

            return;
        }

        // El cliente espera a que main.js reciba el ticket y ordene su regreso.
        if (estado === 'pagoTerminado') {
            animarManual(dt);
            return;
        }

        if (
            estado === 'caminando' ||
            estado === 'yendoProducto' ||
            estado === 'yendoCaja'
        ) {
            avanzarInterior(dt);
        }

        if (tiempoReintento > 0) {
            tiempoReintento = Math.max(0, tiempoReintento - dt);
        }

        if (
            !esLadron &&
            estado === 'caminando' &&
            productosGrupo?.traverse &&
            carrito?.grupo &&
            contadorCompras < config.maxCompras &&
            tiempoCompra >= config.pausaEntreCompras &&
            tiempoReintento <= 0
        ) {
            const encontro = buscarProductoAlcanzable();

            tiempoCompra = 0;

            if (!encontro) {
                tiempoReintento = config.tiempoReintento;
            }
        }

        if (
            estado === 'caminando' &&
            !objetivoActual &&
            !rutaActual.length &&
            tiempoReintento <= 0
        ) {
            asignarDestino();
        }

        animarManual(dt);
    }

    // ========================================================
    // ANIMACIÓN
    // ========================================================

    function detenerAnimacion() {
        detenido = true;
    }

    function reproducirAnimacion() {
        if (eliminado) return;

        detenido = false;

        if (estado === 'esperando') {
            estado = 'caminando';
        }

        if (
            estado === 'caminando' &&
            !objetivoActual &&
            !rutaActual.length
        ) {
            asignarDestino();
        }
    }

    // ========================================================
    // INFORMACIÓN DE COMPRAS
    // ========================================================

    function obtenerCompras() {
        return articulosEnCarrito.map(objeto => ({
            nombre: objeto.userData.nombreProducto,
            codigoProducto: objeto.userData.codigoProducto,
            codigoCatalogo: objeto.userData.codigoCatalogo,
            precio: Number(objeto.userData.precio ?? 0),
            objeto
        }));
    }

    function obtenerTotalCompra() {
        return articulosEnCarrito.reduce(
            (total, objeto) =>
                total + Number(objeto.userData.precio ?? 0),
            0
        );
    }

    function obtenerResumenCompra() {
        return {
            idCliente: id,
            articulos: obtenerCompras(),
            cantidad: articulosEnCarrito.length,
            total: obtenerTotalCompra()
        };
    }

    function buscarOriginalPorUUID(uuid) {
        if (!uuid || !productosGrupo?.traverse) return null;

        let encontrado = null;

        productosGrupo.traverse(objeto => {
            if (objeto.uuid === uuid) encontrado = objeto;
        });

        return encontrado;
    }

    function confirmarCompra() {
        if (pagoConfirmado && resumenPago) {
            return resumenPago;
        }

        for (const objeto of articulosEnCarrito) {
            const original = buscarOriginalPorUUID(
                objeto.userData.idProductoOriginal
            );

            if (original) {
                original.userData.vendido = true;
                original.userData.recogido = true;
                original.userData.disponible = false;
                original.userData.reservado = false;
                original.userData.reservadoPor = null;
                original.visible = false;
            }
        }

        return obtenerResumenCompra();
    }

    // ========================================================
    // ELIMINAR
    // ========================================================

    function eliminar() {
        if (eliminado) return;

        eliminado = true;
        liberarReserva();

        clientesActivos.delete(api);

        scene.remove(grupo);
        grupo.clear();
    }

    // ========================================================
    // API PÚBLICA
    // ========================================================

    const api = {
        id,
        grupo,

        actualizar,
        establecerRuta,
        establecerPosicion,

        configurarCompras,

        iniciarDesdeVehiculo,
        iniciarRegresoVehiculo,

        iniciarPago,

        detenerAnimacion,
        reproducirAnimacion,

        eliminar,

        obtenerCompras,
        obtenerTotalCompra,
        obtenerResumenCompra,
        confirmarCompra,

        obtenerObjetivo: () => objetivoActual,

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

        get entro() {
            return yaEntro;
        },

        get compraConfirmada() {
            return pagoConfirmado;
        },

        get pagoConfirmado() {
            return pagoConfirmado;
        },

        get resumenPago() {
            return resumenPago;
        },

        get productoEnMano() {
            return productoEnMano;
        },

        get productoObjetivo() {
            return productoObjetivo;
        },

        get zona() {
            return zonaPersonal.nombre;
        }
    };

    clientesActivos.add(api);

    if (!config.inactivo) {
        if (!asignarDestino()) {
            tiempoReintento = 0.8;
        }
    }

    return api;
}
