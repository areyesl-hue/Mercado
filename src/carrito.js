import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

// ============================================================
// CONFIGURACIÓN GENERAL
// ============================================================

const CONFIG_DEFAULT = {
    modelo: '/modelos/carrito.glb',
    posicion: { x: 0, y: 0, z: 0 },
    escala: 1,
    distancia: 0.25,
    suavizado: 9,
    velocidadMaxima: 5,
    correccionModelo: Math.PI,
    alturaManubrio: 0.9,
    alturaCesta: 0.75,
    ladoDelante: 1,
    cargarModelo: true
};

// ============================================================
// CONFIGURACIÓN DE PRODUCTOS
// ============================================================

const CONFIG_CESTA = {
    anchoInterior: 0.48,
    profundidadInterior: 0.62,
    columnas: 2,
    filas: 3,
    maxAnchoProducto: 0.21,
    maxProfundidadProducto: 0.21,
    maxAlturaProducto: 0.28,
    alturaEntreNiveles: 0.18,
    margenBase: 0.015,

    // Desplazamiento de los productos hacia el frente.
    desplazamientoFrontal: 0.35,

    // Elevación adicional para la base detectada.
    elevacionBase: 0.12
};

// Altura utilizada cuando no se detecta el fondo del carrito.
const ALTURA_BASE_RESPALDO = 0.92;

// ============================================================
// CREAR CARRITO
// ============================================================

