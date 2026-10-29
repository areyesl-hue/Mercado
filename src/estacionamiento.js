import * as THREE from 'three';

// Las plazas se alinean con las coordenadas de vehiculos.js.
// El estacionamiento se desplaza +7 en Z.
export function crearEstacionamiento(scene, mercado = null) {
    if (!scene?.isScene) {
        throw new Error('crearEstacionamiento necesita una THREE.Scene.');
    }

    const estacionamiento = new THREE.Group();
    estacionamiento.name = 'ESTACIONAMIENTO_SUPERMERCADO';
    estacionamiento.position.set(0, 0, 7);

    const mat = {
        asfalto: new THREE.MeshStandardMaterial({
            color: 0x34383d, roughness: 0.95
        }),
        concreto: new THREE.MeshStandardMaterial({
            color: 0xa7a9aa, roughness: 0.9
        }),
        blanco: new THREE.MeshStandardMaterial({
            color: 0xf4f4ee, roughness: 0.7
        }),
        amarillo: new THREE.MeshStandardMaterial({
            color: 0xffc928, roughness: 0.7
        }),
        pasto: new THREE.MeshStandardMaterial({
            color: 0x3d7435, roughness: 1
        }),
        tronco: new THREE.MeshStandardMaterial({
            color: 0x68452d, roughness: 1
        }),
        hojas: new THREE.MeshStandardMaterial({
            color: 0x28613a, roughness: 0.9
        }),
        metal: new THREE.MeshStandardMaterial({
            color: 0x30363b, metalness: 0.55, roughness: 0.4
        }),
        luz: new THREE.MeshStandardMaterial({
            color: 0xfff2cc,
            emissive: 0xffd98a,
            emissiveIntensity: 1.2
        })
    };

    function caja(
        nombre, grupo, x, y, z,
        ancho, alto, fondo, material
    ) {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(ancho, alto, fondo),
            material
        );

        mesh.name = nombre;
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        grupo.add(mesh);

        return mesh;
    }

    function cilindro(
        nombre, grupo, x, y, z,
        radio, alto, material, segmentos = 12
    ) {
        const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(
                radio, radio * 1.2, alto, segmentos
            ),
            material
        );

        mesh.name = nombre;
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        grupo.add(mesh);

        return mesh;
    }

    const terreno = new THREE.Group();
    terreno.name = 'TERRENO_ESTACIONAMIENTO';
    estacionamiento.add(terreno);

    const lineas = new THREE.Group();
    lineas.name = 'LINEAS_CAJONES';
    estacionamiento.add(lineas);

    const accesorios = new THREE.Group();
    accesorios.name = 'ACCESOS_Y_JARDINERAS';
    estacionamiento.add(accesorios);

    const luminarias = new THREE.Group();
    luminarias.name = 'LUMINARIAS_ESTACIONAMIENTO';
    estacionamiento.add(luminarias);

    caja(
        'BASE_ASFALTO', terreno,
        0, -0.18, 49, 76, 0.35, 48, mat.asfalto
    );

    caja(
        'BANQUETA_FRENTE', accesorios,
        0, 0.02, 25, 76, 0.18, 1.8, mat.concreto
    );

    caja(
        'BANQUETA_FONDO', accesorios,
        0, 0.02, 73, 76, 0.18, 1.8, mat.concreto
    );

    // Cruce peatonal.
    caja(
        'PASO_PEATONAL_BASE', accesorios,
        0, 0.015, 25.9, 8, 0.035, 1.6, mat.blanco
    );

    for (let i = 0; i < 8; i++) {
        caja(
            `FRANJA_PEATONAL_${i + 1}`,
            accesorios,
            -3.5 + i, 0.04, 25.9,
            0.48, 0.025, 1.45, mat.blanco
        );
    }

    // Las filas locales 33, 42, 56 y 65 quedan en Z mundial
    // 40, 49, 63 y 72.
    const columnas = [-32, -24, -16, -8, 0, 8, 16, 24, 32];
    const filas = [33, 42, 56, 65];
    let n = 1;

    for (const z of filas) {
        for (const x of columnas) {
            caja(
                `LINEA_CAJON_${n++}`, lineas,
                x - 3.75, 0.025, z,
                0.09, 0.035, 5.2, mat.blanco
            );
        }
    }

    for (const z of [30.3, 44.7, 53.3, 67.7]) {
        caja(
            `LINEA_HORIZONTAL_${z}`, lineas,
            0, 0.025, z, 70, 0.035, 0.09, mat.blanco
        );
    }

    for (const x of [-28, -20, -12, -4, 4, 12, 20, 28]) {
        caja(
            `FLECHA_CIRCULACION_${x}`, lineas,
            x, 0.04, 49, 2.1, 0.035, 0.35, mat.amarillo
        );
    }

    caja(
        'ISLA_CENTRAL', accesorios,
        0, 0.04, 49, 5.5, 0.08, 2.2, mat.concreto
    );

    caja(
        'ISLA_CENTRAL_VERDE', accesorios,
        0, 0.12, 49, 4.8, 0.12, 1.5, mat.pasto
    );

    caja(
        'ISLA_ENTRADA', accesorios,
        0, 0.06, 27.8, 12, 0.12, 1.2, mat.concreto
    );

    caja(
        'FLECHA_ENTRADA', lineas,
        0, 0.06, 28.5, 3.5, 0.035, 0.25, mat.amarillo
    );

    caja(
        'FLECHA_SALIDA', lineas,
        0, 0.06, 70, 3.5, 0.035, 0.25, mat.amarillo
    );

    const arboles = [
        [-33, 29], [33, 29],
        [-33, 69], [33, 69],
        [-18, 49], [18, 49]
    ];

    arboles.forEach(([x, z], i) => {
        caja(
            `JARDINERA_${i + 1}`, accesorios,
            x, 0.08, z, 3.1, 0.16, 3.1, mat.concreto
        );

        caja(
            `TIERRA_${i + 1}`, accesorios,
            x, 0.18, z, 2.75, 0.08, 2.75, mat.pasto
        );

        cilindro(
            `TRONCO_${i + 1}`, accesorios,
            x, 1.15, z, 0.22, 1.9, mat.tronco
        );

        const copa = new THREE.Mesh(
            new THREE.SphereGeometry(1.15, 12, 10),
            mat.hojas
        );

        copa.name = `COPA_ARBOL_${i + 1}`;
        copa.position.set(x, 2.65, z);
        copa.scale.set(1.15, 1.25, 1.15);
        copa.castShadow = true;
        accesorios.add(copa);
    });

    const postes = [
        [1, -27, 38], [2, 0, 38], [3, 27, 38],
        [4, -27, 61], [5, 0, 61], [6, 27, 61]
    ];

    for (const [i, x, z] of postes) {
        cilindro(
            `POSTE_LUMINARIA_${i}`, luminarias,
            x, 4.2, z, 0.09, 8.4, mat.metal
        );

        caja(
            `BRAZO_LUMINARIA_${i}`, luminarias,
            x + 0.55, 8.25, z,
            1.2, 0.12, 0.12, mat.metal
        );

        caja(
            `FOCO_LUMINARIA_${i}`, luminarias,
            x + 1.05, 8.12, z,
            0.75, 0.16, 0.55, mat.luz
        );
    }

    if (mercado?.add) {
        mercado.add(estacionamiento);
    } else {
        scene.add(estacionamiento);
    }

    return estacionamiento;
}