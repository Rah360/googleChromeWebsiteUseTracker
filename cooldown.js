const timerEl = document.getElementById("cooldown-timer");
const closeBtn = document.getElementById("close-tab");

const params = new URLSearchParams(window.location.search);
let remaining = Math.max(1, Number(params.get("seconds")) || 60);
timerEl.textContent = String(remaining);

const intervalId = setInterval(() => {
  remaining -= 1;
  if (remaining <= 0) {
    clearInterval(intervalId);
    timerEl.textContent = "0";
    closeBtn.disabled = false;
    return;
  }
  timerEl.textContent = String(remaining);
}, 1000);

closeBtn.addEventListener("click", async () => {
  window.close();
});
