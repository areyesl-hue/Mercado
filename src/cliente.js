
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// CLIENTES Y LADRONES DEL SUPERMERCADO
// Three.js 0.180+
// ============================================================

const loader = new GLTFLoader();

const productosCompradosGlobal = new Set();
const productosReservadosGlobal = new Map();

const CONFIG_BASE = {
    modelo: '/modelos/Cliente1.glb',
    posicion: { x: 0, y: 0, z: 20 },
    altura: 1.75,
    escala: 1,
    velocidad: 1.5,

    repetirRuta: false,
    inactivo: false,
    probabilidadCompra: 0.85,

    distanciaProducto: 1.25,
    tiempoSeleccionProducto: 2.5,
    tiempoEntreProductos: 1.5,

    radioColision: 0.65,
    limiteX: 29,
    limiteZMin: -27,
    limiteZMax: 27,

    ruta: [],
    productos: [],
    carrito: null,

    alEntrar: null,
    alComprar: null,
    alPagar: null,
    alFinalizar: null
};

// ============================================================
// UTILIDADES
// ============================================================

function limitar(valor, minimo, maximo) {
    return Math.max(minimo, Math.min(maximo, valor));
}

function distancia(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
}

function punto(x, z) {
    return new THREE.Vector3(x, 0, z);
}

function numeroAleatorio(min, max) {
    return min + Math.random() * (max - min);
}

function obtenerNombre(objeto) {
    return (
        objeto?.userData?.nombre ||
        objeto?.userData?.nombreProducto ||
        objeto?.userData?.producto ||
        objeto?.name ||
        'Producto'
    );
}

function obtenerCodigo(objeto) {
    return (
        objeto?.userData?.codigo ||
        objeto?.userData?.sku ||
        objeto?.userData?.idProducto ||
        objeto?.name ||
        'SIN-CODIGO'
    );
}

function obtenerPrecio(objeto) {
    const precio = Number(
        objeto?.userData?.precio ??
        objeto?.userData?.price ??
        objeto?.userData?.costo ??
        0
    );

    return Number.isFinite(precio) ? precio : 0;
}

function esUnidadProducto(objeto) {
    if (!objeto) return false;

    return (
        objeto.userData?.esUnidadProducto === true ||
        objeto.userData?.tipo === 'producto' ||
        objeto.userData?.esProducto === true
    );
}

function obtenerIdentificadorUnidad(objeto) {
    return objeto.uuid;
}

// ============================================================
// NAVEGACIÓN Y OBSTÁCULOS
// ============================================================

const CELDA = 1;

const OBSTACULOS = [
    // Góndolas centrales
    { minX: -18.7, maxX: -7.3, minZ: -15.5, maxZ: -10.5 },
    { minX: -18.7, maxX: -7.3, minZ: -2.5, maxZ: 2.5 },
    { minX: -18.7, maxX: -7.3, minZ: 10.5, maxZ: 15.5 },

    { minX: 7.3, maxX: 18.7, minZ: -15.5, maxZ: -10.5 },
    { minX: 7.3, maxX: 18.7, minZ: -2.5, maxZ: 2.5 },
    { minX: 7.3, maxX: 18.7, minZ: 10.5, maxZ: 15.5 },

    // Muebles laterales
    { minX: -29, maxX: -25, minZ: -27, maxZ: -24 },
    { minX: 25, maxX: 29, minZ: -27, maxZ: -24 },

    // Refrigeradores laterales
    { minX: -29, maxX: -15, minZ: -28, maxZ: -25.5 },
    { minX: 15, maxX: 29, minZ: -28, maxZ: -25.5 }
];

function puntoBloqueado(x, z, radio = 0.55) {
    if (
        x < -29 + radio ||
        x > 29 - radio ||
        z < -27 + radio ||
        z > 27 - radio
    ) {
        return true;
    }

    return OBSTACULOS.some(o =>
        x + radio > o.minX &&
        x - radio < o.maxX &&
        z + radio > o.minZ &&
        z - radio < o.maxZ
    );
}

