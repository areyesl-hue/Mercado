import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
    distanciaProducto: 1.35,
    tiempoSeleccionProducto: 2.5,
    tiempoEntreProductos: 1.5,
    maximoProductos: 3,

    radioColision: 0.65,

    limiteX: 29,
    limiteZMin: -27,
    limiteZMax: 55,

    ruta: [],
    productos: [],
    carrito: null,

    correccionRotacion: 0,
    distanciaFrenteProducto: 1.05,

    tiempoAlcanzarProducto: 0.65,
    tiempoGuardarProducto: 0.85,

    distanciaMaximaBusqueda: 40,
    evitarZonaAnterior: true,

    tiempoReintentoBusqueda: 3,
    tiempoPaseo: 7,

    alEntrar: null,
    alComprar: null,
    alPagar: null,
    alFinalizar: null
};

const estados = {
    INACTIVO: 'inactivo',
    ENTRANDO: 'entrandoSupermercado',
    BUSCANDO: 'buscandoProducto',
    ACERCANDO: 'acercandoseProducto',
    RECOGIENDO: 'recogiendoProducto',
    GUARDANDO: 'guardandoProducto',
    ESPERANDO: 'esperandoEntreProductos',
    RUTA: 'recorriendoRuta',
    PASEANDO: 'paseandoSupermercado',
    CAJA: 'yendoCaja',
    PAGANDO: 'pagando',
    REGRESANDO: 'regresandoVehiculo',
    FINALIZADO: 'finalizado'
};

// =========================================================
// CLIENTE
// =========================================================

