
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

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
    longitudVehiculo: 4.3,
    anchoVehiculo: 1.9,

    velocidad: 5.5,
    aceleracion: 3.5,
    velocidadMaxima: 7,

    cochesIniciales: 3,
    maximoPorTanda: 3,
    tiempoEntreLlegadas: 7,

    entrada: {
        x: 0,
        zExterior: 96,
        zAcceso: 83,
        zFrente: 29
    },

    salida: {
        x: 0,
        zAcceso: 83,
        zExterior: 96
    },

    estacionamiento: {
        columnas: [-24, -16, -8, 8, 16, 24],
        filas: [32, 39, 46, 53]
    },

    alEstacionar: null,
    alSalir: null
};

const ESTADOS = {
    CARGANDO: 'cargando',
    ESPERANDO: 'esperando',
    ENTRANDO: 'entrando',
    ESTACIONADO: 'estacionado',
    SALIENDO: 'saliendo',
    ERROR: 'error'
};

export function crearVehiculos(scene, opciones = {}) {
    if (!scene || !scene.isScene) {
        throw new Error(
            'crearVehiculos necesita una THREE.Scene válida.'
        );
    }

    const config = {
        ...CONFIG_BASE,
        ...opciones,

        entrada: {
            ...CONFIG_BASE.entrada,
            ...(opciones.entrada || {})
        },

        salida: {
            ...CONFIG_BASE.salida,
            ...(opciones.salida || {})
        },

        estacionamiento: {
            ...CONFIG_BASE.estacionamiento,
            ...(opciones.estacionamiento || {})
        }
    };

    if (!Array.isArray(config.modelos) || config.modelos.length === 0) {
        throw new Error('No hay modelos GLB configurados.');
    }

    const grupo = new THREE.Group();
    grupo.name = 'SISTEMA_VEHICULOS';
    scene.add(grupo);

    const vehiculos = [];
    const plazas = [];
    const colaLlegadas = [];

    let siguienteModelo = 0;
    let siguienteId = 0;
    let siguienteSolicitud = 0;
    let tandaActual = 0;

    let inicialesProcesados = false;
    let eliminado = false;

    // =====================================================
    // CREAR PLAZAS
    // =====================================================

    function crearPlazas() {
        let numero = 0;

        for (const z of config.estacionamiento.filas) {
            for (const x of config.estacionamiento.columnas) {
                plazas.push({
                    id: ++numero,
                    x,
                    z,
                    ocupada: false,
                    vehiculo: null
                });
            }
        }

        console.log(
            `[VEHICULOS] ${plazas.length} plazas creadas.`
        );
    }

    crearPlazas();

    function obtenerPlazaLibre() {
        return plazas.find(plaza => !plaza.ocupada);
    }

    // =====================================================
    // CREAR VEHÍCULO
    // =====================================================

    function crearVehiculo() {
        const id = ++siguienteId;

        const grupoVehiculo = new THREE.Group();
        grupoVehiculo.name = `VEHICULO_${id}`;

        grupo.add(grupoVehiculo);

        const vehiculo = {
            id,
            grupo: grupoVehiculo,
            modelo: null,

            modeloIndex: null,
            rutaModelo: null,
            modeloCargado: false,
            errorModelo: null,

            plaza: null,
            estado: ESTADOS.CARGANDO,

            velocidadActual: 0,
            velocidadObjetivo: Math.min(
                config.velocidad,
                config.velocidadMaxima
            ),

            ruta: [],
            indiceRuta: 0,

            solicitudId: null,
            ruedas: [],
            visible: true
        };

        vehiculos.push(vehiculo);

        cargarModelo(vehiculo);

        return vehiculo;
    }

    // =====================================================
    // CARGAR LOS SIETE MODELOS GLB
    // =====================================================

    function cargarModelo(vehiculo) {
        const indice = siguienteModelo % config.modelos.length;
        const rutaModelo = config.modelos[indice];

        siguienteModelo++;

        vehiculo.modeloIndex = indice;
        vehiculo.rutaModelo = rutaModelo;

        console.log(
            `[VEHICULOS] Vehículo ${vehiculo.id}: ${rutaModelo}`
        );

        loader.load(
            rutaModelo,

            gltf => {
                if (eliminado) return;

                const modelo = gltf.scene;

                modelo.name = `MODELO_GLTF_${indice + 1}`;

                // Conservar materiales y colores originales de Blender.
                modelo.traverse(objeto => {
                    if (!objeto.isMesh) return;

                    objeto.castShadow = false;
                    objeto.receiveShadow = false;
                });

                const caja = new THREE.Box3().setFromObject(modelo);

                if (caja.isEmpty()) {
                    vehiculo.estado = ESTADOS.ERROR;
                    vehiculo.errorModelo = 'Modelo sin geometría.';

                    console.error(
                        `[VEHICULOS] ${rutaModelo} no contiene geometría.`
                    );

                    procesarCola();
                    return;
                }

                const centro = new THREE.Vector3();
                const tamano = new THREE.Vector3();

                caja.getCenter(centro);
                caja.getSize(tamano);

                // Centrar y colocar el vehículo sobre el suelo.
                modelo.position.x -= centro.x;
                modelo.position.z -= centro.z;
                modelo.position.y -= caja.min.y;

                modelo.scale.multiplyScalar(config.escala);

                vehiculo.grupo.add(modelo);

                vehiculo.modelo = modelo;
                vehiculo.modeloCargado = true;
                vehiculo.estado = ESTADOS.ESPERANDO;
                vehiculo.dimensiones = tamano.multiplyScalar(
                    config.escala
                );

                console.log(
                    `%c[VEHICULOS] Cargado: ${rutaModelo}`,
                    'color: green; font-weight: bold;'
                );

                // Si ya existen solicitudes de llegada, procesarlas.
                procesarCola();
            },

            progreso => {
                if (progreso.total > 0) {
                    const porcentaje = (
                        progreso.loaded / progreso.total * 100
                    ).toFixed(0);

                    console.log(
                        `[VEHICULOS] ${rutaModelo}: ${porcentaje}%`
                    );
                }
            },

            error => {
                if (eliminado) return;

                vehiculo.estado = ESTADOS.ERROR;
                vehiculo.errorModelo = error;

                console.error(
                    `[VEHICULOS] ERROR al cargar ${rutaModelo}:`,
                    error
                );

                console.error(
                    `Comprueba que exista public${rutaModelo}`
                );

                procesarCola();
            }
        );
    }

    // =====================================================
    // ASIGNAR RUTA
    // =====================================================

    function asignarRuta(vehiculo, puntos, estado) {
        vehiculo.ruta = puntos.map(punto =>
            new THREE.Vector3(
                punto.x,
                0,
                punto.z
            )
        );

        vehiculo.indiceRuta = 0;
        vehiculo.estado = estado;
        vehiculo.velocidadActual = 0;

        if (vehiculo.ruta.length > 0) {
            vehiculo.grupo.position.set(
                vehiculo.ruta[0].x,
                0,
                vehiculo.ruta[0].z
            );
        }
    }

    // =====================================================
    // ORIENTACIÓN
    // =====================================================

    function orientarVehiculo(vehiculo, direccion) {
        if (direccion.lengthSq() < 0.00001) return;

        vehiculo.grupo.rotation.y = Math.atan2(
            direccion.x,
            direccion.z
        );
    }

    // =====================================================
    // MOVIMIENTO
    // =====================================================

    function moverVehiculo(vehiculo, delta) {
        if (!vehiculo.ruta.length) return false;

        const destino = vehiculo.ruta[vehiculo.indiceRuta];

        if (!destino) return false;

        const posicion = vehiculo.grupo.position;

        const dx = destino.x - posicion.x;
        const dz = destino.z - posicion.z;

        const distancia = Math.sqrt(
            dx * dx + dz * dz
        );

        if (distancia < 0.15) {
            posicion.x = destino.x;
            posicion.z = destino.z;

            vehiculo.indiceRuta++;

            return vehiculo.indiceRuta >= vehiculo.ruta.length;
        }

        const direccion = new THREE.Vector3(
            dx,
            0,
            dz
        ).normalize();

        orientarVehiculo(vehiculo, direccion);

        vehiculo.velocidadActual = Math.min(
            vehiculo.velocidadActual +
            config.aceleracion * delta,

            vehiculo.velocidadObjetivo
        );

        const avance = Math.min(
            distancia,
            vehiculo.velocidadActual * delta
        );

        posicion.x += direccion.x * avance;
        posicion.z += direccion.z * avance;

        return false;
    }

    // =====================================================
    // LLEGADA DE VEHÍCULOS
    // =====================================================

    function iniciarLlegada(vehiculo, plaza, solicitudId) {
        if (
            !vehiculo.modeloCargado ||
            !plaza ||
            plaza.ocupada
        ) {
            return false;
        }

        plaza.ocupada = true;
        plaza.vehiculo = vehiculo;

        vehiculo.plaza = plaza;
        vehiculo.solicitudId = solicitudId;

        vehiculo.grupo.visible = true;

        const ruta = [
            {
                x: config.entrada.x,
                z: config.entrada.zExterior
            },
            {
                x: config.entrada.x,
                z: config.entrada.zAcceso
            },
            {
                x: plaza.x,
                z: config.entrada.zFrente
            },
            {
                x: plaza.x,
                z: plaza.z
            }
        ];

        asignarRuta(
            vehiculo,
            ruta,
            ESTADOS.ENTRANDO
        );

        console.log(
            `[VEHICULOS] Vehículo ${vehiculo.id} entrando a plaza ${plaza.id}.`
        );

        return true;
    }

    function finalizarLlegada(vehiculo) {
        vehiculo.estado = ESTADOS.ESTACIONADO;
        vehiculo.velocidadActual = 0;

        console.log(
            `[VEHICULOS] Vehículo ${vehiculo.id} estacionado.`
        );

        // CONEXIÓN CON LOS CLIENTES DE MAIN.JS.
        // Este callback debe crear el cliente correspondiente.
        if (typeof config.alEstacionar === 'function') {
            config.alEstacionar({
                vehiculo,
                plaza: vehiculo.plaza,
                tanda: tandaActual
            });
        }
    }

    // =====================================================
    // SALIDA DE VEHÍCULOS
    // =====================================================

    function solicitarSalida(vehiculoOId) {
        const vehiculo = typeof vehiculoOId === 'number'
            ? vehiculos.find(v => v.id === vehiculoOId)
            : vehiculoOId;

        if (
            !vehiculo ||
            vehiculo.estado !== ESTADOS.ESTACIONADO
        ) {
            return false;
        }

        if (!vehiculo.plaza) return false;

        const plaza = vehiculo.plaza;

        const ruta = [
            {
                x: plaza.x,
                z: plaza.z
            },
            {
                x: plaza.x,
                z: config.entrada.zFrente
            },
            {
                x: config.salida.x,
                z: config.salida.zAcceso
            },
            {
                x: config.salida.x,
                z: config.salida.zExterior
            }
        ];

        asignarRuta(
            vehiculo,
            ruta,
            ESTADOS.SALIENDO
        );

        console.log(
            `[VEHICULOS] Vehículo ${vehiculo.id} saliendo.`
        );

        return true;
    }

    function finalizarSalida(vehiculo) {
        const plaza = vehiculo.plaza;

        if (plaza) {
            plaza.ocupada = false;
            plaza.vehiculo = null;
        }

        vehiculo.plaza = null;
        vehiculo.estado = ESTADOS.ESPERANDO;
        vehiculo.velocidadActual = 0;
        vehiculo.ruta = [];
        vehiculo.indiceRuta = 0;
        vehiculo.grupo.visible = false;

        if (typeof config.alSalir === 'function') {
            config.alSalir({
                vehiculo,
                plaza,
                tanda: tandaActual
            });
        }

        console.log(
            `[VEHICULOS] Vehículo ${vehiculo.id} salió del estacionamiento.`
        );

        procesarCola();
    }

    // =====================================================
    // PROCESAR COLA
    // =====================================================

    function procesarCola() {
        if (eliminado || colaLlegadas.length === 0) return;

        const disponibles = vehiculos.filter(
            vehiculo =>
                vehiculo.estado === ESTADOS.ESPERANDO &&
                vehiculo.modeloCargado
        );

        while (
            colaLlegadas.length > 0 &&
            disponibles.length > 0
        ) {
            const solicitud = colaLlegadas[0];
            const plaza = obtenerPlazaLibre();

            if (!plaza) {
                console.warn(
                    '[VEHICULOS] No hay plazas libres.'
                );
                return;
            }

            const vehiculo = disponibles.shift();

            colaLlegadas.shift();

            iniciarLlegada(
                vehiculo,
                plaza,
                solicitud.id
            );
        }
    }

    // =====================================================
    // SOLICITAR LLEGADAS
    // =====================================================

    function solicitarLlegada(cantidad = 1) {
        const cantidadValida = Math.max(
            1,
            Math.floor(Number(cantidad) || 1)
        );

        let solicitadas = 0;

        for (let i = 0; i < cantidadValida; i++) {
            if (
                !obtenerPlazaLibre() &&
                colaLlegadas.length === 0
            ) {
                break;
            }

            const solicitud = {
                id: ++siguienteSolicitud,
                tanda: tandaActual + 1
            };

            colaLlegadas.push(solicitud);
            solicitadas++;
        }

        procesarCola();

        return solicitadas;
    }

    // =====================================================
    // SOLICITAR TANDA
    // =====================================================

    function solicitarTanda(
        cantidad = config.maximoPorTanda
    ) {
        const cantidadSolicitada = Math.max(
            1,
            Math.floor(Number(cantidad) || 1)
        );

        const libres = plazas.filter(
            plaza => !plaza.ocupada
        ).length;

        const cantidadReal = Math.min(
            cantidadSolicitada,
            libres
        );

        if (cantidadReal <= 0) {
            console.warn(
                '[VEHICULOS] No hay plazas disponibles.'
            );

            return 0;
        }

        tandaActual++;

        const agregados = solicitarLlegada(cantidadReal);

        console.log(
            `[VEHICULOS] Tanda ${tandaActual}: ${agregados} vehículos.`
        );

        return agregados;
    }

    // =====================================================
    // INICIAR VEHÍCULOS INICIALES
    // =====================================================

    function procesarIniciales() {
        if (inicialesProcesados || eliminado) return;

        inicialesProcesados = true;

        solicitarTanda(config.cochesIniciales);
    }

    // =====================================================
    // ACTUALIZAR
    // =====================================================

    function actualizar(delta) {
        if (eliminado) return;

        // CORRECCIÓN PRINCIPAL:
        // Iniciar las llegadas aunque main.js llame a actualizar().
        procesarIniciales();

        const dt = Math.min(
            Math.max(delta || 0, 0),
            0.05
        );

        for (const vehiculo of vehiculos) {
            if (
                vehiculo.estado !== ESTADOS.ENTRANDO &&
                vehiculo.estado !== ESTADOS.SALIENDO
            ) {
                continue;
            }

            const estadoAnterior = vehiculo.estado;

            const terminado = moverVehiculo(
                vehiculo,
                dt
            );

            if (!terminado) continue;

            if (estadoAnterior === ESTADOS.ENTRANDO) {
                finalizarLlegada(vehiculo);
            }

            if (estadoAnterior === ESTADOS.SALIENDO) {
                finalizarSalida(vehiculo);
            }
        }

        procesarCola();
    }

    function actualizarCompleto(delta) {
        procesarIniciales();
        actualizar(delta);
    }

    // =====================================================
    // CONSULTAR ESTADO
    // =====================================================

    function obtenerEstado() {
        return {
            totalVehiculos: vehiculos.length,

            cargando: vehiculos.filter(
                v => v.estado === ESTADOS.CARGANDO
            ).length,

            conError: vehiculos.filter(
                v => v.estado === ESTADOS.ERROR
            ).length,

            entrando: vehiculos.filter(
                v => v.estado === ESTADOS.ENTRANDO
            ).length,

            estacionados: vehiculos.filter(
                v => v.estado === ESTADOS.ESTACIONADO
            ).length,

            saliendo: vehiculos.filter(
                v => v.estado === ESTADOS.SALIENDO
            ).length,

            plazasLibres: plazas.filter(
                p => !p.ocupada
            ).length,

            plazasOcupadas: plazas.filter(
                p => p.ocupada
            ).length,

            solicitudesEnCola: colaLlegadas.length,

            tandaActual
        };
    }

    // =====================================================
    // ELIMINAR SISTEMA
    // =====================================================

    function eliminar() {
        eliminado = true;

        for (const vehiculo of vehiculos) {
            if (vehiculo.grupo.parent) {
                vehiculo.grupo.parent.remove(
                    vehiculo.grupo
                );
            }
        }

        if (grupo.parent) {
            grupo.parent.remove(grupo);
        }

        vehiculos.length = 0;
        plazas.length = 0;
        colaLlegadas.length = 0;

        console.log('[VEHICULOS] Sistema eliminado.');
    }

    // =====================================================
    // CREAR VEHÍCULOS INICIALES
    // =====================================================

    for (let i = 0; i < config.cochesIniciales; i++) {
        crearVehiculo();
    }

    // =====================================================
    // API PÚBLICA
    // =====================================================

    return {
        grupo,

        actualizar,
        actualizarCompleto,

        solicitarLlegada,
        solicitarTanda,
        solicitarSalida,

        obtenerEstado,
        eliminar,

        get vehiculos() {
            return vehiculos;
        },

        get plazas() {
            return plazas;
        },

        get tandaActiva() {
            return tandaActual;
        },

        get tandaActual() {
            return tandaActual;
        }
    };
}
