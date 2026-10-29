
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// PRODUCTOS DEL SUPERMERCADO
// Archivo: productos.js
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

    const nivelesGondola = [0.43, 0.86, 1.29, 1.72];
    const nivelesRefrigerador = [0.50, 0.93, 1.36, 1.79];
    const nivelesLimpieza = [0.43, 0.78, 1.13, 1.48, 1.83];

    const GIRO_FRENTE = Math.PI / 2;

    // Límites de tamaño de los modelos.
    const HUELLA_MAXIMA = 0.50;

    let modelosCargados = 0;
    let unidadesColocadas = 0;
    let modelosFallidos = 0;

    // Evita solicitudes duplicadas al mismo archivo.
    const cacheModelos = new Map();

    // ========================================================
    // CARGAR MODELOS GLB
    // ========================================================

    function cargarModelo(archivo, nombre, callback) {
        if (cacheModelos.has(archivo)) {
            const existente = cacheModelos.get(archivo);

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

                    const materiales = Array.isArray(objeto.material)
                        ? objeto.material
                        : [objeto.material];

                    materiales.forEach((material) => {
                        if (!material) return;

                        material.side = THREE.DoubleSide;
                        material.needsUpdate = true;
                    });
                });

                modelosCargados++;
                registro.modelo = original;

                console.info(
                    `Producto cargado: ${nombre} (${archivo})`
                );

                const callbacks = [...registro.callbacks];
                registro.callbacks.length = 0;

                callbacks.forEach((fn) => fn(original));
            },
            undefined,
            (error) => {
                modelosFallidos++;
                cacheModelos.delete(archivo);

                console.error(
                    `No se pudo cargar ${archivo}. Revisa el nombre y la ruta en public/modelos/.`,
                    error
                );
            }
        );
    }

    // ========================================================
    // CREAR COPIA Y AJUSTAR ESCALA
    // ========================================================

    function crearCopia(
        original,
        nombre,
        x,
        y,
        z,
        altura,
        rotacionY = 0,
        categoria = 'Abarrotes'
    ) {
        const modelo = original.clone(true);

        modelo.name = nombre;
        modelo.position.set(0, 0, 0);
        modelo.rotation.set(0, 0, 0);
        modelo.scale.set(1, 1, 1);

        modelo.rotation.y = rotacionY + GIRO_FRENTE;
        modelo.updateMatrixWorld(true);

        let caja = new THREE.Box3().setFromObject(modelo);
        const dimensiones = new THREE.Vector3();

        caja.getSize(dimensiones);

        if (
            !Number.isFinite(dimensiones.y) ||
            dimensiones.y < 0.0001 ||
            !Number.isFinite(altura) ||
            altura <= 0
        ) {
            console.warn(
                `Dimensiones inválidas para ${nombre}.`
            );

            return null;
        }

        // Escala inicial según la altura solicitada.
        let escala = altura / dimensiones.y;

        // Limitar la huella para evitar modelos demasiado anchos.
        const anchoEscalado = dimensiones.x * escala;
        const fondoEscalado = dimensiones.z * escala;
        const huellaActual = Math.max(
            anchoEscalado,
            fondoEscalado
        );

        if (huellaActual > HUELLA_MAXIMA) {
            escala *= HUELLA_MAXIMA / huellaActual;
        }

        modelo.scale.setScalar(escala);
        modelo.updateMatrixWorld(true);

        // Centrar el modelo y apoyar su base.
        caja = new THREE.Box3().setFromObject(modelo);

        const centro = new THREE.Vector3();
        caja.getCenter(centro);

        modelo.position.set(
            -centro.x,
            -caja.min.y,
            -centro.z
        );

        modelo.updateMatrixWorld(true);

        modelo.position.x += x;
        modelo.position.y += y;
        modelo.position.z += z;

        modelo.updateMatrixWorld(true);

        // Datos para recogida y sistema de ventas.
        modelo.userData.esUnidadProducto = true;
        modelo.userData.recogido = false;
        modelo.userData.vendido = false;
        modelo.userData.reservado = false;
        modelo.userData.categoria = categoria;
        modelo.userData.nombreProducto = nombre;

        productos.add(modelo);
        unidadesColocadas++;

        return modelo;
    }

    // ========================================================
    // 1. ABARROTES, BOTANAS Y PRODUCTOS DE GÓNDOLA
    // ========================================================

    const catalogoGondolas = [
        { nombre: 'Galletas', archivo: '/modelos/galletas.glb', codigo: 'GALLETAS', categoria: 'Abarrotes', rackX: -17, rackZ: -13, lado: -1, altura: 0.28 },
        { nombre: 'Cereal', archivo: '/modelos/cereal.glb', codigo: 'CEREAL', categoria: 'Abarrotes', rackX: -17, rackZ: -13, lado: 1, altura: 0.32 },
        { nombre: 'Cereal 2', archivo: '/modelos/cereal2.glb', codigo: 'CEREAL_2', categoria: 'Abarrotes', rackX: -17, rackZ: 0, lado: -1, altura: 0.32 },
        { nombre: 'Nesquik', archivo: '/modelos/nesquik.glb', codigo: 'NESQUIK', categoria: 'Abarrotes', rackX: -17, rackZ: 0, lado: 1, altura: 0.28 },
        { nombre: 'Abarrotes', archivo: '/modelos/Abarrotes.glb', codigo: 'ABARROTES', categoria: 'Abarrotes', rackX: -9, rackZ: -13, lado: -1, altura: 0.30 },
        { nombre: 'Enlatados', archivo: '/modelos/enlatados.glb', codigo: 'ENLATADOS', categoria: 'Abarrotes', rackX: -9, rackZ: -13, lado: 1, altura: 0.27 },
        { nombre: 'Doritos', archivo: '/modelos/Doritos.glb', codigo: 'DORITOS', categoria: 'Botanas', rackX: 9, rackZ: -13, lado: -1, altura: 0.30 },
        { nombre: 'Sabritas', archivo: '/modelos/Sabrita.glb', codigo: 'SABRITAS', categoria: 'Botanas', rackX: 9, rackZ: -13, lado: 1, altura: 0.30 },
        { nombre: 'Papel', archivo: '/modelos/papel.glb', codigo: 'PAPEL', categoria: 'Hogar', rackX: -9, rackZ: 0, lado: -1, altura: 0.30 },
        { nombre: 'Higiene personal', archivo: '/modelos/higienePersonal.glb', codigo: 'HIGIENE_PERSONAL', categoria: 'Higiene', rackX: -9, rackZ: 0, lado: 1, altura: 0.28 },
        { nombre: 'Toallitas para bebé', archivo: '/modelos/toallitas_bebe.glb', codigo: 'TOALLITAS_BEBE', categoria: 'Bebé', rackX: 9, rackZ: 0, lado: -1, altura: 0.25 },
        { nombre: 'Bebidas envasadas', archivo: '/modelos/bebidas.glb', codigo: 'BEBIDAS', categoria: 'Bebidas', rackX: 9, rackZ: 0, lado: 1, altura: 0.30 },
        { nombre: 'Cereal Nesquik', archivo: '/modelos/nesquik.glb', codigo: 'NESQUIK_EXTRA', categoria: 'Abarrotes', rackX: 17, rackZ: -13, lado: -1, altura: 0.28 },
        { nombre: 'Galletas surtidas', archivo: '/modelos/galletas.glb', codigo: 'GALLETAS_SURTIDAS', categoria: 'Abarrotes', rackX: 17, rackZ: -13, lado: 1, altura: 0.28 },
        { nombre: 'Abarrotes surtidos', archivo: '/modelos/Abarrotes.glb', codigo: 'ABARROTES_SURTIDOS', categoria: 'Abarrotes', rackX: -17, rackZ: 13, lado: -1, altura: 0.30 },
        { nombre: 'Enlatados surtidos', archivo: '/modelos/enlatados.glb', codigo: 'ENLATADOS_SURTIDOS', categoria: 'Abarrotes', rackX: -17, rackZ: 13, lado: 1, altura: 0.27 },
        { nombre: 'Botanas Doritos', archivo: '/modelos/Doritos.glb', codigo: 'DORITOS_SURTIDOS', categoria: 'Botanas', rackX: -9, rackZ: 13, lado: -1, altura: 0.30 },
        { nombre: 'Botanas Sabritas', archivo: '/modelos/Sabrita.glb', codigo: 'SABRITAS_SURTIDAS', categoria: 'Botanas', rackX: -9, rackZ: 13, lado: 1, altura: 0.30 },
        { nombre: 'Papel para el hogar', archivo: '/modelos/papel.glb', codigo: 'PAPEL_HOGAR', categoria: 'Hogar', rackX: 9, rackZ: 13, lado: -1, altura: 0.30 },
        { nombre: 'Productos de higiene', archivo: '/modelos/higienePersonal.glb', codigo: 'HIGIENE_SURTIDA', categoria: 'Higiene', rackX: 9, rackZ: 13, lado: 1, altura: 0.28 },
        { nombre: 'Toallitas de bebé', archivo: '/modelos/toallitas_bebe.glb', codigo: 'BEBE_SURTIDO', categoria: 'Bebé', rackX: 17, rackZ: 0, lado: -1, altura: 0.25 },
        { nombre: 'Abarrotes de despensa', archivo: '/modelos/Abarrotes.glb', codigo: 'DESPENSA', categoria: 'Abarrotes', rackX: 17, rackZ: 0, lado: 1, altura: 0.30 }
    ];

    function colocarEnGondola(config) {
        cargarModelo(config.archivo, config.nombre, (original) => {
            let cantidad = 0;

            nivelesGondola.forEach((nivel, indiceNivel) => {
                // Separación horizontal ampliada.
                [-1.05, 0, 1.05].forEach((desplazamiento, indice) => {
                    const copia = crearCopia(
                        original,
                        `${config.codigo}_N${indiceNivel + 1}_${indice + 1}`,
                        config.rackX + config.lado * 0.30,
                        nivel + 0.07,
                        config.rackZ + desplazamiento,
                        config.altura,
                        0,
                        config.categoria
                    );

                    if (copia) cantidad++;
                });
            });

            console.info(
                `Góndola ${config.nombre}: ${cantidad} unidades.`
            );
        });
    }

    catalogoGondolas.forEach(colocarEnGondola);

    // ========================================================
    // 2. LÁCTEOS Y BEBIDAS REFRIGERADAS
    // bebidas.glb se conserva en la góndola, no en este arreglo.
    // ========================================================

    function colocarEnRefrigerador(config) {
        cargarModelo(config.archivo, config.nombre, (original) => {
            let cantidad = 0;

            nivelesRefrigerador.forEach((nivel, indiceNivel) => {
                // Más espacio entre unidades.
                [-0.90, 0, 0.90].forEach((dx, indice) => {
                    const copia = crearCopia(
                        original,
                        `${config.codigo}_N${indiceNivel + 1}_${indice + 1}`,
                        config.x + dx,
                        nivel + 0.04,
                        -26.22,
                        config.altura,
                        config.rotacionY ?? 0,
                        config.categoria
                    );

                    if (copia) cantidad++;
                });
            });

            console.info(
                `Refrigerador ${config.nombre}: ${cantidad} unidades.`
            );
        });
    }

    [
        {
            nombre: 'Leche Santa Clara',
            archivo: '/modelos/SantaClara.glb',
            codigo: 'SANTA_CLARA',
            x: -27,
            altura: 0.25,
            categoria: 'Lácteos'
        },
        {
            nombre: 'Leche Lala',
            archivo: '/modelos/Lala.glb',
            codigo: 'LALA',
            x: -23.5,
            altura: 0.25,
            categoria: 'Lácteos'
        },
        {
            nombre: 'Agua embotellada',
            archivo: '/modelos/Agua.glb',
            codigo: 'AGUA',
            x: -20,
            altura: 0.28,
            categoria: 'Bebidas'
        },
        {
            nombre: 'Pepsi',
            archivo: '/modelos/Pepsi.glb',
            codigo: 'PEPSI',
            x: -16.5,
            altura: 0.24,
            categoria: 'Refrescos'
        },
        {
            nombre: 'Pepsi y Coca-Cola',
            archivo: '/modelos/Pepsi. y coca.glb',
            codigo: 'REFRESCOS_SURTIDOS',
            x: 16.5,
            altura: 0.25,
            categoria: 'Refrescos'
        },
        {
            nombre: 'Agua fría',
            archivo: '/modelos/Agua.glb',
            codigo: 'AGUA_FRIA',
            x: 20,
            altura: 0.28,
            categoria: 'Bebidas'
        },
        {
            nombre: 'Refrescos Pepsi',
            archivo: '/modelos/Pepsi.glb',
            codigo: 'PEPSI_EXTRA',
            x: 27,
            altura: 0.24,
            categoria: 'Refrescos'
        }
    ].forEach(colocarEnRefrigerador);

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
            console.error(
                `Mesa de frescos no encontrada: ${config.mesa}`
            );
            return;
        }

        cargarModelo(config.archivo, config.nombre, (original) => {
            let cantidad = 0;

            config.posiciones.forEach(([dx, dz], indice) => {
                const copia = crearCopia(
                    original,
                    `${config.codigo}_${String(indice + 1).padStart(2, '0')}`,
                    mesa.x + dx,
                    1.015,
                    mesa.z + dz,
                    config.altura,
                    config.rotacionY ?? 0,
                    'Frutas y verduras'
                );

                if (copia) cantidad++;
            });

            console.info(
                `${config.nombre}: ${cantidad} unidades en ${config.mesa}.`
            );
        });
    }

    colocarEnMesa({
        nombre: 'Uvas',
        archivo: '/modelos/Uvas.glb',
        codigo: 'UVAS',
        mesa: 'Mesa_frescos_01',
        altura: 0.20,
        posiciones: [
            [-0.90, -0.35], [-0.30, -0.35],
            [0.30, -0.35], [0.90, -0.35],
            [-0.90, 0.35], [-0.30, 0.35],
            [0.30, 0.35], [0.90, 0.35]
        ]
    });

    colocarEnMesa({
        nombre: 'Pera',
        archivo: '/modelos/Pera.glb',
        codigo: 'PERA',
        mesa: 'Mesa_frescos_02',
        altura: 0.17,
        posiciones: [
            [-0.90, -0.35], [-0.45, -0.35],
            [0, -0.35], [0.45, -0.35], [0.90, -0.35],
            [-0.90, 0.35], [-0.45, 0.35],
            [0, 0.35], [0.45, 0.35], [0.90, 0.35]
        ]
    });

    colocarEnMesa({
        nombre: 'Limón',
        archivo: '/modelos/Limon.glb',
        codigo: 'LIMON',
        mesa: 'Mesa_frescos_03',
        altura: 0.11,
        posiciones: [
            [-0.85, -0.35], [-0.28, -0.35],
            [0.28, -0.35], [0.85, -0.35],
            [-0.85, 0.35], [-0.28, 0.35],
            [0.28, 0.35], [0.85, 0.35]
        ]
    });

    colocarEnMesa({
        nombre: 'Brócoli',
        archivo: '/modelos/Brocoli.glb',
        codigo: 'BROCOLI',
        mesa: 'Mesa_frescos_03',
        altura: 0.19,
        posiciones: [
            [-0.85, 0.40], [-0.28, 0.40],
            [0.28, 0.40], [0.85, 0.40]
        ]
    });

    colocarEnMesa({
        nombre: 'Pepino',
        archivo: '/modelos/Pepino.glb',
        codigo: 'PEPINO',
        mesa: 'Mesa_frescos_03',
        altura: 0.14,
        posiciones: [
            [-0.85, -0.35], [-0.28, -0.35],
            [0.28, -0.35], [0.85, -0.35]
        ]
    });

    colocarEnMesa({
        nombre: 'Manzana',
        archivo: '/modelos/Mazana.glb',
        codigo: 'MANZANA',
        mesa: 'Mesa_frescos_04',
        altura: 0.16,
        posiciones: [
            [-0.90, -0.35], [-0.45, -0.35],
            [0, -0.35], [0.45, -0.35], [0.90, -0.35],
            [-0.90, 0.35], [-0.45, 0.35],
            [0, 0.35], [0.45, 0.35], [0.90, 0.35]
        ]
    });

    colocarEnMesa({
        nombre: 'Plátano',
        archivo: '/modelos/Platano.glb',
        codigo: 'PLATANO',
        mesa: 'Mesa_frescos_02',
        altura: 0.17,
        posiciones: [
            [-0.90, 0.35], [-0.45, 0.35],
            [0, 0.35], [0.45, 0.35], [0.90, 0.35]
        ]
    });

    // ========================================================
    // 4. CARNICERÍA
    // ========================================================

    function colocarEnMostrador(config) {
        cargarModelo(config.archivo, config.nombre, (original) => {
            let cantidad = 0;

            config.posiciones.forEach(([dx, dz], indice) => {
                const copia = crearCopia(
                    original,
                    `${config.codigo}_${indice + 1}`,
                    25.1 + dx,
                    1.24,
                    -7.3 + dz,
                    config.altura,
                    config.rotacionY ?? 0,
                    'Carnicería'
                );

                if (copia) cantidad++;
            });

            console.info(
                `${config.nombre}: ${cantidad} unidades en carnicería.`
            );
        });
    }

    colocarEnMostrador({
        nombre: 'Pollo',
        archivo: '/modelos/Pollo.glb',
        codigo: 'POLLO',
        altura: 0.28,
        posiciones: [
            [-0.90, -0.30], [-0.30, -0.30],
            [0.30, -0.30], [0.90, -0.30]
        ]
    });

    colocarEnMostrador({
        nombre: 'Filete',
        archivo: '/modelos/Filete.glb',
        codigo: 'FILETE',
        altura: 0.16,
        posiciones: [
            [-0.90, 0.30], [-0.30, 0.30],
            [0.30, 0.30], [0.90, 0.30]
        ]
    });

    // ========================================================
    // 5. HIGIENE Y LIMPIEZA
    // ========================================================

    function colocarEnLimpieza(config) {
        cargarModelo(config.archivo, config.nombre, (original) => {
            let cantidad = 0;

            config.niveles.forEach((nivel, indiceNivel) => {
                config.posicionesX.forEach((dx, indice) => {
                    const copia = crearCopia(
                        original,
                        `${config.codigo}_N${indiceNivel + 1}_${indice + 1}`,
                        28.3 + dx,
                        nivel + 0.04,
                        config.z + 0.15,
                        config.altura,
                        config.rotacionY ?? 0,
                        'Higiene y limpieza'
                    );

                    if (copia) cantidad++;
                });
            });

            console.info(
                `${config.nombre}: ${cantidad} unidades en limpieza.`
            );
        });
    }

    const productosLimpieza = [
        { nombre: 'Cloro líquido', archivo: '/modelos/cloro_liquido.glb', codigo: 'CLORO', z: 8.0, altura: 0.30 },
        { nombre: 'Detergente líquido', archivo: '/modelos/detergente_liquido.glb', codigo: 'DETERGENTE', z: 8.0, altura: 0.30 },
        { nombre: 'Detergente líquido surtido', archivo: '/modelos/detergente_liquido1.glb', codigo: 'DETERGENTE_2', z: 8.0, altura: 0.30 },
        { nombre: 'Suavizante líquido', archivo: '/modelos/suavizante_liquido.glb', codigo: 'SUAVIZANTE', z: 8.0, altura: 0.30 },
        { nombre: 'Limpiador multiusos', archivo: '/modelos/limpiador_multiusos.glb', codigo: 'LIMPIADOR', z: 8.0, altura: 0.30 }
    ];

    productosLimpieza.forEach((config) => {
        colocarEnLimpieza({
            ...config,
            niveles: nivelesLimpieza,
            posicionesX: [-0.90, 0, 0.90]
        });
    });

    // ========================================================
    // 6. ROPA
    // ========================================================

    const prendas = [
        { nombre: 'Blusa', archivo: '/modelos/Blusa.glb', codigo: 'BLUSA', x: -26.35, z: -4, altura: 0.95, rotacionY: 0 },
        { nombre: 'Sudadera negra', archivo: '/modelos/SudaderaNegra.glb', codigo: 'SUDADERA_NEGRA', x: -25.05, z: -4, altura: 1.05, rotacionY: 0 },
        { nombre: 'Sudadera roja', archivo: '/modelos/sudaderaroja.glb', codigo: 'SUDADERA_ROJA', x: -26.35, z: 2, altura: 1.05, rotacionY: 0 },
        { nombre: 'Chamarra negra', archivo: '/modelos/chamarranegra.glb', codigo: 'CHAMARRA_NEGRA', x: -25.05, z: 2, altura: 1.10, rotacionY: 0 },
        { nombre: 'Pantalón de mezclilla', archivo: '/modelos/pantalomezclilla.glb', codigo: 'PANTALON_MEZCLILLA', x: -26.35, z: 8, altura: 1.00, rotacionY: 0 },
        { nombre: 'Vestido', archivo: '/modelos/vesitdo.glb', codigo: 'VESTIDO', x: -25.05, z: 8, altura: 1.15, rotacionY: 0 }
    ];

    prendas.forEach((prenda) => {
        cargarModelo(prenda.archivo, prenda.nombre, (original) => {
            const modelo = crearCopia(
                original,
                prenda.codigo,
                prenda.x,
                0.65,
                prenda.z,
                prenda.altura,
                prenda.rotacionY,
                'Ropa'
            );

            if (modelo) {
                console.info(
                    `Prenda colocada: ${prenda.nombre}`
                );
            }
        });
    });

    // ========================================================
    // API PÚBLICA Y RESUMEN
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
        return productos.userData.listarUnidades().filter(
            (objeto) => objeto.userData.categoria === categoria
        );
    };

    console.info(
        'Catálogo iniciado. Los modelos GLB se están cargando.'
    );

    return productos;
}
