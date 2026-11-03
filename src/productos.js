
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// PRODUCTOS DEL SUPERMERCADO
// Three.js | GLB | Unidades independientes
// Ajustado a las dimensiones reales de mobiliario.js
// ============================================================

export function crearProductosLacteos(scene) {
    if (!scene?.isScene) {
        throw new Error(
            'crearProductosLacteos necesita una THREE.Scene.'
        );
    }

    const loader = new GLTFLoader();
    const productos = new THREE.Group();

    productos.name = 'PRODUCTOS_SUPERMERCADO';
    scene.add(productos);

    // ========================================================
    // PRECIOS PROVISIONALES MXN
    // ========================================================

    const PRECIOS = {
        GALLETAS: 23,
        CEREAL: 58,
        CEREAL_2: 58,
        NESQUIK: 55,
        NESQUIK_EXTRA: 55,

        DORITO: 22,
        DORITO_DINAMITA: 22,
        DORITO_ICONIG: 22,
        DORITO_PIZZEROLA: 22,

        SABRITAS: 18,
        SABRITAS_ADOBADAS: 18,
        SABRITAS_LIMON: 18,

        FRIJOLES: 24,
        ELOTE: 22,
        JALAPENO: 23,
        ACEITE: 42,
        ATUN: 28,

        PAPEL: 35,
        PAPEL_HOGAR: 35,
        HIGIENE_PERSONAL: 45,
        HIGIENE_SURTIDA: 45,
        TOALLITAS_BEBE: 42,
        BEBE_SURTIDO: 42,

        SANTA_CLARA: 30,
        LALA: 29,
        AGUA: 15,
        AGUA_FRIA: 15,
        PEPSI: 20,
        PEPSI_EXTRA: 20,
        REFRESCOS_SURTIDOS: 22,

        UVAS: 35,
        PERA: 12,
        LIMON: 5,
        BROCOLI: 18,
        PEPINO: 12,
        MANZANA: 10,
        PLATANO: 8,

        POLLO: 45,
        FILETE: 55,

        CLORO: 24,
        DETERGENTE: 48,
        DETERGENTE_2: 48,
        SUAVIZANTE: 42,
        LIMPIADOR: 35,

        BLUSA: 180,
        SUDADERA_NEGRA: 350,
        SUDADERA_ROJA: 350,
        CHAMARRA_NEGRA: 550,
        PANTALON_MEZCLILLA: 420,
        VESTIDO: 380
    };

    // ========================================================
    // MEDIDAS REALES DE LAS REPISAS
    // ========================================================

    // Góndolas: niveles de mobiliario.js:
    // [0.43, 0.86, 1.29, 1.72]
    // Superficie superior = centro + 0.0325

    const nivelesGondola = [
        0.4625,
        0.8925,
        1.3225,
        1.7525
    ];

    // Refrigeradores:
    // [0.50, 0.93, 1.36, 1.79]
    // Superficie superior = centro + 0.0225

    const nivelesRefrigerador = [
        0.5225,
        0.9525,
        1.3825,
        1.8125
    ];

    // Limpieza:
    // [0.43, 0.78, 1.13, 1.48, 1.83]
    // Superficie superior = centro + 0.0275

    const nivelesLimpieza = [
        0.4575,
        0.8075,
        1.1575,
        1.5075,
        1.8575
    ];

    // Cuatro posiciones a lo largo de cada góndola.
    const posicionesGondola = [
        -1.95,
        -0.65,
        0.65,
        1.95
    ];

    const posicionesRefrigerador = [
        -0.48,
        0.48
    ];

    // Orientación base de los modelos GLB.
    const GIRO_FRENTE = Math.PI / 2;

    let modelosCargados = 0;
    let unidadesColocadas = 0;
    let modelosFallidos = 0;
    let siguienteIdUnidad = 1;

    const cacheModelos = new Map();

    // ========================================================
    // CARGAR MODELOS GLB CON CACHÉ
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
    // DETECTAR GRUPOS INDEPENDIENTES DEL GLB
    // ========================================================

    function obtenerGruposProducto(original) {
        original.updateMatrixWorld(true);

        function buscarContenedor(padre) {
            const gruposHijos = padre.children.filter((hijo) => {
                return hijo.isGroup && contieneMallas(hijo);
            });

            if (gruposHijos.length >= 2) {
                return gruposHijos;
            }

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

        original.updateMatrixWorld(true);

        const inversaRaiz = original.matrixWorld.clone().invert();

        return grupos.map((grupo, indice) => {
            grupo.updateWorldMatrix(true, true);

            const matrizRelativa = new THREE.Matrix4()
                .multiplyMatrices(
                    inversaRaiz,
                    grupo.matrixWorld
                );

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

            const caja = new THREE.Box3()
                .setFromObject(fuente);

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

        if (Number.isFinite(precio)) {
            return precio;
        }

        console.warn(
            `No hay precio para ${codigo}. Se asignará $0.00 MXN.`
        );

        return 0;
    }

    // ========================================================
    // CREAR UNA UNIDAD DE PRODUCTO
    // AJUSTE PROPORCIONAL EN TRES DIMENSIONES
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

        const modelo = fuente.clone(true);

        modelo.name = nombre;

        modelo.position.set(0, 0, 0);
        modelo.rotation.set(0, rotacionY, 0);
        modelo.scale.set(1, 1, 1);

        modelo.updateMatrixWorld(true);

        const cajaInicial = new THREE.Box3()
            .setFromObject(modelo);

        if (cajaInicial.isEmpty()) {
            console.warn(`Modelo sin geometría: ${nombre}`);
            return null;
        }

        const dimensiones = new THREE.Vector3();

        cajaInicial.getSize(dimensiones);

        if (
            dimensiones.x <= 0.0001 ||
            dimensiones.y <= 0.0001 ||
            dimensiones.z <= 0.0001 ||
            !Number.isFinite(altura) ||
            altura <= 0
        ) {
            console.warn(
                `Dimensiones inválidas para ${nombre}.`,
                dimensiones
            );

            return null;
        }

        const anchoMaximo = limites.ancho ?? 0.44;
        const profundidadMaxima = limites.profundidad ?? 0.42;

        // Escala uniforme para conservar proporciones.
        const escalaAltura = altura / dimensiones.y;
        const escalaAncho = anchoMaximo / dimensiones.x;
        const escalaProfundidad =
            profundidadMaxima / dimensiones.z;

        const escala = Math.min(
            escalaAltura,
            escalaAncho,
            escalaProfundidad
        );

        modelo.scale.setScalar(escala);
        modelo.updateMatrixWorld(true);

        const cajaFinal = new THREE.Box3()
            .setFromObject(modelo);

        // Centrar el producto y apoyar su base en la repisa.
        const centroX =
            (cajaFinal.min.x + cajaFinal.max.x) / 2;

        const centroZ =
            (cajaFinal.min.z + cajaFinal.max.z) / 2;

        modelo.position.set(
            x - centroX,
            y - cajaFinal.min.y,
            z - centroZ
        );

        modelo.updateMatrixWorld(true);

        // ----------------------------------------------------
        // METADATOS INDIVIDUALES
        // ----------------------------------------------------

        const idUnidad = `UNIDAD_${String(
            siguienteIdUnidad++
        ).padStart(5, '0')}`;

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

        modelo.userData.posicionEstante = {
            x: modelo.position.x,
            y: modelo.position.y,
            z: modelo.position.z
        };

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

        const dimensionesFinales = new THREE.Box3()
            .setFromObject(modelo);

        const tamanoFinal = new THREE.Vector3();

        dimensionesFinales.getSize(tamanoFinal);

        modelo.userData.dimensionesFinales = {
            ancho: tamanoFinal.x,
            alto: tamanoFinal.y,
            profundidad: tamanoFinal.z
        };

        productos.add(modelo);
        unidadesColocadas++;

        return modelo;
    }

    // ========================================================
    // ROTACIÓN SEGÚN EL LADO DE LA GÓNDOLA
    // ========================================================

    function obtenerRotacionGondola(
        lado,
        rotacionExtra = 0
    ) {
        const giroLado = lado === -1 ? Math.PI : 0;

        return GIRO_FRENTE + giroLado + rotacionExtra;
    }

    // ========================================================
    // 1. GÓNDOLAS CENTRALES
    // ========================================================

    function colocarEnGondola(config) {
        cargarModelo(
            config.archivo,
            config.nombre,
            (original) => {
                const fuentes =
                    crearFuentesIndependientes(original);

                if (!fuentes.length) return;

                const posiciones = [];

                const espaciosPorNivel =
                    config.cantidadPorNivel ?? 4;

                const desplazamientos =
                    espaciosPorNivel === 3
                        ? [-1.55, 0, 1.55]
                        : posicionesGondola;

                nivelesGondola.forEach((nivel, nivelIndex) => {
                    desplazamientos.forEach((desplazamiento, indice) => {
                        posiciones.push({
                            nivel,
                            nivelIndex,
                            indice,
                            x: config.rackX + config.lado * 0.30,
                            z: config.rackZ + desplazamiento
                        });
                    });
                });

                posiciones.forEach((posicion) => {
                    const fuente =
                        fuentes[
                            posicion.indice % fuentes.length
                        ];

                    const rotacion =
                        obtenerRotacionGondola(
                            config.lado,
                            config.rotacionY ?? 0
                        );

                    crearCopia(
                        fuente,
                        `${config.codigo}_N${posicion.nivelIndex + 1}_${posicion.indice + 1}`,
                        posicion.x,
                        posicion.nivel,
                        posicion.z,
                        config.altura,
                        rotacion,
                        config.categoria,
                        {
                            ancho: 0.44,
                            profundidad: 0.90
                        }
                    );
                });

                console.info(
                    `${config.nombre}: ${posiciones.length} unidades colocadas.`
                );
            }
        );
    }

    // ========================================================
    // CATÁLOGO DE GÓNDOLAS
    // ========================================================

    const catalogoGondolas = [

        // CEREALES

        {
            nombre: 'Nesquik',
            archivo: '/modelos/nesquik.glb',
            codigo: 'NESQUIK',
            categoria: 'Cereales',
            rackX: -17,
            rackZ: -13,
            lado: 1,
            altura: 0.30
        },
        {
            nombre: 'Cereal',
            archivo: '/modelos/cereal.glb',
            codigo: 'CEREAL',
            categoria: 'Cereales',
            rackX: -17,
            rackZ: 0,
            lado: 1,
            altura: 0.30
        },
        {
            nombre: 'Cereal 2',
            archivo: '/modelos/cereal2.glb',
            codigo: 'CEREAL_2',
            categoria: 'Cereales',
            rackX: -17,
            rackZ: 0,
            lado: -1,
            altura: 0.30
        },

        // DORITOS

        {
            nombre: 'Dorito',
            archivo: '/modelos/Dorito.glb',
            codigo: 'DORITO',
            categoria: 'Botanas',
            rackX: 9,
            rackZ: -13,
            lado: -1,
            altura: 0.40
        },
        {
            nombre: 'Dorito Dinamita',
            archivo: '/modelos/DoritoDinamita.glb',
            codigo: 'DORITO_DINAMITA',
            categoria: 'Botanas',
            rackX: 9,
            rackZ: -13,
            lado: 1,
            altura: 0.40
        },
        {
            nombre: 'Dorito Iconig',
            archivo: '/modelos/DoritoIconig.glb',
            codigo: 'DORITO_ICONIG',
            categoria: 'Botanas',
            rackX: -9,
            rackZ: 13,
            lado: -1,
            altura: 0.40
        },
        {
            nombre: 'Dorito Pizzerola',
            archivo: '/modelos/DoritoPizeerola.glb',
            codigo: 'DORITO_PIZZEROLA',
            categoria: 'Botanas',
            rackX: -9,
            rackZ: 13,
            lado: 1,
            altura: 0.40
        },

        // SABRITAS

        {
            nombre: 'Sabritas',
            archivo: '/modelos/Sabritas.glb',
            codigo: 'SABRITAS',
            categoria: 'Botanas',
            rackX: 17,
            rackZ: -13,
            lado: -1,
            altura: 0.35
        },
        {
            nombre: 'Sabritas Adobadas',
            archivo: '/modelos/SabritasAdobadas.glb',
            codigo: 'SABRITAS_ADOBADAS',
            categoria: 'Botanas',
            rackX: 17,
            rackZ: -13,
            lado: 1,
            altura: 0.35
        },
        {
            nombre: 'Sabritas Limón',
            archivo: '/modelos/SabritasLimon.glb',
            codigo: 'SABRITAS_LIMON',
            categoria: 'Botanas',
            rackX: 9,
            rackZ: 13,
            lado: -1,
            altura: 0.35
        },

        // ENLATADOS

        {
            nombre: 'Frijoles',
            archivo: '/modelos/Frijoles.glb',
            codigo: 'FRIJOLES',
            categoria: 'Enlatados',
            rackX: -9,
            rackZ: -13,
            lado: -1,
            altura: 0.30
        },
        {
            nombre: 'Elote',
            archivo: '/modelos/Elote.glb',
            codigo: 'ELOTE',
            categoria: 'Enlatados',
            rackX: -9,
            rackZ: -13,
            lado: 1,
            altura: 0.30
        },
        {
            nombre: 'Jalapeño',
            archivo: '/modelos/Jalapeño.glb',
            codigo: 'JALAPENO',
            categoria: 'Enlatados',
            rackX: -17,
            rackZ: 13,
            lado: -1,
            altura: 0.30
        },
        {
            nombre: 'Atún',
            archivo: '/modelos/Atun.glb',
            codigo: 'ATUN',
            categoria: 'Enlatados',
            rackX: -17,
            rackZ: 13,
            lado: 1,
            altura: 0.30
        },

        // ACEITES

        {
            nombre: 'Aceite',
            archivo: '/modelos/Aceite.glb',
            codigo: 'ACEITE',
            categoria: 'Aceites y abarrotes',
            rackX: 17,
            rackZ: 0,
            lado: -1,
            altura: 0.42
        },

        // PAPEL E HIGIENE

        {
            nombre: 'Papel higiénico',
            archivo: '/modelos/papel.glb',
            codigo: 'PAPEL',
            categoria: 'Hogar',
            rackX: -9,
            rackZ: 0,
            lado: -1,
            altura: 0.30
        },
        {
            nombre: 'Toallitas para bebé',
            archivo: '/modelos/toallitas_bebe.glb',
            codigo: 'TOALLITAS_BEBE',
            categoria: 'Bebé',
            rackX: 9,
            rackZ: 0,
            lado: -1,
            altura: 0.38
        },
        {
            nombre: 'Cereal Nesquik',
            archivo: '/modelos/nesquik.glb',
            codigo: 'NESQUIK_EXTRA',
            categoria: 'Cereales',
            rackX: 17,
            rackZ: -13,
            lado: 1,
            altura: 0.30
        },
        {
            nombre: 'Papel para el hogar',
            archivo: '/modelos/papel.glb',
            codigo: 'PAPEL_HOGAR',
            categoria: 'Hogar',
            rackX: 9,
            rackZ: 13,
            lado: 1,
            altura: 0.30
        },
        {
            nombre: 'Toallitas de bebé',
            archivo: '/modelos/toallitas_bebe.glb',
            codigo: 'BEBE_SURTIDO',
            categoria: 'Bebé',
            rackX: 17,
            rackZ: 0,
            lado: 1,
            altura: 0.38
        }
    ];

    catalogoGondolas.forEach(colocarEnGondola);

    // ========================================================
    // 2. REFRIGERADORES
    // ========================================================

    const catalogoRefrigeradores = [
        {
            nombre: 'Leche Santa Clara',
            archivo: '/modelos/SantaClara.glb',
            codigo: 'SANTA_CLARA',
            x: -27,
            altura: 0.30,
            categoria: 'Lácteos'
        },
        {
            nombre: 'Leche Lala',
            archivo: '/modelos/Lala.glb',
            codigo: 'LALA',
            x: -23.5,
            altura: 0.30,
            categoria: 'Lácteos'
        },
        {
            nombre: 'Agua embotellada',
            archivo: '/modelos/Agua.glb',
            codigo: 'AGUA',
            x: -20,
            altura: 0.38,
            categoria: 'Bebidas'
        },
        {
            nombre: 'Pepsi',
            archivo: '/modelos/Pepsi.glb',
            codigo: 'PEPSI',
            x: -16.5,
            altura: 0.30,
            categoria: 'Refrescos'
        },
        {
            nombre: 'Pepsi y Coca-Cola',
            archivo: '/modelos/Pepsi. y coca.glb',
            codigo: 'REFRESCOS_SURTIDOS',
            x: 16.5,
            altura: 0.30,
            categoria: 'Refrescos'
        },
        {
            nombre: 'Agua fría',
            archivo: '/modelos/Agua.glb',
            codigo: 'AGUA_FRIA',
            x: 20,
            altura: 0.38,
            categoria: 'Bebidas'
        },
        {
            nombre: 'Refrescos Pepsi',
            archivo: '/modelos/Pepsi.glb',
            codigo: 'PEPSI_EXTRA',
            x: 27,
            altura: 0.30,
            categoria: 'Refrescos'
        }
    ];

    catalogoRefrigeradores.forEach((config) => {
        cargarModelo(
            config.archivo,
            config.nombre,
            (original) => {
                const fuentes =
                    crearFuentesIndependientes(original);

                nivelesRefrigerador.forEach((nivel, nivelIndex) => {
                    posicionesRefrigerador.forEach((dx, indice) => {
                        const fuente = fuentes[
                            (
                                nivelIndex *
                                posicionesRefrigerador.length +
                                indice
                            ) % fuentes.length
                        ];

                        crearCopia(
                            fuente,
                            `${config.codigo}_N${nivelIndex + 1}_${indice + 1}`,
                            config.x + dx,
                            nivel,
                            -26.5,
                            config.altura,
                            GIRO_FRENTE,
                            config.categoria,
                            {
                                ancho: 0.85,
                                profundidad: 0.65
                            }
                        );
                    });
                });
            }
        );
    });

    // ========================================================
    // 3. FRUTAS Y VERDURAS
    // ========================================================

    const mesasFrescos = {
        Mesa_frescos_01: { x: -25.5, z: 15 },
        Mesa_frescos_02: { x: -21.7, z: 15 },
        Mesa_frescos_03: { x: -25.5, z: 10.8 },
        Mesa_frescos_04: { x: -21.7, z: 10.8 }
    };

    function colocarEnMesa(config) {
        const mesa = mesasFrescos[config.mesa];

        if (!mesa) {
            console.error(`Mesa no encontrada: ${config.mesa}`);
            return;
        }

        cargarModelo(
            config.archivo,
            config.nombre,
            (original) => {
                const fuentes =
                    crearFuentesIndependientes(original);

                config.posiciones.forEach(([dx, dz], indice) => {
                    const fuente = fuentes[indice % fuentes.length];

                    crearCopia(
                        fuente,
                        `${config.codigo}_${String(indice + 1).padStart(2, '0')}`,
                        mesa.x + dx,
                        1.00,
                        mesa.z + dz,
                        config.altura,
                        config.rotacionY ?? 0,
                        'Frutas y verduras',
                        {
                            ancho: 0.42,
                            profundidad: 0.42
                        }
                    );
                });
            }
        );
    }

    colocarEnMesa({
        nombre: 'Uvas',
        archivo: '/modelos/Uvas.glb',
        codigo: 'UVAS',
        mesa: 'Mesa_frescos_01',
        altura: 0.25,
        posiciones: [
            [-0.55, -0.30],
            [0.55, -0.30],
            [-0.55, 0.30],
            [0.55, 0.30]
        ]
    });

    colocarEnMesa({
        nombre: 'Pera',
        archivo: '/modelos/Pera.glb',
        codigo: 'PERA',
        mesa: 'Mesa_frescos_02',
        altura: 0.25,
        posiciones: [
            [-0.65, -0.30],
            [0, -0.30],
            [0.65, -0.30],
            [-0.65, 0.30],
            [0, 0.30],
            [0.65, 0.30]
        ]
    });

    colocarEnMesa({
        nombre: 'Limón',
        archivo: '/modelos/Limon.glb',
        codigo: 'LIMON',
        mesa: 'Mesa_frescos_03',
        altura: 0.18,
        posiciones: [
            [-0.55, -0.30],
            [0.55, -0.30]
        ]
    });

    colocarEnMesa({
        nombre: 'Brócoli',
        archivo: '/modelos/Brocoli.glb',
        codigo: 'BROCOLI',
        mesa: 'Mesa_frescos_03',
        altura: 0.28,
        posiciones: [
            [-0.55, 0.30],
            [0.55, 0.30]
        ]
    });

    colocarEnMesa({
        nombre: 'Pepino',
        archivo: '/modelos/Pepino.glb',
        codigo: 'PEPINO',
        mesa: 'Mesa_frescos_03',
        altura: 0.28,
        posiciones: [
            [-0.55, 0],
            [0.55, 0]
        ],
        rotacionY: Math.PI / 2
    });

    colocarEnMesa({
        nombre: 'Manzana',
        archivo: '/modelos/Mazana.glb',
        codigo: 'MANZANA',
        mesa: 'Mesa_frescos_04',
        altura: 0.25,
        posiciones: [
            [-0.65, -0.30],
            [0, -0.30],
            [0.65, -0.30],
            [-0.65, 0.30],
            [0, 0.30],
            [0.65, 0.30]
        ]
    });

    colocarEnMesa({
        nombre: 'Plátano',
        archivo: '/modelos/Platano.glb',
        codigo: 'PLATANO',
        mesa: 'Mesa_frescos_02',
        altura: 0.25,
        posiciones: [
            [-0.55, 0.52],
            [0.55, 0.52]
        ]
    });

    // ========================================================
    // 4. CARNICERÍA
    // ========================================================

    function colocarEnMostrador(config) {
        cargarModelo(
            config.archivo,
            config.nombre,
            (original) => {
                const fuentes =
                    crearFuentesIndependientes(original);

                config.posiciones.forEach(([dx, dz], indice) => {
                    const fuente = fuentes[indice % fuentes.length];

                    crearCopia(
                        fuente,
                        `${config.codigo}_${indice + 1}`,
                        25.1 + dx,
                        1.22,
                        -7.3 + dz,
                        config.altura,
                        config.rotacionY ?? 0,
                        'Carnicería',
                        {
                            ancho: 0.42,
                            profundidad: 0.42
                        }
                    );
                });
            }
        );
    }

    colocarEnMostrador({
        nombre: 'Pollo',
        archivo: '/modelos/Pollo.glb',
        codigo: 'POLLO',
        altura: 0.22,
        posiciones: [
            [-0.55, -0.30],
            [0.55, -0.30]
        ]
    });

    colocarEnMostrador({
        nombre: 'Filete',
        archivo: '/modelos/Filete.glb',
        codigo: 'FILETE',
        altura: 0.14,
        posiciones: [
            [-0.55, 0.30],
            [0.55, 0.30]
        ]
    });

    // ========================================================
    // 5. HIGIENE Y LIMPIEZA
    // ========================================================

    const productosLimpieza = [
        {
            nombre: 'Cloro líquido',
            archivo: '/modelos/cloro_liquido.glb',
            codigo: 'CLORO'
        },
        {
            nombre: 'Detergente líquido',
            archivo: '/modelos/detergente_liquido.glb',
            codigo: 'DETERGENTE'
        },
        {
            nombre: 'Suavizante líquido',
            archivo: '/modelos/suavizante_liquido.glb',
            codigo: 'SUAVIZANTE'
        },
        {
            nombre: 'Limpiador multiusos',
            archivo: '/modelos/limpiador_multiusos.glb',
            codigo: 'LIMPIADOR'
        }
    ];

    // El módulo mide 2.8 de ancho.
    // Cada tipo ocupa una columna independiente.
    const columnasLimpieza = [
        -0.90,
        -0.30,
        0.30,
        0.90
    ];

    productosLimpieza.forEach((config, productoIndex) => {
        cargarModelo(
            config.archivo,
            config.nombre,
            (original) => {
                const fuentes =
                    crearFuentesIndependientes(original);

                const fuente = fuentes[0];

                nivelesLimpieza.forEach((nivel, nivelIndex) => {
                    crearCopia(
                        fuente,
                        `${config.codigo}_N${nivelIndex + 1}_1`,
                        28.3 + columnasLimpieza[productoIndex],
                        nivel,
                        8.15,
                        0.32,
                        GIRO_FRENTE,
                        'Higiene y limpieza',
                        {
                            ancho: 0.48,
                            profundidad: 0.42
                        }
                    );
                });
            }
        );
    });

    // ========================================================
    // 6. DEPARTAMENTO DE ROPA
    // ========================================================

    const prendas = [
        {
            nombre: 'Blusa',
            archivo: '/modelos/Blusa.glb',
            codigo: 'BLUSA',
            x: -26.35,
            z: -4,
            altura: 0.95
        },
        {
            nombre: 'Sudadera negra',
            archivo: '/modelos/SudaderaNegra.glb',
            codigo: 'SUDADERA_NEGRA',
            x: -25.05,
            z: -4,
            altura: 1.05
        },
        {
            nombre: 'Sudadera roja',
            archivo: '/modelos/sudaderaroja.glb',
            codigo: 'SUDADERA_ROJA',
            x: -26.35,
            z: 2,
            altura: 1.05
        },
        {
            nombre: 'Chamarra negra',
            archivo: '/modelos/chamarranegra.glb',
            codigo: 'CHAMARRA_NEGRA',
            x: -25.05,
            z: 2,
            altura: 1.10
        },
        {
            nombre: 'Pantalón de mezclilla',
            archivo: '/modelos/pantalomezclilla.glb',
            codigo: 'PANTALON_MEZCLILLA',
            x: -26.35,
            z: 8,
            altura: 1.00
        },
        {
            nombre: 'Vestido',
            archivo: '/modelos/vesitdo.glb',
            codigo: 'VESTIDO',
            x: -25.05,
            z: 8,
            altura: 1.15
        }
    ];

    prendas.forEach((prenda) => {
        cargarModelo(
            prenda.archivo,
            prenda.nombre,
            (original) => {
                const fuentes =
                    crearFuentesIndependientes(original);

                crearCopia(
                    fuentes[0],
                    prenda.codigo,
                    prenda.x,
                    0.65,
                    prenda.z,
                    prenda.altura,
                    GIRO_FRENTE,
                    'Ropa',
                    {
                        ancho: 0.95,
                        profundidad: 0.45
                    }
                );
            }
        );
    });

    // ========================================================
    // 7. CONSULTAS PARA CLIENTES Y VENTAS
    // ========================================================

    productos.userData.obtenerResumen = () => ({
        modelosCargados,
        unidadesColocadas,
        modelosFallidos
    });

    productos.userData.listarUnidades = () => {
        const lista = [];

        productos.traverse((objeto) => {
            if (objeto.userData?.esUnidadProducto) {
                lista.push(objeto);
            }
        });

        return lista;
    };

    productos.userData.obtenerPorCategoria = (categoria) => {
        return productos.userData
            .listarUnidades()
            .filter((objeto) => {
                return objeto.userData.categoria === categoria;
            });
    };

    productos.userData.obtenerDisponibles = () => {
        return productos.userData
            .listarUnidades()
            .filter((objeto) => {
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

    productos.userData.buscarPorId = (idUnidad) => {
        return productos.userData
            .listarUnidades()
            .find((objeto) => {
                return objeto.userData.idUnidadProducto === idUnidad;
            }) ?? null;
    };

    productos.userData.obtenerEstadisticas = () => {
        const unidades = productos.userData.listarUnidades();

        return {
            total: unidades.length,

            disponibles: unidades.filter((unidad) => {
                const datos = unidad.userData;

                return (
                    datos.disponible &&
                    !datos.recogido &&
                    !datos.vendido
                );
            }).length,

            recogidos: unidades.filter(
                (unidad) => unidad.userData.recogido
            ).length,

            vendidos: unidades.filter(
                (unidad) => unidad.userData.vendido
            ).length,

            reservados: unidades.filter(
                (unidad) => unidad.userData.reservado
            ).length,

            modelosCargados,
            modelosFallidos
        };
    };

    productos.userData.obtenerCatalogoPrecios = () => {
        return { ...PRECIOS };
    };

    productos.userData.obtenerPrecio = (codigo) => {
        return PRECIOS[codigo] ?? 0;
    };

    console.info(
        'Catálogo de productos iniciado. ' +
        'Unidades independientes con precios provisionales MXN.'
    );

    return productos;
}
