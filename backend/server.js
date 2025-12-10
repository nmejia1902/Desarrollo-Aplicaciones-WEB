// server.js
require('dotenv').config(); // carga .env al inicio

const express = require('express');
const cors = require('cors');

const app = express();

// middlewares globales
app.use(express.json());
app.use(cors());

// rutas
const authRoutes = require('./src/routes/auth');
const productosRoutes = require('./src/routes/productos');
const ventasRoutes = require('./src/routes/ventas');

// montar rutas bajo /api
app.use('/api/auth', authRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/ventas', ventasRoutes);

// ruta test root (opcional)
app.get('/api/test', (req, res) => {
  res.send('Backend Veterinaria funcionando ✔️');
});

// levantar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Backend Veterinaria en http://localhost:${PORT}`);
});
