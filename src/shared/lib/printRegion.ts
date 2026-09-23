/** Prints one element instead of the whole application (see `shared/ui/print.css`): the element
 * and `<body>` are marked for the length of the print job and unmarked on `afterprint`. */
export function printRegion(element: HTMLElement | null): void {
  if (!element) return;
  const { body } = document;
  element.setAttribute('data-print-target', '');
  body.setAttribute('data-printing', '');
  const cleanup = () => {
    element.removeAttribute('data-print-target');
    body.removeAttribute('data-printing');
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
}
