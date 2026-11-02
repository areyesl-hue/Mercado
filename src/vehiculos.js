
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// SISTEMA DE VEHÍCULOS DEL SUPERMERCADO
// Rutas de circulación independientes del edificio
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
    let tandaActiva = false;
    let vehiculosPendientesTanda = 0;
    let tiempoLlegada = 0;
    let sistemaEliminado = false;

    // --------------------------------------------------------
    // VARIEDAD DE MODELOS
    // --------------------------------------------------------

    let bolsaModelos = [];
    let ultimoModelo = null;

    function mezclarModelos() {
        bolsaModelos = [...config.modelos];

        for (let i = bolsaModelos.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));

            [bolsaModelos[i], bolsaModelos[j]] =
                [bolsaModelos[j], bolsaModelos[i]];
        }

        if (
            bolsaModelos.length > 1 &&
            bolsaModelos[bolsaModelos.length - 1] === ultimoModelo
        ) {
            [
                bolsaModelos[0],
                bolsaModelos[bolsaModelos.length - 1]
            ] = [
                bolsaModelos[bolsaModelos.length - 1],
                bolsaModelos[0]
            ];
        }
    }

    function obtenerModeloAleatorio() {
        if (bolsaModelos.length === 0) {
            mezclarModelos();
        }

        const modelo = bolsaModelos.pop();
        ultimoModelo = modelo;

        return modelo;
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
    // CARGAR VEHÍCULO
    // --------------------------------------------------------

    function crearVehiculo() {
        if (sistemaEliminado) return null;

        if (!config.modelos?.length) {
            console.error('[VEHICULOS] No hay modelos configurados.');
            return null;
        }

        const rutaModelo = obtenerModeloAleatorio();

        const id = `VEHICULO_${++contadorVehiculos}`;
        const grupo = new THREE.Group();

        grupo.name = id;
        grupo.position.set(config.entradaX, 0, config.exteriorZ);
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

        loader.load(
            rutaModelo,
            gltf => {
                if (sistemaEliminado) {
                    gltf.scene.traverse(obj => {
                        if (obj.geometry) obj.geometry.dispose();
                    });
                    return;
                }

                const modelo = gltf.scene;
                modelo.name = `${id}_MODELO`;

                const caja = new THREE.Box3().setFromObject(modelo);
                const centro = new THREE.Vector3();
                caja.getCenter(centro);

                modelo.position.x -= centro.x;
                modelo.position.z -= centro.z;
                modelo.position.y -= caja.min.y;

                const cajaAjuste = new THREE.Box3().setFromObject(modelo);
                const dimensiones = new THREE.Vector3();
                cajaAjuste.getSize(dimensiones);

                const mayor = Math.max(dimensiones.x, dimensiones.z);

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

                grupo.add(modelo);

                vehiculo.modelo = modelo;
                vehiculo.modeloCargado = true;
                vehiculo.estado = 'ESPERANDO';
                grupo.visible = false;

                console.log(`[VEHICULOS] ${id} cargado: ${rutaModelo}`);
            },
            undefined,
            error => {
                if (sistemaEliminado) return;

                console.error(`[VEHICULOS] Error cargando ${rutaModelo}:`, error);
                vehiculo.errorCarga = true;
                vehiculo.estado = 'ERROR';
            }
        );

        return vehiculo;
    }

    // --------------------------------------------------------
    // RUTAS
    // --------------------------------------------------------

    function establecerRuta(vehiculo, puntos, estado) {
        vehiculo.ruta = puntos.map(p => ({ x: p.x, z: p.z }));
        vehiculo.indiceRuta = 0;
        vehiculo.estado = estado;
        vehiculo.velocidadActual = 0;
        vehiculo.objetivo = vehiculo.ruta[0] || null;
    }

    function orientarVehiculo(vehiculo, destino, delta) {
        const dx = destino.x - vehiculo.grupo.position.x;
        const dz = destino.z - vehiculo.grupo.position.z;

        if (Math.abs(dx) + Math.abs(dz) < 0.0001) return;

        // El frente del modelo apunta inicialmente hacia +Z.
        const anguloObjetivo = Math.atan2(dx, dz);
        let diferencia = anguloObjetivo - vehiculo.grupo.rotation.y;

        while (diferencia > Math.PI) diferencia -= Math.PI * 2;
        while (diferencia < -Math.PI) diferencia += Math.PI * 2;

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

        // Vehículos mirando hacia el supermercado (-Z).
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
                console.error('[VEHICULOS] Error en alEstacionar:', error);
            }
        }
    }

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

        console.log(`[VEHICULOS] ${vehiculo.id} salió del estacionamiento.`);

        if (typeof config.alSalir === 'function') {
            try {
                config.alSalir({
                    vehiculo,
                    plaza: plazaAnterior,
                    tanda: vehiculo.tanda
                });
            } catch (error) {
                console.error('[VEHICULOS] Error en alSalir:', error);
            }
        }
    }

    // --------------------------------------------------------
    // MOVIMIENTO
    // --------------------------------------------------------

    function actualizarMovimiento(vehiculo, delta) {
        if (!vehiculo.ruta.length) return;

        if (vehiculo.indiceRuta >= vehiculo.ruta.length) {
            if (vehiculo.estado === 'LLEGANDO') finalizarLlegada(vehiculo);
            else if (vehiculo.estado === 'SALIENDO') finalizarSalida(vehiculo);
            return;
        }

        const destino = vehiculo.ruta[vehiculo.indiceRuta];
        const posicion = vehiculo.grupo.position;
        const distancia = distanciaXZ(posicion, destino);

        if (distancia < 0.12) {
            vehiculo.indiceRuta++;

            if (vehiculo.indiceRuta >= vehiculo.ruta.length) {
                if (vehiculo.estado === 'LLEGANDO') finalizarLlegada(vehiculo);
                else if (vehiculo.estado === 'SALIENDO') finalizarSalida(vehiculo);
                return;
            }

            vehiculo.objetivo = vehiculo.ruta[vehiculo.indiceRuta];
            return;
        }

        vehiculo.velocidadActual = Math.min(
            vehiculo.velocidadActual + config.aceleracion * delta,
            config.velocidadMaxima
        );

        const velocidad = Math.min(
            vehiculo.velocidadActual,
            config.velocidad
        );

        orientarVehiculo(vehiculo, destino, delta);

        const avance = Math.min(velocidad * delta, distancia);
        posicion.x += ((destino.x - posicion.x) / distancia) * avance;
        posicion.z += ((destino.z - posicion.z) / distancia) * avance;
    }

    // --------------------------------------------------------
    // LLEGADA: EXTERIOR -> CARRIL POSTERIOR -> CAJÓN
    // --------------------------------------------------------

    function solicitarLlegada() {
        if (sistemaEliminado) return null;

        const plaza = obtenerPlazaDisponible();
        if (!plaza) {
            console.warn('[VEHICULOS] No hay plazas disponibles.');
            return null;
        }

        const vehiculo = obtenerVehiculoDisponible();
        if (!vehiculo) {
            console.warn('[VEHICULOS] No hay vehículos listos.');
            return null;
        }

        plaza.reservada = true;
        plaza.vehiculoId = vehiculo.id;
        vehiculo.plaza = plaza;

        vehiculo.grupo.visible = true;
        vehiculo.grupo.position.set(
            config.entradaX,
            0,
            config.exteriorZ
        );

        establecerRuta(
            vehiculo,
            [
                { x: config.entradaX, z: config.exteriorZ },
                { x: config.entradaX, z: config.accesoZ },
                { x: config.entradaX, z: config.carrilZ },
                { x: plaza.x, z: config.carrilZ },
                { x: plaza.x, z: plaza.z }
            ],
            'LLEGANDO'
        );

        console.log(`[VEHICULOS] ${vehiculo.id} entrando al estacionamiento.`);
        return vehiculo;
    }

    // --------------------------------------------------------
    // TANDAS
    // --------------------------------------------------------

    function solicitarTanda(cantidad = config.maxVehiculosPorTanda) {
        if (sistemaEliminado || tandaActiva) return false;

        const disponibles = plazas.filter(p =>
            !p.ocupada && !p.reservada
        ).length;

        const cantidadFinal = Math.min(
            Math.max(0, Math.floor(cantidad)),
            config.maxVehiculosPorTanda,
            disponibles
        );

        if (cantidadFinal <= 0) {
            console.warn('[VEHICULOS] No hay plazas para una nueva tanda.');
            return false;
        }

        tandaActiva = true;
        contadorTandas++;
        vehiculosPendientesTanda = cantidadFinal;

        const tanda = contadorTandas;

        function lanzarSiguiente() {
            if (sistemaEliminado) return;

            if (vehiculosPendientesTanda <= 0) {
                tandaActiva = false;
                return;
            }

            const vehiculo = solicitarLlegada();

            if (vehiculo) {
                vehiculo.tanda = tanda;
                vehiculosPendientesTanda--;
            } else {
                tiempoLlegada = config.intervaloLlegada;
                return;
            }

            if (vehiculosPendientesTanda <= 0) {
                tandaActiva = false;
            } else {
                tiempoLlegada = 0;
            }
        }

        lanzarSiguiente();
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
            console.warn('[VEHICULOS] Vehículo no encontrado.');
            return false;
        }

        if (vehiculo.estado !== 'ESTACIONADO' || !vehiculo.plaza) {
            console.warn(
                `[VEHICULOS] ${vehiculo.id} no está estacionado.`
            );
            return false;
        }

        const plaza = vehiculo.plaza;

        establecerRuta(
            vehiculo,
            [
                { x: plaza.x, z: plaza.z },
                { x: plaza.x, z: config.carrilZ },
                { x: config.salidaX, z: config.carrilZ },
                { x: config.salidaX, z: config.accesoZ },
                { x: config.salidaX, z: config.exteriorZ }
            ],
            'SALIENDO'
        );

        console.log(`[VEHICULOS] ${vehiculo.id} saliendo del estacionamiento.`);
        return true;
    }

    // --------------------------------------------------------
    // ACTUALIZACIÓN
    // --------------------------------------------------------

    function actualizar(delta = 0.016) {
        if (sistemaEliminado) return;

        delta = limitar(delta, 0, 0.05);

        for (const vehiculo of vehiculos) {
            if (
                vehiculo.estado === 'LLEGANDO' ||
                vehiculo.estado === 'SALIENDO'
            ) {
                actualizarMovimiento(vehiculo, delta);
            }
        }

        if (!config.llegadasAutomaticas) return;

        tiempoLlegada += delta;

        if (tiempoLlegada < config.intervaloLlegada) return;

        tiempoLlegada = 0;

        if (tandaActiva) {
            if (vehiculosPendientesTanda > 0) {
                const vehiculo = solicitarLlegada();

                if (vehiculo) {
                    vehiculo.tanda = contadorTandas;
                    vehiculosPendientesTanda--;
                } else {
                    tiempoLlegada = config.intervaloLlegada;
                }
            }

            if (vehiculosPendientesTanda <= 0) {
                tandaActiva = false;
            }
        } else {
            solicitarTanda(config.maxVehiculosPorTanda);
        }
    }

    function obtenerEstado() {
        return {
            totalVehiculos: vehiculos.length,
            esperando: vehiculos.filter(v => v.estado === 'ESPERANDO').length,
            cargando: vehiculos.filter(v => v.estado === 'CARGANDO').length,
            errores: vehiculos.filter(v => v.estado === 'ERROR').length,
            llegando: vehiculos.filter(v => v.estado === 'LLEGANDO').length,
            estacionados: vehiculos.filter(v => v.estado === 'ESTACIONADO').length,
            saliendo: vehiculos.filter(v => v.estado === 'SALIENDO').length,
            plazasOcupadas: plazas.filter(p => p.ocupada || p.reservada).length,
            plazasDisponibles: plazas.filter(p => !p.ocupada && !p.reservada).length,
            tandaActiva,
            tandaActual: contadorTandas
        };
    }

    // --------------------------------------------------------
    // INICIO
    // --------------------------------------------------------

    for (let i = 0; i < config.vehiculosIniciales; i++) {
        crearVehiculo();
    }

    console.log('[VEHICULOS] Sistema iniciado.');
    console.log(`[VEHICULOS] Modelos: ${config.modelos.length}.`);
    console.log(`[VEHICULOS] Plazas: ${plazas.length}.`);

    // --------------------------------------------------------
    // ELIMINAR
    // --------------------------------------------------------

    function eliminar() {
        if (sistemaEliminado) return;

        sistemaEliminado = true;

        for (const vehiculo of vehiculos) {
            grupoSistema.remove(vehiculo.grupo);

            vehiculo.grupo.traverse(objeto => {
                if (objeto.geometry) objeto.geometry.dispose();

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
