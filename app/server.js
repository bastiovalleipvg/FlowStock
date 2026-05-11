const express = require("express");
const { Pool } = require("pg");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Database Connection
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
});

// Initialize Database Table
const initDB = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS inventario (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      categoria VARCHAR(50),
      cantidad INTEGER DEFAULT 0,
      precio DECIMAL(10, 2),
      fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(query);
    console.log("✅ Base de datos inicializada correctamente");
  } catch (err) {
    console.error("❌ Error al inicializar DB:", err);
  }
};

initDB();

// API Routes
app.get("/api/items", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM inventario ORDER BY id DESC",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/items", async (req, res) => {
  const { nombre, categoria, cantidad, precio } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO inventario (nombre, categoria, cantidad, precio) VALUES ($1, $2, $3, $4) RETURNING *",
      [nombre, categoria, cantidad, precio],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/items/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, categoria, cantidad, precio } = req.body;
  try {
    const result = await pool.query(
      "UPDATE inventario SET nombre=$1, categoria=$2, cantidad=$3, precio=$4 WHERE id=$5 RETURNING *",
      [nombre, categoria, cantidad, precio, id],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/items/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM inventario WHERE id = $1", [id]);
    res.json({ message: "Item eliminado" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (req, res) => res.send("🚀 Servidor FlowStock funcionando"));

app.listen(PORT, () =>
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`),
);
