"use client";

import { useEffect } from "react";
import { LANGUAGE_STORAGE_KEY } from "../lib/i18n/detectLanguage";
import { isLanguageCode } from "../lib/i18n/languages";
import { contentStudioFrameAncestors } from "../lib/security/csp";

const messageNamespace = "vrena-content-studio";
const annotationAttribute = "data-vrena-content-studio-annotation";

function allowedParentOrigin(value: string) {
  return contentStudioFrameAncestors.some((source) => {
    if (source === "'self'") {
      return value === window.location.origin;
    }

    return source === value;
  });
}

function parentOriginFromReferrer() {
  if (!document.referrer) {
    return null;
  }

  try {
    const origin = new URL(document.referrer).origin;
    // A same-origin redirect inside the framed app can replace the original
    // Content Studio referrer with the app's own URL. Wait for a validated
    // message from the real parent instead of locking onto the wrong origin.
    if (origin === window.location.origin) {
      return null;
    }

    return allowedParentOrigin(origin) ? origin : null;
  } catch {
    return null;
  }
}

function editableTextElement(target: EventTarget | null) {
  if (!target || typeof (target as Element).closest !== "function") {
    return null;
  }

  return (target as Element).closest<HTMLElement>(
    "[data-copy-target],a,button,[role='button'],p,h1,h2,h3,h4,h5,h6,li,blockquote,label,strong,small",
  );
}

