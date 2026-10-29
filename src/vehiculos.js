
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// SISTEMA DE VEHÍCULOS DEL SUPERMERCADO
// Compatible con Three.js + Vite
//
// Características:
// - 7 modelos de vehículos GLB.
// - 24 plazas de estacionamiento.
// - Llegadas automáticas.
// - Rutas de entrada y salida.
// - Reserva y liberación de plazas.
// - Rotación suave.
// - Reutilización de vehículos que salen.
// - API pública compatible con main.js.
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
        velocidad: 7.5,
        suavizadoRotacion: 5,
        correccionRotacionY: 0,

        tiempoEntreLlegadas: 5,
        cochesIniciales: 7,

        // Distancia entre vehículos al comenzar su recorrido.
        separacionInicial: 6,

        // Evita iniciar llegadas cuando no hay plazas.
        alEstacionar: null,
        alSalir: null,

        ...opciones
    };

    config.modelos = Array.isArray(config.modelos)
        ? [...config.modelos]
        : [];

    config.tiempoEntreLlegadas = Math.max(
        0.5,
        Number(config.tiempoEntreLlegadas) || 7
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

    // --------------------------------------------------------
    // GRUPO PRINCIPAL
    // --------------------------------------------------------

    const grupo = new THREE.Group();

    grupo.name = 'SISTEMA_VEHICULOS';

    scene.add(grupo);

    const loader = new GLTFLoader();

    // --------------------------------------------------------
    // ESTADO INTERNO
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
    // CREAR PLAZAS
    // --------------------------------------------------------

    // Conservamos la distribución original del estacionamiento.
    for (const z of [40, 49, 63, 72]) {
        for (const x of [-24, -16, -8, 8, 16, 24]) {
            plazas.push({
                x,
                z,
                ocupada: false,
                vehiculoId: null
            });
        }
    }

    // --------------------------------------------------------
    // PREPARAR MODELOS
    // --------------------------------------------------------

    function prepararModelo(original, indice) {
        const contenedor = new THREE.Group();

        contenedor.name = `VEHICULO_${indice + 1}`;

        const modelo = original.clone(true);

        modelo.name = `MODELO_GLTF_${indice + 1}`;

        modelo.traverse(objeto => {
            if (!objeto.isMesh) return;

            objeto.castShadow = true;
            objeto.receiveShadow = true;

            // Clonamos los materiales para evitar que los cambios
            // en un vehículo afecten a los demás.
            if (Array.isArray(objeto.material)) {
                objeto.material = objeto.material.map(material =>
                    material ? material.clone() : material
                );
            } else if (objeto.material) {
                objeto.material = objeto.material.clone();
            }
        });

        contenedor.add(modelo);

        modelo.updateMatrixWorld(true);

        let caja = new THREE.Box3().setFromObject(modelo);

        if (caja.isEmpty()) {
            console.warn(
                `[VEHICULOS] El modelo ${indice + 1} está vacío.`
            );

            return contenedor;
        }

        const tamano = caja.getSize(new THREE.Vector3());

        const largoOriginal = Math.max(
            tamano.x,
            tamano.z,
            0.01
        );

        const factor =
            (config.longitudVehiculo / largoOriginal) *
            Math.max(0.001, Number(config.escala) || 1);

        modelo.scale.multiplyScalar(factor);

        modelo.updateMatrixWorld(true);

        caja = new THREE.Box3().setFromObject(modelo);

        const centro = caja.getCenter(new THREE.Vector3());

        // Centrar el vehículo horizontalmente y apoyar sus ruedas
        // sobre el suelo.
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
        if (!plaza || plaza.ocupada) {
            return false;
        }

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
    // RUTAS DE CIRCULACIÓN
    // --------------------------------------------------------

    function crearRutaLlegada(plaza, lado) {
        const xCarril = lado * 31;
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
        const xCarril = lado * 31;
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
        if (typeof config.alEstacionar !== 'function') {
            return;
        }

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
        if (typeof config.alSalir !== 'function') {
            return;
        }

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
    // ESTACIONAR VEHÍCULO
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

        coche.tiempoParado = 0;

        notificarEstacionamiento(coche);

        console.info(
            `[VEHICULOS] Auto ${coche.id} estacionado.`,
            {
                modelo: coche.archivo,
                x: coche.plaza.x,
                z: coche.plaza.z
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

        if (!reservar(plaza, coche)) {
            return false;
        }

        coche.plaza = plaza;

        const lado = plaza.x < 0 ? -1 : 1;

        coche.ruta = crearRutaLlegada(plaza, lado);
        coche.indiceRuta = 0;
        coche.estado = 'circulando';

        // Colocar los vehículos que llegan a distintas distancias
        // para reducir las superposiciones al comenzar.
        const cochesEnMarcha = vehiculos.filter(v =>
            !v.eliminado &&
            (
                v.estado === 'circulando' ||
                v.estado === 'saliendo'
            )
        ).length;

        const separacion = Math.max(
            4.5,
            Number(config.separacionInicial) || 6
        );

        coche.grupo.position.set(
            lado * 31,
            0,
            84 + cochesEnMarcha * separacion
        );

        coche.grupo.rotation.set(
            0,
            Math.PI + config.correccionRotacionY,
            0
        );

        console.info(
            `[VEHICULOS] Auto ${coche.id} inicia su llegada.`,
            {
                modelo: coche.archivo,
                plaza: {
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
            tiempoParado: 0,

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
        if (
            inicialesIniciados ||
            !cargado ||
            eliminado
        ) {
            return;
        }

        inicialesIniciados = true;

        const cantidad = Math.min(
            config.cochesIniciales,
            cola.length,
            plazas.filter(plaza => !plaza.ocupada).length
        );

        let iniciados = 0;

        for (let i = 0; i < cantidad; i++) {
            const coche = cola.shift();

            if (coche && iniciarLlegada(coche)) {
                iniciados++;
            }
        }

        console.info(
            `[VEHICULOS] Modelos disponibles: ${vehiculos.length}. ` +
            `Llegadas iniciales: ${iniciados}.`
        );
    }

    // --------------------------------------------------------
    // SOLICITAR LLEGADA MANUAL
    // --------------------------------------------------------

    function solicitarLlegada() {
        if (
            !cargado ||
            eliminado ||
            !cola.length ||
            !plazaLibre()
        ) {
            return false;
        }

        const coche = cola.shift();

        if (!coche) {
            return false;
        }

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
        if (eliminado) {
            return false;
        }

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
    // FINALIZAR SALIDA Y REUTILIZAR VEHÍCULO
    // --------------------------------------------------------

    function finalizarSalida(coche) {
        liberar(coche.plaza);

        coche.plaza = null;
        coche.ruta = [];
        coche.indiceRuta = 0;

        // El auto termina fuera del estacionamiento.
        coche.estado = 'esperando';

        notificarSalida(coche);

        // Mantener el vehículo en la escena, fuera del área de
        // estacionamiento, hasta que vuelva a iniciar una llegada.
        //
        // Se reutiliza el mismo modelo, sin cargarlo otra vez.
        if (
            !coche.eliminado &&
            !eliminado &&
            !cola.includes(coche)
        ) {
            cola.push(coche);
        }

        console.info(
            `[VEHICULOS] Auto ${coche.id} salió y quedó disponible.`,
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

        // Orientación suave hacia el siguiente punto.
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

        coche.grupo.position.x +=
            (dx / distancia) * paso;

        coche.grupo.position.z +=
            (dz / distancia) * paso;
    }

    // --------------------------------------------------------
    // CARGAR MODELOS GLB
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
                `[VEHICULOS] Comprueba que exista: public${archivo}`
            );
        }

        cargasPendientes--;

        if (cargasPendientes <= 0) {
            cargasPendientes = 0;
            cargado = true;

            console.info(
                `[VEHICULOS] Carga finalizada. ` +
                `${vehiculos.length} modelos cargados correctamente ` +
                `de ${config.modelos.length} configurados.`
            );

            if (vehiculos.length === 0) {
                console.error(
                    '[VEHICULOS] No se pudo cargar ningún modelo.'
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
                                'El archivo GLB no contiene una escena.'
                            )
                        );

                        return;
                    }

                    crearVehiculo(
                        gltf.scene,
                        indice,
                        archivo
                    );

                    console.info(
                        `[VEHICULOS] Modelo cargado: ${archivo}`
                    );

                    finalizarCarga(archivo);
                },

                evento => {
                    if (evento.total > 0) {
                        const porcentaje = Math.round(
                            evento.loaded /
                            evento.total *
                            100
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

        // Limitar delta evita saltos grandes si el navegador
        // se detiene temporalmente o cambia de pestaña.
        const dt = Math.min(
            Math.max(Number(delta) || 0, 0),
            0.05
        );

        for (const coche of vehiculos) {
            actualizarVehiculo(coche, dt);
        }

        // Generar llegadas periódicas si existen plazas libres.
        if (
            cargado &&
            cola.length > 0 &&
            plazaLibre()
        ) {
            tiempoLlegada += dt;

            if (
                tiempoLlegada >=
                config.tiempoEntreLlegadas
            ) {
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
        return vehiculos.find(
            coche => coche.id === id
        ) ?? null;
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
        const coche = vehiculos.find(
            v => v.id === id
        );

        if (!coche) {
            return false;
        }

        coche.eliminado = true;

        liberar(coche.plaza);

        coche.plaza = null;

        grupo.remove(coche.grupo);

        // No liberamos aquí las geometrías compartidas de los
        // GLB, porque otros vehículos pueden utilizar los mismos
        // recursos internos.
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

        plazas.forEach(plaza => {
            plaza.ocupada = false;
            plaza.vehiculoId = null;
        });
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
