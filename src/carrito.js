
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function crearCarrito(scene, opciones = {}) {
    if (!scene?.isScene) {
        throw new Error('crearCarrito necesita una escena THREE.Scene.');
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

    // ========================================================
    // CARRITO PROVISIONAL
    // ========================================================

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

    // ========================================================
    // CESTA
    // ========================================================

    const fondoCesta = 0.90;
    const alturaPared = 0.40;

    const yFondo = 0.57;
    const yCentroPared = 0.78;
    const zCentroCesta = 0.12;

    agregarBarra(
        'FONDO_CESTA',
        0.79, 0.035, 0.84,
        0, yFondo, zCentroCesta,
        metalOscuro
    );

    for (let i = 0; i < 7; i++) {
        const x = -0.32 + i * 0.107;

        agregarBarra(
            `VARILLA_FONDO_X_${i}`,
            0.018, 0.018, 0.82,
            x, yFondo + 0.025, zCentroCesta,
            metal
        );
    }

    for (let i = 0; i < 7; i++) {
        const z = zCentroCesta - 0.34 + i * 0.113;

        agregarBarra(
            `VARILLA_FONDO_Z_${i}`,
            0.76, 0.018, 0.018,
            0, yFondo + 0.028, z,
            metal
        );
    }

    // Bordes superiores.
    agregarBarra(
        'BORDE_SUPERIOR_IZQUIERDO',
        0.035, 0.035, fondoCesta,
        -0.425, yCentroPared + alturaPared / 2,
        zCentroCesta
    );

    agregarBarra(
        'BORDE_SUPERIOR_DERECHO',
        0.035, 0.035, fondoCesta,
        0.425, yCentroPared + alturaPared / 2,
        zCentroCesta
    );

    agregarBarra(
        'BORDE_SUPERIOR_FRONTAL',
        0.85, 0.035, 0.035,
        0, yCentroPared + alturaPared / 2,
        zCentroCesta + fondoCesta / 2
    );

    agregarBarra(
        'BORDE_SUPERIOR_TRASERO',
        0.85, 0.035, 0.035,
        0, yCentroPared + alturaPared / 2,
        zCentroCesta - fondoCesta / 2
    );

    // Paredes laterales.
    for (let nivel = 0; nivel < 5; nivel++) {
        const y = yFondo + 0.08 + nivel * 0.075;

        for (const x of [-0.405, 0.405]) {
            agregarBarra(
                `VARILLA_LATERAL_${x}_${nivel}`,
                0.018, 0.018, 0.86,
                x, y, zCentroCesta,
                metal
            );
        }
    }

    // Paredes frontal y trasera.
    for (let nivel = 0; nivel < 5; nivel++) {
        const y = yFondo + 0.08 + nivel * 0.075;

        for (const z of [
            zCentroCesta - fondoCesta / 2,
            zCentroCesta + fondoCesta / 2
        ]) {
            agregarBarra(
                `VARILLA_PARED_${z}_${nivel}`,
                0.79, 0.018, 0.018,
                0, y, z,
                metal
            );
        }
    }

    // Varillas verticales.
    for (let i = 0; i < 8; i++) {
        const x = -0.36 + i * 0.103;

        for (const z of [
            zCentroCesta - fondoCesta / 2,
            zCentroCesta + fondoCesta / 2
        ]) {
            agregarBarra(
                `VARILLA_VERTICAL_FRONTAL_${i}_${z}`,
                0.018, alturaPared, 0.018,
                x, yCentroPared, z
            );
        }
    }

    for (let i = 0; i < 8; i++) {
        const z = zCentroCesta - 0.37 + i * 0.106;

        for (const x of [-0.405, 0.405]) {
            agregarBarra(
                `VARILLA_VERTICAL_LATERAL_${i}_${x}`,
                0.018, alturaPared, 0.018,
                x, yCentroPared, z
            );
        }
    }

    // ========================================================
    // BASE
    // ========================================================

    agregarBarra(
        'BASE_INFERIOR',
        0.72, 0.07, 0.78,
        0, 0.34, 0.08,
        metalOscuro
    );

    // ========================================================
    // MANUBRIO
    // ========================================================

    agregarBarra(
        'MANUBRIO',
        0.72, 0.065, 0.065,
        0, 1.02, -0.55,
        plastico
    );

    for (const x of [-0.29, 0.29]) {
        const soporte = new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.018, 0.018, 0.43, 8
            ),
            metalOscuro
        );

        soporte.name = 'SOPORTE_MANUBRIO';
        soporte.position.set(x, 0.76, -0.43);
        soporte.rotation.x = -0.25;
        soporte.castShadow = true;

        provisional.add(soporte);
    }

    // ========================================================
    // RUEDAS
    // ========================================================

    for (const x of [-0.37, 0.37]) {
        for (const z of [-0.43, 0.48]) {
            const rueda = new THREE.Mesh(
                new THREE.CylinderGeometry(
                    0.09, 0.09, 0.055, 16
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

    // ========================================================
    // CARGA DEL GLB
    // ========================================================

    loader.load(
        config.modelo,
        gltf => {
            if (eliminado) return;

            const modelo = gltf.scene;
            modelo.name = 'CARRITO_MODELO_GLB';

            modelo.traverse(objeto => {
                if (!objeto.isMesh) return;

                objeto.castShadow = false;
                objeto.receiveShadow = false;

                const materiales = Array.isArray(objeto.material)
                    ? objeto.material
                    : [objeto.material];

                materiales.forEach(material => {
                    if (!material) return;

                    material.side = THREE.DoubleSide;
                    material.needsUpdate = true;
                });
            });

            modelo.updateMatrixWorld(true);

            const caja = new THREE.Box3().setFromObject(modelo);

            if (!caja.isEmpty()) {
                const centro = caja.getCenter(new THREE.Vector3());

                modelo.position.x -= centro.x;
                modelo.position.z -= centro.z;
                modelo.position.y -= caja.min.y;
            }

            contenedorModelo.add(modelo);
            provisional.visible = false;
            modeloCargado = true;

            console.info(
                'Carrito GLB cargado:',
                config.modelo
            );
        },
        undefined,
        error => {
            if (eliminado) return;

            provisional.visible = true;

            console.error(
                `Error cargando ${config.modelo}. Se utiliza el carrito provisional.`,
                error
            );
        }
    );

    // ========================================================
    // SEGUIMIENTO DEL CLIENTE
    // ========================================================

    function calcularPosicionDeseada() {
        if (!objetivo || !objetivo.isObject3D) return false;

        objetivo.updateWorldMatrix(true, false);

        // El carrito se coloca delante del cliente,
        // en el eje local positivo Z.
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
        if (!objeto?.isObject3D) {
            console.warn(
                'seguirObjetivo necesita un objeto 3D válido.'
            );
            return false;
        }

        objetivo = objeto;

        if (Number.isFinite(distancia)) {
            distanciaSeguimiento = Math.max(0, distancia);
        }

        if (!calcularPosicionDeseada()) return false;

        grupo.position.copy(posicionDeseada);
        grupo.quaternion.copy(quaternionTemporal);

        return true;
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

        const factor = 1 - Math.exp(
            Math.max(0, config.suavizado) * -dt
        );

        grupo.position.lerp(posicionDeseada, factor);
        grupo.quaternion.slerp(quaternionTemporal, factor);
    }

    // ========================================================
    // POSICIÓN Y ROTACIÓN MANUAL
    // ========================================================

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
        ) return;

        grupo.position.set(x, y, z);
    }

    function establecerRotacion(rotacionY = 0) {
        if (
            eliminado ||
            !Number.isFinite(rotacionY)
        ) return;

        grupo.rotation.set(0, rotacionY, 0);
    }

    function dejarDeSeguir() {
        objetivo = null;
    }

    // ========================================================
    // ELIMINAR
    // ========================================================

    function eliminar() {
        if (eliminado) return;

        eliminado = true;
        objetivo = null;

        scene.remove(grupo);
        grupo.clear();
    }

    // ========================================================
    // API PÚBLICA
    // ========================================================

    return {
        grupo,
        seguirObjetivo,
        actualizar,
        establecerPosicion,
        establecerRotacion,
        dejarDeSeguir,
        eliminar,

        get cargado() {
            return modeloCargado;
        },

        get objetivo() {
            return objetivo;
        },

        get eliminado() {
            return eliminado;
        }
    };
}
