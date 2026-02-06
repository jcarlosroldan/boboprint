document.addEventListener('DOMContentLoaded', () => {
	const html = document.documentElement
	const nav = document.querySelector('nav')
	const menuBtn = document.querySelector('.menu-btn')
	const mobileMenu = document.querySelector('.mobile-menu')
	const langToggle = document.querySelector('.lang-toggle')
	const cursor = document.querySelector('.cursor')
	const cursorDot = document.querySelector('.cursor-dot')

	// Language
	langToggle.addEventListener('click', () => {
		html.lang = html.lang === 'es' ? 'en' : 'es'
	})

	// Mobile menu
	menuBtn.addEventListener('click', () => {
		menuBtn.classList.toggle('active')
		mobileMenu.classList.toggle('active')
		document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : ''
	})

	mobileMenu.querySelectorAll('a').forEach(link => {
		link.addEventListener('click', () => {
			menuBtn.classList.remove('active')
			mobileMenu.classList.remove('active')
			document.body.style.overflow = ''
		})
	})

	// Nav scroll
	let ticking = false
	window.addEventListener('scroll', () => {
		if (!ticking) {
			requestAnimationFrame(() => {
				nav.classList.toggle('scrolled', window.scrollY > 60)
				ticking = false
			})
			ticking = true
		}
	})

	// Scroll reveal
	const observer = new IntersectionObserver(entries => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				entry.target.classList.add('revealed')
				observer.unobserve(entry.target)
			}
		})
	}, { threshold: 0.1 })

	document.querySelectorAll('.reveal').forEach(el => observer.observe(el))

	// Custom cursor
	let cx = -100, cy = -100
	document.addEventListener('mousemove', e => {
		cx = e.clientX
		cy = e.clientY
	})

	function updateCursor() {
		cursor.style.left = cx + 'px'
		cursor.style.top = cy + 'px'
		cursorDot.style.left = cx + 'px'
		cursorDot.style.top = cy + 'px'
		requestAnimationFrame(updateCursor)
	}
	if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
		requestAnimationFrame(updateCursor)
	}

	document.addEventListener('mouseleave', () => {
		cursor.style.opacity = '0'
		cursorDot.style.opacity = '0'
	})
	document.addEventListener('mouseenter', () => {
		cursor.style.opacity = '1'
		cursorDot.style.opacity = '1'
	})

	document.querySelectorAll('a, button, .gallery-item').forEach(el => {
		el.addEventListener('mouseenter', () => cursor.classList.add('hover'))
		el.addEventListener('mouseleave', () => cursor.classList.remove('hover'))
	})

	// Gallery filter
	const filterBtns = document.querySelectorAll('.filter-btn')
	const galleryItems = document.querySelectorAll('.gallery-item')

	filterBtns.forEach(btn => {
		btn.addEventListener('click', () => {
			const filter = btn.dataset.filter
			filterBtns.forEach(b => b.classList.remove('active'))
			btn.classList.add('active')

			galleryItems.forEach(item => item.style.opacity = '0')

			setTimeout(() => {
				galleryItems.forEach(item => {
					const show = filter === 'all' || item.dataset.category === filter
					item.style.display = show ? '' : 'none'
					if (show) requestAnimationFrame(() => item.style.opacity = '1')
				})
			}, 300)
		})
	})

	// Gallery tilt
	if (matchMedia('(hover: hover)').matches) {
		document.querySelectorAll('.gallery-item').forEach(card => {
			card.addEventListener('mousemove', e => {
				const r = card.getBoundingClientRect()
				const x = (e.clientX - r.left) / r.width - 0.5
				const y = (e.clientY - r.top) / r.height - 0.5
				card.style.transform = `perspective(600px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg) scale(1.02)`
			})
			card.addEventListener('mouseleave', () => {
				card.style.transform = ''
			})
		})
	}
})
