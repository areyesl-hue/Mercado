import * as THREE from 'three';

// ============================================================
// MOBILIARIO DEL SUPERMERCADO OPTIMIZADO
// Three.js r180+
// Archivo: mobiliario.js
//
// Mantiene:
// - 19 departamentos
// - Geometrías reutilizadas mediante caché
// - Materiales compartidos
// - Colisiones y metadatos
// - Productos y superficies compatibles con productos.js
// - Iluminación decorativa con menos luces dinámicas
// - Sin sombras individuales innecesarias
// ============================================================

export function crearMobiliario(scene, mercado = null) {
    if (!scene || !scene.isScene) {
        throw new Error('crearMobiliario necesita una THREE.Scene.');
    }

    const mobiliario = new THREE.Group();
    mobiliario.name = 'MOBILIARIO_SUPERMERCADO';

    const departamentos = {};
    const colisiones = [];
    const luminarias = [];

    // --------------------------------------------------------
    // CACHÉ DE GEOMETRÍAS
    // --------------------------------------------------------

    const geometríasCaja = new Map();
    const geometríasCilindro = new Map();

    function obtenerCaja(ancho, alto, fondo) {
        const clave = `${ancho}|${alto}|${fondo}`;

        if (!geometríasCaja.has(clave)) {
            geometríasCaja.set(
                clave,
                new THREE.BoxGeometry(ancho, alto, fondo)
            );
        }

        return geometríasCaja.get(clave);
    }

    function obtenerCilindro(radio, alto, segmentos) {
        const clave = `${radio}|${alto}|${segmentos}`;

        if (!geometríasCilindro.has(clave)) {
            geometríasCilindro.set(
                clave,
                new THREE.CylinderGeometry(
                    radio, radio, alto, segmentos
                )
            );
        }

        return geometríasCilindro.get(clave);
    }

    // --------------------------------------------------------
    // MATERIALES COMPARTIDOS
    // --------------------------------------------------------

    const mat = {
        metal: new THREE.MeshStandardMaterial({
            color: 0x87939b,
            metalness: 0.45,
            roughness: 0.48
        }),

        acero: new THREE.MeshStandardMaterial({
            color: 0xc3cbd0,
            metalness: 0.45,
            roughness: 0.42
        }),

        estructura: new THREE.MeshStandardMaterial({
            color: 0x303a43,
            metalness: 0.25,
            roughness: 0.55
        }),

        oscuro: new THREE.MeshStandardMaterial({
            color: 0x20272d,
            metalness: 0.2,
            roughness: 0.6
        }),

        blanco: new THREE.MeshStandardMaterial({
            color: 0xf0f2f3,
            roughness: 0.65
        }),

        gris: new THREE.MeshStandardMaterial({
            color: 0x9da7ae,
            roughness: 0.65
        }),

        azul: new THREE.MeshStandardMaterial({
            color: 0x176eb0,
            roughness: 0.5
        }),

        azulOscuro: new THREE.MeshStandardMaterial({
            color: 0x153c55,
            roughness: 0.55
        }),

        verde: new THREE.MeshStandardMaterial({
            color: 0x31834b,
            roughness: 0.55
        }),

        rojo: new THREE.MeshStandardMaterial({
            color: 0xc82d37,
            roughness: 0.55
        }),

        naranja: new THREE.MeshStandardMaterial({
            color: 0xe99535,
            roughness: 0.6
        }),

        madera: new THREE.MeshStandardMaterial({
            color: 0xb58a5a,
            roughness: 0.8
        }),

        maderaClara: new THREE.MeshStandardMaterial({
            color: 0xd8bd95,
            roughness: 0.75
        }),

        goma: new THREE.MeshStandardMaterial({
            color: 0x202428,
            roughness: 0.9
        }),

        luz: new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xd7f1ff,
            emissiveIntensity: 1.0,
            roughness: 0.5
        }),

        cristal: new THREE.MeshStandardMaterial({
            color: 0x9bc8d9,
            transparent: true,
            opacity: 0.28,
            roughness: 0.3,
            depthWrite: false
        })
    };

    // --------------------------------------------------------
    // HERRAMIENTAS
    // --------------------------------------------------------

    function grupo(nombre, padre = mobiliario, x = 0, z = 0) {
        const g = new THREE.Group();
        g.name = nombre;
        g.position.set(x, 0, z);
        padre.add(g);
        return g;
    }

    function departamento(nombre) {
        const g = grupo(nombre);
        departamentos[nombre] = g;
        return g;
    }

    function caja(
        padre, nombre,
        x, y, z,
        ancho, alto, fondo,
        material,
        sombras = false
    ) {
        const mesh = new THREE.Mesh(
            obtenerCaja(ancho, alto, fondo),
            material
        );

        mesh.name = nombre;
        mesh.position.set(x, y, z);

        // El renderizador del proyecto tiene sombras desactivadas.
        // Evitamos trabajo extra por objeto.
        mesh.castShadow = false;
        mesh.receiveShadow = false;

        padre.add(mesh);
        return mesh;
    }

    function cilindro(
        padre, nombre,
        x, y, z,
        radio, alto, material,
        segmentos = 12
    ) {
        const mesh = new THREE.Mesh(
            obtenerCilindro(radio, alto, segmentos),
            material
        );

        mesh.name = nombre;
        mesh.position.set(x, y, z);
        mesh.castShadow = false;
        mesh.receiveShadow = false;

        padre.add(mesh);
        return mesh;
    }

    function registrarColision(nombre, x, z, ancho, fondo, opciones = {}) {
        colisiones.push({
            nombre,
            minX: x - ancho / 2,
            maxX: x + ancho / 2,
            minZ: z - fondo / 2,
            maxZ: z + fondo / 2,
            ancho,
            fondo,
            tipo: opciones.tipo ?? 'mueble',
            transitable: false
        });
    }

    function crearMuebleSimple(
        padre, nombre, x, z,
        ancho, alto, fondo,
        material,
        opciones = {}
    ) {
        const g = grupo(nombre, padre, x, z);

        caja(
            g, 'Cuerpo',
            0, alto / 2, 0,
            ancho, alto, fondo, material
        );

        if (opciones.base !== false) {
            caja(
                g, 'Zocalo',
                0, 0.09, 0,
                ancho + 0.05, 0.18, fondo + 0.05,
                mat.estructura
            );
        }

        registrarColision(
            nombre, x, z,
            ancho + (opciones.margenX ?? 0.12),
            fondo + (opciones.margenZ ?? 0.12),
            { tipo: opciones.tipo ?? 'mueble' }
        );

        return g;
    }

    // --------------------------------------------------------
    // 01. GÓNDOLAS CENTRALES
    // --------------------------------------------------------

    function crearGondola(padre, nombre, x, z) {
        const g = grupo(nombre, padre, x, z);

        const ancho = 1.15;
        const largo = 5.7;
        const alto = 2.0;
        const niveles = [0.43, 0.86, 1.29, 1.72];

        caja(g, 'Base', 0, 0.13, 0, ancho, 0.22, largo, mat.estructura);

        for (const dx of [-0.51, 0.51]) {
            for (const dz of [-2.72, 2.72]) {
                caja(g, 'Montante', dx, alto / 2, dz,
                    0.075, alto, 0.09, mat.metal);

                caja(g, 'Pie', dx, 0.055, dz,
                    0.26, 0.09, 0.22, mat.estructura);
            }
        }

        for (const lado of [-1, 1]) {
            for (let i = 0; i < niveles.length; i++) {
                const y = niveles[i];

                caja(g, `Repisa_${lado}_${i + 1}`,
                    lado * 0.30, y, 0,
                    0.55, 0.065, largo - 0.18, mat.acero);

                caja(g, `Borde_${lado}_${i + 1}`,
                    lado * 0.575, y + 0.035, 0,
                    0.035, 0.07, largo - 0.18, mat.oscuro);
            }
        }

        for (const dz of [-1.8, 0, 1.8]) {
            caja(g, 'Refuerzo', 0, 0.29, dz,
                ancho - 0.12, 0.07, 0.08, mat.oscuro);
        }

        caja(g, 'Franja_superior', 0, 2.04, 0,
            ancho, 0.10, largo - 0.1, mat.azul);

        registrarColision(nombre, x, z, 1.5, 6.0, {
            tipo: 'gondola'
        });

        g.userData.esGondola = true;
        g.userData.ancho = ancho;
        g.userData.largo = largo;
        g.userData.nivelesProducto = niveles;
        g.userData.lados = [-1, 1];

        return g;
    }

    {
        const dep = departamento('01_GONDOLAS_CENTRALES');
        let numero = 1;

        for (const x of [-17, -9, 9, 17]) {
            for (const z of [-13, 0, 13]) {
                crearGondola(
                    dep,
                    `Gondola_${String(numero++).padStart(2, '0')}`,
                    x, z
                );
            }
        }
    }

    // --------------------------------------------------------
    // 02. ISLAS PROMOCIONALES
    // --------------------------------------------------------

    function crearIslaPromocional(padre, nombre, x, z, color) {
        const g = grupo(nombre, padre, x, z);

        caja(g, 'Cuerpo', 0, 0.48, 0, 1.65, 0.85, 1.55, mat.blanco);
        caja(g, 'Zocalo', 0, 0.12, 0, 1.72, 0.16, 1.62, mat.estructura);
        caja(g, 'Cubierta', 0, 0.94, 0, 1.78, 0.12, 1.68, mat.maderaClara);
        caja(g, 'Franja_frontal', 0, 0.48, 0.79, 1.48, 0.22, 0.04, color);

        registrarColision(nombre, x, z, 1.95, 1.9, { tipo: 'isla' });
        g.userData.superficieProductoY = 1.0;

        return g;
    }

    {
        const dep = departamento('02_ISLAS_PROMOCIONALES');

        crearIslaPromocional(dep, 'Isla_promocional_01', -3.5, -7, mat.naranja);
        crearIslaPromocional(dep, 'Isla_promocional_02', 3.5, 7, mat.verde);
    }

    // --------------------------------------------------------
    // 03. ESTANTERÍAS PERIMETRALES
    // --------------------------------------------------------

    function crearEstanteriaPared(padre, nombre, x, z, largo = 4.0) {
        const g = grupo(nombre, padre, x, z);
        const niveles = [0.43, 0.86, 1.29, 1.72];

        caja(g, 'Panel_trasero', 0, 1.0, 0, 0.12, 2.0, largo, mat.gris);

        niveles.forEach((y, i) => {
            caja(g, `Repisa_${i + 1}`, 0.32, y, 0,
                0.62, 0.065, largo - 0.12, mat.acero);

            caja(g, `Borde_${i + 1}`, 0.64, y + 0.035, 0,
                0.035, 0.045, largo - 0.12, mat.oscuro);
        });

        for (const dz of [-largo / 2 + 0.1, largo / 2 - 0.1]) {
            caja(g, 'Poste', 0, 1.0, dz, 0.09, 2.0, 0.09, mat.metal);
        }

        registrarColision(nombre, x, z, 0.95, largo + 0.1, {
            tipo: 'estanteria'
        });

        g.userData.nivelesProducto = niveles;
        return g;
    }

    {
        const dep = departamento('03_ESTANTERIAS_PERIMETRALES');

        crearEstanteriaPared(dep, 'Estanteria_izquierda_01', -29.5, -18);
        crearEstanteriaPared(dep, 'Estanteria_izquierda_02', -29.5, -10);
        crearEstanteriaPared(dep, 'Estanteria_derecha_01', 29.5, -18);
        crearEstanteriaPared(dep, 'Estanteria_derecha_02', 29.5, -10);
    }

    // --------------------------------------------------------
    // 04. FRUTAS Y VERDURAS
    // --------------------------------------------------------

    function crearMesaFrescos(padre, nombre, x, z) {
        const g = grupo(nombre, padre, x, z);
        const ancho = 2.8;
        const fondo = 1.4;

        caja(g, 'Cuerpo', 0, 0.48, 0, ancho, 0.85, fondo, mat.madera);

        caja(g, 'Cubierta', 0, 0.94, 0,
            ancho + 0.12, 0.12, fondo + 0.12, mat.maderaClara);

        caja(g, 'Franja_verde', 0, 0.50, fondo / 2 + 0.015,
            ancho - 0.12, 0.18, 0.035, mat.verde);

        for (const dx of [-1.2, 1.2]) {
            for (const dz of [-0.53, 0.53]) {
                caja(g, 'Pata', dx, 0.16, dz,
                    0.10, 0.32, 0.10, mat.estructura);
            }
        }

        registrarColision(nombre, x, z, 3.0, 1.6, {
            tipo: 'mesa_frescos'
        });

        g.userData.superficieProductoY = 1.0;
        g.userData.anchoSuperficie = ancho;
        g.userData.fondoSuperficie = fondo;

        return g;
    }

    {
        const dep = departamento('04_FRUTAS_Y_VERDURAS');

        crearMesaFrescos(dep, 'Mesa_frescos_01', -25.5, 15);
        crearMesaFrescos(dep, 'Mesa_frescos_02', -21.7, 15);
        crearMesaFrescos(dep, 'Mesa_frescos_03', -25.5, 10.8);
        crearMesaFrescos(dep, 'Mesa_frescos_04', -21.7, 10.8);
    }

    // --------------------------------------------------------
    // 05. PANADERÍA
    // --------------------------------------------------------

    function crearVitrinaPan(padre, nombre, x, z) {
        const g = grupo(nombre, padre, x, z);

        caja(g, 'Base', 0, 0.48, 0, 2.65, 0.90, 1.05, mat.madera);
        caja(g, 'Encimera', 0, 0.96, 0, 2.75, 0.10, 1.15, mat.maderaClara);
        caja(g, 'Bandeja_inferior', 0, 1.18, 0, 2.42, 0.045, 0.85, mat.acero);
        caja(g, 'Bandeja_superior', 0, 1.52, 0, 2.42, 0.045, 0.85, mat.acero);
        caja(g, 'Luz_interior', 0, 1.80, 0, 2.35, 0.04, 0.08, mat.luz);

        registrarColision(nombre, x, z, 2.9, 1.3, {
            tipo: 'panaderia'
        });

        g.userData.superficieProductoY = 1.02;
        return g;
    }

    {
        const dep = departamento('05_PANADERIA');

        crearVitrinaPan(dep, 'Vitrina_pan_01', 25.2, 15.2);
        crearVitrinaPan(dep, 'Vitrina_pan_02', 25.2, 11.4);
    }

    // --------------------------------------------------------
    // 06. REFRIGERADORES
    // --------------------------------------------------------

    function crearRefrigerador(padre, nombre, x, z) {
        const g = grupo(nombre, padre, x, z);
        const ancho = 2.7;
        const alto = 2.55;
        const fondo = 0.95;
        const niveles = [0.50, 0.93, 1.36, 1.79];

        caja(g, 'Parte_trasera', 0, alto / 2, -fondo / 2,
            ancho, alto, 0.10, mat.gris);

        caja(g, 'Lateral_izquierdo', -ancho / 2, alto / 2, 0,
            0.09, alto, fondo, mat.acero);

        caja(g, 'Lateral_derecho', ancho / 2, alto / 2, 0,
            0.09, alto, fondo, mat.acero);

        caja(g, 'Zocalo', 0, 0.13, 0,
            ancho + 0.05, 0.24, fondo + 0.06, mat.estructura);

        caja(g, 'Marco_superior', 0, alto - 0.08, 0,
            ancho, 0.15, fondo, mat.acero);

        niveles.forEach((y, i) => {
            caja(g, `Repisa_${i + 1}`, 0, y, 0,
                ancho - 0.20, 0.045, fondo - 0.16, mat.acero);
        });

        caja(g, 'Luz_interior', 0, 2.24, 0.12,
            ancho - 0.35, 0.045, 0.06, mat.luz);

        registrarColision(nombre, x, z, 2.85, 1.15, {
            tipo: 'refrigerador'
        });

        g.userData.nivelesProducto = niveles;
        g.userData.frenteZ = z + fondo / 2;

        return g;
    }

    {
        const dep = departamento('06_REFRIGERADORES');

        [-27, -23.5, -20, -16.5, 16.5, 20, 23.5, 27].forEach((x, i) => {
            crearRefrigerador(
                dep,
                `Refrigerador_${String(i + 1).padStart(2, '0')}`,
                x, -26.5
            );
        });
    }

    // --------------------------------------------------------
    // 07. CONGELADORES
    // --------------------------------------------------------

    function crearCongelador(padre, nombre, x, z) {
        const g = grupo(nombre, padre, x, z);

        caja(g, 'Cuerpo', 0, 0.55, 0, 2.65, 1.05, 1.25, mat.blanco);
        caja(g, 'Zocalo', 0, 0.10, 0, 2.72, 0.18, 1.32, mat.estructura);
        caja(g, 'Marco_superior', 0, 1.12, 0, 2.72, 0.10, 1.32, mat.acero);
        caja(g, 'Tapa_superior', 0, 1.19, 0, 2.52, 0.045, 1.12, mat.cristal);

        registrarColision(nombre, x, z, 2.85, 1.45, {
            tipo: 'congelador'
        });

        return g;
    }

    {
        const dep = departamento('07_CONGELADORES');

        crearCongelador(dep, 'Congelador_01', 25.5, -18.5);
        crearCongelador(dep, 'Congelador_02', 25.5, -14.8);
    }

    // --------------------------------------------------------
    // 08. CARNICERÍA Y PESCADERÍA
    // --------------------------------------------------------

    function crearMostradorFrio(padre, nombre, x, z, color) {
        const g = grupo(nombre, padre, x, z);

        caja(g, 'Cuerpo', 0, 0.52, 0, 3.25, 0.98, 1.20, mat.blanco);
        caja(g, 'Panel_frontal', 0, 0.53, 0.615, 3.05, 0.64, 0.045, color);
        caja(g, 'Zocalo', 0, 0.11, 0, 3.20, 0.16, 1.23, mat.estructura);
        caja(g, 'Cubierta', 0, 1.04, 0, 3.35, 0.10, 1.28, mat.acero);
        caja(g, 'Bandeja', 0, 1.20, 0, 2.88, 0.04, 0.94, mat.acero);

        registrarColision(nombre, x, z, 3.5, 1.4, {
            tipo: 'mostrador'
        });

        g.userData.superficieProductoY = 1.24;
        return g;
    }

    {
        const dep = departamento('08_CARNICERIA_PESCADERIA');

        crearMostradorFrio(dep, 'Mostrador_carniceria', 25.1, -7.3, mat.rojo);
        crearMostradorFrio(dep, 'Mostrador_pescaderia', 25.1, -2.5, mat.azul);
    }

    // --------------------------------------------------------
    // 09. HIGIENE Y LIMPIEZA
    // --------------------------------------------------------

    function crearModuloHigiene(padre, nombre, x, z, color) {
        const g = grupo(nombre, padre, x, z);
        const ancho = 2.8;
        const niveles = [0.43, 0.78, 1.13, 1.48, 1.83];

        caja(g, 'Panel_trasero', 0, 0.98, -0.3, ancho, 1.95, 0.09, mat.gris);
        caja(g, 'Zocalo', 0, 0.12, 0.05, ancho, 0.24, 0.68, mat.estructura);

        niveles.forEach((y, i) => {
            caja(g, `Repisa_${i + 1}`, 0, y, 0.15,
                ancho - 0.12, 0.055, 0.60, mat.acero);
        });

        for (const dx of [-1.34, 1.34]) {
            caja(g, 'Montante', dx, 0.98, 0.15,
                0.07, 1.95, 0.07, mat.metal);
        }

        caja(g, 'Franja_identificacion', 0, 2.02, 0.02,
            ancho, 0.12, 0.12, color);

        registrarColision(nombre, x, z, 2.95, 0.85, {
            tipo: 'estanteria'
        });

        g.userData.nivelesProducto = niveles;
        return g;
    }

    {
        const dep = departamento('09_HIGIENE_Y_LIMPIEZA');

        crearModuloHigiene(dep, 'Modulo_higiene', 28.3, 3.3, mat.azul);
        crearModuloHigiene(dep, 'Modulo_limpieza', 28.3, 8.0, mat.verde);
    }

    // --------------------------------------------------------
    // 10. DEPARTAMENTO DE ROPA
    // --------------------------------------------------------

    function crearPerchero(padre, nombre, x, z) {
        const g = grupo(nombre, padre, x, z);
        const largo = 2.7;
        const alto = 1.75;

        caja(g, 'Base', 0, 0.09, 0, largo + 0.2, 0.16, 0.72, mat.estructura);

        const barra = cilindro(g, 'Barra', 0, alto, 0, 0.045, largo, mat.acero);
        barra.rotation.z = Math.PI / 2;

        for (const dx of [-largo / 2 + 0.08, largo / 2 - 0.08]) {
            caja(g, 'Poste', dx, alto / 2, 0, 0.08, alto, 0.08, mat.metal);
        }

        registrarColision(nombre, x, z, 3.0, 0.85, {
            tipo: 'perchero'
        });

        return g;
    }

    function crearMesaRopa(padre, nombre, x, z) {
        const g = grupo(nombre, padre, x, z);

        caja(g, 'Tablero', 0, 0.82, 0, 2.1, 0.14, 1.2, mat.maderaClara);
        caja(g, 'Cuerpo', 0, 0.43, 0, 1.95, 0.64, 1.05, mat.blanco);

        registrarColision(nombre, x, z, 2.3, 1.4, {
            tipo: 'mesa'
        });

        g.userData.superficieProductoY = 0.89;
        return g;
    }

    {
        const dep = departamento('10_DEPARTAMENTO_ROPA');

        crearPerchero(dep, 'Perchero_ropa_01', -25.7, -4);
        crearPerchero(dep, 'Perchero_ropa_02', -25.7, 2);
        crearPerchero(dep, 'Perchero_ropa_03', -25.7, 8);

        crearMesaRopa(dep, 'Mesa_ropa_01', -21.3, -1);
        crearMesaRopa(dep, 'Mesa_ropa_02', -21.3, 4.5);
    }

    // --------------------------------------------------------
    // 11. CAJAS REGISTRADORAS
    // --------------------------------------------------------

    function crearCajaRegistradora(padre, nombre, x, z, numero) {
        const g = grupo(nombre, padre, x, z);

        caja(g, 'Mueble', 0, 0.54, 0, 2.8, 1.02, 1.18, mat.blanco);
        caja(g, 'Panel_frontal', 0, 0.53, 0.61, 2.58, 0.65, 0.045, mat.azul);
        caja(g, 'Cubierta', 0, 1.08, 0, 2.92, 0.12, 1.28, mat.oscuro);
        caja(g, 'Banda', -0.56, 1.17, -0.06, 1.25, 0.06, 0.76, mat.goma);
        caja(g, 'Escaner', 0.25, 1.18, 0.02, 0.27, 0.07, 0.28, mat.oscuro);
        caja(g, 'Cristal_escaner', 0.25, 1.22, 0.02, 0.18, 0.015, 0.18, mat.luz);
        caja(g, 'Soporte_monitor', 0.83, 1.27, -0.32, 0.07, 0.30, 0.07, mat.metal);
        caja(g, 'Monitor', 0.83, 1.49, -0.32, 0.46, 0.32, 0.10, mat.oscuro);
        caja(g, 'Pantalla', 0.83, 1.49, -0.265, 0.37, 0.23, 0.015, mat.azulOscuro);

        g.userData.numeroCaja = numero;

        registrarColision(nombre, x, z, 3.05, 1.45, {
            tipo: 'caja'
        });

        return g;
    }

    {
        const dep = departamento('11_CAJAS_REGISTRADORAS');

        [
            [-22, 22.5], [-17, 22.5], [-12, 22.5],
            [12, 22.5], [17, 22.5], [22, 22.5]
        ].forEach(([x, z], i) => {
            crearCajaRegistradora(
                dep,
                `Caja_registradora_${String(i + 1).padStart(2, '0')}`,
                x, z, i + 1
            );
        });
    }

    // --------------------------------------------------------
    // 12. MESAS AUXILIARES
    // --------------------------------------------------------

    function crearMesaAuxiliar(padre, nombre, x, z, ancho = 1.7, fondo = 0.85) {
        const g = grupo(nombre, padre, x, z);

        caja(g, 'Cubierta', 0, 0.82, 0, ancho, 0.12, fondo, mat.acero);

        for (const dx of [-ancho / 2 + 0.12, ancho / 2 - 0.12]) {
            for (const dz of [-fondo / 2 + 0.1, fondo / 2 - 0.1]) {
                caja(g, 'Pata', dx, 0.4, dz, 0.09, 0.8, 0.09, mat.estructura);
            }
        }

        registrarColision(nombre, x, z, ancho + 0.1, fondo + 0.1, {
            tipo: 'mesa'
        });

        return g;
    }

    {
        const dep = departamento('12_MESAS_AUXILIARES');

        crearMesaAuxiliar(dep, 'Mesa_apoyo_01', 21.8, 6);
        crearMesaAuxiliar(dep, 'Mesa_apoyo_02', 21.8, 10);
    }

    // --------------------------------------------------------
    // 13. CARRITOS Y CANASTILLAS
    // --------------------------------------------------------

    function crearCarritoMobiliario(padre, nombre, x, z) {
        const g = grupo(nombre, padre, x, z);

        caja(g, 'Canastilla', 0, 0.80, 0, 0.78, 0.40, 0.95, mat.metal);
        caja(g, 'Base', 0, 0.46, 0, 0.70, 0.07, 0.78, mat.oscuro);
        caja(g, 'Asa', 0, 1.04, -0.54, 0.66, 0.06, 0.07, mat.azul);

        for (const y of [0.66, 0.78, 0.90]) {
            caja(g, 'Barra_lateral', -0.40, y, 0, 0.035, 0.035, 0.88, mat.acero);
            caja(g, 'Barra_lateral', 0.40, y, 0, 0.035, 0.035, 0.88, mat.acero);
        }

        for (const dx of [-0.29, 0.29]) {
            for (const dz of [-0.32, 0.32]) {
                const rueda = cilindro(
                    g, 'Rueda', dx, 0.24, dz,
                    0.09, 0.07, mat.goma
                );
                rueda.rotation.z = Math.PI / 2;
            }
        }

        registrarColision(nombre, x, z, 0.95, 1.1, {
            tipo: 'carrito'
        });

        return g;
    }

    {
        const dep = departamento('13_CARRITOS_Y_CANASTILLAS');

        crearCarritoMobiliario(dep, 'Carrito_01', -7.0, 25.1);
        crearCarritoMobiliario(dep, 'Carrito_02', -8.1, 25.1);
        crearCarritoMobiliario(dep, 'Carrito_03', -9.2, 25.1);

        crearMuebleSimple(
            dep, 'Estacion_canastillas',
            -5.5, 25.0, 1.5, 1.35, 0.85, mat.azul
        );
    }

    // --------------------------------------------------------
    // 14. AUTOSERVICIO
    // --------------------------------------------------------

    function crearAutocobro(padre, nombre, x, z, numero) {
        const g = grupo(nombre, padre, x, z);

        caja(g, 'Base', 0, 0.48, 0, 1.35, 0.90, 1.10, mat.blanco);
        caja(g, 'Zocalo', 0, 0.10, 0, 1.42, 0.16, 1.15, mat.estructura);
        caja(g, 'Cubierta', 0, 0.96, 0, 1.45, 0.10, 1.20, mat.oscuro);
        caja(g, 'Soporte_pantalla', 0, 1.20, -0.30, 0.10, 0.42, 0.10, mat.metal);
        caja(g, 'Monitor', 0, 1.48, -0.30, 0.55, 0.42, 0.10, mat.oscuro);
        caja(g, 'Pantalla', 0, 1.48, -0.242, 0.46, 0.32, 0.018, mat.azulOscuro);
        caja(g, 'Escaner', -0.38, 1.04, 0.18, 0.30, 0.055, 0.25, mat.acero);
        caja(g, 'Terminal', 0.40, 1.05, 0.20, 0.26, 0.08, 0.22, mat.oscuro);

        g.userData.numeroAutocobro = numero;

        registrarColision(nombre, x, z, 1.55, 1.3, {
            tipo: 'autocobro'
        });

        return g;
    }

    {
        const dep = departamento('14_AUTOCObRO');

        crearAutocobro(dep, 'Autocobro_01', -7.0, 19.1, 1);
        crearAutocobro(dep, 'Autocobro_02', -4.8, 19.1, 2);
    }

    // --------------------------------------------------------
    // 15. ATENCIÓN AL CLIENTE
    // --------------------------------------------------------

    {
        const dep = departamento('15_ATENCION_CLIENTE');

        const mostrador = crearMuebleSimple(
            dep, 'Mostrador_atencion',
            7.5, 19, 2.5, 1.0, 1.05, mat.blanco,
            { tipo: 'mostrador' }
        );

        caja(
            mostrador, 'Franja_frontal',
            0, 0.03, 0.54,
            2.3, 0.55, 0.045, mat.azul
        );
    }

    // --------------------------------------------------------
    // 16. BÁSCULAS
    // --------------------------------------------------------

    function crearBascula(padre, nombre, x, z) {
        const g = grupo(nombre, padre, x, z);

        caja(g, 'Base', 0, 0.18, 0, 0.75, 0.36, 0.65, mat.acero);
        caja(g, 'Plataforma', 0, 0.40, 0, 0.80, 0.08, 0.70, mat.oscuro);
        caja(g, 'Columna', 0, 0.92, -0.22, 0.08, 1.0, 0.08, mat.metal);
        caja(g, 'Pantalla', 0, 1.43, -0.22, 0.48, 0.30, 0.08, mat.oscuro);

        registrarColision(nombre, x, z, 0.95, 0.85, {
            tipo: 'bascula'
        });

        return g;
    }

    {
        const dep = departamento('16_BASCULAS');

        crearBascula(dep, 'Bascula_frescos_01', -27, 8.2);
        crearBascula(dep, 'Bascula_frescos_02', -27, 12);
    }

    // --------------------------------------------------------
    // 17. ALMACÉN INDUSTRIAL
    // --------------------------------------------------------

    function crearRackIndustrial(padre, nombre, x, z, largo = 4.8) {
        const g = grupo(nombre, padre, x, z);
        const ancho = 2.2;
        const alto = 3.0;

        for (const dx of [-ancho / 2, ancho / 2]) {
            for (const dz of [-largo / 2, largo / 2]) {
                caja(g, 'Montante', dx, alto / 2, dz,
                    0.09, alto, 0.09, mat.azulOscuro);

                caja(g, 'Placa_base', dx, 0.06, dz,
                    0.22, 0.10, 0.22, mat.estructura);
            }
        }

        for (const y of [0.45, 1.25, 2.05, 2.80]) {
            caja(g, `Nivel_carga_${y}`, 0, y, 0,
                ancho, 0.10, largo, mat.naranja);

            caja(g, `Superficie_${y}`, 0, y + 0.06, 0,
                ancho - 0.12, 0.035, largo - 0.12, mat.acero);
        }

        registrarColision(nombre, x, z, ancho + 0.15, largo + 0.15, {
            tipo: 'rack_almacen'
        });

        return g;
    }

    function crearMesaAlmacen(padre, nombre, x, z) {
        const g = grupo(nombre, padre, x, z);

        caja(g, 'Tablero', 0, 0.95, 0, 2.0, 0.12, 1.0, mat.acero);

        for (const dx of [-0.85, 0.85]) {
            for (const dz of [-0.38, 0.38]) {
                caja(g, 'Pata', dx, 0.47, dz,
                    0.10, 0.94, 0.10, mat.estructura);
            }
        }

        caja(g, 'Repisa_inferior', 0, 0.32, 0,
            1.85, 0.08, 0.85, mat.metal);

        registrarColision(nombre, x, z, 2.2, 1.2, {
            tipo: 'mesa_almacen'
        });

        return g;
    }

    {
        const dep = departamento('17_ALMACEN_INDUSTRIAL');

        crearRackIndustrial(dep, 'Rack_almacen_01', -24.0, -22.0);
        crearRackIndustrial(dep, 'Rack_almacen_02', -19.8, -22.0);
        crearRackIndustrial(dep, 'Rack_almacen_03', 19.8, -22.0);
        crearRackIndustrial(dep, 'Rack_almacen_04', 24.0, -22.0);

        crearMesaAlmacen(dep, 'Mesa_preparacion_01', -18.5, -17.0);
        crearMesaAlmacen(dep, 'Mesa_preparacion_02', 18.5, -17.0);
    }

    // --------------------------------------------------------
    // 18. SEÑALIZACIÓN
    // --------------------------------------------------------

    const materialesLetreros = new Map();

    function obtenerMaterialLetrero(texto, colorFondo) {
        const clave = `${texto}|${colorFondo}`;

        if (materialesLetreros.has(clave)) {
            return materialesLetreros.get(clave);
        }

        let material;

        if (typeof document !== 'undefined') {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 128;

            const ctx = canvas.getContext('2d');

            ctx.fillStyle = `#${colorFondo.toString(16).padStart(6, '0')}`;
            ctx.fillRect(0, 0, 512, 128);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 30px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(texto, 256, 64, 480);

            const textura = new THREE.CanvasTexture(canvas);
            textura.colorSpace = THREE.SRGBColorSpace;

            material = new THREE.MeshStandardMaterial({
                map: textura,
                roughness: 0.65
            });
        } else {
            material = new THREE.MeshStandardMaterial({
                color: colorFondo
            });
        }

        materialesLetreros.set(clave, material);
        return material;
    }

    function crearLetrero(
        padre, nombre, texto,
        x, y, z, colorFondo = 0x176eb0
    ) {
        const g = grupo(nombre, padre, x, z);
        g.position.y = y;

        const material = obtenerMaterialLetrero(texto, colorFondo);

        caja(g, 'Panel', 0, 0, 0,
            3.2, 0.65, 0.12, material);

        for (const dx of [-1.2, 1.2]) {
            caja(g, 'Soporte', dx, -0.55, 0,
                0.055, 0.55, 0.055, mat.metal);
        }

        return g;
    }

    {
        const dep = departamento('18_SENALIZACION');

        crearLetrero(dep, 'Letrero_lacteos', 'LACTEOS Y REFRIGERADOS', -13, 3.3, -22);
        crearLetrero(dep, 'Letrero_abarrotes', 'ABARROTES', -9, 3.3, -6.5, 0x31834b);
        crearLetrero(dep, 'Letrero_abarrotes_2', 'ABARROTES', 13, 3.3, -6.5, 0x31834b);
        crearLetrero(dep, 'Letrero_ropa', 'ROPA', -24, 3, 0, 0x153c55);
        crearLetrero(dep, 'Letrero_panaderia', 'PANADERIA', 25, 3, 18, 0xe99535);
        crearLetrero(dep, 'Letrero_cajas', 'CAJAS Y AUTOSERVICIO', 0, 3.2, 24);
    }

    // --------------------------------------------------------
    // 19. FILAS DE CAJAS
    // --------------------------------------------------------

    {
        const dep = departamento('19_FILAS_CAJAS');

        for (const [i, x] of [-24, -19, -14, 14, 19, 24].entries()) {
            const g = grupo(
                `Poste_fila_${String(i + 1).padStart(2, '0')}`,
                dep, x, 24.7
            );

            cilindro(g, 'Base', 0, 0.06, 0,
                0.16, 0.12, mat.estructura, 12);

            cilindro(g, 'Poste', 0, 0.48, 0,
                0.045, 0.80, mat.acero, 8);

            cilindro(g, 'Tapa', 0, 0.90, 0,
                0.08, 0.08, mat.oscuro, 8);

            registrarColision(g.name, x, 24.7, 0.28, 0.28, {
                tipo: 'poste'
            });
        }
    }

    // --------------------------------------------------------
    // 20. ILUMINACIÓN
    //
    // Los paneles siguen siendo visibles.
    // Se limita el número de luces dinámicas activas para
    // reducir el coste de iluminación por fotograma.
    // La iluminación general debe venir de main.js.
    // --------------------------------------------------------

    const iluminacion = grupo('20_ILUMINACION_MOBILIARIO');

    let lucesRealesActivas = 0;
    const MAX_LUCES_REALES = 5;

    function crearLuminaria(
        nombre, x, y, z,
        color = 0xfff1d6,
        intensidad = 22,
        alcance = 15,
        tamanoX = 2.4,
        tamanoZ = 0.45
    ) {
        const g = new THREE.Group();
        g.name = nombre;
        g.position.set(x, y, z);

        const carcasa = new THREE.Mesh(
            obtenerCaja(tamanoX + 0.12, 0.10, tamanoZ + 0.12),
            mat.oscuro
        );

        carcasa.name = 'Carcasa_luminaria';
        carcasa.castShadow = false;
        carcasa.receiveShadow = false;
        g.add(carcasa);

        const materialPanel = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.65,
            roughness: 0.55
        });

        const panel = new THREE.Mesh(
            obtenerCaja(tamanoX, 0.035, tamanoZ),
            materialPanel
        );

        panel.name = 'Panel_luminoso';
        panel.position.y = -0.06;
        panel.castShadow = false;
        panel.receiveShadow = false;
        g.add(panel);

        const luz = new THREE.PointLight(
            color,
            lucesRealesActivas < MAX_LUCES_REALES ? intensidad : 0,
            alcance,
            2
        );

        luz.name = `Luz_${nombre}`;
        luz.position.set(0, -0.18, 0);
        luz.castShadow = false;
        luz.userData.intensidadBase = intensidad;
        luz.userData.luzReducida = lucesRealesActivas >= MAX_LUCES_REALES;

        if (lucesRealesActivas < MAX_LUCES_REALES) {
            lucesRealesActivas++;
        }

        g.add(luz);
        iluminacion.add(g);
        luminarias.push({ nombre, grupo: g, luz });

        return g;
    }

    [
        [-18, 4.7, -15], [0, 4.7, -15], [18, 4.7, -15],
        [-18, 4.7, 0], [0, 4.7, 0], [18, 4.7, 0],
        [-18, 4.7, 15], [0, 4.7, 15], [18, 4.7, 15]
    ].forEach(([x, y, z], i) => {
        crearLuminaria(
            `Luminaria_pasillos_${String(i + 1).padStart(2, '0')}`,
            x, y, z, 0xfff1dc, 22, 16, 2.6, 0.48
        );
    });

    [
        [-25, 3, -25.5], [-18, 3, -25.5],
        [18, 3, -25.5], [25, 3, -25.5]
    ].forEach(([x, y, z], i) => {
        crearLuminaria(
            `Luminaria_refrigeradores_${i + 1}`,
            x, y, z, 0xe8f7ff, 18, 9, 1.8, 0.35
        );
    });

    [
        [-22, 3, 22.5], [-12, 3, 22.5],
        [12, 3, 22.5], [22, 3, 22.5]
    ].forEach(([x, y, z], i) => {
        crearLuminaria(
            `Luminaria_cajas_${i + 1}`,
            x, y, z, 0xfff4e5, 18, 9, 1.8, 0.35
        );
    });

    crearLuminaria(
        'Luminaria_frutas_verduras',
        -23.5, 3, 13, 0xfff1d6, 20, 10, 2.2, 0.45
    );

    crearLuminaria(
        'Luminaria_panaderia',
        25, 3, 13, 0xffe4bd, 18, 9, 2.0, 0.40
    );

    [
        [-22, 4, -22], [0, 4, -22], [22, 4, -22]
    ].forEach(([x, y, z], i) => {
        crearLuminaria(
            `Luminaria_almacen_${i + 1}`,
            x, y, z, 0xfff0d8, 22, 13, 2.0, 0.42
        );
    });

    // --------------------------------------------------------
    // API PÚBLICA
    // --------------------------------------------------------

    mobiliario.userData.obtenerLuminarias = () => luminarias;

    mobiliario.userData.encenderIluminacion = () => {
        luminarias.forEach(({ luz, grupo }) => {
            grupo.visible = true;
            luz.visible = true;
        });
    };

    mobiliario.userData.apagarIluminacion = () => {
        luminarias.forEach(({ luz, grupo }) => {
            luz.visible = false;
            grupo.visible = false;
        });
    };

    mobiliario.userData.ajustarIntensidadIluminacion = (multiplicador = 1) => {
        const factor = THREE.MathUtils.clamp(multiplicador, 0, 3);

        luminarias.forEach(({ luz }) => {
            luz.intensity = luz.userData.luzReducida
                ? 0
                : luz.userData.intensidadBase * factor;
        });
    };

    mobiliario.userData.ocultarDepartamento = (nombre, ocultar = true) => {
        if (!departamentos[nombre]) {
            console.warn(`No existe el departamento: ${nombre}`);
            return false;
        }

        departamentos[nombre].visible = !ocultar;
        return true;
    };

    mobiliario.userData.mostrarDepartamento = nombre => {
        if (!departamentos[nombre]) return false;

        departamentos[nombre].visible = true;
        return true;
    };

    mobiliario.userData.mostrarTodo = () => {
        Object.values(departamentos).forEach(dep => {
            dep.visible = true;
        });
    };

    mobiliario.userData.ocultarTodo = () => {
        Object.values(departamentos).forEach(dep => {
            dep.visible = false;
        });
    };

    mobiliario.userData.listarDepartamentos = () =>
        Object.keys(departamentos);

    mobiliario.userData.obtenerDepartamento = nombre =>
        departamentos[nombre] ?? null;

    mobiliario.userData.obtenerColisiones = () =>
        colisiones.map(c => ({ ...c }));

    mobiliario.userData.colisiones = colisiones;
    mobiliario.userData.mercado = mercado;

    mobiliario.userData.coordenadas = {
        edificio: {
            minX: -32,
            maxX: 32,
            minZ: -29,
            maxZ: 29
        },
        gondolasX: [-17, -9, 9, 17],
        gondolasZ: [-13, 0, 13],
        entradaZ: 29,
        almacenZ: -29
    };

    mobiliario.userData.estadisticasOptimizacion = {
        geometríasCajaReutilizadas: geometríasCaja.size,
        geometríasCilindroReutilizadas: geometríasCilindro.size,
        materialesLetrerosReutilizados: materialesLetreros.size,
        luminarias: luminarias.length,
        lucesRealesActivas: lucesRealesActivas,
        colisiones: colisiones.length
    };

    scene.add(mobiliario);

    console.info('Mobiliario del supermercado creado.');
    console.info('Departamentos:', Object.keys(departamentos));
    console.info('Optimización:', mobiliario.userData.estadisticasOptimizacion);
    console.info(`Obstáculos registrados: ${colisiones.length}`);

    return mobiliario;
}
