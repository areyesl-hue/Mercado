
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
    tiempoInspeccionar: 3,
    tiempoGuardar: 1.5,
    tiempoDevolver: 1.5,
    tiempoEntreProductos: 1.5,
    tiempoReintento: 3,

    tiempoMovimientoProducto: 0.85,
    tiempoDepositoProducto: 0.9,
    escalaProductoMano: 0.65,

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

function suavizar(t) {
    t = limitar(t, 0, 1);
    return t * t * (3 - 2 * t);
}

export function crearClienteSupermercado(scene, opciones = {}) {
    if (!scene?.isScene) {
        throw new Error('crearClienteSupermercado necesita una THREE.Scene.');
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
        }
    };

    const id = siguienteIdCliente++;

    const grupo = new THREE.Group();
    grupo.name = `CLIENTE_SUPERMERCADO_${id}`;
    grupo.position.set(
        numero(config.posicion.x, 0),
        numero(config.posicion.y, 0),
        numero(config.posicion.z, 20)
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
    let entradaNotificada = false;

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
    let movimientoProducto = null;

    let compras = [];
    let decisionCompra = true;
    let faseAnimacion = Math.random() * Math.PI * 2;

    const huesos = {};
    const huesosBase = new Map();

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

    const EJE_X = new THREE.Vector3(1, 0, 0);
    const EJE_Y = new THREE.Vector3(0, 1, 0);

    // =========================================================
    // ESQUELETO
    // =========================================================

    function detectarHuesos(raiz) {
        Object.keys(huesos).forEach(nombre => delete huesos[nombre]);
        huesosBase.clear();

        raiz.traverse(objeto => {
            if (!objeto.isBone) return;

            huesos[normalizarNombre(objeto.name)] = objeto;

            huesosBase.set(objeto, {
                quaternion: objeto.quaternion.clone(),
                posicion: objeto.position.clone()
            });
        });
    }

    function buscarHueso(...patrones) {
        for (const [nombre, hueso] of Object.entries(huesos)) {
            if (patrones.some(p => nombre.includes(p))) return hueso;
        }
        return null;
    }

    function actualizarRig() {
        rig.cadera = buscarHueso('hips', 'pelvis');
        rig.torso = buscarHueso('spine', 'spine1', 'chest');

        rig.brazoIzquierdo = buscarHueso('leftupperarm', 'upperarml', 'leftarm');
        rig.brazoDerecho = buscarHueso('rightupperarm', 'upperarmr', 'rightarm');

        rig.antebrazoIzquierdo = buscarHueso('leftforearm', 'forearml', 'lowerarml');
        rig.antebrazoDerecho = buscarHueso('rightforearm', 'forearmr', 'lowerarmr');

        rig.manoIzquierda = buscarHueso('lefthand', 'handl', 'handleft');
        rig.manoDerecha = buscarHueso('righthand', 'handr', 'handright');

        rig.piernaIzquierda = buscarHueso('leftupleg', 'uplegleft', 'leftthigh', 'thighl');
        rig.piernaDerecha = buscarHueso('rightupleg', 'uplegright', 'rightthigh', 'thighr');

        rig.pantorrillaIzquierda = buscarHueso('leftleg', 'lowerlegleft', 'calfl', 'leftcalf');
        rig.pantorrillaDerecha = buscarHueso('rightleg', 'lowerlegright', 'calfr', 'rightcalf');
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
        const base = huesosBase.get(hueso);

        if (hueso && base) {
            hueso.quaternion.slerp(base.quaternion, intensidad);
        }
    }

    function restaurarPoseCompleta() {
        for (const [hueso, base] of huesosBase) {
            hueso.quaternion.copy(base.quaternion);
            hueso.position.copy(base.posicion);
        }
    }

    function animarCaminarProcedural() {
        const paso = Math.sin(faseAnimacion) * 0.22;

        aplicarRotacion(rig.piernaIzquierda, EJE_X, paso);
        aplicarRotacion(rig.piernaDerecha, EJE_X, -paso);

        aplicarRotacion(rig.pantorrillaIzquierda, EJE_X, Math.max(0, -paso) * 0.4);
        aplicarRotacion(rig.pantorrillaDerecha, EJE_X, Math.max(0, paso) * 0.4);

        aplicarRotacion(rig.brazoIzquierdo, EJE_X, -paso * 0.35);
        aplicarRotacion(rig.brazoDerecho, EJE_X, paso * 0.35);
    }

    function animarRecoger(t) {
        const levantar = Math.sin(Math.PI * limitar(t, 0, 1));

        aplicarRotacion(rig.brazoDerecho, EJE_X, -0.9 * levantar);
        aplicarRotacion(rig.antebrazoDerecho, EJE_X, -0.8 * levantar);
        aplicarRotacion(rig.brazoIzquierdo, EJE_X, -0.12 * levantar);
        aplicarRotacion(rig.torso, EJE_X, 0.08 * levantar);
    }

    function animarInspeccion(t) {
        const levantar = 0.75 + Math.sin(t * Math.PI * 2) * 0.04;

        aplicarRotacion(rig.brazoDerecho, EJE_X, -0.45 * levantar);
        aplicarRotacion(rig.antebrazoDerecho, EJE_X, -0.55 * levantar);
        aplicarRotacion(rig.brazoIzquierdo, EJE_X, -0.15);
        aplicarRotacion(rig.antebrazoIzquierdo, EJE_X, -0.18);
        aplicarRotacion(rig.torso, EJE_X, -0.035);
        aplicarRotacion(rig.manoDerecha, EJE_Y, Math.sin(t * 4) * 0.06);
    }

    function animarGuardar(t) {
        const bajar = Math.sin(Math.PI * limitar(t, 0, 1));

        aplicarRotacion(rig.brazoDerecho, EJE_X, 0.85 * bajar);
        aplicarRotacion(rig.antebrazoDerecho, EJE_X, 0.75 * bajar);
        aplicarRotacion(rig.brazoIzquierdo, EJE_X, 0.2 * bajar);
        aplicarRotacion(rig.antebrazoIzquierdo, EJE_X, 0.2 * bajar);
        aplicarRotacion(rig.torso, EJE_X, 0.08 * bajar);
    }

    function actualizarAnimacion(delta) {
        if (!modelo) return;

        mixer?.update(delta);

        const caminando = [
            ESTADOS.RUTA,
            ESTADOS.ENTRANDO,
            ESTADOS.ACERCANDO,
            ESTADOS.REGRESANDO,
            ESTADOS.CAJA
        ].includes(estado);

        if (caminando) faseAnimacion += delta * 7.5;

        // Si el GLB tiene animación de caminar, se utiliza.
        if (accionCaminar && mixer && caminando) {
            if (!accionCaminar.isRunning()) {
                accionReposo?.fadeOut(0.15);
                accionCaminar.reset().fadeIn(0.15).play();
            }
            return;
        }

        if (accionCaminar?.isRunning() && !caminando) {
            accionCaminar.fadeOut(0.15);
            accionReposo?.reset().fadeIn(0.15).play();
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
                animarRecoger(tiempoEstado / config.tiempoMovimientoProducto);
                break;

            case ESTADOS.INSPECCIONANDO:
            case ESTADOS.DECIDIENDO:
                animarInspeccion(tiempoEstado);
                break;

            case ESTADOS.GUARDANDO:
            case ESTADOS.DEVOLVIENDO:
                animarGuardar(tiempoEstado / config.tiempoDepositoProducto);
                break;

            default:
                Object.values(rig).forEach(h => restaurarHueso(h));
        }
    }

    // =========================================================
    // MODELO
    // =========================================================

    function crearModeloProvisional() {
        const humano = new THREE.Group();

        const piel = new THREE.MeshStandardMaterial({ color: 0xc99570 });
        const camisa = new THREE.MeshStandardMaterial({ color: 0x2678b8 });
        const pantalon = new THREE.MeshStandardMaterial({ color: 0x293e68 });
        const zapatos = new THREE.MeshStandardMaterial({ color: 0x202020 });

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

    function cargarModelo() {
        loaderGLTF.load(
            config.modelo,
            gltf => {
                if (eliminado) return;

                if (modelo) grupo.remove(modelo);

                modelo = gltf.scene;
                modelo.name = 'MODELO_CLIENTE_GLTF';

                const cajaInicial = new THREE.Box3().setFromObject(modelo);
                const tamano = cajaInicial.getSize(new THREE.Vector3());

                const factor = tamano.y > 0
                    ? config.altura / tamano.y
                    : 1;

                modelo.scale.multiplyScalar(factor * config.escala);

                const caja = new THREE.Box3().setFromObject(modelo);
                const centro = caja.getCenter(new THREE.Vector3());

                modelo.position.x -= centro.x;
                modelo.position.y -= caja.min.y;
                modelo.position.z -= centro.z;
                modelo.rotation.y = config.correccionRotacion;

                modelo.traverse(objeto => {
                    if (objeto.isMesh) {
                        objeto.castShadow = false;
                        objeto.receiveShadow = false;
                    }
                });

                grupo.add(modelo);

                detectarHuesos(modelo);
                actualizarRig();

                if (gltf.animations?.length) {
                    mixer = new THREE.AnimationMixer(modelo);

                    const caminar = gltf.animations.find(a =>
                        /walk|caminar|walking/i.test(a.name)
                    );

                    const reposo = gltf.animations.find(a =>
                        /idle|rest|reposo|standing/i.test(a.name)
                    );

                    if (caminar) {
                        accionCaminar = mixer.clipAction(caminar);
                        accionCaminar.setLoop(THREE.LoopRepeat, Infinity);
                    }

                    if (reposo) {
                        accionReposo = mixer.clipAction(reposo);
                        accionReposo.setLoop(THREE.LoopRepeat, Infinity);
                        accionReposo.play();
                    }
                }

                restaurarPoseCompleta();
                cargado = true;

                console.log(`Cliente ${id}: modelo cargado correctamente.`);
                console.log('Huesos detectados:', Object.keys(huesos));
            },
            undefined,
            error => {
                console.warn(`No se pudo cargar ${config.modelo}.`, error);
            }
        );
    }

    crearModeloProvisional();
    cargarModelo();

    // =========================================================
    // COLISIONES
    // =========================================================

    function obtenerColisiones() {
        if (Array.isArray(config.colisiones)) return config.colisiones;

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
        ) return false;

        const margen = config.radioColision + config.margenObstaculos;

        for (const obstaculo of colisiones) {
            if (!obstaculo) continue;

            if (
                x >= obstaculo.minX - margen &&
                x <= obstaculo.maxX + margen &&
                z >= obstaculo.minZ - margen &&
                z <= obstaculo.maxZ + margen
            ) return false;
        }

        return true;
    }

    // =========================================================
    // PATHFINDING A*
    // =========================================================

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
                if (segmentoLibre(camino[actual], camino[siguiente])) break;
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

            if (actual.x === final.x && actual.z === final.z) {
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

                const mundo = celdaAMundo(vecino.x, vecino.z);
                const vecinoKey = claveCelda(vecino.x, vecino.z);

                if (cerrados.has(vecinoKey)) continue;
                if (!puntoLibre(mundo.x, mundo.z)) continue;

                if (dx !== 0 && dz !== 0) {
                    const lateralA = celdaAMundo(actual.x + dx, actual.z);
                    const lateralB = celdaAMundo(actual.x, actual.z + dz);

                    if (
                        !puntoLibre(lateralA.x, lateralA.z) ||
                        !puntoLibre(lateralB.x, lateralB.z)
                    ) continue;
                }

                const costo = dx !== 0 && dz !== 0 ? 1.414 : 1;
                const tentativo = (gScore.get(actualKey) ?? Infinity) + costo;

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

    // =========================================================
    // ESTADOS Y OBJETIVOS
    // =========================================================

    function cambiarEstado(nuevoEstado) {
        if (estado === nuevoEstado) return;

        const estadoAnterior = estado;
        estado = nuevoEstado;
        tiempoEstado = 0;

        config.alCambiarEstado?.({
            cliente: api,
            estado,
            estadoAnterior
        });
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

            for (let radio = 0.5; radio <= 5 && !encontrado; radio += 0.5) {
                for (
                    let angulo = 0;
                    angulo < Math.PI * 2;
                    angulo += Math.PI / 4
                ) {
                    const x = destinoSeguro.x + Math.cos(angulo) * radio;
                    const z = destinoSeguro.z + Math.sin(angulo) * radio;

                    if (puntoLibre(x, z)) {
                        destinoSeguro = { x, z };
                        encontrado = true;
                        break;
                    }
                }
            }

            if (!encontrado) return false;
        }

        const nuevoCamino = encontrarCamino(inicio, destinoSeguro);

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

    // =========================================================
    // MOVIMIENTO
    // =========================================================

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

        const avance = Math.min(distancia, velocidad * delta);
        const siguienteX = grupo.position.x + dx * avance;
        const siguienteZ = grupo.position.z + dz * avance;

        if (puntoLibre(siguienteX, siguienteZ)) {
            grupo.position.x = siguienteX;
            grupo.position.z = siguienteZ;
        } else if (puntoLibre(siguienteX, grupo.position.z)) {
            grupo.position.x = siguienteX;
        } else if (puntoLibre(grupo.position.x, siguienteZ)) {
            grupo.position.z = siguienteZ;
        } else {
            const nuevoCamino = encontrarCamino(grupo.position, objetivo);

            if (nuevoCamino.length) {
                ruta = nuevoCamino;
                indiceRuta = 0;
            } else {
                objetivo = null;
                ruta = [];
                cambiarEstado(ESTADOS.BUSCANDO);
            }
        }

        return false;
    }

    // =========================================================
    // PRODUCTOS
    // =========================================================

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
            if (!objeto || vistos.has(objeto) || !esProducto(objeto)) return;
            vistos.add(objeto);

            const datos = objeto.userData;

            if (
                datos.reservado ||
                datos.vendido ||
                datos.oculto ||
                datos.enCarrito ||
                !objeto.visible
            ) return;

            const posicion = objeto.getWorldPosition(new THREE.Vector3());

            encontrados.push({
                objeto,
                posicion,
                nombre: datos.nombre ?? objeto.name ?? 'Producto',
                codigo: datos.codigoProducto ??
                    datos.skuProducto ??
                    datos.codigo ??
                    objeto.name
            });
        }

        if (Array.isArray(config.productos)) {
            config.productos.forEach(agregar);
        } else if (config.productos?.isObject3D) {
            config.productos.traverse(agregar);
        } else {
            scene.getObjectByName('PRODUCTOS_SUPERMERCADO')?.traverse(agregar);
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
                distancia: distanciaXZ(grupo.position, registro.posicion)
            }))
            .filter(registro =>
                registro.distancia <= config.distanciaMaximaBusqueda &&
                !reservasProductos.has(registro.objeto)
            )
            .sort((a, b) => a.distancia - b.distancia);

        if (!candidatos.length) return null;

        const cantidad = Math.min(5, candidatos.length);
        const seleccion = candidatos[Math.floor(Math.random() * cantidad)];

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
            x: registro.posicion.x + dx / longitud * config.distanciaFrenteProducto,
            z: registro.posicion.z + dz / longitud * config.distanciaFrenteProducto
        };

        if (!establecerObjetivo(destino, ESTADOS.ACERCANDO)) {
            liberarReserva();
            tiempoReintento = 1;
            cambiarEstado(ESTADOS.ESPERANDO);
        }
    }

    // =========================================================
    // ANIMACIÓN REAL DEL PRODUCTO
    // =========================================================

    const vectorTemporal = new THREE.Vector3();
    const quaternionTemporal = new THREE.Quaternion();

    function obtenerPosicionMano() {
        grupo.updateWorldMatrix(true, true);

        if (rig.manoDerecha) {
            return rig.manoDerecha.getWorldPosition(new THREE.Vector3());
        }

        // Alternativa si el GLB no tiene hueso de mano.
        return grupo.localToWorld(
            new THREE.Vector3(
                0.34,
                config.alturaProductoInspeccion,
                0.20
            )
        );
    }

    function obtenerObjetivoMano() {
        const posicion = obtenerPosicionMano();

        if (rig.manoDerecha) {
            const delante = new THREE.Vector3(0, 0, 0.12);
            rig.manoDerecha.localToWorld(delante);
            return delante;
        }

        return posicion;
    }

    function iniciarMovimientoProducto(objeto, destino, duracion, alTerminar) {
        objeto.updateWorldMatrix(true, false);

        const inicio = objeto.getWorldPosition(new THREE.Vector3());
        const quaternionInicio = objeto.getWorldQuaternion(new THREE.Quaternion());
        const escalaInicio = objeto.getWorldScale(new THREE.Vector3());

        movimientoProducto = {
            objeto,
            inicio,
            destino: typeof destino === 'function' ? null : destino.clone(),
            obtenerDestino: typeof destino === 'function' ? destino : null,
            quaternionInicio,
            escalaInicio,
            duracion: Math.max(0.05, duracion),
            progreso: 0,
            alTerminar
        };

        scene.attach(objeto);
        objeto.position.copy(inicio);
        objeto.quaternion.copy(quaternionInicio);
        objeto.scale.copy(escalaInicio);
    }

    function actualizarMovimientoProducto(delta) {
        if (!movimientoProducto) return;

        const movimiento = movimientoProducto;
        movimiento.progreso = Math.min(
            1,
            movimiento.progreso + delta / movimiento.duracion
        );

        const t = suavizar(movimiento.progreso);

        const destino = movimiento.obtenerDestino
            ? movimiento.obtenerDestino()
            : movimiento.destino;

        const posicion = movimiento.inicio.clone().lerp(destino, t);

        // Pequeño arco vertical para que el objeto no parezca deslizarse
        // por el aire como una caja sobre una cinta transportadora.
        posicion.y += Math.sin(Math.PI * t) * 0.12;

        movimiento.objeto.position.copy(posicion);
        movimiento.objeto.quaternion.copy(
            movimiento.quaternionInicio
        );

        if (movimiento.progreso >= 1) {
            movimientoProducto = null;
            movimiento.alTerminar?.();
        }
    }

    function adjuntarProductoAMano(objeto) {
        if (rig.manoDerecha) {
            rig.manoDerecha.attach(objeto);
            objeto.position.set(0, 0, 0.12);
        } else {
            grupo.attach(objeto);
            objeto.position.set(
                config.distanciaProductoInspeccion,
                config.alturaProductoInspeccion,
                0.22
            );
        }

        objeto.rotation.set(0, 0, 0);
        objeto.scale.multiplyScalar(config.escalaProductoMano);
    }

    function recogerProducto() {
        if (!productoObjetivo) {
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        const objeto = productoObjetivo;
        const padre = objeto.parent;

        if (!padre) {
            liberarReserva();
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        productoOriginal = {
            objeto,
            padre,
            posicion: objeto.position.clone(),
            quaternion: objeto.quaternion.clone(),
            escala: objeto.scale.clone()
        };

        productoEnMano = objeto;

        // El producto viaja desde el estante hasta la mano.
        iniciarMovimientoProducto(
            objeto,
            obtenerObjetivoMano,
            config.tiempoMovimientoProducto,
            () => {
                adjuntarProductoAMano(objeto);
                cambiarEstado(ESTADOS.INSPECCIONANDO);
            }
        );
    }

    function actualizarProductoEnMano() {
        if (!productoEnMano || movimientoProducto) return;

        if (
            estado === ESTADOS.INSPECCIONANDO ||
            estado === ESTADOS.DECIDIENDO
        ) {
            productoEnMano.rotation.y = Math.sin(tiempoEstado * 2.2) * 0.22;
            productoEnMano.rotation.x = Math.sin(tiempoEstado * 1.5) * 0.07;
        }
    }

    function devolverProductoAlEstante() {
        if (!productoEnMano || !productoOriginal) return;

        const registro = productoOriginal;
        const objeto = registro.objeto;

        movimientoProducto = null;

        if (registro.padre) {
            registro.padre.attach(objeto);
            objeto.position.copy(registro.posicion);
            objeto.quaternion.copy(registro.quaternion);
            objeto.scale.copy(registro.escala);
        }

        objeto.userData.reservado = false;
        objeto.userData.enCarrito = false;

        if (reservasProductos.get(objeto) === id) {
            reservasProductos.delete(objeto);
        }

        productoEnMano = null;
        productoOriginal = null;
        productoObjetivo = null;
    }

    function iniciarDevolucionAnimada() {
        if (!productoEnMano || !productoOriginal) {
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        const registro = productoOriginal;
        const objeto = productoEnMano;

        // Guardamos la transformación mundial del estante antes de
        // separar el objeto de la mano.
        const destino = () => {
            registro.padre.updateWorldMatrix(true, false);
            return registro.padre.localToWorld(registro.posicion.clone());
        };

        iniciarMovimientoProducto(
            objeto,
            destino,
            config.tiempoMovimientoProducto,
            () => {
                devolverProductoAlEstante();
                tiempoReintento = config.tiempoEntreProductos;
                cambiarEstado(ESTADOS.ESPERANDO);
            }
        );
    }

    // =========================================================
    // COMPRA Y CARRITO
    // =========================================================

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

        config.alComprar?.({
            cliente: api,
            producto: objeto,
            compra
        });
    }

    function guardarProductoEnCarrito() {
        if (!productoEnMano) {
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        const objeto = productoEnMano;
        const carrito = config.carrito;

        if (!carrito || typeof carrito.agregarProducto !== 'function') {
            console.warn(`Cliente ${id}: no tiene un carrito asignado.`);
            devolverProductoAlEstante();
            tiempoReintento = 1;
            cambiarEstado(ESTADOS.ESPERANDO);
            return;
        }

        if (typeof carrito.obtenerPuntoDeposito !== 'function') {
            console.warn(
                `Cliente ${id}: el carrito no ofrece obtenerPuntoDeposito().`
            );
            devolverProductoAlEstante();
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        const puntoDeposito = carrito.obtenerPuntoDeposito();

        if (!puntoDeposito?.isVector3) {
            devolverProductoAlEstante();
            cambiarEstado(ESTADOS.BUSCANDO);
            return;
        }

        // El objeto se separa de la mano y viaja hacia la cesta.
        iniciarMovimientoProducto(
            objeto,
            () => {
                carrito.grupo.updateWorldMatrix(true, true);
                return carrito.obtenerPuntoDeposito();
            },
            config.tiempoDepositoProducto,
            () => {
                const agregado = carrito.agregarProducto(objeto);

                if (!agregado) {
                    devolverProductoAlEstante();
                    cambiarEstado(ESTADOS.BUSCANDO);
                    return;
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

                tiempoReintento = config.tiempoEntreProductos;
                cambiarEstado(ESTADOS.ESPERANDO);
            }
        );
    }

    // =========================================================
    // RECORRIDO POR EL SUPERMERCADO
    // =========================================================

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

    let indiceRecorrido = Math.floor(Math.random() * puntosRecorrido.length);

    function siguientePuntoRecorrido() {
        for (let i = 0; i < puntosRecorrido.length; i++) {
            const indice = (indiceRecorrido + i) % puntosRecorrido.length;
            const candidato = puntosRecorrido[indice];

            if (
                puntoLibre(candidato.x, candidato.z) &&
                distanciaXZ(grupo.position, candidato) > 2
            ) {
                indiceRecorrido = (indice + 1) % puntosRecorrido.length;
                return candidato;
            }
        }

        return { x: 0, z: 10 };
    }

    function iniciarPaseo() {
        if (!establecerObjetivo(siguientePuntoRecorrido(), ESTADOS.RUTA)) {
            cambiarEstado(ESTADOS.BUSCANDO);
        }
    }

    // =========================================================
    // CAJA Y PAGO
    // =========================================================

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
        config.alPagar?.({
            cliente: api,
            productos: compras,
            totalProductos: compras.length
        });

        compras.forEach(compra => {
            if (compra.objeto) {
                compra.objeto.userData.vendido = true;
                compra.objeto.userData.enCarrito = false;
            }
        });

        cambiarEstado(ESTADOS.PAGANDO);
    }

    // =========================================================
    // VEHÍCULOS
    // =========================================================

    function iniciarDesdeVehiculo(posicionEntrada, plaza) {
        if (!posicionEntrada || !plaza) {
            console.warn('Se necesitan posicionEntrada y plaza.');
            return false;
        }

        liberarReserva();

        if (productoEnMano) devolverProductoAlEstante();

        compras = [];
        entradaNotificada = false;

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

        if (productoEnMano) devolverProductoAlEstante();

        const destino = { x: plaza.x, z: plaza.z };
        const camino = encontrarCamino(grupo.position, destino);

        if (!camino.length) {
            console.warn('No se encontró una ruta de regreso al vehículo.');
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

        config.alFinalizar?.(api);
    }

    // =========================================================
    // ENTRADA
    // =========================================================

    function notificarEntrada() {
        if (entradaNotificada) return;

        entradaNotificada = true;

        console.log(`Cliente ${id}: entró al supermercado.`);

        config.alEntrar?.({
            cliente: api,
            posicion: grupo.position.clone(),
            id
        });

        cambiarEstado(ESTADOS.BUSCANDO);
    }

    // =========================================================
    // ACTUALIZACIÓN
    // =========================================================

    function actualizar(delta) {
        if (eliminado || detenido) return;

        delta = limitar(numero(delta, 0), 0, 0.05);
        tiempoEstado += delta;

        actualizarMovimientoProducto(delta);
        actualizarAnimacion(delta);
        actualizarProductoEnMano();

        const estadosMovimiento = [
            ESTADOS.RUTA,
            ESTADOS.ENTRANDO,
            ESTADOS.ACERCANDO,
            ESTADOS.REGRESANDO,
            ESTADOS.CAJA
        ];

        if (estadosMovimiento.includes(estado) && objetivo !== null) {
            const estadoMovimiento = estado;
            const llego = moverHaciaDestino(delta);

            if (llego) {
                switch (estadoMovimiento) {
                    case ESTADOS.ENTRANDO:
                        notificarEntrada();
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
                if (!productoEnMano) {
                    recogerProducto();
                }
                break;

            case ESTADOS.INSPECCIONANDO:
                if (tiempoEstado >= config.tiempoInspeccionar) {
                    decisionCompra = Math.random() < config.probabilidadCompra;
                    cambiarEstado(ESTADOS.DECIDIENDO);
                }
                break;

            case ESTADOS.DECIDIENDO:
                if (tiempoEstado >= 0.8) {
                    cambiarEstado(
                        decisionCompra
                            ? ESTADOS.GUARDANDO
                            : ESTADOS.DEVOLVIENDO
                    );
                }
                break;

            case ESTADOS.GUARDANDO:
                if (!movimientoProducto) {
                    guardarProductoEnCarrito();
                }
                break;

            case ESTADOS.DEVOLVIENDO:
                if (!movimientoProducto) {
                    iniciarDevolucionAnimada();
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
                        config.alFinalizar?.(api);
                    }
                }
                break;

            case ESTADOS.FINALIZADO:
                break;
        }
    }

    // =========================================================
    // API PÚBLICA
    // =========================================================

    function establecerRuta(nuevaRuta) {
        if (!Array.isArray(nuevaRuta) || !nuevaRuta.length) return false;

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

        if (opcionesCompras.posicionCaja) {
            config.posicionCaja = {
                ...config.posicionCaja,
                ...opcionesCompras.posicionCaja
            };
        }

        actualizarColisiones();
    }

    function detenerAnimacion() {
        detenido = true;
        accionCaminar?.fadeOut(0.2);
    }

    function reproducirAnimacion() {
        detenido = false;
    }

    function eliminar() {
        if (eliminado) return;

        liberarReserva();

        movimientoProducto = null;

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

        obtenerObjetivo: () => objetivo ? { ...objetivo } : null,

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
