const express = require("express");
const { Pool } = require("pg");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security Middleware ───────────────────────────────────────────────────────

// Restrict CORS to same origin in production; allow all only in development
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
              callback(null, true);
            } else {
              callback(new Error("CORS: origen no permitido"));
            }
          }
        : "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })
);

// Limit request body size to prevent DoS attacks (100 KB)
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

// ─── Database Connection ───────────────────────────────────────────────────────

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  // Connection pool settings
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("❌ Error inesperado en el pool de BD:", err.message);
});

// ─── Database Initialization ───────────────────────────────────────────────────

const VALID_CATEGORIAS = ["Hardware", "Software", "Licencia", "Servicio Cloud"];

const initDB = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS inventario (
      id          SERIAL PRIMARY KEY,
      nombre      VARCHAR(100)  NOT NULL,
      categoria   VARCHAR(50)   NOT NULL,
      cantidad    INTEGER       NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
      precio      DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (precio >= 0),
      fecha_creacion TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(query);
    console.log("✅ Base de datos inicializada correctamente");
  } catch (err) {
    console.error("❌ Error al inicializar DB:", err.message);
    process.exit(1); // Fatal: can't run without DB schema
  }
};

initDB();

// ─── Input Validation Helpers ──────────────────────────────────────────────────

/**
 * Validates and sanitises the product fields from req.body.
 * Returns { errors, data } where data is the cleaned payload.
 */
function validateProductBody(body) {
  const errors = [];
  const { nombre, categoria, cantidad, precio } = body;

  // nombre: required, 1-100 characters, trimmed
  if (!nombre || typeof nombre !== "string" || nombre.trim().length === 0) {
    errors.push("El nombre del producto es obligatorio.");
  } else if (nombre.trim().length > 100) {
    errors.push("El nombre no puede superar los 100 caracteres.");
  }

  // categoria: must be one of the allowed values
  if (!categoria || !VALID_CATEGORIAS.includes(categoria)) {
    errors.push(
      `La categoría debe ser una de: ${VALID_CATEGORIAS.join(", ")}.`
    );
  }

  // cantidad: integer, 0 or more
  const parsedCantidad = parseInt(cantidad, 10);
  if (
    cantidad === undefined ||
    cantidad === null ||
    cantidad === "" ||
    isNaN(parsedCantidad) ||
    parsedCantidad < 0
  ) {
    errors.push("La cantidad debe ser un número entero mayor o igual a 0.");
  }

  // precio: float, 0 or more, max 2 decimal places
  const parsedPrecio = parseFloat(precio);
  if (
    precio === undefined ||
    precio === null ||
    precio === "" ||
    isNaN(parsedPrecio) ||
    parsedPrecio < 0
  ) {
    errors.push("El precio debe ser un número mayor o igual a 0.");
  }

  if (errors.length > 0) {
    return { errors, data: null };
  }

  return {
    errors: [],
    data: {
      nombre: nombre.trim(),
      categoria,
      cantidad: parsedCantidad,
      precio: Math.round(parsedPrecio * 100) / 100, // ensure max 2 decimals
    },
  };
}

/**
 * Validates an ID from route params. Returns the integer or null if invalid.
 */
function validateId(paramId) {
  const id = parseInt(paramId, 10);
  if (isNaN(id) || id <= 0) return null;
  return id;
}

// Generic handler for unexpected server errors — never leaks internal details
function handleServerError(res, err) {
  console.error("❌ Error interno:", err.message);
  res.status(500).json({ error: "Error interno del servidor." });
}

// ─── API Routes ────────────────────────────────────────────────────────────────

// GET /api/items — list all products
app.get("/api/items", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM inventario ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (err) {
    handleServerError(res, err);
  }
});

// POST /api/items — create a product
app.post("/api/items", async (req, res) => {
  const { errors, data } = validateProductBody(req.body);
  if (errors.length > 0) {
    return res.status(422).json({ error: errors.join(" ") });
  }

  try {
    const result = await pool.query(
      `INSERT INTO inventario (nombre, categoria, cantidad, precio)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.nombre, data.categoria, data.cantidad, data.precio]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    handleServerError(res, err);
  }
});

// PUT /api/items/:id — update a product
app.put("/api/items/:id", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "ID de producto inválido." });
  }

  const { errors, data } = validateProductBody(req.body);
  if (errors.length > 0) {
    return res.status(422).json({ error: errors.join(" ") });
  }

  try {
    const result = await pool.query(
      `UPDATE inventario
       SET nombre=$1, categoria=$2, cantidad=$3, precio=$4
       WHERE id=$5
       RETURNING *`,
      [data.nombre, data.categoria, data.cantidad, data.precio, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Producto no encontrado." });
    }

    res.json(result.rows[0]);
  } catch (err) {
    handleServerError(res, err);
  }
});

// DELETE /api/items/:id — delete a product
app.delete("/api/items/:id", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "ID de producto inválido." });
  }

  try {
    const result = await pool.query(
      "DELETE FROM inventario WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Producto no encontrado." });
    }

    res.json({ message: "Producto eliminado correctamente.", id });
  } catch (err) {
    handleServerError(res, err);
  }
});

// Health check
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch {
    res.status(503).json({ status: "error", db: "unreachable" });
  }
});

// ─── 404 fallback for unknown API routes ───────────────────────────────────────
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Ruta no encontrada." });
});

// ─── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Solicitud demasiado grande." });
  }
  handleServerError(res, err);
});

// ─── Start Server ──────────────────────────────────────────────────────────────
const server = app.listen(PORT, () =>
  console.log(`🚀 FlowStock corriendo en http://localhost:${PORT}`)
);

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Apagando servidor...");
  server.close(async () => {
    await pool.end();
    console.log("✅ Conexión a BD cerrada.");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("🛑 Apagando servidor (SIGINT)...");
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});
