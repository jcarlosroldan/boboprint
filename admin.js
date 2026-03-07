// ── Hannya Labs Admin Panel ────────────────────────────────
// Gestión de productos vía GitHub Contents API (sin backend)
// ──────────────────────────────────────────────────────────

'use strict'

// ── Estado global ─────────────────────────────────────────
let config = null              // { pat, repo, passwordHash } desde localStorage
let products = []              // copia en memoria del JSON
let productsSha = null         // SHA actual de products.json en GitHub
let currentProductId = null
let pendingImageUpload = null  // { filename, base64content }
let isDirty = false

const CONFIG_KEY  = 'hannya_config'
const SESSION_KEY = 'hannya_authed'

// ── Utilidades ────────────────────────────────────────────
function slugify(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
}

async function hashPassword(pwd) {
  const encoder = new TextEncoder()
  const data = encoder.encode(pwd)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function showStatus(el, msg, type = 'info') {
  el.textContent = msg
  el.className = 'status-msg ' + type
}

function clearStatus(el) {
  el.textContent = ''
  el.className = 'status-msg'
}

function setDirty(val) {
  isDirty = val
  const syncBtn = document.getElementById('sync-btn')
  if (syncBtn) {
    syncBtn.textContent = val ? 'Sync to GitHub *' : 'Sync to GitHub'
    syncBtn.style.borderColor = val ? 'var(--accent)' : ''
    syncBtn.style.color = val ? 'var(--accent)' : ''
  }
}

// ── GitHub API ────────────────────────────────────────────
async function githubGet(path) {
  const url = `https://api.github.com/repos/${config.repo}/contents/${path}`
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${config.pat}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const e = new Error(err.message || `HTTP ${res.status}`)
    e.status = res.status
    throw e
  }
  return res.json()
}

async function githubPut(path, base64Content, sha, message) {
  const url = `https://api.github.com/repos/${config.repo}/contents/${path}`
  const body = { message, content: base64Content }
  if (sha) body.sha = sha
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${config.pat}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const e = new Error(err.message || `HTTP ${res.status}`)
    e.status = res.status
    throw e
  }
  return res.json()
}

async function loadProducts() {
  try {
    const data = await githubGet('products.json')
    const decoded = JSON.parse(atob(data.content.replace(/\s/g, '')))
    products = decoded.products || []
    productsSha = data.sha
  } catch (e) {
    if (e.status === 404) {
      products = []
      productsSha = null
    } else {
      throw e
    }
  }
}

async function saveToGitHub() {
  const statusEl = document.getElementById('admin-status')
  const syncBtn  = document.getElementById('sync-btn')
  syncBtn.disabled = true
  showStatus(statusEl, 'Sincronizando...', 'info')

  try {
    // 1. Subir imagen pendiente si existe
    if (pendingImageUpload) {
      await githubPut(
        pendingImageUpload.filename,
        pendingImageUpload.base64content,
        undefined,
        `Add product image: ${pendingImageUpload.filename}`
      )
      pendingImageUpload = null
    }

    // 2. Codificar JSON en base64 con soporte Unicode
    const json = JSON.stringify({ products }, null, 2)
    const base64 = btoa(unescape(encodeURIComponent(json)))

    // 3. Subir products.json
    const result = await githubPut(
      'products.json',
      base64,
      productsSha || undefined,
      'Update products.json'
    )
    productsSha = result.content.sha

    setDirty(false)
    showStatus(statusEl, '✓ Guardado en GitHub. GitHub Actions redesplegará en ~30s.', 'success')
  } catch (e) {
    if (e.status === 409) {
      showStatus(statusEl, 'Conflicto de SHA — recargando desde GitHub...', 'warning')
      try {
        await loadProducts()
        showStatus(statusEl, 'SHA actualizado. Vuelve a pulsar Sync.', 'warning')
      } catch {
        showStatus(statusEl, 'Error al recargar. Revisa tu conexión.', 'error')
      }
    } else if (e.status === 401 || e.status === 403) {
      showStatus(statusEl, 'PAT inválido o sin permisos suficientes.', 'error')
    } else {
      showStatus(statusEl, 'Error: ' + e.message, 'error')
    }
  } finally {
    syncBtn.disabled = false
  }
}

