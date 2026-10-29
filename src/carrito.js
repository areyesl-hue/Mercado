
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function crearCarrito(scene, opciones = {}) {
    if (!scene || !scene.isScene) {
        throw new Error(
            'crearCarrito necesita una escena THREE.Scene.'
        );
    }

    const config = {
        modelo: '/modelos/carrito.glb',
        distancia: 0.95,
        suavizado: 8,
        correccionModelo: 0,
        escala: 1,
        altura: 0,
        ...opciones
    };

    const grupo = new THREE.Group();
    grupo.name = 'CARRITO_SUPERMERCADO';
    scene.add(grupo);

    // Los productos se añaden al grupo exterior.
    // El modelo del carrito mantiene sus transformaciones por separado.
    const contenedorModelo = new THREE.Group();
    contenedorModelo.name = 'MODELO_CARRITO';
    contenedorModelo.rotation.y = config.correccionModelo;
    contenedorModelo.scale.setScalar(config.escala);
    grupo.add(contenedorModelo);

    const loader = new GLTFLoader();

    let modeloCargado = false;
    let eliminado = false;
    let objetivo = null;
    let distanciaSeguimiento = config.distancia;

    const posicionDeseada = new THREE.Vector3();
    const posicionTemporal = new THREE.Vector3();
    const quaternionTemporal = new THREE.Quaternion();

    // --------------------------------------------------
    // CARRITO PROVISIONAL
    // Visible mientras carga el modelo GLB o si falla.
    // --------------------------------------------------

    const provisional = new THREE.Group();
    provisional.name = 'CARRITO_PROVISIONAL';
    contenedorModelo.add(provisional);

    const metal = new THREE.MeshStandardMaterial({
        color: 0x9ca3af,
        metalness: 0.75,
        roughness: 0.32
    });

    const metalOscuro = new THREE.MeshStandardMaterial({
        color: 0x4b5563,
        metalness: 0.65,
        roughness: 0.4
    });

    const plastico = new THREE.MeshStandardMaterial({
        color: 0x2563eb,
        roughness: 0.55
    });

    const ruedaMaterial = new THREE.MeshStandardMaterial({
        color: 0x202124,
        roughness: 0.8
    });

    function agregarBarra(
        nombre,
        ancho,
        alto,
        fondo,
        x,
        y,
        z,
        material = metal
    ) {
        const barra = new THREE.Mesh(
            new THREE.BoxGeometry(ancho, alto, fondo),
            material
        );

        barra.name = nombre;
        barra.position.set(x, y, z);
        barra.castShadow = true;
        barra.receiveShadow = true;

        provisional.add(barra);
        return barra;
    }

    // --------------------------------------------------
    // CESTA ABIERTA
    // La cesta no utiliza una caja sólida que tape la compra.
    // --------------------------------------------------

    const anchoCesta = 0.85;
    const fondoCesta = 0.90;
    const alturaPared = 0.40;

    const yFondo = 0.57;
    const yCentroPared = 0.78;
    const zCentroCesta = 0.12;

    // Fondo de la cesta.
    agregarBarra(
        'FONDO_CESTA',
        0.79,
        0.035,
        0.84,
        0,
        yFondo,
        zCentroCesta,
        metalOscuro
    );

    // Varillas del fondo para dar apariencia de cesta metálica.
    for (let i = 0; i < 7; i++) {
        const x = -0.32 + i * 0.107;

        agregarBarra(
            `VARILLA_FONDO_X_${i}`,
            0.018,
            0.018,
            0.82,
            x,
            yFondo + 0.025,
            zCentroCesta,
            metal
        );
    }

    for (let i = 0; i < 7; i++) {
        const z = zCentroCesta - 0.34 + i * 0.113;

        agregarBarra(
            `VARILLA_FONDO_Z_${i}`,
            0.76,
            0.018,
            0.018,
            0,
            yFondo + 0.028,
            z,
            metal
        );
    }

    // Cuatro bordes superiores.
    agregarBarra(
        'BORDE_SUPERIOR_IZQUIERDO',
        0.035,
        0.035,
        fondoCesta,
        -anchoCesta / 2,
        yCentroPared + alturaPared / 2,
        zCentroCesta
    );

    agregarBarra(
        'BORDE_SUPERIOR_DERECHO',
        0.035,
        0.035,
        fondoCesta,
        anchoCesta / 2,
        yCentroPared + alturaPared / 2,
        zCentroCesta
    );

    agregarBarra(
        'BORDE_SUPERIOR_FRONTAL',
        anchoCesta,
        0.035,
        0.035,
        0,
        yCentroPared + alturaPared / 2,
        zCentroCesta + fondoCesta / 2
    );

    agregarBarra(
        'BORDE_SUPERIOR_TRASERO',
        anchoCesta,
        0.035,
        0.035,
        0,
        yCentroPared + alturaPared / 2,
        zCentroCesta - fondoCesta / 2
    );

    // Varillas horizontales de las paredes laterales.
    for (let nivel = 0; nivel < 5; nivel++) {
        const y = yFondo + 0.08 + nivel * 0.075;

        for (const x of [-0.405, 0.405]) {
            agregarBarra(
                `VARILLA_LATERAL_${x}_${nivel}`,
                0.018,
                0.018,
                0.86,
                x,
                y,
                zCentroCesta,
                metal
            );
        }
    }

    // Varillas horizontales de las paredes frontal y trasera.
    for (let nivel = 0; nivel < 5; nivel++) {
        const y = yFondo + 0.08 + nivel * 0.075;

        for (const z of [
            zCentroCesta - fondoCesta / 2,
            zCentroCesta + fondoCesta / 2
        ]) {
            agregarBarra(
                `VARILLA_PARED_${z}_${nivel}`,
                0.79,
                0.018,
                0.018,
                0,
                y,
                z,
                metal
            );
        }
    }

    // Varillas verticales en las cuatro paredes.
    for (let i = 0; i < 8; i++) {
        const x = -0.36 + i * 0.103;

        for (const z of [
            zCentroCesta - fondoCesta / 2,
            zCentroCesta + fondoCesta / 2
        ]) {
            agregarBarra(
                `VARILLA_VERTICAL_FRONTAL_${i}_${z}`,
                0.018,
                alturaPared,
                0.018,
                x,
                yCentroPared,
                z
            );
        }
    }

    for (let i = 0; i < 8; i++) {
        const z = zCentroCesta - 0.37 + i * 0.106;

        for (const x of [-0.405, 0.405]) {
            agregarBarra(
                `VARILLA_VERTICAL_LATERAL_${i}_${x}`,
                0.018,
                alturaPared,
                0.018,
                x,
                yCentroPared,
                z
            );
        }
    }

    // --------------------------------------------------
    // BASE INFERIOR
    // --------------------------------------------------

    agregarBarra(
        'BASE_INFERIOR',
        0.72,
        0.07,
        0.78,
        0,
        0.34,
        0.08,
        metalOscuro
    );

    // --------------------------------------------------
    // MANUBRIO Y SOPORTES
    // El manubrio queda detrás, hacia -Z.
    // --------------------------------------------------

    agregarBarra(
        'MANUBRIO',
        0.72,
        0.065,
        0.065,
        0,
        1.02,
        -0.55,
        plastico
    );

    for (const x of [-0.29, 0.29]) {
        const soporte = new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.018,
                0.018,
                0.43,
                8
            ),
            metalOscuro
        );

        soporte.name = 'SOPORTE_MANUBRIO';
        soporte.position.set(x, 0.76, -0.43);
        soporte.rotation.x = -0.25;
        soporte.castShadow = true;

        provisional.add(soporte);
    }

    // --------------------------------------------------
    // RUEDAS
    // --------------------------------------------------

    for (const x of [-0.37, 0.37]) {
        for (const z of [-0.43, 0.48]) {
            const rueda = new THREE.Mesh(
                new THREE.CylinderGeometry(
                    0.09,
                    0.09,
                    0.055,
                    16
                ),
                ruedaMaterial
            );

            rueda.name = 'RUEDA_CARRITO';
            rueda.rotation.z = Math.PI / 2;
            rueda.position.set(x, 0.14, z);
            rueda.castShadow = true;
            rueda.receiveShadow = true;

            provisional.add(rueda);
        }
    }

    // --------------------------------------------------
    // CARGA DEL MODELO GLB
    // --------------------------------------------------

    loader.load(
        config.modelo,
        (gltf) => {
            if (eliminado) return;

            const modelo = gltf.scene;
            modelo.name = 'CARRITO_MODELO_GLB';

            modelo.traverse((objeto3D) => {
                if (!objeto3D.isMesh) return;

                objeto3D.castShadow = true;
                objeto3D.receiveShadow = true;

                const materiales = Array.isArray(objeto3D.material)
                    ? objeto3D.material
                    : [objeto3D.material];

                materiales.forEach((material) => {
                    if (material) {
                        material.side = THREE.DoubleSide;
                        material.needsUpdate = true;
                    }
                });
            });

            // Ajustar el origen del modelo a la base.
            // La escala general la aplica contenedorModelo.
            modelo.updateMatrixWorld(true);

            const cajaInicial = new THREE.Box3().setFromObject(modelo);

            if (!cajaInicial.isEmpty()) {
                const centro = cajaInicial.getCenter(
                    new THREE.Vector3()
                );

                modelo.position.x -= centro.x;
                modelo.position.z -= centro.z;
                modelo.position.y -= cajaInicial.min.y;
            }

            contenedorModelo.add(modelo);

            provisional.visible = false;
            modeloCargado = true;

            console.info(
                'Carrito GLB cargado correctamente:',
                config.modelo
            );
        },
        undefined,
        (error) => {
            if (eliminado) return;

            provisional.visible = true;

            console.error(
                `No se pudo cargar ${config.modelo}. ` +
                'Se utilizará el carrito provisional.',
                error
            );
        }
    );

    // --------------------------------------------------
    // SEGUIR AL CLIENTE
    // --------------------------------------------------

    function calcularPosicionDeseada() {
        if (!objetivo) return false;

        objetivo.updateWorldMatrix(true, false);

        // El cliente avanza mirando hacia su eje local +Z.
        // El carrito se coloca delante de su posición.
        posicionTemporal.set(
            0,
            0,
            distanciaSeguimiento
        );

        objetivo.localToWorld(posicionTemporal);

        posicionDeseada.copy(posicionTemporal);
        posicionDeseada.y = config.altura;

        objetivo.getWorldQuaternion(quaternionTemporal);

        return true;
    }

    function seguirObjetivo(
        objeto,
        distancia = config.distancia
    ) {
        if (!objeto || !objeto.isObject3D) {
            console.warn(
                'seguirObjetivo necesita un objeto 3D válido.'
            );
            return;
        }

        objetivo = objeto;

        if (Number.isFinite(distancia)) {
            distanciaSeguimiento = Math.max(0, distancia);
        }

        if (!calcularPosicionDeseada()) return;

        grupo.position.copy(posicionDeseada);
        grupo.quaternion.copy(quaternionTemporal);
    }

    function actualizar(delta) {
        if (
            eliminado ||
            !Number.isFinite(delta) ||
            delta <= 0 ||
            !objetivo
        ) {
            return;
        }

        const dt = Math.min(delta, 0.05);

        if (!calcularPosicionDeseada()) return;

        // Suavizado independiente de la tasa de fotogramas.
        const factor = 1 - Math.exp(
            -Math.max(0, config.suavizado) * dt
        );

        grupo.position.lerp(posicionDeseada, factor);
        grupo.quaternion.slerp(quaternionTemporal, factor);
    }

    // --------------------------------------------------
    // UTILIDADES
    // --------------------------------------------------

    function establecerPosicion(
        x,
        y = config.altura,
        z
    ) {
        if (
            eliminado ||
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            !Number.isFinite(z)
        ) {
            return;
        }

        grupo.position.set(x, y, z);
    }

    function establecerRotacion(rotacionY = 0) {
        if (
            eliminado ||
            !Number.isFinite(rotacionY)
        ) {
            return;
        }

        grupo.rotation.set(0, rotacionY, 0);
    }

    function eliminar() {
        if (eliminado) return;

        eliminado = true;
        objetivo = null;

        scene.remove(grupo);

        // No liberar las geometrías del GLB aquí porque podrían
        // estar compartidas con otros objetos de la escena.
    }

    return {
        grupo,
        seguirObjetivo,
        actualizar,
        establecerPosicion,
        establecerRotacion,
        eliminar,

        get cargado() {
            return modeloCargado;
        },

        get objetivo() {
            return objetivo;
        }
    };
}
