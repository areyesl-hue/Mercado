
export function crearInteracciones({ THREE, scene, camera, renderer, controls, mercado }) {
  const raycaster = new THREE.Raycaster()
  const centro = new THREE.Vector2(0, 0)
  const reloj = new THREE.Clock()

  const carrito = []
  const puertas = []
  let objetoSeleccionado = null
  let mensaje = 'Acércate a un producto y pulsa E'
  let tiempoMensaje = 0

  const catalogo = [
    { palabras: ['Detergente_Azul'], nombre: 'Detergente', precio: 42 },
    { palabras: ['Cloro_Blanco'], nombre: 'Cloro', precio: 28 },
    { palabras: ['Suavizante_Rosa'], nombre: 'Suavizante', precio: 39 },
    { palabras: ['Manzana_Roja'], nombre: 'Manzana roja', precio: 8 },
    { palabras: ['Manzana_Verde'], nombre: 'Manzana verde', precio: 9 },
    { palabras: ['Naranja'], nombre: 'Naranja', precio: 7 },
    { palabras: ['Limón'], nombre: 'Limón', precio: 5 },
    { palabras: ['Prenda_'], nombre: 'Prenda de ropa', precio: 149 },
    { palabras: ['Bebida_'], nombre: 'Bebida', precio: 18 },
    { palabras: ['Producto_'], nombre: 'Producto de supermercado', precio: 25 }
  ]

  const estilo = document.createElement('style')
  estilo.textContent = `
    #super-ui {
      position: fixed;
      z-index: 1000;
      top: 16px;
      right: 16px;
      width: 310px;
      max-height: 75vh;
      overflow-y: auto;
      color: #f5f7fa;
      background: rgba(15, 24, 34, .94);
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 14px;
      padding: 16px;
      font: 14px Arial, sans-serif;
      box-shadow: 0 8px 30px rgba(0,0,0,.35);
    }
    #super-ui h3 { margin: 0 0 10px; font-size: 18px; }
    #super-ui button {
      border: 0;
      border-radius: 7px;
      padding: 8px 10px;
      margin: 3px;
      cursor: pointer;
      font-weight: bold;
    }
    #super-ui .accion { background: #1684d6; color: white; }
    #super-ui .borrar { background: #c93c48; color: white; }
    #super-ui .fila {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid #ffffff20;
      padding: 7px 0;
    }
    #super-ui .secundario { color: #c5d1dc; font-size: 12px; }
    #super-ui .total { font-size: 20px; font-weight: bold; margin-top: 12px; }
    #super-mensaje {
      position: fixed;
      z-index: 999;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(10,20,30,.9);
      color: white;
      padding: 12px 18px;
      border-radius: 10px;
      font: 14px Arial, sans-serif;
      pointer-events: none;
      max-width: 80vw;
      text-align: center;
    }
    #super-mira {
      position: fixed;
      z-index: 998;
      left: 50%;
      top: 50%;
      width: 7px;
      height: 7px;
      margin: -3px;
      border-radius: 50%;
      background: white;
      box-shadow: 0 0 4px #000;
      pointer-events: none;
    }
  `
  document.head.appendChild(estilo)

  const panel = document.createElement('div')
  panel.id = 'super-ui'
  panel.innerHTML = `
    <h3>🛒 Mi carrito</h3>
    <div class="secundario">Pulsa E mirando un producto para agregarlo.</div>
    <div id="super-lista"></div>
    <div class="total">Total: <span id="super-total">$0.00</span></div>
    <button class="accion" id="super-finalizar">Finalizar compra</button>
    <button class="borrar" id="super-vaciar">Vaciar</button>
    <div class="secundario" id="super-estado" style="margin-top:8px"></div>
  `
  document.body.appendChild(panel)

  const aviso = document.createElement('div')
  aviso.id = 'super-mensaje'
  aviso.textContent = mensaje
  document.body.appendChild(aviso)

  const mira = document.createElement('div')
  mira.id = 'super-mira'
  document.body.appendChild(mira)

  function avisar(texto, duracion = 2.5) {
    mensaje = texto
    tiempoMensaje = duracion
    aviso.textContent = texto
    aviso.style.display = 'block'
  }

  function precioDe(objeto) {
    const nombre = objeto.name || ''
    for (const item of catalogo) {
      if (item.palabras.some(p => nombre.includes(p))) {
        return { nombre: item.nombre, precio: item.precio }
      }
    }

    const padre = objeto.parent
    if (padre?.userData?.producto) {
      return {
        nombre: padre.userData.nombre || padre.name,
        precio: Number(padre.userData.precio) || 25
      }
    }

    return {
      nombre: nombre.replaceAll('_', ' '),
      precio: 25
    }
  }

  function esProducto(objeto) {
    if (!objeto) return false

    if (objeto.userData?.producto) return true

    const nombre = objeto.name || ''
    return [
      'Detergente_Azul',
      'Cloro_Blanco',
      'Suavizante_Rosa',
      'Manzana_Roja',
      'Manzana_Verde',
      'Naranja_',
      'Limón_',
      'Prenda_',
      '_Producto_',
      '_Bebida_'
    ].some(p => nombre.includes(p))
  }

  function actualizarCarrito() {
    const lista = document.getElementById('super-lista')
    const totalTexto = document.getElementById('super-total')
    lista.innerHTML = ''

    let total = 0

    carrito.forEach((item, indice) => {
      total += item.precio * item.cantidad

      const fila = document.createElement('div')
      fila.className = 'fila'

      const info = document.createElement('div')
      info.innerHTML = `
        <strong>${item.nombre}</strong>
        <div class="secundario">$${item.precio.toFixed(2)} × ${item.cantidad}</div>
      `

      const controles = document.createElement('div')
      const menos = document.createElement('button')
      menos.textContent = '−'
      menos.className = 'accion'
      menos.onclick = () => cambiarCantidad(indice, -1)

      const mas = document.createElement('button')
      mas.textContent = '+'
      mas.className = 'accion'
      mas.onclick = () => cambiarCantidad(indice, 1)

      controles.append(menos, mas)
      fila.append(info, controles)
      lista.appendChild(fila)
    })

    totalTexto.textContent = `$${total.toFixed(2)}`

    document.getElementById('super-estado').textContent =
      carrito.reduce((s, p) => s + p.cantidad, 0) + ' artículos en el carrito'
  }

  function cambiarCantidad(indice, cambio) {
    if (!carrito[indice]) return
    carrito[indice].cantidad += cambio

    if (carrito[indice].cantidad <= 0) {
      carrito.splice(indice, 1)
    }

    actualizarCarrito()
  }

  function agregarProducto(objeto) {
    const datos = precioDe(objeto)
    const existente = carrito.find(p => p.nombre === datos.nombre)

    if (existente) {
      existente.cantidad++
    } else {
      carrito.push({
        nombre: datos.nombre,
        precio: datos.precio,
        cantidad: 1
      })
    }

    actualizarCarrito()
    avisar(`${datos.nombre} agregado. $${datos.precio.toFixed(2)}`)
  }

  function totalCompra() {
    return carrito.reduce((total, item) => total + item.precio * item.cantidad, 0)
  }

  function finalizarCompra() {
    if (carrito.length === 0) {
      avisar('Tu carrito está vacío.')
      return
    }

    const compra = {
      fecha: new Date().toISOString(),
      productos: carrito.map(p => ({ ...p })),
      total: totalCompra()
    }

    const historial = JSON.parse(
      sessionStorage.getItem('supermercado_historial') || '[]'
    )
    historial.push(compra)
    sessionStorage.setItem('supermercado_historial', JSON.stringify(historial))

    avisar(`Compra de $${compra.total.toFixed(2)} registrada en esta sesión.`)
    carrito.length = 0
    actualizarCarrito()
  }

  document.getElementById('super-vaciar').addEventListener('click', () => {
    carrito.length = 0
    actualizarCarrito()
    avisar('Carrito vaciado.')
  })

  document.getElementById('super-finalizar').addEventListener('click', finalizarCompra)

  function lanzarRayoDesdeCentro() {
    raycaster.setFromCamera(centro, camera)
    return raycaster.intersectObjects(mercado.children, true)
  }

  function seleccionarObjeto() {
    const impactos = lanzarRayoDesdeCentro()
    const impacto = impactos.find(hit => {
      let actual = hit.object
      while (actual && actual !== mercado) {
        if (esProducto(actual)) return true
        actual = actual.parent
      }
      return false
    })

    if (!impacto) {
      avisar('Mira directamente a un producto y pulsa E.')
      return
    }

    let actual = impacto.object
    while (actual && actual !== mercado && !esProducto(actual)) {
      actual = actual.parent
    }

    if (actual) {
      objetoSeleccionado = actual
      agregarProducto(actual)
    }
  }

  function buscarPuertas() {
    mercado.traverse(obj => {
      if (
        obj.isMesh &&
        (obj.name === 'Puerta_Trasera_Carga_HojaIzquierdaAbierta' ||
         obj.name === 'Puerta_Trasera_Carga_HojaDerechaAbierta')
      ) {
        puertas.push({
          objeto: obj,
          lado: obj.name.includes('Izquierda') ? -1 : 1,
          xAbierta: obj.position.x,
          xCerrada: obj.position.x + (obj.name.includes('Izquierda') ? 4.0 : -4.0),
          abierta: true,
          objetivo: obj.position.x
        })
      }
    })
  }

  buscarPuertas()

  function alternarPuerta() {
    const puerta = puertas.find(p => {
      const dx = camera.position.x - p.objeto.position.x
      const dz = camera.position.z - p.objeto.position.z
      return Math.hypot(dx, dz) < 5
    })

    if (!puerta) {
      avisar('Acércate a la puerta trasera de carga para abrirla o cerrarla.')
      return
    }

    const cerrada = puertas.some(p => !p.abierta)
    const nuevoEstado = cerrada

    puertas.forEach(p => {
      p.abierta = nuevoEstado
      p.objetivo = nuevoEstado ? p.xAbierta : p.xCerrada
    })

    avisar(nuevoEstado ? 'Puerta de carga abierta.' : 'Puerta de carga cerrándose.')
  }

  function actualizarPuertas(delta) {
    for (const puerta of puertas) {
      const diferencia = puerta.objetivo - puerta.objeto.position.x
      puerta.objeto.position.x += diferencia * Math.min(1, delta * 3.5)
    }
  }

  function esObstaculo(obj) {
    if (!obj.isMesh || !obj.visible) return false

    const n = obj.name || ''
    if (
      n.includes('Techo') ||
      n.includes('Pantalla') ||
      n.includes('Luz_') ||
      n.includes('Letrero') ||
      n.includes('Producto_') ||
      n.includes('Bebida_') ||
      n.includes('Prenda_') ||
      n.includes('Manzana_') ||
      n.includes('Naranja_') ||
      n.includes('Limón_') ||
      n.includes('Detergente') ||
      n.includes('Cloro') ||
      n.includes('Suavizante') ||
      n.includes('HojaIzquierdaAbierta') ||
      n.includes('HojaDerechaAbierta')
    ) return false

    return /Muro_|Fachada_|Gondola_|Rack_Almacen|Caja_Cobro|Refrigerador_|Estante_Limpieza|Conector_Pared|Mesa_Fruta|Perchero_Poste|Perchero_Barra|Puerta_Interior_Almacen_Marco/.test(n)
  }

  const obstaculos = []
  mercado.traverse(obj => {
    if (esObstaculo(obj)) {
      obstaculos.push(obj)
    }
  })

  const cajaTemporal = new THREE.Box3()
  const centroTemporal = new THREE.Vector3()

  function posicionLibre(x, z) {
    const radio = 0.42
    const alturaCamara = camera.position.y
    const pieY = alturaCamara - 1.65

    for (const obj of obstaculos) {
      cajaTemporal.setFromObject(obj)

      if (cajaTemporal.max.y < pieY + 0.15) continue
      if (cajaTemporal.min.y > alturaCamara + 0.25) continue

      centroTemporal.set(
        Math.max(cajaTemporal.min.x, Math.min(x, cajaTemporal.max.x)),
        0,
        Math.max(cajaTemporal.min.z, Math.min(z, cajaTemporal.max.z))
      )

      const dx = x - centroTemporal.x
      const dz = z - centroTemporal.z

      if (dx * dx + dz * dz < radio * radio) {
        return false
      }
    }

    return true
  }

  function moverConColision(dx, dz) {
    const x = camera.position.x
    const z = camera.position.z

    if (posicionLibre(x + dx, z)) {
      camera.position.x = x + dx
    }

    if (posicionLibre(camera.position.x, z + dz)) {
      camera.position.z = z + dz
    }
  }

  function alPresionarTecla(evento) {
    if (evento.repeat) return

    if (evento.code === 'KeyE') {
      const puertaCercana = puertas.some(p => {
        const dx = camera.position.x - p.objeto.position.x
        const dz = camera.position.z - p.objeto.position.z
        return Math.hypot(dx, dz) < 5
      })

      if (puertaCercana) {
        alternarPuerta()
      } else {
        seleccionarObjeto()
      }
    }

    if (evento.code === 'Escape') {
      aviso.style.display = 'block'
    }
  }

  function alHacerClic(evento) {
    if (evento.target.closest('#super-ui')) return
    if (controls?.isLocked) return

    const rect = renderer.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((evento.clientX - rect.left) / rect.width) * 2 - 1,
      -((evento.clientY - rect.top) / rect.height) * 2 + 1
    )

    raycaster.setFromCamera(mouse, camera)
    const impactos = raycaster.intersectObjects(mercado.children, true)

    const impacto = impactos.find(hit => {
      let actual = hit.object
      while (actual && actual !== mercado) {
        if (esProducto(actual)) return true
        actual = actual.parent
      }
      return false
    })

    if (!impacto) return

    let actual = impacto.object
    while (actual && actual !== mercado && !esProducto(actual)) {
      actual = actual.parent
    }

    if (actual) agregarProducto(actual)
  }

  window.addEventListener('keydown', alPresionarTecla)
  renderer.domElement.addEventListener('click', alHacerClic)

  function actualizar(delta) {
    actualizarPuertas(delta)

    if (tiempoMensaje > 0) {
      tiempoMensaje -= delta
      if (tiempoMensaje <= 0) {
        aviso.textContent = 'Pulsa E mirando un producto para agregarlo.'
      }
    }
  }

  function destruir() {
    window.removeEventListener('keydown', alPresionarTecla)
    renderer.domElement.removeEventListener('click', alHacerClic)
    estilo.remove()
    panel.remove()
    aviso.remove()
    mira.remove()
  }

  actualizarCarrito()

  return {
    actualizar,
    moverConColision,
    agregarProducto,
    totalCompra,
    obtenerCarrito: () => carrito.map(p => ({ ...p })),
    destruir
  }
}