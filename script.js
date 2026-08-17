// غيّر هذه القيمة فقط بعد إنشاء البوت عبر BotFather.
const TELEGRAM_BOT_URL = "https://t.me/YOUR_BOT_USERNAME";

document.querySelectorAll("[data-telegram-bot]").forEach((link) => {
  link.href = TELEGRAM_BOT_URL;
});

document.querySelectorAll('a[href^="#"]').forEach((link) =>
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    }
  }),
);

const observer = new IntersectionObserver(
  (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("visible")),
  { threshold: 0.2 },
);

document.querySelectorAll(".steps article, .features li, .stats div").forEach((element) => {
  element.classList.add("reveal");
  observer.observe(element);
});
