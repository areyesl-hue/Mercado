
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// PRODUCTOS DEL SUPERMERCADO
// Archivo: productos.js
//
// Compatible con el mobiliario compartido:
// - 12 góndolas centrales.
// - 8 refrigeradores.
// - 4 mesas de frutas y verduras.
// - Estanterías perimetrales.
// - Higiene, limpieza, cereales y bebidas.
//
// Todos los modelos se cargan desde public/modelos/.
// Se reutilizan mediante clone() para llenar las repisas.
// ============================================================

export function crearProductosLacteos(scene) {
    if (!scene || !scene.isScene) {
        throw new Error(
            'crearProductosLacteos necesita una escena THREE.Scene.'
        );
    }

    const loader = new GLTFLoader();
    const productos = new THREE.Group();

    productos.name = 'PRODUCTOS_SUPERMERCADO';
    scene.add(productos);

    // --------------------------------------------------------
    // PRECIOS DE DEMOSTRACIÓN EN PESOS MEXICANOS
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
    // COORDENADAS DEL MOBILIARIO
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

    const modelosCargados = {};
    let contador = 0;

    // --------------------------------------------------------
    // CARGA DE MODELOS CON ALTERNATIVAS
    // --------------------------------------------------------

    function cargarArchivo(archivo) {
        return new Promise((resolve) => {
            loader.load(
                archivo,
                (gltf) => {
                    const modelo = gltf.scene;

                    modelo.traverse((objeto) => {
                        if (!objeto.isMesh) return;

                        objeto.castShadow = true;
                        objeto.receiveShadow = true;

                        if (objeto.material) {
                            const materiales = Array.isArray(
                                objeto.material
                            )
                                ? objeto.material
                                : [objeto.material];

                            materiales.forEach((material) => {
                                material.side = THREE.DoubleSide;
                                material.needsUpdate = true;
                            });
                        }
                    });

                    resolve(modelo);
                },
                undefined,
                (error) => {
                    console.warn(
                        `No se pudo cargar ${archivo}:`,
                        error.message || error
                    );
                    resolve(null);
                }
            );
        });
    }

    async function cargarModelo(config) {
        const archivos = [
            config.archivo,
            ...(config.alternativas || [])
        ];

        for (const archivo of archivos) {
            const modelo = await cargarArchivo(archivo);

            if (modelo) {
                return modelo;
            }
        }

        console.error(
            `No se encontró el modelo ${config.archivo}.`
        );

        return null;
    }

    // --------------------------------------------------------
    // PREPARAR MODELOS
    // --------------------------------------------------------

    async function cargarTodosLosModelos() {
        const entradas = Object.entries(MODELOS);

        await Promise.all(
            entradas.map(async ([codigo, config]) => {
                modelosCargados[codigo] = await cargarModelo(config);
            })
        );
    }

    // --------------------------------------------------------
    // REGISTRO DE INVENTARIO
    // --------------------------------------------------------

    function registrarUnidad(modelo, codigo, nombre) {
        contador++;

        modelo.userData = {
            ...modelo.userData,
            esUnidadProducto: true,
            recogido: false,
            reservado: false,
            vendido: false,
            nombreProducto: nombre,
            codigoProducto: codigo,
            indiceUnidad: contador,
            precio: PRECIOS[codigo] ?? 0,
            idProducto: `${codigo}_${contador}`
        };
    }

    // --------------------------------------------------------
    // CREAR UNA UNIDAD DESDE UN MODELO CARGADO
    // --------------------------------------------------------

    function crearUnidad(
        codigo,
        x,
        y,
        z,
        opciones = {}
    ) {
        const original = modelosCargados[codigo];

        if (!original) return null;

        const config = MODELOS[codigo];
        const modelo = original.clone(true);

        modelo.name = `${codigo}_UNIDAD_${contador + 1}`;

        // Normalizar la altura del modelo.
        modelo.updateMatrixWorld(true);

        const cajaInicial = new THREE.Box3().setFromObject(modelo);
        const tamano = new THREE.Vector3();

        cajaInicial.getSize(tamano);

        const alturaObjetivo = opciones.altura ?? config.altura;

        if (tamano.y > 0.0001) {
            const factor = alturaObjetivo / tamano.y;
            modelo.scale.multiplyScalar(factor);
        }

        modelo.updateMatrixWorld(true);

        const cajaFinal = new THREE.Box3().setFromObject(modelo);
        const centro = new THREE.Vector3();

        cajaFinal.getCenter(centro);

        // Ajustar el centro horizontal y apoyar la base en la repisa.
        modelo.position.x += x - centro.x;
        modelo.position.y += y - cajaFinal.min.y;
        modelo.position.z += z - centro.z;

        modelo.rotation.y = opciones.rotacionY ?? 0;

        registrarUnidad(modelo, codigo, codigo);

        productos.add(modelo);

        return modelo;
    }

    // --------------------------------------------------------
    // DISTRIBUIR PRODUCTOS EN UNA REPISA
    // --------------------------------------------------------

    function llenarRepisa(
        codigo,
        x,
        y,
        z,
        cantidad = 6,
        opciones = {}
    ) {
        const anchoFila = opciones.anchoFila ?? 0.46;
        const inicioZ = opciones.inicioZ ?? -2.35;
        const pasoZ = opciones.pasoZ ?? 0.94;

        for (let i = 0; i < cantidad; i++) {
            crearUnidad(
                codigo,
                x + ((i % 2) ? anchoFila * 0.12 : 0),
                y,
                z + inicioZ + i * pasoZ,
                {
                    altura: opciones.altura,
                    rotacionY: opciones.rotacionY ?? 0
                }
            );
        }
    }

    // --------------------------------------------------------
    // 1. LLENAR LAS 12 GÓNDOLAS CENTRALES
    //
    // Cada góndola tiene dos lados y cuatro niveles.
    // Cada repisa recibe seis productos.
    // Se alternan productos para evitar pasillos vacíos.
    // --------------------------------------------------------

    function productosParaGondola(indiceX, indiceZ, lado, nivel) {
        const secciones = [
            [
                ['PAPEL', 'TOALLITAS_BEBE', 'CEREAL', 'CEREAL2'],
                ['CEREAL', 'NESQUIK', 'PAPEL', 'TOALLITAS_BEBE'],
                ['CEREAL2', 'NESQUIK', 'DETERGENTE_LIQUIDO', 'DETERGENTE_POLVO'],
                ['DETERGENTE_LIQUIDO', 'DETERGENTE_POLVO', 'PAPEL', 'CEREAL2']
            ],
            [
                ['CEREAL', 'CEREAL2', 'NESQUIK', 'TOALLITAS_BEBE'],
                ['PAPEL', 'CEREAL', 'CEREAL2', 'NESQUIK'],
                ['DETERGENTE_LIQUIDO', 'DETERGENTE_POLVO', 'PAPEL', 'TOALLITAS_BEBE'],
                ['CEREAL2', 'NESQUIK', 'DETERGENTE_POLVO', 'CEREAL']
            ],
            [
                ['PEPSI', 'COCACOLA', 'AGUA', 'NESQUIK'],
                ['CEREAL', 'CEREAL2', 'NESQUIK', 'AGUA'],
                ['PEPSI', 'COCACOLA', 'AGUA', 'CEREAL'],
                ['CEREAL2', 'NESQUIK', 'PEPSI', 'COCACOLA']
            ],
            [
                ['DETERGENTE_LIQUIDO', 'DETERGENTE_POLVO', 'PAPEL', 'TOALLITAS_BEBE'],
                ['PAPEL', 'DETERGENTE_LIQUIDO', 'DETERGENTE_POLVO', 'CEREAL'],
                ['TOALLITAS_BEBE', 'PAPEL', 'CEREAL2', 'NESQUIK'],
                ['DETERGENTE_POLVO', 'DETERGENTE_LIQUIDO', 'CEREAL', 'CEREAL2']
            ]
        ];

        const columna = secciones[indiceX];

        const fila = columna[
            (nivel + indiceZ + (lado === 1 ? 1 : 0)) % columna.length
        ];

        return fila;
    }

    function llenarGondolas() {
        let numeroGondola = 0;

        for (let ix = 0; ix < GONDOLAS_X.length; ix++) {
            for (let iz = 0; iz < GONDOLAS_Z.length; iz++) {
                const centroX = GONDOLAS_X[ix];
                const centroZ = GONDOLAS_Z[iz];

                numeroGondola++;

                for (const lado of [-1, 1]) {
                    for (let nivel = 0; nivel < NIVELES_GONDOLA.length; nivel++) {
                        const y = NIVELES_GONDOLA[nivel] + 0.035;
                        const x = centroX + lado * 0.30;

                        const surtido = productosParaGondola(
                            ix,
                            iz,
                            lado,
                            nivel
                        );

                        const codigo = surtido[
                            (iz + nivel + (lado === 1 ? 1 : 0)) %
                            surtido.length
                        ];

                        // Alternar familias por tramo de la góndola.
                        // Cada tramo conserva seis unidades por repisa.
                        llenarRepisa(
                            codigo,
                            x,
                            y,
                            centroZ,
                            6,
                            {
                                pasoZ: 0.88,
                                inicioZ: -2.2,
                                altura: MODELOS[codigo].altura,
                                rotacionY: lado === -1 ? 0 : Math.PI
                            }
                        );

                        // Segunda familia para que la repisa no se vea vacía.
                        const segundoCodigo = surtido[
                            (iz + nivel + 2 + (lado === 1 ? 1 : 0)) %
                            surtido.length
                        ];

                        // Tres unidades intercaladas entre las principales.
                        for (let j = 0; j < 3; j++) {
                            crearUnidad(
                                segundoCodigo,
                                x,
                                y,
                                centroZ - 1.76 + j * 1.76,
                                {
                                    altura: MODELOS[segundoCodigo].altura,
                                    rotacionY: lado === -1 ? 0 : Math.PI
                                }
                            );
                        }
                    }
                }
            }
        }

        console.info(
            `Góndolas surtidas: ${numeroGondola}.`
        );
    }

    // --------------------------------------------------------
    // 2. LLENAR LOS REFRIGERADORES
    // --------------------------------------------------------

    function llenarRefrigeradores() {
        REFRI_X.forEach((x, indice) => {
            let codigoPrincipal;

            if (indice <= 1) {
                codigoPrincipal = 'SANTA_CLARA';
            } else if (indice === 2) {
                codigoPrincipal = 'LALA';
            } else if (indice === 3) {
                codigoPrincipal = 'LALA';
            } else if (indice <= 5) {
                codigoPrincipal = 'PEPSI';
            } else {
                codigoPrincipal = 'COCACOLA';
            }

            for (let nivel = 0; nivel < NIVELES_REFRI.length; nivel++) {
                const y = NIVELES_REFRI[nivel] + 0.025;

                let codigo = codigoPrincipal;

                if (indice >= 4 && nivel % 2 === 1) {
                    codigo = 'AGUA';
                }

                if (indice <= 3 && nivel === 3) {
                    codigo = indice % 2 === 0
                        ? 'SANTA_CLARA'
                        : 'LALA';
                }

                for (let i = 0; i < 5; i++) {
                    crearUnidad(
                        codigo,
                        x - 0.82 + i * 0.41,
                        y,
                        -26.12,
                        {
                            altura: MODELOS[codigo].altura,
                            rotacionY: 0
                        }
                    );
                }
            }
        });

        console.info('Refrigeradores surtidos.');
    }

    // --------------------------------------------------------
    // 3. LLENAR MESAS DE FRUTAS Y VERDURAS
    //
    // Superficie aproximada: Y=1.0.
    // Se conservan las coordenadas de mobiliario.js.
    // --------------------------------------------------------

    function llenarMesa(codigo, centroX, centroZ, cantidad = 12) {
        const columnas = 4;
        const filas = Math.ceil(cantidad / columnas);

        for (let i = 0; i < cantidad; i++) {
            const columna = i % columnas;
            const fila = Math.floor(i / columnas);

            crearUnidad(
                codigo,
                centroX - 0.88 + columna * 0.57,
                1.0,
                centroZ - 0.36 + fila * (0.72 / Math.max(1, filas - 1)),
                {
                    altura: MODELOS[codigo].altura
                }
            );
        }
    }

    function llenarFrutasVerduras() {
        llenarMesa('PERA', MESAS.pera.x, MESAS.pera.z, 12);
        llenarMesa('PLATANO', MESAS.platano.x, MESAS.platano.z, 12);
        llenarMesa('UVAS', MESAS.uvas.x, MESAS.uvas.z, 10);
        llenarMesa('MANZANA', MESAS.manzana.x, MESAS.manzana.z, 12);
        llenarMesa('LIMON', MESAS.limon.x, MESAS.limon.z, 12);
        llenarMesa('LECHUGA', MESAS.lechuga.x, MESAS.lechuga.z, 8);
        llenarMesa('BROCOLI', MESAS.brocoli.x, MESAS.brocoli.z, 8);
        llenarMesa('PEPINO', MESAS.pepino.x, MESAS.pepino.z, 8);

        console.info('Mesas de frutas y verduras surtidas.');
    }

    // --------------------------------------------------------
    // 4. ESTANTERÍAS PERIMETRALES
    // --------------------------------------------------------

    function llenarEstanteriasPerimetrales() {
        const posiciones = [
            { x: -29.0, z: -18, familia: ['PAPEL', 'TOALLITAS_BEBE'] },
            { x: -29.0, z: -10, familia: ['CEREAL', 'CEREAL2'] },
            { x: 29.0, z: -18, familia: ['DETERGENTE_LIQUIDO', 'DETERGENTE_POLVO'] },
            { x: 29.0, z: -10, familia: ['PAPEL', 'TOALLITAS_BEBE'] }
        ];

        posiciones.forEach((estante) => {
            for (let nivel = 0; nivel < NIVELES_GONDOLA.length; nivel++) {
                const y = NIVELES_GONDOLA[nivel] + 0.035;
                const codigo = estante.familia[nivel % estante.familia.length];

                for (let i = 0; i < 4; i++) {
                    crearUnidad(
                        codigo,
                        estante.x,
                        y,
                        estante.z - 1.35 + i * 0.90,
                        {
                            altura: MODELOS[codigo].altura,
                            rotacionY: estante.x < 0 ? 0 : Math.PI
                        }
                    );
                }
            }
        });

        // Módulo de higiene y limpieza de la pared derecha.
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

        modulos.forEach((modulo) => {
            const niveles = [0.43, 0.78, 1.13, 1.48, 1.83];

            niveles.forEach((y, nivel) => {
                const codigo = modulo.familia[nivel % modulo.familia.length];

                for (let i = 0; i < 4; i++) {
                    crearUnidad(
                        codigo,
                        modulo.x - 0.55 + i * 0.36,
                        y + 0.03,
                        modulo.z + 0.15,
                        {
                            altura: Math.min(
                                MODELOS[codigo].altura,
                                0.30
                            )
                        }
                    );
                }
            });
        });

        console.info('Estanterías perimetrales surtidas.');
    }

    // --------------------------------------------------------
    // 5. PANADERÍA, CARNICERÍA Y PESCADERÍA
    // --------------------------------------------------------

    function llenarMostradores() {
        // Panadería: productos visibles sobre las bandejas.
        // Se utilizan modelos existentes como surtido visual
        // mientras se agregan modelos específicos de pan.
        const panaderia = [
            { x: 24.25, z: 15.2 },
            { x: 25.0, z: 15.2 },
            { x: 25.75, z: 15.2 },
            { x: 24.25, z: 11.4 },
            { x: 25.0, z: 11.4 },
            { x: 25.75, z: 11.4 }
        ];

        panaderia.forEach((p, i) => {
            const codigo = i % 2 === 0 ? 'CEREAL' : 'CEREAL2';

            crearUnidad(
                codigo,
                p.x,
                1.02,
                p.z,
                { altura: 0.25 }
            );
        });

        // Carnicería: pollo y filete en el mostrador.
        for (let i = 0; i < 6; i++) {
            crearUnidad(
                'POLLO',
                24.0 + (i % 3) * 0.75,
                1.24,
                -7.55 + Math.floor(i / 3) * 0.50,
                { altura: MODELOS.POLLO.altura }
            );

            crearUnidad(
                'FILETE',
                24.0 + (i % 3) * 0.75,
                1.24,
                -2.75 + Math.floor(i / 3) * 0.50,
                { altura: MODELOS.FILETE.altura }
            );
        }
    }

    // --------------------------------------------------------
    // 6. API PÚBLICA DEL INVENTARIO
    // --------------------------------------------------------

    function obtenerUnidades() {
        const unidades = [];

        productos.traverse((objeto) => {
            if (objeto.userData?.esUnidadProducto) {
                unidades.push(objeto);
            }
        });

        return unidades;
    }

    function obtenerDisponibles() {
        return obtenerUnidades().filter((unidad) =>
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

    // --------------------------------------------------------
    // CARGA E INICIALIZACIÓN
    // --------------------------------------------------------

    productos.userData.obtenerUnidades = obtenerUnidades;
    productos.userData.obtenerDisponibles = obtenerDisponibles;
    productos.userData.obtenerResumen = obtenerResumen;
    productos.userData.obtenerPrecios = obtenerPrecios;

    productos.userData.cargaCompleta = false;

    cargarTodosLosModelos().then(() => {
        llenarGondolas();
        llenarRefrigeradores();
        llenarFrutasVerduras();
        llenarEstanteriasPerimetrales();
        llenarMostradores();

        productos.userData.cargaCompleta = true;

        console.info(
            '========================================',
            '\nSUPERMERCADO SURTIDO',
            '\nUnidades creadas:',
            obtenerUnidades().length,
            '\nModelos disponibles:',
            Object.values(modelosCargados).filter(Boolean).length,
            '\n========================================'
        );
    });

    return productos;
}
