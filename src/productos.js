
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// PRODUCTOS DEL SUPERMERCADO
// Three.js | GLB | Unidades independientes
// CATÁLOGO: ÚNICAMENTE PLÁTANOS
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
    // PRECIO DEL ÚNICO PRODUCTO
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

        const anchoMaximo = limites.ancho ?? 0.44;
        const profundidadMaxima = limites.profundidad ?? 0.42;

        const escalaAltura = altura / dimensionesRotadas.y;
        const escalaAncho = anchoMaximo / dimensionesRotadas.x;
        const escalaProfundidad =
            profundidadMaxima / dimensionesRotadas.z;

        const escala = Math.min(
            escalaAltura,
            escalaAncho,
            escalaProfundidad
        );

        modelo.scale.setScalar(escala);
        modelo.updateMatrixWorld(true);

        const cajaFinal = new THREE.Box3().setFromObject(modelo);

        if (cajaFinal.isEmpty()) return null;

        const centroFinal = new THREE.Vector3();
        const dimensionesFinales = new THREE.Vector3();

        cajaFinal.getCenter(centroFinal);
        cajaFinal.getSize(dimensionesFinales);

        modelo.position.set(
            x - centroFinal.x,
            y - cajaFinal.min.y,
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
        modelo.userData.nombreVisible = nombre;
        modelo.userData.nombreUnidad = nombre;

        modelo.userData.precio = precio;
        modelo.userData.moneda = 'MXN';
        modelo.userData.categoria = categoria;

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
                        profundidad: 0.42
                    }
                );
            });

            console.info(
                `🍌 Se colocaron ${posicionesPlatanos.length} plátanos.`
            );
        }
    );

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
