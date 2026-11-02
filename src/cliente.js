
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

    probabilidadCompra: 0.85,
    distanciaProducto: 1.35,
    distanciaFrenteProducto: 1.25,

    tiempoRecoger: 0.8,
    tiempoInspeccionar: 2.5,
    tiempoGuardar: 1.1,
    tiempoDevolver: 1.1,
    tiempoEntreProductos: 0.8,
    tiempoReintento: 1.5,

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
    let tiempoReintento = 0;
    let intentosMovimiento = 0;

    let productoObjetivo = null;
    let productoEnMano = null;
    let productoOriginal = null;

    let compras = [];

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

    // ========================================================
    // ESQUELETO
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

            if (
                patrones.some(patron =>
                    nombre.includes(patron)
                )
            ) {
                return hueso;
            }
        }

        return null;
    }

    function actualizarRig() {

        rig.cadera = buscarHueso('hips', 'pelvis');

        rig.torso = buscarHueso(
            'spine',
            'spine1',
            'chest'
        );

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

    function aplicarRotacion(hueso, eje, angulo) {

        if (!hueso) return;

        const base = huesosBase.get(hueso);

        if (!base) return;

        hueso.quaternion.copy(base.quaternion);

        hueso.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(
                eje,
                angulo
            )
        );
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

    function animarCaminarProcedural(delta) {

        faseAnimacion += delta * 8;

        const paso = Math.sin(faseAnimacion) * 0.24;

        aplicarRotacion(
            rig.piernaIzquierda,
            EJE_X,
            paso
        );

        aplicarRotacion(
            rig.piernaDerecha,
            EJE_X,
            -paso
        );

        aplicarRotacion(
            rig.pantorrillaIzquierda,
            EJE_X,
            Math.max(0, -paso) * 0.4
        );

        aplicarRotacion(
            rig.pantorrillaDerecha,
            EJE_X,
            Math.max(0, paso) * 0.4
        );

        aplicarRotacion(
            rig.brazoIzquierdo,
            EJE_X,
            -paso * 0.65
        );

        aplicarRotacion(
            rig.brazoDerecho,
            EJE_X,
            paso * 0.65
        );

        restaurarHueso(rig.torso);
        restaurarHueso(rig.cadera);
    }

    function animarReposoProcedural() {

        Object.values(rig).forEach(hueso => {
            restaurarHueso(hueso);
        });
    }

    function animarRecogerProcedural() {

        const t = Math.sin(tiempoEstado * 4) * 0.12;

        aplicarRotacion(
            rig.brazoDerecho,
            EJE_X,
            -0.85 + t
        );

        aplicarRotacion(
            rig.antebrazoDerecho,
            EJE_X,
            -0.55
        );

        aplicarRotacion(
            rig.brazoIzquierdo,
            EJE_X,
            -0.25
        );

        aplicarRotacion(
            rig.antebrazoIzquierdo,
            EJE_X,
            -0.2
        );

        aplicarRotacion(
            rig.torso,
            EJE_X,
            0.12
        );
    }

    function animarInspeccionarProcedural() {

        const t = Math.sin(tiempoEstado * 2) * 0.04;

        aplicarRotacion(
            rig.brazoDerecho,
            EJE_X,
            -1.1 + t
        );

        aplicarRotacion(
            rig.antebrazoDerecho,
            EJE_X,
            -0.75
        );

        aplicarRotacion(
            rig.brazoIzquierdo,
            EJE_X,
            -0.65
        );

        aplicarRotacion(
            rig.antebrazoIzquierdo,
            EJE_X,
            -0.5
        );

        aplicarRotacion(
            rig.torso,
            EJE_X,
            0.08
        );
    }

    function animarGuardarProcedural() {

        const t = Math.sin(tiempoEstado * 5) * 0.08;

        aplicarRotacion(
            rig.brazoDerecho,
            EJE_X,
            -0.75 + t
        );

        aplicarRotacion(
            rig.antebrazoDerecho,
            EJE_X,
            -0.8
        );

        aplicarRotacion(
            rig.brazoIzquierdo,
            EJE_X,
            -0.45
        );

        aplicarRotacion(
            rig.antebrazoIzquierdo,
            EJE_X,
            -0.55
        );
    }

    function animarPagarProcedural() {

        const t = Math.sin(tiempoEstado * 3) * 0.08;

        aplicarRotacion(
            rig.brazoDerecho,
            EJE_X,
            -0.9 + t
        );

        aplicarRotacion(
            rig.antebrazoDerecho,
            EJE_X,
            -0.6
        );

        aplicarRotacion(
            rig.brazoIzquierdo,
            EJE_X,
            -0.7
        );

        aplicarRotacion(
            rig.antebrazoIzquierdo,
            EJE_X,
            -0.4
        );
    }

    // ========================================================
    // CARGA DEL MODELO
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

                        accionCaminar.play();
                        accionCaminar.paused = true;
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
    // CAMBIO DE ESTADO
    // ========================================================

    function cambiarEstado(nuevoEstado) {

        if (estado === nuevoEstado) return;

        const anterior = estado;

        estado = nuevoEstado;

        tiempoEstado = 0;

        intentosMovimiento = 0;

        const caminando = [
            ESTADOS.ENTRANDO,
            ESTADOS.ACERCANDO,
            ESTADOS.RUTA,
            ESTADOS.CAJA,
            ESTADOS.REGRESANDO
        ].includes(estado);

        if (accionCaminar) {

            accionCaminar.paused = !caminando;

            if (caminando) {
                accionCaminar.reset().play();
            }
        }

        if (accionReposo) {

            if (caminando) {
                accionReposo.fadeOut(0.15);
            } else {
                accionReposo.reset().fadeIn(0.15).play();
            }
        }

        if (!caminando) {
            restaurarPoseCompleta();
        }

        try {

            config.alCambiarEstado?.({
                cliente: api,
                anterior,
                estado: nuevoEstado
            });

        } catch (error) {

            console.error(
                `[CLIENTE ${id}] Error cambiando estado:`,
                error
            );

        }
    }

    // ========================================================
    // COLISIONES
    // ========================================================

    let obstaculosCache = [];

    let tiempoActualizarObstaculos = 0;

    function obtenerObstaculos() {

        const obstaculos = [];

        if (Array.isArray(config.colisiones)) {

            for (const colision of config.colisiones) {

                if (!colision) continue;

                obstaculos.push({

                    x: numero(colision.x),

                    z: numero(colision.z),

                    ancho: numero(
                        colision.ancho,
                        colision.width ?? 1
                    ),

                    profundidad: numero(
                        colision.profundidad,
                        colision.depth ?? 1
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
                ) {
                    return;
                }

                const caja = new THREE.Box3().setFromObject(obj);

                if (caja.isEmpty()) return;

                const centro = new THREE.Vector3();
                const tamano = new THREE.Vector3();

                caja.getCenter(centro);
                caja.getSize(tamano);

                if (tamano.y > 3.5) return;

                if (tamano.x < 0.08 || tamano.z < 0.08) {
                    return;
                }

                obstaculos.push({

                    x: centro.x,
                    z: centro.z,

                    ancho: tamano.x,
                    profundidad: tamano.z

                });

            });
        }

        return obstaculos;
    }

    function actualizarColisiones() {

        obstaculosCache = obtenerObstaculos();

        tiempoActualizarObstaculos = 0;
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
            config.radioColision +
            config.margenObstaculos;

        for (const obstaculo of obstaculosCache) {

            const mitadX =
                obstaculo.ancho / 2 + margen;

            const mitadZ =
                obstaculo.profundidad / 2 + margen;

            if (
                Math.abs(x - obstaculo.x) < mitadX &&
                Math.abs(z - obstaculo.z) < mitadZ
            ) {
                return false;
            }
        }

        return true;
    }

    function segmentoLibre(a, b) {

        const distancia = distanciaXZ(a, b);

        const pasos = Math.max(
            1,
            Math.ceil(distancia / 0.25)
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
    // BUSQUEDA A*
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

        // Si el destino está dentro de un obstáculo,
        // buscar un punto cercano libre.
        if (!puntoLibre(fin.x, fin.z)) {

            let mejor = null;
            let mejorDistancia = Infinity;

            for (let radio = 0.4; radio <= 2.8; radio += 0.4) {

                for (let angulo = 0; angulo < Math.PI * 2; angulo += Math.PI / 4) {

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

        const abiertos = [{

            x: aX,
            z: aZ,

            g: 0,

            h: Math.hypot(
                bX - aX,
                bZ - aZ
            ),

            padre: null

        }];

        const abiertosMapa = new Map([
            [inicioClave, abiertos[0]]
        ]);

        const cerrados = new Set();

        const direcciones = [

            [1, 0, 1],
            [-1, 0, 1],
            [0, 1, 1],
            [0, -1, 1],

            [1, 1, 1.414],
            [1, -1, 1.414],
            [-1, 1, 1.414],
            [-1, -1, 1.414]

        ];

        let encontrado = null;

        let iteraciones = 0;

        const maxIteraciones = 12000;

        while (
            abiertos.length &&
            iteraciones < maxIteraciones
        ) {

            iteraciones++;

            abiertos.sort((a, b) =>
                (a.g + a.h) - (b.g + b.h)
            );

            const actual = abiertos.shift();

            const actualClave = claveCelda(
                actual.x,
                actual.z
            );

            abiertosMapa.delete(actualClave);

            if (actualClave === finClave) {

                encontrado = actual;

                break;
            }

            if (cerrados.has(actualClave)) continue;

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
                    ) {
                        continue;
                    }
                }

                const nuevoG = actual.g + costo;

                const existente = abiertosMapa.get(vecinoClave);

                if (existente && nuevoG >= existente.g) {
                    continue;
                }

                const vecino = {

                    x: nx,
                    z: nz,

                    g: nuevoG,

                    h: Math.hypot(
                        bX - nx,
                        bZ - nz
                    ),

                    padre: actual

                };

                abiertos.push(vecino);

                abiertosMapa.set(
                    vecinoClave,
                    vecino
                );
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

        // Suavizar ruta sin atravesar obstáculos.
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

                if (
                    segmentoLibre(
                        puntoActual,
                        camino[j]
                    )
                ) {
                    siguiente = j;
                    break;
                }
            }

            suavizado.push(camino[siguiente]);

            puntoActual = camino[siguiente];

            indice = siguiente + 1;
        }

        return suavizado;
    }

    // ========================================================
    // MOVIMIENTO
    // ========================================================

    function orientarHacia(dx, dz) {

        if (Math.abs(dx) + Math.abs(dz) < 0.0001) {
            return;
        }

        grupo.rotation.y =
            Math.atan2(dx, dz) +
            config.correccionRotacion;
    }

    function establecerObjetivo(destino, nuevoEstado = ESTADOS.RUTA) {

        if (!destino) return false;

        const punto = {

            x: limitar(
                numero(destino.x, grupo.position.x),
                -config.limiteX,
                config.limiteX
            ),

            z: limitar(
                numero(destino.z, grupo.position.z),
                config.limiteZMin,
                config.limiteZMax
            )

        };

        const camino = encontrarCamino(
            grupo.position,
            punto
        );

        if (!camino.length) {
            return false;
        }

        ruta = camino;

        indiceRuta = 0;

        objetivo = camino[camino.length - 1];

        cambiarEstado(nuevoEstado);

        return true;
    }

    function recuperarMovimiento() {

        if (!objetivo) return false;

        intentosMovimiento++;

        const nuevoCamino = encontrarCamino(
            grupo.position,
            objetivo
        );

        if (nuevoCamino.length) {

            ruta = nuevoCamino;

            indiceRuta = 0;

            return true;
        }

        return false;
    }

    function moverHaciaDestino(delta) {

        if (!ruta.length || indiceRuta >= ruta.length) {
            return true;
        }

        const destino = ruta[indiceRuta];

        const dx = destino.x - grupo.position.x;

        const dz = destino.z - grupo.position.z;

        const distancia = Math.hypot(dx, dz);

        if (distancia < 0.16) {

            grupo.position.x = destino.x;

            grupo.position.z = destino.z;

            indiceRuta++;

            if (indiceRuta >= ruta.length) {

                ruta = [];

                objetivo = null;

                return true;
            }

            return false;
        }

        let velocidad = config.velocidad;

        if (estado === ESTADOS.ENTRANDO) {
            velocidad = config.velocidadEntrada;
        }

        if (estado === ESTADOS.REGRESANDO) {
            velocidad = config.velocidadRegreso;
        }

        const direccionX = dx / distancia;

        const direccionZ = dz / distancia;

        orientarHacia(direccionX, direccionZ);

        const avance = Math.min(
            distancia,
            velocidad * delta
        );

        const nuevoX =
            grupo.position.x +
            direccionX * avance;

        const nuevoZ =
            grupo.position.z +
            direccionZ * avance;

        if (
            !segmentoLibre(
                grupo.position,
                { x: nuevoX, z: nuevoZ }
            )
        ) {

            if (recuperarMovimiento()) {
                return false;
            }

            // Evitar que el cliente se quede congelado.
            if (intentosMovimiento >= 3) {

                console.warn(
                    `[CLIENTE ${id}] No pudo continuar su ruta.`
                );

                ruta = [];

                objetivo = null;

                if (estado === ESTADOS.REGRESANDO) {

                    cambiarEstado(ESTADOS.ESPERANDO);

                } else {

                    cambiarEstado(ESTADOS.BUSCANDO);

                }

                tiempoReintento = 0;

            }

            return false;
        }

        grupo.position.x = nuevoX;

        grupo.position.z = nuevoZ;

        animarCaminarProcedural(delta);

        return false;
    }

    function establecerRuta(puntos, repetir = false) {

        if (!Array.isArray(puntos) || !puntos.length) {
            return false;
        }

        const camino = [];

        let actual = {

            x: grupo.position.x,
            z: grupo.position.z

        };

        for (const punto of puntos) {

            const segmento = encontrarCamino(
                actual,
                punto
            );

            if (!segmento.length) continue;

            camino.push(...segmento);

            actual = segmento[segmento.length - 1];
        }

        if (!camino.length) return false;

        ruta = camino;

        indiceRuta = 0;

        objetivo = camino[camino.length - 1];

        config.repetirRuta = repetir;

        cambiarEstado(ESTADOS.RUTA);

        return true;
    }

    function establecerPosicion(posicion) {

        if (!posicion) return false;

        grupo.position.set(

            numero(posicion.x, grupo.position.x),

            numero(posicion.y, 0),

            numero(posicion.z, grupo.position.z)

        );

        ruta = [];

        objetivo = null;

        return true;
    }

    // ========================================================
    // PRODUCTOS
    // ========================================================

    function obtenerProductos() {

        if (Array.isArray(config.productos)) {
            return config.productos;
        }

        if (config.productos?.children) {
            return config.productos.children;
        }

        if (config.productos?.traverse) {

            const encontrados = [];

            config.productos.traverse(obj => {

                if (
                    obj.isMesh &&
                    obj.userData?.esProducto
                ) {
                    encontrados.push(obj);
                }

            });

            return encontrados;
        }

        return [];
    }

    function productoDisponible(producto) {

        if (!producto) return false;

        if (!producto.visible) return false;

        if (producto.userData?.vendido) return false;

        if (producto.userData?.enCarrito) return false;

        if (producto.userData?.reservado) return false;

        if (reservasProductos.has(producto)) return false;

        return true;
    }

    function reservarProducto(producto) {

        if (!productoDisponible(producto)) {
            return false;
        }

        reservasProductos.set(producto, id);

        producto.userData.reservado = true;

        producto.userData.reservadoPor = id;

        productoObjetivo = producto;

        return true;
    }

    function liberarReserva() {

        if (!productoObjetivo) return;

        if (reservasProductos.get(productoObjetivo) === id) {

            reservasProductos.delete(productoObjetivo);

            productoObjetivo.userData.reservado = false;

            delete productoObjetivo.userData.reservadoPor;
        }

        productoObjetivo = null;
    }

    function buscarProducto() {

        const productos = obtenerProductos();

        let mejor = null;

        let mejorDistancia = Infinity;

        for (const producto of productos) {

            if (!productoDisponible(producto)) continue;

            const posicion = new THREE.Vector3();

            producto.getWorldPosition(posicion);

            const distancia = distanciaXZ(
                grupo.position,
                posicion
            );

            if (
                distancia >
                config.distanciaMaximaBusqueda
            ) {
                continue;
            }

            if (distancia < mejorDistancia) {

                mejorDistancia = distancia;

                mejor = producto;
            }
        }

        return mejor;
    }

    function obtenerPuntoFrenteProducto(producto) {

        const posicion = new THREE.Vector3();

        producto.getWorldPosition(posicion);

        // El cliente se coloca frente al producto,
        // no dentro del estante.
        const direccion = new THREE.Vector3()
            .subVectors(grupo.position, posicion);

        direccion.y = 0;

        if (direccion.lengthSq() < 0.0001) {

            direccion.set(0, 0, 1);
        }

        direccion.normalize();

        const destino = {

            x: posicion.x +
                direccion.x *
                config.distanciaFrenteProducto,

            z: posicion.z +
                direccion.z *
                config.distanciaFrenteProducto

        };

        if (!puntoLibre(destino.x, destino.z)) {

            for (
                let distancia = 1.5;
                distancia <= 3.5;
                distancia += 0.35
            ) {

                const candidato = {

                    x: posicion.x + direccion.x * distancia,

                    z: posicion.z + direccion.z * distancia

                };

                if (
                    puntoLibre(
                        candidato.x,
                        candidato.z
                    )
                ) {
                    return candidato;
                }
            }
        }

        return destino;
    }

    function acercarseAProducto(producto) {

        if (!reservarProducto(producto)) {
            return false;
        }

        const destino = obtenerPuntoFrenteProducto(
            producto
        );

        if (
            !establecerObjetivo(
                destino,
                ESTADOS.ACERCANDO
            )
        ) {

            liberarReserva();

            return false;
        }

        return true;
    }

    // ========================================================
    // TOMAR PRODUCTO
    // ========================================================

    function tomarProducto() {

        if (
            !productoObjetivo ||
            !productoDisponible(productoObjetivo)
        ) {

            liberarReserva();

            cambiarEstado(ESTADOS.BUSCANDO);

            return;
        }

        productoOriginal = {

            parent: productoObjetivo.parent,

            posicion: productoObjetivo.position.clone(),

            quaternion: productoObjetivo.quaternion.clone(),

            escala: productoObjetivo.scale.clone()

        };

        productoEnMano = productoObjetivo;

        const mano =
            rig.manoDerecha ??
            rig.brazoDerecho;

        if (mano) {

            grupo.updateMatrixWorld(true);

            mano.updateMatrixWorld(true);

            const posicionMundo = new THREE.Vector3();

            mano.getWorldPosition(posicionMundo);

            productoEnMano.parent?.remove(productoEnMano);

            grupo.add(productoEnMano);

            productoEnMano.position.copy(
                grupo.worldToLocal(posicionMundo)
            );

            productoEnMano.position.y += 0.1;

            productoEnMano.scale.multiplyScalar(
                config.escalaProductoMano
            );

        }

        cambiarEstado(ESTADOS.INSPECCIONANDO);
    }

    // ========================================================
    // DEVOLVER PRODUCTO
    // ========================================================

    function devolverProductoAlEstante() {

        if (!productoEnMano || !productoOriginal) {

            productoEnMano = null;

            productoOriginal = null;

            liberarReserva();

            return;
        }

        grupo.remove(productoEnMano);

        if (productoOriginal.parent) {

            productoOriginal.parent.add(productoEnMano);

        }

        productoEnMano.position.copy(
            productoOriginal.posicion
        );

        productoEnMano.quaternion.copy(
            productoOriginal.quaternion
        );

        productoEnMano.scale.copy(
            productoOriginal.escala
        );

        productoEnMano.visible = true;

        productoEnMano = null;

        productoOriginal = null;

        liberarReserva();
    }

    // ========================================================
    // GUARDAR PRODUCTO
    // ========================================================

    function guardarProducto() {

        if (!productoEnMano) {

            liberarReserva();

            cambiarEstado(ESTADOS.BUSCANDO);

            return;
        }

        const producto = productoEnMano;

        const datos = producto.userData ?? {};

        const compra = {

            objeto: producto,

            nombre:
                datos.nombre ??
                producto.name ??
                'Producto',

            codigo:
                datos.codigo ??
                '',

            precio:
                numero(datos.precio, 0)

        };

        // Registrar primero la compra.
        compras.push(compra);

        // Intentar agregar al carrito sin bloquear el NPC.
        try {

            if (config.carrito?.agregarProducto) {

                config.carrito.agregarProducto(producto);

            } else if (config.carrito?.agregar) {

                config.carrito.agregar(producto);

            }

        } catch (error) {

            console.error(
                `[CLIENTE ${id}] Error al agregar al carrito:`,
                error
            );

        }

        producto.userData.enCarrito = true;

        // El producto ya no debe permanecer en el rack.
        if (producto.parent) {
            producto.parent.remove(producto);
        }

        productoEnMano = null;

        productoOriginal = null;

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
            `[CLIENTE ${id}] Compra registrada: ${compra.nombre}`
        );

        // Regresar a buscar otro producto.
        cambiarEstado(ESTADOS.BUSCANDO);
    }

    // ========================================================
    // DECIDIR COMPRA
    // ========================================================

    function decidirCompra() {

        if (compras.length >= config.maximoProductos) {

            dirigirseACaja();

            return;
        }

        decisionCompra =
            Math.random() <
            config.probabilidadCompra;

        if (!decisionCompra) {

            cambiarEstado(ESTADOS.BUSCANDO);

            return;
        }

        const producto = buscarProducto();

        if (!producto) {

            cambiarEstado(ESTADOS.ESPERANDO);

            return;
        }

        if (!acercarseAProducto(producto)) {

            liberarReserva();

            cambiarEstado(ESTADOS.ESPERANDO);
        }
    }

    // ========================================================
    // RUTAS DE RECORRIDO
    // ========================================================

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
                distanciaXZ(
                    grupo.position,
                    candidato
                ) > 2
            ) {

                indiceRecorrido =
                    (indice + 1) %
                    puntosRecorrido.length;

                return candidato;
            }
        }

        return {
            x: 0,
            z: 10
        };
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

    // ========================================================
    // CAJA Y PAGO
    // ========================================================

    function dirigirseACaja(
        posicionCaja = config.posicionCaja,
        callback = null
    ) {

        const destino = {

            x: numero(
                posicionCaja?.x,
                config.posicionCaja.x
            ),

            z: numero(
                posicionCaja?.z,
                config.posicionCaja.z
            )

        };

        callbackPagoPendiente =
            typeof callback === 'function'
                ? callback
                : null;

        if (
            !establecerObjetivo(
                destino,
                ESTADOS.CAJA
            )
        ) {

            callbackPagoPendiente = null;

            console.warn(
                `[CLIENTE ${id}] No se pudo encontrar la caja.`
            );

            return false;
        }

        return true;
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

                precio:
                    numero(
                        compra.precio,
                        numero(datos.precio, 0)
                    ),

                cantidad: 1

            };
        });

        const total = articulos.reduce(
            (suma, articulo) =>
                suma +
                articulo.precio *
                articulo.cantidad,
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
                `[CLIENTE ${id}] Error en alPagar:`,
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

    // ========================================================
    // VEHÍCULOS
    // ========================================================

    function iniciarDesdeVehiculo(posicionEntrada, plaza) {

        if (!posicionEntrada || !plaza) {

            console.warn(
                `[CLIENTE ${id}] Faltan datos del vehículo.`
            );

            return false;
        }

        liberarReserva();

        if (productoEnMano) {
            devolverProductoAlEstante();
        }

        compras = [];

        callbackPagoPendiente = null;

        ticketPendiente = null;

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

        if (productoEnMano) {
            devolverProductoAlEstante();
        }

        const destino = {

            x: numero(plaza.x),

            z: numero(plaza.z)

        };

        const camino = encontrarCamino(
            grupo.position,
            destino
        );

        if (!camino.length) {

            console.warn(
                `[CLIENTE ${id}] No hay ruta de regreso al vehículo.`
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

        return true;
    }

    function finalizarRegreso() {

        cambiarEstado(ESTADOS.FINALIZADO);

        if (callbackRegreso) {

            const callback = callbackRegreso;

            callbackRegreso = null;

            try {

                callback(api);

            } catch (error) {

                console.error(
                    `[CLIENTE ${id}] Error al finalizar regreso:`,
                    error
                );

            }
        }

        config.alFinalizar?.(api);
    }

    // ========================================================
    // ENTRADA AL SUPERMERCADO
    // ========================================================

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

            console.error(
                `[CLIENTE ${id}] Error al entrar:`,
                error
            );

        }

        cambiarEstado(ESTADOS.BUSCANDO);
    }

    // ========================================================
    // ACTUALIZACIÓN PRINCIPAL
    // ========================================================

    function actualizar(delta) {

        if (eliminado || detenido) return;

        delta = limitar(
            numero(delta, 0),
            0,
            0.05
        );

        tiempoEstado += delta;

        tiempoActualizarObstaculos += delta;

        if (tiempoActualizarObstaculos >= 2) {
            actualizarColisiones();
        }

        if (mixer) {
            mixer.update(delta);
        }

        if (accionCaminar && accionCaminar.isRunning()) {

            accionCaminar.paused = ![

                ESTADOS.ENTRANDO,
                ESTADOS.ACERCANDO,
                ESTADOS.RUTA,
                ESTADOS.CAJA,
                ESTADOS.REGRESANDO

            ].includes(estado);
        }

        switch (estado) {

            // ------------------------------------------------
            // INACTIVO
            // ------------------------------------------------

            case ESTADOS.INACTIVO:

                break;

            // ------------------------------------------------
            // MOVIMIENTO
            // ------------------------------------------------

            case ESTADOS.ENTRANDO:
            case ESTADOS.ACERCANDO:
            case ESTADOS.RUTA:
            case ESTADOS.CAJA:
            case ESTADOS.REGRESANDO: {

                const terminado = moverHaciaDestino(delta);

                if (!terminado) break;

                if (estado === ESTADOS.ENTRANDO) {

                    notificarEntrada();

                } else if (estado === ESTADOS.ACERCANDO) {

                    cambiarEstado(ESTADOS.RECOGIENDO);

                } else if (estado === ESTADOS.RUTA) {

                    if (
                        compras.length >=
                        config.maximoProductos
                    ) {

                        dirigirseACaja();

                    } else {

                        cambiarEstado(ESTADOS.BUSCANDO);

                    }

                } else if (estado === ESTADOS.CAJA) {

                    completarPago();

                } else if (estado === ESTADOS.REGRESANDO) {

                    finalizarRegreso();

                }

                break;
            }

            // ------------------------------------------------
            // BUSCAR PRODUCTOS
            // ------------------------------------------------

            case ESTADOS.BUSCANDO: {

                if (
                    tiempoEstado <
                    config.tiempoEntreProductos
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

            // ------------------------------------------------
            // RECOGER
            // ------------------------------------------------

            case ESTADOS.RECOGIENDO: {

                animarRecogerProcedural();

                if (
                    tiempoEstado >=
                    config.tiempoRecoger
                ) {

                    tomarProducto();

                }

                break;
            }

            // ------------------------------------------------
            // EXAMINAR
            // ------------------------------------------------

            case ESTADOS.INSPECCIONANDO: {

                animarInspeccionarProcedural();

                if (
                    tiempoEstado >=
                    config.tiempoInspeccionar
                ) {

                    cambiarEstado(ESTADOS.DECIDIENDO);

                }

                break;
            }

            // ------------------------------------------------
            // DECIDIR
            // ------------------------------------------------

            case ESTADOS.DECIDIENDO: {

                if (tiempoEstado >= 0.5) {

                    decisionCompra =
                        Math.random() <
                        config.probabilidadCompra;

                    if (decisionCompra) {

                        cambiarEstado(ESTADOS.GUARDANDO);

                    } else {

                        cambiarEstado(ESTADOS.DEVOLVIENDO);

                    }
                }

                break;
            }

            // ------------------------------------------------
            // GUARDAR
            // ------------------------------------------------

            case ESTADOS.GUARDANDO: {

                animarGuardarProcedural();

                if (
                    tiempoEstado >=
                    config.tiempoGuardar
                ) {

                    guardarProducto();

                    // guardarProducto ya cambia el estado.
                    // No se debe continuar ejecutando este estado.

                }

                break;
            }

            // ------------------------------------------------
            // DEVOLVER
            // ------------------------------------------------

            case ESTADOS.DEVOLVIENDO: {

                animarGuardarProcedural();

                if (
                    tiempoEstado >=
                    config.tiempoDevolver
                ) {

                    devolverProductoAlEstante();

                    cambiarEstado(ESTADOS.BUSCANDO);

                }

                break;
            }

            // ------------------------------------------------
            // ESPERAR / REINTENTAR
            // ------------------------------------------------

            case ESTADOS.ESPERANDO: {

                if (
                    tiempoEstado >=
                    config.tiempoReintento
                ) {

                    if (
                        compras.length >=
                        config.maximoProductos
                    ) {

                        dirigirseACaja();

                    } else {

                        cambiarEstado(ESTADOS.BUSCANDO);

                    }
                }

                break;
            }

            // ------------------------------------------------
            // PAGAR
            // ------------------------------------------------

            case ESTADOS.PAGANDO: {

                animarPagarProcedural();

                if (tiempoEstado >= 2.5) {

                    const ticket = ticketPendiente;

                    ticketPendiente = null;

                    if (config.repetirRuta) {

                        compras = [];

                        cambiarEstado(ESTADOS.BUSCANDO);

                    } else {

                        cambiarEstado(ESTADOS.FINALIZADO);

                        if (
                            typeof callbackPagoPendiente ===
                            'function'
                        ) {

                            const callback =
                                callbackPagoPendiente;

                            callbackPagoPendiente = null;

                            try {

                                callback(ticket);

                            } catch (error) {

                                console.error(
                                    `[CLIENTE ${id}] Error en callback de pago:`,
                                    error
                                );

                            }
                        }

                        config.alFinalizar?.(api);
                    }
                }

                break;
            }

            // ------------------------------------------------
            // FINALIZADO
            // ------------------------------------------------

            case ESTADOS.FINALIZADO:

                break;
        }
    }

    // ========================================================
    // CONFIGURAR COMPRAS
    // ========================================================

    function configurarCompras(opcionesCompras = {}) {

        if (
            typeof opcionesCompras.probabilidadCompra ===
            'number'
        ) {

            config.probabilidadCompra = limitar(
                opcionesCompras.probabilidadCompra,
                0,
                1
            );
        }

        if (
            typeof opcionesCompras.maximoProductos ===
            'number'
        ) {

            config.maximoProductos = Math.max(
                1,
                Math.floor(
                    opcionesCompras.maximoProductos
                )
            );
        }

        if (
            typeof opcionesCompras.tiempoEntreProductos ===
            'number'
        ) {

            config.tiempoEntreProductos = Math.max(
                0,
                opcionesCompras.tiempoEntreProductos
            );
        }

        if (opcionesCompras.productos) {
            config.productos = opcionesCompras.productos;
        }

        if (opcionesCompras.carrito) {
            config.carrito = opcionesCompras.carrito;
        }

        if (opcionesCompras.mobiliario) {

            config.mobiliario =
                opcionesCompras.mobiliario;

            actualizarColisiones();
        }

        if (opcionesCompras.colisiones) {

            config.colisiones =
                opcionesCompras.colisiones;

            actualizarColisiones();
        }
    }

    // ========================================================
    // ANIMACIÓN
    // ========================================================

    function detenerAnimacion() {

        detenido = true;

        accionCaminar?.fadeOut(0.2);
    }

    function reproducirAnimacion() {

        detenido = false;
    }

    // ========================================================
    // ELIMINAR
    // ========================================================

    function eliminar() {

        if (eliminado) return;

        liberarReserva();

        if (productoEnMano) {
            devolverProductoAlEstante();
        }

        callbackPagoPendiente = null;

        callbackRegreso = null;

        ticketPendiente = null;

        mixer?.stopAllAction();

        mixer = null;

        grupo.parent?.remove(grupo);

        eliminado = true;

        detenido = true;
    }

    // ========================================================
    // API PÚBLICA
    // ========================================================

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