// ── Gestión de imágenes ───────────────────────────────────
function handleImageFileChange(e) {
  const file = e.target.files[0]
  if (!file) return

  if (file.size > 2 * 1024 * 1024) {
    const statusEl = document.getElementById('admin-status')
    showStatus(statusEl, 'Aviso: la imagen supera 2MB. GitHub puede rechazarla.', 'warning')
  }

  const reader = new FileReader()
  reader.onload = ev => {
    const dataUrl = ev.target.result
    const base64 = dataUrl.split(',')[1]

    // Generar nombre de archivo
    const currentProduct = products.find(p => p.id === currentProductId)
    const nameSlug = currentProduct ? slugify(currentProduct.nameEs || 'producto') : 'producto'
    const ext = file.name.split('.').pop().toLowerCase()
    const filename = `img/products/${nameSlug}-${Date.now()}.${ext}`

    pendingImageUpload = { filename, base64content: base64 }

    // Actualizar producto con la ruta futura
    if (currentProductId) {
      const p = products.find(p => p.id === currentProductId)
      if (p) p.image = filename
    }

    // Preview
    updateImagePreview(dataUrl, filename)
    setDirty(true)
  }
  reader.readAsDataURL(file)
}

function updateImagePreview(src, filename) {
  const wrap = document.getElementById('img-preview-wrap')
  if (!wrap) return
  if (src) {
    wrap.innerHTML = `
      <img src="${src}" alt="Preview">
      <p class="image-preview-label">${filename || ''}</p>
    `
  } else {
    wrap.innerHTML = `
      <div class="upload-placeholder">
        <strong>Haz clic para seleccionar imagen</strong>
        <br>JPG, PNG, WebP — máx. recomendado 2MB
      </div>
    `
  }
}

// ── Renderizado del panel ─────────────────────────────────
const CATEGORIES = ['figuras', 'maquetas', 'decoracion', 'cosplay', 'props', 'prototipos']
const CAT_LABELS = {
  figuras:    'Figuras',
  maquetas:   'Maquetas',
  decoracion: 'Decoración',
  cosplay:    'Cosplay',
  props:      'Props',
  prototipos: 'Prototipos'
}

function renderProductList() {
  const list = document.getElementById('product-list')
  if (!products.length) {
    list.innerHTML = '<p style="color:var(--muted);font-size:0.8rem;padding:0.5rem 0;">Sin productos aún</p>'
    return
  }
  list.innerHTML = products.map(p => `
    <div class="product-row ${p.id === currentProductId ? 'active' : ''}"
         data-id="${p.id}">
      <div class="product-row-thumb">
        ${p.image
          ? `<img src="${escapeAttr(p.image)}" alt="" onerror="this.parentElement.innerHTML='🖨'">`
          : '🖨'}
      </div>
      <div class="product-row-info">
        <div class="product-row-name">${escapeHtml(p.nameEs || p.nameEn || 'Sin nombre')}</div>
        <div class="product-row-price">${p.price != null ? p.price + ' €' : '—'}</div>
      </div>
      <span class="product-row-badge ${p.visible ? 'badge-visible' : 'badge-hidden'}">
        ${p.visible ? 'ON' : 'OFF'}
      </span>
    </div>
  `).join('')

  list.querySelectorAll('.product-row').forEach(row => {
    row.addEventListener('click', () => selectProduct(row.dataset.id))
  })
}

function selectProduct(id) {
  currentProductId = id
  renderProductList()
  renderProductForm(products.find(p => p.id === id))
}

