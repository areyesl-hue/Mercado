
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

    alEstacionar: null,
    alSalir: null,
    llegadasAutomaticas: true
};

function limitar(valor, minimo, maximo) {
    return Math.max(minimo, Math.min(maximo, valor));
}

function distanciaXZ(a, b) {
    return Math.hypot(b.x - a.x, b.z - a.z);
}

export function crearVehiculos(scene, opciones = {}) {
    if (!scene) {
        throw new Error('crearVehiculos necesita una THREE.Scene.');
    }

    const config = {
        ...CONFIG_BASE,
        ...opciones
    };

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

    const loader = new GLTFLoader();

    const grupoSistema = new THREE.Group();
    grupoSistema.name = 'SISTEMA_VEHICULOS';
    scene.add(grupoSistema);

    const vehiculos = [];
    const plazas = [];

    let contadorVehiculos = 0;
    let contadorTandas = 0;

    // Control de tandas
    let tandaActiva = false;
    let vehiculosPendientesTanda = 0;
    let vehiculosSalidosTanda = 0;
    let vehiculosTotalesTanda = 0;

    let tiempoLlegada = 0;
    let sistemaEliminado = false;
    let preparandoSiguienteTanda = false;

    // Rotación secuencial de los siete modelos
    let indiceModelo = 0;

    // --------------------------------------------------------
    // MODELOS: ASIGNACIÓN SECUENCIAL POR TANDAS
    // --------------------------------------------------------

    function obtenerSiguienteModelo() {
        if (!config.modelos || config.modelos.length === 0) {
            return null;
        }

        const modelo = config.modelos[indiceModelo];

        indiceModelo++;

        if (indiceModelo >= config.modelos.length) {
            indiceModelo = 0;
        }

        return modelo;
    }

    // --------------------------------------------------------
    // LIBERAR MODELO ANTERIOR
    // --------------------------------------------------------

    function liberarModelo(modelo) {
        if (!modelo) return;

        modelo.traverse(objeto => {
            if (objeto.geometry) {
                objeto.geometry.dispose();
            }

            if (objeto.material) {
                const materiales = Array.isArray(objeto.material)
                    ? objeto.material
                    : [objeto.material];

                for (const material of materiales) {
                    material.dispose();
                }
            }
        });
    }

    // --------------------------------------------------------
    // CARGAR O CAMBIAR MODELO DE UN VEHÍCULO
    // --------------------------------------------------------

    function cargarModelo(vehiculo, rutaModelo) {
        if (sistemaEliminado) return;

        if (!rutaModelo) {
            vehiculo.estado = 'ERROR';
            vehiculo.errorCarga = true;
            return;
        }

        vehiculo.estado = 'CARGANDO';
        vehiculo.modeloCargado = false;
        vehiculo.errorCarga = false;
        vehiculo.rutaModelo = rutaModelo;

        const modeloAnterior = vehiculo.modelo;

        if (modeloAnterior) {
            vehiculo.grupo.remove(modeloAnterior);
            liberarModelo(modeloAnterior);
            vehiculo.modelo = null;
        }

        console.log(
            `[VEHICULOS] Cargando ${vehiculo.id}: ${rutaModelo}`
        );

        loader.load(
            rutaModelo,

            gltf => {
                if (sistemaEliminado) {
                    liberarModelo(gltf.scene);
                    return;
                }

                const modelo = gltf.scene;
                modelo.name = `${vehiculo.id}_MODELO`;

                // Centrar modelo
                const caja = new THREE.Box3().setFromObject(modelo);
                const centro = new THREE.Vector3();

                caja.getCenter(centro);

                modelo.position.x -= centro.x;
                modelo.position.z -= centro.z;
                modelo.position.y -= caja.min.y;

                // Ajustar escala
                const cajaAjuste = new THREE.Box3().setFromObject(modelo);
                const dimensiones = new THREE.Vector3();

                cajaAjuste.getSize(dimensiones);

                const mayor = Math.max(
                    dimensiones.x,
                    dimensiones.z
                );

                if (mayor > 0) {
                    const escalaFinal =
                        config.escala * (config.largoVehiculo / mayor);

                    modelo.scale.multiplyScalar(escalaFinal);
                }

                modelo.updateMatrixWorld(true);

                const cajaFinal = new THREE.Box3().setFromObject(modelo);
                const dimensionesFinales = new THREE.Vector3();

                cajaFinal.getSize(dimensionesFinales);

                vehiculo.dimensiones.largo = dimensionesFinales.z;
                vehiculo.dimensiones.ancho = dimensionesFinales.x;

                vehiculo.grupo.add(modelo);

                vehiculo.modelo = modelo;
                vehiculo.modeloCargado = true;
                vehiculo.errorCarga = false;
                vehiculo.estado = 'ESPERANDO';

                vehiculo.grupo.visible = false;

                console.log(
                    `[VEHICULOS] ${vehiculo.id} listo: ${rutaModelo}`
                );
            },

            undefined,

            error => {
                if (sistemaEliminado) return;

                console.error(
                    `[VEHICULOS] Error cargando ${rutaModelo}:`,
                    error
                );

                vehiculo.errorCarga = true;
                vehiculo.modeloCargado = false;
                vehiculo.estado = 'ERROR';
            }
        );
    }

    // --------------------------------------------------------
    // PLAZAS
    // --------------------------------------------------------

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
        const disponibles = plazas.filter(
            p => !p.ocupada && !p.reservada
        );

        if (disponibles.length === 0) return null;

        const indice = Math.floor(
            Math.random() * disponibles.length
        );

        return disponibles[indice];
    }

    function obtenerVehiculoDisponible() {
        return vehiculos.find(v =>
            v.estado === 'ESPERANDO' &&
            v.modeloCargado &&
            !v.plaza
        ) || null;
    }

    // --------------------------------------------------------
    // CREAR LOS TRES VEHÍCULOS BASE
    // --------------------------------------------------------

    function crearVehiculo() {
        if (sistemaEliminado) return null;

        const rutaModelo = obtenerSiguienteModelo();

        if (!rutaModelo) {
            console.error('[VEHICULOS] No hay modelos configurados.');
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
            errorCarga: false
        };

        vehiculos.push(vehiculo);

        cargarModelo(vehiculo, rutaModelo);

        return vehiculo;
    }

    // --------------------------------------------------------
    // RUTAS
    // --------------------------------------------------------

    function establecerRuta(vehiculo, puntos, estado) {
        vehiculo.ruta = puntos.map(p => ({
            x: p.x,
            z: p.z
        }));

        vehiculo.indiceRuta = 0;
        vehiculo.estado = estado;
        vehiculo.velocidadActual = 0;
        vehiculo.objetivo = vehiculo.ruta[0] || null;
    }

    function orientarVehiculo(vehiculo, destino, delta) {
        const dx = destino.x - vehiculo.grupo.position.x;
        const dz = destino.z - vehiculo.grupo.position.z;

        if (Math.abs(dx) + Math.abs(dz) < 0.0001) return;

        const anguloObjetivo = Math.atan2(dx, dz);

        let diferencia =
            anguloObjetivo - vehiculo.grupo.rotation.y;

        while (diferencia > Math.PI) {
            diferencia -= Math.PI * 2;
        }

        while (diferencia < -Math.PI) {
            diferencia += Math.PI * 2;
        }

        vehiculo.grupo.rotation.y += limitar(
            diferencia,
            -2.5 * delta,
            2.5 * delta
        );
    }

    // --------------------------------------------------------
    // FINALIZAR ESTACIONAMIENTO
    // --------------------------------------------------------

    function finalizarLlegada(vehiculo) {
        if (!vehiculo.plaza) return;

        vehiculo.grupo.position.set(
            vehiculo.plaza.x,
            0,
            vehiculo.plaza.z
        );

        vehiculo.grupo.rotation.y = Math.PI;

        vehiculo.estado = 'ESTACIONADO';
        vehiculo.velocidadActual = 0;
        vehiculo.ruta = [];
        vehiculo.objetivo = null;

        vehiculo.plaza.ocupada = true;
        vehiculo.plaza.reservada = false;
        vehiculo.plaza.vehiculoId = vehiculo.id;

        console.log(
            `[VEHICULOS] ${vehiculo.id} estacionado en ${vehiculo.plaza.id}`
        );

        if (typeof config.alEstacionar === 'function') {
            try {
                config.alEstacionar({
                    vehiculo,
                    plaza: vehiculo.plaza,
                    tanda: vehiculo.tanda
                });
            } catch (error) {
                console.error(
                    '[VEHICULOS] Error en alEstacionar:',
                    error
                );
            }
        }
    }

    // --------------------------------------------------------
    // PREPARAR SIGUIENTE TANDA
    // --------------------------------------------------------

    function prepararSiguienteTanda() {
        if (sistemaEliminado || preparandoSiguienteTanda) return;

        preparandoSiguienteTanda = true;

        console.log(
            '[VEHICULOS] Los tres vehículos salieron. Preparando nuevos modelos...'
        );

        let pendientesCarga = vehiculos.length;

        if (pendientesCarga === 0) {
            preparandoSiguienteTanda = false;
            return;
        }

        for (const vehiculo of vehiculos) {
            const nuevoModelo = obtenerSiguienteModelo();

            vehiculo.tanda = null;
            vehiculo.plaza = null;
            vehiculo.grupo.visible = false;

            // Se cambia el modelo del mismo vehículo.
            cargarModelo(vehiculo, nuevoModelo);
        }

        // La siguiente tanda se habilita cuando todos los modelos
        // hayan terminado de cargar.
        function comprobarCarga() {
            if (sistemaEliminado) return;

            const todosListos = vehiculos.every(v =>
                v.modeloCargado || v.errorCarga
            );

            if (!todosListos) {
                return;
            }

            preparandoSiguienteTanda = false;

            const errores = vehiculos.filter(v => v.errorCarga);

            if (errores.length > 0) {
                console.error(
                    '[VEHICULOS] Hay modelos que no pudieron cargarse:',
                    errores.map(v => v.rutaModelo)
                );
            } else {
                console.log(
                    '[VEHICULOS] Nueva tanda de modelos lista.'
                );
            }
        }

        // La comprobación se realiza desde actualizar().
        comprobarCargaPendiente = comprobarCarga;
    }

    let comprobarCargaPendiente = null;

    // --------------------------------------------------------
    // FINALIZAR SALIDA
    // --------------------------------------------------------

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
        vehiculo.objetivo = null;
        vehiculo.plaza = null;

        console.log(
            `[VEHICULOS] ${vehiculo.id} salió del estacionamiento.`
        );

        if (typeof config.alSalir === 'function') {
            try {
                config.alSalir({
                    vehiculo,
                    plaza: plazaAnterior,
                    tanda: vehiculo.tanda
                });
            } catch (error) {
                console.error(
                    '[VEHICULOS] Error en alSalir:',
                    error
                );
            }
        }

        // Contabilizar la salida de la tanda actual.
        if (tandaActiva) {
            vehiculosSalidosTanda++;

            console.log(
                `[VEHICULOS] Salidas de tanda: ${vehiculosSalidosTanda}/${vehiculosTotalesTanda}`
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

    // --------------------------------------------------------
    // MOVIMIENTO
    // --------------------------------------------------------

    function actualizarMovimiento(vehiculo, delta) {
        if (!vehiculo.ruta.length) return;

        if (vehiculo.indiceRuta >= vehiculo.ruta.length) {
            if (vehiculo.estado === 'LLEGANDO') {
                finalizarLlegada(vehiculo);
            } else if (vehiculo.estado === 'SALIENDO') {
                finalizarSalida(vehiculo);
            }

            return;
        }

        const destino = vehiculo.ruta[vehiculo.indiceRuta];
        const posicion = vehiculo.grupo.position;

        const distancia = distanciaXZ(posicion, destino);

        if (distancia < 0.12) {
            vehiculo.indiceRuta++;

            if (vehiculo.indiceRuta >= vehiculo.ruta.length) {
                if (vehiculo.estado === 'LLEGANDO') {
                    finalizarLlegada(vehiculo);
                } else if (vehiculo.estado === 'SALIENDO') {
                    finalizarSalida(vehiculo);
                }

                return;
            }

            vehiculo.objetivo =
                vehiculo.ruta[vehiculo.indiceRuta];

            return;
        }

        vehiculo.velocidadActual = Math.min(
            vehiculo.velocidadActual +
                config.aceleracion * delta,
            config.velocidadMaxima
        );

        const velocidad = Math.min(
            vehiculo.velocidadActual,
            config.velocidad
        );

        orientarVehiculo(vehiculo, destino, delta);

        const avance = Math.min(
            velocidad * delta,
            distancia
        );

        posicion.x +=
            ((destino.x - posicion.x) / distancia) * avance;

        posicion.z +=
            ((destino.z - posicion.z) / distancia) * avance;
    }

    // --------------------------------------------------------
    // LLEGADA: EXTERIOR -> CARRIL POSTERIOR -> CAJÓN
    // --------------------------------------------------------

    function solicitarLlegada() {
        if (sistemaEliminado) return null;

        if (!tandaActiva || vehiculosPendientesTanda <= 0) {
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
                '[VEHICULOS] No hay vehículos listos.'
            );
            return null;
        }

        plaza.reservada = true;
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

        console.log(
            `[VEHICULOS] ${vehiculo.id} entrando. Modelo: ${vehiculo.rutaModelo}`
        );

        return vehiculo;
    }

    // --------------------------------------------------------
    // INICIAR TANDA
    // --------------------------------------------------------

    function solicitarTanda(cantidad = config.maxVehiculosPorTanda) {
        if (
            sistemaEliminado ||
            tandaActiva ||
            preparandoSiguienteTanda
        ) {
            return false;
        }

        const disponibles = plazas.filter(p =>
            !p.ocupada && !p.reservada
        ).length;

        const vehiculosListos = vehiculos.filter(v =>
            v.estado === 'ESPERANDO' &&
            v.modeloCargado &&
            !v.plaza
        ).length;

        const cantidadFinal = Math.min(
            Math.max(0, Math.floor(cantidad)),
            config.maxVehiculosPorTanda,
            disponibles,
            vehiculosListos
        );

        if (cantidadFinal <= 0) {
            console.warn(
                '[VEHICULOS] No hay suficientes vehículos listos o plazas disponibles.'
            );
            return false;
        }

        contadorTandas++;

        tandaActiva = true;
        vehiculosPendientesTanda = cantidadFinal;
        vehiculosSalidosTanda = 0;
        vehiculosTotalesTanda = cantidadFinal;

        tiempoLlegada = 0;

        console.log(
            `[VEHICULOS] INICIANDO TANDA ${contadorTandas}. Vehículos: ${cantidadFinal}`
        );

        // Primer vehículo de la tanda.
        solicitarLlegada();

        return true;
    }

    // --------------------------------------------------------
    // SALIDA: CAJÓN -> CARRIL POSTERIOR -> EXTERIOR
    // --------------------------------------------------------

    function solicitarSalida(vehiculoOrId) {
        const vehiculo = typeof vehiculoOrId === 'string'
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

        console.log(
            `[VEHICULOS] ${vehiculo.id} saliendo del estacionamiento.`
        );

        return true;
    }

    // --------------------------------------------------------
    // ACTUALIZACIÓN
    // --------------------------------------------------------

    function actualizar(delta = 0.016) {
        if (sistemaEliminado) return;

        delta = limitar(delta, 0, 0.05);

        // Comprobar si los modelos de la siguiente tanda
        // ya terminaron de cargar.
        if (comprobarCargaPendiente) {
            comprobarCargaPendiente();

            if (!preparandoSiguienteTanda) {
                comprobarCargaPendiente = null;
            }
        }

        // Movimiento de vehículos.
        for (const vehiculo of vehiculos) {
            if (
                vehiculo.estado === 'LLEGANDO' ||
                vehiculo.estado === 'SALIENDO'
            ) {
                actualizarMovimiento(vehiculo, delta);
            }
        }

        if (!config.llegadasAutomaticas) return;

        // No iniciar otra tanda mientras se cambian los modelos.
        if (preparandoSiguienteTanda) return;

        // Si no existe tanda activa, comenzar una nueva.
        if (!tandaActiva) {
            tiempoLlegada += delta;

            if (tiempoLlegada >= config.intervaloLlegada) {
                tiempoLlegada = 0;

                solicitarTanda(
                    config.maxVehiculosPorTanda
                );
            }

            return;
        }

        // Lanzar los siguientes vehículos de la tanda.
        if (vehiculosPendientesTanda > 0) {
            tiempoLlegada += delta;

            if (tiempoLlegada >= config.intervaloLlegada) {
                tiempoLlegada = 0;

                solicitarLlegada();
            }
        }
    }

    // --------------------------------------------------------
    // ESTADO DEL SISTEMA
    // --------------------------------------------------------

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
            preparandoSiguienteTanda
        };
    }

    // --------------------------------------------------------
    // INICIO
    // --------------------------------------------------------

    const cantidadInicial = Math.min(
        Math.max(1, Math.floor(config.vehiculosIniciales)),
        Math.max(1, Math.floor(config.maxVehiculosPorTanda)),
        config.modelos.length
    );

    for (let i = 0; i < cantidadInicial; i++) {
        crearVehiculo();
    }

    console.log('[VEHICULOS] Sistema iniciado.');
    console.log(
        `[VEHICULOS] Modelos disponibles: ${config.modelos.length}.`
    );
    console.log(
        `[VEHICULOS] Vehículos activos: ${cantidadInicial}.`
    );
    console.log(
        `[VEHICULOS] Máximo por tanda: ${config.maxVehiculosPorTanda}.`
    );
    console.log(
        `[VEHICULOS] Plazas: ${plazas.length}.`
    );

    // --------------------------------------------------------
    // ELIMINAR
    // --------------------------------------------------------

    function eliminar() {
        if (sistemaEliminado) return;

        sistemaEliminado = true;

        for (const vehiculo of vehiculos) {
            grupoSistema.remove(vehiculo.grupo);

            vehiculo.grupo.traverse(objeto => {
                if (objeto.geometry) {
                    objeto.geometry.dispose();
                }

                if (objeto.material) {
                    const materiales = Array.isArray(objeto.material)
                        ? objeto.material
                        : [objeto.material];

                    for (const material of materiales) {
                        material.dispose();
                    }
                }
            });
        }

        scene.remove(grupoSistema);

        vehiculos.length = 0;
        plazas.length = 0;
    }

    // --------------------------------------------------------
    // API PÚBLICA
    // --------------------------------------------------------

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
        }
    };
}
