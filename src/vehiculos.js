
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// SISTEMA DE VEHÍCULOS DEL SUPERMERCADO
// 7 modelos en rotación secuencial
// 3 vehículos por tanda
// 24 cajones, 6 columnas x 4 filas
// ============================================================

const CONFIG_BASE = {
    modelos: [
        '/modelos/auto.glb',
        '/modelos/auto2.glb',
        '/modelos/auto3.glb',
        '/modelos/auto4.glb',
        '/modelos/auto5.glb',
        '/modelos/auto6.glb',
        '/modelos/auto7.glb'
    ],

    escala: 1,
    largoVehiculo: 4.3,
    anchoVehiculo: 1.9,

    velocidad: 5.5,
    aceleracion: 3.5,
    velocidadMaxima: 7,
    velocidadGiro: 2.5,

    vehiculosIniciales: 3,
    maxVehiculosPorTanda: 3,
    intervaloLlegada: 7,

    entradaX: 0,
    exteriorZ: 96,
    accesoZ: 75,
    carrilZ: 67,

    salidaX: 0,

    columnasEstacionamiento: [-24, -16, -8, 8, 16, 24],
    filasEstacionamiento: [36, 43, 50, 57],

    distanciaLlegada: 0.15,
    toleranciaMovimiento: 0.12,

    alEstacionar: null,
    alSalir: null,

    llegadasAutomaticas: true
};

// ============================================================
// UTILIDADES
// ============================================================

function limitar(valor, minimo, maximo) {
    return Math.max(minimo, Math.min(maximo, valor));
}

function distanciaXZ(a, b) {
    return Math.hypot(
        b.x - a.x,
        b.z - a.z
    );
}

function liberarModelo(modelo) {
    if (!modelo) return;

    modelo.traverse(objeto => {
        if (!objeto.isMesh) return;

        objeto.geometry?.dispose?.();

        if (Array.isArray(objeto.material)) {
            objeto.material.forEach(material => {
                material?.dispose?.();
            });
        } else {
            objeto.material?.dispose?.();
        }
    });
}

// ============================================================
// CREAR SISTEMA
// ============================================================

