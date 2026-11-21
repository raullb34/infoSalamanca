#!/usr/bin/env node
// Iconos de la "app" del tiempo (/tiempo.html, instalable en el móvil): sol y nube sobre el verde de infoSalamanca.
//   node scripts/build-weather-icons.js  →  frontend/public/icons/tiempo-{180,192,512,maskable-512}.png
// El "maskable" lleva el dibujo dentro del 80 % central: Android lo recorta en círculo, gota o cuadrado.
const fs = require('fs')
const path = require('path')
const { createCanvas } = require('@napi-rs/canvas')

const OUT = path.resolve(__dirname, '../../frontend/public/icons')

function draw(size, { maskable = false, rounded = true } = {}) {
  const c = createCanvas(size, size)
  const g = c.getContext('2d')
  const s = size / 100 // el dibujo se hace en un lienzo de 100 × 100
  g.scale(s, s)
  // Fondo
  const bg = g.createLinearGradient(0, 0, 0, 100)
  bg.addColorStop(0, '#2e7d32')
  bg.addColorStop(1, '#14532d')
  g.fillStyle = bg
  if (rounded && !maskable) {
    g.beginPath()
    g.roundRect(0, 0, 100, 100, 22)
    g.fill()
  } else {
    g.fillRect(0, 0, 100, 100)
  }
  // Contenido más pequeño en el maskable (zona segura)
  const k = maskable ? 0.72 : 0.9
  g.translate(50 * (1 - k), 50 * (1 - k))
  g.scale(k, k)
  // Sol con rayos
  g.save()
  g.translate(64, 36)
  g.fillStyle = '#ffca28'
  g.strokeStyle = '#ffca28'
  g.lineWidth = 4
  g.lineCap = 'round'
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    g.beginPath()
    g.moveTo(Math.cos(a) * 19, Math.sin(a) * 19)
    g.lineTo(Math.cos(a) * 26, Math.sin(a) * 26)
    g.stroke()
  }
  g.beginPath()
  g.arc(0, 0, 14, 0, Math.PI * 2)
  g.fill()
  g.restore()
  // Nube
  g.fillStyle = '#ffffff'
  g.shadowColor = 'rgba(0,0,0,0.18)'
  g.shadowBlur = 4
  g.shadowOffsetY = 2
  g.beginPath()
  g.arc(36, 62, 15, 0, Math.PI * 2)
  g.arc(54, 54, 19, 0, Math.PI * 2)
  g.arc(70, 64, 13, 0, Math.PI * 2)
  g.roundRect(22, 60, 60, 17, 8.5)
  g.fill()
  return c.toBuffer('image/png')
}

fs.mkdirSync(OUT, { recursive: true })
const files = {
  'tiempo-180.png': draw(180, { rounded: false }), // iPhone pone sus propias esquinas
  'tiempo-192.png': draw(192),
  'tiempo-512.png': draw(512),
  'tiempo-maskable-512.png': draw(512, { maskable: true })
}
for (const [name, buf] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, name), buf)
  console.log(`✅ ${name} (${Math.round(buf.length / 1024)} KB)`)
}
