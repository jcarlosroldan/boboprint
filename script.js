import * as THREE from 'three'

const canvas = document.getElementById('hero-canvas')
if (canvas) {
	const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
	renderer.setSize(innerWidth, innerHeight)
	renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
	renderer.toneMapping = THREE.ACESFilmicToneMapping
	renderer.toneMappingExposure = 1.2

	const scene = new THREE.Scene()
	const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100)
	camera.position.set(0, 0.5, 4.5)
	camera.lookAt(0, 0, 0)

	const isMobile = innerWidth < 768
	const detail = isMobile ? 4 : 5
	const geo = new THREE.IcosahedronGeometry(1.1, detail)
	const pos = geo.getAttribute('position')
	const nrm = geo.getAttribute('normal')

	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
		const nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i)
		const d = 0.12 * Math.sin(x * 3.5 + y * 2.1) * Math.cos(z * 2.8 + x * 1.3)
				+ 0.05 * Math.sin(x * 8 + z * 6) * Math.cos(y * 7)
				+ 0.08 * Math.cos(y * 2 + z * 1.5)
		pos.setXYZ(i, x + nx * d, y + ny * d, z + nz * d)
	}
	geo.computeVertexNormals()

	const vertSrc = `
		varying vec3 vPos;
		varying vec3 vNormal;
		varying vec3 vWorld;
		void main() {
			vec4 wp = modelMatrix * vec4(position, 1.0);
			vWorld = wp.xyz;
			vPos = position;
			vNormal = normalize(normalMatrix * normal);
			gl_Position = projectionMatrix * viewMatrix * wp;
		}
	`

	const fragSrc = `
		precision highp float;
		uniform vec3 uCamPos;
		uniform float uTime;
		varying vec3 vPos;
		varying vec3 vNormal;
		varying vec3 vWorld;

		void main() {
			vec3 N = normalize(vNormal);
			vec3 V = normalize(uCamPos - vWorld);

			float h = vPos.y * 0.45 + 0.5;
			vec3 cBot = vec3(0.75, 0.42, 0.25);
			vec3 cMid = vec3(0.85, 0.35, 0.3);
			vec3 cTop = vec3(0.3, 0.72, 0.65);
			vec3 base = mix(cBot, cMid, smoothstep(0.15, 0.5, h));
			base = mix(base, cTop, smoothstep(0.55, 0.9, h));

			base += 0.03 * sin(vPos.x * 8.0 + vPos.z * 6.0 + uTime * 0.2);

			vec3 lDir = normalize(vec3(2.0, 3.0, 4.0));
			float diff = max(dot(N, lDir), 0.0);
			vec3 H = normalize(lDir + V);
			float spec = pow(max(dot(N, H), 0.0), 60.0);
			float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);

			vec3 color = base * (0.15 + diff * 0.65);
			color += vec3(1.0, 0.9, 0.85) * spec * 0.3;
			color += vec3(0.3, 0.7, 0.65) * fresnel * 0.12;
			color += base * max(dot(-N, lDir), 0.0) * 0.06;

			gl_FragColor = vec4(color, 1.0);
		}
	`

	const uniforms = {
		uCamPos: { value: camera.position },
		uTime: { value: 0 }
	}

	const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
		vertexShader: vertSrc,
		fragmentShader: fragSrc,
		uniforms
	}))
	mesh.position.x = isMobile ? 0 : 0.8
	scene.add(mesh)

	let mx = 0, my = 0, tmx = 0, tmy = 0
	document.addEventListener('mousemove', e => {
		tmx = (e.clientX / innerWidth - 0.5) * 0.3
		tmy = -(e.clientY / innerHeight - 0.5) * 0.2
	})

	const hero = document.getElementById('hero')
	const clock = new THREE.Clock()

	function animate() {
		requestAnimationFrame(animate)
		const t = clock.getElapsedTime()
		uniforms.uTime.value = t

		mesh.rotation.y = t * 0.15
		mesh.rotation.x = Math.sin(t * 0.1) * 0.1
		mesh.scale.setScalar(1 + Math.sin(t * 0.5) * 0.02)

		mx += (tmx - mx) * 0.03
		my += (tmy - my) * 0.03
		camera.position.x = mx * 2
		camera.position.y = 0.5 + my * 1.5
		camera.lookAt(isMobile ? 0 : 0.4, 0, 0)

		const rect = hero.getBoundingClientRect()
		const fade = Math.max(0, 1 - Math.max(0, -rect.top) / (innerHeight * 0.6))
		mesh.visible = fade > 0.01
		renderer.render(scene, camera)
	}
	animate()

	window.addEventListener('resize', () => {
		camera.aspect = innerWidth / innerHeight
		camera.updateProjectionMatrix()
		renderer.setSize(innerWidth, innerHeight)
	})
}

document.querySelectorAll('.lang-toggle').forEach(btn =>
	btn.addEventListener('click', () => {
		document.documentElement.lang = document.documentElement.lang === 'es' ? 'en' : 'es'
	})
)

const header = document.querySelector('header')
window.addEventListener('scroll', () => {
	header.classList.toggle('visible', scrollY > innerHeight * 0.8)
}, { passive: true })

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
	document.querySelectorAll('a, button, .gallery-item').forEach(el => {
		el.addEventListener('mouseenter', () => cursor.classList.add('hover'))
		el.addEventListener('mouseleave', () => cursor.classList.remove('hover'))
	})
}

const revealObs = new IntersectionObserver(entries => {
	entries.forEach(e => {
		if (e.isIntersecting) {
			e.target.classList.add('revealed')
			revealObs.unobserve(e.target)
		}
	})
}, { threshold: 0.15 })
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el))