export function crearVehiculos(scene, opciones = {}) {

    if (!scene?.isScene && !scene?.isObject3D) {
        throw new Error(
            'crearVehiculos necesita una escena THREE válida.'
        );
    }

    const config = {
        ...CONFIG_BASE,
        ...opciones
    };

    config.modelos = Array.isArray(opciones.modelos)
        ? [...opciones.modelos]
        : [...CONFIG_BASE.modelos];

    config.largoVehiculo =
        opciones.longitudVehiculo ??
        opciones.largoVehiculo ??
        config.largoVehiculo;

    config.anchoVehiculo =
        opciones.anchoVehiculo ??
        config.anchoVehiculo;

    config.vehiculosIniciales =
        opciones.cochesIniciales ??
        opciones.vehiculosIniciales ??
        config.vehiculosIniciales;

    config.maxVehiculosPorTanda =
        opciones.maximoPorTanda ??
        opciones.maxVehiculosPorTanda ??
        config.maxVehiculosPorTanda;

    config.intervaloLlegada =
        opciones.tiempoEntreLlegadas ??
        opciones.intervaloLlegada ??
        config.intervaloLlegada;

    config.llegadasAutomaticas =
        opciones.llegadasAutomaticas ??
        config.llegadasAutomaticas;

    config.velocidad = Math.max(0.1, config.velocidad);
    config.aceleracion = Math.max(0.1, config.aceleracion);
    config.velocidadMaxima = Math.max(
        config.velocidad,
        config.velocidadMaxima
    );

    config.intervaloLlegada = Math.max(
        0.1,
        config.intervaloLlegada
    );

    const loader = new GLTFLoader();

    const grupoSistema = new THREE.Group();
    grupoSistema.name = 'SISTEMA_VEHICULOS';

    scene.add(grupoSistema);

    const vehiculos = [];
    const plazas = [];

    let contadorVehiculos = 0;
    let contadorTandas = 0;

    let indiceModelo = 0;

    let tandaActiva = false;
    let vehiculosPendientesTanda = 0;
    let vehiculosSalidosTanda = 0;
    let vehiculosTotalesTanda = 0;

    let tiempoLlegada = 0;
    let sistemaEliminado = false;
    let preparandoSiguienteTanda = false;

    let comprobacionCargaPendiente = false;

    // ========================================================
    // MODELOS
    // ========================================================

    function obtenerSiguienteModelo() {
        if (!config.modelos.length) return null;

        const modelo = config.modelos[
            indiceModelo % config.modelos.length
        ];

        indiceModelo++;

        return modelo;
    }

    // ========================================================
    // CARGA SEGURA DE MODELOS
    // ========================================================

    function cargarModelo(vehiculo, rutaModelo) {

        if (sistemaEliminado || !vehiculo) return;

        if (!rutaModelo) {
            vehiculo.estado = 'ERROR';
            vehiculo.errorCarga = true;
            vehiculo.modeloCargado = false;
            return;
        }

        // Identificador para evitar cargas antiguas.
        const token = ++vehiculo.tokenCarga;

        vehiculo.estado = 'CARGANDO';
        vehiculo.modeloCargado = false;
        vehiculo.errorCarga = false;
        vehiculo.rutaModelo = rutaModelo;

        if (vehiculo.modelo) {
            vehiculo.grupo.remove(vehiculo.modelo);

            liberarModelo(vehiculo.modelo);

            vehiculo.modelo = null;
        }

        console.info(
            `[VEHICULOS] Cargando ${vehiculo.id}: ${rutaModelo}`
        );

        loader.load(
            rutaModelo,

            gltf => {

                // El sistema pudo eliminarse o la carga pudo quedar obsoleta.
                if (
                    sistemaEliminado ||
                    vehiculo.tokenCarga !== token
                ) {
                    liberarModelo(gltf.scene);
                    return;
                }

                const modelo = gltf.scene;
                modelo.name = `${vehiculo.id}_MODELO`;

                modelo.traverse(objeto => {
                    if (!objeto.isMesh) return;

                    objeto.castShadow = false;
                    objeto.receiveShadow = false;

                    if (objeto.material) {
                        const materiales = Array.isArray(objeto.material)
                            ? objeto.material
                            : [objeto.material];

                        materiales.forEach(material => {
                            material.side = THREE.DoubleSide;
                        });
                    }
                });

                // Centrar el modelo.
                modelo.updateMatrixWorld(true);

                const caja = new THREE.Box3().setFromObject(modelo);

                if (!caja.isEmpty()) {
                    const centro = caja.getCenter(
                        new THREE.Vector3()
                    );

                    modelo.position.x -= centro.x;
                    modelo.position.z -= centro.z;
                    modelo.position.y -= caja.min.y;
                }

                // Calcular dimensiones originales.
                modelo.updateMatrixWorld(true);

                const cajaAjuste = new THREE.Box3().setFromObject(modelo);
                const dimensiones = cajaAjuste.getSize(
                    new THREE.Vector3()
                );

                const mayor = Math.max(
                    dimensiones.x,
                    dimensiones.z
                );

                if (mayor > 0.0001) {
                    const escalaFinal =
                        config.escala *
                        (config.largoVehiculo / mayor);

                    modelo.scale.multiplyScalar(escalaFinal);
                }

                modelo.updateMatrixWorld(true);

                const cajaFinal = new THREE.Box3().setFromObject(modelo);
                const dimensionesFinales = cajaFinal.getSize(
                    new THREE.Vector3()
                );

                vehiculo.dimensiones.largo = dimensionesFinales.z;
                vehiculo.dimensiones.ancho = dimensionesFinales.x;

                vehiculo.grupo.add(modelo);

                vehiculo.modelo = modelo;
                vehiculo.modeloCargado = true;
                vehiculo.errorCarga = false;
                vehiculo.estado = 'ESPERANDO';

                vehiculo.grupo.visible = false;

                console.info(
                    `[VEHICULOS] ${vehiculo.id} listo: ${rutaModelo}`
                );
            },

            undefined,

            error => {

                if (
                    sistemaEliminado ||
                    vehiculo.tokenCarga !== token
                ) {
                    return;
                }

                console.error(
                    `[VEHICULOS] Error cargando ${rutaModelo}:`,
                    error
                );

                vehiculo.errorCarga = true;
                vehiculo.modeloCargado = false;
                vehiculo.estado = 'ERROR';

                // No se deja bloqueado el sistema.
                if (!preparandoSiguienteTanda) {
                    intentarRecuperarVehiculo(vehiculo);
                }
            }
        );
    }

    function intentarRecuperarVehiculo(vehiculo) {

        if (
            sistemaEliminado ||
            !vehiculo ||
            vehiculo.estado !== 'ERROR' ||
            !config.modelos.length
        ) {
            return;
        }

        // Se limita el número de intentos.
        vehiculo.intentosCarga++;

        if (vehiculo.intentosCarga > config.modelos.length) {
            console.error(
                `[VEHICULOS] No fue posible recuperar ${vehiculo.id}.`
            );

            return;
        }

        const siguiente = obtenerSiguienteModelo();

        console.warn(
            `[VEHICULOS] Reintentando ${vehiculo.id} con ${siguiente}`
        );

        cargarModelo(vehiculo, siguiente);
    }

    // ========================================================
    // PLAZAS
    // ========================================================

    for (const z of config.filasEstacionamiento) {
        for (const x of config.columnasEstacionamiento) {

            plazas.push({
                id: `PLAZA_${plazas.length + 1}`,
                x,
                z,
                ocupada: false,
                reservada: false,
                vehiculoId: null
            });
        }
    }

    function obtenerPlazaDisponible() {

        const disponibles = plazas.filter(plaza =>
            !plaza.ocupada &&
            !plaza.reservada
        );

        if (!disponibles.length) return null;

        return disponibles[
            Math.floor(Math.random() * disponibles.length)
        ];
    }

    function obtenerVehiculoDisponible() {

        return vehiculos.find(vehiculo =>
            vehiculo.estado === 'ESPERANDO' &&
            vehiculo.modeloCargado &&
            !vehiculo.plaza
        ) || null;
    }

    // ========================================================
    // CREAR VEHÍCULO
    // ========================================================

    function crearVehiculo() {

        if (sistemaEliminado) return null;

        const rutaModelo = obtenerSiguienteModelo();

        if (!rutaModelo) {
            console.error(
                '[VEHICULOS] No hay modelos configurados.'
            );

            return null;
        }

        const id = `VEHICULO_${++contadorVehiculos}`;

        const grupo = new THREE.Group();
        grupo.name = id;

        grupo.position.set(
            config.entradaX,
            0,
            config.exteriorZ
        );

        grupo.visible = false;

        grupoSistema.add(grupo);

        const vehiculo = {

            id,
            grupo,
            modelo: null,
            rutaModelo,

            plaza: null,

            dimensiones: {
                largo: config.largoVehiculo,
                ancho: config.anchoVehiculo
            },

            estado: 'CARGANDO',

            velocidadActual: 0,

            ruta: [],
            indiceRuta: 0,
            objetivo: null,

            tanda: null,

            modeloCargado: false,
            errorCarga: false,

            tokenCarga: 0,
            intentosCarga: 0
        };

        vehiculos.push(vehiculo);

        cargarModelo(vehiculo, rutaModelo);

        return vehiculo;
    }

    // ========================================================
    // RUTAS
    // ========================================================

    function establecerRuta(vehiculo, puntos, estado) {

        if (!vehiculo || !Array.isArray(puntos)) {
            return false;
        }

        vehiculo.ruta = puntos.map(punto => ({
            x: punto.x,
            z: punto.z
        }));

        vehiculo.indiceRuta = 0;
        vehiculo.estado = estado;
        vehiculo.velocidadActual = 0;

        vehiculo.objetivo = vehiculo.ruta[0] || null;

        return true;
    }

    // ========================================================
    // ORIENTACIÓN
    // ========================================================

    function orientarVehiculo(vehiculo, destino, delta) {

        const dx = destino.x - vehiculo.grupo.position.x;
        const dz = destino.z - vehiculo.grupo.position.z;

        if (Math.abs(dx) + Math.abs(dz) < 0.0001) {
            return;
        }

        const anguloObjetivo = Math.atan2(dx, dz);

        let diferencia =
            anguloObjetivo - vehiculo.grupo.rotation.y;

        diferencia = Math.atan2(
            Math.sin(diferencia),
            Math.cos(diferencia)
        );

        vehiculo.grupo.rotation.y += limitar(
            diferencia,
            -config.velocidadGiro * delta,
            config.velocidadGiro * delta
        );
    }

    // ========================================================
    // CALLBACKS
    // ========================================================

    function ejecutarCallback(nombre, datos) {

        const callback = config[nombre];

        if (typeof callback !== 'function') return;

        try {
            callback(datos);
        } catch (error) {
            console.error(
                `[VEHICULOS] Error en ${nombre}:`,
                error
            );
        }
    }

    // ========================================================
    // FINALIZAR LLEGADA
    // ========================================================

    function finalizarLlegada(vehiculo) {

        if (!vehiculo?.plaza) return;

        const plaza = vehiculo.plaza;

        vehiculo.grupo.position.set(
            plaza.x,
            0,
            plaza.z
        );

        vehiculo.grupo.rotation.y = Math.PI;

        vehiculo.estado = 'ESTACIONADO';
        vehiculo.velocidadActual = 0;

        vehiculo.ruta = [];
        vehiculo.indiceRuta = 0;
        vehiculo.objetivo = null;

        plaza.ocupada = true;
        plaza.reservada = false;
        plaza.vehiculoId = vehiculo.id;

        console.info(
            `[VEHICULOS] ${vehiculo.id} estacionado en ${plaza.id}`
        );

        ejecutarCallback('alEstacionar', {
            vehiculo,
            plaza,
            tanda: vehiculo.tanda
        });
    }

    // ========================================================
    // PREPARAR SIGUIENTE TANDA
    // ========================================================

    function prepararSiguienteTanda() {

        if (
            sistemaEliminado ||
            preparandoSiguienteTanda
        ) {
            return;
        }

        preparandoSiguienteTanda = true;

        console.info(
            '[VEHICULOS] Preparando siguiente tanda.'
        );

        if (!vehiculos.length) {
            preparandoSiguienteTanda = false;
            return;
        }

        for (const vehiculo of vehiculos) {

            // No permitir que una plaza antigua quede ocupada.
            if (vehiculo.plaza) {
                vehiculo.plaza.ocupada = false;
                vehiculo.plaza.reservada = false;
                vehiculo.plaza.vehiculoId = null;
            }

            vehiculo.plaza = null;
            vehiculo.tanda = null;

            vehiculo.grupo.visible = false;

            vehiculo.grupo.position.set(
                config.entradaX,
                0,
                config.exteriorZ
            );

            vehiculo.intentosCarga = 0;

            const nuevoModelo = obtenerSiguienteModelo();

            cargarModelo(vehiculo, nuevoModelo);
        }

        comprobacionCargaPendiente = true;
    }

    function comprobarCarga() {

        if (!comprobacionCargaPendiente) return;

        const todosListos = vehiculos.every(vehiculo =>
            vehiculo.modeloCargado ||
            vehiculo.errorCarga
        );

        if (!todosListos) return;

        // Recuperar vehículos con error.
        const errores = vehiculos.filter(
            vehiculo => vehiculo.errorCarga
        );

        if (errores.length > 0) {
            for (const vehiculo of errores) {
                intentarRecuperarVehiculo(vehiculo);
            }

            const quedanCargando = vehiculos.some(
                vehiculo => vehiculo.estado === 'CARGANDO'
            );

            if (quedanCargando) return;
        }

        comprobacionCargaPendiente = false;
        preparandoSiguienteTanda = false;

        console.info(
            '[VEHICULOS] Preparación de tanda finalizada.'
        );
    }

    // ========================================================
    // FINALIZAR SALIDA
    // ========================================================

    function finalizarSalida(vehiculo) {

        const plazaAnterior = vehiculo.plaza;

        if (plazaAnterior) {
            plazaAnterior.ocupada = false;
            plazaAnterior.reservada = false;
            plazaAnterior.vehiculoId = null;
        }

        vehiculo.grupo.position.set(
            config.salidaX,
            0,
            config.exteriorZ
        );

        vehiculo.grupo.visible = false;

        vehiculo.estado = 'ESPERANDO';
        vehiculo.velocidadActual = 0;

        vehiculo.ruta = [];
        vehiculo.indiceRuta = 0;
        vehiculo.objetivo = null;

        vehiculo.plaza = null;

        console.info(
            `[VEHICULOS] ${vehiculo.id} salió del estacionamiento.`
        );

        ejecutarCallback('alSalir', {
            vehiculo,
            plaza: plazaAnterior,
            tanda: vehiculo.tanda
        });

        // Contabilizar salida.
        if (tandaActiva) {

            vehiculosSalidosTanda++;

            console.info(
                `[VEHICULOS] Salidas: ${vehiculosSalidosTanda}/${vehiculosTotalesTanda}`
            );

            if (
                vehiculosSalidosTanda >= vehiculosTotalesTanda &&
                vehiculosPendientesTanda <= 0
            ) {
                tandaActiva = false;
                tiempoLlegada = 0;

                prepararSiguienteTanda();
            }
        }
    }

    // ========================================================
    // MOVIMIENTO
    // ========================================================

    function actualizarMovimiento(vehiculo, delta) {

        if (!vehiculo.ruta.length) return;

        if (
            vehiculo.indiceRuta >=
            vehiculo.ruta.length
        ) {

            if (vehiculo.estado === 'LLEGANDO') {
                finalizarLlegada(vehiculo);
            }

            if (vehiculo.estado === 'SALIENDO') {
                finalizarSalida(vehiculo);
            }

            return;
        }

        const destino = vehiculo.ruta[
            vehiculo.indiceRuta
        ];

        const posicion = vehiculo.grupo.position;

        const distancia = distanciaXZ(
            posicion,
            destino
        );

        if (distancia < config.toleranciaMovimiento) {

            vehiculo.indiceRuta++;

            if (
                vehiculo.indiceRuta >=
                vehiculo.ruta.length
            ) {

                if (vehiculo.estado === 'LLEGANDO') {
                    finalizarLlegada(vehiculo);
                }

                if (vehiculo.estado === 'SALIENDO') {
                    finalizarSalida(vehiculo);
                }

                return;
            }

            vehiculo.objetivo =
                vehiculo.ruta[vehiculo.indiceRuta];

            return;
        }

        // Aceleración gradual.
        vehiculo.velocidadActual = Math.min(
            vehiculo.velocidadActual +
                config.aceleracion * delta,
            config.velocidadMaxima
        );

        const velocidad = Math.min(
            vehiculo.velocidadActual,
            config.velocidad
        );

        orientarVehiculo(
            vehiculo,
            destino,
            delta
        );

        const avance = Math.min(
            velocidad * delta,
            distancia
        );

        posicion.x +=
            ((destino.x - posicion.x) / distancia) *
            avance;

        posicion.z +=
            ((destino.z - posicion.z) / distancia) *
            avance;
    }

    // ========================================================
    // SOLICITAR LLEGADA
    // ========================================================

    function solicitarLlegada() {

        if (
            sistemaEliminado ||
            !tandaActiva ||
            vehiculosPendientesTanda <= 0
        ) {
            return null;
        }

        const plaza = obtenerPlazaDisponible();

        if (!plaza) {
            console.warn(
                '[VEHICULOS] No hay plazas disponibles.'
            );

            return null;
        }

        const vehiculo = obtenerVehiculoDisponible();

        if (!vehiculo) {
            console.warn(
                '[VEHICULOS] No hay vehículos disponibles.'
            );

            return null;
        }

        // Reservar plaza.
        plaza.reservada = true;
        plaza.ocupada = false;
        plaza.vehiculoId = vehiculo.id;

        vehiculo.plaza = plaza;
        vehiculo.tanda = contadorTandas;

        vehiculo.grupo.visible = true;

        vehiculo.grupo.position.set(
            config.entradaX,
            0,
            config.exteriorZ
        );

        establecerRuta(
            vehiculo,
            [
                {
                    x: config.entradaX,
                    z: config.exteriorZ
                },
                {
                    x: config.entradaX,
                    z: config.accesoZ
                },
                {
                    x: config.entradaX,
                    z: config.carrilZ
                },
                {
                    x: plaza.x,
                    z: config.carrilZ
                },
                {
                    x: plaza.x,
                    z: plaza.z
                }
            ],
            'LLEGANDO'
        );

        vehiculosPendientesTanda--;

        console.info(
            `[VEHICULOS] ${vehiculo.id} entrando. Modelo: ${vehiculo.rutaModelo}`
        );

        return vehiculo;
    }

    // ========================================================
    // INICIAR TANDA
    // ========================================================

    function solicitarTanda(
        cantidad = config.maxVehiculosPorTanda
    ) {

        if (
            sistemaEliminado ||
            tandaActiva ||
            preparandoSiguienteTanda
        ) {
            return false;
        }

        const disponibles = plazas.filter(plaza =>
            !plaza.ocupada &&
            !plaza.reservada
        ).length;

        const vehiculosListos = vehiculos.filter(
            vehiculo =>
                vehiculo.estado === 'ESPERANDO' &&
                vehiculo.modeloCargado &&
                !vehiculo.plaza
        ).length;

        const cantidadFinal = Math.min(
            Math.max(0, Math.floor(cantidad)),
            Math.max(0, config.maxVehiculosPorTanda),
            disponibles,
            vehiculosListos
        );

        if (cantidadFinal <= 0) {
            console.warn(
                '[VEHICULOS] No hay vehículos listos o plazas disponibles.'
            );

            return false;
        }

        contadorTandas++;

        tandaActiva = true;

        vehiculosPendientesTanda = cantidadFinal;
        vehiculosSalidosTanda = 0;
        vehiculosTotalesTanda = cantidadFinal;

        tiempoLlegada = 0;

        console.info(
            `[VEHICULOS] INICIANDO TANDA ${contadorTandas}. Vehículos: ${cantidadFinal}`
        );

        // Primer vehículo inmediato.
        solicitarLlegada();

        return true;
    }

    // ========================================================
    // SOLICITAR SALIDA
    // ========================================================

    function solicitarSalida(vehiculoOrId) {

        const vehiculo =
            typeof vehiculoOrId === 'string'
                ? vehiculos.find(v => v.id === vehiculoOrId)
                : vehiculoOrId;

        if (!vehiculo) {
            console.warn(
                '[VEHICULOS] Vehículo no encontrado.'
            );

            return false;
        }

        if (
            vehiculo.estado !== 'ESTACIONADO' ||
            !vehiculo.plaza
        ) {
            console.warn(
                `[VEHICULOS] ${vehiculo.id} no está estacionado.`
            );

            return false;
        }

        const plaza = vehiculo.plaza;

        establecerRuta(
            vehiculo,
            [
                {
                    x: plaza.x,
                    z: plaza.z
                },
                {
                    x: plaza.x,
                    z: config.carrilZ
                },
                {
                    x: config.salidaX,
                    z: config.carrilZ
                },
                {
                    x: config.salidaX,
                    z: config.accesoZ
                },
                {
                    x: config.salidaX,
                    z: config.exteriorZ
                }
            ],
            'SALIENDO'
        );

        console.info(
            `[VEHICULOS] ${vehiculo.id} saliendo del estacionamiento.`
        );

        return true;
    }

    // ========================================================
    // ACTUALIZAR
    // ========================================================

    function actualizar(delta = 0.016) {

        if (sistemaEliminado) return;

        delta = limitar(delta, 0, 0.05);

        // Revisar cargas.
        comprobarCarga();

        // Actualizar movimiento.
        for (const vehiculo of vehiculos) {

            if (
                vehiculo.estado === 'LLEGANDO' ||
                vehiculo.estado === 'SALIENDO'
            ) {
                actualizarMovimiento(
                    vehiculo,
                    delta
                );
            }
        }

        if (!config.llegadasAutomaticas) return;

        if (preparandoSiguienteTanda) return;

        // Crear nueva tanda.
        if (!tandaActiva) {

            tiempoLlegada += delta;

            if (
                tiempoLlegada >=
                config.intervaloLlegada
            ) {

                tiempoLlegada = 0;

                solicitarTanda(
                    config.maxVehiculosPorTanda
                );
            }

            return;
        }

        // Llegadas escalonadas.
        if (vehiculosPendientesTanda > 0) {

            tiempoLlegada += delta;

            if (
                tiempoLlegada >=
                config.intervaloLlegada
            ) {

                tiempoLlegada = 0;

                solicitarLlegada();
            }
        }
    }

    // ========================================================
    // ESTADO DEL SISTEMA
    // ========================================================

    function obtenerEstado() {

        return {

            totalVehiculos: vehiculos.length,

            esperando: vehiculos.filter(
                v => v.estado === 'ESPERANDO'
            ).length,

            cargando: vehiculos.filter(
                v => v.estado === 'CARGANDO'
            ).length,

            errores: vehiculos.filter(
                v => v.estado === 'ERROR'
            ).length,

            llegando: vehiculos.filter(
                v => v.estado === 'LLEGANDO'
            ).length,

            estacionados: vehiculos.filter(
                v => v.estado === 'ESTACIONADO'
            ).length,

            saliendo: vehiculos.filter(
                v => v.estado === 'SALIENDO'
            ).length,

            plazasOcupadas: plazas.filter(
                p => p.ocupada || p.reservada
            ).length,

            plazasDisponibles: plazas.filter(
                p => !p.ocupada && !p.reservada
            ).length,

            tandaActiva,

            tandaActual: contadorTandas,

            vehiculosPendientesTanda,

            vehiculosSalidosTanda,

            vehiculosTotalesTanda,

            preparandoSiguienteTanda
        };
    }

    // ========================================================
    // INICIO
    // ========================================================

    const cantidadInicial = Math.min(
        Math.max(
            1,
            Math.floor(config.vehiculosIniciales)
        ),
        Math.max(
            1,
            Math.floor(config.maxVehiculosPorTanda)
        ),
        config.modelos.length
    );

    for (let i = 0; i < cantidadInicial; i++) {
        crearVehiculo();
    }

    console.info('[VEHICULOS] Sistema iniciado.');

    console.info(
        `[VEHICULOS] Modelos disponibles: ${config.modelos.length}.`
    );

    console.info(
        `[VEHICULOS] Vehículos activos: ${cantidadInicial}.`
    );

    console.info(
        `[VEHICULOS] Máximo por tanda: ${config.maxVehiculosPorTanda}.`
    );

    console.info(
        `[VEHICULOS] Plazas: ${plazas.length}.`
    );

    // ========================================================
    // ELIMINAR
    // ========================================================

    function eliminar() {

        if (sistemaEliminado) return;

        sistemaEliminado = true;

        for (const vehiculo of vehiculos) {

            // Invalidar cargas pendientes.
            vehiculo.tokenCarga++;

            if (vehiculo.modelo) {
                liberarModelo(vehiculo.modelo);
                vehiculo.modelo = null;
            }

            vehiculo.grupo.removeFromParent();
            vehiculo.grupo.clear();
        }

        scene.remove(grupoSistema);

        vehiculos.length = 0;
        plazas.length = 0;

        comprobacionCargaPendiente = false;

        tandaActiva = false;
        preparandoSiguienteTanda = false;

        console.info(
            '[VEHICULOS] Sistema eliminado correctamente.'
        );
    }

    // ========================================================
    // API PÚBLICA
    // ========================================================

    return {

        actualizar,
        actualizarCompleto: actualizar,

        solicitarLlegada,
        solicitarTanda,
        solicitarSalida,

        obtenerEstado,

        eliminar,

        vehiculos,
        plazas,

        grupo: grupoSistema,

        get tandaActiva() {
            return tandaActiva;
        },

        get tandaActual() {
            return contadorTandas;
        },

        get preparandoSiguienteTanda() {
            return preparandoSiguienteTanda;
        },

        get eliminado() {
            return sistemaEliminado;
        }
    };
}
