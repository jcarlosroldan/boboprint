import * as THREE from 'three'

// Three.js: 3D printing build + paint animation

const canvas = document.getElementById('hero-canvas')
if (canvas) {
	const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
	renderer.setSize(innerWidth, innerHeight)
	renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
	renderer.toneMapping = THREE.ACESFilmicToneMapping
	renderer.toneMappingExposure = 1.2

	const scene = new THREE.Scene()
	const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100)
	camera.position.set(1.5, 0.8, 3.5)
	camera.lookAt(0.8, 0, 0)

	// Lights
	const ambient = new THREE.AmbientLight(0x221111, 0.8)
	scene.add(ambient)
	const keyLight = new THREE.PointLight(0xffa060, 40, 20)
	keyLight.position.set(3, 3, 4)
	scene.add(keyLight)
	const fillLight = new THREE.PointLight(0x4ecdc4, 15, 20)
	fillLight.position.set(-3, -1, 3)
	scene.add(fillLight)
	const rimLight = new THREE.PointLight(0xff6b35, 20, 20)
	rimLight.position.set(0, 2, -3)
	scene.add(rimLight)

	const isMobile = innerWidth < 768
	const geo = new THREE.TorusKnotGeometry(0.8, 0.28, isMobile ? 128 : 200, isMobile ? 16 : 32, 2, 3)
	geo.computeBoundingBox()
	const yMin = geo.boundingBox.min.y
	const yMax = geo.boundingBox.max.y

	const vertSrc = `
		varying vec3 vWorldPos;
		varying vec3 vNormal;
		varying vec2 vUv;
		void main() {
			vec4 wp = modelMatrix * vec4(position, 1.0);
			vWorldPos = wp.xyz;
			vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
			vUv = uv;
			gl_Position = projectionMatrix * viewMatrix * wp;
		}
	`

	const fragSrc = `
		precision mediump float;
		uniform float uBuild;
		uniform float uPaint;
		uniform vec3 uCamPos;
		varying vec3 vWorldPos;
		varying vec3 vNormal;
		varying vec2 vUv;

		void main() {
			float y = vWorldPos.y;
			if (y > uBuild) discard;

			float edge = 1.0 - smoothstep(0.0, 0.06, uBuild - y);
			float paintLine = mix(${yMin.toFixed(2)} - 0.5, ${yMax.toFixed(2)} + 0.5, uPaint);
			float painted = smoothstep(paintLine, paintLine - 0.4, y);

			vec3 raw = vec3(0.55, 0.5, 0.45);
			vec3 cBot = vec3(0.78, 0.55, 0.3);
			vec3 cTop = vec3(0.85, 0.3, 0.35);
			vec3 paintCol = mix(cBot, cTop, smoothstep(${yMin.toFixed(2)}, ${yMax.toFixed(2)}, y));

			vec3 viewDir = normalize(uCamPos - vWorldPos);
			float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 3.0);
			paintCol = mix(paintCol, vec3(0.3, 0.75, 0.7), fresnel * 0.25);

			vec3 surf = mix(raw, paintCol, painted);

			vec3 lDir = normalize(vec3(1.5, 2.0, 3.0));
			float diff = max(dot(vNormal, lDir), 0.0);
			vec3 h = normalize(lDir + viewDir);
			float spec = pow(max(dot(vNormal, h), 0.0), 50.0) * painted;
			vec3 lit = surf * (0.15 + diff * 0.65) + vec3(1.0) * spec * 0.25;

			vec3 glow = vec3(1.0, 0.45, 0.1);
			lit = mix(lit, glow, edge * 0.9);

			gl_FragColor = vec4(lit, 1.0);
		}
	`

	const uniforms = {
		uBuild: { value: yMin - 0.1 },
		uPaint: { value: 0 },
		uCamPos: { value: camera.position }
	}

	const solidMat = new THREE.ShaderMaterial({
		vertexShader: vertSrc,
		fragmentShader: fragSrc,
		uniforms,
		side: THREE.DoubleSide
	})

	const mesh = new THREE.Mesh(geo, solidMat)
	mesh.position.x = 0.8
	scene.add(mesh)

	// Wireframe preview
	const wireGeo = new THREE.TorusKnotGeometry(0.8, 0.28, 64, 8, 2, 3)
	const wireMat = new THREE.MeshBasicMaterial({
		color: 0x4ecdc4,
		wireframe: true,
		transparent: true,
		opacity: 0.04
	})
	const wire = new THREE.Mesh(wireGeo, wireMat)
	wire.position.x = 0.8
	scene.add(wire)

	// Particles
	const pCount = isMobile ? 200 : 600
	const pPos = new Float32Array(pCount * 3)
	for (let i = 0; i < pCount; i++) {
		const r = 1.5 + Math.random() * 3
		const theta = Math.random() * Math.PI * 2
		const phi = Math.acos(2 * Math.random() - 1)
		pPos[i * 3] = r * Math.sin(phi) * Math.cos(theta) + 0.8
		pPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
		pPos[i * 3 + 2] = r * Math.cos(phi)
	}
	const pGeo = new THREE.BufferGeometry()
	pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
	scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({
		size: 1.2,
		sizeAttenuation: true,
		color: 0xff6b35,
		transparent: true,
		opacity: 0.25,
		blending: THREE.AdditiveBlending,
		depthWrite: false
	})))

	// Mouse
	let mx = 0, my = 0, tmx = 0, tmy = 0
	document.addEventListener('mousemove', e => {
		tmx = (e.clientX / innerWidth - 0.5) * 0.4
		tmy = -(e.clientY / innerHeight - 0.5) * 0.3
	})

	const ease = t => 1 - Math.pow(1 - Math.min(t, 1), 3)
	const hero = document.getElementById('hero')
	const clock = new THREE.Clock()

	function animate() {
		requestAnimationFrame(animate)
		const t = clock.getElapsedTime()

		// Build: 0-2.5s
		uniforms.uBuild.value = yMin + (yMax - yMin) * ease(t / 2.5) + 0.1

		// Paint: 0.8-3s
		if (t > 0.8) uniforms.uPaint.value = ease((t - 0.8) / 2.2)

		// Rotate after build
		if (t > 2.5) {
			mesh.rotation.y += 0.004
			wire.rotation.y += 0.004
		}

		// Mouse orbit
		mx += (tmx - mx) * 0.03
		my += (tmy - my) * 0.03
		camera.position.x = 1.5 + mx * 2
		camera.position.y = 0.8 + my * 1.5
		camera.lookAt(0.8, 0, 0)

		// Scroll fade
		const rect = hero.getBoundingClientRect()
		const fade = Math.max(0, 1 - Math.max(0, -rect.top) / (innerHeight * 0.6))
		mesh.material.opacity = fade
		wire.material.opacity = 0.04 * fade

		renderer.render(scene, camera)
	}
	animate()

	window.addEventListener('resize', () => {
		camera.aspect = innerWidth / innerHeight
		camera.updateProjectionMatrix()
		renderer.setSize(innerWidth, innerHeight)
	})
}

