
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// CLIENTE DEL SUPERMERCADO
// Archivo: cliente.js
// Compatible con Three.js 0.180+
//
// Funciones:
// - Carga de Cliente1.glb.
// - Movimiento con búsqueda de caminos A*.
// - Evita muebles y obstáculos.
// - Búsqueda, recogida y devolución de productos.
// - Integración opcional con carrito.
// - Entrada desde vehículo y regreso.
// - Pago en cajas.
// - Animación procedural si el GLB no tiene animaciones.
//
// MEDIDAS DEL MERCADO:
// X: -32 a 32
// Z: -29 a 29
// Entrada: Z positivo
// Estacionamiento: Z mayor a 29
// ============================================================

const ESTADOS = {
    INACTIVO: 'INACTIVO',
    ENTRANDO: 'ENTRANDO',
    BUSCANDO: 'BUSCANDO',
    ACERCANDO: 'ACERCANDO',
    RECOGIENDO: 'RECOGIENDO',
    GUARDANDO: 'GUARDANDO',
    ESPERANDO: 'ESPERANDO',
    RUTA: 'RUTA',
    CAJA: 'CAJA',
    PAGANDO: 'PAGANDO',
    REGRESANDO: 'REGRESANDO',
    FINALIZADO: 'FINALIZADO'
};

