const API_URL = "/api/items";

// ─── DOM Elements ──────────────────────────────────────────────────────────────
const inventoryBody  = document.getElementById("inventory-body");
const productForm    = document.getElementById("product-form");
const modal          = document.getElementById("modal");
const addBtn         = document.getElementById("add-btn");
const closeModal     = document.getElementById("close-modal");
const searchInput    = document.getElementById("search-input");
const totalItemsEl   = document.getElementById("total-items");
const totalValueEl   = document.getElementById("total-value");
const lowStockEl     = document.getElementById("low-stock");
const submitBtn      = productForm.querySelector("[type=submit]");

let inventory = [];

// ─── XSS-safe text node helper ────────────────────────────────────────────────
function escapeHtml(value) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(String(value ?? "")));
  return div.innerHTML;
}

// ─── API helpers ───────────────────────────────────────────────────────────────

/**
 * Wrapper around fetch that always returns { ok, data }.
 * `data` is the parsed JSON body (may contain { error: "..." } on failure).
 */
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = { error: `Error del servidor (HTTP ${res.status})` };
  }

  return { ok: res.ok, status: res.status, data };
}

// ─── Fetch & Render ────────────────────────────────────────────────────────────

async function fetchInventory() {
  setTableLoading(true);
  try {
    const { ok, data } = await apiFetch(API_URL);
    if (!ok) {
      showToast(data.error || "Error al cargar el inventario.", "danger");
      inventory = [];
    } else {
      inventory = Array.isArray(data) ? data : [];
    }
  } catch {
    showToast("No se pudo conectar con el servidor.", "danger");
    inventory = [];
  } finally {
    setTableLoading(false);
    renderInventory(inventory);
    updateStats();
  }
}

