import { localeDirection, currentLocale } from "./i18n";

/**
 * Set the locale of the HTML page
 * @returns {void}
 */
export function setPageLocale() {
    const html = document.documentElement;
    html.setAttribute("lang", currentLocale() );
    html.setAttribute("dir", localeDirection() );
}