function segmentoLibre(a, b, radio = 0.55) {
    const d = distancia(a, b);
    const pasos = Math.max(2, Math.ceil(d / 0.4));

    for (let i = 0; i <= pasos; i++) {
        const t = i / pasos;
        const x = THREE.MathUtils.lerp(a.x, b.x, t);
        const z = THREE.MathUtils.lerp(a.z, b.z, t);

        if (puntoBloqueado(x, z, radio)) return false;
    }

    return true;
}

function simplificarRuta(ruta, radio) {
    if (ruta.length < 3) return ruta;

    const resultado = [ruta[0]];
    let actual = 0;

    while (actual < ruta.length - 1) {
        let siguiente = ruta.length - 1;

        while (
            siguiente > actual + 1 &&
            !segmentoLibre(ruta[actual], ruta[siguiente], radio)
        ) {
            siguiente--;
        }

        resultado.push(ruta[siguiente]);
        actual = siguiente;
    }

    return resultado;
}

function encontrarRuta(inicio, destino, radio = 0.55) {
    const origen = punto(inicio.x, inicio.z);
    const final = punto(destino.x, destino.z);

    if (!puntoBloqueado(final.x, final.z, radio) &&
        segmentoLibre(origen, final, radio)) {
        return [final];
    }

    const inicioX = Math.round(origen.x / CELDA);
    const inicioZ = Math.round(origen.z / CELDA);
    const finalX = Math.round(final.x / CELDA);
    const finalZ = Math.round(final.z / CELDA);

    const clave = (x, z) => `${x},${z}`;

    const abiertos = [{
        x: inicioX,
        z: inicioZ,
        g: 0,
        h: Math.hypot(finalX - inicioX, finalZ - inicioZ),
        padre: null
    }];

    const cerrados = new Set();
    const nodos = new Map();

    nodos.set(clave(inicioX, inicioZ), abiertos[0]);

    const direcciones = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [-1, 1], [1, -1], [-1, -1]
    ];

    let resultado = null;
    let iteraciones = 0;

    while (abiertos.length && iteraciones < 9000) {
        iteraciones++;

        abiertos.sort((a, b) =>
            (a.g + a.h) - (b.g + b.h)
        );

        const actual = abiertos.shift();
        const llaveActual = clave(actual.x, actual.z);

        if (cerrados.has(llaveActual)) continue;
        cerrados.add(llaveActual);

        if (
            Math.abs(actual.x - finalX) <= 1 &&
            Math.abs(actual.z - finalZ) <= 1
        ) {
            resultado = actual;
            break;
        }

        for (const [dx, dz] of direcciones) {
            const nx = actual.x + dx;
            const nz = actual.z + dz;
            const llave = clave(nx, nz);

            if (cerrados.has(llave)) continue;

            const px = nx * CELDA;
            const pz = nz * CELDA;

            if (puntoBloqueado(px, pz, radio)) continue;

            // Evitar atravesar esquinas de obstáculos.
            if (
                dx !== 0 && dz !== 0 &&
                (
                    puntoBloqueado(actual.x + dx, actual.z, radio) ||
                    puntoBloqueado(actual.x, actual.z + dz, radio)
                )
            ) {
                continue;
            }

            const coste = dx !== 0 && dz !== 0 ? 1.414 : 1;
            const g = actual.g + coste;

            const anterior = nodos.get(llave);

            if (!anterior || g < anterior.g) {
                const nuevo = {
                    x: nx,
                    z: nz,
                    g,
                    h: Math.hypot(finalX - nx, finalZ - nz),
                    padre: actual
                };

                nodos.set(llave, nuevo);
                abiertos.push(nuevo);
            }
        }
    }

    if (!resultado) return [];

    const ruta = [];

    while (resultado) {
        ruta.unshift(punto(
            resultado.x * CELDA,
            resultado.z * CELDA
        ));

        resultado = resultado.padre;
    }

    ruta[0] = origen;
    ruta[ruta.length - 1] = final;

    return simplificarRuta(ruta, radio).slice(1);
}

// ============================================================
// ANIMACIÓN MANUAL DEL ESQUELETO
// ============================================================

function buscarHueso(huesos, palabras) {
    const entradas = Object.entries(huesos);

    for (const palabra of palabras) {
        const encontrado = entradas.find(([nombre]) =>
            nombre.toLowerCase().includes(palabra)
        );

        if (encontrado) return encontrado[1];
    }

    return null;
}

