
export function crearCasa(
    scene,
    THREE,
    x,
    z,
    scale = 1,
    material,
    rotacion = 0
) {
    const casa = new THREE.Group();

    casa.position.set(x, 0, z);
    casa.scale.setScalar(scale);
    casa.rotation.y = rotacion;

    const cuerpo = new THREE.Mesh(
        new THREE.BoxGeometry(9, 5.5, 8),
        material
    );

    cuerpo.position.y = 2.75;
    cuerpo.castShadow = true;
    cuerpo.receiveShadow = true;

    casa.add(cuerpo);

    const materialTecho = new THREE.MeshStandardMaterial({
        color: 0x6b3030,
        roughness: 0.8
    });

    const techo = new THREE.Mesh(
        new THREE.ConeGeometry(6.8, 3.8, 4),
        materialTecho
    );

    techo.position.y = 7.4;
    techo.rotation.y = Math.PI / 4;
    techo.castShadow = true;
    techo.receiveShadow = true;

    casa.add(techo);

    const materialPuerta = new THREE.MeshStandardMaterial({
        color: 0x513525,
        roughness: 0.7
    });

    const puerta = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 3, 0.18),
        materialPuerta
    );

    puerta.position.set(0, 1.5, 4.08);
    puerta.castShadow = true;

    casa.add(puerta);

    const materialVentana = new THREE.MeshStandardMaterial({
        color: 0x7fc9e8,
        roughness: 0.2,
        metalness: 0.15
    });

    const ventana1 = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 1.5, 0.15),
        materialVentana
    );

    ventana1.position.set(-2.6, 3.1, 4.08);
    ventana1.castShadow = true;

    casa.add(ventana1);

    const ventana2 = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 1.5, 0.15),
        materialVentana
    );

    ventana2.position.set(2.6, 3.1, 4.08);
    ventana2.castShadow = true;

    casa.add(ventana2);

    const ventana3 = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 1.5, 1.7),
        materialVentana
    );

    ventana3.position.set(-4.08, 3.1, 0);
    ventana3.castShadow = true;

    casa.add(ventana3);

    const ventana4 = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 1.5, 1.7),
        materialVentana
    );

    ventana4.position.set(4.08, 3.1, 0);
    ventana4.castShadow = true;

    casa.add(ventana4);

    const materialMarco = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.6
    });

    const marco1 = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.12, 0.12),
        materialMarco
    );

    marco1.position.set(-2.6, 3.1, 4.2);

    casa.add(marco1);

    const marco2 = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.12, 0.12),
        materialMarco
    );

    marco2.position.set(2.6, 3.1, 4.2);

    casa.add(marco2);

    const marcoVertical1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 1.6, 0.12),
        materialMarco
    );

    marcoVertical1.position.set(-2.6, 3.1, 4.2);

    casa.add(marcoVertical1);

    const marcoVertical2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 1.6, 0.12),
        materialMarco
    );

    marcoVertical2.position.set(2.6, 3.1, 4.2);

    casa.add(marcoVertical2);

    const chimenea = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 2.2, 0.9),
        new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.8
        })
    );

    chimenea.position.set(2.2, 8.1, -1);
    chimenea.castShadow = true;

    casa.add(chimenea);

    const jardin = new THREE.Mesh(
        new THREE.BoxGeometry(11, 0.12, 11),
        new THREE.MeshStandardMaterial({
            color: 0x78935e,
            roughness: 0.9
        })
    );

    jardin.position.set(0, 0.05, -0.3);
    jardin.receiveShadow = true;

    casa.add(jardin);

    const sendero = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.08, 4),
        new THREE.MeshStandardMaterial({
            color: 0x999999,
            roughness: 0.9
        })
    );

    sendero.position.set(0, 0.11, 2.8);

    casa.add(sendero);

    const bordeFrontal = new THREE.Mesh(
        new THREE.BoxGeometry(11, 0.18, 0.25),
        new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.9
        })
    );

    bordeFrontal.position.set(0, 0.15, 5.2);

    casa.add(bordeFrontal);

    scene.add(casa);

    return casa;
}