// Language toggle (all buttons with class lang-toggle)

document.querySelectorAll('.lang-toggle').forEach(btn =>
	btn.addEventListener('click', () => {
		document.documentElement.lang = document.documentElement.lang === 'es' ? 'en' : 'es'
	})
)

// Header show on scroll

const header = document.querySelector('header')
let lastY = 0
window.addEventListener('scroll', () => {
	header.classList.toggle('visible', scrollY > innerHeight * 0.8)
	lastY = scrollY
}, { passive: true })

// Horizontal scroll gallery (desktop only)

const wrapper = document.querySelector('.work-wrapper')
const track = document.querySelector('.work-track')
const bar = document.querySelector('.work-bar')

function setupHorizontalScroll() {
	if (innerWidth <= 768) {
		wrapper.style.height = ''
		track.style.transform = ''
		return
	}
	const totalScroll = track.scrollWidth - innerWidth
	wrapper.style.height = (totalScroll + innerHeight) + 'px'
}

function updateHorizontalScroll() {
	if (innerWidth <= 768) return
	const rect = wrapper.getBoundingClientRect()
	const progress = Math.max(0, Math.min(1, -rect.top / (wrapper.offsetHeight - innerHeight)))
	const maxTx = track.scrollWidth - innerWidth
	track.style.transform = `translateX(${-progress * maxTx}px)`
	if (bar) bar.style.width = (progress * 100) + '%'
}

setupHorizontalScroll()
window.addEventListener('resize', setupHorizontalScroll)
window.addEventListener('scroll', updateHorizontalScroll, { passive: true })

// Custom cursor

const cursor = document.querySelector('.cursor')

if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
	let cx = -100, cy = -100
	document.addEventListener('mousemove', e => { cx = e.clientX; cy = e.clientY })
	;(function loop() {
		cursor.style.left = cx + 'px'
		cursor.style.top = cy + 'px'
		requestAnimationFrame(loop)
	})()
	document.addEventListener('mouseleave', () => cursor.style.opacity = '0')
	document.addEventListener('mouseenter', () => cursor.style.opacity = '1')
	document.querySelectorAll('a, button, .work-item').forEach(el => {
		el.addEventListener('mouseenter', () => cursor.classList.add('hover'))
		el.addEventListener('mouseleave', () => cursor.classList.remove('hover'))
	})
}

// Reveal on scroll

const revealObs = new IntersectionObserver(entries => {
	entries.forEach(e => {
		if (e.isIntersecting) {
			e.target.classList.add('revealed')
			revealObs.unobserve(e.target)
		}
	})
}, { threshold: 0.15 })

document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el))
