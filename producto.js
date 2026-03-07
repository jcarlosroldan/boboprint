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

function render(p) {
  const lang = getLang()
  const catLabel = CATEGORY_LABELS[p.category] ?? { es: p.category, en: p.category }

  // Title
  document.title = `${lang === 'en' ? (p.nameEn || p.nameEs) : p.nameEs} — Hannya Labs`

  // Category
  document.getElementById('det-cat').textContent = lang === 'en' ? catLabel.en : catLabel.es

  // Name
  document.getElementById('det-name').textContent = lang === 'en' ? (p.nameEn || p.nameEs) : p.nameEs

  // Price
  const priceWrap = document.getElementById('det-price-wrap')
  if (p.price != null) {
    if (p.discount) {
      const final = p.price * (1 - p.discount / 100)
      priceWrap.innerHTML = `
        <span class="price-original">${Number(p.price).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
        <span class="price-final">${Number(final).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
        <span class="discount-badge">-${p.discount}%</span>`
    } else {
      priceWrap.innerHTML = `<span class="price-only">${Number(p.price).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>`
    }
  } else {
    priceWrap.innerHTML = ''
  }

  // Description
  const descEl = document.getElementById('det-desc')
  const desc = lang === 'en' ? (p.descEn || p.descEs) : (p.descEs || p.descEn)
  descEl.textContent = desc || ''
  descEl.hidden = !desc

  // Meta: weight + stock
  const metaEl = document.getElementById('det-meta')
  const parts = []
  if (p.weight != null) {
    parts.push(`<span>${lang === 'en' ? 'Weight' : 'Peso'}: ${p.weight}g</span>`)
  }
  if (p.stock != null) {
    if (p.stock === 0) {
      parts.push(`<span class="stock-badge out-of-stock">${lang === 'en' ? 'Sold out' : 'Agotado'}</span>`)
    } else {
      parts.push(`<span class="stock-badge in-stock">${lang === 'en' ? `${p.stock} left` : `${p.stock} uds.`}</span>`)
    }
  }
  metaEl.innerHTML = parts.join('')
}

async function init() {
  const id = new URLSearchParams(location.search).get('id')
  if (!id) { location.href = 'productos.html'; return }

  let data
  try {
    const res = await fetch('products.json')
    if (!res.ok) throw new Error('fetch failed')
    data = await res.json()
  } catch {
    location.href = 'productos.html'
    return
  }

  const p = (data.products || []).find(x => x.id === id)
  if (!p || !p.visible) { location.href = 'productos.html'; return }

  // Image
  const imgWrap = document.getElementById('det-img-wrap')
  if (p.image) {
    imgWrap.innerHTML = `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.nameEs || '')}">`
  } else {
    imgWrap.innerHTML = `<div class="producto-img-placeholder-lg">🖨</div>`
  }

  render(p)

  // Re-render on language change
  document.querySelectorAll('.lang-toggle').forEach(btn =>
    btn.addEventListener('click', () => {
      setTimeout(() => render(p), 0)
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
