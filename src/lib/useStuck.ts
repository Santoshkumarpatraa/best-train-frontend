import { useCallback, useRef, useState } from 'react';

/** Pixel value of a CSS length custom property, or 0 if it is not set. */
function cssPx(name: string): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

/** Tells a `position: sticky` element when it has started sticking, which CSS cannot express. */
export function useStuck(offsetVar?: string): [boolean, (node: HTMLElement | null) => void] {
  const [stuck, setStuck] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (node: HTMLElement | null) => {
      observer.current?.disconnect();
      observer.current = null;
      if (!node || typeof IntersectionObserver === 'undefined') return;

      const offset = offsetVar ? cssPx(offsetVar) : 0;
      observer.current = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
        rootMargin: `-${offset}px 0px 0px 0px`,
        threshold: 0,
      });
      observer.current.observe(node);
    },
    [offsetVar],
  );

  return [stuck, ref];
}

/** Publishes an element's height as a CSS variable, so what stacks below it can offset by a height that moves. */
export function usePublishedHeight(cssVar: string): (node: HTMLElement | null) => void {
  const observer = useRef<ResizeObserver | null>(null);

  return useCallback(
    (node: HTMLElement | null) => {
      observer.current?.disconnect();
      observer.current = null;

      if (!node) {
        document.documentElement.style.removeProperty(cssVar);
        return;
      }

      const publish = () => {
        const height = Math.round(node.getBoundingClientRect().height);
        document.documentElement.style.setProperty(cssVar, `${height}px`);
      };

      publish();
      if (typeof ResizeObserver === 'undefined') return;
      observer.current = new ResizeObserver(publish);
      observer.current.observe(node);
    },
    [cssVar],
  );
}
