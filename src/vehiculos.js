
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

// =====================================================
// COLORES INDIVIDUALES
// =====================================================

const COLORES_VEHICULOS = [
    0xe32636, // Rojo
    0x1769aa, // Azul
    0xf5f5f5, // Blanco
    0x202020, // Negro
    0x858585, // Gris
    0x168447, // Verde
    0xe5b51b  // Amarillo
];

// =====================================================
// CONFIGURACIÓN
// =====================================================

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

// =====================================================
// CREAR SISTEMA DE VEHÍCULOS
// =====================================================

export function crearVehiculos(scene, opciones = {}) {

    if (!scene) {
        throw new Error(
            'crearVehiculos necesita una escena THREE.Scene.'
        );
    }

    const config = {
        ...CONFIG_BASE,
        ...opciones,

        modelos: opciones.modelos || [...CONFIG_BASE.modelos],

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
    let siguienteSolicitud = 0;
    let tandaActual = 0;

    let tandaActiva = false;
    let tandaPreparando = false;
    let tandaEnCurso = [];

    let inicialesProcesadas = false;
    let destruido = false;

    // =====================================================
    // UTILIDADES
    // =====================================================

    function limitarDelta(delta) {
        return Math.min(Math.max(delta, 0), 0.05);
    }

    function obtenerDireccion(dx, dz) {
        return Math.atan2(dx, dz);
    }

    function obtenerColorVehiculo(indice) {
        return COLORES_VEHICULOS[
            indice % COLORES_VEHICULOS.length
        ];
    }

    function contarPlazasLibres() {
        return plazas.filter(
            plaza => !plaza.ocupada && !plaza.reservada
        ).length;
    }

    function buscarPlazaLibre() {
        return plazas.find(
            plaza => !plaza.ocupada && !plaza.reservada
        ) || null;
    }

    // =====================================================
    // MATERIALES
    // =====================================================

    function material(color, roughness = 0.7, metalness = 0.1) {

        return new THREE.MeshStandardMaterial({
            color,
            roughness,
            metalness
        });
    }

    // =====================================================
    // PINTAR MODELO GLB
    // =====================================================

    function pintarCarroceria(modelo, color) {

        const protegidos =
            /glass|cristal|window|ventana|wheel|rueda|tire|tyre|llanta|rubber|neumatico|light|luz|lamp|chrome|cromo|mirror|espejo|interior|seat|asiento|dashboard|tablero/i;

        const materialesProcesados = new Map();

        modelo.traverse(objeto => {

            if (!objeto.isMesh) return;

            const materialesOriginales = Array.isArray(objeto.material)
                ? objeto.material
                : [objeto.material];

            const nuevosMateriales = materialesOriginales.map(original => {

                if (!original) return original;

                const nombre =
                    `${objeto.name || ''} ${original.name || ''}`;

                // Mantener cristales, ruedas, luces e interiores.
                if (protegidos.test(nombre)) {
                    return original;
                }

                // Reutilizar la copia dentro del mismo vehículo.
                if (materialesProcesados.has(original)) {
                    return materialesProcesados.get(original);
                }

                const nuevo = original.clone();

                // Aplicar color sin eliminar las texturas.
                if (nuevo.color) {
                    nuevo.color.setHex(color);
                }

                nuevo.needsUpdate = true;

                materialesProcesados.set(original, nuevo);

                return nuevo;
            });

            objeto.material = Array.isArray(objeto.material)
                ? nuevosMateriales
                : nuevosMateriales[0];
        });

        console.info(
            `[VEHICULOS] Pintura aplicada: #${color.toString(16).padStart(6, '0')}`
        );
    }

    // =====================================================
    // PLAZAS
    // =====================================================

    function crearPlazas() {

        let numero = 0;

        for (const z of config.estacionamiento.filas) {

            for (const x of config.estacionamiento.columnas) {

                plazas.push({
                    id: `PLAZA_${++numero}`,
                    x,
                    z,

                    ocupada: false,
                    reservada: false,

                    vehiculoId: null
                });
            }
        }
    }

    // =====================================================
    // VEHÍCULO PROVISIONAL
    // =====================================================

    function crearModeloProvisional(vehiculo) {

        if (
            destruido ||
            !vehiculo ||
            vehiculo.modeloCargado
        ) {
            return;
        }

        const grupo = new THREE.Group();
        grupo.name = 'VEHICULO_PROVISIONAL';

        const carroceria = new THREE.Mesh(
            new THREE.BoxGeometry(1.8, 0.8, 3.8),
            material(vehiculo.color, 0.55, 0.3)
        );

        carroceria.position.y = 0.75;
        grupo.add(carroceria);

        const techo = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 0.65, 1.9),
            material(vehiculo.color, 0.5, 0.25)
        );

        techo.position.set(0, 1.43, -0.25);
        grupo.add(techo);

        vehiculo.ruedas = [];

        for (const x of [-0.95, 0.95]) {

            for (const z of [-1.25, 1.25]) {

                const rueda = new THREE.Mesh(
                    new THREE.CylinderGeometry(
                        0.34,
                        0.34,
                        0.18,
                        12
                    ),
                    material(0x161616, 0.95)
                );

                rueda.rotation.z = Math.PI / 2;
                rueda.position.set(x, 0.36, z);

                grupo.add(rueda);
                vehiculo.ruedas.push(rueda);
            }
        }

        vehiculo.grupo.add(grupo);

        vehiculo.modelo = grupo;
        vehiculo.modeloCargado = true;
        vehiculo.estado = 'esperando';

        console.info(
            `[VEHICULOS] Provisional creado: ${vehiculo.id}`
        );

        procesarCola();
    }

    // =====================================================
    // CREAR VEHÍCULO
    // =====================================================

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

            color: obtenerColorVehiculo(siguienteId - 1),

            modelo: null,
            ruedas: [],

            estado: 'cargando',

            plaza: null,
            tanda: null,

            velocidadActual: 0,

            ruta: [],
            indiceRuta: 0,

            modeloCargado: false,

            salidaSolicitada: false,
            callbackSalidaEjecutado: false
        };

        vehiculos.push(vehiculo);

        cargarModelo(vehiculo);

        return vehiculo;
    }

    // =====================================================
    // CARGAR MODELO GLB
    // =====================================================

    function cargarModelo(vehiculo) {

        if (destruido) return;

        if (!config.modelos.length) {
            crearModeloProvisional(vehiculo);
            return;
        }

        const rutaModelo =
            config.modelos[
                siguienteModelo % config.modelos.length
            ];

        siguienteModelo++;

        loader.load(

            rutaModelo,

            gltf => {

                if (destruido) return;

                const modelo = gltf.scene;

                modelo.name = 'MODELO_VEHICULO';

                pintarCarroceria(
                    modelo,
                    vehiculo.color
                );

                modelo.traverse(objeto => {

                    if (objeto.isMesh) {

                        objeto.castShadow = false;
                        objeto.receiveShadow = false;
                    }
                });

                const caja = new THREE.Box3().setFromObject(modelo);

                if (!caja.isEmpty()) {

                    const centro = caja.getCenter(
                        new THREE.Vector3()
                    );

                    modelo.position.x -= centro.x;
                    modelo.position.z -= centro.z;

                    const nuevaCaja = new THREE.Box3()
                        .setFromObject(modelo);

                    modelo.position.y -= nuevaCaja.min.y;
                }

                vehiculo.grupo.add(modelo);

                vehiculo.modelo = modelo;
                vehiculo.modeloCargado = true;
                vehiculo.estado = 'esperando';

                console.info(
                    `[VEHICULOS] ${rutaModelo} | ${vehiculo.id} | Color #${vehiculo.color.toString(16).padStart(6, '0')}`
                );

                procesarCola();
            },

            undefined,

            error => {

                console.warn(
                    `[VEHICULOS] Error cargando ${rutaModelo}:`,
                    error
                );

                if (!destruido) {
                    crearModeloProvisional(vehiculo);
                }
            }
        );
    }

    // =====================================================
    // VEHÍCULOS DISPONIBLES
    // =====================================================

    function obtenerVehiculosDisponibles(cantidad) {

        const disponibles = vehiculos.filter(
            vehiculo => vehiculo.estado === 'esperando'
        );

        while (disponibles.length < cantidad) {

            disponibles.push(
                crearVehiculo()
            );
        }

        return disponibles.slice(0, cantidad);
    }

    // =====================================================
    // RESERVAR PLAZA
    // =====================================================

    function reservarPlaza(vehiculo) {

        const plaza = buscarPlazaLibre();

        if (!plaza) return null;

        plaza.reservada = true;
        plaza.vehiculoId = vehiculo.id;

        vehiculo.plaza = plaza;

        return plaza;
    }

    // =====================================================
    // RUTA DE LLEGADA
    // =====================================================

    function establecerRutaLlegada(vehiculo, plaza) {

        if (!vehiculo || !plaza) return;

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
                z: config.entrada.zFrente
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

        vehiculo.salidaSolicitada = false;
        vehiculo.callbackSalidaEjecutado = false;
    }

    // =====================================================
    // INICIAR SALIDA
    // =====================================================

    function iniciarSalida(vehiculo) {

        if (!vehiculo) return false;

        if (vehiculo.estado !== 'estacionado') {
            return false;
        }

        if (vehiculo.salidaSolicitada) {
            return false;
        }

        vehiculo.salidaSolicitada = true;

        vehiculo.estado = 'saliendo';

        const xPlaza = vehiculo.grupo.position.x;
        const zPlaza = vehiculo.grupo.position.z;

        vehiculo.ruta = [

            {
                x: xPlaza,
                z: zPlaza
            },

            {
                x: xPlaza,
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

        vehiculo.indiceRuta = 0;

        vehiculo.velocidadActual = 0;

        return true;
    }

    // =====================================================
    // FINALIZAR LLEGADA
    // =====================================================

    function finalizarLlegada(vehiculo) {

        if (vehiculo.estado !== 'entrando') return;

        vehiculo.estado = 'estacionado';

        vehiculo.velocidadActual = 0;

        vehiculo.ruta = [];
        vehiculo.indiceRuta = 0;

        if (vehiculo.plaza) {

            vehiculo.plaza.ocupada = true;
            vehiculo.plaza.reservada = false;
        }

        console.info(
            `[VEHICULOS] ${vehiculo.id} estacionado en ${vehiculo.plaza?.id}`
        );

        if (typeof config.alEstacionar === 'function') {

            config.alEstacionar({

                id: vehiculo.id,

                grupo: vehiculo.grupo,

                plaza: vehiculo.plaza,

                vehiculo,

                tanda: vehiculo.tanda
            });
        }
    }

    // =====================================================
    // FINALIZAR SALIDA
    // =====================================================

    function finalizarSalida(vehiculo) {

        if (
            vehiculo.estado !== 'saliendo' ||
            vehiculo.callbackSalidaEjecutado
        ) {
            return;
        }

        vehiculo.callbackSalidaEjecutado = true;

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
            config.salida.x,
            0,
            config.salida.zExterior
        );

        vehiculo.grupo.rotation.y = Math.PI;

        vehiculo.velocidadActual = 0;

        vehiculo.ruta = [];
        vehiculo.indiceRuta = 0;

        vehiculo.salidaSolicitada = false;

        console.info(
            `[VEHICULOS] ${vehiculo.id} terminó su salida.`
        );

        if (typeof config.alSalir === 'function') {

            config.alSalir({

                id: vehiculo.id,

                grupo: vehiculo.grupo,

                vehiculo,

                plaza: plazaAnterior,

                tanda: vehiculo.tanda
            });
        }

        verificarFinTanda();
    }

    // =====================================================
    // VERIFICAR TANDA
    // =====================================================

    function verificarFinTanda() {

        if (!tandaActiva) return;

        const pendientes = tandaEnCurso.some(
            vehiculo => vehiculo.estado !== 'esperando'
        );

        if (pendientes) return;

        tandaActiva = false;

        tandaEnCurso = [];

        console.info(
            `[VEHICULOS] Tanda ${tandaActual} finalizada.`
        );

        procesarCola();
    }

    // =====================================================
    // MOVIMIENTO
    // =====================================================

    function moverVehiculo(vehiculo, delta) {

        if (
            vehiculo.estado !== 'entrando' &&
            vehiculo.estado !== 'saliendo'
        ) {
            return;
        }

        const destino = vehiculo.ruta[
            vehiculo.indiceRuta
        ];

        if (!destino) return;

        const dx = destino.x - vehiculo.grupo.position.x;
        const dz = destino.z - vehiculo.grupo.position.z;

        const distancia = Math.hypot(dx, dz);

        if (distancia < 0.15) {

            vehiculo.grupo.position.x = destino.x;
            vehiculo.grupo.position.z = destino.z;

            vehiculo.indiceRuta++;

            if (
                vehiculo.indiceRuta >= vehiculo.ruta.length
            ) {

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

            vehiculo.velocidadActual +
            config.aceleracion * delta
        );

        const avance = Math.min(
            distancia,
            vehiculo.velocidadActual * delta
        );

        vehiculo.grupo.position.x +=
            (dx / distancia) * avance;

        vehiculo.grupo.position.z +=
            (dz / distancia) * avance;

        const rotacionObjetivo = obtenerDireccion(dx, dz);

        const diferencia = THREE.MathUtils.euclideanModulo(
            rotacionObjetivo - vehiculo.grupo.rotation.y + Math.PI,
            Math.PI * 2
        ) - Math.PI;

        vehiculo.grupo.rotation.y +=
            diferencia * Math.min(1, delta * 5);

        for (const rueda of vehiculo.ruedas) {
            rueda.rotation.x += avance * 2.5;
        }
    }

    // =====================================================
    // PROCESAR COLA
    // =====================================================

    function procesarCola() {

        if (destruido) return;

        if (tandaActiva || tandaPreparando) return;

        if (!colaLlegadas.length) return;

        const cantidad = Math.min(
            config.maximoPorTanda,
            colaLlegadas.length,
            contarPlazasLibres()
        );

        if (cantidad <= 0) {
            return;
        }

        tandaPreparando = true;

        const disponibles = obtenerVehiculosDisponibles(
            cantidad
        );

        if (
            disponibles.length < cantidad ||
            disponibles.some(v => !v.modeloCargado)
        ) {

            tandaPreparando = false;

            return;
        }

        const solicitudes = colaLlegadas.splice(
            0,
            cantidad
        );

        tandaActual++;

        tandaActiva = true;
        tandaPreparando = false;

        tandaEnCurso = [];

        for (let i = 0; i < solicitudes.length; i++) {

            const vehiculo = disponibles[i];

            const plaza = reservarPlaza(vehiculo);

            if (!plaza) {

                colaLlegadas.unshift(
                    ...solicitudes.slice(i)
                );

                break;
            }

            vehiculo.tanda = tandaActual;

            tandaEnCurso.push(vehiculo);

            establecerRutaLlegada(
                vehiculo,
                plaza
            );
        }

        if (!tandaEnCurso.length) {

            tandaActiva = false;

            procesarCola();
        }
    }

    // =====================================================
    // SOLICITUD DE LLEGADA
    // =====================================================

    function solicitarLlegada() {
        return solicitarTanda(1);
    }

    // =====================================================
    // SOLICITAR TANDA
    // =====================================================

    function solicitarTanda(cantidad = 3) {

        if (destruido) return false;

        const cantidadReal = Math.min(
            config.maximoPorTanda,
            Math.max(1, Math.floor(cantidad))
        );

        if (contarPlazasLibres() < cantidadReal) {

            console.warn(
                '[VEHICULOS] No hay suficientes plazas disponibles.'
            );

            return false;
        }

        for (let i = 0; i < cantidadReal; i++) {

            colaLlegadas.push({
                id: ++siguienteSolicitud
            });
        }

        console.info(
            `[VEHICULOS] Solicitudes pendientes: ${colaLlegadas.length}`
        );

        procesarCola();

        return true;
    }

    // =====================================================
    // SOLICITAR SALIDA
    // =====================================================

    function solicitarSalida(id) {

        const vehiculo = vehiculos.find(
            v => v.id === id
        );

        if (!vehiculo) {

            console.warn(
                `[VEHICULOS] No existe ${id}`
            );

            return false;
        }

        return iniciarSalida(vehiculo);
    }

    // =====================================================
    // VEHÍCULOS INICIALES
    // =====================================================

    function procesarIniciales() {

        if (inicialesProcesadas || destruido) {
            return;
        }

        inicialesProcesadas = true;

        solicitarTanda(
            config.cochesIniciales
        );
    }

    // =====================================================
    // ACTUALIZAR
    // =====================================================

    function actualizar(delta = 0.016) {

        if (destruido) return;

        const dt = limitarDelta(delta);

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

    // =====================================================
    // INFORMACIÓN
    // =====================================================

    function obtenerEstado() {

        return {

            tandaActual,

            tandaActiva,

            tandaPreparando,

            vehiculos: vehiculos.map(vehiculo => ({

                id: vehiculo.id,

                estado: vehiculo.estado,

                color: `#${vehiculo.color.toString(16).padStart(6, '0')}`,

                tanda: vehiculo.tanda,

                plaza: vehiculo.plaza?.id ?? null,

                modeloCargado: vehiculo.modeloCargado,

                posicion: {
                    x: vehiculo.grupo.position.x,
                    z: vehiculo.grupo.position.z
                }
            })),

            plazasDisponibles: contarPlazasLibres(),

            solicitudesPendientes: colaLlegadas.length
        };
    }

    // =====================================================
    // ELIMINAR
    // =====================================================

    function eliminar() {

        if (destruido) return;

        destruido = true;

        grupoVehiculos.removeFromParent();

        grupoVehiculos.traverse(objeto => {

            if (!objeto.isMesh) return;

            objeto.geometry?.dispose();

            if (Array.isArray(objeto.material)) {

                objeto.material.forEach(m => m.dispose());

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

    // =====================================================
    // INICIALIZACIÓN
    // =====================================================

    crearPlazas();

    for (
        let i = 0;
        i < config.cochesIniciales;
        i++
    ) {
        crearVehiculo();
    }

    // =====================================================
    // API PÚBLICA
    // =====================================================

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
