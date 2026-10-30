
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

const productosCompradosGlobal = new Set();
const productosReservadosGlobal = new Map();

const CONFIG_BASE = {
    modelo: '/modelos/Cliente1.glb',

    posicion: { x: 0, y: 0, z: 20 },

    altura: 1.75,
    escala: 1,
    velocidad: 1.5,

    repetirRuta: false,
    inactivo: false,

    probabilidadCompra: 0.85,
    distanciaProducto: 1.25,
    tiempoSeleccionProducto: 2.5,
    tiempoEntreProductos: 1.5,

    maximoProductos: 3,

    radioColision: 0.65,

    limiteX: 29,
    limiteZMin: -27,
    limiteZMax: 27,

    ruta: [],
    productos: [],
    carrito: null,

    alEntrar: null,
    alComprar: null,
    alPagar: null,
    alFinalizar: null
};

const estados = {
    INACTIVO: 'inactivo',
    ENTRANDO: 'entrandoSupermercado',
    BUSCANDO: 'buscandoProducto',
    ACERCANDO: 'acercandoseProducto',
    RECOGIENDO: 'recogiendoProducto',
    ESPERANDO: 'esperandoEntreProductos',
    RUTA: 'recorriendoRuta',
    CAJA: 'yendoCaja',
    PAGANDO: 'pagando',
    REGRESANDO: 'regresandoVehiculo',
    FINALIZADO: 'finalizado'
};

