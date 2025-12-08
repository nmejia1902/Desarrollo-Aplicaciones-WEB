// =========================
//  SISTEMA VETERINARIA API
//  Backend todo en un solo archivo
// =========================

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// ------------------- CONFIGURACIONES ---------------------

const app = express();

const PORT = 3000;
const SECRET_KEY = 'MiClaveSecretaSuperSegura';

// conexión fija sin .env
const DB_CONFIG = {
  host: '127.0.0.1',
  user: 'root',
  password: 'manD7oka',
  port: 3307,
  database: 'vet_punto_venta'
};

app.use(express.json());
app.use(cors());

// ------------------- CONEXIÓN A BASE DE DATOS ---------------------

const pool = mysql.createPool(DB_CONFIG);

(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Conexión a MySQL exitosa.');
    conn.release();
  } catch (error) {
    console.log('❌ Error conectando MySQL:', error.message);
  }
})();

// ------------------- MIDDLEWARE AUTH ---------------------

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ message: 'Token requerido' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, SECRET_KEY, (err, usuario) => {
    if (err) {
      return res.status(401).json({ message: 'Token inválido' });
    }

    req.usuario = usuario;
    next();
  });
};

// ------------------- RUTAS ---------------------

// Ruta de prueba
app.get('/api/test', (req, res) => {
  res.send('Backend Veterinaria funcionando ✔️');
});

// 🔹 REGISTRO DE USUARIO
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nombre, correo, password } = req.body;

    if (!nombre || !correo || !password) {
      return res.status(400).json({ message: 'nombre, correo y password son requeridos.' });
    }

    // verificar correo duplicado
    const [existe] = await pool.query(
      'SELECT id FROM usuarios WHERE correo = ?',
      [correo]
    );

    if (existe.length > 0) {
      return res.status(409).json({ message: 'El correo ya está registrado' });
    }

    // hash de contraseña
    const hashedPass = await bcrypt.hash(password, 10);

    // insertar usuario
    const [result] = await pool.query(
      'INSERT INTO usuarios (nombre, correo, password) VALUES (?, ?, ?)',
      [nombre, correo, hashedPass]
    );

    res.status(201).json({ message: 'Usuario registrado', id: result.insertId });

  } catch (err) {
    res.status(500).json({ message: 'Error al registrar usuario', error: err.message });
  }
});

// 🔹 LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { correo, password } = req.body;

    if (!correo || !password) {
      return res.status(400).json({ message: 'correo y password son requeridos' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM usuarios WHERE correo = ?',
      [correo]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    const usuario = rows[0];

    const isMatch = await bcrypt.compare(password, usuario.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // generar token
    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo },
      SECRET_KEY,
      { expiresIn: '2h' }
    );

    res.json({
      message: 'Login exitoso',
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo
      }
    });

  } catch (err) {
    res.status(500).json({ message: 'Error en login', error: err.message });
  }
});

// 🔹 Ruta protegida para pruebas
app.get('/api/protegido', authMiddleware, (req, res) => {
  res.json({
    message: 'Acceso permitido con token válido.',
    usuario: req.usuario
  });
});

// ------------------- LEVANTAR SERVIDOR ---------------------

app.listen(PORT, () => {
  console.log(`🚀 Servidor Backend Veterinaria en http://localhost:${PORT}`);
});
