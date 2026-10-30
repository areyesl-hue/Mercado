
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
        entrada: { ...CONFIG_BASE.entrada, ...opciones.entrada },
        salida: { ...CONFIG_BASE.salida, ...opciones.salida },
        estacionamiento: {
            ...CONFIG_BASE.estacionamiento,
            ...opciones.estacionamiento
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
    let siguienteSolicitud = 0;
    let tandaActual = 0;

    let tandaActiva = false;
    let tandaPreparando = false;
    let tandaEnCurso = [];

    let inicialesProcesadas = false;
    let destruido = false;

    // =========================================================
    // PLAZAS DE ESTACIONAMIENTO
    // =========================================================

    function crearPlazas() {
        let id = 0;

        for (const z of config.estacionamiento.filas) {
            for (const x of config.estacionamiento.columnas) {
                plazas.push({
                    id: `PLAZA_${++id}`,
                    x,
                    z,
                    ocupada: false,
                    reservada: false,
                    vehiculoId: null
                });
            }
        }
    }

    function buscarPlazaLibre() {
        return plazas.find(
            p => !p.ocupada && !p.reservada
        ) || null;
    }

    function contarPlazasLibres() {
        return plazas.filter(
            p => !p.ocupada && !p.reservada
        ).length;
    }

    // =========================================================
    // VEHÍCULO PROVISIONAL
    // Se utiliza si falla la carga del GLB.
    // =========================================================

    function crearModeloProvisional(vehiculo) {
        if (destruido || !vehiculo || vehiculo.modeloCargado) return;

        const material = new THREE.MeshStandardMaterial({
            color: 0x263d59,
            roughness: 0.55,
            metalness: 0.3
        });

        const carroceria = new THREE.Mesh(
            new THREE.BoxGeometry(1.8, 0.8, 3.8),
            material
        );

        carroceria.position.y = 0.75;
        carroceria.castShadow = false;
        carroceria.receiveShadow = false;
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

        vehiculo.ruedas = [];

        for (const x of [-0.95, 0.95]) {
            for (const z of [-1.25, 1.25]) {
                const rueda = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.34, 0.34, 0.18, 10),
                    new THREE.MeshStandardMaterial({
                        color: 0x161616,
                        roughness: 0.95
                    })
                );

                rueda.rotation.z = Math.PI / 2;
                rueda.position.set(x, 0.36, z);

                vehiculo.grupo.add(rueda);
                vehiculo.ruedas.push(rueda);
            }
        }

        vehiculo.modeloCargado = true;
        vehiculo.estado = 'esperando';

        // Importante: al terminar la carga se intenta procesar
        // nuevamente la cola de vehículos.
        procesarCola();
    }

    // =========================================================
    // CREAR VEHÍCULO
    // =========================================================

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
            ruedas: [],
            estado: 'cargando',
            plaza: null,
            tanda: null,
            velocidadActual: 0,
            ruta: [],
            indiceRuta: 0,
            modeloCargado: false
        };

        vehiculos.push(vehiculo);
        cargarModelo(vehiculo);

        return vehiculo;
    }

    // =========================================================
    // CARGAR MODELO GLB
    // =========================================================

    function cargarModelo(vehiculo) {
        const modelos = config.modelos || [];

        if (!modelos.length) {
            crearModeloProvisional(vehiculo);
            return;
        }

        const ruta = modelos[siguienteModelo % modelos.length];
        siguienteModelo++;

        loader.load(
            ruta,

            gltf => {
                if (destruido) return;

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
                vehiculo.estado = 'esperando';

                // Reintentar la cola cuando el modelo esté listo.
                procesarCola();
            },

            undefined,

            error => {
                console.warn(`Error cargando ${ruta}:`, error);

                if (!destruido) {
                    crearModeloProvisional(vehiculo);
                }
            }
        );
    }

    // =========================================================
    // OBTENER VEHÍCULOS DISPONIBLES
    // Incluye vehículos que todavía están cargando.
    // =========================================================

    function obtenerVehiculosDisponibles(cantidad) {
        const disponibles = vehiculos.filter(v =>
            v.estado === 'esperando' ||
            v.estado === 'cargando'
        );

        while (disponibles.length < cantidad) {
            disponibles.push(crearVehiculo());
        }

        return disponibles.slice(0, cantidad);
    }

    // =========================================================
    // RUTA DE ENTRADA
    // =========================================================

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

    // =========================================================
    // SALIDA DEL ESTACIONAMIENTO
    // =========================================================

    function iniciarSalida(vehiculo) {
        if (!vehiculo || vehiculo.estado !== 'estacionado') {
            return false;
        }

        vehiculo.estado = 'saliendo';

        vehiculo.ruta = [
            {
                x: vehiculo.grupo.position.x,
                z: vehiculo.grupo.position.z
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

        vehiculo.indiceRuta = 0;
        vehiculo.velocidadActual = 0;

        return true;
    }

    // =========================================================
    // FINALIZAR LLEGADA
    // =========================================================

    function finalizarLlegada(vehiculo) {
        vehiculo.estado = 'estacionado';

        if (vehiculo.plaza) {
            vehiculo.plaza.ocupada = true;
            vehiculo.plaza.reservada = false;
        }

        config.alEstacionar?.({
            id: vehiculo.id,
            grupo: vehiculo.grupo,
            plaza: vehiculo.plaza,
            vehiculo,
            tanda: vehiculo.tanda
        });
    }

    // =========================================================
    // FINALIZAR SALIDA
    // =========================================================

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
        vehiculo.ruta = [];
        vehiculo.indiceRuta = 0;

        config.alSalir?.({
            id: vehiculo.id,
            grupo: vehiculo.grupo,
            vehiculo,
            plaza: plazaAnterior,
            tanda: vehiculo.tanda
        });

        verificarFinTanda();
    }

    // =========================================================
    // VERIFICAR SI TERMINÓ LA TANDA
    // =========================================================

    function verificarFinTanda() {
        if (!tandaActiva) return;

        const pendientes = tandaEnCurso.some(
            v => v.estado !== 'esperando'
        );

        if (pendientes) return;

        tandaActiva = false;
        tandaEnCurso = [];

        // Si hay solicitudes acumuladas, inicia la siguiente tanda.
        procesarCola();
    }

    // =========================================================
    // MOVIMIENTO DE VEHÍCULOS
    // =========================================================

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
        const distancia = Math.hypot(dx, dz);

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

        vehiculo.grupo.position.x += dx / distancia * avance;
        vehiculo.grupo.position.z += dz / distancia * avance;

        vehiculo.grupo.rotation.y = Math.atan2(dx, dz);

        for (const rueda of vehiculo.ruedas) {
            rueda.rotation.x += avance * 2;
        }
    }

    // =========================================================
    // PROCESAR COLA DE LLEGADAS
    // CORREGIDO: NO SE BLOQUEA SI LOS GLB ESTÁN CARGANDO.
    // =========================================================

    function procesarCola() {
        if (destruido || tandaActiva || tandaPreparando) return;
        if (colaLlegadas.length === 0) return;

        const cantidad = Math.min(
            config.maximoPorTanda,
            colaLlegadas.length
        );

        if (contarPlazasLibres() < cantidad) {
            console.warn('No hay suficientes plazas para la tanda.');
            return;
        }

        tandaPreparando = true;

        const disponibles = obtenerVehiculosDisponibles(cantidad);

        // Si hay modelos cargando, liberamos el bloqueo.
        // Cuando termine cada carga, cargarModelo llamará otra vez
        // a procesarCola().
        if (disponibles.some(v => !v.modeloCargado)) {
            tandaPreparando = false;
            return;
        }

        const solicitudes = colaLlegadas.splice(0, cantidad);

        tandaActual++;
        tandaActiva = true;
        tandaPreparando = false;

        tandaEnCurso = [];

        for (let i = 0; i < solicitudes.length; i++) {
            const vehiculo = disponibles[i];
            const plaza = buscarPlazaLibre();

            if (!plaza) {
                colaLlegadas.unshift(...solicitudes.slice(i));
                break;
            }

            vehiculo.tanda = tandaActual;
            tandaEnCurso.push(vehiculo);

            establecerRutaLlegada(vehiculo, plaza);
        }

        if (tandaEnCurso.length === 0) {
            tandaActiva = false;
            procesarCola();
        }
    }

    // =========================================================
    // SOLICITAR UNA LLEGADA
    // =========================================================

    function solicitarLlegada() {
        return solicitarTanda(1);
    }

    // =========================================================
    // SOLICITAR TANDA
    // CORREGIDO: PERMITE ACUMULAR SOLICITUDES MIENTRAS
    // OTRA TANDA ESTÁ ACTIVA.
    // =========================================================

    function solicitarTanda(cantidad = 3) {
        if (destruido) return false;

        const cantidadReal = Math.min(
            Math.max(1, Math.floor(cantidad)),
            config.maximoPorTanda
        );

        const solicitudesActuales =
            colaLlegadas.length +
            tandaEnCurso.length;

        if (
            contarPlazasLibres() <
            cantidadReal + (tandaActiva ? 0 : 0)
        ) {
            console.warn('No hay suficientes plazas para esta tanda.');
            return false;
        }

        // Se agregan solicitudes a la cola aunque haya vehículos
        // entrando, estacionados o saliendo.
        for (let i = 0; i < cantidadReal; i++) {
            colaLlegadas.push({
                id: ++siguienteSolicitud
            });
        }

        procesarCola();

        return true;
    }

    // =========================================================
    // SOLICITAR SALIDA DE UN VEHÍCULO
    // =========================================================

    function solicitarSalida(id) {
        const vehiculo = vehiculos.find(v => v.id === id);

        return iniciarSalida(vehiculo);
    }

    // =========================================================
    // PROCESAR VEHÍCULOS INICIALES
    // =========================================================

    function procesarIniciales() {
        if (inicialesProcesadas || destruido) return;

        inicialesProcesadas = true;

        solicitarTanda(config.cochesIniciales);
    }

    // =========================================================
    // ACTUALIZACIÓN
    // =========================================================

    function actualizar(delta = 0.016) {
        if (destruido) return;

        const dt = Math.min(Math.max(delta, 0), 0.05);

        for (const vehiculo of vehiculos) {
            moverVehiculo(vehiculo, dt);
        }

        procesarCola();
    }

    function actualizarCompleto(delta = 0.016) {
        if (destruido) return;

        procesarIniciales();
        actualizar(delta);
    }

    // =========================================================
    // CONSULTAR ESTADO
    // =========================================================

    function obtenerEstado() {
        return {
            tandaActual,
            tandaActiva,
            tandaPreparando,

            vehiculos: vehiculos.map(v => ({
                id: v.id,
                estado: v.estado,
                tanda: v.tanda,
                plaza: v.plaza?.id ?? null,
                modeloCargado: v.modeloCargado
            })),

            plazasDisponibles: contarPlazasLibres(),
            solicitudesPendientes: colaLlegadas.length
        };
    }

    // =========================================================
    // ELIMINAR SISTEMA
    // =========================================================

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
        tandaEnCurso.length = 0;

        tandaActiva = false;
        tandaPreparando = false;
    }

    // =========================================================
    // INICIALIZACIÓN
    // =========================================================

    crearPlazas();

    for (let i = 0; i < config.cochesIniciales; i++) {
        crearVehiculo();
    }

    // =========================================================
    // API PÚBLICA
    // =========================================================

    return {
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
}