const CONFIG_BASE = {
    modelo: '/modelos/Cliente1.glb',

    posicion: { x: 0, y: 0, z: 20 },
    escala: 1,
    altura: 1.75,

    velocidad: 1.5,
    velocidadEntrada: 1.8,
    velocidadRegreso: 1.8,

    limiteX: 29,
    limiteZMin: -27,
    limiteZMax: 55,

    radioColision: 0.42,
    margenObstaculos: 0.35,
    tamanoCelda: 0.75,

    probabilidadCompra: 0.85,
    distanciaProducto: 1.35,
    distanciaFrenteProducto: 1.0,

    tiempoSeleccionProducto: 1.5,
    tiempoRecoger: 0.8,
    tiempoGuardar: 0.8,
    tiempoEntreProductos: 1.5,
    tiempoReintento: 3,

    maximoProductos: 3,
    distanciaMaximaBusqueda: 40,

    repetirRuta: false,
    inactivo: false,

    productos: null,
    carrito: null,
    mobiliario: null,
    colisiones: null,

    ruta: [],

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

// ============================================================
// FUNCIONES GENERALES
// ============================================================

function numero(valor, defecto) {
    return Number.isFinite(valor) ? valor : defecto;
}

function distanciaXZ(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
}

function limitar(valor, minimo, maximo) {
    return Math.max(minimo, Math.min(maximo, valor));
}

function punto(x, z) {
    return { x, z };
}

function normalizarNombre(nombre) {
    return String(nombre ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

// ============================================================
// CREACIÓN PRINCIPAL
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
        }
    };

    const id = siguienteIdCliente++;

    const grupo = new THREE.Group();
    grupo.name = `CLIENTE_SUPERMERCADO_${id}`;

    grupo.position.set(
        config.posicion.x,
        config.posicion.y ?? 0,
        config.posicion.z
    );

    grupo.userData.esCliente = true;
    grupo.userData.idCliente = id;

    scene.add(grupo);

    let modelo = null;
    let mixer = null;
    let accionCaminar = null;
    let accionReposo = null;

    let cargado = false;
    let eliminado = false;
    let detenido = false;

    let estado = config.inactivo
        ? ESTADOS.INACTIVO
        : ESTADOS.BUSCANDO;

    let objetivo = null;
    let ruta = [];
    let indiceRuta = 0;

    let tiempoEstado = 0;
    let tiempoBusqueda = 0;
    let tiempoReintento = 0;

    let productoObjetivo = null;
    let productoEnMano = null;
    let productoOriginal = null;

    let compras = [];
    let zonasVisitadas = [];

    let faseAnimacion = Math.random() * Math.PI * 2;
    let animacionActiva = false;

    const huesos = {};
    const huesosOriginales = new Map();

    const reloj = new THREE.Clock();

    // --------------------------------------------------------
    // MATERIALES DEL MODELO PROVISIONAL
    // --------------------------------------------------------

    const materialPiel = new THREE.MeshStandardMaterial({
        color: 0xc99570,
        roughness: 0.85
    });

    const materialCamisa = new THREE.MeshStandardMaterial({
        color: 0x2678b8,
        roughness: 0.85
    });

    const materialPantalon = new THREE.MeshStandardMaterial({
        color: 0x293e68,
        roughness: 0.9
    });

    const materialZapatos = new THREE.MeshStandardMaterial({
        color: 0x202020,
        roughness: 0.9
    });

    // --------------------------------------------------------
    // MODELO PROVISIONAL
    // --------------------------------------------------------

    function crearModeloProvisional() {
        const humano = new THREE.Group();
        humano.name = 'CLIENTE_PROVISIONAL';

        const torso = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.23, 0.48, 3, 8),
            materialCamisa
        );
        torso.position.y = 1.12;
        humano.add(torso);

        const cabeza = new THREE.Mesh(
            new THREE.SphereGeometry(0.17, 12, 10),
            materialPiel
        );
        cabeza.position.y = 1.65;
        humano.add(cabeza);

        const brazos = [];

        for (const lado of [-1, 1]) {
            const brazo = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.065, 0.35, 3, 6),
                materialCamisa
            );

            brazo.position.set(lado * 0.28, 1.16, 0);
            brazo.rotation.z = lado * -0.12;
            humano.add(brazo);
            brazos.push(brazo);

            const pierna = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.085, 0.43, 3, 6),
                materialPantalon
            );

            pierna.position.set(lado * 0.12, 0.48, 0);
            humano.add(pierna);

            const zapato = new THREE.Mesh(
                new THREE.BoxGeometry(0.17, 0.10, 0.28),
                materialZapatos
            );

            zapato.position.set(lado * 0.12, 0.10, 0.06);
            humano.add(zapato);
        }

        grupo.add(humano);
        modelo = humano;

        humano.userData.brazos = brazos;
    }

    // --------------------------------------------------------
    // CARGA DEL GLB
    // --------------------------------------------------------

    function detectarHuesos(raiz) {
        Object.keys(huesos).forEach(k => delete huesos[k]);
        huesosOriginales.clear();

        raiz.traverse(objeto => {
            if (!objeto.isBone) return;

            const nombre = normalizarNombre(objeto.name);
            huesos[nombre] = objeto;

            huesosOriginales.set(objeto, {
                rotation: objeto.rotation.clone(),
                quaternion: objeto.quaternion.clone()
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

    function cargarModelo() {
        return new Promise(resolve => {
            loaderGLTF.load(
                config.modelo,
                gltf => {
                    if (eliminado) {
                        resolve(false);
                        return;
                    }

                    if (modelo) {
                        grupo.remove(modelo);
                    }

                    modelo = gltf.scene;
                    modelo.name = 'MODELO_CLIENTE_GLTF';

                    const caja = new THREE.Box3().setFromObject(modelo);
                    const tamano = caja.getSize(new THREE.Vector3());

                    const escala = config.escala *
                        (tamano.y > 0 ? config.altura / tamano.y : 1);

                    modelo.scale.multiplyScalar(escala);

                    const centro = new THREE.Box3().setFromObject(modelo);
                    const centroMundo = centro.getCenter(new THREE.Vector3());

                    modelo.position.x -= centroMundo.x;
                    modelo.position.y -= centro.min.y;
                    modelo.position.z -= centroMundo.z;

                    modelo.rotation.y = config.correccionRotacion;

                    modelo.traverse(objeto => {
                        if (!objeto.isMesh) return;

                        objeto.castShadow = false;
                        objeto.receiveShadow = false;
                    });

                    grupo.add(modelo);

                    detectarHuesos(modelo);

                    if (gltf.animations?.length) {
                        mixer = new THREE.AnimationMixer(modelo);

                        const clips = gltf.animations;
                        const caminar = clips.find(c =>
                            /walk|caminar|walking/i.test(c.name)
                        );

                        const reposo = clips.find(c =>
                            /idle|rest|reposo|standing/i.test(c.name)
                        );

                        if (caminar) {
                            accionCaminar = mixer.clipAction(caminar);
                        }

                        if (reposo) {
                            accionReposo = mixer.clipAction(reposo);
                            accionReposo.play();
                        }
                    }

                    cargado = true;
                    resolve(true);
                },
                undefined,
                error => {
                    console.warn(
                        `No se pudo cargar ${config.modelo}. Se usará modelo provisional.`,
                        error
                    );

                    if (!modelo && !eliminado) {
                        crearModeloProvisional();
                    }

                    resolve(false);
                }
            );
        });
    }

    crearModeloProvisional();
    cargarModelo();

    // ========================================================
    // COLISIONES
    // ========================================================

    function obtenerColisiones() {
        if (Array.isArray(config.colisiones)) {
            return config.colisiones;
        }

        const mobiliario = config.mobiliario ??
            scene.getObjectByName('MOBILIARIO_SUPERMERCADO');

        if (mobiliario?.userData?.obtenerColisiones) {
            return mobiliario.userData.obtenerColisiones();
        }

        if (mobiliario?.userData?.colisiones) {
            return mobiliario.userData.colisiones;
        }

        return [];
    }

    let colisiones = obtenerColisiones();

    function actualizarColisiones() {
        colisiones = obtenerColisiones();
    }

    function obtenerLimitesMovimiento() {
        return {
            minX: -config.limiteX,
            maxX: config.limiteX,
            minZ: config.limiteZMin,
            maxZ: config.limiteZMax
        };
    }

    function puntoLibre(x, z) {
        const limites = obtenerLimitesMovimiento();

        if (
            x < limites.minX ||
            x > limites.maxX ||
            z < limites.minZ ||
            z > limites.maxZ
        ) {
            return false;
        }

        for (const obstaculo of colisiones) {
            if (!obstaculo) continue;

            const margen = config.radioColision +
                config.margenObstaculos;

            if (
                x >= obstaculo.minX - margen &&
                x <= obstaculo.maxX + margen &&
                z >= obstaculo.minZ - margen &&
                z <= obstaculo.maxZ + margen
            ) {
                return false;
            }
        }

        return true;
    }

    // ========================================================
    // CAMINOS A*
    // ========================================================

    function claveCelda(x, z) {
        return `${x},${z}`;
    }

    function mundoACelda(x, z) {
        const tamano = config.tamanoCelda;

        return {
            x: Math.round(x / tamano),
            z: Math.round(z / tamano)
        };
    }

    function celdaAMundo(x, z) {
        const tamano = config.tamanoCelda;

        return {
            x: x * tamano,
            z: z * tamano
        };
    }

    function heuristica(a, b) {
        return Math.hypot(a.x - b.x, a.z - b.z);
    }

    function encontrarCamino(inicio, destino) {
        const origen = mundoACelda(inicio.x, inicio.z);
        const final = mundoACelda(destino.x, destino.z);

        const abiertos = new Map();
        const cerrados = new Set();
        const padres = new Map();

        const gScore = new Map();
        const fScore = new Map();

        const origenKey = claveCelda(origen.x, origen.z);

        abiertos.set(origenKey, origen);
        gScore.set(origenKey, 0);
        fScore.set(origenKey, heuristica(origen, final));

        const direcciones = [
            [1, 0], [-1, 0], [0, 1], [0, -1],
            [1, 1], [1, -1], [-1, 1], [-1, -1]
        ];

        let iteraciones = 0;
        const maxIteraciones = 14000;

        while (abiertos.size && iteraciones++ < maxIteraciones) {
            let actualKey = null;
            let actual = null;
            let menorF = Infinity;

            for (const [key, celda] of abiertos) {
                const f = fScore.get(key) ?? Infinity;

                if (f < menorF) {
                    menorF = f;
                    actualKey = key;
                    actual = celda;
                }
            }

            if (!actual) break;

            if (
                actual.x === final.x &&
                actual.z === final.z
            ) {
                const camino = [];
                let key = actualKey;

                while (key) {
                    const [x, z] = key.split(',').map(Number);
                    camino.unshift(celdaAMundo(x, z));
                    key = padres.get(key);
                }

                camino.shift();
                camino.push({ x: destino.x, z: destino.z });

                return suavizarCamino(camino);
            }

            abiertos.delete(actualKey);
            cerrados.add(actualKey);

            for (const [dx, dz] of direcciones) {
                const vecino = {
                    x: actual.x + dx,
                    z: actual.z + dz
                };

                const vecinoMundo = celdaAMundo(
                    vecino.x,
                    vecino.z
                );

                const vecinoKey = claveCelda(
                    vecino.x,
                    vecino.z
                );

                if (cerrados.has(vecinoKey)) continue;

                if (!puntoLibre(vecinoMundo.x, vecinoMundo.z)) {
                    continue;
                }

                // Evitar cortar esquinas atravesando muebles.
                if (dx !== 0 && dz !== 0) {
                    const a = celdaAMundo(actual.x + dx, actual.z);
                    const b = celdaAMundo(actual.x, actual.z + dz);

                    if (
                        !puntoLibre(a.x, a.z) ||
                        !puntoLibre(b.x, b.z)
                    ) {
                        continue;
                    }
                }

                const costo = dx !== 0 && dz !== 0
                    ? 1.414
                    : 1;

                const tentativo =
                    (gScore.get(actualKey) ?? Infinity) + costo;

                if (tentativo < (gScore.get(vecinoKey) ?? Infinity)) {
                    padres.set(vecinoKey, actualKey);
                    gScore.set(vecinoKey, tentativo);
                    fScore.set(
                        vecinoKey,
                        tentativo + heuristica(vecino, final)
                    );

                    abiertos.set(vecinoKey, vecino);
                }
            }
        }

        return [];
    }

    function suavizarCamino(camino) {
        if (camino.length < 3) return camino;

        const resultado = [];
        let actual = 0;

        resultado.push(camino[0]);

        while (actual < camino.length - 1) {
            let siguiente = camino.length - 1;

            while (siguiente > actual + 1) {
                if (
                    segmentoLibre(
                        camino[actual],
                        camino[siguiente]
                    )
                ) {
                    break;
                }

                siguiente--;
            }

            resultado.push(camino[siguiente]);
            actual = siguiente;
        }

        return resultado;
    }

    function segmentoLibre(a, b) {
        const distancia = distanciaXZ(a, b);
        const pasos = Math.max(2, Math.ceil(distancia / 0.3));

        for (let i = 1; i < pasos; i++) {
            const t = i / pasos;
            const x = THREE.MathUtils.lerp(a.x, b.x, t);
            const z = THREE.MathUtils.lerp(a.z, b.z, t);

            if (!puntoLibre(x, z)) return false;
        }

        return true;
    }

    function establecerObjetivo(destino, nuevoEstado = ESTADOS.RUTA) {
        if (!destino) return false;

        const inicio = {
            x: grupo.position.x,
            z: grupo.position.z
        };

        let destinoSeguro = {
            x: limitar(destino.x, -config.limiteX, config.limiteX),
            z: limitar(destino.z, config.limiteZMin, config.limiteZMax)
        };

        if (!puntoLibre(destinoSeguro.x, destinoSeguro.z)) {
            let encontrado = false;

            for (let radio = 0.5; radio <= 5; radio += 0.5) {
                for (let angulo = 0; angulo < Math.PI * 2; angulo += Math.PI / 4) {
                    const x = destinoSeguro.x + Math.cos(angulo) * radio;
                    const z = destinoSeguro.z + Math.sin(angulo) * radio;

                    if (puntoLibre(x, z)) {
                        destinoSeguro = { x, z };
                        encontrado = true;
                        break;
                    }
                }

                if (encontrado) break;
            }

            if (!encontrado) return false;
        }

        ruta = encontrarCamino(inicio, destinoSeguro);
        indiceRuta = 0;

        if (!ruta.length) {
            if (distanciaXZ(inicio, destinoSeguro) < 0.5) {
                objetivo = destinoSeguro;
                cambiarEstado(nuevoEstado);
                return true;
            }

            return false;
        }

        objetivo = destinoSeguro;
        cambiarEstado(nuevoEstado);

        return true;
    }

    // ========================================================
    // ESTADOS
    // ========================================================

    function cambiarEstado(nuevoEstado) {
        if (estado === nuevoEstado) return;

        estado = nuevoEstado;
        tiempoEstado = 0;

        if (typeof config.alCambiarEstado === 'function') {
            config.alCambiarEstado({
                cliente: api,
                estado
            });
        }
    }

    // ========================================================
    // MOVIMIENTO
    // ========================================================

    function orientarHacia(dx, dz) {
        if (Math.abs(dx) + Math.abs(dz) < 0.0001) return;

        grupo.rotation.y = Math.atan2(dx, dz);
    }

    function moverHaciaDestino(delta) {
        if (!objetivo) return false;

        let destino = ruta[indiceRuta] ?? objetivo;

        let dx = destino.x - grupo.position.x;
        let dz = destino.z - grupo.position.z;

        let distancia = Math.hypot(dx, dz);

        if (distancia < 0.20) {
            if (indiceRuta < ruta.length - 1) {
                indiceRuta++;
                return false;
            }

            grupo.position.x = objetivo.x;
            grupo.position.z = objetivo.z;
            objetivo = null;
            ruta = [];
            indiceRuta = 0;

            return true;
        }

        orientarHacia(dx, dz);

        dx /= distancia;
        dz /= distancia;

        const velocidad = estado === ESTADOS.ENTRANDO
            ? config.velocidadEntrada
            : estado === ESTADOS.REGRESANDO
                ? config.velocidadRegreso
                : config.velocidad;

        const avance = Math.min(
            distancia,
            velocidad * Math.max(0, delta)
        );

        const siguienteX = grupo.position.x + dx * avance;
        const siguienteZ = grupo.position.z + dz * avance;

        if (puntoLibre(siguienteX, siguienteZ)) {
            grupo.position.x = siguienteX;
            grupo.position.z = siguienteZ;
        } else {
            // Deslizamiento lateral para evitar quedarse atascado.
            const soloX = grupo.position.x + dx * avance;
            const soloZ = grupo.position.z + dz * avance;

            if (puntoLibre(soloX, grupo.position.z)) {
                grupo.position.x = soloX;
            } else if (puntoLibre(grupo.position.x, soloZ)) {
                grupo.position.z = soloZ;
            } else {
                const nuevoCamino = encontrarCamino(
                    grupo.position,
                    objetivo
                );

                if (nuevoCamino.length) {
                    ruta = nuevoCamino;
                    indiceRuta = 0;
                } else {
                    objetivo = null;
                    ruta = [];
                    cambiarEstado(ESTADOS.BUSCANDO);
                }
            }
        }

        return false;
    }

    // ========================================================
    // PRODUCTOS
    // ========================================================

    function esProducto(objeto) {
        const datos = objeto?.userData ?? {};

        return Boolean(
            datos.esUnidadProducto ||
            datos.esProducto ||
            datos.tipo === 'producto' ||
            datos.codigoProducto ||
            datos.skuProducto ||
            (datos.codigo && datos.nombre)
        );
    }

    function listarProductosDisponibles() {
        const encontrados = [];
        const vistos = new Set();

        function agregar(objeto) {
            if (!objeto || vistos.has(objeto)) return;
            if (!esProducto(objeto)) return;

            vistos.add(objeto);

            if (
                objeto.userData.reservado ||
                objeto.userData.vendido ||
                objeto.userData.oculto ||
                !objeto.visible
            ) {
                return;
            }

            const posicion = new THREE.Vector3();
            objeto.getWorldPosition(posicion);

            encontrados.push({
                objeto,
                posicion,
                nombre: objeto.userData.nombre ??
                    objeto.name ??
                    'Producto',
                codigo: objeto.userData.codigoProducto ??
                    objeto.userData.skuProducto ??
                    objeto.userData.codigo ??
                    objeto.name
            });
        }

        if (Array.isArray(config.productos)) {
            config.productos.forEach(agregar);
        } else if (config.productos?.isObject3D) {
            config.productos.traverse(agregar);
        } else {
            const contenedor =
                scene.getObjectByName('PRODUCTOS_SUPERMERCADO');

            contenedor?.traverse(agregar);
        }

        return encontrados;
    }

    function liberarReserva() {
        if (!productoObjetivo) return;

        if (reservasProductos.get(productoObjetivo) === id) {
            reservasProductos.delete(productoObjetivo);
            productoObjetivo.userData.reservado = false;
        }

        productoObjetivo = null;
    }

    function elegirProducto() {
        const disponibles = listarProductosDisponibles();

        if (!disponibles.length) return null;

        const posicion = grupo.position;

        const candidatos = disponibles
            .map(registro => ({
                ...registro,
                distancia: distanciaXZ(posicion, registro.posicion)
            }))
            .filter(registro =>
                registro.distancia <= config.distanciaMaximaBusqueda
            )
            .sort((a, b) => a.distancia - b.distancia);

        if (!candidatos.length) return null;

        // Elegir entre varios productos cercanos para evitar
        // que todos los clientes se dirijan al mismo objeto.
        const cantidad = Math.min(5, candidatos.length);
        const seleccion = candidatos[
            Math.floor(Math.random() * cantidad)
        ];

        if (reservasProductos.has(seleccion.objeto)) {
            return null;
        }

        reservasProductos.set(seleccion.objeto, id);
        seleccion.objeto.userData.reservado = true;

        return seleccion;
    }

    function buscarProductos() {
        if (compras.length >= config.maximoProductos) {
            dirigirseACaja();
            return;
        }

        const registro = elegirProducto();

        if (!registro) {
            tiempoReintento = config.tiempoReintento;
            cambiarEstado(ESTADOS.ESPERANDO);
            return;
        }

        productoObjetivo = registro.objeto;

        const dx = grupo.position.x - registro.posicion.x;
        const dz = grupo.position.z - registro.posicion.z;
        const longitud = Math.hypot(dx, dz) || 1;

        const destino = {
            x: registro.posicion.x +
                dx / longitud * config.distanciaFrenteProducto,
            z: registro.posicion.z +
                dz / longitud * config.distanciaFrenteProducto
        };

        if (!establecerObjetivo(destino, ESTADOS.ACERCANDO)) {
            liberarReserva();
            tiempoReintento = 1;
            cambiarEstado(ESTADOS.ESPERANDO);
        }
    }

    function recogerProducto() {
        if (!productoObjetivo) {
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        const objeto = productoObjetivo;

        objeto.updateWorldMatrix(true, false);

        const posicion = objeto.position.clone();
        const quaternion = objeto.quaternion.clone();
        const escala = objeto.scale.clone();
        const padre = objeto.parent;

        productoOriginal = {
            objeto,
            padre,
            posicion,
            quaternion,
            escala
        };

        scene.attach(objeto);

        productoEnMano = objeto;

        objeto.userData.reservado = true;

        const mano = buscarHueso('handr', 'righthand', 'handright');

        if (mano) {
            mano.attach(objeto);
            objeto.position.set(0, 0, 0.12);
            objeto.rotation.set(0, 0, 0);
            objeto.scale.multiplyScalar(0.65);
        } else {
            grupo.attach(objeto);
            objeto.position.set(0.25, 1.0, 0.35);
            objeto.rotation.set(0, 0, 0);
            objeto.scale.multiplyScalar(0.65);
        }

        compras.push({
            nombre: objeto.userData.nombre ?? objeto.name,
            codigo: objeto.userData.codigoProducto ??
                objeto.userData.codigo ??
                objeto.name,
            objeto,
            fecha: Date.now()
        });

        if (typeof config.alComprar === 'function') {
            config.alComprar({
                cliente: api,
                producto: objeto,
                compra: compras[compras.length - 1]
            });
        }

        cambiarEstado(ESTADOS.GUARDANDO);
    }

    function devolverProducto() {
        if (!productoEnMano || !productoOriginal) return;

        const { objeto, padre, posicion, quaternion, escala } =
            productoOriginal;

        if (padre) {
            padre.attach(objeto);
            objeto.position.copy(posicion);
            objeto.quaternion.copy(quaternion);
            objeto.scale.copy(escala);
        }

        objeto.userData.reservado = false;

        if (reservasProductos.get(objeto) === id) {
            reservasProductos.delete(objeto);
        }

        productoEnMano = null;
        productoObjetivo = null;
        productoOriginal = null;
    }

    function guardarProducto() {
        if (!productoEnMano) {
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        const carrito = config.carrito;

        if (
            carrito &&
            typeof carrito.agregarProducto === 'function'
        ) {
            const registro = compras[compras.length - 1];

            try {
                carrito.agregarProducto(registro);
            } catch (error) {
                console.warn('No se pudo agregar al carrito:', error);
                devolverProducto();
                cambiarEstado(ESTADOS.BUSCANDO);
                return;
            }
        }

        if (productoEnMano) {
            productoEnMano.userData.enCarrito = true;
            productoEnMano.userData.reservado = false;
        }

        productoEnMano = null;
        productoOriginal = null;
        productoObjetivo = null;

        tiempoReintento = config.tiempoEntreProductos;
        cambiarEstado(ESTADOS.ESPERANDO);
    }

    // ========================================================
    // RECORRIDO POR EL SUPERMERCADO
    // ========================================================

    const puntosRecorrido = [
        { x: -23, z: 18 },
        { x: -13, z: 18 },
        { x: -5, z: 16 },
        { x: 5, z: 16 },
        { x: 13, z: 17 },
        { x: 22, z: 17 },
        { x: 22, z: 5 },
        { x: 13, z: 5 },
        { x: 5, z: 5 },
        { x: -5, z: 5 },
        { x: -13, z: 5 },
        { x: -22, z: 5 },
        { x: -22, z: -5 },
        { x: -13, z: -8 },
        { x: -5, z: -8 },
        { x: 5, z: -8 },
        { x: 13, z: -8 },
        { x: 22, z: -8 },
        { x: 22, z: -19 },
        { x: 13, z: -19 },
        { x: 5, z: -19 },
        { x: -5, z: -19 },
        { x: -13, z: -19 }
    ];

    let indiceRecorrido = Math.floor(
        Math.random() * puntosRecorrido.length
    );

    function siguientePuntoRecorrido() {
        for (let i = 0; i < puntosRecorrido.length; i++) {
            const indice = (indiceRecorrido + i) %
                puntosRecorrido.length;

            const candidato = puntosRecorrido[indice];

            if (
                puntoLibre(candidato.x, candidato.z) &&
                distanciaXZ(grupo.position, candidato) > 2
            ) {
                indiceRecorrido = (indice + 1) %
                    puntosRecorrido.length;

                return candidato;
            }
        }

        return { x: 0, z: 10 };
    }

    function iniciarPaseo() {
        const destino = siguientePuntoRecorrido();

        if (!establecerObjetivo(destino, ESTADOS.RUTA)) {
            cambiarEstado(ESTADOS.BUSCANDO);
        }
    }

    // ========================================================
    // CAJAS Y PAGO
    // ========================================================

    function dirigirseACaja(posicionCaja = config.posicionCaja) {
        const destino = {
            x: numero(posicionCaja.x, 0),
            z: numero(posicionCaja.z, 22.5)
        };

        if (!establecerObjetivo(destino, ESTADOS.CAJA)) {
            cambiarEstado(ESTADOS.BUSCANDO);
        }
    }

    function completarPago() {
        if (typeof config.alPagar === 'function') {
            config.alPagar({
                cliente: api,
                productos: compras,
                totalProductos: compras.length
            });
        }

        compras.forEach(compra => {
            if (compra.objeto) {
                compra.objeto.userData.vendido = true;
                compra.objeto.userData.enCarrito = false;
            }
        });

        cambiarEstado(ESTADOS.PAGANDO);
        tiempoEstado = 0;
    }

    // ========================================================
    // ENTRADA Y REGRESO DEL VEHÍCULO
    // ========================================================

    function iniciarDesdeVehiculo(posicionEntrada, plaza) {
        if (!posicionEntrada || !plaza) {
            console.warn(
                'iniciarDesdeVehiculo necesita posicionEntrada y plaza.'
            );
            return false;
        }

        liberarReserva();

        if (productoEnMano) {
            devolverProducto();
        }

        compras = [];

        grupo.position.set(
            numero(posicionEntrada.x, plaza.x),
            0,
            numero(posicionEntrada.z, plaza.z)
        );

        const rutaEntrada = [
            { x: plaza.x, z: plaza.z },
            { x: plaza.x, z: 34 },
            { x: plaza.x, z: 31 },
            { x: 0, z: 27 },
            { x: -8, z: 24 }
        ];

        const primerDestino = rutaEntrada.find(p =>
            puntoLibre(p.x, p.z)
        );

        if (!primerDestino) {
            console.warn('No se encontró acceso libre al supermercado.');
            return false;
        }

        const camino = encontrarCamino(
            grupo.position,
            primerDestino
        );

        if (!camino.length) {
            return establecerObjetivo(
                { x: 0, z: 26 },
                ESTADOS.ENTRANDO
            );
        }

        ruta = camino;
        indiceRuta = 0;
        objetivo = primerDestino;

        cambiarEstado(ESTADOS.ENTRANDO);

        if (typeof config.alEntrar === 'function') {
            config.alEntrar({
                cliente: api,
                plaza
            });
        }

        return true;
    }

    function iniciarRegresoVehiculo(plaza, callback) {
        if (!plaza) return false;

        liberarReserva();

        if (productoEnMano) {
            devolverProducto();
        }

        const destinos = [
            { x: 0, z: 26 },
            { x: 0, z: 30 },
            { x: 0, z: 34 },
            { x: plaza.x, z: 37 },
            { x: plaza.x, z: plaza.z }
        ];

        const destino = destinos[destinos.length - 1];

        const camino = encontrarCamino(
            grupo.position,
            destino
        );

        if (!camino.length) {
            console.warn(
                'No se pudo encontrar un camino al vehículo.'
            );
            return false;
        }

        ruta = camino;
        indiceRuta = 0;
        objetivo = destino;

        api._callbackRegreso = callback ?? null;

        cambiarEstado(ESTADOS.REGRESANDO);

        return true;
    }

    function finalizarRegreso() {
        cambiarEstado(ESTADOS.FINALIZADO);

        if (typeof api._callbackRegreso === 'function') {
            api._callbackRegreso(api);
            api._callbackRegreso = null;
        }

        if (typeof config.alFinalizar === 'function') {
            config.alFinalizar(api);
        }
    }

    // ========================================================
    // ANIMACIÓN
    // ========================================================

    function animarCaminar(activo) {
        animacionActiva = activo;

        if (accionCaminar) {
            if (activo) {
                accionReposo?.stop();
                accionCaminar.play();
            } else {
                accionCaminar.stop();
                accionReposo?.play();
            }
        }
    }

    function animarHuesos(delta) {
        if (!modelo || accionCaminar) return;

        faseAnimacion += delta * (animacionActiva ? 8 : 2);

        const amplitud = animacionActiva ? 0.48 : 0.025;
        const paso = Math.sin(faseAnimacion) * amplitud;

        const piernaIzquierda = buscarHueso(
            'leftupleg', 'uplegleft', 'thighl', 'leftthigh'
        );

        const piernaDerecha = buscarHueso(
            'rightupleg', 'uplegright', 'thighr', 'rightthigh'
        );

        const brazoIzquierdo = buscarHueso(
            'leftarm', 'upperarml', 'leftupperarm'
        );

        const brazoDerecho = buscarHueso(
            'rightarm', 'upperarmr', 'rightupperarm'
        );

        if (piernaIzquierda) {
            piernaIzquierda.rotation.x = paso;
        }

        if (piernaDerecha) {
            piernaDerecha.rotation.x = -paso;
        }

        if (brazoIzquierdo) {
            brazoIzquierdo.rotation.x = -paso * 0.65;
        }

        if (brazoDerecho) {
            brazoDerecho.rotation.x = paso * 0.65;
        }

        const brazo = modelo.userData?.brazos;

        if (brazo?.length) {
            brazo[0].rotation.x = paso;
            brazo[1].rotation.x = -paso;
        }
    }

    // ========================================================
    // ACTUALIZACIÓN DE ESTADOS
    // ========================================================

    function actualizar(delta) {
        if (eliminado || detenido) return;

        delta = limitar(numero(delta, 0), 0, 0.05);

        tiempoEstado += delta;

        if (mixer) {
            mixer.update(delta);
        }

        const seMueve = [
            ESTADOS.RUTA,
            ESTADOS.ENTRANDO,
            ESTADOS.ACERCANDO,
            ESTADOS.CAJA,
            ESTADOS.REGRESANDO
        ].includes(estado);

        animarCaminar(seMueve);
        animarHuesos(delta);

        if (seMueve && objetivo) {
            const llego = moverHaciaDestino(delta);

            if (llego) {
                switch (estado) {
                    case ESTADOS.ENTRANDO:
                        cambiarEstado(ESTADOS.BUSCANDO);
                        break;

                    case ESTADOS.ACERCANDO:
                        cambiarEstado(ESTADOS.RECOGIENDO);
                        break;

                    case ESTADOS.RUTA:
                        if (compras.length >= config.maximoProductos) {
                            dirigirseACaja();
                        } else {
                            cambiarEstado(ESTADOS.BUSCANDO);
                        }
                        break;

                    case ESTADOS.CAJA:
                        completarPago();
                        break;

                    case ESTADOS.REGRESANDO:
                        finalizarRegreso();
                        break;
                }
            }

            return;
        }

        switch (estado) {
            case ESTADOS.INACTIVO:
                break;

            case ESTADOS.BUSCANDO:
                if (Math.random() < config.probabilidadCompra) {
                    buscarProductos();
                } else {
                    iniciarPaseo();
                }
                break;

            case ESTADOS.RECOGIENDO:
                if (tiempoEstado >= config.tiempoRecoger) {
                    recogerProducto();
                }
                break;

            case ESTADOS.GUARDANDO:
                if (tiempoEstado >= config.tiempoGuardar) {
                    guardarProducto();
                }
                break;

            case ESTADOS.ESPERANDO:
                tiempoReintento -= delta;

                if (tiempoReintento <= 0) {
                    if (compras.length >= config.maximoProductos) {
                        dirigirseACaja();
                    } else {
                        tiempoBusqueda++;

                        if (tiempoBusqueda % 3 === 0) {
                            iniciarPaseo();
                        } else {
                            cambiarEstado(ESTADOS.BUSCANDO);
                        }
                    }
                }
                break;

            case ESTADOS.PAGANDO:
                if (tiempoEstado >= 2.5) {
                    if (config.repetirRuta) {
                        compras = [];
                        cambiarEstado(ESTADOS.BUSCANDO);
                    } else {
                        cambiarEstado(ESTADOS.FINALIZADO);

                        if (typeof config.alFinalizar === 'function') {
                            config.alFinalizar(api);
                        }
                    }
                }
                break;

            case ESTADOS.FINALIZADO:
                break;
        }
    }

    // ========================================================
    // API PÚBLICA
    // ========================================================

    function establecerRuta(nuevaRuta) {
        if (!Array.isArray(nuevaRuta) || !nuevaRuta.length) {
            return false;
        }

        ruta = nuevaRuta.map(p => ({
            x: numero(p.x, 0),
            z: numero(p.z, 0)
        }));

        indiceRuta = 0;
        objetivo = ruta[ruta.length - 1];

        cambiarEstado(ESTADOS.RUTA);

        const camino = encontrarCamino(
            grupo.position,
            objetivo
        );

        if (camino.length) {
            ruta = camino;
        }

        return true;
    }

    function establecerPosicion(posicion) {
        if (!posicion) return false;

        grupo.position.set(
            numero(posicion.x, 0),
            numero(posicion.y, 0),
            numero(posicion.z, 0)
        );

        objetivo = null;
        ruta = [];
        indiceRuta = 0;

        return true;
    }

    function configurarCompras(opcionesCompras = {}) {
        Object.assign(config, opcionesCompras);
        actualizarColisiones();
    }

    function detenerAnimacion() {
        detenido = true;
        animarCaminar(false);
    }

    function reproducirAnimacion() {
        detenido = false;
    }

    function eliminar() {
        if (eliminado) return;

        liberarReserva();

        if (productoEnMano) {
            devolverProducto();
        }

        mixer?.stopAllAction();
        mixer = null;

        grupo.parent?.remove(grupo);

        grupo.traverse(objeto => {
            if (!objeto.isMesh) return;

            // No se destruyen materiales ni geometrías compartidas.
        });

        eliminado = true;
        detenido = true;
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

        obtenerObjetivo: () => objetivo
            ? { ...objetivo }
            : null,

        obtenerCompras: () => compras.map(c => ({
            nombre: c.nombre,
            codigo: c.codigo
        })),

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

        _callbackRegreso: null,

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

    return api;
}
