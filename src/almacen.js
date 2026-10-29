
import * as THREE from 'three';

export function crearAlmacen(scene) {
    if (!scene) {
        throw new Error('crearAlmacen necesita una escena THREE.Scene.');
    }

    const almacen = new THREE.Group();
    almacen.name = 'ALMACEN_SUPERMERCADO';
    scene.add(almacen);

    const estructura = new THREE.Group();
    estructura.name = 'ESTRUCTURA_ALMACEN';
    almacen.add(estructura);

    const estanterias = new THREE.Group();
    estanterias.name = 'ESTANTERIAS_INDUSTRIALES';
    almacen.add(estanterias);

    const materiales = {
        muro: new THREE.MeshStandardMaterial({
            color: 0xd4d9dd,
            roughness: 0.88
        }),
        muroInterior: new THREE.MeshStandardMaterial({
            color: 0xe8ecef,
            roughness: 0.92
        }),
        concreto: new THREE.MeshStandardMaterial({
            color: 0x777f85,
            roughness: 0.95
        }),
        piso: new THREE.MeshStandardMaterial({
            color: 0x9ba2a6,
            roughness: 0.9
        }),
        metal: new THREE.MeshStandardMaterial({
            color: 0x34434d,
            metalness: 0.65,
            roughness: 0.42
        }),
        metalEstante: new THREE.MeshStandardMaterial({
            color: 0x3b5968,
            metalness: 0.55,
            roughness: 0.48
        }),
        metalViga: new THREE.MeshStandardMaterial({
            color: 0xf0a62b,
            metalness: 0.25,
            roughness: 0.58
        }),
        techo: new THREE.MeshStandardMaterial({
            color: 0x68747c,
            metalness: 0.35,
            roughness: 0.7
        }),
        puerta: new THREE.MeshStandardMaterial({
            color: 0x52616b,
            metalness: 0.45,
            roughness: 0.6
        }),
        blanco: new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 1.1
        }),
        amarillo: new THREE.MeshStandardMaterial({
            color: 0xf2bd35,
            roughness: 0.72
        }),
        carton: [
            new THREE.MeshStandardMaterial({ color: 0xb9824d, roughness: 0.96 }),
            new THREE.MeshStandardMaterial({ color: 0xc99560, roughness: 0.96 }),
            new THREE.MeshStandardMaterial({ color: 0xa96f3f, roughness: 0.96 }),
            new THREE.MeshStandardMaterial({ color: 0xd0a16e, roughness: 0.96 }),
            new THREE.MeshStandardMaterial({ color: 0xb88959, roughness: 0.96 })
        ],
        etiqueta: new THREE.MeshStandardMaterial({
            color: 0xe9e1ce,
            roughness: 0.95
        }),
        cinta: new THREE.MeshStandardMaterial({
            color: 0xe0bd78,
            roughness: 0.85
        })
    };

    function crearCaja(nombre, padre, x, y, z, ancho, alto, fondo, material) {
        const geometria = new THREE.BoxGeometry(ancho, alto, fondo);
        const malla = new THREE.Mesh(geometria, material);

        malla.name = nombre;
        malla.position.set(x, y, z);
        malla.castShadow = true;
        malla.receiveShadow = true;

        padre.add(malla);
        return malla;
    }

    function crearLuz(nombre, x, y, z, intensidad, distancia, color = 0xffffff) {
        const luz = new THREE.PointLight(color, intensidad, distancia, 2);
        luz.name = nombre;
        luz.position.set(x, y, z);
        luz.castShadow = false;

        almacen.add(luz);
        return luz;
    }

    const centroZ = -41;
    const ancho = 54;
    const fondo = 24;
    const alto = 7;
    const frenteZ = centroZ + fondo / 2;
    const traseraZ = centroZ - fondo / 2;

    const paredXIzquierda = -29;
    const paredXDerecha = 29;

    crearCaja(
        'PISO_ALMACEN',
        estructura,
        0,
        -0.12,
        centroZ,
        ancho,
        0.24,
        fondo,
        materiales.piso
    );

    crearCaja(
        'PARED_TRASERA',
        estructura,
        0,
        alto / 2,
        traseraZ,
        ancho,
        alto,
        0.35,
        materiales.muro
    );

    crearCaja(
        'REVESTIMIENTO_INTERIOR_TRASERO',
        estructura,
        0,
        alto / 2,
        traseraZ + 0.19,
        ancho - 0.7,
        alto - 0.35,
        0.06,
        materiales.muroInterior
    );

    crearCaja(
        'PARED_LATERAL_IZQUIERDA',
        estructura,
        paredXIzquierda,
        alto / 2,
        centroZ,
        0.35,
        alto,
        fondo,
        materiales.muro
    );

    crearCaja(
        'PARED_LATERAL_DERECHA',
        estructura,
        paredXDerecha,
        alto / 2,
        centroZ,
        0.35,
        alto,
        fondo,
        materiales.muro
    );

    crearCaja(
        'ZOCLO_IZQUIERDO',
        estructura,
        paredXIzquierda + 0.2,
        0.35,
        centroZ,
        0.12,
        0.7,
        fondo - 0.4,
        materiales.concreto
    );

    crearCaja(
        'ZOCLO_DERECHO',
        estructura,
        paredXDerecha - 0.2,
        0.35,
        centroZ,
        0.12,
        0.7,
        fondo - 0.4,
        materiales.concreto
    );

    crearCaja(
        'VIGA_LATERAL_IZQUIERDA',
        estructura,
        paredXIzquierda + 0.45,
        alto - 0.25,
        centroZ,
        0.35,
        0.5,
        fondo,
        materiales.metal
    );

    crearCaja(
        'VIGA_LATERAL_DERECHA',
        estructura,
        paredXDerecha - 0.45,
        alto - 0.25,
        centroZ,
        0.35,
        0.5,
        fondo,
        materiales.metal
    );

    crearCaja(
        'VIGA_TRASERA',
        estructura,
        0,
        alto - 0.25,
        traseraZ + 0.45,
        ancho,
        0.5,
        0.35,
        materiales.metal
    );

    crearCaja(
        'VIGA_FRONTAL',
        estructura,
        0,
        alto - 0.25,
        frenteZ - 0.35,
        ancho,
        0.5,
        0.35,
        materiales.metal
    );

    crearCaja(
        'TECHO_ALMACEN',
        estructura,
        0,
        alto + 0.05,
        centroZ,
        ancho + 1.5,
        0.3,
        fondo + 1,
        materiales.techo
    );

    const numeroRefuerzos = 9;

    for (let i = 0; i < numeroRefuerzos; i++) {
        const x = -26 + i * (52 / (numeroRefuerzos - 1));

        crearCaja(
            `REFUERZO_TECHO_${i + 1}`,
            estructura,
            x,
            alto - 0.48,
            centroZ,
            0.18,
            0.2,
            fondo - 0.5,
            materiales.metal
        );
    }

    const marcoAncho = 8;
    const marcoAlto = 4.6;
    const marcoY = marcoAlto / 2;
    const marcoZ = frenteZ - 0.12;

    crearCaja(
        'MARCO_ACCESO_IZQUIERDO',
        estructura,
        -marcoAncho / 2 - 0.18,
        marcoY,
        marcoZ,
        0.35,
        marcoAlto,
        0.4,
        materiales.metal
    );

    crearCaja(
        'MARCO_ACCESO_DERECHO',
        estructura,
        marcoAncho / 2 + 0.18,
        marcoY,
        marcoZ,
        0.35,
        marcoAlto,
        0.4,
        materiales.metal
    );

    crearCaja(
        'MARCO_ACCESO_SUPERIOR',
        estructura,
        0,
        marcoAlto + 0.05,
        marcoZ,
        marcoAncho + 0.7,
        0.35,
        0.4,
        materiales.metal
    );

    function crearCajaMercancia(nombre, x, y, z, anchoCaja, altoCaja, fondoCaja, indice) {
        const materialCarton = materiales.carton[indice % materiales.carton.length];

        const caja = crearCaja(
            nombre,
            estanterias,
            x,
            y,
            z,
            anchoCaja,
            altoCaja,
            fondoCaja,
            materialCarton
        );

        caja.userData.tipo = 'caja_almacen';

        crearCaja(
            `${nombre}_CINTA`,
            estanterias,
            x,
            y + altoCaja / 2 + 0.004,
            z,
            Math.min(anchoCaja * 0.18, 0.14),
            0.012,
            fondoCaja * 0.94,
            materiales.cinta
        );

        crearCaja(
            `${nombre}_ETIQUETA`,
            estanterias,
            x,
            y,
            z + fondoCaja / 2 + 0.008,
            anchoCaja * 0.43,
            altoCaja * 0.3,
            0.015,
            materiales.etiqueta
        );

        return caja;
    }

    function crearEstanteriaIndustrial(numero, xCentro) {
        const rack = new THREE.Group();
        rack.name = `RACK_ALMACEN_${numero}`;
        estanterias.add(rack);

        const anchoRack = 2.2;
        const largoRack = 15.2;
        const zCentroRack = -40.5;
        const zInicio = zCentroRack - largoRack / 2;
        const zFinal = zCentroRack + largoRack / 2;
        const alturaRack = 5.5;
        const grosorPoste = 0.14;
        const niveles = [0.65, 1.85, 3.05, 4.25, 5.25];

        const xIzquierda = xCentro - anchoRack / 2;
        const xDerecha = xCentro + anchoRack / 2;

        for (const [lado, x] of [
            ['IZQUIERDO', xIzquierda],
            ['DERECHO', xDerecha]
        ]) {
            for (const z of [zInicio, zFinal]) {
                crearCaja(
                    `RACK_${numero}_POSTE_${lado}_${z}`,
                    rack,
                    x,
                    alturaRack / 2,
                    z,
                    grosorPoste,
                    alturaRack,
                    grosorPoste,
                    materiales.metalEstante
                );
            }

            crearCaja(
                `RACK_${numero}_POSTE_LARGO_${lado}`,
                rack,
                x,
                alturaRack / 2,
                zCentroRack,
                grosorPoste,
                alturaRack,
                grosorPoste,
                materiales.metalEstante
            );
        }

        for (let nivel = 0; nivel < niveles.length; nivel++) {
            const y = niveles[nivel];

            crearCaja(
                `RACK_${numero}_ESTANTE_${nivel + 1}`,
                rack,
                xCentro,
                y,
                zCentroRack,
                anchoRack,
                0.12,
                largoRack,
                materiales.metalEstante
            );

            crearCaja(
                `RACK_${numero}_VIGA_FRONTAL_${nivel + 1}`,
                rack,
                xCentro,
                y - 0.03,
                zCentroRack + largoRack / 2 - 0.04,
                anchoRack,
                0.1,
                0.09,
                materiales.metalViga
            );

            crearCaja(
                `RACK_${numero}_VIGA_TRASERA_${nivel + 1}`,
                rack,
                xCentro,
                y - 0.03,
                zCentroRack - largoRack / 2 + 0.04,
                anchoRack,
                0.1,
                0.09,
                materiales.metalViga
            );
        }

        for (let z = zInicio + 1; z < zFinal; z += 2.5) {
            crearCaja(
                `RACK_${numero}_TRAVESANO_${z}`,
                rack,
                xCentro,
                0.18,
                z,
                anchoRack + 0.08,
                0.16,
                0.13,
                materiales.metalViga
            );
        }

        const posicionesZ = [
            zInicio + 1.05,
            zInicio + 2.55,
            zInicio + 4.05,
            zInicio + 5.55,
            zInicio + 7.05,
            zInicio + 8.55,
            zInicio + 10.05,
            zInicio + 11.55,
            zInicio + 13.05
        ];

        let contadorCajas = 0;

        for (let nivel = 0; nivel < niveles.length; nivel++) {
            const yEstante = niveles[nivel];

            if (nivel === 0) {
                continue;
            }

            const yCaja = yEstante + 0.12 + 0.34;

            for (let i = 0; i < posicionesZ.length; i++) {
                const z = posicionesZ[i];

                for (const desplazamientoX of [-0.52, 0.52]) {
                    contadorCajas++;

                    const variacionAltura = contadorCajas % 4 === 0 ? 0.08 : 0;

                    crearCajaMercancia(
                        `CAJA_RACK_${numero}_N${nivel + 1}_${contadorCajas}`,
                        xCentro + desplazamientoX,
                        yCaja + variacionAltura,
                        z,
                        0.82,
                        0.64,
                        1.02,
                        contadorCajas + numero + nivel
                    );
                }
            }
        }

        for (let i = 0; i < 5; i++) {
            const z = zInicio + 1.4 + i * 2.8;

            crearCaja(
                `RACK_${numero}_PROTECTOR_${i + 1}`,
                rack,
                xCentro,
                0.35,
                z,
                anchoRack + 0.35,
                0.14,
                0.18,
                materiales.amarillo
            );
        }

        return rack;
    }

    const posicionesRack = [-18, -6, 6, 18];

    posicionesRack.forEach((x, indice) => {
        crearEstanteriaIndustrial(indice + 1, x);
    });

    crearCaja(
        'ZONA_DESCARGA_PISO',
        estructura,
        0,
        0.015,
        traseraZ - 5,
        30,
        0.08,
        8,
        materiales.concreto
    );

    crearCaja(
        'LINEA_SEGURIDAD_DESCARGA',
        estructura,
        0,
        0.07,
        traseraZ - 1.2,
        30,
        0.035,
        0.12,
        materiales.amarillo
    );

    for (let i = 0; i < 6; i++) {
        const z = centroZ + 8 - i * 3.2;

        crearCaja(
            `LUMINARIA_ALMACEN_${i + 1}`,
            estructura,
            0,
            alto - 0.7,
            z,
            2.6,
            0.08,
            0.45,
            materiales.metal
        );

        crearCaja(
            `DIFUSOR_LUZ_ALMACEN_${i + 1}`,
            estructura,
            0,
            alto - 0.75,
            z,
            2.35,
            0.045,
            0.3,
            materiales.blanco
        );

        crearLuz(
            `LUZ_ALMACEN_${i + 1}`,
            0,
            alto - 1,
            z,
            12,
            19
        );
    }

    crearLuz('LUZ_ALMACEN_IZQUIERDA', -18, 5.2, centroZ, 8, 15);
    crearLuz('LUZ_ALMACEN_DERECHA', 18, 5.2, centroZ, 8, 15);

    almacen.userData.limites = {
        minX: -27,
        maxX: 27,
        minZ: traseraZ,
        maxZ: frenteZ
    };

    return almacen;
}
