
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

    let listaProductos = [];
    let indiceProducto = 0;

    let animacionTiempo = 0;

    const direccion = new THREE.Vector3();
    const objetivoMovimiento = new THREE.Vector3();

    const huesos = {};

    let mixer = null;
    let accionCaminar = null;
    let accionReposo = null;

    const relojAnimacion = new THREE.Clock();

    const provisional = new THREE.Group();
    grupo.add(provisional);

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

    function cargarModelo() {
        loader.load(
            config.modelo,

            gltf => {
                if (eliminado) return;

                provisional.clear();

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

                grupo.add(modelo);

                modelo.traverse(objeto => {
                    if (objeto.isBone) {
                        huesos[objeto.name.toLowerCase()] = objeto;
                    }
                });

                if (gltf.animations?.length) {
                    mixer = new THREE.AnimationMixer(modelo);

                    const caminar = gltf.animations.find(a =>
                        /walk|caminar|walking/i.test(a.name)
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

    function animarCaminar(activo) {
        if (accionCaminar && accionReposo) {
            if (activo) {
                accionReposo.stop();
                accionCaminar.reset().play();
            } else {
                accionCaminar.stop();
                accionReposo.reset().play();
            }

            return;
        }

        const fase = animacionTiempo * 7;

        const piernaIzquierda = provisional.getObjectByName(
            'PIERNA_IZQUIERDA'
        );

        const piernaDerecha = provisional.getObjectByName(
            'PIERNA_DERECHA'
        );

        const brazoIzquierdo = provisional.getObjectByName(
            'BRAZO_IZQUIERDO'
        );

        const brazoDerecho = provisional.getObjectByName(
            'BRAZO_DERECHO'
        );

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

    function obtenerRaizProducto(objeto) {
        let actual = objeto;

        while (
            actual.parent &&
            actual.parent !== scene &&
            actual.parent.name !== 'PRODUCTOS_SUPERMERCADO'
        ) {
            if (
                actual.userData?.codigo ||
                actual.userData?.nombre
            ) {
                return actual;
            }

            actual = actual.parent;
        }

        return actual;
    }

    function esUnidadProducto(objeto) {
        if (!objeto?.isObject3D) return false;

        const datos = objeto.userData || {};

        return (
            datos.esUnidadProducto === true ||
            datos.tipo === 'producto' ||
            datos.esProducto === true ||
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
                datos.vendido
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

        if (Array.isArray(config.productos)) {
            for (const producto of config.productos) {
                if (producto?.isObject3D) {
                    agregar(producto);
                } else if (producto?.objeto?.isObject3D) {
                    agregar(producto.objeto);
                }
            }
        } else if (config.productos?.isObject3D) {
            config.productos.traverse(agregar);
        } else {
            const contenedor = scene.getObjectByName(
                'PRODUCTOS_SUPERMERCADO'
            );

            if (contenedor) {
                contenedor.traverse(agregar);
            } else {
                scene.traverse(agregar);
            }
        }

        return resultado;
    }

    function buscarProducto() {
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

        const posicion = candidatos[0].posicion;

        establecerDestino({
            x: posicion.x,
            z: posicion.z + 1.1
        });

        estado = estados.ACERcANDO;
    }

    function establecerDestino(punto) {
        if (!punto) return;

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

        const distancia = Math.sqrt(dx * dx + dz * dz);

        if (distancia < 0.16) {
            grupo.position.x = destino.x;
            grupo.position.z = destino.z;

            animarCaminar(false);

            return true;
        }

        const avance = Math.min(
            distancia,
            velocidad * delta
        );

        grupo.position.x += dx / distancia * avance;
        grupo.position.z += dz / distancia * avance;

        const angulo = Math.atan2(dx, dz);

        grupo.rotation.y = angulo;

        animacionTiempo += delta;

        animarCaminar(true);

        return false;
    }

    function liberarReservaProducto() {
        if (!productoObjetivo) return;

        productosReservadosGlobal.delete(
            productoObjetivo.uuid
        );

        productoObjetivo = null;
    }

    function recogerProducto() {
        if (!productoObjetivo || eliminado) {
            estado = estados.BUSCANDO;
            return;
        }

        const objeto = productoObjetivo;

        const datos = objeto.userData || {};

        const registro = {
            id: objeto.uuid,
            uuid: objeto.uuid,
            codigo: datos.codigo || objeto.name,
            nombre: datos.nombre || objeto.name || 'Producto',
            precio: Number(datos.precio || 0),
            objeto
        };

        const carrito = config.carrito;

        if (!carrito?.agregarProducto) {
            liberarReservaProducto();
            estado = estados.ESPERANDO;
            return;
        }

        const agregado = carrito.agregarProducto(registro);

        if (!agregado) {
            liberarReservaProducto();
            estado = estados.ESPERANDO;
            return;
        }

        compras.push(registro);

        productosCompradosGlobal.add(objeto.uuid);

        datos.esUnidadProducto = true;
        datos.enCarrito = true;
        datos.recogido = true;
        datos.disponible = false;

        liberarReservaProducto();

        productoEnMano = null;

        if (typeof config.alComprar === 'function') {
            config.alComprar(registro, api);
        }

        indiceProducto++;

        estado = estados.ESPERANDO;
        tiempoEstado = 0;
    }

    function actualizarCompra(delta) {
        if (estado === estados.BUSCANDO) {
            buscarProducto();
            return;
        }

        if (estado === estados.ACERcANDO) {
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
                recogerProducto();
            }

            return;
        }

        if (estado === estados.ESPERANDO) {
            tiempoEstado += delta;

            if (tiempoEstado >= config.tiempoEntreProductos) {
                estado = estados.BUSCANDO;
                tiempoEstado = 0;
            }
        }
    }

    function establecerRuta(nuevaRuta, repetir = config.repetirRuta) {
        ruta = Array.isArray(nuevaRuta)
            ? nuevaRuta.map(punto => ({
                x: punto.x,
                z: punto.z
            }))
            : [];

        indiceRuta = 0;

        config.repetirRuta = repetir;

        estado = ruta.length
            ? estados.RUTA
            : estados.BUSCANDO;
    }

    function actualizarRuta(delta) {
        if (!ruta.length) {
            estado = estados.BUSCANDO;
            return;
        }

        const punto = ruta[indiceRuta];

        establecerDestino(punto);

        if (moverHaciaDestino(delta)) {
            indiceRuta++;

            if (indiceRuta >= ruta.length) {
                if (config.repetirRuta) {
                    indiceRuta = 0;
                } else {
                    ruta = [];
                    estado = estados.BUSCANDO;
                }
            }
        }
    }

    function iniciarDesdeVehiculo(posicionEntrada, plaza) {
        if (eliminado) return;

        plazaVehiculo = plaza;

        estado = estados.ENTRANDO;
        entro = false;

        const puntos = [
            { x: plaza.x, z: plaza.z + 5 },
            { x: plaza.x, z: 78 },
            { x: 0, z: 78 },
            { x: 0, z: 83 },
            { x: 0, z: 32 },
            { x: 0, z: 26 }
        ];

        grupo.position.set(
            posicionEntrada.x,
            posicionEntrada.y || 0,
            posicionEntrada.z
        );

        establecerRuta(puntos, false);

        estado = estados.ENTRANDO;
    }

    function finalizarEntrada() {
        entro = true;

        grupo.position.set(0, 0, 26);

        if (typeof config.alEntrar === 'function') {
            config.alEntrar(api);
        }

        estado = estados.BUSCANDO;
        tiempoEstado = 0;
    }

    function iniciarPago(posicionCaja, callback) {
        if (eliminado) return;

        callbackPago = callback || null;

        estado = estados.CAJA;

        establecerDestino({
            x: posicionCaja.x,
            z: posicionCaja.z
        });
    }

    function completarPago() {
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

    function iniciarRegresoVehiculo(plaza, callback) {
        if (eliminado) return;

        plazaVehiculo = plaza;
        callbackRegreso = callback || null;

        estado = estados.REGRESANDO;

        ruta = [
            { x: 0, z: 25.5 },
            { x: 0, z: 30.5 },
            { x: 0, z: 34 },
            { x: 0, z: 78 },
            { x: 0, z: 83 },
            { x: plaza.x, z: 83 },
            { x: plaza.x, z: plaza.z + 5 },
            { x: plaza.x, z: plaza.z }
        ];

        indiceRuta = 0;
    }

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

    function finalizarRegreso() {
        estado = estados.FINALIZADO;

        const callback = callbackRegreso;
        callbackRegreso = null;

        if (callback) callback(api);

        if (typeof config.alFinalizar === 'function') {
            config.alFinalizar(api);
        }
    }

    function actualizar(delta = 0.016) {
        if (eliminado) return;

        const dt = Math.min(Math.max(delta, 0), 0.05);

        if (mixer) {
            mixer.update(dt);
        }

        switch (estado) {
            case estados.INACTIVO:
            case estados.FINALIZADO:
                animarCaminar(false);
                break;

            case estados.ENTRANDO:
                actualizarRuta(dt);

                if (estado === estados.BUSCANDO) {
                    finalizarEntrada();
                }
                break;

            case estados.BUSCANDO:
            case estados.ACERcANDO:
            case estados.RECOGIENDO:
            case estados.ESPERANDO:
                actualizarCompra(dt);
                break;

            case estados.RUTA:
                actualizarRuta(dt);
                break;

            case estados.CAJA:
                if (moverHaciaDestino(dt)) {
                    completarPago();
                }
                break;

            case estados.PAGANDO:
                animarCaminar(false);
                break;

            case estados.REGRESANDO:
                actualizarRuta(dt);

                if (estado === estados.BUSCANDO) {
                    finalizarRegreso();
                }
                break;
        }
    }

    function configurarCompras(opciones = {}) {
        if (opciones.productos) {
            config.productos = opciones.productos;
        }

        if (opciones.carrito) {
            config.carrito = opciones.carrito;
        }

        estado = estados.BUSCANDO;
        tiempoEstado = 0;
    }

    function establecerPosicion(posicion) {
        if (!posicion) return;

        grupo.position.set(
            posicion.x ?? grupo.position.x,
            posicion.y ?? grupo.position.y,
            posicion.z ?? grupo.position.z
        );
    }

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

        compras.length = 0;
    }

    cargarModelo();

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

    return api;
}