export function crearClienteSupermercado(scene, opciones = {}) {

    if (!scene) {
        throw new Error('crearClienteSupermercado necesita una escena.');
    }

    const config = {
        ...CONFIG_BASE,
        ...opciones,
        posicion: {
            ...CONFIG_BASE.posicion,
            ...(opciones.posicion || {})
        }
    };

    const grupo = new THREE.Group();
    grupo.name = config.id || 'CLIENTE_SUPERMERCADO';

    grupo.position.set(
        config.posicion.x,
        config.posicion.y,
        config.posicion.z
    );

    grupo.scale.setScalar(config.escala);
    scene.add(grupo);

    const provisional = new THREE.Group();
    provisional.name = 'MODELO_PROVISIONAL_CLIENTE';
    grupo.add(provisional);

    let eliminado = false;
    let cargado = false;
    let entro = false;
    let callbackEntradaEjecutado = false;

    let compraConfirmada = false;
    let pagoConfirmado = false;

    let estado = config.inactivo
        ? estados.INACTIVO
        : estados.BUSCANDO;

    let velocidad = Math.max(0.1, config.velocidad);

    let ruta = [];
    let indiceRuta = 0;
    let destino = null;

    let tiempoEstado = 0;
    let animacionTiempo = 0;
    let tiempoPaseo = 0;

    let plazaVehiculo = null;
    let callbackRegreso = null;
    let callbackPago = null;

    let compras = [];

    let productoObjetivo = null;
    let productoEnMano = null;
    let productoOriginal = null;

    let probabilidadEvaluada = false;
    let debeComprar = false;

    let mixer = null;
    let accionCaminar = null;
    let accionReposo = null;

    let modeloCargado = null;

    const huesos = {};

    const articulaciones = {
        piernaIzquierda: [],
        piernaDerecha: [],
        brazoIzquierdo: [],
        brazoDerecho: []
    };

    const rotacionesBase = new Map();
    const zonasVisitadas = new Set();

    let ultimaZona = null;
    let direccionPaseo = 1;

    // Rutas interiores de circulación.
    // Se utilizan zonas de paso entre las filas de góndolas.
    const puntosPaseo = [
        { x: -25, z: 21 },
        { x: -25, z: 7 },
        { x: -25, z: -7 },
        { x: -25, z: -21 },

        { x: -5, z: -21 },
        { x: 5, z: -21 },

        { x: 25, z: -21 },
        { x: 25, z: -7 },
        { x: 25, z: 7 },
        { x: 25, z: 21 },

        { x: 5, z: 21 },
        { x: -5, z: 21 },

        { x: 0, z: 7 },
        { x: 0, z: -7 }
    ];

    // =====================================================
    // UTILIDADES
    // =====================================================

    function distanciaXZ(a, b) {
        return Math.hypot(a.x - b.x, a.z - b.z);
    }

    function obtenerPosicionMundo(objeto) {
        return objeto.getWorldPosition(new THREE.Vector3());
    }

    function crearMaterial(color) {
        return new THREE.MeshStandardMaterial({
            color,
            roughness: 0.85
        });
    }

    function limitarPosicion(punto) {
        return {
            x: THREE.MathUtils.clamp(
                punto.x,
                -config.limiteX,
                config.limiteX
            ),
            z: THREE.MathUtils.clamp(
                punto.z,
                config.limiteZMin,
                config.limiteZMax
            )
        };
    }

    // =====================================================
    // MODELO PROVISIONAL
    // =====================================================

    function crearModeloProvisional() {

        provisional.clear();

        const piel = crearMaterial(0xd7a77c);
        const camisa = crearMaterial(0x2471a3);
        const pantalon = crearMaterial(0x263b55);
        const zapatos = crearMaterial(0x171717);

        function caja(nombre, dimensiones, material, posicion) {

            const objeto = new THREE.Mesh(
                new THREE.BoxGeometry(...dimensiones),
                material
            );

            objeto.name = nombre;
            objeto.position.set(...posicion);
            provisional.add(objeto);

            return objeto;
        }

        function esfera(nombre, escala, material, posicion) {

            const objeto = new THREE.Mesh(
                new THREE.SphereGeometry(1, 14, 12),
                material
            );

            objeto.name = nombre;
            objeto.scale.set(...escala);
            objeto.position.set(...posicion);
            provisional.add(objeto);

            return objeto;
        }

        caja('TORSO', [0.42, 0.55, 0.24], camisa, [0, 1.12, 0]);

        caja(
            'PIERNA_IZQUIERDA',
            [0.16, 0.48, 0.18],
            pantalon,
            [-0.12, 0.62, 0]
        );

        caja(
            'PIERNA_DERECHA',
            [0.16, 0.48, 0.18],
            pantalon,
            [0.12, 0.62, 0]
        );

        caja(
            'BRAZO_IZQUIERDO',
            [0.13, 0.48, 0.13],
            camisa,
            [-0.29, 1.1, 0]
        );

        caja(
            'BRAZO_DERECHO',
            [0.13, 0.48, 0.13],
            camisa,
            [0.29, 1.1, 0]
        );

        esfera(
            'CABEZA',
            [0.17, 0.19, 0.17],
            piel,
            [0, 1.52, 0]
        );

        caja(
            'ZAPATO_IZQUIERDO',
            [0.19, 0.09, 0.29],
            zapatos,
            [-0.12, 0.32, 0.045]
        );

        caja(
            'ZAPATO_DERECHO',
            [0.19, 0.09, 0.29],
            zapatos,
            [0.12, 0.32, 0.045]
        );

        articulaciones.piernaIzquierda = [
            provisional.getObjectByName('PIERNA_IZQUIERDA')
        ];

        articulaciones.piernaDerecha = [
            provisional.getObjectByName('PIERNA_DERECHA')
        ];

        articulaciones.brazoIzquierdo = [
            provisional.getObjectByName('BRAZO_IZQUIERDO')
        ];

        articulaciones.brazoDerecho = [
            provisional.getObjectByName('BRAZO_DERECHO')
        ];

        cargado = true;
    }

    // =====================================================
    // ANIMACIONES Y HUESOS
    // =====================================================

    function normalizarNombre(nombre) {
        return String(nombre || '')
            .toLowerCase()
            .replace(/mixamorig/gi, '')
            .replace(/[^a-z0-9]/g, '');
    }

    function detectarHuesosAnimables() {

        for (const lista of Object.values(articulaciones)) {
            lista.length = 0;
        }

        function buscar(lado, patrones) {

            for (const [nombre, hueso] of Object.entries(huesos)) {

                const n = normalizarNombre(nombre);

                const esIzquierdo =
                    /left|izquierdo|izquierda/.test(n);

                const esDerecho =
                    /right|derecho|derecha/.test(n);

                if (lado === 'izquierdo' && !esIzquierdo) continue;
                if (lado === 'derecho' && !esDerecho) continue;

                if (patrones.some(p => p.test(n))) {
                    return hueso;
                }
            }

            return null;
        }

        const patronesPierna = [
            /upleg/,
            /upperleg/,
            /thigh/,
            /lowerleg/,
            /calf/,
            /shin/
        ];

        const patronesBrazo = [
            /uparm/,
            /upperarm/,
            /lowerarm/,
            /forearm/,
            /shoulder/
        ];

        const piernaI = buscar('izquierdo', patronesPierna);
        const piernaD = buscar('derecho', patronesPierna);

        const brazoI = buscar('izquierdo', patronesBrazo);
        const brazoD = buscar('derecho', patronesBrazo);

        if (piernaI) articulaciones.piernaIzquierda.push(piernaI);
        if (piernaD) articulaciones.piernaDerecha.push(piernaD);

        if (brazoI) articulaciones.brazoIzquierdo.push(brazoI);
        if (brazoD) articulaciones.brazoDerecho.push(brazoD);

        for (const lista of Object.values(articulaciones)) {
            for (const hueso of lista) {
                if (!rotacionesBase.has(hueso)) {
                    rotacionesBase.set(
                        hueso,
                        hueso.rotation.clone()
                    );
                }
            }
        }

        console.info('[CLIENTE] Huesos detectados:', {
            piernas:
                articulaciones.piernaIzquierda.length +
                articulaciones.piernaDerecha.length,
            brazos:
                articulaciones.brazoIzquierdo.length +
                articulaciones.brazoDerecho.length
        });
    }

    function restaurarArticulaciones() {

        for (const [hueso, base] of rotacionesBase) {
            hueso.rotation.copy(base);
        }
    }

    function animarArticulaciones(lista, valor) {

        for (const hueso of lista) {

            if (!hueso) continue;

            const base = rotacionesBase.get(hueso);
            if (!base) continue;

            hueso.rotation.x = base.x + valor;
        }
    }

    function animarCaminar(activo) {

        const fase = animacionTiempo * 7;

        if (accionCaminar) {

            if (activo) {
                accionReposo?.stop();

                if (!accionCaminar.isRunning()) {
                    accionCaminar.reset().play();
                }
            } else {
                accionCaminar.stop();

                if (accionReposo && !accionReposo.isRunning()) {
                    accionReposo.reset().play();
                }
            }
        }

        if (activo) {

            const piernas = Math.sin(fase) * 0.48;
            const brazos = Math.sin(fase) * 0.32;

            animarArticulaciones(
                articulaciones.piernaIzquierda,
                piernas
            );

            animarArticulaciones(
                articulaciones.piernaDerecha,
                -piernas
            );

            animarArticulaciones(
                articulaciones.brazoIzquierdo,
                -brazos
            );

            animarArticulaciones(
                articulaciones.brazoDerecho,
                brazos
            );

        } else {
            restaurarArticulaciones();
        }

        const pi = provisional.getObjectByName('PIERNA_IZQUIERDA');
        const pd = provisional.getObjectByName('PIERNA_DERECHA');
        const bi = provisional.getObjectByName('BRAZO_IZQUIERDO');
        const bd = provisional.getObjectByName('BRAZO_DERECHO');

        if (pi) pi.rotation.x = activo ? Math.sin(fase) * 0.45 : 0;
        if (pd) pd.rotation.x = activo ? -Math.sin(fase) * 0.45 : 0;
        if (bi) bi.rotation.x = activo ? -Math.sin(fase) * 0.3 : 0;
        if (bd) bd.rotation.x = activo ? Math.sin(fase) * 0.3 : 0;
    }

    function restaurarPostura() {

        restaurarArticulaciones();

        const brazo = provisional.getObjectByName('BRAZO_DERECHO');

        if (brazo) {
            brazo.rotation.set(0, 0, 0);
        }

        if (modeloCargado) {
            modeloCargado.rotation.x = 0;
        }
    }

    // =====================================================
    // CARGAR MODELO GLB
    // =====================================================

    function cargarModelo() {

        loader.load(
            config.modelo,

            gltf => {

                if (eliminado) return;

                const modelo = gltf.scene;
                modelo.name = 'MODELO_CLIENTE';

                const caja = new THREE.Box3().setFromObject(modelo);

                if (!caja.isEmpty()) {

                    const centro = caja.getCenter(new THREE.Vector3());

                    modelo.position.x -= centro.x;
                    modelo.position.z -= centro.z;

                    const nuevaCaja = new THREE.Box3().setFromObject(modelo);
                    modelo.position.y -= nuevaCaja.min.y;
                }

                modelo.traverse(objeto => {

                    if (objeto.isBone) {
                        huesos[objeto.name.toLowerCase()] = objeto;
                    }

                    if (objeto.isMesh) {
                        objeto.castShadow = false;
                        objeto.receiveShadow = false;
                    }
                });

                modelo.rotation.y = config.correccionRotacion;

                grupo.add(modelo);
                provisional.visible = false;

                modeloCargado = modelo;

                detectarHuesosAnimables();

                if (gltf.animations?.length) {

                    mixer = new THREE.AnimationMixer(modelo);

                    const caminar = gltf.animations.find(a =>
                        /walk|caminar|walking|run/i.test(a.name)
                    );

                    const reposo = gltf.animations.find(a =>
                        /idle|rest|reposo/i.test(a.name)
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

                console.info(`[CLIENTE] Modelo cargado: ${config.modelo}`);

                console.info(
                    '[CLIENTE] Animación disponible:',
                    Boolean(accionCaminar || articulaciones.piernaIzquierda.length)
                );
            },

            undefined,

            error => {

                console.warn(
                    `[CLIENTE] Error cargando ${config.modelo}`,
                    error
                );

                if (!eliminado) {
                    crearModeloProvisional();
                }
            }
        );
    }

    // =====================================================
    // MOVIMIENTO
    // =====================================================

    function establecerDestino(punto) {

        if (!punto) {
            destino = null;
            return;
        }

        const limitado = limitarPosicion(punto);

        destino = new THREE.Vector3(
            limitado.x,
            0,
            limitado.z
        );
    }

    function obtenerLimitesMovimiento() {

        return {
            minX: -config.limiteX,
            maxX: config.limiteX,
            minZ: config.limiteZMin,
            maxZ: config.limiteZMax
        };
    }

    function moverHaciaDestino(delta) {

        if (!destino) return true;

        const dx = destino.x - grupo.position.x;
        const dz = destino.z - grupo.position.z;

        const distancia = Math.hypot(dx, dz);

        if (distancia < 0.16) {

            grupo.position.x = destino.x;
            grupo.position.z = destino.z;

            animarCaminar(false);

            return true;
        }

        const avance = Math.min(
            distancia,
            velocidad * delta
        );

        grupo.position.x += (dx / distancia) * avance;
        grupo.position.z += (dz / distancia) * avance;

        const limites = obtenerLimitesMovimiento();

        grupo.position.x = THREE.MathUtils.clamp(
            grupo.position.x,
            limites.minX,
            limites.maxX
        );

        grupo.position.z = THREE.MathUtils.clamp(
            grupo.position.z,
            limites.minZ,
            limites.maxZ
        );

        grupo.rotation.y = Math.atan2(dx, dz);

        animacionTiempo += delta;

        animarCaminar(true);

        return false;
    }

    // =====================================================
    // PRODUCTOS
    // =====================================================

    function esUnidadProducto(objeto) {

        if (!objeto?.isObject3D) return false;

        const d = objeto.userData || {};

        return (
            d.esUnidadProducto === true ||
            d.tipo === 'producto' ||
            d.esProducto === true ||
            Boolean(d.codigoProducto) ||
            Boolean(d.skuProducto) ||
            Boolean(d.codigo && d.nombre)
        );
    }

    function obtenerRaizProducto(objeto) {

        let actual = objeto;

        while (actual && actual !== scene) {

            if (esUnidadProducto(actual)) {
                return actual;
            }

            actual = actual.parent;
        }

        return null;
    }

    function listarProductosDisponibles() {

        const resultado = [];
        const encontrados = new Set();

        function agregar(objeto) {

            if (!objeto?.isObject3D) return;

            const raiz = obtenerRaizProducto(objeto);

            if (!raiz || encontrados.has(raiz.uuid)) return;

            const datos = raiz.userData || {};

            if (
                datos.disponible === false ||
                datos.enCarrito ||
                datos.recogido ||
                datos.vendido ||
                datos.reservado
            ) {
                return;
            }

            if (
                productosCompradosGlobal.has(raiz.uuid) ||
                productosReservadosGlobal.has(raiz.uuid)
            ) {
                return;
            }

            encontrados.add(raiz.uuid);
            resultado.push(raiz);
        }

        const contenedor = Array.isArray(config.productos)
            ? null
            : config.productos?.isObject3D
                ? config.productos
                : scene.getObjectByName('PRODUCTOS_SUPERMERCADO');

        if (Array.isArray(config.productos)) {

            for (const producto of config.productos) {
                agregar(producto?.objeto || producto);
            }

        } else if (contenedor) {

            contenedor.traverse(agregar);
        }

        return resultado;
    }

    function obtenerZonaProducto(posicion) {

        const x = Math.round(posicion.x / 6);
        const z = Math.round(posicion.z / 6);

        return `${x}_${z}`;
    }

    function elegirProducto(candidatos) {

        if (!candidatos.length) return null;

        const zonas = new Map();

        for (const candidato of candidatos) {

            const zona = obtenerZonaProducto(candidato.posicion);

            if (!zonas.has(zona)) {
                zonas.set(zona, []);
            }

            zonas.get(zona).push(candidato);
        }

        let zonasDisponibles = [...zonas.entries()];

        if (
            config.evitarZonaAnterior &&
            ultimaZona &&
            zonasDisponibles.length > 1
        ) {

            const diferentes = zonasDisponibles.filter(
                ([zona]) => zona !== ultimaZona
            );

            if (diferentes.length) {
                zonasDisponibles = diferentes;
            }
        }

        const zonasNoVisitadas = zonasDisponibles.filter(
            ([zona]) => !zonasVisitadas.has(zona)
        );

        if (zonasNoVisitadas.length) {
            zonasDisponibles = zonasNoVisitadas;
        }

        const indice = Math.floor(
            Math.random() * zonasDisponibles.length
        );

        const [zonaElegida, productosZona] = zonasDisponibles[indice];

        ultimaZona = zonaElegida;
        zonasVisitadas.add(zonaElegida);

        if (zonasVisitadas.size > 12) {
            zonasVisitadas.clear();
            zonasVisitadas.add(zonaElegida);
        }

        productosZona.sort(
            (a, b) => a.distancia - b.distancia
        );

        const cantidad = Math.min(3, productosZona.length);

        return productosZona[
            Math.floor(Math.random() * cantidad)
        ];
    }

    // =====================================================
    // PASEO CUANDO NO HAY PRODUCTOS
    // =====================================================

    function iniciarPaseo() {

        const puntos = puntosPaseo.filter(p =>
            distanciaXZ(grupo.position, p) > 2
        );

        if (!puntos.length) {
            estado = estados.BUSCANDO;
            tiempoEstado = 0;
            return;
        }

        const punto = puntos[
            Math.floor(Math.random() * puntos.length)
        ];

        establecerDestino(punto);

        estado = estados.PASEANDO;
        tiempoPaseo = 0;
    }

    function actualizarPaseo(delta) {

        tiempoPaseo += delta;

        if (moverHaciaDestino(delta)) {

            destino = null;

            estado = estados.BUSCANDO;
            tiempoEstado = 0;

            return;
        }

        if (tiempoPaseo > config.tiempoPaseo * 2) {

            destino = null;
            estado = estados.BUSCANDO;
            tiempoEstado = 0;
        }
    }

    // =====================================================
    // BUSCAR PRODUCTO
    // =====================================================

    function buscarProducto() {

        if (compras.length >= config.maximoProductos) {

            // El cliente queda disponible para que el main
            // le indique cuándo dirigirse a la caja.
            estado = estados.ESPERANDO;
            tiempoEstado = 0;

            return;
        }

        const disponibles = listarProductosDisponibles();

        if (!disponibles.length) {

            console.info(
                '[CLIENTE] No hay productos disponibles. Iniciando recorrido.'
            );

            iniciarPaseo();

            return;
        }

        const candidatos = disponibles
            .map(objeto => {

                const posicion = obtenerPosicionMundo(objeto);

                return {
                    objeto,
                    posicion,
                    distancia: distanciaXZ(grupo.position, posicion)
                };
            })
            .filter(item =>
                item.distancia < config.distanciaMaximaBusqueda
            );

        const elegido = elegirProducto(candidatos);

        if (!elegido) {
            iniciarPaseo();
            return;
        }

        productoObjetivo = elegido.objeto;

        productosReservadosGlobal.set(
            productoObjetivo.uuid,
            grupo.uuid
        );

        productoObjetivo.userData.reservado = true;

        const posicion = elegido.posicion;

        const dx = grupo.position.x - posicion.x;
        const dz = grupo.position.z - posicion.z;

        const longitud = Math.max(
            0.001,
            Math.hypot(dx, dz)
        );

        establecerDestino({
            x: posicion.x + (dx / longitud) * config.distanciaFrenteProducto,
            z: posicion.z + (dz / longitud) * config.distanciaFrenteProducto
        });

        estado = estados.ACERCANDO;
    }

    // =====================================================
    // RESERVAS
    // =====================================================

    function liberarReservaProducto() {

        if (!productoObjetivo) return;

        productosReservadosGlobal.delete(
            productoObjetivo.uuid
        );

        if (productoObjetivo.userData) {
            productoObjetivo.userData.reservado = false;
        }

        productoObjetivo = null;
    }

    // =====================================================
    // RECOGER PRODUCTO
    // =====================================================

    function animarRecogida(delta) {

        tiempoEstado += delta;

        const progreso = THREE.MathUtils.clamp(
            tiempoEstado / config.tiempoSeleccionProducto,
            0,
            1
        );

        const fase = Math.sin(progreso * Math.PI);

        animarArticulaciones(
            articulaciones.brazoDerecho,
            -fase
        );

        const brazoProvisional = provisional.getObjectByName(
            'BRAZO_DERECHO'
        );

        if (brazoProvisional) {
            brazoProvisional.rotation.x = -fase;
            brazoProvisional.rotation.z = -fase * 0.25;
        }

        if (modeloCargado) {
            modeloCargado.rotation.x = -fase * 0.06;
        }

        if (progreso >= 1) {

            if (!probabilidadEvaluada) {
                probabilidadEvaluada = true;

                debeComprar =
                    Math.random() <= config.probabilidadCompra;
            }

            if (debeComprar) {

                iniciarAnimacionGuardar();

            } else {

                restaurarPostura();
                liberarReservaProducto();

                estado = estados.ESPERANDO;
                tiempoEstado = 0;
            }
        }
    }

    // =====================================================
    // GUARDAR PRODUCTO
    // =====================================================

    function iniciarAnimacionGuardar() {

        if (!productoObjetivo) {

            liberarReservaProducto();

            estado = estados.BUSCANDO;

            return;
        }

        const objeto = productoObjetivo;

        productoOriginal = {
            objeto,
            padre: objeto.parent,
            posicion: objeto.position.clone(),
            quaternion: objeto.quaternion.clone(),
            escala: objeto.scale.clone(),
            visible: objeto.visible,
            posicionMundo: objeto.getWorldPosition(
                new THREE.Vector3()
            )
        };

        scene.attach(objeto);

        productoEnMano = objeto;

        tiempoEstado = 0;

        estado = estados.GUARDANDO;
    }

    function actualizarAnimacionGuardar(delta) {

        if (!productoEnMano || !productoOriginal) {

            restaurarPostura();

            estado = estados.ESPERANDO;
            tiempoEstado = 0;

            return;
        }

        tiempoEstado += delta;

        const objeto = productoEnMano;

        const progreso = THREE.MathUtils.clamp(
            tiempoEstado / config.tiempoGuardarProducto,
            0,
            1
        );

        const posicionMano = new THREE.Vector3(
            0.28,
            1.05,
            0.18
        );

        grupo.localToWorld(posicionMano);

        const destinoVisual = posicionMano.clone();

        if (progreso > 0.55 && config.carrito?.grupo) {

            const cesta = config.carrito.grupo;
            const centroCesta = new THREE.Vector3();

            cesta.getWorldPosition(centroCesta);

            destinoVisual.lerp(
                centroCesta,
                THREE.MathUtils.clamp(
                    (progreso - 0.55) / 0.45,
                    0,
                    1
                )
            );
        }

        objeto.position.lerpVectors(
            productoOriginal.posicionMundo,
            destinoVisual,
            progreso
        );

        objeto.scale.copy(
            productoOriginal.escala
        ).multiplyScalar(1 - progreso * 0.15);

        const faseBrazo = Math.sin(progreso * Math.PI);

        animarArticulaciones(
            articulaciones.brazoDerecho,
            -faseBrazo * 0.8
        );

        const brazo = provisional.getObjectByName(
            'BRAZO_DERECHO'
        );

        if (brazo) {
            brazo.rotation.x = -faseBrazo * 0.8;
        }

        if (progreso >= 1) {
            terminarGuardarProducto();
        }
    }

    function restaurarProductoOriginal() {

        if (!productoOriginal) return;

        const datos = productoOriginal;
        const objeto = datos.objeto;

        if (!objeto) return;

        const padre = datos.padre || scene;

        padre.attach(objeto);

        objeto.position.copy(datos.posicion);
        objeto.quaternion.copy(datos.quaternion);
        objeto.scale.copy(datos.escala);
        objeto.visible = datos.visible;
    }

    function terminarGuardarProducto() {

        const objeto = productoEnMano;

        if (!objeto) return;

        const datos = objeto.userData || {};

        const nombre =
            datos.nombreProducto ||
            datos.nombreVisible ||
            datos.nombreUnidad ||
            datos.nombre ||
            objeto.name ||
            'Producto';

        const codigo =
            datos.codigoProducto ||
            datos.codigoCatalogo ||
            datos.skuProducto ||
            datos.codigo ||
            objeto.name ||
            objeto.uuid;

        const registro = {
            id: datos.idUnidadProducto || objeto.uuid,
            uuid: objeto.uuid,
            codigo,
            nombre,
            precio: Number(datos.precio ?? 0),
            categoria: datos.categoria || 'General',
            objeto
        };

        const carrito = config.carrito;

        if (!carrito?.agregarProducto) {

            restaurarProductoOriginal();

            productoEnMano = null;
            productoOriginal = null;

            liberarReservaProducto();

            restaurarPostura();

            estado = estados.ESPERANDO;
            tiempoEstado = 0;

            return;
        }

        objeto.scale.copy(productoOriginal.escala);

        const agregado = carrito.agregarProducto(registro);

        if (agregado === false) {

            restaurarProductoOriginal();

            productoEnMano = null;
            productoOriginal = null;

            liberarReservaProducto();

            restaurarPostura();

            estado = estados.ESPERANDO;
            tiempoEstado = 0;

            return;
        }

        compras.push(registro);

        productosCompradosGlobal.add(objeto.uuid);

        datos.esUnidadProducto = true;
        datos.enCarrito = true;
        datos.recogido = true;
        datos.disponible = false;
        datos.reservado = false;

        productoEnMano = null;
        productoOriginal = null;

        liberarReservaProducto();

        restaurarPostura();

        if (typeof config.alComprar === 'function') {
            config.alComprar(registro, api);
        }

        estado = estados.ESPERANDO;
        tiempoEstado = 0;
    }

    // =====================================================
    // ACTUALIZACIÓN DE COMPRA
    // =====================================================

    function actualizarCompra(delta) {

        if (estado === estados.BUSCANDO) {

            buscarProducto();

            return;
        }

        if (estado === estados.ACERCANDO) {

            if (!productoObjetivo || !productoObjetivo.parent) {

                liberarReservaProducto();

                estado = estados.BUSCANDO;
                tiempoEstado = 0;

                return;
            }

            const posicion = obtenerPosicionMundo(
                productoObjetivo
            );

            const distancia = distanciaXZ(
                grupo.position,
                posicion
            );

            if (distancia <= config.distanciaProducto) {

                estado = estados.RECOGIENDO;
                tiempoEstado = 0;

                animarCaminar(false);

                return;
            }

            if (moverHaciaDestino(delta)) {

                estado = estados.RECOGIENDO;
                tiempoEstado = 0;
            }

            return;
        }

        if (estado === estados.RECOGIENDO) {

            animarRecogida(delta);

            return;
        }

        if (estado === estados.GUARDANDO) {

            actualizarAnimacionGuardar(delta);

            return;
        }

        if (estado === estados.ESPERANDO) {

            tiempoEstado += delta;

            if (
                compras.length >= config.maximoProductos &&
                config.maximoProductos > 0
            ) {
                // Esperar a que main.js indique el pago.
                return;
            }

            if (tiempoEstado >= config.tiempoEntreProductos) {

                probabilidadEvaluada = false;
                debeComprar = false;

                estado = estados.BUSCANDO;
                tiempoEstado = 0;
            }
        }
    }

    // =====================================================
    // RUTAS
    // =====================================================

    function establecerRuta(nuevaRuta, repetir = config.repetirRuta) {

        ruta = Array.isArray(nuevaRuta)
            ? nuevaRuta.map(punto => limitarPosicion({
                x: Number(punto.x),
                z: Number(punto.z)
            }))
            : [];

        indiceRuta = 0;

        config.repetirRuta = repetir;

        destino = null;

        estado = ruta.length
            ? estados.RUTA
            : estados.BUSCANDO;

        tiempoEstado = 0;
    }

    function actualizarRuta(delta) {

        if (!ruta.length) {

            if (estado === estados.ENTRANDO) {
                finalizarEntrada();

            } else if (estado === estados.REGRESANDO) {
                finalizarRegreso();

            } else {
                estado = estados.BUSCANDO;
            }

            return;
        }

        if (!destino) {
            establecerDestino(ruta[indiceRuta]);
        }

        if (moverHaciaDestino(delta)) {

            indiceRuta++;
            destino = null;

            if (indiceRuta >= ruta.length) {

                if (config.repetirRuta && estado === estados.RUTA) {

                    indiceRuta = 0;

                } else {

                    ruta = [];
                    indiceRuta = 0;

                    if (estado === estados.ENTRANDO) {

                        finalizarEntrada();

                    } else if (estado === estados.REGRESANDO) {

                        finalizarRegreso();

                    } else {

                        estado = estados.BUSCANDO;
                        tiempoEstado = 0;
                    }
                }
            }
        }
    }

    // =====================================================
    // ENTRADA DESDE VEHÍCULO
    // =====================================================

    function ejecutarCallbackEntrada() {

        if (callbackEntradaEjecutado) return;

        callbackEntradaEjecutado = true;

        if (typeof config.alEntrar === 'function') {
            config.alEntrar(api);
        }
    }

    function iniciarDesdeVehiculo(posicionEntrada, plaza) {

        if (eliminado || !posicionEntrada || !plaza) return;

        plazaVehiculo = { ...plaza };

        grupo.position.set(
            posicionEntrada.x,
            posicionEntrada.y || 0,
            posicionEntrada.z
        );

        entro = false;
        pagoConfirmado = false;
        compraConfirmada = false;

        compras.length = 0;
        zonasVisitadas.clear();
        ultimaZona = null;

        productosCompradosGlobal.clear();

        callbackEntradaEjecutado = false;

        ejecutarCallbackEntrada();

        establecerRuta([
            {
                x: posicionEntrada.x,
                z: posicionEntrada.z + 1
            },
            {
                x: posicionEntrada.x,
                z: 45
            },
            {
                x: posicionEntrada.x,
                z: 34
            },
            {
                x: 0,
                z: 31
            },
            {
                x: 0,
                z: 29
            },
            {
                x: 0,
                z: 26
            },
            {
                x: 0,
                z: 23
            }
        ], false);

        estado = estados.ENTRANDO;
    }

    function finalizarEntrada() {

        if (entro) return;

        entro = true;

        destino = null;

        estado = estados.BUSCANDO;
        tiempoEstado = 0;
    }

    // =====================================================
    // CAJA Y PAGO
    // =====================================================

    function iniciarPago(posicionCaja, callback) {

        if (eliminado || !posicionCaja) return;

        liberarReservaProducto();

        callbackPago = callback || null;

        estado = estados.CAJA;

        establecerDestino({
            x: posicionCaja.x,
            z: posicionCaja.z
        });
    }

    function completarPago() {

        if (pagoConfirmado || eliminado) return;

        estado = estados.PAGANDO;

        pagoConfirmado = true;
        compraConfirmada = true;

        const resumen = obtenerResumenCompra();

        if (config.carrito?.confirmarVenta) {
            config.carrito.confirmarVenta();
        }

        if (typeof config.alPagar === 'function') {
            config.alPagar(resumen, api);
        }

        const callback = callbackPago;
        callbackPago = null;

        if (callback) {
            callback(resumen);
        }
    }

    // =====================================================
    // REGRESO AL VEHÍCULO
    // =====================================================

    function iniciarRegresoVehiculo(plaza, callback) {

        if (eliminado || !plaza) return;

        plazaVehiculo = { ...plaza };
        callbackRegreso = callback || null;

        liberarReservaProducto();

        destino = null;

        establecerRuta([
            { x: 0, z: 23 },
            { x: 0, z: 26 },
            { x: 0, z: 29 },
            { x: 0, z: 34 },
            { x: plaza.x, z: 40 },
            { x: plaza.x, z: 45 },
            { x: plaza.x, z: plaza.z }
        ], false);

        estado = estados.REGRESANDO;
    }

    function finalizarRegreso() {

        estado = estados.FINALIZADO;

        destino = null;

        animarCaminar(false);

        const callback = callbackRegreso;
        callbackRegreso = null;

        if (callback) {
            callback(api);
        }

        if (typeof config.alFinalizar === 'function') {
            config.alFinalizar(api);
        }
    }

    // =====================================================
    // INFORMACIÓN DE COMPRAS
    // =====================================================

    function obtenerCompras() {
        return [...compras];
    }

    function obtenerTotalCompra() {

        return compras.reduce(
            (total, producto) => total + producto.precio,
            0
        );
    }

    function obtenerResumenCompra() {

        return {
            cantidad: compras.length,
            total: obtenerTotalCompra(),
            productos: obtenerCompras()
        };
    }

    function confirmarCompra() {

        compraConfirmada = true;

        return obtenerResumenCompra();
    }

    // =====================================================
    // CONFIGURAR COMPRAS
    // =====================================================

    function configurarCompras(opciones = {}) {

        if (opciones.productos !== undefined) {
            config.productos = opciones.productos;
        }

        if (opciones.carrito !== undefined) {
            config.carrito = opciones.carrito;
        }

        if (opciones.probabilidadCompra !== undefined) {

            config.probabilidadCompra =
                THREE.MathUtils.clamp(
                    opciones.probabilidadCompra,
                    0,
                    1
                );
        }

        if (opciones.maximoProductos !== undefined) {

            config.maximoProductos = Math.max(
                1,
                Math.floor(opciones.maximoProductos)
            );
        }

        if (opciones.velocidad !== undefined) {

            velocidad = Math.max(
                0.1,
                opciones.velocidad
            );
        }

        if (opciones.tiempoSeleccionProducto !== undefined) {

            config.tiempoSeleccionProducto = Math.max(
                0.1,
                opciones.tiempoSeleccionProducto
            );
        }

        if (opciones.tiempoEntreProductos !== undefined) {

            config.tiempoEntreProductos = Math.max(
                0.1,
                opciones.tiempoEntreProductos
            );
        }

        if (opciones.tiempoPaseo !== undefined) {

            config.tiempoPaseo = Math.max(
                1,
                opciones.tiempoPaseo
            );
        }

        if (estado !== estados.ENTRANDO && estado !== estados.REGRESANDO) {

            estado = estados.BUSCANDO;
            tiempoEstado = 0;
        }
    }

    // =====================================================
    // POSICIÓN
    // =====================================================

    function establecerPosicion(posicion) {

        if (!posicion) return;

        grupo.position.set(
            posicion.x ?? grupo.position.x,
            posicion.y ?? grupo.position.y,
            posicion.z ?? grupo.position.z
        );
    }

    // =====================================================
    // ACTUALIZACIÓN PRINCIPAL
    // =====================================================

    function actualizar(delta = 0.016) {

        if (eliminado) return;

        const dt = Math.min(
            Math.max(delta, 0),
            0.05
        );

        if (mixer) {
            mixer.update(dt);
        }

        switch (estado) {

            case estados.INACTIVO:
            case estados.FINALIZADO:
            case estados.PAGANDO:

                animarCaminar(false);

                break;

            case estados.ENTRANDO:
            case estados.RUTA:
            case estados.REGRESANDO:

                actualizarRuta(dt);

                break;

            case estados.PASEANDO:

                actualizarPaseo(dt);

                break;

            case estados.BUSCANDO:
            case estados.ACERCANDO:
            case estados.RECOGIENDO:
            case estados.GUARDANDO:
            case estados.ESPERANDO:

                actualizarCompra(dt);

                break;

            case estados.CAJA:

                if (moverHaciaDestino(dt)) {
                    completarPago();
                }

                break;
        }
    }

    // =====================================================
    // ELIMINAR
    // =====================================================

    function eliminar() {

        if (eliminado) return;

        eliminado = true;

        liberarReservaProducto();

        if (productoEnMano && productoOriginal) {
            restaurarProductoOriginal();
        }

        productoEnMano = null;
        productoOriginal = null;

        mixer?.stopAllAction();

        grupo.removeFromParent();

        grupo.traverse(objeto => {

            if (!objeto.isMesh) return;

            // No destruir productos ni recursos compartidos.
            if (objeto.userData?.esUnidadProducto) {
                return;
            }

            // Evitar liberar recursos que pueden compartirse
            // con otros clientes o modelos.
            // La geometría y los materiales se dejan al gestor
            // general de la escena.

        });

        compras.length = 0;
    }

    // =====================================================
    // API PÚBLICA
    // =====================================================

    const api = {

        grupo,

        actualizar,

        establecerRuta,
        establecerPosicion,

        configurarCompras,

        iniciarDesdeVehiculo,
        iniciarRegresoVehiculo,
        iniciarPago,

        obtenerCompras,
        obtenerTotalCompra,
        obtenerResumenCompra,

        confirmarCompra,

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
            return obtenerResumenCompra();
        },

        get productoEnMano() {
            return productoEnMano;
        },

        get productoObjetivo() {
            return productoObjetivo;
        },

        get zona() {
            return estado;
        },

        get animacionDisponible() {
            return Boolean(
                accionCaminar ||
                articulaciones.piernaIzquierda.length ||
                articulaciones.piernaDerecha.length
            );
        }
    };

    cargarModelo();

    return api;
}
