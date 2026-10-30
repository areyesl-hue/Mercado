import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

const CONFIG_BASE = {
    modelo: '/modelos/carrito.glb',

    posicion: {
        x: 0,
        y: 0,
        z: 0
    },

    escala: 1,
    altura: 0,

    distancia: 0.95,
    suavizado: 8,

    capacidad: 20,

    correccionModelo: 0,

    anchoCesta: 0.68,
    profundidadCesta: 0.55,
    alturaCesta: 0.62
};

export function crearCarrito(scene, opciones = {}) {
    if (!scene) {
        throw new Error('crearCarrito necesita una escena THREE.Scene.');
    }

    const config = {
        ...CONFIG_BASE,
        ...opciones,
        posicion: {
            ...CONFIG_BASE.posicion,
            ...(opciones.posicion || {})
        }
    };

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
    objetosEnCesta.name = 'PRODUCTOS_DENTRO_CARRITO';

    grupo.add(objetosEnCesta);

    const inventario = [];

    let objetivo = null;
    let eliminado = false;
    let cargado = false;

    const vectorObjetivo = new THREE.Vector3();
    const vectorActual = new THREE.Vector3();

    const materialMetal = new THREE.MeshStandardMaterial({
        color: 0x929ba2,
        metalness: 0.75,
        roughness: 0.35
    });

    const materialPlastico = new THREE.MeshStandardMaterial({
        color: 0x263746,
        roughness: 0.65
    });

    const materialRueda = new THREE.MeshStandardMaterial({
        color: 0x17191c,
        roughness: 0.9
    });

    function crearBarra(inicio, fin, radio = 0.025, material = materialMetal) {
        const a = new THREE.Vector3(...inicio);
        const b = new THREE.Vector3(...fin);

        const direccion = new THREE.Vector3().subVectors(b, a);
        const longitud = direccion.length();

        const geometria = new THREE.CylinderGeometry(
            radio,
            radio,
            longitud,
            8
        );

        const barra = new THREE.Mesh(geometria, material);

        barra.position.copy(a).add(b).multiplyScalar(0.5);
        barra.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direccion.normalize()
        );

        barra.castShadow = false;
        barra.receiveShadow = false;

        grupoModelo.add(barra);

        return barra;
    }

    function crearRueda(x, z) {
        const geometria = new THREE.CylinderGeometry(
            0.085,
            0.085,
            0.055,
            12
        );

        const rueda = new THREE.Mesh(geometria, materialRueda);

        rueda.rotation.z = Math.PI / 2;
        rueda.position.set(x, 0.12, z);

        grupoModelo.add(rueda);
    }

    function crearModeloProvisional() {
        const ancho = 0.68;
        const largo = 0.85;

        const baseY = 0.62;

        // Estructura inferior
        crearBarra(
            [-0.34, 0.32, -0.40],
            [0.34, 0.32, -0.40]
        );

        crearBarra(
            [-0.34, 0.32, 0.40],
            [0.34, 0.32, 0.40]
        );

        crearBarra(
            [-0.34, 0.32, -0.40],
            [-0.34, 0.32, 0.40]
        );

        crearBarra(
            [0.34, 0.32, -0.40],
            [0.34, 0.32, 0.40]
        );

        // Cesta inferior
        crearBarra(
            [-ancho / 2, baseY, -largo / 2],
            [ancho / 2, baseY, -largo / 2]
        );

        crearBarra(
            [-ancho / 2, baseY, largo / 2],
            [ancho / 2, baseY, largo / 2]
        );

        crearBarra(
            [-ancho / 2, baseY, -largo / 2],
            [-ancho / 2, baseY, largo / 2]
        );

        crearBarra(
            [ancho / 2, baseY, -largo / 2],
            [ancho / 2, baseY, largo / 2]
        );

        // Rejilla inferior
        for (let i = 1; i < 5; i++) {
            const z = -largo / 2 + (largo * i) / 5;

            crearBarra(
                [-ancho / 2, baseY, z],
                [ancho / 2, baseY, z],
                0.012
            );
        }

        for (let i = 1; i < 4; i++) {
            const x = -ancho / 2 + (ancho * i) / 4;

            crearBarra(
                [x, baseY, -largo / 2],
                [x, baseY, largo / 2],
                0.012
            );
        }

        // Laterales
        const altura = 0.42;

        for (const x of [-ancho / 2, ancho / 2]) {
            crearBarra(
                [x, baseY, -largo / 2],
                [x, baseY + altura, -largo / 2]
            );

            crearBarra(
                [x, baseY, largo / 2],
                [x, baseY + altura, largo / 2]
            );

            for (let i = 1; i < 5; i++) {
                const z = -largo / 2 + (largo * i) / 5;

                crearBarra(
                    [x, baseY + altura * 0.15, z],
                    [x, baseY + altura * 0.15, z]
                );
            }

            for (let j = 1; j <= 3; j++) {
                const y = baseY + (altura * j) / 4;

                crearBarra(
                    [x, y, -largo / 2],
                    [x, y, largo / 2],
                    0.012
                );
            }
        }

        // Parte trasera y delantera
        for (const z of [-largo / 2, largo / 2]) {
            crearBarra(
                [-ancho / 2, baseY + altura, z],
                [ancho / 2, baseY + altura, z]
            );

            for (let j = 1; j <= 3; j++) {
                const y = baseY + (altura * j) / 4;

                crearBarra(
                    [-ancho / 2, y, z],
                    [ancho / 2, y, z],
                    0.012
                );
            }
        }

        // Manubrio
        crearBarra(
            [-0.34, 1.05, -0.40],
            [-0.34, 1.05, -0.72],
            0.035,
            materialPlastico
        );

        crearBarra(
            [0.34, 1.05, -0.40],
            [0.34, 1.05, -0.72],
            0.035,
            materialPlastico
        );

        crearBarra(
            [-0.34, 1.05, -0.72],
            [0.34, 1.05, -0.72],
            0.045,
            materialPlastico
        );

        // Soportes
        for (const x of [-0.25, 0.25]) {
            crearBarra(
                [x, 0.32, -0.30],
                [x, 0.62, -0.30]
            );
        }

        // Ruedas
        crearRueda(-0.36, -0.35);
        crearRueda(0.36, -0.35);
        crearRueda(-0.36, 0.35);
        crearRueda(0.36, 0.35);

        cargado = true;
    }

    function centrarModelo(modelo) {
        const caja = new THREE.Box3().setFromObject(modelo);

        if (caja.isEmpty()) return;

        const centro = caja.getCenter(new THREE.Vector3());

        modelo.position.x -= centro.x;
        modelo.position.z -= centro.z;

        const cajaNueva = new THREE.Box3().setFromObject(modelo);

        modelo.position.y -= cajaNueva.min.y;

        modelo.position.y += config.correccionModelo;
    }

    function cargarModelo() {
        if (!config.modelo) {
            crearModeloProvisional();
            return;
        }

        loader.load(
            config.modelo,

            (gltf) => {
                if (eliminado) return;

                grupoModelo.clear();

                const modelo = gltf.scene;

                modelo.name = 'MODELO_CARRITO_GLTF';

                modelo.traverse((objeto) => {
                    if (objeto.isMesh) {
                        objeto.castShadow = false;
                        objeto.receiveShadow = false;
                    }
                });

                centrarModelo(modelo);

                grupoModelo.add(modelo);

                cargado = true;
            },

            undefined,

            (error) => {
                console.warn(
                    'No se pudo cargar el carrito. Se utilizará el modelo provisional.',
                    error
                );

                if (!eliminado) {
                    crearModeloProvisional();
                }
            }
        );
    }

    function obtenerObjetoProducto(entrada) {
        if (!entrada) return null;

        if (entrada.isObject3D) {
            return entrada;
        }

        if (entrada.objeto?.isObject3D) {
            return entrada.objeto;
        }

        if (entrada.modelo?.isObject3D) {
            return entrada.modelo;
        }

        return null;
    }

    function calcularPosicionProducto(indice) {
        const columna = indice % 3;
        const fila = Math.floor(indice / 3);

        const x = -0.21 + columna * 0.21;
        const z = -0.15 + fila * 0.18;
        const y = 0.72 + fila * 0.025;

        return new THREE.Vector3(x, y, z);
    }

    function agregarProducto(entrada) {
        if (eliminado) return null;

        const objeto = obtenerObjetoProducto(entrada);

        if (!objeto) {
            console.warn('El producto no contiene un objeto THREE.Object3D.');
            return null;
        }

        if (inventario.length >= config.capacidad) {
            console.warn('El carrito alcanzó su capacidad máxima.');
            return null;
        }

        const idUnidad =
            objeto.userData.idUnidadProducto ||
            objeto.uuid;

        const duplicado = inventario.some(
            (producto) => producto.idUnidad === idUnidad
        );

        if (duplicado) return null;

        // Actualizar matrices antes de calcular coordenadas.
        scene.updateMatrixWorld(true);

        const cajaOriginal = new THREE.Box3().setFromObject(objeto);

        if (cajaOriginal.isEmpty()) return null;

        const dimensiones = cajaOriginal.getSize(
            new THREE.Vector3()
        );

        const dimensionMayor = Math.max(
            dimensiones.x,
            dimensiones.y,
            dimensiones.z,
            0.001
        );

        const escalaOriginal = objeto.scale.clone();

        const posicionOriginal = objeto.position.clone();
        const rotacionOriginal = objeto.rotation.clone();

        // Pasar el objeto al carrito conservando su transformación mundial.
        objetosEnCesta.attach(objeto);

        // Calcular el centro en coordenadas LOCALES de la cesta.
        objetosEnCesta.updateMatrixWorld(true);

        const cajaDespues = new THREE.Box3().setFromObject(objeto);

        const centroMundo = cajaDespues.getCenter(
            new THREE.Vector3()
        );

        const centroLocal = objetosEnCesta.worldToLocal(
            centroMundo.clone()
        );

        // Ajustar el tamaño para que los productos sean visibles.
        const escalaProducto = Math.min(
            1,
            0.30 / dimensionMayor
        );

        objeto.scale.multiplyScalar(escalaProducto);

        objeto.updateMatrixWorld(true);
        objetosEnCesta.updateMatrixWorld(true);

        const cajaAjustada = new THREE.Box3().setFromObject(objeto);

        const centroAjustadoMundo = cajaAjustada.getCenter(
            new THREE.Vector3()
        );

        const centroAjustadoLocal = objetosEnCesta.worldToLocal(
            centroAjustadoMundo.clone()
        );

        // Colocar el producto en una posición local de la cesta.
        const destino = calcularPosicionProducto(inventario.length);

        objeto.position.add(
            destino.clone().sub(centroAjustadoLocal)
        );

        objeto.updateMatrixWorld(true);

        objeto.userData.enCarrito = true;
        objeto.userData.recogido = true;
        objeto.userData.disponible = false;

        const registro = {
            id: objeto.uuid,
            idUnidad,
            nombre:
                entrada.nombre ||
                objeto.userData.nombre ||
                objeto.name ||
                'Producto',

            codigo:
                entrada.codigo ||
                objeto.userData.codigo ||
                '',

            precio:
                Number(
                    entrada.precio ??
                    objeto.userData.precio ??
                    0
                ),

            objeto,

            posicionOriginal,
            rotacionOriginal,
            escalaOriginal
        };

        inventario.push(registro);

        return registro;
    }

    function seguirObjetivo(objeto, distancia = config.distancia) {
        if (!objeto || eliminado) return;

        objetivo = objeto;
        config.distancia = distancia;
    }

    function dejarDeSeguir() {
        objetivo = null;
    }

    function actualizar(delta = 0.016) {
        if (eliminado) return;

        if (!objetivo) return;

        if (objetivo.eliminado) {
            objetivo = null;
            return;
        }

        if (objetivo.isObject3D !== true) {
            objetivo = null;
            return;
        }

        const direccion = new THREE.Vector3(0, 0, 1);

        direccion.applyQuaternion(objetivo.quaternion);

        const posicionObjetivo = objetivo.position.clone();

        vectorObjetivo.copy(posicionObjetivo);

        vectorObjetivo.add(
            direccion.multiplyScalar(config.distancia)
        );

        vectorObjetivo.y = config.posicion.y;

        const factor = 1 - Math.exp(
            -config.suavizado * Math.max(0, delta)
        );

        grupo.position.lerp(vectorObjetivo, factor);

        const direccionMirada = new THREE.Vector3()
            .subVectors(posicionObjetivo, grupo.position);

        direccionMirada.y = 0;

        if (direccionMirada.lengthSq() > 0.0001) {
            const angulo = Math.atan2(
                direccionMirada.x,
                direccionMirada.z
            );

            const rotacionObjetivo = new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 1, 0),
                angulo
            );

            grupo.quaternion.slerp(rotacionObjetivo, factor);
        }
    }

    function establecerPosicion(posicion) {
        if (!posicion) return;

        grupo.position.set(
            posicion.x ?? grupo.position.x,
            posicion.y ?? grupo.position.y,
            posicion.z ?? grupo.position.z
        );
    }

    function establecerRotacion(rotacion) {
        if (!rotacion) return;

        grupo.rotation.set(
            rotacion.x ?? grupo.rotation.x,
            rotacion.y ?? grupo.rotation.y,
            rotacion.z ?? grupo.rotation.z
        );
    }

    function obtenerProductos() {
        return inventario.map((producto) => ({
            id: producto.id,
            nombre: producto.nombre,
            codigo: producto.codigo,
            precio: producto.precio,
            objeto: producto.objeto
        }));
    }

    function obtenerTotal() {
        return inventario.reduce(
            (total, producto) => total + producto.precio,
            0
        );
    }

    function obtenerCantidad() {
        return inventario.length;
    }

    function devolverProducto(id) {
        const indice = inventario.findIndex(
            (producto) =>
                producto.id === id ||
                producto.idUnidad === id
        );

        if (indice === -1) return false;

        const registro = inventario[indice];
        const objeto = registro.objeto;

        if (!objeto) return false;

        const contenedorProductos = scene.getObjectByName(
            'PRODUCTOS_SUPERMERCADO'
        );

        if (contenedorProductos) {
            contenedorProductos.attach(objeto);
        } else {
            scene.attach(objeto);
        }

        objeto.position.copy(registro.posicionOriginal);
        objeto.rotation.copy(registro.rotacionOriginal);
        objeto.scale.copy(registro.escalaOriginal);

        objeto.userData.enCarrito = false;
        objeto.userData.recogido = false;
        objeto.userData.disponible = true;

        inventario.splice(indice, 1);

        return true;
    }

    function vaciarInventario() {
        while (inventario.length > 0) {
            devolverProducto(inventario[inventario.length - 1].id);
        }
    }

    function confirmarVenta() {
        const resumen = {
            cantidad: inventario.length,
            total: obtenerTotal(),
            productos: obtenerProductos()
        };

        for (const registro of inventario) {
            if (registro.objeto) {
                registro.objeto.userData.vendido = true;
                registro.objeto.userData.enCarrito = false;
                registro.objeto.userData.disponible = false;
            }
        }

        return resumen;
    }

    function eliminar() {
        if (eliminado) return;

        eliminado = true;
        objetivo = null;

        grupo.removeFromParent();

        grupo.traverse((objeto) => {
            if (!objeto.isMesh) return;

            objeto.geometry?.dispose();

            if (Array.isArray(objeto.material)) {
                objeto.material.forEach((material) => material.dispose());
            } else {
                objeto.material?.dispose();
            }
        });

        inventario.length = 0;
    }

    cargarModelo();

    const api = {
        grupo,

        seguirObjetivo,
        dejarDeSeguir,

        actualizar,
        establecerPosicion,
        establecerRotacion,

        agregarProducto,

        obtenerProductos,
        obtenerTotal,
        obtenerCantidad,

        devolverProducto,
        vaciarInventario,
        confirmarVenta,

        eliminar,

        get cargado() {
            return cargado;
        },

        get objetivo() {
            return objetivo;
        },

        get eliminado() {
            return eliminado;
        },

        get inventario() {
            return inventario;
        }
    };

    return api;
}
