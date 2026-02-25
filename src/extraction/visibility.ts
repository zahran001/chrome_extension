export function isVisible(element: Element): boolean {
  const style = getComputedStyle(element);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) === 0) return false;
  // Dimension check (after style check to avoid unnecessary layout)
  if (element.clientWidth === 0 || element.clientHeight === 0) return false;
  return true;
}
