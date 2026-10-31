// Aplica el tema guardado (o el del sistema) antes de que Angular arranque
(function () {
  try {
    var theme = localStorage.getItem('stockpilot.theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('ion-palette-dark');
    }
  } catch (error) {
    // Sin almacenamiento disponible: se mantiene el tema claro
  }
})();
