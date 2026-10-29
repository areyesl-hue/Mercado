
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// PRODUCTOS DEL SUPERMERCADO OPTIMIZADOS
// Menos objetos, modelos reutilizados y colocación económica.
// Compatible con el inventario y la recogida de productos.
// ============================================================

export function crearProductosLacteos(scene) {
    if (!scene?.isScene) {
        throw new Error(
            'crearProductosLacteos necesita una escena THREE.Scene.'
        );
    }

    const productos = new THREE.Group();
    productos.name = 'PRODUCTOS_SUPERMERCADO';
    scene.add(productos);

    const loader = new GLTFLoader();

    // --------------------------------------------------------
    // PRECIOS
    // --------------------------------------------------------

    const PRECIOS = {
        SANTA_CLARA: 28,
        LALA: 26,
        PEPSI: 20,
        COCACOLA: 22,
        AGUA: 15,
        PERA: 8,
        PLATANO: 5,
        UVAS: 12,
        LIMON: 4,
        LECHUGA: 15,
        BROCOLI: 18,
        PEPINO: 9,
        MANZANA: 7,
        POLLO: 85,
        FILETE: 65,
        PAPEL: 35,
        TOALLITAS_BEBE: 45,
        CEREAL: 55,
        CEREAL2: 62,
        NESQUIK: 48,
        DETERGENTE_LIQUIDO: 75,
        DETERGENTE_POLVO: 60
    };

    // --------------------------------------------------------
    // MODELOS
    // --------------------------------------------------------

    const MODELOS = {
        SANTA_CLARA: {
            archivo: '/modelos/SantaClara.glb',
            altura: 0.29
        },
        LALA: {
            archivo: '/modelos/Lala.glb',
            altura: 0.29
        },
        PEPSI: {
            archivo: '/modelos/Pepsi.glb',
            altura: 0.25
        },
        COCACOLA: {
            archivo: '/modelos/cocacola.glb',
            altura: 0.25
        },
        AGUA: {
            archivo: '/modelos/Agua.glb',
            altura: 0.28
        },
        PERA: {
            archivo: '/modelos/Pera.glb',
            altura: 0.15
        },
        PLATANO: {
            archivo: '/modelos/Platano.glb',
            altura: 0.16
        },
        UVAS: {
            archivo: '/modelos/Uvas.glb',
            altura: 0.15
        },
        LIMON: {
            archivo: '/modelos/Limon.glb',
            altura: 0.12
        },
        LECHUGA: {
            archivo: '/modelos/Lechuga.glb',
            altura: 0.20
        },
        BROCOLI: {
            archivo: '/modelos/Brocoli.glb',
            altura: 0.19
        },
        PEPINO: {
            archivo: '/modelos/Pepino.glb',
            altura: 0.16
        },
        MANZANA: {
            archivo: '/modelos/Mazana.glb',
            alternativas: ['/modelos/Manzana.glb'],
            altura: 0.14
        },
        POLLO: {
            archivo: '/modelos/Pollo.glb',
            altura: 0.25
        },
        FILETE: {
            archivo: '/modelos/Filete.glb',
            altura: 0.22
        },
        PAPEL: {
            archivo: '/modelos/papel.glb',
            altura: 0.28
        },
        TOALLITAS_BEBE: {
            archivo: '/modelos/toallitas_bebe.glb',
            altura: 0.20
        },
        CEREAL: {
            archivo: '/modelos/cereal.glb',
            altura: 0.32
        },
        CEREAL2: {
            archivo: '/modelos/cereal2.glb',
            altura: 0.32
        },
        NESQUIK: {
            archivo: '/modelos/nesquik.glb',
            altura: 0.24
        },
        DETERGENTE_LIQUIDO: {
            archivo: '/modelos/detergente_liquido1.glb',
            altura: 0.30
        },
        DETERGENTE_POLVO: {
            archivo: '/modelos/detergente_polvo.glb',
            altura: 0.28
        }
    };

    // --------------------------------------------------------
    // UBICACIONES
    // --------------------------------------------------------

    const GONDOLAS_X = [-17, -9, 9, 17];
    const GONDOLAS_Z = [-13, 0, 13];

    const NIVELES_GONDOLA = [0.43, 0.86, 1.29, 1.72];
    const NIVELES_REFRI = [0.50, 0.93, 1.36, 1.79];

    const REFRI_X = [
        -27, -23.5, -20, -16.5,
        16.5, 20, 23.5, 27
    ];

    const MESAS = {
        pera: { x: -25.5, z: 15 },
        platano: { x: -21.7, z: 15 },
        uvas: { x: -25.5, z: 10.8 },
        manzana: { x: -25.5, z: 10.8 },
        limon: { x: -21.7, z: 10.8 },
        lechuga: { x: -21.7, z: 15 },
        brocoli: { x: -25.5, z: 15 },
        pepino: { x: -21.7, z: 10.8 }
    };

    // Un modelo preparado por tipo de producto.
    const modelosCargados = Object.create(null);

    let contador = 0;

    // --------------------------------------------------------
    // CARGA DE UN MODELO
    // --------------------------------------------------------

    function cargarArchivo(archivo) {
        return new Promise(resolve => {
            loader.load(
                archivo,
                gltf => resolve(gltf.scene),
                undefined,
                error => {
                    console.warn(
                        `No se pudo cargar ${archivo}:`,
                        error?.message || error
                    );
                    resolve(null);
                }
            );
        });
    }

    // Se normaliza el modelo una sola vez.
    // Las unidades compartirán geometrías y materiales.
    async function cargarModelo(config) {
        const archivos = [
            config.archivo,
            ...(config.alternativas || [])
        ];

        let original = null;

        for (const archivo of archivos) {
            original = await cargarArchivo(archivo);
            if (original) break;
        }

        if (!original) {
            console.error(
                `No se encontró el modelo ${config.archivo}.`
            );
            return null;
        }

        original.updateMatrixWorld(true);

        const caja = new THREE.Box3().setFromObject(original);
        const tamano = new THREE.Vector3();
        caja.getSize(tamano);

        if (tamano.y <= 0.0001) {
            console.warn(
                `El modelo ${config.archivo} no tiene altura válida.`
            );
            return null;
        }

        const factor = config.altura / tamano.y;

        original.scale.multiplyScalar(factor);
        original.updateMatrixWorld(true);

        const cajaEscalada = new THREE.Box3().setFromObject(original);
        const centro = new THREE.Vector3();

        cajaEscalada.getCenter(centro);

        // Centrar horizontalmente y apoyar el modelo en el suelo.
        original.position.x -= centro.x;
        original.position.y -= cajaEscalada.min.y;
        original.position.z -= centro.z;

        // Las copias no generan sombras dinámicas.
        original.traverse(objeto => {
            if (!objeto.isMesh) return;

            objeto.castShadow = false;
            objeto.receiveShadow = false;

            objeto.frustumCulled = true;
        });

        // Envolver el modelo normalizado permite posicionar
        // las copias sin destruir su corrección de escala/origen.
        const plantilla = new THREE.Group();
        plantilla.name = `PLANTILLA_${config.archivo}`;
        plantilla.add(original);

        return plantilla;
    }

    async function cargarTodosLosModelos() {
        const entradas = Object.entries(MODELOS);

        // Cargar todos los tipos en paralelo.
        const resultados = await Promise.all(
            entradas.map(async ([codigo, config]) => {
                return [
                    codigo,
                    await cargarModelo(config)
                ];
            })
        );

        for (const [codigo, modelo] of resultados) {
            modelosCargados[codigo] = modelo;
        }
    }

    // --------------------------------------------------------
    // INVENTARIO
    // --------------------------------------------------------

    function registrarUnidad(modelo, codigo) {
        contador++;

        modelo.userData = {
            ...modelo.userData,
            esUnidadProducto: true,
            recogido: false,
            reservado: false,
            vendido: false,
            nombreProducto: codigo,
            codigoProducto: codigo,
            indiceUnidad: contador,
            precio: PRECIOS[codigo] ?? 0,
            idProducto: `${codigo}_${contador}`
        };
    }

    // --------------------------------------------------------
    // CREAR UNA UNIDAD
    // No calcula Box3 para cada copia.
    // --------------------------------------------------------

    function crearUnidad(
        codigo,
        x,
        y,
        z,
        opciones = {}
    ) {
        const plantilla = modelosCargados[codigo];

        if (!plantilla) return null;

        const unidad = plantilla.clone(true);

        unidad.name = `${codigo}_UNIDAD_${contador + 1}`;

        unidad.position.set(x, y, z);
        unidad.rotation.y = opciones.rotacionY ?? 0;

        const escalaExtra = opciones.escala ?? 1;
        unidad.scale.setScalar(escalaExtra);

        registrarUnidad(unidad, codigo);
        productos.add(unidad);

        return unidad;
    }

    // --------------------------------------------------------
    // COLOCAR UNA FILA DE PRODUCTOS
    // --------------------------------------------------------

    function llenarFila(
        codigos,
        x,
        y,
        centroZ,
        opciones = {}
    ) {
        const cantidad = opciones.cantidad ?? 4;
        const espacio = opciones.espacio ?? 1.18;
        const anchoX = opciones.anchoX ?? 0;
        const rotacionY = opciones.rotacionY ?? 0;

        for (let i = 0; i < cantidad; i++) {
            const codigo = Array.isArray(codigos)
                ? codigos[i % codigos.length]
                : codigos;

            const z = centroZ + (i - (cantidad - 1) / 2) * espacio;

            crearUnidad(
                codigo,
                x + (i % 2) * anchoX,
                y,
                z,
                { rotacionY }
            );
        }
    }

    // --------------------------------------------------------
    // 1. GÓNDOLAS CENTRALES
    // Cuatro productos por nivel y lado.
    // --------------------------------------------------------

    const SURTIDOS_GONDOLA = [
        ['CEREAL', 'CEREAL2', 'NESQUIK'],
        ['PAPEL', 'TOALLITAS_BEBE'],
        ['DETERGENTE_LIQUIDO', 'DETERGENTE_POLVO'],
        ['PEPSI', 'COCACOLA', 'AGUA']
    ];

    function llenarGondolas() {
        let numero = 0;

        for (let ix = 0; ix < GONDOLAS_X.length; ix++) {
            for (let iz = 0; iz < GONDOLAS_Z.length; iz++) {
                numero++;

                const centroX = GONDOLAS_X[ix];
                const centroZ = GONDOLAS_Z[iz];

                for (const lado of [-1, 1]) {
                    for (let nivel = 0; nivel < NIVELES_GONDOLA.length; nivel++) {
                        const y = NIVELES_GONDOLA[nivel] + 0.035;
                        const x = centroX + lado * 0.30;

                        const familia =
                            SURTIDOS_GONDOLA[
                                (ix + iz + nivel + (lado === 1 ? 1 : 0)) %
                                SURTIDOS_GONDOLA.length
                            ];

                        llenarFila(
                            familia,
                            x,
                            y,
                            centroZ,
                            {
                                cantidad: 4,
                                espacio: 1.18,
                                rotacionY: lado === -1 ? 0 : Math.PI
                            }
                        );
                    }
                }
            }
        }

        console.info(`Góndolas surtidas: ${numero}.`);
    }

    // --------------------------------------------------------
    // 2. REFRIGERADORES
    // Tres productos por nivel en lugar de cinco.
    // --------------------------------------------------------

    function llenarRefrigeradores() {
        REFRI_X.forEach((x, indice) => {
            let principal;

            if (indice <= 1) {
                principal = 'SANTA_CLARA';
            } else if (indice <= 3) {
                principal = 'LALA';
            } else if (indice <= 5) {
                principal = 'PEPSI';
            } else {
                principal = 'COCACOLA';
            }

            for (let nivel = 0; nivel < NIVELES_REFRI.length; nivel++) {
                let codigo = principal;

                if (indice >= 4 && nivel === 1) {
                    codigo = 'AGUA';
                }

                if (indice >= 4 && nivel === 3) {
                    codigo = indice % 2 === 0 ? 'AGUA' : 'COCACOLA';
                }

                llenarFila(
                    codigo,
                    x,
                    NIVELES_REFRI[nivel] + 0.025,
                    -26.12,
                    {
                        cantidad: 3,
                        espacio: 0.78
                    }
                );
            }
        });

        console.info('Refrigeradores surtidos.');
    }

    // --------------------------------------------------------
    // 3. FRUTAS Y VERDURAS
    // --------------------------------------------------------

    function llenarMesa(codigo, centroX, centroZ, cantidad = 8) {
        const columnas = 4;

        for (let i = 0; i < cantidad; i++) {
            const columna = i % columnas;
            const fila = Math.floor(i / columnas);

            crearUnidad(
                codigo,
                centroX - 0.80 + columna * 0.52,
                1.0,
                centroZ - 0.25 + fila * 0.45
            );
        }
    }

    function llenarFrutasVerduras() {
        llenarMesa('PERA', MESAS.pera.x, MESAS.pera.z, 8);
        llenarMesa('PLATANO', MESAS.platano.x, MESAS.platano.z, 8);
        llenarMesa('UVAS', MESAS.uvas.x, MESAS.uvas.z, 6);
        llenarMesa('MANZANA', MESAS.manzana.x, MESAS.manzana.z, 8);
        llenarMesa('LIMON', MESAS.limon.x, MESAS.limon.z, 8);
        llenarMesa('LECHUGA', MESAS.lechuga.x, MESAS.lechuga.z, 6);
        llenarMesa('BROCOLI', MESAS.brocoli.x, MESAS.brocoli.z, 6);
        llenarMesa('PEPINO', MESAS.pepino.x, MESAS.pepino.z, 6);

        console.info('Frutas y verduras surtidas.');
    }

    // --------------------------------------------------------
    // 4. ESTANTERÍAS PERIMETRALES
    // --------------------------------------------------------

    function llenarEstanteriasPerimetrales() {
        const estantes = [
            {
                x: -29,
                z: -18,
                familia: ['PAPEL', 'TOALLITAS_BEBE']
            },
            {
                x: -29,
                z: -10,
                familia: ['CEREAL', 'CEREAL2']
            },
            {
                x: 29,
                z: -18,
                familia: ['DETERGENTE_LIQUIDO', 'DETERGENTE_POLVO']
            },
            {
                x: 29,
                z: -10,
                familia: ['PAPEL', 'TOALLITAS_BEBE']
            }
        ];

        for (const estante of estantes) {
            for (let nivel = 0; nivel < NIVELES_GONDOLA.length; nivel++) {
                const codigo = estante.familia[nivel % estante.familia.length];

                llenarFila(
                    codigo,
                    estante.x,
                    NIVELES_GONDOLA[nivel] + 0.035,
                    estante.z,
                    {
                        cantidad: 3,
                        espacio: 1.15,
                        rotacionY: estante.x < 0 ? 0 : Math.PI
                    }
                );
            }
        }

        const modulos = [
            {
                x: 28.3,
                z: 3.3,
                familia: ['PAPEL', 'TOALLITAS_BEBE']
            },
            {
                x: 28.3,
                z: 8.0,
                familia: ['DETERGENTE_LIQUIDO', 'DETERGENTE_POLVO']
            }
        ];

        const niveles = [0.46, 0.82, 1.18, 1.54, 1.86];

        for (const modulo of modulos) {
            niveles.forEach((y, nivel) => {
                const codigo = modulo.familia[nivel % modulo.familia.length];

                llenarFila(
                    codigo,
                    modulo.x - 0.35,
                    y,
                    modulo.z,
                    {
                        cantidad: 3,
                        espacio: 0.34
                    }
                );
            });
        }

        console.info('Estanterías perimetrales surtidas.');
    }

    // --------------------------------------------------------
    // 5. MOSTRADORES
    // --------------------------------------------------------

    function llenarMostradores() {
        const panaderia = [
            { x: 24.25, z: 15.2 },
            { x: 25.0, z: 15.2 },
            { x: 25.75, z: 15.2 },
            { x: 24.25, z: 11.4 },
            { x: 25.0, z: 11.4 },
            { x: 25.75, z: 11.4 }
        ];

        panaderia.forEach((p, i) => {
            crearUnidad(
                i % 2 === 0 ? 'CEREAL' : 'CEREAL2',
                p.x,
                1.02,
                p.z
            );
        });

        for (let i = 0; i < 3; i++) {
            crearUnidad(
                'POLLO',
                24.0 + i * 0.75,
                1.24,
                -7.55
            );

            crearUnidad(
                'FILETE',
                24.0 + i * 0.75,
                1.24,
                -2.75
            );
        }
    }

    // --------------------------------------------------------
    // 6. FUNCIONES PÚBLICAS DEL INVENTARIO
    // --------------------------------------------------------

    function obtenerUnidades() {
        const unidades = [];

        productos.traverse(objeto => {
            if (objeto.userData?.esUnidadProducto) {
                unidades.push(objeto);
            }
        });

        return unidades;
    }

    function obtenerDisponibles() {
        return obtenerUnidades().filter(unidad =>
            !unidad.userData.recogido &&
            !unidad.userData.reservado &&
            !unidad.userData.vendido
        );
    }

    function obtenerResumen() {
        const resumen = {};

        for (const unidad of obtenerUnidades()) {
            const codigo = unidad.userData.codigoProducto;

            if (!resumen[codigo]) {
                resumen[codigo] = {
                    codigo,
                    precio: PRECIOS[codigo] ?? 0,
                    total: 0,
                    disponibles: 0,
                    recogidos: 0,
                    reservados: 0,
                    vendidos: 0
                };
            }

            const item = resumen[codigo];
            item.total++;

            if (unidad.userData.vendido) {
                item.vendidos++;
            } else if (unidad.userData.recogido) {
                item.recogidos++;
            } else if (unidad.userData.reservado) {
                item.reservados++;
            } else {
                item.disponibles++;
            }
        }

        return resumen;
    }

    function obtenerPrecios() {
        return { ...PRECIOS };
    }

    productos.userData.obtenerUnidades = obtenerUnidades;
    productos.userData.obtenerDisponibles = obtenerDisponibles;
    productos.userData.obtenerResumen = obtenerResumen;
    productos.userData.obtenerPrecios = obtenerPrecios;
    productos.userData.cargaCompleta = false;

    // --------------------------------------------------------
    // INICIALIZACIÓN
    // --------------------------------------------------------

    cargarTodosLosModelos()
        .then(() => {
            llenarGondolas();
            llenarRefrigeradores();
            llenarFrutasVerduras();
            llenarEstanteriasPerimetrales();
            llenarMostradores();

            productos.userData.cargaCompleta = true;

            console.info(
                '====================================',
                '\nSUPERMERCADO OPTIMIZADO',
                '\nUnidades creadas:',
                contador,
                '\nModelos cargados:',
                Object.values(modelosCargados).filter(Boolean).length,
                '\n===================================='
            );
        })
        .catch(error => {
            console.error('Error preparando los productos:', error);
        });

    return productos;
}
