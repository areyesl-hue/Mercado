
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
const VELOCIDAD_GIRO = 7;
const ACELERACION_MOVIMIENTO = 5;

export function crearClienteSupermercado(scene, opciones = {}) {
    if (!scene?.isScene) {
        throw new Error(
            'crearClienteSupermercado necesita una THREE.Scene.'
        );
    }

    const config = {
        modelo: '/modelos/cliente1.glb',
        posicion: { x: -5, y: 0, z: 20 },
        velocidad: 1.5,
        escala: 1,
        distanciaRecoger: 1.6,
        tiempoExaminar: 1.25,
        pausaEntreCompras: 2.5,
        probabilidadCompra: 0.8,
        radioColision: 0.42,
        distanciaDestino: 0.8,
        tiempoReintento: 2.5,
        ruta: [],
        inactivo: false,
        alEntrar: null,
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
    let tiempoSinRuta = 0;
    let faseCaminar = 0;
    let contadorCompras = 0;

    let velocidadActual = 0;
    let rotacionObjetivo = grupo.rotation.y;
    let velocidadAnimacion = 0;

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

    let callbackEntrada =
        typeof config.alEntrar === 'function'
            ? config.alEntrar
            : null;

    let yaEntro = false;
    let callbackRegreso = null;
    let compraConfirmada = false;

    const comprasCliente = [];
    const huesos = {};
    const rotacionesBase = new Map();
    const centroTemporal = new THREE.Vector3();
    const articulosEnCarrito = [];
    const MAX_ARTICULOS_VISIBLES = 18;

    // =========================================================
    // OBSTÁCULOS
    // =========================================================

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

    for (const x of [-17, -9, 9, 17]) {
        for (const z of [-13, 0, 13]) {
            agregarObstaculo(x, z, 1.45, 6, 'Góndola');
        }
    }

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

    for (const x of [-29.5, 29.5]) {
        for (const z of [-18, -10]) {
            agregarObstaculo(
                x, z, 0.95, 4.5, 'Estantería perimetral'
            );
        }
    }

    agregarObstaculo(25.2, 15.2, 2.9, 1.3, 'Panadería');
    agregarObstaculo(25.2, 11.4, 2.9, 1.3, 'Panadería');
    agregarObstaculo(25.1, -7.3, 5.2, 2.4, 'Carnicería');

    for (const x of [
        -27, -23.5, -20, -16.5, 16.5, 20, 23.5, 27
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

    // =========================================================
    // RUTAS A*
    // =========================================================

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
                const d = Math.hypot(p.x - x, p.z - z);

                if (d < distanciaMejor) {
                    distanciaMejor = d;
                    mejor = { ix, iz, ...p };
                }
            }
        }

        return mejor;
    }

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

            const p =
                rutaPersonalizada[
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

        tiempoSinRuta = 0;
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

        if (![x, y, z].every(Number.isFinite)) {
            return false;
        }

        grupo.position.set(x, y, z);
        objetivoActual = null;
        rutaActual = [];
        indiceRuta = 0;
        velocidadActual = 0;

        return true;
    }

    // =========================================================
    // GIRO SUAVE
    // =========================================================

    function orientarSuavemente(dx, dz) {
        if (Math.hypot(dx, dz) < 0.001) return;

        rotacionObjetivo = Math.atan2(dx, dz);
    }

    function actualizarRotacionSuave(dt) {
        let diferencia =
            rotacionObjetivo - grupo.rotation.y;

        while (diferencia > Math.PI) {
            diferencia -= Math.PI * 2;
        }

        while (diferencia < -Math.PI) {
            diferencia += Math.PI * 2;
        }

        const factor =
            1 - Math.exp(-VELOCIDAD_GIRO * dt);

        grupo.rotation.y += diferencia * factor;
    }

    // =========================================================
    // ENTRADA Y REGRESO AL ESTACIONAMIENTO
    // =========================================================

    function iniciarRegresoVehiculo(plaza, alTerminar = null) {
        if (eliminado || !plaza) return false;

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
        velocidadActual = 0;

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
            plaza?.x ?? posicion.x ?? grupo.position.x
        );

        const z = Number(
            plaza?.z ?? posicion.z ?? grupo.position.z
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
        velocidadActual = 0;
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
                console.error(
                    'Error en callback alEntrar:',
                    error
                );
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
            if (estado === 'regresando') {
                estado = 'esperando';
                detenido = true;
                velocidadActual = 0;

                if (accionCaminar) {
                    accionCaminar.stop();
                }

                const cb = callbackRegreso;
                callbackRegreso = null;

                if (cb) cb(api);
            } else {
                terminarLlegada();
            }

            return;
        }

        const dx = p.x - grupo.position.x;
        const dz = p.z - grupo.position.z;
        const d = Math.hypot(dx, dz);

        if (d < 0.35) {
            grupo.position.x = p.x;
            grupo.position.z = p.z;
            indiceRutaExterior++;

            if (indiceRutaExterior >= rutaExterior.length) {
                if (estado === 'regresando') {
                    estado = 'esperando';
                    detenido = true;
                    velocidadActual = 0;

                    if (accionCaminar) {
                        accionCaminar.stop();
                    }

                    const cb = callbackRegreso;
                    callbackRegreso = null;

                    if (cb) cb(api);
                } else {
                    terminarLlegada();
                }
            }

            return;
        }

        orientarSuavemente(dx, dz);

        const paso = Math.min(config.velocidad * dt, d);
        grupo.position.x += dx / d * paso;
        grupo.position.z += dz / d * paso;

        velocidadActual = config.velocidad;
    }

    // =========================================================
    // CONFIGURAR COMPRAS
    // =========================================================

    function configurarCompras(opcionesCompra = {}) {
        productosGrupo = opcionesCompra.productos ?? null;
        carrito = opcionesCompra.carrito ?? null;
        callbackRecoger = opcionesCompra.alRecoger ?? null;
    }

    function listarProductosDisponibles() {
        if (!productosGrupo) return [];

        const lista = [];

        productosGrupo.traverse(o => {
            if (
                o === productosGrupo ||
                !o.isObject3D ||
                !o.visible ||
                o.userData.esUnidadProducto !== true ||
                o.userData.recogido ||
                o.userData.vendido ||
                o.userData.reservado
            ) {
                return;
            }

            if (
                o.userData.reservadoPor != null &&
                o.userData.reservadoPor !== id
            ) {
                return;
            }

            lista.push(o);
        });

        return lista;
    }

    function buscarProductoCercano() {
        if (!productosGrupo || estado !== 'caminando') {
            return null;
        }

        let mejor = null;
        let dMejor = config.distanciaRecoger;

        for (const p of listarProductosDisponibles()) {
            p.updateWorldMatrix(true, false);
            p.getWorldPosition(centroTemporal);

            const d = Math.hypot(
                centroTemporal.x - grupo.position.x,
                centroTemporal.z - grupo.position.z
            );

            if (d < dMejor) {
                dMejor = d;
                mejor = p;
            }
        }

        return mejor;
    }

    function copiaParaCarrito(producto) {
        const copia = producto.clone(true);

        copia.name =
            `ARTICULO_CARRITO_${id}_${contadorCompras}`;

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

        if (
            producto.userData.reservadoPor != null &&
            producto.userData.reservadoPor !== id
        ) {
            return false;
        }

        contadorCompras++;

        const copia = copiaParaCarrito(producto);
        const indice =
            (contadorCompras - 1) % MAX_ARTICULOS_VISIBLES;

        copia.position.set(
            ((indice % 4) - 1.5) * 0.12,
            0.6 + Math.floor(indice / 12) * 0.18,
            (Math.floor((indice % 12) / 4) - 1) * 0.13
        );

        copia.userData.esArticuloCarrito = true;
        copia.userData.nombreProducto =
            producto.userData.nombreProducto ?? producto.name;
        copia.userData.codigoProducto =
            producto.userData.codigoProducto ?? producto.name;
        copia.userData.precio = Number(
            producto.userData.precio ?? 0
        );

        if (
            articulosEnCarrito.length >= MAX_ARTICULOS_VISIBLES
        ) {
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

        const articulo = {
            id: producto.userData.idProducto ?? producto.uuid,
            idCliente: id,
            nombre:
                producto.userData.nombreProducto ?? producto.name,
            codigo:
                producto.userData.codigoProducto ?? producto.name,
            precio: Number(producto.userData.precio ?? 0),
            numeroCompra: contadorCompras,
            unidadOriginal: producto
        };

        comprasCliente.push(articulo);

        if (typeof callbackRecoger === 'function') {
            try {
                callbackRecoger({
                    id: articulo.id,
                    idCliente: articulo.idCliente,
                    nombre: articulo.nombre,
                    codigo: articulo.codigo,
                    precio: articulo.precio,
                    numeroCompra: articulo.numeroCompra
                });
            } catch (error) {
                console.error(
                    'Error en callback de producto:',
                    error
                );
            }
        }

        return true;
    }

    function liberarReserva() {
        if (
            productoEnExamen &&
            productoEnExamen.userData.reservadoPor === id
        ) {
            productoEnExamen.userData.reservadoPor = null;
            productoEnExamen.userData.reservado = false;
        }

        productoEnExamen = null;
    }

    // =========================================================
    // TICKET Y CONFIRMACIÓN
    // =========================================================

    function obtenerCompras() {
        return comprasCliente.map(articulo => ({
            id: articulo.id,
            idCliente: articulo.idCliente,
            nombre: articulo.nombre,
            codigo: articulo.codigo,
            precio: articulo.precio,
            numeroCompra: articulo.numeroCompra
        }));
    }

    function obtenerTotalCompra() {
        return comprasCliente.reduce(
            (total, articulo) => total + articulo.precio,
            0
        );
    }

    function obtenerResumenCompra() {
        return {
            idCliente: id,
            cantidadArticulos: comprasCliente.length,
            subtotal: obtenerTotalCompra(),
            total: obtenerTotalCompra(),
            confirmada: compraConfirmada,
            productos: obtenerCompras()
        };
    }

    function confirmarCompra() {
        if (compraConfirmada) {
            return {
                ok: false,
                mensaje: 'Esta compra ya fue confirmada.',
                ...obtenerResumenCompra()
            };
        }

        if (comprasCliente.length === 0) {
            return {
                ok: false,
                mensaje: 'El carrito está vacío.',
                ...obtenerResumenCompra()
            };
        }

        for (const articulo of comprasCliente) {
            const unidad = articulo.unidadOriginal;

            if (unidad) {
                unidad.userData.vendido = true;
                unidad.userData.recogido = true;
                unidad.userData.reservado = false;
                unidad.userData.reservadoPor = null;
                unidad.visible = false;
            }
        }

        compraConfirmada = true;

        return {
            ok: true,
            mensaje: 'Compra confirmada.',
            ...obtenerResumenCompra()
        };
    }

    // =========================================================
    // SEPARACIÓN ENTRE CLIENTES
    // =========================================================

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

            const dx =
                grupo.position.x - otro.grupo.position.x;
            const dz =
                grupo.position.z - otro.grupo.position.z;
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

    // =========================================================
    // MOVIMIENTO INTERIOR SUAVE
    // =========================================================

    function avanzarInterior(dt) {
        if (!objetivoActual || !rutaActual.length) {
            tiempoSinRuta += dt;

            if (tiempoSinRuta >= config.tiempoReintento) {
                asignarDestino();
            }

            velocidadActual = THREE.MathUtils.damp(
                velocidadActual,
                0,
                ACELERACION_MOVIMIENTO,
                dt
            );

            return;
        }

        const p = rutaActual[indiceRuta];

        if (!p) {
            objetivoActual = null;
            rutaActual = [];
            velocidadActual = 0;
            return;
        }

        const dx = p.x - grupo.position.x;
        const dz = p.z - grupo.position.z;
        const d = Math.hypot(dx, dz);

        if (d < config.distanciaDestino) {
            indiceRuta++;

            if (indiceRuta >= rutaActual.length) {
                objetivoActual = null;
                rutaActual = [];
                indiceRuta = 0;
            }

            return;
        }

        const sep = separacionClientes();

        let vx = dx / d + sep.x * 0.55;
        let vz = dz / d + sep.z * 0.55;

        const n = Math.hypot(vx, vz) || 1;
        vx /= n;
        vz /= n;

        orientarSuavemente(vx, vz);

        const velocidadDeseada = config.velocidad;

        velocidadActual = THREE.MathUtils.damp(
            velocidadActual,
            velocidadDeseada,
            ACELERACION_MOVIMIENTO,
            dt
        );

        const paso = Math.min(velocidadActual * dt, d);

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

        if (!movio) {
            tiempoSinRuta += dt;

            if (tiempoSinRuta >= 0.4) {
                objetivoActual = null;
                rutaActual = [];
                tiempoSinRuta = 0;
            }
        } else {
            tiempoSinRuta = 0;
        }
    }

    // =========================================================
    // ANIMACIÓN DEL ESQUELETO
    // =========================================================

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
    }

    function animarManual(dt) {
        if (!modelo || accionCaminar) return;

        const caminando =
            estado === 'caminando' ||
            estado === 'llegando' ||
            estado === 'regresando';

        const movimiento =
            caminando
                ? THREE.MathUtils.clamp(
                    velocidadActual /
                    Math.max(config.velocidad, 0.01),
                    0,
                    1
                )
                : 0;

        velocidadAnimacion = THREE.MathUtils.damp(
            velocidadAnimacion,
            movimiento,
            8,
            dt
        );

        faseCaminar +=
            dt * (5 + velocidadAnimacion * 7);

        const balanceo =
            Math.sin(faseCaminar) *
            0.48 *
            velocidadAnimacion;

        const rotar = (nombre, valor) => {
            const h = huesos[nombre];
            const b = h && rotacionesBase.get(h);

            if (h && b) {
                h.rotation.x = b.x + valor;
            }
        };

        rotar('thighL', balanceo);
        rotar('thighR', -balanceo);

        rotar(
            'shinL',
            Math.max(0, -balanceo) * 0.65
        );

        rotar(
            'shinR',
            Math.max(0, balanceo) * 0.65
        );

        rotar('armL', -balanceo * 0.6);
        rotar('armR', balanceo * 0.6);
    }

    // =========================================================
    // CARGA DEL MODELO
    // =========================================================

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
                    /walk|walking|caminar|andar|locomotion/i.test(
                        c.name
                    )
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
                `Cliente ${id} cargado: ${config.modelo}; ` +
                `animaciones: ${clips.length}`
            );
        },
        undefined,
        error => {
            console.error(
                `No se pudo cargar ${config.modelo}. ` +
                `Verifica public${config.modelo}`,
                error
            );
        }
    );

    // =========================================================
    // ACTUALIZACIÓN
    // =========================================================

    function actualizar(delta) {
        if (eliminado || detenido || !Number.isFinite(delta)) {
            return;
        }

        const dt = Math.min(Math.max(delta, 0), 0.05);

        if (mixer) {
            mixer.update(dt);
        }

        tiempoEstado += dt;
        tiempoCompra += dt;

        if (estado === 'esperando') {
            velocidadActual = 0;
            return;
        }

        if (
            estado === 'llegando' ||
            estado === 'regresando'
        ) {
            avanzarExterior(dt);
        } else if (estado === 'caminando') {
            avanzarInterior(dt);

            if (tiempoCompra >= config.pausaEntreCompras) {
                const p = buscarProductoCercano();

                if (p) {
                    productoEnExamen = p;
                    p.userData.reservadoPor = id;
                    p.userData.reservado = true;

                    p.updateWorldMatrix(true, false);
                    p.getWorldPosition(centroTemporal);

                    orientarSuavemente(
                        centroTemporal.x - grupo.position.x,
                        centroTemporal.z - grupo.position.z
                    );

                    estado = 'examinando';
                    tiempoEstado = 0;
                    velocidadActual = 0;

                    if (accionCaminar) {
                        accionCaminar.stop();
                    }
                }
            }
        } else if (estado === 'examinando') {
            velocidadActual = 0;

            if (
                productoEnExamen &&
                !productoEnExamen.userData.recogido &&
                !productoEnExamen.userData.vendido
            ) {
                productoEnExamen.updateWorldMatrix(true, false);
                productoEnExamen.getWorldPosition(centroTemporal);

                orientarSuavemente(
                    centroTemporal.x - grupo.position.x,
                    centroTemporal.z - grupo.position.z
                );
            }

            if (tiempoEstado >= config.tiempoExaminar) {
                let recogido = false;

                if (
                    productoEnExamen &&
                    !productoEnExamen.userData.recogido &&
                    !productoEnExamen.userData.vendido &&
                    Math.random() <= config.probabilidadCompra
                ) {
                    recogido = agregarAlCarrito(productoEnExamen);
                }

                if (!recogido) {
                    liberarReserva();
                }

                productoEnExamen = null;
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
        }

        actualizarRotacionSuave(dt);
        animarManual(dt);
    }

    // =========================================================
    // CONTROL Y ELIMINACIÓN
    // =========================================================

    function detenerAnimacion() {
        detenido = true;
        velocidadActual = 0;

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

    // =========================================================
    // API PÚBLICA
    // =========================================================

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
            return compraConfirmada;
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
