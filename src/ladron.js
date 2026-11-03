
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
        distanciaProducto: 1.5,
        tiempoRobo: 1.3,
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
    const productosEnMano = [];

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
                /leftforearm/,
                /leftlowerarm/,
                /forearmleft/,
                /lowerarmleft/,
                /antebrazoizquierdo/,
                /antebrazoizq/
            ]),

            antebrazoDerecho: buscarHueso(huesos, [
                /rightforearm/,
                /rightlowerarm/,
                /forearmright/,
                /lowerarmright/,
                /antebrazoderecho/,
                /antebrazoder/
            ]),

            piernaIzquierda: buscarHueso(huesos, [
                /leftupleg/,
                /leftthigh/,
                /leftupperleg/,
                /thighleft/,
                /upperlegleft/,
                /piernaizquierda/,
                /piernaizq/
            ]),

            piernaDerecha: buscarHueso(huesos, [
                /rightupleg/,
                /rightthigh/,
                /rightupperleg/,
                /thighright/,
                /upperlegright/,
                /piernader/
            ]),

            pantorrillaIzquierda: buscarHueso(huesos, [
                /leftleg$/,
                /leftcalf/,
                /leftshin/,
                /leftlowerleg/,
                /calfleft/,
                /pantorrillaizq/
            ]),

            pantorrillaDerecha: buscarHueso(huesos, [
                /rightleg$/,
                /rightcalf/,
                /rightshin/,
                /rightlowerleg/,
                /calfright/,
                /pantorrillader/
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
        const frecuencia = corriendoAhora ? 12 : 7;
        const intensidad = quieto ? 0 : corriendoAhora ? 1 : 0.62;

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
                Math.max(0, paso) * 0.65,

            pantorrillaDerecha:
                Math.max(0, pasoContrario) * 0.65,

            cadera: paso * 0.035,
            pecho: -paso * 0.025
        };

        if (estado === 'robando') {
            const progreso = Math.min(
                tiempoAnimacionRobo / CONFIG.tiempoRobo,
                1
            );

            const movimientoBrazo = Math.sin(
                progreso * Math.PI
            );

            movimiento.brazoDerecho += movimientoBrazo * 0.85;
            movimiento.antebrazoDerecho += movimientoBrazo * 0.65;

            movimiento.piernaIzquierda -= movimientoBrazo * 0.12;
            movimiento.piernaDerecha -= movimientoBrazo * 0.12;

            movimiento.pecho -= movimientoBrazo * 0.12;
            movimiento.cadera -= movimientoBrazo * 0.08;
        }

        for (const item of huesosAnimados) {
            const { hueso, base, nombre } = item;
            const giro = movimiento[nombre] ?? 0;

            hueso.rotation.x = base.x + giro * intensidad;
            hueso.rotation.y = base.y;
            hueso.rotation.z = base.z;
        }
    }

    // =========================================================
    // PRODUCTOS EN LA MANO
    // =========================================================

    function prepararSoporteProducto() {
        if (!modeloCargado || soporteProducto) return;

        soporteProducto = new THREE.Group();
        soporteProducto.name = 'PRODUCTOS_ROBADOS_EN_MANO';

        soporteProducto.position.set(0.30, 0.95, 0.22);

        modeloCargado.add(soporteProducto);
    }

    function colocarProductoEnMano(producto) {
        if (!producto || !modeloCargado) return;

        prepararSoporteProducto();

        const copia = producto.clone(true);

        copia.name =
            `COPIA_ROBADA_${productosEnMano.length + 1}`;

        copia.visible = true;

        copia.traverse(objeto => {
            objeto.visible = true;

            if (objeto.isMesh) {
                objeto.castShadow = true;
                objeto.receiveShadow = true;
            }
        });

        copia.updateMatrixWorld(true);

        const caja = new THREE.Box3().setFromObject(copia);
        const dimensiones = new THREE.Vector3();

        caja.getSize(dimensiones);

        const maximo = Math.max(
            dimensiones.x,
            dimensiones.y,
            dimensiones.z
        );

        if (maximo > 0) {
            copia.scale.multiplyScalar(0.28 / maximo);
        }

        const numero = productosEnMano.length;

        copia.position.set(
            numero * 0.11,
            -numero * 0.07,
            numero * -0.10
        );

        copia.rotation.set(
            -0.15,
            numero * 0.25,
            0.10
        );

        soporteProducto.add(copia);
        productosEnMano.push(copia);

        producto.visible = false;
    }

    function limpiarProductosVisuales() {
        for (const copia of productosEnMano) {
            copia.parent?.remove(copia);
        }

        productosEnMano.length = 0;
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

                prepararAnimacionCorporal(modelo);
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
            1.9,
            2.3,
            2.8,
            3.3
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

        colocarProductoEnMano(producto);

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

        liberarReserva();

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

        const estaCorriendo = estado === 'huyendo';
        const estaQuieto = estado === 'robando';

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
                    estado = 'buscando';
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
