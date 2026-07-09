export const dynamic = "force-dynamic";

/**
 * The calSync embed SDK — a tiny, dependency-free script sites drop in to embed
 * a booking page. Two modes:
 *
 *   Inline:  <div data-calsync-embed data-url="/ada/intro" data-height="720"></div>
 *   Popup:   <button data-calsync-popup data-url="/ada/intro">Book a call</button>
 *
 *   <script src="https://APP/embed.js" async></script>
 *
 * A relative data-url is resolved against this app's origin. Serving it from a
 * route (not a static file) lets the origin follow APP_URL per deployment.
 */
export function GET(): Response {
  const base = process.env.APP_URL ?? "http://localhost:3000";

  const script = `(function(){
  "use strict";
  var BASE = ${JSON.stringify(base)};
  function resolve(u){ return /^https?:/.test(u) ? u : BASE.replace(/\\/$/,"") + (u[0]==="/"?u:"/"+u); }
  function frame(url){
    var f = document.createElement("iframe");
    f.src = url; f.loading = "lazy"; f.style.border = "0"; f.style.width = "100%";
    f.allow = "payment";
    return f;
  }
  function inline(el){
    if (el.__cs) return; el.__cs = 1;
    var url = el.getAttribute("data-url"); if(!url) return;
    var f = frame(resolve(url));
    f.style.minHeight = (el.getAttribute("data-height") || "700") + "px";
    el.appendChild(f);
  }
  function openModal(url){
    var ov = document.createElement("div");
    ov.setAttribute("data-calsync-overlay","");
    ov.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(15,15,20,.55);display:flex;align-items:center;justify-content:center;padding:16px";
    var box = document.createElement("div");
    box.style.cssText = "position:relative;background:#fff;border-radius:14px;overflow:hidden;width:100%;max-width:820px;height:88vh;box-shadow:0 20px 60px rgba(0,0,0,.3)";
    var close = document.createElement("button");
    close.textContent = "\\u00d7";
    close.setAttribute("aria-label","Close");
    close.style.cssText = "position:absolute;top:8px;right:10px;z-index:1;border:0;background:transparent;font-size:26px;line-height:1;cursor:pointer;color:#333";
    var f = frame(resolve(url)); f.style.height = "100%"; f.style.display = "block";
    function remove(){ ov.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e){ if(e.key==="Escape") remove(); }
    close.addEventListener("click", remove);
    ov.addEventListener("click", function(e){ if(e.target===ov) remove(); });
    document.addEventListener("keydown", onKey);
    box.appendChild(close); box.appendChild(f); ov.appendChild(box);
    document.body.appendChild(ov);
  }
  function popup(el){
    if (el.__cs) return; el.__cs = 1;
    var url = el.getAttribute("data-url"); if(!url) return;
    el.addEventListener("click", function(e){ e.preventDefault(); openModal(resolve(url)); });
  }
  function scan(){
    document.querySelectorAll("[data-calsync-embed]").forEach(inline);
    document.querySelectorAll("[data-calsync-popup]").forEach(popup);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
  window.calSync = { scan: scan, open: function(u){ openModal(resolve(u)); } };
})();`;

  return new Response(script, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