export function crearClienteSupermercado(scene, opciones = {}) {
    if (!scene) {
        throw new Error('crearClienteSupermercado necesita una escena.');
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
    grupo.name = config.id || 'CLIENTE_SUPERMERCADO';

    grupo.position.set(
        config.posicion.x,
        config.posicion.y,
        config.posicion.z
    );

    grupo.scale.setScalar(config.escala);
    scene.add(grupo);

    let eliminado = false;
    let cargado = false;
    let entro = false;
    let compraConfirmada = false;
    let pagoConfirmado = false;

    let estado = config.inactivo
        ? estados.INACTIVO
        : estados.BUSCANDO;

    let velocidad = config.velocidad;

    let ruta = [];
    let indiceRuta = 0;

    let destino = null;
    let tiempoEstado = 0;

    let plazaVehiculo = null;
    let callbackRegreso = null;
    let callbackPago = null;

    let compras = [];

    let productoObjetivo = null;
    let productoEnMano = null;

    let animacionTiempo = 0;
    let probabilidadEvaluada = false;
    let debeComprar = false;

    const huesos = {};

    let mixer = null;
    let accionCaminar = null;
    let accionReposo = null;

    const provisional = new THREE.Group();
    provisional.name = 'MODELO_PROVISIONAL_CLIENTE';
    grupo.add(provisional);

    // ========================================================
    // MODELO PROVISIONAL
    // ========================================================

    function crearMaterial(color, roughness = 0.8) {
        return new THREE.MeshStandardMaterial({
            color,
            roughness
        });
    }

    function crearModeloProvisional() {
        provisional.clear();

        const piel = crearMaterial(0xd7a77c);
        const camisa = crearMaterial(0x2471a3);
        const pantalon = crearMaterial(0x263b55);
        const zapatos = crearMaterial(0x171717);

        function caja(nombre, dimensiones, material, posicion) {
            const malla = new THREE.Mesh(
                new THREE.BoxGeometry(...dimensiones),
                material
            );

            malla.name = nombre;
            malla.position.set(...posicion);
            provisional.add(malla);

            return malla;
        }

        function esfera(nombre, escala, material, posicion) {
            const malla = new THREE.Mesh(
                new THREE.SphereGeometry(1, 12, 10),
                material
            );

            malla.name = nombre;
            malla.scale.set(...escala);
            malla.position.set(...posicion);
            provisional.add(malla);

            return malla;
        }

        caja('TORSO', [0.42, 0.55, 0.24], camisa, [0, 1.12, 0]);

        caja('PIERNA_IZQUIERDA', [0.16, 0.48, 0.18], pantalon, [-0.12, 0.62, 0]);
        caja('PIERNA_DERECHA', [0.16, 0.48, 0.18], pantalon, [0.12, 0.62, 0]);

        caja('BRAZO_IZQUIERDO', [0.13, 0.48, 0.13], camisa, [-0.29, 1.1, 0]);
        caja('BRAZO_DERECHO', [0.13, 0.48, 0.13], camisa, [0.29, 1.1, 0]);

        esfera('CABEZA', [0.17, 0.19, 0.17], piel, [0, 1.52, 0]);

        caja('ZAPATO_IZQUIERDO', [0.19, 0.09, 0.29], zapatos, [-0.12, 0.32, 0.045]);
        caja('ZAPATO_DERECHO', [0.19, 0.09, 0.29], zapatos, [0.12, 0.32, 0.045]);

        cargado = true;
    }

    // ========================================================
    // CARGA DEL MODELO GLB
    // ========================================================

    function cargarModelo() {
        loader.load(
            config.modelo,

            gltf => {
                if (eliminado) return;

                const modelo = gltf.scene;
                modelo.name = 'MODELO_CLIENTE';

                const caja = new THREE.Box3().setFromObject(modelo);

                if (!caja.isEmpty()) {
                    const centro = caja.getCenter(new THREE.Vector3());

                    modelo.position.x -= centro.x;
                    modelo.position.z -= centro.z;

                    const cajaNueva = new THREE.Box3().setFromObject(modelo);
                    modelo.position.y -= cajaNueva.min.y;
                }

                modelo.traverse(objeto => {
                    if (objeto.isBone) {
                        huesos[objeto.name.toLowerCase()] = objeto;
                    }

                    if (objeto.isMesh) {
                        objeto.castShadow = false;
                        objeto.receiveShadow = false;
                    }
                });

                provisional.visible = false;
                grupo.add(modelo);

                if (gltf.animations?.length) {
                    mixer = new THREE.AnimationMixer(modelo);

                    const caminar = gltf.animations.find(a =>
                        /walk|caminar|walking|run/i.test(a.name)
                    );

                    const reposo = gltf.animations.find(a =>
                        /idle|rest|reposo/i.test(a.name)
                    );

                    if (caminar) {
                        accionCaminar = mixer.clipAction(caminar);
                    }

                    if (reposo) {
                        accionReposo = mixer.clipAction(reposo);
                        accionReposo.play();
                    }
                }

                cargado = true;

                console.info(`[CLIENTE] Modelo cargado: ${config.modelo}`);
            },

            undefined,

            error => {
                console.warn(
                    `No se pudo cargar el modelo ${config.modelo}:`,
                    error
                );

                if (!eliminado) {
                    crearModeloProvisional();
                }
            }
        );
    }

    // ========================================================
    // ANIMACIÓN
    // ========================================================

    function animarCaminar(activo) {
        if (accionCaminar) {
            if (activo) {
                accionReposo?.stop();

                if (!accionCaminar.isRunning()) {
                    accionCaminar.reset().play();
                }
            } else {
                accionCaminar.stop();

                if (accionReposo && !accionReposo.isRunning()) {
                    accionReposo.reset().play();
                }
            }

            return;
        }

        const fase = animacionTiempo * 7;

        const piernaIzquierda = provisional.getObjectByName('PIERNA_IZQUIERDA');
        const piernaDerecha = provisional.getObjectByName('PIERNA_DERECHA');
        const brazoIzquierdo = provisional.getObjectByName('BRAZO_IZQUIERDO');
        const brazoDerecho = provisional.getObjectByName('BRAZO_DERECHO');

        if (activo) {
            if (piernaIzquierda) {
                piernaIzquierda.rotation.x = Math.sin(fase) * 0.45;
            }

            if (piernaDerecha) {
                piernaDerecha.rotation.x = -Math.sin(fase) * 0.45;
            }

            if (brazoIzquierdo) {
                brazoIzquierdo.rotation.x = -Math.sin(fase) * 0.3;
            }

            if (brazoDerecho) {
                brazoDerecho.rotation.x = Math.sin(fase) * 0.3;
            }
        } else {
            if (piernaIzquierda) piernaIzquierda.rotation.x = 0;
            if (piernaDerecha) piernaDerecha.rotation.x = 0;
            if (brazoIzquierdo) brazoIzquierdo.rotation.x = 0;
            if (brazoDerecho) brazoDerecho.rotation.x = 0;
        }
    }

    // ========================================================
    // DETECCIÓN DE PRODUCTOS
    // ========================================================

    function obtenerRaizProducto(objeto) {
        let actual = objeto;

        while (actual && actual !== scene) {
            if (esUnidadProducto(actual)) {
                return actual;
            }

            actual = actual.parent;
        }

        return objeto;
    }

    function esUnidadProducto(objeto) {
        if (!objeto?.isObject3D) return false;

        const datos = objeto.userData || {};

        return (
            datos.esUnidadProducto === true ||
            datos.tipo === 'producto' ||
            datos.esProducto === true ||
            Boolean(datos.codigoProducto) ||
            Boolean(datos.skuProducto) ||
            Boolean(datos.codigo && datos.nombre)
        );
    }

    function listarProductosDisponibles() {
        const resultado = [];
        const encontrados = new Set();

        function agregar(objeto) {
            if (!esUnidadProducto(objeto)) return;

            const raiz = obtenerRaizProducto(objeto);

            if (!raiz || encontrados.has(raiz.uuid)) return;

            const datos = raiz.userData || {};

            if (
                datos.disponible === false ||
                datos.enCarrito ||
                datos.recogido ||
                datos.vendido ||
                datos.reservado
            ) {
                return;
            }

            if (
                productosCompradosGlobal.has(raiz.uuid) ||
                productosReservadosGlobal.has(raiz.uuid)
            ) {
                return;
            }

            encontrados.add(raiz.uuid);
            resultado.push(raiz);
        }

        const contenedor = Array.isArray(config.productos)
            ? null
            : config.productos?.isObject3D
                ? config.productos
                : scene.getObjectByName('PRODUCTOS_SUPERMERCADO');

        if (Array.isArray(config.productos)) {
            for (const producto of config.productos) {
                agregar(producto?.objeto || producto);
            }
        } else if (contenedor) {
            contenedor.traverse(agregar);
        }

        return resultado;
    }

    // ========================================================
    // MOVIMIENTO
    // ========================================================

    function establecerDestino(punto) {
        if (!punto) {
            destino = null;
            return;
        }

        destino = new THREE.Vector3(
            punto.x,
            0,
            punto.z
        );
    }

    function moverHaciaDestino(delta) {
        if (!destino) return true;

        const dx = destino.x - grupo.position.x;
        const dz = destino.z - grupo.position.z;
        const distancia = Math.hypot(dx, dz);

        if (distancia < 0.16) {
            grupo.position.x = destino.x;
            grupo.position.z = destino.z;

            animarCaminar(false);
            return true;
        }

        const avance = Math.min(distancia, velocidad * delta);

        grupo.position.x += (dx / distancia) * avance;
        grupo.position.z += (dz / distancia) * avance;

        grupo.position.x = THREE.MathUtils.clamp(
            grupo.position.x,
            -config.limiteX,
            config.limiteX
        );

        grupo.position.z = THREE.MathUtils.clamp(
            grupo.position.z,
            config.limiteZMin,
            config.limiteZMax
        );

        grupo.rotation.y = Math.atan2(dx, dz);

        animacionTiempo += delta;
        animarCaminar(true);

        return false;
    }

    // ========================================================
    // RESERVAR Y LIBERAR PRODUCTOS
    // ========================================================

    function liberarReservaProducto() {
        if (!productoObjetivo) return;

        productosReservadosGlobal.delete(productoObjetivo.uuid);

        if (productoObjetivo.userData) {
            productoObjetivo.userData.reservado = false;
        }

        productoObjetivo = null;
    }

    function buscarProducto() {
        if (compras.length >= config.maximoProductos) {
            estado = estados.ESPERANDO;
            tiempoEstado = 0;
            return;
        }

        const disponibles = listarProductosDisponibles();

        if (!disponibles.length) {
            estado = estados.ESPERANDO;
            tiempoEstado = 0;
            return;
        }

        const candidatos = disponibles
            .map(objeto => {
                const posicion = new THREE.Vector3();

                objeto.getWorldPosition(posicion);

                return {
                    objeto,
                    posicion,
                    distancia: grupo.position.distanceTo(posicion)
                };
            })
            .filter(item => item.distancia < 25)
            .sort((a, b) => a.distancia - b.distancia);

        if (!candidatos.length) {
            estado = estados.ESPERANDO;
            tiempoEstado = 0;
            return;
        }

        productoObjetivo = candidatos[0].objeto;

        productosReservadosGlobal.set(
            productoObjetivo.uuid,
            grupo.uuid
        );

        productoObjetivo.userData.reservado = true;

        const posicion = candidatos[0].posicion;

        establecerDestino({
            x: posicion.x,
            z: posicion.z + 1.1
        });

        estado = estados.ACERCANDO;
    }

    // ========================================================
    // RECOGER PRODUCTO Y AGREGARLO AL CARRITO
    // ========================================================

    function recogerProducto() {
        if (!productoObjetivo || eliminado) {
            liberarReservaProducto();
            estado = estados.BUSCANDO;
            return;
        }

        const objeto = productoObjetivo;
        const datos = objeto.userData || {};

        const nombre =
            datos.nombreProducto ||
            datos.nombreVisible ||
            datos.nombreUnidad ||
            datos.nombre ||
            objeto.name ||
            'Producto';

        const codigo =
            datos.codigoProducto ||
            datos.codigoCatalogo ||
            datos.skuProducto ||
            datos.codigo ||
            objeto.name ||
            objeto.uuid;

        const registro = {
            id: datos.idUnidadProducto || objeto.uuid,
            uuid: objeto.uuid,
            codigo,
            nombre,
            precio: Number(datos.precio ?? 0),
            categoria: datos.categoria || 'General',
            objeto
        };

        const carrito = config.carrito;

        if (!carrito?.agregarProducto) {
            liberarReservaProducto();
            estado = estados.ESPERANDO;
            return;
        }

        const agregado = carrito.agregarProducto(registro);

        if (agregado === false) {
            liberarReservaProducto();
            estado = estados.ESPERANDO;
            tiempoEstado = 0;
            return;
        }

        compras.push(registro);
        productosCompradosGlobal.add(objeto.uuid);

        datos.esUnidadProducto = true;
        datos.enCarrito = true;
        datos.recogido = true;
        datos.disponible = false;
        datos.reservado = false;

        liberarReservaProducto();

        productoEnMano = null;

        if (typeof config.alComprar === 'function') {
            config.alComprar(registro, api);
        }

        estado = estados.ESPERANDO;
        tiempoEstado = 0;
    }

    // ========================================================
    // SISTEMA DE COMPRA
    // ========================================================

    function actualizarCompra(delta) {
        if (estado === estados.BUSCANDO) {
            buscarProducto();
            return;
        }

        if (estado === estados.ACERCANDO) {
            if (!productoObjetivo) {
                estado = estados.BUSCANDO;
                return;
            }

            const posicion = new THREE.Vector3();
            productoObjetivo.getWorldPosition(posicion);

            const distancia = grupo.position.distanceTo(posicion);

            if (distancia <= config.distanciaProducto + 0.7) {
                estado = estados.RECOGIENDO;
                tiempoEstado = 0;
                animarCaminar(false);
                return;
            }

            if (moverHaciaDestino(delta)) {
                estado = estados.RECOGIENDO;
                tiempoEstado = 0;
            }

            return;
        }

        if (estado === estados.RECOGIENDO) {
            tiempoEstado += delta;

            if (tiempoEstado >= config.tiempoSeleccionProducto) {
                if (!probabilidadEvaluada) {
                    probabilidadEvaluada = true;
                    debeComprar = Math.random() <= config.probabilidadCompra;
                }

                if (debeComprar) {
                    recogerProducto();
                } else {
                    liberarReservaProducto();

                    estado = estados.ESPERANDO;
                    tiempoEstado = 0;
                }
            }

            return;
        }

        if (estado === estados.ESPERANDO) {
            tiempoEstado += delta;

            if (tiempoEstado >= config.tiempoEntreProductos) {
                if (compras.length >= config.maximoProductos) {
                    estado = estados.BUSCANDO;
                    return;
                }

                probabilidadEvaluada = false;
                debeComprar = false;

                estado = estados.BUSCANDO;
                tiempoEstado = 0;
            }
        }
    }

    // ========================================================
    // ESTABLECER RUTA
    // ========================================================

    function establecerRuta(nuevaRuta, repetir = config.repetirRuta) {
        ruta = Array.isArray(nuevaRuta)
            ? nuevaRuta.map(punto => ({
                x: punto.x,
                z: punto.z
            }))
            : [];

        indiceRuta = 0;
        config.repetirRuta = repetir;
        destino = null;

        estado = ruta.length
            ? estados.RUTA
            : estados.BUSCANDO;
    }

    function actualizarRuta(delta) {
        if (!ruta.length) {
            if (estado === estados.ENTRANDO) {
                finalizarEntrada();
            } else if (estado === estados.REGRESANDO) {
                finalizarRegreso();
            } else {
                estado = estados.BUSCANDO;
            }

            return;
        }

        if (!destino) {
            establecerDestino(ruta[indiceRuta]);
        }

        if (moverHaciaDestino(delta)) {
            indiceRuta++;
            destino = null;

            if (indiceRuta >= ruta.length) {
                if (config.repetirRuta && estado === estados.RUTA) {
                    indiceRuta = 0;
                } else {
                    ruta = [];
                    indiceRuta = 0;

                    if (estado === estados.ENTRANDO) {
                        finalizarEntrada();
                    } else if (estado === estados.REGRESANDO) {
                        finalizarRegreso();
                    } else {
                        estado = estados.BUSCANDO;
                    }
                }
            }
        }
    }

    // ========================================================
    // ENTRAR DESDE EL VEHÍCULO
    // ========================================================

    function iniciarDesdeVehiculo(posicionEntrada, plaza) {
        if (eliminado || !posicionEntrada || !plaza) return;

        plazaVehiculo = { ...plaza };

        grupo.position.set(
            posicionEntrada.x,
            posicionEntrada.y || 0,
            posicionEntrada.z
        );

        entro = false;

        establecerRuta([
            {
                x: plaza.x,
                z: Math.min(27, plaza.z - 2)
            },
            {
                x: plaza.x,
                z: 27
            },
            {
                x: 0,
                z: 26
            }
        ], false);

        estado = estados.ENTRANDO;
    }

    function finalizarEntrada() {
        if (entro) return;

        entro = true;
        destino = null;

        if (typeof config.alEntrar === 'function') {
            config.alEntrar(api);
        }

        estado = estados.BUSCANDO;
        tiempoEstado = 0;
    }

    // ========================================================
    // IR A CAJA Y PAGAR
    // ========================================================

    function iniciarPago(posicionCaja, callback) {
        if (eliminado || !posicionCaja) return;

        liberarReservaProducto();

        callbackPago = callback || null;

        estado = estados.CAJA;

        establecerDestino({
            x: posicionCaja.x,
            z: posicionCaja.z
        });
    }

    function completarPago() {
        if (pagoConfirmado || eliminado) return;

        estado = estados.PAGANDO;

        pagoConfirmado = true;
        compraConfirmada = true;

        const resumen = obtenerResumenCompra();

        if (config.carrito?.confirmarVenta) {
            config.carrito.confirmarVenta();
        }

        if (typeof config.alPagar === 'function') {
            config.alPagar(resumen, api);
        }

        const callback = callbackPago;
        callbackPago = null;

        if (callback) callback(resumen);
    }

    // ========================================================
    // REGRESAR AL VEHÍCULO
    // ========================================================

    function iniciarRegresoVehiculo(plaza, callback) {
        if (eliminado || !plaza) return;

        plazaVehiculo = { ...plaza };
        callbackRegreso = callback || null;

        liberarReservaProducto();

        estado = estados.REGRESANDO;

        establecerRuta([
            { x: 0, z: 25.5 },
            { x: 0, z: 27 },
            { x: 0, z: 29 },
            { x: 0, z: 27 },
            { x: plaza.x, z: 27 },
            { x: plaza.x, z: Math.max(29, plaza.z - 2) },
            { x: plaza.x, z: plaza.z }
        ], false);

        estado = estados.REGRESANDO;
    }

    function finalizarRegreso() {
        estado = estados.FINALIZADO;
        destino = null;

        const callback = callbackRegreso;
        callbackRegreso = null;

        if (callback) callback(api);

        if (typeof config.alFinalizar === 'function') {
            config.alFinalizar(api);
        }
    }

    // ========================================================
    // INFORMACIÓN DE COMPRAS
    // ========================================================

    function obtenerCompras() {
        return [...compras];
    }

    function obtenerTotalCompra() {
        return compras.reduce(
            (total, producto) => total + producto.precio,
            0
        );
    }

    function obtenerResumenCompra() {
        return {
            cantidad: compras.length,
            total: obtenerTotalCompra(),
            productos: obtenerCompras()
        };
    }

    function confirmarCompra() {
        compraConfirmada = true;
        return obtenerResumenCompra();
    }

    // ========================================================
    // CONFIGURAR PRODUCTOS Y CARRITO
    // ========================================================

    function configurarCompras(opciones = {}) {
        if (opciones.productos) {
            config.productos = opciones.productos;
        }

        if (opciones.carrito) {
            config.carrito = opciones.carrito;
        }

        if (opciones.probabilidadCompra !== undefined) {
            config.probabilidadCompra = THREE.MathUtils.clamp(
                opciones.probabilidadCompra,
                0,
                1
            );
        }

        if (opciones.maximoProductos !== undefined) {
            config.maximoProductos = Math.max(
                1,
                Math.floor(opciones.maximoProductos)
            );
        }

        if (opciones.velocidad !== undefined) {
            velocidad = Math.max(0.1, opciones.velocidad);
        }

        estado = estados.BUSCANDO;
        tiempoEstado = 0;
    }

    // ========================================================
    // ESTABLECER POSICIÓN
    // ========================================================

    function establecerPosicion(posicion) {
        if (!posicion) return;

        grupo.position.set(
            posicion.x ?? grupo.position.x,
            posicion.y ?? grupo.position.y,
            posicion.z ?? grupo.position.z
        );
    }

    // ========================================================
    // ACTUALIZACIÓN PRINCIPAL
    // ========================================================

    function actualizar(delta = 0.016) {
        if (eliminado) return;

        const dt = Math.min(Math.max(delta, 0), 0.05);

        if (mixer) {
            mixer.update(dt);
        }

        switch (estado) {
            case estados.INACTIVO:
            case estados.FINALIZADO:
            case estados.PAGANDO:
                animarCaminar(false);
                break;

            case estados.ENTRANDO:
            case estados.RUTA:
            case estados.REGRESANDO:
                actualizarRuta(dt);
                break;

            case estados.BUSCANDO:
            case estados.ACERCANDO:
            case estados.RECOGIENDO:
            case estados.ESPERANDO:
                actualizarCompra(dt);
                break;

            case estados.CAJA:
                if (moverHaciaDestino(dt)) {
                    completarPago();
                }
                break;
        }
    }

    // ========================================================
    // ELIMINAR CLIENTE
    // ========================================================

    function eliminar() {
        if (eliminado) return;

        eliminado = true;

        liberarReservaProducto();

        grupo.removeFromParent();

        grupo.traverse(objeto => {
            if (!objeto.isMesh) return;

            objeto.geometry?.dispose();

            if (Array.isArray(objeto.material)) {
                objeto.material.forEach(material => material.dispose());
            } else {
                objeto.material?.dispose();
            }
        });

        mixer?.stopAllAction();

        compras.length = 0;
    }

    // ========================================================
    // API PÚBLICA
    // ========================================================

    const api = {
        grupo,

        actualizar,
        establecerRuta,
        establecerPosicion,

        configurarCompras,

        iniciarDesdeVehiculo,
        iniciarRegresoVehiculo,
        iniciarPago,

        obtenerCompras,
        obtenerTotalCompra,
        obtenerResumenCompra,
        confirmarCompra,

        eliminar,

        get cargado() {
            return cargado;
        },

        get huesos() {
            return huesos;
        },

        get estado() {
            return estado;
        },

        get eliminado() {
            return eliminado;
        },

        get entro() {
            return entro;
        },

        get compraConfirmada() {
            return compraConfirmada;
        },

        get pagoConfirmado() {
            return pagoConfirmado;
        },

        get resumenPago() {
            return obtenerResumenCompra();
        },

        get productoEnMano() {
            return productoEnMano;
        },

        get productoObjetivo() {
            return productoObjetivo;
        },

        get zona() {
            return estado;
        }
    };

    cargarModelo();

    return api;
}
