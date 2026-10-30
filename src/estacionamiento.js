
import * as THREE from 'three';

// ============================================================
// ESTACIONAMIENTO DEL SUPERMERCADO
// Compatible con vehiculos.js y main.js
// Coordenadas globales:
// X: -30 a 30
// Z:  25 a 80
// ============================================================

export function crearEstacionamiento(scene) {
    if (!scene) {
        throw new Error('crearEstacionamiento necesita una THREE.Scene.');
    }

    const estacionamiento = new THREE.Group();
    estacionamiento.name = 'ESTACIONAMIENTO_SUPERMERCADO';

    // --------------------------------------------------------
    // MATERIALES
    // --------------------------------------------------------

    const materiales = {
        asfalto: new THREE.MeshStandardMaterial({
            color: 0x30343a,
            roughness: 0.96
        }),

        banqueta: new THREE.MeshStandardMaterial({
            color: 0xb9bdc1,
            roughness: 0.9
        }),

        linea: new THREE.MeshStandardMaterial({
            color: 0xf4f1dc,
            roughness: 0.8
        }),

        lineaAmarilla: new THREE.MeshStandardMaterial({
            color: 0xf5c542,
            roughness: 0.8
        }),

        jardin: new THREE.MeshStandardMaterial({
            color: 0x416b37,
            roughness: 1
        }),

        concreto: new THREE.MeshStandardMaterial({
            color: 0x777e84,
            roughness: 0.9
        }),

        metal: new THREE.MeshStandardMaterial({
            color: 0x414b55,
            metalness: 0.7,
            roughness: 0.35
        }),

        luz: new THREE.MeshStandardMaterial({
            color: 0xfff0c2,
            emissive: 0xffd27a,
            emissiveIntensity: 1.8
        }),

        verde: new THREE.MeshStandardMaterial({
            color: 0x287b37,
            roughness: 0.9
        }),

        tronco: new THREE.MeshStandardMaterial({
            color: 0x765033,
            roughness: 1
        })
    };

    // --------------------------------------------------------
    // FUNCIONES AUXILIARES
    // --------------------------------------------------------

    function agregarCaja(nombre, ancho, alto, largo, x, y, z, material) {
        const geometria = new THREE.BoxGeometry(ancho, alto, largo);
        const malla = new THREE.Mesh(geometria, material);

        malla.name = nombre;
        malla.position.set(x, y, z);
        malla.receiveShadow = true;
        malla.castShadow = false;

        estacionamiento.add(malla);
        return malla;
    }

    function agregarCilindro(nombre, radioSuperior, radioInferior, alto, x, y, z, material, segmentos = 12) {
        const geometria = new THREE.CylinderGeometry(
            radioSuperior,
            radioInferior,
            alto,
            segmentos
        );

        const malla = new THREE.Mesh(geometria, material);
        malla.name = nombre;
        malla.position.set(x, y, z);

        estacionamiento.add(malla);
        return malla;
    }

    // --------------------------------------------------------
    // PISO PRINCIPAL
    // --------------------------------------------------------

    agregarCaja(
        'PISO_ASFALTO_ESTACIONAMIENTO',
        76,
        0.18,
        48,
        0,
        -0.09,
        49,
        materiales.asfalto
    );

    // --------------------------------------------------------
    // BANQUETAS
    // --------------------------------------------------------

    agregarCaja(
        'BANQUETA_FRONTAL',
        76,
        0.24,
        3,
        0,
        0.02,
        26.5,
        materiales.banqueta
    );

    agregarCaja(
        'BANQUETA_POSTERIOR',
        76,
        0.24,
        3,
        0,
        0.02,
        71.5,
        materiales.banqueta
    );

    agregarCaja(
        'BANQUETA_IZQUIERDA',
        3,
        0.24,
        48,
        -36.5,
        0.02,
        49,
        materiales.banqueta
    );

    agregarCaja(
        'BANQUETA_DERECHA',
        3,
        0.24,
        48,
        36.5,
        0.02,
        49,
        materiales.banqueta
    );

    // --------------------------------------------------------
    // CAJONES DE ESTACIONAMIENTO
    // 6 columnas x 4 filas = 24 espacios
    // Las posiciones Z coinciden con vehiculos.js:
    // 32, 39, 46 y 53.
    // --------------------------------------------------------

    const posicionesX = [-24, -16, -8, 8, 16, 24];
    const posicionesZ = [32, 39, 46, 53];

    const anchoCajon = 7;
    const largoCajon = 7;

    posicionesZ.forEach((z, fila) => {
        posicionesX.forEach((x, columna) => {
            const id = `CAJON_F${fila + 1}_C${columna + 1}`;

            // Líneas laterales
            agregarCaja(
                `${id}_LINEA_IZQUIERDA`,
                0.12,
                0.025,
                largoCajon,
                x - anchoCajon / 2,
                0.025,
                z,
                materiales.linea
            );

            agregarCaja(
                `${id}_LINEA_DERECHA`,
                0.12,
                0.025,
                largoCajon,
                x + anchoCajon / 2,
                0.025,
                z,
                materiales.linea
            );

            // Línea de fondo
            agregarCaja(
                `${id}_LINEA_FONDO`,
                anchoCajon,
                0.025,
                0.12,
                x,
                0.025,
                z - largoCajon / 2,
                materiales.linea
            );
        });
    });

    // Separación de circulación entre filas
    [35.5, 42.5, 49.5].forEach((z, i) => {
        agregarCaja(
            `SEPARADOR_CIRCULACION_${i + 1}`,
            58,
            0.025,
            0.10,
            0,
            0.025,
            z,
            materiales.lineaAmarilla
        );
    });

    // --------------------------------------------------------
    // FLECHAS DE CIRCULACIÓN
    // --------------------------------------------------------

    function crearFlecha(x, z, rotacion, nombre) {
        const forma = new THREE.Shape();

        forma.moveTo(0, 1.1);
        forma.lineTo(-0.55, 0.15);
        forma.lineTo(-0.18, 0.15);
        forma.lineTo(-0.18, -1.1);
        forma.lineTo(0.18, -1.1);
        forma.lineTo(0.18, 0.15);
        forma.lineTo(0.55, 0.15);
        forma.closePath();

        const geometria = new THREE.ShapeGeometry(forma);
        const flecha = new THREE.Mesh(geometria, materiales.lineaAmarilla);

        flecha.name = nombre;
        flecha.rotation.x = -Math.PI / 2;
        flecha.rotation.z = rotacion;
        flecha.position.set(x, 0.035, z);

        estacionamiento.add(flecha);
    }

    crearFlecha(-5, 36, 0, 'FLECHA_CIRCULACION_1');
    crearFlecha(5, 36, Math.PI, 'FLECHA_CIRCULACION_2');
    crearFlecha(-5, 57, 0, 'FLECHA_CIRCULACION_3');
    crearFlecha(5, 57, Math.PI, 'FLECHA_CIRCULACION_4');

    // --------------------------------------------------------
    // JARDINERAS
    // --------------------------------------------------------

    function crearJardinera(x, z, ancho, largo, numero) {
        agregarCaja(
            `JARDINERA_${numero}_BASE`,
            ancho,
            0.45,
            largo,
            x,
            0.22,
            z,
            materiales.concreto
        );

        agregarCaja(
            `JARDINERA_${numero}_TIERRA`,
            ancho - 0.25,
            0.12,
            largo - 0.25,
            x,
            0.49,
            z,
            materiales.jardin
        );

        const cantidad = Math.max(2, Math.floor(ancho / 2));

        for (let i = 0; i < cantidad; i++) {
            const px = x - ancho / 2 + 0.8 + i * ((ancho - 1.6) / Math.max(1, cantidad - 1));

            agregarCilindro(
                `JARDINERA_${numero}_TRONCO_${i}`,
                0.12,
                0.16,
                1.3,
                px,
                1.15,
                z,
                materiales.tronco,
                8
            );

            const copa = new THREE.Mesh(
                new THREE.SphereGeometry(0.85, 10, 8),
                materiales.verde
            );

            copa.name = `JARDINERA_${numero}_ARBOL_${i}`;
            copa.position.set(px, 2.05, z);
            copa.scale.set(1, 1.15, 1);
            estacionamiento.add(copa);
        }
    }

    crearJardinera(-33, 37, 4, 5, 1);
    crearJardinera(33, 37, 4, 5, 2);
    crearJardinera(-33, 65, 4, 5, 3);
    crearJardinera(33, 65, 4, 5, 4);

    crearJardinera(-29, 56, 3, 5, 5);
    crearJardinera(29, 56, 3, 5, 6);

    // --------------------------------------------------------
    // POSTES DE ILUMINACIÓN
    // --------------------------------------------------------

    function crearPosteLuz(x, z, numero) {
        agregarCilindro(
            `POSTE_${numero}_BASE`,
            0.32,
            0.4,
            0.35,
            x,
            0.18,
            z,
            materiales.concreto
        );

        agregarCilindro(
            `POSTE_${numero}_CUERPO`,
            0.09,
            0.13,
            5.8,
            x,
            3.15,
            z,
            materiales.metal
        );

        agregarCaja(
            `POSTE_${numero}_BRAZO`,
            1.5,
            0.12,
            0.12,
            x + 0.55,
            5.95,
            z,
            materiales.metal
        );

        agregarCaja(
            `POSTE_${numero}_LUMINARIA`,
            1.1,
            0.18,
            0.65,
            x + 1.1,
            5.85,
            z,
            materiales.luz
        );

        const luz = new THREE.PointLight(0xffe3ae, 35, 17, 2);
        luz.position.set(x + 1.1, 5.55, z);
        luz.castShadow = false;
        estacionamiento.add(luz);
    }

    const postes = [
        [-30, 43],
        [30, 43],
        [-30, 61],
        [30, 61],
        [-12, 61],
        [12, 61]
    ];

    postes.forEach((p, i) => {
        crearPosteLuz(p[0], p[1], i + 1);
    });

    // --------------------------------------------------------
    // SEÑALIZACIÓN DE ENTRADA Y SALIDA
    // --------------------------------------------------------

    agregarCaja(
        'LINEA_ENTRADA_ESTACIONAMIENTO',
        12,
        0.04,
        0.22,
        0,
        0.04,
        29,
        materiales.lineaAmarilla
    );

    agregarCaja(
        'LINEA_SALIDA_ESTACIONAMIENTO',
        12,
        0.04,
        0.22,
        0,
        0.04,
        76,
        materiales.lineaAmarilla
    );

    // --------------------------------------------------------
    // ROTULACIÓN
    // --------------------------------------------------------

    function crearRotulo(texto, x, z, color = '#ffffff') {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;

        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(20, 30, 40, 0.88)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#f5c542';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

        ctx.fillStyle = color;
        ctx.font = 'bold 58px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(texto, canvas.width / 2, canvas.height / 2);

        const textura = new THREE.CanvasTexture(canvas);
        textura.colorSpace = THREE.SRGBColorSpace;

        const material = new THREE.MeshBasicMaterial({
            map: textura,
            transparent: true,
            side: THREE.DoubleSide
        });

        const placa = new THREE.Mesh(
            new THREE.PlaneGeometry(7, 1.75),
            material
        );

        placa.name = `ROTULO_${texto}`;
        placa.position.set(x, 3.5, z);
        placa.rotation.y = Math.PI;
        estacionamiento.add(placa);
    }

    crearRotulo('ESTACIONAMIENTO', 0, 28);
    crearRotulo('SALIDA', 0, 78, '#ffe28a');

    // --------------------------------------------------------
    // GRUPO FINAL
    // --------------------------------------------------------

    scene.add(estacionamiento);

    console.log('Estacionamiento creado correctamente.');
    console.log('24 cajones disponibles.');
    console.log('6 postes de iluminación.');
    console.log('6 jardineras.');

    return estacionamiento;
}