function crearControlHuesos(modelo) {
    const huesos = {};

    modelo.traverse(objeto => {
        if (objeto.isBone) {
            huesos[objeto.name] = objeto;
        }
    });

    const brazos = {
        izquierdo: buscarHueso(huesos, [
            'leftarm', 'left_arm', 'upperarm_l',
            'arm_l', 'brazo_izquierdo'
        ]),
        derecho: buscarHueso(huesos, [
            'rightarm', 'right_arm', 'upperarm_r',
            'arm_r', 'brazo_derecho'
        ])
    };

    const antebrazos = {
        izquierdo: buscarHueso(huesos, [
            'leftforearm', 'lowerarm_l', 'forearm_l'
        ]),
        derecho: buscarHueso(huesos, [
            'rightforearm', 'lowerarm_r', 'forearm_r'
        ])
    };

    const piernas = {
        izquierdo: buscarHueso(huesos, [
            'leftupleg', 'thigh_l', 'upperleg_l',
            'leg_l', 'pierna_izquierda'
        ]),
        derecho: buscarHueso(huesos, [
            'rightupleg', 'thigh_r', 'upperleg_r',
            'leg_r', 'pierna_derecha'
        ])
    };

    const rodillas = {
        izquierdo: buscarHueso(huesos, [
            'leftleg', 'calf_l', 'lowerleg_l', 'shin_l'
        ]),
        derecho: buscarHueso(huesos, [
            'rightleg', 'calf_r', 'lowerleg_r', 'shin_r'
        ])
    };

    const base = new Map();

    Object.values(huesos).forEach(hueso => {
        base.set(hueso, hueso.rotation.clone());
    });

    function restaurar() {
        for (const [hueso, rotacion] of base) {
            hueso.rotation.copy(rotacion);
        }
    }

    function animar(caminar, tiempo, intensidad = 1) {
        restaurar();

        if (!caminar) return;

        const movimiento = Math.sin(tiempo * 8) * 0.55 * intensidad;
        const movimientoContrario = -movimiento;

        if (piernas.izquierdo) {
            piernas.izquierdo.rotation.x += movimiento;
        }

        if (piernas.derecho) {
            piernas.derecho.rotation.x += movimientoContrario;
        }

        if (rodillas.izquierdo) {
            rodillas.izquierdo.rotation.x +=
                Math.max(0, -movimiento) * 0.65;
        }

        if (rodillas.derecho) {
            rodillas.derecho.rotation.x +=
                Math.max(0, movimiento) * 0.65;
        }

        if (brazos.izquierdo) {
            brazos.izquierdo.rotation.x += movimientoContrario * 0.75;
        }

        if (brazos.derecho) {
            brazos.derecho.rotation.x += movimiento * 0.75;
        }

        if (antebrazos.izquierdo) {
            antebrazos.izquierdo.rotation.x += 0.12;
        }

        if (antebrazos.derecho) {
            antebrazos.derecho.rotation.x += 0.12;
        }
    }

    return { huesos, animar, restaurar };
}

// ============================================================
// CREAR CLIENTE
// ============================================================