function renderProductForm(p) {
  const container = document.getElementById('product-form-container')
  const isNew = !p
  if (isNew) p = {
    id: String(Date.now()),
    nameEs: '', nameEn: '',
    category: 'figuras',
    price: '',
    descEs: '', descEn: '',
    image: '',
    visible: true
  }

  container.innerHTML = `
    <form class="product-form" id="product-form">
      <h2>${isNew ? 'Nuevo producto' : 'Editar producto'}</h2>

      <div class="form-row">
        <div class="form-group">
          <label for="f-nameEs">Nombre (ES)</label>
          <input type="text" id="f-nameEs" value="${escapeAttr(p.nameEs || '')}" required>
        </div>
        <div class="form-group">
          <label for="f-nameEn">Nombre (EN)</label>
          <input type="text" id="f-nameEn" value="${escapeAttr(p.nameEn || '')}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="f-category">Categoría</label>
          <select id="f-category">
            ${CATEGORIES.map(c => `<option value="${c}" ${p.category === c ? 'selected' : ''}>${CAT_LABELS[c]}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="f-price">Precio (€)</label>
          <input type="number" id="f-price" min="0" step="0.01" value="${p.price != null ? p.price : ''}">
        </div>
      </div>

      <div class="form-group">
        <label for="f-descEs">Descripción (ES)</label>
        <textarea id="f-descEs">${escapeHtml(p.descEs || '')}</textarea>
      </div>
      <div class="form-group">
        <label for="f-descEn">Descripción (EN)</label>
        <textarea id="f-descEn">${escapeHtml(p.descEn || '')}</textarea>
      </div>

      <div class="form-group">
        <label>Imagen</label>
        <div class="image-upload-area" id="img-upload-area">
          <input type="file" id="f-image" accept="image/*">
          <div id="img-preview-wrap"></div>
        </div>
      </div>

      <div class="form-group">
        <label>Visibilidad</label>
        <div class="toggle-group">
          <label class="toggle-switch">
            <input type="checkbox" id="f-visible" ${p.visible ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <span class="toggle-label">Mostrar en la web</span>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-primary">Guardar cambios</button>
        ${!isNew ? `<button type="button" id="delete-btn" class="btn-danger">Eliminar</button>` : ''}
        <button type="button" id="cancel-form-btn" class="btn-link">Cancelar</button>
      </div>
    </form>
  `

  // Inicializar preview de imagen
  updateImagePreview(p.image || null, p.image || null)

  // Hacer clic en el área de upload abre el input
  document.getElementById('img-upload-area').addEventListener('click', () => {
    document.getElementById('f-image').click()
  })
  document.getElementById('f-image').addEventListener('change', handleImageFileChange)

  // Submit
  document.getElementById('product-form').addEventListener('submit', e => {
    e.preventDefault()
    saveProduct(isNew, p.id)
  })

  // Delete
  const deleteBtn = document.getElementById('delete-btn')
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      if (confirm(`¿Eliminar "${p.nameEs || p.nameEn || 'este producto'}"?`)) {
        deleteProduct(p.id)
      }
    })
  }

  // Cancel
  document.getElementById('cancel-form-btn').addEventListener('click', () => {
    currentProductId = null
    pendingImageUpload = null
    document.getElementById('product-form-container').innerHTML = `
      <div class="empty-state"><p>Selecciona un producto o crea uno nuevo</p></div>`
    renderProductList()
  })
}

function saveProduct(isNew, id) {
  const nameEs = document.getElementById('f-nameEs').value.trim()
  if (!nameEs) {
    showStatus(document.getElementById('admin-status'), 'El nombre en ES es obligatorio.', 'error')
    return
  }

  const productData = {
    id,
    nameEs,
    nameEn:    document.getElementById('f-nameEn').value.trim(),
    category:  document.getElementById('f-category').value,
    price:     parseFloat(document.getElementById('f-price').value) || null,
    descEs:    document.getElementById('f-descEs').value.trim(),
    descEn:    document.getElementById('f-descEn').value.trim(),
    image:     pendingImageUpload ? pendingImageUpload.filename
               : (products.find(p => p.id === id)?.image || ''),
    visible:   document.getElementById('f-visible').checked
  }

  if (isNew) {
    products.push(productData)
  } else {
    const idx = products.findIndex(p => p.id === id)
    if (idx !== -1) products[idx] = productData
  }

  currentProductId = id
  setDirty(true)
  renderProductList()
  showStatus(document.getElementById('admin-status'), 'Cambios guardados localmente. Pulsa "Sync to GitHub" para publicar.', 'success')
}

function deleteProduct(id) {
  products = products.filter(p => p.id !== id)
  currentProductId = null
  pendingImageUpload = null
  setDirty(true)
  renderProductList()
  document.getElementById('product-form-container').innerHTML = `
    <div class="empty-state"><p>Selecciona un producto o crea uno nuevo</p></div>`
  showStatus(document.getElementById('admin-status'), 'Producto eliminado. Pulsa "Sync to GitHub" para publicar.', 'warning')
}

// ── Escape helpers ────────────────────────────────────────
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// ── Navegación entre pantallas ────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.hidden = true)
  const target = document.getElementById('screen-' + name)
  if (target) target.hidden = false
}

// ── Setup ─────────────────────────────────────────────────
async function initSetup() {
  const btn      = document.getElementById('setup-btn')
  const statusEl = document.getElementById('setup-status')

  btn.addEventListener('click', async () => {
    const pat  = document.getElementById('setup-pat').value.trim()
    const repo = document.getElementById('setup-repo').value.trim()
    const pwd  = document.getElementById('setup-pwd').value
    const pwd2 = document.getElementById('setup-pwd2').value

    if (!pat || !repo)         return showStatus(statusEl, 'PAT y repositorio son obligatorios.', 'error')
    if (pwd.length < 6)        return showStatus(statusEl, 'La contraseña debe tener al menos 6 caracteres.', 'error')
    if (pwd !== pwd2)          return showStatus(statusEl, 'Las contraseñas no coinciden.', 'error')
    if (!repo.includes('/'))   return showStatus(statusEl, 'El formato del repo debe ser "usuario/repo".', 'error')

    showStatus(statusEl, 'Verificando acceso a GitHub...', 'info')
    btn.disabled = true

    try {
      // Verificar que el PAT funciona
      const res = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: { 'Authorization': `Bearer ${pat}`, 'Accept': 'application/vnd.github.v3+json' }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const passwordHash = await hashPassword(pwd)
      const cfg = { pat, repo, passwordHash }
      localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
      config = cfg

      showStatus(statusEl, '✓ Configuración guardada.', 'success')
      setTimeout(() => { showScreen('login'); initLogin() }, 800)
    } catch (e) {
      showStatus(statusEl, 'No se pudo conectar con GitHub. Revisa el PAT y el repo.', 'error')
    } finally {
      btn.disabled = false
    }
  })
}

// ── Login ─────────────────────────────────────────────────
async function initLogin() {
  const btn      = document.getElementById('login-btn')
  const pwdInput = document.getElementById('login-pwd')
  const statusEl = document.getElementById('login-status')

  const tryLogin = async () => {
    const hash = await hashPassword(pwdInput.value)
    if (hash === config.passwordHash) {
      sessionStorage.setItem(SESSION_KEY, '1')
      await initPanel()
    } else {
      showStatus(statusEl, 'Contraseña incorrecta.', 'error')
      pwdInput.value = ''
      pwdInput.focus()
    }
  }

  btn.addEventListener('click', tryLogin)
  pwdInput.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin() })

  document.getElementById('reset-config-btn').addEventListener('click', () => {
    if (confirm('¿Borrar la configuración actual y volver al setup?')) {
      localStorage.removeItem(CONFIG_KEY)
      sessionStorage.removeItem(SESSION_KEY)
      location.reload()
    }
  })
}

// ── Panel ─────────────────────────────────────────────────
async function initPanel() {
  showScreen('panel')
  const statusEl = document.getElementById('admin-status')

  showStatus(statusEl, 'Cargando productos desde GitHub...', 'info')
  try {
    await loadProducts()
    clearStatus(statusEl)
  } catch (e) {
    showStatus(statusEl, 'Error al cargar productos: ' + e.message, 'error')
  }

  renderProductList()

  document.getElementById('add-product-btn').addEventListener('click', () => {
    currentProductId = null
    pendingImageUpload = null
    renderProductForm(null)
    renderProductList()
  })

  document.getElementById('sync-btn').addEventListener('click', saveToGitHub)

  document.getElementById('logout-btn').addEventListener('click', () => {
    sessionStorage.removeItem(SESSION_KEY)
    showScreen('login')
    document.getElementById('login-pwd').value = ''
  })
}

// ── Boot ──────────────────────────────────────────────────
async function boot() {
  const stored = localStorage.getItem(CONFIG_KEY)
  if (!stored) {
    showScreen('setup')
    initSetup()
    return
  }

  try {
    config = JSON.parse(stored)
  } catch {
    localStorage.removeItem(CONFIG_KEY)
    showScreen('setup')
    initSetup()
    return
  }

  if (sessionStorage.getItem(SESSION_KEY)) {
    await initPanel()
  } else {
    showScreen('login')
    initLogin()
  }
}

// ── Dirty guard ───────────────────────────────────────────
window.addEventListener('beforeunload', e => {
  if (isDirty) {
    e.preventDefault()
    e.returnValue = 'Hay cambios sin sincronizar con GitHub.'
  }
})

boot()
