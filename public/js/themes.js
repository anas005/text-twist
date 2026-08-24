/**
 * Text Twist — theme registry.
 *
 * Each theme lives in its own file under js/themes/ and is pure data:
 * a label plus a map of CSS custom properties (variables). The game
 * code never references concrete colors — every visual token is
 * resolved at runtime.
 *
 * To plug in a new theme: create js/themes/<name>.js that assigns
 * window.TextTwistThemes.<name> = { label, vars } and add a script
 * tag for it in index.html.
 */
/* eslint-env browser */
window.TextTwistThemes = {};
