
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// PRODUCTOS DEL SUPERMERCADO
// Versión optimizada para reducir carga de FPS.
// Conserva modelos, categorías y datos para clientes/ventas.
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

    const GIRO_FRENTE = Math.PI / 2;

    // Menos niveles y unidades por estante.
    const nivelesGondola = [0.48, 1.12, 1.76];
    const nivelesRefrigerador = [0.55, 1.15, 1.75];
    const nivelesLimpieza = [0.48, 1.13, 1.78];

    // Dos posiciones por nivel en lugar de tres.
    const posicionesEstante = [-0.55, 0.55];
    const posicionesRefrigerador = [-0.48, 0.48];
    const posicionesLimpieza = [-0.48, 0.48];

    let modelosCargados = 0;
    let unidadesColocadas = 0;
    let modelosFallidos = 0;

    const cacheModelos = new Map();

    // ========================================================
    // CARGAR CADA MODELO UNA SOLA VEZ
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

                callbacks.forEach((fn) => fn(original));

                console.info(`Modelo cargado: ${nombre}`);
            },
            undefined,
            (error) => {
                modelosFallidos++;
                cacheModelos.delete(archivo);

                console.error(
                    `Error cargando ${archivo}. Revisa la ruta y el nombre del archivo.`,
                    error
                );
            }
        );
    }

    // ========================================================
    // CREAR COPIA DE UN PRODUCTO
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

        const cajaInicial = new THREE.Box3().setFromObject(modelo);
        const dimensiones = new THREE.Vector3();

        cajaInicial.getSize(dimensiones);

        if (
            !Number.isFinite(dimensiones.y) ||
            dimensiones.y <= 0.0001 ||
            altura <= 0
        ) {
            console.warn(`Dimensiones inválidas: ${nombre}`);
            return null;
        }

        const escala = altura / dimensiones.y;

        modelo.scale.setScalar(escala);
        modelo.updateMatrixWorld(true);

        const cajaFinal = new THREE.Box3().setFromObject(modelo);
        const centro = new THREE.Vector3();

        cajaFinal.getCenter(centro);

        modelo.position.set(
            x - centro.x,
            y - cajaFinal.min.y,
            z - centro.z
        );

        modelo.updateMatrixWorld(true);

        // Datos necesarios para clientes, recogida y ventas.
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
    // 1. GÓNDOLAS
    // Antes: 12 unidades por producto.
    // Ahora: 6 unidades por producto.
    // ========================================================

    const catalogoGondolas = [
        { nombre: 'Galletas', archivo: '/modelos/galletas.glb', codigo: 'GALLETAS', categoria: 'Abarrotes', rackX: -17, rackZ: -13, lado: -1, altura: 0.40 },
        { nombre: 'Cereal', archivo: '/modelos/cereal.glb', codigo: 'CEREAL', categoria: 'Abarrotes', rackX: -17, rackZ: -13, lado: 1, altura: 0.30 },
        { nombre: 'Cereal 2', archivo: '/modelos/cereal2.glb', codigo: 'CEREAL_2', categoria: 'Abarrotes', rackX: -17, rackZ: 0, lado: -1, altura: 0.30 },
        { nombre: 'Nesquik', archivo: '/modelos/nesquik.glb', codigo: 'NESQUIK', categoria: 'Abarrotes', rackX: -17, rackZ: 0, lado: 1, altura: 0.30 },
        { nombre: 'Abarrotes', archivo: '/modelos/Abarrotes.glb', codigo: 'ABARROTES', categoria: 'Abarrotes', rackX: -9, rackZ: -13, lado: -1, altura: 0.40 },
        { nombre: 'Enlatados', archivo: '/modelos/enlatados.glb', codigo: 'ENLATADOS', categoria: 'Abarrotes', rackX: -9, rackZ: -13, lado: 1, altura: 0.38 },
        { nombre: 'Doritos', archivo: '/modelos/Doritos.glb', codigo: 'DORITOS', categoria: 'Botanas', rackX: 9, rackZ: -13, lado: -1, altura: 0.40 },
        { nombre: 'Sabritas', archivo: '/modelos/Sabrita.glb', codigo: 'SABRITAS', categoria: 'Botanas', rackX: 9, rackZ: -13, lado: 1, altura: 0.30 },
        { nombre: 'Papel higiénico', archivo: '/modelos/papel.glb', codigo: 'PAPEL', categoria: 'Hogar', rackX: -9, rackZ: 0, lado: -1, altura: 0.30 },
        { nombre: 'Higiene personal', archivo: '/modelos/higienePersonal.glb', codigo: 'HIGIENE_PERSONAL', categoria: 'Higiene', rackX: -9, rackZ: 0, lado: 1, altura: 0.38 },
        { nombre: 'Toallitas para bebé', archivo: '/modelos/toallitas_bebe.glb', codigo: 'TOALLITAS_BEBE', categoria: 'Bebé', rackX: 9, rackZ: 0, lado: -1, altura: 0.38 },
        { nombre: 'Bebidas envasadas', archivo: '/modelos/bebidas.glb', codigo: 'BEBIDAS', categoria: 'Bebidas', rackX: 9, rackZ: 0, lado: 1, altura: 0.38 },
        { nombre: 'Cereal Nesquik', archivo: '/modelos/nesquik.glb', codigo: 'NESQUIK_EXTRA', categoria: 'Abarrotes', rackX: 17, rackZ: -13, lado: -1, altura: 0.30 },
        { nombre: 'Galletas surtidas', archivo: '/modelos/galletas.glb', codigo: 'GALLETAS_SURTIDAS', categoria: 'Abarrotes', rackX: 17, rackZ: -13, lado: 1, altura: 0.40 },
        { nombre: 'Abarrotes surtidos', archivo: '/modelos/Abarrotes.glb', codigo: 'ABARROTES_SURTIDOS', categoria: 'Abarrotes', rackX: -17, rackZ: 13, lado: -1, altura: 0.40 },
        { nombre: 'Enlatados surtidos', archivo: '/modelos/enlatados.glb', codigo: 'ENLATADOS_SURTIDOS', categoria: 'Abarrotes', rackX: -17, rackZ: 13, lado: 1, altura: 0.38 },
        { nombre: 'Botanas Doritos', archivo: '/modelos/Doritos.glb', codigo: 'DORITOS_SURTIDOS', categoria: 'Botanas', rackX: -9, rackZ: 13, lado: -1, altura: 0.40 },
        { nombre: 'Botanas Sabritas', archivo: '/modelos/Sabrita.glb', codigo: 'SABRITAS_SURTIDAS', categoria: 'Botanas', rackX: -9, rackZ: 13, lado: 1, altura: 0.30 },
        { nombre: 'Papel para el hogar', archivo: '/modelos/papel.glb', codigo: 'PAPEL_HOGAR', categoria: 'Hogar', rackX: 9, rackZ: 13, lado: -1, altura: 0.30 },
        { nombre: 'Productos de higiene', archivo: '/modelos/higienePersonal.glb', codigo: 'HIGIENE_SURTIDA', categoria: 'Higiene', rackX: 9, rackZ: 13, lado: 1, altura: 0.38 },
        { nombre: 'Toallitas de bebé', archivo: '/modelos/toallitas_bebe.glb', codigo: 'BEBE_SURTIDO', categoria: 'Bebé', rackX: 17, rackZ: 0, lado: -1, altura: 0.38 },
        { nombre: 'Abarrotes de despensa', archivo: '/modelos/Abarrotes.glb', codigo: 'DESPENSA', categoria: 'Abarrotes', rackX: 17, rackZ: 0, lado: 1, altura: 0.40 }
    ];

    function colocarEnGondola(config) {
        cargarModelo(config.archivo, config.nombre, (original) => {
            nivelesGondola.forEach((nivel, nivelIndex) => {
                posicionesEstante.forEach((desplazamiento, indice) => {
                    crearCopia(
                        original,
                        `${config.codigo}_N${nivelIndex + 1}_${indice + 1}`,
                        config.rackX + config.lado * 0.30,
                        nivel + 0.07,
                        config.rackZ + desplazamiento,
                        config.altura,
                        0,
                        config.categoria
                    );
                });
            });
        });
    }

    catalogoGondolas.forEach(colocarEnGondola);

    // ========================================================
    // 2. REFRIGERADORES
    // Antes: 12 unidades por refrigerador.
    // Ahora: 6 unidades por refrigerador.
    // ========================================================

    const catalogoRefrigeradores = [
        { nombre: 'Leche Santa Clara', archivo: '/modelos/SantaClara.glb', codigo: 'SANTA_CLARA', x: -27, altura: 0.30, categoria: 'Lácteos' },
        { nombre: 'Leche Lala', archivo: '/modelos/Lala.glb', codigo: 'LALA', x: -23.5, altura: 0.30, categoria: 'Lácteos' },
        { nombre: 'Agua embotellada', archivo: '/modelos/Agua.glb', codigo: 'AGUA', x: -20, altura: 0.38, categoria: 'Bebidas' },
        { nombre: 'Pepsi', archivo: '/modelos/Pepsi.glb', codigo: 'PEPSI', x: -16.5, altura: 0.30, categoria: 'Refrescos' },
        { nombre: 'Pepsi y Coca-Cola', archivo: '/modelos/Pepsi. y coca.glb', codigo: 'REFRESCOS_SURTIDOS', x: 16.5, altura: 0.30, categoria: 'Refrescos' },
        { nombre: 'Agua fría', archivo: '/modelos/Agua.glb', codigo: 'AGUA_FRIA', x: 20, altura: 0.38, categoria: 'Bebidas' },
        { nombre: 'Refrescos Pepsi', archivo: '/modelos/Pepsi.glb', codigo: 'PEPSI_EXTRA', x: 27, altura: 0.30, categoria: 'Refrescos' }
    ];

    catalogoRefrigeradores.forEach((config) => {
        cargarModelo(config.archivo, config.nombre, (original) => {
            nivelesRefrigerador.forEach((nivel, nivelIndex) => {
                posicionesRefrigerador.forEach((dx, indice) => {
                    crearCopia(
                        original,
                        `${config.codigo}_N${nivelIndex + 1}_${indice + 1}`,
                        config.x + dx,
                        nivel + 0.04,
                        -26.22,
                        config.altura,
                        0,
                        config.categoria
                    );
                });
            });
        });
    });

    // ========================================================
    // 3. FRUTAS Y VERDURAS
    // Se reducen las repeticiones, manteniendo variedad visual.
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

        cargarModelo(config.archivo, config.nombre, (original) => {
            config.posiciones.forEach(([dx, dz], indice) => {
                crearCopia(
                    original,
                    `${config.codigo}_${String(indice + 1).padStart(2, '0')}`,
                    mesa.x + dx,
                    1.015,
                    mesa.z + dz,
                    config.altura,
                    0,
                    'Frutas y verduras'
                );
            });
        });
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
        ]
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
    // Antes: 4 pollos y 4 filetes.
    // Ahora: 2 de cada uno.
    // ========================================================

    function colocarEnMostrador(config) {
        cargarModelo(config.archivo, config.nombre, (original) => {
            config.posiciones.forEach(([dx, dz], indice) => {
                crearCopia(
                    original,
                    `${config.codigo}_${indice + 1}`,
                    25.1 + dx,
                    1.24,
                    -7.3 + dz,
                    config.altura,
                    0,
                    'Carnicería'
                );
            });
        });
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
    // 5. LIMPIEZA
    // Antes: 15 unidades por producto.
    // Ahora: 6 unidades por producto.
    // ========================================================

    const productosLimpieza = [
        { nombre: 'Cloro líquido', archivo: '/modelos/cloro_liquido.glb', codigo: 'CLORO' },
        { nombre: 'Detergente líquido', archivo: '/modelos/detergente_liquido.glb', codigo: 'DETERGENTE' },
        { nombre: 'Detergente líquido surtido', archivo: '/modelos/detergente_liquido1.glb', codigo: 'DETERGENTE_2' },
        { nombre: 'Suavizante líquido', archivo: '/modelos/suavizante_liquido.glb', codigo: 'SUAVIZANTE' },
        { nombre: 'Limpiador multiusos', archivo: '/modelos/limpiador_multiusos.glb', codigo: 'LIMPIADOR' }
    ];

    productosLimpieza.forEach((config, productoIndex) => {
        cargarModelo(config.archivo, config.nombre, (original) => {
            nivelesLimpieza.forEach((nivel, nivelIndex) => {
                posicionesLimpieza.forEach((dx, indice) => {
                    crearCopia(
                        original,
                        `${config.codigo}_N${nivelIndex + 1}_${indice + 1}`,
                        28.3 + dx,
                        nivel + 0.04,
                        8.15 + productoIndex * 0.55,
                        0.38,
                        0,
                        'Higiene y limpieza'
                    );
                });
            });
        });
    });

    // ========================================================
    // 6. ROPA
    // Se conserva una unidad por modelo.
    // ========================================================

    const prendas = [
        { nombre: 'Blusa', archivo: '/modelos/Blusa.glb', codigo: 'BLUSA', x: -26.35, z: -4, altura: 0.95 },
        { nombre: 'Sudadera negra', archivo: '/modelos/SudaderaNegra.glb', codigo: 'SUDADERA_NEGRA', x: -25.05, z: -4, altura: 1.05 },
        { nombre: 'Sudadera roja', archivo: '/modelos/sudaderaroja.glb', codigo: 'SUDADERA_ROJA', x: -26.35, z: 2, altura: 1.05 },
        { nombre: 'Chamarra negra', archivo: '/modelos/chamarranegra.glb', codigo: 'CHAMARRA_NEGRA', x: -25.05, z: 2, altura: 1.10 },
        { nombre: 'Pantalón de mezclilla', archivo: '/modelos/pantalomezclilla.glb', codigo: 'PANTALON_MEZCLILLA', x: -26.35, z: 8, altura: 1.00 },
        { nombre: 'Vestido', archivo: '/modelos/vesitdo.glb', codigo: 'VESTIDO', x: -25.05, z: 8, altura: 1.15 }
    ];

    prendas.forEach((prenda) => {
        cargarModelo(prenda.archivo, prenda.nombre, (original) => {
            crearCopia(
                original,
                prenda.codigo,
                prenda.x,
                0.65,
                prenda.z,
                prenda.altura,
                0,
                'Ropa'
            );
        });
    });

    // ========================================================
    // FUNCIONES DE CONSULTA PARA CLIENTES Y VENTAS
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

    console.info('Catálogo optimizado de productos iniciado.');

    return productos;
}
