
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// VEHICULOS DEL SUPERMERCADO
// Compatible con Three.js 0.180+
// ============================================================

export function crearVehiculos(scene, opciones = {}) {
    if (!scene) {
        throw new Error('crearVehiculos necesita una THREE.Scene.');
    }

    const CONFIG = {
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

        tiempoEntreLlegadas: 7,
        cochesIniciales: 3,

        alturaModelo: 0,
        rotacionModelo: 0,

        // Rutas compatibles con el estacionamiento
        entrada: {
            zExterior: 96,
            zAcceso: 83,
            zFrontal: 29,
            xCarril: 0
        },

        salida: {
            zExterior: 96,
            zAcceso: 83,
            xCarril: 0
        },

        posicionesX: [-24, -16, -8, 8, 16, 24],
        posicionesZ: [32, 39, 46, 53],

        ...opciones
    };

    const loader = new GLTFLoader();

    const grupoVehiculos = new THREE.Group();
    grupoVehiculos.name = 'SISTEMA_VEHICULOS';
    scene.add(grupoVehiculos);

    const vehiculos = new Map();
    const plazas = [];

    const colaLlegadas = [];
    const colaSalidas = [];

    let contadorId = 0;
    let temporizadorLlegadas = 0;
    let modeloActual = 0;
    let destruido = false;

    const vectorDireccion = new THREE.Vector3();
    const vectorObjetivo = new THREE.Vector3();

    // --------------------------------------------------------
    // CREACIÓN DE PLAZAS
    // --------------------------------------------------------

    CONFIG.posicionesZ.forEach((z, fila) => {
        CONFIG.posicionesX.forEach((x, columna) => {
            plazas.push({
                id: `P${fila + 1}-${columna + 1}`,
                x,
                z,
                ocupada: false,
                vehiculoId: null
            });
        });
    });

    function obtenerPlazaLibre() {
        return plazas.find(plaza => !plaza.ocupada) || null;
    }

    function reservarPlaza(plaza, id) {
        if (!plaza || plaza.ocupada) return false;

        plaza.ocupada = true;
        plaza.vehiculoId = id;

        return true;
    }

    function liberarPlaza(plaza) {
        if (!plaza) return;

        plaza.ocupada = false;
        plaza.vehiculoId = null;
    }

    // --------------------------------------------------------
    // UTILIDADES
    // --------------------------------------------------------

    function obtenerModelo() {
        if (!CONFIG.modelos.length) return null;

        const ruta = CONFIG.modelos[
            modeloActual % CONFIG.modelos.length
        ];

        modeloActual++;
        return ruta;
    }

    function distanciaXZ(a, b) {
        return Math.hypot(a.x - b.x, a.z - b.z);
    }

    function normalizarAngulo(angulo) {
        while (angulo > Math.PI) angulo -= Math.PI * 2;
        while (angulo < -Math.PI) angulo += Math.PI * 2;
        return angulo;
    }

    function calcularRotacion(origen, destino) {
        const dx = destino.x - origen.x;
        const dz = destino.z - origen.z;

        if (Math.abs(dx) + Math.abs(dz) < 0.0001) {
            return 0;
        }

        // El frente del vehículo se considera +Z.
        return Math.atan2(dx, dz);
    }

    function interpolarRotacion(actual, objetivo, factor) {
        const diferencia = normalizarAngulo(objetivo - actual);
        return actual + diferencia * factor;
    }

    function crearPunto(x, z) {
        return new THREE.Vector3(x, 0, z);
    }

    // --------------------------------------------------------
    // RUTAS DE CIRCULACIÓN
    // --------------------------------------------------------

    function rutaEntrada(plaza) {
        const x = plaza.x;
        const z = plaza.z;

        return [
            crearPunto(0, CONFIG.entrada.zExterior),
            crearPunto(0, CONFIG.entrada.zAcceso),
            crearPunto(0, 78),
            crearPunto(x, 78),
            crearPunto(x, z + 5),
            crearPunto(x, z)
        ];
    }

    function rutaSalida(plaza) {
        const x = plaza.x;
        const z = plaza.z;

        return [
            crearPunto(x, z),
            crearPunto(x, z + 5),
            crearPunto(x, 78),
            crearPunto(0, 78),
            crearPunto(0, CONFIG.salida.zAcceso),
            crearPunto(0, CONFIG.salida.zExterior)
        ];
    }

    // --------------------------------------------------------
    // CARGAR MODELO
    // --------------------------------------------------------

    function cargarModelo(vehiculo, ruta) {
        return new Promise(resolve => {
            loader.load(
                ruta,
                gltf => {
                    if (destruido || vehiculo.eliminado) {
                        resolve(false);
                        return;
                    }

                    const modelo = gltf.scene;

                    modelo.name = `MODELO_${vehiculo.id}`;

                    modelo.scale.setScalar(CONFIG.escala);

                    modelo.rotation.y = CONFIG.rotacionModelo;

                    modelo.traverse(objeto => {
                        if (!objeto.isMesh) return;

                        objeto.castShadow = false;
                        objeto.receiveShadow = false;

                        if (objeto.material) {
                            objeto.material = objeto.material.clone();

                            objeto.material.roughness = Math.max(
                                objeto.material.roughness ?? 0.7,
                                0.35
                            );
                        }
                    });

                    // Centrar el modelo sobre su base.
                    const caja = new THREE.Box3().setFromObject(modelo);
                    const centro = new THREE.Vector3();
                    caja.getCenter(centro);

                    modelo.position.x -= centro.x;
                    modelo.position.z -= centro.z;
                    modelo.position.y -= caja.min.y;

                    modelo.position.y += CONFIG.alturaModelo;

                    vehiculo.modelo = modelo;
                    vehiculo.grupo.add(modelo);

                    resolver(true);
                },

                undefined,

                error => {
                    console.error(
                        `No se pudo cargar el vehículo ${vehiculo.id}:`,
                        ruta,
                        error
                    );

                    crearVehiculoProvisional(vehiculo);
                    resolver(false);
                }
            );
        });
    }

    // --------------------------------------------------------
    // VEHÍCULO PROVISIONAL
    // --------------------------------------------------------

    function crearVehiculoProvisional(vehiculo) {
        const grupo = new THREE.Group();

        const carroceria = new THREE.Mesh(
            new THREE.BoxGeometry(1.9, 0.8, 4),
            new THREE.MeshStandardMaterial({
                color: 0x2878c8,
                metalness: 0.35,
                roughness: 0.4
            })
        );

        carroceria.position.y = 0.8;
        grupo.add(carroceria);

        const cabina = new THREE.Mesh(
            new THREE.BoxGeometry(1.55, 0.8, 1.9),
            new THREE.MeshStandardMaterial({
                color: 0x9fc9df,
                metalness: 0.2,
                roughness: 0.25
            })
        );

        cabina.position.set(0, 1.45, -0.25);
        grupo.add(cabina);

        const materialRueda = new THREE.MeshStandardMaterial({
            color: 0x17191b,
            roughness: 0.9
        });

        for (const x of [-0.98, 0.98]) {
            for (const z of [-1.35, 1.35]) {
                const rueda = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.36, 0.36, 0.18, 12),
                    materialRueda
                );

                rueda.rotation.z = Math.PI / 2;
                rueda.position.set(x, 0.38, z);
                grupo.add(rueda);
            }
        }

        grupo.name = `VEHICULO_PROVISIONAL_${vehiculo.id}`;

        vehiculo.modelo = grupo;
        vehiculo.grupo.add(grupo);
    }

    // --------------------------------------------------------
    // CREAR VEHÍCULO
    // --------------------------------------------------------

    function crearVehiculo() {
        if (destruido) return null;

        const id = `AUTO_${++contadorId}`;

        const grupo = new THREE.Group();
        grupo.name = id;

        grupo.position.set(
            0,
            0,
            CONFIG.entrada.zExterior
        );

        grupoVehiculos.add(grupo);

        const vehiculo = {
            id,
            grupo,
            modelo: null,
            plaza: null,

            estado: 'cargando',
            ruta: [],
            indiceRuta: 0,

            velocidadActual: 0,
            velocidadObjetivo: CONFIG.velocidad,

            callbackEstacionarEjecutado: false,
            eliminado: false,

            tiempoEspera: 0,
            tipo: 'vehiculo'
        };

        vehiculos.set(id, vehiculo);

        const rutaModelo = obtenerModelo();

        if (!rutaModelo) {
            crearVehiculoProvisional(vehiculo);
            vehiculo.estado = 'esperando';
            return vehiculo;
        }

        cargarModelo(vehiculo, rutaModelo).then(() => {
            if (destruido || vehiculo.eliminado) return;

            if (vehiculo.estado === 'cargando') {
                vehiculo.estado = 'esperando';
            }
        });

        return vehiculo;
    }

    // --------------------------------------------------------
    // INICIAR LLEGADA
    // --------------------------------------------------------

    function iniciarLlegada(vehiculo, plaza) {
        if (!vehiculo || !plaza || vehiculo.eliminado) return false;

        if (!reservarPlaza(plaza, vehiculo.id)) return false;

        vehiculo.plaza = plaza;
        vehiculo.ruta = rutaEntrada(plaza);
        vehiculo.indiceRuta = 0;
        vehiculo.estado = 'entrando';
        vehiculo.velocidadActual = 0;
        vehiculo.callbackEstacionarEjecutado = false;

        vehiculo.grupo.position.set(
            0,
            0,
            CONFIG.entrada.zExterior
        );

        return true;
    }

    function solicitarLlegada() {
        if (destruido) return false;

        const plaza = obtenerPlazaLibre();

        if (!plaza) {
            console.warn('Estacionamiento lleno.');
            return false;
        }

        let vehiculo = [...vehiculos.values()].find(v =>
            !v.eliminado &&
            (v.estado === 'esperando' || v.estado === 'oculto')
        );

        if (!vehiculo) {
            vehiculo = crearVehiculo();
        }

        if (!vehiculo) return false;

        if (vehiculo.estado === 'cargando') {
            colaLlegadas.push({ vehiculo, plaza });
            return true;
        }

        return iniciarLlegada(vehiculo, plaza);
    }

    // --------------------------------------------------------
    // INICIAR SALIDA
    // --------------------------------------------------------

    function solicitarSalida(id) {
        const vehiculo = vehiculos.get(id);

        if (!vehiculo || vehiculo.eliminado) return false;

        if (vehiculo.estado !== 'estacionado') {
            return false;
        }

        vehiculo.ruta = rutaSalida(vehiculo.plaza);
        vehiculo.indiceRuta = 0;
        vehiculo.estado = 'saliendo';
        vehiculo.velocidadActual = 0;

        return true;
    }

    // --------------------------------------------------------
    // MOVIMIENTO
    // --------------------------------------------------------

    function moverHaciaPunto(vehiculo, destino, delta) {
        const posicion = vehiculo.grupo.position;

        vectorObjetivo.set(destino.x, 0, destino.z);

        vectorDireccion.subVectors(vectorObjetivo, posicion);
        vectorDireccion.y = 0;

        const distancia = vectorDireccion.length();

        if (distancia < 0.08) {
            posicion.x = destino.x;
            posicion.z = destino.z;
            return true;
        }

        vectorDireccion.normalize();

        const velocidadDeseada = Math.min(
            CONFIG.velocidadMaxima,
            vehiculo.velocidadObjetivo
        );

        vehiculo.velocidadActual = THREE.MathUtils.damp(
            vehiculo.velocidadActual,
            velocidadDeseada,
            CONFIG.aceleracion,
            delta
        );

        const avance = Math.min(
            distancia,
            vehiculo.velocidadActual * delta
        );

        posicion.addScaledVector(vectorDireccion, avance);

        const rotacionObjetivo = calcularRotacion(
            posicion,
            destino
        );

        vehiculo.grupo.rotation.y = interpolarRotacion(
            vehiculo.grupo.rotation.y,
            rotacionObjetivo,
            Math.min(1, delta * 4)
        );

        return false;
    }

    function actualizarRuta(vehiculo, delta) {
        if (vehiculo.indiceRuta >= vehiculo.ruta.length) {
            if (vehiculo.estado === 'entrando') {
                estacionar(vehiculo);
            } else if (vehiculo.estado === 'saliendo') {
                finalizarSalida(vehiculo);
            }

            return;
        }

        const destino = vehiculo.ruta[vehiculo.indiceRuta];

        const llego = moverHaciaPunto(
            vehiculo,
            destino,
            delta
        );

        if (llego) {
            vehiculo.indiceRuta++;

            if (vehiculo.indiceRuta >= vehiculo.ruta.length) {
                if (vehiculo.estado === 'entrando') {
                    estacionar(vehiculo);
                } else if (vehiculo.estado === 'saliendo') {
                    finalizarSalida(vehiculo);
                }
            }
        }
    }

    // --------------------------------------------------------
    // ESTACIONAR
    // --------------------------------------------------------

    function estacionar(vehiculo) {
        if (!vehiculo || vehiculo.estado !== 'entrando') return;

        vehiculo.estado = 'estacionado';
        vehiculo.velocidadActual = 0;

        if (vehiculo.plaza) {
            vehiculo.grupo.position.set(
                vehiculo.plaza.x,
                0,
                vehiculo.plaza.z
            );
        }

        if (!vehiculo.callbackEstacionarEjecutado) {
            vehiculo.callbackEstacionarEjecutado = true;

            if (typeof CONFIG.alEstacionar === 'function') {
                CONFIG.alEstacionar({
                    id: vehiculo.id,
                    grupo: vehiculo.grupo,
                    plaza: {
                        x: vehiculo.plaza.x,
                        z: vehiculo.plaza.z,
                        id: vehiculo.plaza.id
                    },
                    vehiculo
                });
            }
        }

        console.log(
            `Vehículo ${vehiculo.id} estacionado en ${vehiculo.plaza.id}`
        );
    }

    // --------------------------------------------------------
    // FINALIZAR SALIDA
    // --------------------------------------------------------

    function finalizarSalida(vehiculo) {
        if (!vehiculo || vehiculo.estado !== 'saliendo') return;

        const plazaAnterior = vehiculo.plaza;

        liberarPlaza(plazaAnterior);

        vehiculo.plaza = null;
        vehiculo.estado = 'oculto';
        vehiculo.velocidadActual = 0;

        vehiculo.grupo.position.set(
            0,
            0,
            CONFIG.salida.zExterior
        );

        if (typeof CONFIG.alSalir === 'function') {
            CONFIG.alSalir({
                id: vehiculo.id,
                grupo: vehiculo.grupo,
                vehiculo,
                plaza: plazaAnterior
                    ? { x: plazaAnterior.x, z: plazaAnterior.z, id: plazaAnterior.id }
                    : null
            });
        }

        // El vehículo queda disponible para una nueva llegada.
        vehiculo.estado = 'esperando';

        console.log(`Vehículo ${vehiculo.id} salió del estacionamiento.`);
    }

    // --------------------------------------------------------
    // COLA DE LLEGADAS
    // --------------------------------------------------------

    function procesarColaLlegadas() {
        for (let i = colaLlegadas.length - 1; i >= 0; i--) {
            const solicitud = colaLlegadas[i];

            if (
                solicitud.vehiculo.eliminado ||
                solicitud.vehiculo.estado !== 'esperando'
            ) {
                continue;
            }

            if (iniciarLlegada(solicitud.vehiculo, solicitud.plaza)) {
                colaLlegadas.splice(i, 1);
            }
        }
    }

    // --------------------------------------------------------
    // ACTUALIZACIÓN GENERAL
    // --------------------------------------------------------

    function actualizar(delta = 0.016) {
        if (destruido) return;

        delta = Math.min(Math.max(delta, 0), 0.05);

        temporizadorLlegadas += delta;

        if (temporizadorLlegadas >= CONFIG.tiempoEntreLlegadas) {
            temporizadorLlegadas = 0;

            if (obtenerPlazaLibre()) {
                solicitarLlegada();
            }
        }

        procesarColaLlegadas();

        for (const vehiculo of vehiculos.values()) {
            if (
                vehiculo.eliminado ||
                vehiculo.estado === 'cargando' ||
                vehiculo.estado === 'esperando' ||
                vehiculo.estado === 'oculto' ||
                vehiculo.estado === 'estacionado'
            ) {
                continue;
            }

            actualizarRuta(vehiculo, delta);
        }
    }

    // --------------------------------------------------------
    // INFORMACIÓN DEL SISTEMA
    // --------------------------------------------------------

    function obtenerEstado() {
        const resultado = {
            totalVehiculos: vehiculos.size,
            plazasTotales: plazas.length,
            plazasOcupadas: plazas.filter(p => p.ocupada).length,
            plazasLibres: plazas.filter(p => !p.ocupada).length,
            entrando: 0,
            estacionados: 0,
            saliendo: 0
        };

        for (const vehiculo of vehiculos.values()) {
            if (vehiculo.estado === 'entrando') resultado.entrando++;
            if (vehiculo.estado === 'estacionado') resultado.estacionados++;
            if (vehiculo.estado === 'saliendo') resultado.saliendo++;
        }

        return resultado;
    }

    function obtenerVehiculo(id) {
        return vehiculos.get(id) || null;
    }

    function obtenerPlazas() {
        return plazas.map(plaza => ({
            id: plaza.id,
            x: plaza.x,
            z: plaza.z,
            ocupada: plaza.ocupada,
            vehiculoId: plaza.vehiculoId
        }));
    }

    function eliminarVehiculo(id) {
        const vehiculo = vehiculos.get(id);

        if (!vehiculo) return false;

        vehiculo.eliminado = true;

        liberarPlaza(vehiculo.plaza);

        grupoVehiculos.remove(vehiculo.grupo);

        vehiculo.grupo.traverse(objeto => {
            if (!objeto.isMesh) return;

            objeto.geometry?.dispose();

            if (Array.isArray(objeto.material)) {
                objeto.material.forEach(m => m.dispose());
            } else {
                objeto.material?.dispose();
            }
        });

        vehiculos.delete(id);

        return true;
    }

    function destruir() {
        destruido = true;

        for (const id of [...vehiculos.keys()]) {
            eliminarVehiculo(id);
        }

        colaLlegadas.length = 0;
        colaSalidas.length = 0;

        scene.remove(grupoVehiculos);
    }

    // --------------------------------------------------------
    // CREAR VEHÍCULOS INICIALES
    // --------------------------------------------------------

    for (let i = 0; i < CONFIG.cochesIniciales; i++) {
        const vehiculo = crearVehiculo();

        if (vehiculo) {
            // Los vehículos iniciales también entran por la ruta.
            colaLlegadas.push({
                vehiculo,
                plaza: null
            });
        }
    }

    // Corregir asignación de plazas para vehículos iniciales.
    function procesarIniciales() {
        for (let i = colaLlegadas.length - 1; i >= 0; i--) {
            const solicitud = colaLlegadas[i];

            if (!solicitud.plaza) {
                const plaza = obtenerPlazaLibre();

                if (!plaza) continue;

                solicitud.plaza = plaza;
            }

            if (solicitud.vehiculo.estado === 'esperando') {
                if (iniciarLlegada(solicitud.vehiculo, solicitud.plaza)) {
                    colaLlegadas.splice(i, 1);
                }
            }
        }
    }

    // Envolver la actualización para procesar los vehículos iniciales.
    const actualizarBase = actualizar;

    function actualizarCompleto(delta = 0.016) {
        if (destruido) return;

        procesarIniciales();
        actualizarBase(delta);
    }

    console.log('Sistema de vehículos iniciado.');
    console.log(`Modelos configurados: ${CONFIG.modelos.length}`);
    console.log(`Plazas disponibles: ${plazas.length}`);

    return {
        grupo: grupoVehiculos,
        vehiculos,
        plazas,

        actualizar: actualizarCompleto,
        solicitarLlegada,
        solicitarSalida,

        obtenerEstado,
        obtenerVehiculo,
        obtenerPlazas,

        eliminarVehiculo,
        destruir,

        get totalVehiculos() {
            return vehiculos.size;
        },

        get plazasOcupadas() {
            return plazas.filter(p => p.ocupada).length;
        },

        get plazasLibres() {
            return plazas.filter(p => !p.ocupada).length;
        }
    };
}