export function crearCarrito(scene, opciones = {}) {

    if (!scene?.isScene && !scene?.isObject3D) {
        throw new Error('crearCarrito necesita una escena THREE válida.');
    }

    const config = {
        ...CONFIG_DEFAULT,
        ...opciones,
        posicion: {
            ...CONFIG_DEFAULT.posicion,
            ...(opciones.posicion ?? {})
        }
    };

    // ========================================================
    // GRUPOS
    // ========================================================

    const grupo = new THREE.Group();
    grupo.name = 'CARRITO_SUPERMERCADO';

    grupo.position.set(
        config.posicion.x,
        config.posicion.y,
        config.posicion.z
    );

    grupo.scale.setScalar(config.escala);
    scene.add(grupo);

    const grupoModelo = new THREE.Group();
    grupoModelo.name = 'MODELO_CARRITO';
    grupo.add(grupoModelo);

    const objetosEnCesta = new THREE.Group();
    objetosEnCesta.name = 'PRODUCTOS_EN_CARRITO';
    grupoModelo.add(objetosEnCesta);

    const estado = {
        eliminado: false,
        cargado: false,
        siguiendo: false,
        objetivo: null,
        distancia: config.distancia,
        productos: [],
        baseCestaLocal: null
    };

    // ========================================================
    // MATERIALES
    // ========================================================

    const materiales = {
        metal: new THREE.MeshStandardMaterial({
            color: 0x9da8ae,
            metalness: 0.82,
            roughness: 0.3
        }),

        metalOscuro: new THREE.MeshStandardMaterial({
            color: 0x424c52,
            metalness: 0.75,
            roughness: 0.35
        }),

        plastico: new THREE.MeshStandardMaterial({
            color: 0x263b43,
            roughness: 0.65
        }),

        goma: new THREE.MeshStandardMaterial({
            color: 0x17191b,
            roughness: 0.9
        }),

        detalle: new THREE.MeshStandardMaterial({
            color: 0xd5dce0,
            metalness: 0.8,
            roughness: 0.25
        })
    };

    // ========================================================
    // UTILIDADES
    // ========================================================

    function crearCaja(
        padre,
        nombre,
        ancho,
        alto,
        profundidad,
        posicion,
        material
    ) {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(ancho, alto, profundidad),
            material
        );

        mesh.name = nombre;
        mesh.position.set(
            posicion.x,
            posicion.y,
            posicion.z
        );

        mesh.castShadow = false;
        mesh.receiveShadow = false;

        padre.add(mesh);
        return mesh;
    }

    function crearBarra(
        padre,
        nombre,
        inicio,
        final,
        radio,
        material
    ) {
        const a = new THREE.Vector3(
            inicio.x,
            inicio.y,
            inicio.z
        );

        const b = new THREE.Vector3(
            final.x,
            final.y,
            final.z
        );

        const direccion = new THREE.Vector3().subVectors(b, a);
        const longitud = direccion.length();

        const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(radio, radio, longitud, 8),
            material
        );

        mesh.name = nombre;
        mesh.position.copy(a).add(b).multiplyScalar(0.5);

        mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direccion.normalize()
        );

        padre.add(mesh);
        return mesh;
    }

    // ========================================================
    // MODELO DE RESPALDO
    // ========================================================

    function crearModeloRespaldo() {
        const modelo = new THREE.Group();
        modelo.name = 'CARRITO_RESPALDO';

        const yInferior = 0.65;
        const ySuperior = 1.22;

        const zFrontal = 0.52;
        const zTrasero = -0.45;

        const xIzquierdo = -0.4;
        const xDerecho = 0.4;

        crearCaja(
            modelo,
            'Base_inferior',
            0.82,
            0.07,
            1.05,
            { x: 0, y: 0.53, z: 0.05 },
            materiales.metalOscuro
        );

        const bordes = [
            [
                'Borde_superior_izquierdo',
                { x: xIzquierdo, y: ySuperior, z: zTrasero },
                { x: xIzquierdo, y: ySuperior, z: zFrontal }
            ],
            [
                'Borde_superior_derecho',
                { x: xDerecho, y: ySuperior, z: zTrasero },
                { x: xDerecho, y: ySuperior, z: zFrontal }
            ],
            [
                'Borde_superior_frontal',
                { x: xIzquierdo, y: ySuperior, z: zFrontal },
                { x: xDerecho, y: ySuperior, z: zFrontal }
            ],
            [
                'Borde_superior_trasero',
                { x: xIzquierdo, y: ySuperior, z: zTrasero },
                { x: xDerecho, y: ySuperior, z: zTrasero }
            ]
        ];

        for (const [nombre, inicio, final] of bordes) {
            crearBarra(
                modelo,
                nombre,
                inicio,
                final,
                0.022,
                materiales.metal
            );
        }

        for (const x of [xIzquierdo, xDerecho]) {
            for (const z of [zTrasero, zFrontal]) {
                crearBarra(
                    modelo,
                    'Poste_cesta',
                    { x, y: yInferior, z },
                    { x, y: ySuperior, z },
                    0.018,
                    materiales.metal
                );
            }
        }

        for (let i = 1; i <= 5; i++) {
            const y = yInferior + i * 0.085;

            crearBarra(
                modelo,
                'Rejilla_lateral_izquierda',
                { x: xIzquierdo, y, z: zTrasero },
                { x: xIzquierdo, y, z: zFrontal },
                0.012,
                materiales.metal
            );

            crearBarra(
                modelo,
                'Rejilla_lateral_derecha',
                { x: xDerecho, y, z: zTrasero },
                { x: xDerecho, y, z: zFrontal },
                0.012,
                materiales.metal
            );

            crearBarra(
                modelo,
                'Rejilla_frontal',
                { x: xIzquierdo, y, z: zFrontal },
                { x: xDerecho, y, z: zFrontal },
                0.012,
                materiales.metal
            );

            crearBarra(
                modelo,
                'Rejilla_trasera',
                { x: xIzquierdo, y, z: zTrasero },
                { x: xDerecho, y, z: zTrasero },
                0.012,
                materiales.metal
            );
        }

        // Fondo de la cesta.
        for (let i = 0; i <= 7; i++) {
            const x = -0.35 + i * 0.1;

            crearBarra(
                modelo,
                'Rejilla_fondo',
                { x, y: 0.62, z: zTrasero },
                { x, y: 0.62, z: zFrontal },
                0.012,
                materiales.metal
            );
        }

        crearBarra(
            modelo,
            'Chasis_izquierdo',
            { x: -0.34, y: 0.45, z: -0.45 },
            { x: -0.34, y: 0.45, z: 0.55 },
            0.035,
            materiales.metalOscuro
        );

        crearBarra(
            modelo,
            'Chasis_derecho',
            { x: 0.34, y: 0.45, z: -0.45 },
            { x: 0.34, y: 0.45, z: 0.55 },
            0.035,
            materiales.metalOscuro
        );

        const posicionesRuedas = [
            [-0.36, 0.18, -0.42],
            [0.36, 0.18, -0.42],
            [-0.36, 0.18, 0.48],
            [0.36, 0.18, 0.48]
        ];

        for (const [x, y, z] of posicionesRuedas) {
            const rueda = new THREE.Mesh(
                new THREE.CylinderGeometry(0.105, 0.105, 0.055, 16),
                materiales.goma
            );

            rueda.name = 'Rueda';
            rueda.rotation.z = Math.PI / 2;
            rueda.position.set(x, y, z);
            modelo.add(rueda);

            const centro = new THREE.Mesh(
                new THREE.CylinderGeometry(0.035, 0.035, 0.06, 12),
                materiales.detalle
            );

            centro.rotation.z = Math.PI / 2;
            centro.position.set(x, y, z);
            modelo.add(centro);
        }

        crearBarra(
            modelo,
            'Soporte_manubrio_izquierdo',
            { x: -0.31, y: 0.48, z: -0.4 },
            { x: -0.31, y: 1.02, z: -0.75 },
            0.035,
            materiales.metalOscuro
        );

        crearBarra(
            modelo,
            'Soporte_manubrio_derecho',
            { x: 0.31, y: 0.48, z: -0.4 },
            { x: 0.31, y: 1.02, z: -0.75 },
            0.035,
            materiales.metalOscuro
        );

        crearBarra(
            modelo,
            'Manubrio',
            { x: -0.38, y: 1.02, z: -0.75 },
            { x: 0.38, y: 1.02, z: -0.75 },
            0.055,
            materiales.plastico
        );

        crearCaja(
            modelo,
            'Agarre_manubrio',
            0.56,
            0.08,
            0.09,
            { x: 0, y: 1.02, z: -0.75 },
            materiales.plastico
        );

        return modelo;
    }

    // ========================================================
    // LIBERAR MODELO
    // ========================================================

    function liberarModelo(objeto) {
        objeto.traverse(hijo => {
            if (!hijo.isMesh) return;

            hijo.geometry?.dispose?.();

            if (Array.isArray(hijo.material)) {
                hijo.material.forEach(m => m.dispose?.());
            } else {
                hijo.material?.dispose?.();
            }
        });
    }

    // ========================================================
    // MEDIR CAJA DE OBJETO EN COORDENADAS LOCALES
    // ========================================================

    function obtenerCajaLocal(objeto, referencia) {
        objeto.updateWorldMatrix(true, true);
        referencia.updateWorldMatrix(true, false);

        const cajaMundial = new THREE.Box3().setFromObject(objeto);

        if (cajaMundial.isEmpty()) return null;

        const min = new THREE.Vector3(Infinity, Infinity, Infinity);
        const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

        for (let x = 0; x <= 1; x++) {
            for (let y = 0; y <= 1; y++) {
                for (let z = 0; z <= 1; z++) {
                    const punto = new THREE.Vector3(
                        x ? cajaMundial.max.x : cajaMundial.min.x,
                        y ? cajaMundial.max.y : cajaMundial.min.y,
                        z ? cajaMundial.max.z : cajaMundial.min.z
                    );

                    referencia.worldToLocal(punto);

                    min.min(punto);
                    max.max(punto);
                }
            }
        }

        return new THREE.Box3(min, max);
    }

    // ========================================================
    // DETECTAR LA BASE DE LA CESTA
    // ========================================================

    function detectarBaseCesta() {
        grupoModelo.updateWorldMatrix(true, true);

        const candidatos = [];

        grupoModelo.traverse(objeto => {
            if (!objeto.isMesh || !objeto.geometry) return;

            const nombre = objeto.name.toLowerCase();

            if (
                nombre.includes('rueda') ||
                nombre.includes('manubrio') ||
                nombre.includes('chasis')
            ) {
                return;
            }

            objeto.geometry.computeBoundingBox();

            const caja = obtenerCajaLocal(
                objeto,
                objetosEnCesta
            );

            if (!caja || caja.isEmpty()) return;

            const dimensiones = caja.getSize(
                new THREE.Vector3()
            );

            if (
                dimensiones.x > 0.25 &&
                dimensiones.z > 0.25 &&
                dimensiones.y < 0.16
            ) {
                candidatos.push({
                    objeto,
                    altura: caja.max.y,
                    minY: caja.min.y,
                    maxY: caja.max.y,
                    ancho: dimensiones.x,
                    profundidad: dimensiones.z
                });
            }
        });

        console.table(
            candidatos.map(c => ({
                nombre: c.objeto.name,
                minY: Number(c.minY.toFixed(4)),
                maxY: Number(c.maxY.toFixed(4)),
                ancho: Number(c.ancho.toFixed(4)),
                profundidad: Number(c.profundidad.toFixed(4))
            }))
        );

        candidatos.sort((a, b) => b.altura - a.altura);

        if (candidatos.length > 0) {
            estado.baseCestaLocal =
                candidatos[0].altura +
                CONFIG_CESTA.margenBase +
                CONFIG_CESTA.elevacionBase;

            console.info(
                '[CARRITO] Fondo candidato seleccionado:',
                candidatos[0].objeto.name,
                'Altura:',
                estado.baseCestaLocal
            );
        } else {
            estado.baseCestaLocal = ALTURA_BASE_RESPALDO;

            console.warn(
                '[CARRITO] No se encontró una superficie candidata. Se utiliza',
                ALTURA_BASE_RESPALDO,
                'como respaldo.'
            );
        }
    }

    // ========================================================
    // CARGAR MODELO
    // ========================================================

    function cargarModelo() {
        if (!config.cargarModelo) {
            grupoModelo.add(crearModeloRespaldo());
            grupoModelo.rotation.y = config.correccionModelo;

            detectarBaseCesta();

            estado.cargado = true;
            return;
        }

        loader.load(
            config.modelo,

            gltf => {
                if (estado.eliminado) {
                    liberarModelo(gltf.scene);
                    return;
                }

                const modelo = gltf.scene;
                modelo.name = 'CARRITO_GLB';

                modelo.traverse(objeto => {
                    if (!objeto.isMesh) return;

                    objeto.castShadow = false;
                    objeto.receiveShadow = false;

                    if (objeto.material) {
                        objeto.material.side = THREE.DoubleSide;
                    }
                });

                const caja = new THREE.Box3().setFromObject(modelo);

                if (!caja.isEmpty()) {
                    const centro = caja.getCenter(
                        new THREE.Vector3()
                    );

                    modelo.position.x -= centro.x;
                    modelo.position.z -= centro.z;
                    modelo.position.y -= caja.min.y;
                }

                const cajaFinal = new THREE.Box3().setFromObject(modelo);
                const altura = cajaFinal.getSize(
                    new THREE.Vector3()
                ).y || 1;

                modelo.scale.multiplyScalar(1.25 / altura);

                grupoModelo.add(modelo);
                grupoModelo.rotation.y = config.correccionModelo;

                detectarBaseCesta();

                estado.cargado = true;

                console.info(
                    '[CARRITO] Modelo GLB cargado correctamente.'
                );
            },

            undefined,

            error => {
                if (estado.eliminado) return;

                console.warn(
                    '[CARRITO] Error cargando GLB. Se utilizará el respaldo.',
                    error
                );

                grupoModelo.add(crearModeloRespaldo());
                grupoModelo.rotation.y = config.correccionModelo;

                detectarBaseCesta();

                estado.cargado = true;
            }
        );
    }

    cargarModelo();

    // ========================================================
    // SEGUIMIENTO DEL CLIENTE
    // ========================================================

    function seguirObjetivo(
        objetivo,
        distancia = config.distancia
    ) {
        if (estado.eliminado) return false;

        const objetivoReal = objetivo?.isObject3D
            ? objetivo
            : objetivo?.grupo;

        if (!objetivoReal?.isObject3D) {
            console.warn('[CARRITO] Objetivo no válido.');
            return false;
        }

        estado.objetivo = objetivoReal;
        estado.distancia = Math.max(0.5, distancia);
        estado.siguiendo = true;

        return true;
    }

    function detenerSeguimiento() {
        estado.siguiendo = false;
        estado.objetivo = null;
    }

    const posicionObjetivo = new THREE.Vector3();
    const direccion = new THREE.Vector3();
    const posicionDeseada = new THREE.Vector3();
    const haciaCliente = new THREE.Vector3();

    function actualizar(delta) {
        if (
            estado.eliminado ||
            !estado.siguiendo ||
            !estado.objetivo
        ) {
            return;
        }

        const dt = Math.min(
            Math.max(delta || 0, 0),
            0.05
        );

        estado.objetivo.getWorldPosition(posicionObjetivo);

        direccion.set(0, 0, 1);
        estado.objetivo.getWorldDirection(direccion);
        direccion.y = 0;

        if (direccion.lengthSq() < 0.0001) {
            direccion.set(0, 0, 1);
        }

        direccion.normalize();

        posicionDeseada.copy(posicionObjetivo);

        posicionDeseada.addScaledVector(
            direccion,
            estado.distancia * config.ladoDelante
        );

        posicionDeseada.y = config.posicion.y;

        grupo.position.lerp(
            posicionDeseada,
            1 - Math.exp(-config.suavizado * dt)
        );

        haciaCliente.subVectors(
            posicionObjetivo,
            grupo.position
        );

        haciaCliente.y = 0;

        if (haciaCliente.lengthSq() > 0.0001) {
            grupo.rotation.y = Math.atan2(
                haciaCliente.x,
                haciaCliente.z
            );
        }
    }

    // ========================================================
    // POSICIÓN DE LOS PRODUCTOS
    // ========================================================

    function obtenerPosicionLocalDeposito(
        indice = estado.productos.length
    ) {
        const columnas = CONFIG_CESTA.columnas;
        const filas = CONFIG_CESTA.filas;

        const porNivel = columnas * filas;

        const nivel = Math.floor(indice / porNivel);
        const posicion = indice % porNivel;

        const columna = posicion % columnas;
        const fila = Math.floor(posicion / columnas);

        const x = (
            columna - (columnas - 1) / 2
        ) * (
            CONFIG_CESTA.anchoInterior / columnas
        );

        const z = (
            fila - (filas - 1) / 2
        ) * (
            CONFIG_CESTA.profundidadInterior / filas
        ) + CONFIG_CESTA.desplazamientoFrontal;

        return new THREE.Vector3(
            x,
            (estado.baseCestaLocal ?? ALTURA_BASE_RESPALDO) +
                nivel * CONFIG_CESTA.alturaEntreNiveles,
            z
        );
    }

    function obtenerPuntoDeposito(
        indice = estado.productos.length
    ) {
        const punto = obtenerPosicionLocalDeposito(indice);

        return objetosEnCesta.localToWorld(
            punto.clone()
        );
    }

    // ========================================================
    // COLOCAR PRODUCTO DENTRO DE LA CESTA
    // ========================================================

    function colocarProductoEnCesta(
        objeto,
        indice,
        rotacionY
    ) {
        const posicion = obtenerPosicionLocalDeposito(indice);

        objeto.rotation.set(0, rotacionY, 0);

        objeto.position.set(
            posicion.x,
            0,
            posicion.z
        );

        objeto.updateWorldMatrix(true, true);

        let caja = obtenerCajaLocal(
            objeto,
            objetosEnCesta
        );

        if (!caja || caja.isEmpty()) return false;

        const dimensiones = caja.getSize(
            new THREE.Vector3()
        );

        const factor = Math.min(
            1,
            CONFIG_CESTA.maxAnchoProducto /
                Math.max(dimensiones.x, 0.001),
            CONFIG_CESTA.maxProfundidadProducto /
                Math.max(dimensiones.z, 0.001),
            CONFIG_CESTA.maxAlturaProducto /
                Math.max(dimensiones.y, 0.001)
        );

        objeto.scale.multiplyScalar(factor);
        objeto.updateWorldMatrix(true, true);

        caja = obtenerCajaLocal(
            objeto,
            objetosEnCesta
        );

        if (!caja || caja.isEmpty()) return false;

        const alturaBase =
            (estado.baseCestaLocal ?? ALTURA_BASE_RESPALDO) +
            Math.floor(
                indice /
                (CONFIG_CESTA.columnas * CONFIG_CESTA.filas)
            ) * CONFIG_CESTA.alturaEntreNiveles;

        objeto.position.y += alturaBase - caja.min.y;

        objeto.updateWorldMatrix(true, true);

        const cajaFinal = obtenerCajaLocal(
            objeto,
            objetosEnCesta
        );

        console.info('[CARRITO] Verificación de producto:', {
            producto: objeto.name,
            baseCesta: alturaBase,
            baseProducto: cajaFinal?.min.y,
            techoProducto: cajaFinal?.max.y,
            desplazamientoFrontal: CONFIG_CESTA.desplazamientoFrontal
        });

        return true;
    }

    // ========================================================
    // RESTAURAR TRANSFORMACIÓN ORIGINAL
    // ========================================================

    function restaurarProducto(registro) {
        const objeto = registro.objeto;
        const padre = registro.padreOriginal;

        if (!objeto || !padre) return false;

        padre.attach(objeto);

        objeto.position.copy(
            padre.worldToLocal(
                registro.posicionMundial.clone()
            )
        );

        const quaternionPadre = padre
            .getWorldQuaternion(new THREE.Quaternion())
            .invert();

        objeto.quaternion
            .copy(quaternionPadre)
            .multiply(registro.quaternionMundial);

        const escalaPadre = padre.getWorldScale(
            new THREE.Vector3()
        );

        objeto.scale.set(
            registro.escalaMundial.x / (escalaPadre.x || 1),
            registro.escalaMundial.y / (escalaPadre.y || 1),
            registro.escalaMundial.z / (escalaPadre.z || 1)
        );

        objeto.userData.enCarrito = false;
        objeto.updateWorldMatrix(true, true);

        return true;
    }

    // ========================================================
    // AGREGAR PRODUCTO
    // ========================================================

    function agregarProducto(
        objeto,
        opcionesProducto = {}
    ) {
        if (
            estado.eliminado ||
            !objeto?.isObject3D
        ) {
            return false;
        }

        if (
            estado.productos.some(
                p => p.objeto === objeto
            )
        ) {
            return false;
        }

        const padreOriginal = objeto.parent;

        if (!padreOriginal) {
            console.warn(
                '[CARRITO] El producto no tiene padre original.'
            );
            return false;
        }

        objeto.updateWorldMatrix(true, true);

        const registro = {
            objeto,
            padreOriginal,

            posicionMundial: objeto.getWorldPosition(
                new THREE.Vector3()
            ),

            quaternionMundial: objeto.getWorldQuaternion(
                new THREE.Quaternion()
            ),

            escalaMundial: objeto.getWorldScale(
                new THREE.Vector3()
            ),

            nombre:
                opcionesProducto.nombre ??
                objeto.userData?.nombre ??
                objeto.name ??
                'Producto',

            cantidad: opcionesProducto.cantidad ?? 1,

            precio:
                opcionesProducto.precio ??
                objeto.userData?.precio ??
                0,

            rotacionY:
                opcionesProducto.rotacionY ??
                Math.random() * Math.PI * 2
        };

        objetosEnCesta.attach(objeto);

        const indice = estado.productos.length;

        if (
            !colocarProductoEnCesta(
                objeto,
                indice,
                registro.rotacionY
            )
        ) {
            restaurarProducto(registro);
            return false;
        }

        objeto.userData.enCarrito = true;
        objeto.userData.reservado = false;

        estado.productos.push(registro);

        console.info(
            `[CARRITO] Producto agregado: ${registro.nombre}`
        );

        return true;
    }

    // ========================================================
    // REORGANIZAR PRODUCTOS
    // ========================================================

    function reorganizarProductos() {
        estado.productos.forEach((registro, indice) => {
            colocarProductoEnCesta(
                registro.objeto,
                indice,
                registro.rotacionY
            );
        });

        objetosEnCesta.updateWorldMatrix(true, true);
    }

    // ========================================================
    // DEVOLVER PRODUCTO A SU LUGAR ORIGINAL
    // ========================================================

    function devolverProducto(producto) {
        if (estado.eliminado) return false;

        const indice = typeof producto === 'number'
            ? producto
            : estado.productos.findIndex(
                registro => registro.objeto === producto
            );

        if (
            indice < 0 ||
            indice >= estado.productos.length
        ) {
            return false;
        }

        const [registro] = estado.productos.splice(
            indice,
            1
        );

        restaurarProducto(registro);
        reorganizarProductos();

        console.info(
            `[CARRITO] Producto devuelto: ${registro.nombre}`
        );

        return true;
    }

    // ========================================================
    // VACIAR INVENTARIO
    // ========================================================

    function vaciarInventario() {
        if (estado.eliminado) return false;

        const productos = [...estado.productos];

        estado.productos.length = 0;

        for (const registro of productos) {
            restaurarProducto(registro);
        }

        console.info('[CARRITO] Inventario vaciado.');

        return true;
    }

    // ========================================================
    // CALCULAR TOTAL
    // ========================================================

    function obtenerTotal() {
        return estado.productos.reduce(
            (total, registro) => {
                return total +
                    registro.precio * registro.cantidad;
            },
            0
        );
    }

    // ========================================================
    // CONSULTAR PRODUCTOS
    // ========================================================

    function obtenerProductos() {
        return estado.productos.map(registro => ({
            objeto: registro.objeto,
            nombre: registro.nombre,
            cantidad: registro.cantidad,
            precio: registro.precio,
            total: registro.precio * registro.cantidad
        }));
    }

    // ========================================================
    // CONFIRMAR VENTA
    // ========================================================

    function confirmarVenta() {
        if (estado.eliminado) return 0;

        const total = obtenerTotal();

        for (const registro of estado.productos) {
            const objeto = registro.objeto;

            if (!objeto) continue;

            objeto.userData.enCarrito = false;
            objeto.userData.reservado = false;

            objeto.removeFromParent();
        }

        estado.productos.length = 0;

        console.info(
            `[CARRITO] Venta confirmada. Total: $${total.toFixed(2)}`
        );

        return total;
    }

    // ========================================================
    // ELIMINAR CARRITO
    // ========================================================

    function eliminar() {
        if (estado.eliminado) return;

        estado.eliminado = true;
        estado.siguiendo = false;
        estado.objetivo = null;

        const productos = [...estado.productos];

        estado.productos.length = 0;

        for (const registro of productos) {
            restaurarProducto(registro);
        }

        grupo.removeFromParent();

        console.info('[CARRITO] Carrito eliminado.');
    }

    // ========================================================
    // API PÚBLICA
    // ========================================================

    return {
        grupo,
        grupoModelo,
        objetosEnCesta,

        actualizar,
        seguirObjetivo,
        detenerSeguimiento,

        agregarProducto,
        devolverProducto,
        reorganizarProductos,

        vaciarInventario,
        confirmarVenta,

        obtenerProductos,
        obtenerTotal,
        obtenerPuntoDeposito,

        eliminar,

        get eliminado() {
            return estado.eliminado;
        },

        get siguiendo() {
            return estado.siguiendo;
        },

        get cantidadProductos() {
            return estado.productos.length;
        },

        get cargado() {
            return estado.cargado;
        }
    };
}
