
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function crearVehiculos(scene, opciones = {}) {
    if (!scene?.isScene) {
        throw new Error('crearVehiculos necesita una THREE.Scene.');
    }

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
        tiempoEntreLlegadas: 7,
        cochesIniciales: 3,
        separacionInicial: 8,
        alEstacionar: null,
        alSalir: null,
        ...opciones
    };

    config.modelos = Array.isArray(config.modelos)
        ? [...new Set(config.modelos)]
        : [];

    config.velocidad = Math.max(0.1, Number(config.velocidad) || 5.5);
    config.longitudVehiculo = Math.max(1, Number(config.longitudVehiculo) || 4.3);
    config.tiempoEntreLlegadas = Math.max(1, Number(config.tiempoEntreLlegadas) || 7);
    config.cochesIniciales = Math.max(0, Math.floor(Number(config.cochesIniciales) || 0));
    config.separacionInicial = Math.max(5, Number(config.separacionInicial) || 8);

    const grupo = new THREE.Group();
    grupo.name = 'SISTEMA_VEHICULOS';
    scene.add(grupo);

    const loader = new GLTFLoader();
    const vehiculos = [];
    const cola = [];
    const plazas = [];

    let siguienteId = 1;
    let cargasPendientes = config.modelos.length;
    let cargado = false;
    let errorCarga = null;
    let eliminado = false;
    let inicialesIniciados = false;
    let tiempoLlegada = 0;

    // 24 plazas, todas en la zona exterior.
    for (const z of [32, 39, 46, 53]) {
        for (const x of [-24, -16, -8, 8, 16, 24]) {
            plazas.push({
                x,
                z,
                ocupada: false,
                vehiculoId: null
            });
        }
    }

    function prepararModelo(original, indice) {
        const contenedor = new THREE.Group();
        contenedor.name = `VEHICULO_${indice + 1}`;

        // Conservar el GLB completo como un solo automóvil.
        const modelo = original.clone(true);
        modelo.name = `MODELO_AUTO_${indice + 1}`;

        modelo.traverse(objeto => {
            if (!objeto.isMesh) return;
            objeto.castShadow = false;
            objeto.receiveShadow = false;
        });

        contenedor.add(modelo);
        contenedor.updateMatrixWorld(true);

        let caja = new THREE.Box3().setFromObject(contenedor);

        if (caja.isEmpty()) {
            console.warn(`[VEHICULOS] Modelo vacío: ${indice + 1}`);
            return contenedor;
        }

        // Centrar horizontalmente y ajustar la escala del vehículo.
        const centro = caja.getCenter(new THREE.Vector3());
        modelo.position.x -= centro.x;
        modelo.position.z -= centro.z;
        modelo.position.y -= caja.min.y;
        contenedor.updateMatrixWorld(true);

        caja = new THREE.Box3().setFromObject(contenedor);
        const tamano = caja.getSize(new THREE.Vector3());
        const largoOriginal = Math.max(tamano.x, tamano.z, 0.01);
        const factor = (config.longitudVehiculo / largoOriginal) *
            Math.max(0.001, Number(config.escala) || 1);

        modelo.scale.multiplyScalar(factor);
        contenedor.updateMatrixWorld(true);

        caja = new THREE.Box3().setFromObject(contenedor);
        contenedor.position.y -= caja.min.y;
        contenedor.updateMatrixWorld(true);

        return contenedor;
    }

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

    function notificarEstacionamiento(coche) {
        if (typeof config.alEstacionar !== 'function') return;

        try {
            config.alEstacionar({
                id: coche.id,
                grupo: coche.grupo,
                plaza: { x: coche.plaza.x, z: coche.plaza.z },
                vehiculo: coche
            });
        } catch (error) {
            console.error('[VEHICULOS] Error al crear el cliente:', error);
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
            console.error('[VEHICULOS] Error al salir:', error);
        }
    }

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

    function estacionar(coche) {
        if (!coche.plaza) {
            coche.estado = 'preparado';
            return;
        }

        coche.estado = 'estacionado';
        coche.grupo.visible = true;
        coche.grupo.position.set(coche.plaza.x, 0, coche.plaza.z);
        coche.grupo.rotation.set(
            0,
            Math.PI + config.correccionRotacionY,
            0
        );

        console.info(`[VEHICULOS] Auto ${coche.id} estacionado en (${coche.plaza.x}, ${coche.plaza.z}).`);
        notificarEstacionamiento(coche);
    }

    function iniciarLlegada(coche) {
        if (!coche || coche.eliminado || eliminado) return false;

        const plaza = plazaLibre();

        if (!plaza) {
            coche.estado = 'esperando';
            coche.grupo.visible = false;

            if (!cola.includes(coche)) cola.push(coche);
            return false;
        }

        if (!reservar(plaza, coche)) return false;

        coche.plaza = plaza;

        const lado = plaza.x < 0 ? -1 : 1;
        coche.ruta = crearRutaLlegada(plaza, lado);
        coche.indiceRuta = 0;
        coche.estado = 'circulando';

        const enMarcha = vehiculos.filter(v =>
            v !== coche &&
            !v.eliminado &&
            (v.estado === 'circulando' || v.estado === 'saliendo')
        ).length;

        // CORRECCIÓN PRINCIPAL: mostrar el vehículo antes de moverlo.
        coche.grupo.visible = true;
        coche.grupo.position.set(
            lado * 10,
            0,
            83 + enMarcha * config.separacionInicial
        );

        coche.grupo.rotation.set(
            0,
            Math.PI + config.correccionRotacionY,
            0
        );

        console.info(`[VEHICULOS] Auto ${coche.id} comienza su llegada.`, {
            modelo: coche.archivo,
            destino: { x: plaza.x, z: plaza.z }
        });

        return true;
    }

    function crearVehiculo(gltf, indice, archivo) {
        const modelo = prepararModelo(gltf, indice);
        const id = siguienteId++;

        modelo.userData.idVehiculo = id;
        modelo.userData.archivoModelo = archivo;
        modelo.visible = false;
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

    function iniciarCochesIniciales() {
        if (inicialesIniciados || !cargado || eliminado) return;

        inicialesIniciados = true;

        const cantidad = Math.min(
            config.cochesIniciales,
            cola.length,
            plazas.filter(p => !p.ocupada).length
        );

        let iniciados = 0;

        for (let i = 0; i < cantidad; i++) {
            const coche = cola.shift();
            if (coche && iniciarLlegada(coche)) iniciados++;
        }

        console.info(`[VEHICULOS] Carga completa: ${vehiculos.length} autos disponibles.`);
        console.info(`[VEHICULOS] Llegadas iniciales: ${iniciados}.`);
        console.info(`[VEHICULOS] Autos en espera: ${cola.length}.`);
    }

    function solicitarLlegada() {
        if (!cargado || eliminado || !cola.length || !plazaLibre()) {
            return false;
        }

        const coche = cola.shift();
        if (!coche) return false;

        const resultado = iniciarLlegada(coche);

        if (!resultado && !cola.includes(coche)) cola.push(coche);
        return resultado;
    }

    function solicitarSalida(id) {
        if (eliminado) return false;

        const coche = vehiculos.find(v => v.id === id && !v.eliminado);

        if (!coche || coche.estado !== 'estacionado' || !coche.plaza) {
            return false;
        }

        coche.estado = 'saliendo';
        coche.ruta = crearRutaSalida(coche);
        coche.indiceRuta = 0;

        console.info(`[VEHICULOS] Auto ${coche.id} comienza a salir.`);
        return true;
    }

    function finalizarSalida(coche) {
        liberar(coche.plaza);
        coche.plaza = null;
        coche.ruta = [];
        coche.indiceRuta = 0;
        coche.estado = 'esperando';
        coche.grupo.visible = false;
        coche.grupo.position.set(0, -100, 0);

        notificarSalida(coche);

        if (!coche.eliminado && !eliminado && !cola.includes(coche)) {
            cola.push(coche);
        }

        console.info(`[VEHICULOS] Auto ${coche.id} terminó su salida.`);
    }

    function actualizarVehiculo(coche, delta) {
        if (
            coche.eliminado ||
            (coche.estado !== 'circulando' && coche.estado !== 'saliendo')
        ) return;

        const punto = coche.ruta[coche.indiceRuta];

        if (!punto) {
            if (coche.estado === 'circulando') estacionar(coche);
            else finalizarSalida(coche);
            return;
        }

        const dx = punto.x - coche.grupo.position.x;
        const dz = punto.z - coche.grupo.position.z;
        const distancia = Math.hypot(dx, dz);

        if (distancia < 0.35) {
            coche.indiceRuta++;

            if (coche.indiceRuta >= coche.ruta.length) {
                if (coche.estado === 'circulando') estacionar(coche);
                else finalizarSalida(coche);
            }
            return;
        }

        const paso = Math.min(coche.velocidad * delta, distancia);
        const angulo = Math.atan2(dx, dz);

        const objetivo = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            angulo + config.correccionRotacionY
        );

        coche.grupo.quaternion.slerp(
            objetivo,
            Math.min(1, config.suavizadoRotacion * delta)
        );

        coche.grupo.position.x += dx / distancia * paso;
        coche.grupo.position.z += dz / distancia * paso;
    }

    function finalizarCarga(archivo, error = null) {
        if (eliminado) return;

        if (error) {
            errorCarga = error;
            console.error(`[VEHICULOS] No se pudo cargar ${archivo}.`, error);
        }

        cargasPendientes--;

        if (cargasPendientes <= 0) {
            cargasPendientes = 0;
            cargado = true;

            console.info(
                `[VEHICULOS] Se cargaron ${vehiculos.length} de ${config.modelos.length} modelos.`
            );

            if (vehiculos.length === 0) {
                console.error('[VEHICULOS] No se cargó ningún automóvil.');
                return;
            }

            iniciarCochesIniciales();
        }
    }

    if (config.modelos.length === 0) {
        cargado = true;
        inicialesIniciados = true;
        console.warn('[VEHICULOS] No hay modelos configurados.');
    } else {
        config.modelos.forEach((archivo, indice) => {
            loader.load(
                archivo,
                gltf => {
                    if (eliminado) return;

                    if (!gltf?.scene) {
                        finalizarCarga(archivo, new Error('El GLB no contiene una escena válida.'));
                        return;
                    }

                    // Un archivo GLB completo corresponde a un solo auto.
                    crearVehiculo(gltf.scene, indice, archivo);

                    console.info(`[VEHICULOS] Modelo listo: ${archivo}`);
                    finalizarCarga(archivo);
                },
                evento => {
                    if (evento.total > 0) {
                        console.info(
                            `[VEHICULOS] ${archivo}: ${Math.round(evento.loaded / evento.total * 100)}%`
                        );
                    }
                },
                error => finalizarCarga(archivo, error)
            );
        });
    }

    function actualizar(delta) {
        if (eliminado) return;

        const dt = Math.min(Math.max(Number(delta) || 0, 0), 0.05);

        for (const coche of vehiculos) {
            actualizarVehiculo(coche, dt);
        }

        if (cargado && cola.length && plazaLibre()) {
            tiempoLlegada += dt;

            if (tiempoLlegada >= config.tiempoEntreLlegadas) {
                tiempoLlegada = 0;
                solicitarLlegada();
            }
        } else {
            tiempoLlegada = 0;
        }
    }

    function obtenerVehiculo(id) {
        return vehiculos.find(coche => coche.id === id) ?? null;
    }

    function obtenerPlazas() {
        return plazas.map(plaza => ({ ...plaza }));
    }

    function obtenerEstacionados() {
        return vehiculos.filter(coche => coche.estado === 'estacionado');
    }

    function eliminarVehiculo(id) {
        const coche = vehiculos.find(v => v.id === id);
        if (!coche) return false;

        coche.eliminado = true;
        liberar(coche.plaza);
        coche.plaza = null;
        grupo.remove(coche.grupo);
        coche.grupo.clear();

        const i = vehiculos.indexOf(coche);
        if (i >= 0) vehiculos.splice(i, 1);

        const j = cola.indexOf(coche);
        if (j >= 0) cola.splice(j, 1);

        return true;
    }

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
            return plazas.filter(plaza => !plaza.ocupada).length;
        }
    };
}
