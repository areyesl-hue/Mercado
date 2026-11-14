
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function crearLadron(scene, productos, opciones = {}) {
    if (!scene?.isScene) {
        throw new Error('crearLadron necesita una THREE.Scene.');
    }

    if (!productos) {
        throw new Error('No se recibió el grupo de productos.');
    }

    const CONFIG = {
        id: null,
        modelo: '/modelos/ladron2.glb',
        posicion: { x: 0, y: 0, z: 31 },
        velocidadCaminar: 1.8,
        velocidadHuida: 5.8,
        productosRobados: 2,
        distanciaProducto: 0.85,
        tiempoRobo: 1.3,
        tiempoObservacion: 1.8,
        tiempoAtascado: 4,
        altura: 1.75,
        escala: 1,
        margenColision: 0.35,
        tamanoCelda: 0.5,
        ...opciones
    };

    const id = CONFIG.id ||
        `LADRON_${Math.random().toString(36).slice(2, 9)}`;

    const variacionVelocidad = 0.90 + Math.random() * 0.20;

    const grupo = new THREE.Group();
    grupo.name = id;
    grupo.position.set(
        CONFIG.posicion.x,
        CONFIG.posicion.y,
        CONFIG.posicion.z
    );

    scene.add(grupo);

    const mobiliario =
        CONFIG.mobiliario ??
        scene.getObjectByName('MOBILIARIO_SUPERMERCADO');

    let colisiones = [];

    function actualizarColisiones() {
        const obtener = mobiliario?.userData?.obtenerColisiones;

        if (typeof obtener === 'function') {
            colisiones = obtener() || [];
        } else {
            console.warn(
                `[${id}] No se encontraron las colisiones del mobiliario.`
            );
            colisiones = [];
        }
    }

    actualizarColisiones();

    // =========================================================
    // NAVEGACIÓN
    // =========================================================

    const CELDA = CONFIG.tamanoCelda;
    const RADIO = CONFIG.margenColision;

    const LIM = {
        minX: -30.5,
        maxX: 30.5,
        minZ: -52,
        maxZ: 56
    };

    const ANCHO = Math.round(
        (LIM.maxX - LIM.minX) / CELDA
    ) + 1;

    const ALTO = Math.round(
        (LIM.maxZ - LIM.minZ) / CELDA
    ) + 1;

    function aCelda(x, z) {
        return {
            x: Math.round((x - LIM.minX) / CELDA),
            z: Math.round((z - LIM.minZ) / CELDA)
        };
    }

    function aMundo(cx, cz) {
        return {
            x: LIM.minX + cx * CELDA,
            z: LIM.minZ + cz * CELDA
        };
    }

    function dentro(cx, cz) {
        return (
            cx >= 0 &&
            cx < ANCHO &&
            cz >= 0 &&
            cz < ALTO
        );
    }

    function clave(cx, cz) {
        return cz * ANCHO + cx;
    }

    function bloqueada(cx, cz) {
        if (!dentro(cx, cz)) return true;

        const p = aMundo(cx, cz);

        for (const obstaculo of colisiones) {
            if (
                p.x >= obstaculo.minX - RADIO &&
                p.x <= obstaculo.maxX + RADIO &&
                p.z >= obstaculo.minZ - RADIO &&
                p.z <= obstaculo.maxZ + RADIO
            ) {
                return true;
            }
        }

        return false;
    }

    class ColaPrioridad {
        constructor() {
            this.items = [];
        }

        push(item) {
            const a = this.items;
            a.push(item);

            let i = a.length - 1;

            while (i > 0) {
                const padre = Math.floor((i - 1) / 2);

                if (a[padre].f <= a[i].f) break;

                [a[padre], a[i]] = [a[i], a[padre]];
                i = padre;
            }
        }

        pop() {
            const a = this.items;

            if (!a.length) return null;

            const primero = a[0];
            const ultimo = a.pop();

            if (a.length) {
                a[0] = ultimo;

                let i = 0;

                while (true) {
                    const izq = i * 2 + 1;
                    const der = izq + 1;

                    let menor = i;

                    if (
                        izq < a.length &&
                        a[izq].f < a[menor].f
                    ) {
                        menor = izq;
                    }

                    if (
                        der < a.length &&
                        a[der].f < a[menor].f
                    ) {
                        menor = der;
                    }

                    if (menor === i) break;

                    [a[i], a[menor]] = [a[menor], a[i]];
                    i = menor;
                }
            }

            return primero;
        }

        get length() {
            return this.items.length;
        }
    }

    function heuristica(a, b) {
        const dx = Math.abs(a.x - b.x);
        const dz = Math.abs(a.z - b.z);

        return Math.max(dx, dz) +
            (Math.SQRT2 - 1) * Math.min(dx, dz);
    }

    function encontrarRuta(inicio, destino) {
        const origen = aCelda(inicio.x, inicio.z);
        const final = aCelda(destino.x, destino.z);

        if (!dentro(origen.x, origen.z)) return [];
        if (!dentro(final.x, final.z)) return [];

        if (bloqueada(origen.x, origen.z)) {
            let encontrado = null;

            for (let radio = 1; radio <= 8 && !encontrado; radio++) {
                for (
                    let dz = -radio;
                    dz <= radio && !encontrado;
                    dz++
                ) {
                    for (let dx = -radio; dx <= radio; dx++) {
                        if (
                            Math.max(
                                Math.abs(dx),
                                Math.abs(dz)
                            ) !== radio
                        ) {
                            continue;
                        }

                        const x = origen.x + dx;
                        const z = origen.z + dz;

                        if (
                            dentro(x, z) &&
                            !bloqueada(x, z)
                        ) {
                            encontrado = { x, z };
                            break;
                        }
                    }
                }
            }

            if (!encontrado) return [];

            origen.x = encontrado.x;
            origen.z = encontrado.z;
        }

        if (bloqueada(final.x, final.z)) return [];

        const inicioKey = clave(origen.x, origen.z);
        const finalKey = clave(final.x, final.z);

        const abiertos = new ColaPrioridad();
        const costos = new Map();
        const padres = new Map();
        const cerrados = new Set();

        costos.set(inicioKey, 0);

        abiertos.push({
            x: origen.x,
            z: origen.z,
            key: inicioKey,
            f: heuristica(origen, final)
        });

        const vecinos = [
            [1, 0, 1],
            [-1, 0, 1],
            [0, 1, 1],
            [0, -1, 1],
            [1, 1, Math.SQRT2],
            [1, -1, Math.SQRT2],
            [-1, 1, Math.SQRT2],
            [-1, -1, Math.SQRT2]
        ];

        let visitados = 0;
        const MAX_VISITADOS = 50000;

        while (
            abiertos.length &&
            visitados < MAX_VISITADOS
        ) {
            const actual = abiertos.pop();

            if (!actual || cerrados.has(actual.key)) continue;

            if (actual.key === finalKey) {
                const puntos = [];
                let k = finalKey;

                while (k !== inicioKey) {
                    const z = Math.floor(k / ANCHO);
                    const x = k - z * ANCHO;

                    puntos.push(aMundo(x, z));

                    k = padres.get(k);

                    if (k === undefined) return [];
                }

                puntos.reverse();

                return suavizarRuta([
                    { x: inicio.x, z: inicio.z },
                    ...puntos
                ]);
            }

            cerrados.add(actual.key);
            visitados++;

            for (const [dx, dz, peso] of vecinos) {
                const nx = actual.x + dx;
                const nz = actual.z + dz;

                if (
                    !dentro(nx, nz) ||
                    bloqueada(nx, nz)
                ) {
                    continue;
                }

                if (dx !== 0 && dz !== 0) {
                    if (
                        bloqueada(actual.x + dx, actual.z) ||
                        bloqueada(actual.x, actual.z + dz)
                    ) {
                        continue;
                    }
                }

                const nk = clave(nx, nz);

                if (cerrados.has(nk)) continue;

                const nuevoCosto =
                    costos.get(actual.key) + peso;

                if (
                    nuevoCosto <
                    (costos.get(nk) ?? Infinity)
                ) {
                    costos.set(nk, nuevoCosto);
                    padres.set(nk, actual.key);

                    abiertos.push({
                        x: nx,
                        z: nz,
                        key: nk,
                        f: nuevoCosto + heuristica(
                            { x: nx, z: nz },
                            final
                        )
                    });
                }
            }
        }

        return [];
    }

    function suavizarRuta(puntos) {
        if (puntos.length < 3) return puntos;

        const resultado = [puntos[0]];
        let actual = 0;

        while (actual < puntos.length - 1) {
            let elegido = actual + 1;

            for (
                let candidato = puntos.length - 1;
                candidato > actual + 1;
                candidato--
            ) {
                if (
                    segmentoLibre(
                        puntos[actual],
                        puntos[candidato]
                    )
                ) {
                    elegido = candidato;
                    break;
                }
            }

            resultado.push(puntos[elegido]);
            actual = elegido;
        }

        return resultado;
    }

    function segmentoLibre(a, b) {
        const distancia = Math.hypot(
            b.x - a.x,
            b.z - a.z
        );

        const pasos = Math.max(
            1,
            Math.ceil(distancia / (CELDA * 0.4))
        );

        for (let i = 0; i <= pasos; i++) {
            const t = i / pasos;

            const x = THREE.MathUtils.lerp(a.x, b.x, t);
            const z = THREE.MathUtils.lerp(a.z, b.z, t);

            const c = aCelda(x, z);

            if (bloqueada(c.x, c.z)) return false;
        }

        return true;
    }

    // =========================================================
    // ANIMACIÓN CORPORAL
    // =========================================================

    let modeloCargado = null;
    let mixer = null;
    let caminar = null;
    let correr = null;
    let accionActual = null;

    let huesosAnimados = [];
    let tiempoAnimacion = 0;
    let tiempoAnimacionRobo = 0;

    let soporteProducto = null;
    let rigModelo = null;
    const productosEnMano = [];
    let animacionProductoRobado = null;

    function normalizarNombre(nombre) {
        return nombre
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    }

    function buscarHueso(huesos, patrones) {
        for (const hueso of huesos) {
            const nombre = normalizarNombre(hueso.name);

            if (
                patrones.some(patron => patron.test(nombre))
            ) {
                return hueso;
            }
        }

        return null;
    }

    function prepararAnimacionCorporal(modelo) {
        const huesos = [];

        modelo.traverse(objeto => {
            if (objeto.isBone) huesos.push(objeto);
        });

        const mapa = {
            manoDerecha: buscarHueso(huesos, [
                /^handr$/,
                /righthand$/,
                /rightwrist/,
                /handright/,
                /wristight/,
                /^manor$/,
                /manoderecha/,
                /manoder/
            ]),

            manoIzquierda: buscarHueso(huesos, [
                /^handl$/,
                /lefthand$/,
                /leftwrist/,
                /handleft/,
                /wristleft/,
                /^manol$/,
                /manoizquierda/,
                /manoizq/
            ]),

            brazoIzquierdo: buscarHueso(huesos, [
                /leftarm$/,
                /leftupperarm/,
                /upperarmleft/,
                /armleft/,
                /arml$/,
                /brazoizquierdo/,
                /brazoizq/
            ]),

            brazoDerecho: buscarHueso(huesos, [
                /rightarm$/,
                /rightupperarm/,
                /upperarmright/,
                /armright/,
                /armr$/,
                /brazoderecho/,
                /brazoder/
            ]),

            antebrazoIzquierdo: buscarHueso(huesos, [
                /^forearml$/,
                /leftforearm/,
                /leftlowerarm/,
                /forearmleft/,
                /lowerarmleft/,
                /^antebrazol$/,
                /antebrazoizquierdo/,
                /antebrazoizq/
            ]),

            antebrazoDerecho: buscarHueso(huesos, [
                /^forearmr$/,
                /rightforearm/,
                /rightlowerarm/,
                /forearmright/,
                /lowerarmright/,
                /^antebrazor$/,
                /antebrazoderecho/,
                /antebrazoder/
            ]),

            piernaIzquierda: buscarHueso(huesos, [
                /^thighl$/,
                /leftupleg/,
                /leftthigh/,
                /leftupperleg/,
                /thighleft/,
                /upperlegleft/,
                /^muslol$/,
                /piernaizquierda/,
                /piernaizq/
            ]),

            piernaDerecha: buscarHueso(huesos, [
                /^thighr$/,
                /rightupleg/,
                /rightthigh/,
                /rightupperleg/,
                /thighright/,
                /upperlegright/,
                /^muslor$/,
                /piernader/
            ]),

            pantorrillaIzquierda: buscarHueso(huesos, [
                /^shinl$/,
                /leftleg$/,
                /leftcalf/,
                /leftshin/,
                /leftlowerleg/,
                /calfleft/,
                /^pantorrillal$/,
                /pantorrillaizq/
            ]),

            pantorrillaDerecha: buscarHueso(huesos, [
                /^shinr$/,
                /rightleg$/,
                /rightcalf/,
                /rightshin/,
                /rightlowerleg/,
                /calfright/,
                /^pantorrillar$/,
                /pantorrillader/
            ]),

            pieIzquierdo: buscarHueso(huesos, [
                /^footl$/,
                /^leftfoot$/,
                /^piel$/,
                /pieizquierdo/,
                /pieizq/
            ]),

            pieDerecho: buscarHueso(huesos, [
                /^footr$/,
                /^rightfoot$/,
                /^pier$/,
                /piederecho/,
                /pieder/
            ]),

            cadera: buscarHueso(huesos, [
                /^hips$/,
                /^pelvis$/,
                /^hip$/,
                /^cadera$/
            ]),

            pecho: buscarHueso(huesos, [
                /^chest$/,
                /^upperchest$/,
                /^spine2$/,
                /^pecho$/
            ])
        };

        const originales = new Map();

        for (const hueso of Object.values(mapa)) {
            if (!hueso || originales.has(hueso)) continue;

            originales.set(hueso, {
                x: hueso.rotation.x,
                y: hueso.rotation.y,
                z: hueso.rotation.z
            });
        }

        huesosAnimados = [];

        for (const [nombre, hueso] of Object.entries(mapa)) {
            if (!hueso) continue;

            huesosAnimados.push({
                nombre,
                hueso,
                base: originales.get(hueso)
            });
        }

        console.info(
            `[${id}] Huesos encontrados:`,
            huesosAnimados.map(
                item => `${item.nombre}: ${item.hueso.name}`
            )
        );

        if (!huesos.length) {
            console.warn(`[${id}] El GLB no contiene huesos.`);
        }

        return mapa;
    }

    function animarCuerpo(delta, corriendoAhora, quieto = false) {
        if (!modeloCargado || !huesosAnimados.length) return;

        tiempoAnimacion += delta;

        // Alternancia de extremidades.
        const frecuencia = corriendoAhora ? 19 : 10;
        const intensidad = estado === 'robando'
            ? 1
            : quieto
                ? 0
                : corriendoAhora
                    ? 1
                    : 0.62;

        const paso = Math.sin(tiempoAnimacion * frecuencia);
        const pasoContrario = Math.sin(
            tiempoAnimacion * frecuencia + Math.PI
        );

        const movimiento = {
            brazoIzquierdo: pasoContrario * 0.60,
            brazoDerecho: paso * 0.60,

            antebrazoIzquierdo:
                0.10 + Math.max(0, paso) * 0.18,

            antebrazoDerecho:
                0.10 + Math.max(0, pasoContrario) * 0.18,

            piernaIzquierda: paso * 0.48,
            piernaDerecha: pasoContrario * 0.48,

            pantorrillaIzquierda:
                Math.max(0, paso) *
                (corriendoAhora ? 0.9 : 0.55),

            pantorrillaDerecha:
                Math.max(0, pasoContrario) *
                (corriendoAhora ? 0.9 : 0.55),

            pieIzquierdo: -Math.max(0, paso) * 0.18,
            pieDerecho: -Math.max(0, pasoContrario) * 0.18,

            cadera: paso * 0.035,
            pecho: -paso * 0.025
        };

        if (estado === 'robando') {
            const progreso = Math.min(
                tiempoAnimacionRobo / CONFIG.tiempoRobo,
                1
            );

            const movimientoBrazo = Math.sin(
                progreso * Math.PI / 2
            );

            movimiento.brazoDerecho = movimientoBrazo * 0.82;
            movimiento.antebrazoDerecho = movimientoBrazo * 0.58;

            movimiento.brazoIzquierdo = 0;
            movimiento.piernaIzquierda = 0;
            movimiento.piernaDerecha = 0;
            movimiento.pantorrillaIzquierda = 0;
            movimiento.pantorrillaDerecha = 0;
            movimiento.pieIzquierdo = 0;
            movimiento.pieDerecho = 0;
            movimiento.piernaIzquierda -= movimientoBrazo * 0.12;
            movimiento.piernaDerecha -= movimientoBrazo * 0.12;

            movimiento.pecho -= movimientoBrazo * 0.12;
            movimiento.cadera -= movimientoBrazo * 0.08;
        }

        for (const item of huesosAnimados) {
            const { hueso, base, nombre } = item;
            let giro = movimiento[nombre] ?? 0;

            if (estado === 'tomando') {
                giro = {
                    brazoDerecho: 0.82,
                    antebrazoDerecho: 0.58,
                    manoDerecha: 0.12
                }[nombre] ?? 0;
            }

            hueso.rotation.x = base.x + giro *
                (estado === 'tomando' ? 1 : intensidad);
            hueso.rotation.y = base.y;
            hueso.rotation.z = base.z;
        }

        const rebote = quieto
            ? 0
            : Math.max(
                0,
                Math.sin(tiempoAnimacion * frecuencia * 2)
            ) * (corriendoAhora ? 0.045 : 0.014);

        grupo.position.y = CONFIG.posicion.y + (
            estado === 'robando'
                ? -Math.sin(tiempoAnimacionRobo * 2) * 0.015
                : rebote
        );
    }

    // =========================================================
    // PRODUCTOS EN LA MANO
    // =========================================================

    function prepararSoporteProducto() {
        if (!modeloCargado || soporteProducto) return;

        soporteProducto = new THREE.Group();
        soporteProducto.name = 'PRODUCTOS_ROBADOS_EN_MANO';
        soporteProducto.visible = false;

        const huesoMano =
            rigModelo?.manoDerecha ||
            rigModelo?.antebrazoDerecho ||
            rigModelo?.brazoDerecho ||
            modeloCargado;

        soporteProducto.position.set(0, 0.04, 0.02);
        soporteProducto.rotation.set(0, 0, 0);
        huesoMano.add(soporteProducto);

        const mallaMano = modeloCargado.getObjectByName('Mano_R');

        if (mallaMano?.isSkinnedMesh) {
            modeloCargado.updateMatrixWorld(true);
            mallaMano.skeleton.update();

            const cajaMano = new THREE.Box3().setFromObject(
                mallaMano,
                true
            );

            if (!cajaMano.isEmpty()) {
                soporteProducto.position.copy(
                    huesoMano.worldToLocal(
                        cajaMano.getCenter(new THREE.Vector3())
                    )
                );
            }
        }
    }

    function colocarProductoEnMano(producto) {
        if (!producto || !modeloCargado) return;

        prepararSoporteProducto();
        soporteProducto.visible = true;

        const numero = productosEnMano.length;
        scene.updateMatrixWorld(true);
        producto.updateMatrixWorld(true);

        const caja = new THREE.Box3().setFromObject(producto);

        if (caja.isEmpty()) return false;

        const centroLocal = producto.worldToLocal(
            caja.getCenter(new THREE.Vector3())
        );
        const posicionInicial = producto.getWorldPosition(
            new THREE.Vector3()
        );
        const quaternionInicial = producto.getWorldQuaternion(
            new THREE.Quaternion()
        );
        const escalaInicial = producto.getWorldScale(
            new THREE.Vector3()
        );

        scene.updateMatrixWorld(true);
        scene.attach(producto);
        producto.visible = true;
        productosEnMano.push(producto);

        animacionProductoRobado = {
            producto,
            tiempo: 0,
            duracion: 0.32,
            posicionInicial,
            quaternionInicial,
            escalaInicial,
            centroLocal,
            posicionCentroMano: new THREE.Vector3(
                numero * 0.09,
                -numero * 0.05,
                -numero * 0.07
            ),
            rotacionMano: new THREE.Quaternion().setFromEuler(
                new THREE.Euler(-0.15, numero * 0.25, 0.10)
            )
        };

        return true;
    }

    function actualizarAnimacionProductoRobado(delta) {
        const animacion = animacionProductoRobado;

        if (!animacion || !soporteProducto) return false;

        animacion.tiempo += delta;

        const t = Math.min(
            animacion.tiempo / animacion.duracion,
            1
        );
        const suave = t * t * (3 - 2 * t);

        soporteProducto.updateWorldMatrix(true, false);

        const centroObjetivo = soporteProducto.localToWorld(
            animacion.posicionCentroMano.clone()
        );
        const quaternionObjetivo = soporteProducto.getWorldQuaternion(
            new THREE.Quaternion()
        ).multiply(animacion.rotacionMano);
        const desplazamientoCentro =
            animacion.centroLocal
                .clone()
                .multiply(animacion.escalaInicial)
                .applyQuaternion(quaternionObjetivo);
        const posicionObjetivo = centroObjetivo.sub(
            desplazamientoCentro
        );

        const posicionMundo = animacion.posicionInicial
            .clone()
            .lerp(posicionObjetivo, suave);
        const quaternionMundo = animacion.quaternionInicial
            .clone()
            .slerp(quaternionObjetivo, suave);

        scene.updateMatrixWorld(true);

        const escalaPadre = scene.getWorldScale(
            new THREE.Vector3()
        );
        const quaternionPadreInversa = scene.getWorldQuaternion(
            new THREE.Quaternion()
        ).invert();

        animacion.producto.position.copy(
            scene.worldToLocal(posicionMundo)
        );
        animacion.producto.quaternion
            .copy(quaternionPadreInversa)
            .multiply(quaternionMundo);
        animacion.producto.scale
            .copy(animacion.escalaInicial)
            .divide(escalaPadre);
        animacion.producto.updateMatrixWorld(true);

        if (t < 1) return false;

        soporteProducto.attach(animacion.producto);
        animacion.producto.updateMatrixWorld(true);

        const caja = new THREE.Box3().setFromObject(
            animacion.producto
        );
        const centroActualLocal = soporteProducto.worldToLocal(
            caja.getCenter(new THREE.Vector3())
        );

        animacion.producto.position.add(
            animacion.posicionCentroMano
                .clone()
                .sub(centroActualLocal)
        );
        animacion.producto.updateMatrixWorld(true);

        animacionProductoRobado = null;
        completarRoboProducto(animacion.producto);

        return true;
    }

    function limpiarProductosVisuales() {
        for (const producto of productosEnMano) {
            producto.parent?.remove(producto);
        }

        productosEnMano.length = 0;
        animacionProductoRobado = null;

        if (soporteProducto) {
            soporteProducto.visible = false;
        }
    }

    // =========================================================
    // ESTADOS
    // =========================================================

    let eliminado = false;
    let estado = 'cargando';

    let productoObjetivo = null;
    let tiempoRobo = 0;
    let cantidadRobada = 0;

    let ruta = [];
    let indiceRuta = 0;
    let tiempoBusqueda = 0;
    let tiempoObservacion = 0;
    let tiempoEstado = 0;
    let tiempoSinAvance = 0;
    let posicionAnterior = grupo.position.clone();

    const productosRobados = [];

    function cambiarAnimacion(accion) {
        if (!accion || accionActual === accion) return;

        if (accionActual) {
            accionActual.fadeOut(0.18);
        }

        accion.reset();
        accion.fadeIn(0.18);
        accion.play();

        accionActual = accion;
    }

    // =========================================================
    // CARGAR MODELO
    // =========================================================

    function cargarModelo() {
        new GLTFLoader().load(
            CONFIG.modelo,

            gltf => {
                if (eliminado) return;

                const modelo = gltf.scene;
                modelo.name = 'MODELO_LADRON';

                modelo.scale.setScalar(CONFIG.escala);

                modelo.traverse(objeto => {
                    if (objeto.isMesh) {
                        objeto.castShadow = true;
                        objeto.receiveShadow = true;
                    }
                });

                grupo.add(modelo);

                const caja = new THREE.Box3().setFromObject(modelo);
                const alto = caja.max.y - caja.min.y;

                if (alto > 0) {
                    const factor = CONFIG.altura / alto;

                    modelo.scale.multiplyScalar(factor);
                    modelo.position.y -= caja.min.y * factor;
                }

                modeloCargado = modelo;

                rigModelo = prepararAnimacionCorporal(modelo);
                prepararSoporteProducto();

                if (gltf.animations?.length) {
                    mixer = new THREE.AnimationMixer(modelo);

                    const clips = gltf.animations;

                    const clipCaminar = clips.find(clip =>
                        /walk|walking|caminar|andar|locomotion/i.test(
                            clip.name
                        )
                    );

                    const clipCorrer = clips.find(clip =>
                        /run|running|correr|sprint/i.test(clip.name)
                    );

                    if (clipCaminar) {
                        caminar = mixer.clipAction(clipCaminar);
                    }

                    if (clipCorrer) {
                        correr = mixer.clipAction(clipCorrer);
                    }

                    console.info(
                        `[${id}] Animaciones:`,
                        clips.map(clip => clip.name)
                    );
                }

                estado = 'entrando';
                tiempoObservacion = 0;

                if (establecerDestino({ x: 0, z: 27 })) {
                    cambiarAnimacion(caminar);
                } else {
                    estado = 'buscando';
                }
            },

            evento => {
                if (evento.total) {
                    console.info(
                        `[${id}] Cargando modelo:`,
                        Math.round(
                            evento.loaded / evento.total * 100
                        ) + '%'
                    );
                }
            },

            error => {
                estado = 'error';

                console.error(
                    `[${id}] Error al cargar ${CONFIG.modelo}.`,
                    error
                );
            }
        );
    }

    // =========================================================
    // MOVIMIENTO
    // =========================================================

    function establecerDestino(destino) {
        ruta = encontrarRuta(grupo.position, destino);
        indiceRuta = 0;

        if (!ruta.length) {
            console.warn(
                `[${id}] No encontró ruta hacia:`,
                destino
            );

            return false;
        }

        return true;
    }

    function avanzar(delta, velocidad) {
        while (indiceRuta < ruta.length) {
            const punto = ruta[indiceRuta];

            const dx = punto.x - grupo.position.x;
            const dz = punto.z - grupo.position.z;

            const distancia = Math.hypot(dx, dz);

            if (distancia < 0.10) {
                grupo.position.x = punto.x;
                grupo.position.z = punto.z;

                indiceRuta++;
                continue;
            }

            const paso = Math.min(
                distancia,
                velocidad * delta
            );

            grupo.position.x += dx / distancia * paso;
            grupo.position.z += dz / distancia * paso;

            grupo.rotation.y = Math.atan2(dx, dz);

            return false;
        }

        return true;
    }

    // =========================================================
    // BÚSQUEDA GLOBAL DE PRODUCTOS
    // =========================================================

    function obtenerProductosDisponibles() {
        const disponibles = [];

        // La escena incluye góndolas, refrigeradores y almacén,
        // siempre que los productos estén agregados a la escena.
        scene.traverse(objeto => {
            if (objeto.userData?.esUnidadProducto !== true) return;
            if (!objeto.visible) return;
            if (objeto.userData.recogido) return;
            if (objeto.userData.robadoPor) return;
            if (objeto.userData.reservado === true) return;

            const reserva = objeto.userData.reservadoPor;

            if (reserva && reserva !== id) return;

            let padre = objeto.parent;
            let visible = true;

            while (padre && padre !== scene) {
                if (!padre.visible) {
                    visible = false;
                    break;
                }

                padre = padre.parent;
            }

            if (!visible) return;

            disponibles.push(objeto);
        });

        return disponibles;
    }

    function liberarReserva() {
        if (
            productoObjetivo?.userData?.reservadoPor === id
        ) {
            delete productoObjetivo.userData.reservadoPor;
        }

        productoObjetivo = null;
    }

    function encontrarPosicionDeRobo(producto) {
        const posicion = new THREE.Vector3();
        producto.getWorldPosition(posicion);

        const radios = [
            CONFIG.distanciaProducto,
            1.05,
            1.25,
            1.45,
            1.65
        ];

        let mejorRuta = null;
        let mejorDistancia = Infinity;

        for (const radio of radios) {
            for (let i = 0; i < 16; i++) {
                const angulo = i * Math.PI * 2 / 16;

                const candidato = {
                    x: posicion.x + Math.cos(angulo) * radio,
                    z: posicion.z + Math.sin(angulo) * radio
                };

                const celda = aCelda(
                    candidato.x,
                    candidato.z
                );

                if (bloqueada(celda.x, celda.z)) continue;

                const rutaCandidata = encontrarRuta(
                    grupo.position,
                    candidato
                );

                if (!rutaCandidata.length) continue;

                let distanciaRuta = 0;

                for (
                    let j = 1;
                    j < rutaCandidata.length;
                    j++
                ) {
                    distanciaRuta += Math.hypot(
                        rutaCandidata[j].x -
                            rutaCandidata[j - 1].x,
                        rutaCandidata[j].z -
                            rutaCandidata[j - 1].z
                    );
                }

                if (distanciaRuta < mejorDistancia) {
                    mejorDistancia = distanciaRuta;
                    mejorRuta = rutaCandidata;
                }
            }

            if (mejorRuta) break;
        }

        return mejorRuta;
    }

    function buscarYReservarProducto() {
        const disponibles = obtenerProductosDisponibles();

        if (!disponibles.length) {
            return false;
        }

        const candidatos = [...disponibles];

        // Mezcla para evitar que siempre roben en el mismo sitio.
        for (let i = candidatos.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));

            [candidatos[i], candidatos[j]] =
                [candidatos[j], candidatos[i]];
        }

        const MAX_INTENTOS = Math.min(
            candidatos.length,
            80
        );

        for (let i = 0; i < MAX_INTENTOS; i++) {
            const producto = candidatos[i];

            if (!producto.visible) continue;
            if (producto.userData.recogido) continue;

            const reserva = producto.userData.reservadoPor;

            if (reserva && reserva !== id) continue;

            producto.userData.reservadoPor = id;

            const rutaRobo = encontrarPosicionDeRobo(producto);

            if (rutaRobo?.length) {
                productoObjetivo = producto;
                ruta = rutaRobo;
                indiceRuta = 0;
                estado = 'acercandose';

                const posicion = new THREE.Vector3();
                producto.getWorldPosition(posicion);

                console.info(
                    `[${id}] Objetivo:`,
                    producto.userData.nombreProducto || producto.name,
                    `X:${posicion.x.toFixed(1)}`,
                    `Z:${posicion.z.toFixed(1)}`
                );

                return true;
            }

            delete producto.userData.reservadoPor;
        }

        return false;
    }

    // =========================================================
    // ROBO
    // =========================================================

    function robarProducto() {
        const producto = productoObjetivo;

        if (
            !producto ||
            !producto.visible ||
            producto.userData.recogido ||
            !grupo.parent
        ) {
            liberarReserva();
            estado = 'buscando';
            return;
        }

        producto.userData.recogido = true;
        producto.userData.robadoPor = id;

        if (!colocarProductoEnMano(producto)) {
            producto.userData.recogido = false;
            delete producto.userData.robadoPor;
            liberarReserva();
            estado = 'buscando';
            tiempoBusqueda = 0;
            return;
        }

        liberarReserva();
        estado = 'tomando';
        tiempoEstado = 0;
        return;
    }

    function completarRoboProducto(producto) {
        const registro = {
            nombre:
                producto.userData.nombreProducto ||
                producto.name ||
                'Producto',

            codigo:
                producto.userData.codigoProducto ||
                'SIN-CODIGO'
        };

        productosRobados.push(registro);
        cantidadRobada++;

        console.info(
            `[${id}] Robó ${registro.nombre}.`,
            `Total: ${cantidadRobada}`
        );

        CONFIG.alRobar?.({
            id,
            producto: registro,
            cantidadRobada
        });

        if (cantidadRobada >= CONFIG.productosRobados) {
            iniciarHuida();
        } else {
            estado = 'buscando';
            tiempoBusqueda = 0;
        }
    }

    // =========================================================
    // HUIDA
    // =========================================================

    function iniciarHuida() {
        liberarReserva();

        estado = 'huyendo';

        cambiarAnimacion(correr || caminar);

        if (!establecerDestino({ x: 0, z: 34 })) {
            console.warn(
                `[${id}] No pudo calcular la ruta de huida.`
            );
        }
    }

    function terminarHuida() {
        if (eliminado) return;

        eliminado = true;

        liberarReserva();
        limpiarProductosVisuales();

        mixer?.stopAllAction();

        scene.remove(grupo);

        CONFIG.alEscapar?.({
            id,
            cantidadRobada,
            productos: productosRobados
        });
    }

    // =========================================================
    // ACTUALIZACIÓN
    // =========================================================

    function actualizar(delta) {
        if (
            eliminado ||
            estado === 'cargando' ||
            estado === 'error'
        ) {
            return;
        }

        delta = Math.min(
            Math.max(delta, 0),
            0.05
        );

        mixer?.update(delta);

        tiempoEstado += delta;

        const desplazamiento = grupo.position.distanceTo(posicionAnterior);

        if (
            ['entrando', 'acercandose', 'huyendo'].includes(estado) &&
            desplazamiento > 0.025
        ) {
            posicionAnterior.copy(grupo.position);
            tiempoSinAvance = 0;
        } else if (['entrando', 'acercandose', 'huyendo'].includes(estado)) {
            tiempoSinAvance += delta;
        } else {
            posicionAnterior.copy(grupo.position);
            tiempoSinAvance = 0;
        }

        if (
            tiempoSinAvance >= CONFIG.tiempoAtascado &&
            ['entrando', 'acercandose', 'huyendo'].includes(estado)
        ) {
            tiempoSinAvance = 0;
            ruta = [];
            indiceRuta = 0;

            if (estado === 'acercandose') {
                liberarReserva();
                estado = 'buscando';
                tiempoBusqueda = 0;
            } else if (estado === 'huyendo') {
                establecerDestino({
                    x: Math.random() < 0.5 ? -26 : 26,
                    z: 34
                });
            } else {
                establecerDestino({ x: 0, z: 27 });
            }
        }

        const estaCorriendo = estado === 'huyendo';
        const estaQuieto =
            estado === 'robando' ||
            estado === 'observando' ||
            estado === 'tomando';

        animarCuerpo(
            delta,
            estaCorriendo,
            estaQuieto
        );

        switch (estado) {
            case 'entrando': {
                cambiarAnimacion(caminar);

                if (
                    avanzar(
                        delta,
                        CONFIG.velocidadCaminar *
                        variacionVelocidad
                    )
                ) {
                    estado = 'observando';
                    tiempoEstado = 0;
                    tiempoObservacion =
                        CONFIG.tiempoObservacion *
                        (0.75 + Math.random() * 0.75);
                }

                break;
            }

            case 'observando': {
                cambiarAnimacion(null);
                tiempoObservacion -= delta;

                if (caminar?.isRunning()) {
                    caminar.paused = true;
                }

                if (tiempoObservacion <= 0) {
                    if (caminar?.isRunning()) {
                        caminar.paused = false;
                    }
                    estado = 'buscando';
                    tiempoEstado = 0;
                    tiempoBusqueda = 0;
                }

                break;
            }

            case 'buscando': {
                cambiarAnimacion(caminar);

                if (
                    cantidadRobada >=
                    CONFIG.productosRobados
                ) {
                    iniciarHuida();
                    break;
                }

                tiempoBusqueda -= delta;

                if (tiempoBusqueda <= 0) {
                    const encontrado =
                        buscarYReservarProducto();

                    tiempoBusqueda = encontrado ? 0 : 0.8;
                }

                break;
            }

            case 'acercandose': {
                if (
                    !productoObjetivo ||
                    !productoObjetivo.visible ||
                    productoObjetivo.userData.recogido
                ) {
                    liberarReserva();
                    estado = 'buscando';
                    tiempoBusqueda = 0;
                    break;
                }

                cambiarAnimacion(caminar);

                if (productoObjetivo) {
                    const posicionProducto =
                        productoObjetivo.getWorldPosition(
                            new THREE.Vector3()
                        );

                    const dx =
                        posicionProducto.x - grupo.position.x;
                    const dz =
                        posicionProducto.z - grupo.position.z;

                    if (Math.hypot(dx, dz) > 0.01) {
                        const rotacionObjetivo =
                            Math.atan2(dx, dz);

                        let diferencia =
                            rotacionObjetivo - grupo.rotation.y;

                        while (diferencia > Math.PI) {
                            diferencia -= Math.PI * 2;
                        }

                        while (diferencia < -Math.PI) {
                            diferencia += Math.PI * 2;
                        }

                        grupo.rotation.y += diferencia *
                            (1 - Math.exp(-6 * delta));
                    }
                }

                if (
                    avanzar(
                        delta,
                        CONFIG.velocidadCaminar *
                        variacionVelocidad
                    )
                ) {
                    estado = 'robando';
                    tiempoRobo = 0;
                    tiempoAnimacionRobo = 0;
                }

                break;
            }

            case 'robando': {
                tiempoRobo += delta;
                tiempoAnimacionRobo += delta;

                if (tiempoRobo >= CONFIG.tiempoRobo) {
                    tiempoAnimacionRobo = 0;
                    robarProducto();
                }

                break;
            }

            case 'tomando': {
                actualizarAnimacionProductoRobado(delta);
                break;
            }

            case 'huyendo': {
                cambiarAnimacion(correr || caminar);

                if (
                    avanzar(
                        delta,
                        CONFIG.velocidadHuida *
                        variacionVelocidad
                    )
                ) {
                    terminarHuida();
                }

                break;
            }
        }
    }

    // =========================================================
    // INICIAR
    // =========================================================

    cargarModelo();

    return {
        id,
        grupo,
        actualizar,

        get eliminado() {
            return eliminado;
        },

        get cantidadRobada() {
            return cantidadRobada;
        },

        get estado() {
            return estado;
        },

        get productosRobados() {
            return [...productosRobados];
        },

        destruir() {
            if (eliminado) return;

            eliminado = true;

            liberarReserva();
            limpiarProductosVisuales();

            mixer?.stopAllAction();

            scene.remove(grupo);
        }
    };
}