function setTableLoading(loading) {
  if (loading) {
    inventoryBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-dim);">
          Cargando inventario…
        </td>
      </tr>`;
  }
}

function renderInventory(items) {
  if (items.length === 0) {
    inventoryBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-dim);">
          Sin productos registrados.
        </td>
      </tr>`;
    return;
  }

  // Build rows using DOM API to avoid XSS — no innerHTML with user data
  inventoryBody.innerHTML = "";
  items.forEach((item) => {
    const cantidad   = Number(item.cantidad) || 0;
    const precio     = parseFloat(item.precio) || 0;
    const isLowStock = cantidad < 5;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="font-weight:600;">${escapeHtml(item.nombre)}</div>
        <div style="font-size:0.75rem; color:var(--text-dim);">ID: #${escapeHtml(item.id)}</div>
      </td>
      <td><span class="badge">${escapeHtml(item.categoria)}</span></td>
      <td>
        <span style="color:${isLowStock ? "var(--accent-orange)" : "inherit"}">
          ${escapeHtml(cantidad)} unidades
        </span>
      </td>
      <td>$${precio.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CLP</td>
      <td>
        <div style="display:flex; gap:0.5rem;">
          <button class="btn-icon btn-edit"   data-id="${escapeHtml(item.id)}" title="Editar"><i data-lucide="edit-2"></i></button>
          <button class="btn-icon btn-delete" data-id="${escapeHtml(item.id)}" title="Eliminar"><i data-lucide="trash-2"></i></button>
        </div>
      </td>`;
    inventoryBody.appendChild(tr);
  });

  // Attach events via delegation-safe per-button listeners (no inline onclick)
  inventoryBody.querySelectorAll(".btn-edit").forEach((btn) => {
    btn.addEventListener("click", () => editItem(parseInt(btn.dataset.id, 10)));
  });
  inventoryBody.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteItem(parseInt(btn.dataset.id, 10)));
  });

  lucide.createIcons();
}

function updateStats() {
  const total = inventory.length;
  const value = inventory.reduce(
    (acc, item) => acc + (Number(item.cantidad) || 0) * (parseFloat(item.precio) || 0),
    0
  );
  const low = inventory.filter((item) => Number(item.cantidad) < 5).length;

  totalItemsEl.textContent = total;
  totalValueEl.textContent = `$${value.toLocaleString("es-CL", { maximumFractionDigits: 0 })} CLP`;
  lowStockEl.textContent   = low;
}

// ─── Search ────────────────────────────────────────────────────────────────────

searchInput.addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase().trim();
  const filtered = inventory.filter((item) => {
    const nombre    = (item.nombre    || "").toLowerCase();
    const categoria = (item.categoria || "").toLowerCase();
    return nombre.includes(term) || categoria.includes(term);
  });
  renderInventory(filtered);
});

// ─── Create / Update ───────────────────────────────────────────────────────────

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id       = document.getElementById("product-id").value;
  const nombre   = document.getElementById("nombre").value.trim();
  const categoria = document.getElementById("categoria").value;
  const cantidad  = document.getElementById("cantidad").value;
  const precio    = document.getElementById("precio").value;

  // Client-side validation mirrors server rules
  if (!nombre) {
    showToast("El nombre del producto es obligatorio.", "danger");
    return;
  }
  if (nombre.length > 100) {
    showToast("El nombre no puede superar los 100 caracteres.", "danger");
    return;
  }
  const parsedCantidad = parseInt(cantidad, 10);
  if (isNaN(parsedCantidad) || parsedCantidad < 0) {
    showToast("La cantidad debe ser un número entero ≥ 0.", "danger");
    return;
  }
  const parsedPrecio = parseFloat(precio);
  if (isNaN(parsedPrecio) || parsedPrecio < 0) {
    showToast("El precio debe ser un número ≥ 0.", "danger");
    return;
  }

  const payload = {
    nombre,
    categoria,
    cantidad: parsedCantidad,
    precio:   parsedPrecio,
  };

  const method = id ? "PUT" : "POST";
  const url    = id ? `${API_URL}/${id}` : API_URL;

  setSubmitLoading(true);
  try {
    const { ok, data } = await apiFetch(url, {
      method,
      body: JSON.stringify(payload),
    });

    if (ok) {
      showToast(id ? "Producto actualizado correctamente." : "Producto creado correctamente.");
      hideModal();
      fetchInventory();
    } else {
      // Show the server's validation message
      showToast(data.error || "Error al guardar el producto.", "danger");
    }
  } catch {
    showToast("No se pudo conectar con el servidor.", "danger");
  } finally {
    setSubmitLoading(false);
  }
});

function setSubmitLoading(loading) {
  submitBtn.disabled     = loading;
  submitBtn.textContent  = loading ? "Guardando…" : "Guardar Cambios";
}

// ─── Delete ────────────────────────────────────────────────────────────────────

async function deleteItem(id) {
  if (!confirm("¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer.")) return;
  try {
    const { ok, data } = await apiFetch(`${API_URL}/${id}`, { method: "DELETE" });
    if (ok) {
      showToast("Producto eliminado correctamente.");
      fetchInventory();
    } else {
      showToast(data.error || "Error al eliminar el producto.", "danger");
    }
  } catch {
    showToast("No se pudo conectar con el servidor.", "danger");
  }
}

// ─── Edit ──────────────────────────────────────────────────────────────────────

function editItem(id) {
  const item = inventory.find((i) => i.id === id);
  if (!item) {
    showToast("Producto no encontrado.", "danger");
    return;
  }
  document.getElementById("product-id").value   = item.id;
  document.getElementById("nombre").value        = item.nombre;
  document.getElementById("categoria").value     = item.categoria;
  document.getElementById("cantidad").value      = item.cantidad;
  document.getElementById("precio").value        = parseFloat(item.precio).toFixed(2);
  document.getElementById("modal-title").textContent = "Editar Producto";
  submitBtn.textContent = "Guardar Cambios";
  modal.classList.add("active");
}

// ─── Modal ─────────────────────────────────────────────────────────────────────

addBtn.onclick = () => {
  productForm.reset();
  document.getElementById("product-id").value        = "";
  document.getElementById("modal-title").textContent = "Añadir Producto";
  submitBtn.textContent = "Guardar Cambios";
  modal.classList.add("active");
};

function hideModal() {
  modal.classList.remove("active");
  productForm.reset();
  setSubmitLoading(false);
}

closeModal.onclick = hideModal;
window.addEventListener("click", (e) => {
  if (e.target === modal) hideModal();
});

// ─── Toast ─────────────────────────────────────────────────────────────────────

function showToast(msg, type = "success") {
  const container = document.getElementById("toast-container");
  const toast     = document.createElement("div");
  toast.className  = `toast ${type}`;
  // Use textContent — never innerHTML — to avoid XSS in toast messages
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ─── Init ──────────────────────────────────────────────────────────────────────

fetchInventory();