export default function ContentStudioPreviewBridge() {
  useEffect(() => {
    if (window.parent === window) {
      return;
    }

    let parentOrigin = parentOriginFromReferrer();

    let annotationMode = false;
    let highlightedElement: HTMLElement | null = null;
    let previousOutline = "";
    let previousOutlineOffset = "";
    let selectedValue = "";
    let readyTimer: number | null = null;

    const cursorStyle = document.createElement("style");
    cursorStyle.textContent = `
      html[${annotationAttribute}],
      html[${annotationAttribute}] * {
        cursor: crosshair !important;
      }

      html:not([${annotationAttribute}])
        [data-vrena-content-studio-toolbar] {
        display: none !important;
      }
    `;
    document.head.appendChild(cursorStyle);

    const toolbar = document.createElement("button");
    toolbar.type = "button";
    toolbar.textContent = "Propose edit";
    toolbar.setAttribute("aria-label", "Propose edit");
    toolbar.setAttribute("data-vrena-content-studio-toolbar", "");
    toolbar.style.cssText = [
      "position:fixed",
      "z-index:2147483647",
      "display:none",
      "min-height:42px",
      "padding:0 16px",
      "border:1px solid var(--vrena-orange-600)",
      "border-radius:8px",
      "background:var(--vrena-orange-600)",
      "color:var(--vrena-white)",
      "font:700 14px/1 Inter,Arial,sans-serif",
      "box-shadow:0 10px 28px rgb(var(--vrena-neutral-950-rgb) / .34)",
      "cursor:pointer",
    ].join(";");
    document.body.appendChild(toolbar);

    function post(type: string, payload: Record<string, unknown> = {}) {
      window.parent.postMessage(
        {
          namespace: messageNamespace,
          type,
          ...payload,
        },
        parentOrigin ?? "*",
      );
    }

    function clearHighlight() {
      if (!highlightedElement) {
        return;
      }

      highlightedElement.style.outline = previousOutline;
      highlightedElement.style.outlineOffset = previousOutlineOffset;
      highlightedElement = null;
    }

    function hideToolbar() {
      toolbar.style.display = "none";
    }

    function sendSelection(value: string) {
      const text = value.replace(/\s+/g, " ").trim();

      if (text.length >= 2) {
        post("selected-text", { text });
      }
    }

    function showToolbar(target: EventTarget | null) {
      if (!annotationMode) {
        hideToolbar();
        return;
      }

      const selection = window.getSelection();
      const text = selection?.toString().replace(/\s+/g, " ").trim() ?? "";
      const fallbackElement = editableTextElement(target);
      const fallbackText =
        (
          fallbackElement?.getAttribute("aria-label") ??
          fallbackElement?.innerText ??
          fallbackElement?.textContent ??
          ""
        )
          .replace(/\s+/g, " ")
          .trim();

      if (text.length < 2 && fallbackText.length < 2) {
        hideToolbar();
        return;
      }

      const range =
        selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const rect =
        text.length >= 2 && range
          ? range.getBoundingClientRect()
          : fallbackElement?.getBoundingClientRect();

      if (!rect) {
        hideToolbar();
        return;
      }

      selectedValue = text.length >= 2 ? text : fallbackText;
      toolbar.style.display = "block";

      const width = toolbar.offsetWidth || 150;
      const height = toolbar.offsetHeight || 42;
      const left = Math.min(
        Math.max(12, rect.left + rect.width / 2 - width / 2),
        window.innerWidth - width - 12,
      );
      const preferredTop = rect.top - height - 10;
      const top =
        preferredTop >= 12
          ? preferredTop
          : Math.min(rect.bottom + 10, window.innerHeight - height - 12);

      toolbar.style.left = `${left}px`;
      toolbar.style.top = `${top}px`;
    }

    function handlePointerUp(event: MouseEvent) {
      if (!annotationMode) {
        return;
      }

      window.setTimeout(() => showToolbar(event.target), 0);
    }

    function handlePointerOver(event: MouseEvent) {
      if (!annotationMode) {
        return;
      }

      const target = editableTextElement(event.target);

      if (!target || target === highlightedElement) {
        return;
      }

      clearHighlight();
      highlightedElement = target;
      previousOutline = target.style.outline;
      previousOutlineOffset = target.style.outlineOffset;
      target.style.outline = "3px solid var(--vrena-orange-600)";
      target.style.outlineOffset = "4px";
    }

    function handleAnnotationClick(event: MouseEvent) {
      if (!annotationMode || toolbar.contains(event.target as Node)) {
        return;
      }

      const selectedText =
        window.getSelection()?.toString().replace(/\s+/g, " ").trim() ?? "";

      if (selectedText.length >= 2) {
        return;
      }

      const target = editableTextElement(event.target);
      const text =
        (target?.innerText ?? target?.textContent ?? "")
          .replace(/\s+/g, " ")
          .trim();

      if (!target || text.length < 2) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      clearHighlight();
      sendSelection(text);
    }

    function handleToolbarClick(event: MouseEvent) {
      event.preventDefault();
      event.stopPropagation();
      hideToolbar();
      sendSelection(selectedValue);
    }

    function handleMessage(event: MessageEvent) {
      if (
        event.source !== window.parent ||
        !allowedParentOrigin(event.origin) ||
        event.data?.namespace !== messageNamespace
      ) {
        return;
      }

      parentOrigin = event.origin;

      if (event.data.type === "set-annotation-mode") {
        annotationMode = event.data.enabled === true;
        if (readyTimer !== null) {
          window.clearInterval(readyTimer);
          readyTimer = null;
        }
        document.documentElement.toggleAttribute(
          annotationAttribute,
          annotationMode,
        );

        if (!annotationMode) {
          hideToolbar();
          clearHighlight();
        }
      }

      if (
        event.data.type === "set-language" &&
        isLanguageCode(event.data.locale)
      ) {
        const nextLanguage = event.data.locale;

        if (window.localStorage.getItem(LANGUAGE_STORAGE_KEY) !== nextLanguage) {
          window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
          window.location.reload();
        }
      }
    }

    function handleScroll() {
      hideToolbar();
    }

    document.addEventListener("mouseup", handlePointerUp);
    document.addEventListener("mouseover", handlePointerOver);
    document.addEventListener("click", handleAnnotationClick, true);
    document.addEventListener("scroll", handleScroll, true);
    toolbar.addEventListener("click", handleToolbarClick);
    window.addEventListener("message", handleMessage);
    post("ready", { pathname: window.location.pathname });
    readyTimer = window.setInterval(
      () => post("ready", { pathname: window.location.pathname }),
      500,
    );

    return () => {
      document.removeEventListener("mouseup", handlePointerUp);
      document.removeEventListener("mouseover", handlePointerOver);
      document.removeEventListener("click", handleAnnotationClick, true);
      document.removeEventListener("scroll", handleScroll, true);
      toolbar.removeEventListener("click", handleToolbarClick);
      window.removeEventListener("message", handleMessage);
      if (readyTimer !== null) {
        window.clearInterval(readyTimer);
      }
      document.documentElement.removeAttribute(annotationAttribute);
      clearHighlight();
      cursorStyle.remove();
      toolbar.remove();
    };
  }, []);

  return null;
}
