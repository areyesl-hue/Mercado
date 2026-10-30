
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// CLIENTE DE SUPERMERCADO
// Three.js 0.180+
// Animaciones: caminar, recoger, inspeccionar, comprar y devolver.
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

    radioColision: 0.42,
    margenObstaculos: 0.35,
    tamanoCelda: 0.75,

    probabilidadCompra: 0.85,
    distanciaProducto: 1.35,
    distanciaFrenteProducto: 1,

    tiempoRecoger: 0.9,
    tiempoInspeccionar: 3.0,
    tiempoGuardar: 1.5,
    tiempoDevolver: 1.5,
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

    posicionCaja: { x: 0, z: 22.5 },

    correccionRotacion: 0,

    // Posición del producto en relación con el personaje.
    alturaProductoInspeccion: 1.25,
    distanciaProductoInspeccion: 0.35,

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
// UTILIDADES
// ============================================================

function limitar(valor, minimo, maximo) {
    return Math.max(minimo, Math.min(maximo, valor));
}

function distanciaXZ(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
}

function numero(valor, defecto) {
    return Number.isFinite(valor) ? valor : defecto;
}

function normalizarNombre(nombre) {
    return String(nombre ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
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
    let tiempoReintento = 0;
    let contadorBusqueda = 0;

    let productoObjetivo = null;
    let productoEnMano = null;
    let productoOriginal = null;

    let compras = [];
    let registroProductoActual = null;

    let decisionCompra = true;
    let faseAnimacion = Math.random() * Math.PI * 2;
    let animacionActiva = false;

    // ========================================================
    // ESQUELETO
    // ========================================================

    const huesos = {};
    const huesosBase = new Map();

    function detectarHuesos(raiz) {
        Object.keys(huesos).forEach(nombre => delete huesos[nombre]);
        huesosBase.clear();

        raiz.traverse(objeto => {
            if (!objeto.isBone) return;

            const nombre = normalizarNombre(objeto.name);
            huesos[nombre] = objeto;

            huesosBase.set(objeto, {
                quaternion: objeto.quaternion.clone(),
                posicion: objeto.position.clone()
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

    function obtenerHuesosAnimacion() {
        return {
            cadera: buscarHueso('hips', 'pelvis'),
            torso: buscarHueso('spine', 'spine1', 'chest'),

            brazoIzquierdo: buscarHueso(
                'leftupperarm', 'upperarml', 'leftarm'
            ),

            brazoDerecho: buscarHueso(
                'rightupperarm', 'upperarmr', 'rightarm'
            ),

            antebrazoIzquierdo: buscarHueso(
                'leftforearm', 'forearml', 'lowerarml'
            ),

            antebrazoDerecho: buscarHueso(
                'rightforearm', 'forearmr', 'lowerarmr'
            ),

            manoIzquierda: buscarHueso(
                'lefthand', 'handl', 'handleft'
            ),

            manoDerecha: buscarHueso(
                'righthand', 'handr', 'handright'
            ),

            piernaIzquierda: buscarHueso(
                'leftupleg', 'uplegleft', 'leftthigh', 'thighl'
            ),

            piernaDerecha: buscarHueso(
                'rightupleg', 'uplegright', 'rightthigh', 'thighr'
            ),

            pantorrillaIzquierda: buscarHueso(
                'leftleg', 'lowerlegleft', 'calfl', 'leftcalf'
            ),

            pantorrillaDerecha: buscarHueso(
                'rightleg', 'lowerlegright', 'calfr', 'rightcalf'
            )
        };
    }

    const rig = {
        cadera: null,
        torso: null,
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

    function actualizarRig() {
        Object.assign(rig, obtenerHuesosAnimacion());
    }

    function aplicarRotacion(hueso, eje, angulo) {
        if (!hueso) return;

        const base = huesosBase.get(hueso);
        if (!base) return;

        const giro = new THREE.Quaternion()
            .setFromAxisAngle(eje, angulo);

        hueso.quaternion.copy(base.quaternion);
        hueso.quaternion.multiply(giro);
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
    }

    // ========================================================
    // ANIMACIONES PROCEDURALES
    // ========================================================

    const EJE_X = new THREE.Vector3(1, 0, 0);
    const EJE_Y = new THREE.Vector3(0, 1, 0);
    const EJE_Z = new THREE.Vector3(0, 0, 1);

    function animarCaminar(activo) {
        animacionActiva = activo;

        if (!mixer) return;

        if (activo && accionCaminar) {
            if (!accionCaminar.isRunning()) {
                accionReposo?.stop();
                accionCaminar.reset().fadeIn(0.2).play();
            }
        } else if (!activo) {
            if (accionCaminar?.isRunning()) {
                accionCaminar.fadeOut(0.2);
            }

            if (accionReposo && !accionReposo.isRunning()) {
                accionReposo.reset().fadeIn(0.2).play();
            }
        }
    }

    function animarCaminarProcedural() {
        const paso = Math.sin(faseAnimacion) * 0.22;
        const pasoContrario = -paso;

        aplicarRotacion(rig.piernaIzquierda, EJE_X, paso);
        aplicarRotacion(rig.piernaDerecha, EJE_X, pasoContrario);

        aplicarRotacion(
            rig.pantorrillaIzquierda,
            EJE_X,
            Math.max(0, -paso) * 0.4
        );

        aplicarRotacion(
            rig.pantorrillaDerecha,
            EJE_X,
            Math.max(0, -pasoContrario) * 0.4
        );

        aplicarRotacion(
            rig.brazoIzquierdo,
            EJE_X,
            -paso * 0.35
        );

        aplicarRotacion(
            rig.brazoDerecho,
            EJE_X,
            paso * 0.35
        );
    }

    function animarInspeccion(t) {
        // El brazo derecho se aproxima al producto.
        // Los ángulos son moderados para respetar la pose base.
        const levantar = Math.sin(Math.PI * t);

        aplicarRotacion(
            rig.brazoDerecho,
            EJE_X,
            -0.35 * levantar
        );

        aplicarRotacion(
            rig.antebrazoDerecho,
            EJE_X,
            -0.45 * levantar
        );

        aplicarRotacion(
            rig.brazoIzquierdo,
            EJE_X,
            -0.12 * levantar
        );

        aplicarRotacion(
            rig.antebrazoIzquierdo,
            EJE_X,
            -0.18 * levantar
        );

        // Inclinación discreta del torso.
        aplicarRotacion(
            rig.torso,
            EJE_X,
            -0.035 * levantar
        );

        // Pequeño movimiento de muñeca para simular lectura.
        aplicarRotacion(
            rig.manoDerecha,
            EJE_Y,
            Math.sin(t * Math.PI * 4) * 0.06
        );

        aplicarRotacion(
            rig.manoIzquierda,
            EJE_Y,
            -Math.sin(t * Math.PI * 4) * 0.025
        );
    }

    function animarRecoger(t) {
        const levantar = Math.sin(Math.PI * t);

        aplicarRotacion(
            rig.brazoDerecho,
            EJE_X,
            -0.28 * levantar
        );

        aplicarRotacion(
            rig.antebrazoDerecho,
            EJE_X,
            -0.35 * levantar
        );

        aplicarRotacion(
            rig.brazoIzquierdo,
            EJE_X,
            -0.10 * levantar
        );

        aplicarRotacion(
            rig.torso,
            EJE_X,
            0.06 * levantar
        );
    }

    function animarGuardar(t) {
        // Los brazos bajan hacia el carrito.
        const bajar = Math.sin(Math.PI * t);

        aplicarRotacion(
            rig.brazoDerecho,
            EJE_X,
            0.28 * bajar
        );

        aplicarRotacion(
            rig.antebrazoDerecho,
            EJE_X,
            0.32 * bajar
        );

        aplicarRotacion(
            rig.brazoIzquierdo,
            EJE_X,
            0.22 * bajar
        );

        aplicarRotacion(
            rig.antebrazoIzquierdo,
            EJE_X,
            0.25 * bajar
        );

        aplicarRotacion(
            rig.torso,
            EJE_X,
            0.08 * bajar
        );
    }

    function actualizarAnimacion(delta) {
        if (!modelo) return;

        if (mixer) {
            mixer.update(delta);
        }

        if (estado === ESTADOS.RUTA ||
            estado === ESTADOS.ENTRANDO ||
            estado === ESTADOS.ACERCANDO ||
            estado === ESTADOS.REGRESANDO ||
            estado === ESTADOS.CAJA) {
            animacionActiva = true;
        } else {
            animacionActiva = false;
        }

        if (animacionActiva) {
            faseAnimacion += delta * 7.5;
        }

        if (accionCaminar && mixer) {
            return;
        }

        switch (estado) {
            case ESTADOS.RUTA:
            case ESTADOS.ENTRANDO:
            case ESTADOS.ACERCANDO:
            case ESTADOS.REGRESANDO:
            case ESTADOS.CAJA:
                animarCaminarProcedural();
                break;

            case ESTADOS.RECOGIENDO:
                animarRecoger(
                    limitar(tiempoEstado / config.tiempoRecoger, 0, 1)
                );
                break;

            case ESTADOS.INSPECCIONANDO:
            case ESTADOS.DECIDIENDO:
                animarInspeccion(
                    limitar(
                        tiempoEstado / config.tiempoInspeccionar,
                        0,
                        1
                    )
                );
                break;

            case ESTADOS.GUARDANDO:
                animarGuardar(
                    limitar(tiempoEstado / config.tiempoGuardar, 0, 1)
                );
                break;

            case ESTADOS.DEVOLVIENDO:
                animarGuardar(
                    limitar(tiempoEstado / config.tiempoDevolver, 0, 1)
                );
                break;

            default:
                for (const hueso of Object.values(rig)) {
                    restaurarHueso(hueso, 0.15);
                }
                break;
        }
    }

    // ========================================================
    // MODELO PROVISIONAL
    // ========================================================

    function crearModeloProvisional() {
        const humano = new THREE.Group();

        const piel = new THREE.MeshStandardMaterial({
            color: 0xc99570,
            roughness: 0.85
        });

        const camisa = new THREE.MeshStandardMaterial({
            color: 0x2678b8,
            roughness: 0.85
        });

        const pantalon = new THREE.MeshStandardMaterial({
            color: 0x293e68,
            roughness: 0.9
        });

        const zapatos = new THREE.MeshStandardMaterial({
            color: 0x202020,
            roughness: 0.9
        });

        const torso = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.23, 0.48, 3, 8),
            camisa
        );

        torso.position.y = 1.12;
        humano.add(torso);

        const cabeza = new THREE.Mesh(
            new THREE.SphereGeometry(0.17, 12, 10),
            piel
        );

        cabeza.position.y = 1.65;
        humano.add(cabeza);

        humano.userData.brazos = [];
        humano.userData.piernas = [];

        for (const lado of [-1, 1]) {
            const brazo = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.065, 0.35, 3, 6),
                camisa
            );

            brazo.position.set(lado * 0.28, 1.16, 0);
            brazo.rotation.z = lado * -0.12;
            humano.add(brazo);
            humano.userData.brazos.push(brazo);

            const pierna = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.085, 0.43, 3, 6),
                pantalon
            );

            pierna.position.set(lado * 0.12, 0.48, 0);
            humano.add(pierna);
            humano.userData.piernas.push(pierna);

            const zapato = new THREE.Mesh(
                new THREE.BoxGeometry(0.17, 0.10, 0.28),
                zapatos
            );

            zapato.position.set(lado * 0.12, 0.10, 0.06);
            humano.add(zapato);
        }

        humano.name = 'CLIENTE_PROVISIONAL';
        grupo.add(humano);
        modelo = humano;
    }

    // ========================================================
    // CARGAR MODELO GLB
    // ========================================================

    function cargarModelo() {
        loaderGLTF.load(
            config.modelo,
            gltf => {
                if (eliminado) return;

                if (modelo) {
                    grupo.remove(modelo);
                }

                modelo = gltf.scene;
                modelo.name = 'MODELO_CLIENTE_GLTF';

                const cajaInicial = new THREE.Box3()
                    .setFromObject(modelo);

                const tamano = cajaInicial.getSize(
                    new THREE.Vector3()
                );

                const factor = tamano.y > 0
                    ? config.altura / tamano.y
                    : 1;

                modelo.scale.multiplyScalar(
                    factor * config.escala
                );

                const caja = new THREE.Box3()
                    .setFromObject(modelo);

                const centro = caja.getCenter(
                    new THREE.Vector3()
                );

                modelo.position.x -= centro.x;
                modelo.position.y -= caja.min.y;
                modelo.position.z -= centro.z;

                modelo.rotation.y = config.correccionRotacion;

                modelo.traverse(objeto => {
                    if (!objeto.isMesh) return;

                    objeto.castShadow = false;
                    objeto.receiveShadow = false;
                });

                grupo.add(modelo);

                detectarHuesos(modelo);
                actualizarRig();

                if (gltf.animations?.length) {
                    mixer = new THREE.AnimationMixer(modelo);

                    const caminar = gltf.animations.find(animacion =>
                        /walk|caminar|walking/i.test(animacion.name)
                    );

                    const reposo = gltf.animations.find(animacion =>
                        /idle|rest|reposo|standing/i.test(animacion.name)
                    );

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
                        accionReposo.play();
                    }
                }

                restaurarPoseCompleta();
                cargado = true;

                console.log(
                    `Cliente ${id}: modelo cargado correctamente.`
                );
                console.log(
                    `Cliente ${id}: huesos detectados:`,
                    Object.keys(huesos)
                );
            },
            undefined,
            error => {
                console.warn(
                    `No se pudo cargar ${config.modelo}.`,
                    error
                );
            }
        );
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

        return mobiliario?.userData?.colisiones ?? [];
    }

    let colisiones = obtenerColisiones();

    function actualizarColisiones() {
        colisiones = obtenerColisiones();
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
            config.radioColision + config.margenObstaculos;

        for (const obstaculo of colisiones) {
            if (!obstaculo) continue;

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
    // PATHFINDING A*
    // ========================================================

    function claveCelda(x, z) {
        return `${x},${z}`;
    }

    function mundoACelda(x, z) {
        return {
            x: Math.round(x / config.tamanoCelda),
            z: Math.round(z / config.tamanoCelda)
        };
    }

    function celdaAMundo(x, z) {
        return {
            x: x * config.tamanoCelda,
            z: z * config.tamanoCelda
        };
    }

    function heuristica(a, b) {
        return Math.hypot(a.x - b.x, a.z - b.z);
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

    function suavizarCamino(camino) {
        if (camino.length < 3) return camino;

        const resultado = [camino[0]];
        let actual = 0;

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

        while (abiertos.size && iteraciones++ < 14000) {
            let actualKey = null;
            let actual = null;
            let menorF = Infinity;

            for (const [key, celda] of abiertos) {
                const valor = fScore.get(key) ?? Infinity;

                if (valor < menorF) {
                    menorF = valor;
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

                camino.push({
                    x: destino.x,
                    z: destino.z
                });

                return suavizarCamino(camino);
            }

            abiertos.delete(actualKey);
            cerrados.add(actualKey);

            for (const [dx, dz] of direcciones) {
                const vecino = {
                    x: actual.x + dx,
                    z: actual.z + dz
                };

                const mundo = celdaAMundo(
                    vecino.x,
                    vecino.z
                );

                const vecinoKey = claveCelda(
                    vecino.x,
                    vecino.z
                );

                if (cerrados.has(vecinoKey)) continue;

                if (!puntoLibre(mundo.x, mundo.z)) continue;

                if (dx !== 0 && dz !== 0) {
                    const lateralA = celdaAMundo(
                        actual.x + dx,
                        actual.z
                    );

                    const lateralB = celdaAMundo(
                        actual.x,
                        actual.z + dz
                    );

                    if (
                        !puntoLibre(lateralA.x, lateralA.z) ||
                        !puntoLibre(lateralB.x, lateralB.z)
                    ) {
                        continue;
                    }
                }

                const costo = dx !== 0 && dz !== 0
                    ? 1.414
                    : 1;

                const tentativo =
                    (gScore.get(actualKey) ?? Infinity) + costo;

                if (
                    tentativo <
                    (gScore.get(vecinoKey) ?? Infinity)
                ) {
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

    function establecerObjetivo(destino, nuevoEstado = ESTADOS.RUTA) {
        if (!destino) return false;

        const inicio = {
            x: grupo.position.x,
            z: grupo.position.z
        };

        let destinoSeguro = {
            x: limitar(destino.x, -config.limiteX, config.limiteX),
            z: limitar(
                destino.z,
                config.limiteZMin,
                config.limiteZMax
            )
        };

        if (!puntoLibre(destinoSeguro.x, destinoSeguro.z)) {
            let encontrado = false;

            for (let radio = 0.5; radio <= 5; radio += 0.5) {
                for (
                    let angulo = 0;
                    angulo < Math.PI * 2;
                    angulo += Math.PI / 4
                ) {
                    const x =
                        destinoSeguro.x + Math.cos(angulo) * radio;

                    const z =
                        destinoSeguro.z + Math.sin(angulo) * radio;

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

        const nuevoCamino = encontrarCamino(
            inicio,
            destinoSeguro
        );

        if (!nuevoCamino.length) {
            if (distanciaXZ(inicio, destinoSeguro) < 0.5) {
                objetivo = destinoSeguro;
                ruta = [];
                cambiarEstado(nuevoEstado);
                return true;
            }

            return false;
        }

        ruta = nuevoCamino;
        indiceRuta = 0;
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

        const destino = ruta[indiceRuta] ?? objetivo;

        let dx = destino.x - grupo.position.x;
        let dz = destino.z - grupo.position.z;

        const distancia = Math.hypot(dx, dz);

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
            velocidad * delta
        );

        const siguienteX = grupo.position.x + dx * avance;
        const siguienteZ = grupo.position.z + dz * avance;

        if (puntoLibre(siguienteX, siguienteZ)) {
            grupo.position.x = siguienteX;
            grupo.position.z = siguienteZ;
        } else {
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
                objeto.userData.enCarrito ||
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
            scene
                .getObjectByName('PRODUCTOS_SUPERMERCADO')
                ?.traverse(agregar);
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

        const candidatos = disponibles
            .map(registro => ({
                ...registro,
                distancia: distanciaXZ(
                    grupo.position,
                    registro.posicion
                )
            }))
            .filter(registro =>
                registro.distancia <= config.distanciaMaximaBusqueda
            )
            .sort((a, b) => a.distancia - b.distancia);

        if (!candidatos.length) return null;

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
        registroProductoActual = registro;

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

    // ========================================================
    // TOMAR PRODUCTO Y COLOCARLO EN LA MANO
    // ========================================================

    function adjuntarProductoAMano(objeto) {
        const mano = rig.manoDerecha;

        if (mano) {
            mano.attach(objeto);

            objeto.position.set(0, 0, 0.12);
            objeto.rotation.set(0, 0, 0);
            objeto.scale.multiplyScalar(0.65);
        } else {
            grupo.attach(objeto);

            objeto.position.set(
                config.distanciaProductoInspeccion,
                config.alturaProductoInspeccion,
                0.22
            );

            objeto.rotation.set(0, 0, 0);
            objeto.scale.multiplyScalar(0.65);
        }
    }

    function actualizarProductoEnMano() {
        if (!productoEnMano) return;

        const objeto = productoEnMano;

        // El producto gira suavemente mientras el cliente lo inspecciona.
        if (
            estado === ESTADOS.INSPECCIONANDO ||
            estado === ESTADOS.DECIDIENDO
        ) {
            const giro = Math.sin(tiempoEstado * 2.2) * 0.22;
            objeto.rotation.y = giro;
            objeto.rotation.x = Math.sin(tiempoEstado * 1.5) * 0.07;
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

        // Desvincular del estante y llevarlo al personaje.
        scene.attach(objeto);

        productoEnMano = objeto;
        adjuntarProductoAMano(objeto);

        cambiarEstado(ESTADOS.INSPECCIONANDO);
    }

    // ========================================================
    // INSPECCIÓN Y DECISIÓN
    // ========================================================

    function terminarInspeccion() {
        // 85 % compra y 15 % devuelve.
        decisionCompra = Math.random() < config.probabilidadCompra;

        cambiarEstado(ESTADOS.DECIDIENDO);
    }

    function registrarCompra() {
        if (!productoEnMano) return;

        const objeto = productoEnMano;

        const compra = {
            nombre: objeto.userData.nombre ?? objeto.name,
            codigo: objeto.userData.codigoProducto ??
                objeto.userData.skuProducto ??
                objeto.userData.codigo ??
                objeto.name,
            objeto,
            fecha: Date.now()
        };

        compras.push(compra);

        if (typeof config.alComprar === 'function') {
            config.alComprar({
                cliente: api,
                producto: objeto,
                compra
            });
        }
    }

    // ========================================================
    // COLOCAR PRODUCTO EN EL CARRITO
    // ========================================================

    function guardarProductoEnCarrito() {
        if (!productoEnMano) {
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        const objeto = productoEnMano;
        const carrito = config.carrito;

        const registro = {
            objeto,
            nombre: objeto.userData.nombre ?? objeto.name,
            codigo: objeto.userData.codigoProducto ??
                objeto.userData.codigo ??
                objeto.name
        };

        if (
            carrito &&
            typeof carrito.agregarProducto === 'function'
        ) {
            try {
                carrito.agregarProducto(registro);
            } catch (error) {
                console.warn(
                    'No se pudo agregar al carrito:',
                    error
                );

                devolverProductoAlEstante();
                cambiarEstado(ESTADOS.BUSCANDO);
                return;
            }
        }

        // Si el carrito ofrece un punto de colocación,
        // el producto se mueve hasta ese punto.
        const destinoCarrito =
            carrito?.obtenerPuntoColocacion?.() ??
            carrito?.puntoColocacion ??
            null;

        if (destinoCarrito?.isVector3) {
            objeto.position.copy(destinoCarrito);
        }

        objeto.userData.enCarrito = true;
        objeto.userData.reservado = false;

        if (reservasProductos.get(objeto) === id) {
            reservasProductos.delete(objeto);
        }

        registrarCompra();

        productoEnMano = null;
        productoOriginal = null;
        productoObjetivo = null;
        registroProductoActual = null;

        tiempoReintento = config.tiempoEntreProductos;
        cambiarEstado(ESTADOS.ESPERANDO);
    }

    // ========================================================
    // DEVOLVER PRODUCTO AL ESTANTE
    // ========================================================

    function devolverProductoAlEstante() {
        if (!productoEnMano || !productoOriginal) return;

        const {
            objeto,
            padre,
            posicion,
            quaternion,
            escala
        } = productoOriginal;

        if (padre) {
            padre.attach(objeto);

            objeto.position.copy(posicion);
            objeto.quaternion.copy(quaternion);
            objeto.scale.copy(escala);
        }

        objeto.userData.reservado = false;
        objeto.userData.enCarrito = false;

        if (reservasProductos.get(objeto) === id) {
            reservasProductos.delete(objeto);
        }

        productoEnMano = null;
        productoOriginal = null;
        productoObjetivo = null;
        registroProductoActual = null;
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
            const indice = (
                indiceRecorrido + i
            ) % puntosRecorrido.length;

            const candidato = puntosRecorrido[indice];

            if (
                puntoLibre(candidato.x, candidato.z) &&
                distanciaXZ(grupo.position, candidato) > 2
            ) {
                indiceRecorrido = (
                    indice + 1
                ) % puntosRecorrido.length;

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
    // CAJA Y PAGO
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
    }

    // ========================================================
    // VEHÍCULOS
    // ========================================================

    function iniciarDesdeVehiculo(posicionEntrada, plaza) {
        if (!posicionEntrada || !plaza) {
            console.warn(
                'Se necesitan posicionEntrada y plaza.'
            );
            return false;
        }

        liberarReserva();

        if (productoEnMano) {
            devolverProductoAlEstante();
        }

        compras = [];

        grupo.position.set(
            numero(posicionEntrada.x, plaza.x),
            0,
            numero(posicionEntrada.z, plaza.z)
        );

        return establecerObjetivo(
            { x: 0, z: 26 },
            ESTADOS.ENTRANDO
        );
    }

    function iniciarRegresoVehiculo(plaza, callback) {
        if (!plaza) return false;

        liberarReserva();

        if (productoEnMano) {
            devolverProductoAlEstante();
        }

        const destino = {
            x: plaza.x,
            z: plaza.z
        };

        const camino = encontrarCamino(
            grupo.position,
            destino
        );

        if (!camino.length) {
            console.warn(
                'No se encontró una ruta de regreso al vehículo.'
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
    // ACTUALIZACIÓN
    // ========================================================

    function actualizar(delta) {
        if (eliminado || detenido) return;

        delta = limitar(numero(delta, 0), 0, 0.05);

        tiempoEstado += delta;

        actualizarAnimacion(delta);
        actualizarProductoEnMano();

        const seMueve = [
            ESTADOS.RUTA,
            ESTADOS.ENTRANDO,
            ESTADOS.ACERCANDO,
            ESTADOS.REGRESANDO,
            ESTADOS.CAJA
        ].includes(estado) && objetivo !== null;

        if (seMueve) {
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

            case ESTADOS.INSPECCIONANDO:
                if (
                    tiempoEstado >= config.tiempoInspeccionar
                ) {
                    terminarInspeccion();
                }
                break;

            case ESTADOS.DECIDIENDO:
                if (tiempoEstado >= 0.8) {
                    if (decisionCompra) {
                        cambiarEstado(ESTADOS.GUARDANDO);
                    } else {
                        cambiarEstado(ESTADOS.DEVOLVIENDO);
                    }
                }
                break;

            case ESTADOS.GUARDANDO:
                if (tiempoEstado >= config.tiempoGuardar) {
                    guardarProductoEnCarrito();
                }
                break;

            case ESTADOS.DEVOLVIENDO:
                if (tiempoEstado >= config.tiempoDevolver) {
                    devolverProductoAlEstante();
                    tiempoReintento = config.tiempoEntreProductos;
                    cambiarEstado(ESTADOS.ESPERANDO);
                }
                break;

            case ESTADOS.ESPERANDO:
                tiempoReintento -= delta;

                if (tiempoReintento <= 0) {
                    if (compras.length >= config.maximoProductos) {
                        dirigirseACaja();
                    } else {
                        contadorBusqueda++;

                        if (contadorBusqueda % 3 === 0) {
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

        const destino = nuevaRuta[nuevaRuta.length - 1];

        return establecerObjetivo(
            { x: destino.x, z: destino.z },
            ESTADOS.RUTA
        );
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
            devolverProductoAlEstante();
        }

        mixer?.stopAllAction();
        mixer = null;

        grupo.parent?.remove(grupo);

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

        obtenerCompras: () => compras.map(compra => ({
            nombre: compra.nombre,
            codigo: compra.codigo
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
