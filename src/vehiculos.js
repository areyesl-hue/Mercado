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

export function crearVehiculos(scene, opciones = {}) {
    if (!scene) {
        throw new Error('crearVehiculos necesita una escena THREE.Scene.');
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

    const grupoVehiculos = new THREE.Group();
    grupoVehiculos.name = 'SISTEMA_VEHICULOS';

    scene.add(grupoVehiculos);

    const vehiculos = [];
    const plazas = [];

    const colaLlegadas = [];

    let siguienteModelo = 0;
    let siguienteId = 0;

    let tandaActiva = false;
    let tandaActual = 0;
    let llegadasInicialesProcesadas = false;
    let temporizadorLlegadas = 0;

    let destruido = false;

    function crearPlazas() {
        let id = 0;

        for (const z of config.estacionamiento.filas) {
            for (const x of config.estacionamiento.columnas) {
                const plaza = {
                    id: `PLAZA_${++id}`,
                    x,
                    z,
                    ocupada: false,
                    reservada: false,
                    vehiculoId: null
                };

                plazas.push(plaza);
            }
        }
    }

    function buscarPlazaLibre() {
        return plazas.find(
            plaza => !plaza.ocupada && !plaza.reservada
        ) || null;
    }

    function crearVehiculo() {
        const id = `VEHICULO_${++siguienteId}`;

        const grupo = new THREE.Group();
        grupo.name = id;

        grupo.scale.setScalar(config.escala);

        grupo.visible = false;

        grupoVehiculos.add(grupo);

        const vehiculo = {
            id,
            grupo,

            modelo: null,

            estado: 'cargando',

            plaza: null,

            velocidadActual: 0,

            velocidadObjetivo: config.velocidad,

            ruta: [],
            indiceRuta: 0,

            tiempoEspera: 0,

            modeloCargado: false
        };

        vehiculos.push(vehiculo);

        cargarModelo(vehiculo);

        return vehiculo;
    }

    function crearModeloProvisional(vehiculo) {
        const carroceria = new THREE.Mesh(
            new THREE.BoxGeometry(1.8, 0.8, 3.8),
            new THREE.MeshStandardMaterial({
                color: 0x263d59,
                roughness: 0.55,
                metalness: 0.3
            })
        );

        carroceria.position.y = 0.75;
        carroceria.castShadow = false;

        vehiculo.grupo.add(carroceria);

        const techo = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 0.65, 1.9),
            new THREE.MeshStandardMaterial({
                color: 0x8ca5b9,
                roughness: 0.5,
                metalness: 0.25
            })
        );

        techo.position.set(0, 1.43, -0.25);

        vehiculo.grupo.add(techo);

        const ruedas = [];

        for (const x of [-0.95, 0.95]) {
            for (const z of [-1.25, 1.25]) {
                const rueda = new THREE.Mesh(
                    new THREE.CylinderGeometry(
                        0.34,
                        0.34,
                        0.18,
                        10
                    ),
                    new THREE.MeshStandardMaterial({
                        color: 0x161616,
                        roughness: 0.95
                    })
                );

                rueda.rotation.z = Math.PI / 2;
                rueda.position.set(x, 0.36, z);

                vehiculo.grupo.add(rueda);

                ruedas.push(rueda);
            }
        }

        vehiculo.ruedas = ruedas;
        vehiculo.modeloCargado = true;

        if (vehiculo.estado === 'cargando') {
            vehiculo.estado = 'esperando';
        }
    }

    function cargarModelo(vehiculo) {
        const modelos = config.modelos || [];

        if (!modelos.length) {
            crearModeloProvisional(vehiculo);
            return;
        }

        const ruta = modelos[
            siguienteModelo % modelos.length
        ];

        siguienteModelo++;

        loader.load(
            ruta,

            gltf => {
                if (destruido) return;

                vehiculo.grupo.clear();

                const modelo = gltf.scene;

                modelo.name = 'MODELO_VEHICULO';

                modelo.traverse(objeto => {
                    if (objeto.isMesh) {
                        objeto.castShadow = false;
                        objeto.receiveShadow = false;
                    }
                });

                const caja = new THREE.Box3().setFromObject(modelo);

                if (!caja.isEmpty()) {
                    const centro = caja.getCenter(new THREE.Vector3());

                    modelo.position.x -= centro.x;
                    modelo.position.z -= centro.z;

                    const cajaNueva = new THREE.Box3().setFromObject(modelo);

                    modelo.position.y -= cajaNueva.min.y;
                }

                vehiculo.grupo.add(modelo);

                vehiculo.modelo = modelo;
                vehiculo.modeloCargado = true;

                if (vehiculo.estado === 'cargando') {
                    vehiculo.estado = 'esperando';
                }

                procesarCola();
            },

            undefined,

            error => {
                console.warn(`Error cargando ${ruta}:`, error);

                if (!destruido) {
                    crearModeloProvisional(vehiculo);
                    procesarCola();
                }
            }
        );
    }

    function obtenerVehiculoDisponible() {
        return vehiculos.find(
            vehiculo =>
                vehiculo.estado === 'esperando' &&
                vehiculo.modeloCargado
        ) || crearVehiculo();
    }

    function establecerRutaLlegada(vehiculo, plaza) {
        vehiculo.plaza = plaza;

        plaza.reservada = true;
        plaza.vehiculoId = vehiculo.id;

        vehiculo.ruta = [
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
                z: plaza.z
            }
        ];

        vehiculo.indiceRuta = 0;

        vehiculo.grupo.position.set(
            config.entrada.x,
            0,
            config.entrada.zExterior
        );

        vehiculo.grupo.rotation.y = Math.PI;

        vehiculo.velocidadActual = 0;
        vehiculo.estado = 'entrando';
        vehiculo.grupo.visible = true;
    }

    function iniciarSalida(vehiculo) {
        if (!vehiculo || vehiculo.estado !== 'estacionado') {
            return false;
        }

        vehiculo.estado = 'saliendo';

        vehiculo.ruta = [
            {
                x: vehiculo.plaza.x,
                z: vehiculo.plaza.z
            },
            {
                x: config.salida.x,
                z: config.entrada.zAcceso
            },
            {
                x: config.salida.x,
                z: config.salida.zExterior
            }
        ];

        vehiculo.indiceRuta = 0;

        return true;
    }

    function finalizarLlegada(vehiculo) {
        vehiculo.estado = 'estacionado';

        if (vehiculo.plaza) {
            vehiculo.plaza.ocupada = true;
            vehiculo.plaza.reservada = false;
        }

        if (typeof config.alEstacionar === 'function') {
            config.alEstacionar({
                id: vehiculo.id,
                grupo: vehiculo.grupo,
                plaza: vehiculo.plaza,
                vehiculo
            });
        }
    }

    function finalizarSalida(vehiculo) {
        const plazaAnterior = vehiculo.plaza;

        if (plazaAnterior) {
            plazaAnterior.ocupada = false;
            plazaAnterior.reservada = false;
            plazaAnterior.vehiculoId = null;
        }

        vehiculo.plaza = null;
        vehiculo.estado = 'esperando';

        vehiculo.grupo.visible = false;

        vehiculo.grupo.position.set(
            config.entrada.x,
            0,
            config.entrada.zExterior
        );

        vehiculo.velocidadActual = 0;

        if (typeof config.alSalir === 'function') {
            config.alSalir({
                id: vehiculo.id,
                grupo: vehiculo.grupo,
                vehiculo,
                plaza: plazaAnterior
            });
        }

        verificarFinTanda();
    }

    function verificarFinTanda() {
        if (!tandaActiva) return;

        const activos = vehiculos.filter(
            vehiculo =>
                vehiculo.tanda === tandaActual &&
                vehiculo.estado !== 'esperando'
        );

        if (activos.length > 0) return;

        tandaActiva = false;

        // No se inicia otra tanda hasta que todos hayan salido.
        procesarCola();
    }

    function moverVehiculo(vehiculo, delta) {
        if (
            vehiculo.estado !== 'entrando' &&
            vehiculo.estado !== 'saliendo'
        ) {
            return;
        }

        const destino = vehiculo.ruta[vehiculo.indiceRuta];

        if (!destino) return;

        const dx = destino.x - vehiculo.grupo.position.x;
        const dz = destino.z - vehiculo.grupo.position.z;

        const distancia = Math.sqrt(dx * dx + dz * dz);

        if (distancia < 0.15) {
            vehiculo.grupo.position.x = destino.x;
            vehiculo.grupo.position.z = destino.z;

            vehiculo.indiceRuta++;

            if (vehiculo.indiceRuta >= vehiculo.ruta.length) {
                if (vehiculo.estado === 'entrando') {
                    finalizarLlegada(vehiculo);
                } else {
                    finalizarSalida(vehiculo);
                }
            }

            return;
        }

        vehiculo.velocidadActual = Math.min(
            config.velocidadMaxima,
            vehiculo.velocidadActual + config.aceleracion * delta
        );

        const avance = Math.min(
            distancia,
            vehiculo.velocidadActual * delta
        );

        vehiculo.grupo.position.x += (dx / distancia) * avance;
        vehiculo.grupo.position.z += (dz / distancia) * avance;

        const angulo = Math.atan2(dx, dz);

        vehiculo.grupo.rotation.y = angulo;

        if (vehiculo.ruedas) {
            for (const rueda of vehiculo.ruedas) {
                rueda.rotation.x += avance * 2;
            }
        }
    }

    function iniciarVehiculo(vehiculo) {
        const plaza = buscarPlazaLibre();

        if (!plaza) return false;

        establecerRutaLlegada(vehiculo, plaza);

        return true;
    }

    function procesarCola() {
        if (destruido || tandaActiva) return;

        if (colaLlegadas.length === 0) return;

        const cantidad = Math.min(
            config.maximoPorTanda,
            colaLlegadas.length
        );

        const tanda = colaLlegadas.splice(0, cantidad);

        tandaActual++;
        tandaActiva = true;

        let iniciados = 0;

        for (const solicitud of tanda) {
            const vehiculo = obtenerVehiculoDisponible();

            vehiculo.tanda = tandaActual;

            if (vehiculo.modeloCargado) {
                const correcto = iniciarVehiculo(vehiculo);

                if (!correcto) {
                    colaLlegadas.unshift(solicitud);
                    vehiculo.estado = 'esperando';
                    continue;
                }

                iniciados++;
            } else {
                // Espera a que el modelo termine de cargar.
                colaLlegadas.unshift(solicitud);
                vehiculo.estado = 'esperando';
            }
        }

        if (iniciados === 0) {
            tandaActiva = false;
        }
    }

    function solicitarLlegada() {
        if (destruido) return false;

        const plaza = buscarPlazaLibre();

        if (!plaza) {
            console.warn('No hay plazas disponibles.');
            return false;
        }

        if (tandaActiva) {
            console.warn('La tanda actual todavía no ha terminado.');
            return false;
        }

        colaLlegadas.push({
            solicitud: Date.now() + Math.random()
        });

        procesarCola();

        return true;
    }

    function solicitarSalida(id) {
        const vehiculo = vehiculos.find(
            elemento => elemento.id === id
        );

        if (!vehiculo) return false;

        return iniciarSalida(vehiculo);
    }

    function solicitarTanda(cantidad = 3) {
        if (destruido || tandaActiva || colaLlegadas.length > 0) {
            return false;
        }

        const disponibles = plazas.filter(
            plaza => !plaza.ocupada && !plaza.reservada
        ).length;

        const cantidadReal = Math.min(
            Math.max(1, cantidad),
            config.maximoPorTanda,
            disponibles
        );

        if (cantidadReal === 0) return false;

        for (let i = 0; i < cantidadReal; i++) {
            colaLlegadas.push({
                solicitud: Date.now() + i
            });
        }

        procesarCola();

        return true;
    }

    function procesarIniciales() {
        if (llegadasInicialesProcesadas) return;

        llegadasInicialesProcesadas = true;

        solicitarTanda(config.cochesIniciales);
    }

    function actualizar(delta = 0.016) {
        if (destruido) return;

        const dt = Math.min(Math.max(delta, 0), 0.05);

        for (const vehiculo of vehiculos) {
            moverVehiculo(vehiculo, dt);
        }

        procesarCola();
    }

    function actualizarCompleto(delta = 0.016) {
        procesarIniciales();
        actualizar(delta);
    }

    function obtenerEstado() {
        return {
            tandaActual,
            tandaActiva,
            vehiculos: vehiculos.map(vehiculo => ({
                id: vehiculo.id,
                estado: vehiculo.estado,
                tanda: vehiculo.tanda,
                plaza: vehiculo.plaza?.id ?? null
            })),
            plazasDisponibles: plazas.filter(
                plaza => !plaza.ocupada && !plaza.reservada
            ).length,
            solicitudesPendientes: colaLlegadas.length
        };
    }

    function eliminar() {
        if (destruido) return;

        destruido = true;

        grupoVehiculos.removeFromParent();

        grupoVehiculos.traverse(objeto => {
            if (!objeto.isMesh) return;

            objeto.geometry?.dispose();

            if (Array.isArray(objeto.material)) {
                objeto.material.forEach(material => material.dispose());
            } else {
                objeto.material?.dispose();
            }
        });

        vehiculos.length = 0;
        plazas.length = 0;
        colaLlegadas.length = 0;
    }

    crearPlazas();

    // Se crean los vehículos iniciales, pero no se duplican las llegadas.
    for (let i = 0; i < config.cochesIniciales; i++) {
        crearVehiculo();
    }

    const api = {
        grupo: grupoVehiculos,

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
            return tandaActiva;
        },

        get tandaActual() {
            return tandaActual;
        }
    };

    return api;
}
