/** Prints one element instead of the whole application (see `shared/ui/print.css`): the element,
 * every ancestor up to `<body>` and `<body>` itself are marked for the length of the print job and
 * unmarked on `afterprint`. The ancestor marks let the stylesheet drop everything else from layout
 * (not just hide it) and flatten the shell around the region, so it prints at full page width. */
export function printRegion(element: HTMLElement | null): void {
  if (!element) return;
  const { body } = document;
  const ancestors: HTMLElement[] = [];
  for (let node = element.parentElement; node && node !== body; node = node.parentElement) {
    ancestors.push(node);
  }
  element.setAttribute('data-print-target', '');
  for (const node of ancestors) node.setAttribute('data-print-ancestor', '');
  body.setAttribute('data-printing', '');
  const cleanup = () => {
    element.removeAttribute('data-print-target');
    for (const node of ancestors) node.removeAttribute('data-print-ancestor');
    body.removeAttribute('data-printing');
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
}
