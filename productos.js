'use strict'

const CATEGORY_LABELS = {
  figuras:    { es: 'Figuras',    en: 'Figures'      },
  maquetas:   { es: 'Maquetas',   en: 'Scale models' },
  decoracion: { es: 'Decoración', en: 'Decor'        },
  cosplay:    { es: 'Cosplay',    en: 'Cosplay'      },
  props:      { es: 'Props',      en: 'Props'        },
  prototipos: { es: 'Prototipos', en: 'Prototypes'   },
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function getLang() {
  return document.documentElement.lang || 'es'
}

function priceHtml(p) {
  if (p.price == null) return ''
  if (p.discount) {
    const final = p.price * (1 - p.discount / 100)
    return `
      <span class="price-original">${Number(p.price).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
      <span class="price-final">${Number(final).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
      <span class="discount-badge">-${p.discount}%</span>`
  }
  return `<span class="producto-price">${Number(p.price).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>`
}

function stockBadge(p) {
  if (p.stock == null) return ''
  if (p.stock === 0) return '<span class="stock-badge out-of-stock"><span class="es">Agotado</span><span class="en">Sold out</span></span>'
  return `<span class="stock-badge in-stock"><span class="es">${p.stock} uds.</span><span class="en">${p.stock} left</span></span>`
}

function renderGrid(products) {
  const grid = document.getElementById('productos-grid')
  grid.innerHTML = ''
  products.forEach(p => {
    const lang = getLang()
    const catEs = CATEGORY_LABELS[p.category]?.es ?? p.category
    const catEn = CATEGORY_LABELS[p.category]?.en ?? p.category
    const imgHtml = p.image
      ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.nameEs || '')}" loading="lazy">`
      : `<div class="producto-img-placeholder">🖨</div>`

    const link = document.createElement('a')
    link.href = `producto.html?id=${encodeURIComponent(p.id)}`
    link.className = 'producto-card-link'
    link.innerHTML = `
      <article class="producto-card">
        <div class="producto-img-wrap">${imgHtml}</div>
        <div class="producto-info">
          <span class="producto-cat"><span class="es">${catEs}</span><span class="en">${catEn}</span></span>
          <h3 class="producto-name">
            <span class="es">${escapeHtml(p.nameEs || '')}</span>
            <span class="en">${escapeHtml(p.nameEn || '')}</span>
          </h3>
          <div class="producto-price-row">
            ${priceHtml(p)}
            ${stockBadge(p)}
          </div>
        </div>
      </article>`
    grid.appendChild(link)
  })
}

function renderFilters(products) {
  const cats = ['all', ...new Set(products.map(p => p.category))]
  const container = document.getElementById('cat-filters')
  container.innerHTML = cats.map(cat => {
    if (cat === 'all') {
      return `<button class="cat-pill active" data-cat="all"><span class="es">Todos</span><span class="en">All</span></button>`
    }
    const es = CATEGORY_LABELS[cat]?.es ?? cat
    const en = CATEGORY_LABELS[cat]?.en ?? cat
    return `<button class="cat-pill" data-cat="${cat}"><span class="es">${es}</span><span class="en">${en}</span></button>`
  }).join('')

  container.querySelectorAll('.cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      container.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'))
      pill.classList.add('active')
      filterAndRender(window._allProducts)
    })
  })
}

function filterAndRender(all) {
  const q = document.getElementById('search-input').value.toLowerCase().trim()
  const activeCat = document.querySelector('.cat-pill.active')?.dataset.cat ?? 'all'
  const lang = getLang()

  const filtered = all.filter(p => {
    const name = (lang === 'en' ? p.nameEn : p.nameEs) || ''
    const desc = (lang === 'en' ? p.descEn : p.descEs) || ''
    const matchesSearch = !q || name.toLowerCase().includes(q) || desc.toLowerCase().includes(q)
    const matchesCat = activeCat === 'all' || p.category === activeCat
    return matchesSearch && matchesCat
  })

  renderGrid(filtered)
  document.getElementById('no-results').hidden = filtered.length > 0
}

async function init() {
  let data
  try {
    const res = await fetch('products.json')
    if (!res.ok) throw new Error('fetch failed')
    data = await res.json()
  } catch {
    document.getElementById('no-results').hidden = false
    return
  }

  const visible = (data.products || []).filter(p => p.visible)
  window._allProducts = visible

  renderFilters(visible)
  renderGrid(visible)

  document.getElementById('search-input').addEventListener('input', () => filterAndRender(visible))

  // Re-render on language toggle (category pill labels update automatically via CSS)
  document.querySelectorAll('.lang-toggle').forEach(btn =>
    btn.addEventListener('click', () => {
      setTimeout(() => filterAndRender(visible), 0)
    })
  )
}

// Language toggle
document.querySelectorAll('.lang-toggle').forEach(btn =>
  btn.addEventListener('click', () => {
    document.documentElement.lang = document.documentElement.lang === 'es' ? 'en' : 'es'
  })
)

// Dropdown toggle for mobile
const navTienda = document.getElementById('nav-tienda')
if (navTienda) {
  navTienda.querySelector('.nav-dropdown-btn')?.addEventListener('click', () => {
    navTienda.classList.toggle('open')
  })
  document.addEventListener('click', e => {
    if (!navTienda.contains(e.target)) navTienda.classList.remove('open')
  })
}

init()
