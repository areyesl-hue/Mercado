
import * as THREE from 'three';

// ================================================================
// SUPERMERCADO 3D | FASE 1: EDIFICIO Y ESTRUCTURA
// Three.js 0.180+
// Frente: Z positivo
// Fondo: Z negativo
// Piso interior: Y = 0
//
// INCLUYE:
// - Piso principal
// - Paredes perimetrales
// - Fachada frontal de cristal
// - Entrada central con puertas de cristal
// - Marquesina y letrero
// - Columnas estructurales
// - Techo independiente, ocultable
// - Iluminación LED interior y exterior
//
// NO INCLUYE:
// - Mobiliario
// - Estantes ni productos
// - Cajas registradoras
// - Clientes
// - Estacionamiento
// ================================================================

export function crearMercado(scene) {

    const mercado = new THREE.Group();
    mercado.name = 'SUPERMERCADO_COMPLETO';
    scene.add(mercado);

    // ------------------------------------------------------------
    // 1. DIMENSIONES GENERALES
    // ------------------------------------------------------------

    const ANCHO = 64;
    const FONDO = 58;
    const ALTURA_PAREDES = 7;
    const GROSOR_PARED = 0.35;

    const FRENTE = FONDO / 2;
    const PARTE_TRASERA = -FONDO / 2;
    const LATERAL = ANCHO / 2;

    const ANCHO_ENTRADA = 8.5;
    const ALTURA_ENTRADA = 4.2;
    const ANCHO_ACCESO_ALMACEN = 8;

    // ------------------------------------------------------------
    // 2. MATERIALES ARQUITECTÓNICOS
    // ------------------------------------------------------------

    const materiales = {

        piso: new THREE.MeshStandardMaterial({
            color: 0xdfe4e7,
            roughness: 0.82,
            metalness: 0.02
        }),

        concreto: new THREE.MeshStandardMaterial({
            color: 0xbfc5c9,
            roughness: 0.9
        }),

        pared: new THREE.MeshStandardMaterial({
            color: 0xf0f1ef,
            roughness: 0.88
        }),

        paredInterior: new THREE.MeshStandardMaterial({
            color: 0xe6e9e9,
            roughness: 0.9
        }),

        zoclo: new THREE.MeshStandardMaterial({
            color: 0x667078,
            roughness: 0.7
        }),

        metal: new THREE.MeshStandardMaterial({
            color: 0x3d464d,
            metalness: 0.72,
            roughness: 0.35
        }),

        metalClaro: new THREE.MeshStandardMaterial({
            color: 0x9ba5ab,
            metalness: 0.65,
            roughness: 0.32
        }),

        cristal: new THREE.MeshPhysicalMaterial({
            color: 0xbfe8f4,
            metalness: 0,
            roughness: 0.12,
            transmission: 0.18,
            transparent: true,
            opacity: 0.32,
            thickness: 0.12,
            ior: 1.45,
            side: THREE.DoubleSide
        }),

        cristalPuerta: new THREE.MeshPhysicalMaterial({
            color: 0xd8f5ff,
            metalness: 0,
            roughness: 0.08,
            transmission: 0.12,
            transparent: true,
            opacity: 0.42,
            thickness: 0.08,
            side: THREE.DoubleSide
        }),

        fascia: new THREE.MeshStandardMaterial({
            color: 0x0878bd,
            roughness: 0.4,
            metalness: 0.12
        }),

        fasciaOscura: new THREE.MeshStandardMaterial({
            color: 0x07538b,
            roughness: 0.5
        }),

        blanco: new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.5
        }),

        junta: new THREE.MeshStandardMaterial({
            color: 0x8b969c,
            roughness: 0.85
        }),

        techo: new THREE.MeshStandardMaterial({
            color: 0xd2d8dc,
            roughness: 0.88,
            side: THREE.DoubleSide
        }),

        techoInterior: new THREE.MeshStandardMaterial({
            color: 0xe8ebed,
            roughness: 0.92,
            side: THREE.DoubleSide
        })
    };

    // ------------------------------------------------------------
    // 3. GRUPOS ORGANIZADOS
    // ------------------------------------------------------------

    const edificio = new THREE.Group();
    edificio.name = '01_EDIFICIO';
    mercado.add(edificio);

    const estructura = new THREE.Group();
    estructura.name = '02_ESTRUCTURA';
    edificio.add(estructura);

    const fachada = new THREE.Group();
    fachada.name = '03_FACHADA_FRONTAL';
    edificio.add(fachada);

    const entrada = new THREE.Group();
    entrada.name = '04_ENTRADA_PRINCIPAL';
    edificio.add(entrada);

    const techo = new THREE.Group();
    techo.name = '05_TECHO_OCULTABLE';
    mercado.add(techo);

    const rotulos = new THREE.Group();
    rotulos.name = '06_ROTULOS';
    edificio.add(rotulos);

    // NUEVO: grupos de iluminación
    const iluminacion = new THREE.Group();
    iluminacion.name = '07_ILUMINACION';
    mercado.add(iluminacion);

    const luminariasInterior = new THREE.Group();
    luminariasInterior.name = 'LUMINARIAS_LED_INTERIORES';
    iluminacion.add(luminariasInterior);

    const luminariasExterior = new THREE.Group();
    luminariasExterior.name = 'LUMINARIAS_EXTERIORES';
    iluminacion.add(luminariasExterior);

    const lucesActivas = [];

    // ------------------------------------------------------------
    // 4. FUNCIONES AUXILIARES
    // ------------------------------------------------------------

    function crearCaja(
        nombre,
        ancho,
        alto,
        fondo,
        x,
        y,
        z,
        material,
        padre
    ) {
        const geometria = new THREE.BoxGeometry(
            ancho,
            alto,
            fondo
        );

        const objeto = new THREE.Mesh(geometria, material);

        objeto.name = nombre;
        objeto.position.set(x, y, z);
        objeto.castShadow = true;
        objeto.receiveShadow = true;

        padre.add(objeto);

        return objeto;
    }

    function crearCristal(
        nombre,
        ancho,
        alto,
        x,
        y,
        z,
        padre,
        material = materiales.cristal
    ) {
        const cristal = crearCaja(
            nombre,
            ancho,
            alto,
            0.08,
            x,
            y,
            z,
            material,
            padre
        );

        cristal.castShadow = false;

        return cristal;
    }

    function crearColumna(
        nombre,
        x,
        z,
        alto,
        ancho = 0.55
    ) {
        const columna = new THREE.Group();
        columna.name = nombre;
        columna.position.set(x, 0, z);

        estructura.add(columna);

        crearCaja(
            `${nombre}_BASE`,
            ancho + 0.22,
            0.18,
            ancho + 0.22,
            0,
            0.09,
            0,
            materiales.concreto,
            columna
        );

        crearCaja(
            `${nombre}_CUERPO`,
            ancho,
            alto,
            ancho,
            0,
            alto / 2 + 0.18,
            0,
            materiales.paredInterior,
            columna
        );

        crearCaja(
            `${nombre}_REMATE`,
            ancho + 0.12,
            0.16,
            ancho + 0.12,
            0,
            alto + 0.26,
            0,
            materiales.concreto,
            columna
        );

        return columna;
    }

    function crearRotuloCanvas(texto) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 256;

        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#0878bd';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 105px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(texto, 512, 128);

        const textura = new THREE.CanvasTexture(canvas);
        textura.colorSpace = THREE.SRGBColorSpace;
        textura.anisotropy = 4;

        return new THREE.MeshBasicMaterial({
            map: textura,
            transparent: false,
            side: THREE.DoubleSide
        });
    }

    // ------------------------------------------------------------
    // 4.1. NUEVO: FUNCIÓN PARA CREAR LUMINARIAS LED
    // ------------------------------------------------------------

    const materialLED = new THREE.MeshBasicMaterial({
        color: 0xfff4df,
        toneMapped: false
    });

    const materialLEDExterior = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        toneMapped: false
    });

    function crearLuminariaLED(
        nombre,
        x,
        y,
        z,
        padre,
        opciones = {}
    ) {
        const {
            intensidad = 18,
            distancia = 17,
            ancho = 2.2,
            fondo = 0.55,
            color = 0xfff1dc
        } = opciones;

        const grupo = new THREE.Group();
        grupo.name = nombre;
        grupo.position.set(x, y, z);
        padre.add(grupo);

        // Carcasa metálica de la luminaria
        const carcasa = new THREE.Mesh(
            new THREE.BoxGeometry(
                ancho + 0.12,
                0.12,
                fondo + 0.12
            ),
            materiales.metalClaro
        );

        carcasa.name = `${nombre}_CARCASA`;
        carcasa.position.y = 0.015;
        carcasa.castShadow = false;
        carcasa.receiveShadow = false;
        grupo.add(carcasa);

        // Panel luminoso visible
        const panel = new THREE.Mesh(
            new THREE.BoxGeometry(ancho, 0.07, fondo),
            color === 0xffffff
                ? materialLEDExterior
                : materialLED
        );

        panel.name = `${nombre}_PANEL`;
        panel.position.y = -0.06;
        panel.castShadow = false;
        panel.receiveShadow = false;
        grupo.add(panel);

        // Luz puntual real
        const luz = new THREE.PointLight(
            color,
            intensidad,
            distancia,
            2
        );

        luz.name = `${nombre}_LUZ`;
        luz.position.set(0, -0.15, 0);
        luz.castShadow = false;
        grupo.add(luz);

        lucesActivas.push(luz);

        return grupo;
    }

    // ------------------------------------------------------------
    // 5. PISO PRINCIPAL
    // ------------------------------------------------------------

    const piso = crearCaja(
        'PISO_INTERIOR_GENERAL',
        ANCHO,
        0.36,
        FONDO,
        0,
        -0.18,
        0,
        materiales.piso,
        edificio
    );

    piso.receiveShadow = true;

    crearCaja(
        'ACABADO_PISO_INTERIOR',
        ANCHO - 0.7,
        0.035,
        FONDO - 0.7,
        0,
        0.018,
        0,
        materiales.piso,
        edificio
    );

    for (const lado of [-1, 1]) {
        crearCaja(
            lado < 0
                ? 'ZOCL0_LATERAL_IZQUIERDO'
                : 'ZOCL0_LATERAL_DERECHO',
            0.08,
            0.38,
            FONDO - 0.7,
            lado * (LATERAL - 0.22),
            0.19,
            0,
            materiales.zoclo,
            edificio
        );
    }

    // ------------------------------------------------------------
    // 6. PAREDES LATERALES
    // ------------------------------------------------------------

    for (const lado of [-1, 1]) {
        const x = lado * (LATERAL - GROSOR_PARED / 2);

        crearCaja(
            lado < 0
                ? 'PARED_LATERAL_IZQUIERDA'
                : 'PARED_LATERAL_DERECHA',
            GROSOR_PARED,
            ALTURA_PAREDES,
            FONDO,
            x,
            ALTURA_PAREDES / 2,
            0,
            materiales.pared,
            estructura
        );

        crearCaja(
            lado < 0
                ? 'FRANJA_LATERAL_IZQUIERDA'
                : 'FRANJA_LATERAL_DERECHA',
            0.05,
            0.45,
            FONDO - 0.8,
            lado * (LATERAL - GROSOR_PARED - 0.02),
            0.23,
            0,
            materiales.paredInterior,
            estructura
        );
    }

    // ------------------------------------------------------------
    // 7. PARED TRASERA
    // ------------------------------------------------------------

    const mitadAcceso = ANCHO_ACCESO_ALMACEN / 2;
    const anchoSegmentoTrasero = LATERAL - mitadAcceso;

    crearCaja(
        'PARED_TRASERA_IZQUIERDA',
        anchoSegmentoTrasero,
        ALTURA_PAREDES,
        GROSOR_PARED,
        -(LATERAL + mitadAcceso) / 2,
        ALTURA_PAREDES / 2,
        PARTE_TRASERA,
        materiales.pared,
        estructura
    );

    crearCaja(
        'PARED_TRASERA_DERECHA',
        anchoSegmentoTrasero,
        ALTURA_PAREDES,
        GROSOR_PARED,
        (LATERAL + mitadAcceso) / 2,
        ALTURA_PAREDES / 2,
        PARTE_TRASERA,
        materiales.pared,
        estructura
    );

    crearCaja(
        'MARCO_ACCESO_ALMACEN_SUPERIOR',
        ANCHO_ACCESO_ALMACEN,
        0.3,
        0.42,
        0,
        ALTURA_PAREDES - 0.15,
        PARTE_TRASERA,
        materiales.metal,
        estructura
    );

    for (const lado of [-1, 1]) {
        crearCaja(
            lado < 0
                ? 'MARCO_ALMACEN_IZQUIERDO'
                : 'MARCO_ALMACEN_DERECHO',
            0.25,
            ALTURA_PAREDES,
            0.42,
            lado * (mitadAcceso - 0.125),
            ALTURA_PAREDES / 2,
            PARTE_TRASERA,
            materiales.metal,
            estructura
        );
    }

    // ------------------------------------------------------------
    // 8. FACHADA FRONTAL
    // ------------------------------------------------------------

    const alturaCristal = 4.6;
    const centroCristalY = 2.75;
    const zCristal = FRENTE - 0.05;

    crearCaja(
        'FACHADA_SUPERIOR',
        ANCHO,
        ALTURA_PAREDES - alturaCristal,
        0.42,
        0,
        alturaCristal + (ALTURA_PAREDES - alturaCristal) / 2,
        FRENTE,
        materiales.pared,
        fachada
    );

    const anchoPanelLateral = (ANCHO - ANCHO_ENTRADA) / 2;

    crearCristal(
        'CRISTAL_FACHADA_IZQUIERDA',
        anchoPanelLateral - 0.2,
        alturaCristal,
        -(ANCHO_ENTRADA / 2 + anchoPanelLateral / 2),
        centroCristalY,
        zCristal,
        fachada
    );

    crearCristal(
        'CRISTAL_FACHADA_DERECHA',
        anchoPanelLateral - 0.2,
        alturaCristal,
        ANCHO_ENTRADA / 2 + anchoPanelLateral / 2,
        centroCristalY,
        zCristal,
        fachada
    );

    const cantidadPerfiles = 8;

    for (const lado of [-1, 1]) {
        for (let i = 0; i <= cantidadPerfiles; i++) {
            const recorrido = anchoPanelLateral - 0.2;
            const xInicio = ANCHO_ENTRADA / 2 + 0.1;

            const x = lado * (
                xInicio + (recorrido / cantidadPerfiles) * i
            );

            crearCaja(
                `PERFIL_FACHADA_${lado}_${i}`,
                0.075,
                alturaCristal,
                0.1,
                x,
                centroCristalY,
                zCristal + 0.045,
                materiales.metal,
                fachada
            );
        }
    }

    crearCaja(
        'PERFIL_HORIZONTAL_FACHADA',
        ANCHO - 0.4,
        0.1,
        0.12,
        0,
        0.55,
        zCristal + 0.05,
        materiales.metal,
        fachada
    );

    // ------------------------------------------------------------
    // 9. ENTRADA PRINCIPAL
    // ------------------------------------------------------------

    const anchoMarco = ANCHO_ENTRADA;
    const xMarco = anchoMarco / 2;
    const zMarco = FRENTE + 0.03;

    for (const lado of [-1, 1]) {
        crearCaja(
            lado < 0
                ? 'ENTRADA_MARCO_IZQUIERDO'
                : 'ENTRADA_MARCO_DERECHO',
            0.18,
            ALTURA_ENTRADA,
            0.22,
            lado * xMarco,
            ALTURA_ENTRADA / 2,
            zMarco,
            materiales.metalClaro,
            entrada
        );
    }

    crearCaja(
        'ENTRADA_MARCO_SUPERIOR',
        anchoMarco + 0.25,
        0.2,
        0.25,
        0,
        ALTURA_ENTRADA,
        zMarco,
        materiales.metalClaro,
        entrada
    );

    const anchoHoja = 1.95;
    const alturaHoja = 3.45;

    crearCristal(
        'PUERTA_AUTOMATICA_IZQUIERDA',
        anchoHoja,
        alturaHoja,
        -anchoHoja / 2,
        alturaHoja / 2,
        FRENTE + 0.12,
        entrada,
        materiales.cristalPuerta
    );

    crearCristal(
        'PUERTA_AUTOMATICA_DERECHA',
        anchoHoja,
        alturaHoja,
        anchoHoja / 2,
        alturaHoja / 2,
        FRENTE + 0.12,
        entrada,
        materiales.cristalPuerta
    );

    for (const x of [-anchoHoja, 0, anchoHoja]) {
        crearCaja(
            `PERFIL_PUERTA_${x}`,
            0.055,
            alturaHoja,
            0.09,
            x,
            alturaHoja / 2,
            FRENTE + 0.17,
            materiales.metal,
            entrada
        );
    }

    crearCaja(
        'GUIA_SUPERIOR_PUERTAS',
        anchoHoja * 2 + 0.1,
        0.12,
        0.16,
        0,
        alturaHoja + 0.08,
        FRENTE + 0.15,
        materiales.metal,
        entrada
    );

    for (const lado of [-1, 1]) {
        crearCaja(
            `SENSOR_ENTRADA_${lado}`,
            0.13,
            0.1,
            0.12,
            lado * 0.42,
            ALTURA_ENTRADA - 0.18,
            FRENTE + 0.24,
            materiales.metal,
            entrada
        );
    }

    // ------------------------------------------------------------
    // 10. MARQUESINA FRONTAL
    // ------------------------------------------------------------

    crearCaja(
        'MARQUESINA_PRINCIPAL',
        27,
        0.55,
        2.2,
        0,
        ALTURA_PAREDES + 0.15,
        FRENTE + 0.9,
        materiales.fascia,
        fachada
    );

    crearCaja(
        'MARQUESINA_BANDA_INFERIOR',
        27,
        0.12,
        2.25,
        0,
        ALTURA_PAREDES - 0.18,
        FRENTE + 0.9,
        materiales.fasciaOscura,
        fachada
    );

    for (const x of [-12, -6, 6, 12]) {
        crearCaja(
            `SOPORTE_MARQUESINA_${x}`,
            0.22,
            2.5,
            0.22,
            x,
            5.95,
            FRENTE + 1.5,
            materiales.metal,
            fachada
        );
    }

    // ------------------------------------------------------------
    // 11. LETRERO PRINCIPAL
    // ------------------------------------------------------------

    const materialRotulo = crearRotuloCanvas('SUPERMERCADO');

    const rotulo = new THREE.Mesh(
        new THREE.PlaneGeometry(17, 4.25),
        materialRotulo
    );

    rotulo.name = 'ROTULO_SUPERMERCADO';
    rotulo.position.set(
        0,
        ALTURA_PAREDES + 0.15,
        FRENTE + 2.04
    );

    rotulos.add(rotulo);

    // ------------------------------------------------------------
    // 12. COLUMNAS ESTRUCTURALES INTERIORES
    // ------------------------------------------------------------

    const posicionesColumnasX = [-24, -12, 0, 12, 24];
    const posicionesColumnasZ = [-20, -8, 8, 20];

    posicionesColumnasX.forEach((x, ix) => {
        posicionesColumnasZ.forEach((z, iz) => {

            if (Math.abs(x) < 4.5 && z < -15) {
                return;
            }

            if (Math.abs(x) < 5 && z > 15) {
                return;
            }

            crearColumna(
                `COLUMNA_${ix + 1}_${iz + 1}`,
                x,
                z,
                ALTURA_PAREDES - 0.25,
                0.48
            );
        });
    });

    // ------------------------------------------------------------
    // 13. VIGA PERIMETRAL SUPERIOR
    // ------------------------------------------------------------

    crearCaja(
        'VIGA_SUPERIOR_FRONTAL',
        ANCHO,
        0.3,
        0.42,
        0,
        ALTURA_PAREDES - 0.15,
        FRENTE - 0.05,
        materiales.concreto,
        estructura
    );

    crearCaja(
        'VIGA_SUPERIOR_TRASERA_IZQUIERDA',
        LATERAL - mitadAcceso,
        0.3,
        0.42,
        -(LATERAL + mitadAcceso) / 2,
        ALTURA_PAREDES - 0.15,
        PARTE_TRASERA,
        materiales.concreto,
        estructura
    );

    crearCaja(
        'VIGA_SUPERIOR_TRASERA_DERECHA',
        LATERAL - mitadAcceso,
        0.3,
        0.42,
        (LATERAL + mitadAcceso) / 2,
        ALTURA_PAREDES - 0.15,
        PARTE_TRASERA,
        materiales.concreto,
        estructura
    );

    for (const lado of [-1, 1]) {
        crearCaja(
            `VIGA_SUPERIOR_LATERAL_${lado}`,
            0.42,
            0.3,
            FONDO,
            lado * (LATERAL - 0.05),
            ALTURA_PAREDES - 0.15,
            0,
            materiales.concreto,
            estructura
        );
    }

    // ------------------------------------------------------------
    // 14. TECHO INDEPENDIENTE
    // ------------------------------------------------------------

    crearCaja(
        'TECHO_EXTERIOR',
        ANCHO + 1.2,
        0.3,
        FONDO + 1.2,
        0,
        ALTURA_PAREDES + 0.48,
        0,
        materiales.techo,
        techo
    );

    crearCaja(
        'TECHO_INTERIOR_ACABADO',
        ANCHO - 0.7,
        0.08,
        FONDO - 0.7,
        0,
        ALTURA_PAREDES + 0.29,
        0,
        materiales.techoInterior,
        techo
    );

    const alturaBorde = 0.45;

    crearCaja(
        'BORDE_TECHO_FRONTAL',
        ANCHO + 1.2,
        alturaBorde,
        0.25,
        0,
        ALTURA_PAREDES + 0.7,
        FRENTE + 0.55,
        materiales.concreto,
        techo
    );

    crearCaja(
        'BORDE_TECHO_TRASERO',
        ANCHO + 1.2,
        alturaBorde,
        0.25,
        0,
        ALTURA_PAREDES + 0.7,
        PARTE_TRASERA - 0.55,
        materiales.concreto,
        techo
    );

    for (const lado of [-1, 1]) {
        crearCaja(
            `BORDE_TECHO_LATERAL_${lado}`,
            0.25,
            alturaBorde,
            FONDO + 1.2,
            lado * (LATERAL + 0.55),
            ALTURA_PAREDES + 0.7,
            0,
            materiales.concreto,
            techo
        );
    }

    // ------------------------------------------------------------
    // 15. NUEVO: ILUMINACIÓN INTERIOR LED
    // ------------------------------------------------------------

    const posicionesLEDX = [-21, -7, 7, 21];
    const posicionesLEDZ = [-19, -6, 7, 19];

    let contadorLED = 0;

    for (const z of posicionesLEDZ) {
        for (const x of posicionesLEDX) {

            contadorLED++;

            crearLuminariaLED(
                `LED_INTERIOR_${String(contadorLED).padStart(2, '0')}`,
                x,
                6.35,
                z,
                luminariasInterior,
                {
                    intensidad: 18,
                    distancia: 17,
                    ancho: 2.2,
                    fondo: 0.55,
                    color: 0xfff1df
                }
            );
        }
    }

    // ------------------------------------------------------------
    // 16. NUEVO: ILUMINACIÓN DE LA MARQUESINA
    // ------------------------------------------------------------

    for (const x of [-9, 0, 9]) {
        crearLuminariaLED(
            `LED_MARQUESINA_${x}`,
            x,
            6.65,
            FRENTE + 0.85,
            luminariasExterior,
            {
                intensidad: 12,
                distancia: 13,
                ancho: 1.5,
                fondo: 0.4,
                color: 0xffffff
            }
        );
    }

    // Luz para el acceso posterior al almacén
    crearLuminariaLED(
        'LED_ACCESO_ALMACEN',
        0,
        6.25,
        PARTE_TRASERA + 3,
        luminariasInterior,
        {
            intensidad: 14,
            distancia: 15,
            ancho: 1.8,
            fondo: 0.5,
            color: 0xfff1df
        }
    );

    // ------------------------------------------------------------
    // 17. DATOS Y CONTROLES DEL MERCADO
    // ------------------------------------------------------------

    mercado.userData.dimensiones = {
        ancho: ANCHO,
        fondo: FONDO,
        alturaParedes: ALTURA_PAREDES,
        entrada: ANCHO_ENTRADA
    };

    mercado.userData.grupos = {
        edificio,
        estructura,
        fachada,
        entrada,
        techo,
        rotulos,
        iluminacion,
        luminariasInterior,
        luminariasExterior
    };

    mercado.userData.ocultarTecho = () => {
        techo.visible = false;
    };

    mercado.userData.mostrarTecho = () => {
        techo.visible = true;
    };

    mercado.userData.alternarTecho = () => {
        techo.visible = !techo.visible;
    };

    mercado.userData.obtenerTechoVisible = () => {
        return techo.visible;
    };

    // Controles nuevos de iluminación
    mercado.userData.encenderIluminacion = () => {
        iluminacion.visible = true;
        lucesActivas.forEach(luz => {
            luz.visible = true;
        });
    };

    mercado.userData.apagarIluminacion = () => {
        lucesActivas.forEach(luz => {
            luz.visible = false;
        });

        // Apaga las luces, pero conserva visibles las carcasas.
        // Si se desea apagar también los paneles, descomenta:
        // iluminacion.visible = false;
    };

    mercado.userData.obtenerLuces = () => lucesActivas;

    mercado.userData.puntoEntrada = new THREE.Vector3(
        0,
        0,
        FRENTE + 3
    );

    mercado.userData.puntoAccesoAlmacen = new THREE.Vector3(
        0,
        0,
        PARTE_TRASERA - 2
    );

    return mercado;
}
