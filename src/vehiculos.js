
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// SISTEMA DE VEHÍCULOS DEL SUPERMERCADO
// Compatible con Three.js + Vite
// Modelos: auto.glb hasta auto7.glb
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
    accesoZ: 83,
    frenteZ: 29,

    salidaX: 0,

    columnasEstacionamiento: [-24, -16, -8, 8, 16, 24],
    filasEstacionamiento: [32, 39, 46, 53],

    alEstacionar: null,
    alSalir: null
};

// ============================================================
// UTILIDADES
// ============================================================

function limitar(valor, minimo, maximo) {
    return Math.max(minimo, Math.min(maximo, valor));
}

function distanciaXZ(a, b) {
    return Math.hypot(b.x - a.x, b.z - a.z);
}

// ============================================================
// CREAR SISTEMA
// ============================================================

export function crearVehiculos(scene, opciones = {}) {
    if (!scene) {
        throw new Error('crearVehiculos necesita una THREE.Scene.');
    }

    const config = {
        ...CONFIG_BASE,
        ...opciones
    };

    const loader = new GLTFLoader();

    const grupoSistema = new THREE.Group();
    grupoSistema.name = 'SISTEMA_VEHICULOS';

    scene.add(grupoSistema);

    const vehiculos = [];
    const plazas = [];

    let contadorVehiculos = 0;
    let contadorTandas = 0;
    let tandaActiva = false;
    let tiempoLlegada = 0;

    // ========================================================
    // CREAR PLAZAS
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

    // ========================================================
    // BUSCAR PLAZA DISPONIBLE
    // ========================================================

    function obtenerPlazaDisponible() {
        return plazas.find(plaza =>
            !plaza.ocupada && !plaza.reservada
        ) || null;
    }

    // ========================================================
    // CREAR VEHÍCULO
    // ========================================================

    function crearVehiculo() {
        const indiceModelo =
            Math.floor(Math.random() * config.modelos.length);

        const rutaModelo = config.modelos[indiceModelo];

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
                const modelo = gltf.scene;

                modelo.name = `${id}_MODELO`;

                // ------------------------------------------------
                // CENTRAR MODELO
                // ------------------------------------------------

                const cajaInicial = new THREE.Box3()
                    .setFromObject(modelo);

                const centro = new THREE.Vector3();
                cajaInicial.getCenter(centro);

                modelo.position.x -= centro.x;
                modelo.position.z -= centro.z;
                modelo.position.y -= cajaInicial.min.y;

                // ------------------------------------------------
                // AJUSTAR ESCALA
                // ------------------------------------------------

                const cajaAjuste = new THREE.Box3()
                    .setFromObject(modelo);

                const dimensiones = new THREE.Vector3();
                cajaAjuste.getSize(dimensiones);

                const mayor = Math.max(
                    dimensiones.x,
                    dimensiones.z
                );

                if (mayor > 0) {
                    const escalaFinal =
                        config.escala *
                        (config.largoVehiculo / mayor);

                    modelo.scale.multiplyScalar(escalaFinal);
                }

                // ------------------------------------------------
                // RECALCULAR DIMENSIONES
                // ------------------------------------------------

                modelo.updateMatrixWorld(true);

                const cajaFinal = new THREE.Box3()
                    .setFromObject(modelo);

                const dimensionesFinales = new THREE.Vector3();
                cajaFinal.getSize(dimensionesFinales);

                vehiculo.dimensiones.largo =
                    dimensionesFinales.z;

                vehiculo.dimensiones.ancho =
                    dimensionesFinales.x;

                grupo.add(modelo);

                vehiculo.modelo = modelo;
                vehiculo.modeloCargado = true;
                vehiculo.estado = 'ESPERANDO';

                grupo.visible = false;
            },

            undefined,

            error => {
                console.error(
                    `[VEHICULOS] No se pudo cargar ${rutaModelo}:`,
                    error
                );

                vehiculo.errorCarga = true;
                vehiculo.estado = 'ERROR';
            }
        );

        return vehiculo;
    }

    // ========================================================
    // CREAR RUTA
    // ========================================================

    function establecerRuta(vehiculo, puntos, estado) {
        vehiculo.ruta = puntos.map(p => ({
            x: p.x,
            z: p.z
        }));

        vehiculo.indiceRuta = 0;
        vehiculo.estado = estado;
        vehiculo.velocidadActual = 0;

        vehiculo.objetivo =
            vehiculo.ruta[0] || null;
    }

    // ========================================================
    // ORIENTAR VEHÍCULO HACIA EL SIGUIENTE PUNTO
    // ========================================================

    function orientarVehiculo(vehiculo, destino, delta) {
        const dx = destino.x - vehiculo.grupo.position.x;
        const dz = destino.z - vehiculo.grupo.position.z;

        if (Math.abs(dx) + Math.abs(dz) < 0.0001) {
            return;
        }

        const anguloObjetivo = Math.atan2(dx, dz);

        const anguloActual = vehiculo.grupo.rotation.y;

        let diferencia =
            anguloObjetivo - anguloActual;

        while (diferencia > Math.PI) {
            diferencia -= Math.PI * 2;
        }

        while (diferencia < -Math.PI) {
            diferencia += Math.PI * 2;
        }

        const velocidadGiro = 3.5;

        vehiculo.grupo.rotation.y += limitar(
            diferencia,
            -velocidadGiro * delta,
            velocidadGiro * delta
        );
    }

    // ========================================================
    // FINALIZAR LLEGADA
    // ========================================================

    function finalizarLlegada(vehiculo) {
        vehiculo.grupo.position.set(
            vehiculo.plaza.x,
            0,
            vehiculo.plaza.z
        );

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
    }

    // ========================================================
    // ACTUALIZAR MOVIMIENTO
    // ========================================================

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

        const destino =
            vehiculo.ruta[vehiculo.indiceRuta];

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

        const dx = destino.x - posicion.x;
        const dz = destino.z - posicion.z;

        posicion.x += (dx / distancia) * avance;
        posicion.z += (dz / distancia) * avance;
    }

    // ========================================================
    // SOLICITAR LLEGADA DE UN VEHÍCULO
    // ========================================================

    function solicitarLlegada() {
        const plaza = obtenerPlazaDisponible();

        if (!plaza) {
            console.warn(
                '[VEHICULOS] No hay plazas disponibles.'
            );
            return null;
        }

        let vehiculo = vehiculos.find(v =>
            v.estado === 'ESPERANDO' &&
            v.modeloCargado &&
            !v.plaza
        );

        if (!vehiculo) {
            vehiculo = crearVehiculo();
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

        vehiculo.grupo.rotation.y = Math.PI;

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
                    z: config.frenteZ
                },
                {
                    x: plaza.x,
                    z: config.frenteZ
                },
                {
                    x: plaza.x,
                    z: plaza.z
                }
            ],
            'LLEGANDO'
        );

        console.log(
            `[VEHICULOS] ${vehiculo.id} se dirige al estacionamiento.`
        );

        return vehiculo;
    }

    // ========================================================
    // SOLICITAR TANDA DE VEHÍCULOS
    // ========================================================

    function solicitarTanda(cantidad = config.maxVehiculosPorTanda) {
        if (tandaActiva) return false;

        tandaActiva = true;
        contadorTandas++;

        const tanda = contadorTandas;

        const cantidadFinal = Math.min(
            cantidad,
            config.maxVehiculosPorTanda
        );

        let creados = 0;

        function lanzarSiguiente() {
            if (creados >= cantidadFinal) {
                tandaActiva = false;
                return;
            }

            const vehiculo = solicitarLlegada();

            if (vehiculo) {
                vehiculo.tanda = tanda;
                creados++;
            }

            tiempoLlegada = 0;

            if (creados < cantidadFinal) {
                tandaActiva = false;
            }
        }

        lanzarSiguiente();

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

        if (vehiculo.estado !== 'ESTACIONADO') {
            console.warn(
                `[VEHICULOS] ${vehiculo.id} no está estacionado. Estado: ${vehiculo.estado}`
            );
            return false;
        }

        if (!vehiculo.plaza) {
            console.warn(
                `[VEHICULOS] ${vehiculo.id} no tiene plaza asignada.`
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
                    z: config.frenteZ
                },
                {
                    x: config.salidaX,
                    z: config.frenteZ
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
            `[VEHICULOS] ${vehiculo.id} inicia su salida.`
        );

        return true;
    }

    // ========================================================
    // ACTUALIZAR SISTEMA
    // ========================================================

    function actualizar(delta = 0.016) {
        delta = limitar(delta, 0, 0.05);

        for (const vehiculo of vehiculos) {
            if (
                vehiculo.estado === 'LLEGANDO' ||
                vehiculo.estado === 'SALIENDO'
            ) {
                actualizarMovimiento(vehiculo, delta);
            }
        }
    }

    function actualizarCompleto(delta = 0.016) {
        actualizar(delta);
    }

    // ========================================================
    // CREAR VEHÍCULOS INICIALES
    // ========================================================

    for (let i = 0; i < config.vehiculosIniciales; i++) {
        crearVehiculo();
    }

    // ========================================================
    // CONSULTAR ESTADO
    // ========================================================

    function obtenerEstado() {
        return {
            totalVehiculos: vehiculos.length,

            esperando: vehiculos.filter(v =>
                v.estado === 'ESPERANDO'
            ).length,

            cargando: vehiculos.filter(v =>
                v.estado === 'CARGANDO'
            ).length,

            llegando: vehiculos.filter(v =>
                v.estado === 'LLEGANDO'
            ).length,

            estacionados: vehiculos.filter(v =>
                v.estado === 'ESTACIONADO'
            ).length,

            saliendo: vehiculos.filter(v =>
                v.estado === 'SALIENDO'
            ).length,

            plazasOcupadas: plazas.filter(p =>
                p.ocupada || p.reservada
            ).length,

            plazasDisponibles: plazas.filter(p =>
                !p.ocupada && !p.reservada
            ).length
        };
    }

    // ========================================================
    // ELIMINAR SISTEMA
    // ========================================================

    function eliminar() {
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

    // ========================================================
    // API PÚBLICA
    // ========================================================

    return {
        actualizar,
        actualizarCompleto,

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
