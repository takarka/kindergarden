/* ==========================================================================
   AQYL — интерактив лендинга. Без зависимостей.
   Всё тяжёлое инициализируется после первого экрана (requestIdleCallback).
   ========================================================================== */

(function () {
  "use strict";

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 200); };

  /* ------------------------------------------------------------------ i18n */

  var DICT = window.I18N || { ru: {} };
  var HTML_LANG = { ru: "ru", kz: "kk", en: "en" };
  var lang = "ru";

  function t(key) {
    var pack = DICT[lang] || {};
    if (key in pack) return pack[key];
    return (DICT.ru && DICT.ru[key]) || "";
  }

  function setNodeText(el, value) {
    // Если внутри есть вложенные переводимые узлы (например <small>), меняем
    // только собственный текст элемента, не затирая детей.
    if (el.querySelector("[data-i18n]")) {
      for (var i = 0; i < el.childNodes.length; i++) {
        if (el.childNodes[i].nodeType === 3 && el.childNodes[i].nodeValue.trim()) {
          el.childNodes[i].nodeValue = value;
          return;
        }
      }
      el.insertBefore(document.createTextNode(value), el.firstChild);
      return;
    }
    if (el.hasAttribute("data-i18n-html") || value.indexOf("<") > -1) el.innerHTML = value;
    else el.textContent = value;
  }

  function applyLang(code) {
    if (!DICT[code]) code = "ru";
    lang = code;
    document.documentElement.lang = HTML_LANG[code] || code;

    $$("[data-i18n]").forEach(function (el) {
      var v = t(el.getAttribute("data-i18n"));
      if (v) setNodeText(el, v);
    });
    $$("[data-i18n-ph]").forEach(function (el) {
      var v = t(el.getAttribute("data-i18n-ph"));
      if (v) el.setAttribute("placeholder", v);
    });

    $$(".lang button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === code));
    });

    var close = $("[data-close-modal]");
    if (close) close.setAttribute("aria-label", t("js.close"));
    var burger = $("#burger");
    if (burger) burger.setAttribute("aria-label", t("js.menu"));

    try { localStorage.setItem("aqyl-lang", code); } catch (e) { /* приватный режим */ }

    // Пересобрать динамические тексты
    renderStoryPage();
    renderClassifier();
    if ($("#scene").dataset.mode === "story") typeStory();
  }

  $$(".lang button").forEach(function (btn) {
    btn.addEventListener("click", function () { applyLang(btn.getAttribute("data-lang")); });
  });

  /* ---------------------------------------------------------------- header */

  var header = $("#header");
  var onScroll = function () { header.classList.toggle("is-stuck", window.scrollY > 8); };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var nav = $("#nav");
  var burger = $("#burger");
  burger.addEventListener("click", function () {
    var open = nav.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", String(open));
  });
  $$("#nav a").forEach(function (a) {
    a.addEventListener("click", function () {
      nav.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
    });
  });

  /* ----------------------------------------------------- hero: робот и сцена */

  var scene = $("#scene");
  var stage = $("#stage");
  var robot = $("#robot");
  var pupils = $$(".robot__pupil", robot);
  var cards = { draw: $("#cardDraw"), story: $("#cardStory"), game: $("#cardGame") };

  // Взгляд следит за курсором/пальцем, корпус слегка наклоняется (лёгкий 3D).
  var pointer = { x: 0, y: 0, active: false };
  var rafPending = false;

  function trackFrame() {
    rafPending = false;
    var box = stage.getBoundingClientRect();
    if (!box.width) return;
    var nx = Math.max(-1, Math.min(1, (pointer.x - (box.left + box.width / 2)) / (box.width / 2)));
    var ny = Math.max(-1, Math.min(1, (pointer.y - (box.top + box.height / 2)) / (box.height / 2)));

    pupils.forEach(function (p) {
      p.setAttribute("transform", "translate(" + (nx * 6).toFixed(2) + "," + (ny * 5).toFixed(2) + ")");
    });
    if (!reduceMotion) {
      stage.style.transform = "rotateY(" + (nx * 7).toFixed(2) + "deg) rotateX(" + (-ny * 5).toFixed(2) + "deg)";
    }
  }

  function onPointer(e) {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if (!rafPending) { rafPending = true; requestAnimationFrame(trackFrame); }
  }

  idle(function () {
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    document.addEventListener("pointerleave", function () {
      pupils.forEach(function (p) { p.setAttribute("transform", "translate(0,0)"); });
      stage.style.transform = "";
    });

    if (!reduceMotion) {
      (function blink() {
        setTimeout(function () {
          robot.classList.add("is-blinking");
          setTimeout(function () { robot.classList.remove("is-blinking"); }, 130);
          blink();
        }, 2600 + Math.random() * 3600);
      })();
    }
  });

  /* --- режимы: рисовать / сочинять / создавать игру --- */

  var PALETTE = ["#5b4be8", "#2f7bff", "#16c79a", "#ffc93c", "#ff6b6b"];
  var storyTimer = null;

  function paintArt() {
    var art = $("#canvasArt");
    var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
    var parts = [
      '<rect width="200" height="150" fill="#eaf3ff"/>',
      '<circle cx="' + (30 + Math.random() * 40) + '" cy="34" r="16" fill="#ffc93c" data-paint style="animation-delay:.05s"/>',
      '<path d="M0 112 Q50 ' + (70 + Math.random() * 24) + ' 100 108 T200 104 V150 H0Z" fill="' + pick(PALETTE) + '" opacity=".85" data-paint style="animation-delay:.25s"/>',
      '<path d="M40 118 l26-44 26 44Z" fill="' + pick(PALETTE) + '" data-paint style="animation-delay:.45s"/>',
      '<rect x="112" y="' + (86 + Math.random() * 10) + '" width="46" height="34" rx="8" fill="#fff" stroke="' + pick(PALETTE) + '" stroke-width="4" data-paint style="animation-delay:.65s"/>',
      '<circle cx="' + (150 + Math.random() * 20) + '" cy="52" r="' + (8 + Math.random() * 8) + '" fill="' + pick(PALETTE) + '" data-paint style="animation-delay:.85s"/>'
    ];
    art.innerHTML = '<svg viewBox="0 0 200 150" role="img" aria-label="Рисунок, сгенерированный на уроке">' + parts.join("") + "</svg>";
  }

  function typeStory() {
    var box = $("#storyText");
    var card = $("#cardStory");
    var text = t("js.sceneStory");
    clearInterval(storyTimer);
    card.classList.remove("is-done");
    if (reduceMotion) { box.textContent = text; card.classList.add("is-done"); return; }
    box.textContent = "";
    var i = 0;
    storyTimer = setInterval(function () {
      box.textContent = text.slice(0, ++i);
      if (i >= text.length) { clearInterval(storyTimer); card.classList.add("is-done"); }
    }, 24);
  }

  function buildPix() {
    var grid = $("#pixGrid");
    var html = "";
    for (var i = 0; i < 24; i++) {
      html += '<i style="background:' + PALETTE[i % PALETTE.length] + ';animation-delay:' + (i % 6) * 0.09 + 's"></i>';
    }
    grid.innerHTML = html;
  }

  function setMode(mode) {
    var next = scene.dataset.mode === mode ? "idle" : mode;
    scene.dataset.mode = next;

    $$("[data-mode-btn]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-mode-btn") === next));
    });
    Object.keys(cards).forEach(function (k) { cards[k].classList.toggle("is-on", k === next); });

    if (next === "draw") paintArt();
    if (next === "story") typeStory(); else clearInterval(storyTimer);
    if (next === "game") buildPix();
  }

  $$("[data-mode-btn]").forEach(function (btn) {
    btn.addEventListener("click", function () { setMode(btn.getAttribute("data-mode-btn")); });
  });

  /* ----------------------------------------------------------------- табы */

  var tabs = $$(".tab");
  function selectTab(idx) {
    tabs.forEach(function (tab, i) {
      var on = i === idx;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      $("#" + tab.getAttribute("aria-controls")).hidden = !on;
    });
  }
  tabs.forEach(function (tab, i) {
    tab.tabIndex = i === 0 ? 0 : -1;
    tab.addEventListener("click", function () { selectTab(i); });
    tab.addEventListener("keydown", function (e) {
      var next = null;
      if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
      if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
      if (e.key === "Home") next = 0;
      if (e.key === "End") next = tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      selectTab(next);
      tabs[next].focus();
    });
  });

  /* -------------------------------------------------- витрина: сказка */

  var STORY_KEYS = ["show.w1.page1", "js.w1.p2", "js.w1.p3", "js.w1.p4", "js.w1.end"];
  var storyPage = 0;

  function renderStoryPage() {
    var out = $("#demoStory");
    var btn = $("#btnStoryNext");
    if (!out || !btn) return;
    out.innerHTML = "<p>" + t(STORY_KEYS[storyPage]) + "</p>";
    btn.textContent = storyPage === STORY_KEYS.length - 1 ? t("js.w1.again") : t("show.w1.btn");
  }

  $("#btnStoryNext").addEventListener("click", function () {
    storyPage = (storyPage + 1) % STORY_KEYS.length;
    renderStoryPage();
  });

  /* ------------------------------------------- витрина: классификатор */

  var ANIMALS = {
    cat: { pet: true, conf: 96 },
    wolf: { pet: false, conf: 93 },
    hamster: { pet: true, conf: 91 },
    fox: { pet: false, conf: 74, note: true }
  };
  var picked = null;

  function renderClassifier() {
    var out = $("#clsOut");
    var meter = $("#clsMeter");
    if (!out || !meter) return;
    if (!picked) {
      out.textContent = t("show.w2.hint");
      meter.style.width = "0";
      return;
    }
    var a = ANIMALS[picked];
    var text = t(a.pet ? "js.cls.pet" : "js.cls.wild")
      .replace("{a}", t("js.animal." + picked))
      .replace("{c}", String(a.conf));
    if (a.note) text += t("js.cls.note");
    out.textContent = text;
    meter.style.width = a.conf + "%";
  }

  $$("#clsChips .chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      picked = chip.getAttribute("data-animal");
      $$("#clsChips .chip").forEach(function (c) {
        c.setAttribute("aria-pressed", String(c === chip));
      });
      renderClassifier();
    });
  });

  /* --------------------------------------------- витрина: мини-игра */

  $$("#gameChips .chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      var answer = chip.getAttribute("data-answer");
      $$("#gameChips .chip").forEach(function (c) {
        c.setAttribute("aria-pressed", String(c === chip));
      });
      $("#gameOut").textContent = t(answer === "crystal" ? "js.game.crystal" : "js.game.cat");
      if (answer === "crystal") confetti(chip);
    });
  });

  /* ----------------------------------------------------------- конфетти */

  function confetti(anchor) {
    if (reduceMotion) return;
    var layer = document.createElement("div");
    layer.className = "confetti-layer";
    var box = anchor ? anchor.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
    var ox = box.left + box.width / 2;
    var oy = box.top + box.height / 2;
    var html = "";
    for (var i = 0; i < 70; i++) {
      html += '<i style="left:' + ox + 'px;top:' + oy + 'px;background:' + PALETTE[i % PALETTE.length] +
        ";--dx:" + (Math.random() * 460 - 230).toFixed(0) + "px;--rot:" + (Math.random() * 900 - 450).toFixed(0) +
        "deg;animation-delay:" + (Math.random() * 0.25).toFixed(2) + 's"></i>';
    }
    layer.innerHTML = html;
    document.body.appendChild(layer);
    setTimeout(function () { layer.remove(); }, 2000);
  }

  /* ------------------------------------------------------------- формы */

  var RE_MAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  var digits = function (v) { return (v.match(/\d/g) || []).length; };

  function validate(input) {
    var v = input.value.trim();
    var ok;
    if (input.type === "tel") ok = digits(v) >= 10;
    else if (input.name === "contact") ok = RE_MAIL.test(v) || digits(v) >= 10;
    else ok = v.length >= 2;
    input.setAttribute("aria-invalid", String(!ok));
    return ok;
  }

  function wireForm(form, onDone) {
    if (!form) return;
    $$("input", form).forEach(function (input) {
      input.addEventListener("input", function () {
        if (input.getAttribute("aria-invalid") === "true") validate(input);
      });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var bad = null;
      $$("input[required]", form).forEach(function (input) {
        if (!validate(input) && !bad) bad = input;
      });
      if (bad) { bad.focus(); return; }
      // Демо-лендинг: реальная отправка подключается на бэкенде.
      form.classList.add("is-sent");
      confetti(form.querySelector("button[type=submit]"));
      if (onDone) onDone();
    });
  }

  wireForm($("#formSchool"));
  wireForm($("#formLead"));
  wireForm($("#formTrial"));

  /* ------------------------------------------------------------- модалка */

  var modal = $("#modal");
  var lastFocus = null;

  function openModal() {
    lastFocus = document.activeElement;
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    var first = modal.querySelector("input, select, button");
    if (first) first.focus();
  }

  function closeModal() {
    modal.classList.remove("is-open");
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  $$("[data-open-modal]").forEach(function (b) { b.addEventListener("click", openModal); });
  $$("[data-close-modal]").forEach(function (b) { b.addEventListener("click", closeModal); });
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });

  document.addEventListener("keydown", function (e) {
    if (!modal.classList.contains("is-open")) return;
    if (e.key === "Escape") { closeModal(); return; }
    if (e.key !== "Tab") return;
    var focusable = $$('a[href], button, input, select, [tabindex]:not([tabindex="-1"])', modal)
      .filter(function (el) { return el.offsetParent !== null; });
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ------------------------------------------------- появление при скролле */

  idle(function () {
    var items = $$(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  });

  /* ------------------------------------------------------------- запуск */

  $("#year").textContent = String(new Date().getFullYear());

  var saved = null;
  try { saved = localStorage.getItem("aqyl-lang"); } catch (e) { /* нет доступа к storage */ }
  applyLang(saved || "ru");
  renderStoryPage();
  renderClassifier();
})();
