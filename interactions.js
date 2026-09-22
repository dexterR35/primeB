
document.addEventListener('click', event => {
  const link = event.target.closest('.mobile-menu a');
  if (link) link.closest('details').open = false;
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const menu = document.querySelector('.mobile-menu[open]');
  if (menu) {
    menu.open = false;
    menu.querySelector('summary').focus();
  }
});
