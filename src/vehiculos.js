
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// SISTEMA DE VEHÍCULOS DEL SUPERMERCADO
// Three.js + Vite
//
// - Cada GLB completo representa un solo vehículo.
// - Carga de varios modelos de automóviles.
// - 24 plazas exteriores.
// - Tres llegadas iniciales por defecto.
// - Llegadas automáticas de los vehículos restantes.
// - Rutas de entrada y salida por el exterior.
// - Reserva y liberación de plazas.
// - Rotación suave.
// - Reutilización de vehículos.
// - API compatible con main.js.
// ============================================================

export function crearVehiculos(scene, opciones = {}) {
    if (!scene?.isScene) {
        throw new Error(
            'crearVehiculos necesita una THREE.Scene.'
        );
    }

    // --------------------------------------------------------
    // CONFIGURACIÓN
    // --------------------------------------------------------

    const config = {
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
        velocidad: 5.5,
        suavizadoRotacion: 5,
        correccionRotacionY: 0,

        tiempoEntreLlegadas: 10,
        cochesIniciales: 3,
        separacionInicial: 8,

        alEstacionar: null,
        alSalir: null,

        ...opciones
    };

    config.modelos = Array.isArray(config.modelos)
        ? [...new Set(config.modelos)]
        : [];

    config.tiempoEntreLlegadas = Math.max(
        1,
        Number(config.tiempoEntreLlegadas) || 10
    );

    config.cochesIniciales = Math.max(
        0,
        Math.floor(Number(config.cochesIniciales) || 0)
    );

    config.velocidad = Math.max(
        0.1,
        Number(config.velocidad) || 5.5
    );

    config.longitudVehiculo = Math.max(
        1,
        Number(config.longitudVehiculo) || 4.3
    );

    config.separacionInicial = Math.max(
        5,
        Number(config.separacionInicial) || 8
    );

    // --------------------------------------------------------
    // GRUPO PRINCIPAL
    // --------------------------------------------------------

    const grupo = new THREE.Group();
    grupo.name = 'SISTEMA_VEHICULOS';
    scene.add(grupo);

    const loader = new GLTFLoader();

    // --------------------------------------------------------
    // ESTADO
    // --------------------------------------------------------

    const plazas = [];
    const vehiculos = [];
    const cola = [];

    let cargado = false;
    let errorCarga = null;
    let tiempoLlegada = 0;
    let inicialesIniciados = false;
    let eliminado = false;
    let cargasPendientes = config.modelos.length;
    let siguienteId = 1;

    // --------------------------------------------------------
    // PLAZAS DE ESTACIONAMIENTO
    // Todas permanecen fuera del edificio.
    //
    // El interior termina aproximadamente en z = 29.
    // El estacionamiento ocupa la zona exterior z > 29.
    // --------------------------------------------------------

    const posicionesZ = [32, 39, 46, 53];
    const posicionesX = [-24, -16, -8, 8, 16, 24];

    for (const z of posicionesZ) {
        for (const x of posicionesX) {
            plazas.push({
                x,
                z,
                ocupada: false,
                vehiculoId: null
            });
        }
    }

    // --------------------------------------------------------
    // PREPARAR MODELO
    // Un archivo GLB completo es un único automóvil.
    // Nunca se separan sus piezas en vehículos independientes.
    // --------------------------------------------------------

    function prepararModelo(original, indice) {
        const contenedor = new THREE.Group();

        contenedor.name = `VEHICULO_${indice + 1}`;

        const modelo = original.clone(true);
        modelo.name = `MODELO_GLTF_${indice + 1}`;

        modelo.traverse(objeto => {
            if (!objeto.isMesh) return;

            // Las sombras dinámicas se desactivan para reducir lag.
            objeto.castShadow = false;
            objeto.receiveShadow = false;

            // No duplicar materiales innecesariamente.
            // El sistema no modifica los materiales del modelo.
        });

        contenedor.add(modelo);

        modelo.updateMatrixWorld(true);

        let caja = new THREE.Box3().setFromObject(modelo);

        if (caja.isEmpty()) {
            console.warn(
                `[VEHICULOS] Modelo vacío: ${config.modelos[indice] ?? indice}`
            );

            return contenedor;
        }

        const tamano = caja.getSize(new THREE.Vector3());

        const largoOriginal = Math.max(
            tamano.x,
            tamano.z,
            0.01
        );

        const escalaUsuario = Math.max(
            0.001,
            Number(config.escala) || 1
        );

        const factor =
            (config.longitudVehiculo / largoOriginal) *
            escalaUsuario;

        modelo.scale.multiplyScalar(factor);
        modelo.updateMatrixWorld(true);

        caja = new THREE.Box3().setFromObject(modelo);

        const centro = caja.getCenter(new THREE.Vector3());

        // Centrar horizontalmente y apoyar el modelo en el suelo.
        modelo.position.x -= centro.x;
        modelo.position.z -= centro.z;
        modelo.position.y -= caja.min.y;

        modelo.updateMatrixWorld(true);
        contenedor.updateMatrixWorld(true);

        return contenedor;
    }

    // --------------------------------------------------------
    // PLAZAS: CONSULTAR, RESERVAR Y LIBERAR
    // --------------------------------------------------------

    function plazaLibre() {
        return plazas.find(plaza => !plaza.ocupada) ?? null;
    }

    function reservar(plaza, coche) {
        if (!plaza || plaza.ocupada) return false;

        plaza.ocupada = true;
        plaza.vehiculoId = coche.id;

        return true;
    }

    function liberar(plaza) {
        if (!plaza) return;

        plaza.ocupada = false;
        plaza.vehiculoId = null;
    }

    // --------------------------------------------------------
    // RUTAS EXTERIORES
    //
    // La circulación utiliza los carriles de la carretera.
    // Ningún punto de circulación atraviesa el interior.
    // --------------------------------------------------------

    function crearRutaLlegada(plaza, lado) {
        const xCarril = lado * 10;
        const zPasillo = plaza.z + 3.2;

        return [
            { x: xCarril, z: 83 },
            { x: xCarril, z: zPasillo },
            { x: plaza.x, z: zPasillo },
            { x: plaza.x, z: plaza.z }
        ];
    }

    function crearRutaSalida(coche) {
        const plaza = coche.plaza;

        const lado = plaza.x < 0 ? -1 : 1;
        const xCarril = lado * 10;
        const zPasillo = plaza.z + 3.2;

        return [
            { x: plaza.x, z: zPasillo },
            { x: xCarril, z: zPasillo },
            { x: xCarril, z: 83 },
            { x: xCarril, z: 96 }
        ];
    }

    // --------------------------------------------------------
    // NOTIFICACIONES
    // --------------------------------------------------------

    function notificarEstacionamiento(coche) {
        if (typeof config.alEstacionar !== 'function') return;

        try {
            config.alEstacionar({
                id: coche.id,
                grupo: coche.grupo,

                plaza: {
                    x: coche.plaza.x,
                    z: coche.plaza.z
                },

                vehiculo: coche
            });
        } catch (error) {
            console.error(
                '[VEHICULOS] Error en alEstacionar:',
                error
            );
        }
    }

    function notificarSalida(coche) {
        if (typeof config.alSalir !== 'function') return;

        try {
            config.alSalir({
                id: coche.id,
                grupo: coche.grupo,
                vehiculo: coche
            });
        } catch (error) {
            console.error(
                '[VEHICULOS] Error en alSalir:',
                error
            );
        }
    }

    // --------------------------------------------------------
    // ESTACIONAR
    // --------------------------------------------------------

    function estacionar(coche) {
        if (!coche.plaza) {
            coche.estado = 'preparado';
            return;
        }

        coche.estado = 'estacionado';

        coche.grupo.position.set(
            coche.plaza.x,
            0,
            coche.plaza.z
        );

        coche.grupo.rotation.set(
            0,
            Math.PI + config.correccionRotacionY,
            0
        );

        notificarEstacionamiento(coche);

        console.info(
            `[VEHICULOS] Auto ${coche.id} estacionado.`,
            {
                modelo: coche.archivo,
                plaza: {
                    x: coche.plaza.x,
                    z: coche.plaza.z
                }
            }
        );
    }

    // --------------------------------------------------------
    // INICIAR LLEGADA
    // --------------------------------------------------------

    function iniciarLlegada(coche) {
        if (!coche || coche.eliminado || eliminado) {
            return false;
        }

        const plaza = plazaLibre();

        if (!plaza) {
            coche.estado = 'esperando';

            if (!cola.includes(coche)) {
                cola.push(coche);
            }

            return false;
        }

        if (!reservar(plaza, coche)) return false;

        coche.plaza = plaza;

        const lado = plaza.x < 0 ? -1 : 1;

        coche.ruta = crearRutaLlegada(plaza, lado);
        coche.indiceRuta = 0;
        coche.estado = 'circulando';

        // Escalonar los autos para que no aparezcan amontonados.
        const cochesEnMarcha = vehiculos.filter(v =>
            !v.eliminado &&
            (
                v.estado === 'circulando' ||
                v.estado === 'saliendo'
            )
        ).length;

        const separacion = config.separacionInicial;

        coche.grupo.position.set(
            lado * 10,
            0,
            84 + cochesEnMarcha * separacion
        );

        coche.grupo.rotation.set(
            0,
            Math.PI + config.correccionRotacionY,
            0
        );

        console.info(
            `[VEHICULOS] Auto ${coche.id} inicia llegada.`,
            {
                modelo: coche.archivo,
                destino: {
                    x: plaza.x,
                    z: plaza.z
                }
            }
        );

        return true;
    }

    // --------------------------------------------------------
    // CREAR VEHÍCULO
    // --------------------------------------------------------

    function crearVehiculo(original, indice, archivo) {
        const modelo = prepararModelo(original, indice);
        const id = siguienteId++;

        modelo.userData.archivoModelo = archivo;
        modelo.userData.idVehiculo = id;

        grupo.add(modelo);

        const coche = {
            id,
            archivo,
            grupo: modelo,
            plaza: null,
            ruta: [],
            indiceRuta: 0,
            estado: 'preparado',
            velocidad: config.velocidad,
            eliminado: false
        };

        vehiculos.push(coche);
        cola.push(coche);

        return coche;
    }

    // --------------------------------------------------------
    // INICIAR VEHÍCULOS INICIALES
    // --------------------------------------------------------

    function iniciarCochesIniciales() {
        if (inicialesIniciados || !cargado || eliminado) {
            return;
        }

        inicialesIniciados = true;

        const cantidad = Math.min(
            config.cochesIniciales,
            cola.length,
            plazas.filter(p => !p.ocupada).length
        );

        let iniciados = 0;

        for (let i = 0; i < cantidad; i++) {
            const coche = cola.shift();

            if (coche && iniciarLlegada(coche)) {
                iniciados++;
            }
        }

        console.info(
            `[VEHICULOS] Carga completa: ${vehiculos.length} vehículos disponibles.`
        );

        console.info(
            `[VEHICULOS] Llegadas iniciales: ${iniciados}.`
        );

        console.info(
            `[VEHICULOS] Vehículos pendientes en cola: ${cola.length}.`
        );
    }

    // --------------------------------------------------------
    // SOLICITAR LLEGADA MANUAL
    // --------------------------------------------------------

    function solicitarLlegada() {
        if (
            !cargado ||
            eliminado ||
            cola.length === 0 ||
            !plazaLibre()
        ) {
            return false;
        }

        const coche = cola.shift();

        if (!coche) return false;

        const resultado = iniciarLlegada(coche);

        if (!resultado && !cola.includes(coche)) {
            cola.push(coche);
        }

        return resultado;
    }

    // --------------------------------------------------------
    // SOLICITAR SALIDA
    // --------------------------------------------------------

    function solicitarSalida(id) {
        if (eliminado) return false;

        const coche = vehiculos.find(v =>
            v.id === id && !v.eliminado
        );

        if (
            !coche ||
            coche.estado !== 'estacionado' ||
            !coche.plaza
        ) {
            return false;
        }

        coche.estado = 'saliendo';
        coche.ruta = crearRutaSalida(coche);
        coche.indiceRuta = 0;

        console.info(
            `[VEHICULOS] Auto ${coche.id} comienza a salir.`
        );

        return true;
    }

    // --------------------------------------------------------
    // FINALIZAR SALIDA Y REUTILIZAR
    // --------------------------------------------------------

    function finalizarSalida(coche) {
        liberar(coche.plaza);

        coche.plaza = null;
        coche.ruta = [];
        coche.indiceRuta = 0;
        coche.estado = 'esperando';

        // Ocultar el vehículo mientras espera su próxima llegada.
        // Así no queda estacionado en mitad de la carretera.
        coche.grupo.visible = false;

        notificarSalida(coche);

        if (
            !coche.eliminado &&
            !eliminado &&
            !cola.includes(coche)
        ) {
            cola.push(coche);
        }

        console.info(
            `[VEHICULOS] Auto ${coche.id} salió y quedó en espera.`,
            coche.archivo
        );
    }

    // --------------------------------------------------------
    // ACTUALIZAR MOVIMIENTO
    // --------------------------------------------------------

    function actualizarVehiculo(coche, delta) {
        if (
            coche.eliminado ||
            (
                coche.estado !== 'circulando' &&
                coche.estado !== 'saliendo'
            )
        ) {
            return;
        }

        const punto = coche.ruta[coche.indiceRuta];

        if (!punto) {
            if (coche.estado === 'circulando') {
                estacionar(coche);
            } else {
                finalizarSalida(coche);
            }

            return;
        }

        const dx = punto.x - coche.grupo.position.x;
        const dz = punto.z - coche.grupo.position.z;
        const distancia = Math.hypot(dx, dz);

        if (distancia < 0.35) {
            coche.indiceRuta++;

            if (coche.indiceRuta >= coche.ruta.length) {
                if (coche.estado === 'circulando') {
                    estacionar(coche);
                } else {
                    finalizarSalida(coche);
                }
            }

            return;
        }

        const paso = Math.min(
            coche.velocidad * delta,
            distancia
        );

        const direccion = Math.atan2(dx, dz);

        const objetivo = new THREE.Quaternion()
            .setFromAxisAngle(
                new THREE.Vector3(0, 1, 0),
                direccion + config.correccionRotacionY
            );

        coche.grupo.quaternion.slerp(
            objetivo,
            Math.min(
                1,
                config.suavizadoRotacion * delta
            )
        );

        coche.grupo.position.x += (dx / distancia) * paso;
        coche.grupo.position.z += (dz / distancia) * paso;
    }

    // --------------------------------------------------------
    // CARGA DE MODELOS
    // --------------------------------------------------------

    function finalizarCarga(archivo, error = null) {
        if (eliminado) return;

        if (error) {
            errorCarga = error;

            console.error(
                `[VEHICULOS] No se pudo cargar ${archivo}.`,
                error
            );

            console.error(
                `[VEHICULOS] Comprueba que exista public${archivo}`
            );
        }

        cargasPendientes--;

        if (cargasPendientes <= 0) {
            cargasPendientes = 0;
            cargado = true;

            console.info(
                `[VEHICULOS] Se cargaron ${vehiculos.length} de ` +
                `${config.modelos.length} modelos configurados.`
            );

            if (vehiculos.length === 0) {
                console.error(
                    '[VEHICULOS] No se pudo cargar ningún automóvil.'
                );
                return;
            }

            iniciarCochesIniciales();
        }
    }

    if (config.modelos.length === 0) {
        cargado = true;
        inicialesIniciados = true;

        console.warn(
            '[VEHICULOS] No hay modelos configurados.'
        );
    } else {
        config.modelos.forEach((archivo, indice) => {
            loader.load(
                archivo,

                gltf => {
                    if (eliminado) return;

                    if (!gltf?.scene) {
                        finalizarCarga(
                            archivo,
                            new Error(
                                'El GLB no contiene una escena válida.'
                            )
                        );
                        return;
                    }

                    // IMPORTANTE:
                    // Se crea un solo vehículo por cada GLB.
                    // No se recorren los hijos para crear más autos.
                    const coche = crearVehiculo(
                        gltf.scene,
                        indice,
                        archivo
                    );

                    // Los autos esperan fuera de escena hasta su turno.
                    coche.grupo.visible = false;

                    console.info(
                        `[VEHICULOS] Modelo listo: ${archivo}`
                    );

                    finalizarCarga(archivo);
                },

                evento => {
                    if (evento.total > 0) {
                        const porcentaje = Math.round(
                            (evento.loaded / evento.total) * 100
                        );

                        console.info(
                            `[VEHICULOS] ${archivo}: ${porcentaje}%`
                        );
                    }
                },

                error => {
                    finalizarCarga(archivo, error);
                }
            );
        });
    }

    // --------------------------------------------------------
    // ACTUALIZACIÓN PRINCIPAL
    // --------------------------------------------------------

    function actualizar(delta) {
        if (eliminado) return;

        const dt = Math.min(
            Math.max(Number(delta) || 0, 0),
            0.05
        );

        for (const coche of vehiculos) {
            actualizarVehiculo(coche, dt);
        }

        // Llegadas periódicas:
        // un vehículo nuevo cada cierto tiempo mientras existan
        // autos esperando y plazas disponibles.
        if (
            cargado &&
            cola.length > 0 &&
            plazaLibre()
        ) {
            tiempoLlegada += dt;

            if (tiempoLlegada >= config.tiempoEntreLlegadas) {
                tiempoLlegada = 0;

                solicitarLlegada();
            }
        } else {
            tiempoLlegada = 0;
        }
    }

    // --------------------------------------------------------
    // CONSULTAS
    // --------------------------------------------------------

    function obtenerVehiculo(id) {
        return vehiculos.find(coche => coche.id === id) ?? null;
    }

    function obtenerPlazas() {
        return plazas.map(plaza => ({
            x: plaza.x,
            z: plaza.z,
            ocupada: plaza.ocupada,
            vehiculoId: plaza.vehiculoId
        }));
    }

    function obtenerEstacionados() {
        return vehiculos.filter(
            coche => coche.estado === 'estacionado'
        );
    }

    // --------------------------------------------------------
    // ELIMINAR UN VEHÍCULO
    // --------------------------------------------------------

    function eliminarVehiculo(id) {
        const coche = vehiculos.find(v => v.id === id);

        if (!coche) return false;

        coche.eliminado = true;

        liberar(coche.plaza);
        coche.plaza = null;

        grupo.remove(coche.grupo);
        coche.grupo.clear();

        const indice = vehiculos.indexOf(coche);

        if (indice >= 0) {
            vehiculos.splice(indice, 1);
        }

        const indiceCola = cola.indexOf(coche);

        if (indiceCola >= 0) {
            cola.splice(indiceCola, 1);
        }

        return true;
    }

    // --------------------------------------------------------
    // ELIMINAR TODO EL SISTEMA
    // --------------------------------------------------------

    function eliminar() {
        if (eliminado) return;

        eliminado = true;

        for (const coche of [...vehiculos]) {
            coche.eliminado = true;

            liberar(coche.plaza);

            grupo.remove(coche.grupo);
            coche.grupo.clear();
        }

        vehiculos.length = 0;
        cola.length = 0;

        scene.remove(grupo);
        grupo.clear();

        for (const plaza of plazas) {
            plaza.ocupada = false;
            plaza.vehiculoId = null;
        }
    }

    // --------------------------------------------------------
    // API PÚBLICA
    // --------------------------------------------------------

    return {
        grupo,

        actualizar,

        solicitarLlegada,
        solicitarSalida,

        obtenerVehiculos: () => [...vehiculos],
        obtenerVehiculo,
        obtenerEstacionados,
        obtenerPlazas,

        eliminarVehiculo,
        eliminar,

        get cargado() {
            return cargado;
        },

        get error() {
            return errorCarga;
        },

        get cantidad() {
            return vehiculos.length;
        },

        get disponibles() {
            return cola.length;
        },

        get plazasLibres() {
            return plazas.filter(
                plaza => !plaza.ocupada
            ).length;
        }
    };
}
