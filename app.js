const STORE = {
  name: "TRAZO PY",
  whatsapp: "595981000000", // Reemplazar por tu número real: 595 + número sin el cero inicial.
  currency: "Gs.",
  shippingPrice: 25000, // Tarifa provisoria; debe coincidir con SHIPPING_PRICE en Netlify.
  products: [
    { id: 1, name: "Hecho para destacar", price: 95000, art: "HECHO<br><i style='color:#eaff3f'>PARA</i><br>DESTACAR", base: "black", badge: "MÁS PEDIDA" },
    { id: 2, name: "Modo creativo", price: 95000, art: "MODO<br><span style='color:#ff5939'>CREATIVO</span>", base: "white", badge: "NUEVA" },
    { id: 3, name: "Paraguay vibra", price: 105000, art: "PARAGUAY<br><span style='font-size:.7em'>VIBRA</span>", base: "black" },
    { id: 4, name: "Sin miedo", price: 95000, art: "SIN<br><span style='color:#ff5939'>MIEDO</span>", base: "white" }
  ]
};

let cart = JSON.parse(localStorage.getItem("trazo-cart") || "[]");
let selected = { product: null, color: "Negro", size: "M" };
let customDesign = { color: "Negro", size: "M", printSize: "medium", text: "", side: "Frente", back: false, hasImage: false };
const $ = (selector) => document.querySelector(selector);
const format = (value) => `${STORE.currency} ${value.toLocaleString("es-PY")}`;

function productVisual(product, color) {
  const base = color ? color === "Negro" ? "black" : "white" : product.base;
  return `<div class="shirt shirt-${base}"><div class="mini-print">${product.art}</div></div>`;
}

function renderProducts() {
  $("#product-grid").innerHTML = STORE.products.map(product => `
    <article class="product-card" data-id="${product.id}" tabindex="0" aria-label="Ver ${product.name}">
      <div class="product-image">${product.badge ? `<span class="product-badge">${product.badge}</span>` : ""}${productVisual(product)}</div>
      <div class="product-info"><div><h3>${product.name}</h3><p>Negro / Blanco · S al XXL</p></div><strong>${format(product.price)}</strong></div>
    </article>`).join("");
  document.querySelectorAll(".product-card").forEach(card => {
    card.addEventListener("click", () => openProduct(Number(card.dataset.id)));
    card.addEventListener("keydown", e => { if (e.key === "Enter") openProduct(Number(card.dataset.id)); });
  });
}

function openProduct(id) {
  selected = { product: STORE.products.find(p => p.id === id), color: "Negro", size: "M" };
  renderDialog();
  $("#product-dialog").showModal();
}

function renderDialog() {
  const p = selected.product;
  $("#dialog-content").innerHTML = `<div class="dialog-product">
    <div class="dialog-image">${productVisual(p, selected.color)}</div>
    <div class="dialog-info"><p class="eyebrow">Remera unisex · Estampa DTF</p><h2>${p.name}</h2><p class="price">${format(p.price)}</p>
      <div class="option-group"><label>Color: <span id="chosen-color">${selected.color}</span></label><div class="choices">
        ${["Negro","Blanco"].map(c => `<button class="choice color-choice ${c === selected.color ? "active" : ""}" data-option="color" data-value="${c}" aria-label="${c}"></button>`).join("")}
      </div></div>
      <div class="option-group"><label>Talle: <span id="chosen-size">${selected.size}</span></label><div class="choices">
        ${["S","M","L","XL","XXL"].map(s => `<button class="choice ${s === selected.size ? "active" : ""}" data-option="size" data-value="${s}">${s}</button>`).join("")}
      </div></div>
      <button class="button primary dialog-add" id="dialog-add">Agregar al carrito</button>
      <p style="font-size:.78rem;color:var(--muted);line-height:1.5">Preparación estimada: 2 a 4 días hábiles. Te confirmamos la disponibilidad antes del pago.</p>
    </div></div>`;
  document.querySelectorAll("[data-option]").forEach(button => button.addEventListener("click", () => {
    if (button.dataset.option === "color") selected.color = button.dataset.value;
    else selected.size = button.dataset.value;
    renderDialog();
  }));
  $("#dialog-add").addEventListener("click", addToCart);
}

function addToCart() {
  const key = `${selected.product.id}-${selected.color}-${selected.size}`;
  const existing = cart.find(item => item.key === key);
  if (existing) existing.qty += 1;
  else cart.push({ key, id: selected.product.id, name: selected.product.name, price: selected.product.price, color: selected.color, size: selected.size, qty: 1 });
  saveCart();
  $("#product-dialog").close();
  showToast("¡Remera agregada al carrito!");
  openCart();
}

function saveCart() {
  localStorage.setItem("trazo-cart", JSON.stringify(cart));
  renderCart();
}

function renderCart() {
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  $("#cart-count").textContent = count;
  $("#cart-total").textContent = format(total);
  $("#cart-empty").hidden = cart.length > 0;
  $("#cart-items").innerHTML = cart.map(item => {
    const product = STORE.products.find(p => p.id === item.id);
    const thumb = product ? productVisual(product, item.color) : `<div class="shirt shirt-${item.color === "Negro" ? "black" : "white"}"><div class="mini-print">TU<br>DISEÑO</div></div>`;
    return `<div class="cart-item"><div class="cart-item-thumb">${thumb}</div><div><h4>${item.qty}× ${item.name}</h4><p>${item.color} · Talle ${item.size}${item.custom ? `<br>${item.custom.printSizeLabel} · ${item.custom.side}${item.custom.back ? " + espalda" : ""}` : ""}<br>${format(item.price * item.qty)}</p></div><button class="remove-item" data-remove="${item.key}">Quitar</button></div>`;
  }).join("");
  document.querySelectorAll("[data-remove]").forEach(btn => btn.addEventListener("click", () => {
    cart = cart.filter(item => item.key !== btn.dataset.remove); saveCart();
  }));
}

