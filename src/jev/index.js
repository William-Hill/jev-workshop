// The Jev player is off by default. Add ?jev=1 to the URL to load it.
if (new URLSearchParams(window.location.search).has("jev")) {
  import("./player.js").then(({ startJev }) => startJev());
}
