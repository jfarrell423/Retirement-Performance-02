(function () {
  const $ = (id) => document.getElementById(id);

  const els = {
    startDate: $("startDate"),
    endDate: $("endDate"),
    beginBal: $("beginBal"),
    endBal: $("endBal"),
    netFlow: $("netFlow"),
    flowTiming: $("flowTiming"),
    showCagr: $("showCagr"),
    daysOut: $("daysOut"),
    yearsOut: $("yearsOut"),
    gainDollar: $("gainDollar"),
    gainPct: $("gainPct"),
    adjGainDollar: $("adjGainDollar"),
    adjGainPct: $("adjGainPct"),
    cagrOut: $("cagrOut"),
    cagrRow: $("cagrRow"),
    calcBtn: $("calcBtn"),
    saveBtn: $("saveBtn"),
    loadBtn: $("loadBtn"),
    clearBtn: $("clearBtn"),
    saveMsg: $("saveMsg"),
  };

  const STORAGE_KEY = "portfolio_gain_range_v1";

  function parseMoney(v) {
    if (v == null) return NaN;
    const cleaned = String(v).replace(/[$, ]/g, "").trim();
    if (!cleaned) return NaN;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
  }

  function fmtMoney(n) {
    if (!Number.isFinite(n)) return "—";
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    return sign + abs.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function fmtPct(n) {
    if (!Number.isFinite(n)) return "—";
    return (n * 100).toFixed(2) + "%";
  }

  function daysBetween(d1, d2) {
    const a = new Date(d1 + "T00:00:00");
    const b = new Date(d2 + "T00:00:00");
    const ms = b - a;
    return Math.round(ms / (1000 * 60 * 60 * 24));
  }

  function clampPositive(n, fallback = NaN) {
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function compute() {
    const sd = els.startDate.value;
    const ed = els.endDate.value;

    let days = NaN;
    let years = NaN;
    if (sd && ed) {
      days = daysBetween(sd, ed);
      years = days / 365.2425;
      els.daysOut.textContent = Number.isFinite(days) ? String(days) : "—";
      els.yearsOut.textContent = Number.isFinite(years) ? years.toFixed(4) : "—";
    } else {
      els.daysOut.textContent = "—";
      els.yearsOut.textContent = "—";
    }

    const begin = parseMoney(els.beginBal.value);
    const end = parseMoney(els.endBal.value);
    const flow = parseMoney(els.netFlow.value);
    const timing = els.flowTiming.value;

    // Simple gain
    let simpleGainDollar = NaN;
    let simpleGainPct = NaN;
    if (Number.isFinite(begin) && Number.isFinite(end) && begin !== 0) {
      simpleGainDollar = end - begin;
      simpleGainPct = simpleGainDollar / begin;
    }

    // Flow-adjusted approximation:
    // We estimate an "effective starting capital" depending on when net flow happened.
    // deposits positive increase base; withdrawals negative decrease base.
    let adjGainDollar = NaN;
    let adjGainPct = NaN;

    let effectiveBase = begin;

    const hasFlows = Number.isFinite(flow) && flow !== 0;

    if (Number.isFinite(begin) && Number.isFinite(end)) {
      if (hasFlows) {
        if (timing === "start") {
          effectiveBase = begin + flow;
        } else if (timing === "mid") {
          effectiveBase = begin + flow * 0.5;
        } else if (timing === "end") {
          effectiveBase = begin + flow * 0.1; // near end -> little time to affect gains
        } else {
          effectiveBase = begin; // none
        }
        // Performance gain in dollars estimated as:
        // end = begin + flow + performance
        adjGainDollar = end - begin - flow;
        const denom = effectiveBase;
        adjGainPct = denom !== 0 ? adjGainDollar / denom : NaN;
      } else {
        // No flows: same as simple
        adjGainDollar = simpleGainDollar;
        adjGainPct = simpleGainPct;
      }
    }

    // CAGR (annualized) based on adjusted return if possible
    const wantCagr = els.showCagr.value === "yes";
    els.cagrRow.style.display = wantCagr ? "" : "none";

    let cagr = NaN;
    if (wantCagr && Number.isFinite(years) && years > 0) {
      const r = hasFlows ? adjGainPct : simpleGainPct;
      if (Number.isFinite(r)) {
        // Handle r > -1
        if (1 + r > 0) {
          cagr = Math.pow(1 + r, 1 / years) - 1;
        }
      }
    }

    // Output
    els.gainDollar.textContent = fmtMoney(simpleGainDollar);
    els.gainPct.textContent = fmtPct(simpleGainPct);
    els.adjGainDollar.textContent = fmtMoney(adjGainDollar);
    els.adjGainPct.textContent = fmtPct(adjGainPct);
    els.cagrOut.textContent = fmtPct(cagr);

    // Colorize % fields
    colorize(els.gainPct, simpleGainPct);
    colorize(els.adjGainPct, adjGainPct);
    colorize(els.cagrOut, cagr);
  }

  function colorize(el, val) {
    el.classList.remove("ok", "bad");
    if (!Number.isFinite(val)) return;
    if (val > 0) el.classList.add("ok");
    else if (val < 0) el.classList.add("bad");
  }

  function save() {
    const data = {
      startDate: els.startDate.value,
      endDate: els.endDate.value,
      beginBal: els.beginBal.value,
      endBal: els.endBal.value,
      netFlow: els.netFlow.value,
      flowTiming: els.flowTiming.value,
      showCagr: els.showCagr.value,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    els.saveMsg.textContent = "Saved to this browser/device.";
  }

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      els.saveMsg.textContent = "Nothing saved yet on this browser/device.";
      return;
    }
    const data = JSON.parse(raw);
    els.startDate.value = data.startDate || "";
    els.endDate.value = data.endDate || "";
    els.beginBal.value = data.beginBal || "";
    els.endBal.value = data.endBal || "";
    els.netFlow.value = data.netFlow || "";
    els.flowTiming.value = data.flowTiming || "mid";
    els.showCagr.value = data.showCagr || "yes";
    els.saveMsg.textContent = "Loaded saved values.";
    compute();
  }

  function clearAll() {
    els.startDate.value = "";
    els.endDate.value = "";
    els.beginBal.value = "";
    els.endBal.value = "";
    els.netFlow.value = "0";
    els.flowTiming.value = "mid";
    els.showCagr.value = "yes";
    els.saveMsg.textContent = "";
    compute();
  }

  // Wire up
  ["startDate","endDate","beginBal","endBal","netFlow","flowTiming","showCagr"].forEach((k) => {
    els[k].addEventListener("input", compute);
    els[k].addEventListener("change", compute);
  });

  els.calcBtn.addEventListener("click", compute);
  els.saveBtn.addEventListener("click", save);
  els.loadBtn.addEventListener("click", load);
  els.clearBtn.addEventListener("click", clearAll);

  // Sensible defaults
  els.netFlow.value = "0";
  compute();
})();