function openCart() { $("#cart").classList.add("open"); $("#cart").setAttribute("aria-hidden", "false"); $("#overlay").hidden = false; }
function closeCart() { $("#cart").classList.remove("open"); $("#cart").setAttribute("aria-hidden", "true"); $("#overlay").hidden = true; }
function whatsappUrl(message) { return `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(message)}`; }
function checkout() {
  if (!cart.length) return showToast("Primero agregá una remera");
  closeCart();
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  $("#payment-subtotal").textContent = format(subtotal);
  $("#payment-shipping").textContent = format(STORE.shippingPrice);
  $("#payment-total").textContent = format(subtotal + STORE.shippingPrice);
  $("#payment-error").textContent = "";
  $("#checkout-dialog").showModal();
}

async function createPayment(event) {
  event.preventDefault();
  const button = $("#pay-button");
  const form = new FormData(event.currentTarget);
  button.disabled = true;
  button.textContent = "Preparando pago…";
  $("#payment-error").textContent = "";
  try {
    const response = await fetch("/.netlify/functions/create-payment", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer: Object.fromEntries(form.entries()), items: cart.map(({ id, color, size, qty, custom }) => ({ id, color, size, qty, custom })) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No pudimos iniciar el pago.");
    sessionStorage.setItem("last-pagopar-order", JSON.stringify({ orderId: data.orderId, hash: data.hash }));
    window.location.href = data.checkoutUrl;
  } catch (error) {
    $("#payment-error").textContent = error.message.includes("Failed to fetch") ? "La integración se activa al publicar la tienda en Netlify." : error.message;
    button.disabled = false;
    button.textContent = "Continuar a Pagopar →";
  }
}
function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2200); }

function customPrice() { const prices={small:25000,medium:30000,large:40000}; return 55000+prices[customDesign.printSize]+(customDesign.back?20000:0)+(customDesign.size==="XXL"?5000:0); }
function updateDesigner(){const shirt=$("#designer-shirt"),design=$("#user-design");shirt.className=`shirt shirt-${customDesign.color==="Negro"?"black":"white"} designer-shirt`;design.className=`user-design size-${customDesign.printSize}`;$("#design-text").textContent=customDesign.text||(customDesign.side==="Frente"?"TU DISEÑO":"ESPALDA");$("#designer-total").textContent=format(customPrice());}
document.querySelectorAll("[data-design-color]").forEach(button=>button.addEventListener("click",()=>{customDesign.color=button.dataset.designColor;document.querySelectorAll("[data-design-color]").forEach(b=>b.classList.toggle("active",b===button));updateDesigner();}));
document.querySelectorAll("[data-side]").forEach(button=>button.addEventListener("click",()=>{customDesign.side=button.dataset.side;document.querySelectorAll("[data-side]").forEach(b=>b.classList.toggle("active",b===button));updateDesigner();}));
$("#design-size").addEventListener("change",e=>{customDesign.size=e.target.value;updateDesigner();});
$("#print-size").addEventListener("change",e=>{customDesign.printSize=e.target.value;updateDesigner();});
$("#custom-text").addEventListener("input",e=>{customDesign.text=e.target.value.trim();updateDesigner();});
$("#add-back").addEventListener("change",e=>{customDesign.back=e.target.checked;updateDesigner();});
$("#custom-image").addEventListener("change",e=>{const file=e.target.files[0];if(!file)return;if(file.size>8*1024*1024){e.target.value="";return showToast("La imagen supera los 8 MB");}const reader=new FileReader();reader.onload=()=>{const img=$("#design-image");img.src=reader.result;img.hidden=false;customDesign.hasImage=true;};reader.readAsDataURL(file);});
$("#designer-form").addEventListener("submit",e=>{e.preventDefault();const labels={small:"Impresión pequeña",medium:"Impresión mediana",large:"Impresión grande"},price=customPrice(),custom={...customDesign,printSizeLabel:labels[customDesign.printSize]};cart.push({key:`custom-${Date.now()}`,id:100,name:"Remera personalizada",price,color:customDesign.color,size:customDesign.size,qty:1,custom});saveCart();showToast("Diseño agregado al carrito");openCart();});

$("#open-cart").addEventListener("click", openCart);
$("#close-cart").addEventListener("click", closeCart);
$("#overlay").addEventListener("click", closeCart);
$("#checkout").addEventListener("click", checkout);
$("#checkout-close").addEventListener("click", () => $("#checkout-dialog").close());
$("#payment-form").addEventListener("submit", createPayment);
$("#dialog-close").addEventListener("click", () => $("#product-dialog").close());
$("#custom-design").addEventListener("click", () => window.open(whatsappUrl("¡Hola! Quiero cotizar una remera con mi propio diseño. ¿Qué archivo debo enviarles?"), "_blank", "noopener"));
$("#year").textContent = new Date().getFullYear();
renderProducts(); renderCart();
