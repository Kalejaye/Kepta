// /JS/cart.js

// 1️⃣ Configure LocalForage
localforage.config({ name: "kepta_cart" });

// 2️⃣ On page load, render badge + cart (if on cart.html), and set up clicks
document.addEventListener("DOMContentLoaded", () => {
  refreshUI();
  document.body.addEventListener("click", handleClick);
});

// 3️⃣ Re-draw badge + cart table (simplified for-loop version)
async function refreshUI() {
  // fetch or default
  const cart = (await localforage.getItem("cart")) || [];

  // — Update the badge —
  let totalQty = 0;
  for (const item of cart) {
    totalQty += item.qty;
  }
  const badge = document.getElementById("cart-count-badge");
  if (badge) badge.textContent = totalQty;

  // — If we’re on cart.html, render items —
  const out = document.getElementById("cart-items");
  if (!out) return;

  // Empty‐cart case
  if (cart.length === 0) {
    out.innerHTML = "<p>Your cart is empty.</p>";
    return;
  } else {
    // Build the table HTML with a plain for-loop
    let html = ''
      + '<table class="table">'
      +   '<thead><tr>'
      +     '<th>Item</th><th>Price</th><th>Qty</th><th>Total</th><th></th>'
      +   '</tr></thead>'
      +   '<tbody>';

    let grandTotal = 0;
    for (let i = 0; i < cart.length; i++) {
      const it = cart[i];
      const lineTotal = it.price * it.qty;
      grandTotal += lineTotal;

      html += ''
        + '<tr data-i="' + i + '">'
        +   '<td><img src="' + it.img + '" width="50" /> ' + it.name + '</td>'
        +   '<td>₦' + it.price + '</td>'
        +   '<td>'
        +     '<button class="qty-decrease">–</button> '
        +     it.qty + ' '
        +     '<button class="qty-increase">+</button>'
        +   '</td>'
        +   '<td>₦' + lineTotal + '</td>'
        +   '<td><button class="remove-item">×</button></td>'
        + '</tr>';
    }

    html += ''
      +   '</tbody>'
      + '</table>'
      + '<div class="text-end">'
      +   '<strong>Grand Total: ₦' + grandTotal.toLocaleString() + '</strong>'
      + '</div>'
      + '<div class="text-end mt-3">'
      +   '<button id="checkoutbtn" class="btn btn-primary">Checkout</button>'
      + '</div>';

    out.innerHTML = html;
  }
}

// 4️⃣ Handle all cart-related clicks (add, +, –, remove, checkout)
async function handleClick(e) {
  const t = e.target;

  // ── Add to Cart ──────────────────────────
  if (t.matches(".add-to-cart-btn")) {
    const card = t.closest(".menu-item-card");
    const item = {
      name:  card.dataset.name,
      price: +card.dataset.price,
      img:   card.dataset.img,
      qty:   1
    };

    const cart = (await localforage.getItem("cart")) || [];
    const idx  = cart.findIndex(x => x.name === item.name);

    if (idx > -1) cart[idx].qty++;
    else cart.push(item);

    await localforage.setItem("cart", cart);
    return refreshUI();
  }

  // ── Cart Page Actions: +, –, remove ──────
  if (t.matches(".qty-increase, .qty-decrease, .remove-item")) {
    const row  = t.closest("tr");
    const i    = +row.dataset.i;
    const cart = (await localforage.getItem("cart")) || [];

    if (t.matches(".qty-increase"))      cart[i].qty++;
    else if (t.matches(".qty-decrease")) {
      if (cart[i].qty > 1) cart[i].qty--;
      else cart.splice(i, 1);
    }
    else /* remove-item */              cart.splice(i, 1);

    await localforage.setItem("cart", cart);
    return refreshUI();
  }

  // ── Checkout Button ──────────────────────
  if (t.matches("#checkoutbtn")) {
    await processCheckout();
  }
}

// 5️⃣ Process checkout and create Paystack payment page
async function processCheckout() {
  try {
    // Get cart data
    const cart = (await localforage.getItem("cart")) || [];
    
    if (cart.length === 0) {
      alert("Your cart is empty!");
      return;
    }

    // Calculate total amount
    let grandTotal = 0;
    for (const item of cart) {
      grandTotal += item.price * item.qty;
    }

    // Get user email from localStorage (assuming it's stored during login)
    const userEmail = localStorage.getItem("userEmail") || "customer@kepta.com";
    
    // Prepare order description
    const itemNames = cart.map(item => `${item.name} (x${item.qty})`).join(", ");
    const orderDescription = `Kepta Order: ${itemNames}`;

    // Show loading state on button
    const checkoutBtn = document.getElementById("checkoutbtn");
    const originalText = checkoutBtn.textContent;
    checkoutBtn.textContent = "Processing...";
    checkoutBtn.disabled = true;

    // Create payment page via backend API
    const response = await axios.post("http://localhost:1000/create-payment", {
      name: "Kepta Food Order",
      description: orderDescription,
      amount: grandTotal,
      email: userEmail,
      callback_url: `${window.location.protocol}//${window.location.host}/HTML/payment-success.html`
    });

    // Reset button state
    checkoutBtn.textContent = originalText;
    checkoutBtn.disabled = false;

    if (response.data.code === "success") {
      const paymentUrl = response.data.data?.payment_url;
      
      if (paymentUrl) {
        // Open Paystack payment page in a new window/tab
        const paymentWindow = window.open(paymentUrl, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
        
        if (paymentWindow) {
          // Focus on the new window
          paymentWindow.focus();
        } else {
          alert("Please allow popups for this site, or click here to open payment page manually.");
          // Fallback: redirect in current window
          window.location.href = paymentUrl;
        }
      } else {
        alert("Payment URL not received from server. Please try again.");
      }
    } else {
      alert(`Payment Error: ${response.data.message}`);
    }

  } catch (error) {
    console.error("Checkout error:", error);
    
    // Reset button state
    const checkoutBtn = document.getElementById("checkoutbtn");
    if (checkoutBtn) {
      checkoutBtn.textContent = "Checkout";
      checkoutBtn.disabled = false;
    }
    
    alert("Unable to process checkout. Please try again.");
  }
}