export function crearClienteSupermercado(scene, opciones = {}) {
    if (!scene) {
        throw new Error(
            'crearClienteSupermercado necesita una THREE.Scene.'
        );
    }

    const config = {
        ...CONFIG_BASE,
        ...opciones,
        posicion: {
            ...CONFIG_BASE.posicion,
            ...(opciones.posicion || {})
        }
    };

    const id = config.id || `CLIENTE_${THREE.MathUtils.generateUUID()}`;

    const grupo = new THREE.Group();
    grupo.name = id;

    grupo.position.set(
        config.posicion.x,
        config.posicion.y,
        config.posicion.z
    );

    scene.add(grupo);

    let modelo = null;
    let mixer = null;
    let controlHuesos = null;

    let cargado = false;
    let eliminado = false;
    let entro = false;

    let estado = config.inactivo ? 'inactivo' : 'cargando';

    let ruta = [];
    let indiceRuta = 0;

    let tiempoAnimacion = Math.random() * 10;
    let tiempoEstado = 0;
    let tiempoCompra = 0;
    let tiempoEspera = 0;

    let objetivo = null;
    let productoEnMano = null;
    let productoObjetivo = null;

    let zona = 'supermercado';
    let pagoConfirmado = false;
    let compraConfirmada = false;
    let resumenPago = null;

    const productosCarrito = [];
    const productosLocalesReservados = new Set();

    let carrito = config.carrito || null;
    let callbackPago = null;
    let callbackRegreso = null;

    let posicionAnterior = grupo.position.clone();

    // --------------------------------------------------------
    // CARGAR MODELO
    // --------------------------------------------------------

    loader.load(
        config.modelo,
        gltf => {
            if (eliminado) return;

            modelo = gltf.scene;
            modelo.name = `MODELO_${id}`;

            modelo.scale.setScalar(config.escala);

            modelo.traverse(objeto => {
                if (!objeto.isMesh) return;

                objeto.castShadow = false;
                objeto.receiveShadow = false;
            });

            const caja = new THREE.Box3().setFromObject(modelo);
            const centro = new THREE.Vector3();

            caja.getCenter(centro);

            modelo.position.x -= centro.x;
            modelo.position.z -= centro.z;
            modelo.position.y -= caja.min.y;

            grupo.add(modelo);

            mixer = new THREE.AnimationMixer(modelo);

            if (gltf.animations?.length) {
                gltf.animations.forEach(clip => {
                    const accion = mixer.clipAction(clip);
                    accion.play();
                });
            }

            controlHuesos = crearControlHuesos(modelo);

            cargado = true;

            if (estado === 'cargando') {
                estado = config.inactivo ? 'inactivo' : 'recorriendo';
            }

            console.log(
                `${id}: modelo cargado. Huesos:`,
                Object.keys(controlHuesos.huesos).length,
                'Animaciones:',
                gltf.animations?.length || 0
            );

            if (config.ruta?.length && !config.inactivo) {
                establecerRuta(config.ruta);
            }
        },

        undefined,

        error => {
            console.error(
                `Error cargando modelo ${config.modelo}:`,
                error
            );

            crearModeloProvisional();
            cargado = true;

            if (estado === 'cargando') {
                estado = config.inactivo ? 'inactivo' : 'recorriendo';
            }
        }
    );

    function crearModeloProvisional() {
        const cuerpo = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.32, 0.85, 4, 8),
            new THREE.MeshStandardMaterial({ color: 0x2877bb })
        );

        cuerpo.position.y = 0.95;
        grupo.add(cuerpo);

        const cabeza = new THREE.Mesh(
            new THREE.SphereGeometry(0.24, 12, 10),
            new THREE.MeshStandardMaterial({ color: 0xd5a17d })
        );

        cabeza.position.y = 1.65;
        grupo.add(cabeza);

        modelo = grupo;
    }

    // ========================================================
    // PRODUCTOS
    // ========================================================

    function listarProductosDisponibles() {
        const encontrados = [];

        if (Array.isArray(config.productos) && config.productos.length) {
            for (const producto of config.productos) {
                if (producto?.isObject3D) {
                    encontrados.push(producto);
                }
            }
        } else {
            scene.traverse(objeto => {
                if (esUnidadProducto(objeto)) {
                    encontrados.push(objeto);
                }
            });
        }

        return encontrados.filter(objeto => {
            if (!objeto || !objeto.parent) return false;
            if (!esUnidadProducto(objeto)) return false;

            // Cada unidad física tiene su propio UUID.
            const unidadId = obtenerIdentificadorUnidad(objeto);

            if (productosCompradosGlobal.has(unidadId)) return false;
            if (productosReservadosGlobal.has(unidadId)) return false;
            if (productosLocalesReservados.has(unidadId)) return false;

            if (objeto.userData.disponible === false) return false;
            if (objeto.userData.enCarrito) return false;

            return true;
        });
    }

    function reservarProducto(producto) {
        if (!producto) return false;

        const unidadId = obtenerIdentificadorUnidad(producto);

        if (productosCompradosGlobal.has(unidadId)) return false;
        if (productosReservadosGlobal.has(unidadId)) return false;

        productosReservadosGlobal.set(unidadId, id);
        productosLocalesReservados.add(unidadId);

        producto.userData.reservadoPor = id;

        return true;
    }

    function liberarReserva(producto) {
        if (!producto) return;

        const unidadId = obtenerIdentificadorUnidad(producto);

        if (productosReservadosGlobal.get(unidadId) === id) {
            productosReservadosGlobal.delete(unidadId);
        }

        productosLocalesReservados.delete(unidadId);

        if (producto.userData.reservadoPor === id) {
            delete producto.userData.reservadoPor;
        }
    }

    function agregarAlCarrito(producto) {
        if (!producto || !producto.parent) return false;

        const unidadId = obtenerIdentificadorUnidad(producto);

        if (productosCompradosGlobal.has(unidadId)) return false;
        if (productosReservadosGlobal.get(unidadId) !== id) return false;

        const registro = {
            id: unidadId,
            uuid: unidadId,
            codigo: obtenerCodigo(producto),
            nombre: obtenerNombre(producto),
            precio: obtenerPrecio(producto),
            objeto: producto
        };

        productosCarrito.push(registro);

        productosCompradosGlobal.add(unidadId);
        productosReservadosGlobal.delete(unidadId);
        productosLocalesReservados.delete(unidadId);

        producto.userData.enCarrito = true;
        producto.userData.compradoPor = id;
        producto.userData.reservadoPor = null;

        if (carrito?.agregarProducto) {
            carrito.agregarProducto(producto);
        } else {
            producto.visible = false;
        }

        if (typeof config.alComprar === 'function') {
            config.alComprar(registro, api);
        }

        return true;
    }

    function buscarProductoCercano() {
        const disponibles = listarProductosDisponibles();

        let mejor = null;
        let menorDistancia = Infinity;

        for (const producto of disponibles) {
            const posicion = new THREE.Vector3();

            producto.getWorldPosition(posicion);

            const d = distancia(grupo.position, posicion);

            if (d < menorDistancia && d < 18) {
                menorDistancia = d;
                mejor = {
                    objeto: producto,
                    posicion,
                    distancia: d
                };
            }
        }

        return mejor;
    }

    function posicionDeProducto(producto) {
        const posicion = new THREE.Vector3();
        producto.getWorldPosition(posicion);
        return posicion;
    }

    // ========================================================
    // RUTAS
    // ========================================================

    function establecerRuta(puntos) {
        if (!Array.isArray(puntos) || !puntos.length) return false;

        const destino = puntos.map(p => ({
            x: Number(p.x),
            z: Number(p.z)
        })).filter(p =>
            Number.isFinite(p.x) && Number.isFinite(p.z)
        );

        if (!destino.length) return false;

        ruta = [];

        let actual = {
            x: grupo.position.x,
            z: grupo.position.z
        };

        for (const destinoPunto of destino) {
            const tramo = encontrarRuta(
                actual,
                destinoPunto,
                config.radioColision
            );

            if (!tramo.length) {
                console.warn(
                    `${id}: no se pudo encontrar ruta hacia`,
                    destinoPunto
                );
                continue;
            }

            ruta.push(...tramo);
            actual = destinoPunto;
        }

        indiceRuta = 0;
        objetivo = ruta[0] || null;

        if (ruta.length) {
            estado = 'recorriendo';
            return true;
        }

        return false;
    }

    function establecerRutaDirecta(destino) {
        const nuevaRuta = encontrarRuta(
            {
                x: grupo.position.x,
                z: grupo.position.z
            },
            destino,
            config.radioColision
        );

        if (!nuevaRuta.length) return false;

        ruta = nuevaRuta;
        indiceRuta = 0;
        objetivo = ruta[0];

        return true;
    }

    function establecerPosicion(posicion) {
        if (!posicion) return;

        grupo.position.set(
            posicion.x ?? grupo.position.x,
            posicion.y ?? grupo.position.y,
            posicion.z ?? grupo.position.z
        );
    }

    function avanzarRuta(delta) {
        if (!ruta.length || indiceRuta >= ruta.length) {
            return true;
        }

        objetivo = ruta[indiceRuta];

        const dx = objetivo.x - grupo.position.x;
        const dz = objetivo.z - grupo.position.z;

        const d = Math.hypot(dx, dz);

        if (d < 0.12) {
            grupo.position.x = objetivo.x;
            grupo.position.z = objetivo.z;

            indiceRuta++;

            if (indiceRuta >= ruta.length) {
                ruta = [];
                objetivo = null;
                return true;
            }

            objetivo = ruta[indiceRuta];
            return false;
        }

        const direccionX = dx / d;
        const direccionZ = dz / d;

        const velocidad = config.velocidad;
        const avance = Math.min(d, velocidad * delta);

        const nuevaX = grupo.position.x + direccionX * avance;
        const nuevaZ = grupo.position.z + direccionZ * avance;

        if (!puntoBloqueado(nuevaX, nuevaZ, config.radioColision)) {
            grupo.position.x = nuevaX;
            grupo.position.z = nuevaZ;
        } else {
            // Recalcular ruta si el punto queda bloqueado.
            const destino = {
                x: objetivo.x,
                z: objetivo.z
            };

            if (!establecerRutaDirecta(destino)) {
                estado = 'esperando';
                tiempoEspera = 0;
                return false;
            }
        }

        const angulo = Math.atan2(direccionX, direccionZ);

        grupo.rotation.y = THREE.MathUtils.damp(
            grupo.rotation.y,
            angulo,
            8,
            delta
        );

        return false;
    }

    // ========================================================
    // SELECCIÓN DE PRODUCTOS
    // ========================================================

    function iniciarBusquedaProductos() {
        if (Math.random() > config.probabilidadCompra) {
            finalizarRecorrido();
            return;
        }

        estado = 'buscandoProducto';
        tiempoEstado = 0;
    }

    function seleccionarProducto() {
        const encontrado = buscarProductoCercano();

        if (!encontrado) {
            finalizarRecorrido();
            return;
        }

        const producto = encontrado.objeto;

        if (!reservarProducto(producto)) {
            estado = 'buscandoProducto';
            return;
        }

        productoObjetivo = producto;

        const posicion = encontrado.posicion;

        const dx = grupo.position.x - posicion.x;
        const dz = grupo.position.z - posicion.z;
        const longitud = Math.hypot(dx, dz) || 1;

        const destino = {
            x: posicion.x + (dx / longitud) * config.distanciaProducto,
            z: posicion.z + (dz / longitud) * config.distanciaProducto
        };

        if (!establecerRutaDirecta(destino)) {
            liberarReserva(producto);
            productoObjetivo = null;
            estado = 'buscandoProducto';
            return;
        }

        estado = 'acercandoseProducto';
    }

    function recogerProducto() {
        if (!productoObjetivo) {
            estado = 'buscandoProducto';
            return;
        }

        if (!productoObjetivo.parent) {
            liberarReserva(productoObjetivo);
            productoObjetivo = null;
            estado = 'buscandoProducto';
            return;
        }

        const posicion = posicionDeProducto(productoObjetivo);

        if (distancia(grupo.position, posicion) > 3.5) {
            liberarReserva(productoObjetivo);
            productoObjetivo = null;
            estado = 'buscandoProducto';
            return;
        }

        productoEnMano = productoObjetivo;

        tiempoEstado = 0;
        estado = 'recogiendoProducto';
    }

    function finalizarRecogida() {
        if (!productoEnMano) {
            estado = 'buscandoProducto';
            return;
        }

        const producto = productoEnMano;

        if (!agregarAlCarrito(producto)) {
            liberarReserva(producto);
        }

        productoEnMano = null;
        productoObjetivo = null;

        tiempoEspera = 0;
        estado = 'esperandoEntreProductos';
    }

    // ========================================================
    // RECORRIDO DEL CLIENTE
    // ========================================================

    function finalizarRecorrido() {
        if (config.repetirRuta && config.ruta?.length) {
            const primera = config.ruta[0];

            establecerRuta([primera]);
            estado = 'recorriendo';
        } else {
            estado = 'finalizado';

            if (typeof config.alFinalizar === 'function') {
                config.alFinalizar(api);
            }
        }
    }

    // ========================================================
    // PAGO
    // ========================================================

    function obtenerTotalCompra() {
        return productosCarrito.reduce(
            (total, producto) => total + producto.precio,
            0
        );
    }

    function obtenerResumenCompra() {
        const detalle = productosCarrito.map(producto => ({
            id: producto.id,
            codigo: producto.codigo,
            nombre: producto.nombre,
            precio: producto.precio
        }));

        return {
            cliente: id,
            productos: detalle,
            cantidad: detalle.length,
            total: obtenerTotalCompra()
        };
    }

    function confirmarCompra() {
        if (compraConfirmada) return obtenerResumenCompra();

        compraConfirmada = true;
        pagoConfirmado = true;

        resumenPago = obtenerResumenCompra();

        return resumenPago;
    }

    function iniciarPago(posicionCaja, callback) {
        if (eliminado || pagoConfirmado) return false;

        if (productoEnMano) {
            liberarReserva(productoEnMano);
            productoEnMano = null;
        }

        if (productoObjetivo) {
            liberarReserva(productoObjetivo);
            productoObjetivo = null;
        }

        if (estado === 'pagando') return false;

        callbackPago = callback || null;

        const destino = posicionCaja || { x: 0, z: 20 };

        if (!establecerRutaDirecta(destino)) {
            console.warn(`${id}: no hay ruta libre hacia la caja.`);
            return false;
        }

        estado = 'yendoCaja';
        return true;
    }

    function completarPago() {
        if (pagoConfirmado) return;

        estado = 'pagando';

        const resumen = confirmarCompra();

        if (typeof config.alPagar === 'function') {
            config.alPagar(resumen, api);
        }

        if (callbackPago) {
            const callback = callbackPago;
            callbackPago = null;
            callback(resumen);
        }

        if (typeof config.alFinalizar === 'function') {
            config.alFinalizar(api);
        }
    }

    // ========================================================
    // REGRESO AL VEHÍCULO
    // ========================================================

    function iniciarRegresoVehiculo(plaza, callback) {
        if (!plaza) return false;

        callbackRegreso = callback || null;

        const destino = [
            { x: 0, z: 25.5 },
            { x: 0, z: 30.5 },
            { x: 8, z: 34 },
            { x: 20, z: 34 },
            { x: 30, z: 34 },
            { x: 30, z: plaza.z + 5 },
            { x: plaza.x, z: plaza.z + 5 },
            { x: plaza.x, z: plaza.z }
        ];

        const puntosValidos = destino.filter(p =>
            !puntoBloqueado(p.x, p.z, config.radioColision)
        );

        // La ruta exterior no utiliza la cuadrícula interior.
        ruta = puntosValidos.map(p => punto(p.x, p.z));
        indiceRuta = 0;

        estado = 'regresandoVehiculo';
        zona = 'exterior';

        return ruta.length > 0;
    }

    function iniciarDesdeVehiculo(posicion, plaza) {
        if (!posicion || !plaza) return false;

        establecerPosicion({
            x: plaza.x,
            y: 0,
            z: plaza.z
        });

        zona = 'exterior';

        ruta = [
            punto(plaza.x, plaza.z + 5),
            punto(plaza.x, 78),
            punto(0, 78),
            punto(0, 83),
            punto(0, 32),
            punto(0, 27)
        ];

        indiceRuta = 0;
        estado = 'entrandoSupermercado';

        return true;
    }

    // ========================================================
    // ACTUALIZACIÓN
    // ========================================================

    function actualizar(delta = 0.016) {
        if (eliminado || !cargado) return;

        delta = Math.min(Math.max(delta, 0), 0.05);

        tiempoAnimacion += delta;
        tiempoEstado += delta;

        if (mixer) {
            mixer.update(delta);
        }

        const movimiento = distancia(
            grupo.position,
            posicionAnterior
        );

        posicionAnterior.copy(grupo.position);

        const caminando = movimiento > 0.001;

        controlHuesos?.animar(
            caminando,
            tiempoAnimacion,
            estado === 'recogiendoProducto' ? 0.25 : 1
        );

        switch (estado) {
            case 'cargando':
            case 'inactivo':
            case 'finalizado':
            case 'pagando':
                break;

            case 'recorriendo': {
                const llego = avanzarRuta(delta);

                if (llego) {
                    iniciarBusquedaProductos();
                }

                break;
            }

            case 'buscandoProducto':
                seleccionarProducto();
                break;

            case 'acercandoseProducto': {
                const llego = avanzarRuta(delta);

                if (llego) {
                    recogerProducto();
                }

                break;
            }

            case 'recogiendoProducto':
                if (tiempoEstado >= config.tiempoSeleccionProducto) {
                    finalizarRecogida();
                }
                break;

            case 'esperandoEntreProductos':
                tiempoEspera += delta;

                if (tiempoEspera >= config.tiempoEntreProductos) {
                    estado = 'buscandoProducto';
                }
                break;

            case 'yendoCaja': {
                const llego = avanzarRuta(delta);

                if (llego) {
                    completarPago();
                }

                break;
            }

            case 'regresandoVehiculo': {
                const llego = avanzarRuta(delta);

                if (llego) {
                    estado = 'esperandoSalida';

                    if (callbackRegreso) {
                        const callback = callbackRegreso;
                        callbackRegreso = null;
                        callback(api);
                    }
                }

                break;
            }

            case 'entrandoSupermercado': {
                const llego = avanzarRuta(delta);

                if (llego) {
                    zona = 'supermercado';
                    entro = true;
                    estado = 'recorriendo';

                    if (typeof config.alEntrar === 'function') {
                        config.alEntrar(api);
                    }

                    if (config.ruta?.length) {
                        establecerRuta(config.ruta);
                    }
                }

                break;
            }

            case 'esperando':
                tiempoEspera += delta;

                if (tiempoEspera > 2) {
                    tiempoEspera = 0;
                    estado = 'buscandoProducto';
                }
                break;
        }
    }

    // ========================================================
    // CONTROL DE ANIMACIONES
    // ========================================================

    function detenerAnimacion() {
        mixer?.stopAllAction();
        controlHuesos?.restaurar();
    }

    function reproducirAnimacion(nombre) {
        if (!mixer || !modelo) return false;

        const clips = mixer._root?.animations || [];

        const clip = clips.find(a =>
            a.name.toLowerCase().includes(nombre.toLowerCase())
        );

        if (!clip) return false;

        mixer.stopAllAction();
        mixer.clipAction(clip).reset().play();

        return true;
    }

    // ========================================================
    // ELIMINAR CLIENTE
    // ========================================================

    function eliminar() {
        if (eliminado) return;

        eliminado = true;
        estado = 'eliminado';

        for (const unidadId of productosLocalesReservados) {
            if (productosReservadosGlobal.get(unidadId) === id) {
                productosReservadosGlobal.delete(unidadId);
            }
        }

        productosLocalesReservados.clear();

        if (productoEnMano) {
            liberarReserva(productoEnMano);
        }

        if (productoObjetivo) {
            liberarReserva(productoObjetivo);
        }

        mixer?.stopAllAction();

        scene.remove(grupo);

        grupo.traverse(objeto => {
            if (!objeto.isMesh) return;

            objeto.geometry?.dispose();

            if (Array.isArray(objeto.material)) {
                objeto.material.forEach(material => material.dispose());
            } else {
                objeto.material?.dispose();
            }
        });

        console.log(`${id} eliminado.`);
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

        configurarCompras(opciones = {}) {
            if (Array.isArray(opciones.productos)) {
                config.productos = opciones.productos;
            }

            if (opciones.carrito) {
                carrito = opciones.carrito;
                config.carrito = carrito;
            }
        },

        iniciarDesdeVehiculo,
        iniciarRegresoVehiculo,
        iniciarPago,

        detenerAnimacion,
        reproducirAnimacion,
        eliminar,

        obtenerCompras() {
            return productosCarrito.map(p => ({ ...p }));
        },

        obtenerTotalCompra,
        obtenerResumenCompra,
        confirmarCompra,

        get cargado() {
            return cargado;
        },

        get huesos() {
            return controlHuesos?.huesos || {};
        },

        get estado() {
            return estado;
        },

        get eliminado() {
            return eliminado;
        },

        get entro() {
            return entro;
        },

        get compraConfirmada() {
            return compraConfirmada;
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
            return zona;
        }
    };

    return api;
}

// ============================================================
// ALIAS DE COMPATIBILIDAD
// ============================================================

export const crearCliente = crearClienteSupermercado;
