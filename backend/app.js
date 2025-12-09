// =========================
//  SISTEMA VETERINARIA API
//  Backend todo en un solo archivo (corregido)
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

// conexión DB
const DB_CONFIG = {
  host: '127.0.0.1',
  user: 'root',
  password: 'manD7oka',
  port: 3307,
  database: 'vet_punto_venta'
};

app.use(express.json());
app.use(cors());

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

// ------------------- RUTAS DE PRODUCTOS Y VEHICULOS ---------------------

// GET productos (público para facilitar pruebas; si quieres lo proteges con authMiddleware)
app.get('/api/productos', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, nombre, precio, stock FROM productos');
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener productos:', err);
    res.status(500).json({ message: 'Error al obtener productos' });
  }
});

// POST crear producto (protegido)
app.post('/api/productos', authMiddleware, async (req, res) => {
  try {
    const { nombre, precio, stock } = req.body;
    if (!nombre || precio == null) {
      return res.status(400).json({ message: 'nombre y precio son requeridos' });
    }
    const [result] = await pool.query(
      'INSERT INTO productos (nombre, precio, stock) VALUES (?, ?, ?)',
      [nombre, parseFloat(precio), stock || 0]
    );
    res.status(201).json({ message: 'Producto creado', id: result.insertId });
  } catch (err) {
    console.error('Error al crear producto:', err);
    res.status(500).json({ message: 'Error al crear producto' });
  }
});

// GET vehiculos (público)
app.get('/api/vehiculos', async (req, res) => {
  try {
    // ajusta columnas según tu tabla
    const [rows] = await pool.query('SELECT id, placa, modelo, propietario FROM vehiculos');
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener vehiculos:', err);
    res.status(500).json({ message: 'Error al obtener vehiculos' });
  }
});

// ------------------- RUTAS DE VENTAS (REGISTRAR + CONSULTAR FACTURA) ---------------------

// POST registrar venta (protegido)
app.post('/api/ventas', authMiddleware, async (req, res) => {
  const { cliente, items } = req.body;

  if (!cliente || !cliente.nombre || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Cliente y productos son requeridos' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Crear cliente
    const [clienteResult] = await conn.query(
      'INSERT INTO clientes (nombre, telefono) VALUES (?, ?)',
      [cliente.nombre, cliente.telefono || null]
    );
    const id_cliente = clienteResult.insertId;

    // 2) Calcular total, validar stock y preparar detalle
    let total = 0;
    const detalles = [];

    for (const item of items) {
      const [prodRows] = await conn.query(
        'SELECT id, nombre, precio, stock FROM productos WHERE id = ?',
        [item.id_producto]
      );

      if (prodRows.length === 0) {
        throw new Error(`Producto con id ${item.id_producto} no existe`);
      }

      const prod = prodRows[0];

      if (prod.stock < item.cantidad) {
        throw new Error(`Stock insuficiente para ${prod.nombre}`);
      }

      const subtotal = prod.precio * item.cantidad;
      total += subtotal;

      detalles.push({
        id_producto: prod.id,
        cantidad: item.cantidad,
        subtotal
      });
    }

    // 3) Insertar venta
    const id_usuario = req.usuario.id; // viene del token
    const [ventaResult] = await conn.query(
      'INSERT INTO ventas (id_usuario, id_cliente, total) VALUES (?, ?, ?)',
      [id_usuario, id_cliente, total]
    );
    const id_venta = ventaResult.insertId;

    // 4) Insertar detalle y actualizar stock
    for (const det of detalles) {
      await conn.query(
        'INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, subtotal) VALUES (?, ?, ?, ?)',
        [id_venta, det.id_producto, det.cantidad, det.subtotal]
      );

      await conn.query(
        'UPDATE productos SET stock = stock - ? WHERE id = ?',
        [det.cantidad, det.id_producto]
      );
    }

    await conn.commit();

    res.status(201).json({
      message: 'Venta registrada correctamente',
      id_venta,
      total
    });
  } catch (err) {
    await conn.rollback();
    console.error('Error al registrar venta:', err);
    res.status(500).json({
      message: err.message || 'Error al registrar la venta'
    });
  } finally {
    conn.release();
  }
});

// GET venta (factura)
app.get('/api/ventas/:id', authMiddleware, async (req, res) => {
  const id_venta = req.params.id;

  try {
    const [ventaRows] = await pool.query(
      `SELECT v.id, v.fecha, v.total,
              u.nombre AS usuario_nombre,
              c.nombre AS cliente_nombre,
              c.telefono AS cliente_telefono
       FROM ventas v
       INNER JOIN usuarios u ON v.id_usuario = u.id
       INNER JOIN clientes c ON v.id_cliente = c.id
       WHERE v.id = ?`,
      [id_venta]
    );

    if (ventaRows.length === 0) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    const venta = ventaRows[0];

    const [detalleRows] = await pool.query(
      `SELECT dv.id_producto, p.nombre, p.precio, dv.cantidad, dv.subtotal
       FROM detalle_ventas dv
       INNER JOIN productos p ON dv.id_producto = p.id
       WHERE dv.id_venta = ?`,
      [id_venta]
    );

    const veterinaria = {
      nombre: 'Veterinaria Patitas Felices',
      direccion: 'Calle Principal #123',
      telefono: '555-123-4567'
    };

    res.json({
      veterinaria,
      venta,
      detalle: detalleRows
    });
  } catch (err) {
    console.error('Error al obtener factura:', err);
    res.status(500).json({ message: 'Error al obtener la factura' });
  }
});

// ------------------- LEVANTAR SERVIDOR ---------------------

app.listen(PORT, () => {
  console.log(`🚀 Servidor Backend Veterinaria en http://localhost:${PORT}`);
});
