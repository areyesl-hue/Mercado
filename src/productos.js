
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// PRODUCTOS DEL SUPERMERCADO
// Three.js | GLB | Unidades independientes
// CATÁLOGO: MODELOS REALES DEL PROYECTO
// ============================================================

export function crearProductosLacteos(scene) {
    if (!scene?.isScene) {
        throw new Error('crearProductosLacteos necesita una THREE.Scene.');
    }

    const loader = new GLTFLoader();
    const productos = new THREE.Group();

    productos.name = 'PRODUCTOS_SUPERMERCADO';
    scene.add(productos);

    // ========================================================
    // Precios configurados en este catálogo.
    // ========================================================

    const PRECIOS = {
        PLATANO: 8
    };

    // ========================================================
    // REGISTROS
    // ========================================================

    let modelosCargados = 0;
    let unidadesColocadas = 0;
    let modelosFallidos = 0;
    let siguienteIdUnidad = 1;

    const cacheModelos = new Map();
    const cacheDimensiones = new WeakMap();

    const unidades = [];
    const unidadesPorId = new Map();

    // ========================================================
    // CARGAR MODELOS GLB
    // ========================================================

    function cargarModelo(archivo, nombre, callback) {
        const existente = cacheModelos.get(archivo);

        if (existente) {
            if (existente.modelo) {
                callback(existente.modelo);
            } else {
                existente.callbacks.push(callback);
            }

            return;
        }

        const registro = {
            modelo: null,
            callbacks: [callback]
        };

        cacheModelos.set(archivo, registro);

        loader.load(
            archivo,
            (gltf) => {
                const original = gltf.scene;
                original.name = nombre;

                original.traverse((objeto) => {
                    if (!objeto.isMesh) return;

                    objeto.castShadow = false;
                    objeto.receiveShadow = false;
                    objeto.frustumCulled = true;
                });

                original.updateMatrixWorld(true);

                registro.modelo = original;
                modelosCargados++;

                const callbacks = [...registro.callbacks];
                registro.callbacks.length = 0;

                callbacks.forEach((fn) => {
                    try {
                        fn(original);
                    } catch (error) {
                        console.error(
                            `Error colocando ${nombre}:`,
                            error
                        );
                    }
                });

                console.info(`Modelo cargado: ${nombre}`);
            },
            undefined,
            (error) => {
                modelosFallidos++;
                cacheModelos.delete(archivo);

                console.error(
                    `No se pudo cargar ${archivo}.`,
                    error
                );
            }
        );
    }

    // ========================================================
    // DETECTAR MALLAS
    // ========================================================

    function contieneMallas(objeto) {
        let encontrado = false;

        objeto.traverse((hijo) => {
            if (hijo.isMesh) encontrado = true;
        });

        return encontrado;
    }

    // ========================================================
    // DETECTAR GRUPOS INDEPENDIENTES
    // ========================================================

    function obtenerGruposProducto(original) {
        original.updateMatrixWorld(true);

        function buscarContenedor(padre) {
            const gruposHijos = padre.children.filter((hijo) => {
                return hijo.isGroup && contieneMallas(hijo);
            });

            if (gruposHijos.length >= 2) return gruposHijos;

            for (const hijo of padre.children) {
                const resultado = buscarContenedor(hijo);

                if (resultado && resultado.length >= 2) {
                    return resultado;
                }
            }

            return null;
        }

        const grupos = buscarContenedor(original);

        if (!grupos) {
            console.warn(
                `No se detectaron grupos independientes en "${original.name}". ` +
                'Se utilizará el modelo completo como una unidad.'
            );

            return [original];
        }

        return grupos;
    }

    // ========================================================
    // CREAR FUENTES INDEPENDIENTES
    // ========================================================

    function crearFuentesIndependientes(original) {
        original.updateMatrixWorld(true);

        const grupos = obtenerGruposProducto(original);
        const inversaRaiz = original.matrixWorld.clone().invert();

        return grupos.map((grupo, indice) => {
            grupo.updateWorldMatrix(true, true);

            const matrizRelativa = new THREE.Matrix4()
                .multiplyMatrices(inversaRaiz, grupo.matrixWorld);

            const copia = grupo.clone(true);

            copia.position.set(0, 0, 0);
            copia.quaternion.identity();
            copia.scale.set(1, 1, 1);
            copia.matrix.identity();
            copia.matrixAutoUpdate = true;

            const fuente = new THREE.Group();

            fuente.name = `FUENTE_PRODUCTO_${indice + 1}`;

            matrizRelativa.decompose(
                fuente.position,
                fuente.quaternion,
                fuente.scale
            );

            fuente.add(copia);
            fuente.updateMatrixWorld(true);

            const caja = new THREE.Box3().setFromObject(fuente);

            if (caja.isEmpty()) {
                console.warn(`Grupo vacío: ${grupo.name}`);
                return fuente;
            }

            const centro = new THREE.Vector3();
            caja.getCenter(centro);

            fuente.position.sub(centro);
            fuente.updateMatrixWorld(true);

            fuente.userData.esFuenteProducto = true;
            fuente.userData.grupoOriginal = grupo.name;
            fuente.userData.indiceGrupo = indice;

            return fuente;
        });
    }

    // ========================================================
    // IDENTIFICADORES Y PRECIOS
    // ========================================================

    function obtenerCodigoCatalogo(nombreUnidad) {
        return nombreUnidad
            .replace(/_N\d+_\d+$/, '')
            .replace(/_\d+$/, '');
    }

    function obtenerPrecio(codigo) {
        const precio = PRECIOS[codigo];

        if (Number.isFinite(precio)) return precio;

        console.warn(
            `No hay precio para ${codigo}. Se asignará $0.00 MXN.`
        );

        return 0;
    }

    // ========================================================
    // OBTENER DIMENSIONES
    // ========================================================

    function obtenerDimensionesFuente(fuente) {
        let dimensiones = cacheDimensiones.get(fuente);

        if (dimensiones) return dimensiones;

        fuente.updateMatrixWorld(true);

        const caja = new THREE.Box3().setFromObject(fuente);

        if (caja.isEmpty()) return null;

        const centro = new THREE.Vector3();
        const tamano = new THREE.Vector3();

        caja.getCenter(centro);
        caja.getSize(tamano);

        dimensiones = { centro, tamano };

        cacheDimensiones.set(fuente, dimensiones);

        return dimensiones;
    }

    // ========================================================
    // CREAR UNIDAD DE PRODUCTO
    // ========================================================

    function crearCopia(
        fuente,
        nombre,
        x,
        y,
        z,
        altura,
        rotacionY = 0,
        categoria = 'Abarrotes',
        limites = {}
    ) {
        if (!fuente) return null;

        const datosFuente = obtenerDimensionesFuente(fuente);

        if (!datosFuente) {
            console.warn(`Modelo sin geometría: ${nombre}`);
            return null;
        }

        const modelo = fuente.clone(true);

        modelo.name = nombre;
        modelo.position.set(0, 0, 0);
        modelo.scale.setScalar(1);
        modelo.rotation.set(0, rotacionY, 0);

        modelo.updateMatrixWorld(true);

        const cajaRotada = new THREE.Box3().setFromObject(modelo);

        if (cajaRotada.isEmpty()) return null;

        const dimensionesRotadas = new THREE.Vector3();
        const centroRotado = new THREE.Vector3();

        cajaRotada.getSize(dimensionesRotadas);
        cajaRotada.getCenter(centroRotado);

        if (
            dimensionesRotadas.x <= 0.0001 ||
            dimensionesRotadas.y <= 0.0001 ||
            dimensionesRotadas.z <= 0.0001 ||
            !Number.isFinite(altura) ||
            altura <= 0
        ) {
            console.warn(`Dimensiones inválidas para ${nombre}.`);
            return null;
        }

        const dimensionMaximaEstandar =
            categoria === 'Ropa' ? 0.52 : 0.32;
        const escala = dimensionMaximaEstandar / Math.max(
            dimensionesRotadas.x,
            dimensionesRotadas.y,
            dimensionesRotadas.z
        );

        modelo.scale.setScalar(escala);
        modelo.updateMatrixWorld(true);

        const cajaFinal = new THREE.Box3().setFromObject(modelo);

        if (cajaFinal.isEmpty()) return null;

        const centroFinal = new THREE.Vector3();
        const dimensionesFinales = new THREE.Vector3();

        cajaFinal.getCenter(centroFinal);
        cajaFinal.getSize(dimensionesFinales);

        const posicionY = categoria === 'Ropa'
            ? 1.72 - cajaFinal.max.y
            : y - cajaFinal.min.y;

        modelo.position.set(
            x - centroFinal.x,
            posicionY,
            z - centroFinal.z
        );

        modelo.updateMatrixWorld(true);

        const idUnidad =
            `UNIDAD_${String(siguienteIdUnidad++).padStart(5, '0')}`;

        const codigoCatalogo = obtenerCodigoCatalogo(nombre);
        const precio = obtenerPrecio(codigoCatalogo);

        modelo.userData.esUnidadProducto = true;
        modelo.userData.tipo = 'producto';
        modelo.userData.esProducto = true;

        modelo.userData.idUnidadProducto = idUnidad;
        modelo.userData.codigoProducto = idUnidad;
        modelo.userData.codigoCatalogo = codigoCatalogo;
        modelo.userData.skuProducto = codigoCatalogo;

        modelo.userData.nombreProducto = codigoCatalogo;
        modelo.userData.nombre = nombre;
        modelo.userData.nombreVisible = nombre;
        modelo.userData.nombreUnidad = nombre;
        modelo.userData.codigo = codigoCatalogo;

        modelo.userData.precio = precio;
        modelo.userData.moneda = 'MXN';
        modelo.userData.categoria = categoria;
        modelo.userData.idRack = limites.idRack ?? categoria;
        modelo.userData.rackId = modelo.userData.idRack;
        modelo.userData.departamento = categoria;

        modelo.userData.recogido = false;
        modelo.userData.vendido = false;
        modelo.userData.reservado = false;
        modelo.userData.enCarrito = false;
        modelo.userData.disponible = true;

        modelo.userData.posicionEstante = { x, y, z };

        modelo.userData.rotacionEstante = {
            x: modelo.rotation.x,
            y: modelo.rotation.y,
            z: modelo.rotation.z
        };

        modelo.userData.escalaEstante = {
            x: modelo.scale.x,
            y: modelo.scale.y,
            z: modelo.scale.z
        };

        modelo.updateMatrixWorld(true);

        const cajaMedicion = new THREE.Box3().setFromObject(modelo);
        const tamanoFinal = new THREE.Vector3();

        cajaMedicion.getSize(tamanoFinal);

        modelo.userData.dimensionesFinales = {
            ancho: tamanoFinal.x,
            alto: tamanoFinal.y,
            profundidad: tamanoFinal.z
        };

        modelo.userData.superficieApoyo = y;
        modelo.userData.baseReal = cajaMedicion.min.y;

        productos.add(modelo);

        unidades.push(modelo);
        unidadesPorId.set(idUnidad, modelo);

        unidadesColocadas++;

        return modelo;
    }

    // ========================================================
    // ÚNICO PRODUCTO: PLÁTANO
    // 15 unidades en Mesa_frescos_02
    // ========================================================

    const posicionesPlatanos = [
        [-0.75, -0.55],
        [-0.25, -0.55],
        [ 0.25, -0.55],
        [ 0.75, -0.55],

        [-0.75, -0.15],
        [-0.25, -0.15],
        [ 0.25, -0.15],
        [ 0.75, -0.15],

        [-0.75,  0.25],
        [-0.25,  0.25],
        [ 0.25,  0.25],
        [ 0.75,  0.25],

        [-0.50,  0.55],
        [ 0.00,  0.55],
        [ 0.50,  0.55]
    ];

    const MESA_PLATANOS = {
        x: -21.7,
        z: 15,
        y: 1.00
    };

    cargarModelo(
        '/modelos/Platano.glb',
        'Plátano',
        (original) => {
            const fuentes = crearFuentesIndependientes(original);

            if (!fuentes.length) {
                console.error('El modelo de plátano no contiene geometría.');
                return;
            }

            posicionesPlatanos.forEach(([dx, dz], indice) => {
                const fuente = fuentes[indice % fuentes.length];

                crearCopia(
                    fuente,
                    `PLATANO_N1_${indice + 1}`,
                    MESA_PLATANOS.x + dx,
                    MESA_PLATANOS.y,
                    MESA_PLATANOS.z + dz,
                    0.25,
                    Math.PI / 2,
                    'Frutas y verduras',
                    {
                        ancho: 0.42,
                        profundidad: 0.42,
                        idRack: 'Mesa_frescos_02'
                    }
                );
            });

            console.info(
                `🍌 Se colocaron ${posicionesPlatanos.length} plátanos.`
            );
        }
    );

    // ========================================================
    // PRODUCTOS GLB EXISTENTES, DISTRIBUIDOS POR CATEGORIA
    // ========================================================

    const gondolas = [
        [-17, -13], [-17, 0], [-17, 13],
        [-9, -13], [-9, 0], [-9, 13],
        [9, -13], [9, 0], [9, 13],
        [17, -13], [17, 0]
    ];
    const nivelesGondola = [0.4625, 0.8925, 1.3225, 1.7525];
    const offsetsZGondola = [-2.15, -1.075, 0, 1.075, 2.15];
    let siguienteFilaGondola = 0;

    function obtenerFilaGondola() {
        const fila = siguienteFilaGondola++;
        const filasPorGondola = 8;
        const indiceGondola = Math.floor(fila / filasPorGondola) % gondolas.length;
        const filaEnGondola = fila % filasPorGondola;
        const lado = filaEnGondola < 4 ? -1 : 1;
        const nivel = filaEnGondola % 4;
        const [centroX, centroZ] = gondolas[indiceGondola];

        return {
            idRack: `Gondola_${String(indiceGondola + 1).padStart(2, '0')}_Lado_${lado}`,
            rotacionY: lado * Math.PI / 2,
            posiciones: offsetsZGondola.map((offsetZ) => ({
                x: centroX + lado * 0.40,
                y: nivelesGondola[nivel],
                z: centroZ + offsetZ
            }))
        };
    }

    const mesasFrutas = [
        { x: -25.5, z: 15, rack: 'Mesa_frescos_01' },
        { x: -21.7, z: 15, rack: 'Mesa_frescos_02' },
        { x: -25.5, z: 10.8, rack: 'Mesa_frescos_03' },
        { x: -21.7, z: 10.8, rack: 'Mesa_frescos_04' }
    ];
    const offsetsMesaFrutas = [
        [-1.0, -0.55], [-0.6, -0.55], [-0.2, -0.55],
        [0.2, -0.55], [0.6, -0.55], [1.0, -0.55],
        [-1.0, 0.55], [-0.6, 0.55], [-0.2, 0.55],
        [0.2, 0.55], [0.6, 0.55], [1.0, 0.55]
    ];
    const usoMesasFrutas = new Map();

    function obtenerPosicionesMesa(indiceMesa) {
        const mesa = mesasFrutas[indiceMesa];
        const inicio = usoMesasFrutas.get(indiceMesa) ?? 0;
        const posiciones = offsetsMesaFrutas.slice(inicio, inicio + 4);
        usoMesasFrutas.set(indiceMesa, inicio + posiciones.length);

        return {
            idRack: mesa.rack,
            posiciones: posiciones.map(([dx, dz]) => ({
                x: mesa.x + dx,
                y: 1.0,
                z: mesa.z + dz
            }))
        };
    }

    const refrigeradoresX = [-27, -23.5, -20, -16.5, 16.5, 20, 27];
    const nivelesRefrigerador = [0.5225, 0.9525, 1.3825, 1.8125];
    const offsetsXRefrigerador = [-0.82, -0.27, 0.27, 0.82];

    function obtenerPosicionesRefrigerador(indiceRefrigerador, nivel) {
        const x = refrigeradoresX[indiceRefrigerador % refrigeradoresX.length];

        return {
            idRack: `Refrigerador_${String(indiceRefrigerador + 1).padStart(2, '0')}`,
            posiciones: offsetsXRefrigerador.map((offsetX) => ({
                x: x + offsetX,
                y: nivelesRefrigerador[nivel],
                z: -26.5 + 0.30
            }))
        };
    }

    const nivelesHigiene = [0.4575, 0.8075, 1.1575, 1.5075, 1.8575];
    const offsetsXHigiene = [-0.95, -0.35, 0.35, 0.95];
    let siguienteProductoHigiene = 0;

    function obtenerPosicionesHigiene() {
        const indice = siguienteProductoHigiene++;
        const nivel = Math.floor(indice / 2);
        const mitad = indice % 2;
        const offsets = mitad === 0
            ? offsetsXHigiene.slice(0, 2)
            : offsetsXHigiene.slice(2, 4);

        return {
            idRack: 'Modulo_limpieza',
            posiciones: offsets.map((offsetX) => ({
                x: 28.3 + offsetX,
                y: nivelesHigiene[nivel],
                z: 8.15
            }))
        };
    }

    const catalogoProductosAdicionales = [
        { archivo: '/modelos/Aceite.glb', nombre: 'Aceite', categoria: 'Abarrotes', tipo: 'gondola', alto: 0.36, ancho: 0.26, profundidad: 0.26 },
        { archivo: '/modelos/Atun.glb', nombre: 'At\u00fan', categoria: 'Enlatados', tipo: 'gondola', alto: 0.28, ancho: 0.34, profundidad: 0.30 },
        { archivo: '/modelos/Azucar.glb', nombre: 'Az\u00facar', categoria: 'Abarrotes', tipo: 'gondola', alto: 0.32, ancho: 0.38, profundidad: 0.34 },
        { archivo: '/modelos/Dorito.glb', nombre: 'Dorito', categoria: 'Snacks', tipo: 'gondola', alto: 0.28, ancho: 0.25, profundidad: 0.20 },
        { archivo: '/modelos/DoritoDinamita.glb', nombre: 'Dorito Dinamita', categoria: 'Snacks', tipo: 'gondola', alto: 0.28, ancho: 0.25, profundidad: 0.20 },
        { archivo: '/modelos/DoritoIconig.glb', nombre: 'Dorito Iconig', categoria: 'Snacks', tipo: 'gondola', alto: 0.28, ancho: 0.25, profundidad: 0.20 },
        { archivo: '/modelos/DoritoPizeerola.glb', nombre: 'Dorito Pizzerola', categoria: 'Snacks', tipo: 'gondola', alto: 0.28, ancho: 0.25, profundidad: 0.20 },
        { archivo: '/modelos/Frijoles.glb', nombre: 'Frijoles', categoria: 'Enlatados', tipo: 'gondola', alto: 0.30, ancho: 0.30, profundidad: 0.28 },
        { archivo: '/modelos/Sabrita.glb', nombre: 'Sabrita', categoria: 'Snacks', tipo: 'gondola', alto: 0.27, ancho: 0.25, profundidad: 0.20 },
        { archivo: '/modelos/SabritasAdobadas.glb', nombre: 'Sabritas Adobadas', categoria: 'Snacks', tipo: 'gondola', alto: 0.27, ancho: 0.25, profundidad: 0.20 },
        { archivo: '/modelos/SabritasLimon.glb', nombre: 'Sabritas Lim?n', categoria: 'Snacks', tipo: 'gondola', alto: 0.27, ancho: 0.25, profundidad: 0.20 },
        { archivo: '/modelos/cereal.glb', nombre: 'Cereal', categoria: 'Cereales', tipo: 'gondola', alto: 0.38, ancho: 0.30, profundidad: 0.24 },
        { archivo: '/modelos/cereal2.glb', nombre: 'Cereal 2', categoria: 'Cereales', tipo: 'gondola', alto: 0.38, ancho: 0.30, profundidad: 0.24 },
        { archivo: '/modelos/CafeLegal.glb', nombre: 'Cafe Legal', categoria: 'Abarrotes', tipo: 'gondola', alto: 0.34, ancho: 0.26, profundidad: 0.20 },
        { archivo: '/modelos/CafeOrol.glb', nombre: 'Cafe Orol', categoria: 'Abarrotes', tipo: 'gondola', alto: 0.34, ancho: 0.26, profundidad: 0.20 },
        { archivo: '/modelos/Nescafe.glb', nombre: 'Nescafe', categoria: 'Abarrotes', tipo: 'gondola', alto: 0.34, ancho: 0.26, profundidad: 0.20 },
        { archivo: '/modelos/ChocoDulce.glb', nombre: 'Choco Dulce', categoria: 'Dulces', tipo: 'gondola', alto: 0.28, ancho: 0.22, profundidad: 0.20 },
        { archivo: '/modelos/FresaDulce.glb', nombre: 'Fresa Dulce', categoria: 'Dulces', tipo: 'gondola', alto: 0.28, ancho: 0.22, profundidad: 0.20 },
        { archivo: '/modelos/VanillaDulce.glb', nombre: 'Vanilla Dulce', categoria: 'Dulces', tipo: 'gondola', alto: 0.28, ancho: 0.22, profundidad: 0.20 },
        { archivo: '/modelos/Mayonesa.glb', nombre: 'Mayonesa', categoria: 'Abarrotes', tipo: 'gondola', alto: 0.30, ancho: 0.24, profundidad: 0.22 },
        { archivo: '/modelos/Mermelada.glb', nombre: 'Mermelada', categoria: 'Abarrotes', tipo: 'gondola', alto: 0.30, ancho: 0.24, profundidad: 0.22 },
        { archivo: '/modelos/Mostaza.glb', nombre: 'Mostaza', categoria: 'Abarrotes', tipo: 'gondola', alto: 0.30, ancho: 0.24, profundidad: 0.22 },
        { archivo: '/modelos/BarraJabon.glb', nombre: 'Jabon', categoria: 'Higiene personal', tipo: 'gondola', alto: 0.22, ancho: 0.22, profundidad: 0.14 },
        { archivo: '/modelos/BarraJabonMorado.glb', nombre: 'Jabon morado', categoria: 'Higiene personal', tipo: 'gondola', alto: 0.22, ancho: 0.22, profundidad: 0.14 },
        { archivo: '/modelos/BarraJabonRosa.glb', nombre: 'Jabon rosa', categoria: 'Higiene personal', tipo: 'gondola', alto: 0.22, ancho: 0.22, profundidad: 0.14 },
        { archivo: '/modelos/BarraJabonVerde.glb', nombre: 'Jabon verde', categoria: 'Higiene personal', tipo: 'gondola', alto: 0.22, ancho: 0.22, profundidad: 0.14 },
        { archivo: '/modelos/PastaDental.glb', nombre: 'Pasta dental', categoria: 'Higiene personal', tipo: 'gondola', alto: 0.30, ancho: 0.26, profundidad: 0.12 },
        { archivo: '/modelos/desodorante.glb', nombre: 'Desodorante', categoria: 'Higiene personal', tipo: 'gondola', alto: 0.30, ancho: 0.15, profundidad: 0.15 },
        { archivo: '/modelos/shampooGold.glb', nombre: 'Shampoo Gold', categoria: 'Higiene personal', tipo: 'gondola', alto: 0.34, ancho: 0.20, profundidad: 0.14 },
        { archivo: '/modelos/Agua.glb', nombre: 'Agua', categoria: 'Bebidas', tipo: 'refrigerador', refrigerador: 0, nivel: 0, alto: 0.43, ancho: 0.25, profundidad: 0.25 },
        { archivo: '/modelos/Lala.glb', nombre: 'Lala', categoria: 'Lacteos', tipo: 'refrigerador', refrigerador: 1, nivel: 1, alto: 0.38, ancho: 0.30, profundidad: 0.26 },
        { archivo: '/modelos/Pepsi. y coca.glb', nombre: 'Pepsi y Coca', categoria: 'Bebidas', tipo: 'refrigerador', refrigerador: 2, nivel: 0, alto: 0.42, ancho: 0.28, profundidad: 0.25 },
        { archivo: '/modelos/Pepsi.glb', nombre: 'Pepsi', categoria: 'Bebidas', tipo: 'refrigerador', refrigerador: 3, nivel: 0, alto: 0.42, ancho: 0.24, profundidad: 0.24 },
        { archivo: '/modelos/SantaClara.glb', nombre: 'Santa Clara', categoria: 'Lacteos', tipo: 'refrigerador', refrigerador: 4, nivel: 1, alto: 0.38, ancho: 0.30, profundidad: 0.26 },
        { archivo: '/modelos/cocacola.glb', nombre: 'Coca-Cola', categoria: 'Bebidas', tipo: 'refrigerador', refrigerador: 5, nivel: 0, alto: 0.42, ancho: 0.24, profundidad: 0.24 },
        { archivo: '/modelos/nesquik.glb', nombre: 'Nesquik', categoria: 'Lacteos', tipo: 'refrigerador', refrigerador: 6, nivel: 1, alto: 0.38, ancho: 0.30, profundidad: 0.26 },
        { archivo: '/modelos/Fanta.glb', nombre: 'Fanta', categoria: 'Bebidas', tipo: 'refrigerador', refrigerador: 0, nivel: 1, alto: 0.42, ancho: 0.24, profundidad: 0.24 },
        { archivo: '/modelos/FantaFresa.glb', nombre: 'Fanta Fresa', categoria: 'Bebidas', tipo: 'refrigerador', refrigerador: 1, nivel: 2, alto: 0.42, ancho: 0.24, profundidad: 0.24 },
        { archivo: '/modelos/FantaUva.glb', nombre: 'Fanta Uva', categoria: 'Bebidas', tipo: 'refrigerador', refrigerador: 2, nivel: 1, alto: 0.42, ancho: 0.24, profundidad: 0.24 },
        { archivo: '/modelos/Monster.glb', nombre: 'Monster', categoria: 'Bebidas', tipo: 'refrigerador', refrigerador: 3, nivel: 1, alto: 0.38, ancho: 0.22, profundidad: 0.22 },
        { archivo: '/modelos/MonsterBlanca.glb', nombre: 'Monster Blanca', categoria: 'Bebidas', tipo: 'refrigerador', refrigerador: 4, nivel: 2, alto: 0.38, ancho: 0.22, profundidad: 0.22 },
        { archivo: '/modelos/MonsterRosa.glb', nombre: 'Monster Rosa', categoria: 'Bebidas', tipo: 'refrigerador', refrigerador: 5, nivel: 1, alto: 0.38, ancho: 0.22, profundidad: 0.22 },

        { archivo: '/modelos/Brocoli.glb', nombre: 'Brocoli', categoria: 'Frutas y verduras', tipo: 'mesa', mesa: 0, alto: 0.28, ancho: 0.30, profundidad: 0.28 },
        { archivo: '/modelos/Elote.glb', nombre: 'Elote', categoria: 'Frutas y verduras', tipo: 'mesa', mesa: 0, alto: 0.30, ancho: 0.24, profundidad: 0.24 },
        { archivo: '/modelos/Limon.glb', nombre: 'Limon', categoria: 'Frutas y verduras', tipo: 'mesa', mesa: 0, alto: 0.20, ancho: 0.20, profundidad: 0.20 },
        { archivo: '/modelos/Jalape\\u00f1o.glb', nombre: 'Jalapeno', categoria: 'Frutas y verduras', tipo: 'mesa', mesa: 2, alto: 0.20, ancho: 0.20, profundidad: 0.20 },
        { archivo: '/modelos/Mazana.glb', nombre: 'Manzana', categoria: 'Frutas y verduras', tipo: 'mesa', mesa: 2, alto: 0.22, ancho: 0.22, profundidad: 0.22 },
        { archivo: '/modelos/Pepino.glb', nombre: 'Pepino', categoria: 'Frutas y verduras', tipo: 'mesa', mesa: 2, alto: 0.28, ancho: 0.22, profundidad: 0.22 },
        { archivo: '/modelos/Pera.glb', nombre: 'Pera', categoria: 'Frutas y verduras', tipo: 'mesa', mesa: 3, alto: 0.22, ancho: 0.22, profundidad: 0.22 },
        { archivo: '/modelos/Uvas.glb', nombre: 'Uvas', categoria: 'Frutas y verduras', tipo: 'mesa', mesa: 3, alto: 0.24, ancho: 0.28, profundidad: 0.24 },

        { archivo: '/modelos/cloro_liquido.glb', nombre: 'Cloro liquido', categoria: 'Limpieza', tipo: 'higiene', alto: 0.38, ancho: 0.28, profundidad: 0.25 },
        { archivo: '/modelos/detergente_liquido.glb', nombre: 'Detergente liquido', categoria: 'Limpieza', tipo: 'higiene', alto: 0.38, ancho: 0.28, profundidad: 0.25 },
        { archivo: '/modelos/detergente_liquido1.glb', nombre: 'Detergente liquido 2', categoria: 'Limpieza', tipo: 'higiene', alto: 0.38, ancho: 0.28, profundidad: 0.25 },
        { archivo: '/modelos/limpiador_multiusos.glb', nombre: 'Limpiador multiusos', categoria: 'Limpieza', tipo: 'higiene', alto: 0.36, ancho: 0.28, profundidad: 0.25 },
        { archivo: '/modelos/papel.glb', nombre: 'Papel', categoria: 'Higiene', tipo: 'higiene', alto: 0.34, ancho: 0.30, profundidad: 0.28 },
        { archivo: '/modelos/suavizante_liquido.glb', nombre: 'Suavizante', categoria: 'Limpieza', tipo: 'higiene', alto: 0.38, ancho: 0.28, profundidad: 0.25 },
        { archivo: '/modelos/toallitas_bebe.glb', nombre: 'Toallitas para bebe', categoria: 'Higiene', tipo: 'higiene', alto: 0.28, ancho: 0.30, profundidad: 0.24 },

        { archivo: '/modelos/Filete.glb', nombre: 'Filete', categoria: 'Carniceria', tipo: 'mostrador', alto: 0.24, ancho: 0.32, profundidad: 0.28 },
        { archivo: '/modelos/Pollo.glb', nombre: 'Pollo', categoria: 'Carniceria', tipo: 'mostrador', alto: 0.28, ancho: 0.34, profundidad: 0.30 },

        { archivo: '/modelos/Blusa.glb', nombre: 'Blusa', categoria: 'Ropa', tipo: 'ropa', alto: 0.72, ancho: 0.42, profundidad: 0.24 },
        { archivo: '/modelos/SudaderaNegra.glb', nombre: 'Sudadera negra', categoria: 'Ropa', tipo: 'ropa', alto: 0.72, ancho: 0.42, profundidad: 0.24 },
        { archivo: '/modelos/camisaAzul.glb', nombre: 'Camisa azul', categoria: 'Ropa', tipo: 'ropa', alto: 0.72, ancho: 0.42, profundidad: 0.24 },
        { archivo: '/modelos/chamarranegra.glb', nombre: 'Chamarra negra', categoria: 'Ropa', tipo: 'ropa', alto: 0.72, ancho: 0.42, profundidad: 0.24 },
        { archivo: '/modelos/pantalomezclilla.glb', nombre: 'Pantalon de mezclilla', categoria: 'Ropa', tipo: 'ropa', alto: 0.72, ancho: 0.42, profundidad: 0.24 },
        { archivo: '/modelos/sudaderaroja.glb', nombre: 'Sudadera roja', categoria: 'Ropa', tipo: 'ropa', alto: 0.72, ancho: 0.42, profundidad: 0.24 },
        { archivo: '/modelos/vesitdo.glb', nombre: 'Vestido', categoria: 'Ropa', tipo: 'ropa', alto: 0.72, ancho: 0.42, profundidad: 0.24 }
    ];

    let siguientePerchero = 0;
    let siguienteMostrador = 0;

    function obtenerUbicacion(catalogo) {
        if (catalogo.tipo === 'gondola') {
            return obtenerFilaGondola();
        }

        if (catalogo.tipo === 'mesa') {
            return obtenerPosicionesMesa(catalogo.mesa);
        }

        if (catalogo.tipo === 'refrigerador') {
            return obtenerPosicionesRefrigerador(
                catalogo.refrigerador,
                catalogo.nivel
            );
        }

        if (catalogo.tipo === 'higiene') {
            return obtenerPosicionesHigiene();
        }

        if (catalogo.tipo === 'mostrador') {
            const indice = siguienteMostrador++;
            const offsets = indice === 0
                ? [-1.0, -0.5, 0]
                : [0.5, 1.0, 1.25];

            return {
                idRack: 'Mostrador_carniceria',
                posiciones: offsets.map((offsetX) => ({
                    x: 25.1 + offsetX,
                    y: 1.26,
                    z: -7.3
                }))
            };
        }

        const percheros = [
            { x: -25.7, z: -4, rack: 'Perchero_ropa_01' },
            { x: -25.7, z: 2, rack: 'Perchero_ropa_02' },
            { x: -25.7, z: 8, rack: 'Perchero_ropa_03' }
        ];
        const indice = siguientePerchero++;
        const indicePerchero = indice < 2 ? 0 : indice < 4 ? 1 : 2;
        const articuloEnPerchero = indicePerchero === 0
            ? indice
            : indicePerchero === 1
                ? indice - 2
                : indice - 4;
        const percha = percheros[indicePerchero];
        const offsetsPorPerchero = [
            [[-0.9, -0.3], [0.3, 0.9]],
            [[-0.9, -0.3], [0.3, 0.9]],
            [[-1.1, -0.66], [-0.22, 0.22], [0.66, 1.1]]
        ];
        const offsets = offsetsPorPerchero[indicePerchero][articuloEnPerchero];

        return {
            idRack: percha.rack,
            posiciones: offsets.map((offsetX) => ({
                x: percha.x + offsetX,
                y: 1.0,
                z: percha.z
            }))
        };
    }

    function colocarCatalogoProductos(catalogo) {
        const ubicacion = obtenerUbicacion(catalogo);
        const clave = catalogo.archivo
            .split('/')
            .pop()
            .replace(/\.glb$/i, '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Za-z0-9]/g, '')
            .toUpperCase();

        cargarModelo(
            catalogo.archivo,
            catalogo.nombre,
            (original) => {
                const fuentes = crearFuentesIndependientes(original);

                if (!fuentes.length || !ubicacion.posiciones.length) {
                    console.warn(`No se pudo preparar ${catalogo.nombre} para su rack.`);
                    return;
                }

                ubicacion.posiciones.forEach((posicion, indice) => {
                    const fuente = fuentes[indice % fuentes.length];
                    crearCopia(
                        fuente,
                        `${clave}_${indice + 1}`,
                        posicion.x,
                        posicion.y,
                        posicion.z,
                        catalogo.alto,
                        catalogo.rotacion ??
                            ubicacion.rotacionY ??
                            Math.PI / 2,
                        catalogo.categoria,
                        {
                            ancho: catalogo.ancho,
                            profundidad: catalogo.profundidad,
                            idRack: ubicacion.idRack
                        }
                    );
                });

                console.info(
                    `Se colocaron ${ubicacion.posiciones.length} unidades de ${catalogo.nombre} en ${ubicacion.idRack}.`
                );
            }
        );
    }

    catalogoProductosAdicionales.forEach(colocarCatalogoProductos);

    // ========================================================
    // CONSULTAS PARA CLIENTES Y VENTAS
    // ========================================================

    productos.userData.obtenerResumen = () => ({
        modelosCargados,
        unidadesColocadas,
        modelosFallidos
    });

    productos.userData.listarUnidades = () => {
        return [...unidades];
    };

    productos.userData.obtenerPorCategoria = (categoria) => {
        return unidades.filter((objeto) => {
            return objeto.userData.categoria === categoria;
        });
    };

    productos.userData.obtenerDisponibles = () => {
        return unidades.filter((objeto) => {
            const datos = objeto.userData;

            return (
                datos.disponible &&
                !datos.recogido &&
                !datos.vendido &&
                !datos.reservado &&
                !datos.enCarrito
            );
        });
    };

    // Buscar productos por código de catálogo.
    // Ejemplo: obtenerPorCodigo('PLATANO')
    productos.userData.obtenerPorCodigo = (codigo) => {
        return unidades.filter((objeto) => {
            return objeto.userData.codigoCatalogo === codigo;
        });
    };

    // Obtener plátanos que todavía pueden recogerse.
    productos.userData.obtenerPlatanosDisponibles = () => {
        return unidades.filter((objeto) => {
            const datos = objeto.userData;

            return (
                datos.codigoCatalogo === 'PLATANO' &&
                datos.disponible &&
                !datos.recogido &&
                !datos.vendido &&
                !datos.reservado &&
                !datos.enCarrito
            );
        });
    };

    productos.userData.buscarPorId = (idUnidad) => {
        return unidadesPorId.get(idUnidad) ?? null;
    };

    productos.userData.obtenerEstadisticas = () => {
        let disponibles = 0;
        let recogidos = 0;
        let vendidos = 0;
        let reservados = 0;

        for (const unidad of unidades) {
            const datos = unidad.userData;

            if (
                datos.disponible &&
                !datos.recogido &&
                !datos.vendido
            ) {
                disponibles++;
            }

            if (datos.recogido) recogidos++;
            if (datos.vendido) vendidos++;
            if (datos.reservado) reservados++;
        }

        return {
            total: unidades.length,
            disponibles,
            recogidos,
            vendidos,
            reservados,
            modelosCargados,
            modelosFallidos,
            platanosDisponibles:
                productos.userData.obtenerPlatanosDisponibles().length
        };
    };

    productos.userData.obtenerCatalogoPrecios = () => {
        return { ...PRECIOS };
    };

    productos.userData.obtenerPrecio = (codigo) => {
        return PRECIOS[codigo] ?? 0;
    };

    // ========================================================
    // INFORMACIÓN DE INICIO
    // ========================================================

    console.info(
        'Catálogo iniciado: únicamente 15 plátanos a $8 MXN cada uno.'
    );

    return productos;
}
