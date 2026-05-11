const API_URL = "/api/items";

// Elements
const inventoryBody = document.getElementById("inventory-body");
const productForm = document.getElementById("product-form");
const modal = document.getElementById("modal");
const addBtn = document.getElementById("add-btn");
const closeModal = document.getElementById("close-modal");
const searchInput = document.getElementById("search-input");

// Stats Elements
const totalItemsEl = document.getElementById("total-items");
const totalValueEl = document.getElementById("total-value");
const lowStockEl = document.getElementById("low-stock");

let inventory = [];

// Fetch and Render
async function fetchInventory() {
  try {
    const res = await fetch(API_URL);
    inventory = await res.json();
    renderInventory(inventory);
    updateStats();
  } catch (err) {
    showToast("Error al cargar inventario", "danger");
  }
}

function renderInventory(items) {
  inventoryBody.innerHTML = items
    .map(
      (item) => `
        <tr>
            <td>
                <div style="font-weight: 600;">${item.nombre}</div>
                <div style="font-size: 0.75rem; color: var(--text-dim);">ID: #${item.id}</div>
            </td>
            <td><span class="badge">${item.categoria}</span></td>
            <td>
                <span style="color: ${item.cantidad < 5 ? "var(--accent-orange)" : "inherit"}">
                    ${item.cantidad} unidades
                </span>
            </td>
            <td>$${parseFloat(item.precio).toLocaleString("es-CL")} CLP</td>
            <td>
                <div style="display: flex; gap: 0.5rem;">
                    <button onclick="editItem(${item.id})" class="btn-icon"><i data-lucide="edit-2"></i></button>
                    <button onclick="deleteItem(${item.id})" class="btn-icon btn-delete"><i data-lucide="trash-2"></i></button>
                </div>
            </td>
        </tr>
    `,
    )
    .join("");
  lucide.createIcons();
}

function updateStats() {
  const total = inventory.length;
  const value = inventory.reduce(
    (acc, item) => acc + item.cantidad * item.precio,
    0,
  );
  const low = inventory.filter((item) => item.cantidad < 5).length;

  totalItemsEl.textContent = total;
  totalValueEl.textContent = `$${value.toLocaleString("es-CL", { maximumFractionDigits: 0 })} CLP`;
  lowStockEl.textContent = low;
}

// Search
searchInput.addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase();
  const filtered = inventory.filter(
    (item) =>
      item.nombre.toLowerCase().includes(term) ||
      item.categoria.toLowerCase().includes(term),
  );
  renderInventory(filtered);
});

// Create / Update
productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("product-id").value;
  const data = {
    nombre: document.getElementById("nombre").value,
    categoria: document.getElementById("categoria").value,
    cantidad: parseInt(document.getElementById("cantidad").value),
    precio: parseFloat(document.getElementById("precio").value),
  };

  try {
    const method = id ? "PUT" : "POST";
    const url = id ? `${API_URL}/${id}` : API_URL;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      showToast(id ? "Producto actualizado" : "Producto creado");
      hideModal();
      fetchInventory();
    }
  } catch (err) {
    showToast("Error al guardar", "danger");
  }
});

// Delete
async function deleteItem(id) {
  if (!confirm("¿Estás seguro de eliminar este producto?")) return;
  try {
    await fetch(`${API_URL}/${id}`, { method: "DELETE" });
    showToast("Producto eliminado");
    fetchInventory();
  } catch (err) {
    showToast("Error al eliminar", "danger");
  }
}

// UI Helpers
function editItem(id) {
  const item = inventory.find((i) => i.id === id);
  document.getElementById("product-id").value = item.id;
  document.getElementById("nombre").value = item.nombre;
  document.getElementById("categoria").value = item.categoria;
  document.getElementById("cantidad").value = item.cantidad;
  document.getElementById("precio").value = item.precio;

  document.getElementById("modal-title").textContent = "Editar Producto";
  modal.classList.add("active");
}

function showToast(msg, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

addBtn.onclick = () => {
  productForm.reset();
  document.getElementById("product-id").value = "";
  document.getElementById("modal-title").textContent = "Añadir Producto";
  modal.classList.add("active");
};

function hideModal() {
  modal.classList.remove("active");
}
closeModal.onclick = hideModal;
window.onclick = (e) => {
  if (e.target === modal) hideModal();
};

// Init
fetchInventory();
