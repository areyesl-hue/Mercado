
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// PRODUCTOS DEL SUPERMERCADO
// Archivo: productos.js
//
// Cada archivo GLB tiene su propia entrada y ubicación.
// No se utiliza Coca-Cola como sustituto de Pepsi ni ningún
// otro modelo como sustituto de productos que no carguen.
//
// Mobiliario esperado:
// Gondolas: x [-17, -9, 9, 17], z [-13, 0, 13]
// Refrigeradores: z -26.5
// Mesas de frutas: z 15 y 10.8
// Panadería: x 25.2, z 15.2 y 11.4
// Congeladores: x 25.5, z -18.5 y -14.8
// Carnicería: x 25.1, z -7.3
// Higiene/limpieza: x 28.3, z 3.3 y 8
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

    const unidades = [];
    const erroresCarga = [];
    const catalogo = [];
    const modelosCargados = new Map();

    let cargaCompleta = false;

    // --------------------------------------------------------
    // CONFIGURACIÓN DE UBICACIONES
    // --------------------------------------------------------

    const estantes = {
        gondolas: [
            { x: -17, z: -13, lado: -1 },
            { x: -17, z: 0, lado: -1 },
            { x: -17, z: 13, lado: -1 },
            { x: -9, z: -13, lado: 1 },
            { x: -9, z: 0, lado: 1 },
            { x: -9, z: 13, lado: 1 },
            { x: 9, z: -13, lado: -1 },
            { x: 9, z: 0, lado: -1 },
            { x: 9, z: 13, lado: -1 },
            { x: 17, z: -13, lado: 1 },
            { x: 17, z: 0, lado: 1 },
            { x: 17, z: 13, lado: 1 }
        ],

        niveles: [0.43, 0.86, 1.29, 1.72],

        refrigeradoresX: [
            -27, -23.5, -20, -16.5,
            16.5, 20, 23.5, 27
        ],

        frutas: [
            { x: -25.5, z: 15 },
            { x: -21.7, z: 15 },
            { x: -25.5, z: 10.8 },
            { x: -21.7, z: 10.8 }
        ]
    };

    // --------------------------------------------------------
    // CATÁLOGO
    //
    // Cada registro es un GLB distinto.
    // Las rutas distinguen mayúsculas y minúsculas en servidores.
    // --------------------------------------------------------

    const catalogoInicial = [
        // Lácteos y bebidas refrigeradas
        {
            id: 'leche-santa-clara',
            nombre: 'Leche Santa Clara',
            archivo: 'SantaClara.glb',
            departamento: 'Lácteos',
            ubicacion: 'refrigerador',
            x: -27, z: -26.08, y: 0.50,
            altura: 0.34
        },
        {
            id: 'leche-lala',
            nombre: 'Leche Lala',
            archivo: 'Lala.glb',
            departamento: 'Lácteos',
            ubicacion: 'refrigerador',
            x: -23.5, z: -26.08, y: 0.50,
            altura: 0.34
        },
        {
            id: 'pepsi',
            nombre: 'Pepsi',
            archivo: 'Pepsi.glb',
            departamento: 'Bebidas',
            ubicacion: 'refrigerador',
            x: -20, z: -26.08, y: 0.50,
            altura: 0.30
        },
        {
            id: 'coca-cola',
            nombre: 'Coca-Cola',
            archivo: 'cocacola.glb',
            departamento: 'Bebidas',
            ubicacion: 'refrigerador',
            x: -16.5, z: -26.08, y: 0.50,
            altura: 0.30
        },
        {
            id: 'agua',
            nombre: 'Agua embotellada',
            archivo: 'Agua.glb',
            departamento: 'Bebidas',
            ubicacion: 'refrigerador',
            x: 16.5, z: -26.08, y: 0.50,
            altura: 0.34
        },
        {
            id: 'bebidas-varias',
            nombre: 'Bebidas variadas',
            archivo: 'bebidas.glb',
            departamento: 'Bebidas',
            ubicacion: 'refrigerador',
            x: 20, z: -26.08, y: 0.50,
            altura: 0.34
        },

        // Frutas y verduras
        {
            id: 'pera',
            nombre: 'Pera',
            archivo: 'Pera.glb',
            departamento: 'Frutas y verduras',
            ubicacion: 'frutas',
            x: -25.5, z: 15, y: 1.0,
            altura: 0.24
        },
        {
            id: 'uvas',
            nombre: 'Uvas',
            archivo: 'Uvas.glb',
            departamento: 'Frutas y verduras',
            ubicacion: 'frutas',
            x: -24.7, z: 15, y: 1.0,
            altura: 0.24
        },
        {
            id: 'platano',
            nombre: 'Plátano',
            archivo: 'Platano.glb',
            departamento: 'Frutas y verduras',
            ubicacion: 'frutas',
            x: -21.7, z: 15, y: 1.0,
            altura: 0.26
        },
        {
            id: 'limon',
            nombre: 'Limón',
            archivo: 'Limon.glb',
            departamento: 'Frutas y verduras',
            ubicacion: 'frutas',
            x: -20.9, z: 15, y: 1.0,
            altura: 0.18
        },
        {
            id: 'manzana',
            nombre: 'Manzana',
            archivo: 'Mazana.glb',
            alternativas: ['Manzana.glb'],
            departamento: 'Frutas y verduras',
            ubicacion: 'frutas',
            x: -25.5, z: 10.8, y: 1.0,
            altura: 0.22
        },
        {
            id: 'brocoli',
            nombre: 'Brócoli',
            archivo: 'Brocoli.glb',
            departamento: 'Frutas y verduras',
            ubicacion: 'frutas',
            x: -24.7, z: 10.8, y: 1.0,
            altura: 0.30
        },
        {
            id: 'pepino',
            nombre: 'Pepino',
            archivo: 'Pepino.glb',
            departamento: 'Frutas y verduras',
            ubicacion: 'frutas',
            x: -21.7, z: 10.8, y: 1.0,
            altura: 0.28
        },
        {
            id: 'lechuga',
            nombre: 'Lechuga',
            archivo: 'Lechuga.glb',
            departamento: 'Frutas y verduras',
            ubicacion: 'frutas',
            x: -20.9, z: 10.8, y: 1.0,
            altura: 0.28
        },

        // Carnicería
        {
            id: 'pollo',
            nombre: 'Pollo',
            archivo: 'Pollo.glb',
            departamento: 'Carnicería',
            ubicacion: 'mostrador',
            x: 24.2, z: -7.3, y: 1.24,
            altura: 0.38
        },
        {
            id: 'filete',
            nombre: 'Filete',
            archivo: 'Filete.glb',
            departamento: 'Carnicería',
            ubicacion: 'mostrador',
            x: 26.0, z: -7.3, y: 1.24,
            altura: 0.30
        },

        // Panadería
        {
            id: 'pan',
            nombre: 'Pan',
            archivo: 'pan.glb',
            departamento: 'Panadería',
            ubicacion: 'panaderia',
            x: 24.5, z: 15.2, y: 1.02,
            altura: 0.30
        },

        // Cereales y desayuno
        {
            id: 'cereal',
            nombre: 'Cereal',
            archivo: 'cereal.glb',
            departamento: 'Abarrotes',
            ubicacion: 'gondola',
            rack: 0, nivel: 2, posicion: 0,
            altura: 0.38
        },
        {
            id: 'cereal-2',
            nombre: 'Cereal variedad 2',
            archivo: 'cereal2.glb',
            departamento: 'Abarrotes',
            ubicacion: 'gondola',
            rack: 1, nivel: 2, posicion: 0,
            altura: 0.38
        },
        {
            id: 'nesquik',
            nombre: 'Nesquik',
            archivo: 'nesquik.glb',
            departamento: 'Abarrotes',
            ubicacion: 'gondola',
            rack: 0, nivel: 1, posicion: 0,
            altura: 0.32
        },

        // Botanas y galletas
        {
            id: 'doritos',
            nombre: 'Doritos',
            archivo: 'Doritos.glb',
            departamento: 'Botanas',
            ubicacion: 'gondola',
            rack: 2, nivel: 2, posicion: 0,
            altura: 0.28
        },
        {
            id: 'galletas',
            nombre: 'Galletas',
            archivo: 'galletas.glb',
            departamento: 'Botanas',
            ubicacion: 'gondola',
            rack: 2, nivel: 1, posicion: 0,
            altura: 0.28
        },

        // Abarrotes y conservas
        {
            id: 'abarrotes',
            nombre: 'Abarrotes',
            archivo: 'Abarrotes.glb',
            departamento: 'Abarrotes',
            ubicacion: 'gondola',
            rack: 3, nivel: 2, posicion: 0,
            altura: 0.34
        },
        {
            id: 'enlatados',
            nombre: 'Enlatados',
            archivo: 'enlatados.glb',
            departamento: 'Abarrotes',
            ubicacion: 'gondola',
            rack: 3, nivel: 1, posicion: 0,
            altura: 0.28
        },

        // Higiene personal
        {
            id: 'higiene-personal',
            nombre: 'Higiene personal',
            archivo: 'higienePersonal.glb',
            departamento: 'Higiene personal',
            ubicacion: 'gondola',
            rack: 4, nivel: 2, posicion: 0,
            altura: 0.32
        },

        // Limpieza del hogar
        {
            id: 'detergente-liquido',
            nombre: 'Detergente líquido',
            archivo: 'detergente_liquido.glb',
            departamento: 'Limpieza',
            ubicacion: 'limpieza',
            x: 27.5, z: 3.3, y: 0.43,
            altura: 0.36
        },
        {
            id: 'suavizante-liquido',
            nombre: 'Suavizante líquido',
            archivo: 'suavisante_liquido.glb',
            departamento: 'Limpieza',
            ubicacion: 'limpieza',
            x: 28.3, z: 3.3, y: 0.78,
            altura: 0.32
        },
        {
            id: 'cloro-liquido',
            nombre: 'Cloro líquido',
            archivo: 'cloro_liquido.glb',
            departamento: 'Limpieza',
            ubicacion: 'limpieza',
            x: 27.5, z: 8, y: 0.43,
            altura: 0.36
        },
        {
            id: 'limpiador-multiusos',
            nombre: 'Limpiador multiusos',
            archivo: 'limpiador_multiusos.glb',
            departamento: 'Limpieza',
            ubicacion: 'limpieza',
            x: 28.3, z: 8, y: 0.78,
            altura: 0.32
        },
        {
            id: 'detergente-liquido-1',
            nombre: 'Detergente líquido variedad',
            archivo: 'detergente_liquido1.glb',
            departamento: 'Limpieza',
            ubicacion: 'limpieza',
            x: 27.5, z: 3.3, y: 1.13,
            altura: 0.36
        },
        {
            id: 'detergente-polvo',
            nombre: 'Detergente en polvo',
            archivo: 'detergente_polvo.glb',
            departamento: 'Limpieza',
            ubicacion: 'limpieza',
            x: 28.3, z: 8, y: 1.13,
            altura: 0.34
        },

        // Otros modelos que ya habías preparado
        {
            id: 'papel',
            nombre: 'Papel',
            archivo: 'papel.glb',
            departamento: 'Higiene personal',
            ubicacion: 'gondola',
            rack: 5, nivel: 1, posicion: 0,
            altura: 0.30
        },
        {
            id: 'toallitas-bebe',
            nombre: 'Toallitas para bebé',
            archivo: 'toallitas_bebe.glb',
            departamento: 'Higiene personal',
            ubicacion: 'gondola',
            rack: 5, nivel: 2, posicion: 0,
            altura: 0.30
        }
    ];

    // --------------------------------------------------------
    // UBICACIÓN AUTOMÁTICA DE PRODUCTOS EN GÓNDOLAS
    // --------------------------------------------------------

    function calcularPosicionGondola(item) {
        const rack = estantes.gondolas[item.rack] ??
            estantes.gondolas[0];

        const nivel = estantes.niveles[item.nivel ?? 1];
        const desplazamiento = item.posicion ?? 0;

        return {
            x: rack.x + rack.lado * 0.30 + desplazamiento,
            y: nivel,
            z: rack.z + 1.75
        };
    }

    // --------------------------------------------------------
    // PREPARAR MODELO
    // Ajusta la altura sin alterar la geometría compartida.
    // Centra el objeto y coloca su base sobre la repisa.
    // --------------------------------------------------------

    function prepararModelo(modelo, item) {
        modelo.updateMatrixWorld(true);

        const cajaOriginal = new THREE.Box3().setFromObject(modelo);
        const tamano = new THREE.Vector3();
        const centro = new THREE.Vector3();

        cajaOriginal.getSize(tamano);
        cajaOriginal.getCenter(centro);

        if (
            !Number.isFinite(tamano.y) ||
            tamano.y <= 0.0001
        ) {
            throw new Error(
                `El modelo ${item.archivo} no tiene una altura válida.`
            );
        }

        const alturaDeseada = item.altura ?? 0.30;
        const escala = alturaDeseada / tamano.y;

        modelo.scale.multiplyScalar(escala);
        modelo.position.x -= centro.x * escala;
        modelo.position.z -= centro.z * escala;
        modelo.position.y -= cajaOriginal.min.y * escala;

        modelo.traverse(obj => {
            if (!obj.isMesh) return;

            obj.castShadow = false;
            obj.receiveShadow = false;

            // Mantiene materiales originales de los GLB.
            // No se reemplazan texturas ni colores.
            obj.userData.esMallaProducto = true;
        });

        modelo.updateMatrixWorld(true);
        return modelo;
    }

    // --------------------------------------------------------
    // REGISTRO Y CARGA
    // Cada archivo se intenta cargar por su ruta real.
    // Si falla, se informa en consola y no se sustituye.
    // --------------------------------------------------------

    function resolverPosicion(item) {
        if (item.ubicacion === 'gondola') {
            return calcularPosicionGondola(item);
        }

        return {
            x: item.x ?? 0,
            y: item.y ?? 0.5,
            z: item.z ?? 0
        };
    }

    function registrarUnidad(modelo, item, archivoUsado) {
        prepararModelo(modelo, item);

        const posicion = resolverPosicion(item);

        const unidad = new THREE.Group();
        unidad.name = `PRODUCTO_${item.id}`;
        unidad.position.set(posicion.x, posicion.y, posicion.z);

        if (item.rotY !== undefined) {
            unidad.rotation.y = item.rotY;
        }

        modelo.name = item.nombre;
        unidad.add(modelo);

        unidad.userData.esUnidadProducto = true;
        unidad.userData.id = item.id;
        unidad.userData.nombre = item.nombre;
        unidad.userData.archivo = archivoUsado;
        unidad.userData.departamento = item.departamento;
        unidad.userData.ubicacion = item.ubicacion;
        unidad.userData.disponible = true;
        unidad.userData.precio = item.precio ?? 0;
        unidad.userData.codigo = item.codigo ?? item.id;
        unidad.userData.alturaColocacion = posicion.y;

        productos.add(unidad);
        unidades.push(unidad);

        catalogo.push({
            id: item.id,
            nombre: item.nombre,
            archivo: archivoUsado,
            departamento: item.departamento,
            ubicacion: item.ubicacion,
            precio: unidad.userData.precio,
            unidad
        });

        modelosCargados.set(item.id, unidad);
        return unidad;
    }

    function cargarArchivo(item, archivos, indice = 0) {
        return new Promise((resolve, reject) => {
            if (indice >= archivos.length) {
                reject(new Error(
                    `No se pudo cargar ${item.nombre}. Archivos intentados: ${
                        archivos.join(', ')
                    }`
                ));
                return;
            }

            const archivo = archivos[indice];
            const ruta = `/modelos/${archivo}`;

            loader.load(
                ruta,
                gltf => {
                    try {
                        const modelo = gltf.scene;

                        if (!modelo) {
                            throw new Error(
                                `El archivo ${archivo} no contiene escena GLB.`
                            );
                        }

                        const unidad = registrarUnidad(
                            modelo, item, archivo
                        );

                        console.info(
                            `Producto cargado: ${item.nombre}`,
                            `| ${archivo}`,
                            `| ${item.departamento}`,
                            `| posición:`,
                            unidad.position
                        );

                        resolve(unidad);
                    } catch (error) {
                        reject(error);
                    }
                },
                undefined,
                error => {
                    if (indice + 1 < archivos.length) {
                        console.warn(
                            `No se encontró ${ruta}. Probando alternativa.`
                        );

                        cargarArchivo(item, archivos, indice + 1)
                            .then(resolve)
                            .catch(reject);

                        return;
                    }

                    reject(new Error(
                        `Error al cargar ${ruta}: ${
                            error?.message ?? 'archivo no disponible'
                        }`
                    ));
                }
            );
        });
    }

    // --------------------------------------------------------
    // INICIAR CARGA DE TODOS LOS MODELOS
    // --------------------------------------------------------

    const tareas = catalogoInicial.map(async item => {
        const archivos = [
            item.archivo,
            ...(item.alternativas ?? [])
        ];

        try {
            return await cargarArchivo(item, archivos);
        } catch (error) {
            erroresCarga.push({
                id: item.id,
                nombre: item.nombre,
                archivo: item.archivo,
                departamento: item.departamento,
                error: error.message
            });

            console.error(
                `No se cargó el producto "${item.nombre}".`,
                error.message
            );

            return null;
        }
    });

    const promesaCarga = Promise.allSettled(tareas).then(() => {
        cargaCompleta = true;

        const cargados = unidades.length;
        const fallidos = erroresCarga.length;

        console.info('====================================');
        console.info('INVENTARIO 3D DEL SUPERMERCADO');
        console.info(`Modelos registrados: ${cargados}`);
        console.info(`Modelos con error: ${fallidos}`);
        console.info('====================================');

        if (fallidos > 0) {
            console.warn(
                'Revisa los nombres de estos archivos en public/modelos:',
                erroresCarga.map(e => e.archivo)
            );
        }

        return {
            total: catalogoInicial.length,
            cargados,
            fallidos,
            errores: [...erroresCarga]
        };
    });

    // --------------------------------------------------------
    // API PARA CLIENTES, CARRITO Y SISTEMA DE VENTAS
    // --------------------------------------------------------

    productos.userData.cargaCompleta = promesaCarga;

    productos.userData.obtenerUnidades = () =>
        [...unidades];

    productos.userData.obtenerDisponibles = () =>
        unidades.filter(u => u.userData.disponible);

    productos.userData.obtenerResumen = () => ({
        totalCatalogo: catalogoInicial.length,
        cargados: unidades.length,
        disponibles: unidades.filter(
            u => u.userData.disponible
        ).length,
        retirados: unidades.filter(
            u => !u.userData.disponible
        ).length,
        pendientes: !cargaCompleta
    });

    productos.userData.obtenerPrecios = () =>
        catalogo.map(item => ({
            id: item.id,
            nombre: item.nombre,
            precio: item.precio,
            departamento: item.departamento
        }));

    productos.userData.obtenerCatalogo = () =>
        catalogo.map(item => ({
            id: item.id,
            nombre: item.nombre,
            archivo: item.archivo,
            departamento: item.departamento,
            ubicacion: item.ubicacion,
            precio: item.precio
        }));

    productos.userData.obtenerErroresCarga = () =>
        [...erroresCarga];

    productos.userData.buscarPorId = id =>
        modelosCargados.get(id) ?? null;

    productos.userData.buscarPorNombre = nombre => {
        const termino = String(nombre).toLowerCase();

        return unidades.filter(unidad =>
            unidad.userData.nombre.toLowerCase().includes(termino)
        );
    };

    productos.userData.marcarRetirado = unidad => {
        if (!unidad?.userData?.esUnidadProducto) {
            return false;
        }

        unidad.userData.disponible = false;
        return true;
    };

    productos.userData.devolverProducto = unidad => {
        if (!unidad?.userData?.esUnidadProducto) {
            return false;
        }

        unidad.userData.disponible = true;
        return true;
    };

    productos.userData.listarDepartamentos = () => [
        ...new Set(catalogoInicial.map(p => p.departamento))
    ];

    scene.add(productos);

    console.info(
        `Iniciando carga de ${catalogoInicial.length} modelos GLB únicos...`
    );

    return productos;
}
