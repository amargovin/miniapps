/* Swarajya PRO — pricing calculator + page interactions. Vanilla JS, no deps. */

(function () {
  "use strict";

  var LIST_PRICE = 1999; // ₹ per seat / year (digital list, before GST)
  var GST_RATE = 0.18; // applies to DIGITAL only
  var PRINT_ADDON = 400; // ₹ per seat / year added for print; print is GST-exempt
  var MIN_SEATS = 5;
  var MAX_SEATS = 500;
  var RANGE_MAX = 60; // slider caps here; typed input can go higher
  var JOIN_URL = "https://join.swarajyamag.com/pro";

  // Discount tiers:
  //   5–10 → 10%   ·   11–20 → 20%   ·   21+ → 30%
  function discountFor(seats) {
    if (seats <= 10) return 0.10;
    if (seats <= 20) return 0.20;
    return 0.30;
  }

  // Flat indiaBUILD contribution added to the total (GST-exempt):
  //   5–9 seats → ₹5,000   ·   10+ seats → ₹10,000
  function indiaBuildFor(seats) {
    return seats < 10 ? 5000 : 10000;
  }

  function inr(n) {
    return "₹" + Math.round(n).toLocaleString("en-IN");
  }

  var plan = "digital"; // "digital" | "print"
  var currentSeats = MIN_SEATS;

  var numEl = document.getElementById("seatNum");
  var rangeEl = document.getElementById("seatRange");
  var minusEl = document.getElementById("seatMinus");
  var plusEl = document.getElementById("seatPlus");

  var planDigital = document.getElementById("planDigital");
  var planPrint = document.getElementById("planPrint");

  var lineSeats = document.getElementById("lineSeats");
  var lineList = document.getElementById("lineList");
  var lineDiscLbl = document.getElementById("lineDiscLbl");
  var lineDisc = document.getElementById("lineDisc");
  var printRow = document.getElementById("printRow");
  var linePrintLbl = document.getElementById("linePrintLbl");
  var linePrint = document.getElementById("linePrint");
  var subLbl = document.getElementById("subLbl");
  var lineSub = document.getElementById("lineSub");
  var gstRow = document.getElementById("gstRow");
  var lineGst = document.getElementById("lineGst");
  var lineIb = document.getElementById("lineIb");
  var lineTotal = document.getElementById("lineTotal");
  var linePerSeat = document.getElementById("linePerSeat");
  var calcCta = document.getElementById("calcCta");
  var entNote = document.getElementById("entNote");

  function clampSeats(v) {
    v = parseInt(v, 10);
    if (isNaN(v)) v = MIN_SEATS;
    if (v < MIN_SEATS) v = MIN_SEATS;
    if (v > MAX_SEATS) v = MAX_SEATS;
    return v;
  }

  function joinUrl(seats, amount, type) {
    return JOIN_URL + "?seats=" + seats + "&amount=" + amount + "&type=" + type;
  }

  function render(seats) {
    var disc = discountFor(seats);
    var discPct = Math.round(disc * 100);
    var list = seats * LIST_PRICE;
    var discAmt = list * disc;
    var digitalSub = list - discAmt; // discounted digital, ex-GST
    var digitalPerSeat = LIST_PRICE * (1 - disc);

    lineSeats.textContent = seats + " seats × " + inr(LIST_PRICE);
    lineList.textContent = inr(list);
    lineDiscLbl.textContent = "Volume discount (" + discPct + "%)";
    lineDisc.textContent = "−" + inr(discAmt);

    // Flat indiaBUILD contribution, added to the total. It is taxable, so for
    // the digital plan GST applies to it too (it sits in the pre-GST base).
    var indiaBuild = indiaBuildFor(seats);
    lineIb.textContent = "+" + inr(indiaBuild);

    var total, perSeat, note, type, amountBase;

    if (plan === "print") {
      // Print: digital discounted price + ₹400/seat + indiaBUILD, all GST-free.
      var printAdd = seats * PRINT_ADDON;
      printRow.style.display = "";
      linePrintLbl.textContent = "Print delivery (" + seats + " × ₹400)";
      linePrint.textContent = "+" + inr(printAdd);
      subLbl.textContent = "Digital subtotal";
      lineSub.textContent = inr(digitalSub);
      gstRow.style.display = "none";
      total = digitalSub + printAdd + indiaBuild;
      amountBase = total; // no GST anywhere for print
      perSeat = digitalPerSeat + PRINT_ADDON;
      note = "GST-free";
      type = "print";
      linePerSeat.textContent = "≈ " + inr(perSeat) + " / seat / year (incl. print)";
    } else {
      // Digital: GST applies to (subscription + indiaBUILD). GST is added by the
      // checkout, so the URL carries the PRE-GST base (both parts) to avoid
      // double-charging.
      printRow.style.display = "none";
      subLbl.textContent = "Subtotal (ex-GST)";
      lineSub.textContent = inr(digitalSub);
      var taxable = digitalSub + indiaBuild;
      gstRow.style.display = "";
      lineGst.textContent = inr(taxable * GST_RATE);
      total = taxable * (1 + GST_RATE);
      amountBase = taxable; // pre-GST; checkout adds the 18%
      perSeat = digitalPerSeat;
      note = "incl. GST";
      type = "digital";
      linePerSeat.textContent = "≈ " + inr(perSeat) + " / seat / year + GST";
    }

    lineTotal.innerHTML = inr(total) + " <small>" + note + "</small>";

    // `amount` is the full PRE-GST payable base (subscription + print + indiaBUILD
    // as applicable); checkout adds 18% GST for digital, nothing for print.
    var amount = Math.round(amountBase);
    calcCta.textContent = "Buy now — " + seats + " seats →";
    calcCta.href = joinUrl(seats, amount, type);

    if (seats >= 50) {
      entNote.innerHTML =
        "Buying for a larger team? <a href='mailto:pro@swarajyamag.com?subject=Swarajya%20PRO%20—%20larger%20team%20enquiry'>Talk to us.</a>";
    } else {
      entNote.innerHTML = "";
    }
  }

  function setSeats(v, syncRange) {
    currentSeats = clampSeats(v);
    numEl.value = currentSeats;
    if (syncRange !== false) {
      rangeEl.value = Math.min(currentSeats, RANGE_MAX);
    }
    render(currentSeats);
  }

  function setPlan(p) {
    plan = p;
    planDigital.classList.toggle("active", p === "digital");
    planPrint.classList.toggle("active", p === "print");
    render(currentSeats);
  }

  // Plan toggle
  planDigital.addEventListener("click", function () { setPlan("digital"); });
  planPrint.addEventListener("click", function () { setPlan("print"); });

  // Seat inputs
  rangeEl.addEventListener("input", function () {
    setSeats(rangeEl.value, false);
  });
  numEl.addEventListener("input", function () {
    currentSeats = clampSeats(numEl.value);
    rangeEl.value = Math.min(currentSeats, RANGE_MAX);
    render(currentSeats);
  });
  numEl.addEventListener("blur", function () {
    setSeats(numEl.value);
  });
  minusEl.addEventListener("click", function () {
    setSeats(clampSeats(numEl.value) - 1);
  });
  plusEl.addEventListener("click", function () {
    setSeats(clampSeats(numEl.value) + 1);
  });

  // FAQ accordion
  var faq = document.getElementById("faqList");
  if (faq) {
    faq.addEventListener("click", function (e) {
      var btn = e.target.closest(".faq-q");
      if (!btn) return;
      var item = btn.parentElement;
      var answer = item.querySelector(".faq-a");
      var isOpen = item.classList.toggle("open");
      answer.style.maxHeight = isOpen ? answer.scrollHeight + "px" : "0";
    });
  }

  // Footer year
  var yr = document.getElementById("year");
  if (yr) yr.textContent = String(new Date().getFullYear());

  // Init
  setSeats(MIN_SEATS);
})();
