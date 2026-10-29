
import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';

export async function crearFisica({
  mercado,
  camara,
  posicionInicial = { x: 0, y: 0.88, z: 45 }
}) {
  await RAPIER.init();

  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0
  });

  world.timestep = 1 / 60;

  const gravedad = -18;
  const alturaCamara = 0.82;
  const cuerposDinamicos = [];
  const cuerposEstaticos = [];
  const cuerposPorObjeto = new Map();

  const sueloBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.15, 0)
  );

  world.createCollider(
    RAPIER.ColliderDesc.cuboid(150, 0.15, 150)
      .setFriction(0.9),
    sueloBody
  );

  cuerposEstaticos.push(sueloBody);

  function crearColliderEstatico(objeto) {
    objeto.updateWorldMatrix(true, false);

    const caja = new THREE.Box3().setFromObject(objeto);

    if (caja.isEmpty()) return;

    const tamano = new THREE.Vector3();
    const centro = new THREE.Vector3();

    caja.getSize(tamano);
    caja.getCenter(centro);

    if (
      tamano.x < 0.08 ||
      tamano.y < 0.08 ||
      tamano.z < 0.08
    ) {
      return;
    }

    const cuerpo = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(
        centro.x,
        centro.y,
        centro.z
      )
    );

    world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        Math.max(tamano.x / 2, 0.04),
        Math.max(tamano.y / 2, 0.04),
        Math.max(tamano.z / 2, 0.04)
      ).setFriction(0.8),
      cuerpo
    );

    cuerposEstaticos.push(cuerpo);
  }

  function crearObjetoDinamico(objeto) {
    const config = objeto.userData?.fisica;

    if (!config?.dinamico || objeto.userData.fisicaCreada) {
      return;
    }

    objeto.updateWorldMatrix(true, true);

    const posicion = new THREE.Vector3();
    const escala = new THREE.Vector3();
    const rotacion = new THREE.Quaternion();

    objeto.getWorldPosition(posicion);
    objeto.getWorldScale(escala);
    objeto.getWorldQuaternion(rotacion);

    const medidas = config.halfExtents || {
      x: 0.2,
      y: 0.2,
      z: 0.2
    };

    const cuerpo = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(posicion.x, posicion.y, posicion.z)
        .setRotation({
          x: rotacion.x,
          y: rotacion.y,
          z: rotacion.z,
          w: rotacion.w
        })
        .setLinearDamping(config.amortiguacion ?? 0.6)
        .setAngularDamping(config.amortiguacionAngular ?? 1.2)
        .setCanSleep(true)
    );

    const collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        Math.max(medidas.x * escala.x, 0.04),
        Math.max(medidas.y * escala.y, 0.04),
        Math.max(medidas.z * escala.z, 0.04)
      )
        .setDensity(config.densidad ?? 1)
        .setFriction(config.friccion ?? 0.75)
        .setRestitution(config.restitucion ?? 0.03),
      cuerpo
    );

    objeto.userData.fisicaCreada = true;

    const entrada = {
      objeto,
      cuerpo,
      collider,
      tipo: config.tipo || 'producto'
    };

    cuerposDinamicos.push(entrada);
    cuerposPorObjeto.set(objeto, entrada);
  }

  if (mercado) {
    mercado.updateWorldMatrix(true, true);

    const estaticos = [];
    const dinamicos = [];

    mercado.traverse((objeto) => {
      if (objeto.userData?.fisicaEstatica && objeto.isMesh) {
        estaticos.push(objeto);
      }

      if (objeto.userData?.fisica?.dinamico) {
        dinamicos.push(objeto);
      }
    });

    const limiteCollidersEstaticos = 500;

    for (
      let i = 0;
      i < Math.min(estaticos.length, limiteCollidersEstaticos);
      i++
    ) {
      crearColliderEstatico(estaticos[i]);
    }

    for (const objeto of dinamicos) {
      crearObjetoDinamico(objeto);
    }
  }

  const jugadorBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(
        posicionInicial.x,
        posicionInicial.y,
        posicionInicial.z
      )
  );

  const jugadorCollider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.52, 0.28)
      .setFriction(0)
      .setRestitution(0),
    jugadorBody
  );

  const controlador = world.createCharacterController(0.04);

  controlador.setSlideEnabled(true);
  controlador.setMaxSlopeClimbAngle(Math.PI / 3);
  controlador.setMinSlopeSlideAngle(Math.PI / 4);
  controlador.setApplyImpulsesToDynamicBodies(true);

  let velocidadVertical = 0;
  let enSuelo = false;
  let saltoPendiente = false;
  const desplazamiento = new THREE.Vector3();
  let tiempoSimulacion = 0;

  function moverJugador(x, z) {
    desplazamiento.set(
      Number.isFinite(x) ? x : 0,
      0,
      Number.isFinite(z) ? z : 0
    );
  }

  function saltar() {
    if (enSuelo) {
      saltoPendiente = true;
    }
  }

  function actualizarObjetoVisual(entrada) {
    const { objeto, cuerpo } = entrada;
    const posicion = cuerpo.translation();
    const rotacion = cuerpo.rotation();

    const posicionMundo = new THREE.Vector3(
      posicion.x,
      posicion.y,
      posicion.z
    );

    const rotacionMundo = new THREE.Quaternion(
      rotacion.x,
      rotacion.y,
      rotacion.z,
      rotacion.w
    );

    if (objeto.parent) {
      objeto.parent.updateWorldMatrix(true, false);

      const posicionLocal = objeto.parent.worldToLocal(
        posicionMundo.clone()
      );

      const rotacionPadre = objeto.parent.getWorldQuaternion(
        new THREE.Quaternion()
      );

      objeto.position.copy(posicionLocal);
      objeto.quaternion.copy(
        rotacionPadre.invert().multiply(rotacionMundo)
      );
    } else {
      objeto.position.copy(posicionMundo);
      objeto.quaternion.copy(rotacionMundo);
    }

    objeto.updateMatrix();
  }

  function actualizar(delta, sincronizarCamara = true) {
    const dt = Math.min(
      Math.max(Number.isFinite(delta) ? delta : 1 / 60, 0.001),
      0.033
    );

    if (saltoPendiente && enSuelo) {
      velocidadVertical = 7;
      enSuelo = false;
    }

    saltoPendiente = false;
    velocidadVertical += gravedad * dt;

    const movimientoDeseado = {
      x: desplazamiento.x,
      y: velocidadVertical * dt,
      z: desplazamiento.z
    };

    controlador.computeColliderMovement(
      jugadorCollider,
      movimientoDeseado
    );

    const movimientoCorregido = controlador.computedMovement();

    if (controlador.computedGrounded()) {
      enSuelo = true;

      if (velocidadVertical < 0) {
        velocidadVertical = 0;
      }
    } else {
      enSuelo = false;
    }

    const posicionActual = jugadorBody.translation();

    jugadorBody.setNextKinematicTranslation({
      x: posicionActual.x + movimientoCorregido.x,
      y: posicionActual.y + movimientoCorregido.y,
      z: posicionActual.z + movimientoCorregido.z
    });

    world.timestep = dt;
    world.step();

    for (const entrada of cuerposDinamicos) {
      actualizarObjetoVisual(entrada);
    }

    const posicionJugador = jugadorBody.translation();

    if (sincronizarCamara && camara) {
      camara.position.set(
        posicionJugador.x,
        posicionJugador.y + alturaCamara,
        posicionJugador.z
      );
    }

    desplazamiento.set(0, 0, 0);
    tiempoSimulacion += dt;
  }

  function aplicarImpulso(objeto, impulso = {}) {
    const entrada = cuerposPorObjeto.get(objeto);

    if (!entrada) return false;

    entrada.cuerpo.applyImpulse(
      {
        x: impulso.x ?? 0,
        y: impulso.y ?? 2,
        z: impulso.z ?? 0
      },
      true
    );

    return true;
  }

  function obtenerPosicionJugador() {
    const posicion = jugadorBody.translation();

    return {
      x: posicion.x,
      y: posicion.y,
      z: posicion.z
    };
  }

  function obtenerEstado() {
    return {
      enSuelo,
      velocidadVertical,
      objetosDinamicos: cuerposDinamicos.length,
      cuerposEstaticos: cuerposEstaticos.length,
      tiempoSimulacion
    };
  }

  function registrarObjetoDinamico(objeto, config = {}) {
    if (!objeto?.isObject3D) return false;

    objeto.userData.fisica = {
      dinamico: true,
      tipo: config.tipo || 'producto',
      halfExtents: config.halfExtents || {
        x: 0.2,
        y: 0.2,
        z: 0.2
      },
      densidad: config.densidad ?? 1,
      friccion: config.friccion ?? 0.75,
      restitucion: config.restitucion ?? 0.03,
      amortiguacion: config.amortiguacion ?? 0.6,
      amortiguacionAngular: config.amortiguacionAngular ?? 1.2
    };

    crearObjetoDinamico(objeto);

    return cuerposPorObjeto.has(objeto);
  }

  function destruir() {
    world.free();
    cuerposDinamicos.length = 0;
    cuerposEstaticos.length = 0;
    cuerposPorObjeto.clear();
  }

  return {
    world,
    actualizar,
    moverJugador,
    saltar,
    aplicarImpulso,
    obtenerPosicionJugador,
    obtenerEstado,
    registrarObjetoDinamico,
    destruir,
    cuerposDinamicos,
    cuerposEstaticos,
    jugadorBody,
    jugadorCollider
  };
}
