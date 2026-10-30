
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// CLIENTES Y LADRONES DEL SUPERMERCADO
// Three.js 0.180+
// Animación manual de esqueleto + clips GLB
// Compras, navegación, vehículos y caja
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

const clamp = THREE.MathUtils.clamp;

function distancia(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
}

function punto(x, z) {
    return new THREE.Vector3(x, 0, z);
}

function normalizarNombre(nombre) {
    return String(nombre || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
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
        objeto?.userData?.codigoProducto ||
        objeto?.userData?.skuProducto ||
        objeto?.userData?.sku ||
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

    return Number.isFinite(precio) && precio >= 0 ? precio : 0;
}

function esUnidadProducto(objeto) {
    return !!objeto && (
        objeto.userData?.esUnidadProducto === true ||
        objeto.userData?.tipo === 'producto' ||
        objeto.userData?.esProducto === true
    );
}

// ============================================================
// NAVEGACIÓN Y OBSTÁCULOS
// ============================================================

const CELDA = 1;

const OBSTACULOS = [
    { minX: -18.7, maxX: -7.3, minZ: -15.5, maxZ: -10.5 },
    { minX: -18.7, maxX: -7.3, minZ: -2.5, maxZ: 2.5 },
    { minX: -18.7, maxX: -7.3, minZ: 10.5, maxZ: 15.5 },

    { minX: 7.3, maxX: 18.7, minZ: -15.5, maxZ: -10.5 },
    { minX: 7.3, maxX: 18.7, minZ: -2.5, maxZ: 2.5 },
    { minX: 7.3, maxX: 18.7, minZ: 10.5, maxZ: 15.5 },

    { minX: -29, maxX: -25, minZ: -27, maxZ: -24 },
    { minX: 25, maxX: 29, minZ: -27, maxZ: -24 },

    { minX: -29, maxX: -15, minZ: -28, maxZ: -25.5 },
    { minX: 15, maxX: 29, minZ: -28, maxZ: -25.5 }
];

function puntoBloqueado(x, z, radio = 0.55) {
    if (
        x < -29 + radio ||
        x > 29 - radio ||
        z < -27 + radio ||
        z > 27 - radio
    ) return true;

    return OBSTACULOS.some(o =>
        x + radio > o.minX &&
        x - radio < o.maxX &&
        z + radio > o.minZ &&
        z - radio < o.maxZ
    );
}

function puntoExteriorBloqueado(x, z, radio = 0.55) {
    return (
        x < -31 + radio ||
        x > 31 - radio ||
        z < 20 ||
        z > 98
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

    if (
        !puntoBloqueado(final.x, final.z, radio) &&
        segmentoLibre(origen, final, radio)
    ) {
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

            if (
                dx !== 0 && dz !== 0 &&
                (
                    puntoBloqueado(actual.x + dx, actual.z, radio) ||
                    puntoBloqueado(actual.x, actual.z + dz, radio)
                )
            ) continue;

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

    const rutaCalculada = [];

    while (resultado) {
        rutaCalculada.unshift(
            punto(resultado.x * CELDA, resultado.z * CELDA)
        );

        resultado = resultado.padre;
    }

    rutaCalculada[0] = origen;
    rutaCalculada[rutaCalculada.length - 1] = final;

    return simplificarRuta(rutaCalculada, radio).slice(1);
}

// ============================================================
// SISTEMA DE ANIMACIÓN DEL ESQUELETO
// ============================================================

function buscarHueso(huesos, patrones) {
    const entradas = Object.entries(huesos);

    for (const patron of patrones) {
        const normalizado = normalizarNombre(patron);

        const encontrado = entradas.find(([nombre]) =>
            normalizarNombre(nombre).includes(normalizado)
        );

        if (encontrado) return encontrado[1];
    }

    return null;
}

function buscarHuesoExacto(huesos, patrones) {
    const entradas = Object.entries(huesos);

    for (const patron of patrones) {
        const normalizado = normalizarNombre(patron);

        const encontrado = entradas.find(([nombre]) =>
            normalizarNombre(nombre) === normalizado
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

    const lista = Object.values(huesos);

    const brazos = {
        izquierdo: buscarHueso(huesos, [
            'LeftArm', 'UpperArm_L', 'Arm_L',
            'BrazoIzquierdo', 'Brazo_I', 'Bip01LUpperArm'
        ]),
        derecho: buscarHueso(huesos, [
            'RightArm', 'UpperArm_R', 'Arm_R',
            'BrazoDerecho', 'Brazo_D', 'Bip01RUpperArm'
        ])
    };

    const antebrazos = {
        izquierdo: buscarHueso(huesos, [
            'LeftForeArm', 'LeftLowerArm', 'Forearm_L',
            'LowerArm_L', 'AntebrazoIzquierdo', 'Bip01LForearm'
        ]),
        derecho: buscarHueso(huesos, [
            'RightForeArm', 'RightLowerArm', 'Forearm_R',
            'LowerArm_R', 'AntebrazoDerecho', 'Bip01RForearm'
        ])
    };

    const manos = {
        izquierdo: buscarHueso(huesos, [
            'LeftHand', 'Hand_L', 'ManoIzquierda', 'Bip01LHand'
        ]),
        derecho: buscarHueso(huesos, [
            'RightHand', 'Hand_R', 'ManoDerecha', 'Bip01RHand'
        ])
    };

    const piernas = {
        izquierdo: buscarHueso(huesos, [
            'LeftUpLeg', 'LeftThigh', 'Thigh_L',
            'UpperLeg_L', 'Leg_L', 'MusloIzquierdo',
            'Bip01LThigh'
        ]),
        derecho: buscarHueso(huesos, [
            'RightUpLeg', 'RightThigh', 'Thigh_R',
            'UpperLeg_R', 'Leg_R', 'MusloDerecho',
            'Bip01RThigh'
        ])
    };

    const rodillas = {
        izquierdo: buscarHueso(huesos, [
            'LeftLeg', 'LeftCalf', 'LowerLeg_L',
            'Calf_L', 'Shin_L', 'PiernaIzquierda',
            'Bip01LCalf'
        ]),
        derecho: buscarHueso(huesos, [
            'RightLeg', 'RightCalf', 'LowerLeg_R',
            'Calf_R', 'Shin_R', 'PiernaDerecha',
            'Bip01RCalf'
        ])
    };

    const pies = {
        izquierdo: buscarHueso(huesos, [
            'LeftFoot', 'Foot_L', 'PieIzquierdo', 'Bip01LFoot'
        ]),
        derecho: buscarHueso(huesos, [
            'RightFoot', 'Foot_R', 'PieDerecho', 'Bip01RFoot'
        ])
    };

    const columna = buscarHueso(huesos, [
        'Spine', 'Spine1', 'Chest', 'Torso', 'Columna'
    ]);

    const cabeza = buscarHueso(huesos, [
        'Head', 'Cabeza'
    ]);

    const caderas = buscarHueso(huesos, [
        'Hips', 'Pelvis', 'Root', 'Cadera'
    ]);

    const rotacionesBase = new Map();

    lista.forEach(hueso => {
        rotacionesBase.set(hueso, hueso.rotation.clone());
    });

    function restaurar() {
        for (const [hueso, rotacion] of rotacionesBase) {
            hueso.rotation.copy(rotacion);
        }
    }

    function animar(tipo, tiempo, intensidad = 1) {
        restaurar();

        const movimiento = tipo === 'caminar' || tipo === 'correr';
        const amplitud = tipo === 'correr' ? 0.85 : 0.62;
        const velocidad = tipo === 'correr' ? 12 : 8;

        if (movimiento) {
            const fase = tiempo * velocidad;
            const paso = Math.sin(fase) * amplitud * intensidad;
            const pasoOpuesto = -paso;

            // MUSLOS
            if (piernas.izquierdo) {
                piernas.izquierdo.rotation.x += paso;
            }

            if (piernas.derecho) {
                piernas.derecho.rotation.x += pasoOpuesto;
            }

            // RODILLAS
            if (rodillas.izquierdo) {
                rodillas.izquierdo.rotation.x +=
                    Math.max(0, -paso) * 0.85;
            }

            if (rodillas.derecho) {
                rodillas.derecho.rotation.x +=
                    Math.max(0, paso) * 0.85;
            }

            // BRAZOS EN OPOSICIÓN A LAS PIERNAS
            if (brazos.izquierdo) {
                brazos.izquierdo.rotation.x += pasoOpuesto * 0.8;
            }

            if (brazos.derecho) {
                brazos.derecho.rotation.x += paso * 0.8;
            }

            // CODOS
            if (antebrazos.izquierdo) {
                antebrazos.izquierdo.rotation.x +=
                    0.15 + Math.max(0, paso) * 0.22;
            }

            if (antebrazos.derecho) {
                antebrazos.derecho.rotation.x +=
                    0.15 + Math.max(0, -paso) * 0.22;
            }

            // PIES
            if (pies.izquierdo) {
                pies.izquierdo.rotation.x +=
                    Math.max(0, -paso) * 0.35;
            }

            if (pies.derecho) {
                pies.derecho.rotation.x +=
                    Math.max(0, paso) * 0.35;
            }

            // BALANCEO NATURAL DEL CUERPO
            if (columna) {
                columna.rotation.z += Math.sin(fase) * 0.035;
                columna.rotation.x += Math.abs(Math.sin(fase)) * 0.025;
            }

            if (caderas) {
                caderas.rotation.z += Math.sin(fase) * 0.025;
            }
        } else if (tipo === 'espera') {
            // Respiración sutil al permanecer quieto.
            const respiracion = Math.sin(tiempo * 2.1);

            if (columna) {
                columna.rotation.x += respiracion * 0.018;
            }

            if (cabeza) {
                cabeza.rotation.y += Math.sin(tiempo * 0.8) * 0.025;
            }
        } else if (tipo === 'recoger') {
            // Inclinación leve al examinar un producto.
            if (columna) {
                columna.rotation.x += 0.12 * intensidad;
            }

            if (cabeza) {
                cabeza.rotation.x += 0.16 * intensidad;
            }

            if (brazos.derecho) {
                brazos.derecho.rotation.x -= 0.45 * intensidad;
            }

            if (antebrazos.derecho) {
                antebrazos.derecho.rotation.x -= 0.35 * intensidad;
            }
        }
    }

    return {
        huesos,
        animar,
        restaurar,
        brazos,
        antebrazos,
        piernas,
        rodillas,
        pies,
        columna,
        cabeza,
        caderas,
        cantidad: lista.length
    };
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

    const id = config.id ||
        `CLIENTE_${THREE.MathUtils.generateUUID()}`;

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
    let clipsAnimacion = [];
    let accionActual = null;
    let clipCaminar = null;
    let clipCorrer = null;
    let clipReposo = null;

    let cargado = false;
    let eliminado = false;
    let entro = false;

    let estado = config.inactivo ? 'inactivo' : 'cargando';

    let ruta = [];
    let indiceRuta = 0;
    let tiempoAnimacion = Math.random() * 10;
    let tiempoEstado = 0;
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

    const posicionAnterior = grupo.position.clone();
    const posicionTemporal = new THREE.Vector3();

    // --------------------------------------------------------
    // SISTEMA DE ANIMACIONES GLB
    // --------------------------------------------------------

    function elegirClip(patrones) {
        return clipsAnimacion.find(clip => {
            const nombre = normalizarNombre(clip.name);

            return patrones.some(patron =>
                nombre.includes(normalizarNombre(patron))
            );
        }) || null;
    }

    function cambiarClip(clip, velocidad = 1) {
        if (!mixer || !clip) return false;

        if (accionActual?.getClip() === clip) {
            accionActual.timeScale = velocidad;
            return true;
        }

        const nuevaAccion = mixer.clipAction(clip);

        nuevaAccion.reset();
        nuevaAccion.enabled = true;
        nuevaAccion.setEffectiveWeight(1);
        nuevaAccion.setEffectiveTimeScale(velocidad);
        nuevaAccion.fadeIn(0.18);
        nuevaAccion.play();

        if (accionActual) {
            accionActual.fadeOut(0.18);
        }

        accionActual = nuevaAccion;
        return true;
    }

    function actualizarAnimacion(tipo) {
        if (mixer) {
            let clip = null;
            let velocidad = 1;

            if (tipo === 'correr') {
                clip = clipCorrer || clipCaminar;
                velocidad = clipCorrer ? 1 : 1.25;
            } else if (tipo === 'caminar') {
                clip = clipCaminar;
            } else {
                clip = clipReposo;
            }

            if (clip) {
                cambiarClip(clip, velocidad);
                return;
            }
        }

        if (controlHuesos) {
            controlHuesos.animar(tipo, tiempoAnimacion, 1);
        }
    }

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
                if (objeto.isMesh) {
                    objeto.castShadow = false;
                    objeto.receiveShadow = false;
                }
            });

            const caja = new THREE.Box3().setFromObject(modelo);
            const centro = new THREE.Vector3();

            caja.getCenter(centro);

            modelo.position.x -= centro.x;
            modelo.position.z -= centro.z;
            modelo.position.y -= caja.min.y;

            grupo.add(modelo);

            clipsAnimacion = gltf.animations || [];

            // Detectar clips sin reproducir todos simultáneamente.
            clipCaminar = elegirClip([
                'walk', 'walking', 'caminar', 'walkingcycle'
            ]);

            clipCorrer = elegirClip([
                'run', 'running', 'correr', 'sprint'
            ]);

            clipReposo = elegirClip([
                'idle', 'stand', 'standing', 'reposo'
            ]);

            if (clipsAnimacion.length) {
                mixer = new THREE.AnimationMixer(modelo);
            }

            // Siempre crear el controlador de huesos.
            // Se utiliza como respaldo cuando no existe un clip
            // compatible de caminar o reposo.
            controlHuesos = crearControlHuesos(modelo);

            cargado = true;

            if (estado === 'cargando') {
                estado = config.inactivo ? 'inactivo' : 'recorriendo';
            }

            console.info(
                `[${id}] Modelo cargado`,
                {
                    huesos: controlHuesos.cantidad,
                    brazos: !!controlHuesos.brazos.izquierdo &&
                        !!controlHuesos.brazos.derecho,
                    piernas: !!controlHuesos.piernas.izquierdo &&
                        !!controlHuesos.piernas.derecho,
                    animaciones: clipsAnimacion.map(c => c.name),
                    caminar: clipCaminar?.name || 'Manual',
                    correr: clipCorrer?.name || 'Manual'
                }
            );

            if (!config.inactivo && config.ruta?.length) {
                establecerRuta(config.ruta);
            }
        },

        undefined,

        error => {
            console.error(
                `Error cargando modelo ${config.modelo}:`,
                error
            );

            if (eliminado) return;

            crearModeloProvisional();
            cargado = true;

            if (estado === 'cargando') {
                estado = config.inactivo ? 'inactivo' : 'recorriendo';
            }

            if (!config.inactivo && config.ruta?.length) {
                establecerRuta(config.ruta);
            }
        }
    );

    function crearModeloProvisional() {
        const material = new THREE.MeshStandardMaterial({
            color: 0x2877bb
        });

        const cuerpo = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.32, 0.85, 4, 8),
            material
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

            const unidadId = objeto.uuid;

            if (productosCompradosGlobal.has(unidadId)) return false;
            if (productosReservadosGlobal.has(unidadId)) return false;
            if (productosLocalesReservados.has(unidadId)) return false;

            if (objeto.userData.disponible === false) return false;
            if (objeto.userData.enCarrito) return false;
            if (objeto.userData.recogido) return false;
            if (objeto.userData.vendido) return false;

            return true;
        });
    }

    function reservarProducto(producto) {
        if (!producto) return false;

        const unidadId = producto.uuid;

        if (productosCompradosGlobal.has(unidadId)) return false;
        if (productosReservadosGlobal.has(unidadId)) return false;

        productosReservadosGlobal.set(unidadId, id);
        productosLocalesReservados.add(unidadId);

        producto.userData.reservadoPor = id;
        producto.userData.reservado = true;

        return true;
    }

    function liberarReserva(producto) {
        if (!producto) return;

        const unidadId = producto.uuid;

        if (productosReservadosGlobal.get(unidadId) === id) {
            productosReservadosGlobal.delete(unidadId);
        }

        productosLocalesReservados.delete(unidadId);

        if (producto.userData.reservadoPor === id) {
            delete producto.userData.reservadoPor;
            producto.userData.reservado = false;
        }
    }

    function agregarAlCarrito(producto) {
        if (!producto || !producto.parent) return false;

        const unidadId = producto.uuid;

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

        if (carrito?.agregarProducto) {
            const agregado = carrito.agregarProducto(registro);

            if (agregado === false) return false;
        } else {
            producto.visible = false;
        }

        productosCarrito.push(registro);

        productosCompradosGlobal.add(unidadId);
        productosReservadosGlobal.delete(unidadId);
        productosLocalesReservados.delete(unidadId);

        producto.userData.enCarrito = true;
        producto.userData.recogido = true;
        producto.userData.disponible = false;
        producto.userData.vendido = false;
        producto.userData.compradoPor = id;
        producto.userData.reservado = false;
        producto.userData.reservadoPor = null;

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
    // RUTAS INTERIORES
    // ========================================================

    function establecerRuta(puntos) {
        if (!Array.isArray(puntos) || !puntos.length) return false;

        const destinos = puntos.map(p => ({
            x: Number(p.x),
            z: Number(p.z)
        })).filter(p =>
            Number.isFinite(p.x) && Number.isFinite(p.z)
        );

        if (!destinos.length) return false;

        ruta = [];

        let actual = {
            x: grupo.position.x,
            z: grupo.position.z
        };

        for (const destino of destinos) {
            const tramo = encontrarRuta(
                actual,
                destino,
                config.radioColision
            );

            if (!tramo.length) {
                console.warn(`${id}: ruta bloqueada hacia`, destino);
                continue;
            }

            ruta.push(...tramo);
            actual = destino;
        }

        indiceRuta = 0;
        objetivo = ruta[0] || null;

        if (!ruta.length) return false;

        zona = 'supermercado';
        estado = 'recorriendo';

        return true;
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

        posicionAnterior.copy(grupo.position);
    }

    // ========================================================
    // MOVIMIENTO Y GIRO
    // ========================================================

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

        const avance = Math.min(
            d,
            Math.max(0, config.velocidad) * delta
        );

        const nuevaX = grupo.position.x + direccionX * avance;
        const nuevaZ = grupo.position.z + direccionZ * avance;

        const movimientoExterior =
            zona === 'exterior' ||
            estado === 'entrandoSupermercado' ||
            estado === 'regresandoVehiculo';

        const bloqueado = movimientoExterior
            ? puntoExteriorBloqueado(
                nuevaX,
                nuevaZ,
                config.radioColision
            )
            : puntoBloqueado(
                nuevaX,
                nuevaZ,
                config.radioColision
            );

        if (!bloqueado) {
            grupo.position.x = nuevaX;
            grupo.position.z = nuevaZ;
        } else if (!movimientoExterior) {
            const destino = { x: objetivo.x, z: objetivo.z };

            if (!establecerRutaDirecta(destino)) {
                estado = 'esperando';
                tiempoEspera = 0;
                return false;
            }
        } else {
            estado = 'esperando';
            tiempoEspera = 0;
            console.warn(`${id}: ruta exterior bloqueada.`);
            return false;
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
    // COMPRAS
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

    function finalizarRecorrido() {
        if (config.repetirRuta && config.ruta?.length) {
            establecerRuta([config.ruta[0]]);
            estado = 'recorriendo';
        } else {
            estado = 'finalizado';

            if (typeof config.alFinalizar === 'function') {
                config.alFinalizar(api);
            }
        }
    }

    // ========================================================
    // CAJA
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
            articulos: detalle,
            cantidad: detalle.length,
            total: obtenerTotalCompra()
        };
    }

    function confirmarCompra() {
        if (compraConfirmada) return obtenerResumenCompra();

        compraConfirmada = true;
        pagoConfirmado = true;
        resumenPago = obtenerResumenCompra();

        if (carrito?.confirmarVenta) {
            carrito.confirmarVenta();
        }

        return resumenPago;
    }

    function iniciarPago(posicionCaja, callback) {
        if (eliminado || pagoConfirmado || estado === 'pagando') {
            return false;
        }

        if (productoEnMano) {
            liberarReserva(productoEnMano);
            productoEnMano = null;
        }

        if (productoObjetivo) {
            liberarReserva(productoObjetivo);
            productoObjetivo = null;
        }

        callbackPago = callback || null;

        const destino = posicionCaja || { x: 0, z: 20 };

        if (!establecerRutaDirecta(destino)) {
            console.warn(`${id}: no hay ruta libre hacia la caja.`);
            return false;
        }

        zona = 'supermercado';
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
    // VEHÍCULOS
    // ========================================================

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
        objetivo = ruta[0];
        estado = 'entrandoSupermercado';

        return true;
    }

    function iniciarRegresoVehiculo(plaza, callback) {
        if (
            !plaza ||
            !Number.isFinite(Number(plaza.x)) ||
            !Number.isFinite(Number(plaza.z))
        ) return false;

        callbackRegreso = callback || null;

        ruta = [
            punto(0, 25.5),
            punto(0, 30.5),
            punto(0, 34),
            punto(0, 78),
            punto(0, 83),
            punto(0, 78),
            punto(plaza.x, 78),
            punto(plaza.x, plaza.z + 5),
            punto(plaza.x, plaza.z)
        ];

        indiceRuta = 0;
        objetivo = ruta[0];

        zona = 'exterior';
        estado = 'regresandoVehiculo';

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

        // Guardar la posición antes de mover al personaje.
        const xAnterior = grupo.position.x;
        const zAnterior = grupo.position.z;

        switch (estado) {
            case 'cargando':
            case 'inactivo':
            case 'finalizado':
            case 'pagando':
            case 'esperandoSalida':
                break;

            case 'recorriendo': {
                const llego = avanzarRuta(delta);

                if (llego) iniciarBusquedaProductos();
                break;
            }

            case 'buscandoProducto':
                seleccionarProducto();
                break;

            case 'acercandoseProducto': {
                const llego = avanzarRuta(delta);

                if (llego) recogerProducto();
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

                if (llego) completarPago();
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

                    if (zona === 'exterior') {
                        estado = 'regresandoVehiculo';
                    } else {
                        estado = 'buscandoProducto';
                    }
                }
                break;
        }

        // Detectar movimiento real en este fotograma.
        const dx = grupo.position.x - xAnterior;
        const dz = grupo.position.z - zAnterior;
        const velocidadReal = Math.hypot(dx, dz) / Math.max(delta, 0.0001);

        const caminando = velocidadReal > 0.04;
        const corriendo = velocidadReal > config.velocidad * 1.35;

        // Actualizar animaciones.
        if (mixer) {
            mixer.update(delta);
        }

        const tieneClipMovimiento = corriendo
            ? !!(clipCorrer || clipCaminar)
            : !!clipCaminar;

        if (tieneClipMovimiento || (!caminando && clipReposo)) {
            actualizarAnimacion(
                caminando
                    ? (corriendo ? 'correr' : 'caminar')
                    : 'espera'
            );
        } else if (controlHuesos) {
            const tipoAnimacion = caminando
                ? (corriendo ? 'correr' : 'caminar')
                : estado === 'recogiendoProducto'
                    ? 'recoger'
                    : 'espera';

            controlHuesos.animar(
                tipoAnimacion,
                tiempoAnimacion,
                1
            );
        }

        // Balanceo muy ligero de respiración en reposo.
        posicionAnterior.copy(grupo.position);
    }

    // ========================================================
    // CONTROL MANUAL DE ANIMACIONES
    // ========================================================

    function detenerAnimacion() {
        if (mixer) {
            mixer.stopAllAction();
            accionActual = null;
        }

        controlHuesos?.restaurar();
    }

    function reproducirAnimacion(nombre) {
        const texto = normalizarNombre(nombre);

        if (!mixer || !clipsAnimacion.length) {
            return false;
        }

        const clip = clipsAnimacion.find(animacion =>
            normalizarNombre(animacion.name).includes(texto)
        );

        if (!clip) return false;

        cambiarClip(clip);
        return true;
    }

    // ========================================================
    // ELIMINAR
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

        if (productoEnMano) liberarReserva(productoEnMano);
        if (productoObjetivo) liberarReserva(productoObjetivo);

        mixer?.stopAllAction();

        if (mixer && modelo) {
            mixer.uncacheRoot(modelo);
        }

        // Los modelos GLB pueden compartir geometrías y materiales.
        // No destruir esos recursos compartidos.
        scene.remove(grupo);

        grupo.traverse(objeto => {
            if (!objeto.isMesh) return;

            if (
                objeto.geometry?.type === 'CapsuleGeometry' ||
                objeto.geometry?.type === 'SphereGeometry'
            ) {
                objeto.geometry.dispose();
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
