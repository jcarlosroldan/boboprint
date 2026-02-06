import * as THREE from 'three'

// Three.js hero

const canvas = document.getElementById('hero-canvas')
if (canvas) {
	const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
	renderer.setSize(window.innerWidth, window.innerHeight)
	renderer.setPixelRatio(Math.min(devicePixelRatio, 2))

	const scene = new THREE.Scene()
	const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100)
	camera.position.z = 4

	const vertexShader = `
		uniform float uTime;
		uniform vec2 uMouse;
		varying vec3 vNormal;
		varying vec3 vPos;
		varying float vDisp;

		vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
		vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

		float snoise(vec3 v) {
			const vec2 C = vec2(1.0/6.0, 1.0/3.0);
			const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
			vec3 i = floor(v + dot(v, C.yyy));
			vec3 x0 = v - i + dot(i, C.xxx);
			vec3 g = step(x0.yzx, x0.xyz);
			vec3 l = 1.0 - g;
			vec3 i1 = min(g.xyz, l.zxy);
			vec3 i2 = max(g.xyz, l.zxy);
			vec3 x1 = x0 - i1 + C.xxx;
			vec3 x2 = x0 - i2 + C.yyy;
			vec3 x3 = x0 - D.yyy;
			i = mod(i, 289.0);
			vec4 p = permute(permute(permute(
				i.z + vec4(0.0, i1.z, i2.z, 1.0))
				+ i.y + vec4(0.0, i1.y, i2.y, 1.0))
				+ i.x + vec4(0.0, i1.x, i2.x, 1.0));
			float n_ = 1.0/7.0;
			vec3 ns = n_ * D.wyz - D.xzx;
			vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
			vec4 x_ = floor(j * ns.z);
			vec4 y_ = floor(j - 7.0 * x_);
			vec4 x = x_ * ns.x + ns.yyyy;
			vec4 y = y_ * ns.x + ns.yyyy;
			vec4 h = 1.0 - abs(x) - abs(y);
			vec4 b0 = vec4(x.xy, y.xy);
			vec4 b1 = vec4(x.zw, y.zw);
			vec4 s0 = floor(b0) * 2.0 + 1.0;
			vec4 s1 = floor(b1) * 2.0 + 1.0;
			vec4 sh = -step(h, vec4(0.0));
			vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
			vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
			vec3 p0 = vec3(a0.xy, h.x);
			vec3 p1 = vec3(a0.zw, h.y);
			vec3 p2 = vec3(a1.xy, h.z);
			vec3 p3 = vec3(a1.zw, h.w);
			vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
			p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
			vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
			m = m * m;
			return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
		}

		void main() {
			float n1 = snoise(position * 1.5 + uTime * 0.5);
			float n2 = snoise(position * 3.0 - uTime * 0.3);
			float disp = n1 * 0.2 + n2 * 0.08;
			vec3 dir = normalize(position + vec3(0.001));
			float mouseInf = dot(dir, normalize(vec3(uMouse, 0.5)));
			disp += mouseInf * 0.06 * length(uMouse);
			vec3 newPos = position + normal * disp;
			vNormal = normalize(normalMatrix * normal);
			vPos = (modelViewMatrix * vec4(newPos, 1.0)).xyz;
			vDisp = disp;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
		}
	`

	const fragmentShader = `
		varying vec3 vNormal;
		varying vec3 vPos;
		varying float vDisp;
		uniform float uTime;

		void main() {
			vec3 orange = vec3(1.0, 0.42, 0.21);
			vec3 teal = vec3(0.31, 0.8, 0.77);
			vec3 gold = vec3(1.0, 0.82, 0.4);
			vec3 viewDir = normalize(-vPos);
			float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 3.0);
			vec3 color = mix(teal, orange, vDisp * 2.5 + 0.5);
			color = mix(color, gold, fresnel * 0.5);
			float alpha = 0.06 + fresnel * 0.75;
			gl_FragColor = vec4(color, alpha);
		}
	`

	const isMobile = innerWidth < 768
	const uniforms = {
		uTime: { value: 0 },
		uMouse: { value: new THREE.Vector2(0, 0) }
	}

	// Main blob
	const blob = new THREE.Mesh(
		new THREE.IcosahedronGeometry(1.3, isMobile ? 3 : 4),
		new THREE.ShaderMaterial({
			vertexShader,
			fragmentShader,
			uniforms,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			side: THREE.DoubleSide
		})
	)
	scene.add(blob)

	// Wireframe overlay
	const wire = new THREE.Mesh(
		new THREE.IcosahedronGeometry(1.38, 2),
		new THREE.MeshBasicMaterial({
			color: 0xff6b35,
			wireframe: true,
			transparent: true,
			opacity: 0.06,
			blending: THREE.AdditiveBlending
		})
	)
	scene.add(wire)

	// Particles
	const pCount = isMobile ? 600 : 1500
	const pPositions = new Float32Array(pCount * 3)
	const pColors = new Float32Array(pCount * 3)
	const orange = new THREE.Color(0xff6b35)
	const teal = new THREE.Color(0x4ecdc4)
	for (let i = 0; i < pCount; i++) {
		const i3 = i * 3
		const r = 1.8 + Math.random() * 4
		const theta = Math.random() * Math.PI * 2
		const phi = Math.acos(2 * Math.random() - 1)
		pPositions[i3] = r * Math.sin(phi) * Math.cos(theta)
		pPositions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta)
		pPositions[i3 + 2] = r * Math.cos(phi)
		const c = Math.random() > 0.5 ? orange : teal
		pColors[i3] = c.r
		pColors[i3 + 1] = c.g
		pColors[i3 + 2] = c.b
	}
	const pGeo = new THREE.BufferGeometry()
	pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3))
	pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3))
	const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
		size: isMobile ? 1.5 : 2,
		sizeAttenuation: true,
		vertexColors: true,
		transparent: true,
		opacity: 0.5,
		blending: THREE.AdditiveBlending,
		depthWrite: false
	}))
	scene.add(particles)

	// Mouse tracking
	let mx = 0, my = 0, mtx = 0, mty = 0
	document.addEventListener('mousemove', e => {
		mtx = (e.clientX / innerWidth - 0.5) * 2
		mty = -(e.clientY / innerHeight - 0.5) * 2
	})

	// Scroll fade
	const hero = document.getElementById('hero')
	let scrollProgress = 0

	const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
	const startTime = performance.now()

	function animate() {
		requestAnimationFrame(animate)

		const elapsed = (performance.now() - startTime) / 1000
		const scale = Math.min(elapsed / 1.2, 1)
		const eased = 1 - Math.pow(1 - scale, 3)

		uniforms.uTime.value += reducedMotion ? 0 : 0.008
		mx += (mtx - mx) * 0.05
		my += (mty - my) * 0.05
		uniforms.uMouse.value.set(mx, my)

		blob.scale.setScalar(eased)
		blob.rotation.y += 0.003
		blob.rotation.x += 0.001
		wire.scale.setScalar(eased)
		wire.rotation.y += 0.002
		wire.rotation.x += 0.0008
		particles.rotation.y += 0.0004

		scrollProgress = Math.min(hero.getBoundingClientRect().top < 0 ? -hero.getBoundingClientRect().top / innerHeight : 0, 1)
		camera.position.z = 4 + scrollProgress * 3
		blob.material.opacity = 1 - scrollProgress
		wire.material.opacity = 0.06 * (1 - scrollProgress)

		renderer.render(scene, camera)
	}
	animate()

	window.addEventListener('resize', () => {
		camera.aspect = innerWidth / innerHeight
		camera.updateProjectionMatrix()
		renderer.setSize(innerWidth, innerHeight)
	})
}

