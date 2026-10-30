
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// VEHICULOS DEL SUPERMERCADO
// Three.js 0.180+
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

    let contadorId = 0;
    let temporizadorLlegadas = 0;
    let modeloActual = 0;
    let destruido = false;

    const vectorDireccion = new THREE.Vector3();
    const vectorObjetivo = new THREE.Vector3();

    // ========================================================
    // PLAZAS
    // ========================================================

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

    function liberarPlaza(plaza, id = null) {
        if (!plaza) return;

        // Evita liberar una plaza que ya pertenezca a otro vehículo.
        if (id && plaza.vehiculoId !== id) return;

        plaza.ocupada = false;
        plaza.vehiculoId = null;
    }

    // ========================================================
    // UTILIDADES
    // ========================================================

    function obtenerModelo() {
        if (!CONFIG.modelos.length) return null;

        const ruta = CONFIG.modelos[
            modeloActual % CONFIG.modelos.length
        ];

        modeloActual++;
        return ruta;
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

        return Math.atan2(dx, dz);
    }

    function crearPunto(x, z) {
        return new THREE.Vector3(x, 0, z);
    }

    // ========================================================
    // RUTAS
    // ========================================================

    function rutaEntrada(plaza) {
        return [
            crearPunto(0, CONFIG.entrada.zExterior),
            crearPunto(0, CONFIG.entrada.zAcceso),
            crearPunto(0, 78),
            crearPunto(plaza.x, 78),
            crearPunto(plaza.x, plaza.z + 5),
            crearPunto(plaza.x, plaza.z)
        ];
    }

    function rutaSalida(plaza) {
        return [
            crearPunto(plaza.x, plaza.z),
            crearPunto(plaza.x, plaza.z + 5),
            crearPunto(plaza.x, 78),
            crearPunto(0, 78),
            crearPunto(0, CONFIG.salida.zAcceso),
            crearPunto(0, CONFIG.salida.zExterior)
        ];
    }

    // ========================================================
    // VEHÍCULO PROVISIONAL
    // ========================================================

    function crearVehiculoProvisional(vehiculo) {
        const grupo = new THREE.Group();

        const materialCarroceria = new THREE.MeshStandardMaterial({
            color: 0x2878c8,
            metalness: 0.35,
            roughness: 0.4
        });

        const materialCristal = new THREE.MeshStandardMaterial({
            color: 0x9fc9df,
            metalness: 0.2,
            roughness: 0.25
        });

        const materialRueda = new THREE.MeshStandardMaterial({
            color: 0x17191b,
            roughness: 0.9
        });

        const carroceria = new THREE.Mesh(
            new THREE.BoxGeometry(1.9, 0.8, 4),
            materialCarroceria
        );

        carroceria.position.y = 0.8;
        grupo.add(carroceria);

        const cabina = new THREE.Mesh(
            new THREE.BoxGeometry(1.55, 0.8, 1.9),
            materialCristal
        );

        cabina.position.set(0, 1.45, -0.25);
        grupo.add(cabina);

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

    // ========================================================
    // CARGAR MODELO
    // ========================================================

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
                            const materiales = Array.isArray(objeto.material)
                                ? objeto.material
                                : [objeto.material];

                            const clonados = materiales.map(material => {
                                const clon = material.clone();

                                if ('roughness' in clon) {
                                    clon.roughness = Math.max(
                                        clon.roughness ?? 0.7,
                                        0.35
                                    );
                                }

                                return clon;
                            });

                            objeto.material = Array.isArray(objeto.material)
                                ? clonados
                                : clonados[0];
                        }
                    });

                    const caja = new THREE.Box3().setFromObject(modelo);
                    const centro = new THREE.Vector3();

                    caja.getCenter(centro);

                    modelo.position.x -= centro.x;
                    modelo.position.z -= centro.z;
                    modelo.position.y -= caja.min.y;
                    modelo.position.y += CONFIG.alturaModelo;

                    vehiculo.modelo = modelo;
                    vehiculo.grupo.add(modelo);

                    resolve(true);
                },

                undefined,

                error => {
                    console.error(
                        `No se pudo cargar el vehículo ${vehiculo.id}:`,
                        ruta,
                        error
                    );

                    if (!destruido && !vehiculo.eliminado) {
                        crearVehiculoProvisional(vehiculo);
                    }

                    resolve(false);
                }
            );
        });
    }

    // ========================================================
    // CREAR VEHÍCULO
    // ========================================================

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

    // ========================================================
    // INICIAR LLEGADA
    // ========================================================

    function iniciarLlegada(vehiculo, plaza, plazaYaReservada = false) {
        if (!vehiculo || !plaza || vehiculo.eliminado) {
            return false;
        }

        if (!plazaYaReservada) {
            if (!reservarPlaza(plaza, vehiculo.id)) {
                return false;
            }
        } else if (
            !plaza.ocupada ||
            plaza.vehiculoId !== vehiculo.id
        ) {
            return false;
        }

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

        // Primero se comprueba que exista una plaza libre.
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

        // La plaza se reserva desde que se crea la solicitud.
        // Así otra llegada no puede tomar la misma plaza.
        if (!reservarPlaza(plaza, vehiculo.id)) {
            return false;
        }

        if (vehiculo.estado === 'cargando') {
            colaLlegadas.push({
                vehiculo,
                plaza,
                reservada: true
            });

            return true;
        }

        return iniciarLlegada(vehiculo, plaza, true);
    }

    // ========================================================
    // INICIAR SALIDA
    // ========================================================

    function solicitarSalida(id) {
        const vehiculo = vehiculos.get(id);

        if (!vehiculo || vehiculo.eliminado) return false;
        if (vehiculo.estado !== 'estacionado') return false;

        if (!vehiculo.plaza) {
            console.warn(`${id}: no tiene una plaza asignada.`);
            return false;
        }

        vehiculo.ruta = rutaSalida(vehiculo.plaza);
        vehiculo.indiceRuta = 0;
        vehiculo.estado = 'saliendo';
        vehiculo.velocidadActual = 0;

        return true;
    }

    // ========================================================
    // MOVIMIENTO
    // ========================================================

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

        const diferencia = normalizarAngulo(
            rotacionObjetivo - vehiculo.grupo.rotation.y
        );

        vehiculo.grupo.rotation.y += diferencia *
            Math.min(1, delta * 4);

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

        if (!llego) return;

        vehiculo.indiceRuta++;

        if (vehiculo.indiceRuta >= vehiculo.ruta.length) {
            if (vehiculo.estado === 'entrando') {
                estacionar(vehiculo);
            } else if (vehiculo.estado === 'saliendo') {
                finalizarSalida(vehiculo);
            }
        }
    }

    // ========================================================
    // ESTACIONAR
    // ========================================================

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

    // ========================================================
    // FINALIZAR SALIDA
    // ========================================================

    function finalizarSalida(vehiculo) {
        if (!vehiculo || vehiculo.estado !== 'saliendo') return;

        const plazaAnterior = vehiculo.plaza;

        liberarPlaza(plazaAnterior, vehiculo.id);

        vehiculo.plaza = null;
        vehiculo.velocidadActual = 0;

        vehiculo.grupo.position.set(
            0,
            0,
            CONFIG.salida.zExterior
        );

        // Se notifica antes de dejarlo disponible para otra llegada.
        if (typeof CONFIG.alSalir === 'function') {
            CONFIG.alSalir({
                id: vehiculo.id,
                grupo: vehiculo.grupo,
                vehiculo,
                plaza: plazaAnterior
                    ? {
                        x: plazaAnterior.x,
                        z: plazaAnterior.z,
                        id: plazaAnterior.id
                    }
                    : null
            });
        }

        vehiculo.estado = 'esperando';

        console.log(
            `Vehículo ${vehiculo.id} salió del estacionamiento.`
        );
    }

    // ========================================================
    // COLA DE LLEGADAS
    // ========================================================

    function procesarColaLlegadas() {
        for (let i = colaLlegadas.length - 1; i >= 0; i--) {
            const solicitud = colaLlegadas[i];
            const vehiculo = solicitud.vehiculo;

            if (!vehiculo || vehiculo.eliminado) {
                liberarPlaza(solicitud.plaza, vehiculo?.id);
                colaLlegadas.splice(i, 1);
                continue;
            }

            if (vehiculo.estado !== 'esperando') continue;

            if (
                iniciarLlegada(
                    vehiculo,
                    solicitud.plaza,
                    solicitud.reservada
                )
            ) {
                colaLlegadas.splice(i, 1);
            }
        }
    }

    // ========================================================
    // VEHÍCULOS INICIALES
    // ========================================================

    function procesarIniciales() {
        for (let i = colaLlegadas.length - 1; i >= 0; i--) {
            const solicitud = colaLlegadas[i];

            if (solicitud.plaza) continue;

            const vehiculo = solicitud.vehiculo;

            if (!vehiculo || vehiculo.eliminado) {
                colaLlegadas.splice(i, 1);
                continue;
            }

            if (vehiculo.estado !== 'esperando') continue;

            const plaza = obtenerPlazaLibre();

            if (!plaza) break;

            if (!reservarPlaza(plaza, vehiculo.id)) continue;

            solicitud.plaza = plaza;
            solicitud.reservada = true;

            if (iniciarLlegada(vehiculo, plaza, true)) {
                colaLlegadas.splice(i, 1);
            }
        }
    }

    // ========================================================
    // ACTUALIZACIÓN GENERAL
    // ========================================================

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

    function actualizarCompleto(delta = 0.016) {
        if (destruido) return;

        procesarIniciales();
        actualizar(delta);
    }

    // ========================================================
    // INFORMACIÓN DEL SISTEMA
    // ========================================================

    function obtenerEstado() {
        const resultado = {
            totalVehiculos: vehiculos.size,
            plazasTotales: plazas.length,
            plazasOcupadas: plazas.filter(p => p.ocupada).length,
            plazasLibres: plazas.filter(p => !p.ocupada).length,
            entrando: 0,
            estacionados: 0,
            saliendo: 0,
            esperando: 0,
            cargando: 0
        };

        for (const vehiculo of vehiculos.values()) {
            if (vehiculo.estado === 'entrando') resultado.entrando++;
            if (vehiculo.estado === 'estacionado') resultado.estacionados++;
            if (vehiculo.estado === 'saliendo') resultado.saliendo++;
            if (vehiculo.estado === 'esperando') resultado.esperando++;
            if (vehiculo.estado === 'cargando') resultado.cargando++;
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

    // ========================================================
    // ELIMINAR VEHÍCULO
    // ========================================================

    function eliminarVehiculo(id) {
        const vehiculo = vehiculos.get(id);

        if (!vehiculo) return false;

        vehiculo.eliminado = true;

        liberarPlaza(vehiculo.plaza, vehiculo.id);

        // Liberar también las plazas que estuvieran reservadas
        // por solicitudes todavía pendientes.
        for (let i = colaLlegadas.length - 1; i >= 0; i--) {
            if (colaLlegadas[i].vehiculo.id === id) {
                liberarPlaza(colaLlegadas[i].plaza, id);
                colaLlegadas.splice(i, 1);
            }
        }

        grupoVehiculos.remove(vehiculo.grupo);
        vehiculos.delete(id);

        // No se destruyen geometrías GLB compartidas.
        return true;
    }

    function destruir() {
        if (destruido) return;

        destruido = true;

        for (const id of [...vehiculos.keys()]) {
            eliminarVehiculo(id);
        }

        colaLlegadas.length = 0;

        scene.remove(grupoVehiculos);
    }

    // ========================================================
    // CREACIÓN DE VEHÍCULOS INICIALES
    // ========================================================

    for (let i = 0; i < CONFIG.cochesIniciales; i++) {
        const vehiculo = crearVehiculo();

        if (vehiculo) {
            colaLlegadas.push({
                vehiculo,
                plaza: null,
                reservada: false
            });
        }
    }

    // ========================================================
    // API PÚBLICA
    // ========================================================

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
