window.CoralUtils = (function () {
  function createErrorDialog(header, message) {
    const dialog = new Coral.Dialog().set({
      variant: 'error',
      header: { innerHTML: header },
      content: { innerHTML: message },
      footer: { innerHTML: '<button is="coral-button" variant="primary" coral-close>OK</button>' },
      closable: true
    });
    document.body.appendChild(dialog);
    dialog.show();
    dialog.on('coral-overlay:close', () => dialog.remove());
  }

  function showCoralAlert(title, message) {
    Coral.Dialog.alert(title, message);
  }

  return {
    createErrorDialog,
    showCoralAlert
  };
})();
