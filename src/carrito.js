
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// CARRITO DE SUPERMERCADO
// Three.js 0.180+
// ============================================================

const loader = new GLTFLoader();

const CONFIG_DEFAULT = {
    modelo: '/modelos/carrito.glb',

    posicion: { x: 0, y: 0, z: 0 },

    escala: 1,

    distancia: 1.15,
    suavizado: 6,

    velocidadMaxima: 5,

    // Ajuste de orientación del GLB.
    correccionModelo: Math.PI,

    // El cliente queda detrás del manubrio.
    alturaManubrio: 0.9,

    alturaCesta: 0.75,

    cargarModelo: true
};

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

export function crearCarrito(scene, opciones = {}) {
    if (!scene?.isScene && !scene?.isObject3D) {
        throw new Error(
            'crearCarrito necesita una escena THREE.Scene válida.'
        );
    }

    const config = {
        ...CONFIG_DEFAULT,
        ...opciones,

        posicion: {
            ...CONFIG_DEFAULT.posicion,
            ...(opciones.posicion ?? {})
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
    objetosEnCesta.name = 'PRODUCTOS_EN_CARRITO';

    grupo.add(objetosEnCesta);

    const estado = {
        eliminado: false,
        cargado: false,
        siguiendo: false,
        objetivo: null,

        distancia: config.distancia,

        productos: [],

        velocidadActual: new THREE.Vector3(),

        ultimaPosicionObjetivo: new THREE.Vector3(),

        temporizador: 0
    };

    // ========================================================
    // MATERIALES DEL CARRITO DE RESPALDO
    // ========================================================

    const materiales = {
        metal: new THREE.MeshStandardMaterial({
            color: 0x9da8ae,
            metalness: 0.82,
            roughness: 0.3
        }),

        metalOscuro: new THREE.MeshStandardMaterial({
            color: 0x424c52,
            metalness: 0.75,
            roughness: 0.35
        }),

        plastico: new THREE.MeshStandardMaterial({
            color: 0x263b43,
            metalness: 0.05,
            roughness: 0.65
        }),

        goma: new THREE.MeshStandardMaterial({
            color: 0x17191b,
            roughness: 0.9
        }),

        detalle: new THREE.MeshStandardMaterial({
            color: 0xd5dce0,
            metalness: 0.8,
            roughness: 0.25
        })
    };

    // ========================================================
    // UTILIDADES
    // ========================================================

    function crearCaja(
        padre,
        nombre,
        ancho,
        alto,
        profundidad,
        posicion,
        material
    ) {
        const geometria = new THREE.BoxGeometry(
            ancho,
            alto,
            profundidad
        );

        const mesh = new THREE.Mesh(
            geometria,
            material
        );

        mesh.name = nombre;
        mesh.position.set(
            posicion.x,
            posicion.y,
            posicion.z
        );

        mesh.castShadow = false;
        mesh.receiveShadow = false;

        padre.add(mesh);

        return mesh;
    }

    function crearBarra(
        padre,
        nombre,
        inicio,
        final,
        radio,
        material
    ) {
        const a = new THREE.Vector3(
            inicio.x,
            inicio.y,
            inicio.z
        );

        const b = new THREE.Vector3(
            final.x,
            final.y,
            final.z
        );

        const direccion = new THREE.Vector3()
            .subVectors(b, a);

        const longitud = direccion.length();

        const geometria = new THREE.CylinderGeometry(
            radio,
            radio,
            longitud,
            8
        );

        const mesh = new THREE.Mesh(
            geometria,
            material
        );

        mesh.name = nombre;

        mesh.position.copy(a).add(b).multiplyScalar(0.5);

        mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direccion.normalize()
        );

        padre.add(mesh);

        return mesh;
    }

    // ========================================================
    // CARRITO DE RESPALDO
    // ========================================================

    function crearModeloRespaldo() {
        const modelo = new THREE.Group();
        modelo.name = 'CARRITO_RESPALDO';

        // El frente del carrito apunta hacia +Z.
        // El manubrio queda hacia -Z, lado del cliente
        // después de aplicar la corrección de 180 grados.

        const ancho = 0.82;
        const largo = 1.05;

        // Base inferior.
        crearCaja(
            modelo,
            'Base_inferior',
            ancho,
            0.07,
            largo,
            { x: 0, y: 0.53, z: 0.05 },
            materiales.metalOscuro
        );

        // Cesta: cuatro bordes superiores.
        const yInferior = 0.65;
        const ySuperior = 1.22;

        const zFrontal = 0.52;
        const zTrasero = -0.45;

        const xIzquierdo = -0.4;
        const xDerecho = 0.4;

        // Estructura superior.
        crearBarra(
            modelo,
            'Borde_superior_izquierdo',
            { x: xIzquierdo, y: ySuperior, z: zTrasero },
            { x: xIzquierdo, y: ySuperior, z: zFrontal },
            0.022,
            materiales.metal
        );

        crearBarra(
            modelo,
            'Borde_superior_derecho',
            { x: xDerecho, y: ySuperior, z: zTrasero },
            { x: xDerecho, y: ySuperior, z: zFrontal },
            0.022,
            materiales.metal
        );

        crearBarra(
            modelo,
            'Borde_superior_frontal',
            { x: xIzquierdo, y: ySuperior, z: zFrontal },
            { x: xDerecho, y: ySuperior, z: zFrontal },
            0.022,
            materiales.metal
        );

        crearBarra(
            modelo,
            'Borde_superior_trasero',
            { x: xIzquierdo, y: ySuperior, z: zTrasero },
            { x: xDerecho, y: ySuperior, z: zTrasero },
            0.022,
            materiales.metal
        );

        // Cuatro postes de la cesta.
        for (const x of [xIzquierdo, xDerecho]) {
            for (const z of [zTrasero, zFrontal]) {
                crearBarra(
                    modelo,
                    'Poste_cesta',
                    { x, y: yInferior, z },
                    { x, y: ySuperior, z },
                    0.018,
                    materiales.metal
                );
            }
        }

        // Barras horizontales de la cesta.
        for (let i = 1; i <= 5; i++) {
            const y = yInferior + i * 0.085;

            crearBarra(
                modelo,
                'Rejilla_lateral_izquierda',
                { x: xIzquierdo, y, z: zTrasero },
                { x: xIzquierdo, y, z: zFrontal },
                0.012,
                materiales.metal
            );

            crearBarra(
                modelo,
                'Rejilla_lateral_derecha',
                { x: xDerecho, y, z: zTrasero },
                { x: xDerecho, y, z: zFrontal },
                0.012,
                materiales.metal
            );

            crearBarra(
                modelo,
                'Rejilla_frontal',
                { x: xIzquierdo, y, z: zFrontal },
                { x: xDerecho, y, z: zFrontal },
                0.012,
                materiales.metal
            );

            crearBarra(
                modelo,
                'Rejilla_trasera',
                { x: xIzquierdo, y, z: zTrasero },
                { x: xDerecho, y, z: zTrasero },
                0.012,
                materiales.metal
            );
        }

        // Fondo de la cesta.
        for (let i = 0; i <= 7; i++) {
            const x = -0.35 + i * 0.1;

            crearBarra(
                modelo,
                'Rejilla_fondo',
                { x, y: 0.62, z: zTrasero },
                { x, y: 0.62, z: zFrontal },
                0.012,
                materiales.metal
            );
        }

        // Chasis inferior.
        crearBarra(
            modelo,
            'Chasis_izquierdo',
            { x: -0.34, y: 0.45, z: -0.45 },
            { x: -0.34, y: 0.45, z: 0.55 },
            0.035,
            materiales.metalOscuro
        );

        crearBarra(
            modelo,
            'Chasis_derecho',
            { x: 0.34, y: 0.45, z: -0.45 },
            { x: 0.34, y: 0.45, z: 0.55 },
            0.035,
            materiales.metalOscuro
        );

        // Ruedas.
        const posicionesRuedas = [
            [-0.36, 0.18, -0.42],
            [0.36, 0.18, -0.42],
            [-0.36, 0.18, 0.48],
            [0.36, 0.18, 0.48]
        ];

        for (const [x, y, z] of posicionesRuedas) {
            const rueda = new THREE.Mesh(
                new THREE.CylinderGeometry(
                    0.105,
                    0.105,
                    0.055,
                    16
                ),
                materiales.goma
            );

            rueda.name = 'Rueda';
            rueda.rotation.z = Math.PI / 2;
            rueda.position.set(x, y, z);

            modelo.add(rueda);

            const centro = new THREE.Mesh(
                new THREE.CylinderGeometry(
                    0.035,
                    0.035,
                    0.06,
                    12
                ),
                materiales.detalle
            );

            centro.rotation.z = Math.PI / 2;
            centro.position.set(x, y, z);
            modelo.add(centro);
        }

        // Soportes del manubrio.
        crearBarra(
            modelo,
            'Soporte_manubrio_izquierdo',
            { x: -0.31, y: 0.48, z: -0.4 },
            { x: -0.31, y: 1.02, z: -0.75 },
            0.035,
            materiales.metalOscuro
        );

        crearBarra(
            modelo,
            'Soporte_manubrio_derecho',
            { x: 0.31, y: 0.48, z: -0.4 },
            { x: 0.31, y: 1.02, z: -0.75 },
            0.035,
            materiales.metalOscuro
        );

        crearBarra(
            modelo,
            'Manubrio',
            { x: -0.38, y: 1.02, z: -0.75 },
            { x: 0.38, y: 1.02, z: -0.75 },
            0.055,
            materiales.plastico
        );

        // Mango central.
        crearCaja(
            modelo,
            'Agarre_manubrio',
            0.56,
            0.08,
            0.09,
            { x: 0, y: 1.02, z: -0.75 },
            materiales.plastico
        );

        return modelo;
    }

    // ========================================================
    // CARGAR MODELO GLB
    // ========================================================

    function cargarModelo() {
        if (!config.cargarModelo) {
            grupoModelo.add(crearModeloRespaldo());
            estado.cargado = true;
            return;
        }

        loader.load(
            config.modelo,

            gltf => {
                if (estado.eliminado) {
                    liberarModelo(gltf.scene);
                    return;
                }

                const modelo = gltf.scene;

                modelo.name = 'CARRITO_GLB';

                modelo.traverse(objeto => {
                    if (!objeto.isMesh) return;

                    objeto.castShadow = false;
                    objeto.receiveShadow = false;

                    if (objeto.material) {
                        objeto.material.side = THREE.DoubleSide;
                    }
                });

                // Centrar el modelo sin cambiar su orientación.
                const caja = new THREE.Box3().setFromObject(modelo);

                if (!caja.isEmpty()) {
                    const centro = caja.getCenter(new THREE.Vector3());

                    modelo.position.x -= centro.x;
                    modelo.position.z -= centro.z;
                    modelo.position.y -= caja.min.y;
                }

                const cajaFinal = new THREE.Box3().setFromObject(modelo);
                const tamano = cajaFinal.getSize(new THREE.Vector3());

                const altura = tamano.y || 1;

                // Normalizar la altura visual del carrito.
                const escalaNormalizada = 1.25 / altura;

                modelo.scale.multiplyScalar(escalaNormalizada);

                // Corrección de orientación independiente.
                modelo.rotation.y = config.correccionModelo;

                grupoModelo.add(modelo);

                estado.cargado = true;

                console.info(
                    '[CARRITO] Modelo GLB cargado correctamente.'
                );
            },

            undefined,

            error => {
                if (estado.eliminado) return;

                console.warn(
                    '[CARRITO] No se pudo cargar el GLB. Se utilizará el carrito de respaldo.',
                    error
                );

                grupoModelo.add(crearModeloRespaldo());

                grupoModelo.rotation.y = config.correccionModelo;

                estado.cargado = true;
            }
        );
    }

    function liberarModelo(objeto) {
        objeto.traverse(hijo => {
            if (!hijo.isMesh) return;

            hijo.geometry?.dispose?.();

            if (Array.isArray(hijo.material)) {
                hijo.material.forEach(material => material.dispose?.());
            } else {
                hijo.material?.dispose?.();
            }
        });
    }

    cargarModelo();

    // ========================================================
    // SEGUIR AL CLIENTE
    // ========================================================

    function seguirObjetivo(objetivo, distancia = config.distancia) {
        if (estado.eliminado) return false;

        const grupoObjetivo = objetivo?.isObject3D
            ? objetivo
            : objetivo?.grupo;

        if (!grupoObjetivo?.isObject3D) {
            console.warn(
                '[CARRITO] El objetivo no es un Object3D válido.'
            );
            return false;
        }

        estado.objetivo = grupoObjetivo;
        estado.distancia = Math.max(0.5, distancia);
        estado.siguiendo = true;

        return true;
    }

    function detenerSeguimiento() {
        estado.siguiendo = false;
        estado.objetivo = null;
    }

    // ========================================================
    // ACTUALIZAR POSICIÓN Y ORIENTACIÓN
    // ========================================================

    const posicionObjetivo = new THREE.Vector3();
    const posicionActual = new THREE.Vector3();
    const direccion = new THREE.Vector3();
    const posicionDeseada = new THREE.Vector3();

    function actualizar(delta) {
        if (estado.eliminado || !estado.siguiendo || !estado.objetivo) {
            return;
        }

        const dt = Math.min(Math.max(delta || 0, 0), 0.05);

        estado.objetivo.getWorldPosition(posicionObjetivo);
        grupo.getWorldPosition(posicionActual);

        // El carrito se coloca detrás del cliente.
        direccion.set(0, 0, 1);

        estado.objetivo.getWorldDirection(direccion);

        direccion.y = 0;

        if (direccion.lengthSq() < 0.0001) {
            direccion.set(0, 0, 1);
        }

        direccion.normalize();

        posicionDeseada.copy(posicionObjetivo);

        posicionDeseada.addScaledVector(
            direccion,
            -estado.distancia
        );

        posicionDeseada.y = config.posicion.y;

        const diferencia = new THREE.Vector3()
            .subVectors(posicionDeseada, posicionActual);

        const distanciaActual = diferencia.length();

        if (distanciaActual > 0.02) {
            const velocidad = Math.min(
                config.velocidadMaxima,
                distanciaActual * config.suavizado
            );

            const desplazamiento = Math.min(
                distanciaActual,
                velocidad * dt
            );

            diferencia.normalize();

            grupo.position.addScaledVector(
                diferencia,
                desplazamiento
            );
        }

        // El manubrio apunta hacia el cliente.
        const haciaCliente = new THREE.Vector3()
            .subVectors(posicionObjetivo, posicionActual);

        haciaCliente.y = 0;

        if (haciaCliente.lengthSq() > 0.0001) {
            const angulo = Math.atan2(
                haciaCliente.x,
                haciaCliente.z
            );

            grupo.rotation.y = angulo;
        }
    }

    // ========================================================
    // INVENTARIO
    // ========================================================

    function agregarProducto(objeto, opcionesProducto = {}) {
        if (estado.eliminado || !objeto?.isObject3D) {
            return false;
        }

        if (estado.productos.some(p => p.objeto === objeto)) {
            return false;
        }

        const padreOriginal = objeto.parent;

        if (!padreOriginal) {
            console.warn(
                '[CARRITO] El producto no tiene un padre original.'
            );
            return false;
        }

        const posicionMundial = objeto.getWorldPosition(
            new THREE.Vector3()
        );

        const quaternionMundial = objeto.getWorldQuaternion(
            new THREE.Quaternion()
        );

        const escalaMundial = objeto.getWorldScale(
            new THREE.Vector3()
        );

        const registro = {
            objeto,
            padreOriginal,

            posicionMundial,
            quaternionMundial,
            escalaMundial,

            nombre: opcionesProducto.nombre ?? objeto.name,
            cantidad: opcionesProducto.cantidad ?? 1,

            precio: opcionesProducto.precio ?? 0
        };

        // Reparentar conservando transformaciones mundiales.
        objetosEnCesta.attach(objeto);

        objeto.position.set(
            (Math.random() - 0.5) * 0.35,
            0.76 + estado.productos.length * 0.08,
            (Math.random() - 0.5) * 0.45
        );

        objeto.rotation.set(
            0,
            Math.random() * Math.PI * 2,
            0
        );

        objeto.scale.multiplyScalar(
            Math.min(
                1,
                0.65 / Math.max(
                    objeto.getWorldScale(new THREE.Vector3()).y,
                    0.01
                )
            )
        );

        estado.productos.push(registro);

        return true;
    }

    function devolverProducto(objeto) {
        const indice = estado.productos.findIndex(
            producto => producto.objeto === objeto
        );

        if (indice === -1) return false;

        const registro = estado.productos[indice];

        if (!registro.padreOriginal) return false;

        // Volver a colocar el producto en su ubicación mundial.
        registro.padreOriginal.attach(registro.objeto);

        registro.objeto.position.copy(
            registro.padreOriginal.worldToLocal(
                registro.posicionMundial.clone()
            )
        );

        const quaternionPadre = registro.padreOriginal
            .getWorldQuaternion(new THREE.Quaternion())
            .invert();

        registro.objeto.quaternion
            .copy(quaternionPadre)
            .multiply(registro.quaternionMundial);

        const escalaPadre = registro.padreOriginal.getWorldScale(
            new THREE.Vector3()
        );

        registro.objeto.scale.set(
            registro.escalaMundial.x / (escalaPadre.x || 1),
            registro.escalaMundial.y / (escalaPadre.y || 1),
            registro.escalaMundial.z / (escalaPadre.z || 1)
        );

        estado.productos.splice(indice, 1);

        return true;
    }

    function vaciarInventario() {
        for (let i = estado.productos.length - 1; i >= 0; i--) {
            devolverProducto(estado.productos[i].objeto);
        }
    }

    function confirmarVenta() {
        const productos = estado.productos.map(registro => ({
            nombre: registro.nombre,
            cantidad: registro.cantidad,
            precio: registro.precio,
            objeto: registro.objeto
        }));

        estado.productos.length = 0;

        for (const producto of productos) {
            producto.objeto?.parent?.remove(producto.objeto);
        }

        return productos;
    }

    function obtenerProductos() {
        return estado.productos.map(registro => ({
            nombre: registro.nombre,
            cantidad: registro.cantidad,
            precio: registro.precio,
            objeto: registro.objeto
        }));
    }

    function obtenerTotal() {
        return estado.productos.reduce(
            (total, registro) =>
                total + registro.precio * registro.cantidad,
            0
        );
    }

    // ========================================================
    // ELIMINAR CARRITO
    // ========================================================

    function eliminar() {
        if (estado.eliminado) return;

        estado.eliminado = true;
        estado.siguiendo = false;
        estado.objetivo = null;

        // Los productos vuelven a sus posiciones originales.
        vaciarInventario();

        scene.remove(grupo);

        // No se destruyen las geometrías ni materiales de productos.
        grupoModelo.traverse(objeto => {
            if (!objeto.isMesh) return;

            objeto.geometry?.dispose?.();

            if (Array.isArray(objeto.material)) {
                objeto.material.forEach(m => m.dispose?.());
            } else {
                objeto.material?.dispose?.();
            }
        });

        for (const material of Object.values(materiales)) {
            material.dispose();
        }

        objetosEnCesta.clear();
        grupoModelo.clear();
        grupo.clear();
    }

    // ========================================================
    // API PÚBLICA
    // ========================================================

    const api = {
        grupo,
        grupoModelo,
        objetosEnCesta,

        actualizar,

        seguirObjetivo,
        detenerSeguimiento,

        agregarProducto,
        devolverProducto,
        vaciarInventario,
        confirmarVenta,

        obtenerProductos,
        obtenerTotal,

        eliminar,

        get eliminado() {
            return estado.eliminado;
        },

        get siguiendo() {
            return estado.siguiendo;
        },

        get cantidadProductos() {
            return estado.productos.length;
        },

        get cargado() {
            return estado.cargado;
        }
    };

    return api;
}
