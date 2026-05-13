export function getRequiredElement<T extends HTMLElement>(id: string, expectedType: new () => T): T {
  const element = document.getElementById(id);

  if (!(element instanceof expectedType)) {
    throw new Error(`Expected #${id} to be ${expectedType.name}`);
  }

  return element;
}

export function clear(element: HTMLElement): void {
  element.replaceChildren();
}

export function textElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  text: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.textContent = text;

  if (className) {
    element.className = className;
  }

  return element;
}