// Language toggle

document.querySelector('.lang-toggle').addEventListener('click', () => {
	document.documentElement.lang = document.documentElement.lang === 'es' ? 'en' : 'es'
})

// Mobile menu

const menuBtn = document.querySelector('.menu-btn')
const mobileMenu = document.querySelector('.mobile-menu')

menuBtn.addEventListener('click', () => {
	menuBtn.classList.toggle('active')
	mobileMenu.classList.toggle('active')
	document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : ''
})

mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
	menuBtn.classList.remove('active')
	mobileMenu.classList.remove('active')
	document.body.style.overflow = ''
}))

// Nav scroll

let ticking = false
window.addEventListener('scroll', () => {
	if (!ticking) {
		requestAnimationFrame(() => {
			document.querySelector('nav').classList.toggle('scrolled', scrollY > 60)
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

const cursor = document.querySelector('.cursor')
const cursorDot = document.querySelector('.cursor-dot')
let cx = -100, cy = -100

if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
	document.addEventListener('mousemove', e => { cx = e.clientX; cy = e.clientY })

	;(function loop() {
		cursor.style.left = cx + 'px'
		cursor.style.top = cy + 'px'
		cursorDot.style.left = cx + 'px'
		cursorDot.style.top = cy + 'px'
		requestAnimationFrame(loop)
	})()

	document.addEventListener('mouseleave', () => { cursor.style.opacity = cursorDot.style.opacity = '0' })
	document.addEventListener('mouseenter', () => { cursor.style.opacity = cursorDot.style.opacity = '1' })

	document.querySelectorAll('a, button, .gallery-item').forEach(el => {
		el.addEventListener('mouseenter', () => cursor.classList.add('hover'))
		el.addEventListener('mouseleave', () => cursor.classList.remove('hover'))
	})
}

// Gallery filter

const filterBtns = document.querySelectorAll('.filter-btn')
const galleryItems = document.querySelectorAll('.gallery-item')

filterBtns.forEach(btn => btn.addEventListener('click', () => {
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
}))

// Gallery tilt

if (matchMedia('(hover: hover)').matches) {
	galleryItems.forEach(card => {
		card.addEventListener('mousemove', e => {
			const r = card.getBoundingClientRect()
			const x = (e.clientX - r.left) / r.width - 0.5
			const y = (e.clientY - r.top) / r.height - 0.5
			card.style.transform = `perspective(600px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg) scale(1.02)`
		})
		card.addEventListener('mouseleave', () => { card.style.transform = '' })
	})
}
