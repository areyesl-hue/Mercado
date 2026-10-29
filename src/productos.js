
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// PRODUCTOS DEL SUPERMERCADO
// Compatible con Three.js + Vite
//
// Ruta de modelos: public/modelos/
// Cada archivo de producto se carga una sola vez.
// No se sustituyen modelos que fallen por otros productos.
// No se crean copias para simular existencias.
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
    const catalogoCargado = new Map();
    const promesasCarga = [];

    let cargaCompleta = false;

    // ========================================================
    // CONFIGURACIÓN DEL MOBILIARIO
    // ========================================================

    const niveles = [0.5025, 0.9325, 1.3625, 1.7925];

    // Posiciones de las góndolas del mobiliario.js.
    const gondolas = [
        { x: -17, z: -13 },
        { x: -17, z: 0 },
        { x: -17, z: 13 },
        { x: -9, z: -13 },
        { x: -9, z: 0 },
        { x: -9, z: 13 },
        { x: 9, z: -13 },
        { x: 9, z: 0 },
        { x: 9, z: 13 },
        { x: 17, z: -13 },
        { x: 17, z: 0 },
        { x: 17, z: 13 }
    ];

    // Cuatro posiciones a lo largo de cada góndola.
    const posicionesZ = [-1.15, -0.38, 0.38, 1.15];

    // Mesas de frutas y verduras.
    const mesasFrutas = [
        { x: -25.5, z: 15 },
        { x: -21.7, z: 15 },
        { x: -25.5, z: 10.8 },
        { x: -21.7, z: 10.8 }
    ];

    // ========================================================
    // CATÁLOGO REAL
    //
    // Las rutas respetan los nombres que compartiste.
    // La ubicación se expresa respecto al mobiliario existente.
    // ========================================================

    const catalogo = [
        // ----------------------------------------------------
        // REFRIGERADORES: Z = -26.5
        // ----------------------------------------------------
        {
            id: 'santa-clara',
            nombre: 'Leche Santa Clara',
            archivo: 'SantaClara.glb',
            departamento: 'Lácteos',
            ubicacion: 'refrigerador',
            x: -27,
            z: -26.08,
            y: niveles[0],
            altura: 0.34
        },
        {
            id: 'lala',
            nombre: 'Leche Lala',
            archivo: 'Lala.glb',
            departamento: 'Lácteos',
            ubicacion: 'refrigerador',
            x: -23.5,
            z: -26.08,
            y: niveles[0],
            altura: 0.34
        },
        {
            id: 'pepsi',
            nombre: 'Pepsi',
            archivo: 'Pepsi.glb',
            departamento: 'Bebidas',
            ubicacion: 'refrigerador',
            x: -20,
            z: -26.08,
            y: niveles[0],
            altura: 0.30
        },
        {
            id: 'pepsi-coca',
            nombre: 'Pepsi y Coca-Cola',
            archivo: 'Pepsi. y coca.glb',
            departamento: 'Bebidas',
            ubicacion: 'refrigerador',
            x: -16.5,
            z: -26.08,
            y: niveles[0],
            altura: 0.34
        },
        {
            id: 'agua',
            nombre: 'Agua embotellada',
            archivo: 'Agua.glb',
            departamento: 'Bebidas',
            ubicacion: 'refrigerador',
            x: 16.5,
            z: -26.08,
            y: niveles[0],
            altura: 0.34
        },
        {
            id: 'bebidas',
            nombre: 'Bebidas',
            archivo: 'bebidas.glb',
            departamento: 'Bebidas',
            ubicacion: 'refrigerador',
            x: 20,
            z: -26.08,
            y: niveles[0],
            altura: 0.34
        },

        // ----------------------------------------------------
        // FRUTAS Y VERDURAS
        // ----------------------------------------------------
        {
            id: 'pera',
            nombre: 'Pera',
            archivo: 'Pera.glb',
            departamento: 'Frutas y verduras',
            ubicacion: 'mesa-frutas',
            mesa: 0,
            dx: -0.48,
            dz: 0,
            altura: 0.24
        },
        {
            id: 'uvas',
            nombre: 'Uvas',
            archivo: 'Uvas.glb',
            departamento: 'Frutas y verduras',
            ubicacion: 'mesa-frutas',
            mesa: 0,
            dx: 0.40,
            dz: 0,
            altura: 0.24
        },
        {
            id: 'platano',
            nombre: 'Plátano',
            archivo: 'Platano.glb',
            departamento: 'Frutas y verduras',
            ubicacion: 'mesa-frutas',
            mesa: 1,
            dx: -0.42,
            dz: 0,
            altura: 0.26
        },
        {
            id: 'limon',
            nombre: 'Limón',
            archivo: 'Limon.glb',
            departamento: 'Frutas y verduras',
            ubicacion: 'mesa-frutas',
            mesa: 1,
            dx: 0.40,
            dz: 0,
            altura: 0.18
        },
        {
            id: 'manzana',
            nombre: 'Manzana',
            archivo: 'Mazana.glb',
            departamento: 'Frutas y verduras',
            ubicacion: 'mesa-frutas',
            mesa: 2,
            dx: -0.42,
            dz: 0,
            altura: 0.22
        },
        {
            id: 'brocoli',
            nombre: 'Brócoli',
            archivo: 'Brocoli.glb',
            departamento: 'Frutas y verduras',
            ubicacion: 'mesa-frutas',
            mesa: 2,
            dx: 0.40,
            dz: 0,
            altura: 0.30
        },
        {
            id: 'pepino',
            nombre: 'Pepino',
            archivo: 'Pepino.glb',
            departamento: 'Frutas y verduras',
            ubicacion: 'mesa-frutas',
            mesa: 3,
            dx: -0.42,
            dz: 0,
            altura: 0.28
        },

        // ----------------------------------------------------
        // CARNICERÍA
        // ----------------------------------------------------
        {
            id: 'pollo',
            nombre: 'Pollo',
            archivo: 'Pollo.glb',
            departamento: 'Carnicería',
            ubicacion: 'mostrador',
            x: 24.2,
            z: -7.3,
            y: 1.24,
            altura: 0.38
        },
        {
            id: 'filete',
            nombre: 'Filete',
            archivo: 'Filete.glb',
            departamento: 'Carnicería',
            ubicacion: 'mostrador',
            x: 26,
            z: -7.3,
            y: 1.24,
            altura: 0.30
        },

        // ----------------------------------------------------
        // ABARROTES Y CEREALES
        // ----------------------------------------------------
        {
            id: 'abarrotes',
            nombre: 'Abarrotes',
            archivo: 'Abarrotes.glb',
            departamento: 'Abarrotes',
            ubicacion: 'gondola',
            rack: 0,
            lado: -1,
            nivel: 2,
            slot: 0,
            altura: 0.34
        },
        {
            id: 'cereal',
            nombre: 'Cereal',
            archivo: 'cereal.glb',
            departamento: 'Cereales',
            ubicacion: 'gondola',
            rack: 0,
            lado: 1,
            nivel: 2,
            slot: 1,
            altura: 0.38
        },
        {
            id: 'cereal-2',
            nombre: 'Cereal variedad 2',
            archivo: 'cereal2.glb',
            departamento: 'Cereales',
            ubicacion: 'gondola',
            rack: 1,
            lado: -1,
            nivel: 2,
            slot: 0,
            altura: 0.38
        },
        {
            id: 'nesquik',
            nombre: 'Nesquik',
            archivo: 'nesquik.glb',
            departamento: 'Cereales',
            ubicacion: 'gondola',
            rack: 1,
            lado: 1,
            nivel: 1,
            slot: 1,
            altura: 0.32
        },
        {
            id: 'enlatados',
            nombre: 'Enlatados',
            archivo: 'enlatados.glb',
            departamento: 'Abarrotes',
            ubicacion: 'gondola',
            rack: 2,
            lado: -1,
            nivel: 1,
            slot: 0,
            altura: 0.28
        },

        // ----------------------------------------------------
        // BOTANAS Y GALLETAS
        // ----------------------------------------------------
        {
            id: 'doritos',
            nombre: 'Doritos',
            archivo: 'Doritos.glb',
            departamento: 'Botanas',
            ubicacion: 'gondola',
            rack: 2,
            lado: 1,
            nivel: 2,
            slot: 1,
            altura: 0.28
        },
        {
            id: 'sabrita',
            nombre: 'Sabritas',
            archivo: 'Sabrita.glb',
            departamento: 'Botanas',
            ubicacion: 'gondola',
            rack: 3,
            lado: -1,
            nivel: 2,
            slot: 0,
            altura: 0.28
        },
        {
            id: 'galletas',
            nombre: 'Galletas',
            archivo: 'galletas.glb',
            departamento: 'Galletas',
            ubicacion: 'gondola',
            rack: 3,
            lado: 1,
            nivel: 1,
            slot: 1,
            altura: 0.28
        },

        // ----------------------------------------------------
        // HIGIENE PERSONAL
        // ----------------------------------------------------
        {
            id: 'higiene-personal',
            nombre: 'Higiene personal',
            archivo: 'higienePersonal.glb',
            departamento: 'Higiene personal',
            ubicacion: 'gondola',
            rack: 4,
            lado: -1,
            nivel: 2,
            slot: 0,
            altura: 0.32
        },
        {
            id: 'papel',
            nombre: 'Papel',
            archivo: 'papel.glb',
            departamento: 'Higiene personal',
            ubicacion: 'gondola',
            rack: 4,
            lado: 1,
            nivel: 1,
            slot: 1,
            altura: 0.30
        },
        {
            id: 'toallitas-bebe',
            nombre: 'Toallitas para bebé',
            archivo: 'toallitas_bebe.glb',
            departamento: 'Bebés',
            ubicacion: 'gondola',
            rack: 5,
            lado: -1,
            nivel: 2,
            slot: 0,
            altura: 0.30
        },

        // ----------------------------------------------------
        // LIMPIEZA DEL HOGAR
        // ----------------------------------------------------
        {
            id: 'detergente-liquido',
            nombre: 'Detergente líquido',
            archivo: 'detergente_liquido.glb',
            departamento: 'Limpieza',
            ubicacion: 'limpieza',
            x: 27.5,
            z: 3.3,
            y: niveles[0],
            altura: 0.36
        },
        {
            id: 'detergente-liquido-1',
            nombre: 'Detergente líquido variedad',
            archivo: 'detergente_liquido1.glb',
            departamento: 'Limpieza',
            ubicacion: 'limpieza',
            x: 28.3,
            z: 3.3,
            y: niveles[1],
            altura: 0.36
        },
        {
            id: 'cloro',
            nombre: 'Cloro líquido',
            archivo: 'cloro_liquido.glb',
            departamento: 'Limpieza',
            ubicacion: 'limpieza',
            x: 27.5,
            z: 8,
            y: niveles[0],
            altura: 0.36
        },
        {
            id: 'suavizante',
            nombre: 'Suavizante líquido',
            archivo: 'suavizante_liquido.glb',
            departamento: 'Limpieza',
            ubicacion: 'limpieza',
            x: 28.3,
            z: 8,
            y: niveles[1],
            altura: 0.32
        },
        {
            id: 'limpiador',
            nombre: 'Limpiador multiusos',
            archivo: 'limpiador_multiusos.glb',
            departamento: 'Limpieza',
            ubicacion: 'limpieza',
            x: 27.5,
            z: 3.3,
            y: niveles[2],
            altura: 0.34
        },

        // ----------------------------------------------------
        // ROPA
        // Se usan góndolas del lado derecho como ubicación inicial.
        // Si tu mobiliario tiene percheros dedicados, podemos
        // ajustar estas coordenadas a esos objetos exactos.
        // ----------------------------------------------------
        {
            id: 'blusa',
            nombre: 'Blusa',
            archivo: 'Blusa.glb',
            departamento: 'Ropa',
            ubicacion: 'gondola',
            rack: 8,
            lado: -1,
            nivel: 1,
            slot: 0,
            altura: 0.55
        },
        {
            id: 'camisa-azul',
            nombre: 'Camisa azul',
            archivo: 'camisaAzul.glb',
            departamento: 'Ropa',
            ubicacion: 'gondola',
            rack: 8,
            lado: 1,
            nivel: 1,
            slot: 1,
            altura: 0.55
        },
        {
            id: 'sudadera-negra',
            nombre: 'Sudadera negra',
            archivo: 'SudaderaNegra.glb',
            departamento: 'Ropa',
            ubicacion: 'gondola',
            rack: 9,
            lado: -1,
            nivel: 1,
            slot: 0,
            altura: 0.65
        },
        {
            id: 'sudadera-roja',
            nombre: 'Sudadera roja',
            archivo: 'sudaderaroja.glb',
            departamento: 'Ropa',
            ubicacion: 'gondola',
            rack: 9,
            lado: 1,
            nivel: 1,
            slot: 1,
            altura: 0.65
        },
        {
            id: 'chamarra-negra',
            nombre: 'Chamarra negra',
            archivo: 'chamarranegra.glb',
            departamento: 'Ropa',
            ubicacion: 'gondola',
            rack: 10,
            lado: -1,
            nivel: 1,
            slot: 0,
            altura: 0.70
        },
        {
            id: 'pantalon-mezclilla',
            nombre: 'Pantalón de mezclilla',
            archivo: 'pantalomezclilla.glb',
            departamento: 'Ropa',
            ubicacion: 'gondola',
            rack: 10,
            lado: 1,
            nivel: 1,
            slot: 1,
            altura: 0.70
        },
        {
            id: 'vestido',
            nombre: 'Vestido',
            archivo: 'vesitdo.glb',
            departamento: 'Ropa',
            ubicacion: 'gondola',
            rack: 11,
            lado: -1,
            nivel: 1,
            slot: 0,
            altura: 0.75
        }
    ];

    // ========================================================
    // POSICIONAMIENTO
    // ========================================================

    function obtenerPosicion(item) {
        if (item.ubicacion === 'gondola') {
            const rack = gondolas[item.rack];

            if (!rack) {
                throw new Error(
                    `La góndola ${item.rack} no existe para ${item.nombre}.`
                );
            }

            const lado = item.lado ?? -1;
            const nivel = niveles[item.nivel ?? 1];
            const slot = posicionesZ[item.slot ?? 1];

            return {
                x: rack.x + lado * 0.62,
                y: nivel,
                z: rack.z + slot
            };
        }

        if (item.ubicacion === 'mesa-frutas') {
            const mesa = mesasFrutas[item.mesa];

            if (!mesa) {
                throw new Error(
                    `La mesa de frutas ${item.mesa} no existe.`
                );
            }

            return {
                x: mesa.x + (item.dx ?? 0),
                y: 1.0,
                z: mesa.z + (item.dz ?? 0)
            };
        }

        return {
            x: item.x ?? 0,
            y: item.y ?? niveles[0],
            z: item.z ?? 0
        };
    }

    // ========================================================
    // NORMALIZAR ESCALA Y CENTRAR EL GLB
    // Conserva los materiales y texturas originales.
    // ========================================================

    function prepararModelo(modelo, item) {
        modelo.updateMatrixWorld(true);

        const cajaInicial = new THREE.Box3().setFromObject(modelo);
        const tamano = new THREE.Vector3();

        cajaInicial.getSize(tamano);

        if (
            !Number.isFinite(tamano.y) ||
            tamano.y < 0.0001
        ) {
            throw new Error(
                `El modelo ${item.archivo} no tiene dimensiones válidas.`
            );
        }

        const alturaObjetivo = item.altura ?? 0.30;
        const escala = alturaObjetivo / tamano.y;

        modelo.scale.multiplyScalar(escala);
        modelo.updateMatrixWorld(true);

        const cajaEscalada = new THREE.Box3().setFromObject(modelo);
        const centro = new THREE.Vector3();

        cajaEscalada.getCenter(centro);

        modelo.position.x -= centro.x;
        modelo.position.y -= cajaEscalada.min.y;
        modelo.position.z -= centro.z;

        modelo.traverse(obj => {
            if (!obj.isMesh) return;

            obj.castShadow = false;
            obj.receiveShadow = false;
            obj.frustumCulled = true;
        });

        modelo.updateMatrixWorld(true);
    }

    // ========================================================
    // REGISTRAR UNIDAD
    // ========================================================

    function registrarProducto(gltf, item) {
        const modelo = gltf.scene;

        if (!modelo) {
            throw new Error(
                `El archivo ${item.archivo} no contiene una escena.`
            );
        }

        prepararModelo(modelo, item);

        const posicion = obtenerPosicion(item);
        const unidad = new THREE.Group();

        unidad.name = `PRODUCTO_${item.id}`;
        unidad.position.set(
            posicion.x,
            posicion.y,
            posicion.z
        );

        if (item.rotY !== undefined) {
            unidad.rotation.y = item.rotY;
        }

        modelo.name = item.nombre;
        unidad.add(modelo);

        unidad.userData = {
            esUnidadProducto: true,
            id: item.id,
            nombre: item.nombre,
            archivo: item.archivo,
            departamento: item.departamento,
            ubicacion: item.ubicacion,
            disponible: true,
            retirado: false,
            precio: item.precio ?? 0,
            codigo: item.codigo ?? item.id,
            alturaColocacion: posicion.y,
            posicionOriginal: posicion,
            escalaObjetivo: item.altura ?? 0.30
        };

        productos.add(unidad);
        unidades.push(unidad);
        catalogoCargado.set(item.id, unidad);

        console.info(
            `[GLB] ${item.archivo} cargado en ${item.departamento}`,
            unidad.position
        );

        return unidad;
    }

    // ========================================================
    // CARGA INDIVIDUAL DE CADA ARCHIVO
    // No hay modelos de sustitución ni copias automáticas.
    // ========================================================

    function cargarProducto(item) {
        return new Promise(resolve => {
            const ruta = `/modelos/${encodeURIComponent(item.archivo)}`;

            loader.load(
                ruta,
                gltf => {
                    try {
                        const unidad = registrarProducto(gltf, item);
                        resolve(unidad);
                    } catch (error) {
                        erroresCarga.push({
                            id: item.id,
                            archivo: item.archivo,
                            departamento: item.departamento,
                            error: error.message
                        });

                        console.error(
                            `[PRODUCTO] Error preparando ${item.archivo}:`,
                            error
                        );

                        resolve(null);
                    }
                },
                undefined,
                error => {
                    const detalle = {
                        id: item.id,
                        archivo: item.archivo,
                        departamento: item.departamento,
                        error: error?.message ?? 'No se pudo cargar el archivo'
                    };

                    erroresCarga.push(detalle);

                    console.error(
                        `[PRODUCTO] No se pudo cargar ${ruta}.`,
                        'Comprueba que el nombre coincida con public/modelos.',
                        error
                    );

                    resolve(null);
                }
            );
        });
    }

    // ========================================================
    // API PÚBLICA PARA CLIENTES, CARRITO Y VENTAS
    // ========================================================

    productos.userData.obtenerUnidades = () => [...unidades];

    productos.userData.obtenerDisponibles = () =>
        unidades.filter(unidad =>
            unidad.userData.disponible &&
            !unidad.userData.retirado
        );

    productos.userData.obtenerResumen = () => ({
        totalCatalogo: catalogo.length,
        cargados: unidades.length,
        disponibles: unidades.filter(
            unidad => unidad.userData.disponible
        ).length,
        retirados: unidades.filter(
            unidad => unidad.userData.retirado
        ).length,
        errores: erroresCarga.length,
        cargaCompleta
    });

    productos.userData.obtenerCatalogo = () =>
        catalogo.map(item => ({
            id: item.id,
            nombre: item.nombre,
            archivo: item.archivo,
            departamento: item.departamento,
            ubicacion: item.ubicacion,
            precio: item.precio ?? 0,
            cargado: catalogoCargado.has(item.id)
        }));

    productos.userData.obtenerPrecios = () =>
        unidades.map(unidad => ({
            id: unidad.userData.id,
            nombre: unidad.userData.nombre,
            precio: unidad.userData.precio,
            departamento: unidad.userData.departamento
        }));

    productos.userData.obtenerErroresCarga = () =>
        [...erroresCarga];

    productos.userData.buscarPorId = id =>
        catalogoCargado.get(id) ?? null;

    productos.userData.buscarPorNombre = nombre => {
        const termino = String(nombre).toLowerCase();

        return unidades.filter(unidad =>
            unidad.userData.nombre.toLowerCase().includes(termino)
        );
    };

    productos.userData.listarDepartamentos = () =>
        [...new Set(catalogo.map(item => item.departamento))];

    productos.userData.marcarRetirado = unidad => {
        if (!unidad?.userData?.esUnidadProducto) {
            return false;
        }

        unidad.userData.disponible = false;
        unidad.userData.retirado = true;
        return true;
    };

    productos.userData.devolverProducto = unidad => {
        if (!unidad?.userData?.esUnidadProducto) {
            return false;
        }

        unidad.userData.disponible = true;
        unidad.userData.retirado = false;
        return true;
    };

    productos.userData.restaurarPosicion = unidad => {
        if (!unidad?.userData?.posicionOriginal) {
            return false;
        }

        const p = unidad.userData.posicionOriginal;

        unidad.position.set(p.x, p.y, p.z);
        unidad.userData.disponible = true;
        unidad.userData.retirado = false;

        return true;
    };

    // ========================================================
    // INICIAR CARGA
    // ========================================================

    scene.add(productos);

    for (const item of catalogo) {
        promesasCarga.push(cargarProducto(item));
    }

    const promesaCarga = Promise.all(promesasCarga).then(() => {
        cargaCompleta = true;

        const resultado = {
            total: catalogo.length,
            cargados: unidades.length,
            fallidos: erroresCarga.length,
            errores: [...erroresCarga]
        };

        console.info('========================================');
        console.info('INVENTARIO 3D DEL SUPERMERCADO');
        console.info(`Modelos de catálogo: ${resultado.total}`);
        console.info(`Modelos cargados: ${resultado.cargados}`);
        console.info(`Modelos con error: ${resultado.fallidos}`);
        console.info('========================================');

        if (erroresCarga.length) {
            console.table(erroresCarga);
        }

        return resultado;
    });

    productos.userData.cargaCompleta = promesaCarga;

    console.info(
        `Cargando ${catalogo.length} modelos de productos distintos...`
    );

    return productos;
}
