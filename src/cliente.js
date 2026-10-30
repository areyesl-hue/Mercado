
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const clientesActivos = new Set();
let siguienteIdCliente = 1;

const LIMITES = {
    minX: -29,
    maxX: 29,
    minZ: -27,
    maxZ: 27
};

const PASO_RUTA = 2;
const DISTANCIA_CLIENTES = 1.05;

export function crearClienteSupermercado(scene, opciones = {}) {
    if (!scene?.isScene) {
        throw new Error('crearClienteSupermercado necesita una THREE.Scene.');
    }

    const config = {
        modelo: '/modelos/cliente1.glb',
        posicion: { x: -5, y: 0, z: 20 },
        velocidad: 1.5,
        escala: 1,
        distanciaRecoger: 1.8,
        tiempoExaminar: 2.8,
        pausaEntreCompras: 3,
        probabilidadCompra: 0.8,
        radioColision: 0.42,
        distanciaDestino: 0.8,
        tiempoReintento: 3,
        ruta: [],
        inactivo: false,
        alEntrar: null,
        maxProductosPorBusqueda: 24,
        ...opciones
    };

    const id = siguienteIdCliente++;

    const grupo = new THREE.Group();
    grupo.name = `CLIENTE_SUPERMERCADO_${id}`;

    grupo.position.set(
        Number(config.posicion.x) || 0,
        Number(config.posicion.y) || 0,
        Number(config.posicion.z) || 0
    );

    grupo.userData.idCliente = id;
    scene.add(grupo);

    const contenedorModelo = new THREE.Group();
    contenedorModelo.name = `MODELO_CLIENTE_${id}`;
    grupo.add(contenedorModelo);

    let modelo = null;
    let mixer = null;
    let accionCaminar = null;
    let clips = [];

    let cargado = false;
    let eliminado = false;
    let detenido = Boolean(config.inactivo);

    let estado = config.inactivo ? 'esperando' : 'caminando';

    let tiempoEstado = 0;
    let tiempoCompra = 0;
    let faseCaminar = 0;
    let contadorCompras = 0;
    let tiempoReintento = 0;

    let rutaPersonalizada = Array.isArray(config.ruta)
        ? config.ruta.map(p => ({
            x: Number(p.x),
            z: Number(p.z)
        }))
        : [];

    let indiceRutaPersonalizada = 0;
    let rutaActual = [];
    let indiceRuta = 0;
    let objetivoActual = null;

    let rutaExterior = [];
    let indiceRutaExterior = 0;

    let productosGrupo = null;
    let carrito = null;
    let callbackRecoger = null;

    let productoEnExamen = null;
    let productoEnMano = null;
    let productoObjetivo = null;

    let anclaMano = null;

    let callbackEntrada =
        typeof config.alEntrar === 'function'
            ? config.alEntrar
            : null;

    let callbackRegreso = null;
    let yaEntro = false;

    const huesos = {};
    const rotacionesBase = new Map();

    const centroTemporal = new THREE.Vector3();
    const articulosEnCarrito = [];

    const MAX_ARTICULOS_VISIBLES = 18;

    const obstaculos = [];

    function agregarObstaculo(x, z, ancho, fondo, nombre = '') {
        obstaculos.push({
            minX: x - ancho / 2,
            maxX: x + ancho / 2,
            minZ: z - fondo / 2,
            maxZ: z + fondo / 2,
            nombre
        });
    }

    // Góndolas
    for (const x of [-17, -9, 9, 17]) {
        for (const z of [-13, 0, 13]) {
            agregarObstaculo(x, z, 1.45, 6, 'Góndola');
        }
    }

    // Mesas de frutas y verduras
    for (const [x, z] of [
        [-25.5, 15],
        [-21.7, 15],
        [-25.5, 10.8],
        [-21.7, 10.8]
    ]) {
        agregarObstaculo(x, z, 3, 1.6, 'Mesa de frescos');
    }

    agregarObstaculo(-3.5, -7, 1.9, 1.8, 'Isla promocional');
    agregarObstaculo(3.5, 7, 1.9, 1.8, 'Isla promocional');

    // Estanterías perimetrales
    for (const x of [-29.5, 29.5]) {
        for (const z of [-18, -10]) {
            agregarObstaculo(x, z, 0.95, 4.5, 'Estantería perimetral');
        }
    }

    agregarObstaculo(25.2, 15.2, 2.9, 1.3, 'Panadería');
    agregarObstaculo(25.2, 11.4, 2.9, 1.3, 'Panadería');
    agregarObstaculo(25.1, -7.3, 5.2, 2.4, 'Carnicería');

    // Refrigeradores
    for (const x of [
        -27, -23.5, -20, -16.5,
        16.5, 20, 23.5, 27
    ]) {
        agregarObstaculo(x, -26.5, 2.8, 1.15, 'Refrigerador');
    }

    function colisiona(x, z, radio = config.radioColision) {
        if (
            x < LIMITES.minX + radio ||
            x > LIMITES.maxX - radio ||
            z < LIMITES.minZ + radio ||
            z > LIMITES.maxZ - radio
        ) {
            return true;
        }

        return obstaculos.some(o =>
            x + radio > o.minX &&
            x - radio < o.maxX &&
            z + radio > o.minZ &&
            z - radio < o.maxZ
        );
    }

    function transitable(x, z) {
        return !colisiona(
            x,
            z,
            config.radioColision + 0.08
        );
    }

    function clave(ix, iz) {
        return `${ix},${iz}`;
    }

    function nodo(ix, iz) {
        return {
            x: LIMITES.minX + 1 + ix * PASO_RUTA,
            z: LIMITES.minZ + 1 + iz * PASO_RUTA
        };
    }

    const columnas =
        Math.floor(
            (LIMITES.maxX - LIMITES.minX - 2) / PASO_RUTA
        ) + 1;

    const filas =
        Math.floor(
            (LIMITES.maxZ - LIMITES.minZ - 2) / PASO_RUTA
        ) + 1;

    function nodoValido(ix, iz) {
        if (
            ix < 0 ||
            iz < 0 ||
            ix >= columnas ||
            iz >= filas
        ) {
            return false;
        }

        const p = nodo(ix, iz);
        return transitable(p.x, p.z);
    }

    function nodoCercano(x, z) {
        let mejor = null;
        let distanciaMejor = Infinity;

        for (let iz = 0; iz < filas; iz++) {
            for (let ix = 0; ix < columnas; ix++) {
                if (!nodoValido(ix, iz)) continue;

                const p = nodo(ix, iz);

                const d = Math.hypot(
                    p.x - x,
                    p.z - z
                );

                if (d < distanciaMejor) {
                    distanciaMejor = d;
                    mejor = { ix, iz, ...p };
                }
            }
        }

        return mejor;
    }

    // Búsqueda de rutas A*
    function buscarCamino(inicio, destino) {
        const a = nodoCercano(inicio.x, inicio.z);
        const b = nodoCercano(destino.x, destino.z);

        if (!a || !b) return [];

        const ka = clave(a.ix, a.iz);
        const kb = clave(b.ix, b.iz);

        const abiertos = new Set([ka]);
        const anterior = new Map();
        const costo = new Map([[ka, 0]]);

        const estimacion = new Map([
            [
                ka,
                Math.abs(a.ix - b.ix) +
                Math.abs(a.iz - b.iz)
            ]
        ]);

        const dirs = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ];

        let iter = 0;

        while (
            abiertos.size &&
            iter++ < columnas * filas * 4
        ) {
            let actual = null;
            let mejorF = Infinity;

            for (const k of abiertos) {
                const f = estimacion.get(k) ?? Infinity;

                if (f < mejorF) {
                    mejorF = f;
                    actual = k;
                }
            }

            if (!actual) break;

            if (actual === kb) {
                const camino = [];
                let k = actual;

                while (k) {
                    const [ix, iz] = k.split(',').map(Number);
                    camino.unshift(nodo(ix, iz));
                    k = anterior.get(k);
                }

                camino.shift();

                if (transitable(destino.x, destino.z)) {
                    const ultimo =
                        camino[camino.length - 1] || a;

                    if (
                        Math.hypot(
                            ultimo.x - destino.x,
                            ultimo.z - destino.z
                        ) < PASO_RUTA * 1.8
                    ) {
                        camino.push({
                            x: destino.x,
                            z: destino.z
                        });
                    }
                }

                return camino;
            }

            abiertos.delete(actual);

            const [ix, iz] = actual.split(',').map(Number);
            const g = costo.get(actual) ?? Infinity;

            for (const [dx, dz] of dirs) {
                const nx = ix + dx;
                const nz = iz + dz;

                if (!nodoValido(nx, nz)) continue;

                const nk = clave(nx, nz);
                const ng = g + 1;

                if (ng >= (costo.get(nk) ?? Infinity)) {
                    continue;
                }

                anterior.set(nk, actual);
                costo.set(nk, ng);

                estimacion.set(
                    nk,
                    ng +
                    Math.abs(nx - b.ix) +
                    Math.abs(nz - b.iz)
                );

                abiertos.add(nk);
            }
        }

        return [];
    }

    function destinoAleatorio() {
        for (let i = 0; i < 80; i++) {
            const x = THREE.MathUtils.randFloat(-27, 27);
            const z = THREE.MathUtils.randFloat(-25, 25);

            if (transitable(x, z)) {
                return { x, z };
            }
        }

        return { x: 0, z: 20 };
    }

    function asignarDestino() {
        let destino = null;

        for (
            let intentos = 0;
            intentos < Math.max(1, rutaPersonalizada.length);
            intentos++
        ) {
            if (!rutaPersonalizada.length) break;

            const p = rutaPersonalizada[
                indiceRutaPersonalizada %
                rutaPersonalizada.length
            ];

            indiceRutaPersonalizada++;

            if (
                p &&
                p.x >= LIMITES.minX &&
                p.x <= LIMITES.maxX &&
                p.z >= LIMITES.minZ &&
                p.z <= LIMITES.maxZ &&
                transitable(p.x, p.z)
            ) {
                destino = p;
                break;
            }
        }

        objetivoActual = destino || destinoAleatorio();

        rutaActual = buscarCamino(
            {
                x: grupo.position.x,
                z: grupo.position.z
            },
            objetivoActual
        );

        indiceRuta = 0;

        if (!rutaActual.length) {
            objetivoActual = null;
        }
    }

    function establecerRuta(nuevaRuta) {
        rutaPersonalizada = Array.isArray(nuevaRuta)
            ? nuevaRuta
                .map(p => ({
                    x: Number(p.x),
                    z: Number(p.z)
                }))
                .filter(p =>
                    Number.isFinite(p.x) &&
                    Number.isFinite(p.z) &&
                    p.x >= LIMITES.minX &&
                    p.x <= LIMITES.maxX &&
                    p.z >= LIMITES.minZ &&
                    p.z <= LIMITES.maxZ
                )
            : [];

        indiceRutaPersonalizada = 0;
        objetivoActual = null;
        rutaActual = [];
        indiceRuta = 0;

        if (!detenido && estado === 'caminando') {
            asignarDestino();
        }
    }

    function establecerPosicion(posicion) {
        if (!posicion) return false;

        const x = Number(posicion.x ?? grupo.position.x);
        const z = Number(posicion.z ?? grupo.position.z);
        const y = Number(posicion.y ?? grupo.position.y);

        if (![x, y, z].every(Number.isFinite)) return false;

        grupo.position.set(x, y, z);

        objetivoActual = null;
        rutaActual = [];
        indiceRuta = 0;

        return true;
    }

    // ==================================================
    // VEHÍCULOS
    // ==================================================

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
        objetivoActual = null;
        rutaActual = [];
        indiceRuta = 0;

        callbackRegreso =
            typeof alTerminar === 'function'
                ? alTerminar
                : null;

        if (accionCaminar) {
            accionCaminar.reset();
            accionCaminar.play();
        }

        return true;
    }

    function iniciarDesdeVehiculo(posicion, plaza = null) {
        if (eliminado) return;

        establecerPosicion(posicion);

        detenido = false;
        estado = 'llegando';
        tiempoEstado = 0;
        yaEntro = false;

        const x = Number(
            plaza?.x ??
            posicion.x ??
            grupo.position.x
        );

        const z = Number(
            plaza?.z ??
            posicion.z ??
            grupo.position.z
        );

        const filaZ = Number.isFinite(z) ? z : 40;

        rutaExterior = [
            { x, z: filaZ + 3 },
            { x: 30.5, z: filaZ + 3 },
            { x: 30.5, z: 34 },
            { x: 8, z: 34 },
            { x: 0, z: 32 },
            { x: 0, z: 27.5 }
        ];

        indiceRutaExterior = 0;
        objetivoActual = null;
        rutaActual = [];
        indiceRuta = 0;
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
            } catch (e) {
                console.error('Error en callback alEntrar:', e);
            }
        }

        asignarDestino();

        if (accionCaminar) {
            accionCaminar.reset();
            accionCaminar.play();
        }
    }

    function avanzarExterior(dt) {
        const p = rutaExterior[indiceRutaExterior];

        if (!p) {
            terminarLlegada();
            return;
        }

        const dx = p.x - grupo.position.x;
        const dz = p.z - grupo.position.z;
        const d = Math.hypot(dx, dz);

        if (d < 0.65) {
            indiceRutaExterior++;

            if (indiceRutaExterior >= rutaExterior.length) {
                if (estado === 'regresando') {
                    estado = 'esperando';
                    detenido = true;

                    if (accionCaminar) accionCaminar.stop();

                    const cb = callbackRegreso;
                    callbackRegreso = null;

                    if (cb) cb(api);
                } else {
                    terminarLlegada();
                }
            }

            return;
        }

        const paso = Math.min(config.velocidad * dt, d);

        grupo.rotation.y = Math.atan2(dx, dz);
        grupo.position.x += dx / d * paso;
        grupo.position.z += dz / d * paso;
    }

    // ==================================================
    // SISTEMA DE PRODUCTOS
    // ==================================================

    function configurarCompras(opcionesCompra = {}) {
        const fuente = opcionesCompra.productos ?? null;

        productosGrupo = fuente?.grupo ?? fuente;
        carrito = opcionesCompra.carrito ?? null;

        callbackRecoger =
            typeof opcionesCompra.alRecoger === 'function'
                ? opcionesCompra.alRecoger
                : null;

        tiempoCompra = 0;

        console.info(
            `Cliente ${id}: sistema de compras configurado`,
            Boolean(productosGrupo),
            Boolean(carrito?.grupo)
        );
    }

    function listarProductosDisponibles() {
        if (!productosGrupo?.traverse) return [];

        const lista = [];

        productosGrupo.traverse(o => {
            if (
                o === productosGrupo ||
                !o.isObject3D ||
                !o.visible ||
                o.userData.esUnidadProducto !== true ||
                o.userData.recogido ||
                o.userData.vendido
            ) {
                return;
            }

            if (
                o.userData.reservado &&
                o.userData.reservadoPor !== id
            ) {
                return;
            }

            lista.push(o);
        });

        return lista;
    }

    function liberarObjetivoProducto() {
        if (
            productoObjetivo &&
            productoObjetivo.userData.reservadoPor === id &&
            productoObjetivo !== productoEnExamen
        ) {
            productoObjetivo.userData.reservado = false;
            productoObjetivo.userData.reservadoPor = null;
        }

        productoObjetivo = null;
    }

    function obtenerPosicionesAproximacion(producto) {
        producto.updateWorldMatrix(true, false);
        producto.getWorldPosition(centroTemporal);

        const px = centroTemporal.x;
        const pz = centroTemporal.z;

        const direcciones = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [0.707, 0.707],
            [-0.707, 0.707],
            [0.707, -0.707],
            [-0.707, -0.707]
        ];

        const posiciones = [];

        for (const radio of [1.25, 1.75, 2.3]) {
            for (const [dx, dz] of direcciones) {
                const x = px + dx * radio;
                const z = pz + dz * radio;

                if (transitable(x, z)) {
                    posiciones.push({ x, z });
                }
            }
        }

        return posiciones;
    }

    function calcularRutaHastaProducto(producto) {
        const posiciones = obtenerPosicionesAproximacion(producto);

        if (!posiciones.length) return null;

        let mejorRuta = null;
        let mejorCosto = Infinity;
        let mejorDestino = null;

        const inicio = {
            x: grupo.position.x,
            z: grupo.position.z
        };

        producto.updateWorldMatrix(true, false);
        producto.getWorldPosition(centroTemporal);

        for (const destino of posiciones) {
            const ruta = buscarCamino(inicio, destino);

            if (!ruta.length) {
                const distancia = Math.hypot(
                    inicio.x - destino.x,
                    inicio.z - destino.z
                );

                if (distancia > 1.8) continue;
            }

            const longitud = ruta.reduce((total, punto, i) => {
                const anterior = i === 0 ? inicio : ruta[i - 1];

                return total + Math.hypot(
                    punto.x - anterior.x,
                    punto.z - anterior.z
                );
            }, 0);

            const distanciaProducto = Math.hypot(
                destino.x - centroTemporal.x,
                destino.z - centroTemporal.z
            );

            if (distanciaProducto > 2.8) continue;

            const costo = longitud + distanciaProducto * 0.15;

            if (costo < mejorCosto) {
                mejorCosto = costo;
                mejorRuta = ruta;
                mejorDestino = destino;
            }
        }

        if (!mejorDestino) return null;

        return {
            ruta: mejorRuta,
            destino: mejorDestino,
            costo: mejorCosto
        };
    }

    function buscarProductoAlcanzable() {
        if (!productosGrupo || estado !== 'caminando') {
            return false;
        }

        const disponibles = listarProductosDisponibles();

        if (!disponibles.length) return false;

        disponibles.sort((a, b) => {
            a.updateWorldMatrix(true, false);
            b.updateWorldMatrix(true, false);

            const pa = a.getWorldPosition(new THREE.Vector3());
            const pb = b.getWorldPosition(new THREE.Vector3());

            const da = Math.hypot(
                pa.x - grupo.position.x,
                pa.z - grupo.position.z
            );

            const db = Math.hypot(
                pb.x - grupo.position.x,
                pb.z - grupo.position.z
            );

            return da - db;
        });

        const limite = Math.min(
            disponibles.length,
            Math.max(1, config.maxProductosPorBusqueda)
        );

        let mejorProducto = null;
        let mejorRuta = null;
        let mejorCosto = Infinity;

        for (let i = 0; i < limite; i++) {
            const producto = disponibles[i];
            const resultado = calcularRutaHastaProducto(producto);

            if (!resultado) continue;

            if (resultado.costo < mejorCosto) {
                mejorCosto = resultado.costo;
                mejorProducto = producto;
                mejorRuta = resultado;
            }
        }

        if (!mejorProducto || !mejorRuta) {
            return false;
        }

        productoObjetivo = mejorProducto;

        productoObjetivo.userData.reservado = true;
        productoObjetivo.userData.reservadoPor = id;

        objetivoActual = mejorRuta.destino;
        rutaActual = mejorRuta.ruta;
        indiceRuta = 0;

        estado = 'yendoProducto';

        console.info(
            `Cliente ${id}: se dirige a`,
            productoObjetivo.userData.nombreProducto ??
            productoObjetivo.name
        );

        if (accionCaminar && !accionCaminar.isRunning()) {
            accionCaminar.reset();
            accionCaminar.play();
        }

        return true;
    }

    function obtenerAnclaMano() {
        if (anclaMano) return anclaMano;

        const candidatos = [
            'handr',
            'righthand',
            'hand_r',
            'mixamorigrighthand',
            'handl',
            'lefthand',
            'hand_l',
            'mixamorighand'
        ];

        for (const nombre of candidatos) {
            const encontrado = modelo?.getObjectByName(nombre);

            if (encontrado) {
                anclaMano = encontrado;
                return anclaMano;
            }
        }

        modelo?.traverse(o => {
            if (!o.isBone || anclaMano) return;

            const n = o.name.toLowerCase().replace(/[^a-z0-9]/g, '');

            if (
                n.includes('hand') &&
                (n.includes('right') || n.endsWith('r'))
            ) {
                anclaMano = o;
            }
        });

        return anclaMano;
    }

    function crearProductoTemporal(producto) {
        const copia = producto.clone(true);

        copia.name = `PRODUCTO_EN_MANO_${id}`;
        copia.userData.esProductoTemporal = true;

        copia.traverse(o => {
            if (o.isMesh) {
                o.visible = true;
                o.castShadow = true;
            }
        });

        const caja = new THREE.Box3().setFromObject(copia);
        const tam = new THREE.Vector3();

        caja.getSize(tam);

        if (!caja.isEmpty() && tam.length() > 0) {
            const factor = Math.min(
                1,
                0.22 / Math.max(tam.x, 0.001),
                0.25 / Math.max(tam.y, 0.001),
                0.22 / Math.max(tam.z, 0.001)
            );

            copia.scale.multiplyScalar(factor);
        }

        copia.position.set(0, 0, 0);
        copia.rotation.set(0, 0, 0);

        return copia;
    }

    function colocarProductoEnMano(producto) {
        if (!producto || productoEnMano) return false;

        productoEnMano = crearProductoTemporal(producto);

        const mano = obtenerAnclaMano();

        if (mano) {
            mano.add(productoEnMano);
            productoEnMano.position.set(0, 0, 0.09);
            productoEnMano.rotation.set(0, 0, 0);
        } else {
            contenedorModelo.add(productoEnMano);
            productoEnMano.position.set(0.32, 1.05, 0.22);
            productoEnMano.rotation.set(0, 0, 0);
        }

        productoEnMano.updateMatrixWorld(true);

        producto.visible = false;
        producto.userData.reservado = true;
        producto.userData.reservadoPor = id;

        return true;
    }

    function retirarProductoDeMano() {
        if (!productoEnMano) return null;

        const objeto = productoEnMano;

        if (objeto.parent) {
            objeto.parent.remove(objeto);
        }

        productoEnMano = null;
        return objeto;
    }

    function liberarReserva() {
        liberarObjetivoProducto();

        if (productoEnExamen) {
            productoEnExamen.userData.reservado = false;

            if (productoEnExamen.userData.reservadoPor === id) {
                productoEnExamen.userData.reservadoPor = null;
            }

            if (
                !productoEnExamen.userData.recogido &&
                !productoEnExamen.userData.vendido
            ) {
                productoEnExamen.visible = true;
            }
        }

        retirarProductoDeMano();
        productoEnExamen = null;
    }

    function devolverProductoAlEstante() {
        if (!productoEnExamen) {
            retirarProductoDeMano();
            return;
        }

        const producto = productoEnExamen;

        retirarProductoDeMano();

        producto.visible = true;
        producto.userData.recogido = false;
        producto.userData.reservado = false;
        producto.userData.reservadoPor = null;

        productoEnExamen = null;
    }

    function copiaParaCarrito(producto) {
        const copia = producto.clone(true);

        copia.name = `ARTICULO_CARRITO_${id}_${contadorCompras}`;

        copia.position.set(0, 0, 0);
        copia.rotation.set(0, 0, 0);

        const caja = new THREE.Box3().setFromObject(copia);
        const tam = new THREE.Vector3();

        caja.getSize(tam);

        if (
            !caja.isEmpty() &&
            tam.x > 0 &&
            tam.y > 0 &&
            tam.z > 0
        ) {
            copia.scale.multiplyScalar(
                Math.min(
                    1,
                    0.16 / tam.x,
                    0.23 / tam.y,
                    0.16 / tam.z
                )
            );
        }

        copia.updateMatrixWorld(true);

        const caja2 = new THREE.Box3().setFromObject(copia);

        if (!caja2.isEmpty()) {
            copia.position.y -= caja2.min.y;
        }

        copia.traverse(o => {
            if (o.isMesh) {
                o.visible = true;
                o.castShadow = true;
                o.receiveShadow = true;
            }
        });

        return copia;
    }

    function agregarAlCarrito(producto) {
        if (
            !producto ||
            producto.userData.recogido ||
            producto.userData.vendido ||
            !carrito?.grupo
        ) {
            return false;
        }

        contadorCompras++;

        const copia = productoEnMano
            ? retirarProductoDeMano()
            : copiaParaCarrito(producto);

        if (!copia) return false;

        copia.name = `ARTICULO_CARRITO_${id}_${contadorCompras}`;

        const indice =
            (contadorCompras - 1) % MAX_ARTICULOS_VISIBLES;

        copia.position.set(
            ((indice % 4) - 1.5) * 0.12,
            0.6 + Math.floor(indice / 12) * 0.18,
            (Math.floor((indice % 12) / 4) - 1) * 0.13
        );

        copia.rotation.set(0, 0, 0);
        copia.userData.esArticuloCarrito = true;

        copia.userData.nombreProducto =
            producto.userData.nombreProducto ?? producto.name;

        copia.userData.precio =
            Number(producto.userData.precio ?? 0);

        copia.userData.idProductoOriginal = producto.uuid;

        if (articulosEnCarrito.length >= MAX_ARTICULOS_VISIBLES) {
            const viejo = articulosEnCarrito.shift();

            if (viejo?.parent) {
                viejo.parent.remove(viejo);
            }
        }

        carrito.grupo.add(copia);
        articulosEnCarrito.push(copia);

        producto.userData.recogido = true;
        producto.userData.reservado = false;
        producto.userData.reservadoPor = null;
        producto.visible = false;

        const datos = {
            id: producto.uuid,
            idCliente: id,
            nombre: producto.userData.nombreProducto ?? producto.name,
            precio: Number(producto.userData.precio ?? 0),
            numeroCompra: contadorCompras
        };

        if (typeof callbackRecoger === 'function') {
            try {
                callbackRecoger(datos);
            } catch (e) {
                console.error('Error en callback de producto:', e);
            }
        }

        return true;
    }

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

        if (
            producto.userData.reservadoPor != null &&
            producto.userData.reservadoPor !== id
        ) {
            liberarObjetivoProducto();
            estado = 'caminando';
            asignarDestino();
            return;
        }

        productoEnExamen = producto;
        productoObjetivo = null;

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

        objetivoActual = null;
        rutaActual = [];
        indiceRuta = 0;

        if (accionCaminar) {
            accionCaminar.stop();
        }
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
            tiempoCompra = 0;
            asignarDestino();
            return;
        }

        producto.updateWorldMatrix(true, false);
        producto.getWorldPosition(centroTemporal);

        const distancia = Math.hypot(
            centroTemporal.x - grupo.position.x,
            centroTemporal.z - grupo.position.z
        );

        if (distancia <= config.distanciaRecoger + 0.8) {
            iniciarExamen(producto);
            return;
        }

        const nuevaRuta = calcularRutaHastaProducto(producto);

        if (nuevaRuta) {
            objetivoActual = nuevaRuta.destino;
            rutaActual = nuevaRuta.ruta;
            indiceRuta = 0;

            if (!rutaActual.length) {
                // Evita una recursión infinita si el punto
                // de aproximación no permite acercarse más.
                producto.updateWorldMatrix(true, false);
                producto.getWorldPosition(centroTemporal);

                const d = Math.hypot(
                    centroTemporal.x - grupo.position.x,
                    centroTemporal.z - grupo.position.z
                );

                if (d <= config.distanciaRecoger + 0.8) {
                    iniciarExamen(producto);
                } else {
                    liberarObjetivoProducto();
                    estado = 'caminando';
                    tiempoCompra = 0;
                    asignarDestino();
                }
            }
        } else {
            liberarObjetivoProducto();
            estado = 'caminando';
            tiempoCompra = 0;
            asignarDestino();
        }
    }

    function finalizarExamen() {
        if (!productoEnExamen) {
            estado = 'caminando';
            asignarDestino();
            return;
        }

        const comprar =
            Math.random() <= THREE.MathUtils.clamp(
                config.probabilidadCompra,
                0,
                1
            );

        let compraRealizada = false;

        if (comprar && carrito?.grupo) {
            compraRealizada = agregarAlCarrito(productoEnExamen);
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

        asignarDestino();

        if (accionCaminar) {
            accionCaminar.reset();
            accionCaminar.play();
        }
    }

    // ==================================================
    // SEPARACIÓN ENTRE CLIENTES
    // ==================================================

    function separacionClientes() {
        const v = new THREE.Vector3();

        for (const otro of clientesActivos) {
            if (
                otro === api ||
                otro.eliminado ||
                !otro.grupo ||
                otro.estado === 'esperando' ||
                otro.estado === 'llegando'
            ) {
                continue;
            }

            const dx = grupo.position.x - otro.grupo.position.x;
            const dz = grupo.position.z - otro.grupo.position.z;
            const d = Math.hypot(dx, dz);

            if (d > 0.001 && d < DISTANCIA_CLIENTES) {
                const f =
                    (DISTANCIA_CLIENTES - d) /
                    DISTANCIA_CLIENTES;

                v.x += dx / d * f;
                v.z += dz / d * f;
            }
        }

        return v;
    }

    function avanzarInterior(dt) {
        if (!objetivoActual || !rutaActual.length) {
            if (estado === 'yendoProducto') {
                comprobarLlegadaProducto();
            } else {
                asignarDestino();
            }

            return;
        }

        const p = rutaActual[indiceRuta];

        if (!p) {
            if (estado === 'yendoProducto') {
                objetivoActual = null;
                rutaActual = [];
                indiceRuta = 0;
                comprobarLlegadaProducto();
            } else {
                objetivoActual = null;
                rutaActual = [];
                asignarDestino();
            }

            return;
        }

        const dx = p.x - grupo.position.x;
        const dz = p.z - grupo.position.z;
        const d = Math.hypot(dx, dz);

        if (d < config.distanciaDestino) {
            indiceRuta++;

            if (indiceRuta >= rutaActual.length) {
                if (estado === 'yendoProducto') {
                    objetivoActual = null;
                    rutaActual = [];
                    indiceRuta = 0;
                    comprobarLlegadaProducto();
                } else {
                    objetivoActual = null;
                    rutaActual = [];
                    indiceRuta = 0;
                }
            }

            return;
        }

        const sep = separacionClientes();

        let vx = dx / d + sep.x * 0.55;
        let vz = dz / d + sep.z * 0.55;

        const n = Math.hypot(vx, vz) || 1;

        vx /= n;
        vz /= n;

        const paso = Math.min(config.velocidad * dt, d);

        const nx = grupo.position.x + vx * paso;
        const nz = grupo.position.z + vz * paso;

        let movio = false;

        if (!colisiona(nx, nz)) {
            grupo.position.x = nx;
            grupo.position.z = nz;
            movio = true;
        } else if (!colisiona(nx, grupo.position.z)) {
            grupo.position.x = nx;
            movio = true;
        } else if (!colisiona(grupo.position.x, nz)) {
            grupo.position.z = nz;
            movio = true;
        }

        if (movio) {
            grupo.rotation.y = Math.atan2(vx, vz);
        } else if (estado === 'yendoProducto') {
            liberarObjetivoProducto();
            estado = 'caminando';
            tiempoCompra = 0;
            asignarDestino();
        } else if (Math.random() < dt * 0.8) {
            objetivoActual = null;
            rutaActual = [];
        }
    }

    // ==================================================
    // ANIMACIÓN DEL ESQUELETO
    // ==================================================

    function normalizarNombre(n) {
        return String(n ?? '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
    }

    function registrarHuesos() {
        if (!modelo) return;

        modelo.traverse(o => {
            if (!o.isBone) return;

            const n = normalizarNombre(o.name);
            rotacionesBase.set(o, o.rotation.clone());

            let lado = null;

            if (n.includes('left') || n.endsWith('l')) {
                lado = 'L';
            } else if (n.includes('right') || n.endsWith('r')) {
                lado = 'R';
            }

            if (!lado) return;

            if (/thigh|upleg|upperleg/.test(n)) {
                huesos[`thigh${lado}`] = o;
            } else if (/shin|calf|lowerleg/.test(n)) {
                huesos[`shin${lado}`] = o;
            } else if (/upperarm|armupper/.test(n)) {
                huesos[`arm${lado}`] = o;
            } else if (/forearm|lowerarm/.test(n)) {
                huesos[`forearm${lado}`] = o;
            }
        });

        obtenerAnclaMano();
    }

    function animarManual(dt) {
        if (!modelo) return;

        const caminando =
            estado === 'caminando' ||
            estado === 'yendoProducto' ||
            estado === 'llegando' ||
            estado === 'regresando';

        faseCaminar += dt * (caminando ? 7.5 : 2);

        const balanceo = Math.sin(faseCaminar) *
            (caminando ? 0.45 : 0.02);

        const rotar = (nombre, valor) => {
            const h = huesos[nombre];
            const b = h && rotacionesBase.get(h);

            if (h && b) {
                h.rotation.x = b.x + valor;
            }
        };

        rotar('thighL', balanceo);
        rotar('thighR', -balanceo);

        rotar('shinL', Math.max(0, -balanceo) * 0.65);
        rotar('shinR', Math.max(0, balanceo) * 0.65);

        if (estado === 'examinando') {
            rotar('armR', -0.95);
            rotar('forearmR', -0.8);
            rotar('armL', -0.25);
            rotar('forearmL', -0.45);
        } else {
            rotar('armL', -balanceo * 0.6);
            rotar('armR', balanceo * 0.6);
        }
    }

    // ==================================================
    // CARGA DEL MODELO
    // ==================================================

    const loader = new GLTFLoader();

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

            modelo.traverse(o => {
                if (o.isMesh) {
                    o.castShadow = true;
                    o.receiveShadow = true;
                }
            });

            contenedorModelo.add(modelo);

            clips = gltf.animations ?? [];

            if (clips.length) {
                mixer = new THREE.AnimationMixer(modelo);

                const clip = clips.find(c =>
                    /walk|walking|caminar|andar|locomotion/i.test(c.name)
                );

                if (clip) {
                    accionCaminar = mixer.clipAction(clip);

                    if (!detenido) {
                        accionCaminar.play();
                    }
                }
            }

            registrarHuesos();
            cargado = true;

            console.info(
                `Cliente ${id} cargado: ${config.modelo}; animaciones: ${clips.length}`
            );
        },
        undefined,
        error => {
            console.error(
                `No se pudo cargar ${config.modelo}. Verifica public${config.modelo}`,
                error
            );
        }
    );

    // ==================================================
    // ACTUALIZACIÓN PRINCIPAL
    // ==================================================

    function actualizar(delta) {
        if (
            eliminado ||
            detenido ||
            !Number.isFinite(delta) ||
            delta <= 0
        ) {
            return;
        }

        const dt = Math.min(delta, 0.05);

        if (mixer) {
            mixer.update(dt);
        }

        tiempoEstado += dt;
        tiempoCompra += dt;

        if (estado === 'esperando') {
            return;
        }

        if (
            estado === 'llegando' ||
            estado === 'regresando'
        ) {
            avanzarExterior(dt);
        } else if (
            estado === 'caminando' ||
            estado === 'yendoProducto'
        ) {
            avanzarInterior(dt);

            if (
                estado === 'caminando' &&
                tiempoCompra >= config.pausaEntreCompras &&
                tiempoReintento <= 0
            ) {
                const encontro = buscarProductoAlcanzable();

                if (encontro) {
                    tiempoCompra = 0;
                } else {
                    tiempoCompra = 0;
                    tiempoReintento = config.tiempoReintento;
                }
            }
        } else if (estado === 'examinando') {
            if (
                productoEnExamen &&
                !productoEnExamen.userData.recogido
            ) {
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
        }

        if (tiempoReintento > 0) {
            tiempoReintento = Math.max(0, tiempoReintento - dt);
        }

        if (!accionCaminar || estado === 'examinando') {
            animarManual(dt);
        }
    }

    // ==================================================
    // CONTROLES
    // ==================================================

    function detenerAnimacion() {
        detenido = true;

        if (accionCaminar) {
            accionCaminar.stop();
        }
    }

    function reproducirAnimacion() {
        if (eliminado) return;

        detenido = false;

        if (estado === 'esperando') {
            estado = 'caminando';
        }

        if (accionCaminar) {
            accionCaminar.reset();
            accionCaminar.play();
        }

        if (estado === 'caminando') {
            asignarDestino();
        }
    }

    // ==================================================
    // INFORMACIÓN DE COMPRAS
    // ==================================================

    function obtenerCompras() {
        return articulosEnCarrito.map(objeto => ({
            nombre: objeto.userData.nombreProducto,
            precio: Number(objeto.userData.precio ?? 0),
            objeto
        }));
    }

    function obtenerTotalCompra() {
        return articulosEnCarrito.reduce(
            (total, objeto) => {
                return total + Number(objeto.userData.precio ?? 0);
            },
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

    function confirmarCompra() {
        for (const objeto of articulosEnCarrito) {
            const original = buscarOriginalPorUUID(
                objeto.userData.idProductoOriginal
            );

            if (original) {
                original.userData.vendido = true;
                original.userData.recogido = true;
                original.userData.reservado = false;
                original.userData.reservadoPor = null;
                original.visible = false;
            }
        }

        return obtenerResumenCompra();
    }

    function buscarOriginalPorUUID(uuid) {
        if (!uuid || !productosGrupo?.traverse) {
            return null;
        }

        let encontrado = null;

        productosGrupo.traverse(o => {
            if (o.uuid === uuid) {
                encontrado = o;
            }
        });

        return encontrado;
    }

    function eliminar() {
        if (eliminado) return;

        eliminado = true;

        liberarReserva();
        clientesActivos.delete(api);

        if (mixer) {
            mixer.stopAllAction();

            if (modelo) {
                mixer.uncacheRoot(modelo);
            }
        }

        scene.remove(grupo);
        grupo.clear();
    }

    // ==================================================
    // API PÚBLICA
    // ==================================================

    const api = {
        id,
        grupo,
        actualizar,
        establecerRuta,
        establecerPosicion,
        configurarCompras,
        iniciarDesdeVehiculo,
        iniciarRegresoVehiculo,
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
            return articulosEnCarrito.length > 0;
        },

        get productoEnMano() {
            return productoEnMano;
        },

        get productoObjetivo() {
            return productoObjetivo;
        }
    };

    clientesActivos.add(api);

    if (!config.inactivo) {
        if (rutaPersonalizada.length) {
            establecerRuta(rutaPersonalizada);
        } else {
            asignarDestino();
        }
    }

    return api;
}
